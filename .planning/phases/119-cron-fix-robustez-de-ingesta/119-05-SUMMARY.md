---
phase: 119-cron-fix-robustez-de-ingesta
plan: 05
subsystem: ingesta
tags: [cron, r2, etapa-2, replay, g7, locked-rules]
requires:
  - "R2Store.getObject (packages/ingest/src/r2-store.ts)"
  - "plantilla dorada --from-r2 (packages/tramitacion/src/ingest-cli.ts:130)"
provides:
  - "agenda --from-r2 <r2Path> [--semana YYYY-Www]"
  - "probidad --from-r2 <r2Path> (ingestado_hasta del crudo)"
  - "lobby-camara --from-r2 <r2Path> + [WARN] de Etapa 1 omitida"
affects:
  - ".github/workflows/lobby-camara-weekly.yml (log del r2Path re-procesable)"
  - "docs/runbooks/cron-local-fallback.md (§2.1 replay)"
tech-stack:
  added: []
  patterns:
    - "replay fail-loud: key anclada por regex + sha re-verificado + cero degradación a re-fetch"
    - "honestidad de frescura: el cursor del replay sale del crudo, nunca del reloj"
key-files:
  created: []
  modified:
    - packages/agenda/src/ingest-run.ts
    - packages/agenda/src/ingest-run.test.ts
    - packages/agenda/src/run-agenda-prod-cli.ts
    - packages/agenda/src/index.ts
    - packages/probidad/src/run-probidad-todos.ts
    - packages/probidad/src/run-probidad-todos.test.ts
    - packages/probidad/src/run-probidad-todos-cli.ts
    - packages/probidad/src/index.ts
    - packages/lobby/src/run-camara-lobby.ts
    - packages/lobby/src/run-camara-lobby.test.ts
    - packages/lobby/src/run-camara-lobby-cli.ts
    - .github/workflows/lobby-camara-weekly.yml
    - docs/runbooks/cron-local-fallback.md
decisions:
  - "El replay de probidad reconcilia cada response contra la maestra COMPLETA (el crudo agregado no guarda qué objetivo originó cada query); mismo test determinista ⇒ igual de fail-closed"
  - "Crudos de agenda particionados por FECHA (legacy pre-WR-01) exigen --semana explícita: deducir la semana de la fecha de corrida sería fabricar el vínculo"
  - "En replay de lobby NO se pasa r2Store: re-escribir daría 412 y el skip anularía la Etapa 2 que el operador quiere correr (nuevo flag omitirEtapa1)"
metrics:
  duration: "~1h"
  completed: 2026-07-28
  tasks: 3
  tests_added: 16
---

# Phase 119 Plan 05: Etapa 2 desde R2 (`--from-r2`) en agenda, probidad y lobby-camara — Summary

Los tres conectores que no tenían ruta de replay ahora la tienen con la firma dorada: `--from-r2 <r2Path>` lee el crudo YA versionado en R2, verifica el sha contra la key y corre solo la Etapa 2 — cerrando G7 y la regla LOCKED "re-ingestar a Supabase se hace SIEMPRE desde R2".

## Qué se construyó

**Task 1 — agenda (`runReplayDesdeR2`).** Función nueva en `ingest-run.ts` cuya firma NO admite conectores: es estructuralmente imposible tocar `camara.cl`/`senado.cl` desde el replay. Deriva el recurso del prefijo de la key (`camara/citaciones-semana/*.html` vs `camara/tabla-sala/*.pdf`), falla loud ante prefijo desconocido, extensión incoherente, `..`/ruta absoluta o mismatch de sha. `parseFromR2Arg` valida el flag antes de cualquier red/DB. El CLI corre el bloque de replay ANTES de instanciar conector/rate-limiter.

**Task 2 — probidad (`runProbidadReplay`).** Lee el crudo agregado (`infoprobidad/declaraciones/<fecha>/<sha>.json`), valida forma (array de responses SPARQL con `results.bindings`), parsea y reconcilia TODO antes del primer upsert (cero escritura parcial) y marca `ingestado_hasta` con **la fecha de la key**, nunca `new Date()` — un replay del pasado no puede fingir frescura (T-119-15).

**Task 3 — W-9 lobby-camara.** `--html-file` ya pasaba por `putImmutable` antes de parsear (verificado y ahora cubierto por test de orden `put → upsert`); se añadió el `[WARN] R2 no configurado — Etapa 1 omitida` que faltaba, `--from-r2` con validación de key + sha, y el flag `omitirEtapa1` para que el replay no emita una alarma falsa. El workflow emite el `r2Path` re-procesable y la línea de replay lista para copiar; `curl`, el guard de 10.240 bytes y la ausencia de `schedule:` quedaron INTACTOS.

## Verificación

Suite completa verde: **1605 tests en packages** (agenda 131, probidad 54, lobby 75) + **1560 en app**; `tsc -b` raíz exit 0.

Replay REAL ejecutado contra objetos ya existentes en R2 (todo `--dry-run`, sin escribir PROD, sin tocar ninguna fuente):

```
camara-lobby: REPLAY desde R2 (camara-lobby/listadodeaudiencias/2026-06-22/f70ffc25….html) — CERO fetch a camara.cl
camara-lobby DRY-RUN: audiencias=17730 contrapartes=17681 confirmados=136 marcados=136

probidad-replay: leyendo crudo desde R2 (infoprobidad/declaraciones/2026-07-23/1383f924….json) — CERO consultas al CPLT
probidad-todos REPLAY DRY-RUN: declaraciones=1062 confirmados=136 ingestado_hasta=2026-07-23 (del crudo)

replay: Cámara 2026-W30 → 37 citaciones (desde R2)
agenda REPLAY DRY-RUN (citaciones-semana 2026-W30): citaciones=37 itemsTabla=0 — sin tocar la fuente

# y sin --semana, sobre la misma key legacy:
agenda FALLÓ: --from-r2: la key … está particionada por FECHA de corrida (2026-07-22), no por
semana ISO: declare la semana del contenido con --semana YYYY-Www (deducirla sería fabricar el vínculo)
```

`grep -c 'schedule:' .github/workflows/lobby-camara-weekly.yml` = 0; `grep -c '10240'` = 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Los crudos reales de agenda están particionados por FECHA, no por semana ISO**
- **Found during:** Task 1 (verificación con objetos reales de R2)
- **Issue:** las keys en producción son `camara/citaciones-semana/2026-07-22/<sha>.html` (fecha de corrida, previas a WR-01). La regex del replay sólo aceptaba `YYYY-Www` ⇒ el crudo histórico era irreplayable, que es justo el caso de uso.
- **Fix:** la regex acepta ambas particiones; con key legacy el replay EXIGE `--semana YYYY-Www` declarada por el operador y falla loud si falta — la fecha de corrida no determina la semana del contenido y deducirla fabricaría el vínculo. Una `--semana` que contradice una key semanal también es error.
- **Files modified:** `packages/agenda/src/ingest-run.ts`, `ingest-run.test.ts`, `run-agenda-prod-cli.ts`, `docs/runbooks/cron-local-fallback.md`
- **Commit:** 33d3e1b

**2. [Rule 3 - Blocking] `run-agenda-prod-cli` no encontraba `.env` bajo `pnpm --filter exec`**
- **Found during:** Task 1 (primer replay real)
- **Issue:** `loadEnv(process.cwd())` con cwd = `packages/agenda` (gotcha v8.1) ⇒ `--from-r2` abortaba con "R2 no configurado" pese a tener credenciales. Los CLIs de lobby/probidad ya usaban `findWorkspaceRoot`.
- **Fix:** `findWorkspaceRoot(process.cwd())`, mismo patrón que los otros dos runners.
- **Commit:** 33d3e1b

**3. [Rule 2 - Missing] `[WARN]` de Etapa 1 omitida en lobby**
- El acceptance criterion lo pedía y `runCamaraLobby` no lo emitía: sin `r2Store` la degradación a una-etapa era invisible. Añadido junto al flag `omitirEtapa1` que lo suprime cuando la omisión es deliberada (replay).
- **Commit:** f5a8af8

### Nota de proceso (TDD)

Tasks 1 y 3 siguieron RED→GREEN con corrida intermedia verificada (7 y 2 tests fallando antes de implementar). En la Task 2 escribí los tests y la implementación sin correr el paso RED intermedio: los 5 tests son igualmente reales y pasan, pero la gate RED no quedó registrada en el log de esa task. Se declara en vez de disimularse.

## Threat Flags

Ninguno nuevo. Las mitigaciones del registro se implementaron: T-119-13 (regex anclada por conector, sin construcción de URL arbitraria), T-119-14 (sha del contenido re-verificado contra el segmento de la key en los tres conectores), T-119-15 (cursor del replay desde el crudo), T-119-16 (errores de R2 sin credenciales; ningún log nuevo expone endpoint ni keys), T-119-SC (cero instalaciones de paquetes).

## Known Stubs

Ninguno.

## Self-Check: PASSED

- `packages/agenda/src/ingest-run.ts` FOUND · `packages/probidad/src/run-probidad-todos.ts` FOUND · `packages/lobby/src/run-camara-lobby-cli.ts` FOUND · `docs/runbooks/cron-local-fallback.md` FOUND
- Commits FOUND: 2aa7d32, 31cc0b4, f5a8af8, 33d3e1b
