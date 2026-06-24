---
phase: 34-ingest-ingesta-lobby-probidad-programada
plan: 01
subsystem: infra
tags: [supabase, source_snapshot, provenance, idempotencia, snapshot-store, ingest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "SnapshotWriter + interface SnapshotStore (@obs/ingest) y source_snapshot (migración 0002)"
provides:
  - "SupabaseSnapshotStore: implementación Node-side de SnapshotStore (supabase-js, manejo idempotente 23505), exportada desde @obs/ingest"
affects: [34-02, probidad, lobby, run-probidad-todos-cli, run-camara-lobby-cli]

# Tech tracking
tech-stack:
  added: []  # cero dependencias nuevas (T-34-SC); cliente supabase-js se inyecta
  patterns:
    - "Store Node-side con cliente supabase-js INYECTABLE (client | createClient factory) — @obs/ingest no depende de @supabase/supabase-js"
    - "Recuperación idempotente de unique-violation 23505: SELECT por clave natural → id existente; sin fila → Error RETRYABLE explícito (nunca undefined/TypeError)"

key-files:
  created:
    - packages/ingest/src/snapshot-store-supabase.ts
    - packages/ingest/src/snapshot-store-supabase.test.ts
  modified:
    - packages/ingest/src/index.ts

key-decisions:
  - "Cliente supabase-js INYECTABLE (client pre-armado o factory createClient) en vez de import directo: @obs/ingest queda desacoplado de @supabase/supabase-js (T-34-SC, cero deps nuevas); el consumidor (probidad, Plan 02) que ya tiene la lib provee el cliente"
  - "Mensaje de error de 23505-sin-fila nombra source/resource/date_bucket y es RETRYABLE (puerto verbatim del worker Deno #40); distinguible del error genérico 'insert source_snapshot fallo:'"
  - "La service key NUNCA se interpola en mensajes de error (T-34-01); su único uso es la factory createClient"

patterns-established:
  - "SupabaseClientLike estructural: tipa el subconjunto de supabase-js que toca insertSnapshot, sin importar la lib en ingest"
  - "Mock supabase-js estructural en tests (insert path + recovery path), sin red ni DB"

requirements-completed: [INGEST-04]

# Metrics
duration: ~10min
completed: 2026-06-24
---

# Phase 34 Plan 01: SupabaseSnapshotStore Node-side Summary

**Puerto Node-side del único `SnapshotStore` concreto del repo (antes inline en el worker Deno), con manejo idempotente verbatim de la unique-violation 23505 y cliente supabase-js inyectable — exportado desde `@obs/ingest` para los CLIs de ingesta.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-24T00:46:00Z (aprox)
- **Completed:** 2026-06-24T00:51:00Z (aprox)
- **Tasks:** 2 (Task 1 vía TDD: test → feat)
- **Files modified:** 3 (2 creados, 1 modificado)

## Accomplishments

- `SupabaseSnapshotStore` implementa `SnapshotStore` (`insertSnapshot`) hablando con `source_snapshot` vía supabase-js — la pieza fundacional de INGEST-04 que ningún CLI Node/tsx tenía (la única impl vivía en Deno worker L197–228, no reusable).
- Manejo idempotente de la unique-violation `23505` portado verbatim: re-insert el mismo día → SELECT por `(source, resource, date_bucket)` → devuelve el id de la fila existente (caché diaria WR-02), no falla el job.
- Cliente supabase-js INYECTABLE: `@obs/ingest` no declara `@supabase/supabase-js` (cero deps nuevas); el consumidor pasa un `client` o su factory `createClient`. En tests se inyecta un mock estructural — el test corre sin red ni DB.
- Re-exportado desde el barrel `@obs/ingest` → consumible por `run-probidad-todos-cli.ts` (Plan 02).

## Task Commits

1. **Task 1 (RED): test fallido para SupabaseSnapshotStore** — `b51038a` (test)
2. **Task 1 (GREEN): SupabaseSnapshotStore Node-side** — `b0c8693` (feat)
3. **Task 2: re-export desde el barrel @obs/ingest** — `de39d67` (feat)

_Task 1 es TDD: commit test (RED) → commit feat (GREEN). No hubo commit refactor separado — el ajuste de desacople (Rule 3) se incorporó al commit GREEN antes de la primera versión publicada._

## Files Created/Modified

- `packages/ingest/src/snapshot-store-supabase.ts` — `SupabaseSnapshotStore implements SnapshotStore`; `insertSnapshot` = `.from('source_snapshot').insert(row).select('id').single()` con recuperación 23505; cliente inyectable (`client | createClient`); `SupabaseClientLike` estructural.
- `packages/ingest/src/snapshot-store-supabase.test.ts` — 4 casos: insert OK, 23505 recupera fila, 23505-sin-fila RETRYABLE, error real sin exponer service key. Mock supabase-js estructural, sin red.
- `packages/ingest/src/index.ts` — re-export de `SupabaseSnapshotStore` + tipos de opciones, junto a `SnapshotWriter`.

## Decisions Made

- **Cliente supabase-js inyectable, no import directo.** El plan pedía "construye `createClient(url, serviceKey)` … si no se inyecta cliente". `@supabase/supabase-js` NO resuelve desde `packages/ingest` (pnpm aisla; solo está en `packages/probidad`) y `tsc -b` rompía con un dynamic import. En vez de declarar la dependencia en ingest (contradiría "cero dependencias nuevas", T-34-SC), se añadió una factory `createClient?` inyectable a las opciones. El consumidor (probidad, que ya tiene la lib) provee `client` o `createClient`. Mantiene a `@obs/ingest` desacoplado y `tsc` limpio. Ver Deviations.
- **Error 23505-sin-fila RETRYABLE** nombrando los 3 campos de la clave natural — puerto verbatim del worker (#40); nunca cae a `undefined`/`TypeError`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cliente supabase-js inyectable en vez de `createClient` directo / dynamic import**
- **Found during:** Task 1 (GREEN) — al correr `pnpm --filter @obs/ingest typecheck`.
- **Issue:** El plan indicaba construir `createClient(url, serviceKey)` de `@supabase/supabase-js` cuando no se inyecta cliente. Pero `@supabase/supabase-js` no es dependencia de `packages/ingest` (no resuelve ni desde el paquete ni hoisted; solo `packages/probidad` lo declara). Un `import("@supabase/supabase-js")` hacía fallar `tsc -b` con `TS2307: Cannot find module`. Declarar la dependencia en ingest contradiría T-34-SC ("cero dependencias nuevas").
- **Fix:** Se añadió una factory `createClient?: CreateSupabaseClient` a `SupabaseSnapshotStoreOptions` (junto al ya previsto `client?`). `getClient()` usa el `client` inyectado, o lo construye con la factory del consumidor, o lanza un error claro si falta ambos. `@obs/ingest` no referencia `@supabase/supabase-js` en ningún punto; el tipo de cliente es el estructural `SupabaseClientLike`. El consumidor (probidad/Plan 02) pasará su `createClient` o un `client` ya armado — espejo del patrón `client?` de `writer-supabase.ts`.
- **Files modified:** packages/ingest/src/snapshot-store-supabase.ts
- **Verification:** `tsc -b` limpio; 63 tests verdes; grep confirma `serviceKey` solo en constructor/factory, nunca en mensajes de error.
- **Committed in:** `b0c8693` (parte del commit GREEN de Task 1).

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** El fix preserva el invariante del plan (cero dependencias nuevas, T-34-SC) y la semántica pedida (cliente construido server-side con la service key); solo cambia el mecanismo de inyección (factory en vez de import directo). Sin scope creep. El contrato de consumo para Plan 02 es: `new SupabaseSnapshotStore({ url, serviceKey, createClient })` o `{ client }`.

## Issues Encountered

None más allá de la deviation de desacople documentada arriba.

## User Setup Required

None — no external service configuration required. El test corre sin red, sin DB y sin secrets reales. Cero DDL (la tabla `source_snapshot` ya existe en migración 0002).

## Next Phase Readiness

- `SupabaseSnapshotStore` está disponible vía `import { SupabaseSnapshotStore } from "@obs/ingest"`; Plan 34-02 (probidad R2/SnapshotWriter) puede consumirlo pasando `createClient` (de `@supabase/supabase-js`, que probidad ya tiene) o un `client` pre-armado.
- Contrato de instanciación para Plan 02: `new SupabaseSnapshotStore({ url, serviceKey, createClient })`.

---
*Phase: 34-ingest-ingesta-lobby-probidad-programada*
*Completed: 2026-06-24*

## Self-Check: PASSED

- FOUND: packages/ingest/src/snapshot-store-supabase.ts
- FOUND: packages/ingest/src/snapshot-store-supabase.test.ts
- FOUND: packages/ingest/src/index.ts (re-export present)
- FOUND commit b51038a (test RED)
- FOUND commit b0c8693 (feat GREEN)
- FOUND commit de39d67 (feat barrel re-export)
