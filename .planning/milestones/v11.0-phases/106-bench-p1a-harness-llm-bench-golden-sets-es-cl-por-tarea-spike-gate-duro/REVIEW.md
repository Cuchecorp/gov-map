---
phase: 106-bench-p1a-harness-llm-bench-golden-sets-es-cl-por-tarea
reviewed: 2026-07-26T00:00:00Z
depth: deep
files_reviewed: 20
files_reviewed_list:
  - packages/llm-bench/src/metrics.ts
  - packages/llm-bench/src/instrument.ts
  - packages/llm-bench/src/pricing.ts
  - packages/llm-bench/src/report.ts
  - packages/llm-bench/src/harness.ts
  - packages/llm-bench/src/mock-provider.ts
  - packages/llm-bench/src/index.ts
  - packages/llm-bench/src/guards/freeze.ts
  - packages/llm-bench/src/guards/no-rut.ts
  - packages/llm-bench/src/tasks/routing/scorer.ts
  - packages/llm-bench/src/tasks/clasificacion/scorer.ts
  - packages/llm-bench/src/tasks/extraccion/scorer.ts
  - packages/llm-bench/src/tasks/juez/scorer.ts
  - packages/llm-bench/src/tasks/routing/disjuncion.test.ts
  - packages/llm-bench/src/tasks/clasificacion/disjuncion.test.ts
  - packages/llm-bench/src/tasks/extraccion/disjuncion.test.ts
  - packages/llm-bench/src/tasks/juez/disjuncion.test.ts
  - packages/llm-bench/src/metrics.test.ts
  - packages/llm-bench/src/harness.test.ts
  - packages/llm-bench/src/baseline.live.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 106: Code Review Report — `@obs/llm-bench`

**Reviewed:** 2026-07-26
**Depth:** deep (cross-file: harness ↔ `@obs/llm` validate.ts repair-loop contract)
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The measurement core (`metrics.ts`) is, on its own, correct and well-tested: percentile is nearest-rank with no interpolation and proper clamping; `costoUsd` returns `null` (not 0) on missing usage with units right; the two fail-rate metrics are genuinely separate first-class fields. The scorers implement abstention-never-error (routing/clasificación), parse-rate-separate-from-value-accuracy (extracción), and conditional accuracy vs `human_label` with a live rubber-stamp exposure (juez). The freeze guard hashes stable `readFileSync(...,"utf8")` bytes and the no-RUT regex catches real Chilean RUT formats (dotted, dotless, K/k). `instrumentedFetch` returns the ORIGINAL response and reads a `.clone()`. CI never touches the network (LIVE is env-gated + `describe.skip`, mock is fetch-free).

**BUT** there is one BLOCKER on metric correctness at the integration layer: the harness driver (`harness.ts`) collapses the four-way outcome taxonomy that `metrics.ts` was purpose-built to preserve. Every successful completion is hard-coded to `"clean"` and every non-`LLMValidationError` throw to `"structured-output-fail"`. The `"zod-repaired"` outcome is **never produced by the live path**, and a genuine structured-output failure (empty/no-payload) that the repair loop escalates to `LLMValidationError` is **misclassified as `zod-terminal`**. This means the very metric the phase declares LOCKED and safety-critical (Pitfall B: structured-output-fail vs zod-fail, separate) is corrupted the moment a real provider is measured — exactly the 107 integration decision this instrument exists to inform.

## Critical Issues

### CR-01: Harness driver never produces `zod-repaired` and mislabels structured-output failures as `zod-terminal` — the LOCKED two-fail-rate metric is wrong on the live path

**File:** `packages/llm-bench/src/harness.ts:115-136`
**Issue:**
`metrics.ts` defines four outcomes precisely to mirror `@obs/llm/validate.ts`'s repair loop: `clean`, `structured-output-fail`, `zod-repaired`, `zod-terminal`. The comment on `clasificarOutcome` (metrics.ts:81-92) is explicit that `structured-output-fail` = "no usable payload on attempt 0" and `zod-terminal` = "attempts exhausted (LLMValidationError)". These are semantically distinct failure modes: one means the model could not emit a parseable object at all; the other means it emitted parseable JSON that repeatedly failed zod.

The driver destroys this distinction:

```ts
// harness.ts — completarClasificando
try {
  const out = await provider.complete<T>(req, schema);
  outcomes.push("clean");                    // (1) ALWAYS "clean", even if a repair happened
  return out;
} catch (err) {
  const rec = {
    payloadUsableAttempt0: false,            // (2) ALWAYS false on any throw
    repaired: false,
    terminal: err instanceof LLMValidationError,
  };
  outcomes.push(clasificarOutcome(rec));     // → structured-output-fail OR zod-terminal
  return null;
}
```

Two concrete correctness failures:

1. **`zod-repaired` is unreachable on the live path.** `provider.complete` runs the repair loop internally (deepseek.ts:90 → `parseAndValidate`) and returns the repaired object as a plain success. The harness cannot see that a reprompt occurred, so it stamps `"clean"`. A model that only ever succeeds *after* a zod repair round-trip reports `zod_fail_rate.repaired = 0` and a perfect clean rate — the exact "looks clean on what it managed" masking the phase docstring (metrics.ts:102-106) swears never happens. `agregarFallos` is correct; it is simply never fed a `"zod-repaired"`.

2. **Structured-output failures are labeled `zod-terminal`.** When the model emits no parseable payload, the repair loop in `validate.ts` still throws `LLMValidationError` (validate.ts:107-108) — that is the ONLY terminal error type. So `err instanceof LLMValidationError` is `true`, and `clasificarOutcome` returns `"zod-terminal"`. The intended `payloadUsableAttempt0: false` → `"structured-output-fail"` branch (clasificarOutcome:88) is dead on the live path because the driver's `terminal` flag wins whenever the provider threw. A candidate whose real defect is "can't produce JSON" will be reported as a zod-schema problem, inverting the two rates the phase declares LOCKED-separate.

The CI test at harness.test.ts:238-255 does not catch this: the mock `responderFalla` throws a plain `Error` (not `LLMValidationError`), so it happens to land in `structured-output-fail`. No test exercises a provider that throws `LLMValidationError`, and no test asserts `zod_fail_rate.repaired > 0` from the driver — so both broken paths are untested.

**Impact:** This is the load-bearing measurement. A wrong structured-output-fail vs zod-fail split → a wrong read on which model can be trusted to emit structured output → a wrong 107 integration decision. Direct hit on the phase's stated safety rationale.

**Fix:** The driver must recover the true outcome from the provider path, not synthesize it. Either (a) have `@obs/llm` expose the outcome (whether a repair occurred, and whether the terminal failure was parse-failure vs zod-failure) via the completion result or a typed error field, and map it faithfully; or (b) at minimum, inspect `LLMValidationError.issues` to distinguish "no usable payload" (issues indicate the root was `undefined`/non-object) from a genuine schema-shape failure, and stop hard-coding `"clean"`:

```ts
try {
  const { value, repaired } = await provider.completeWithOutcome<T>(req, schema);
  outcomes.push(repaired ? "zod-repaired" : "clean");
  return value;
} catch (err) {
  if (err instanceof LLMValidationError) {
    // distinguish no-payload (structured-output-fail) from schema-shape terminal (zod-terminal)
    const noPayload = err.issues.some(
      (i) => i.code === "invalid_type" && i.path.length === 0, // root was undefined/null
    );
    outcomes.push(noPayload ? "structured-output-fail" : "zod-terminal");
  } else {
    outcomes.push("structured-output-fail");
  }
  return null;
}
```
The clean fix is (a): the harness comment claims it "espeja el repair loop", but it cannot mirror what the provider does not surface. Until the provider emits the repair/parse-vs-zod signal, this metric cannot be trusted on a real model.

## Warnings

### WR-01: `costo_por_1k` silently collapses to `null` if ANY single sample lacks usage — one missing-usage repair round-trip nulls the whole model's cost

**File:** `packages/llm-bench/src/harness.ts:250-266`
**Issue:** The cost loop sets `todasConCosto = false` and `break`s on the first sample whose usage is absent, returning `null` for the entire model. On the LIVE path each logical completion can emit multiple `CallMetric`s (the repair reprompt is a second fetch → a second sample). If a provider returns `usage` on the primary call but omits it on a reprompt (or on any one call in a 100-call run), the whole model reports cost `n/a`. The docstring frames `null` as "host omits usage", implying a whole-host property, but the implementation makes it an all-or-nothing over every individual call — a single flaky omission erases an otherwise-complete cost measurement. This is defensible as conservative, but it is not what the comment describes and it will surprise the operator (a model that reports cost on 99/100 calls shows `n/a`).
**Fix:** Decide the intended semantics explicitly. If "conservative null on any gap" is intended, document it and count how many samples were missing so the operator can see it was 1/100 not 100/100. If per-call robustness is wanted, compute cost over the samples that HAVE usage and separately report a `usage_coverage` fraction — keeping cost and coverage as separate fields (consistent with the phase's own separation discipline).

### WR-02: Cost denominator `n` = latency-sample count, not logical-call count — "per 1k casos" is mislabeled when repairs occur

**File:** `packages/llm-bench/src/harness.ts:229, 243-265`
**Issue:** `costo_por_1k = (suma / n) * 1000` where `n = latencias.length = muestras.length` (instrumented fetch calls). The comment (harness.ts:228-229) calls this "costo por 1000 casos". But when the repair loop fires, one golden case produces 2+ fetches → 2+ `CallMetric`s. So `n` counts network round-trips, not cases. The per-call average is fine, but multiplying by 1000 and labeling it "per 1000 casos" overstates or understates depending on repair frequency: a model that repairs often has more samples, so its *per-sample* cost × 1000 is a per-round-trip cost, not a per-case cost. The report field is `costo_por_1k` documented as "Costo por 1000 casos de esta tarea" (report.ts:50). Two different models with different repair rates are then not comparable on a per-case basis.
**Fix:** Track the logical case count (sum of golden set sizes actually run) separately from the fetch-sample count, and define `costo_por_1k` as total-cost / cases × 1000. Or rename the field to `costo_por_1k_llamadas` and document that it is per round-trip. Comparability across candidates in 107 depends on this being per-case.

### WR-03: `n_muestras` mixes all four tasks — p50/p95 latency is a cross-task blend, not a per-task latency

**File:** `packages/llm-bench/src/harness.ts:243-246, 282-284`
**Issue:** `correrTareas` drives all four golden sets against the same provider, and the single `muestras` sink accumulates latency from routing + clasificación + extracción + juez indiscriminately. `latencia_p50_ms`/`latencia_p95_ms` are then percentiles over a heterogeneous pool (extracción prompts are long legal texts; routing prompts are short). A p95 over mixed workloads is not a meaningful latency SLA for any single task, and the `p95Indicativo` small-N caveat (good) does not cover the "these samples aren't from the same distribution" problem. The report presents one latency pair per model as if it characterized the model uniformly.
**Fix:** Either compute latency per task (aligning with `calidad_por_tarea` being per-task) or document loudly in `report.ts` that latency is an aggregate across a fixed task mix and is only comparable when the task mix and `limitePorTarea` are identical between models.

### WR-04: Juez driver maps every structural/terminal failure to `ok=false` — inflates recall-de-rechazo for a broken model

**File:** `packages/llm-bench/src/harness.ts:208-217`
**Issue:** `out?.ok ?? false` means any completion failure (no payload, terminal zod error, timeout-as-throw) is scored as a *rejection* by the judge. The comment justifies this as "escalate-only por diseño". But the juez metric is accuracy vs `human_label`: `recall_rechazo = rechazadas-entre-malas / #malas`. A judge that is completely broken and never returns a parseable verdict will be scored as rejecting every bad answer → `recall_rechazo = 1.0`, i.e. it looks like a *perfect* rejector. That is the inverse of the phase's own "rubber-stamp judge must be exposed" goal — here a *non-functional* judge is rewarded on the safety-relevant metric. The failure is separately visible in `structured_output_fail_rate` (once CR-01 is fixed), but the juez quality number itself is contaminated by treating no-answer as a correct rejection.
**Fix:** Exclude cases where the completion failed from the juez conditional-accuracy computation (do not count a no-verdict as a rejection), and surface the failure only via the fail-rate metric. A judge must earn `recall_rechazo` by actually emitting a reasoned rejection, not by crashing. At minimum, add a golden test asserting that an always-throwing judge does NOT score `recall_rechazo = 1`.

### WR-05: Sector taxonomy is a hand-copied duplicate of `@obs/cruces` with only a comment guarding drift

**File:** `packages/llm-bench/src/tasks/clasificacion/scorer.ts:32-46`
**Issue:** `SECTOR_CODIGOS` (13 literals) is a deliberate byte-for-byte copy of `@obs/cruces/sector.ts`, justified to avoid a runtime dependency. The only drift protection is the zod parse rejecting out-of-list codes *in the golden* — but if `@obs/cruces` adds/renames a sector, this copy silently diverges and the benchmark measures classification against a stale taxonomy with no failing test. The comment says "ambas listas deben re-sincronizarse" but nothing enforces it. Same latent duplication risk applies to `ROUTING_LABELS` if those ever couple to cruces.
**Fix:** Add a test (build-time, no runtime dep) that imports the cruces taxonomy in a `*.test.ts` and asserts `SECTOR_CODIGOS` equals it. A test-only import does not create a runtime dependency but makes drift a red CI, converting the comment into an enforced invariant.

## Info

### IN-01: Disjunction guard compares `id` pools only — a leaked case with a renamed id passes

**File:** `packages/llm-bench/src/tasks/routing/disjuncion.test.ts:27-41` (and the three sibling disjuncion tests)
**Issue:** The anti-leakage invariant checks `exemplarIds ∩ evalIds = ∅` purely on the `id` field. If a few-shot exemplar reuses the *content* of an eval case under a different id, the guard passes while real leakage exists. The review question was "does the disjunction guard compare the right pools" — it compares the right pools (exemplar vs eval, and scoring vs calibración for juez) but on identity keys, not on input content. For a measurement instrument this is a soft spot: id-hygiene is necessary but not sufficient for no-leakage.
**Fix:** Optionally also assert content disjointness (e.g. normalized `input` substring containment between pools) or document that exemplar authorship must never copy eval content. Low priority given the sets are hand-curated and frozen.

### IN-02: `instrumentedFetch` awaits `res.clone().json()` before returning — adds latency the caller pays and buffers the whole body

**File:** `packages/llm-bench/src/instrument.ts:43-57`
**Issue:** The wrapper returns the ORIGINAL response (correct — verified), and reads a clone (correct — does not consume the caller's body). But it `await`s the clone's `.json()` *before* returning `res` to the adapter. For a streaming or large response this delays the caller and forces the clone's full body into memory. `latencyMs` is measured before the clone read (line 46), so the metric is unaffected, but the caller's effective time-to-response includes the clone parse. For the benchmark's non-streaming JSON completions this is negligible; flagged only because the docstring emphasizes "returns the ORIGINAL response intact" without noting the added serial await.
**Fix:** If any 107 candidate streams, read the clone body in a detached `.then()` (fire-and-forget into the sink) so the original is returned immediately. Not needed for current non-streaming providers.

### IN-03: `percentile` returns `NaN` for empty input but `latencia_p50_ms`/`p95_ms` are typed `number` and flow into the report unchecked

**File:** `packages/llm-bench/src/metrics.ts:17-25`, `packages/llm-bench/src/harness.ts:282-283`
**Issue:** `percentile([], 50) = NaN` is the correct choice (documented: absence ≠ zero latency). But if a run produces zero samples (e.g. every completion throws before any fetch, or `limitePorTarea: 0`), `latencia_p50_ms`/`latencia_p95_ms` become `NaN` in a field typed `number`, and `JSON.stringify` serializes `NaN` as `null` in the LIVE artifact (baseline.live.test.ts:120) — silently, without the operator knowing latency was unmeasured vs zero. `n_muestras: 0` is the tell, but the NaN→null coercion in the JSON report loses the distinction.
**Fix:** In `construirReporte`/`tablaLegible`, when `n_muestras === 0` render latency as explicit `"n/a"` (the table's `fmt` already does this for cost but not for latency, since `fmt` only special-cases `null`, not `NaN`). Add `Number.isNaN` handling to `fmt`.

---

## Verdict

**One BLOCKER on metric correctness (CR-01):** the harness driver does not faithfully mirror the `validate.ts` repair loop it claims to espejar. `zod-repaired` is never emitted on the live path, and structured-output (no-payload) failures are misclassified as `zod-terminal`. The `metrics.ts` primitives are correct in isolation and well-tested, but they are fed a corrupted signal by `harness.ts` — so the LOCKED "two separate fail-rate" guarantee (Pitfall B) is violated exactly when a real model is measured in 107. This must be fixed (provider must surface the repair/parse-vs-zod outcome) before any baseline or candidate number is trusted, because a wrong structured-output-vs-zod split is precisely the kind of wrong metric → wrong integration → false civic claim the phase exists to prevent.

**Also fix before 107 comparability:** WR-02 (per-case vs per-round-trip cost denominator) and WR-04 (broken judge scoring `recall_rechazo = 1`) both distort safety-relevant comparisons.

**Clean on the specific review questions:** percentile math (nearest-rank, correct clamping, small-N safe), `costoUsd` units and null-not-zero, the no-RUT regex (catches dotted/dotless/K forms), the sha256 freeze over stable `readFileSync` bytes, `instrumentedFetch` returning the original body, and no-network-in-CI are all correct. The scorers' abstention-never-error, parse-rate-separate-from-value-accuracy, and juez-vs-human-label-not-responder are all implemented correctly — the juez even has a live rubber-stamp exposure via `recall_rechazo` (subject to WR-04's no-verdict caveat).

_Reviewed: 2026-07-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
