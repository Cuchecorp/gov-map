---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
plan: 05
subsystem: database
tags: [postgres, pgvector, pgtap, supabase, rls, migration, identity, entidad_tercero]

# Dependency graph
requires:
  - phase: 35-01
    provides: "Migraciones 0034/0035/0036 + 3 pgTAP del subsistema de terceros (escritas, no aplicadas a PROD)"
provides:
  - "Indice unico TOTAL entidad_tercero_clave_natural en 0034 (cierra CR-01: el ON CONFLICT del writer ya tiene indice targeteable)"
  - "pgTAP de 0034 extendido (existencia + indpred is null + throws_ok 23505 sobre doble-insert de la clave natural)"
  - "Docstring de writer-entidad-supabase.ts corregido (sin la afirmacion falsa del indice TOTAL en 0034/0035)"
  - "0034/0035/0036 APLICADAS a PROD por psql --single-transaction + 3 filas en schema_migrations; entidad_tercero anon=42501"
  - "HALLAZGO: dos defectos preexistentes de 35-01 destapados por correr los pgTAP contra PROD (ver Issues)"
affects: [36-financiamiento, entity-resolution, ENT-03, ENT-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clave natural por nombre con indice unico TOTAL (no parcial) para que PostgREST .upsert(onConflict) la targetee (espejo 0035)"
    - "Apply a PROD: DDL + registro en schema_migrations en UNA transaccion atomica via heredoc stdin (evita el bug de ARGV multibyte de psql en Windows con caracteres Δ)"

key-files:
  created: []
  modified:
    - supabase/migrations/0034_entidad_tercero.sql
    - supabase/tests/0034_entidad_tercero.test.sql
    - packages/identity/src/writer-entidad-supabase.ts

key-decisions:
  - "Operador confirmo opt-nombre-solo: clave natural = (tipo_entidad, nombre_normalizado), indice TOTAL — coincide byte-a-byte con el onConflict que el writer YA usa; cero cambio de codigo ejecutable"
  - "Operador eligio PARAR Y RE-PLANIFICAR los dos defectos nuevos de 0035/0036 en vez de fix-forward inmediato (no tocar mas PROD)"

patterns-established:
  - "Correr los pgTAP contra el schema REAL (PROD) destapa bugs que el code-review estructural y los tests con cliente mockeado no ven (CR-01 era invisible al mock; el FK de resolver_entidad solo aparece contra PROD vacio)"

requirements-completed: [ENT-05]
# ENT-05 cerrado (CR-01: upsert ON CONFLICT ya no lanza 42P10, idempotencia ejercitable contra schema real).
# ENT-01 PARCIAL: 3 migraciones aplicadas + schema_migrations + anon deny + 0034 pgTAP verde,
#   PERO la suite 0035/0036 NO esta toda verde (ver Issues). ENT-03/ENT-04 NO satisfechos (bug 0036).

# Metrics
duration: ~40min
completed: 2026-06-24
---

# Phase 35 / Plan 05: Gap-closure CR-01 + apply a PROD — Summary

**Cerrado CR-01 (indice unico TOTAL entidad_tercero_clave_natural en 0034) y aplicadas las 3 migraciones de terceros a PROD; correr los pgTAP reales destapo DOS defectos preexistentes de 35-01 (FK roto de resolver_entidad en 0036, plan(18)->16 en 0035) — el operador eligio parar y re-planificarlos.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 1 auto (completada) + 2 checkpoints de operador (resueltos)
- **Files modified:** 3

## Accomplishments

- **CR-01 cerrado (ENT-05):** 0034 ahora crea el indice unico TOTAL `entidad_tercero_clave_natural` sobre `(tipo_entidad, nombre_normalizado)` (sin WHERE), espejo del patron LOCKED de 0035. El `ON CONFLICT (tipo_entidad, nombre_normalizado)` del writer ya tiene un indice targeteable → un upsert real ya NO lanza SQLSTATE 42P10. La idempotencia "2da corrida = 0 nuevos" es ejercitable contra el schema real, no solo contra el cliente mockeado.
- **pgTAP de 0034 extendido:** `has_index` de `entidad_tercero_clave_natural` + assert `indpred is null` (es TOTAL, no parcial) + `throws_ok('23505')` sobre doble-insert de la misma `(tipo_entidad, nombre_normalizado)` con rut NULL. `plan(22)` -> `plan(26)`. Verde 26/26 contra PROD.
- **Docstring drift corregido:** `writer-entidad-supabase.ts` ya no afirma el indice TOTAL inexistente "en 0034/0035"; nombra `entidad_tercero_clave_natural` en 0034 y aclara que el de 0035 es de otra tabla (vinculo_entidad).
- **Apply a PROD (ENT-01, parcial):** 0034/0035/0036 aplicadas por `psql --single-transaction -v ON_ERROR_STOP=1`, cada una con su fila en `supabase_migrations.schema_migrations` (DDL + registro atomicos en una transaccion). Probe anon sobre `entidad_tercero` via PostgREST → `42501 permission denied`.

## Task Commits

1. **Task 1: indice TOTAL + pgTAP + docstring (CR-01)** — `129f6f0` (fix)
2. **Task 2: CHECKPOINT decision operador** — resuelto inline: opt-nombre-solo ("clave por nombre confirmada"). Sin commit (decision).
3. **Task 3: CHECKPOINT apply operador a PROD** — ejecutado por el agente bajo autorizacion explicita del operador ("aplicarlas tu mismo, defensivo y razonado"). Aplicado a PROD; NO es un commit de codigo.

## Files Created/Modified

- `supabase/migrations/0034_entidad_tercero.sql` — agregado el indice unico TOTAL `entidad_tercero_clave_natural` (coexiste con el parcial rut); comentario de cabecera actualizado.
- `supabase/tests/0034_entidad_tercero.test.sql` — `plan(26)`; 4 asserts nuevos de CR-01.
- `packages/identity/src/writer-entidad-supabase.ts` — docstring de idempotencia corregido.

## Decisions Made

- **opt-nombre-solo (Task 2):** clave natural por `(tipo_entidad, nombre_normalizado)` con indice TOTAL. Coincide con el onConflict del writer; deduplica contrapartes de lobby sin RUT; espejo de 0035; cero cambio de codigo ejecutable. (La alternativa opt-incluye-rut reabria el writer y excedia el gap-closure.)
- **Parar y re-planificar (Task 3):** ante los dos defectos nuevos, el operador opto por dejar 0034 como hecho y re-planificar 0035/0036 aparte, sin tocar mas PROD.

## Deviations from Plan

El plan asumia que 0035/0036 estaban verdes ("verificados localmente" en 35-01) y que Task 3 cerraria ENT-01 con los 3 pgTAP verdes. Al correr los pgTAP contra PROD por primera vez (el review los habia marcado "SKIP (human)"), aparecieron dos defectos preexistentes que el plan no contemplaba. No son auto-fixes: exceden el alcance del gap-closure y se difieren a re-planificacion por decision del operador.

## Issues Encountered

### 🛑 Issue 1 (BLOCKER ENT-03/ENT-04) — FK roto de `resolver_entidad` en 0036

- **Sintoma:** el pgTAP de 0036 falla en el caso transaccional con `insert or update on table "identidad_audit" violates foreign key constraint "identidad_audit_vinculo_id_fkey"`.
- **Causa raiz:** `identidad_audit.vinculo_id` tiene FK → **`vinculo_identidad`** (tabla del subsistema parlamentario, reusada en 35-01 con criterio A3). Pero el RPC `resolver_entidad` (0036) inserta en `identidad_audit` con `vinculo_id = <id de vinculo_entidad>` (tabla de TERCEROS). Como `vinculo_identidad` esta vacia en PROD, cualquier id de `vinculo_entidad` viola la FK. El reúso de `identidad_audit` no contemplo que su columna `vinculo_id` apunta a la tabla parlamentaria.
- **Por que "paso localmente":** la DB local de test tenia filas en `vinculo_identidad` con ids que coincidian; contra PROD vacio, falla. El cliente mockeado de los tests TS tampoco lo ejercia.
- **Impacto:** el camino de confirmacion humana de terceros (ENT-03/ENT-04, `resolver_entidad` con `p_promover=true`) esta roto contra PROD. Sin datos de terceros aun → sin daño en produccion todavia; falla al primer confirm-con-promote.
- **Fix candidato (para re-planificacion, decision de diseño):** agregar `identidad_audit.vinculo_entidad_id bigint references vinculo_entidad(id)`, hacer `vinculo_id` nullable, y `CREATE OR REPLACE` de `resolver_entidad` para poblar la columna correcta — via una migracion NUEVA 0037 (forward-fix; 0036 ya esta aplicada e inmutable). Alternativa: tabla de audit separada para terceros. Requiere decision del planner/operador.

### ⚠ Issue 2 (defecto de autoria) — `plan(18)` vs 16 asserts en el test de 0035

- **Sintoma:** `supabase/tests/0035_vinculo_entidad.test.sql` declara `select plan(18)` pero solo hay 16 asserts; pgTAP reporta `# Looks like you planned 18 tests but ran 16` (plan-failure), aunque las 16 que corren PASAN (0 `not ok`).
- **Causa:** sobre-declaracion del plan en el archivo de test (35-01). No es un fallo de schema.
- **Fix candidato:** ajustar `plan(18)` -> `plan(16)` (o agregar los 2 asserts faltantes que el autor pretendia). Trivial, pero se difiere con el Issue 1.

## Verification (estado real de los criterios de Task 3)

| Criterio | Estado |
|----------|--------|
| 0034 con `entidad_tercero_clave_natural` (sin WHERE), parcial rut intacto | ✅ |
| 0034 pgTAP verde con asserts CR-01 (indice TOTAL no-parcial + 23505) | ✅ 26/26 contra PROD |
| writer docstring sin la afirmacion falsa del indice | ✅ |
| `@obs/identity` test writer-entidad verde | ✅ 5/5 |
| Decision de dedup confirmada por el operador | ✅ opt-nombre-solo |
| 0034/0035/0036 aplicadas + 3 filas en schema_migrations | ✅ |
| anon SELECT entidad_tercero → permission denied | ✅ 42501 |
| **0035 pgTAP verde** | ❌ plan(18)≠16 (Issue 2) |
| **0036 pgTAP verde** | ❌ FK violation real (Issue 1) |

## Next Phase Readiness

- **ENT-05:** cerrado. CR-01 resuelto contra el schema real.
- **ENT-01:** maestra/vinculo/revision aplicadas a PROD con deny-by-default verificado; 0034 pgTAP verde. Parcial: la suite 0035/0036 no esta toda verde por los dos defectos de abajo.
- **ENT-03/ENT-04:** NO satisfechos contra PROD — bloqueados por el FK roto de `resolver_entidad` (Issue 1). Requieren un plan nuevo (forward-fix 0037 + diseño del audit de terceros).
- **Bloqueador para cierre de fase:** Issues 1 y 2 deben re-planificarse antes de declarar Phase 35 completa. No se toca mas PROD hasta entonces (decision del operador).

---
*Phase: 35-ent-resoluci-n-de-identidades-de-terceros*
*Completed: 2026-06-24*
