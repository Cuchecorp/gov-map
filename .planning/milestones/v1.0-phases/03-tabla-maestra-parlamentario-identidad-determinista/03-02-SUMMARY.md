---
phase: 03-tabla-maestra-parlamentario-identidad-determinista
plan: 02
subsystem: identidad
tags: [supabase, postgres, migracion, rls, pgtap, provenance, identidad, parlamentario]

# Dependency graph
requires:
  - "Migraciones 0001-0004 + patron de migracion/pgTAP de Fase 1 (RLS deny-by-default)"
provides:
  - "Tabla maestra `parlamentario` con provenance inline + estado (compuerta humana) + claves naturales para upsert idempotente"
  - "Tabla `parlamentario_alias` (FK on delete cascade + unique parlamentario_id,alias)"
  - "RLS deny-by-default en ambas tablas (rut/email nunca legibles por anon)"
  - "Contrato DDL que el seeder (siembra Camara/Senado) y Fase 4 (adjudicacion) consumen"
affects: [identidad, framework-de-ingesta, tramitacion, busqueda-semantica]

# Tech tracking
tech-stack:
  added: []
  patterns: [rls-deny-by-default, provenance-inline, migraciones-versionadas, indices-unicos-parciales, pgtap-throws-ok]

key-files:
  created:
    - supabase/migrations/0005_parlamentario.sql
    - supabase/tests/0004_parlamentario.test.sql
  modified: []

key-decisions:
  - "estado default 'no_confirmado' a nivel DDL: nada se auto-marca confirmado; la promocion es revision humana (ID-01)"
  - "Claves naturales via indices unicos PARCIALES (where ... is not null), no columnas NOT NULL → upsert idempotente sin obligar el campo"
  - "rut/distrito/circunscripcion nullable: los catalogos no traen todos los campos (Pitfall 4); NOT NULL reventaria la siembra"

requirements-completed: [ID-01]

# Metrics
duration: 2min
completed: 2026-06-18
---

# Phase 3 Plan 02: Tabla maestra `parlamentario` + identidad (DDL) Summary

**Migracion 0005 materializa la maestra `parlamentario` + `parlamentario_alias` en Supabase local con provenance inline, columna `estado` (compuerta de revision humana, default `no_confirmado`), claves naturales por camara para upsert idempotente y RLS deny-by-default; verificada por 25 asserts pgTAP espejando el patron de Fase 1.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-18T12:42:43Z
- **Completed:** 2026-06-18T12:44:49Z
- **Tasks:** 2
- **Files modified:** 2 creados

## Accomplishments
- `parlamentario` creada con el modelo exacto de 03-CONTEXT: `id` interno (P00001), nombre/apellidos, `camara` (check diputados|senado), `periodo`, `region`, `distrito`/`circunscripcion` nullable, `partido`, `rut` nullable interno, `parlid_senado`/`id_diputado_camara` nullable, `estado` (check confirmado|probable|no_confirmado, default no_confirmado), `email`, y provenance inline (`origen`, `fecha_captura`, `enlace`).
- Claves naturales para upsert idempotente: indices unicos PARCIALES sobre `parlid_senado` y `id_diputado_camara` (`where ... is not null`) — permiten idempotencia sin obligar NOT NULL (T-03-06).
- `parlamentario_alias` con `id` identity, FK `parlamentario_id -> parlamentario(id) on delete cascade`, `alias`, `origen`, y `unique (parlamentario_id, alias)`.
- RLS deny-by-default en AMBAS tablas (enable sin policies) — anon nunca lee `rut`/`email` (T-03-04, Ley 21.719).
- `supabase db reset` aplica 0001->0005 limpio; `supabase db lint` sin errores; `supabase test db` verde en 0001->0004 (52 tests, 25 del nuevo pgTAP).

## Task Commits

Cada tarea se comiteo atomicamente:

1. **Task 1: Migracion 0005 — parlamentario + alias + RLS deny-by-default** - `ade61ea` (feat)
2. **Task 2: pgTAP 0004 — columnas, check, RLS deny-by-default, unicidad natural** - `60cae51` (test)

## Files Created/Modified
- `supabase/migrations/0005_parlamentario.sql` - DDL `parlamentario` + `parlamentario_alias`; provenance inline; estado check+default; indices unicos parciales; RLS deny-by-default en ambas tablas.
- `supabase/tests/0004_parlamentario.test.sql` - 25 asserts pgTAP: has_table/has_column, col_is_null (rut/distrito/circunscripcion), col_default_is (estado=no_confirmado), throws_ok/lives_ok (check estado/camara), throws_ok (parlid_senado duplicado), RLS habilitada + is_empty(pg_policy) en ambas, FK+unique de alias.

## Decisions Made
- **`estado` default `no_confirmado` por DDL** — modela la compuerta de promocion de ID-01: el seeder carga el lote, el operador lo promueve a `confirmado` tras revision. Nada incierto se confirma por defecto (fail-closed a nivel de datos).
- **Claves naturales via indices unicos PARCIALES** (`where parlid_senado is not null`) en vez de columnas NOT NULL — un diputado no tiene `parlid_senado` y viceversa; el indice parcial da idempotencia de upsert por camara sin obligar el campo cruzado.
- **`rut`/`distrito`/`circunscripcion` nullable** — Pitfall 4: los catalogos de Camara/Senado no traen todos los campos; NOT NULL reventaria la siembra.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Conteo de plan pgTAP off-by-one**
- **Found during:** Task 2 (`supabase test db`)
- **Issue:** El test declaraba `plan(24)` pero corrian 25 asserts (la migracion del check de `camara` agrego un assert extra); pgTAP reporta "Bad plan" y FAIL aunque las 25 sub-pruebas pasaran.
- **Fix:** `plan(24)` → `plan(25)` para reflejar el numero real de asserts.
- **Files modified:** supabase/tests/0004_parlamentario.test.sql
- **Verification:** `supabase test db` → "All tests successful" (52 tests, Result: PASS).
- **Committed in:** `60cae51` (Task 2)

**Total deviations:** 1 auto-fixed (1 bug). Sin scope creep.

## Threat Model Coverage
- **T-03-04 (Information Disclosure / rut-email):** mitigado — RLS habilitada sin policies en ambas tablas; pgTAP verifica `relrowsecurity=true` + `is_empty(pg_policy)`. `rut` nullable interno.
- **T-03-05 (Tampering / estado):** mitigado — check `(confirmado|probable|no_confirmado)` + default `no_confirmado`; pgTAP `throws_ok` valida el check y `col_default_is` el default.
- **T-03-06 (Tampering / idempotencia):** mitigado — indices unicos parciales por clave natural; pgTAP `throws_ok` sobre `parlid_senado` duplicado.

## Issues Encountered
- Ninguno mas alla del off-by-one del plan pgTAP (documentado arriba).

## Next Phase Readiness
- El **seeder** (siembra live Camara/Senado, siguiente plan de la fase) tiene el contrato DDL estable: inserta como `no_confirmado` con provenance, upsert por `parlid_senado`/`id_diputado_camara`.
- **Fase 4** (adjudicacion LLM + golden set + gate humano) consume `parlamentario` + `parlamentario_alias` y la columna `estado` como compuerta de promocion.
- **Operador:** el push de 0005 al Supabase REMOTO sigue pendiente de credencial (DB password/PAT) — deferred de 03-CONTEXT, fuera de scope.

## Self-Check: PASSED

Archivos declarados existen y ambos commits estan en el historial:
- Archivos: supabase/migrations/0005_parlamentario.sql, supabase/tests/0004_parlamentario.test.sql, 03-02-SUMMARY.md — todos FOUND.
- Commits: ade61ea (Task 1), 60cae51 (Task 2) — ambos FOUND.

---
*Phase: 03-tabla-maestra-parlamentario-identidad-determinista*
*Completed: 2026-06-18*
