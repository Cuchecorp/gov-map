---
phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default
plan: 03
subsystem: cruces
tags: [cruces, clasificacion, sector, golden, cli, writer, deny-by-default, CRUCE-02]
requires:
  - "@obs/cruces clasificarFicha/clasificarContraparte + ClasificacionSectorSchema (36-02)"
  - "@obs/cruces MockClasificadorProvider keyed (36-02)"
  - "supabase/migrations/0038 sector_id en proyecto_ficha/lobby_contraparte/donante (36-01, apply=Plan 04)"
  - "@obs/llm DeepSeekProvider/MiniMaxProvider + assertNoRutInLlmInput"
provides:
  - "SupabaseCrucesWriter (actualizarSectorFicha/actualizarSectorContraparte, service-role, sin LLM)"
  - "golden de sector single-label top-1 + abstencion + gate >=7/10 (evaluarGolden/gatePasa/GOLDEN_SET_GATE)"
  - "clasificar-fichas-cli (DeepSeek) + clasificar-lobby-cli (MiniMax), batch dry-run/degrade"
affects:
  - "Plan 04 (corrida LIVE que puebla sector_id + apply remoto 0038/0039/0040)"
tech-stack:
  added: []
  patterns:
    - "two-stage (D-13): writer service-role SOLO UPDATE; jamas llama al LLM (grep-enforced)"
    - "degrade-to-dry-run sin service key (NUNCA silent no-write); --service-key empty-value fail-fast"
    - "scoring single-label top-1 + abstencion: null=no-cubierto (no error), sector-distinto=error"
key-files:
  created:
    - packages/cruces/src/writer-supabase.ts
    - packages/cruces/src/clasificar-fichas-cli.ts
    - packages/cruces/src/clasificar-lobby-cli.ts
    - packages/cruces/src/golden/golden-set.ts
    - packages/cruces/src/golden/golden-set.test.ts
    - packages/cruces/src/golden/casos.json
  modified:
    - packages/cruces/src/index.ts
    - packages/cruces/tsconfig.json
decisions:
  - "actualizarSectorContraparte usa la clave natural (identificador, nombre[, rol]) de lobby_contraparte (0021 unique)"
  - "GOLDEN_SET_GATE = los 10 casos muestra:true (no-null); el gate >=7/10 NO se mide sobre los ~40 (que incluyen abstenciones esperadas)"
  - "casos.json validado por zod al cargar (z.enum(SECTOR_CODIGOS).nullable()): un codigo fuera de taxonomia rompe el test, no se cuela"
  - "tsconfig include src/**/*.json para que tsc -b vea casos.json (resolveJsonModule ya estaba en la base)"
metrics:
  duration: ~8min
  completed: 2026-06-24
  tasks: 3
  files: 8
---

# Phase 36 Plan 03: CLIs + writer + golden del etiquetado de sector Summary

Pipeline derivado de etiquetado de sector (CRUCE-02) cerrado como etapa batch separada del writer: writer service-role que SOLO hace UPDATE de `sector_id` (jamas toca el LLM, D-13), golden propio con scoring single-label top-1 + abstencion y gate >=7/10, y los dos CLIs batch (fichas DeepSeek / lobby MiniMax) con degrade-to-dry-run. Todo verde en CI con mock-provider (sin red). La corrida LIVE que realmente puebla `sector_id` vive en Plan 04.

## What Was Built

### Task 1 — writer-supabase.ts (etapa derivada, sin LLM)
`SupabaseCrucesWriter` espeja `SupabaseFichasWriter`: `createClient` sin sesion (bypassa la RLS deny-by-default de `lobby_contraparte`), service key NUNCA interpolada en errores (solo `error.message` de PostgREST, T-36-09), `chunk`/`dedupePorClave` para batch UPDATE.
- `actualizarSectorFicha(boletin, sector_id)` → `.update({ sector_id }).eq('boletin', boletin)` sobre `proyecto_ficha`.
- `actualizarSectorContraparte(identificador, nombre, sector_id, rol?)` → UPDATE sobre `lobby_contraparte` por su clave natural `(identificador, nombre[, rol])`.
- `null` escribe NULL = honest no-match (D-05).
- El writer NO importa ni invoca clasificacion/provider/LLM — verificado por grep (two-stage, D-13).

### Task 2 — golden de sector (single-label top-1 + abstencion) + gate >=7/10
- `casos.json`: 40 casos `{ id, tipo:'ficha'|'contraparte', muestra?, input, sector_codigo|null }`. 10 marcados `muestra:true` (no-null, ambos tipos) + 30 de cobertura (incl. 5 abstenciones esperadas con `sector_codigo:null`).
- `golden-set.ts`: estructura espejada de fichas (`CasoGolden`, `MetricasGolden`, `evaluarGolden`, `GOLDEN_SET_GATE`) pero SCORING REEMPLAZADO (D-07/D-08):
  - `actual === expected` → correcto (cubierto).
  - `actual === null` → no-cubierto (baja cobertura, NUNCA error — Pitfall 3).
  - `actual !== null && actual !== expected` → misclasificacion (error).
  - `cobertura = correctos/total`; `errores = misclasificaciones`; `gatePasa = cobertura>=0.7 && errores===0`.
- `golden-set.test.ts`: corre `evaluarGolden` con el mock + los 3 casos de behavior (10-correctos→pasa; 10-abstencion→0 cobertura/0 errores/gate falla por cobertura; 1-sector-distinto→1 error/gate falla aunque cobertura 9/10). Bloque LIVE gated por `CRUCES_GOLDEN_LIVE=1` (DeepSeek+MiniMax reales) — skip en CI.

### Task 3 — clasificar-fichas-cli.ts (DeepSeek) + clasificar-lobby-cli.ts (MiniMax)
Ambos espejan la SHAPE de `pipeline-cli.ts` (NO su extraccion):
- `parseArgs` fail-fast con `--service-key` empty-value guard y `--limite` entero>0 guard.
- `decidirDryRun({serviceKey, dryRun})`: sin service key → dry-run con AVISO explicito (nunca silent no-write).
- env-driven (`SUPABASE_URL`/`SUPABASE_SECRET_KEY` + `DEEPSEEK_API_KEY` / `MINIMAX_API_KEY`); `isMain` por regex de filename.
- Flujo: selecciona filas (`proyecto_ficha` con idea_matriz/titulo/materia; `lobby_contraparte` por identificador/nombre/rol) → clasifica → en NO-dry hace UPDATE via el writer. El CLI de lobby hereda el RUT-gate de `clasificarContraparte` (un RUT en el nombre lanza con 0 llamadas, T-36-06).
- `--dry-run` reporta cobertura de la muestra (>=70% = gate CRUCE-02) sin escribir.
- NO reusa el pipeline de extraccion literal (texto fuente, conector Senado, R2, --reembed/--boletines) — verificado por grep.

## Comandos de los CLIs (para Plan 04)

```
# Fichas (proyectos, publico/bulk → DeepSeek):
tsx packages/cruces/src/clasificar-fichas-cli.ts --limite 50 [--dry-run] [--service-key K]
#   env: SUPABASE_URL, SUPABASE_SECRET_KEY, DEEPSEEK_API_KEY

# Contrapartes de lobby (sensible/critical → MiniMax, RUT-gate):
tsx packages/cruces/src/clasificar-lobby-cli.ts --limite 50 [--dry-run] [--service-key K]
#   env: SUPABASE_URL, SUPABASE_SECRET_KEY, MINIMAX_API_KEY
```
Sin `--service-key` ni `SUPABASE_SECRET_KEY` → corrida dry-run automatica con aviso (no escribe). `--dry-run` con key presente lee y reporta cobertura sin escribir.

## Gate del golden (consumido por Plan 04)

`CRUCES_GOLDEN_LIVE=1` (+ `DEEPSEEK_API_KEY` + `MINIMAX_API_KEY`) activa la corrida LIVE del golden que mide la cobertura real de DeepSeek/MiniMax contra `gatePasa` (cobertura >=0.7 sobre la muestra de 10 Y cero misclasificaciones). Es la compuerta de calidad ANTES de poblar `sector_id` en PROD.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig no incluia JSON → tsc -b fallaba (TS6307)**
- **Found during:** Task 2 (typecheck tras importar `casos.json`).
- **Issue:** `include: ["src/**/*.ts"]` no lista los `.json`; `tsc -b` rechaza el import del golden.
- **Fix:** anadido `"src/**/*.json"` al `include` de `packages/cruces/tsconfig.json` (`resolveJsonModule` ya estaba en la base).
- **Files modified:** packages/cruces/tsconfig.json
- **Commit:** d23cec1

**2. [Rule 3 - Blocking] Comentarios disparaban los greps negativos de verificacion**
- **Found during:** Tasks 1 y 3 (verify automatizado).
- **Issue:** los comentarios mencionaban literalmente `clasificar`/`provider` (writer) y `correrPipeline/obtenerTextoFuente/SenadoConnector` (fichas-cli), tripeando el `! grep -qiE ...` que exige cero ocurrencias.
- **Fix:** reformulados los comentarios sin esos tokens literales (el invariante two-stage / no-reuso de extraccion se mantiene en codigo). Grep limpio.
- **Files modified:** packages/cruces/src/writer-supabase.ts, packages/cruces/src/clasificar-fichas-cli.ts
- **Commits:** 91e15f8, 98c90a7

## Verification

- `pnpm --filter @obs/cruces typecheck` → verde (`tsc -b`).
- `pnpm --filter @obs/cruces test` → 14 passed, 1 skipped (LIVE gated).
- Task 1 grep: writer sin `clasificar|complete(|provider`; contiene `actualizarSectorContraparte`.
- Task 3 grep: ambos CLIs contienen `decidirDryRun`; fichas-cli sin `correrPipeline|obtenerTextoFuente|SenadoConnector`.

## Notes for Plan 04

- Apply remoto 0038/0039/0040 + pgTAP siguen siendo checkpoint de operador (BLOCKING, ver STATE.md blockers).
- La corrida LIVE que puebla `sector_id` usa estos dos CLIs (con service key real) + el golden LIVE como gate previo.
- `lobby_contraparte` es deny-by-default; el writer usa service-role para bypassarlo (correcto para etapa-2 de escritura).

## Self-Check: PASSED
