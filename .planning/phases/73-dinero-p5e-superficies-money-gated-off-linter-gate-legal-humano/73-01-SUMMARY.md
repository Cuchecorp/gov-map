---
phase: 73
plan: 01
subsystem: money-gate
tags: [money, anti-insinuacion, guard, deny-by-default, single-source]
requires:
  - app/lib/money-gate.ts (chokepoint, read-only)
  - app/lib/voto-presentacion.ts (LEYENDA_ANTI_INSINUACION pattern)
  - .env.example (MONEY_PUBLIC_ENABLED=false)
provides:
  - LEYENDA_ANTI_INSINUACION_MONEY (single-source constant)
  - money-antiflip-guard (3-vector CI guard + mutation self-check)
affects:
  - plan 73-02 (imports the legend into the 4 MONEY surfaces)
  - plan 73-03 (linter subtracts the legend from NEGACIONES_LOCKED)
  - plan 73-04 (dossier)
tech-stack:
  added: []
  patterns:
    - single-source legend constant (mirror voto-presentacion.ts)
    - guard-as-test with pure detectors + in-memory mutation self-check
    - walkSourceFiles/SKIP_DIRS/stripTsComments reproduced (not imported)
key-files:
  created:
    - app/lib/money-presentacion.ts
    - app/lib/money-antiflip-guard.test.ts
  modified: []
decisions:
  - Vector 3 relies on walkSourceFiles excluding *.test.* by construction, so the raw-env allowlist has exactly ONE nominated entry (lib/money-gate.ts); test files that inject { MONEY_PUBLIC_ENABLED: "true" } are out of scope by the walker, not by a broad pattern.
  - Detection logic extracted to pure detectarRelajacionGate / detectarRawEnvEnRuta so the mutation self-check runs entirely in memory (never mutates repo files).
metrics:
  duration: ~15m
  completed: 2026-07-15
  tasks: 2
  files: 2
---

# Phase 73 Plan 01: MONEY legend single-source + anti-flip guard Summary

Added the single-source `LEYENDA_ANTI_INSINUACION_MONEY` constant (verbatim LOCKED
copy) and the `money-antiflip-guard.test.ts` CI guard that freezes the MONEY
deny-by-default gate across three vectors (fail-closed `=== "true"`, `.env.example=false`,
no-raw-env-in-route) with an in-memory mutation self-check — green on the current tree,
gate stays OFF.

## What was built

### Task 1 — `LEYENDA_ANTI_INSINUACION_MONEY` (commit `dce8266`)
`app/lib/money-presentacion.ts`: a single `export const` holding the verbatim LOCKED
legend from 73-UI-SPEC §Leyenda (with exact accents: "público", "afirmación",
"influencia", "intención", "decisión"). Mirrors the `LEYENDA_ANTI_INSINUACION` pattern
of `voto-presentacion.ts` — a side-effect-free `app/lib/` module, no `import "server-only"`
(it is client-renderable text). JSDoc documents it as the single source imported by the
4 MONEY surfaces and subtracted from the linter's `NEGACIONES_LOCKED` (plans 02/03).

### Task 2 — `money-antiflip-guard.test.ts` (commit `488f957`)
`app/lib/money-antiflip-guard.test.ts`: a vitest guard (picked up by `pnpm --filter ./app test`)
with three assertion vectors over real files + a mutation self-check:
- **Vector 1 (fail-closed):** reads `money-gate.ts`, asserts `MONEY_PUBLIC_ENABLED === "true"`
  present and neither `Boolean(...)` laxo nor `!== "false"`.
- **Vector 2:** reads `.env.example`, asserts `=false` present and `=true` absent.
- **Vector 3 (NET-NEW):** reproduces `walkSourceFiles`/`SKIP_DIRS`/`stripTsComments` verbatim
  from `lockdown-guard.test.ts`, walks `app/`, and FAILS if any source file (other than the
  allowlisted chokepoint `lib/money-gate.ts`) names `MONEY_PUBLIC_ENABLED` after comment strip.
- **Mutation self-check (in memory):** pure `detectarRelajacionGate` / `detectarRawEnvEnRuta`
  are exercised against mutated fixtures — A (gate → `Boolean(...)` / `!== "false"`), B
  (`.env.example=true`), C (raw env in a route) — each proving the guard bites, plus
  negative cases (chokepoint allowlisted; comment-only mention not flagged).

## Verification

- `pnpm vitest run lib/money-antiflip-guard.test.ts` → 12 tests pass.
- `pnpm --filter ./app test` → 74 files, 788 tests pass (no regression).
- `pnpm --filter ./app typecheck` (tsc --noEmit) → clean.
- `git status --short app/lib/money-gate.ts .env.example` → empty (both untouched;
  gate still `=== "true"`, `.env.example` still `=false`).

## Deviations from Plan

None — plan executed exactly as written.

Note on Vector 3 allowlist: the plan asked for an explicit nominated allowlist of test
files. In practice `walkSourceFiles` already excludes `*.test.ts`/`*.test.tsx` by
construction (verbatim from `lockdown-guard.test.ts`), so the surviving non-test file that
names the flag is exactly one — the chokepoint `lib/money-gate.ts` — which is the single
nominated allowlist entry. The 5 test files that inject `{ MONEY_PUBLIC_ENABLED: "true" }`
(money-gate.test.ts, parlamentario-resumen.test.tsx, contratos/financiamiento-de-parlamentario.test.tsx,
this guard) are documented in the RAW_ENV_ALLOWLIST comment as out-of-scope by the walker.
This is the plan's intent (allowlist by exact path + documented reason), not a deviation.

## Anti-flip invariants confirmed (NOT flipped)

- `MONEY_PUBLIC_ENABLED` still OFF/default; gate still `=== "true"`.
- `.env.example` still `MONEY_PUBLIC_ENABLED=false`.
- Dossier signoff untouched (this plan does not touch it; remains pending).

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: app/lib/money-presentacion.ts
- FOUND: app/lib/money-antiflip-guard.test.ts
- FOUND commit: dce8266
- FOUND commit: 488f957
