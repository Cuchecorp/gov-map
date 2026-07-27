---
phase: 108-tier-p2-plomeria-tieredprovider-judgeprovider-ladder-telemetria
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - packages/llm/src/types.ts
  - packages/llm/src/telemetry.ts
  - packages/llm/src/task-ladder.ts
  - packages/llm/src/test-mock.ts
  - packages/llm/src/tiered.ts
  - packages/llm/src/index.ts
  - packages/llm/src/telemetry.test.ts
  - packages/llm/src/task-ladder.test.ts
  - packages/llm/src/tiered.test.ts
  - packages/llm/src/tiered-scope-guard.test.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 108: Code Review Report

**Reviewed:** 2026-07-27
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the TIER P2 plumbing (`TieredProvider`, `JudgeProvider` wiring, `TaskLadder`
config, payload-free telemetry). I read the four out-of-scope dependencies
(`validate.ts`, `judge.ts`, `data-routing.ts`, `router.ts`, `providers/deepseek.ts`,
`providers/phi-judge.ts`) to verify the LOCKED invariants held end-to-end, not just at
the surface of the changed files.

**LOCKED invariants — verdict:**

- **`task` additive-optional:** HELD. `task` is `?:` on `CompletionRequest`; concrete
  adapters ignore it; `TieredProvider` only reads it for telemetry labeling (never
  re-routes on it). Absence reproduces prior behavior.
- **Telemetry payload-free:** HELD at the type level. `TelemetryEvent` declares no
  text-domain field; `judgeVerdict` is `Pick<Verdict,"ok"|"confidence">` (excludes
  `reason`). No sink receives payload. See WR-05 for a residual runtime gap.
- **Judge escalate-only:** HELD. `ok:true` never relaxes a gate; tier-0 catch is
  narrowed to `LLMValidationError` (bare `catch` would swallow `Error`/`ZodError` — it
  does not). See WR-03 for a judge-on-escalated-output gap.
- **Bounded escalation:** HELD. Max `tiers.length` calls; terminal `EscalationExhaustedError`;
  no loop back to tier-0.
- **Routing between-pipelines / fixed at construction:** HELD. `this.tiers` is a
  defensive copy; `complete()` never reorders on `req.task`.
- **RUT never crosses to LLM:** HELD for the responder path (`assertNoRutInLlmInput` on
  `user`+`system`). See **WR-01** for an unguarded path (tier-0 output → judge).
- **`response_format json_schema` never assumed:** HELD (DeepSeek uses `json_object`,
  PhiJudge uses tool-calling or prompt-forced).
- **Scope fence:** HELD. `pipeline-cli.ts` guarded by `tiered-scope-guard.test.ts`;
  `router.ts`/`adjudicacion.*` untouched; no network in changed code.

The strongest finding is **WR-02**: the user-supplied `onValidationOutcome` callback can
fire **twice** in a single `complete()` when tier-0 fails terminally and tier-1 is
invoked — directly violating the "invoked EXACTLY once" contract that
`@obs/llm-bench` depends on to recover the real production outcome.

## Warnings

### WR-01: Tier-0 output forwarded to judge without RUT guard (defense-in-depth hole)

**File:** `packages/llm/src/tiered.ts:162-168`
**Issue:** `TieredProvider` builds `const answer = JSON.stringify(tier0Result)` and passes
it straight to `this.judge.judge({ answer, ... })`. There is NO `assertNoRutInLlmInput`
on this judge-bound text. The T-108-03 guard at line 114-115 only covers the *inbound*
`req.user`/`req.system` — it does not cover the *tier-0 model output* that is now being
sent to a second LLM (the judge). If a primary model echoes a RUT into its structured
output (e.g. an extraction that surfaces an identifier), that RUT crosses to the judge
provider. Today `PhiJudge.judge()` re-guards its own `req.answer` (phi-judge.ts:165), so
a PhiJudge wiring is safe — but `JudgeProvider` is an interface and the decorator must not
assume every implementer guards. The whole point of the class comment ("`assertNoRutInLlmInput`
en la ENTRADA del decorador, defensa en profundidad") is undermined at the judge hop.
**Fix:**
```ts
if (this.judge && !tier0Failed) {
  const answer = JSON.stringify(tier0Result);
  assertNoRutInLlmInput(answer); // guard the model output before it reaches the judge
  if (this.judgeContext) assertNoRutInLlmInput(this.judgeContext);
  const verdict = await this.judge.judge({ answer, system: this.judgeContext, ... });
```

### WR-02: `onValidationOutcome` can fire twice per `complete()` (breaks single-outcome contract)

**File:** `packages/llm/src/tiered.ts:128-134, 232`
**Issue:** The wrapped request (`wrappedReq`, lines 128-134) forwards the caller's
`req.onValidationOutcome` on the tier-0 path. On terminal zod failure, `validate.ts`
fires `ctx.onOutcome` (a `zod-terminal`/`structured-output-fail` outcome) **before**
throwing (validate.ts:147-152) — so the caller's callback fires ONCE for tier-0. Then
escalation calls `escalationTier.complete(req, schema)` at line 232 using the **original
`req`** (not `wrappedReq`), so tier-1's `parseAndValidate` fires the caller's
`onValidationOutcome` a **SECOND** time (e.g. a `clean` outcome from tier-1). The
`CompletionRequest.task`/`onValidationOutcome` contract (types.ts:52-59) and
`ValidateContext.onOutcome` (validate.ts:83-90) both state the observer is invoked
"EXACTAMENTE una vez". `@obs/llm-bench` uses this to recover the REAL production outcome
— two fires means it records the wrong (last-wins) outcome and its per-item metrics
double-count. No test covers this: every escalation test uses a bare `baseReq` with no
`onValidationOutcome`, so the double-fire passes vacuously.
**Fix:** Do not forward the caller's `onValidationOutcome` on the escalation hop, OR
gate forwarding so it fires exactly once for the terminal production path. E.g. wrap the
escalation call too and forward only the final outcome:
```ts
// Suppress the caller callback on tier-0 when an escalation tier exists; forward only
// the outcome of the tier that actually produces the returned value.
const escalationReq: CompletionRequest = {
  ...req,
  onValidationOutcome: (o) => { capturedOutcome = o; req.onValidationOutcome?.(o); },
};
// ...and strip req.onValidationOutcome from the tier-0 wrappedReq so it only captures.
```

### WR-03: Judge never re-evaluates the escalated tier-1 output (silent gate bypass on escalation)

**File:** `packages/llm/src/tiered.ts:159-173, 231-244`
**Issue:** The judge runs only against tier-0 (`if (this.judge && !tier0Failed)`). When
the judge says `ok:false` and the call escalates, tier-1's output is returned **unjudged**
(lines 232-244). The gate that rejected tier-0 as inadequate is never applied to the
replacement answer. For an "escalate-only judge whose purpose is quality adjudication",
returning an un-adjudicated tier-1 result means a bad answer can still ship if tier-1 also
produces a weak-but-schema-valid output. This may be an intentional bound (1 hop, no
re-judge loop), but it is undocumented as a deliberate trade-off and no test asserts it.
At minimum the telemetry should reflect that the returned value was NOT judged.
**Fix:** Either (a) document explicitly that escalation returns unjudged output by design
(bounded, no re-judge to avoid loops), and add a test asserting `judge.callCount===1` on
the escalated path (currently only asserted implicitly); or (b) re-judge tier-1 once and
surface its verdict in telemetry. Do NOT add a loop.

### WR-04: `validationOutcome` and `judgeVerdict` from tier-0 are dropped on successful escalation

**File:** `packages/llm/src/tiered.ts:233-243`
**Issue:** On a successful escalation the emitted event sets `validationOutcome: null`
(line 239) with the comment "outcome de escalación no capturado por wrapper". But
`capturedOutcome` DID capture the tier-0 terminal outcome (via the wrapper), and
`judgeVerdict` holds the tier-0 verdict that triggered escalation — both are the
structurally interesting facts about WHY escalation happened. Emitting `null` for
`validationOutcome` here loses the tier-0 terminal signal. Since exactly one event is
emitted per `complete()`, the telemetry stream cannot distinguish "escalated due to
zod-terminal" from "escalated due to judge ok:false" from the event alone in the
zod-fail case. `judgeVerdict` is correctly still emitted (line 240), but the tier-0
`validationOutcome` is silently zeroed.
**Fix:** Emit the captured tier-0 outcome when the escalation was zod-triggered:
```ts
validationOutcome: capturedOutcome, // tier-0 terminal outcome that forced escalation
```
(tier-1's own outcome is not observed by this wrapper, but tier-0's IS and is the causal
signal worth logging).

### WR-05: `_estimateCost` fixed 120-token estimate ignores budget accuracy (budget gate is coarse)

**File:** `packages/llm/src/tiered.ts:195-196, 268-272`
**Issue:** The budget gate only trips when `maxBudgetUsd <= 0` (line 196) — any positive
budget is treated as unlimited for escalation purposes, because actual accumulated cost is
never compared against `maxBudgetUsd`. The `_estimateCost` helper always assumes 120
output tokens (line 271) regardless of real token usage, and its result is never summed or
checked against `maxBudgetUsd` before escalating. So `maxBudgetUsd: 0.05` behaves
identically to `maxBudgetUsd: undefined` — the only enforced value is `0`. The doc on
`LadderConfig.maxBudgetUsd` (task-ladder.ts:66-70) claims "Si se supera antes de la
escalación, aborta con error", which is not implemented for positive budgets.
**Fix:** Either implement a real running-cost check
(`if (maxBudgetUsd !== undefined && primaryCost >= maxBudgetUsd) throw budget-exceeded`),
or narrow the docs to state that `maxBudgetUsd` currently only supports the sentinel `0`
(disable escalation) and any positive value is not yet enforced. The current doc/behavior
mismatch is a correctness/robustness trap for callers who set a nonzero budget expecting
enforcement.

### WR-06: MockProvider emits synthetic telemetry that can mask real TieredProvider events in tests

**File:** `packages/llm/src/test-mock.ts:86-103`
**Issue:** `MockProvider.complete` emits its OWN `TelemetryEvent` to `opts.telemetrySink`
if one is injected, always with `validationOutcome: { kind: "clean" }` and
`escalated: false` hardcoded (lines 98-99). If a future test injects the same sink into
both the MockProvider and the TieredProvider, the sink receives mixed events and the
"emite exactamente 1 TelemetryEvent" assertions (tiered.test.ts:279-291) would silently
break or, worse, pass while measuring the wrong events. Current tests avoid this by not
sharing sinks, but the mock's ability to emit `escalated:false` clean events is a footgun
that can make load-bearing telemetry tests pass vacuously. The hardcoded
`validationOutcome:"clean"` also does not reflect the mock's actual responder behavior
(it can throw).
**Fix:** Have `MockProvider` NOT emit telemetry by default in the tiered tests (the
`TieredProvider` is the unit under test and owns emission), or clearly namespace the
mock's provider id so mixed events are detectable. Consider dropping the mock's telemetry
emission entirely since the tiered layer is the emission authority.

## Info

### IN-01: `parseAndValidate` `console.warn` leaks first 80 chars of raw LLM output

**File:** `packages/llm/src/validate.ts:100-102` (dependency, not a Phase-108 file)
**Issue:** `safeJsonParse` logs `raw[0..80]` on parse failure. This is out of the Phase-108
diff scope but is directly relevant to the payload-free invariant this phase enforces: a
non-JSON LLM response (e.g. a prose refusal that quotes back the prompt, or a model that
echoes user text) can put up to 80 chars of raw model output into stdout logs. The
telemetry layer is scrupulously payload-free while this `console.warn` is not.
**Fix:** Log only structural facts (`raw?.length`, a boolean "non-JSON") without the
content slice, or gate the slice behind an explicit debug flag. Flagged for awareness;
belongs to the validate.ts owner.

### IN-02: `escalated: true` telemetry on non-escalation failures is semantically misleading

**File:** `packages/llm/src/tiered.ts:207, 224`
**Issue:** When budget is exceeded (line 207) or there is no escalation tier (line 224),
the emitted event sets `escalated: true` even though NO escalation actually occurred —
the call failed at tier-0. `escalated` reads as "the secondary tier was invoked", which
is false here. Downstream consumers counting escalations will over-count.
**Fix:** Consider a distinct field (e.g. `escalationAttempted` vs `escalated`) or set
`escalated: false` with the `EscalationExhaustedError` reason carrying the state. Minor;
document the chosen semantics either way.

### IN-03: `id` string uses non-ASCII arrow `→` in a stable identifier

**File:** `packages/llm/src/tiered.ts:106`
**Issue:** `this.id = "tiered:" + this.tiers.map((t) => t.id).join("→")`. Using U+2192 in
a provider id that may be logged, keyed, or compared across systems (JSONL telemetry,
grep) invites encoding surprises. Cosmetic but the id is a stable identifier.
**Fix:** Use an ASCII separator (e.g. `>` or `+`): `join(">")`.

### IN-04: Duplicated telemetry-emit blocks (5 near-identical `this._emit({...})` sites)

**File:** `packages/llm/src/tiered.ts:180-189, 200-209, 217-226, 234-243, 248-257`
**Issue:** Five `_emit` call sites repeat the same event shape with small deltas
(providerId, costUsd, escalated, validationOutcome). The duplication makes it easy for a
future edit to fix one path and miss another (this is how WR-04's `null` slipped in).
**Fix:** Extract a `_buildEvent(partial)` helper that fills `task`, `ts`, and defaults, so
each site only specifies the deltas. Reduces the chance of divergent telemetry across paths.

### IN-05: `task-ladder.ts` module-doc claims a forward-reference that is now resolved

**File:** `packages/llm/src/task-ladder.ts:12-15, 93-94`
**Issue:** The header still says `./tiered` is "escrito por Plan 02 (Wave 2)... tsc -b
reportará módulo faltante hasta que Plan 02 exista". `tiered.ts` now exists, so the note is
stale and could confuse a reader into thinking the build is broken.
**Fix:** Update or remove the Wave-1/Wave-2 forward-reference note now that `./tiered`
resolves.

---

_Reviewed: 2026-07-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
