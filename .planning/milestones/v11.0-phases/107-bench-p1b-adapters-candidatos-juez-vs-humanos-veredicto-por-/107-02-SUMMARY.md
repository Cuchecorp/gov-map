---
phase: 107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-
plan: 02
subsystem: infra
tags: [llm-bench, veredicto, epsilon-gate, es-cl, negacion, judge, human-label, pure, fixture]

# Dependency graph
requires:
  - phase: 107-01
    provides: JudgeProvider/JudgeRequest/Verdict LOCKED contract, PhiJudge
  - phase: 106
    provides: extracción scorer + juez scorer (evaluarJuez/JuzgarFn) + report MetricasModelo/Reporte
provides:
  - MetricasNegacionExtraccion (first-class es-CL negacion{total,correctas,accuracy}) additive on MetricasExtraccion
  - computarVeredicto/computarVeredictoDeReporte (pure per-task ε-gated machine) + EPSILON_POR_TAREA + es-CL hard veto
  - Veredicto/ResultadoTarea/EstadoTarea output types
  - puenteJuezDesdeJudgeProvider + medirJuezVsHumano (PhiJudge->JuzgarFn bridge, vs human_label)
affects: [107-03 LIVE veredicto run, 108 TieredProvider composition]

# Tech tracking
tech-stack:
  added: []  # ZERO new SDK/package
  patterns:
    - "First-class es-CL signal (negacion.accuracy) INDEPENDENT of aggregate value.precision — the veto reads the field, never the aggregate"
    - "ε-gated verdict machine is PURE (no fetch/http); es-CL hard veto short-circuits BEFORE the aggregate gate"
    - "fail-rate (structured_output + zod) is a first-class gate, never averaged into quality"
    - "absent live numbers -> pending-evidence, never a silent approval"
    - "JudgeProvider->JuzgarFn bridge: ok->boolean, throw->null (WR-04); measured vs human_label only"

key-files:
  created:
    - packages/llm-bench/src/veredicto.ts
    - packages/llm-bench/src/veredicto.test.ts
    - packages/llm-bench/src/tasks/juez/juez-vs-humano.ts
    - packages/llm-bench/src/tasks/juez/juez-vs-humano.test.ts
  modified:
    - packages/llm-bench/src/tasks/extraccion/scorer.ts
    - packages/llm-bench/src/tasks/extraccion/scorer.test.ts
    - packages/llm-bench/src/index.ts

key-decisions:
  - "negacion sub-metric is ADDITIVE: casos.json + its sha256 (0dc7bd5b…) are byte-for-byte UNCHANGED; only MetricasExtraccion gains a field; all 106 extracción tests stay green"
  - "negacion.correctas rides the SAME idea-matriz literal-substring outcome already computed per case (no new rule) — a dropped/inverted 'no'/'deróganse' breaks the substring => idea NOT ok => negation NOT correcta"
  - "EPSILON_POR_TAREA declared explicitly per task with justification; extracción is the strictest (0.01) given legal-fidelity stakes; routing/clasificación 0.03; juez 0.05"
  - "es-CL HARD VETO reads negacion.accuracy (NOT value.precision) and short-circuits BEFORE the aggregate ε gate — a candidate with strictly better aggregate precision/recall but worse negacion.accuracy is VETOED"
  - "fail-rate is a first-class gate (structured_output + zod repaired/terminal), tiny float tolerance never lets a genuinely-worse rate pass"
  - "bridge maps Verdict.ok->boolean and a thrown judge->null (WR-04: a broken judge harvests NO recall-de-rechazo); LIVE Phi run is env-gated for Plan 03"

requirements-completed: [BENCH-04, BENCH-05]

# Metrics
duration: 7min
completed: 2026-07-27
---

# Phase 107 Plan 02: VEREDICTO machine + es-CL negacion sub-metric + PhiJudge bridge Summary

**A first-class es-CL `negacion.accuracy` sub-metric added ADDITIVELY to the frozen 106 extracción scorer, a PURE ε-gated VEREDICTO machine whose es-CL HARD VETO reads that independent field and short-circuits the aggregate gate, and a PhiJudge→juez bridge measured against HUMAN labels — all fixture-tested, no network, zero new package.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-27T03:08:49Z
- **Completed:** 2026-07-27T03:15:10Z
- **Tasks:** 3 (all TDD)
- **Files:** 7 (4 created, 3 modified)

## Accomplishments

- **Task 0 — es-CL negacion sub-metric (ADDITIVE):** `MetricasExtraccion` gains a first-class `negacion { total, correctas, accuracy }`. `total` counts cases whose `estrato` contains the `negacion` token (split on `|`); `correctas` rides the SAME idea-matriz literal-substring outcome already computed in the loop (a dropped/inverted negation breaks the substring → idea not ok → negation not correcta); `accuracy = total===0 ? 1 : correctas/total`. `value`/`schema_parse_rate`/`detalle` are UNCHANGED — all 106 extracción tests stay green. `casos.json` and its sha256 (`0dc7bd5b…`) are byte-for-byte untouched.
- **Task 1 — VEREDICTO machine (BENCH-05):** `computarVeredicto(candidato, incumbente)` is PURE (no fetch/http) and emits per task `{approved-model | incumbent-stays | pending-evidence}`. `EPSILON_POR_TAREA` is an explicit named constant with per-metric justification (extracción 0.01 strictest, routing/clasif 0.03, juez 0.05). The **es-CL HARD VETO** reads the first-class `negacion.accuracy` (NOT `value.precision`) and short-circuits BEFORE the aggregate ε gate; a candidate with strictly better aggregate precision/recall but worse `negacion.accuracy` is VETOED (load-bearing fixture proves it). Fail-rate (structured_output + zod repaired/terminal) is a first-class gate. Absent metric → `pending-evidence`, never a silent approval. `computarVeredictoDeReporte` folds over a Reporte and can express "nada aprueba paridad" (every task incumbent-stays).
- **Task 2 — PhiJudge→juez bridge (BENCH-04):** `puenteJuezDesdeJudgeProvider(judge)` adapts `JudgeProvider.judge({answer, sensitivity:"public"})` into the 106 scorer's `JuzgarFn` — `Verdict.ok`→boolean, a thrown judge→`null` (WR-04, never a rejection). `medirJuezVsHumano` is the one-call LIVE entrypoint. CI test uses a deterministic inline mock JudgeProvider (no network): asserts precision_ok/recall_rechazo vs `human_label`, populated bias hooks (porProductor + porLongitud), and that a throwing judge yields `sinVeredicto>0` with `recall_rechazo` NOT 1.0. The real Phi measurement is `describe.skip` unless `LLM_BENCH_LIVE=1` (Plan 03).

## Task Commits

Each task committed atomically (TDD RED→GREEN per task):

1. **Task 0: additive es-CL negacion sub-metric** — `8edf9cb` (feat). RED: 4 new tests fail (field absent) with 11 existing green; GREEN after threading counters.
2. **Task 1: pure ε-gated VEREDICTO machine + es-CL hard veto** — `1923f73` (feat). 9 fixture tests, load-bearing es-CL-veto + nada-aprueba.
3. **Task 2: PhiJudge→juez-vs-humano bridge (CI mock, LIVE-gated)** — `b2525aa` (feat). 4 CI tests + 1 skipped LIVE block.

## Files Created/Modified

- `packages/llm-bench/src/tasks/extraccion/scorer.ts` — `MetricasNegacionExtraccion` interface + `negacion` field on `MetricasExtraccion`; `negacionTotal`/`negacionCorrectas` counters threaded through the loop (ride the per-case `ideaOk` flag); JSDoc marking the field INDEPENDENT of value.precision and ADDITIVE.
- `packages/llm-bench/src/tasks/extraccion/scorer.test.ts` — 5 new assertions: total==count-of-negacion-estrato, accuracy in [0,1], drop-negation→accuracy<1 read WITHOUT value.precision, oro→accuracy===1, separation from value/schema_parse_rate/detalle, empty-set→total 0 accuracy 1. Existing 106 assertions unchanged.
- `packages/llm-bench/src/veredicto.ts` — `EPSILON_POR_TAREA`, `Veredicto`/`ResultadoTarea`/`EstadoTarea`, `computarVeredicto`, `computarVeredictoDeReporte`, es-CL hard veto short-circuit, first-class fail-rate gate, pure (no I/O).
- `packages/llm-bench/src/veredicto.test.ts` — synthetic MetricasModelo fixtures: ε-config shape, approves-on-parity, incumbent-stays, nada-aprueba, es-CL-veto (better aggregate + worse negacion.accuracy → VETOED, razon references negation veto), pending-evidence, fail-rate gate (structured + zod).
- `packages/llm-bench/src/tasks/juez/juez-vs-humano.ts` — `puenteJuezDesdeJudgeProvider` + `medirJuezVsHumano`; pure (network lives in the injected judge).
- `packages/llm-bench/src/tasks/juez/juez-vs-humano.test.ts` — CI mock JudgeProvider (deterministic, no network) + throwing-judge WR-04 test + LIVE describe.skip.
- `packages/llm-bench/src/index.ts` — two net-new barrel re-export lines (`./veredicto`, `./tasks/juez/juez-vs-humano`); existing 106 lines intact.

## Decisions Made

- `negacion.correctas` reuses the existing per-case idea-matriz literal outcome (tracked via a new `ideaOk` flag) rather than a bespoke negation rule — keeps the veto grounded in the SAME substring fidelity the scorer already enforces.
- Quality scalar per task for the ε gate: routing/clasificación `cobertura`, juez `recall_rechazo` (the axis that exposes rubber-stamping), extracción `value.precision`. es-CL is handled OUTSIDE the aggregate as a hard veto.
- Fail-rate gate uses a `1e-9` float tolerance for noise only — never large enough to pass a genuinely-worse rate.
- The bridge calls the judge with `sensitivity: "public"` (juez golden is NO-PII by construction); PhiJudge's own fail-closed RUT guard still bites if one leaked.

## Deviations from Plan

None — plan executed exactly as written. The additive sub-metric, the explicit-ε pure machine, the es-CL hard veto reading `negacion.accuracy` (independent of value.precision, short-circuiting the aggregate), the pending-evidence path, and the WR-04 bridge all follow the plan and threat model verbatim.

## Threat Model Compliance

- **T-107-05 (EoP, veredicto):** absent metric → pending-evidence (test); es-CL deficit → hard veto reading first-class negacion.accuracy short-circuits the aggregate (load-bearing fixture: better aggregate precision but worse negacion.accuracy → VETOED). Both mitigated + tested.
- **T-107-06 (Spoofing, juez vs responder):** bridge feeds `evaluarJuez` which compares ONLY vs `human_label`; JSDoc + tests assert human-label grounding.
- **T-107-07 (Repudiation, weak-judge rubber-stamp):** WR-04 — thrown judge → null; test proves `recall_rechazo` is not inflated to 1.0 by failure.
- **T-107-SC (Tampering, installs):** ZERO new packages; no install task.

## Issues Encountered

None. TDD RED verified before each GREEN (Task 0 via 4 failing new tests; Tasks 1/2 net-new modules). `tsc -b` clean for the package after each task. Full `@obs/llm-bench` suite green: 124 passed, 2 skipped (baseline.live + the LIVE juez block).

## Known Stubs

None that block the plan goal. The real Phi measurement is LIVE-gated (`describe.skip` unless `LLM_BENCH_LIVE=1`) by design — Plan 03 owns the actual run with operator credentials, per 107-CONTEXT.

## Verification

- `pnpm --filter @obs/llm-bench test` → 124 passed, 2 skipped (13 files passed, 1 skipped).
- `pnpm exec tsc -b` (packages/llm-bench) → exit 0.
- Grep: no `fetch`/`http` in `veredicto.ts` or `juez-vs-humano.ts` (both pure).
- `negacion` present in scorer.ts (sub-metric) AND in veredicto.ts (the veto reads it, not value.precision).
- `casos.json` sha256 `0dc7bd5bec4e79fc333901f6f9ca8573ada6a2b2d854537bf8d24d2674fd9703` unchanged.

## Self-Check: PASSED

All created files exist (veredicto.ts, veredicto.test.ts, tasks/juez/juez-vs-humano.ts, tasks/juez/juez-vs-humano.test.ts). All three task commits present in git log (8edf9cb, 1923f73, b2525aa).

---
*Phase: 107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-*
*Completed: 2026-07-27*
