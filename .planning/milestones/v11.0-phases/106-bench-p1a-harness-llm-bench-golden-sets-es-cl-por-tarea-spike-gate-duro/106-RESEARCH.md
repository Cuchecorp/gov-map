# Phase 106: BENCH P1a — Harness `packages/llm-bench` + golden sets es-CL POR TAREA (SPIKE, gate duro) - Research

**Researched:** 2026-07-26
**Domain:** Measurement instrument for a tiered-LLM go/no-go — benchmark harness methodology + golden-set construction (es-CL legal), NOT stack selection
**Confidence:** HIGH (grounded in real repo code + existing milestone research + methodology literature already cited in SUMMARY/PITFALLS)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (frame LOCKED del operador — rectora, NO re-preguntar)
- **Ante la duda, SIEMPRE calidad.** El escalonamiento optimiza latencia/costo SOLO donde el benchmark demuestra paridad. DeepSeek se queda donde luce.
- **Harness VIVE FUERA del runtime** (`packages/llm-bench`, nunca dentro de `@obs/llm`) — el código de medición jamás se enlaza al camino de producción.
- **Golden sets NUEVOS por tarea, es-CL, estratificados del corpus REAL, SIN leakage al prompt** (pools de ejemplo/eval disjuntos), CONGELADOS antes de cualquier integración (precedente golden 32/1263: el set se congela ANTES del schema).
- **Métricas de PRIMERA CLASE, SEPARADAS:** calidad (por tarea) + latencia p50/p95 + costo/1k + tasa de fallo zod/structured-output. Omitir la de zod sobre-recomienda modelos chicos → es obligatoria.
- **BENCH-03:** medir contra el endpoint/cuantización EXACTOS de producción. En 106 el baseline corre contra DeepSeek/MiniMax reales (sus keys existen); la medición de latencia/costo de candidatos en su host servido es de 107. Ollama-local (si está) = spike de CALIDAD; jamás transfiere latencia/costo del host servido (Pitfall 9).
- `response_format: json_schema` JAMÁS asumido: el harness mide structured-output vía tool_choice-forzado + zod; la tasa de fallo zod ES una métrica, no un crash.
- **RUT jamás cruza a un LLM:** golden sets son datos NO-PII (idea_matriz/sector/tramitación son públicos). Guard por construcción — ningún caso lleva RUT.
- **Adjudicación intocable e inobservada:** ningún golden nuevo toca golden-1263 ni corre el pipeline de identidad. Phi-juez-sobre-identidad DIFERIDO a v2.
- **Secrets nuevos solo en `.env` con placeholder SIN valor en `.env.example`.** En 106 NO se necesita key nueva (baseline usa DeepSeek/MiniMax existentes); el token Workers AI/OpenRouter es checkpoint de 107.

### Claude's Discretion
- Nombre exacto de tipos/funciones del harness, forma del reporte JSON, estructura de `casos.json` por tarea, ejes de estratificación finos, tamaño exacto por set (dentro de la escala del precedente ~40 casos), y si el juez-set se modela como pares `(respuesta, etiqueta_humana)` o como rúbrica — todo dentro del frame.

### Deferred Ideas (OUT OF SCOPE — van en 107+)
- Adapters Granite/Phi + benchmark contra endpoint REAL + juez vs humano + VEREDICTO → Phase 107.
- Router aprendido/semántico, fine-tuning de modelos chicos → v2+.
- Phi-juez-sobre-identidad → v2 (adjudicación intocable).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BENCH-01 | Harness `packages/llm-bench` evalúa candidatos sobre golden sets POR TAREA en es-CL legal, midiendo calidad, latencia, costo y tasa de fallo zod/structured-output como métricas de primera clase **separadas** | § Metric Methodology (fórmulas concretas p50/p95, cost/1k, zod-fail vs structured-output-fail); § Harness Architecture (drives `LLMProvider`, mock-en-CI/real-en-LIVE); § Measurement Wrapper (cómo capturar usage/latency que `complete()` hoy NO expone) |
| BENCH-02 | Golden sets es-CL nuevos por tarea (routing, clasificación, juez/validación, paridad-extracción) estratificados del corpus real — sin leakage, congelados ANTES de integrar | § Golden-Set Construction (estratificación, sourcing NO-PII del corpus real, freezing + hash, anti-leakage guard-que-muerde); § Judge-Set Methodology (pares answer/human_label) |
| BENCH-03 | El benchmark corre contra el endpoint/cuantización EXACTOS de prod (host+revision pinned; Ollama = calidad, re-medición latencia/costo en host servido) | § Baseline Readiness (DeepSeek/MiniMax reales en 106, cero secret nuevo); § Endpoint Provenance (versionar model+baseURL+tarifa+fecha en el reporte; 107 re-mide candidatos en host servido) |
</phase_requirements>

## Summary

Phase 106 builds the **measurement instrument**, not the models. Every architectural and stack question is already answered (SUMMARY/STACK/ARCHITECTURE); the only research a planner still needs is the **methodology of measurement** and the **discipline of golden-set construction**. Two facts dominate everything below.

**Fact 1 — the runtime contract hides the metrics the harness must record.** `LLMProvider.complete<T>(req, schema)` (`packages/llm/src/types.ts:58`) returns an *already-zod-validated `T`*. It surfaces **no token `usage`, no latency, no repair-attempt count, no raw structured-output-failure signal** — those live *inside* the adapter and inside `parseAndValidate` (`validate.ts`). Therefore the harness **cannot** obtain cost/latency/zod-fail-rate by calling `complete()` as-is. This is the single load-bearing design decision of the phase: the harness needs an *instrumented* path (a measurement wrapper that owns the `openai@5` call and reads `res.usage` + wall-clock + repair outcomes) that produces the *same validated `T`* the golden scorer consumes. `@obs/llm` runtime stays UNCHANGED (frame: harness never touches the prod path).

**Fact 2 — the golden precedents already encode the correct per-task scoring; 106 generalizes them, it does not invent them.** `packages/cruces/src/golden/golden-set.ts` is single-label top-1 + first-class abstention (routing/classification). `packages/fichas/src/golden/golden-set.ts` is literal-fidelity precision/recall with schema-parse SEPARATE from value-accuracy and a live adversarial-fabrication meta-test proving "the gate can actually fail." Both use the identical CI-vs-LIVE split (mock in CI, real provider gated by env, never in CI) and load `casos.json` through a zod parse-at-load compuerta. 106 = one package that hosts four such golden sets + a metrics aggregator + a report, mirroring these two files exactly.

**Primary recommendation:** Build `packages/llm-bench` as a **thin instrumentation + scoring layer over an instrumented provider path**, with four frozen `casos.json` golden sets (routing, clasificación, juez, paridad-extracción), a versioned pricing table, a single `Reporte` type that keeps `{ calidad_por_tarea, latencia_p50, latencia_p95, costo_por_1k, zod_fail_rate, structured_output_fail_rate }` as SEPARATE first-class fields, a CI guard-que-muerde asserting pool disjunction + no-RUT + frozen-hash, and a baseline run of today's DeepSeek/MiniMax gated LIVE-only. **No new secret. A "nada aprueba paridad" verdict must be expressible.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Metric capture (usage/latency/repair) | `packages/llm-bench` instrumented path | — | `LLMProvider.complete()` returns only validated `T`; metrics must be captured where the `openai@5` call and repair loop are observable (harness-owned, OUT of runtime) |
| Structured-output invocation (tool_choice + zod) | `@obs/llm` providers (delegated) | llm-bench wrapper | Reuse the MiniMax template; never re-implement the compliance gates — harness composes the real provider or a faithful instrumented clone |
| Golden scoring per task | `packages/llm-bench/tasks/*` | — | Mirror cruces (top-1+abstención) and fichas (parse-rate vs value) scoring; each task's failure mode differs |
| Freezing + anti-leakage enforcement | CI guard (vitest, static, no network) | — | Repo's "guard que muerde" culture = vitest tests run by `pnpm test` in ci.yml; static reads of `casos.json`, no DB/net |
| Baseline execution vs real providers | LIVE-only block (env-gated, not in CI) | — | Precedent: fichas/cruces `golden-set.test.ts` LIVE block; avoids quota burn/flakiness in CI |
| Verdict/report emission | `packages/llm-bench` report | — | Report is JSON + legible table; 106 is a REPORT, not an auto-merge verdict (verdict-por-tarea is 107/BENCH-05) |

## Standard Stack

Stack is DECIDED (do not re-derive). This section only records what the harness *reuses*.

### Core (all already in-repo — zero new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | `npm:openai@5` | The instrumented call inside the harness reads `res.usage` (prompt/completion tokens) + does wall-clock timing | Same SDK as every adapter; `usage` object is standard on `chat.completions.create` responses `[CITED: platform.openai.com/docs/api-reference/chat/object → usage]` |
| `zod` | 3.x/4.x | Parse-at-load compuerta for `casos.json`; the same `parseAndValidate` gate the harness measures | Untrusted-JSON-on-disk gate, precedent in both golden files `[VERIFIED: packages/cruces/src/golden/golden-set.ts:64]` |
| `zodToToolSchema` | in-repo (`packages/llm/src/json-schema.ts`) | Derive tool `parameters` for structured-output measurement | Single source of truth, reused verbatim by MiniMax adapter `[VERIFIED: packages/llm/src/providers/minimax.ts:74]` |
| `vitest` | per-package | Golden gate + guard tests, CI-mock / LIVE-gated split | Precedent `golden-set.test.ts` in fichas/cruces `[VERIFIED: packages/fichas/src/golden/golden-set.test.ts]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node `perf_hooks` `performance.now()` | Node builtin | Per-call latency sampling | Already used in ARCHITECTURE's `tiered.ts` sketch `[CITED: .planning/research/ARCHITECTURE.md:167]` |
| `node:crypto` `createHash("sha256")` | Node builtin | Freeze marker for `casos.json` (immutability hash) | Freezing mechanism (§ Golden-Set Construction) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `res.usage` token counts | client-side tokenizer (tiktoken/gpt-tokenizer) | Adds a dep + mismatches server tokenization; use `res.usage` when present, fall back to `[ASSUMED]` cost only if a host omits usage (flag it in report) |
| Percentile hand-roll | `simple-statistics` / d3-array `quantile` | For small-N a 10-line nearest-rank function is clearer and dependency-free (§ Metric Methodology); avoid the dep |

**Installation:** No new packages. `packages/llm-bench/package.json` depends on `@obs/llm` (+ dev: vitest, zod). NEVER the reverse (`@obs/llm` must not depend on `@obs/llm-bench`).

## Package Legitimacy Audit

> Phase installs **zero external packages** — the harness reuses `openai@5`, `zod`, `vitest`, and Node builtins, all already vetted and in-repo. No slopcheck run required.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none new) | — | N/A — all dependencies pre-existing in the monorepo |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Metric Methodology (concrete formulas the harness implements — BENCH-01)

### The capture problem (READ FIRST)
`complete<T>()` returns validated `T` only. To measure, the harness needs an **instrumented invocation** that owns the `openai@5` `chat.completions.create` call so it can read:
- `res.usage.prompt_tokens`, `res.usage.completion_tokens` → cost `[CITED: openai chat completion object → usage]`
- `performance.now()` deltas around the call → latency
- whether the tool_call/`json_object` parsed and passed zod, and how many repair round-trips → the two failure metrics

**Two implementation options for the planner (discretion, but flag the tradeoff):**
1. **Instrument the real provider** by injecting a `fetchFn` (every adapter accepts `opts.fetchFn` — `deepseek.ts:39`, `minimax.ts:43`) that wraps `fetch`, times it, and captures the response body's `usage` before handing it back. Pro: measures the EXACT prod code path (repair loop included). Con: usage must be parsed out of the intercepted response.
2. **Harness-owned instrumented call** that re-implements the tool_choice+zod+repair loop (a faithful clone of the MiniMax pattern) purely for measurement. Pro: direct access to usage/latency/repair-count. Con: must be kept faithful to the real adapter or it measures a different thing (Pitfall 4 — apples-to-oranges).
   → **Recommendation:** Option 1 (fetch-wrapper instrumentation) — it measures the real path and keeps the harness honest per BENCH-03. `[VERIFIED: packages/llm/src/providers/deepseek.ts:39, minimax.ts:43 — fetchFn is injectable]`

### Latency p50 / p95 (per-call sample → distribution percentile)
- **Sample per call:** `t = performance.now(); await call(); latencyMs = performance.now() - t`. One sample per golden case per model (repair round-trips are part of the wall clock — a small model that repairs twice is genuinely slower; do NOT strip them). `[CITED: PITFALLS.md Pitfall 7 — "account for zod-retry round-trips in the latency/cost math"]`
- **Percentile (nearest-rank, correct for small N):** sort ascending; `index = ceil(p/100 * n) - 1` clamped to `[0, n-1]`; `pXX = sorted[index]`. For p50 with n=40 → index 19; p95 → index 37.
- **Small-N caveat (MUST document in the report):** with ~40 samples, p95 is a single observation (the 38th) — it is a **point estimate with wide uncertainty, not a stable SLA number**. The report must state N and label p95 as indicative. Do NOT interpolate between ranks for these small sets (adds false precision). `[ASSUMED — standard percentile practice; confirm framing with operator]`
- **BENCH-03 boundary:** in 106 latency is measured against DeepSeek/MiniMax real endpoints (baseline). Candidate latency on the *served host* (Workers AI/OpenRouter) is 107. Ollama-local latency **must never be reported as the candidate's latency** (Pitfall 9). Tag every latency number with its endpoint (§ Endpoint Provenance).

### Cost / 1k tokens (versioned rate table)
- **Formula:** `costo_usd = (prompt_tokens/1e6 * rate_in) + (completion_tokens/1e6 * rate_out)`; report `costo_por_1k = costo_usd / (total_tokens/1000)` OR the more useful `costo_por_1k_casos` (cost to run 1000 cases of this task). Keep whichever the operator wants but **name it unambiguously** in the report.
- **Token source:** `res.usage` from the openai@5 response. If a host omits `usage`, mark that model's cost `[ASSUMED]`/`null` in the report — never silently zero it.
- **Rate table VERSIONED with a date** (mirrors the embeddings `model/dims/version` provenance discipline `[VERIFIED: packages/llm/src/types.ts:66-75]`):
  ```ts
  // packages/llm-bench/src/pricing.ts
  export const PRICING = {
    fecha: "2026-07-26",
    tarifas: {
      // per 1M tokens, in/out — MEDIUM confidence, re-verify in 107
      "deepseek-v4-flash": { in: /* verify */ , out: /* verify */ },
      "MiniMax-M3":        { in: /* verify */ , out: /* verify */ },
      // candidates (107): granite ~$0.017/$0.11, phi ~$0.08/$0.35  [CITED: STACK.md]
    },
  } as const;
  ```
  The report embeds `pricing.fecha` so any cost number carries the tariff date. Pricing is MEDIUM-confidence and is re-verified in 107 (LOCKED).

### zod-fail-rate vs structured-output-fail-rate (SEPARATE first-class metrics — LOCKED)
These are **two different failures** and folding either into "quality" over-recommends small models (LOCKED). Define exactly, mirroring `parseAndValidate`'s repair loop (`validate.ts:101`):

| Outcome | Definition | Which metric |
|---------|-----------|--------------|
| **structured-output fail** | The model did not return a usable structured payload at all: no `tool_calls` with the forced `emit_result` name (`minimax.ts:112`), or `json_object` content that `JSON.parse` rejects (`validate.ts:safeJsonParse` → undefined). Counted on the **initial attempt** (attempt 0). | `structured_output_fail_rate` |
| **zod fail (repaired)** | JSON parsed but `schema.safeParse` failed, then a reprompt round-trip produced a valid object. Non-terminal. Count the repair. | `zod_fail_rate` numerator (repair-succeeded) — reported separately from terminal |
| **zod fail (terminal)** | Attempts exhausted → `LLMValidationError` thrown (`validate.ts:107`). The case is a hard failure. | `zod_fail_rate` numerator (terminal) AND excluded from quality-correct |
| **clean** | Parsed + validated on attempt 0, no repair. | neither failure metric |

- **Report shape:** `zod_fail_rate = { repaired: n/total, terminal: n/total }` — keep repaired and terminal separate (a model that always repairs on the 2nd try is costlier and slower but not *wrong*; a model that goes terminal is *wrong*). `structured_output_fail_rate` = initial-attempt no-parse rate.
- **Never crash the run:** a terminal zod fail is a recorded datapoint, not an exception that aborts the harness. Wrap each case; on `LLMValidationError` record `outcome:"terminal-zod-fail"` and continue. `[CITED: CONTEXT.md — "la tasa de fallo zod ES una métrica, no un crash"]`

### Quality per task (each task's real failure mode)
| Task | Scoring | Precedent |
|------|---------|-----------|
| **routing** | single-label top-1: ¿qué tarea/tier es este input? cobertura + errores, **abstención first-class** (null → no-cubierto, NUNCA error) | generalize `cruces evaluarGolden` `[VERIFIED: packages/cruces/src/golden/golden-set.ts:128-172]` |
| **clasificación** | single-label top-1 + abstención — idéntico a cruces sector (`correcto` / `no-cubierto` / `misclasificación`) | reuse cruces scoring verbatim |
| **juez/validación** | conditional accuracy vs **human label** (§ Judge-Set Methodology). 106 DEFINES the set+scoring; Phi-vs-human measurement is 107 | new (see below) |
| **paridad-extracción** | **schema-parse-rate SEPARATE from field-value accuracy** (Cleanlab); + literal-fidelity precision/recall by normalized substring + **negation/es-CL** fidelity; the failure mode is *fabricating/hallucinating text* | generalize `fichas evaluarGolden` incl. its adversarial-fabrication meta-test `[VERIFIED: packages/fichas/src/golden/golden-set.ts:459-523]` |

**Keep the fichas "gate puede fallar" meta-test pattern** (`IDS_CASOS_ADVERSARIOS`, `GOLDEN_SET_ADVERSARIO` — `golden-set.ts:416`): isolated adversarial cases that force the failure branch to be reachable, proving the metric is *alive*, not a tautology. Replicate this per task so no gate is theater.

## Judge-Set Methodology (juez/validación — set + scoring DEFINED in 106; Phi-vs-human is 107)

- **Model the judge golden as `(candidate_answer, human_label)` pairs.** Each case = an answer to a task (e.g., a proposed sector, or a proposed idea_matriz extraction) + a human boolean/verdict `ok` = "is this answer actually correct?" The judge's job under test is: given the answer, does its verdict match the human label?
- **Conditional accuracy (the metric that matters — Pitfall 1/2):** report *"when the judge says OK, how often is the answer actually right?"* (precision of the OK verdict) and *"when the answer is wrong, how often does the judge catch it?"* (recall of rejection). A judge that rubber-stamps (100% OK) scores near-0 rejection-recall → exposed. `[CITED: PITFALLS.md Pitfall 1; SUMMARY.md — "conditional accuracy: when Phi says OK, how often is the small responder actually right"]`
- **Bias-metric HOOKS to leave in the type (measured in 107, defined in 106):** the `CasoJuez` shape and scorer must carry fields/slots so 107 can measure without re-freezing the set:
  - **self-preference:** tag each answer with which model family produced it; the scorer can later compute verdict-rate-by-producer.
  - **position bias:** for any pairwise judging, store both orderings (A-then-B and B-then-A) so 107 can measure order sensitivity.
  - **verbosity bias:** store answer length; 107 correlates verdict with length.
  `[CITED: PITFALLS.md Sources — Justice or Prejudice? / Self-Preference Bias arXiv 2410.21819]`
- **Calibration methods (scope only, not full impl in 106):** the escalation/verdict signal must be **calibrated on held-out es-CL labels** (isotonic regression or Platt scaling), NOT a hand-picked threshold. 106 deliverable = a **held-out calibration split** carved from the judge golden (disjoint from the scoring split) + the `Reporte` field to hold a reliability curve (bins of predicted-confidence vs observed-accuracy). Full isotonic/Platt fit + reliability diagram is a 107 measurement; 106 leaves the *data split* and the *report slot*. `[CITED: PITFALLS.md Pitfall 6; SUMMARY.md Research Flags — "calibration methodology (isotonic/Platt on held-out es-CL labels)"]`
- **The judge NEVER approves in this design.** Its measured power is escalate-only (Pitfall 1) — but that is a 107/TIER concern. In 106 we only measure whether its verdicts agree with humans.

## Golden-Set Construction & Anti-Leakage (BENCH-02)

### Stratification axes (expose the REAL failure modes, per Pitfalls 2/8/9)
Stratify each task's `casos.json` by the axes that surface silent degradation on es-CL legal text — not by volume:
| Axis | Values | Failure mode it exposes |
|------|--------|-------------------------|
| **Document format** | XML-clean (Senado/Cámara doGet) vs scanned/OCR'd-PDF (BCN norms, agenda PDFs) | small-model degradation on noisy text (Pitfall 2) |
| **Legal register** | archaic/formulaic ("DFL N° 1", "deróganse los incisos") vs modern plain | es-CL legal-term fidelity (Pitfall 8) |
| **Length** | short single-norma vs long multi-norma amendment | constraint-drop on long prompts (Pitfall 13) |
| **Chamber / source** | Cámara vs Senado vs BCN/LeyChile | source-specific phrasing |
| **Negation presence** | cases WITH a load-bearing negation | dropped-negation → inverted legal meaning (Pitfall 8) |

Cover each axis; the report tallies per-stratum accuracy so a model that passes overall but fails on scanned-PDF/negation is caught.

### Sourcing from the REAL corpus (NO invented text, NO PII/RUT)
- **Source pools (all public, non-PII):**
  - `idea_matriz` + `cuerpos_legales` from fichas real extractions → paridad-extracción set.
  - `sector` classifications from cruces (has existing gold labels) → clasificación set.
  - `tramitación`/`citación` metadata → routing set.
  - Existing gold labels (cruces sector) reused as **seeds**, but see anti-leakage.
- **NO-PII by construction:** idea_matriz/sector/tramitación are public bill/legislative data. **No case carries a RUT or personal identifier.** The `assertNoRutInLlmInput` guard (`data-routing.ts`) runs inside every provider anyway, but the golden itself must be RUT-free — add a **static guard test** scanning `casos.json` for RUT patterns (§ CI guards). Adjudication corpus is OFF-LIMITS (golden-1263 untouched, LOCKED).
- **Labeling by D-06 (LLM-propone + HUMANO-valida = el golden).** Where a gold label already exists (cruces sector), reuse it as a seed but do NOT re-expose it as a prompt exemplar to the model under test (anti-leakage below).

### Anti-leakage: disjoint example-pool vs eval-pool + a guard that BITES
- **Two disjoint pools by construction:** `prompt_exemplars/` (few-shot exemplars fed to the model) and `casos.json` (eval). No boletín/entity ID may appear in both. `[CITED: PITFALLS.md Pitfall 3; SUMMARY.md Sources — leakage arXiv 2407.07565]`
- **Guard-que-muerde (repo culture — 9 v10.0 guards, all vitest tests run by `pnpm test` in `ci.yml`, static, no network `[VERIFIED: .github/workflows/ci.yml:44-48]`):** a `disjuncion.test.ts` that:
  1. loads both pools, asserts `exemplarIds ∩ evalIds = ∅` (fails CI loud if any ID appears in both),
  2. asserts every `casos.json` case is RUT-free (regex scan),
  3. asserts the frozen-hash marker matches (see freezing).
  This mirrors the lockdown-guard "static test enumerating X and asserting invariant" pattern.

### Freezing mechanism (immutable `casos.json` + hash marker)
- Precedent: "golden congelado ANTES del schema" (golden 32/1263). `[CITED: PITFALLS.md Pitfall 2; SUMMARY.md]`
- Compute `sha256(casos.json)` at freeze time; store it in a checked-in `casos.freeze.json` (`{ hash, fecha, n_casos, estratos }`). The disjunction guard asserts the live file's hash equals the marker → any edit after freeze fails CI until the marker is deliberately re-cut (a reviewed act, not a silent drift).
- **Order:** freeze the four sets BEFORE any 107 adapter integration (LOCKED). The freeze marker is the artifact 107 depends on.

### Size (follow precedent scale)
~40 casos/tarea with a curated gate-sample (cruces uses ~40 total with a 10-case `muestra` gate; fichas uses ≥15 gate cases `[VERIFIED: packages/fichas/src/golden/golden-set.test.ts:45]`). **Prioritize stratum coverage over volume.** Note: PITFALLS.md warns 32 cases is below the 50–500 pre-merge bar the routing literature recommends — so favor the upper end (~40+) and document the small-N caveat on p95/quality confidence intervals.

## Harness Architecture (confirm placement + CI/LIVE split)

- **`packages/llm-bench` (`@obs/llm-bench`) sits OUTSIDE `@obs/llm`.** It `depends on @obs/llm` (imports the real providers + contracts); `@obs/llm` NEVER depends on it. This mirrors the existing split where golden sets live in the *consumer/domain* package, never in the runtime lib — keeping test/eval deps out of the Deno/edge runtime. `[VERIFIED: .planning/research/ARCHITECTURE.md:123-134]`
- **Invocation via `LLMProvider`, host-agnostic (baseURL-swap ready for 107):** the harness drives *any* `LLMProvider`. In 106 it drives real `DeepSeekProvider`/`MiniMaxProvider` (LIVE) and `MockProvider` (CI). In 107, Granite/Phi adapters plug in by baseURL with zero harness change — the Workers AI Granite endpoint (`https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`, `@cf/ibm-granite/granite-4.0-h-micro` `[CITED: STACK.md ADDENDUM]`) is just another `baseURL`. The harness must be endpoint-agnostic so 107 only supplies the adapter.
- **CI vs LIVE split (LOCKED precedent — `fichas`/`cruces` golden-set.test.ts):**
  - **CI (default, no network, deterministic):** `ejecutar` uses `MockProvider` (`packages/{fichas,adjudication}/src/mock-provider.ts` patterns). The golden gate + guards run here. Fast, free, no flakiness. `[VERIFIED: packages/fichas/src/golden/golden-set.test.ts:1-15, 43]`
  - **LIVE (env-gated, NOT in CI):** e.g. `LLM_BENCH_LIVE === "1"` swaps the mock for the real provider and records the baseline metrics. Skipped by default — never burns quota in CI. Mirror `FICHAS_GOLDEN_LIVE` exactly.
- **Report, not auto-merge-verdict (106 boundary):** the harness emits a `Reporte` (JSON + legible table). It does NOT gate a merge on candidate parity in 106 (that's BENCH-05/107). The frozen golden *does* gate CI as a mock regression floor.

### Report type (keep metrics SEPARATE — LOCKED)
```ts
// packages/llm-bench/src/report.ts
export interface MetricasModelo {
  modelo: string;              // concrete model id
  endpoint: string;            // baseURL — provenance (BENCH-03)
  tarifaFecha: string;         // pricing.fecha
  calidad_por_tarea: Record<TaskId, QualityScore>;  // task-specific shape
  latencia_p50_ms: number;
  latencia_p95_ms: number;     // labeled small-N indicative
  n_muestras: number;          // so p95 uncertainty is legible
  costo_por_1k: number | null; // null if host omits usage
  zod_fail_rate: { repaired: number; terminal: number };
  structured_output_fail_rate: number;
}
export interface Reporte {
  fecha: string;
  pricingFecha: string;
  modelos: MetricasModelo[];
  // a "nada aprueba paridad" outcome is fully expressible: every candidate
  // simply shows its numbers; no field forces an approval.  [CITED: CONTEXT.md specifics]
}
```

### Anti-patterns to avoid
- **Measuring through `complete()` and inferring cost from string length** — `complete()` hides `usage`; guessing tokens is wrong. Instrument the real call.
- **Stripping repair round-trips from latency/cost** — a model that repairs twice IS slower/costlier; the math must include them (Pitfall 7).
- **One "accuracy" number for extraction** — schema-parse-rate and field-value accuracy are different things; a 100%-parse / wrong-value model is a defamation risk, not a win (Cleanlab, Pitfall 4).
- **Reporting Ollama-local latency as candidate latency** — quality-only from local; latency/cost from the served host (Pitfall 9).
- **Reusing golden cases as few-shot exemplars** — self-referential benchmark (Pitfall 3).

## Baseline Readiness (BENCH-03) — and the "no new secret" check

- **106 baselines TODAY's incumbents: DeepSeek V4 + MiniMax.** Both keys already exist in `.env` (`DEEPSEEK_API_KEY`, `MINIMAX_API_KEY` — present in `.env.example` with empty placeholders `[VERIFIED: .env.example]`). The harness LIVE block instantiates the real `DeepSeekProvider`/`MiniMaxProvider` and records their per-task metrics as the parity floor 107 measures candidates against.
- **NO NEW SECRET is required in 106.** Confirmed:
  - Baseline uses existing DeepSeek/MiniMax keys.
  - The candidate endpoints (Workers AI/OpenRouter) are a **107** concern (adapters + real-host measurement).
  - Workers AI baseURL needs `CLOUDFLARE_ACCOUNT_ID` + an AI token — **but that is 107**. Note: `.env.example` currently has **no `CLOUDFLARE_ACCOUNT_ID`/AI-token entry** `[VERIFIED: grep of .env.example]`; that placeholder is a 107 task (add empty placeholder to `.env.example` + real value to `.env`, guard-green). **If the planner finds 106 needs it, that is a signal 106 has absorbed 107 scope — push it back.**
  - **Flag:** if the planner scopes any candidate (Granite/Phi) run into 106, it crosses into needing a new secret → violates the LOCKED "en 106 no se necesita key nueva." Keep candidates in 107.
- **Endpoint provenance in the baseline:** even the baseline records `endpoint` (DeepSeek `https://api.deepseek.com`, MiniMax `https://api.minimax.io/v1`) + `tarifaFecha` so numbers are traceable and 107 re-measures candidates on their served host (never a different host — BENCH-03 LOCKED).

## Runtime State Inventory

> This is a greenfield package addition (new `packages/llm-bench` + new golden `casos.json` files). No rename/refactor of existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — golden `casos.json` are new checked-in files; no DB writes in 106 | none |
| Live service config | None — harness is offline (CI mock) / operator-run (LIVE); no cron/service registration in 106 | none |
| OS-registered state | None | none |
| Secrets/env vars | Reuses existing `DEEPSEEK_API_KEY`/`MINIMAX_API_KEY`; **no new secret** (§ Baseline Readiness) | none in 106 |
| Build artifacts | New `@obs/llm-bench` package appears in pnpm workspace + `tsc -b` references graph | add to workspace; `references` (NOT `paths`) per repo convention `[VERIFIED: CLAUDE.md conventions]` |

## Common Pitfalls (106-specific slice of PITFALLS.md)

### Pitfall A: Measuring through `complete()` (metrics are invisible)
**What goes wrong:** the harness calls `complete()`, gets a clean `T`, and has nothing to report for cost/latency/zod-fail.
**Why:** `complete()` returns validated `T` only; `usage`/latency/repair live inside the adapter (`validate.ts`, `minimax.ts`).
**Avoid:** instrument via injected `fetchFn` around the real provider (captures `res.usage`, times the call, sees repairs). Measure the real path.
**Warning sign:** cost column is all `0` or derived from `answer.length`.

### Pitfall B: Folding zod-fail into quality (over-recommends small models — LOCKED)
**Avoid:** keep `structured_output_fail_rate`, `zod_fail_rate.{repaired,terminal}` as SEPARATE fields; a small model that "passes quality on the cases it managed to structure" while failing structure 30% of the time must look *bad*, not good.

### Pitfall C: Self-referential benchmark (golden cases as exemplars)
**Avoid:** disjoint `prompt_exemplars/` vs `casos.json` + a biting CI guard asserting `∩ = ∅` (Pitfall 3).

### Pitfall D: Ollama-latency laundering (Pitfall 9)
**Avoid:** local runs measure QUALITY only; tag every latency/cost with its endpoint; candidate latency/cost is measured on the served host in 107.

### Pitfall E: p95 false precision on N=40
**Avoid:** nearest-rank (no interpolation), report N, label p95 indicative.

### Pitfall F: A gate that can't fail (theater)
**Avoid:** replicate the fichas adversarial meta-test per task — isolated fabrication/misclassification cases proving the failure branch is reachable (`IDS_CASOS_ADVERSARIOS` pattern).

## Code Examples

### Nearest-rank percentile (small-N safe, dependency-free)
```ts
// packages/llm-bench/src/metrics.ts
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}
// p50/p95 = percentile(latencies, 50) / percentile(latencies, 95)
```

### Instrumented call capturing usage + latency (fetch-wrapper over the real provider)
```ts
// packages/llm-bench/src/instrument.ts  — Source pattern: deepseek.ts:39 / minimax.ts:43 (fetchFn injectable)
export function instrumentedFetch(base: typeof fetch, sink: (m: CallMetric) => void): typeof fetch {
  return async (input, init) => {
    const t0 = performance.now();
    const res = await base(input, init);
    const clone = res.clone();
    const body = await clone.json().catch(() => undefined);
    sink({
      latencyMs: performance.now() - t0,
      promptTokens: body?.usage?.prompt_tokens,      // [CITED: openai chat completion → usage]
      completionTokens: body?.usage?.completion_tokens,
    });
    return res;
  };
}
// new DeepSeekProvider({ apiKey, fetchFn: instrumentedFetch(fetch, recordMetric) })
```

### Freeze marker + guard (Source: repo guard-que-muerde culture, ci.yml:44-48)
```ts
// packages/llm-bench/src/tasks/routing/disjuncion.test.ts
import { createHash } from "node:crypto";
it("casos.json frozen: hash matches marker", () => {
  const raw = readFileSync(CASOS_PATH, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex");
  expect(hash).toBe(FREEZE.hash);        // edit after freeze → CI fails until re-cut
});
it("exemplar pool ∩ eval pool = ∅", () => {
  expect(exemplarIds.filter(id => evalIds.has(id))).toEqual([]);
});
it("no RUT in any golden case", () => {
  expect(RUT_RE.test(raw)).toBe(false);  // NO-PII by construction
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One "accuracy" number per model | schema-parse-rate SEPARATE from field-value accuracy | Cleanlab 2026 `[CITED: SUMMARY.md Sources]` | prevents 100%-parse/wrong-value false wins |
| Hand-picked confidence threshold | calibration (isotonic/Platt) on held-out labels | cascade lit 2605.18796 `[CITED: PITFALLS.md]` | 106 leaves the split + report slot; 107 fits |
| Judge vs responder agreement | judge vs HUMAN labels, conditional accuracy | judge lit `[CITED: PITFALLS.md Pitfall 1]` | 106 golden = `(answer, human_label)` pairs |
| Benchmark on convenient host | pin exact prod endpoint/quantization | quantization lit `[CITED: PITFALLS.md Pitfall 9]` | endpoint provenance in every metric row |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nearest-rank (no interpolation) is the right percentile convention for these small sets | Metric Methodology | LOW — either convention is defensible; report N regardless |
| A2 | DeepSeek/MiniMax responses include a standard `usage` object via openai@5 | Metric Methodology / Code | MEDIUM — if a host omits it, cost falls back to `null` (already handled); verify at first LIVE run |
| A3 | ~40 casos/tarea (precedent scale) is sufficient given stratum-coverage priority | Golden-Set Construction | MEDIUM — PITFALLS notes 32 is below the 50–500 lit bar; document small-N caveat, favor upper end |
| A4 | Exact DeepSeek/MiniMax per-1M rates | Cost formula | MEDIUM — pricing is explicitly re-verified in 107 (LOCKED); table is dated |
| A5 | `res.clone().json()` reliably reads `usage` from the intercepted response body | Code Examples | MEDIUM — verify the openai@5 fetch path exposes a cloneable body; fallback = option-2 harness-owned call |

## Open Questions

1. **Instrument the real provider (fetch-wrapper) vs harness-owned faithful clone?**
   - Known: fetch-wrapper measures the exact prod path (Pitfall 4-safe); clone gives direct usage access.
   - Unclear: whether `res.clone().json()` cleanly surfaces `usage` under openai@5's fetch handling (A5).
   - Recommendation: start with fetch-wrapper (option 1); if usage isn't cleanly interceptable, fall back to the faithful clone kept byte-aligned with the MiniMax adapter.

2. **`costo_por_1k` = per-1k-tokens or per-1k-cases?**
   - Known: both are computable from `usage`.
   - Recommendation: report per-1k-**cases** (operator-legible "what does 1000 classifications cost") AND raw per-1M in/out; name each unambiguously.

3. **Judge golden: pairs vs rubric (operator left to discretion)?**
   - Recommendation: `(answer, human_label)` pairs — directly yields conditional accuracy and the bias hooks; simpler to freeze than a rubric.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai@5` | instrumented call | ✓ (in-repo) | 5.x | — |
| DeepSeek API key | LIVE baseline | ✓ | `.env` `DEEPSEEK_API_KEY` | mock-only (CI) |
| MiniMax API key | LIVE baseline | ✓ | `.env` `MINIMAX_API_KEY` | mock-only (CI) |
| Ollama (local) | optional quality spike | ? (operator machine) | — | skip local; baseline is DeepSeek/MiniMax hosted |
| Real corpus (fichas/cruces/tramitación) | golden sourcing | ✓ (in-repo packages) | — | — |

**Missing dependencies with no fallback:** none — 106 baseline needs only existing keys.
**Missing dependencies with fallback:** Ollama (candidate quality spike is 107; skip if absent).

## Validation Architecture

> `workflow.nyquist_validation` treated as enabled (key absent).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (per-package, `pnpm test`) |
| Config file | per-package `vitest.config` (mirror `packages/fichas`) — **may be a Wave 0 gap for the new package** |
| Quick run command | `pnpm --filter @obs/llm-bench test` |
| Full suite command | `pnpm test` (root — includes 9 v10.0 guards) `[VERIFIED: ci.yml]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BENCH-01 | metrics kept separate (`percentile`, cost, zod-fail split, structured-output-fail) — pure functions | unit | `pnpm --filter @obs/llm-bench test metrics` | ❌ Wave 0 |
| BENCH-01 | harness runs a golden set via MockProvider, produces a `Reporte` | unit (mock, no net) | `pnpm --filter @obs/llm-bench test harness` | ❌ Wave 0 |
| BENCH-01 | each per-task scorer (routing/clasif/juez/extracción) — incl. adversarial "gate can fail" meta-test | unit | `pnpm --filter @obs/llm-bench test tasks` | ❌ Wave 0 |
| BENCH-02 | pool disjunction ∩=∅; no-RUT scan; frozen-hash match | guard (static, no net) | `pnpm --filter @obs/llm-bench test disjuncion` | ❌ Wave 0 |
| BENCH-02 | golden gate as mock regression floor (per task) | gate (mock) | `pnpm --filter @obs/llm-bench test golden` | ❌ Wave 0 |
| BENCH-03 | baseline vs real DeepSeek/MiniMax records endpoint+tarifaFecha | LIVE-gated (NOT in CI) | `LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench test live` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/llm-bench test` (mock + guards, fast, no net)
- **Per wave merge:** `pnpm test` (root — new package tests + 9 existing guards stay green; tsc 0)
- **Phase gate:** full suite green + four golden sets frozen (hash markers committed) before `/gsd:verify-work`; LIVE baseline run once by operator (records the report artifact).

### Wave 0 Gaps
- [ ] `packages/llm-bench/vitest.config.*` + `package.json` (`@obs/llm-bench`, dep `@obs/llm`, `references` in tsconfig)
- [ ] `packages/llm-bench/src/metrics.ts` + `.test.ts` — percentile, cost, zod-fail split
- [ ] `packages/llm-bench/src/{report,pricing,instrument}.ts`
- [ ] `packages/llm-bench/src/tasks/{routing,clasificacion,juez,extraccion}/{casos.json, casos.freeze.json, scorer.ts, *.test.ts, disjuncion.test.ts}`
- [ ] `prompt_exemplars/` per task (disjoint from `casos.json`)
- [ ] LIVE baseline test file (env-gated) mirroring `fichas/golden-set.test.ts` LIVE block

## Security Domain

> `security_enforcement` treated as enabled. 106 handles NO PII (golden sets are public non-PII data) and adds NO runtime path — but the PII-by-construction and secret-hygiene invariants still apply.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | zod parse-at-load on `casos.json`; `parseAndValidate` is the measured gate |
| V6 Cryptography | yes | `sha256` freeze marker (integrity, not secrecy) — Node `crypto`, never hand-rolled |
| V7 Data Protection / minimization | yes | NO-RUT guard on golden; harness never logs prompt/answer payloads (mirror `LLMValidationError` — issues only) `[VERIFIED: validate.ts:23-35]` |
| V2/V3/V4 Auth/Session/Access | no | 106 is an offline harness + checked-in fixtures; no auth surface |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RUT/PII leaks into a golden case → crosses to LLM at LIVE run | Information Disclosure | NO-RUT static guard on `casos.json`; corpus sourced from public bill data only; adjudication corpus off-limits |
| Golden edited after freeze (silent gate drift) | Tampering | sha256 freeze marker asserted in CI guard; re-cut is a reviewed act |
| Secret sprawl (new key added prematurely) | — | 106 adds NO secret; `.env.example` placeholder-without-value discipline is a 107 concern |
| Benchmark laundering (Ollama latency as candidate) | Repudiation of true numbers | endpoint provenance tag on every metric row; candidate host measurement deferred to 107 |

## Sources

### Primary (HIGH confidence — read directly)
- `packages/llm/src/types.ts` — `LLMProvider.complete<T>` returns validated `T` only (no usage/latency surfaced) — the load-bearing constraint
- `packages/llm/src/validate.ts` — `parseAndValidate` repair loop, `LLMValidationError` (issues-only, no payload) — defines the zod-fail outcomes
- `packages/llm/src/providers/{deepseek,minimax}.ts` — tool_choice+zod template; `fetchFn` injectable (instrumentation hook); fail-closed asserts
- `packages/cruces/src/golden/golden-set.ts` — single-label top-1 + abstención scorer (routing/clasificación precedent)
- `packages/fichas/src/golden/golden-set.ts` + `golden-set.test.ts` — literal-fidelity precision/recall, parse-vs-value separation, adversarial "gate can fail" meta-test, CI-mock/LIVE-gated split
- `.github/workflows/ci.yml` — guards = static vitest tests via `pnpm test`, no network
- `.env.example` — `DEEPSEEK_API_KEY`/`MINIMAX_API_KEY` present; no `CLOUDFLARE_ACCOUNT_ID` (confirms no-new-secret in 106)
- `.planning/research/{SUMMARY,ARCHITECTURE,STACK,PITFALLS}.md` — milestone research (harness-out-of-runtime, Workers AI addendum, all measurement pitfalls)

### Secondary (MEDIUM — cited in milestone research)
- Cleanlab — schema-valid vs field-value accuracy separation
- arXiv 2605.18796 (UCCI), 2604.19781 — calibration > threshold tuning
- arXiv 2410.21819, "Justice or Prejudice?" — judge bias metrics (self-preference/position/verbosity)
- arXiv 2407.07565, 2406.04244 — few-shot leakage / eval contamination
- STACK.md ADDENDUM — Workers AI Granite endpoint (107 readiness)

### Tertiary (LOW / to verify at run time)
- Exact DeepSeek/MiniMax per-1M pricing (re-verified in 107) `[ASSUMED]`
- `res.clone().json()` cleanly exposes `usage` under openai@5 fetch handling (verify first LIVE run) `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Metric methodology: HIGH — formulas grounded in code (validate.ts outcomes, usage object) + cited literature
- Golden-set construction: HIGH — direct generalization of two working precedents + cited anti-leakage lit
- Harness architecture/placement: HIGH — ARCHITECTURE.md + real package-split precedent
- Baseline/no-new-secret: HIGH — verified against `.env.example` and requirement mapping
- Pricing exactness: MEDIUM — deferred to 107 by LOCKED decision

**Research date:** 2026-07-26
**Valid until:** 2026-08-25 (stable — internal code + methodology; pricing is the only fast-moving item and is 107's job)
