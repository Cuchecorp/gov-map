---
phase: 119-cron-fix-robustez-de-ingesta
verified: 2026-07-28T20:05:00Z
status: human_needed
score: 4/4 success criteria + 20/20 plan truths verified
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Correr LOCALMENTE `seed-cli` de identity con `.env` completo (SUPABASE_API_URL + SUPABASE_SECRET_KEY + R2_*) y luego `select source, count(*) from source_snapshot group by 1`"
    expected: "Aparece una fila con source = 'identity' (hoy hay 4 fuentes: agenda, infoprobidad, leyes, lobby-leylobby)"
    why_human: "El código está montado y verificado (buildSnapshotWriter + snapshotWriter.write en seed-cli.ts:305-334), pero `backup-parlamentario.yml` no lleva service key ⇒ el writer queda null en CI por diseño. La fila sólo nace en la corrida local del operador. Limitación DECLARADA en G5."
  - test: "Cargar `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en `gh secret` de Cuchecorp/gov-map (pasos ya emitidos en 118-OPERATOR-CHECKPOINT.md)"
    expected: "`gh secret list --repo Cuchecorp/gov-map` los muestra"
    why_human: "Acto de operador (G8). No bloquea ninguna ingesta."
  - test: "Cargar `GEMINI_API_KEY` en `gh secret` y disparar `fichas-backfill.yml` por workflow_dispatch"
    expected: "La corrida no falla por key ausente; `pnpm freshness` deja de reportar `fichas → n/d (sin corridas)`"
    why_human: "Acto de operador (G9, parte gemini). El dispatch de prueba NO se disparó y así se declara. Hoy `fichas` reporta STALE (gh-failure) — señal honesta, no avería del fix."
  - test: "Re-observar `select jobid,status,start_time from cron.job_run_details where jobid=5` tras un viernes hábil completo"
    expected: "Hay corrida el viernes (el schedule `7 11,14,17,20 * * 1-5` la espera)"
    why_human: "G11 queda ABIERTO en observación: su premisa original fue REFUTADA (2026-07-25 es sábado, no viernes). Necesita una ventana temporal nueva, no código."
---

# Phase 119: CRON-FIX robustez de ingesta — Verification Report

**Phase Goal:** La ingesta programada degrada honesto en vez de fallar en silencio o fabricar: reintentos, cursores, hash-check y señales de frescura cerradas donde faltaban.
**Verified:** 2026-07-28T20:05:00Z
**Status:** human_needed
**Re-verification:** No — verificación inicial

## Goal Achievement

### Success Criteria (ROADMAP §Phase 119)

| # | Criterio | Status | Evidencia |
|---|---|---|---|
| 1 | Cada gap accionable de 118 cerrado en código, o explícitamente diferido como deuda de operador con razón y pasos | ✓ VERIFIED | `119-GAP-CLOSURES.md` tabla §1: 11 gaps de 118 + G12-119 + D-PROB-119, **cero sin estado**. 8 cerrados con puntero archivo:línea; G8 y G9-gemini diferidos con pasos; G11 abierto con criterio y premisa refutada. Guard `check-crons.sh` de 118 con `STRICT=1` → `RESULTADO: 0 falta(s)`, exit 0 |
| 2 | Un cron que no puede obtener datos deja señal honesta y JAMÁS escribe filas inventadas | ✓ VERIFIED | Tests: `ingest-run.test.ts:54` "(a) drift estructural → CUARENTENA: 0 filas + degradación, NUNCA escribe"; `:90` "(b) institución inalcanzable (503) → degradación honesta, NO aborta, 0 filas"; `:306` "corrida degradada (503) ⇒ NINGÚN cursor avanza". CR-02/03 fixed: `ingest-run.ts:299-315` y `run-camara-lobby.ts:198-206` — `if (f.fecha == null) continue`, **cero fallback al reloj** |
| 3 | Dos etapas LOCKED + hash-check respetados en cada conector tocado; rate-limit 2-3s intacto | ✓ VERIFIED (con limitación declarada) | `existed` (412) consumido en los 3 llamadores con `[skip] sin novedades` (agenda:347, probidad:331, identity:322). `--from-r2` en agenda/probidad/lobby-camara/lobby-leylobby. Capa de política intacta: `rate-limiter.ts:15` sigue `minDelayMs default 2000ms (LOCKED 2-3s)`; `git log --name-only` de la fase no toca rate-limit/robots/user-agent. Limitación: probidad tiene el orden de etapas invertido → `D-PROB-119` declarado |
| 4 | `pnpm freshness` refleja el estado real por fuente tras los fixes | ✓ VERIFIED | Ejecutado en vivo: `pnpm freshness --json` emite JSON desde la raíz (G10), **cero líneas `HTTP 404`** en stderr (G2), 10 fuentes + bloque `pgCron` de los 5 jobs con schedule vivo = esperado (G3). G4 muerde: `fichas` → `STALE (gh-failure)` por `ghRun: "n/d (sin corridas)"` con 17 días < umbral 30 — **stale por ghRun solo**; `lobby-camara` → `STALE (dias>umbral)` sobre `lobby_contraparte` (tabla propia) |

**Score:** 4/4 criterios · 20/20 truths de los 7 planes

### Observable Truths por plan

| Plan | Truth | Status | Evidencia |
|---|---|---|---|
| 01 | `pnpm freshness --json` corre desde la raíz (G10) | ✓ | `package.json:13` `"freshness": "tsx packages/freshness/src/cli.ts"`; ejecutado, primer carácter `{` |
| 01 | Sin líneas HTTP 404 por workflows inexistentes (G2) | ✓ | `catalog.ts:468,494` `workflowYml: null` ×2 (chilecompra, servel); `query-runner.ts:185` omite `ghRunSignal` cuando es null; stderr limpio en la corrida real |
| 01 | Una señal con workflow fallado/sin correr puede reportar stale:true por sí sola (G4) | ✓ | `evaluate.ts:49 ghRunEsAveria()` + `:113 stale = staleTemporal \|\| ghRunEsAveria(ghRun)`. Observado en vivo: `fichas` stale con `motivoStale: "gh-failure"` |
| 01 | `lobby-camara` y `fichas` miden tabla propia del cron que nombran (G4) | ✓ | `catalog.ts:408 lobby_contraparte`, `:440 proyecto_ficha` (antes `lobby_audiencia`/`proyecto`) |
| 02 | Avería de `actualidad-refresh` dispara señal propia | ✓ | `catalog.ts:508-513` entrada `actualidad-refresh` / `actualidad_senal` / umbral 2d; en vivo `0 días · OK` |
| 02 | Un job de pg_cron que deja de correr produce stale con umbral derivado del schedule | ✓ | `catalog.ts:312-352` (5 jobids) + `query-runner.ts:291` `select jobid, max(start_time) from cron.job_run_details`; salida viva trae `umbralHoras` derivado (0.25 / 0.5 / 48 / 66) |
| 02 | Huecos deliberados DECLARADOS en catalog.ts | ✓ | `catalog.ts:47` bloque `HUECOS DECLARADOS DE COBERTURA (G3, 119-02)` con W-3 y W-7 |
| 03 | 412 ⇒ `[skip] sin novedades` y NO re-parsea | ✓ | agenda `ingest-run.ts:347,527`; probidad `:331`; identity `seed-cli.ts:322` |
| 03 | En agenda e identity el skip ocurre ANTES de gastar trabajo | ✓ | agenda: guard antes de la Etapa 2 de la tabla (`:507` comentario + `:527` return); identity: `:320-324` antes de la carga |
| 03 | En probidad el 412 queda consumido y visible; reordenación registrada como hallazgo | ✓ | `run-probidad-todos.ts:312-333` + comentario `:324`; `D-PROB-119` en GAP-CLOSURES §3 |
| 03 | En identity el skip salta la CARGA, no el commit del snapshot git | ✓ | `seed-cli.ts:385` "carga a DB omitida, pero --promote SÍ se aplica" |
| 04 | `source_snapshot` tiene filas de agenda, identity y lobby-leylobby | ⚠ PARCIAL (3/4 fuentes observadas) | Código montado y **wired** en los 3 (agenda `run-agenda-prod-cli.ts:247-269`; identity `seed-cli.ts:305-334`; lobby `ingest-cli.ts:409-431` → `ingest-run.ts:178-180`). Observado en vivo: `r2Snapshot` de agenda = 2026-07-28 18:15 y de lobby-leylobby = 2026-07-28 18:49. **identity requiere corrida local del operador** (limitación declarada G5, ver human_verification) |
| 04 | Cada fila lleva source, resource, r2_path, content_hash, fetched_at reales | ✓ | `snapshotWriter.write({...})` en los 3 sitios; timestamps reales en la salida de freshness |
| 04 | Un fallo del snapshot no aborta la ingesta (best-effort) | ✓ | escrituras dentro de try/catch declarado best-effort en los 3 conectores |
| 05 | Re-ingestar agenda y probidad DESDE R2 | ✓ | `run-agenda-prod-cli.ts:140-167` y `run-probidad-todos-cli.ts:135-161`: `parseFromR2Arg` → `getObject` → Etapa 2, con error explícito si falta R2 |
| 05 | Fallback local de lobby-camara deja HTML en R2 y parsea desde R2 | ✓ | `.github/workflows/lobby-camara-weekly.yml:66-74`: `--html-file` persiste el crudo, extrae `r2Path` y emite la línea de replay `--from-r2` |
| 05 | Parsear dos veces el mismo objeto R2 es idempotente | ✓ | replay re-ejecutado en 119-05 contra objeto real (GAP-CLOSURES §4); sha re-verificado contra la key |
| 06 | Tras un lote confirmado, `lobby_ingesta_estado.ingestado_hasta` avanza | ✓ | `ingest-run.ts:308-352` `marcados: Map<id, fechaDato>` → `writer.marcarIngestado(ids, h)`; espejo en `run-camara-lobby.ts:198-219` |
| 06 | Una corrida que degrada NO avanza ningún cursor | ✓ | `if (f.fecha == null) continue` en ambos conectores + test `:306`; `marcados` vacío ⇒ cero escrituras |
| 06 | El archivo explica por qué conviven dos cursores | ✓ | `cursor-leylobby.ts:18` `POR QUÉ DOS CURSORES (G1 / 119-06)` |
| 06 | `fichas-backfill` resuelve `SUPABASE_URL` sin secret inexistente | ✓ | `.github/workflows/fichas-backfill.yml:63-68`: la línea `SUPABASE_URL: ${{ secrets.SUPABASE_URL }}` fue ELIMINADA; queda `SUPABASE_API_URL` (fallback ya presente en `pipeline-cli.ts:150`) |
| 07 | Cada gap de 118 con estado explícito | ✓ | GAP-CLOSURES §1, 13 filas |
| 07 | Degradación honesta aseverada por test u observación | ✓ | ver SC2 |
| 07 | `pnpm freshness` refleja el estado real | ✓ | ver SC4 |
| 07 | Suite, tsc y guards verdes | ✓ | ver más abajo |

### Fixes del code review (CR-01/02/03) — confirmados en código

| CR | Claim | Verificación |
|---|---|---|
| CR-01 | `--from-r2` de leylobby se parseaba y nunca se usaba | ✓ FIXED — `ingest-cli.ts:300` `tareaDesdeR2Path`, `:330` `lector.getObject(fromR2)`, `:335` re-verificación de sha, `:352` log `REPLAY desde R2 — CERO fetch a leylobby.gob.cl`, `:346` fail-loud si el crudo es un LISTADO |
| CR-02 | Cursor leylobby caía al reloj sin fecha del dato | ✓ FIXED — `ingest-run.ts:299-315`: comentario "NO HAY FALLBACK AL RELOJ" + `if (f.fecha == null) continue` |
| CR-03 | Conector de Cámara (el que escribe las 136 filas) seguía marcando con el reloj | ✓ FIXED — `run-camara-lobby.ts:198-206`: la marca sale del máximo de `f.fecha`; `fechaCaptura` queda sólo como provenance |

**No hay regresión de must_haves por los fixes:** el writer compartido conserva la firma `marcarIngestado(ids, hasta)`; los truths de 119-06 siguen satisfechos con el nuevo origen de `hasta`.

### Data-Flow Trace (Level 4)

| Artefacto | Variable | Fuente | Datos reales | Status |
|---|---|---|---|---|
| `packages/freshness/src/cli.ts` | `frescura[]`, `pgCron[]` | psql read-only a PROD | Sí — 10 fuentes con timestamps y 5 jobs con `maxStartTime` vivos | ✓ FLOWING |
| `evaluate.ts` → `stale` | `ghRun` | `gh run list` | Sí — `success @ 2026-07-27`, `failure @ 2026-07-07`, `n/d (sin corridas)` | ✓ FLOWING |
| `SnapshotWriter` (agenda, lobby) | `source_snapshot` | Supabase | Sí — `r2Snapshot` 2026-07-28 para ambas | ✓ FLOWING |
| `SnapshotWriter` (identity) | `source_snapshot` | Supabase | No observado — writer null en CI por ausencia de service key (declarado) | ⚠ HUMAN |
| `marcarIngestado` | `lobby_ingesta_estado.ingestado_hasta` | fecha máxima del dato | Sí, pero sin avance real: `136 \| 2026-06-22` antes y después — la cobertura vieja es REAL | ✓ FLOWING (honesto) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Suite de packages | `pnpm vitest run` | 1649 passed / 15 skipped; 1 suite falla en colección | ⚠ ver Anti-Patterns |
| Suite de app | `pnpm test` | 107 files / **1560 passed** | ✓ PASS |
| Typecheck | `npx tsc -b` | exit 0, cero salida | ✓ PASS |
| Guard de 118 STRICT | `STRICT=1 bash .../check-crons.sh` | `RESULTADO: 0 falta(s) · STRICT=1`, exit 0 | ✓ PASS |
| Instrumento de frescura | `pnpm freshness --json` | JSON completo, cero 404, pg_cron vivo | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CRON-02 | 119-01..07 | Robustez cerrada donde falte: reintentos/backoff, cursores, hash-check, señales freshness — cada cron degrada honesto, jamás fabrica | ✓ SATISFIED | Cursores (G1/CR-02/CR-03), hash-check (G6), señales (G2/G3/G4/G10), degradación honesta (tests 503/drift). `REQUIREMENTS.md:23` marcado `[x]`, `:67` mapeado a Phase 119 = Complete |

Sin requisitos huérfanos: `REQUIREMENTS.md` no mapea otro ID a Phase 119.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `packages/fichas/src/spike/retrieval-golden.live.test.ts` | 55-72 | Suite LIVE que falla en colección con `.env` local completo (`probeUnaccent` sin DB alcanzable) | ℹ️ Info | **Pre-existente, ajeno a 119** — último commit del archivo es `4842439 feat(87-03)` (milestone v9.0). No toca ningún artefacto de esta fase. 1649 tests pasan igual |

Cero `TBD`/`FIXME`/`XXX` en los 14 archivos tocados por la fase (grep exhaustivo, salida vacía).

### Human Verification Required

#### 1. Fila `identity` en `source_snapshot`
**Test:** Correr `seed-cli` de identity localmente con `.env` completo; luego `select source, count(*) from source_snapshot group by 1`.
**Expected:** aparece `identity`.
**Why human:** el writer está montado y wired, pero en `backup-parlamentario.yml` no hay service key ⇒ null por diseño. Limitación declarada (G5).

#### 2. Secrets de Cloudflare (G8)
**Test:** cargar `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` (pasos en `118-OPERATOR-CHECKPOINT.md`).
**Expected:** aparecen en `gh secret list`.
**Why human:** acto de operador. No bloquea ingesta.

#### 3. `GEMINI_API_KEY` + dispatch de `fichas-backfill` (G9)
**Test:** cargar la key y disparar el workflow.
**Expected:** la corrida no falla por key ausente; `fichas` deja de reportar `n/d (sin corridas)`.
**Why human:** acto de operador; el dispatch NO se disparó y así está declarado.

#### 4. Re-observación de G11
**Test:** revisar `cron.job_run_details` de jobid=5 tras un viernes hábil.
**Expected:** hay corrida ese viernes.
**Why human:** requiere ventana temporal, no código. Premisa original REFUTADA (2026-07-25 fue sábado).

### Gaps Summary

**Ningún gap bloqueante.** El intento adversarial de falsear la narrativa del SUMMARY no encontró código hueco:

- Los fixes del code review (CR-01/02/03) están **en el código**, no sólo en el registro: el replay de leylobby ejecuta `getObject` y verifica sha; los dos escapes al reloj están eliminados en **ambos** conectores (leylobby y Cámara, este último el que realmente escribe las 136 filas).
- G4 **muerde en producción**: dos verdes prestados cayeron a STALE honesto en la corrida real de `pnpm freshness`, incluido un stale disparado **sólo** por `ghRun` (`fichas`, 17 días < umbral 30). Eso es exactamente lo que el criterio pedía y no se puede fingir.
- Las 5 filas STALE son señal honesta, no avería del fix: `chilecompra`/`servel` gated sin workflow (declarado con `workflowYml: null`, sin YAML vacíos que fabricaran cobertura), `lobby-camara`/`lobby-leylobby` con cobertura vieja REAL, `fichas` sin corridas por la key ausente del operador.
- El registro de cierre es honesto en la dirección incómoda: abre **dos gaps nuevos contra sí mismo** (`G12-119` rótulo engañoso de la señal lobby-leylobby, `D-PROB-119` orden de etapas invertido en probidad) en vez de declarar victoria total.

Lo pendiente es enteramente **acto de operador o ventana temporal**, no código: por eso `human_needed` y no `passed`.

---

_Verified: 2026-07-28T20:05:00Z_
_Verifier: Claude (gsd-verifier)_
