---
phase: 109-integ-p3-integrar-clasificacion-tras-golden-gate-verde
plan: "02"
subsystem: cruces/llm
tags: [clasificacion, tiered-provider, ci-gate, env-gate, integ-03]
dependency_graph:
  requires: [109-01]
  provides: [INTEG-01, INTEG-03]
  affects: [packages/cruces, packages/llm, .github/workflows/ci.yml]
tech_stack:
  added: []
  patterns:
    - resolverProvider pure function (env-gate testeable sin process.env global)
    - TieredProvider via buildTieredProvider (drop-in LLMProvider)
    - CI offline golden gate (MockClasificadorProvider, no secrets)
key_files:
  created:
    - packages/cruces/src/clasificar-fichas-cli.test.ts
  modified:
    - packages/cruces/src/clasificar-fichas-cli.ts
    - .github/workflows/ci.yml
    - .env.example
decisions:
  - "resolverProvider extraída como función pura exportada para testear offline sin process.env global"
  - "Default incumbente: DeepSeekProvider directo cuando CLASIFICACION_ESCALERA != '1' (byte-idéntico INTEG-03)"
  - "Fail-safe Pitfall 2: keys vacías caen a DeepSeek con log de advertencia, nunca GraniteProvider con token vacío"
  - "ci.yml ampliado con dos steps offline (@obs/llm + @obs/cruces) sin secrets"
  - "El agente NO setea CLASIFICACION_ESCALERA=1 — config-flip diferido a operador tras shadow-eval verde"
metrics:
  duration: "~8 min"
  completed: "2026-07-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 109 Plan 02: Swap construction point + golden CI gate Summary

**One-liner:** Env-gate en clasificar-fichas-cli.ts (CLASIFICACION_ESCALERA; default = DeepSeek incumbente byte-idéntico) + golden de clasificación como gate CI permanente offline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Swap construction point con env-gate default-incumbente | fbf1e78 | clasificar-fichas-cli.ts, clasificar-fichas-cli.test.ts |
| 2 | Golden CI gate permanente + .env.example | b6c4c31 | ci.yml, .env.example |

## What Was Built

### Task 1: resolverProvider + env-gate

`resolverProvider(opts, env, log): LLMProvider` — función pura exportada que encapsula toda la lógica de resolución del provider:

- **Rama 1:** `opts.provider` inyectado → se usa directo (tests / integración).
- **Rama 2 (DEFAULT):** `CLASIFICACION_ESCALERA !== "1"` → `new DeepSeekProvider(...)` — byte-idéntico al código previo, INTEG-03 rollback por config.
- **Rama 3:** `CLASIFICACION_ESCALERA === "1"` + keys válidas → `buildTieredProvider` con Granite primario (Workers AI) y DeepSeek escalación.
- **Fail-safe (Pitfall 2 / T-109-05):** si `WORKERS_AI_API_TOKEN` o `CLOUDFLARE_ACCOUNT_ID` vacíos → fallback DeepSeek con log de advertencia.
- `CLOUDFLARE_ACCOUNT_ID` interpolado en baseURL, nunca hardcodeado (T-109-07).

5 tests offline verdes (TDD RED→GREEN confirmado).

### Task 2: ci.yml + .env.example

`ci.yml` ampliado con dos steps offline tras `tsc --noEmit`:
- `Test @obs/llm (TieredProvider + provider-guard + scope-guards)` — 17 suites, 158 tests.
- `Test @obs/cruces (golden clasificación + wiring)` — 6 suites, 38 tests + 1 skipped (LIVE).

Ambos corren sin secrets (CRUCES_GOLDEN_LIVE ausente → test LIVE salta). Un fallo bloquea merge.

`.env.example`: `CLASIFICACION_ESCALERA=` con comentario que explica el config-flip de operador.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DeepSeekProvider rejects apiKey="" in constructor**

- **Found during:** Task 1, GREEN phase
- **Issue:** El SDK openai@6 lanza `Missing credentials` cuando `apiKey=""`. El Test 1 pasaba `{}` como env → `DEEPSEEK_API_KEY` undefined → `""` → crash en el constructor.
- **Fix:** Test 1 pasa `{ DEEPSEEK_API_KEY: "dummy-deepseek" }` en env. El constructor no toca la red — la función `resolverProvider` sigue siendo pura y offline.
- **Files modified:** packages/cruces/src/clasificar-fichas-cli.test.ts
- **Commit:** fbf1e78

## Verification

- `pnpm --filter @obs/cruces exec vitest run` → 38 passed, 1 skipped (LIVE-gated)
- `pnpm --filter @obs/llm exec vitest run` → 158 passed, 3 skipped (LIVE-gated)
- `pnpm --filter @obs/cruces exec tsc -b` → exit 0
- `grep -q "@obs/cruces" .github/workflows/ci.yml` → OK
- `grep -q "@obs/llm exec vitest" .github/workflows/ci.yml` → OK
- `grep -q "CLASIFICACION_ESCALERA" .env.example` → OK
- integ-scope-guard verde (clasificar-fichas-cli.ts = target legítimo; lobby-cli/pipeline-cli sin TieredProvider)
- tiered-scope-guard verde
- El agente NO seteó CLASIFICACION_ESCALERA=1 en ningún lado

## Known Stubs

None — plan ejecutado sin stubs. La escalera Granite está construida pero gateada por la env var; la activación es config-flip del operador.

## Threat Flags

None — ninguna nueva superficie de red, auth path ni schema change fuera del threat model del plan.

## Self-Check: PASSED

- packages/cruces/src/clasificar-fichas-cli.ts: FOUND
- packages/cruces/src/clasificar-fichas-cli.test.ts: FOUND
- .github/workflows/ci.yml: FOUND (@obs/cruces step presente)
- .env.example: FOUND (CLASIFICACION_ESCALERA presente)
- Commits fbf1e78, b6c4c31: FOUND (git log)
