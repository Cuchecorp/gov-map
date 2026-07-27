---
phase: 108-tier-p2-plomeria-tieredprovider-judgeprovider-ladder-telemetria
fixed_at: 2026-07-27
review_path: 108-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
accepted_debt: 4
tests_passed: true
test_command: "pnpm --filter @obs/llm test && pnpm --filter @obs/llm-bench test"
status: all_fixed
---

# Phase 108: Code Review Fix Report

**Source review:** 108-REVIEW.md
**Scope:** the 6 Warnings + the trivial payload-leak Info (IN-01). Info items
IN-02/03/04/05 assessed and accepted as debt (rationale below).

## Summary

- Findings fixed: WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, IN-01
- Accepted as debt: IN-02, IN-03, IN-04, IN-05
- Final suite: **GREEN** — `tsc -b` = 0; `@obs/llm` 152 passed / 3 skipped;
  `@obs/llm-bench` 131 passed / 3 skipped.

LOCKED invariants held throughout: telemetry stays PAYLOAD-FREE, RUT never
crosses to an LLM (now guarded at the judge hop too), escalation stays bounded
(1 hop, no loop), and `pipeline-cli.ts` / `router.ts` / `adjudicacion.*` were
untouched (scope-guard test still green). No existing load-bearing test was
weakened — only extended.

## Fixed

### WR-01 — guard tier-0 output before the judge hop
`tiered.ts`: `assertNoRutInLlmInput(answer)` + `assertNoRutInLlmInput(judgeContext)`
applied to the tier-0 output before it reaches `this.judge.judge(...)`. Defense in
depth at the decorator's own boundary — no longer relying on each `JudgeProvider`
implementer to re-guard its `answer`. Test: describe "RUT-guard hop al juez".

### WR-02 — onValidationOutcome fires EXACTLY once across escalation (highest priority)
`tiered.ts`: the tier-0 and tier-1 request wrappers now CAPTURE the validation
outcome but no longer forward the caller's callback. A single idempotent
`fireCallerOutcome(...)` invokes `req.onValidationOutcome` exactly once per
top-level `complete()`, with the outcome of the tier that produced the returned
value (or, on a terminal path, the tier that produced the terminal outcome). This
closes the double-fire where tier-0's terminal outcome AND tier-1's outcome both
reached the caller. **New load-bearing test asserts call count === 1 on an
escalating `complete()`** — it fails on the old double-fire (the previous escalation
tests used a bare req with no callback, so the bug passed vacuously).

### WR-03 — escalated tier-1 output is intentionally unjudged (documented + tested)
`tiered.ts`: added an explicit design note that escalation returns UNJUDGED output
by design (bounded 1-hop, no re-judge loop — a re-judge would risk
re-judge→re-escalate). Telemetry makes this legible: the escalation event carries
the tier-0 `judgeVerdict` (the causal signal) while `providerId` points at tier-1,
so a consumer sees the returned value was not itself judged. Test asserts
`judge.callCount === 1` on the escalated path. No loop added.

### WR-04 — tier-0 terminal outcome preserved on escalation telemetry
`tiered.ts`: the successful-escalation and all-tiers-failed emit sites now set
`validationOutcome: capturedOutcome` (the tier-0 terminal outcome that forced
escalation) instead of `null`. The single per-`complete()` event again distinguishes
"escalated due to zod-terminal" from "escalated due to judge ok:false".

### WR-05 — positive maxBudgetUsd is now enforced
`tiered.ts`: replaced the `maxBudgetUsd <= 0` sentinel-only check with a real
running-cost comparison. For a positive budget, escalation aborts with
`EscalationExhaustedError("budget-exceeded")` if the tier-0 estimated cost already
meets/exceeds the budget, or if adding the escalation estimate would exceed it.
Sentinel `0` still disables escalation; `undefined` still unlimited. Tests: positive
budget exceeded → escalation skipped (terminal); positive budget sufficient →
escalation proceeds.

### WR-06 — MockProvider synthetic telemetry is now opt-in
`test-mock.ts`: the mock's synthetic `TelemetryEvent` emission is gated behind an
explicit `emitTelemetry: true` flag (default `false`). Even with a `telemetrySink`
injected, the mock stays silent unless asked, so it can never mask the
`TieredProvider`'s authoritative events in a shared-sink test. Doc comment spells out
the footgun. No current test set the mock's `telemetrySink`, so this is zero-risk.

### IN-01 — payload-free console.warn in validate.ts
`validate.ts`: `safeJsonParse`'s parse-failure `console.warn` now logs only
`raw.length` (a structural fact), never a content slice — matching the payload-free
discipline the phase enforces in the telemetry layer.

## Accepted as debt (with rationale)

- **IN-02** (`escalated:true` on non-escalation failures): changing the field
  semantics or adding `escalationAttempted` is a telemetry-contract change with
  downstream JSONL consumers — a deliberate schema revision, not a warning-fix.
- **IN-03** (`→` in provider `id`): the id is a stable identifier possibly already
  keyed/compared downstream; swapping the separator is a value change with ripple
  risk and not adjacent to any WR fix.
- **IN-04** (duplicated `_emit` blocks): a `_buildEvent(partial)` refactor touches all
  five sites at once — broader/riskier than a targeted fix; the WR-04 divergence it
  enabled is now closed.
- **IN-05** (stale Wave-1/Wave-2 doc note in `task-ladder.ts`): cosmetic, out of the
  changed-file set, not adjacent to a WR fix.

## Commits (atomic)

- `b7b909f` fix(108): IN-01 validate.ts console.warn payload-free
- `f67f29e` fix(108): WR-06 MockProvider telemetry emission opt-in
- `c935b54` fix(108): WR-01/02/03/04/05 TieredProvider escalation control-flow + telemetry
- `956f68f` test(108): load-bearing tests for WR-01/02/03/05

**Note on atomicity:** WR-01/02/03/04/05 all edit interleaved regions of
`tiered.ts` (the escalation control-flow and the five telemetry emit sites are
physically fused); they could not be split into per-finding source commits without
leaving a non-compiling intermediate (e.g. referencing `escalationReq`/
`fireCallerOutcome` before they are defined). They are grouped into one commit that
compiles and passes the full suite, with the message enumerating every finding.
IN-01 (validate.ts) and WR-06 (test-mock.ts) are fully independent files and are
committed separately.

---

_Fixed: 2026-07-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
