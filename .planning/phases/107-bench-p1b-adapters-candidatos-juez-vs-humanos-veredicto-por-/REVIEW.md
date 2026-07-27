---
phase: 107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-
reviewed: 2026-07-27T03:31:27Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - packages/llm/src/providers/granite.ts
  - packages/llm/src/providers/phi-judge.ts
  - packages/llm/src/judge.ts
  - packages/llm-bench/src/veredicto.ts
  - packages/llm-bench/src/tasks/extraccion/scorer.ts
  - packages/llm-bench/src/tasks/juez/juez-vs-humano.ts
  - packages/llm-bench/src/candidatos.live.test.ts
  - packages/llm/src/data-routing.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 107: Code Review Report

**Reviewed:** 2026-07-27T03:31:27Z
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the two safety-critical surfaces of Phase 107: the candidate adapters (`granite.ts`, `phi-judge.ts` — fail-closed RUT/sensitivity guards) and the VEREDICTO machine (`veredicto.ts` — authorizes/vetoes model integrations). Cross-checked against `MiniMaxProvider` (the declared clone source), `data-routing.ts` (the guards), `validate.ts` (the repair loop / match-by-name gate), `harness.ts` and `report.ts` (metric shapes the verdict reads).

Verdict math is **correct**: ε-direction is right (`Δ = cand − inc ≥ −ε` for higher-is-better scalars), the es-CL negation veto reads `negacion.accuracy` (not `value.precision`) and short-circuits BEFORE the aggregate gate with the correct direction (`negCand < negInc` → veto), fail-rate gates are non-worse in the safe direction, and a missing/undefined metric yields `pending-evidence` (never a silent pass). Match-by-name is strict (`function.name === TOOL_NAME`, never index) in both adapters. Granite fixes `max_tokens` explicitly (> 256, asserted). PhiJudge forces `temperature: 0`. CI paths are network-free and gated behind `LLM_BENCH_LIVE=1`; no secrets are printed.

**One BLOCKER on guard-completeness:** `PhiJudge.judge` interpolates `req.context` into the wire prompt but does NOT run `assertNoRutInLlmInput` over it. A RUT in `context` reaches the network. Details below (CR-01). The remaining findings are traceability/robustness warnings.

## Critical Issues

### CR-01: PhiJudge `req.context` reaches the wire WITHOUT the RUT guard (fail-closed hole)

**File:** `packages/llm/src/providers/phi-judge.ts:82-96` (guard at 82-83; unguarded use at 90)
**Issue:** The guard block only asserts `req.answer` and `req.system`:

```ts
assertNoRutInLlmInput(req.answer);
if (req.system) assertNoRutInLlmInput(req.system);
assertSensitivityAllowed({ sensitivity: req.sensitivity ?? "public" }, this);
```

But the user prompt is then built from `req.context` too:

```ts
const userParts = [
  req.context ? `Context:\n${req.context}` : undefined,  // <-- NEVER guarded
  `Answer to judge:\n${req.answer}`,
].filter(...);
```

`req.context` is a public field on the **LOCKED** `JudgeRequest` interface (`judge.ts:39-40`), documented as "contexto extra opcional para el prompt del juez," and Wave 2 (Phase 108) is instructed to compile against this shape. Any caller that populates `context` with a RUT (e.g. passing a lobby/patrimonio snippet as judge context) sends that RUT to the model — the exact failure mode the fail-closed guard exists to prevent. The module's own header comment claims "ningun RUT cruza al prompt (se guarda `answer` Y `system`)" — the invariant is stated but the `context` path violates it. This is a guard-completeness gap on a safety-critical surface; it is dormant only because no current caller sets `context`.

**Fix:** Guard `context` before it can reach the wire, symmetric with `answer`/`system`:

```ts
assertNoRutInLlmInput(req.answer);
if (req.system) assertNoRutInLlmInput(req.system);
if (req.context) assertNoRutInLlmInput(req.context);
assertSensitivityAllowed({ sensitivity: req.sensitivity ?? "public" }, this);
```

Add a CI test mirroring the existing `RUT en req.system -> ... CERO fetches` case, but for `req.context`, so the invariant is enforced going forward.

## Warnings

### WR-01: Live-test `juez` verdict is about Granite-as-responder, NOT PhiJudge — misleading traceability

**File:** `packages/llm-bench/src/candidatos.live.test.ts:196-208`; `packages/llm-bench/src/harness.ts:243-256`
**Issue:** `computarVeredicto(candidato, incumbente)` reads the `juez` quality scalar from `candidato.calidad_por_tarea.juez`, which the harness populates by running the **candidate responder (Granite)** as a judge-via-completion (`harness.ts:244` calls `completarClasificando(provider, ...)`). The dedicated `medirJuezVsHumano(phiJudge)` result (`metricasJuez`) is computed and printed but **never fed into the verdict**. So the `juez` line of the definitive verdict does not reflect PhiJudge's real judge performance vs human labels — the printed BENCH-04 table and the verdict's `juez` estado are about two different models. An operator reading `juez: approved-model` from the verdict JSON would reasonably (and wrongly) attribute it to Phi.
**Fix:** Either (a) inject `metricasJuez` into the verdict input for the `juez` task so the verdict reflects the actual judge candidate, or (b) rename/annotate the printed verdict so the `juez` line is explicitly labeled "responder-as-judge (harness), NOT PhiJudge" and surface the PhiJudge measurement as the authoritative juez evidence. Silent divergence on a surface whose whole purpose is authorizing an integration is the risk.

### WR-02: es-CL negation veto is skipped when the incumbent lacks `negacion` — a worse candidate can slip to the aggregate gate

**File:** `packages/llm-bench/src/veredicto.ts:135-146`
**Issue:** The hard veto only fires when **both** `negCand` and `negInc` are numbers:

```ts
if (typeof negCand === "number" && typeof negInc === "number" && negCand < negInc) { ...veto... }
```

If the incumbent metric is absent or its `negacion.accuracy` is undefined (`metInc === undefined`, or an older/partial incumbent shape), `negInc` is `undefined`, the guard is skipped, and the candidate falls through to the aggregate ε-gate — where it can be **approved despite worse negation fidelity**, because `value.precision` alone can clear ε. The design assumes both rows come from the same scorer in the same run (true in `candidatos.live.test.ts`), but the machine is exported as a pure, reusable function (`computarVeredictoDeReporte`) that runs over any `Reporte`, so the assumption is not enforced. For a first-class hard veto guarding legal-negation fidelity, "no incumbent signal" should not degrade to "no veto."
**Fix:** Fail closed on missing negation evidence for extracción. If `negCand` is a number but `negInc` is not (or vice versa), return `pending-evidence` for extracción rather than proceeding to the aggregate gate:

```ts
if (typeof negCand !== "number" || typeof negInc !== "number") {
  salida[task] = { estado: "pending-evidence",
    razon: "negacion.accuracy ausente en candidato o incumbente → no se puede aplicar el veto es-CL → pending-evidence" };
  continue;
}
if (negCand < negInc) { ...veto... }
```

### WR-03: `escalarDeCalidad` has no `default` case — a new/unknown `TaskId` returns `undefined`, not `null`, silently breaking the pending-evidence contract

**File:** `packages/llm-bench/src/veredicto.ts:71-91`
**Issue:** The `switch (task)` covers the four current tasks but has no `default`. TypeScript's exhaustiveness holds only while `TaskId` stays exactly these four; if a fifth task is added to `TaskId` (the type is shared and the machine iterates `TAREAS`), `escalarDeCalidad` falls off the end of the function and returns `undefined`. Downstream, `escCand === null` / `escInc === null` checks (line 151) use strict `=== null`, so an `undefined` would NOT be caught there and would flow into `escCand - escInc` → `NaN`; `NaN >= -epsilon` is `false` → the task silently becomes `incumbent-stays` with a misleading "no alcanza paridad" reason, rather than the intended `pending-evidence`. A wrong estado on the verdict machine is exactly the class of defect this surface must not have.
**Fix:** Add an exhaustiveness guard so a new task fails loudly (or maps to null) instead of returning `undefined`:

```ts
default: {
  const _exhaustive: never = task;
  return null;
}
```

## Info

### IN-01: `LLM_BENCH_LIMIT` non-numeric value silently becomes `NaN` limit

**File:** `packages/llm-bench/src/candidatos.live.test.ts:111-113`
**Issue:** `LIMITE_POR_TAREA = LIMITE_RAW === undefined ? 3 : LIMITE_RAW === "0" ? undefined : Number(LIMITE_RAW)`. A typo like `LLM_BENCH_LIMIT=all` yields `Number("all") === NaN`, passed as `limitePorTarea: NaN` into the harness. Depending on how the harness slices, this can produce zero cases or an empty run that still "passes" the compute-only assertions — a confusing operator footgun. LIVE-gated, so low impact.
**Fix:** Validate: `const n = Number(LIMITE_RAW); if (!Number.isInteger(n) || n < 0) throw new Error("LLM_BENCH_LIMIT debe ser un entero ≥ 0")`.

### IN-02: negation `correctas` counts trivially-null cases as "correct negation handling"

**File:** `packages/llm-bench/src/tasks/extraccion/scorer.ts:223,249`
**Issue:** `ideaOk` starts `true` and only flips false in the affirmed-idea branches. For a `negacion`-stratum case whose `expected.idea_matriz_substring` is `null` and the model returns `null`, `ideaOk` stays `true`, so the case counts toward `negacionCorrectas` even though no substring/negation preservation was actually exercised. The sub-metric denominator (only `estrato`-negacion cases, split by `|`) and `accuracy` (correctas/total, 1 when total===0) are otherwise computed correctly, and additivity is confirmed (commit 8edf9cb touched only `scorer.ts` + `scorer.test.ts`; `casos.json`/sha256 intact). This is a mild semantic softness in what "correct negation" means for null-idea negation cases, not a scoring bug for the affirmed-negation cases that matter.
**Fix:** If null-idea cases exist in the negation stratum, consider counting a negation case as `correcta` only when it genuinely exercised the substring rule (affirmed idea that remained a literal substring), or document that null-idea negation cases are trivially correct by design.

---

_Reviewed: 2026-07-27T03:31:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
