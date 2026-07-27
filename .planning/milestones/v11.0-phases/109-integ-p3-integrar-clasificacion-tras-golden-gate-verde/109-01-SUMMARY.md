---
phase: 109-integ-p3-integrar-clasificacion-tras-golden-gate-verde
plan: "01"
subsystem: packages/llm
tags: [guard, safety, pii, tiered-provider, lockdown-guard-first]
dependency_graph:
  requires: [108-02]
  provides: [INTEG-02]
  affects: [packages/llm/src/providers/*, packages/cruces/src/clasificar-lobby-cli.ts, packages/fichas/src/pipeline-cli.ts]
tech_stack:
  added: []
  patterns: [source-scan vitest guard, mutation self-check, readdirSync enumeration, fail-loud length assert]
key_files:
  created:
    - packages/llm/src/provider-guard.test.ts
    - packages/llm/src/integ-scope-guard.test.ts
  modified: []
decisions:
  - "Synthetic source strings for mutation self-check must NOT contain the guard strings even in comments — fixed by removing the word from comment text"
  - "Both guards live in packages/llm/src/ alongside tiered-scope-guard.test.ts (not in packages/cruces/) — canonical location for provider-level guards"
  - "integ-scope-guard.test.ts is a NEW file parallel to tiered-scope-guard.test.ts (not an extension) to avoid ownership collision with 108"
metrics:
  duration: "~8 minutes"
  completed: "2026-07-27"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
requirements: [INTEG-02]
---

# Phase 109 Plan 01: Safety Guards (lockdown-guard-first) Summary

**One-liner:** Two static vitest source-scan guards — provider-guard enumerates all LLM providers and asserts the zod+PII wrapper; integ-scope-guard asserts TieredProvider is absent from adjudicacion and extraccion construction points — with mutation self-checks proving both guards bite.

## What Was Built

### Task 1: provider-guard.test.ts
`packages/llm/src/provider-guard.test.ts` — enumerates every `.ts` in `packages/llm/src/providers/` excluding `*.test.ts` and `gemini-embeddings.ts` (EmbeddingProvider, not LLMProvider). Three tests:

1. **Positivo:** every enumerated provider contains `assertNoRutInLlmInput` AND `assertSensitivityAllowed` — 0 offenders today (deepseek/minimax/granite/phi-judge all have the guards by construction from 107/108)
2. **Mutation self-check:** synthetic provider source WITHOUT the guard strings is detected as offender by `esProviderSinGuard(source)` — proves the guard is non-vacuous
3. **Enumeración no-vacía:** list length ≥ 4 — fail-loud so a broken glob returning 0 cannot false-green Test 1

### Task 2: integ-scope-guard.test.ts
`packages/llm/src/integ-scope-guard.test.ts` — clones the idiom of `tiered-scope-guard.test.ts`. Three tests:

1. `packages/cruces/src/clasificar-lobby-cli.ts` NOT contains `TieredProvider` (MiniMax adjudicacion route stays intact)
2. `packages/fichas/src/pipeline-cli.ts` NOT contains `TieredProvider` (re-asserts TIER-05 from 109 scope)
3. **Mutation self-check:** synthetic source WITH `TieredProvider` detected as offender by `contieneTiered(source)` — proves the guard bites

## Verification

```
pnpm --filter @obs/llm exec vitest run src/provider-guard.test.ts src/integ-scope-guard.test.ts src/tiered-scope-guard.test.ts
```

Result: **7 tests passed** (3 provider-guard + 3 integ-scope-guard + 1 TIER-05 tiered-scope-guard)

`pnpm --filter @obs/llm exec tsc -b` → **exit 0**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mutation self-check false-passed due to comment containing guard string**
- **Found during:** Task 1 initial test run
- **Issue:** Synthetic provider source comment text `// No assertNoRutInLlmInput aquí` contained the guard string itself, causing `esProviderSinGuard()` to return `false` (source does contain the string, even in a comment) — test expected `true`
- **Fix:** Removed the guard string words from the comment: `// Este provider no tiene los guards obligatorios`
- **Files modified:** packages/llm/src/provider-guard.test.ts
- **Commit:** 044a0c3

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. These are offline test-only files.

## Self-Check: PASSED

- [x] `packages/llm/src/provider-guard.test.ts` — FOUND
- [x] `packages/llm/src/integ-scope-guard.test.ts` — FOUND
- [x] Commit `044a0c3` — FOUND (feat(109-01): safety guards)
- [x] 7 tests green, tsc -b exit 0
- [x] CERO swap de CLI (guards-only, Wave 2 not touched)
