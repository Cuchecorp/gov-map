---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
plan: 07
subsystem: database
tags: [pgtap, supabase, rls, test, identity, vinculo_entidad, plan-count]

# Dependency graph
requires:
  - phase: 35-05
    provides: "0035 aplicada a PROD; destapó Issue 2 (plan(18) vs 16 asserts — plan-count defect)"
provides:
  - "0035_vinculo_entidad.test.sql con 18 asserts reales que coinciden con select plan(18)"
  - "2 asserts nuevos anclados al schema real: revision_entidad NO force-RLS (asimetría intencional) + anon NO INSERT en vinculo_entidad"
  - "0035 pgTAP 18/18 verde contra PROD → cierra ENT-01 (junto con 0036/0037 verdes de 35-06)"
affects: [ENT-01, entity-resolution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cerrar plan-count defect agregando los asserts faltantes (anclados al schema real) en vez de bajar plan(N) — sube la cobertura en lugar de ocultar el hueco"

key-files:
  created: []
  modified:
    - supabase/tests/0035_vinculo_entidad.test.sql

key-decisions:
  - "Sumar 2 asserts reales (no reducir plan(18)→16): documentan garantías deny-by-default no cubiertas (anon sin INSERT) y la asimetría force-RLS revision_entidad vs vinculo_entidad"

patterns-established:
  - "Asserts nuevos deben estar anclados a propiedades reales de la migración (force-RLS línea 177 solo en vinculo_entidad; revoke INSERT línea 182) — no inventar schema"

requirements-completed: [ENT-01]
# ENT-01 ("maestra+vinculo+revision aplicadas por psql con pgTAP verde") cerrado:
# 0035 18/18 (este plan) + 0034 26/26 (35-05) + 0036 15/15 + 0037 12/12 (35-06), todos verdes contra PROD.

# Metrics
duration: ~10min
completed: 2026-06-24
---

# Phase 35 / Plan 07: 0035 pgTAP plan-count fix — Summary

**Cerrado el Issue 2 de 35-05 (plan-count defect): `0035_vinculo_entidad.test.sql` declaraba `plan(18)` pero solo tenía 16 asserts. Se agregaron los 2 asserts faltantes (anclados al schema real, ambos pasan contra PROD); 0035 ahora 18/18 verde → cierra ENT-01.**

## Performance

- **Duration:** ~10 min (Task 1 auto + Task 2 checkpoint de operador resuelto)
- **Tasks:** 1 auto (completada) + 1 checkpoint blocking-human (pgTAP PROD, resuelto)
- **Files modified:** 1

## Accomplishments

- **plan-count cerrado:** se mantuvo `select plan(18)` y se sumaron 2 asserts reales (no se bajó a 16), subiendo cobertura en vez de ocultar el hueco.
- **Assert 17 (asimetría force-RLS):** `revision_entidad` NO tiene force row level security (la migración aplica `force row level security` solo a `vinculo_entidad`, línea 177) — la asimetría es intencional (revision_entidad = cola de revisión humana; vinculo_entidad = tabla de hecho público inmutable). Antes la suite era silenciosa al respecto.
- **Assert 18 (anon sin INSERT):** la migración hace `revoke all on vinculo_entidad from anon, authenticated` (línea 182); la suite verificaba el deny de SELECT pero no de INSERT sobre la tabla "producto final" — la garantía deny-by-default de mayor valor sin cubrir.
- **0035 pgTAP 18/18 verde contra PROD:** `1..18`, 0 `not ok`, sin plan-count mismatch.

## Task Commits

1. **Task 1: agregar 2 asserts a 0035 pgTAP** — `46f964a` (`test(35-07): add 2 missing asserts to 0035 pgTAP suite (plan-count defect Issue 2)`)
2. **Task 2: CHECKPOINT pgTAP operador contra PROD** — run rollback-only (sin writes); 18/18 verde. NO es commit de código.

## Files Modified

- `supabase/tests/0035_vinculo_entidad.test.sql` — +2 asserts en la sección `-- ── (a) deny-by-default ──`; `select plan(18)` intacto; wrapper begin/rollback y los 16 asserts previos sin tocar.

## Decisions Made

- **Sumar asserts reales** en vez de reducir `plan(18)→16`: el plan-count mismatch era sobre-declaración; cerrarlo con cobertura real es estrictamente mejor.

## Deviations from Plan

Ninguna. Edit exacto al plan; `plan(18)` preservado; solo el archivo en alcance modificado. (El mensaje del assert usa "NAO" verbatim del plan — intencional, no typo a corregir.)

## Issues Encountered

Ninguno. El run pgTAP es rollback-only; no persiste estado en PROD.

## Verification (estado real contra PROD)

| Criterio | Estado |
|----------|--------|
| 0035 con exactamente 18 asserts + plan(18) intacto | ✅ |
| 2 asserts nuevos anclados al schema real (no inventados) | ✅ |
| 0035 pgTAP 18/18 verde, 0 not ok, sin plan-count mismatch | ✅ |
| ENT-01 cerrado (0035 18/18 + 0036/0037 verdes de 35-06) | ✅ |

## Next Phase Readiness

- **ENT-01:** completamente cerrado — maestra/vinculo/revision aplicadas por psql con toda la suite pgTAP verde (0034 26/26, 0035 18/18, 0036 15/15, 0037 12/12).
- **Phase 35:** todos los gaps de 35-05 (Issues 1 y 2) cerrados. Lista para verificación de fase.

---
*Phase: 35-ent-resoluci-n-de-identidades-de-terceros*
*Completed: 2026-06-24*
