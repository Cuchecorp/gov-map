---
phase: 63-busq-b-squeda-de-proyectos-completa
plan: 01
subsystem: database
tags: [supabase, upsert, idempotent, cli, seed, fichas, coverage, sql]

# Dependency graph
requires:
  - phase: earlier-fichas
    provides: SupabaseFichasWriter (upsertFicha/leerPendientes), proyecto_ficha schema (mig 0011), pipeline-cli
provides:
  - "seedFichasPendientes(): método idempotente que abre una fila proyecto_ficha estado='pendiente' para todo proyecto sin ficha"
  - "seed-fichas-cli.ts: CLI LOCAL del seed, dry-run gateado por presencia de service key"
  - "scripts/verify-cobertura.sql: 7 conteos de cobertura (fuente única compartida verificación/freshness)"
affects: [63-02, 63-03, "backfill P03", freshness cobertura, /buscar banner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent seed via ignoreDuplicates:true (ON CONFLICT DO NOTHING) — nunca re-abre estado terminal"
    - "CLI dry-run gating on service-key presence (espejo de pipeline-cli)"

key-files:
  created:
    - packages/fichas/src/seed-fichas.test.ts
    - packages/fichas/src/seed-fichas-cli.ts
    - scripts/verify-cobertura.sql
  modified:
    - packages/fichas/src/writer-supabase.ts

key-decisions:
  - "Seed como paso dedicado y testeable (no auto-crear dentro de leerPendientes) — no mezcla lectura/escritura, no cambia el contrato del pipeline"
  - "ignoreDuplicates:true (DO NOTHING) como blindaje de idempotencia y anti-re-apertura de 'embebido'/'error'"
  - "verify-cobertura.sql = fuente única de conteos, compartida por P03 y la señal de freshness"

patterns-established:
  - "Seed idempotente por boletín: SELECT gap vía Set diff → upsert DO NOTHING"
  - "CLI de seed sin providers/pipeline: solo flags --dry-run/--service-key, secreto desde env"

requirements-completed: [BUSQ-01]

# Metrics
duration: 8min
completed: 2026-07-10
---

# Phase 63 Plan 01: Seed idempotente de fichas + verificación de cobertura Summary

**`seedFichasPendientes()` cierra la causa raíz BUSQ-01 (los 82 proyectos sin fila `proyecto_ficha` invisibles al pipeline) abriendo una fila `estado='pendiente'` idempotente por boletín, más un CLI LOCAL dry-run-gateado y un SQL de 7 conteos de cobertura.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-10T01:54Z
- **Completed:** 2026-07-10T01:57Z
- **Tasks:** 3
- **Files modified:** 4 (3 creados, 1 modificado)

## Accomplishments
- `seedFichasPendientes()` en el writer: detecta el gap (proyectos sin ficha) vía Set-diff y upsertea filas `'pendiente'` con `ignoreDuplicates:true` (ON CONFLICT DO NOTHING) — jamás re-abre `'embebido'`/`'error'`.
- `seed-fichas-cli.ts`: CLI LOCAL con flags `--dry-run`/`--service-key`, degrada a dry-run sin key (nunca escribe silenciosamente), guard `isMain` sobre su propio nombre (evita el gotcha "dos entrypoints CLI").
- `scripts/verify-cobertura.sql`: 7 conteos (proyecto / ficha / embedding / sin_ficha / por estado / con_idea_matriz / por versión) — fuente única para verificar el backfill de P03 y alimentar la señal de freshness.

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Task 1: Test del seed idempotente (RED)** - `38bab08` (test)
2. **Task 2: Implementar seedFichasPendientes() (GREEN)** - `e3c4a8b` (feat)
3. **Task 3: CLI de seed + SQL de verificación** - `e95aff5` (feat)

_TDD: Task 1 (RED) → Task 2 (GREEN); Task 3 sin TDD._

## Files Created/Modified
- `packages/fichas/src/seed-fichas.test.ts` (nuevo) - 4 tests: gap detection, ignoreDuplicates:true, no re-abrir terminal, caso vacío.
- `packages/fichas/src/writer-supabase.ts` (modificado) - método `seedFichasPendientes()` reusando `chunk` + `dedupePorClave`; solo `error.message` propagado (T-07-06).
- `packages/fichas/src/seed-fichas-cli.ts` (nuevo) - CLI LOCAL del seed, dry-run gateado por service key; secreto desde env, `--service-key` nunca logueado (T-63-01/T-63-03).
- `scripts/verify-cobertura.sql` (nuevo) - 7 conteos de cobertura con comentario por significado.

## Decisions Made
- Seed como paso explícito y testeable en vez de auto-crear filas dentro de `leerPendientes` (no mezcla lectura/escritura, no altera el contrato del pipeline).
- `ignoreDuplicates:true` (DO NOTHING) como doble blindaje: idempotencia + anti-re-apertura de estado terminal.
- Un único `verify-cobertura.sql` como fuente de conteos compartida (verificación manual P03 + freshness).

## Deviations from Plan

None - plan executed exactly as written. Los 4 tests, la implementación, el CLI y el SQL siguen los analogs del PATTERNS.md verbatim.

## Threat Model Compliance
- **T-63-01 (Information Disclosure):** service key nunca en logs/errores — solo `error.message` de PostgREST; key desde env, `--service-key` override nunca logueado. ✓
- **T-63-02 (Tampering / re-abrir estado terminal):** `ignoreDuplicates:true` (DO NOTHING) + Test 3 dedicado que verifica que `'embebido'`/`'error'` nunca entran al lote. ✓
- **T-63-03 (Elevation / secreto por argv):** secreto = `process.env` primario; `--service-key` solo override con fail-fast en valor vacío. ✓

## Issues Encountered
None. La suite `@obs/fichas` verde (70 pass, 1 skip), typecheck limpio (tsc --noEmit exit 0), CLI dry-run sin key verificado (no toca DB).

## Known Stubs
None. El plan entrega CÓDIGO + tests; el backfill real (correr el seed contra PROD) es P03 por diseño — no es un stub, es el alcance declarado del plan.

## User Setup Required
None - no external service configuration required. El CLI corre LOCAL con la service key de `.env` cuando el operador ejecute P03.

## Next Phase Readiness
- `seedFichasPendientes()` listo para que P03 abra las 82 filas faltantes antes del backfill del pipeline.
- `verify-cobertura.sql` listo para verificar `count(proyecto)==count(proyecto_ficha)` tras el seed y `count(proyecto_embedding)` para el banner de /buscar (BUSQ-03).
- Sin bloqueos. El seed no corre automáticamente (LOCAL, operador) — coherente con CLAUDE.md (backfill masivo = LOCAL, nunca GH Actions).

## Self-Check: PASSED

---
*Phase: 63-busq-b-squeda-de-proyectos-completa*
*Completed: 2026-07-10*
