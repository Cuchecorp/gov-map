---
phase: 04-adjudicacion-identidad-compuerta-humana-golden-set
plan: 02
subsystem: identidad
tags: [supabase, postgres, migracion, rls, pgtap, append-only, trigger, audit, identidad]

# Dependency graph
requires:
  - "Migracion 0005 (tabla parlamentario, PK text id) + patron de migracion/pgTAP de Fase 1/3 (RLS deny-by-default)"
provides:
  - "Tabla `vinculo_identidad` (mencion→parlamentario_id, estado confirmado/probable/no_confirmado default no_confirmado) — producto final ID-06"
  - "Cola `revision_identidad` (registro foraneo + candidatos + salida_modelo + estado pendiente/resuelto + revisor_id + timestamps) — ID-05"
  - "Audit log `identidad_audit` APPEND-ONLY enforced por trigger RAISE EXCEPTION + REVOKE update/delete/truncate — ID-08"
  - "Contrato DDL que el orquestador de adjudicacion (escritor service role) y el CLI de revisor consumen"
affects: [identidad, adjudicacion-llm, compuerta-humana, golden-set]

# Tech tracking
tech-stack:
  added: []
  patterns: [rls-deny-by-default, provenance-inline, append-only-trigger, revoke-defensa-en-profundidad, pgtap-throws-ok]

key-files:
  created:
    - supabase/migrations/0006_revision_identidad.sql
    - supabase/tests/0005_revision_identidad.test.sql
  modified: []

key-decisions:
  - "Inmutabilidad de identidad_audit por trigger BEFORE UPDATE OR DELETE (RAISE EXCEPTION) — unica defensa que aplica al service role que bypassa RLS — MAS REVOKE update/delete/truncate como defensa en profundidad (ID-08, Pitfall 4)"
  - "vinculo_identidad.estado default no_confirmado por DDL: nada se auto-confirma; parlamentario_id nullable (no_confirmado puede no tener id)"
  - "candidatos jsonb SIN rut (minimizacion aguas arriba); el RUT nunca toca esta cola ni el LLM"

requirements-completed: [ID-05, ID-06, ID-08]

# Metrics
duration: 4min
completed: 2026-06-18
---

# Phase 4 Plan 02: vinculo_identidad + revision_identidad + identidad_audit (DDL) Summary

**La migracion 0006 materializa el estado durable del subsistema de identidad asistida — el vinculo final mencion→id (ID-06), la cola humana (ID-05) y el audit log inmutable (ID-08) — donde la inmutabilidad del audit se enforcea con AMBOS mecanismos (trigger RAISE EXCEPTION que aplica al service role + REVOKE update/delete/truncate) y se prueba con pgTAP `throws_ok` sobre UPDATE y DELETE; 85 tests pgTAP verdes.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-18T14:19:19Z
- **Completed:** 2026-06-18T14:23:00Z
- **Tasks:** 2
- **Files modified:** 2 creados

## Accomplishments
- `vinculo_identidad` (ID-06): producto final mencion→id con `mencion_nombre`/`mencion_normalizada`, `camara` (check diputados|senado), `periodo`, `parlamentario_id` (FK nullable a parlamentario), `estado` (check confirmado|probable|no_confirmado, **default no_confirmado**), `metodo` (check determinista|llm|humano), provenance inline (origen/fecha_captura/enlace) e indice unico PARCIAL `(camara, periodo, mencion_normalizada) where parlamentario_id is not null` para idempotencia del vinculo resuelto.
- `revision_identidad` (ID-05): cola humana con `vinculo_id` (FK nullable), mencion + camara/periodo/region, `candidatos` jsonb (default `[]`, SIN rut), `salida_modelo` jsonb (la Adjudicacion validada), `modelo_version`, `estado` (check pendiente|confirmado|rechazado|corregido, **default pendiente**), `revisor_id`, `motivo`, `created_at`/`resolved_at`.
- `identidad_audit` (ID-08): append-only con `metodo`/`decision`/`confidence`/`modelo_version`/`revisor_id`/`evidence`/`conflicts`/`created_at`. Inmutabilidad con AMBOS mecanismos:
  - **Trigger** `identidad_audit_immutable` BEFORE UPDATE OR DELETE → `raise exception` (errcode `restrict_violation` = SQLSTATE 23001). Aplica a TODOS los roles, incluido el service role que bypassa RLS — la barrera efectiva (Pitfall 4).
  - **REVOKE** `update, delete, truncate ... from public` — defensa en profundidad.
- RLS deny-by-default en las TRES tablas (enable sin policies) — anon nunca lee identidad/cola/auditoria.
- `supabase db reset` aplica 0001→0006 limpio; `supabase db lint` sin errores; `supabase test db` verde (85 tests, 33 del nuevo pgTAP) incluyendo los dos `throws_ok` de inmutabilidad (UPDATE+DELETE) como asserts explicitos.

## Task Commits

Cada tarea se comiteo atomicamente:

1. **Task 1: Migracion 0006 — vinculo_identidad + revision_identidad + identidad_audit append-only** - `d01dc40` (feat)
2. **Task 2: pgTAP 0005 — columnas, checks, RLS deny-by-default, inmutabilidad del audit** - `9e2b1c9` (test)

## Files Created/Modified
- `supabase/migrations/0006_revision_identidad.sql` - DDL de las tres tablas; trigger + REVOKE de inmutabilidad de identidad_audit; RLS deny-by-default en las tres.
- `supabase/tests/0005_revision_identidad.test.sql` - 33 asserts pgTAP: has_table/has_column de las tres tablas, col_default_is (estado no_confirmado/pendiente), throws_ok 23514 (checks de dominio), lives_ok (append legal), throws_ok 23001 sobre UPDATE y DELETE de identidad_audit (inmutabilidad ID-08), has_trigger, is_empty del REVOKE, RLS habilitada + is_empty(pg_policy) en las tres.

## Decisions Made
- **Inmutabilidad por trigger + REVOKE (no RLS sola)** — el writer del audit usa service role, que bypassa RLS; solo el trigger `RAISE EXCEPTION` BEFORE UPDATE OR DELETE frena al service role. El REVOKE es defensa en profundidad. pgTAP corre como superuser local (peor caso): si el trigger bloquea ahi, bloquea al service role.
- **`vinculo_identidad.parlamentario_id` nullable** — un vinculo `no_confirmado` puede no tener id asignado todavia; el indice unico PARCIAL solo aplica a los resueltos (`where parlamentario_id is not null`).
- **`candidatos` jsonb sin rut** — minimizacion por diseno (la mencion foranea y los candidatos del blocking nunca llevan RUT; el RUT no toca la cola ni el LLM).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLSTATE esperado en los throws_ok de inmutabilidad**
- **Found during:** Task 2 (`supabase test db`)
- **Issue:** Los `throws_ok` de UPDATE/DELETE esperaban SQLSTATE `P0001` (raise exception generico), pero el trigger usa `using errcode = 'restrict_violation'` → SQLSTATE real `23001`. El trigger SI lanzaba (la inmutabilidad funciona); el test esperaba el codigo equivocado.
- **Fix:** `P0001` → `23001` en ambos `throws_ok`.
- **Files modified:** supabase/tests/0005_revision_identidad.test.sql
- **Verification:** ambos throws_ok pasan (UPDATE y DELETE lanzan).
- **Committed in:** `9e2b1c9` (Task 2)

**2. [Rule 1 - Bug] Conteo de plan pgTAP off-by-one**
- **Found during:** Task 2 (`supabase test db`)
- **Issue:** El test declaraba `plan(34)` pero corrian 33 asserts; pgTAP reporta "Bad plan" y FAIL aunque todas las sub-pruebas pasaran (mismo patron que el off-by-one de 03-02).
- **Fix:** `plan(34)` → `plan(33)` para reflejar el numero real de asserts.
- **Files modified:** supabase/tests/0005_revision_identidad.test.sql
- **Verification:** `supabase test db` → "All tests successful" (85 tests, Result: PASS).
- **Committed in:** `9e2b1c9` (Task 2)

**Total deviations:** 2 auto-fixed (2 bugs, ambos en el test). Sin scope creep.

## Threat Model Coverage
- **T-04-05 (Tampering/Repudiation / editar-borrar audit):** mitigado — trigger `RAISE EXCEPTION` BEFORE UPDATE OR DELETE (aplica al service role) + `REVOKE update,delete,truncate`; pgTAP `throws_ok` 23001 verifica que UPDATE y DELETE fallan, `has_trigger` verifica el trigger, `is_empty` verifica el REVOKE.
- **T-04-06 (Information Disclosure / anon lee cola/audit/vinculo):** mitigado — RLS deny-by-default (enable sin policies) en las 3 tablas; pgTAP verifica `relrowsecurity=true` + `is_empty(pg_policy)`. `candidatos` jsonb sin rut.
- **T-04-07 (Tampering / estado-metodo fuera de dominio):** mitigado — checks `(confirmado|probable|no_confirmado)` y `(determinista|llm|humano)` + default no_confirmado/pendiente; pgTAP `throws_ok` 23514.
- **T-04-SC (npm/pnpm installs):** N/A — solo DDL, sin paquetes nuevos.

## Issues Encountered
- Ninguno mas alla de los dos bugs del test documentados arriba (SQLSTATE esperado + off-by-one del plan).

## Next Phase Readiness
- El **orquestador de adjudicacion** (escritor service role) tiene el contrato DDL estable: escribe `vinculo_identidad` (estado segun la compuerta), encola en `revision_identidad` bajo umbral, y registra cada decision en `identidad_audit` (append-only garantizado por la DB).
- El **CLI de revisor** (ID-05) consume `revision_identidad`: lee pendientes, escribe estado/revisor_id/resolved_at, y deja rastro en `identidad_audit`.
- La inmutabilidad del audit esta sellada a nivel DB — confiar en la app es innecesario (Pitfall 4 cerrado).

## Self-Check: PASSED

Archivos declarados existen y ambos commits estan en el historial:
- Archivos: supabase/migrations/0006_revision_identidad.sql, supabase/tests/0005_revision_identidad.test.sql — ambos FOUND.
- Commits: d01dc40 (Task 1), 9e2b1c9 (Task 2) — ambos FOUND.

---
*Phase: 04-adjudicacion-identidad-compuerta-humana-golden-set*
*Completed: 2026-06-18*
