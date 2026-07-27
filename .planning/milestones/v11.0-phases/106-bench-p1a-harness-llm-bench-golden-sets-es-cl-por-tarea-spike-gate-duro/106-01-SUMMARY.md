---
phase: 106
plan: 01
subsystem: llm-bench
tags: [benchmark, harness, metrics, instrumentation, tsc-references, tdd]
dependency_graph:
  requires: ["@obs/llm (runtime contract, fetchFn hook, validate.ts repair loop)"]
  provides:
    - "@obs/llm-bench workspace package (outside @obs/llm)"
    - "metric core: percentile (nearest-rank), costoUsd, clasificarOutcome, agregarFallos"
    - "instrumentedFetch fetch-wrapper (latency + usage capture, host-agnostic)"
    - "versioned+dated PRICING table (incumbents only) + tarifaDe()"
    - "Reporte / MetricasModelo type with the two fail metrics as SEPARATE fields"
    - "complete barrel src/index.ts (single owner 106-01) + 6 placeholder scorer/guard modules for Wave 2"
  affects:
    - "106-02 / 106-03 fill guards/*.ts and tasks/*/scorer.ts (never edit the barrel)"
tech_stack:
  added: []  # ZERO new external packages (RESEARCH § Package Legitimacy Audit)
  patterns:
    - "tsc -b via references (NOT paths) — Phase 43 gotcha"
    - "vitest per package, CI-mock discipline; passWithNoTests"
    - "TDD RED→GREEN per behavior-adding task"
    - "single-owner barrel + forward re-exports + export {} placeholders for parallel Wave 2"
key_files:
  created:
    - packages/llm-bench/package.json
    - packages/llm-bench/tsconfig.json
    - packages/llm-bench/vitest.config.ts
    - packages/llm-bench/src/index.ts
    - packages/llm-bench/src/metrics.ts
    - packages/llm-bench/src/metrics.test.ts
    - packages/llm-bench/src/pricing.ts
    - packages/llm-bench/src/instrument.ts
    - packages/llm-bench/src/instrument.test.ts
    - packages/llm-bench/src/report.ts
    - packages/llm-bench/src/guards/freeze.ts
    - packages/llm-bench/src/guards/no-rut.ts
    - packages/llm-bench/src/tasks/routing/scorer.ts
    - packages/llm-bench/src/tasks/clasificacion/scorer.ts
    - packages/llm-bench/src/tasks/juez/scorer.ts
    - packages/llm-bench/src/tasks/extraccion/scorer.ts
  modified:
    - tsconfig.json
    - pnpm-lock.yaml
decisions:
  - "The two failure metrics are separate first-class fields: structured_output_fail_rate is NOT inside zod_fail_rate; folding is asserted-against by test (Pitfall B, LOCKED)"
  - "instrumentedFetch returns the ORIGINAL response and reads a clone (never consumes the body the adapter needs); sink carries only latency + token counts, never payload text (T-106-02)"
  - "PRICING lists ONLY incumbent rates (DeepSeek/MiniMax), dated 2026-07-26, marked [ASSUMED] MEDIUM re-verify 107; NO candidate (Granite/Phi) rates and NO new secret (107 scope)"
  - "The barrel is the single owner of this plan; core modules also created as placeholders in Task 1 so tsc -b was green before Tasks 2/3 filled them — Wave 2 overwrites only guard/scorer bodies"
metrics:
  duration: ~6 min
  completed: 2026-07-27
---

# Phase 106 Plan 01: BENCH P1a — llm-bench harness (measurement core) Summary

Scaffolded `@obs/llm-bench` OUTSIDE `@obs/llm` and built its measurement core: nearest-rank percentiles + cost-from-usage + a four-way outcome classifier that keeps `structured_output_fail_rate` and `zod_fail_rate.{repaired,terminal}` as separate first-class fields, an `instrumentedFetch` wrapper that captures real-path latency+token-usage via the adapter `fetchFn` hook (returning the original response, sink carries no payload text), a versioned+dated incumbent-only pricing table, and a `Reporte` type where "nada aprueba paridad" is expressible; the complete barrel is authored once here so the two Wave-2 plans only fill placeholder modules.

## What was built

- **Task 1 — package + barrel** (`190ece1`): `@obs/llm-bench` (private, `type: module`, deps `@obs/llm` workspace:* + zod, dev vitest/@types/node); tsconfig `references: [{ "../llm" }]` (NOT paths); appended `{ "path": "./packages/llm-bench" }` to root tsconfig. Complete barrel `src/index.ts` (single owner) forward-re-exports the 4 core modules + 2 guards + 4 task scorers; 6 placeholder guard/scorer modules + 4 core placeholders (`export {}`) so `tsc -b` was exit 0 immediately.
- **Task 2 — metric core** (TDD, `631f0d4` RED → `b70f86b` GREEN): `percentile` (nearest-rank, no interpolation, empty→NaN, clamped), `costoUsd` (null never 0 on missing usage), `CallOutcome` union + `clasificarOutcome` (mirrors validate.ts repair loop), `agregarFallos` (three distinct rates, anti-Pitfall-B). 15 tests including the meta-check that a model structure-failing 30% reports a high `structured_output_fail_rate` (does NOT look good).
- **Task 3 — pricing + instrument + report** (TDD, `15f013f` RED → `eb7700e` GREEN): `PRICING` dated 2026-07-26 + `[ASSUMED]` MEDIUM incumbent rates + `tarifaDe()`; `instrumentedFetch` (times call, clones response, emits `CallMetric`, returns original); `Reporte`/`MetricasModelo` with the two fail metrics separate + `p95Indicativo` small-N flag + `n_muestras` + `costo_por_1k: number|null`. 3 instrument tests (usage present / absent / non-JSON body).

## Verification

- `pnpm --filter @obs/llm-bench test` → 18/18 green (metrics 15 + instrument 3).
- `pnpm --filter @obs/llm-bench exec tsc -b` → exit 0.
- Root `pnpm exec tsc -b` → exit 0 (package in the references graph).
- `@obs/llm` package UNCHANGED (git diff over the plan's commits is empty for `packages/llm/`).
- ZERO new external package (only zod/vitest/@types/node, all pre-existing).

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Core placeholders created in Task 1 to keep tsc -b green.**
- **Found during:** Task 1 (verify step ran `tsc -b`, which resolves ALL barrel re-exports).
- **Issue:** The complete barrel forward-re-exports `./metrics`, `./pricing`, `./instrument`, `./report` — modules whose real bodies are authored in Tasks 2/3. Without placeholders, Task 1's own `tsc -b` verify would fail on unresolved modules.
- **Fix:** Created the four core modules as `export {}` placeholders in Task 1 (alongside the six guard/scorer placeholders the plan already mandates); Tasks 2/3 overwrote them with real implementations. This matches the plan's own placeholder strategy for the barrel targets.
- **Files:** src/metrics.ts, src/pricing.ts, src/instrument.ts, src/report.ts
- **Commit:** 190ece1

**2. [Rule 3 - Blocking issue] pnpm-lock.yaml staged with Task 1.**
- **Issue:** `pnpm install` (needed to link the new workspace package) updated the lockfile.
- **Fix:** Staged `pnpm-lock.yaml` in the Task 1 commit — it is the workspace-linking artifact of scaffolding the package.
- **Commit:** 190ece1

No architectural changes; no auth gates; no new secret (T-106-03 respected — 106 scope only).

## Known Stubs

The six Wave-2 modules are intentional `export {}` placeholders owned by 106-02/106-03 (documented in each file header). This is by design per the plan (single-owner barrel + Wave-2 fills bodies), not a data stub that blocks the plan goal.

| File | Reason | Resolved by |
|------|--------|-------------|
| src/guards/freeze.ts | freeze-marker guard | 106-02 |
| src/guards/no-rut.ts | no-RUT static guard | 106-02 |
| src/tasks/routing/scorer.ts | routing scorer | 106-02 |
| src/tasks/clasificacion/scorer.ts | clasificación scorer | 106-02 |
| src/tasks/juez/scorer.ts | juez/validación scorer | 106-03 |
| src/tasks/extraccion/scorer.ts | paridad-extracción scorer | 106-03 |

## Self-Check: PASSED

All 16 created files present on disk; all 5 task commits (190ece1, 631f0d4, b70f86b, 15f013f, eb7700e) present in git.
