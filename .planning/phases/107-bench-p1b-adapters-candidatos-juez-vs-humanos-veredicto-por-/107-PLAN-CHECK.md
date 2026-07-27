# 107 PLAN-CHECK — Pre-execution verification

Verdict: CONCERNS (execute after resolving BLOCKER-1; WARNINGs are fix-recommended)
Checked: 2026-07-26
Plans: 107-01, 107-02, 107-03
Requirements: TIER-01, BENCH-04, BENCH-05 — all present in requirements frontmatter; all covered.

## Summary

Adapters faithfully specify the MiniMax clone (match-by-name, external parseAndValidate +
onValidationOutcome, dual RUT guards, explicit max_tokens, zero new SDK); JudgeProvider is a genuinely
separate interface; the VEREDICTO machine is pure/fixture-tested with an explicit epsilon, nada-aprueba,
pending-evidence, and an es-CL hard veto; the LIVE run is correctly deferred (autonomous:false,
env-gated, exact 3 keys + command, empty .env.example placeholders); adjudication is untouched.

ONE blocking issue: the es-CL HARD VETO — the single most load-bearing gate in the phase goal — is
specified against a scorer field that DOES NOT EXIST. Left unresolved, the executor will either invent a
field (silent scope drift) or fold the veto into aggregate precision (defeating the short-circuit-
regardless-of-aggregate-metrics requirement). Two warnings on incumbent-baseline realism and a
JudgeRequest field-name contract.

## Dimension coverage

- 1. Requirement coverage: PASS — TIER-01 (01), BENCH-05 (02), BENCH-04 (02+03) all covered.
- 2. Task completeness: PASS — every auto task has files/action/verify/done + acceptance_criteria.
- 3. Dependency correctness: PASS — 01(w1)->02(w2)->03(w3), linear, acyclic, no forward refs.
- 4. Key links planned: PASS — barrel re-exports, guard wiring, bridge->JudgeProvider all explicit.
- 5. Scope sanity: PASS — 2 tasks/plan, <=8 files/plan.
- 6. must_haves derivation: PASS — truths are user/outcome-observable.
- 7. Context compliance: PASS — locked decisions honored; deferred ideas excluded.
- 7b. Scope reduction: PASS — no v1/simplified/static-for-now; deferral is credential-gated, not cut.
- 7c. Architectural tier: SKIPPED (no Architectural Responsibility Map in a phase RESEARCH.md).
- 9. Cross-plan data contracts: WARNING — JudgeRequest field-name contract (WARNING-2).
- 10. CLAUDE.md compliance: PASS — openai@5+baseURL, zero new SDK, tool_choice forced (never
  response_format), secrets only in .env.
- 12. Pattern compliance: PASS — minimax.ts named as the exact template with verbatim clone points.
- 8 (Nyquist) / 11 (Research resolution): no VALIDATION.md / RESEARCH Open Questions in read set; not
  evaluated as gating.

## BLOCKER-1 — es-CL hard veto reads a scorer field that does not exist

dimension: cross_plan_data_contracts / requirement_coverage (BENCH-05 es-CL veto, success criterion 4)
severity: BLOCKER
plans: 107-02 (author), 107-03 (consumer); task 107-02 Task 1

Evidence. 107-02 instructs the executor to read a dedicated es-CL field on the extraccion scorer
(read_first: the extraccion scorer carries an es-CL negation/fidelity metric; the es-CL HARD VETO reads
THIS, not aggregate accuracy; read the exact field names before wiring the veto. action: es-CL HARD
VETO for the extraccion task and any task exposing a negation/fidelity field, if the candidate es-CL
fidelity/negation metric is below the incumbent...).

Actual MetricasExtraccion (packages/llm-bench/src/tasks/extraccion/scorer.ts, lines 140-146) has only:
schema_parse_rate: number; value { tp; fp; fn; precision; recall }; detalle[]. There is NO
negation/fidelity aggregate. A dropped negation is folded INTO value.precision (comment line 130: una
negacion caida = fp -> baja la precision; line 203). The only place negation is first-class is
CasoExtraccion.estrato = ...negacion... (line 82), and estrato is aggregated away by evaluarExtraccion;
it is NOT present on MetricasExtraccion nor on detalle.

Why blocking. The phase goal makes es-CL a HARD VETO that short-circuits the aggregate gate regardless
of aggregate metrics (CONTEXT LOCKED; ROADMAP criterion 4). But the only es-CL signal reaching
MetricasModelo.calidad_por_tarea.extraccion IS aggregate value.precision. So the executor has three bad
paths:
  (a) invent a field the scorer never populates -> the 107-03 LIVE Reporte has it undefined -> veto
      never bites (or degrades to pending-evidence, hiding the veto);
  (b) read value.precision as the es-CL metric -> the veto is identical to the aggregate quality gate,
      i.e. NOT a short-circuit and NOT independent of aggregate metrics, contradicting the locked req;
  (c) guess estrato -> not on the metric type; will not type-check.

Fix (must be explicit in revised 107-02 before execution):
1. Amend the 106 extraccion scorer to surface a negation/fidelity sub-metric (e.g.
   value_por_estrato.negacion computed from cases whose estrato contains negacion), add
   extraccion/scorer.ts + its test to 107-02 files_modified, and state it does NOT alter the existing
   value aggregate (106 tests stay green). Only path that keeps the veto independent of aggregate. OR
2. Redefine the veto against the existing value.precision and DROP the regardless-of-aggregate / short-
   circuit language from CONTEXT (weaker guarantee; relaxes a LOCKED decision -> surface to operator).

The plan currently asserts a field that makes path 1 look already-done when it is not — that is the
defect.

## WARNING-1 — 107-03 incumbent baseline same-run step under-specified / possibly unreachable

dimension: key_links_planned / task_completeness; plan 107-03 Task 1

The verdict needs a candidate AND an incumbent MetricasModelo. 107-03 leaves the incumbent unpinned
(re-run DeepSeek via the baseline path OR read a committed baseline artifact if one exists). Neither is
pinned: re-running DeepSeek needs DEEPSEEK_API_KEY, but it.skipIf keys only on
WORKERS_AI_API_TOKEN/OPENROUTER_API_KEY (an operator with candidate keys but no DeepSeek key gets no
incumbent, an unspecified/throwing path); and no committed baseline JSON path is named (106 baseline is
a LIVE test, may leave nothing on disk).

Fix: name the concrete incumbent source (add DEEPSEEK_API_KEY to skipIf and re-run same-run, or specify
the exact committed baseline JSON path 106 produces and how 107 reads it). Low blast-radius
(autonomous:false), but the LIVE verdict is the phase headline artifact.

## WARNING-2 — JudgeRequest field-name contract asserted across plans but not defined

dimension: cross_plan_data_contracts; plans 107-01 (defines) and 107-02 (consumes)

107-02 calls judge.judge({ answer: caso.answer, sensitivity: public }) and 107-01 must guard the answer
AND system text. But 107-01 defines JudgeRequest only prose-side (carrying the answer plus optional
context/sensitivity/temperature); the concrete field name (answer) and whether a system field exists
are executor discretion. If the field is named pregunta/text/input or system is omitted, 107-02 will
not compile and the guard-on-system-text criterion has nothing to guard.

Fix: pin the JudgeRequest shape in 107-01 interfaces to exactly what 107-02/03 consume — at minimum
{ answer: string; system?: string; sensitivity?: Sensitivity; temperature?: number; context?: string }.
Inside Claude Discretion per CONTEXT (no conflict); just fix in ONE place, do not reinvent in Wave 2.

## Checks that PASS (explicit confirmations requested)

1. Adapter faithfulness (107-01): forced tool_choice (function TOOL_NAME); match by calls.find
   (c.type === function AND c.function.name === TOOL_NAME), NOT position — reorderedToolResponse
   wrong-name-first test AND all-wrong-name -> LLMValidationError test both required; EXTERNAL
   parseAndValidate with onOutcome req.onValidationOutcome threaded (matches validate.ts); IDENTICAL
   guards assertNoRutInLlmInput on user AND system + assertSensitivityAllowed with RUT-guard-bites for
   BOTH inputs (fetch never fires); explicit numeric max_tokens asserted on captured body (Workers AI
   256 pitfall); zero new SDK (STRIDE T-107-SC). No criterion lets a positional match or missing guard
   slip through.
2. JudgeProvider separation (107-01 Task 2): NEW judge.ts, NOT folded into LLMProvider/types.ts; Verdict
   zod { ok, reason?, confidence? }; deterministic via forced temperature 0 asserted on captured body;
   match-by-name (Phi hallucination). Compatible with scorer JuzgarFn = caso -> Promise boolean|null via
   the Plan-02 bridge.
3. VEREDICTO epsilon (107-02): CONCRETE named export EPSILON_POR_TAREA, per-metric, with justification
   comments — NOT hand-wavy. Quality delta <= epsilon AND not-worse on BOTH structured_output_fail_rate
   and zod_fail_rate.repaired/terminal (first-class gate, tested). nada-aprueba and pending-evidence are
   explicit tested returns (report.ts forces no approval). Pure — grep-asserted no fetch/http.
4. RUT-guard-bites + nada-aprueba + es-CL-veto tests all named as explicit acceptance criteria (RUT:
   107-01 both tasks; other two: 107-02 Task 1). NOTE: the es-CL-veto TEST is only as sound as
   BLOCKER-1 resolution — a fixture can pass against an invented field the LIVE path never populates.
5. Deferred live run (107-03): autonomous:false; describe.skip unless LLM_BENCH_LIVE=1 + it.skipIf on
   keys -> CI never runs it, no network/quota (T-107-09); exact 3 keys (WORKERS_AI_API_TOKEN,
   CLOUDFLARE_ACCOUNT_ID, OPENROUTER_API_KEY) + run command in checkpoint and README; pending-evidence
   asserted as a VALID non-failing outcome (asserts verdict COMPUTED, never that anything approved).
6. .env.example gets exactly 3 EMPTY placeholders (KEY= style), guarded by env-example-guard.test.ts
   (empty allowlisted); no secret value planned; agent never loads a secret (T-107-03 / T-107-08).
7. Adjudication untouched: no plan touches packages/adjudication/ or golden-1263; CONTEXT INTOCABLE/
   inobservada honored.
8. Wave/dependency + collisions: 01->02->03 linear. Barrels differ (107-01 packages/llm/src/index.ts vs
   107-02 packages/llm-bench/src/index.ts) — no collision. Same-plan tasks serialize (worktrees off).
   107-02 ADDS net-new barrel lines without touching the 106 placeholder set. No barrel-style collision.

## Recommendation

1 BLOCKER + 2 WARNINGs. Return to planner:
- Must fix (BLOCKER-1): resolve the es-CL veto field — extend the 106 extraccion scorer with a
  negation/fidelity sub-metric (preferred; keeps the LOCKED independent-of-aggregate veto) and add it to
  107-02 files_modified, OR redefine the veto against value.precision AND flag the CONTEXT relaxation.
- Should fix: pin the incumbent baseline source in 107-03 (WARNING-1) and the JudgeRequest shape in
  107-01 interfaces (WARNING-2).

The credential-gated Wave-3 split is intentional and correct — NOT counted as a gap.
