# Deferred items — Phase 16

Out-of-scope discoveries logged during execution (not fixed; do not block this phase).

## DI-16-01 — Pre-existing tsc error in `app/lib/buscar.test.ts`

- **Found during:** Plan 16-02, Task 3 (`npx tsc --noEmit -p app/tsconfig.json`).
- **Error:**
  - `lib/buscar.test.ts(156,17): error TS2532: Object is possibly 'undefined'.`
  - `lib/buscar.test.ts(156,41): error TS2493: Tuple type '[]' of length '0' has no element at index '0'.`
- **Line:** `const arg = emb.embed.mock.calls[0][0][0] as string;`
- **Origin:** Pre-existing — present at commit `4037694` (16-01 HEAD) and last touched by
  commit `86073bf` (phase 07). NOT introduced by Plan 16-02 (zero diff to this file in 16-02).
- **Why deferred:** Out of scope per the executor SCOPE BOUNDARY — it is a strictness error in
  an unrelated phase-07 test, not caused by any Phase 16 change. All Phase 16 files (page.tsx,
  the two lane components, the two RTL tests, `types.ts`, `buscar.ts`) typecheck clean.
- **Suggested fix (whoever owns search):** narrow the mock-call tuple access, e.g.
  `emb.embed.mock.calls[0]?.[0]?.[0] as string` or assert non-empty before indexing.
