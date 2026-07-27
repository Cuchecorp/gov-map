# Phase 108: TIER P2 — Plomería `TieredProvider` + `JudgeProvider` + ladder config + telemetría - Research

**Researched:** 2026-07-27
**Domain:** `@obs/llm` package internals — decorator pattern over `LLMProvider`, `JudgeProvider` wiring, declarative ladder config, payload-free telemetry
**Confidence:** HIGH — grounded entirely in the live codebase; no speculative claims.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- `TieredProvider implements LLMProvider` — decorator at the CLI construction point; consumer bodies do NOT change.
- Router `selectProvider`/`loadRouterConfigFromEnv` is DEAD CODE — do NOT use or revive it.
- `CompletionRequest.task` is ADDITIVE and OPTIONAL: absence of `task` reproduces current behavior BYTE-FOR-BYTE (regression test required).
- Cascade is BOUNDED: respond → validate → escalate. 1 hop per tier, max budget per item, terminal state = human review. NO loops.
- Escalation triggers: judge reject OR zod fail — NEVER model self-confidence.
- Routing BETWEEN pipelines, NEVER mid-session. DeepSeek prompt-cache in fichas must remain intact (verifiable via `prompt_cache_hit_tokens`).
- JudgeProvider is ESCALATE-ONLY: can escalate/reject, NEVER approve or relax a gate.
- Telemetry per call: model, task, latency, cost, verdict, escalation. NEVER payload or PII in logs.
- Reuse `onValidationOutcome`/`ValidationOutcome` from `validate.ts` (107) as the telemetry seam.
- Default sink is NOOP; JSONL variant is optional.
- 100% testable with MockProvider — no new keys required.
- RUT never crosses to any LLM (`assertNoRutInLlmInput` on user+system+context).
- `response_format: json_schema` NEVER assumed. tool_choice forced OR prompt-forced+zod per provider.
- Adjudication (golden-1263) INTOCABLE and unobserved this milestone.

### Claude's Discretion

- Internal shape of `TieredProvider` (how it holds tiers, how it calls the judge).
- Internal shape of `task-ladder.ts` (the config type, how it maps task name to tier list).
- Internal shape of `telemetry.ts` (sink interface, JSONL format).
- Whether telemetry sits inside `TieredProvider.complete` or as a wrapper in `telemetry.ts`.
- Test file names and test organization within `packages/llm/src/`.

### Deferred Ideas (OUT OF SCOPE)

- Swap any production CLI to `TieredProvider` — Phase 109.
- Provider-guard that bites in CI — Phase 109.
- Shadow-eval, canary drift, golden-set regression CI — Phase 109.
- Phi-judge over identity — deferred to v2.
- Adjudication observation of any kind — deferred to v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIER-02 | `TieredProvider` decorator implementing `LLMProvider` with declarative task→ladder config; consumers do not change | Exact `LLMProvider` interface at `packages/llm/src/types.ts:59-68`; construction points identified at `clasificar-fichas-cli.ts:200` and `clasificar-lobby-cli.ts:190` (109 swaps these; 108 only builds the decorator) |
| TIER-03 | `JudgeProvider` wired as ESCALATE-ONLY separate interface; structured verdicts logged for auditability | `JudgeProvider`/`Verdict` interface fully implemented at `packages/llm/src/judge.ts`; `PhiJudge` adapter at `providers/phi-judge.ts` — compose, do not duplicate |
| TIER-04 | Telemetry per call (model/task/latency/cost/verdict/escalation) without payload/PII; bounded escalation (no loops, max budget per item) | `onValidationOutcome`/`ValidationOutcome` hook in `validate.ts:35-39` is the existing payload-free seam; `instrumentedFetch` in `llm-bench/src/instrument.ts` is the pattern for the JSONL sink |
| TIER-05 | Routing between pipelines, not mid-session; DeepSeek prompt-cache economy verifiable | `prompt_cache_hit_tokens` field in DeepSeek response body (not yet read by any adapter — must be surfaced via `instrumentedFetch` extension or documented as a manual check); `pipeline-cli.ts:191` is the non-touched construction point |
</phase_requirements>

---

## Summary

Phase 108 is a pure infrastructure phase: wire the cascade `respond→validate→escalate` as a composable decorator over the existing `@obs/llm` layer, testable deterministically with `MockProvider` before touching any live task. No network calls, no new keys, no CLI changes.

The codebase already has every primitive needed. `LLMProvider` (types.ts), `JudgeProvider`/`Verdict` (judge.ts), `ValidationOutcome`/`onValidationOutcome` (validate.ts), and `MockProvider` (llm-bench and adjudication packages) are all live and stable. The decorator pattern is a natural fit: `TieredProvider` wraps an ordered list of `LLMProvider` tiers, calls the primary, and on judge-reject or zod-fail escalates once to the next tier (1-hop ceiling), then marks the item for human review if that also fails.

The only additive code change to existing files is adding the optional `task?: string` field to `CompletionRequest` in `types.ts`. Everything else is net-new files in `packages/llm/src/`. The barrel `index.ts` needs three new re-export lines. The dead router (`selectProvider`) stays dead — it is exported but not called by any CLI and must not be revived.

**Primary recommendation:** Create `tiered.ts`, `task-ladder.ts`, `telemetry.ts` in `packages/llm/src/`; add `task?: string` to `CompletionRequest`; re-export all three from `index.ts`; write all tests using `MockProvider` from `@obs/llm-bench` (no network).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Respond (primary) | `LLMProvider` (concrete tier-0) | — | Existing contract; `TieredProvider` wraps it |
| Validate output | `parseAndValidate` in `validate.ts` | — | Already the single zod gate; TieredProvider reads its thrown `LLMValidationError` as escalation trigger |
| Judge verdict | `JudgeProvider` (separate interface) | — | Already in `judge.ts`; ESCALATE-ONLY wiring is new |
| Escalate | `TieredProvider` (cascade logic) | — | One hop to next tier; terminal = human-review marker |
| Telemetry sink | `telemetry.ts` (noop/JSONL) | `onValidationOutcome` hook | Payload-free; reuses existing hook seam |
| Ladder config | `task-ladder.ts` | — | Maps task name → ordered tier list + judge + budgets |
| Test harness | `MockProvider` (`@obs/llm-bench`) | `MockMiniMaxProvider` (`@obs/adjudication`) | Deterministic; no network |

---

## Exact Interfaces and Shapes (Grounded)

### 1. `LLMProvider` — `packages/llm/src/types.ts:59-68`

```typescript
export interface LLMProvider {
  readonly id: string;
  readonly trainsOnInputs: boolean;
  complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T>;
}
```

`TieredProvider implements LLMProvider` — exactly this shape, no changes.

### 2. `CompletionRequest` — `packages/llm/src/types.ts:26-51`

Current fields (all existing):
- `system?: string`
- `user: string`
- `criticality: Criticality` ("critical" | "bulk")
- `sensitivity: Sensitivity` ("public" | "personal")
- `maxRepairAttempts?: number`
- `temperature?: number`
- `onValidationOutcome?: (o: ValidationOutcome) => void`

**ADDITIVE EDIT REQUIRED** — add after `temperature?`:
```typescript
/**
 * Identificador semántico de la tarea (p.ej. "clasificacion", "extraccion").
 * ADITIVO y OPCIONAL: ausencia reproduce el comportamiento actual byte-por-byte.
 * Lo usa TieredProvider para seleccionar la escalera; los adapters concretos
 * (DeepSeek, MiniMax, Granite) lo ignoran por completo.
 */
task?: string;
```

`task` is consumed ONLY by `TieredProvider`; no concrete adapter reads it, so its absence is a true no-op for all existing callers.

### 3. `JudgeProvider` and `Verdict` — `packages/llm/src/judge.ts:60-70`

```typescript
export interface JudgeProvider {
  readonly id: string;
  readonly trainsOnInputs: boolean;
  judge(req: JudgeRequest): Promise<Verdict>;
}

export const VerdictSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type Verdict = z.infer<typeof VerdictSchema>; // { ok: boolean; reason?: string; confidence?: number }
```

`JudgeRequest` fields: `answer: string`, `system?: string`, `sensitivity?: Sensitivity`, `temperature?: number`, `context?: string`.

The ESCALATE-ONLY constraint is NOT enforced by the interface — it is enforced by `TieredProvider` logic: when `verdict.ok === true`, `TieredProvider` still passes through (does not escalate); when `verdict.ok === false`, it escalates. A judge that always returns `ok: true` cannot relax a gate because the judgment is only a trigger for escalation, not a substitution for zod validation. The planner must document this clearly in the task: "the judge gates escalation, not acceptance."

### 4. `ValidationOutcome` / `onValidationOutcome` — `packages/llm/src/validate.ts:35-50`

```typescript
export type ValidationOutcome =
  | { kind: "clean" }
  | { kind: "zod-repaired"; attempts: number }
  | { kind: "structured-output-fail" }
  | { kind: "zod-terminal"; issues: ZodIssue[] };
```

`onValidationOutcome` is passed via `CompletionRequest` → threaded into `parseAndValidate`'s `ValidateContext.onOutcome`. The `TieredProvider` can intercept zod failures by catching `LLMValidationError` (thrown when `parseAndValidate` exhausts attempts). The `onValidationOutcome` callback fires BEFORE the error is thrown (at the terminal point in the repair loop). This is the telemetry seam: attach a callback in `TieredProvider.complete` that records the structural outcome without ever touching the prompt or response text.

### 5. Concrete Providers — Construction Signatures

| Provider | File | Constructor key params | `id` | `trainsOnInputs` |
|----------|------|----------------------|------|-----------------|
| `DeepSeekProvider` | `providers/deepseek.ts` | `{ apiKey, baseURL?, model?, fetchFn? }` | `"deepseek"` | `false` |
| `MiniMaxProvider` | `providers/minimax.ts` | `{ apiKey, baseURL?, model?, fetchFn? }` | `"minimax"` | `false` |
| `GraniteProvider` | `providers/granite.ts` | `{ apiKey, baseURL?, model?, fetchFn? }` | `"granite"` | `false` |
| `PhiJudge` | `providers/phi-judge.ts` | `{ apiKey, baseURL?, model?, fetchFn?, structuredMode? }` | `"phi-judge"` | `false` |

All accept `fetchFn?: typeof fetch` — this is the injection point for `instrumentedFetch` in tests and in the telemetry sink.

### 6. Dead Router — `packages/llm/src/router.ts`

`selectProvider` and `loadRouterConfigFromEnv` are exported but NO CLI calls them (verified by grep). They are dead code. Do NOT reference them from `TieredProvider`. Do NOT add `task` routing logic into `router.ts`.

### 7. `MockProvider` — `packages/llm-bench/src/mock-provider.ts:51-85`

```typescript
export class MockProvider implements LLMProvider {
  readonly id = "bench-mock";
  readonly trainsOnInputs = false;
  callCount = 0;
  constructor(private readonly responder: MockResponder, private readonly opts: MockProviderOptions = {}) {}
  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T>
}
type MockResponder = (req: CompletionRequest, schema: ZodType<unknown>) => unknown;
```

`MockProvider` validates the `responder`'s return value against `schema` (same as real adapters). `callCount` is public — use it to assert escalation happened (callCount on tier-0 mock = 1, callCount on tier-1 mock = 1 after one escalation). The `opts.sink` receives `CallMetric` (latencyMs, promptTokens, completionTokens) — compatible with the telemetry sink pattern.

### 8. CLI Construction Points (READ-ONLY for 108)

- `packages/cruces/src/clasificar-fichas-cli.ts:200` — `opts.provider ?? new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY ?? "" })`
- `packages/cruces/src/clasificar-lobby-cli.ts:190` — `opts.provider ?? new MiniMaxProvider({ apiKey: process.env.MINIMAX_API_KEY ?? "" })`
- `packages/fichas/src/pipeline-cli.ts:191` — `const provider = new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY ?? "" })`

Phase 108 does NOT touch these. Phase 109 replaces the `new DeepSeekProvider(...)` in `clasificar-fichas-cli.ts:200` with `new TieredProvider(...)`. The `pipeline-cli.ts` construction point is NEVER touched (DeepSeek stays; prompt-cache must remain).

### 9. Prompt-Cache Observability Gap

`prompt_cache_hit_tokens` is mentioned in ROADMAP, CONTEXT, and PITFALLS as the verifiability criterion for TIER-05, but **it is not currently read by any adapter** (verified by grep — zero occurrences in any `.ts` file, only in `.md` planning files). The `instrumentedFetch` wrapper in `llm-bench/src/instrument.ts:29-58` reads `body.usage.prompt_tokens` and `body.usage.completion_tokens` but NOT `prompt_cache_hit_tokens`. DeepSeek does return this field in their OpenAI-compat response body under `usage.prompt_cache_hit_tokens`.

**Implication for TIER-05 verification:** The planner must decide how to verify "no regression." Options:
1. Document it as a manual check (run `pipeline-cli` before/after and inspect raw DeepSeek response body).
2. Extend `CallMetric` and `instrumentedFetch` to capture `prompt_cache_hit_tokens` (small additive change, but touches `@obs/llm-bench`).
3. Accept that TIER-05 is satisfied structurally — because `TieredProvider` is applied ONLY at the CLI construction point and `pipeline-cli.ts` is NOT changed, the prompt-cache path cannot be disturbed.

Option 3 is the correct interpretation for Phase 108 (no `pipeline-cli.ts` change = no cache regression possible). The planner should document it as a structural invariant, not a measured metric, for 108.

---

## Net-New Files and Public Surface

### `packages/llm/src/tiered.ts`

Public surface:
```typescript
export interface TieredProviderOptions {
  /** Ordered list of tiers: tier[0] is primary, tier[1] is escalation target. Max 2 for 108. */
  tiers: LLMProvider[];
  /** Optional judge. If provided, a judge-reject triggers escalation after tier[0]. */
  judge?: JudgeProvider;
  /** Context for the judge request (task description, rubric). No PII. */
  judgeContext?: string;
  /** Max cost budget per item in USD. Escalation is skipped if exceeded. Prevents loops. */
  maxBudgetUsd?: number;
  /** Telemetry sink. Called once per complete() call with structural info (no payload). */
  telemetrySink?: TelemetrySink;
}

export class TieredProvider implements LLMProvider {
  readonly id: string;         // e.g. "tiered:granite→deepseek"
  readonly trainsOnInputs: boolean; // true if any tier trainsOnInputs
  constructor(opts: TieredProviderOptions);
  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T>;
}
```

Cascade logic inside `complete`:
1. Call `tiers[0].complete(req, schema)` — wraps `onValidationOutcome` to capture structural outcome.
2. If clean → emit telemetry, return.
3. If `LLMValidationError` thrown (zod-terminal or structured-output-fail) → escalation trigger.
4. If judge present → call `judge.judge({ answer: rawOutput, context: judgeContext, sensitivity: req.sensitivity })` — if `verdict.ok === false` → escalation trigger.
5. Escalation: if `tiers[1]` exists and budget not exceeded → call `tiers[1].complete(req, schema)`.
6. If `tiers[1]` fails or absent → throw `EscalationExhaustedError` (terminal; caller marks for human review).
7. `assertNoRutInLlmInput` on `req.user` and `req.system` at entry (even though the wrapped providers also check — defense in depth at the decorator layer is correct).

**Critical: ESCALATE-ONLY semantics.** The judge verdict `ok: true` does NOT skip validation — it is simply not an escalation trigger. The judge can only cause escalation (`ok: false`); it cannot approve output that failed zod.

### `packages/llm/src/task-ladder.ts`

Public surface:
```typescript
export interface TierSpec {
  provider: LLMProvider;
}

export interface LadderConfig {
  /** Primary tier */
  primary: TierSpec;
  /** Optional escalation tier */
  escalation?: TierSpec;
  /** Optional judge applied after primary */
  judge?: JudgeProvider;
  /** Judge context string (rubric — no PII) */
  judgeContext?: string;
  /** Max per-item cost budget USD */
  maxBudgetUsd?: number;
}

/** Map of task name (e.g. "clasificacion") to ladder config. */
export type TaskLadder = Record<string, LadderConfig>;

/** Build a TieredProvider from a LadderConfig. */
export function buildTieredProvider(config: LadderConfig, telemetrySink?: TelemetrySink): TieredProvider;
```

Purpose: decouple the "what tiers exist for this task" configuration from `TieredProvider`'s cascade logic. The CLI (in 109) will do:
```typescript
const ladder: TaskLadder = { clasificacion: { primary: { provider: granite }, escalation: { provider: deepseek }, maxBudgetUsd: 0.01 } };
const provider = buildTieredProvider(ladder["clasificacion"], sink);
```

### `packages/llm/src/telemetry.ts`

Public surface:
```typescript
export interface TelemetryEvent {
  /** Provider id (e.g. "granite", "deepseek") */
  providerId: string;
  /** Task name from CompletionRequest.task (undefined if not set) */
  task?: string;
  /** Wall-clock latency ms */
  latencyMs: number;
  /** Estimated cost USD (null if tokens unavailable) */
  costUsd: number | null;
  /** Structural outcome from onValidationOutcome */
  validationOutcome: ValidationOutcome | null;
  /** Judge verdict if invoked */
  judgeVerdict?: Pick<Verdict, "ok" | "confidence">;
  /** Whether escalation occurred */
  escalated: boolean;
  /** ISO timestamp */
  ts: string;
}

/** Sink interface: receives one event per complete() call. Never receives prompt/response text. */
export type TelemetrySink = (event: TelemetryEvent) => void;

/** Default sink: noop. Import and use when no telemetry configured. */
export const noopSink: TelemetrySink;

/** JSONL sink factory: writes one JSON line per event to a WritableStream or file path. */
export function jsonlSink(target: { write: (line: string) => void }): TelemetrySink;
```

`TelemetryEvent` deliberately excludes `user`, `system`, `answer`, `reason` (judge reason string), and any Verdict field beyond `ok`/`confidence`. The judge `reason` field is structural opinion text that could leak task content — exclude it. `confidence` is a float — safe.

### Additive Edit to `packages/llm/src/types.ts`

Add `task?: string` to `CompletionRequest` after `temperature?`. This is the ONLY change to an existing source file in Phase 108.

### Additive Edit to `packages/llm/src/index.ts`

Add three lines after the existing exports:
```typescript
export * from "./tiered";
export * from "./task-ladder";
export * from "./telemetry";
```

No existing exports change. No name collision risk (grep confirms no existing export named `TieredProvider`, `TaskLadder`, `TelemetrySink`, `TelemetryEvent`, `noopSink`, `jsonlSink`, `buildTieredProvider`, `EscalationExhaustedError`).

---

## MockProvider-Based Test Strategy

All tests in `packages/llm/src/tiered.test.ts` (and optionally `task-ladder.test.ts`, `telemetry.test.ts`). Import `MockProvider` from `@obs/llm-bench`. No network, no keys.

### Test A — No-`task` byte-identical passthrough (TIER-02 regression criterion #1)

Create `TieredProvider` with one tier (`MockProvider` returning a known value). Call `complete` with a `CompletionRequest` WITHOUT `task`. Assert: (a) the exact same value is returned as calling the `MockProvider` directly, (b) `MockProvider.callCount === 1`, (c) no escalation occurred, (d) telemetry event `task === undefined`, `escalated === false`.

### Test B — Escalation on zod-fail (TIER-02 + TIER-04)

Create tier-0 `MockProvider` whose responder throws (simulating `LLMValidationError`). Create tier-1 `MockProvider` returning a valid value. Assert: tier-0 `callCount === 1`, tier-1 `callCount === 1`, return value = tier-1's value, telemetry `escalated === true`. Test that a second zod-fail on tier-1 throws `EscalationExhaustedError` (not a loop).

### Test C — Escalation on judge-reject (TIER-03 + TIER-04)

Create tier-0 `MockProvider` returning a valid value. Create a `MockJudgeProvider` (inline test double implementing `JudgeProvider`) returning `{ ok: false, reason: "not good" }`. Assert: escalation fires, tier-1 is called. Separately assert that a judge returning `{ ok: true }` does NOT trigger escalation.

### Test D — Judge is ESCALATE-ONLY (TIER-03 invariant)

Create tier-0 `MockProvider` whose responder throws `LLMValidationError`. Create `MockJudgeProvider` returning `{ ok: true }`. Assert: the `ok: true` verdict does NOT cause the zod-fail to be swallowed — the zod-fail still triggers escalation (because the judge runs AFTER validation, not instead of it). The judge's `ok: true` is irrelevant when validation already failed.

Alternatively: create a `TieredProvider` with only one tier and a judge that returns `{ ok: true }`. Call with a request whose tier-0 returns a valid value. Assert: judge is called, verdict is `ok: true`, no escalation, result returned correctly. This proves the judge cannot relax a gate — it can only escalate when returning `ok: false`.

### Test E — Telemetry payload-free (TIER-04)

Capture all `TelemetryEvent` objects emitted during a full cascade (clean + escalated runs). Assert: no event has fields `user`, `system`, `answer`, `prompt`, `reason` (judge reason). Assert `providerId`, `task`, `latencyMs`, `escalated`, `validationOutcome.kind` are present and correct.

### Test F — Bounded escalation, 1-hop, terminal human-review (TIER-04)

Create a ladder with tier-0 and tier-1 both failing (both `MockProvider`s throw). Assert: `complete` throws `EscalationExhaustedError` after exactly 2 calls total (1 per tier), not a loop. Assert telemetry shows `escalated: true`.

### Test G — Budget cap prevents escalation (TIER-04)

Create `TieredProvider` with `maxBudgetUsd: 0` (zero budget). Create tier-0 that fails. Assert: escalation is skipped (budget exceeded), `EscalationExhaustedError` thrown with 1 total call. (Budget tracking is approximate for 108 — can be based on token count from `CallMetric` or a hardcoded cost-per-call estimate.)

### Test H — `assertNoRutInLlmInput` fires at TieredProvider entry (TIER-03 guard)

Pass a `user` string containing a Chilean RUT pattern. Assert the decorator itself throws before calling any tier (same as existing adapters). This confirms defense-in-depth: the guard fires at the decorator level even if the wrapped provider also checks.

---

## Architecture Patterns

### System Architecture Diagram

```
CLI (clasificar-fichas-cli.ts)
       |
       | constructs at startup
       v
TieredProvider (decorator, implements LLMProvider)
  ├─ assertNoRutInLlmInput (entry guard)
  ├─ tiers[0].complete(req, schema)   ←── MockProvider (tests) / GraniteProvider (109 live)
  │      └─ onValidationOutcome callback → TelemetrySink
  │
  ├─ [on LLMValidationError] ──────────────────────────────────┐
  │                                                             │ escalation trigger
  ├─ judge?.judge({ answer, context, sensitivity })            │
  │      └─ [ok: false] ────────────────────────────────────── ┤
  │                                                             │
  │                                                             v
  │                                               tiers[1].complete(req, schema)
  │                                               (DeepSeek incumbent / fallback)
  │                                                             │
  │                                               [fail] → EscalationExhaustedError
  │                                               (caller marks item for human review)
  │
  └─ TelemetrySink.emit(TelemetryEvent) — no payload, no PII
```

### Recommended File Structure

```
packages/llm/src/
├── types.ts          # +task?: string (additive)
├── tiered.ts         # TieredProvider, EscalationExhaustedError (NEW)
├── task-ladder.ts    # TaskLadder, LadderConfig, buildTieredProvider (NEW)
├── telemetry.ts      # TelemetrySink, TelemetryEvent, noopSink, jsonlSink (NEW)
├── tiered.test.ts    # All MockProvider-based tests (NEW)
├── index.ts          # +3 export lines (additive)
└── ... (existing files untouched)
```

### Anti-Patterns to Avoid

- **Reviving `selectProvider`:** The dead router selects by `Criticality` ("critical"/"bulk"), not by semantic task name. `TieredProvider` selects by `task` string. These are orthogonal. Do not merge them.
- **Mid-session routing:** `TieredProvider` is constructed once per pipeline run with a fixed tier list. It does NOT switch models based on request content at runtime (that would break prompt-cache).
- **Judge as approver:** If `verdict.ok === true` AND zod validation passed, return result. If `verdict.ok === true` AND zod failed, still escalate (zod failure is not overridden by judge approval).
- **Loops:** After tier-1 fails, throw immediately. Never call tier-0 again. Max calls = `tiers.length` (2 for 108).
- **PII in TelemetryEvent:** `reason` from Verdict is a string from the judge model — could contain task-specific text. Exclude it. Include only `ok` and `confidence`.
- **`task` field consumed by concrete adapters:** `DeepSeekProvider.complete`, `GraniteProvider.complete`, etc. do not read `req.task`. The field is for `TieredProvider` only. No adapter change needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod validation in TieredProvider | Custom JSON parsing | `parseAndValidate` from `validate.ts` + catch `LLMValidationError` | Already handles repair loop, terminal detection, and the `onValidationOutcome` hook |
| RUT detection | Regex in TieredProvider body | `assertNoRutInLlmInput` from `data-routing.ts` | Existing guard with tests; defense-in-depth at decorator layer |
| Sensitivity gate | Custom check | `assertSensitivityAllowed` from `data-routing.ts` | Same pattern as all concrete adapters |
| Judge call format | Custom prompt construction | `PhiJudge.judge(req: JudgeRequest)` | Already handles tool-mode/prompt-mode, VerdictSchema validation, temperature=0 |
| Mock for tests | New test double class | `MockProvider` from `@obs/llm-bench` | Already accepts `responder` function, tracks `callCount`, emits `CallMetric` |

---

## Common Pitfalls

### Pitfall 1: `onValidationOutcome` fires BEFORE `LLMValidationError` is thrown

**What goes wrong:** The telemetry callback fires at the terminal point inside `parseAndValidate`, before the error propagates to `TieredProvider`. If `TieredProvider` sets its own `onValidationOutcome` wrapper to detect failures, it must catch `LLMValidationError` in `try/catch`, not rely on the callback to signal failure (the callback fires in both success and failure paths).

**How to avoid:** In `TieredProvider.complete`, wrap `tiers[0].complete()` in a `try/catch`. The callback captures the outcome kind; the catch captures the error. They are independent signals. Use the `onValidationOutcome` callback to record telemetry; use the `catch` block to decide escalation.

**Pattern:**
```typescript
let capturedOutcome: ValidationOutcome | null = null;
const wrappedReq = { ...req, onValidationOutcome: (o) => { capturedOutcome = o; req.onValidationOutcome?.(o); } };
try {
  const result = await tiers[0].complete(wrappedReq, schema);
  // capturedOutcome.kind === "clean" or "zod-repaired"
  emitTelemetry({ ..., escalated: false, validationOutcome: capturedOutcome });
  return result;
} catch (err) {
  if (err instanceof LLMValidationError) {
    // escalation trigger — capturedOutcome.kind === "structured-output-fail" or "zod-terminal"
  }
}
```

### Pitfall 2: `trainsOnInputs` must be true if ANY tier trains on inputs

**What goes wrong:** `TieredProvider.trainsOnInputs` is checked by `assertSensitivityAllowed` in the wrapped provider, but the caller may also check the decorator's own `trainsOnInputs`. If tier-1 is a provider that trains on inputs and the decorator reports `false`, personal data could be routed incorrectly.

**How to avoid:** `TieredProvider.trainsOnInputs = tiers.some(t => t.trainsOnInputs)`. Compute at construction.

### Pitfall 3: Barrel name collisions

**What goes wrong:** `index.ts` does `export * from "./tiered"` — if `tiered.ts` exports any name already exported by another module (e.g. `ValidationOutcome` from `validate.ts`), TypeScript raises "All declarations of 'X' must have identical type parameters."

**How to avoid:** Before finalizing `tiered.ts`, `task-ladder.ts`, and `telemetry.ts`, grep the existing barrel exports for name conflicts. Currently no conflicts found for: `TieredProvider`, `EscalationExhaustedError`, `TieredProviderOptions`, `TierSpec`, `LadderConfig`, `TaskLadder`, `buildTieredProvider`, `TelemetrySink`, `TelemetryEvent`, `noopSink`, `jsonlSink`. Import `ValidationOutcome` and `Verdict` from their source modules inside the new files — do not re-export them from the new modules.

### Pitfall 4: Judge is called with the raw string output, not the parsed object

**What goes wrong:** `JudgeRequest.answer` expects a string (the raw LLM response to judge). After `tiers[0].complete()` succeeds (returns a typed `T`), there is no raw string available to pass to the judge. The judge cannot inspect a parsed TypeScript object.

**How to avoid:** The judge is called ONLY when tier-0 FAILS (i.e., when `LLMValidationError` is thrown and the raw response is unavailable anyway). If tier-0 succeeds cleanly, the judge is skipped (or called with `JSON.stringify(result)` as `answer` — but this is a design decision for the planner). Simplest design: judge only fires on failure path, where the answer to judge is "the final invalid raw output" captured from the repair loop context. Alternatively, always call the judge on success too with `answer = JSON.stringify(result)` as an acceptance gate. The CONTEXT.md says judge triggers on "veredicto de juez o fallo zod" — meaning both can escalate independently. Planner must pin which design.

**Recommended:** For 108 (plomería only), keep it simple: judge fires always after tier-0 attempt, receiving `JSON.stringify(result)` on success or a description of the failure on zod-fail. The judge's `ok: false` is the escalation trigger regardless.

### Pitfall 5: `MockProvider` from `@obs/llm-bench` vs `MockMiniMaxProvider` from `@obs/adjudication`

**What goes wrong:** Two `MockProvider` shapes exist. `@obs/adjudication`'s `MockMiniMaxProvider` is domain-specific (Adjudicacion type, name-keyed responses) and unsuitable for generic ladder testing. `@obs/llm-bench`'s `MockProvider` is generic and is the correct test vehicle.

**How to avoid:** Import `MockProvider` from `@obs/llm-bench` in all `@obs/llm` tests. Do NOT import from `@obs/adjudication`.

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to false — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing in `@obs/llm`) |
| Config file | `packages/llm/vitest.config.ts` (existing) |
| Quick run command | `pnpm --filter @obs/llm test --run` |
| Full suite command | `pnpm --filter @obs/llm test --run && tsc -b` |

Current baseline: `@obs/llm` 102 pass / 3 skip. Phase 108 adds tests; baseline must remain green.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIER-02 | No-`task` passthrough byte-identical | unit | `pnpm --filter @obs/llm test --run tiered` | ❌ Wave 0 |
| TIER-02 | `TieredProvider` is drop-in LLMProvider (implements interface) | unit (type-level) | `tsc -b` | ❌ Wave 0 |
| TIER-03 | Judge-reject triggers escalation | unit | `pnpm --filter @obs/llm test --run tiered` | ❌ Wave 0 |
| TIER-03 | Judge `ok: true` cannot relax zod-fail | unit | `pnpm --filter @obs/llm test --run tiered` | ❌ Wave 0 |
| TIER-03 | `assertNoRutInLlmInput` fires at decorator entry | unit | `pnpm --filter @obs/llm test --run tiered` | ❌ Wave 0 |
| TIER-04 | Telemetry events contain no payload/PII fields | unit | `pnpm --filter @obs/llm test --run telemetry` | ❌ Wave 0 |
| TIER-04 | Escalation bounded: max `tiers.length` calls, then EscalationExhaustedError | unit | `pnpm --filter @obs/llm test --run tiered` | ❌ Wave 0 |
| TIER-04 | Budget cap prevents escalation when exceeded | unit | `pnpm --filter @obs/llm test --run tiered` | ❌ Wave 0 |
| TIER-05 | `pipeline-cli.ts` construction point untouched | structural (grep in CI) | `grep -r "TieredProvider" packages/fichas/src` should exit 1 | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @obs/llm test --run`
- **Per wave merge:** `pnpm --filter @obs/llm test --run && tsc -b`
- **Phase gate:** Full suite green (102 existing + new) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/llm/src/tiered.test.ts` — covers TIER-02, TIER-03, TIER-04
- [ ] `packages/llm/src/telemetry.test.ts` — covers TIER-04 payload-free assertion
- [ ] `packages/llm/src/task-ladder.test.ts` — covers `buildTieredProvider` config wiring

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `assertNoRutInLlmInput` (existing) + zod (`parseAndValidate`) |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RUT in escalation path | Information Disclosure | `assertNoRutInLlmInput` at TieredProvider entry + in each wrapped provider |
| PII in telemetry logs | Information Disclosure | `TelemetryEvent` shape excludes all text fields; only structural/numeric |
| Infinite escalation loop | Denial of Service | Hard cap: at most `tiers.length` calls per `complete()` invocation |
| Judge "approves" bad output | Tampering | Judge verdict only gates escalation; zod validation is the single acceptance gate |
| `task` field leaks task context to adapter | Information Disclosure | Concrete adapters do not read `task`; it is consumed only by TieredProvider |

---

## Package Legitimacy Audit

No new external packages are required for Phase 108. All dependencies are already in the monorepo:
- `@obs/llm-bench` (internal, already a devDependency of test infrastructure)
- `zod` (already in `@obs/llm`)
- `openai` (already in `@obs/llm`)

No npm install step; no audit table required.

---

## Environment Availability

Phase 108 is code/config-only with no external dependencies. All tests use `MockProvider` (no network, no keys).

Step 2.6: SKIPPED — no external dependencies. Workers AI and OpenRouter keys are required in Phase 109, not here.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `prompt_cache_hit_tokens` is present in DeepSeek's response body but not currently read by any adapter | Prompt-Cache Observability Gap | If DeepSeek does not expose this field, TIER-05 metric-based verification is impossible; structural argument still holds |
| A2 | The `buildTieredProvider` helper is the right abstraction for task-ladder wiring | Net-New Files | If the ladder config shape is wrong, 109 integration is harder; planner may adjust |

---

## Open Questions (RESOLVED)

> Ambas resueltas en los planes 108-01/108-02: (1) el juez corre SIEMPRE tras el intento de tier-0 (Pitfall 4 RECOMENDADO — fija en 108-02 Task 1 step 4); (2) el cost-tracking del budget cap se hace vía `costPerToken?: number` en `TierSpec` (interfaces de 108-01; consumido en 108-02 Task 1 step 6).

1. **When does the judge fire — always or only on failure?**
   - What we know: CONTEXT says "escalación disparada por veredicto de juez o fallo zod" — both are triggers.
   - What's unclear: Whether the judge fires on a SUCCESSFUL tier-0 output (to optionally escalate even clean outputs) or only on failure.
   - Recommendation: For 108, implement judge firing ALWAYS (after tier-0 attempt, passing result or failure description as `answer`). This is more conservative and enables richer testing.

2. **How is cost tracked for budget cap?**
   - What we know: `CallMetric` has `promptTokens` and `completionTokens`; cost-per-token varies by provider.
   - What's unclear: Should `TieredProvider` have per-provider cost rates baked in, or receive a cost estimator function?
   - Recommendation: Start with a simple `costPerToken?: number` in `TierSpec`; if undefined, budget cap is disabled for that tier.

---

## Sources

### Primary (HIGH confidence)
- `packages/llm/src/types.ts` — exact `LLMProvider`, `CompletionRequest` shapes (read directly)
- `packages/llm/src/judge.ts` — exact `JudgeProvider`, `Verdict`, `VerdictSchema`, `JudgeRequest` shapes (read directly)
- `packages/llm/src/validate.ts` — exact `ValidationOutcome`, `onValidationOutcome`, `parseAndValidate`, `LLMValidationError` (read directly)
- `packages/llm/src/providers/deepseek.ts` — constructor signature, `prompt_cache_hit_tokens` absence confirmed (read directly)
- `packages/llm/src/providers/granite.ts` — constructor signature, tool-calling pattern (read directly)
- `packages/llm/src/providers/phi-judge.ts` — `PhiJudge` constructor, `structuredMode`, `JudgeProvider` implementation (read directly)
- `packages/llm/src/router.ts` — `selectProvider` confirmed dead code pattern (read directly)
- `packages/llm/src/index.ts` — barrel exports, no name conflicts confirmed (read directly)
- `packages/llm-bench/src/mock-provider.ts` — `MockProvider` exact shape (read directly)
- `packages/llm-bench/src/instrument.ts` — `CallMetric`, `instrumentedFetch` pattern (read directly)
- `packages/adjudication/src/mock-provider.ts` — `MockMiniMaxProvider` shape, confirmed domain-specific (read directly)
- `packages/cruces/src/clasificar-fichas-cli.ts:200` — construction point grep (read directly)
- `packages/cruces/src/clasificar-lobby-cli.ts:190` — construction point grep (read directly)
- `packages/fichas/src/pipeline-cli.ts:191` — construction point grep (read directly)

### Secondary (MEDIUM confidence)
- `.planning/PROMPT-v11.0-PASADA2.md` §108 — design invariants (authoritative rector, not codebase)
- `.planning/REQUIREMENTS.md` TIER-02..05 — requirement text (authoritative)
- `.planning/phases/108-*/108-CONTEXT.md` — locked decisions (authoritative)

---

## Metadata

**Confidence breakdown:**
- Interface shapes: HIGH — read directly from source files
- Net-new file surfaces: HIGH — derived from locked decisions + existing patterns
- Test strategy: HIGH — grounded in MockProvider shape and existing test patterns
- Prompt-cache observability: MEDIUM — field existence inferred from DeepSeek docs referenced in planning files, not from a live API call

**Research date:** 2026-07-27
**Valid until:** 2026-08-27 (stable internal interfaces; no external API dependencies)

---

## RESEARCH COMPLETE

Phase 108 is fully groundable: every interface, construction point, and test vehicle exists in the live codebase. The planner needs to create three net-new files (`tiered.ts`, `task-ladder.ts`, `telemetry.ts`), one additive field (`CompletionRequest.task`), three barrel lines, and one test file — all within `packages/llm/src/`, with zero changes to any CLI or concrete adapter.
