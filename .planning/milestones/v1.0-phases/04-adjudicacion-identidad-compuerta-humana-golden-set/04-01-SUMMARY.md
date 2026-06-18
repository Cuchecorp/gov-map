---
phase: 04-adjudicacion-identidad-compuerta-humana-golden-set
plan: 01
subsystem: identity
tags: [adjudication, llm, minimax, zod, blocking, fail-closed, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-capa-de-providers-llm-embeddings
    provides: "LLMProvider, CompletionRequest, MiniMaxProvider, parseAndValidate, assertNoRutInLlmInput, assertSensitivityAllowed"
  - phase: 03-tabla-maestra-parlamentario-identidad-determinista
    provides: "Parlamentario type, EstadoIdentidad, normalizarNombre/tokens, maestra poblada (186 reales)"
provides:
  - "Paquete @obs/adjudication dado de alta (deps @obs/core + @obs/identity + @obs/llm)"
  - "generarCandidatos() blocking fail-open (cámara/periodo duros, región blanda)"
  - "AdjudicacionSchema (zod) + construirPromptAdjudicacion() + SYSTEM_ADJUDICACION"
  - "aplicarCompuerta() pura fail-closed con UMBRAL=0.90 estricto (borde 0.90 auto-acepta)"
  - "MockMiniMaxProvider determinista (sin red) para tests downstream"
  - "CompletionRequest.temperature? opcional retrocompatible en @obs/llm"
affects: [04-02-cola-revision-humana, 04-03-orquestacion-golden-set, identidad, adjudicacion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compuerta fail-closed: acumula TODAS las razones (sin corto-circuito), auto-aceptar solo si lista vacía"
    - "Blocking fail-open: filtros duros (cámara/periodo) + blando (región) para evitar falsos negativos silenciosos"
    - "Minimización de PII: la mención no transporta rut; assertNoRutInLlmInput sobre el prompt final"
    - "Spread condicional para extender CompletionRequest sin romper callers existentes (A1)"

key-files:
  created:
    - packages/adjudication/src/tipos.ts
    - packages/adjudication/src/candidatos.ts
    - packages/adjudication/src/prompt.ts
    - packages/adjudication/src/compuerta.ts
    - packages/adjudication/src/mock-provider.ts
    - packages/adjudication/src/slice.e2e.test.ts
  modified:
    - packages/llm/src/types.ts
    - packages/llm/src/providers/minimax.ts
    - tsconfig.json
    - tsconfig.base.json

key-decisions:
  - "UMBRAL=0.90 con comparación ESTRICTA <: confidence===0.90 auto-acepta, 0.8999 enruta a revisión (bug existencial #1 sellado con test de borde mandatorio)"
  - "Auto-aceptar mapea SOLO a estado 'probable', NUNCA 'confirmado' (A4); el mapeo lo hace el orquestador, la compuerta es pura"
  - "Mención foránea SIN rut por construcción; assertNoRutInLlmInput corre sobre el prompt final ensamblado (no campos sueltos)"
  - "Región fail-open: solo descarta si AMBOS lados traen región y difieren; perder el candidato real es falso negativo silencioso"
  - "temperature? opcional con spread condicional en MiniMax para no alterar el comportamiento por defecto (A1)"

patterns-established:
  - "Fail-closed gate: cualquier razón → revisión humana; solo lista vacía → auto-aceptar"
  - "Mock provider valida la respuesta fijada contra el schema recibido (compuerta zod externa, como el adapter real)"

requirements-completed: [ID-03, ID-04, ID-06]

# Metrics
duration: 9min
completed: 2026-06-18
---

# Phase 4 Plan 01: Núcleo puro de adjudicación de identidad + compuerta fail-closed Summary

**Paquete @obs/adjudication con blocking fail-open de candidatos, AdjudicacionSchema (zod) + prompt restrictivo en español, y la compuerta fail-closed UMBRAL=0.90 estricto (auto-acepta a 'probable', nunca 'confirmado') + slice e2e con MiniMax mockeado sin red.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-18T10:08:00Z
- **Completed:** 2026-06-18T10:17:00Z
- **Tasks:** 3
- **Files modified:** 13 (9 creados en @obs/adjudication, 2 en @obs/llm, 2 tsconfig)

## Accomplishments
- `@obs/adjudication` dado de alta espejando `@obs/identity` (deps `@obs/core` + `@obs/identity` + `@obs/llm`), resolviendo en el workspace (`pnpm -w typecheck` exit 0).
- `aplicarCompuerta()` fail-closed con UMBRAL=0.90 **estricto** — el borde existencial #1 sellado con test mandatorio (`=== 0.90` auto-acepta; `0.8999` enruta a revisión).
- `generarCandidatos()` blocking fail-open (cámara/periodo duros, región blanda) incluyendo el caso canónico "Walker P., Matías".
- `AdjudicacionSchema` (zod) que rechaza salidas adversarias: confidence fuera de rango, `chosen_id` mal formado, match-con-null.
- Slice e2e: mención dudosa → candidatos → prompt → mock LLM → compuerta → `probable` (NUNCA `confirmado`, A4); RUT que se colaría aborta con **0 llamadas** al provider.
- `CompletionRequest.temperature?` opcional en `@obs/llm` (A1) — 68 tests de @obs/llm siguen verdes sin cambios.

## Task Commits

Cada task se committeó atómicamente (las TDD con test → feat):

1. **Task 1: Scaffold @obs/adjudication + temperature? en @obs/llm** - `c6c05bf` (feat)
2. **Task 2 RED: tests candidatos + schema + prompt** - `35ae973` (test)
3. **Task 2 GREEN: generarCandidatos + AdjudicacionSchema + prompt** - `a3b50b9` (feat)
4. **Task 3 RED: tests compuerta + slice e2e** - `5f25733` (test)
5. **Task 3 GREEN: aplicarCompuerta + mock provider + barrel** - `8baf951` (feat)

## Files Created/Modified
- `packages/adjudication/package.json` - Alta del paquete (espeja @obs/identity).
- `packages/adjudication/tsconfig.json` - composite + references a core/identity/llm.
- `packages/adjudication/vitest.config.ts` - Clon del de identity.
- `packages/adjudication/src/tipos.ts` - `MencionForanea` (sin rut) + `DecisionCompuerta`.
- `packages/adjudication/src/candidatos.ts` - `generarCandidatos()` blocking fail-open.
- `packages/adjudication/src/candidatos.test.ts` - Tests de blocking + Walker P., Matías.
- `packages/adjudication/src/prompt.ts` - `AdjudicacionSchema` + `construirPromptAdjudicacion()` + `SYSTEM_ADJUDICACION`.
- `packages/adjudication/src/prompt.test.ts` - Tests del schema + prompt sin RUT.
- `packages/adjudication/src/compuerta.ts` - `aplicarCompuerta()` pura fail-closed, UMBRAL=0.90.
- `packages/adjudication/src/compuerta.test.ts` - Tabla de decisión exhaustiva + borde 0.90 mandatorio.
- `packages/adjudication/src/mock-provider.ts` - `MockMiniMaxProvider` determinista (sin red).
- `packages/adjudication/src/slice.e2e.test.ts` - Slice vertical + invariante probable/no-confirmado + RUT 0-llamadas.
- `packages/adjudication/src/index.ts` - Barrel del paquete.
- `packages/llm/src/types.ts` - `CompletionRequest.temperature?` opcional (A1).
- `packages/llm/src/providers/minimax.ts` - Spread condicional de `temperature` (A1).
- `tsconfig.json` / `tsconfig.base.json` - Registro del paquete (reference + path mapping).

## Decisions Made
- **UMBRAL=0.90 estricto `<`:** el borde exacto se testea como mandatorio (T-04-01); un `<=` o `>` sería el bug existencial #1.
- **Compuerta pura, mapeo externo:** `aplicarCompuerta` no escribe estado; el orquestador del slice mapea `auto-aceptar → probable` (A4). Mantiene la compuerta testeable como función pura.
- **Región fail-open:** preferir sobre-incluir candidatos; un falso negativo silencioso (perder el candidato real) es peor que sobre-incluir y dejar que la compuerta/revisión descarte.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] El literal "(0-1)" en el prompt disparaba la regex RUT**
- **Found during:** Task 2 (construirPromptAdjudicacion)
- **Issue:** La notación de rango `confidence (0-1)` en el cuerpo del prompt coincide con la regex `assertNoRutInLlmInput` (cuerpo-guion-DV `0-1`), haciendo fallar el test de "prompt sin RUT".
- **Fix:** Reemplazado por "confidence entre 0 y 1" (sin dígito-guion-dígito), conservando el sentido sin disparar el gate.
- **Files modified:** packages/adjudication/src/prompt.ts
- **Verification:** `assertNoRutInLlmInput(prompt)` no lanza; los 9 tests de prompt verdes.
- **Committed in:** a3b50b9 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** El fix es necesario para que el gate de PII (fail-closed) no produzca falsos positivos sobre texto de instrucciones legítimo. Sin scope creep.

## Issues Encountered
- El RUT_REGEX de @obs/llm es deliberadamente amplio (sobre-bloquea por seguridad); hay que redactar el prompt evitando patrones dígito-guion-dígito. Resuelto cambiando "(0-1)" por "entre 0 y 1".

## User Setup Required
None - no external service configuration required. El slice corre 100% con mock determinista (sin red, sin cuota MiniMax).

## Next Phase Readiness
- **04-02 (cola de revisión humana):** consume `DecisionCompuerta` (razones) para encolar; la compuerta ya produce la lista de razones.
- **04-03 (orquestación + golden set):** la orquestación definitiva del pipeline reemplaza el `correrPipeline` inline del slice; `generarCandidatos`/`construirPromptAdjudicacion`/`AdjudicacionSchema`/`aplicarCompuerta` están listos y testeados para componer. `MockMiniMaxProvider` disponible para el golden set sin red.
- Sin blockers.

## Self-Check: PASSED

Todos los archivos creados existen en disco y los 5 commits de tarea están en el historial.

---
*Phase: 04-adjudicacion-identidad-compuerta-humana-golden-set*
*Completed: 2026-06-18*
