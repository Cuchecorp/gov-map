---
phase: 108-tier-p2-plomeria-tieredprovider-judgeprovider-ladder-telemetria
plan: "02"
subsystem: llm
tags: [tiered-provider, escalation, judge, telemetry, mock-tests, guard]
dependency_graph:
  requires:
    - packages/llm/src/telemetry.ts (TelemetrySink/TelemetryEvent — Plan 01)
    - packages/llm/src/task-ladder.ts (LadderConfig/buildTieredProvider — Plan 01)
    - packages/llm/src/test-mock.ts (MockProvider/MockJudgeProvider — Plan 01)
    - packages/llm/src/validate.ts (LLMValidationError)
    - packages/llm/src/data-routing.ts (assertNoRutInLlmInput)
    - packages/llm/src/judge.ts (JudgeProvider/Verdict)
  provides:
    - packages/llm/src/tiered.ts (TieredProvider, TieredProviderOptions, EscalationExhaustedError)
    - packages/llm/src/tiered.test.ts (suite MockProvider offline, 14 tests)
    - packages/llm/src/task-ladder.test.ts (buildTieredProvider, 6 tests)
    - packages/llm/src/tiered-scope-guard.test.ts (guard TIER-05, 1 test)
  affects:
    - packages/llm/src/index.ts (barrel ampliado con ./tiered)
    - packages/llm/src/task-ladder.ts (buildTieredProvider implementado con TieredProvider real)
tech_stack:
  added: []
  patterns:
    - "Decorador LLMProvider drop-in (TieredProvider implements LLMProvider)"
    - "Catch narrowed a LLMValidationError — FLAG-2 (no catch desnudo)"
    - "Juez ESCALATE-ONLY: ok:false escala, ok:true no relaja compuerta"
    - "Escalera inmutable post-construcción — FLAG-1 (tiers fijos al construir)"
    - "1 TelemetryEvent PAYLOAD-FREE por complete() (T-108-06)"
    - "Guard estructural TIER-05: pipeline-cli.ts de fichas intacto (prompt-cache)"
key_files:
  created:
    - packages/llm/src/tiered.ts
    - packages/llm/src/tiered.test.ts
    - packages/llm/src/task-ladder.test.ts
    - packages/llm/src/tiered-scope-guard.test.ts
  modified:
    - packages/llm/src/index.ts (export * from ./tiered)
    - packages/llm/src/task-ladder.ts (buildTieredProvider conecta TieredProvider real)
decisions:
  - "Catch narrowed con instanceof LLMValidationError (FLAG-2): solo fallo zod dispara escalación; errores de red/TypeError/ZodError crudo se re-lanzan sin escalar"
  - "Juez corre solo tras éxito del tier primario (no tras LLMValidationError): ok:false = trigger de escalación; ok:true = retornar resultado de tier-0 sin escalar (ESCALATE-ONLY)"
  - "EscalationExhaustedError tiene 3 razones explícitas: all-tiers-failed, budget-exceeded, no-escalation-tier — sin contenido del prompt"
  - "escalationTier derivado como local const para satisfacer noUncheckedIndexedAccess (tsc strictness)"
  - "task-ladder.ts: import cambia de type-only a import real para construir TieredProvider"
metrics:
  duration: "~15 min"
  completed_date: "2026-07-27"
  tasks: 2
  files: 6
---

# Phase 108 Plan 02: TieredProvider decorador de cascada acotada + tests MockProvider Summary

**One-liner:** TieredProvider decorador LLMProvider con escalada acotada (catch-narrowed LLMValidationError, juez ESCALATE-ONLY, tiers inmutables, presupuesto, telemetría payload-free) + suite offline 21 tests + guard estructural TIER-05 + forward ref Plan 01 cerrado (tsc -b 0).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TieredProvider + barrel | 7662d2e | tiered.ts, index.ts, task-ladder.ts |
| 2 | Suite tests MockProvider + guard TIER-05 | 451c7fd | tiered.test.ts, task-ladder.test.ts, tiered-scope-guard.test.ts |

## Verification

- `pnpm --filter @obs/llm exec tsc -b`: **exit 0** (forward ref ./tiered cerrado)
- `pnpm --filter @obs/llm exec vitest run src/tiered.test.ts src/task-ladder.test.ts src/tiered-scope-guard.test.ts`: **21/21 PASS**
- Suite completa `@obs/llm`: **144 pass / 3 skip** (baseline 123 pass / 3 skip; +21 tests nuevos, cero regresión)
- Guard estructural: pipeline-cli.ts NO contiene `TieredProvider` (TIER-05 verde)
- `grep -c "instanceof LLMValidationError" packages/llm/src/tiered.ts`: 1 (FLAG-2 verificado)

## Deviations from Plan

**1. [Rule 3 - Blocking] noUncheckedIndexedAccess: `tiers[0]`/`tiers[1]` devuelven `T | undefined`**
- **Found during:** Task 1 (primer tsc -b)
- **Issue:** La config tsc del proyecto tiene `noUncheckedIndexedAccess`; acceder `this.tiers[0].complete()` da TS2532 "Object is possibly undefined"
- **Fix:** Alias locales `const primaryTier = this.tiers[0]!` y `const escalationTier = this.tiers[1] as LLMProvider | undefined` tras la validación en constructor; el constructor ya asevera `tiers.length >= 1`
- **Files modified:** packages/llm/src/tiered.ts
- **Commit:** 7662d2e

**2. [Rule 1 - Bug] task-ladder.ts: import cambiado de type-only a import real**
- **Found during:** Task 1
- **Issue:** El stub del Plan 01 importaba `TieredProvider` como `type` (type-only import); al hacer `new TieredProvider(opts)` se necesita el import de valor real
- **Fix:** Cambiar `import type { TieredProvider, TieredProviderOptions }` a `import { TieredProvider, type TieredProviderOptions }` y reemplazar el `throw` stub por `return new TieredProvider(opts)`
- **Files modified:** packages/llm/src/task-ladder.ts
- **Commit:** 7662d2e

No other deviations — plan executed as written.

## Known Stubs

Ninguno. `buildTieredProvider` ya retorna un `TieredProvider` real (el stub Wave 1 fue reemplazado).

## Threat Flags

Ninguno — sin nuevas superficies de red, auth, ni esquema. `TelemetryEvent` payload-free verificado por test de Object.keys (T-108-06 mitigado). RUT-guard en entrada del decorador verificado por test H (T-108-03). Loop-bound verificado por test "bounded" (T-108-04). Juez ESCALATE-ONLY verificado por test D ambas aristas (T-108-05). Guard estructural TIER-05 verde (T-108-07).

## Self-Check: PASSED

- packages/llm/src/tiered.ts: FOUND
- packages/llm/src/tiered.test.ts: FOUND
- packages/llm/src/task-ladder.test.ts: FOUND
- packages/llm/src/tiered-scope-guard.test.ts: FOUND
- Commits 7662d2e y 451c7fd: FOUND en git log
