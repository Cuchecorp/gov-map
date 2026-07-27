---
phase: 108-tier-p2-plomeria-tieredprovider-judgeprovider-ladder-telemetria
plan: "01"
subsystem: llm
tags: [telemetry, task-ladder, mock-provider, types, payload-free]
dependency_graph:
  requires: []
  provides:
    - packages/llm/src/telemetry.ts (TelemetrySink, TelemetryEvent, noopSink, jsonlSink)
    - packages/llm/src/task-ladder.ts (TierSpec, LadderConfig, TaskLadder, buildTieredProvider)
    - packages/llm/src/test-mock.ts (MockProvider, MockJudgeProvider)
    - packages/llm/src/types.ts:task (CompletionRequest.task aditivo)
  affects:
    - packages/llm/src/index.ts (barrel ampliado)
tech_stack:
  added: []
  patterns:
    - "TelemetrySink como función pura payload-free (TIER-04)"
    - "buildTieredProvider como fábrica declarativa (forward ref Wave 2)"
    - "MockProvider local sin import cruzado (cero circular)"
key_files:
  created:
    - packages/llm/src/telemetry.ts
    - packages/llm/src/task-ladder.ts
    - packages/llm/src/test-mock.ts
    - packages/llm/src/telemetry.test.ts
  modified:
    - packages/llm/src/types.ts (task? aditivo)
    - packages/llm/src/index.ts (export * telemetry + task-ladder)
decisions:
  - "task? en CompletionRequest es aditivo; ausencia = byte-idéntico (TIER-02)"
  - "TelemetryEvent excluye user/system/answer/prompt/reason; solo ok/confidence del Verdict (TIER-04/T-108-01)"
  - "buildTieredProvider lanza en Wave 1 (./tiered no existe aún); tsc falla solo en este error esperado"
  - "MockProvider clonado mínimo dentro de @obs/llm para evitar dependencia circular con @obs/llm-bench"
metrics:
  duration: "~6 min"
  completed_date: "2026-07-27"
  tasks: 2
  files: 6
---

# Phase 108 Plan 01: Contratos plomería LLM (telemetry + task-ladder + MockProvider) Summary

**One-liner:** Contrato telemetría payload-free (TelemetrySink/TelemetryEvent) + config declarativa tarea→escalera (LadderConfig/buildTieredProvider) + MockProvider local para tests offline de la cascada.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CompletionRequest.task aditivo + telemetry.ts | 1a009af | types.ts, telemetry.ts |
| 2 | task-ladder.ts + test-mock.ts + telemetry.test.ts + barrel | c2ddf8b | task-ladder.ts, test-mock.ts, telemetry.test.ts, index.ts |

## Verification

- `pnpm --filter @obs/llm exec vitest run src/telemetry.test.ts`: **13/13 PASS**
- Suite completa `@obs/llm`: **123 pass / 3 skip** (baseline era 102 pass / 3 skip; +21 tests nuevos, cero regresión)
- `pnpm --filter @obs/llm exec tsc -b`: 1 error esperado (`Cannot find module './tiered'` — forward ref Wave 2, documentado en el plan). Este error se cierra cuando Plan 02 escribe `./tiered`.

## Deviations from Plan

**1. [Rule 1 - Bug] Eliminado `require()` en buildTieredProvider**
- **Found during:** Task 2
- **Issue:** La primera versión usaba `require("./tiered")` para diferir la importación en runtime, lo que generaba un error tsc adicional (`Cannot find name 'require'` — falta @types/node) además del error esperado del módulo faltante.
- **Fix:** Se reemplazó el cuerpo por `throw new Error(...)` con `void opts` para satisfacer el compilador. La función existe con su firma correcta; Plan 02 la reemplazará con la implementación real.
- **Files modified:** packages/llm/src/task-ladder.ts

No other deviations — plan executed as written.

## Known Stubs

- `buildTieredProvider` lanza `Error("not implemented in Wave 1")` — stub INTENCIONAL y documentado. Plan 108-02 escribe `./tiered` y conecta la implementación real. Esto no impide el objetivo del plan (definir la superficie de tipos contra la que Plan 02 compila).

## Threat Flags

Ninguno — sin nuevas superficies de red, auth, ni esquema. `TelemetryEvent` verificado payload-free por test de Object.keys (T-108-01 mitigado).

## Self-Check: PASSED

- packages/llm/src/telemetry.ts: FOUND
- packages/llm/src/task-ladder.ts: FOUND
- packages/llm/src/test-mock.ts: FOUND
- packages/llm/src/telemetry.test.ts: FOUND
- Commits 1a009af y c2ddf8b: FOUND en git log
