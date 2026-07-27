---
phase: 74-deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly
plan: 01
subsystem: infra
tags: [ingesta, cursor, leylobby, supabase, postgres, rls, vitest, deno]

# Dependency graph
requires:
  - phase: 08-18 (v2.0 lobby)
    provides: conector leylobby + hash-check R2 (ingest-run.ts putImmutable/existed) + writer marcador (0021 lobby_ingesta_estado)
provides:
  - Cursor incremental durable del conector leylobby (leylobby_cursor_estado, 0053) que avanza (institución/año/página) entre corridas
  - Lógica pura testeable de avance/wrap del cursor (cursor-leylobby.ts) — no re-scrapea el histórico
  - Wire ingest-cli: leer cursor antes / avanzar tras corrida exitosa; degradación 403/503 NO avanza
affects: [74-02 (round-robin leyes-weekly usa el mismo patrón marcador), cron lobby-leylobby-weekly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cursor marcador durable espejando lobby_ingesta_estado (0021)/aportes_ingesta_estado (0024) pero deny-by-default (uso interno de cron, no ficha)"
    - "Lógica pura de avance separada del I/O (cursor-leylobby.ts) para test unitario sin red/DB"
    - "Persistir DESPUÉS de corrida exitosa; huboDatos=false → no avanza (degradación honesta)"

key-files:
  created:
    - supabase/migrations/0053_leylobby_cursor_estado.sql
    - packages/lobby/src/cursor-leylobby.ts
    - packages/lobby/src/cursor-leylobby.test.ts
  modified:
    - packages/lobby/src/writer.ts
    - packages/lobby/src/writer-supabase.ts
    - packages/lobby/src/ingest-cli.ts
    - packages/lobby/src/ingest-cli.test.ts

key-decisions:
  - "Cursor deny-by-default (RLS sin policy to anon): es uso interno de cron, la ficha no lo consulta — a diferencia de lobby_ingesta_estado que sí es public-read (T-74-04)"
  - "avanzarCursor con huboDatos=false devuelve el cursor byte-idéntico → una corrida degradada (403/503) no avanza (Pitfall 4 / T-74-02)"
  - "El override explícito (--anio/--paginas) y dry-run NO consultan el cursor (corridas dirigidas de operador)"
  - "Histórico hacia atrás: al agotar paginaMax de un año → anio-1/pag 1, sin bajar de anioMin (2015) → no loop infinito"

patterns-established:
  - "Cursor incremental durable = tabla marcador (PK institución) + lógica pura de avance + wire leer-antes/avanzar-después"

requirements-completed: [DEBT-02]

# Metrics
duration: ~40min
completed: 2026-07-15
---

# Phase 74 Plan 01: Cursor incremental leylobby Summary

**Cursor durable (migración 0053 `leylobby_cursor_estado`) que avanza (institución/año/página) entre corridas del conector leylobby — lógica de avance/wrap pura + testeable, cableada en ingest-cli con leer-antes/avanzar-después y degradación honesta (403/503 no avanza), preservando el hash-check R2 existente.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-15T03:10Z (aprox)
- **Completed:** 2026-07-15
- **Tasks:** 2 (ambas TDD)
- **Files modified:** 7 (3 creados, 4 modificados)

## Accomplishments
- **Migración 0053** `leylobby_cursor_estado` (PK `institucion_codigo` + `anio` + `pagina` + `fecha_captura`), RLS habilitada **sin** policy `to anon` (deny-by-default, uso interno de cron) — espeja la forma de `lobby_ingesta_estado`/`aportes_ingesta_estado` pero sin superficie pública.
- **Lógica pura `cursor-leylobby.ts`:** `avanzarCursor` (pagina+1 / anio-1 al agotar, tope `anioMin`), `deriveTarea`, `cursorInicial` — sin red/DB, 6 casos unitarios.
- **Wire en `ingest-cli.ts`:** sin `--anio`/`--paginas` + writer real → lee el cursor durable, deriva la tarea de UNA página, corre, y tras corrida exitosa (`audiencias>0`) avanza + persiste; degradación (403/503, `audiencias===0`) **no** avanza. Override y dry-run no tocan el cursor.
- **Sin regresión:** el hash-check R2 (`[skip] sin novedades`) y la degradación honesta de `ingest-run.ts` quedaron intactos (no se tocó ese archivo).

## Task Commits

1. **Task 1: Migración 0053 + lógica pura de avance** — `ab44961` (feat, TDD: test RED → impl GREEN en un commit)
2. **Task 2: Wire cursor en ingest-cli + writer** — `610895e` (feat, TDD: tests + impl)

**Plan metadata:** (final commit abajo)

## Files Created/Modified
- `supabase/migrations/0053_leylobby_cursor_estado.sql` — tabla marcador del cursor, RLS deny-by-default.
- `packages/lobby/src/cursor-leylobby.ts` — lógica pura de avance/wrap del cursor + `deriveTarea` + `cursorInicial`.
- `packages/lobby/src/cursor-leylobby.test.ts` — 6 casos (avance, retroceso de año, no-avance, no-bajar-de-anioMin, deriveTarea, primera corrida).
- `packages/lobby/src/writer.ts` — `LobbyWriter` extendido con `leerCursor`/`avanzarCursor`; `InMemoryLobbyWriter` con `cursorEstado` Map.
- `packages/lobby/src/writer-supabase.ts` — `SupabaseLobbyWriter.leerCursor`/`avanzarCursor` contra `leylobby_cursor_estado` (onConflict `institucion_codigo`, solo `error.message`).
- `packages/lobby/src/ingest-cli.ts` — derivación de tareas vía cursor + avance post-corrida.
- `packages/lobby/src/ingest-cli.test.ts` — 5 casos de wiring (avance, primera corrida, degradada-no-avanza, override, dry-run).

## Decisions Made
- **Deny-by-default para el cursor:** RLS habilitada sin `to anon`; el cursor no se expone a la ficha (T-74-04). Validado localmente: `anon` recibe `permission denied` al leer.
- **`anioMin` (2015) como piso del histórico:** evita loop infinito al agotar el histórico; el cursor se queda quieto y el hash-check R2 decide si hay novedades.
- **`huboDatos = res.audiencias > 0`:** la señal de "corrida exitosa" que gatea el avance. Una degradación (403/503) produce `audiencias===0` y `degradaciones>0` → no avanza.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Validación de migración local:** existe un Supabase Postgres local (`127.0.0.1:54322`). Se validó la 0053 en una transacción `begin`/`rollback` (sin persistir, sin tocar remoto/PROD). Al correr como `postgres`, las default-ACLs locales otorgan a `anon` `TRIGGER/REFERENCES/TRUNCATE` (artefacto de la instancia local, no del archivo de migración) — pero **ningún** `SELECT/INSERT/UPDATE/DELETE`, y con RLS activa sin policy `anon` recibe `permission denied for table leylobby_cursor_estado`. Deny-by-default confirmado. El archivo de migración no contiene ningún `grant ... to anon`.

## Migration Apply — Operator Debt
- **`supabase/migrations/0053_leylobby_cursor_estado.sql` NO fue aplicada a remoto/PROD** (validada solo localmente en rollback). El operador debe aplicarla (`supabase db push --db-url ...` o el flujo de migraciones del repo) antes de que el cron `lobby-leylobby-weekly` use el cursor en LIVE. Sin la tabla, `leerCursor` fallará con `leer leylobby_cursor_estado falló: ...` en la primera corrida real.

## User Setup Required
None - no external service configuration required (aparte de la aplicación de la migración por operador, arriba).

## Next Phase Readiness
- El patrón de cursor marcador queda establecido para **74-02** (round-robin leyes-weekly, migración 0054, mismo enfoque deny-by-default).
- Corrida LIVE real contra `leylobby.gob.cl` = acto de operador (fuera de alcance offline).

## Self-Check: PASSED

- Files created/modified: all 6 verified present on disk.
- Commits: `ab44961` (Task 1) and `610895e` (Task 2) verified in git log.
- `pnpm --filter @obs/lobby test` → 68 tests green (9 files); `tsc --noEmit` exit 0.
- Migration 0053 validated locally in rollback transaction: PK/columns/RLS correct, `anon` = `permission denied` (deny-by-default). NOT applied to remote/PROD.

---
*Phase: 74-deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly*
*Completed: 2026-07-15*
