---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
plan: 06
subsystem: database
tags: [postgres, pgtap, supabase, rls, migration, identity, identidad_audit, forward-fix]

# Dependency graph
requires:
  - phase: 35-05
    provides: "0034/0035/0036 aplicadas a PROD; destapó Issue 1 (FK roto de resolver_entidad en 0036)"
provides:
  - "Migración forward-fix 0037: identidad_audit.vinculo_entidad_id bigint FK → vinculo_entidad(id)"
  - "CHECK identidad_audit_un_solo_vinculo (num_nonnulls(vinculo_id, vinculo_entidad_id) <= 1) — defensa-en-profundidad, no el guard de la clase FK"
  - "CREATE OR REPLACE resolver_entidad: el INSERT de audit escribe vinculo_entidad_id (no vinculo_id) → cierra la violación 23503 contra PROD vacío"
  - "Grant block deny-by-default re-emitido DESPUÉS de la función (anon/authenticated/public revocados, service_role concedido)"
  - "0037 APLICADA a PROD (schema_migrations) + pgTAP 0037 12/12 + 0036 15/15 verdes"
affects: [ENT-03, ENT-04, ENT-01, entity-resolution, 36-financiamiento]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forward-fix por migración nueva (0037) en vez de mutar 0036 ya aplicada e inmutable a PROD"
    - "Columna XOR (vinculo_id parlamentario / vinculo_entidad_id terceros) con CHECK num_nonnulls <= 1: el path de rechazo/no-promote deja ambas null (num_nonnulls=0), que sigue siendo legal"
    - "El FK sobre la columna correcta (vinculo_entidad_id) es el guard estructural de la clase 23503; el CHECK es defensa-en-profundidad contra ambas-columnas-set, NO el guard de la clase FK"

key-files:
  created:
    - supabase/migrations/0037_resolver_entidad_audit_fix.sql
    - supabase/tests/0037_resolver_entidad_audit_fix.test.sql
  modified: []

key-decisions:
  - "Option A (operator-locked en re-planificación): agregar vinculo_entidad_id + FK + CHECK + CREATE OR REPLACE, no tabla de audit separada para terceros"
  - "Operador autorizó al agente a aplicar 0037 a PROD y verificar (DDL aditivo/reversible; tablas de terceros vacías → sin daño)"

patterns-established:
  - "Regresión funcional contra PROD vacío: el caso confirm-with-promote (lives_ok, no 23503) que faltaba en 35-01 ahora está en la suite — el mock TS no lo ejercía"

requirements-completed: [ENT-03, ENT-04]
# ENT-03/ENT-04 cerrados: el path de confirmación humana de terceros (resolver_entidad p_promover=true)
# persiste identidad_audit sin violar FK contra PROD. ENT-01 schema-correcto en PROD (0037 aplicada);
# el cierre pgTAP de ENT-01 (0035 18/18) lo aporta 35-07.

# Metrics
duration: ~25min
completed: 2026-06-24
---

# Phase 35 / Plan 06: Forward-fix 0037 — resolver_entidad audit FK — Summary

**Cerrado el Issue 1 de 35-05 (BLOCKER ENT-03/ENT-04): la migración forward-fix 0037 agrega `identidad_audit.vinculo_entidad_id` (FK → vinculo_entidad) + CHECK, y reemplaza `resolver_entidad` para escribir la columna correcta. Aplicada a PROD; pgTAP 0037 12/12 y 0036 15/15 verdes; deny-by-default preservado.**

## Performance

- **Duration:** ~25 min (Task 1 auto + Task 2 checkpoint de operador resuelto: aplicado por el agente bajo autorización explícita)
- **Tasks:** 1 auto (completada) + 1 checkpoint blocking-human (apply PROD, resuelto)
- **Files created:** 2

## Accomplishments

- **Causa raíz cerrada (ENT-03/ENT-04):** 0036 insertaba en `identidad_audit(vinculo_id, ...)` un id proveniente de `vinculo_entidad` (terceros), pero `vinculo_id` tiene FK → `vinculo_identidad` (parlamentario). Contra PROD vacío, el primer confirm-with-promote lanzaba `identidad_audit_vinculo_id_fkey` (23503). 0037 agrega `vinculo_entidad_id bigint references vinculo_entidad(id)` y el `CREATE OR REPLACE` escribe esa columna → la violación desaparece.
- **CHECK defensa-en-profundidad:** `identidad_audit_un_solo_vinculo` con `num_nonnulls(vinculo_id, vinculo_entidad_id) <= 1` (no `= 1`: el path de rechazo/no-promote escribe ambas null, num_nonnulls=0, que debe seguir siendo legal). No es el guard de la clase FK — eso lo dan el INSERT corregido + el FK sobre la columna correcta.
- **Deny-by-default preservado:** grant block re-emitido DESPUÉS del `CREATE OR REPLACE` (granting antes de definir la función concedería sobre objeto stale/ausente). Probes en PROD: anon=f, authenticated=f, public=f, service_role=t.
- **pgTAP nuevo (12 asserts):** has_column + FK + CHECK + 3 grant probes + regresión funcional (lives_ok, sin 23503) + vinculo_entidad_id non-null + vinculo_id null (XOR) + throws_ok 23514 (ambas columnas set) + lives_ok path parlamentario + throws_ok 23503 (un id de vinculo_entidad en vinculo_id → el FK parlamentario es el guard estructural). Verde 12/12 contra PROD.
- **Apply a PROD (ENT-01):** 0037 aplicada por `psql --single-transaction -v ON_ERROR_STOP=1` (heredoc stdin) + fila en `schema_migrations`. 0036 pgTAP ahora 15/15 (el caso transaccional que lanzaba 23503 ahora pasa).

## Task Commits

1. **Task 1: escribir 0037 migración + pgTAP** — `ffa7346` (`feat(35-06): forward-fix 0037 resolver_entidad audit FK (vinculo_entidad_id + CHECK)`)
2. **Task 2: CHECKPOINT apply operador a PROD** — ejecutado por el agente bajo autorización explícita del operador ("I apply + verify now"). Aplicado a PROD; NO es commit de código.

## Files Created

- `supabase/migrations/0037_resolver_entidad_audit_fix.sql` — ADD COLUMN vinculo_entidad_id (FK) + ADD CONSTRAINT identidad_audit_un_solo_vinculo + CREATE OR REPLACE resolver_entidad (INSERT corregido) + grant block tras la función.
- `supabase/tests/0037_resolver_entidad_audit_fix.test.sql` — `plan(12)`, 12 asserts (estructurales + grants + regresión + CHECK + guards parlamentarios).

## Decisions Made

- **Option A (forward-fix aditivo)** sobre tabla de audit separada: menos superficie, reusa identidad_audit con XOR de columnas.
- **Apply por el agente** bajo autorización del operador (DDL aditivo/reversible, terceros vacíos).

## Deviations from Plan

- El draft del plan sembraba `vinculo_identidad` con la columna `origem` (typo); el schema real (0006 línea 36) usa `origen`. El ejecutor corrigió el seed a `origen` (Rule 1 fix — el test como estaba habría fallado con "column origem does not exist"). Sin impacto en el diseño.

## Issues Encountered

Ninguno en apply ni verificación. Pre-check confirmó estado limpio (0037 no aplicada, sin columna/CHECK previos) antes de aplicar.

## Verification (estado real contra PROD)

| Criterio | Estado |
|----------|--------|
| 0037 aplicada + fila en schema_migrations | ✅ |
| 0037 pgTAP verde | ✅ 12/12 |
| 0036 pgTAP verde (regresión 23503 cerrada) | ✅ 15/15 |
| anon/authenticated/public NO ejecutan resolver_entidad | ✅ f/f/f |
| service_role SÍ ejecuta resolver_entidad | ✅ t |
| vinculo_entidad_id non-null + vinculo_id null tras confirm-with-promote | ✅ |

## Next Phase Readiness

- **ENT-03/ENT-04:** cerrados contra PROD — el path de confirmación humana de terceros ya no lanza FK.
- **ENT-01:** schema-correcto en PROD (0037 aplicada). El cierre pgTAP de ENT-01 (0035 18/18) lo aporta 35-07.

---
*Phase: 35-ent-resoluci-n-de-identidades-de-terceros*
*Completed: 2026-06-24*
