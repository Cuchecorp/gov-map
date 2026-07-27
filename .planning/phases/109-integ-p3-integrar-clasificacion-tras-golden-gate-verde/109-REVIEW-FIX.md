---
phase: 109-integ-p3-integrar-clasificacion-tras-golden-gate-verde
fixed_at: 2026-07-27
review_path: .planning/phases/109-integ-p3-integrar-clasificacion-tras-golden-gate-verde/109-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
accepted_debt: 3
tests_passed: true
test_command: pnpm --filter @obs/cruces exec vitest run && pnpm --filter @obs/llm exec vitest run
status: all_fixed
---

# Phase 109: Code Review Fix Report

**Fixed at:** 2026-07-27
**Source review:** 109-REVIEW.md
**Iteration:** 1

**Summary:**
- Warnings in scope: 4
- Fixed: 4 (WR-01, WR-02, WR-03, WR-04)
- Info accepted as debt: 3 (IN-01, IN-02, IN-03)
- Type gate: `pnpm -r exec tsc -b` = 0 errors
- Test gate: PASSED — `@obs/cruces` 42 passed / 3 LIVE-gated skips; `@obs/llm` 158 passed / 3 LIVE-gated skips

## Test Gate

- `pnpm -r exec tsc -b` → 0 errors.
- `pnpm --filter @obs/cruces exec vitest run` → 7 files passed, 1 skipped (drift-canary, LIVE-gated); 42 tests passed, 3 skipped (drift + golden-LIVE + shadow-LIVE — all skip cleanly offline as designed).
- `pnpm --filter @obs/llm exec vitest run` → 17 files passed, 1 skipped (smoke, LIVE-gated); 158 tests passed, 3 skipped.
- LIVE-gated tests still skip cleanly offline — no LOCKED skip weakened.

## Fixed Issues

### WR-03: drift-canary printed a credentialed URL (LOCKED)

**File modified:** `packages/cruces/src/drift-canary.test.ts`
**Commit:** f1d34b6
**Applied fix:** The success-path `console.log` printed `endpoint: ${baseURL}`, which embeds `CLOUDFLARE_ACCOUNT_ID` (tenant id, credential-adjacent). Per CLAUDE.md's LOCKED rule (never print keys or credentialed URLs), the endpoint is now redacted with `baseURL.replace(accountId, "***")` before logging. The drift assertion (served model vs `MODELO_PINNEADO`) and the failure message are untouched — the guard still bites on model drift.

### WR-02: non-deterministic gate sample (LOCKED)

**File modified:** `packages/cruces/src/clasificar-fichas-cli.ts`
**Commit:** 337acd5
**Applied fix:** `cargarFichas` used `.limit(limite)` with no `.order()`, so the first-N sample that feeds the CRUCE-02 ≥70% coverage report was order-dependent (PostgREST does not guarantee row order without `ORDER BY`). Added `.order("boletin", { ascending: true })` before `.limit()` per the LOCKED "paginar con .order().range() SIEMPRE" convention. The gate semantics (sample size `MUESTRA_GATE`, coverage arithmetic) are unchanged; the sample is now stable/reproducible across runs.

### WR-01: empty-URL crash in dry-run-with-key path

**File modified:** `packages/cruces/src/clasificar-fichas-cli.ts`
**Commit:** 337acd5
**Applied fix:** In the dry-run branch (`opts.filas === undefined && serviceKey.length > 0`), `createClient("", key)` threw `supabaseUrl is required`, turning a "just report coverage" dry-run into a hard crash. Now if `url.length === 0` the run degrades cleanly (logs an explicit notice, no DB read) instead of constructing an invalid client. Symmetrically, the LIVE branch now fail-fasts with a clear `Error` if the URL is empty (a genuine misconfiguration) before `createClient`, mirroring the existing `--service-key` fail-fast style.

### WR-04: provider-guard substring false-green

**File modified:** `packages/llm/src/provider-guard.test.ts`
**Commit:** 59dca9e
**Applied fix:** `esProviderSinGuard` used bare `.includes("assertNoRutInLlmInput")`, so a provider mentioning the guards only in a comment would false-green. The predicate now (1) strips line (`//`) and block (`/* */`) comments via `stripComentarios`, and (2) requires call-shape — `assertNoRutInLlmInput(` and `assertSensitivityAllowed(` with the open paren. The mutation self-check (Test 2) is extended with two comment-only synthetic sources (line-comment and block-comment, the latter with mimetic parens) that MUST be flagged as offenders. Verified all 4 real LLM providers (deepseek/granite/minimax/phi-judge) use genuine call syntax at code lines, so Test 1 stays green; gemini-embeddings remains the documented exclusion.

## Accepted as Debt (Info)

### IN-01: `costPerToken` magic numbers undocumented

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:233,237`
**Decision:** Accepted as debt. The values are explicitly labeled "informativo — telemetría" and do not affect correctness, routing, or the gate. Hoisting to named constants with a pricing-source citation is a nice-to-have but not load-bearing; deferring avoids touching the resolver hot path for a cosmetic change.

### IN-02: integ-scope-guard relies on `readFileSync` throwing on rename

**File:** `packages/llm/src/integ-scope-guard.test.ts:34-47`
**Decision:** Accepted as debt. Current behavior is already fail-safe (a renamed guard target makes the test error red, which is the desired direction). The only gap is a less-friendly ENOENT message. Both guarded files currently exist; adding an `existsSync` pre-check is a message-quality improvement, not a correctness fix.

### IN-03: `MUESTRA_GATE` literal `10` duplicated in golden-set/shadow

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:26`; `golden/golden-set.test.ts:56`
**Decision:** Accepted as debt. `MUESTRA_GATE` is a named constant in the CLI; the duplicate `10` lives in a test assertion and comments. Deduplicating would cross the CLI/golden package boundary (export + import) for a low-risk, single-value literal. Flagged for lockstep update if the gate size ever changes; not worth the coupling now.

---

_Fixed: 2026-07-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
