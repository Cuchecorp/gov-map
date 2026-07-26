# Feature Research

**Domain:** Tiered LLM architecture (cascade / model-routing / LLM-as-judge) for a civic-data extraction+classification platform
**Researched:** 2026-07-26
**Confidence:** HIGH (Granite/Phi benchmarks from official model cards + peer-reviewed judge study; cascade/judge patterns from FrugalGPT + multiple production sources)

> **Scope note:** This file covers ONLY the new capability from SEED-001 — per-task model tiering with quality-parity gates over the existing `LLMProvider` layer. It does NOT re-cover the extraction/adjudication/embedding features already built. The operator rule is LOCKED: **"ante la duda, SIEMPRE calidad"** — tiering optimizes latency/cost ONLY where the benchmark proves quality parity on that task's golden set. Every recommendation below is filtered through that rule.

---

## Task Taxonomy for Tiering (which tasks are safe for small models)

Industry evidence is remarkably consistent on WHICH tasks small (~3B) models handle at parity, and which they do NOT. This drives the whole architecture.

| Task type | Small-model safety | Evidence | Recommendation for this project |
|-----------|-------------------|----------|--------------------------------|
| **Routing / triage** (which pipeline, which model, yes/no gate) | SAFE | "classification tasks, yes/no questions, structured extraction, and summarisation are almost always fine on small models" (leanlm/truefoundry consensus). A sub-ms static rule beats a learned router at the front door. | Granite-4.0-H-Micro candidate; but **prefer static rules first** where the routing signal is a known field (source type, boletín present, PDF vs XML). Model routing only where the signal is genuinely semantic. |
| **Classification** (theme/sector labeling, señal typing) | SAFE-with-golden-set | Granite-4.0-H-Micro: IFEval 84.3% avg, MMLU 67.4% — "strong generalist... summarization, classification, extraction". Classification is the canonical small-model win. | Granite candidate. GATE: needs a per-task golden set (theme/sector labels) with a quality-parity threshold vs DeepSeek before flipping. Spanish caveat below. |
| **Judging / validation** (was the small model's output good enough?) | SAFE-as-second-opinion, NOT-as-authority | Phi-4-mini's ancestor (Phi-3.5, 3.8B → Flow-Judge-v0.1) reached parity with much larger judges on held-out + OOD binary classification (HaluEval/Covid-QA style). But the 14B Phi-4 judge still beat the 3.8B, and "grounding and alignment remain essential." | Phi-4-mini candidate as the **validate** step (binary/Likert "is this extraction faithful / is this label plausible"). NEVER as the sole authority on a critical output. Identity adjudication is explicitly OUT (see anti-features). |
| **Extraction** (idea matriz literal, agenda tables from PDF) | RISKY on ~3B — keep DeepSeek | 3B models "achieve near-zero schema accuracy via direct prompting"; Llama-3.2-3B "zero tool attempts across 9 scenarios." Extraction with strict schema + fidelity is exactly where small models fail. | KEEP DeepSeek for `packages/fichas` extraction and agenda-table extraction. This is where the seed says "DeepSeek SOLO donde luce." Do not tier this without a golden set proving parity (unlikely at 3B). |
| **Identity adjudication** (MiniMax, golden 1263, CI ≥0.95) | DO NOT TOUCH | Riesgo existencial #1 (PROJECT.md): a false match = false-but-credible claim. | LOCKED. Phi may only be a **second opinion** layered ON TOP; the primary decision never degrades. |

**Key taxonomy insight:** the safe tasks (routing, classification, judging) are *reasoning/decision* tasks with small output spaces. The risky task (extraction) is a *strict-structured-generation* task. Tier the former, protect the latter.

---

## Feature Landscape

### Table Stakes (a serious tiered-LLM system is expected to have these)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Per-task golden set + parity gate before any tier flip** | The project's LOCKED method (golden 32, golden 1263 as CI precedent). Without it, tiering is a quality gamble. | MEDIUM | Depends on: building 4 new golden sets (routing, classification, judge, extraction). Reuse the golden-32 / golden-1263 harness pattern. The gate is a hard CI gate, not a dashboard. |
| **Eval harness measuring quality + latency + cost + structured-output validity** | A spike that measures only accuracy is useless for a latency/cost decision; a spike that ignores schema-failure rate hides the 3B failure mode. | MEDIUM | Must record: task accuracy (vs golden), p50/p95 latency, cost/1k calls, and **zod-validation failure rate** (retries + malformed JSON). The last one is the small-model killer per the 3B evidence. |
| **`baseURL`-swap over existing `LLMProvider`** | The seed's whole thesis: "encaja sin re-arquitectura." Granite/Phi/DeepSeek all expose OpenAI-compatible endpoints. | LOW | Reuse `packages/llm` openai-SDK multi-baseURL. Per CLAUDE.md: NEVER assume `response_format: json_schema` — tool-calling or prompt-forced + **zod per provider** applies to Granite/Phi too. |
| **respond → validate → escalate cascade** | The canonical FrugalGPT pattern; the operator designed exactly this. Cheap model responds, judge validates, selector escalates on fail. | MEDIUM | FrugalGPT reports 50–98% cost savings at same quality. But quality is bounded by the routing/validation signal — see the miscalibration pitfall. |
| **Escalation on validation-fail (not just confidence)** | Raw token-confidence from small models is "typically miscalibrated" (UCCI, cascade-scoring papers). A judge-model verdict is a stronger signal than self-reported confidence. | MEDIUM | Prefer judge-based escalation (Phi validates) over self-confidence thresholds. Fail-open UP the ladder (escalate on doubt), never fail-down. |
| **Separation of generation and evaluation models** | "self-evaluation should be avoided in production" — a model judging its own output inflates 5–7% (self-enhancement bias). | LOW | Granite responds → Phi (different family) judges. Different family is itself a bias-mitigation per the judge literature. Do NOT let the same model be responder and judge. |
| **Deterministic judge (low temperature)** | Reproducible gates require deterministic evaluation. | LOW | temp≈0 for the validate step so the gate result is stable across CI runs. |

### Differentiators (align with the project's Core Value + LOCKED quality rule)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Quality-parity-ONLY tiering (never cost-first)** | Inverts the industry default. Most cascade work optimizes cost; here cost/latency is a *side-effect* of proven parity. Directly encodes "ante la duda, SIEMPRE calidad." | MEDIUM | The gate says: flip to small model ONLY if parity_delta ≤ ε on the task golden set. Otherwise DeepSeek/MiniMax stays. This is the differentiator vs generic FrugalGPT. |
| **Gradual per-product rollout starting at lowest-risk task** | De-risks: prove the pattern on theme-classification or routing (reversible, non-legal) before touching anything user-facing or legal. | LOW | Seed says exactly this. Suggested order: routing → classification (señal/tema) → judge-as-second-opinion → (extraction stays DeepSeek). |
| **Judge-as-second-opinion on critical outputs (never as gate-flip)** | Adds a cheap quality signal to identity/extraction WITHOUT degrading them — pure upside, no risk to the LOCKED subsystems. | MEDIUM | Phi flags "this MiniMax adjudication looks weak → route to human review" — it *raises* the human-review rate, never lowers the primary model's authority. |
| **Provenance of model choice per record** | Consistent with the project's trazabilidad rule: store which model produced each derived value + model version. | LOW-MEDIUM | Extends the existing `embedding_model`/`embedding_version` per-row pattern to LLM-derived fields. Enables re-processing when a tier changes and audit of which model made which call. |
| **Static-rule router before learned router** | Cheaper, faster, auditable, no extra failure mode. A static rule is "sub-ms noise against a 500ms generation." | LOW | Where the routing key is a known field, a `switch` beats an LLM. Keep the model-router only for genuinely semantic routing decisions. |

### Anti-Features (seem good, create problems — DO NOT build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Learned/ML router as the primary routing mechanism** | "Intelligent routing" sounds sophisticated; papers show 85% savings. | Adds a trained artifact to maintain + retrain, a new miscalibration failure mode, and non-determinism, for a routing problem that is mostly a known-field `switch` here. Overkill for "well-defined, predictable use cases" (which this is). | Static rules on known fields (source, boletín-present, task type); reserve model-classification routing for the few genuinely semantic splits, gated by a golden set. |
| **Per-request dynamic pricing/cost optimization** | Squeeze every cent per call. | Introduces non-determinism into which model runs (breaks reproducibility of the golden-set gate), and micro-optimizes a cost that free tiers already cover (MiniMax 45k/wk free, Gemini free). Contradicts "SIEMPRE calidad." | Static per-task model assignment decided once by the benchmark; re-benchmark on model-version change, not per request. |
| **Self-confidence-threshold escalation as the only signal** | Simplest to implement (just read logprobs). | Small-model confidence is "typically miscalibrated" (UCCI + cascade-scoring papers) — the escalation trigger would be noise. | Judge-model verdict (Phi) as the escalation signal; self-confidence only as a coarse cheap pre-filter, never the sole gate. |
| **Small model (~3B) doing strict-schema extraction to save cost** | It's the biggest DeepSeek consumer; tempting target. | 3B models hit "near-zero schema accuracy via direct prompting" / "zero tool attempts." Would silently corrupt idea-matriz fidelity — a Core-Value violation. | KEEP DeepSeek for extraction. If ever revisited, requires constrained decoding + a golden fidelity gate proving parity (improbable at 3B). |
| **Small model replacing MiniMax on identity adjudication** | Latency/cost win on a hot path. | Riesgo existencial #1. A degraded adjudicator = false-but-credible claims. The golden-1263 ≥0.95 gate exists precisely to prevent this. | Phi ONLY as an additive second opinion that can *escalate to human*, never as a replacement or a downgrade. LOCKED. |
| **Fine-tuning a small model to fix its structured-output weakness** | SLOT paper shows 1B → 88.9% schema accuracy after SFT. | Adds a training/data pipeline, a fine-tuned artifact to host and version, and drifts from "capa enchufable OpenAI-compat." Out of scope for a swap-by-baseURL milestone. | Prompt-forced + zod + retry-with-bigger-model (the cascade already handles the failure). Fine-tuning is a future consideration, not this milestone. |
| **Ensemble/majority-vote judging (3–5 models) everywhere** | Reduces judge bias 30–40%. | Costs 3–5x; the judge literature says "reserve for high-stakes decisions only." Applying it to every classification defeats the tiering purpose. | Single different-family judge (Phi) for routine validation; reserve ensemble only if a specific high-stakes gate demands it. |

---

## Feature Dependencies

```
[4 per-task golden sets]  (routing, classification, judge, extraction-parity)
        └──requires──> [eval harness: quality + latency + cost + zod-fail-rate]
                              └──requires──> [existing LLMProvider baseURL swap]
                                                   └──requires──> [zod-per-provider validation (existing)]

[Parity gate (CI)]  ──requires──> [4 per-task golden sets]
        └── precedent ── [golden 32 (búsqueda)] + [golden 1263 (identidad)]

[respond→validate→escalate cascade]
        └──requires──> [separation of generation + judge models]
        └──requires──> [judge-based escalation signal]  ──conflicts──> [self-confidence-only escalation]

[Gradual per-product rollout]  ──requires──> [Parity gate passing on the lowest-risk task first]

[Judge-as-second-opinion on identity]  ──enhances──> [existing MiniMax adjudication]
        (additive only; MUST NOT degrade the golden-1263 ≥0.95 gate)
```

### Dependency Notes

- **Everything depends on the eval harness + golden sets.** The spike (SEED-001 item 1) is the true first deliverable; the cascade (item 2) cannot be flipped for any task until that task's parity gate passes. This mirrors v9.0's "golden set congelado ANTES del schema" ordering.
- **The harness must measure zod-validation-failure-rate as a first-class metric,** not just accuracy. The 3B structured-output evidence means a small model can be "accurate when it works" but fail schema often — that failure rate IS the latency/cost story (retries + escalations erase the savings). A spike that omits it will over-recommend small models.
- **Judge model must be a different family from the responder** (Granite responds → Phi judges) — this is both an architecture requirement and a bias-mitigation per the judge literature.
- **Identity adjudication is an enhance-only edge:** Phi layers on top of MiniMax; the dependency is one-directional and non-degrading. Any change to the primary path is out of scope.

---

## MVP Definition

### Launch With (the spike + first safe integration)

- [ ] **Eval harness** measuring quality (vs golden) + p50/p95 latency + cost/1k + zod-fail-rate, over `LLMProvider` baseURL swap — essential; it IS the empirical basis the project requires.
- [ ] **Per-task golden sets** for at least: routing, classification, judge — essential; the gate has nothing to measure otherwise. (Extraction golden = parity-check that likely KEEPS DeepSeek.)
- [ ] **Parity gate as hard CI check** (parity_delta ≤ ε per task) — essential; encodes "SIEMPRE calidad."
- [ ] **One lowest-risk integration** (classification of theme/señal OR a semantic routing split) behind the gate — essential to validate the pattern end-to-end on something reversible and non-legal.

### Add After Validation (next tier of integration)

- [ ] **respond→validate→escalate cascade** wired for the validated task — trigger: parity gate green on the first task.
- [ ] **Judge-as-second-opinion on extraction fidelity** (Phi flags weak DeepSeek extractions for review) — trigger: judge golden set shows Phi correlates with fidelity failures.
- [ ] **Provenance-of-model-choice per derived record** — trigger: more than one task tiered, so audit/re-processing matters.

### Future Consideration (defer)

- [ ] **Judge-as-second-opinion on identity adjudication** — defer: touches the most critical subsystem; only after the pattern is proven elsewhere and with explicit "additive-only" guards. Never a replacement.
- [ ] **Learned/semantic router** — defer until static rules demonstrably can't express a needed routing split.
- [ ] **Fine-tuning a small model for structured output** — defer indefinitely; contradicts the plug-in, benchmark-swap thesis.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Eval harness (quality/latency/cost/zod-fail) | HIGH | MEDIUM | P1 |
| Per-task golden sets (routing/class/judge) | HIGH | MEDIUM | P1 |
| Parity gate (CI, hard) | HIGH | LOW | P1 |
| Static-rule router (known-field splits) | MEDIUM | LOW | P1 |
| respond→validate→escalate cascade | MEDIUM | MEDIUM | P2 |
| Judge-as-second-opinion (extraction) | MEDIUM | MEDIUM | P2 |
| Provenance of model choice per record | MEDIUM | LOW | P2 |
| Judge-as-second-opinion (identity) | LOW-but-sensitive | MEDIUM | P3 |
| Learned/semantic router | LOW | HIGH | P3 |
| Small-model fine-tuning | LOW | HIGH | P3 (avoid) |

## Known Quality Profiles of the Candidate Small Models

| Model | Params / Arch | Strengths (evidence) | Weaknesses / risks for THIS project | Best role |
|-------|---------------|----------------------|-------------------------------------|-----------|
| **Granite-4.0-H-Micro** | ~3B, hybrid Mamba-2/transformer; ~70% less memory, ~2x faster inference | IFEval 84.3% avg (Instruct-strict 86.9%), MMLU 67.4%, GSM8K 81.4%, HumanEval 81%. Explicitly targeted at "summarization, classification, extraction, function-calling." Supports Spanish. | BFCL tool-calling only **57.6%** → strict-schema/tool-call reliability is a real risk (matches the 3B structured-output evidence). Model card: multilingual "might not be similar to English"; recommends few-shot. | Routing + classification (small output space), few-shot prompted, zod-guarded. NOT strict-schema extraction. |
| **Phi-4-mini-instruct** | 3.8B dense | Ancestor (Phi-3.5→Flow-Judge-v0.1, 3.8B) reached parity with larger judges on binary hallucination/QA classification (HaluEval ~0.88, Covid-QA ~0.90 for the 14B; the 3.8B judge line is competitive). ~92% on long-answer judging with a strong meta-judge. Strong multilingual reasoning for its size. | The 14B Phi-4 judge still **beats** the 3.8B → a small judge is "good enough for routine validation," not authoritative on hard cases. Judge biases (position ~40%, verbosity ~15%, self-enhancement 5–7%) still apply → mitigate with A/B order swap + 1–4 scale + different family. | The **validate/judge** step (binary/Likert faithfulness & plausibility). Second opinion, not authority. |
| **DeepSeek V4 (incumbent)** | large, prompt-cache | Proven on extraction (fichas, golden-gated) + agenda tables. `json_object` mode (not strict schema) — already handled by zod. | Cost/latency at volume (the reason for the seed). | KEEP for strict-schema extraction; the tier that small models must BEAT on a golden set to displace (they likely won't for extraction). |
| **MiniMax M3 (incumbent)** | large, tool-calling structured output | Identity adjudication, golden-1263 ≥0.95 CI gate. | — | LOCKED for identity. Phi may only add a second opinion on top. |

**Cross-cutting risk for both small models: Spanish.** Both model cards flag multilingual < English. This project is 100% Spanish (Congreso de Chile). The golden sets MUST be Spanish, and few-shot Spanish exemplars are likely required. A spike that benchmarks on English would over-estimate parity.

## Sources

- [ibm-granite/granite-4.0-h-micro — Hugging Face](https://huggingface.co/ibm-granite/granite-4.0-h-micro) — IFEval 84.3%, BFCL 57.6%, MMLU 67.4%, hybrid Mamba, Spanish support, few-shot rec — HIGH
- [Granite 4.0 | IBM Granite docs](https://www.ibm.com/granite/docs/models/granite) — hybrid Mamba-2/transformer, ~70% memory / 2x inference, classification/extraction/tool-calling positioning — HIGH
- [microsoft/Phi-4-mini-instruct — Hugging Face](https://huggingface.co/microsoft/Phi-4-mini-instruct) — 3.8B, synthetic+filtered data, multilingual reasoning — HIGH
- [Phi-4 as an LLM Evaluator — Flow AI](https://flow-ai.com/blog/phi-4-as-llm-evaluator) — Likert/binary judge benchmarks; 14B > 3.8B; Flow-Judge-v0.1 (Phi-3.5, 3.8B) parity; grounding essential — HIGH
- [Phi-4-Mini Technical Report — arXiv](https://arxiv.org/html/2503.01743v1) — 92.26% long-answer judging; multilingual reasoning at 3.8B — MEDIUM/HIGH
- [FrugalGPT — EmergentMind](https://www.emergentmind.com/topics/frugalgpt) — cascade pattern, 50–98% cost savings at same quality, confidence-threshold escalation — HIGH
- [UCCI: Calibrated Uncertainty for Cost-Optimal LLM Cascade Routing — arXiv](https://arxiv.org/pdf/2605.18796) — LLM confidence miscalibration; cascade bounded by routing signal — MEDIUM
- [Do Small Language Models Know When They're Wrong? Confidence-Based Cascade Scoring — arXiv](https://arxiv.org/pdf/2604.19781) — small-model confidence miscalibration in cascades — MEDIUM
- [LLM Model Routing — leanlm.ai](https://leanlm.ai/blog/llm-model-routing) — "classification, yes/no, extraction, summarisation almost always fine on small models"; static vs learned router — MEDIUM
- [Intelligent LLM Routing — TrueFoundry](https://www.truefoundry.com/blog/llm-routing-cost-quality-aware-model-selection) — static rules for well-defined use cases; sub-ms rule vs semantic overhead — MEDIUM
- [LLM-as-a-judge complete guide — Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge) — separate generation/eval models, no self-eval, low temp, bias mitigation — HIGH
- [Exploring LLM-as-a-Judge — Weights & Biases](https://wandb.ai/site/articles/exploring-llm-as-a-judge/) — position/verbosity/self-enhancement bias %s, ensemble reserve-for-high-stakes — MEDIUM
- [When Correct Isn't Usable: Structured Output Reliability in Small LMs — arXiv](https://arxiv.org/pdf/2605.02363) — 3B near-zero schema accuracy via direct prompting; mitigation stack — HIGH
- [Why Small LLMs Fail at Tool Calling: Llama 3B Benchmark — DEV](https://dev.to/anak_wannaphaschaiyong_11/why-small-llms-fail-at-tool-calling-the-shocking-discovery-from-our-llama-3b-benchmark-5lg) — Llama-3.2-3B zero tool attempts across 9 scenarios — MEDIUM
- [SLOT: Structuring the Output of LLMs — arXiv](https://arxiv.org/html/2505.04016v1) — SFT raises 1B to 88.9% schema accuracy (fine-tuning as future-only option) — MEDIUM

---
*Feature research for: tiered LLM cascade / routing / judge layer (SEED-001, milestone v11.0)*
*Researched: 2026-07-26*
