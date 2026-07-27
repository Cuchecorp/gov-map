---
phase: 108-tier-p2-plomeria-tieredprovider-judgeprovider-ladder-telemetria
verified: 2026-07-27T11:05:00Z
status: passed
score: 4/4 success-criteria verified (TIER-02..05)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  note: "Initial verification. 108-REVIEW.md (6 warnings) already resolved in 108-REVIEW-FIX.md; re-verified in code."
gaps: []
human_verification: []
---

# Phase 108: TIER P2 — Plomería `TieredProvider` + `JudgeProvider` + ladder + telemetría Verification Report

**Phase Goal:** Cablear la cascada respond→validate→escalate como composición sobre `@obs/llm`, testeable determinísticamente con `MockProvider` OFFLINE antes de tocar cualquier tarea viva (109).
**Verified:** 2026-07-27T11:05:00Z
**Status:** passed
**Re-verification:** No — initial verification.

## Goal Achievement

Phase 108 is pure offline plumbing. All four ROADMAP success criteria (TIER-02..05) hold in the code, are backed by load-bearing MockProvider tests that would fail on regression, and the full suite is green (`tsc -b` = 0; `@obs/llm` 152 pass / 3 skip; `@obs/llm-bench` 131 pass / 3 skip). The scope fence held: no CLI swap, no `TieredProvider` in `pipeline-cli.ts`/cruces CLIs, no network, no keys, no `selectProvider` dead-code revival. The 6 code-review Warnings (WR-01..06) are resolved in code and covered by new tests. Per VALIDATION.md there are zero manual-only checks — LIVE integration is 109's job. **PASSED.**

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Criterion) | Status | Evidence (file:line + guarding test) |
|---|-------------------|--------|--------------------------------------|
| TIER-02 | `TieredProvider implements LLMProvider`, drop-in decorator; consumer bodies unchanged; ABSENCE of `task` reproduces current behavior byte-identical | ✓ VERIFIED | `tiered.ts:82` `class TieredProvider implements LLMProvider`. `task?: string` additive at `types.ts:50` (adapters ignore it per JSDoc; only TieredProvider reads it for telemetry labeling). **Load-bearing passthrough test** `tiered.test.ts:30-59` ("byte-identical passthrough"): 1-tier, no `task` → deep-equals direct provider result, `callCount==1`, `escalated===false`, `task===undefined`. Drop-in test `tiered.test.ts:61-66`. No `selectProvider`/`loadRouterConfigFromEnv` reference (grep: 0). Construction points untouched: `clasificar-fichas-cli.ts:200` `new DeepSeekProvider`, `clasificar-lobby-cli.ts:190` `new MiniMaxProvider`. |
| TIER-03 | `JudgeProvider` composed as SEPARATE interface, ESCALATE-ONLY (escalates/rejects, NEVER approves/relaxes a gate); verdicts recorded structured | ✓ VERIFIED | Judge is the separate `JudgeProvider` interface (`judge.ts`), composed in `tiered.ts:188-208`. Escalate-only asserted **both directions**: (a) `ok:false` escalates — `tiered.test.ts:152-171`; (b) `ok:true` on tier-0 success does NOT escalate, returns tier-0 — `tiered.test.ts:173-193`; (c) `ok:true` does NOT swallow a tier-0 zod-fail (zod-fail escalates regardless of judge, judge not even consulted) — `tiered.test.ts:195-215`. Verdict recorded structured in telemetry as `judgeVerdict: Pick<Verdict,"ok"|"confidence">` (`telemetry.ts:47`), `reason` excluded by type. |
| TIER-04 | Per-call telemetry (model/task/latency/cost/verdict/escalation) with NO payload/PII; escalation BOUNDED (1 hop/tier, per-item budget, terminal human-review, no loops); onValidationOutcome exactly-once (WR-02) | ✓ VERIFIED | `TelemetryEvent` (`telemetry.ts:23-52`) carries providerId/task/latencyMs/costUsd/validationOutcome/judgeVerdict/escalated/ts — **no** user/system/answer/prompt/reason. Payload-free asserted by `Object.keys` in `telemetry.test.ts:141-177` AND `tiered.test.ts:262-279`. Exactly-one event per `complete()`: `tiered.test.ts:281-293`. Bounded: max `tiers.length` calls, terminal `EscalationExhaustedError`, no loop back to tier-0 — `tiered.test.ts:116-147`. Budget bound: sentinel `0` skips escalation (`tiered.test.ts:220-240`) AND positive `maxBudgetUsd` enforced (WR-05) both exceed→skip and sufficient→proceed (`tiered.test.ts:466-508`). **onValidationOutcome exactly-once (WR-02)** load-bearing: fires once across escalation (`tiered.test.ts:335-370`), once without escalation (372-394), once on judge-escalation with authoritative tier-1 outcome (396-426). RUT guard at decorator entry (`tiered.ts:116-117`, test 244-257) AND at judge hop (WR-01, `tiered.ts:196-197`, test 431-461). |
| TIER-05 | Routing BETWEEN pipelines never mid-session; fichas prompt-cache intact — structural guard that `pipeline-cli.ts` untouched | ✓ VERIFIED | Tiers fixed at construction, immutable defensive copy (`tiered.ts:99`); `complete()` never reorders on `req.task`. **between-pipelines test** `tiered.test.ts:298-323`: two `complete()` with distinct `task` on ONE instance route the same ladder. **Structural guard** `tiered-scope-guard.test.ts:14-33` reads `packages/fichas/src/pipeline-cli.ts` and asserts it does NOT contain `TieredProvider` (grep confirms `pipeline-cli.ts:191` still `new DeepSeekProvider`; zero `TieredProvider` in cruces src). `router.ts`/`adjudicacion.*` untouched. |

**Score:** 4/4 criteria verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/llm/src/tiered.ts` | TieredProvider + TieredProviderOptions + EscalationExhaustedError, ≥60 lines | ✓ VERIFIED | 358 lines; all three exports present; catch narrowed to `instanceof LLMValidationError` (`tiered.ts:175`), no bare-catch escalation; wired into barrel. |
| `packages/llm/src/telemetry.ts` | TelemetrySink, TelemetryEvent, noopSink, jsonlSink; payload-free | ✓ VERIFIED | All 4 symbols exported; TelemetryEvent declares no text-domain field; judgeVerdict excludes reason. |
| `packages/llm/src/task-ladder.ts` | LadderConfig, TaskLadder, TierSpec, buildTieredProvider | ✓ VERIFIED | Fábrica returns real `new TieredProvider(opts)` (stub replaced in Wave 2); import is value-import. |
| `packages/llm/src/test-mock.ts` | MockProvider (LLMProvider) + MockJudgeProvider (JudgeProvider), no cross-package import | ✓ VERIFIED | Local, no import from `@obs/llm-bench`/`@obs/adjudication`; synthetic telemetry opt-in (WR-06, `emitTelemetry` default false). |
| `packages/llm/src/types.ts` | CompletionRequest.task additive | ✓ VERIFIED | `task?: string` at line 50 with JSDoc declaring byte-identical-on-absence + ignored by adapters. |
| Test suite (tiered/task-ladder/tiered-scope-guard/telemetry) | offline mock, green | ✓ VERIFIED | 22 + 6 + 1 + 13 tests, all pass. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `tiered.ts` | `validate.ts` (LLMValidationError) | narrowed catch trigger | ✓ WIRED (`tiered.ts:175`) |
| `tiered.ts` | `data-routing.ts` (assertNoRutInLlmInput) | entry + judge-hop guard | ✓ WIRED (`tiered.ts:116,196`) |
| `tiered.ts` | `telemetry.ts` (TelemetrySink) | one event per complete() | ✓ WIRED (`tiered.ts:347`) |
| `index.ts` | `./tiered`, `./telemetry`, `./task-ladder` | export * | ✓ WIRED (`index.ts:23-25`) |
| `task-ladder.ts` | `./tiered` (TieredProvider) | value import + construct | ✓ WIRED (`task-ladder.ts:20,115`) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Types compile clean | `pnpm --filter @obs/llm exec tsc -b` | exit 0 | ✓ PASS |
| @obs/llm suite | `pnpm --filter @obs/llm exec vitest run` | 152 passed / 3 skipped, exit 0 | ✓ PASS |
| @obs/llm-bench suite (no regression) | `pnpm --filter @obs/llm-bench exec vitest run` | 131 passed / 3 skipped, exit 0 | ✓ PASS |
| Scope fence: no TieredProvider in cruces CLIs / fichas | grep | 0 matches | ✓ PASS |
| No network/keys/dead-router in tiered.ts | grep fetch/http/apiKey/env/selectProvider | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| TIER-02 | 108-01, 108-02 | ✓ SATISFIED | See Truth TIER-02 |
| TIER-03 | 108-02 | ✓ SATISFIED | See Truth TIER-03 |
| TIER-04 | 108-01, 108-02 | ✓ SATISFIED | See Truth TIER-04 |
| TIER-05 | 108-01, 108-02 | ✓ SATISFIED | See Truth TIER-05 |

No orphaned requirements — REQUIREMENTS.md maps exactly TIER-02..05 to Phase 108, all claimed by the two plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tiered.ts` | 352-356 | `_estimateCost` hardcodes 120-token estimate | ℹ️ Info | Coarse but now actually compared vs budget (WR-05 fix); estimate-accuracy is accepted debt, not a blocker. |
| `tiered.ts` | 108 | `id` uses non-ASCII `→` | ℹ️ Info | IN-03 accepted debt (stable id, ripple risk). Cosmetic. |
| `tiered.ts` | 207,224 | `escalated:true` on non-escalation terminal | ℹ️ Info | IN-02 accepted debt (telemetry-contract change deferred). |

No BLOCKER or WARNING anti-patterns. No unreferenced TBD/FIXME/XXX debt markers in phase files. Review's IN-01 payload leak in `validate.ts` `console.warn` was fixed (`raw.length` only) — confirmed by suite stderr showing `raw.length=9` (structural fact, no content slice).

### Code-Review Resolution (per 108-REVIEW-FIX.md, re-verified in code)

| Finding | Resolution | Re-verified |
|---------|-----------|-------------|
| WR-01 RUT guard at judge hop | `assertNoRutInLlmInput(answer)` before judge | ✓ `tiered.ts:196-197`, test `tiered.test.ts:431-461` |
| WR-02 onValidationOutcome fires once | wrappers capture, single idempotent `fireCallerOutcome` | ✓ `tiered.ts:142-163`, load-bearing test 335-426 |
| WR-03 tier-1 unjudged by design | documented + `judge.callCount===1` asserted | ✓ `tiered.ts:294-300`, test 513-537 |
| WR-04 tier-0 outcome preserved on escalation | `validationOutcome: capturedOutcome` | ✓ `tiered.ts:317,337` |
| WR-05 positive budget enforced | running-cost comparison | ✓ `tiered.ts:241-255`, test 466-508 |
| WR-06 mock telemetry opt-in | `emitTelemetry` default false | ✓ `test-mock.ts:105` |

### Human Verification Required

None. Per 108-VALIDATION.md all behaviors have automated (mock) verification; LIVE integration (real prompt-cache, drift) is Phase 109. Suite green end-to-end.

### Gaps Summary

No gaps. All four success criteria hold in code with load-bearing regression tests, scope fence intact, review warnings resolved, both suites green, tsc clean.

---

_Verified: 2026-07-27T11:05:00Z_
_Verifier: Claude (gsd-verifier)_
