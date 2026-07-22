---
phase: 87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix
fixed_at: 2026-07-21T22:38:00Z
review_path: .planning/phases/87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix/87-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
tests_passed: true
test_command: pnpm test (app: 1009 passed; fichas: 158 passed 1 skipped)
status: all_fixed
---

# Phase 87: Code Review Fix Report

**Fixed at:** 2026-07-21T22:38:00Z
**Source review:** `.planning/phases/87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix/87-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 7
- Skipped: 0
- Test gate: PASSED (`pnpm test` — app 1009/1009, fichas 158/159)

## Test Gate

- PASSED — `pnpm test` (app) exited 0 after all fixes: 82 test files, 1009 tests passed.
  `pnpm test` (packages/fichas) exited 0: 18 test files, 158 passed, 1 skipped (live gate).

## Fixed Issues

### CR-01: Hybrid RPC drops `excludeBoletin` — self-listing in "proyectos similares"

**Files modified:** `app/lib/buscar.ts`, `app/lib/buscar.test.ts`
**Commit:** `bcd0d9a`
**Applied fix:** In the hybrid branch of `buscarProyectos`, request `matchCount + 1`
when `excludeBoletin` is set, then filter the result array app-side to remove the
self-boletín. Added two new unit tests: one asserting the self-boletín is absent from
results, one asserting the `match_count` passed to the RPC is `+1`.

### CR-02: Return type mismatch — `rank` cast to `similarity` gives `undefined`

**Files modified:** `app/lib/buscar.ts`, `app/lib/buscar.test.ts`
**Commit:** `bcd0d9a` (same commit as CR-01)
**Applied fix:** At the boundary of the hybrid branch, normalize `{boletin, rank}[]`
rows to `MatchProyectoRow[]` (`{boletin, similarity: 0}`) using an explicit `.map()`.
Corrected the unit test assertion at buscar.test.ts:192 from `{boletin, rank}` to
`{boletin, similarity: 0}`.

### WR-01: `statement_timeout` cap declared LOCKED but never set

**Files modified:** `supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql`,
`supabase/tests/post-apply/0057_busqueda_hibrida_statement_timeout.test.sql` (new)
**Commit:** `0b6f882`
**Applied fix:** New migration 0057 does a `drop + create or replace` of
`buscar_proyectos_hibrido` with `set statement_timeout = '5s'` in the function-definition
options list (the `language plpgsql stable security definer set search_path = '' set statement_timeout = '5s'`
idiom). Includes full ACL doble-revoke. Post-apply pgTAP test (4 assertions) verifies
function exists, ACL intact, `statement_timeout` is in `pg_proc.proconfig`, and
short-circuit still fires.

**Operator action required:** Apply 0057 to PROD:
```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
  -f supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql
```
Then run the pgTAP test:
```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -f supabase/tests/post-apply/0057_busqueda_hibrida_statement_timeout.test.sql
```

### WR-02: `boletin_num = split_part(...)` type assumption unverified

**Files modified:** `supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql`
**Commit:** `0b6f882` (same migration as WR-01)
**Applied fix:** In the `boletin_hit` CTE within 0057, changed the comparison to
`p.boletin_num::text = split_part(q_norm, '-', 1)` to make it safe regardless of
whether the column is `text` or `numeric`, and to avoid leading-zero mismatch.

### WR-03: Two `detectarBoletin` copies with no drift guard

**Files modified:** `packages/fichas/src/spike/boletin.test.ts`
**Commit:** `755e4a5`
**Applied fix:** Added a `BOLETIN_EQUIVALENCE_FIXTURE` golden set and a
`"detectarBoletin — equivalencia guard app vs spike (WR-03)"` describe block to
`boletin.test.ts`. The test inlines a mirror of `app/lib/boletin-detector.ts` and
asserts both copies produce identical output over 11 cases. A cross-reference comment
notes the three copies (app, spike, SQL regex in 0056/0057) and instructs that all
three must be updated together.

### WR-04: Post-apply tests hard-pin live boletines — brittle on row deletion

**Files modified:** `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql`,
`supabase/tests/post-apply/0056_busqueda_hibrida_boletin_norm.test.sql`
**Commit:** `80d5db2`
**Applied fix:** Added `ok(exists(select 1 from proyecto where boletin = '...'))` 
precondition assertions before each live-boletin behavioral assert. Plan counts updated
(0055: 5→6, 0056: 5→7). A missing row now reports as "data-precondition failure" rather
than a spurious logic failure.

### WR-05: `retrieval-cli` --w-fts/--w-sem silently ignored on rpc-real strategy

**Files modified:** `packages/fichas/src/spike/retrieval-cli.ts`
**Commit:** `821fc6b`
**Applied fix:** Updated `parametrosRpc` string from
`limit=N (RPC real buscar_proyectos_hibrido)` to
`limit=N (RPC real; rrf_k=50 w=1 fijos en SQL, --w-* ignorados)` so the scoring table
makes it explicit that CLI weight flags do not reach the RPC strategy row.

## Skipped Issues

None — all in-scope findings were fixed.

## Migration ledger (0057)

| Migration | Estado | Gate |
|-----------|--------|------|
| 0057_busqueda_hibrida_statement_timeout.sql | ESCRITA, pendiente apply PROD | pgTAP post-apply 4 assertions |

---

_Fixed: 2026-07-21T22:38:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
