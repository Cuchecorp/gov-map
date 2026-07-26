# Architecture Research

**Domain:** Tiered LLM layer (respond→validate→escalate) over an existing pluggable `LLMProvider` in a pnpm/TypeScript monorepo — batch/CLI execution, not a synchronous request path
**Researched:** 2026-07-26
**Confidence:** HIGH (grounded in the actual `packages/llm` code; small-model availability MEDIUM/HIGH)

> Scope: SEED-001. This file answers **how the tiering integrates** with the code that exists today. Every claim below is anchored to a real signature in `packages/llm/src` or a real call site. Model *selection* per task is decided by the benchmark harness (out of scope here); this is the plumbing that the harness's verdicts flow into.

---

## Ground Truth: what exists today (quoted from the code)

The whole design hinges on one interface. From `packages/llm/src/types.ts:49`:

```typescript
export interface LLMProvider {
  readonly id: string;
  readonly trainsOnInputs: boolean;
  complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T>;
}
```

`CompletionRequest` (`types.ts:25`) carries `{ system?, user, criticality, sensitivity, maxRepairAttempts?, temperature? }` where `Criticality = "critical" | "bulk"` and `Sensitivity = "public" | "personal"`.

Four facts from the code are load-bearing for the whole recommendation:

1. **`complete()` returns an already-zod-validated `T`, not raw text.** The compuerta única (`validate.ts:parseAndValidate`) and the repair loop live *inside* each adapter (`deepseek.ts:90`, `minimax.ts:123`). A caller never sees raw model output. **Consequence:** a judge that inspects "the raw answer" cannot sit *outside* `complete()` unless the answer type is surfaced — the tier design must respect that the unit of exchange is a *validated object*, not a string.

2. **The compliance gates are fail-closed *by construction inside every adapter*** — `assertNoRutInLlmInput` + `assertSensitivityAllowed` run before any network call (`deepseek.ts:65-68`, `minimax.ts:69-72`). **Consequence:** any new tier provider (Granite, Phi) is subject to the same gates automatically *if and only if* it implements `LLMProvider` the same way. This is the single most important constraint: new rungs MUST be `LLMProvider` implementations, not a bespoke path that bypasses the gates.

3. **The router (`selectProvider`) and config (`loadRouterConfigFromEnv`) are DORMANT in production.** Grep across `packages/**` and `apps/**` (excluding tests/dist) shows `selectProvider` / `loadRouterConfigFromEnv` are referenced **only** in `router.ts` / `config.ts` themselves. Every real consumer hard-instantiates a concrete provider:
   - `fichas/src/pipeline-cli.ts:191` → `new DeepSeekProvider({ apiKey: ... })`
   - `adjudication` receives a provider injected; golden CI passes `MockProvider`, LIVE passes `new MiniMaxProvider(...)`
   - `agenda/src/run-agenda-prod-cli.ts:130`, `cruces/src/clasificar-fichas-cli.ts:200` → `new DeepSeekProvider(...)`
   - `cruces/src/clasificar-lobby-cli.ts:190` → `new MiniMaxProvider(...)`

   **Consequence:** there is no central selection seam to hook. The cascade cannot be "wire it into the router" because nothing calls the router. It has to be a **new `LLMProvider` implementation** that consumers opt into at their existing instantiation site (change `new DeepSeekProvider(...)` → `new TieredProvider(...)`), OR a revived-and-extended `selectProvider`. The former is far lower-risk and touches one line per consumer.

4. **Consumers inject the provider; they don't reach into `@obs/llm` internals.** `extraer(texto, proyecto, provider)` (`fichas/src/extraer.ts:26`) and `correrPipeline(mencion, maestra, provider, writer)` (`adjudication/src/pipeline.ts:88`) both take an `LLMProvider` as a parameter. **This is the decisive fact for the whole SEED:** because consumers are already dependency-injected on the interface, a composed tiered provider is a **drop-in** — the consumer body does not change at all, only the object handed to it at the CLI boundary.

---

## Recommended Architecture

**Answer to (a): the cascade lives in a new `TieredProvider` class that `implements LLMProvider` (composition/decorator).** Not the router, not per-consumer wiring, not a separate orchestrator that consumers call directly.

Rationale, from the code above:
- Consumers already take `LLMProvider` by injection (fact 4) → a decorator is a zero-change drop-in at the call sites.
- The router is dead code (fact 3) → reviving it as the seam means resurrecting an unused path *and* it only maps `Criticality` (2 values) to *one* provider — it cannot express a *ladder*. The ladder is a richer concept than the router models.
- A separate orchestrator module that consumers must call would force every consumer body to change (violates "without touching consumers", question b).
- Because `TieredProvider` *is* an `LLMProvider`, the fail-closed gates (fact 2) are enforced by the inner rung providers automatically — the tiered wrapper never sees a RUT bypass path.

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  CONSUMERS (unchanged bodies — inject LLMProvider)                      │
│  fichas/extraer(..., provider)   adjudication/correrPipeline(..., prov) │
│  cruces/clasificar   agenda/tabla                                       │
│         │ (one-line change at the CLI: which provider they construct)   │
├─────────┴─────────────────────────────────────────────────────────────┤
│  @obs/llm  —  NEW: TieredProvider  implements LLMProvider               │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │ complete<T>(req, schema):                                       │    │
│  │   ladder = ladderFor(req)      ← from TaskLadderConfig (task→…) │    │
│  │   for rung in ladder.responders:                                │    │
│  │      answer = rung.provider.complete(req, schema)  ← zod-valid  │    │
│  │      verdict = ladder.judge?.judge(req, answer, schema)         │    │
│  │      telemetry.record({rung, verdict, latency, cost, …})        │    │
│  │      if verdict.ok  → return answer   (escalate no further)     │    │
│  │   throw / return last  (per ladder.onExhausted policy)          │    │
│  └───────────────────────────────────────────────────────────────┘    │
│        │ delegates to                    │ optional second opinion       │
│  ┌─────┴──────┐ ┌──────────┐ ┌───────────┴──┐   ┌──────────────────┐    │
│  │ Granite    │ │ DeepSeek │ │ MiniMax      │   │ JudgeProvider    │    │
│  │ Provider   │ │ Provider │ │ Provider     │   │ (Phi-4-mini)     │    │
│  │ (new rung) │ │ (exists) │ │ (exists)     │   │ (new, separate   │    │
│  └────────────┘ └──────────┘ └──────────────┘   │  interface)      │    │
│    each implements LLMProvider → fail-closed     └──────────────────┘    │
│    gates + repair loop run inside each                                   │
├──────────────────────────────────────────────────────────────────────┤
│  TELEMETRY SINK (NEW): per-call {task, rung, model, verdict,           │
│  latency_ms, tokens/cost, escalated} → JSONL / Supabase table          │
│  feeds the benchmark loop                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New / Modified / Unchanged |
|-----------|----------------|------------------|
| `LLMProvider` interface (`types.ts`) | Stable contract; unit of exchange = validated `T` | **Unchanged** (do NOT touch — everything composes on it) |
| `GraniteProvider` (`providers/granite.ts`) | New responder rung for routing/classification/simple tasks; OpenAI-compat via `baseURL`; tool-calling structured output + zod (like MiniMax) | **New** |
| `PhiJudge` (`providers/phi-judge.ts`) | Judge/validator rung. Takes `(req, candidateAnswer, schema)` → `Verdict{ ok, reason, confidence }`. Own interface, not `LLMProvider` (see c) | **New** |
| `TieredProvider` (`tiered.ts`) | The cascade. Implements `LLMProvider`; reads a `TaskLadder`, runs respond→judge→escalate, emits telemetry | **New** |
| `TaskLadderConfig` (`task-ladder.ts`) | Config map `task → ladder` (responders in order + optional judge + escalation policy). The swappable piece the benchmark writes into | **New** |
| Telemetry sink (`telemetry.ts`) | Per-call record; pluggable writer (JSONL local, Supabase table in CI/LIVE) | **New** |
| `DeepSeekProvider` / `MiniMaxProvider` | Concrete rungs, delegated to by `TieredProvider` | **Unchanged** |
| `selectProvider` / `loadRouterConfigFromEnv` (`router.ts`/`config.ts`) | Dead code today | **Leave as-is or delete**; do NOT extend into the ladder (see anti-pattern 1) |
| Consumers (`fichas`, `adjudication`, `cruces`, `agenda`) | Business logic; already DI'd on `LLMProvider` | **Bodies unchanged**; only the object constructed at the CLI boundary changes (one line) |

---

## Recommended Project Structure

```
packages/llm/src/
├── types.ts                 # UNCHANGED — LLMProvider, CompletionRequest, …
├── validate.ts              # UNCHANGED — parseAndValidate (compuerta única)
├── data-routing.ts          # UNCHANGED — assertNoRutInLlmInput, assertSensitivityAllowed
├── json-schema.ts           # UNCHANGED — zodToToolSchema (reused by Granite + Phi)
├── router.ts / config.ts    # LEFT ALONE (dormant); NOT the seam for the ladder
├── providers/
│   ├── deepseek.ts          # UNCHANGED
│   ├── minimax.ts           # UNCHANGED
│   ├── granite.ts           # NEW — responder rung (tool-calling + zod)
│   └── phi-judge.ts         # NEW — judge rung (JudgeProvider, not LLMProvider)
├── judge.ts                 # NEW — JudgeProvider interface + Verdict type
├── tiered.ts                # NEW — TieredProvider implements LLMProvider
├── task-ladder.ts           # NEW — TaskId, TaskLadder, ladder config loader
└── telemetry.ts             # NEW — TelemetryEvent + pluggable sink

packages/llm-bench/           # NEW package (kept OUT of @obs/llm to avoid shipping
├── src/                      #   test/eval deps into the runtime lib)
│   ├── harness.ts            # runs a golden set for a task across a set of providers
│   ├── metrics.ts            # quality/latency/cost aggregation
│   └── tasks/                # per-task golden sets (routing, clasificación, juez, extracción)
└── ...
```

### Structure Rationale

- **`tiered.ts` inside `@obs/llm`:** the cascade is part of the provider layer's public surface; consumers import it the same way they import `DeepSeekProvider`. It belongs next to the interface it composes.
- **`llm-bench` as a *separate* package:** the benchmark harness needs golden fixtures, live-API-gated tests, and metric tooling that must NOT become runtime dependencies of `@obs/llm` (which runs in Deno/edge). This mirrors the existing split where golden sets live in the *consumer* package (`adjudication/src/golden`, `fichas/src/golden`) rather than in `@obs/llm`.
- **`phi-judge.ts` separate from `granite.ts`:** the judge answers a different question (is *this answer* good?) than a responder (produce an answer). Different interface (see c) → different file.

---

## Architectural Patterns

### Pattern 1: Decorator provider (the cascade)

**What:** `TieredProvider implements LLMProvider` and holds N inner `LLMProvider`s + an optional `JudgeProvider`. Its `complete<T>` runs the ladder and returns the first answer the judge accepts, escalating on rejection.

**When to use:** for any task whose ladder config lists more than one rung. A single-rung ladder (e.g. `extraccion → [deepseek]` with no judge) collapses to a straight delegation — identical behavior to today.

**Trade-offs:**
- Pro: zero consumer-body changes; gates + repair loop enforced by inner rungs; ladder is pure config.
- Pro: because `complete()` returns a validated `T`, "the responder failed schema" is already handled *below* the tier by the repair loop — the judge only adjudicates *semantic* quality, not JSON validity.
- Con: the judge sees a *validated object* `T`, not raw prose. That is actually correct here (we judge the extracted fact, not the token stream), but it means the judge prompt must serialize `T` back to text. Acceptable.

**Example:**
```typescript
// packages/llm/src/tiered.ts
export class TieredProvider implements LLMProvider {
  readonly id = "tiered";
  // trainsOnInputs is the OR of the rungs the ladder can actually reach for a
  // given task; conservatively expose true only if a reachable rung trains.
  readonly trainsOnInputs: boolean;

  constructor(
    private ladders: TaskLadderConfig,
    private telemetry: TelemetrySink,
  ) { /* … */ }

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    const ladder = this.ladders.for(req);           // task → ladder
    let last: { answer: T; verdict: Verdict } | undefined;
    for (const rung of ladder.responders) {
      const t0 = performance.now();
      // Inner complete() runs assertNoRut + assertSensitivity + repair loop.
      const answer = await rung.complete(req, schema);
      const verdict = ladder.judge
        ? await ladder.judge.judge(req, answer, schema)
        : { ok: true, reason: "no-judge", confidence: 1 };
      this.telemetry.record({
        task: ladder.task, rung: rung.id, judge: ladder.judge?.id ?? null,
        verdict, latencyMs: performance.now() - t0, /* + cost/tokens */
      });
      if (verdict.ok) return answer;                 // accepted → stop escalating
      last = { answer, verdict };
    }
    // exhausted: policy decides. For CRITICAL never silently return a rejected
    // answer — throw so the caller's fail-closed gate (e.g. compuerta) engages.
    return ladder.onExhausted(last, req);
  }
}
```

### Pattern 2: Task-keyed ladder config (granularity without touching consumers)

**What (answer to b):** a config map `TaskId → { responders: LLMProvider[]; judge?: JudgeProvider; onExhausted }`. The task is identified per call. Because `CompletionRequest` today has only `criticality`/`sensitivity` (too coarse to name a *task*), add **one optional field** `task?: TaskId` to `CompletionRequest` — a backward-compatible, additive change. Consumers set it once at their call site (e.g. `extraer` sets `task: "extraccion.idea_matriz"`), which is *inside the @obs package boundary they already own*, not a change to business logic flow.

**When to use:** always — this is how per-product/task tiering is expressed. Simple tasks (routing) get `[granite]`; classification gets `[granite]` + Phi judge, escalating to DeepSeek; extraction stays `[deepseek]` where the benchmark confirms it; adjudication gets `[minimax]` + optional Phi *second opinion* (never a Phi-first responder).

**Trade-offs:**
- Pro: adding/reordering rungs for a task = edit config, redeploy, zero code change (mirrors the existing FND-06 "cambiar de modelo = cambiar config" principle already stated in `config.ts`).
- Pro: fallback when `task` is absent → a default ladder that reproduces today's `criticality`-based routing (`critical→minimax`, `bulk→deepseek`) so unmigrated call sites behave identically.
- Con: `task` string is stringly-typed; mitigate with a `TaskId` union + a zod enum so an unknown task fails loudly rather than silently taking the default.

**Example:**
```typescript
// packages/llm/src/task-ladder.ts
export type TaskId =
  | "adjudicacion.parlamentario" | "adjudicacion.entidad"
  | "extraccion.idea_matriz" | "clasificacion.sector"
  | "agenda.tabla" | "routing.simple";

export interface TaskLadder {
  task: TaskId;
  responders: LLMProvider[];        // ordered lowest-cost → escalation
  judge?: JudgeProvider;
  onExhausted: <T>(last: { answer: T; verdict: Verdict } | undefined,
                   req: CompletionRequest) => T;
}
// The ladder for each task is what the benchmark harness FILLS IN, per evidence.
```

### Pattern 3: Judge as a separate `JudgeProvider` interface (not `LLMProvider`)

**What (answer to c):** the judge is a distinct interface because its shape is different — it does not *produce* a `T`, it *rates* one. It also does not need `<T>`-generic `complete`; it needs the request, the candidate answer, and (optionally) the schema for context.

**When to use:** on any ladder rung where the benchmark shows a small responder is *usually* right but needs a cheap gate before trusting it; and as a **read-only second opinion** on critical tasks.

**Trade-offs:**
- Pro: keeps `LLMProvider` clean; the judge can be backed by any model (Phi-4-mini today) via its own OpenAI-compat adapter, reusing `zodToToolSchema` + `parseAndValidate` to force a structured verdict.
- Pro: verdicts are structured and zod-validated → directly recordable for audit/benchmark feedback (see telemetry).
- Con: a judge is itself an LLM call — it has a false-accept / false-reject rate. Therefore the judge's own accuracy is a *benchmarked quantity* on the "juez/validación" golden set before it gates anything. Never let an unbenchmarked judge decide escalation.

**Example:**
```typescript
// packages/llm/src/judge.ts
export interface Verdict {
  ok: boolean;                 // true = accept the candidate answer
  reason: string;              // why (recorded for audit)
  confidence: number;          // [0,1]
}
export interface JudgeProvider {
  readonly id: string;
  readonly trainsOnInputs: boolean;   // subject to the SAME data-routing gate
  judge<T>(req: CompletionRequest, candidate: T, schema: ZodType<T>): Promise<Verdict>;
}
```
The Phi judge implementation runs the SAME fail-closed gates before its call:
`assertNoRutInLlmInput(serialize(candidate))` + `assertSensitivityAllowed(req, this)` — a judge that trains on inputs must never see personal data, exactly like a responder.

---

## Data Flow

### Non-critical task (e.g. classification) — respond → validate → escalate

```
consumer.complete({ task:"clasificacion.sector", user, criticality:"bulk", sensitivity:"public" }, SectorSchema)
   ↓
TieredProvider.complete → ladder = [granite, deepseek], judge = phi
   ↓
granite.complete(req, SectorSchema)         → validated Sector  (gates+repair inside)
   ↓
phi.judge(req, sector, SectorSchema)        → Verdict{ok:false, "sector too broad", 0.4}
   ↓  telemetry.record({rung:granite, verdict:reject, latency, cost, escalated:true})
deepseek.complete(req, SectorSchema)        → validated Sector
   ↓
phi.judge(...)                              → Verdict{ok:true, …, 0.9}
   ↓  telemetry.record({rung:deepseek, verdict:accept, escalated:false})
return sector    (DeepSeek used only because Granite's answer was judged insufficient)
```

### Critical task (adjudication) — MUST NOT degrade (answer to d)

The adjudication ladder is **MiniMax-as-responder, Phi-as-read-only-second-opinion**, and the escalation direction is *toward more human review, never toward auto-accepting a small model*:

```
correrPipeline → provider.complete({ task:"adjudicacion.parlamentario", criticality:"critical",
                                     sensitivity:"personal", temperature:0 }, AdjudicacionSchema)
   ↓
TieredProvider → ladder.responders = [minimax]   (Phi is NOT a responder here)
   ↓
minimax.complete(...) → validated Adjudicacion    (unchanged behavior)
   ↓
phi.judge(req, adjudicacion, AdjudicacionSchema)  → Verdict recorded ONLY
   ↓  telemetry.record({task:adjudicacion, responder:minimax, judge_verdict, …})
return adjudicacion   ← the AUTHORITATIVE answer is ALWAYS MiniMax's
   ↓
aplicarCompuerta(adjudicacion, …)  ← existing fail-closed gate, UNCHANGED, still decides
```

**The compuerta (`compuerta.ts:UMBRAL=0.9`, strict `<`) remains the sole authority for auto-accept vs revision.** The Phi verdict is *observed and recorded* but does not (in phase 1) alter the compuerta decision. A future, benchmark-earned enhancement could route "MiniMax-accepted BUT Phi-disagreed" cases to human revision — i.e. Phi can only ever make the gate *stricter*, never looser. This preserves the LOCKED rule "ante la duda, SIEMPRE calidad" and the golden-1263 CI gate.

### `fichas` prompt-cache: what changes vs stays (answer to d)

- **Stays:** `SYSTEM_EXTRACCION` is a stable prefix passed as `req.system`; DeepSeek puts system first (`deepseek.ts:72`) precisely for prompt-cache. As long as `extraccion.*` ladders keep DeepSeek as the responder for that task, **the prompt-cache assumption is untouched** — `TieredProvider` delegates the identical `req` to `DeepSeekProvider.complete`, which builds the identical messages array. The decorator adds nothing to the prompt.
- **Watch out:** if a benchmark ever routes extraction through Granite-first, the cache warms on a *different* model/endpoint and the DeepSeek cache benefit is only realized on escalation. Keep extraction single-rung (DeepSeek) unless the benchmark shows Granite parity on the fidelity golden set — and remember the fidelity gate is the golden set, not zod (`extraer.ts` docstring: zod can't catch a fluent hallucination).
- **Judge + cache:** if a judge is ever added to the extraction ladder, its call is a *separate* endpoint and does not perturb the DeepSeek cache.

---

## Telemetry (answer to f)

**Every `complete()` emits one `TelemetryEvent` per rung attempt** (so an escalated call emits ≥2 rows), plus one judge row per judge invocation. This is the substrate the benchmark loop consumes.

```typescript
// packages/llm/src/telemetry.ts
export interface TelemetryEvent {
  ts: string;                 // ISO
  task: TaskId | "default";
  rung: string;               // provider id used for THIS attempt
  role: "responder" | "judge";
  model: string;              // concrete model id (from ProviderConfig)
  latencyMs: number;
  promptTokens?: number; completionTokens?: number;   // from usage when the API returns it
  costUsd?: number;           // derived from tokens × per-model price table
  verdict?: { ok: boolean; reason: string; confidence: number };  // judge/responder outcome
  escalated: boolean;         // did the ladder move on after this rung?
  repairAttempts?: number;    // from the inner repair loop, if surfaced
  outcome: "accepted" | "rejected" | "exhausted" | "error";
}
export interface TelemetrySink { record(e: TelemetryEvent): void; }
```

- **Sink is pluggable** (mirrors the existing `FichasWriter` noop-vs-Supabase pattern in `pipeline-cli.ts`): a `JsonlSink` for local operator runs, a `SupabaseSink` (a new `llm_call_audit` table, service-role/zero-grant like `notificacion_envio`) for CI/LIVE aggregation. Default = noop, so telemetry can't break a run.
- **Never log the prompt or answer content** — this must mirror `LLMValidationError` (`validate.ts:23`: "el objeto solo lleva los issues zod; jamás incluye el prompt ni credenciales"). Telemetry records *metrics and verdict reason*, not payloads. This is both a secret-hygiene rule and a Ley-21.719 minimization rule (personal-data prompts must not be logged).
- **The benchmark loop** (`llm-bench`) reads aggregated telemetry to answer, per task: quality (vs golden), p50/p95 latency, cost, and escalation rate — which is exactly what SEED-001's "gate duro: paridad de calidad demostrada" needs.

---

## Anti-Patterns

### Anti-Pattern 1: Reviving `selectProvider`/router as the tiering seam
**What people do:** extend `RouterConfig.byCriticality` to a ladder and make consumers call `selectProvider`.
**Why it's wrong:** `selectProvider` is unused (grep-verified) and its model is a *single* provider per `Criticality` (2 values) — it can't express an ordered ladder, a judge, or an escalation policy. Wiring consumers to it means changing every call site to a path that doesn't exist today. It also splits selection logic (router) from execution (the cascade needs to run the calls), which the decorator unifies.
**Do this instead:** `TieredProvider implements LLMProvider`, injected at the existing instantiation sites. Leave the router dormant or delete it.

### Anti-Pattern 2: Judge or small-model rung that bypasses the fail-closed gates
**What people do:** call Granite/Phi through a bespoke fetch or a "lightweight" path that skips `assertNoRutInLlmInput`/`assertSensitivityAllowed`.
**Why it's wrong:** it re-opens the exact hole the adapters close by construction (`deepseek.ts:65`, `minimax.ts:69`). A RUT or personal document could reach a training-tier endpoint.
**Do this instead:** every rung is an `LLMProvider` (or a `JudgeProvider` with the same two asserts run before its call). The gates run inside `complete()`/`judge()`, before the network.

### Anti-Pattern 3: Letting a small model or a judge auto-accept a critical adjudication
**What people do:** put Phi/Granite first on the adjudication ladder, or let a Phi "ok" verdict upgrade a MiniMax result to `confirmado`.
**Why it's wrong:** violates SEED-001 ("adjudicación JAMÁS se degrada; Phi solo como segunda opinión") and the LOCKED rule "ante la duda, SIEMPRE calidad". The compuerta's strict `<` at 0.90 and golden-1263 are the existential-risk-#1 guardrails.
**Do this instead:** MiniMax stays the sole responder for `adjudicacion.*`; Phi is read-only/recorded; escalation for critical tasks points to *human revision*, never to auto-accept. A judge may only make the gate stricter.

### Anti-Pattern 4: Benchmark-free tiering
**What people do:** ship a Granite-first ladder because it's cheaper.
**Why it's wrong:** SEED-001 gate: "NADA se integra sin paridad de calidad demostrada en el golden set de su tarea." Precedent: golden 32 (búsqueda), golden 1263 (identidad).
**Do this instead:** the ladder config for a task is *written from* the benchmark verdict, and the per-task golden set becomes a CI regression gate before that ladder goes live.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Granite-4.0-H-Micro | OpenAI-compat `baseURL` (OpenRouter / self-host vLLM / Docker `ai/granite-4.0-micro`); 3B, **native tool-calling** | Reuse the MiniMax adapter shape: tool-calling forced + `zodToToolSchema` + `parseAndValidate`. `response_format: json_schema` NOT assumed (project rule). MEDIUM/HIGH: tool-calling confirmed by IBM model card + OpenRouter. |
| Phi-4-mini-instruct | OpenAI-compat `baseURL` (OpenRouter / Puter / self-host); 3.8B, 128K ctx | Judge adapter. Force a structured `Verdict` via tool-calling + zod. Benchmark its judge accuracy on the "juez" golden set before it gates anything. |
| DeepSeek / MiniMax | Existing adapters, unchanged | `TieredProvider` delegates to them. |
| Supabase (`llm_call_audit`) | New table, service-role / zero-grant (pattern of `notificacion_envio`, migration >0072) | Telemetry sink for CI/LIVE. No PII in rows. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| consumer ↔ `@obs/llm` | DI of `LLMProvider` (unchanged) | Only the *constructed object* at the CLI changes: `new DeepSeekProvider` → `new TieredProvider(ladders, sink)`. Bodies of `extraer`/`correrPipeline`/etc. untouched. |
| `TieredProvider` ↔ rung providers | `LLMProvider.complete` | Gates + repair enforced inside each rung. |
| `TieredProvider` ↔ judge | `JudgeProvider.judge` | Separate interface; same fail-closed asserts. |
| `TieredProvider` ↔ telemetry | `TelemetrySink.record` | Pluggable; noop default; never logs payloads. |
| `CompletionRequest.task` | additive optional field | Backward-compatible; absent `task` → default ladder = today's `criticality` routing. |

---

## Suggested Build Order (answer to e — dependency-aware)

1. **Benchmark harness first (`packages/llm-bench`).** Golden sets per task (routing, clasificación, juez, extracción) + a runner that drives *any* `LLMProvider` and records quality/latency/cost. Depends on nothing new; it can score today's DeepSeek/MiniMax to establish baselines. This is the SEED-001 gate and the source of every ladder decision. Add the Granite/Phi adapters (step 2) as *candidates* the harness can score.
2. **`GraniteProvider` + `PhiJudge` adapters** (as harness candidates). Copy the MiniMax adapter shape (tool-calling + `zodToToolSchema` + `parseAndValidate` + the two fail-closed asserts). Cheap, isolated, no consumer impact. Needed by the harness in step 1 to produce evidence.
3. **Telemetry (`telemetry.ts` + noop sink).** Pure, no deps; unblocks observability for both the harness and the runtime tier. Add `SupabaseSink` + `llm_call_audit` migration when LIVE aggregation is needed.
4. **`TaskLadderConfig` + `CompletionRequest.task` additive field.** Config scaffolding with a default ladder that reproduces today's behavior (so nothing changes until a task opts in). Unit-testable without any model.
5. **`TieredProvider`.** Compose steps 2–4. Test with mock rungs + mock judge (the codebase already has `MockProvider` patterns in `fichas/src/mock-provider.ts` and `adjudication/src/mock-provider.ts`). Prove escalation + telemetry + fail-closed-on-exhaust behavior deterministically.
6. **Integrate the LOWEST-RISK task first.** Per SEED-001: pick a `bulk`/`public` task where a wrong answer is cheap and reversible — **`agenda.tabla` (agenda-PDF extraction) or `clasificacion.sector`**, NOT extraction-of-idea-matriz (feeds search) and NEVER adjudication first. Swap that one CLI's `new DeepSeekProvider(...)` → `new TieredProvider(...)`, gate its ladder behind the task's golden set in CI. Measure with telemetry.
7. **Widen by evidence.** Extraction stays DeepSeek until the fidelity golden set shows parity. Adjudication gets Phi as *recorded second opinion only* (no behavior change) last, behind golden-1263 staying green.

**Dependency summary:** harness (1) unblocks every decision; adapters (2) feed the harness; telemetry (3) and config (4) are independent leaves; `TieredProvider` (5) needs 2+3+4; consumer integration (6) needs 5 + a green per-task golden gate. Critical-task changes are strictly last.

---

## Sources

- `packages/llm/src/types.ts`, `router.ts`, `config.ts`, `validate.ts`, `data-routing.ts`, `json-schema.ts`, `providers/deepseek.ts`, `providers/minimax.ts` — the actual `LLMProvider` contract, gates, compuerta, and adapter shape — HIGH (read directly)
- `packages/fichas/src/extraer.ts` / `pipeline-cli.ts:191`, `packages/adjudication/src/pipeline.ts` + `compuerta.ts` (UMBRAL 0.9 strict `<`) + `golden/golden-set.ts` — consumer call patterns, DI, critical-task fail-closed gate — HIGH (read directly)
- Grep of `packages/**` + `apps/**`: `selectProvider`/`loadRouterConfigFromEnv` unused in prod; consumers hard-`new` concrete providers — HIGH (verified)
- `.planning/PROJECT.md` (v11.0 milestone), `.planning/seeds/SEED-001-*.md` — scope, LOCKED rules, benchmark gate precedent (golden 32 / 1263) — HIGH
- [ibm-granite/granite-4.0-h-micro — Hugging Face](https://huggingface.co/ibm-granite/granite-4.0-h-micro) / [Granite 4.0 Micro — OpenRouter](https://openrouter.ai/ibm-granite/granite-4.0-h-micro) — 3B, native tool-calling, OpenAI-compat endpoint — MEDIUM/HIGH
- [Phi-4-mini-instruct — OpenRouter](https://openrouter.ai/microsoft/phi-4-mini-instruct) / [Phi-4-mini — Puter](https://developer.puter.com/ai/microsoft/phi-4-mini-instruct/) — 3.8B, 128K ctx, OpenAI-compat endpoint — MEDIUM/HIGH

---
*Architecture research for: tiered LLM layer over pluggable LLMProvider*
*Researched: 2026-07-26*
