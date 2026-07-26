# Project Research Summary

**Project:** Observatorio del Congreso 360 -- v11.0 (tiered LLM layer, SEED-001 + deuda viva)
**Domain:** Tiered LLM cascade (respond->validate->escalate / model-routing / LLM-as-judge) over an existing pluggable `LLMProvider` in a Spanish-legal civic-accountability pipeline
**Researched:** 2026-07-26
**Confidence:** HIGH (stack IDs/licenses/architecture verified against code + official model cards; benchmark-safety framing grounded in 2024-2026 cascade/judge literature)

## Executive Summary

v11.0 adds two small models -- **IBM Granite-4.0-H-Micro** (3B, Apache-2.0, tool-calling responder for routing/classification) and **Microsoft Phi-4-mini-instruct** (3.84B, MIT, judge/validator) -- as new rungs on the existing `packages/llm` `LLMProvider` layer. The stack fit is trivial: both are OpenAI-compatible via `baseURL`, so there is **zero new SDK and zero new architecture** -- they slot into the current `openai@5` multi-provider pattern exactly like DeepSeek/MiniMax, hosted on **OpenRouter** (single key, both models) with **Ollama** for the free local golden-set benchmark rig. What is actually being built is a `TieredProvider` decorator that `implements LLMProvider` (a drop-in at each consumer's CLI instantiation site -- bodies unchanged), a separate `JudgeProvider` interface for Phi, a task-keyed ladder config, a telemetry sink, and a **new `packages/llm-bench` benchmark harness** that is the true first deliverable.

The recommended approach inverts the industry default: this is **quality-parity-ONLY tiering**, not cost-first. The operator rule is LOCKED -- *"ante la duda, SIEMPRE calidad"* -- so cost/latency is a *side-effect* of proven parity, never a goal. Nothing integrates for any task until that task's Spanish-corpus golden set proves parity (the golden-32 / golden-1263 CI-gate precedent). The safe tasks are reasoning/decision tasks with small output spaces (routing, classification, judging); the risky task is strict-structured generation (extraction), where 3B models hit near-zero schema accuracy and must stay on DeepSeek. Identity adjudication (MiniMax, golden-1263 >=0.95) is **off-limits** -- Phi may only ever be an additive second opinion that *escalates to human review*, never a replacement or a downgrade.

The dominant risk is **silent quality degradation that a green CI does not catch**: a cheaper model that passes the small golden set but is worse on the live Chilean-Spanish legal distribution produces a *false, credible published claim* (riesgo existencial #1) -- a legal event, not a latency blip. Mitigation is baked into the phase structure: the benchmark must measure quality **and** latency **and** cost **and** zod-schema-failure-rate on a stratified live-distribution, Spanish-only, fidelity/negation-weighted eval against the *exact production endpoint* (quantization pinned); a weak judge may only raise the tier; escalation must be calibrated and bounded; and every new provider must pass the shared zod + PII-redaction guard as a first commit.

## Key Findings

### Recommended Stack

Both new models fit the LOCKED stack rule (one `openai@5` SDK, multi-provider by `baseURL`) with no additions. The real decision is *hosting*: OpenRouter as the single production/benchmark endpoint (cheapest Granite, both models, one key) + Ollama local for repeatable free golden-set runs, with DeepInfra held as a pure `baseURL`-swap cost fallback. The one type-level change is extending `Criticality`/`CompletionRequest` with a `task` axis so the router maps task->rung. See STACK.md.

**Core technologies:**
- **IBM Granite-4.0-H-Micro** (`ibm-granite/granite-4.0-h-micro`): responder rung for routing/classification -- 3B hybrid Mamba, Apache-2.0, fine-tuned for OpenAI-schema tool-calling (but BFCL only 57.6% -> zod-guard hard).
- **Phi-4-mini-instruct** (`microsoft/phi-4-mini-instruct`): judge/validator rung -- 3.84B, MIT, post-trained for function-calling (caveat: documented to hallucinate function names -> match tool_call by name, never position).
- **openai@5 SDK + zod + `zodToToolSchema`** (all already in-repo): unchanged -- the tool-calling-forced + external-zod-gate + repair-loop pattern from `MiniMaxProvider` is the template for both new adapters. **Never assume `response_format: json_schema`.**
- **OpenRouter + Ollama**: single hosted endpoint + free local benchmark rig.

### Expected Features

The safe/risky task taxonomy drives everything: tier the reasoning/decision tasks (routing, classification, judging), protect the strict-structured-generation task (extraction). See FEATURES.md.

**Must have (table stakes):**
- Eval harness measuring quality (vs golden) + p50/p95 latency + cost/1k + **zod-fail-rate** -- omitting the last metric over-recommends small models.
- Per-task Spanish golden sets (routing, classification, judge) + hard CI parity gate (`parity_delta <= epsilon`).
- `baseURL`-swap over existing `LLMProvider`; respond->validate->escalate cascade with escalation on *judge-verdict*, not self-confidence.
- Separation of generation and judge models (different family -- Granite responds, Phi judges); deterministic (temp~=0) judge.

**Should have (competitive / project-specific):**
- **Quality-parity-ONLY tiering** (never cost-first) -- the differentiator encoding "SIEMPRE calidad."
- Gradual per-task rollout starting at the lowest-risk task; judge-as-second-opinion that can only *raise* human-review; static-rule router before any learned router; provenance-of-model-choice per record.

**Defer (v2+):**
- Judge-as-second-opinion on identity adjudication (touches the most critical subsystem -- last or never, additive-only).
- Learned/semantic router; small-model fine-tuning for structured output (contradicts the plug-in thesis -- avoid).

### Architecture Approach

The cascade is a new `TieredProvider` class that `implements LLMProvider` (decorator/composition), injected at consumers' existing CLI instantiation sites -- because every consumer is already DI'd on the `LLMProvider` interface, this is a one-line drop-in per consumer with **zero business-logic change**. It is NOT the dormant `selectProvider`/router (dead code, can't express a ladder) and NOT a bespoke path (would bypass the fail-closed PII/sensitivity gates that live *inside* each adapter). The fail-closed gates and zod repair loop are enforced automatically *because* every rung is an `LLMProvider`. See ARCHITECTURE.md.

**Major components:**
1. **`TieredProvider` (`tiered.ts`)** -- the cascade; reads a task ladder, runs respond->judge->escalate, emits telemetry, returns a zod-validated `T`.
2. **`GraniteProvider` + `PhiJudge`** -- new responder rung (tool-calling + zod, MiniMax template) + judge rung on a *separate* `JudgeProvider` interface (rates an answer, returns `Verdict{ok, reason, confidence}`; runs the same fail-closed asserts).
3. **`TaskLadderConfig` + additive `CompletionRequest.task`** -- config map `task -> {responders[], judge?, onExhausted}`; absent `task` -> default ladder = today's `criticality` routing (backward-compatible).
4. **Telemetry sink + `packages/llm-bench`** -- per-rung `TelemetryEvent` (metrics + verdict only, **never payloads**); benchmark harness kept OUT of the runtime lib.

### Critical Pitfalls

1. **Silent quality regression on the live distribution** (riesgo existencial #1) -- a model passes golden-32/1263 but degrades on scanned PDFs / archaic legal formulae -> *false published claim*. Avoid: expand each golden set to a **stratified live-distribution sample**, add **shadow evaluation** (parallel-run vs incumbent, diff, human-review disagreements), report live disagreement-rate -- not just golden accuracy.
2. **Judge weaker than the responder (validation theater)** -- a 3B judge can't detect errors above its ceiling; it rubber-stamps exactly the outputs that need escalation. Avoid: judge power is **escalate-only, never suppress**; measure judge vs **human** labels (not vs the responder); judge agreement never short-circuits the existing zod/golden gate.
3. **Spanish (es-CL legal register) + quantization gap** -- both models are English-primary; hosted endpoints may silently serve Q4 (multilingual breaks first). Avoid: benchmark **exclusively on the real Chilean-Spanish corpus** with fidelity/negation metrics, and **against the exact prod endpoint/quantization** (pin + drift canary). Any Spanish shortfall = hard veto for that task.
4. **Cascade adds latency/cost + breaks DeepSeek prompt-cache** -- escalation-heavy tasks pay small+judge+big sequentially; routing mid-extraction invalidates the cached prefix (12x write cost). Avoid: adopt tiering only where the expected-cost math beats single-big-model; keep extraction single-family DeepSeek; **route between pipelines, never mid-session**; monitor `prompt_cache_hit_tokens`.
5. **Degrading the adjudication path + PII/escalation-loop exposure** -- small responder anywhere in adjudication, or a new tier bypassing the "RUT never crosses" guard, or unbounded escalation on a public repo (cost DoS). Avoid: adjudication pinned to MiniMax (explicit non-goal + guard, golden-1263 >=0.95 unchanged); shared zod+PII-redaction wrapper enforced by a biting CI guard enumerating all providers; bounded escalation (1 hop/tier, global call budget, terminal human-review state).

## Implications for Roadmap

Research is emphatic on ordering: **the benchmark harness is the true first deliverable and the gate for every subsequent decision.** Nothing tiers until its task's Spanish golden set passes. Critical-task changes come strictly last (or never). Suggested phase structure:

### Phase 1: Benchmark harness + candidate adapters (the SPIKE / SEED-001 gate)
**Rationale:** ARCHITECTURE build-order fact -- the harness depends on nothing new, can baseline today's DeepSeek/MiniMax, and is the source of every ladder decision. FEATURES: "the spike is the true first deliverable." It carries the majority of critical pitfalls as *measured deliverables*.
**Delivers:** `packages/llm-bench` (harness + metrics); `GraniteProvider` + `PhiJudge` adapters (MiniMax tool-calling template + fail-closed asserts) as scored candidates; per-task **Spanish** golden sets (routing, classification, judge, extraction-parity-check) stratified over the live distribution; a metrics suite reporting **separately**: schema-parse-rate, field-value accuracy, p50/p95 latency, cost/1k, zod-fail/retry rate, judge-vs-human conditional accuracy, calibration/reliability curves, constraint-adherence (literal-only/anti-causal), expected end-to-end cost/latency vs single-big-model.
**Addresses:** eval harness, per-task golden sets, parity gate (FEATURES P1).
**Avoids:** Pitfalls 1 (stratified + shadow), 2 (judge vs human), 3 (Spanish + quantization pin), 4 (schema vs value; apples-to-apples mode), 6 (calibration curves), 7 (expected-cost math), 8, 9, 13 (constraint-adherence) -- all *measured* here. CI guards for golden-set/exemplar pool disjointness (Pitfall 3).

### Phase 2: Cascade plumbing -- `TieredProvider` + ladder config + telemetry
**Rationale:** ARCHITECTURE steps 3-5 -- telemetry and `TaskLadderConfig` are independent leaves; `TieredProvider` composes them plus the Phase-1 adapters. Testable deterministically with existing `MockProvider` patterns before any live task.
**Delivers:** `telemetry.ts` (+ noop default, JSONL sink); `task-ladder.ts` + additive `CompletionRequest.task` (default ladder reproduces today's behavior); `TieredProvider` (respond->judge->escalate, bounded, fail-closed-on-exhaust).
**Uses:** `openai@5`, `zodToToolSchema`, `parseAndValidate` (STACK -- all existing).
**Implements:** `TieredProvider` decorator, `JudgeProvider` interface, telemetry sink (ARCHITECTURE components).
**Avoids:** Pitfall 10 (bounded escalation: 1 hop/tier, global call budget, terminal human-review state) built in from the start.

### Phase 3: Integrate the LOWEST-RISK task behind a green golden gate + provider guards
**Rationale:** SEED-001 + FEATURES gradual-rollout: prove the pattern on something reversible and non-legal first. ARCHITECTURE names `agenda.tabla` or `clasificacion.sector` -- NOT idea-matriz extraction, NEVER adjudication.
**Delivers:** one CLI's `new DeepSeekProvider(...)` -> `new TieredProvider(...)`; that task's golden set as a hard CI regression gate; shadow evaluation kept ON before promotion; the **provider-wrapper guard as the FIRST commit** (CI fails if any registered provider lacks the shared zod+PII-redaction wrapper); calibrated per-task escalation threshold (over-escalation bias); DeepSeek `prompt_cache_hit` monitoring + endpoint-drift canary; optional `SupabaseSink` + `llm_call_audit` table (service-role/zero-grant, no PII).
**Addresses:** one lowest-risk integration (FEATURES P1); provenance-of-model-choice (P2).
**Avoids:** Pitfalls 5 (adjudication untouched; PII guard first), 11 (route between pipelines; cache monitor), 12 (biting provider guard), 6 (calibrated router), 9 (drift canary).

### Phase 4 (defer, evidence-gated): widen by proven parity
**Rationale:** FEATURES "add after validation" + ARCHITECTURE step 7. Extraction stays DeepSeek until the fidelity golden set shows parity (unlikely at 3B). Adjudication gets Phi as *recorded second opinion only* (no behavior change) LAST, behind golden-1263 staying green -- Phi can only make the compuerta *stricter*, never looser.
**Delivers:** respond->validate->escalate wired for the second validated task; judge-as-second-opinion on extraction fidelity (flag-for-review only); (much later, guarded) additive judge on adjudication.
**Avoids:** Pitfalls 5 (adjudication authority stays MiniMax), 7 (extraction stays single-model unless parity proven).

### Phase Ordering Rationale
- **Dependency:** the harness (1) unblocks every decision; adapters feed it; plumbing (2) needs the adapters + telemetry + config; integration (3) needs plumbing + a green per-task golden gate. This mirrors v9.0's "golden congelado ANTES del schema."
- **Risk-ascending:** lowest-risk reversible task first (3); dense extraction and identity adjudication -- the existential-risk subsystems -- strictly last or never (4), as explicit non-goals/guards, not features.
- **Pitfall-driven:** the SPIKE front-loads all the *measurement* pitfalls (silent degradation, weak judge, Spanish/quantization, cost math); the integration phase front-loads the *guard* pitfalls (PII wrapper, bounded escalation, cache, drift) as first-commit guards in the repo's "guard that bites" culture.

### Research Flags

Phases likely needing deeper research (`/gsd:plan-phase --research-phase`) during planning:
- **Phase 1 (SPIKE):** the load-bearing phase. Needs run-time verification of exact OpenRouter model capability flags (does `response_format`/tool-calling actually pass through per underlying provider?), the host's **quantization level + DPA/no-train posture** (legal gate for `trainsOnInputs`), and calibration methodology (isotonic/Platt on held-out es-CL labels). Pricing is MEDIUM-confidence and moves fast.
- **Phase 4 (adjudication second-opinion):** touches riesgo existencial #1 -- needs explicit legal/operator sign-off and additive-only guard design before any code.

Phases with standard patterns (skip research-phase):
- **Phase 2 (plumbing):** the decorator/DI pattern is fully specified against real code in ARCHITECTURE; `MockProvider` test patterns already exist. Well-documented, established.
- **Phase 3 (lowest-risk integration):** one-line consumer swap + CI-gate + guard, all patterned on existing v9.0/v10.0 lockdown-guard-as-first-commit precedent.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Model IDs, licenses (Apache-2.0 / MIT), context windows, OpenAI-compat verified against HF/OpenRouter/IBM/Microsoft official pages. Pricing MEDIUM (hosting landscape moves fast); quantization level per host is an unverified variable -> Phase-1 deliverable. |
| Features | HIGH | Task-safety taxonomy consistent across leanlm/truefoundry + FrugalGPT + peer-reviewed judge study; Granite/Phi profiles from official model cards. Spanish-corpus parity is unproven-by-design (that's what the spike measures). |
| Architecture | HIGH | Every claim anchored to a real signature in `packages/llm/src` or a real call site; router-is-dead-code and consumers-DI'd-on-interface grep-verified. |
| Pitfalls | HIGH | Grounded in arXiv 2024-2026 cascade/judge/quantization literature + model cards; model-specific Spanish numbers are MEDIUM (inferred). |

**Overall confidence:** HIGH

### Gaps to Address
- **Exact prod endpoint quantization + DPA/no-train posture** (OpenRouter forwards to underlying providers): a legal fail-closed gate for `trainsOnInputs`, not a convenience flag. Verify per host *before* any real corpus touches it; Ollama-local is trivially non-training. Handle in Phase 1 + operator/legal gate.
- **Spanish (es-CL legal) parity is unproven** -- the entire go/no-go rests on the spike's Spanish-corpus fidelity/negation eval. English benchmarks are irrelevant and must not influence the decision. Handle as the Phase-1 hard veto.
- **Pricing drift** -- MEDIUM confidence; re-verify at run time; DeepInfra fallback is a pure `baseURL` swap if OpenRouter markup matters at scale.
- **Judge accuracy on hard cases** -- a small judge is "good enough for routine validation," not authoritative; its own accuracy is a benchmarked quantity on the "juez" golden set before it gates anything.

## Sources

### Primary (HIGH confidence)
- In-repo `packages/llm/src/{types,router,config,validate,data-routing,json-schema}.ts` + `providers/{deepseek,minimax}.ts`; `fichas`/`adjudication` consumer call sites + `compuerta.ts` (UMBRAL 0.9) -- the exact integration target, contract, fail-closed gates, DI pattern (read/grep-verified).
- [ibm-granite/granite-4.0-h-micro -- Hugging Face](https://huggingface.co/ibm-granite/granite-4.0-h-micro) / [Granite 4.0 -- IBM docs](https://www.ibm.com/granite/docs/models/granite) -- 3B, Apache-2.0, hybrid Mamba, tool-calling, IFEval 84.3% / BFCL 57.6%, Spanish caveat.
- [microsoft/Phi-4-mini-instruct -- Hugging Face](https://huggingface.co/microsoft/Phi-4-mini-instruct) / [Phi-4-Mini Technical Report -- arXiv 2503.01743](https://arxiv.org/pdf/2503.01743) -- MIT, 3.84B, function-calling, function-name hallucination, English-primary training.
- [Phi-4 as an LLM Evaluator -- Flow AI](https://flow-ai.com/blog/phi-4-as-llm-evaluator) / [LLM-as-a-judge -- Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge) -- separate gen/eval models, no self-eval, low temp, bias mitigation.
- [FrugalGPT -- EmergentMind](https://www.emergentmind.com/topics/frugalgpt) -- cascade pattern, 50-98% savings when the small tier resolves the majority.
- [Is Escalation Worth It? -- arXiv 2605.06350](https://arxiv.org/html/2605.06350) / [UCCI -- arXiv 2605.18796](https://arxiv.org/abs/2605.18796) -- accuracy-gap requirement; calibration > threshold tuning.
- [When Correct Isn't Usable: Structured Output in Small LMs -- arXiv 2605.02363](https://arxiv.org/pdf/2605.02363) -- 3B near-zero schema accuracy via direct prompting.
- [Structured Output Benchmarks are Riddled with Mistakes -- Cleanlab](https://cleanlab.ai/blog/structured-output-benchmark/) -- schema-valid vs field-value accuracy must be separated.
- [Benchmark Data Contamination -- arXiv 2406.04244](https://arxiv.org/html/2406.04244v1) / [Leakage of Eval Datasets -- arXiv 2407.07565](https://arxiv.org/pdf/2407.07565) -- overfit-to-eval; separate exemplar/eval pools.
- [DeepSeek Context Caching -- DeepSeek API Docs](https://api-docs.deepseek.com/news/news0802/) -- cache-hit pricing, route between pipelines.
- [OpenRouter Structured Outputs docs](https://openrouter.ai/docs/guides/features/structured-outputs) -- enforcement varies by underlying provider.

### Secondary (MEDIUM confidence)
- [Granite 4.0 Micro -- OpenRouter](https://openrouter.ai/ibm-granite/granite-4.0-h-micro) / [Phi-4-mini -- OpenRouter](https://openrouter.ai/microsoft/phi-4-mini-instruct) -- model IDs HIGH, pricing MEDIUM (~$0.017/$0.112 Granite, ~$0.08/$0.35 Phi).
- [Phi-4 providers -- Artificial Analysis](https://artificialanalysis.ai/models/phi-4/providers) -- DeepInfra cheapest blended, Azure pricier.
- [LLM Model Routing -- leanlm.ai](https://leanlm.ai/blog/llm-model-routing) / [TrueFoundry](https://www.truefoundry.com/blog/llm-routing-cost-quality-aware-model-selection) -- classification/yes-no/extraction fine on small models; static-rule router.
- [SLMJury -- arXiv 2606.07810](https://arxiv.org/html/2606.07810) / [Meta Ranking -- arXiv 2402.12146](https://arxiv.org/pdf/2402.12146) -- small-judge limits; weak-judge caveats.
- [Cascade Failure under Adversarial Attack -- arXiv 2605.17288](https://arxiv.org/html/2605.17288) -- escalation cost-DoS on public repos.
- [Quantization Q4-Q8 quality loss 2026 -- runaihome](https://runaihome.com/blog/quantization-q4-q5-q6-q8-quality-loss-2026/) -- multilingual first to break, ~15-20% non-English drop.
- [Ollama: phi4-mini / granite4:micro-h](https://ollama.com/library/phi4-mini) -- local pull tags, partial OpenAI `/v1` surface.

### Tertiary (LOW confidence)
- Small-model availability on DeepInfra/Together -- churny; verify catalog at run time before any `baseURL` swap.

---
*Research completed: 2026-07-26*
*Ready for roadmap: yes*
