---
phase: 57-cron-fix-hardening-dos-etapas-hash-check-crons-verdes
plan: "02"
subsystem: tramitacion
tags: [bug-fix, tdd, dedup, upsert, leyes-weekly]
dependency_graph:
  requires: []
  provides: [G4-fix]
  affects: [leyes-weekly, upsertEventos]
tech_stack:
  added: []
  patterns: [dedupePorClave-mirror-upsertVotos]
key_files:
  created:
    - packages/tramitacion/src/writer-supabase.test.ts
  modified:
    - packages/tramitacion/src/writer-supabase.ts
decisions:
  - "Separated \x00 as key separator in upsertEventos (vs space in upsertVotos) to avoid ambiguity with field content"
metrics:
  duration: "~8 min"
  completed: "2026-07-08"
  tasks_completed: 2
  files_changed: 2
---

# Phase 57 Plan 02: G4 dedupePorClave in upsertEventos Summary

**One-liner:** Applied `dedupePorClave` to `upsertEventos` (3-line mirror of `upsertVotos`) with NUL separator, unblocking leyes-weekly from CRITICAL G4 duplicate-key crash since 2026-06-26.

## What Was Done

### Task 1: Test reproductor (RED)
Created `packages/tramitacion/src/writer-supabase.test.ts` with a G4 reproducer test that:
- Builds a `mockClient` capturing arrays passed to `upsert`
- Calls `upsertEventos([ev, ev])` with the same event twice
- Asserts the batch sent to Supabase has exactly 1 row

Test failed as expected before the fix (mock received 2 rows).

### Task 2: Fix (GREEN)
Applied `dedupePorClave` in `upsertEventos` before the `chunk` loop:
```typescript
const deduped = dedupePorClave(
  eventos,
  (e) => [e.boletin, e.fecha, e.camara, e.tipo, e.descripcion].join("\x00"),
);
for (const lote of chunk(deduped, CHUNK)) { ... }
```

Used `\x00` (NUL) as separator — not ambiguous with field content, and distinct from the space separator used in `eventoKey` (writer.ts:74).

## Test Results

- Suite `@obs/tramitacion`: **108/108 passed** (was 107 before adding test)
- `pnpm -w typecheck`: clean

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (RED) | `ed931f7` | test(57-02): add G4 reproducer |
| Task 2 (GREEN) | `2b95e21` | fix(57-02): apply dedupePorClave in upsertEventos |

## Deviations from Plan

None — plan executed exactly as written. The `dedupePorClave` function was already present in the file (line 43-47) as expected. The fix was exactly the 3-line insertion described in PATTERNS.md.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `packages/tramitacion/src/writer-supabase.test.ts`: EXISTS
- `packages/tramitacion/src/writer-supabase.ts` contains `dedupePorClave` call in `upsertEventos`: VERIFIED
- Commits `ed931f7` and `2b95e21`: EXIST
- Suite green: 108/108 PASSED
- Typecheck: CLEAN
