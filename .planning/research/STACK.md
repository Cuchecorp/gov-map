# Stack Research

**Domain:** v11.0 — Tiered LLM layer (respond→validate→escalate) — adding two small models as new rungs to the existing pluggable `LLMProvider` layer (`packages/llm`, `openai@5` multi-provider by `baseURL`)
**Researched:** 2026-07-26
**Confidence:** HIGH (model specs, licensing, IDs verified against HF/OpenRouter/IBM/Microsoft official pages; pricing MEDIUM — hosting landscape moves fast)

## TL;DR for the roadmap

The two new models fit the existing stack with **zero new SDKs and zero new architecture**. Both are OpenAI-compatible via `baseURL` and slot into the current `openai@5` + `LLMProvider` pattern exactly like DeepSeek/MiniMax. What you actually add is: (1) **one hosting account** (OpenRouter, single key, both models — recommended primary) plus **Ollama** for a zero-cost local benchmark rig; (2) **two new `ProviderConfig` entries** in `config.ts`; (3) possibly **two thin adapter classes** (or one generic OpenAI-compat tool-calling adapter) that pick the right structured-output strategy per host. Nothing else.

The hard rule of this stack still holds and is the ONLY real risk: **never assume `response_format: json_schema` is honored end-to-end.** For Granite/Phi on OpenRouter/DeepInfra/Ollama, tool-calling is the safe structured-output path (Granite is fine-tuned for it; Phi supports it but is documented to hallucinate function names — so keep the existing external zod gate + repair loop, and prefer `tool_choice`-forced single-function exactly like the current `MiniMaxProvider`).

## Recommended Stack

### Core Technologies (NEW — the two model rungs)

| Technology | Version / Model ID | Purpose | Why Recommended |
|------------|--------------------|---------|-----------------|
| **IBM Granite-4.0-H-Micro** | `ibm-granite/granite-4.0-h-micro` (OpenRouter) · `granite4:micro-h` (Ollama) · `ibm-granite/granite-4.0-micro` = dense variant (HF weights) | Router / triage, simple Q&A, classification (low-risk, high-volume rung) | 3B params, **Apache 2.0** (clean commercial license, ISO 42001 certified, cryptographically signed). Hybrid Mamba-2/transformer (**4 attention / 36 Mamba2** layers) → low memory + fast → strong latency class for the "cheap first responder" rung. **Fine-tuned for long-context tool calling** (OpenAI function schema) → structured output is first-class. 128K–131K context. |
| **Microsoft Phi-4-mini-instruct** | `microsoft/phi-4-mini-instruct` (OpenRouter) · `phi4-mini` (Ollama) · `microsoft/Phi-4-mini-instruct` (HF weights) | Judge / validator rung (second-opinion on other models' outputs) | 3.84B params, **MIT license** (maximally permissive). Post-trained specifically for instruction-following + function calling; strong reasoning-per-parameter (ties larger models on ARC-Challenge). 128K/131K context. Ideal as a cheap, fast "did the first answer satisfy the schema/task?" checker. **Caveat: documented to sometimes hallucinate function names/URLs in tool-calling** → validate hard. |
| **openai (SDK)** | `npm:openai@5` (already installed) | Same client for both new models via `baseURL` | The stack rule is LOCKED: one SDK, multi-provider by `baseURL`. Both new models are exposed OpenAI-compatible on every recommended host. **No new SDK is added.** |

### Hosting / Inference Options (the real decision)

Ranked by fit for this project (single `.env` key discipline, cheap/free tiers, OpenAI-compat, both models under one account).

| Host | Serves both models? | OpenAI-compat endpoint | Pricing (per 1M tok, in/out) | Free tier | Recommendation |
|------|--------------------|-----------------------|------------------------------|-----------|----------------|
| **OpenRouter** (PRIMARY) | ✅ Both. `ibm-granite/granite-4.0-h-micro` + `microsoft/phi-4-mini-instruct` | `https://openrouter.ai/api/v1` | Granite-H-Micro ≈ **$0.017 / $0.112**; Phi-4-mini ≈ **$0.08 / $0.35** | Small credit + `:free` variants on some models; pay-as-you-go, no minimum | **Use as the single hosted production/benchmark endpoint.** One key, both models, cheapest Granite price found, OpenAI-native tool-calling + `response_format` passthrough (capability-dependent per underlying provider — verify per model page). Least ceremony with the `baseURL` pattern. |
| **Ollama (local)** (BENCHMARK RIG) | ✅ Both. `ollama pull granite4:micro-h`, `ollama pull phi4-mini` | `http://localhost:11434/v1` | **Free** (your hardware) | N/A (local) | **Use for the SEED-001 golden-set benchmark spike and CI-free local iteration.** 3–4B models run on a laptop/modest GPU; zero marginal cost to run the golden set repeatedly per task. ⚠️ Ollama's `/v1` is a partial OpenAI surface — JSON-schema structured output, logprobs, some streaming differ; use tool-calling or `format:json` and keep the external zod gate. Measure *quality* here; re-measure *latency/cost* against OpenRouter before integrating. |
| **DeepInfra** | Phi: historically yes (usage-gated — a Phi multimodal variant was retired for low usage; verify `phi-4-mini-instruct` is live before committing). Granite: verify in catalog. | `https://api.deepinfra.com/v1/openai` | Cheapest blended Phi-4 provider (~$0.09 blended) per analyses | Small starting credit | **Secondary / cost-optimization fallback.** Cheapest at volume, OpenAI-compat, but small-model availability is churny — do not hard-depend. Pure `baseURL` swap target if OpenRouter markup matters at scale. |
| **Together AI** | Granite/Phi small-model availability **not confirmed** in current catalog searches | `https://api.together.xyz/v1` | Competitive, per-model | Starting credit | **Only if catalog confirms the exact model ID at run time.** Do not assume presence. |
| **IBM watsonx.ai** | Granite: ✅ first-party (canonical Granite host). Phi: no. | OpenAI-compat available on watsonx chat endpoints | Enterprise pricing | Trial | Consider **only** if you later want IBM's SLA/first-party Granite guarantees or an ISO-42001 provenance story for the legal dossier. Overkill for the benchmark spike. |
| **Azure AI Foundry** | Phi: ✅ first-party (Microsoft's canonical Phi host). Granite: via Foundry catalog partners, verify. | Azure OpenAI-style endpoint (Azure-specific auth + deployment names, not a plain `baseURL`+bearer) | Azure per-token (~$0.22 blended Phi-4, pricier) | Azure credits | **Not recommended for this project's `.env`+`baseURL` discipline.** Azure auth/deployment-name model breaks the clean `apiKey`+`baseURL` adapter shape. Skip unless an enterprise Azure mandate appears. |

**Decision: OpenRouter as the single hosted endpoint for both new models + Ollama for the local benchmark spike.** One production key, both models, cheapest Granite, OpenAI-native tool-calling — fewest moving parts for the pluggable layer. DeepInfra held as a cost fallback via a pure `baseURL` swap.

### Supporting Libraries (already present — NO additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **openai** | `npm:openai@5` | OpenAI-compatible client for both new hosts (OpenRouter/DeepInfra/Ollama) via `baseURL` | Every new provider adapter. Already the base of `DeepSeekProvider`/`MiniMaxProvider`. |
| **zod** | 3.x / 4.x | External validation gate on every structured output (`parseAndValidate`) | Unchanged. Applies identically to Granite/Phi outputs — the LOCKED "never trust the provider's schema enforcement" rule. |
| **`json-schema.ts` (`zodToToolSchema`)** | in-repo (`packages/llm/src/json-schema.ts`) | Derive tool `parameters` from a zod schema (single source of truth) for tool-calling structured output | Reuse verbatim for Granite/Phi tool-calling adapters — same as `MiniMaxProvider`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Ollama** | Local inference for the golden-set benchmark spike (SEED-001 step 1) | `ollama pull granite4:micro-h`; `ollama pull phi4-mini`. OpenAI-compat at `http://localhost:11434/v1`. Free, repeatable, no rate limits — ideal for running per-task golden sets many times. |
| **OpenRouter model pages** | Verify per-model structured-output + tool support at run time | OpenRouter auto-selects extraction strategy (jsonSchema → functionCalling → jsonMode fallback) and support **varies by underlying provider** — check the model page's capability flags before relying on `response_format: json_schema`. |

## Installation

```bash
# NO new packages. The openai SDK is already a dependency of @obs/llm.
# import OpenAI from "npm:openai@5";  // Deno edge — unchanged

# Local benchmark rig (SEED-001 spike):
#   ollama pull granite4:micro-h    # IBM Granite-4.0-H-Micro (hybrid, 3B)
#   ollama pull phi4-mini           # Microsoft Phi-4-mini-instruct (3.84B)
#   # OpenAI-compat: http://localhost:11434/v1

# .env additions (mirror the existing DEEPSEEK_*/MINIMAX_* pattern):
#   OPENROUTER_API_KEY=...
#   GRANITE_MODEL=ibm-granite/granite-4.0-h-micro
#   GRANITE_BASE_URL=https://openrouter.ai/api/v1
#   PHI_MODEL=microsoft/phi-4-mini-instruct
#   PHI_BASE_URL=https://openrouter.ai/api/v1
```

## Integration into the existing `LLMProvider` layer

The layer (`packages/llm/src/{types,config,router}.ts` + `providers/{deepseek,minimax}.ts`) already models exactly what SEED-001 needs. Concretely:

1. **`config.ts` — add two `ProviderConfig` entries** (swappable by env, literal defaults; keep `trainsOnInputs` NOT env-configurable — that compliance invariant is deliberate):
   ```
   granite: { model: env.GRANITE_MODEL ?? "ibm-granite/granite-4.0-h-micro",
              baseURL: env.GRANITE_BASE_URL ?? "https://openrouter.ai/api/v1",
              trainsOnInputs: false }   // verify host DPA before setting false
   phi:     { model: env.PHI_MODEL ?? "microsoft/phi-4-mini-instruct",
              baseURL: env.PHI_BASE_URL ?? "https://openrouter.ai/api/v1",
              trainsOnInputs: false }
   ```
   ⚠️ **`trainsOnInputs` is a legal gate, not a convenience flag.** Confirm the chosen host's data-use/DPA (OpenRouter forwards to underlying providers; Ollama local = trivially false) before hardcoding `false`. The fail-closed router (`selectProvider`) refuses any personal-data route to a `trainsOnInputs:true` provider. If Phi (as judge) ever sees personal data from an adjudication output, its host MUST be non-training.

2. **Adapters — reuse, don't reinvent.** Both new models support OpenAI tool-calling, so the **`MiniMaxProvider` shape is the correct template** (forced single-function `emit_result` via `tool_choice`, tool_call matched by NAME not position, external `parseAndValidate` + repair loop). Two options:
   - **Minimal:** a single generic `OpenAICompatToolCallingProvider(id, model, baseURL)` parameterized by id — Granite and Phi both instantiate it. DeepSeek keeps its `json_object` adapter.
   - **Explicit:** `GraniteProvider` + `PhiProvider` cloned from `MiniMaxProvider` with different `id`/defaults. Prefer this if per-model prompt tuning diverges.

3. **`types.ts` `Criticality` needs extension.** Today it's `"critical" | "bulk"` (a 2-tier ladder). SEED-001's respond→validate→escalate is a **finer ladder** — expect to add tiers (e.g. `"triage" | "classify" | "judge"`) or a separate `task`/`stage` axis so the router maps task→rung. This is the one type-level change; keep it additive and keep the fail-closed sensitivity gate intact for every new rung.

4. **respond→validate→escalate is orchestration ABOVE the providers**, not inside them. Each adapter stays a dumb `complete()`. The escalation selector is a NEW module (e.g. `packages/llm/src/escalate.ts`) that: calls the small model → runs the Phi judge (`complete()` with a verdict schema like `{ verdict: "pass"|"fail", reason: string }`) → on fail, re-routes to a larger model (DeepSeek/MiniMax) by criticality. The existing `selectProvider` + registry is the substrate; the ladder logic sits on top. The judge verdict is itself a structured output → same zod gate.

## Structured-output strategy per host+model (the load-bearing table)

| Host | Model | Strategy | Quirk / rule |
|------|-------|----------|--------------|
| OpenRouter | Granite-4.0-H-Micro | **Tool-calling forced** (`tool_choice` single function), like MiniMax | Granite is fine-tuned for OpenAI-schema tool calling → reliable. `response_format: json_schema` may pass through, but support is provider-dependent → prefer tool-calling + zod gate. |
| OpenRouter | Phi-4-mini-instruct | **Tool-calling forced** + strict zod gate + repair loop | Phi **documented to hallucinate function names/URLs** → match tool_call by name (the existing `MiniMaxProvider` already does `find(c => c.function.name === TOOL_NAME)`), never by position; missing/renamed call = invalid → repair. |
| DeepInfra | either | Tool-calling (OpenAI-compat) | Same; verify model is live in catalog first. |
| Ollama (local) | either | Tool-calling OR `format: "json"` | `/v1` is a partial OpenAI surface — **do not rely on `response_format: json_schema`**. Use native tool-calling or Ollama's `format:json`; external zod gate mandatory. Don't trust its tool-fidelity/latency as representative of the hosted endpoint. |

**LOCKED (unchanged from CLAUDE.md):** never assume `response_format: json_schema` universal. For Granite/Phi the safe path is tool-calling (or prompt-forced JSON) + zod per provider + repair loop.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| OpenRouter (one key, both models) | DeepInfra | High volume where OpenRouter markup matters AND the exact model is confirmed live in DeepInfra's catalog. Pure `baseURL` swap. |
| OpenRouter | IBM watsonx (Granite) / Azure Foundry (Phi) first-party | Need first-party SLAs, ISO-42001 provenance for the legal dossier (watsonx/Granite), or an existing enterprise Azure contract. Costs the clean `baseURL`+bearer adapter shape (Azure especially). |
| Ollama for the benchmark spike | Rented GPU / hosted eval | Only if local hardware can't fit 3–4B models (it can) or you need production-representative latency — then benchmark directly against OpenRouter. |
| Granite-4.0-**H**-Micro (hybrid) | Granite-4.0-Micro (dense) | If a host only offers the dense variant or the hybrid Mamba path shows tool-calling quirks in benchmark. Dense = `ibm-granite/granite-4.0-micro`; same 3B/128K/Apache-2.0, higher memory, no Mamba latency edge. |
| Reuse `MiniMaxProvider` tool-calling shape | Bespoke JSON-mode adapters per model | Only if a host lacks tool-calling for that model (none of the recommended ones do). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Any new SDK** (`@ibm/watsonx`, `@azure/ai-inference`, LangChain, litellm, etc.) | Violates the LOCKED stack rule — one `openai@5` SDK, multi-provider by `baseURL`. Both new models are OpenAI-compatible on every recommended host. Adds surface, breaks the uniform adapter shape. | `npm:openai@5` + `baseURL`, existing adapter pattern. |
| **Assuming `response_format: json_schema` works on Granite/Phi endpoints** | Support is provider-dependent on OpenRouter/DeepInfra; Ollama's `/v1` doesn't fully implement it. Silent schema drift breaks downstream. | Tool-calling forced (`tool_choice`) + external zod gate + repair loop (existing MiniMax pattern). |
| **Trusting Phi-4-mini tool calls by position / without validation** | Phi is documented to hallucinate function names/URLs in tool-calling. | Match tool_call by exact name (already done in `MiniMaxProvider`); invalid → repair → fail-closed. |
| **Azure AI Foundry for this project's key discipline** | Azure needs deployment names + Azure-specific auth, not plain `apiKey`+`baseURL`; breaks `.env` + adapter uniformity. Also pricier (~$0.22 blended vs $0.08 OpenRouter). | OpenRouter (`microsoft/phi-4-mini-instruct`). |
| **Hard-depending on Together/DeepInfra having the small model** | Small-model availability on these hosts is churny (DeepInfra retired a Phi multimodal variant for low usage). | OpenRouter primary; verify Together/DeepInfra catalog at run time before any swap. |
| **Degrading identity adjudication to Granite/Phi** | SEED-001 + operator rule: adjudication NEVER degrades; Phi is a *second-opinion judge only*, quality-first. | Keep MiniMax for adjudication; Phi as a validator rung that can only *escalate*, never replace. |
| **Setting `trainsOnInputs:false` without checking the host DPA** | It's a legal fail-closed gate (Ley 21.719). A wrong `false` could route personal data to a training tier. | Verify each host's data-use/DPA; Ollama-local is trivially non-training; keep the router gate mandatory for every new rung. |

## Stack Patterns by Variant

**If the benchmark spike runs locally (SEED-001 step 1):**
- Use Ollama (`granite4:micro-h`, `phi4-mini`) at `http://localhost:11434/v1` with the same `openai@5` client.
- Because it's free and repeatable across per-task golden sets — measure *quality* only; re-measure latency/cost against OpenRouter before integrating.

**If a host only exposes the dense Granite variant:**
- Swap `GRANITE_MODEL=ibm-granite/granite-4.0-micro` (dense) via env — zero code change.
- Because config swappability is already built in; the dense variant is the same license/context, just without the Mamba latency edge.

**If cost dominates at volume after launch:**
- Swap `GRANITE_BASE_URL`/`PHI_BASE_URL` to DeepInfra (`https://api.deepinfra.com/v1/openai`) after confirming the model IDs are live.
- Because it's the cheapest blended provider and a pure `baseURL` swap; keep OpenRouter as fallback.

**If a rung handles personal data (e.g. Phi judging an adjudication output with personal fields):**
- Its host MUST be non-training (or run Ollama-local); the fail-closed router refuses otherwise.
- Because `trainsOnInputs` is a compliance boundary, not a tuning knob.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `openai@5` (SDK) | OpenRouter / DeepInfra / Ollama `/v1` | All OpenAI-compatible via `baseURL`; tool-calling shape identical to existing MiniMax adapter. Runs in Deno 2.x edge. |
| `granite-4.0-h-micro` | OpenAI function-calling schema | Fine-tuned for tool calling; returns tool_calls in OpenAI shape. Apache 2.0, 128K–131K ctx, 3B, hybrid Mamba2/attn. |
| `phi-4-mini-instruct` | OpenAI function-calling schema | Function calling supported; MIT, 128K–131K ctx, 3.84B. Watch tool-name hallucination. |
| Ollama `/v1` | `openai@5` | Partial OpenAI surface — JSON-schema/logprobs/streaming edge cases differ; use tool-calling or `format:json`. |
| `zodToToolSchema` (in-repo) | Granite/Phi tool `parameters` | Reuse as-is; single source of truth for the forced-function schema. |

## Sources

- [IBM Granite-4.0-Micro — Hugging Face](https://huggingface.co/ibm-granite/granite-4.0-micro) — 3B, Apache 2.0, 128K ctx, tool calling, dense vs H(hybrid 4 attn/36 Mamba2) distinction — HIGH
- [Granite 4.0 language models — GitHub (ibm-granite)](https://github.com/ibm-granite/granite-4.0-language-models) / [IBM Granite docs](https://www.ibm.com/granite/docs/models/granite) — Apache 2.0, ISO 42001, tool-calling via OpenAI schema, `<tool_call>` tags — HIGH
- [Granite 4.0 Micro — OpenRouter](https://openrouter.ai/ibm-granite/granite-4.0-h-micro) — model ID `ibm-granite/granite-4.0-h-micro`, 131K ctx, ~$0.017/$0.112, "fine-tuned for long context tool calling" — HIGH (ID/spec), MEDIUM (price drift)
- [microsoft/Phi-4-mini-instruct — Hugging Face](https://huggingface.co/microsoft/Phi-4-mini-instruct) / [license: mit (raw README)](https://huggingface.co/microsoft/Phi-4-mini-instruct/raw/4665bce29c0e7cab6a0f8fd003355308fe61f9c8/README.md) — MIT, 3.84B, 128K ctx, function calling supported, documented function-name/URL hallucination — HIGH
- [Phi 4 Mini Instruct — OpenRouter](https://openrouter.ai/microsoft/phi-4-mini-instruct) — model ID `microsoft/phi-4-mini-instruct`, 131K ctx, ~$0.08/$0.35, released Oct 2025 — HIGH (ID/spec), MEDIUM (price)
- [Phi-4 providers — Artificial Analysis](https://artificialanalysis.ai/models/phi-4/providers) — DeepInfra cheapest blended (~$0.09), Azure ~$0.22 — MEDIUM
- [OpenRouter Structured Outputs docs](https://openrouter.ai/docs/guides/features/structured-outputs) — jsonSchema→functionCalling→jsonMode auto-selection; enforcement varies by provider — HIGH
- [Ollama: phi4-mini](https://ollama.com/library/phi4-mini) / [granite4:micro-h](https://ollama.com/library/granite4:micro-h) — local pull tags, OpenAI-compat `/v1` (partial surface) — HIGH
- [Run Granite/Phi locally — IBM Developer](https://developer.ibm.com/tutorials/awb-local-ai-copilot-ibm-granite-code-ollama-continue/) — `ollama pull granite4:*`, `http://localhost:11434/v1`, partial OpenAI surface caveat — MEDIUM
- In-repo: `packages/llm/src/{types,config,router}.ts` + `providers/{deepseek,minimax}.ts` — the exact integration target (LLMProvider, baseURL config, tool-calling shape, external zod gate) — HIGH

---
*Stack research for: v11.0 tiered LLM layer (Granite-4.0-H-Micro + Phi-4-mini-instruct as new rungs)*
*Researched: 2026-07-26*
*Prior milestone stack archived at STACK-v10.md*
