---
phase: 72-dinero-p5d-extender-materializador-cruce-senal-con-lobby-sector-aporte
plan: 02
subsystem: database
tags: [runbook, operador-local, migration, pgtap, cruce_senal, money, dinero, checkpoint]

# Dependency graph
requires:
  - phase: 72-01
    provides: "migración aditiva 0052 (CHECK ampliado + rama lobby_sector_aporte stub estructural) + pgTAP 7 aserciones validado offline (7/7 ok)"
  - phase: 39-cruce_senal
    provides: "cruces.materializar_cruces() FULL REBUILD + CHECK cruce_senal_tipo_senal_check + cron cruces-materializar + RLS deny-by-default + RPC 0040 sin grant anon"
  - phase: 69-rut-01
    provides: "checkpoint operador RUT-01 (PENDIENTE) — dependencia de DATOS de la señal aporte"
  - phase: 70-chilecompra
    provides: "backfill ChileCompra por RUT (PENDIENTE, runbook 70-03) — dependencia de DATOS de la señal aporte"
provides:
  - "72-APPLY-RUNBOOK.md: procedimiento operador-LOCAL de aplicación de 0052 a PROD por psql --db-url --single-transaction + verificación pgTAP contra schema APLICADO"
  - "Documentación del vacío honesto de la señal por DOS razones (arista empresa→sector ausente + RUT/backfill pendientes) + gate MONEY OFF hasta Phase 73 + rollback aditivo"
  - "Checkpoint blocking-human registrado: el apply a PROD es acto de operador PENDIENTE (el agente NO tocó PROD)"
affects: [73-flip-legal-money, cruces_de_parlamentario]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runbook operador-LOCAL de apply de DDL controlado (espejo de 66/67/70/71): el agente escribe y valida offline, el operador aplica a PROD; build/typecheck son falso positivo, el pgTAP contra el schema APLICADO es la única prueba válida (Pitfall 5)"
    - "Empty-honest documentado por DOS razones independientes: (a) arista estructural ausente correcto-por-construcción, (b) datos pendientes (RUT-01 + backfill) — ninguna un bug"

key-files:
  created:
    - ".planning/phases/72-dinero-p5d-extender-materializador-cruce-senal-con-lobby-sector-aporte/72-APPLY-RUNBOOK.md"
  modified: []

key-decisions:
  - "El agente NO aplica 0052 a PROD ni corre supabase db push ni flipea MONEY — patrón operador-LOCAL blocking-human (mismo que 0023/0038/0039/0049 y los runbooks 66/67/70/71)"
  - "El runbook fuerza aplicar UNA vez (Bloque 1 drop+add del constraint NO es re-ejecutable; Bloque 2 create-or-replace sí) y verificar el nombre del constraint contra pg_constraint ANTES del drop (Pitfall A1)"
  - "El vacío honesto de la señal (0 filas) se documenta como CORRECTO por construcción + por datos, con la sustancia diferida (arista <company-rut → sector>) explícita — NO un bug del materializador"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 72 Plan 02: Runbook operador-LOCAL de aplicación de 0052 + checkpoint blocking-human Summary

**Runbook operador-LOCAL (`72-APPLY-RUNBOOK.md`) que documenta cómo el operador aplica la migración aditiva `0052` al remoto PROD por `psql --db-url --single-transaction` (NUNCA `supabase db push`, `PGCLIENTENCODING=UTF8`, BOM esquivado, constraint verificado contra `pg_constraint` antes del drop), corre el pgTAP contra el schema APLICADO (7/7 `ok`), confirma el vacío honesto de la señal `lobby_sector_aporte` (0 filas por arista empresa→sector ausente + RUT/backfill pendientes) y deja MONEY OFF hasta el flip legal de Phase 73 — con la aplicación a PROD registrada como checkpoint blocking-human PENDIENTE (el agente NO tocó PROD).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (1 auto ejecutada + 1 checkpoint blocking-human PENDIENTE)
- **Files modified:** 1 (1 creado)

## Accomplishments
- **`72-APPLY-RUNBOOK.md` escrito** (279 líneas) espejando el tono/estructura de los runbooks operador previos (69/70/71), con las 7 secciones: pre-checks, aplicación, precondición del constraint, verificación pgTAP, post-aplicación (vacío honesto), gate MONEY, rollback + cierre.
- **Aplicación documentada** por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql`, con el BOM UTF-8 del `.env` esquivado y `supabase db push` explícitamente PROHIBIDO (drift de `schema_migrations`). Advertencia de idempotencia: aplicar UNA vez (Bloque 1 drop+add del constraint NO re-ejecutable; Bloque 2 `create or replace` sí).
- **Precondición del constraint** (Pitfall A1): verificar `select conname from pg_constraint where conrelid='public.cruce_senal'::regclass and contype='c'` = `cruce_senal_tipo_senal_check` ANTES del drop; ajustar el `drop` de 0052 si un forward-fix lo renombró.
- **Verificación pgTAP** contra el schema APLICADO: `psql -tA -f supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql`, esperar 0 `not ok` (7 aserciones). Documentado que build/typecheck NO prueban el DDL (falso positivo de CI, Pitfall 5).
- **Vacío honesto explícito** por DOS razones independientes: (a) ESTRUCTURAL — la arista `<company-rut → sector>` no existe (CTE `empresa_sector where false`, stub correcto-por-construcción; la sustancia diferida de MONEY-03 es construir esa arista: columna `sector_id` en la entidad-empresa + su clasificador); (b) DE DATOS — RUT-01 0% + backfill ChileCompra pendiente. Post-apply: correr `select cruces.materializar_cruces();` → `count where tipo_senal='lobby_sector_aporte'` = 0 HOY, CORRECTO, NO un bug.
- **Gate MONEY OFF** documentado: la señal se materializa OFF-line pero NO se presenta hasta el sign-off legal 21.719 de Phase 73 (acto humano). El apply NO añade grants/policies; el RPC 0040 hereda el token pero sigue sin grant a anon.
- **Rollback aditivo** documentado: revertir el CHECK a `('lobby_sector')` (drop+add), borrar filas del token nuevo, re-emitir `cruces.materializar_cruces()` de 0039 (sin la rama aporte); MONEY se queda OFF en todo el proceso.
- **Verify automatizado del plan: 12/12 PASS.**

## Task Commits

1. **Task 1: runbook operador-LOCAL de aplicación de 0052 + verificación pgTAP** — `41fc207` (docs)
2. **Task 2 (checkpoint blocking-human): aplicación a PROD + pgTAP verde** — **NO EJECUTADO** (acto de operador PENDIENTE; ver abajo)

**Plan metadata:** (final commit tras este SUMMARY)

## Files Created/Modified
- `.planning/phases/72-.../72-APPLY-RUNBOOK.md` — Procedimiento operador-LOCAL de apply de 0052 a PROD + verificación pgTAP + estado de la señal (vacío honesto por arista ausente + datos pendientes) + confirmación MONEY OFF + rollback. Referencia las rutas reales `supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql` y `supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql`.

## Deviations from Plan

None - plan executed exactly as written.

## Blocking Operator Checkpoint (Task 2) — PENDIENTE

**El agente NO aplicó el DDL a PROD (blocking-human, autonomous:false, patrón operador-LOCAL de 0023/0038/0039/0049).** La aplicación de 0052 al remoto PROD + la corrida real del pgTAP contra el schema aplicado es un acto de operador PENDIENTE. Pasos (ver `72-APPLY-RUNBOOK.md`):

1. Verificar el nombre del constraint: `psql "$SUPABASE_DB_URL" -tAc "select conname from pg_constraint where conrelid='public.cruce_senal'::regclass and contype='c';"` → confirmar `cruce_senal_tipo_senal_check` (ajustar el `drop` de 0052 si difiere).
2. Aplicar: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql` (NUNCA `supabase db push`; UNA vez).
3. pgTAP contra el schema aplicado: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql` → esperar 0 `not ok`.
4. Confirmar vacío honesto: `select count(*) from cruce_senal where tipo_senal='lobby_sector_aporte';` = 0 HOY (CORRECTO — arista empresa→sector ausente + RUT-01/backfill pendientes, NO un bug).
5. Confirmar `MONEY_PUBLIC_ENABLED` sigue OFF.

**Resume-signal:** el operador escribe `"aplicado"` (con el resultado del pgTAP y `count=0` confirmado), o describe el fallo (nombre de constraint distinto, error de aplicación, o pgTAP rojo → rollback §6 del runbook).

**Prerrequisitos de DATOS (independientes de este apply, no bloquean el apply del DDL):** RUT-01 (Phase 69) + backfill ChileCompra (Phase 70). El flip legal de MONEY es Phase 73.

## Next Phase Readiness
- 0052 queda listo para aplicar a PROD (runbook entregado); es la única deuda pendiente de la Phase 72, como checkpoint operador blocking-human.
- MONEY_PUBLIC_ENABLED OFF hasta el sign-off legal 21.719 de Phase 73.
- La señal `lobby_sector_aporte` se poblará cuando exista la arista real empresa→sector Y los datos (RUT-01 + backfill) aterricen; el cron `cruces-materializar` y el RPC 0040 heredan el token sin cambios.

## Self-Check: PASSED

- FOUND: .planning/phases/72-.../72-APPLY-RUNBOOK.md
- FOUND: 72-02-SUMMARY.md
- FOUND commit 41fc207 (Task 1, docs)
- Task 2 (apply PROD) = checkpoint blocking-human PENDIENTE por diseño (el agente NO toca PROD)

---
*Phase: 72-dinero-p5d-extender-materializador-cruce-senal-con-lobby-sector-aporte*
*Completed: 2026-07-15*
