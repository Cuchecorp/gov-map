# Pitfalls Research

**Domain:** Adding a tiered LLM cascade (respond→validate→escalate) to a production extraction/classification pipeline for a civic-accountability platform with defamation/legal risk and an all-Chilean-Spanish legal corpus (v11.0 — SEED-001)
**Researched:** 2026-07-26
**Confidence:** HIGH (verified against arXiv 2024-2026 cascade/judge/quantization literature + model cards; MEDIUM where model-specific Spanish numbers are inferred)

> **Reading guide.** This system is NOT greenfield. It already has: `LLMProvider` enchufable (openai SDK multi-baseURL), zod validation per provider, golden-set CI gates (búsqueda 32, identidad 1263), fail-closed reconciliation, "RUT never crosses to LLM" guard, and the operator's LOCKED rule **"ante la duda, SIEMPRE calidad."** Every pitfall below is framed as *what breaks when you bolt tiering onto THIS*. The dominant failure mode of this milestone is **silent quality degradation that a green CI does not catch** — because a cheaper model that passes the golden set but is worse on the live distribution produces a *false, credible* claim (riesgo existencial #1), which is a legal event, not a latency regression.

---

## Critical Pitfalls

### Pitfall 1: Judge weaker than the responder (silent validation theater)

**What goes wrong:**
The seed proposes Phi-4-mini (3.8B) as *juez/validador* of outputs that may come from DeepSeek V4 or MiniMax. A judge cannot reliably detect errors that require capability beyond its own ceiling — it rubber-stamps subtly-wrong extractions of legal text and mis-adjudicated identities, so the "validate" step reports HIGH confidence on exactly the outputs that most need escalation. The cascade *looks* safer than the current two-model system while being *less* safe.

**Why it happens:**
Cascade tutorials frame the judge as a cheap gate; teams assume "any second opinion helps." The literature is explicit: a weaker model cannot recognize quality patterns beyond its own capability ceiling, and hints from a weaker LLM when it is uncertain do not help the stronger LLM. On Spanish legal text (see Pitfall 8) Phi's ceiling is lower still.

**How to avoid:**
- Never let a small judge *gate* a task where its measured task-accuracy is below the responder's. Phi is allowed as a **second opinion that can only trigger escalation, never suppress it** — exactly the seed's "Phi solo como segunda opinión, jamás degrada la adjudicación." Encode this as: judge disagreement → escalate; judge agreement → **still** apply the existing zod + golden gate, never short-circuit.
- Prefer **asymmetric-safe** validation: the judge's only power is to raise the tier, never to approve a bypass of existing gates.
- Measure judge–responder agreement against **human labels**, not against the responder (agreeing with a wrong responder is worthless).

**Warning signs:**
- Judge approval rate ≈ 100% on a task where the responder's golden-set accuracy is <95%.
- Escalation rate near 0% on the identity/extraction tasks.
- CI green but spot-checks of live outputs find errors the judge "passed."

**Phase to address:** SPIKE (benchmark per task must report judge accuracy vs **human** labels, and the *conditional* accuracy: "when Phi says OK, how often is the small responder actually right?"). Gate: judge only earns gating power if it beats the responder on that task.

---

### Pitfall 2: Cheap model passes the golden set but is worse on the live distribution (benchmarking the wrong distribution)

**What goes wrong:**
Granite/Phi are benchmarked on the *existing* golden sets (búsqueda 32, identidad 1263) — which were curated to catch *known* failure classes and are heavily weighted toward clean cases. A small model can hit parity on those 32/1263 while degrading on the long tail of real Chilean bill text (scanned PDFs, archaic legal formulae, multi-norma amendments). CI stays green; production quality silently drops. This is the single most dangerous failure for this project: silent quality regression surfaces as a *false published claim*, not a dashboard blip.

**Why it happens:**
Golden sets are small and were built as regression tripwires for a *specific* model's mistakes, not as a representative sample of the production distribution. Model selection that optimizes the eval set overfits to it (a recognized contamination/overfitting vector). 32 cases is far below the 50–500-case pre-merge gate the routing literature recommends.

**How to avoid:**
- Before tiering, **expand each task's golden set to a stratified sample of the live distribution** (by source: Cámara doGet vs Senado XML vs BCN obtxml; by document quality: clean vs scanned; by era). Freeze it *before* touching schema (the v9.0 "golden congelado ANTES del schema" precedent).
- Add **shadow evaluation**: run the candidate small model in parallel with the incumbent on live traffic, diff outputs, human-review disagreements — do not route real users to it until the diff distribution is understood.
- Report a **disagreement-with-incumbent rate on live data**, not just golden accuracy.

**Warning signs:**
- Golden-set accuracy is high but shadow-diff rate vs DeepSeek/MiniMax is >5%.
- The golden set has not grown when new source types (opendata votes, scanned norms) were added.
- "It passes 32/32" used as the sole go/no-go.

**Phase to address:** SPIKE (build stratified per-task eval + shadow harness *first*). Integration phase must keep shadow on for the low-risk task before promoting.

---

### Pitfall 3: Golden-set leakage into prompts (self-referential benchmark)

**What goes wrong:**
The tiered design uses few-shot examples / prompt-forced structure (the stack rule for providers without `json_schema`). If those few-shot exemplars are drawn from — or are near-duplicates of — the golden set, every candidate model "has seen the answer." The benchmark then measures memorization of the prompt, not task capability, and picks the wrong model.

**Why it happens:**
Convenient reuse: the golden set is the highest-quality labeled data on hand, so it gets pasted into both the prompt and the eval. Few-shot leakage is a named contamination mode — few-shot exemplars and eval cases must live in strictly separate pools.

**How to avoid:**
- **Strict pool separation**: `prompt_exemplars/` and `golden_eval/` are disjoint by construction, enforced by a test that fails if any boletín/entity ID appears in both.
- Prefer synthetic-but-representative exemplars, or exemplars from a *held-out era* not in the eval.
- When comparing models, keep the exemplar set **identical and fixed** across all candidates.

**Warning signs:**
- The same boletín appears in a prompt template and in `golden_eval`.
- A model's golden accuracy collapses when exemplars are swapped for held-out ones.

**Phase to address:** SPIKE (harness design). Add a CI guard (mirrors existing linter/guard culture) asserting disjoint pools.

---

### Pitfall 4: Comparing models across different structured-output modes (apples-to-oranges benchmark)

**What goes wrong:**
DeepSeek supports `json_object`; MiniMax needs tool-calling; Granite/Phi via OpenAI-compat endpoints may support neither reliably (the CLAUDE.md rule: never assume `response_format json_schema` universal). If the benchmark lets each model use its "best" structured mode, differences in the *harness* masquerade as differences in *model quality* — and worse, a model can win on schema-validation-rate while losing on field-level value accuracy.

**Why it happens:**
Each provider's SDK path is the path of least resistance, so the benchmark accidentally varies two things at once (model AND output mode). Research shows structured-output APIs enforce schema compliance more reliably but can *reduce* field-level value accuracy vs instruction-following prompts — so "which mode" changes the ranking.

**How to avoid:**
- Fix the output contract at the **zod schema**, and measure two metrics separately per model: (a) **schema-valid rate** (does it parse?) and (b) **field-value accuracy** (are the values right vs human label?). A model that is 100% schema-valid but wrong on `idea_matriz` text is a defamation risk, not a win.
- For each model, pick its *most reliable* mode empirically but **report the mode used** and hold the *evaluation* metric identical.
- Re-run the zod gate for every model in the benchmark exactly as production will (no lenient parsing in the harness).

**Warning signs:**
- Benchmark table reports one accuracy number without separating parse-rate from value-accuracy.
- The winning model uses a different output mode than the one it will use in prod.
- zod retries are silently swallowed in the harness but counted as latency/cost in prod.

**Phase to address:** SPIKE (metric design: parse-rate + value-accuracy, mode logged per model).

---

### Pitfall 5: Degrading the CRITICAL identity-adjudication path (riesgo existencial #1)

**What goes wrong:**
Identity adjudication (today MiniMax at umbral 0.90, golden 1263) is the load-bearing subsystem: a wrong match produces a false, credible public claim about a named politician. Introducing a small responder or a small judge *anywhere* in this path — even "just for pre-filtering obvious matches" — creates a route where a Granite/Phi false-positive slips a bad adjudication through before MiniMax ever sees it.

**Why it happens:**
Cascades tempt teams to "handle the easy 80% cheaply." But adjudication has no cheap-and-safe subset: the "obvious" matches are where a small model's overconfidence (Pitfall 6) does the most damage, and RUT (the strongest key) is deliberately withheld from the LLM.

**How to avoid:**
- **Adjudication path is off-limits to small responders.** The seed already says this ("jamás se degrada; Phi solo como segunda opinión"). Enforce architecturally: adjudication `LLMProvider` is pinned to MiniMax; the only permitted small-model role is a *second opinion that can escalate/flag for human review*, never approve.
- Keep the golden-1263 gate and the ≥0.95 CI threshold as a hard, unchanged gate for anything touching this path.
- Keep the "RUT never crosses" guard intact — verify the new tiers inherit the same PII redaction (Pitfall 12).

**Warning signs:**
- Any config where an adjudication request can resolve without MiniMax.
- Escalation-loop cost pressure creates a temptation to "route easy adjudications to Granite."
- golden-1263 pass rate dips even 0.5%.

**Phase to address:** Integration phase, but as an **explicit non-goal / guard**, not a feature. Start integration with the *lowest-risk* task (routing/classification), reach adjudication last or never.

---

### Pitfall 6: Small-model confidence miscalibration drives bad escalation decisions

**What goes wrong:**
The cascade decides escalate/stop from the small model's confidence. Small models are systematically miscalibrated and prompt-wording-sensitive — they are confidently wrong on hard cases and under-confident on easy ones. Result: hard, legally-sensitive cases *don't* escalate (false claim ships) while easy cases *do* escalate (cost blows up). A threshold tuned on the golden set fails on live traffic.

**Why it happens:**
Teams treat a self-reported confidence or token log-prob as if it were calibrated probability. The literature is blunt: calibration — not threshold tuning — is the part worth engineering; raw confidence signals are noisy and workload-specific.

**How to avoid:**
- **Calibrate** the escalation signal (e.g., isotonic/Platt fit on a held-out labeled set) rather than picking a raw-confidence threshold.
- Bias the calibration toward **over-escalation under uncertainty** — this *is* "ante la duda, SIEMPRE calidad" expressed numerically. Cost is the safe direction to fail; a false claim is not.
- Re-validate calibration per task and per source; do not reuse one threshold across routing/classification/extraction.

**Warning signs:**
- Escalation threshold is a hand-picked constant (e.g., "escalate if confidence < 0.8").
- Escalation rate is stable in the golden set but swings wildly on live data.
- Reliability diagram (confidence vs actual accuracy) is never plotted.

**Phase to address:** SPIKE (measure calibration, plot reliability curves per task) → Integration (implement calibrated router, per-task thresholds).

---

### Pitfall 7: Cascade adds MORE latency (and cost) than the single big model on escalation-heavy tasks

**What goes wrong:**
On a task where the small model is often insufficient, every request pays small-model time + judge time + big-model time *sequentially* — strictly worse than just calling the big model once. Extraction of dense legal text (DeepSeek's current home, with prompt-cache) is exactly this kind of task. The "optimization" makes the platform slower and more expensive.

**Why it happens:**
Cascade wins are real *only when most requests stop early*; the median-latency reductions (61–82%) reported in the literature assume the small tier resolves the majority. If the accuracy gap between tiers is insufficient or the small model rarely suffices, the cascade cannot identify what to escalate and the savings evaporate — you pay for all tiers plus routing overhead.

**How to avoid:**
- In the spike, compute **expected end-to-end latency and cost per task** = P(stop@small)·(t_small+t_judge) + P(escalate)·(t_small+t_judge+t_big). Compare against single-big-model baseline. **Only adopt tiering where this is a win.**
- Explicitly mark high-escalation tasks (dense extraction) as **stay-single-model** unless the small tier clears a high stop-rate bar.
- Account for zod-retry round-trips in the latency/cost math (a small model that fails schema and retries twice is not cheap).

**Warning signs:**
- Extraction p50 latency rises after tiering.
- Escalation rate >~40% on a task (rule of thumb: cascade rarely wins there).
- Cost per task exceeds the old DeepSeek-only cost.

**Phase to address:** SPIKE (per-task expected-cost/latency model is a required deliverable of the benchmark, not an afterthought).

---

### Pitfall 8: Spanish-language (Chilean legal register) quality gap in small models

**What goes wrong:**
The ENTIRE corpus is Chilean-Spanish legal text (ideas matrices, cuerpos legales, lobby materias, agenda). Phi-4 is ~92% English-trained; Microsoft's own card states non-English languages "experience worse performance." Granite-micro is likewise English-centric. A model that benchmarks fine on English SLM leaderboards can mangle Spanish legal phrasing — dropping a negation, mistranslating a legal term, or hallucinating a norma — which becomes a *published false statement*.

**Why it happens:**
Model marketing and generic benchmarks are English-first; teams extrapolate "it's a strong small model" to a domain (formal es-CL legal) where it was barely trained. Instruction-following and multilingual capability are the *first* things to degrade under both scale and quantization (Pitfall 9).

**How to avoid:**
- Benchmark **exclusively on the real Chilean-Spanish corpus** — English SLM benchmarks are irrelevant here and must not influence the decision.
- Weight the eval toward **negation, legal-term fidelity, and idea-matriz literalidad** (the existing "extracción literal" guardrail #2 already targets this — reuse its fidelity metric).
- Treat any Spanish-quality shortfall as a hard veto for that task, per "ante la duda, SIEMPRE calidad."

**Warning signs:**
- Model chosen on English benchmark scores.
- Spot-checks find dropped negations or invented norma citations in Spanish output.
- Fidelity metric drops vs DeepSeek even where "overall accuracy" looks similar.

**Phase to address:** SPIKE (Spanish-corpus-only benchmark with fidelity/negation metrics is mandatory).

---

### Pitfall 9: Quantization quality loss on serverless / hosted endpoints (invisible variable)

**What goes wrong:**
Granite/Phi accessed via a serverless OpenAI-compat host may be served **quantized** (Q4/Q8) without it being obvious. Quantization hits multilingual and instruction-following *first and hardest* (Q4_K_M dropped ~15–20% on Chinese eval; multilingual is the first thing to break), and smaller models are the fragile zone. So the model you benchmark (maybe FP16 locally) is not the model that serves prod (Q4 on the host) — a silent, uncontrolled quality variable stacked on top of the Spanish gap.

**Why it happens:**
Hosts rarely surface quantization level in the API; teams assume "same model name = same weights." Below 4-bit, degradation accelerates fast, and it magnifies a model's *existing* weaknesses (Spanish, exactly this project's weak spot).

**How to avoid:**
- **Benchmark against the exact endpoint/quantization that will serve production**, not a local FP16 copy. Pin the provider + model revision.
- Ask/verify the host's quantization; prefer endpoints that disclose it. Treat an undisclosed/variable quantization as a reason to distrust the endpoint.
- Re-run the golden gate if the host silently changes quantization (add an endpoint-drift canary — mirrors the existing provider-quirk vigilance).

**Warning signs:**
- Benchmark ran locally; prod uses a different host.
- Quality quietly drops with no code change (host re-quantized).
- Host cannot state the quantization level.

**Phase to address:** SPIKE (pin exact prod endpoint in benchmark) + Integration (endpoint-drift canary in CI/monitoring).

---

### Pitfall 10: Escalation loops and cost blow-ups (thrashing between tiers)

**What goes wrong:**
respond→validate→escalate can loop: small model answers, judge rejects, selector escalates, big model answers, a re-validation rejects again, retries… Combined with zod-retry loops per provider, a single hard document can trigger many paid calls. Under a public repo with hostile actors (the project's stated threat model), crafted inputs can *deliberately* trigger max-escalation on every request.

**Why it happens:**
No hard ceiling on tier transitions; validation and escalation are wired as "retry until pass." Adversarial inputs exploit exactly this — efficiency backfires when cascades trigger cascade-failure under attack.

**How to avoid:**
- **Bounded escalation:** at most one hop per tier, a global max-calls-per-request budget, and a terminal state = "escalate to human review / mark low-confidence" rather than infinite retry.
- Cap zod-retries per provider (e.g., 2) and count a persistent schema failure as a *fail-closed* outcome, not a loop.
- Rate-limit / budget per source and per session; alert on requests hitting the call ceiling (possible abuse).

**Warning signs:**
- A request issues >N model calls.
- Cost per request has a long tail far above median.
- One boletín repeatedly ping-pongs between tiers.

**Phase to address:** Integration (bounded router with hard budgets) — mirrors the existing "bounded RPC" discipline (LIMIT + statement_timeout).

---

### Pitfall 11: Breaking DeepSeek prompt-cache economics by routing mid-pipeline

**What goes wrong:**
DeepSeek's extraction economics depend on the long, stable prefix (system + schema + exemplars) hitting the disk cache (cache-hit ≈ $0.014/Mtok, ~90% cheaper). Inserting a small-model tier *in front of* extraction, or swapping providers *within* one extraction pipeline, invalidates the cached prefix — each swap re-writes full context at 1.25× instead of reading at 0.1×. The tiering meant to save money can 10× the extraction bill.

**Why it happens:**
Routing is designed per-request without regard to cache locality. The economics rule is explicit: **route between pipelines, not mid-session** — every step sharing accumulated context must stay on one family.

**How to avoid:**
- Keep extraction as a **single-family pipeline on DeepSeek** with its cached prefix intact; do the tiering *before* the request is classified into "goes to extraction," not inside it.
- Route **between** pipelines (a routing/classification tier decides *which* pipeline), never mid-pipeline provider swaps.
- Monitor `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`; alert when hit-rate drops below the breakeven floor after tiering ships.

**Warning signs:**
- DeepSeek cache-hit rate falls after tiering deploy.
- Extraction cost rises despite "cheaper" small models added.
- The same stable prefix is being rewritten per request.

**Phase to address:** Integration (route between pipelines; add cache-hit monitoring). Flag in SPIKE cost model.

---

### Pitfall 12: Provider-quirk drift breaks the zod gates / PII guard across new tiers

**What goes wrong:**
Each new provider (Granite host, Phi host) has its own structured-output quirks, tokenizer, and failure modes. If the new tiers are wired without extending the per-provider zod validation and the "RUT never crosses" redaction, one of them can (a) emit malformed JSON that a lenient path lets through, or (b) receive un-redacted PII because the guard was only applied on the old code path.

**Why it happens:**
The enchufable `LLMProvider` makes adding a baseURL trivial — too trivial. Teams add the endpoint but forget that the zod gate, retry policy, and PII redaction are *per-provider contracts*, not global defaults.

**How to avoid:**
- Every new provider must pass the **same zod gate + PII-redaction guard** as a construction requirement — extend the existing per-provider validation, don't add a bypass. Add a guard/test that *muerde* (bites): fails CI if a provider is registered without a redaction+zod wrapper.
- Reuse the existing "guard that bites" culture (Direction-B, env-example, lockdown guards) for the LLM layer: a static test enumerating all registered providers and asserting each is wrapped.
- Never assume `response_format json_schema`; keep tool-calling-or-prompt-forced + zod per provider (CLAUDE.md LOCKED rule).

**Warning signs:**
- A provider added with a fresh code path instead of the shared wrapper.
- PII-redaction unit tests only cover DeepSeek/MiniMax.
- zod failures logged-and-ignored on the new tier.

**Phase to address:** Integration (extend guards to cover all providers as first commit — the v10.0 "lockdown-guard extended as PRIMER commit" pattern).

---

### Pitfall 13: Small-model tool-calling / instruction-following brittleness on long prompts

**What goes wrong:**
The stack uses tool-calling or long prompt-forced instructions to get structured output. Granite-micro/Phi-mini follow simple, short instructions but degrade on long, multi-constraint prompts and complex tool workflows (Granite "eye-balls" instead of using the right strategy; struggles to recover from repeated tool-call errors). The current extraction/adjudication prompts are long and constraint-heavy (guardrails, anti-causal rules, literal-only). Small models will drop constraints — e.g., ignore the "literal only, no paraphrase" guardrail — producing paraphrased/invented legal content.

**Why it happens:**
Prompts written for DeepSeek/MiniMax are ported verbatim to small models. Small models have less instruction-following headroom, so the *last* constraints in a long prompt are the first dropped — and those are often the safety constraints.

**How to avoid:**
- Do **not** reuse the big-model prompts unchanged; for small tiers, shorten and front-load the safety-critical constraints, and prefer tool-calling with a tight schema over free-form JSON where the host supports it reliably.
- Measure **constraint-adherence explicitly** (did it obey "literal only"? did it emit only allowed fields?) as a benchmark metric, separate from accuracy.
- If a small model cannot reliably hold the safety constraints on this corpus, it fails the gate for that task — no exceptions per "SIEMPRE calidad."

**Warning signs:**
- Small model paraphrases idea matriz instead of extracting literally.
- Emits fields outside the schema / ignores anti-causal wording rules.
- Adherence drops as prompt length grows.

**Phase to address:** SPIKE (constraint-adherence metric) + Integration (small-tier-specific prompts, not ported).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Benchmark small models on existing golden 32/1263 only | Fast, no new labeling | Overfit to tripwire cases; silent live-distribution degradation → false published claims | Never as the *only* eval; OK as a *regression floor* alongside a stratified live-distribution set |
| Reuse golden cases as few-shot exemplars | No exemplar curation work | Self-referential benchmark picks wrong model | Never |
| Port DeepSeek/MiniMax prompts to Granite/Phi unchanged | Zero prompt work | Dropped safety constraints, paraphrased legal text | Never for extraction/adjudication; OK to prototype routing/classification, then rewrite |
| Hand-pick a single escalation confidence threshold | Ships fast | Miscalibrated on live data; hard cases don't escalate | MVP of the *routing* task only, with over-escalation bias, replaced by calibrated router before extraction/adjudication |
| Benchmark FP16 locally, serve quantized on host | Convenient | Prod is a different (worse) model, esp. in Spanish | Never — pin the prod endpoint |
| Add a new provider without the shared zod+PII wrapper | Trivial baseURL add | PII leak / malformed output slips through | Never |
| Let judge approvals short-circuit the existing zod/golden gate | Lower latency | Weak judge rubber-stamps errors | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| DeepSeek (extraction, prompt-cache) | Insert tier mid-pipeline or swap provider within a request → cache invalidation, ~12× write cost | Route *between* pipelines; keep extraction single-family; monitor `prompt_cache_hit_tokens` |
| MiniMax (adjudication) | Front it with a small responder for "easy" matches | Pin adjudication to MiniMax; small model may only *escalate/flag*, never approve |
| Granite/Phi via OpenAI-compat host | Assume `response_format json_schema`; assume FP16 weights | Tool-calling-or-prompt-forced + zod per provider; pin + verify quantization; endpoint-drift canary |
| New `LLMProvider` registration | Add baseURL, forget PII redaction + zod wrapper | Guard that fails CI if any registered provider lacks the shared redaction+zod wrapper |
| Judge model | Judge trained/evaluated to agree with the *responder* | Evaluate judge vs *human* labels; judge power limited to raising the tier |
| zod retries | Swallowed in benchmark, counted in prod | Count retries in cost/latency model; cap retries; persistent fail = fail-closed |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cascade on escalation-heavy task | p50 latency & cost rise after tiering | Adopt tiering only where expected-cost math wins; keep dense extraction single-model | Escalation rate >~40% |
| Escalation loop / thrashing | Long tail of >N calls per request | Bounded escalation (1 hop/tier), global call budget, terminal human-review state | Any adversarial or hard input in a public repo |
| zod-retry storms on small models | Cost per request spikes on malformed-JSON-prone models | Cap retries (≤2); fail-closed on persistent invalid | Small model + long/complex schema |
| DeepSeek cache-miss after routing | Extraction bill rises despite "cheaper" tiers | Route between pipelines, not mid-session; alert on hit-rate < breakeven | Every request that swaps family mid-pipeline |
| Threshold tuned on golden set | Escalation rate swings on live traffic | Calibrate on held-out live sample; per-task thresholds | Distribution shift (new source, scanned PDFs) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New tier bypasses "RUT never crosses" redaction | PII (RUT/family data) leaks to a small-model host / subprocessor without DPA | Shared redaction wrapper mandatory per provider; CI guard enumerates providers |
| Unbounded escalation on public repo | Hostile actor crafts inputs that force max-tier on every request → cost DoS | Global per-request call budget + per-source rate limits + abuse alerting |
| New provider = new subprocessor, no DPA / trains on data | 21.719 violation (LLM API = subencargado; tier sin entrenamiento / DPA required) | Legal check of each new provider's data-retention/training terms *before* it touches real corpus (operator/legal gate) |
| Trusting host-reported "no training" without verification | Silent data retention on Granite/Phi host | Prefer providers with explicit no-train + DPA; document per-provider legal posture |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tier choice changes displayed content silently | Same bill shows different idea-matriz text depending on which model happened to answer → erodes trazabilidad | Output must be model-invariant for user-facing fields; log which model produced each field for audit, but gate on equivalence |
| Small model paraphrases legal text | Published text no longer matches the source → violates "cada dato lleva fuente" and defamation exposure | Literal-only constraint measured per model; paraphrase = fail |
| Low-confidence output shown as fact | Citizen/press treats an escalation-worthy guess as authoritative | Terminal low-confidence state = suppress or mark, never publish (fail-closed, matches existing empty-state honesty) |

## "Looks Done But Isn't" Checklist

- [ ] **Benchmark:** passes golden 32/1263 — but was it also run on a **stratified live-distribution sample** and a **Spanish-only fidelity/negation** metric? Verify both exist.
- [ ] **Judge:** wired in — but is its power limited to **escalate-only**, and was it measured vs **human** labels (not vs the responder)? Verify it cannot suppress escalation.
- [ ] **Router:** escalation works — but is the threshold **calibrated** (reliability curve plotted) and biased to **over-escalate under uncertainty**? Verify per-task thresholds.
- [ ] **Cost:** "cheaper models added" — but is DeepSeek **cache-hit rate unchanged** and is per-task **expected cost/latency** actually lower than single-big-model? Verify monitoring + math.
- [ ] **Prompts:** small tier runs — but are the **safety constraints** (literal-only, anti-causal, schema-only) still obeyed, measured as constraint-adherence? Verify small-tier-specific prompts.
- [ ] **Providers:** new baseURLs registered — but do **all** pass the shared **zod + PII-redaction** wrapper, enforced by a biting guard? Verify CI guard enumerates them.
- [ ] **Endpoint:** benchmark model == **prod-served quantization/revision**? Verify pin + drift canary.
- [ ] **Adjudication:** untouched — verify no config path resolves identity without MiniMax; golden-1263 ≥0.95 still green.
- [ ] **Escalation:** bounded — verify a hard max-calls-per-request budget and terminal human-review state exist.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cheap model shipped, degrading live quality silently | HIGH (false published claims already live) | Kill-switch route back to incumbent (LLMProvider swap by config); audit outputs produced during window; re-verify against source; issue corrections |
| Weak judge rubber-stamped errors | HIGH | Disable judge gating (escalate-only); re-run affected outputs through incumbent; add human-label eval before re-enabling |
| DeepSeek cache economics broken | LOW/MEDIUM | Revert to pipeline-level routing; re-establish stable prefix; watch hit-rate recover |
| Escalation loop / cost blow-up | LOW | Deploy call-budget cap + terminal state; add per-source rate limit |
| PII leaked to new tier | HIGH (legal, 21.719) | Halt provider; assess exposure; legal notification path; add redaction guard before re-enable |
| Threshold miscalibrated | LOW | Refit calibration on held-out live sample; redeploy router config |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 — Weak judge gating | SPIKE (judge vs human labels) + Integration (escalate-only guard) | Judge cannot suppress escalation; conditional accuracy reported |
| 2 — Wrong-distribution benchmark | SPIKE (stratified live eval + shadow harness) | Shadow-diff rate vs incumbent <threshold before promotion |
| 3 — Golden-set leakage into prompts | SPIKE (harness) + CI guard | Test asserts prompt-exemplars ∩ golden-eval = ∅ |
| 4 — Mixed structured-output modes | SPIKE (metric design) | Parse-rate and value-accuracy reported separately; mode logged |
| 5 — Degrading adjudication | Integration (explicit non-goal + guard) | No path resolves identity without MiniMax; golden-1263 ≥0.95 |
| 6 — Confidence miscalibration | SPIKE (reliability curves) + Integration (calibrated router) | Reliability diagram per task; over-escalation bias verified |
| 7 — Cascade adds latency/cost | SPIKE (expected cost/latency model) | Adopt only where math beats single-big-model; extraction p50 not worse |
| 8 — Spanish quality gap | SPIKE (es-CL-only benchmark) | Fidelity/negation metric on real corpus; English benchmarks excluded |
| 9 — Quantization loss | SPIKE (pin prod endpoint) + Integration (drift canary) | Benchmark endpoint == prod; quantization documented |
| 10 — Escalation loops | Integration (bounded router) | Hard call budget; >N-call alerting |
| 11 — DeepSeek cache broken | SPIKE (cost model) + Integration (route between pipelines) | cache-hit rate monitored; unchanged post-deploy |
| 12 — Provider-quirk / PII drift | Integration (guards first commit) | CI guard enumerates all providers wrapped w/ zod+redaction |
| 13 — Small-model brittleness on long prompts | SPIKE (constraint-adherence metric) + Integration (small-tier prompts) | Constraint-adherence measured; literal-only obeyed |

**Phasing summary:** The SPIKE (SEED-001 benchmark-por-tarea) must carry pitfalls 1–4, 6–9, 13 as *measured deliverables* — the benchmark is not "which model is most accurate" but "which model is safe enough on THIS Spanish legal distribution, with calibrated escalation, at a genuine cost/latency win, without leaking or paraphrasing." The Integration phase carries the *guards* (5, 10, 11, 12) and must begin with the **lowest-risk task** (routing/classification), keep **adjudication and dense extraction on their incumbents** until (and unless) the spike proves parity, and land the provider-wrapper guard as its first commit.

## Sources

- [Is Escalation Worth It? A Decision-Theoretic Characterization of LLM Cascades — arXiv 2605.06350](https://arxiv.org/html/2605.06350) — when escalation does/doesn't pay; accuracy-gap requirement — HIGH
- [UCCI: Calibrated Uncertainty for Cost-Optimal LLM Cascade Routing — arXiv 2605.18796](https://arxiv.org/abs/2605.18796) — calibration > threshold tuning; isotonic fit — HIGH
- [Do Small Language Models Know When They're Wrong? Confidence-Based Cascade Scoring — arXiv 2604.19781](https://arxiv.org/html/2604.19781v1) — small-model confidence miscalibration — HIGH
- [When Efficiency Backfires: Cascading LLMs Trigger Cascade Failure under Adversarial Attack — arXiv 2605.17288](https://arxiv.org/html/2605.17288) — adversarial escalation / cost DoS — HIGH
- [SLMJury: Can Small Language Models Judge as Well as Large Ones? — arXiv 2606.07810](https://arxiv.org/html/2606.07810) — small-judge limits — MEDIUM
- [Enabling Weak LLMs to Judge Response Reliability via Meta Ranking — arXiv 2402.12146](https://arxiv.org/pdf/2402.12146) — weak-judge caveats; hints from uncertain weak model don't help — HIGH
- [Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge](https://llm-judge-bias.github.io/) — position/verbosity/self-preference biases + mitigations — HIGH
- [Self-Preference Bias in LLM-as-a-Judge — arXiv 2410.21819](https://arxiv.org/pdf/2410.21819) — self-preference quantified — HIGH
- [Are You Making These 7 LLM-as-a-Judge Mistakes? — Galileo](https://galileo.ai/blog/why-llm-as-a-judge-fails) — judge ≥ responder capability rule — MEDIUM
- [LLM Model Routing 2026: Cost-Quality Optimization — DigitalApplied](https://www.digitalapplied.com/blog/llm-model-routing-2026-cost-quality-optimization-engineering-guide) — silent quality regression; 50–500-case pre-merge gate — MEDIUM
- [Prompt Caching Economics: Cache-First Agent Design — DigitalApplied](https://www.digitalapplied.com/blog/prompt-caching-economics-cache-first-agent-architecture-2026) — route between pipelines not mid-session; 1.25× write vs 0.1× read — MEDIUM
- [DeepSeek Context Caching on Disk — DeepSeek API Docs](https://api-docs.deepseek.com/news/news0802/) — cache-hit pricing; prompt_cache_hit/miss tokens — HIGH
- [microsoft/Phi-4-mini-instruct — Hugging Face](https://huggingface.co/microsoft/Phi-4-mini-instruct) — English-primary training; non-English worse performance — HIGH
- [Phi-4-Mini Technical Report — arXiv 2503.01743](https://arxiv.org/pdf/2503.01743) — 92% English data; multilingual limits — HIGH
- [ibm-granite/granite-4.0-h-micro — Hugging Face](https://huggingface.co/ibm-granite/granite-4.0-h-micro) — model card / capabilities — HIGH
- [How Do LLMs Fail In Agentic Scenarios? — arXiv 2512.07497](https://arxiv.org/pdf/2512.07497) — Granite tool-calling strengths/weaknesses, error-recovery limits — MEDIUM
- [Q4 vs Q5 vs Q6 vs Q8 Quantization: Real Quality Loss Numbers (2026) — runaihome](https://runaihome.com/blog/quantization-q4-q5-q6-q8-quality-loss-2026/) — multilingual first to break; small models fragile; ~15–20% non-English drop — MEDIUM
- [LLM Quantization Guide (2026) — llmhardware.io](https://llmhardware.io/guides/llm-quantization-guide) — Q4/Q8/FP16 tradeoffs — MEDIUM
- [Structured Output Benchmarks are Riddled with Mistakes — Cleanlab](https://cleanlab.ai/blog/structured-output-benchmark/) — schema-valid vs field-value accuracy; benchmark errors — HIGH
- [Structured Outputs with LLMs: JSON Mode vs Function Calling — Towards Data Science](https://towardsdatascience.com/structured-outputs-with-llms-json-mode-function-calling-and-when-to-use-each/) — mode differences affect ranking — MEDIUM
- [On Leakage of Code Generation Evaluation Datasets — arXiv 2407.07565](https://arxiv.org/pdf/2407.07565) — few-shot leakage; separate exemplar/eval pools — HIGH
- [Benchmark Data Contamination of LLMs: A Survey — arXiv 2406.04244](https://arxiv.org/html/2406.04244v1) — contamination modes incl. overfitting to eval during model selection — HIGH

---
*Pitfalls research for: tiered LLM cascade on a Spanish-legal civic-accountability pipeline with defamation risk (v11.0 SEED-001)*
*Researched: 2026-07-26*
