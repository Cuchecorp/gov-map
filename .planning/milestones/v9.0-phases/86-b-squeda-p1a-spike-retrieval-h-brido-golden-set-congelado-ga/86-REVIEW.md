---
phase: 86-busqueda-p1a-spike-retrieval-hibrido
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - packages/fichas/src/spike/boletin.ts
  - packages/fichas/src/spike/boletin.test.ts
  - packages/fichas/src/spike/rrf.ts
  - packages/fichas/src/spike/rrf.test.ts
  - packages/fichas/src/spike/golden-set.ts
  - packages/fichas/src/spike/golden-set.test.ts
  - packages/fichas/src/spike/score.ts
  - packages/fichas/src/spike/score.test.ts
  - packages/fichas/src/spike/psql.ts
  - packages/fichas/src/spike/psql.test.ts
  - packages/fichas/src/spike/embed-query.ts
  - packages/fichas/src/spike/embed-cache.ts
  - packages/fichas/src/spike/embed-cache.test.ts
  - packages/fichas/src/spike/embed-cache.json
  - packages/fichas/src/spike/strategies.ts
  - packages/fichas/src/spike/strategies.test.ts
  - packages/fichas/src/spike/retrieval-cli.ts
  - packages/fichas/src/spike/retrieval-golden.live.test.ts
  - packages/fichas/vitest.config.ts
  - packages/fichas/vitest.live.config.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 86: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the Phase 86 retrieval spike harness (golden set, RRF fusion, FTS/semantic
strategies, psql wrapper, Gemini query embedder, CLI, live test). The spike correctly
honors the read-only mandate at the guard level, keeps the Gemini key header-only, and
the committed `embed-cache.json` is clean (40 keys, each a 768-float array; the
falsification test in `embed-cache.test.ts` proves no secrets leak).

However there is a **material security-posture mismatch**: every docstring in `psql.ts`
and `strategies.ts` asserts that query parameters are bound via `psql -v` (true
parameterization, "NUNCA interpolado"), but the implementation actually performs
**string interpolation with hand-rolled single-quote escaping** into the SQL file. The
escaping is correct *given* `standard_conforming_strings=on` (Supabase default), so it
is not exploitable today — but the guard `assertReadOnly()` runs on the template
**before** substitution, so the actual user-controlled text is never re-inspected, and
the safety rests entirely on one undocumented server GUC. That is the blocker: the
threat-model claim in the code is false, which is dangerous when Phase 87 copies this
pattern into production. Plus a boletín-detector correctness bug (money/decimal strings
misclassified) and several test-honesty / dead-code issues.

## Critical Issues

### CR-01: `psql.ts` claims `-v` parameter binding but actually string-interpolates; the read-only guard never inspects the interpolated text

**File:** `packages/fichas/src/spike/psql.ts:81-119` (and docstrings at :5-9, :78-82)
**Issue:**
The module header and `runSql` JSDoc state the security contract as: *"el texto de
query va bindeado vía `-v` (psql variable substitution) — NUNCA interpolado en el string
SQL"* and *"Los params van como variables psql (-v key=value)"*. The actual code does the
opposite: it string-replaces `:key` tokens directly into the SQL body
(`sqlWithParams.replace(new RegExp(...), '${escaped}')`) and writes that to a temp file
run with `-f`. No `-v` flag is ever passed to `psql` (see `args` at :122). The stated
contract is false.

Compounding this: `assertReadOnly(sql)` at :87 runs against the **template** (before
substitution at :107-119). The actual bytes sent to Postgres — which now contain
user/golden-set query text — are never re-validated. The only barrier against injection
is the `' → ''` escape at :116. That escape is sound **only** while
`standard_conforming_strings = on` (so backslash-escapes are inert). Supabase defaults to
`on`, so this is not exploitable in the current environment, but:
  1. The safety depends on an undocumented, external server GUC, not on the code.
  2. Phase 87 is explicitly mandated to build the production RPC "following this pattern";
     copying interpolation-labeled-as-binding into a public, hostile-subject codebase is
     exactly the failure this repo's V5 rule exists to prevent.

**Fix:** Either make the docstrings truthful and defend the escape explicitly, or (better)
switch to real binding so the claim becomes true:

```ts
// Real psql variable binding — the SQL references :'key' (quoted-var form),
// values pass via -v and never touch the SQL string. This makes the docstring true.
const args = [dbUrl, "-At", "-F", "\t"];
for (const [k, v] of Object.entries(params)) {
  args.push("-v", `${k}=${v}`);   // psql handles quoting when SQL uses :'k'
}
args.push("-f", tmpFile);
// ...and in the SQL templates use  unaccent(:'q')  /  :'query_embedding'::vector  etc.
```
If interpolation is kept for the spike, at minimum: (a) delete the "-v"/"bindeado" claims,
(b) re-run `assertReadOnly(sqlWithParams)` on the *final* string, and (c) pin
`standard_conforming_strings` via `SET` — except `SET` is a forbidden token, which itself
shows the guard and the escaping strategy are in tension.

## Warnings

### WR-01: `detectarBoletin` strips ALL dots, misclassifying decimals/money as boletines

**File:** `packages/fichas/src/spike/boletin.ts:17`
**Issue:** `q.trim().replace(/\./g, "")` removes every `.`, so `"12.34"` → `"1234"` and
`"100.00"` → `"10000"` both pass the `^\d{3,6}(-\d{1,2})?$` test and are treated as
boletines. In `runRrf` (strategies.ts:242-252) this triggers the short-circuit: the query
returns only an exact boletín lookup (empty for a price) instead of running FTS+semantic.
A user searching a monetary amount or a decimal gets silent zero results. The spec only
requires the dotted forms `14.309-04` / `14.309`, not arbitrary dot-stripping.
**Fix:** Anchor the dotted format instead of blanket-stripping:
```ts
const stripped = /^\d{1,3}(\.\d{3})*(-\d{1,2})?$/.test(q.trim())
  ? q.trim().replace(/\./g, "")
  : q.trim();
if (!/^\d{3,6}(-\d{1,2})?$/.test(stripped)) return null;
```
(Only strip dots when they sit in valid thousands-separator positions.)

### WR-02: RRF fusion ignores `limit` on each arm, weakening the k-parameter measurement

**File:** `packages/fichas/src/spike/strategies.ts:255-266`, `rrf.ts:9-20`
**Issue:** `runRrf` passes `limit` to both arms and then `merged.slice(0, limit)`, but
`rrf()` itself has no cap and fuses the full lists. That is fine functionally, but the
spike's stated purpose is to *measure* `rrf_k` and per-arm candidate limits (20/50/100).
Because both arms always receive the same `limit`, the grid cannot vary FTS-limit vs
sem-limit independently, and `wFts`/`wSem` are exercised only via CLI values that the CLI
itself forbids from being `0` (see IN-03). The measurement surface is narrower than the
CONTEXT.md grid mandate ("límite de candidatos por rama 20/50/100"). Not a correctness
bug, but the decision this spike must produce could be under-informed.
**Fix:** Accept `ftsLimit`/`semLimit` separately in `RrfOptions`, or document that per-arm
limits were intentionally tied and record it in the SUMMARY decision.

### WR-03: MRR is silently truncated to the top-5 window, diverging from standard MRR

**File:** `packages/fichas/src/spike/score.ts:58-59`
**Issue:** `const mrr = rank !== null && rank <= 5 ? 1 / rank : 0;` — a hit at rank 6+ scores
MRR 0. Standard Mean Reciprocal Rank uses `1/rank` for *any* rank. The docstring at
score.ts:9 says `mrr = rank ? 1/rank : 0` (the standard definition), which contradicts the
code. This is defensible as "MRR@5" but it is mislabeled as "MRR" in the report headers
(retrieval-cli.ts:143) and in the live-test gate, so the produced decision numbers may be
compared against external MRR baselines that use the untruncated formula.
**Fix:** Either rename every "MRR" label to "MRR@5", or compute true MRR
(`rank ? 1/rank : 0`) and keep hit@5 separate. Make the docstring and code agree.

### WR-04: `runSemanticOnly` passes threshold/exclude but the SEMANTIC_QUERY only self-limits via match_count — `exclude_boletin` for RRF path is dropped

**File:** `packages/fichas/src/spike/strategies.ts:255-260`
**Issue:** In `runRrf`, the semantic arm is called as
`runSemanticOnly(vector, { runSql, limit, matchThreshold })` — `excludeBoletin` is never
threaded through, so the "proyectos similares" self-exclusion (SEM-05) is impossible via
the RRF path. The golden `similares` cases (sm-01…sm-05) are scored through this path in
the CLI/live-test, so any self-match is not excluded. For a spike measuring
non-regression on SEM-05 this can inflate the `similares` hit rate for RRF vs the
baseline, biasing the very gate the live-test asserts (retrieval-golden.live.test.ts:134-141).
**Fix:** Thread `excludeBoletin` into the `RrfOptions` and pass it to `runSemanticOnly`,
or document that similares cases are query-only (no seed boletín) so exclusion is moot.

### WR-05: `probeUnaccent` swallows all errors, so a transient DB failure silently degrades every FTS query to the no-unaccent path

**File:** `packages/fichas/src/spike/psql.ts:186-194`
**Issue:** `probeUnaccent` returns `false` on ANY thrown error (network blip, auth failure,
timeout), not only on "extension missing". The CLI (retrieval-cli.ts:170) and live test
(retrieval-golden.live.test.ts:69) use that single boolean to pick `FTS_QUERY` vs
`FTS_QUERY_NO_UNACCENT` for the whole run. A one-off connection error during the probe
therefore corrupts the entire scoring run (accent-sensitive FTS) while reporting
`unaccent disponible: false` as if it were a legitimate schema fact. The golden-set note
at at-01/at-04/at-05 already blames unaccent for empty results — this makes that
diagnosis unreliable.
**Fix:** Distinguish "extension absent" (expected → false) from "query failed" (unexpected →
rethrow or surface a warning), e.g. catch only the specific `function unaccent(...) does
not exist` error and let connection errors propagate.

### WR-06: Live-test env loader hard-reads `.env` from workspace root and will throw (not skip) when the file is absent

**File:** `packages/fichas/src/spike/retrieval-golden.live.test.ts:33-48`
**Issue:** `loadEnv` calls `readFileSync(join(root, ".env"), ...)` at module-eval time,
before the `LIVE` gate is evaluated (:52). In an environment where credentials are
supplied purely via real process env (e.g. CI secrets, no `.env` file), `readFileSync`
throws `ENOENT` and the whole test file fails to load — the opposite of the "SKIP HONESTO"
contract in the header comment. The skip only works when a `.env` file happens to exist.
**Fix:** Guard the read:
```ts
const envPath = join(root, ".env");
const env = existsSync(envPath) ? loadEnv(envPath) : {};
```
so missing-`.env` + missing-process-env falls through to `describe.skip`.

## Info

### IN-01: `parseAtOutput` cannot distinguish an empty column from a dropped row; NULLs collapse silently

**File:** `packages/fichas/src/spike/psql.ts:63-68`
**Issue:** `psql -At` renders SQL NULL as an empty string, and `filter((line) => line.length > 0)`
drops any line that is entirely empty. For the current single-non-null-column queries this
is harmless, but a future two-column row where the first column is NULL would shift
columns. Low risk in this spike; note for Phase 87 reuse.
**Fix:** Only filter the final trailing-newline artifact, not all empty lines:
`raw.replace(/\n$/, "").split(/\r?\n/)` when raw is non-empty.

### IN-02: `rrf.ts` docstring formula (`1/(rrfK + rank + 1)`) is correct but the k-vs-rank convention differs from the Supabase reference (`1/(k + rank)` with 1-based rank)

**File:** `packages/fichas/src/spike/rrf.ts:3-6, 17-18`
**Issue:** Implementation uses 0-based `i` plus `+1`, i.e. `1/(k + i + 1)`. That equals the
canonical `1/(k + rank)` with 1-based rank — mathematically fine. Just flag that the
constant offset means `rrf_k=50` here is one position "softer" than a naive
`1/(50 + rank_0based)` reading; ensure the SUMMARY records the exact formula so Phase 87's
Postgres RRF (`1/(k + row_number())`) matches bit-for-bit.
**Fix:** State the exact formula in the decision record; no code change needed.

### IN-03: CLI rejects weight `0`, so the `wFts=0 / wSem=0` ablation (present in rrf.test.ts) is unreachable from the harness

**File:** `packages/fichas/src/spike/retrieval-cli.ts:90, 99`
**Issue:** `if (isNaN(n) || n <= 0)` forbids weight `0`. `rrf.test.ts:23-32` explicitly tests
`wFts=0` behavior, but the operator can never invoke it via the CLI to measure the
FTS-off / sem-off ablations the grid implies. Inconsistent guard vs. tested capability.
**Fix:** Allow `n >= 0` for weights (keep `> 0` only for `--limit`/`--rrf-k`).

### IN-04: Two verbatim-duplicated 25-line FTS SQL blocks (unaccent / no-unaccent) drift risk

**File:** `packages/fichas/src/spike/strategies.ts:45-105`
**Issue:** `FTS_QUERY` and `FTS_QUERY_NO_UNACCENT` are identical except for the
`unaccent(...)` wrapper. Any future weight/column change must be made in two places. A
single template with an `unaccent`-or-identity helper would remove the duplication.
**Fix:** Build the tsvector expression once from a `wrap = useUnaccent ? 'unaccent' : ''`
parameter, or generate both strings from one template function.

### IN-05: `normalizarLiteral` is duplicated verbatim from `packages/fichas/src/golden/golden-set.ts` (per its own comment)

**File:** `packages/fichas/src/spike/golden-set.ts:37-48`
**Issue:** The comment states it is copied verbatim from the sibling golden module. Two
copies of the accent-normalizer can diverge. For a frozen spike this is acceptable, but
worth a shared export in Phase 87 to avoid a normalization mismatch between the golden
gate and production search. Also `embed-query.ts` is a verbatim copy of `buscar.ts:70-156`
— parity confirmed correct today, but a documented copy-paste dependency to watch.
**Fix:** Extract a shared `normalizarLiteral` (and, in 87, a shared embedder contract).

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
