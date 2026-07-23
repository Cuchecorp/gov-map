# Phase 90 — Deferred Items (out of plan scope)

Items discovered during execution that are OUT OF SCOPE for the current plan
(SCOPE BOUNDARY: only fix issues directly caused by the current task's changes).

## Pre-existing test failure — `app/lib/buscar.test.ts` (Phase 89 drift)

- **Discovered during:** 90-01 (root `pnpm test` verification)
- **File:** `app/lib/buscar.test.ts:193`
- **Symptom:** test expects `[{ boletin: "222-07", similarity: 0 }]` but `buscarProyectos`
  returns `similarity: null` under the hybrid flag ON path.
- **Root cause:** commit `2a4a6a9` (`fix(89): WR-04 use similarity null in hybrid path;
  widen MatchProyectoRow type`) changed the production code to emit `similarity: null`, but
  the companion test at line 193 was not updated (still asserts `similarity: 0`). This drift
  predates Phase 90 — none of the 90-01 commits touch `app/` or `app/lib/buscar.*`.
- **Why NOT fixed here:** unrelated to the 90-01 changes (bio package + migration 0059).
  Fixing app search tests is outside the plan's declared files.
- **Suggested owner:** a Phase 89 follow-up / `/gsd:quick` — align the test expectation
  (`similarity: 0` → `similarity: null`) with the WR-04 production behavior, OR revert the
  production change if `0` was the intended contract.
- **90-01 own surface is green:** `pnpm --filter @obs/bio test` (11 tests), `tsc -b`
  (exit 0), and the migration 0059 deny-by-default check all pass.
