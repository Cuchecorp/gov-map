---
phase: 02-capa-de-providers-llm-embeddings
plan: 02
subsystem: capa-de-providers-llm
tags: [typescript, deno, vitest, tdd, openai-sdk, zod4, minimax, tool-calling, data-routing, rut, fail-closed, smoke-test-gated]

# Dependency graph
requires:
  - "02-01: contratos LLMProvider/CompletionRequest, parseAndValidate (compuerta zod unica), SensitiveRoutingError (router), config minimax (MiniMax-M3 / api.minimax.io/v1), makeMockFetch, barrel index.ts + stubs (json-schema/data-routing/minimax)"
  - "zod 4.4.3 (z.toJSONSchema nativo); openai SDK v6 (fetch inyectable)"
provides:
  - "MiniMaxProvider: adapter tier critico/sensible via TOOL-CALLING FORZADO (tool_choice fija emit_result), lee tool_calls[0].function.arguments, valida por la MISMA compuerta externa que DeepSeek; sin response_format"
  - "zodToToolSchema: deriva el JSON schema de la tool function desde zod (z.toJSONSchema), una sola fuente de verdad; strip $schema"
  - "data-routing: assertNoRutInLlmInput (RUT nunca al LLM, error sin el RUT) + assertSensitivityAllowed (PII solo a tier trainsOnInputs=false, reusa SensitiveRoutingError)"
  - "smoke.test.ts: smoke live por proveedor gated por LLM_SMOKE=1, describe.skip por defecto (CI no lo corre)"
affects: [adjudicacion-identidad-fase-4, extraccion-fichas-fase-7]

# Tech tracking
tech-stack:
  added: []
  patterns: [tool-calling-forzado, zod-to-jsonschema-single-source, compuerta-zod-unica-externa, data-routing-fail-closed, rut-never-llm, smoke-test-gated-por-env, tdd-red-green, stub-relleno-sin-tocar-barrel]

key-files:
  created:
    - packages/llm/src/json-schema.test.ts
    - packages/llm/src/providers/minimax.test.ts
    - packages/llm/src/data-routing.test.ts
    - packages/llm/src/smoke.test.ts
  modified:
    - packages/llm/src/json-schema.ts
    - packages/llm/src/providers/minimax.ts
    - packages/llm/src/data-routing.ts

key-decisions:
  - "MiniMax structured output = tool-calling forzado: tools=[emit_result] con parameters derivados de zod, tool_choice fija la function; NUNCA response_format (verificado 02-CONTEXT.md)"
  - "MiniMaxProvider NO hace su propio safeParse: lee tool_calls[0].function.arguments (string|undefined) y delega a parseAndValidate (compuerta unica identica a DeepSeek) — sin tool_calls => repair => LLMValidationError, nunca se acepta salida no estructurada"
  - "zodToToolSchema strip $schema: el JSON schema de los parameters de la function es plano, sin la meta-clave del documento"
  - "RUT regex determinista (con/sin puntos, DV 0-9/K); el error NUNCA incluye el RUT ni el texto (T-02-05)"
  - "assertSensitivityAllowed REUSA SensitiveRoutingError de router.ts (no se duplica): fail-closed compartido PII->tier que entrena"
  - "smoke test (LIVE ? describe : describe.skip) + it.skipIf por key faltante: 0 ejecuciones sin LLM_SMOKE; Gemini sub-test importa el stub de 02-03 (resuelve aunque 03 no haya corrido, solo corre con LLM_SMOKE=1)"

requirements-completed: [FND-06]

# Metrics
duration: 3min
completed: 2026-06-18
---

# Phase 2 Plan 02: Adapter MiniMax (tool-calling forzado) + data-routing + smoke gated Summary

**Rellena los tres stubs de 02-01 con el tier critico real: `MiniMaxProvider` obtiene salida estructurada via TOOL-CALLING FORZADO (`tool_choice` fija una function unica `emit_result` cuyos `parameters` derivan del zod via `zodToToolSchema`/`z.toJSONSchema`), lee `tool_calls[0].function.arguments` y la valida por la MISMA compuerta externa (`parseAndValidate`) que DeepSeek — sin `response_format`, sellando "MiniMax sin response_format universal" sin que el caller note diferencia. La politica `data-routing` queda en codigo y testeada: `assertNoRutInLlmInput` rechaza un RUT antes de cualquier llamada LLM (error sin el RUT) y `assertSensitivityAllowed` aborta PII hacia un tier que entrena reutilizando `SensitiveRoutingError`. Un smoke test live por proveedor existe gated por `LLM_SMOKE=1` y se salta por defecto.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2 (ambas TDD)
- **Files created:** 4 (tests); 3 stubs reemplazados por implementacion real
- **Tests:** 27 verdes (+3 smoke skipped) en 8 archivos; suite completa @obs/llm sin red ni keys

## Accomplishments
- **MiniMaxProvider (tier critico/sensible, FND-06):** tool-calling forzado — `tools:[{type:"function",function:{name:"emit_result",parameters:<jsonSchemaFromZod>}}]` + `tool_choice:{type:"function",function:{name:"emit_result"}}`. Extrae `choices[0].message.tool_calls[0].function.arguments` (acotado a `type==="function"` por el union del SDK v6) y delega a la compuerta externa. Sin tool_calls => `arguments` undefined => repair loop => `LLMValidationError`. NO usa `response_format`. `id="minimax"`, `trainsOnInputs=false`.
- **zodToToolSchema:** `z.toJSONSchema(schema)` (zod v4 nativo, una sola fuente de verdad), eliminando la meta-clave `$schema` para que los `parameters` de la function sean planos.
- **data-routing en codigo (criterio 4 de la fase):** cabecera que documenta la politica dato->proveedor (RUT nunca al LLM; PII solo a tier `trainsOnInputs=false`; Gemini free solo texto publico). `assertNoRutInLlmInput` (regex de RUT chileno con/sin puntos, DV 0-9/K) lanza `RutInLlmInputError` cuyo mensaje NUNCA expone el RUT ni el texto. `assertSensitivityAllowed` reutiliza `SensitiveRoutingError` (no se duplica) para abortar `personal && trainsOnInputs`.
- **Smoke test live gated:** `(LIVE ? describe : describe.skip)` con `LIVE = process.env.LLM_SMOKE === "1"`; 1 sub-test por proveedor (DeepSeek/MiniMax/Gemini) con `it.skipIf` por key faltante. Skip por defecto (CI no quema cuota ni expone keys). Documenta como confirmar A1 (MiniMax forced tool_choice) y A4 (Gemini batch shape).
- **Capa enchufable real (criterio 2):** agregar MiniMax NO toco `router.ts`, `validate.ts` ni `index.ts` — solo se rellenaron stubs. Un adapter + config, cero cambios aguas arriba.

## Task Commits

1. **Task 1: Helper zod->JSON-schema + MiniMaxProvider (tool-calling forzado)** (TDD)
   - `test(02-02)` RED `467ed0f` -> `feat(02-02)` GREEN `a4dc54c`
2. **Task 2: Politica data-routing + smoke test live gated** (TDD)
   - `test(02-02)` RED `49af287` -> `feat(02-02)` GREEN `20d530f`

## Files Created/Modified
- `packages/llm/src/json-schema.ts` - `zodToToolSchema` via `z.toJSONSchema` (strip `$schema`)
- `packages/llm/src/providers/minimax.ts` - `MiniMaxProvider` tool-calling forzado, compuerta externa, sin response_format
- `packages/llm/src/data-routing.ts` - `RutInLlmInputError`/`assertNoRutInLlmInput`/`assertSensitivityAllowed`; politica documentada en cabecera
- `packages/llm/src/json-schema.test.ts` / `minimax.test.ts` / `data-routing.test.ts` - cobertura del `<behavior>` con mock-fetch / logica pura
- `packages/llm/src/smoke.test.ts` - smoke live gated por LLM_SMOKE (skip por defecto)

## Decisions Made
- **Tool-calling forzado, no response_format** - MiniMax no soporta `response_format` universal (verificado en vivo, 02-CONTEXT.md); la function unica `emit_result` con `tool_choice` impone la forma. La salida estructurada se lee de `tool_calls[0].function.arguments`.
- **Compuerta externa identica a DeepSeek** - el adapter NUNCA hace safeParse; `parseAndValidate` valida y el reprompt re-llama agregando los issues zod. Esto unifica los dos modos (json_object vs tool-calling) tras una sola garantia.
- **Error de RUT sin el RUT** - `RutInLlmInputError` lleva un mensaje generico ("input contains a RUT; RUT must never be sent to an LLM"); test asserta que ni el RUT ni el texto aparecen (T-02-05).
- **Reusar SensitiveRoutingError** - `assertSensitivityAllowed` importa el error del router en vez de duplicar el tipo: el fail-closed PII->tier-que-entrena es uno solo en todo @obs/llm.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El union de `tool_calls` del SDK openai v6 no tiene `.function` en todos sus miembros**
- **Found during:** Task 1 (typecheck tras GREEN)
- **Issue:** `res.choices[0].message.tool_calls[0].function.arguments` fallaba el typecheck: en openai v6 el tipo `tool_calls[]` es un union `ChatCompletionMessageFunctionToolCall | ChatCompletionMessageCustomToolCall`, y el custom no expone `.function` (TS2339).
- **Fix:** Acotar por `toolCall?.type === "function"` antes de leer `.function.arguments` (la function tool es la unica que forzamos via tool_choice); `undefined` en cualquier otro caso (alimenta el repair loop, consistente con el caso "sin tool_calls").
- **Files modified:** packages/llm/src/providers/minimax.ts
- **Verification:** `pnpm -w typecheck` exit 0; 6/6 tests de Task 1 verdes.
- **Committed in:** GREEN de Task 1 (`a4dc54c`)

---

**Total deviations:** 1 auto-fixed (estrechamiento de tipo del SDK v6, necesario para typecheck). Sin cambios arquitectonicos. Sin scope creep. Sin paquetes nuevos. `index.ts` no se toco (cero colision con la wave 02-03 paralela).

## Known Stubs

Ninguno introducido por este plan. Los tres stubs que 02-02 tenia asignados (`json-schema.ts`, `providers/minimax.ts`, `data-routing.ts`) quedan IMPLEMENTADOS y testeados. El unico stub que el smoke test referencia (`GeminiEmbeddingProvider` de 02-03) sigue siendo stub por diseno — su sub-test solo corre con `LLM_SMOKE=1`, asi que no bloquea la suite por orden de waves.

## Threat Flags

Sin superficie nueva fuera del `<threat_model>` del plan. Mitigaciones del registro STRIDE implementadas y verificadas por tests:
- **T-02-05** (RUT al LLM): `assertNoRutInLlmInput` deteccion determinista; lanza antes de cualquier llamada; mensaje sin el RUT (test con/sin puntos + assert de no-disclosure).
- **T-02-06** (PII a tier que entrena): `assertSensitivityAllowed` reusa `SensitiveRoutingError`; `personal && trainsOnInputs` -> abort.
- **T-02-07** (tool_calls ausentes/adversarios): sin tool_calls -> repair -> `LLMValidationError`; nunca se acepta salida no estructurada.
- **T-02-08** (keys reales en smoke): gated por `LLM_SMOKE=1`, skip por defecto; keys solo de env, jamas en asserts/logs.
- **T-02-SC** (npm installs): sin paquetes nuevos en este plan (accept, heredado de 02-01).

## Verification
- `pnpm --filter @obs/llm test --run`: 27 verdes + 3 smoke skipped (8 archivos).
- `pnpm -w typecheck`: exit 0.
- `deno check packages/llm/src/{providers/minimax,data-routing,json-schema}.ts`: sin error (consumo Edge).
- Sin `LLM_SMOKE`, el bloque smoke no ejecuta tests (describe.skip).

## Next Phase Readiness
- **FND-06 sellado:** dos modos de structured output (DeepSeek json_object, MiniMax tool-calling) unificados tras una sola compuerta zod; politica de datos en codigo. La adjudicacion de identidad (Fase 4) ya puede consumir `MiniMaxProvider` + `assertNoRutInLlmInput`/`assertSensitivityAllowed`.
- **Wave 02-03 (Gemini embeddings)** sigue pendiente y es independiente: rellena `GeminiEmbeddingProvider`/`l2normalize` (FND-07) sin tocar lo de esta rebanada.

## Self-Check: PASSED

- Archivos declarados: json-schema.ts, json-schema.test.ts, providers/minimax.ts, providers/minimax.test.ts, data-routing.ts, data-routing.test.ts, smoke.test.ts — todos presentes.
- Commits: 467ed0f (T1 RED), a4dc54c (T1 GREEN), 49af287 (T2 RED), 20d530f (T2 GREEN) — verificados en el historial.
- Suite: 27 tests verdes + 3 smoke skipped; `pnpm -w typecheck` exit 0; `deno check` de los 3 modulos sin error.
