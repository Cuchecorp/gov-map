---
phase: 02-capa-de-providers-llm-embeddings
plan: 01
subsystem: capa-de-providers-llm
tags: [typescript, deno, vitest, tdd, openai-sdk, zod4, llm-provider, router-fail-closed, repair-loop, mock-fetch]

# Dependency graph
requires:
  - "Patron de paquete @obs/* (Fase 1): package.json/tsconfig/vitest espejo de @obs/ingest"
  - "Patron mock-fetch + fetch inyectable (@obs/ingest/test/_helpers.ts)"
  - "zod 4.4.3 en el lockfile (z.toJSONSchema para la rebanada 02-02)"
provides:
  - "@obs/llm: contratos LLMProvider/EmbeddingProvider/EmbeddingResult/CompletionRequest/Criticality/Sensitivity"
  - "parseAndValidate: compuerta zod UNICA + repair loop + LLMValidationError sin secretos"
  - "selectProvider: router fail-closed + RouterError + SensitiveRoutingError"
  - "DeepSeekProvider: adapter real (response_format json_object) via compuerta externa"
  - "loadRouterConfigFromEnv: config swappable (critical->minimax, bulk->deepseek)"
  - "makeMockFetch para chat-completions sin red (body JSON, respuestas secuenciales)"
  - "Stubs + barrel index.ts para las rebanadas 02-02 (MiniMax) y 02-03 (Gemini)"
  - "import-map @obs/llm/ en deno.json (consumo Edge)"
affects: [adjudicacion-identidad-fase-4, extraccion-fichas-fase-7, embeddings-fase-7]

# Tech tracking
tech-stack:
  added: [openai@6, "@google/genai@2", zod@4 (en @obs/llm)]
  patterns: [llm-provider-enchufable, compuerta-zod-unica, repair-loop-reprompt, router-fail-closed, config-swappable, fetch-inyectable-mock, barrel-owned-by-slice, stub-para-paralelizar, tdd-red-green]

key-files:
  created:
    - packages/llm/package.json
    - packages/llm/tsconfig.json
    - packages/llm/vitest.config.ts
    - packages/llm/test/_helpers.ts
    - packages/llm/src/index.ts
    - packages/llm/src/types.ts
    - packages/llm/src/config.ts
    - packages/llm/src/validate.ts
    - packages/llm/src/validate.test.ts
    - packages/llm/src/router.ts
    - packages/llm/src/router.test.ts
    - packages/llm/src/json-schema.ts
    - packages/llm/src/data-routing.ts
    - packages/llm/src/providers/deepseek.ts
    - packages/llm/src/providers/deepseek.test.ts
    - packages/llm/src/providers/minimax.ts
    - packages/llm/src/providers/gemini-embeddings.ts
    - packages/llm/src/e2e.test.ts
  modified:
    - tsconfig.json
    - deno.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml

key-decisions:
  - "Compuerta zod UNICA y EXTERNA al adapter: el adapter NUNCA hace safeParse; solo parseAndValidate valida (cambiar de modelo es seguro)"
  - "LLMValidationError lleva solo los issues zod (code/path/message) — nunca prompt ni API key (T-02-03); copia defensiva de issues"
  - "Router fail-closed sin fallback: personal + trainsOnInputs -> SensitiveRoutingError, jamas sustituye provider (T-02-01)"
  - "Config swappable es la pieza de cambio (FND-06 crit 2): model/baseURL/trainsOnInputs en loadRouterConfigFromEnv; keys solo de env"
  - "index.ts (barrel) es 100% propiedad de 02-01; 02-02/03 rellenan stubs sin tocarlo (cero colision de archivo compartido entre waves paralelas)"
  - "makeMockFetch default content-type application/json: el SDK openai v6 solo parsea el body si el content-type lo declara"

requirements-completed: [FND-06, FND-07]

# Metrics
duration: 8min
completed: 2026-06-18
---

# Phase 2 Plan 01: Rebanada vertical LLM end-to-end (@obs/llm) Summary

**`@obs/llm`: capa de providers enchufable donde un caller pasa (prompt, schema zod, criticality, sensitivity) y recibe un objeto YA validado del provider correcto — o un `SensitiveRoutingError` fail-closed si la politica lo prohibe — sin tocar la red (mock-fetch). Incluye contratos (`LLMProvider`/`EmbeddingProvider`/`EmbeddingResult`), la compuerta zod UNICA con repair loop (`parseAndValidate` + `LLMValidationError` sin secretos), el router fail-closed (`selectProvider`), el primer adapter real (DeepSeek `json_object`), un test e2e que ejercita toda la pila, y stubs + barrel para que las rebanadas 02-02 (MiniMax) y 02-03 (Gemini) rellenen sin renegociar arquitectura.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-18T01:47:09Z
- **Tasks:** 3 (1 scaffold + 2 tdd)
- **Files created:** 18 (10 src de produccion/contratos + 4 src de test + scaffold + helpers); 4 modificados (tsconfig/deno.json/pnpm-workspace/lock)
- **Tests:** 13 verdes en 4 archivos, sin red ni keys reales

## Accomplishments
- **Contratos enchufables (FND-06, FND-07):** `types.ts` exporta `LLMProvider`, `EmbeddingProvider`, `EmbeddingResult`, `CompletionRequest`, `Criticality`, `Sensitivity`. `EmbeddingProvider/EmbeddingResult` quedan como contrato que implementa la rebanada 02-03 (cada vector versiona model/dims/version — no existe vector anonimo).
- **Compuerta zod UNICA + repair loop:** `parseAndValidate(schema, raw, ctx)` es el unico punto de validacion: `JSON.parse` tolerante (no parseable -> repair), `safeParse`, reprompt con los issues `path: message`, y `LLMValidationError` al agotar reintentos. El error lleva SOLO los issues zod (copia defensiva) — nunca prompt ni keys (test lo verifica, T-02-03).
- **Router fail-closed:** `selectProvider(task, registry, config)` selecciona por criticidad (`bulk -> deepseek`), lanza `RouterError` si falta el provider, y aplica el gate de cumplimiento: `personal && trainsOnInputs -> SensitiveRoutingError` sin fallback ni degradacion (T-02-01).
- **Adapter DeepSeek real:** `DeepSeekProvider` (openai SDK v6, fetch inyectable) usa `response_format: {type:"json_object"}`, system estable PRIMERO (prompt-cache), model `deepseek-v4-flash`, y delega en la compuerta externa — el adapter NO valida por su cuenta; el repair re-llama al provider con los issues.
- **e2e de la rebanada:** test que ejercita `router -> provider -> zod gate` end-to-end con mock-fetch, y el caso fail-closed que aborta ANTES de cualquier fetch (assert: 0 calls).
- **Habilitacion de waves paralelas:** stubs de `json-schema`/`data-routing`/`minimax`/`gemini-embeddings` (typechequean, lanzan `not implemented`) + barrel `index.ts` completo propiedad de este plan; 02-02 y 02-03 rellenan stubs sin tocar `index.ts`. `deno.json` declara `@obs/llm/` para Edge.

## Task Commits

1. **Task 1: Scaffold @obs/llm + contratos + config + stubs/barrel**
   - `feat(02-01)`: `b885b02`
2. **Task 2: Compuerta zod unica (parseAndValidate) + router fail-closed** (TDD)
   - `test(02-01)` RED `c4b9e37` -> `feat(02-01)` GREEN `9884287`
3. **Task 3: Adapter DeepSeek (json_object) + e2e de la rebanada** (TDD)
   - `test(02-01)` RED `e7d6199` -> `feat(02-01)` GREEN `37ac5fb`

## Files Created/Modified
- `packages/llm/package.json` / `tsconfig.json` / `vitest.config.ts` - Scaffold espejo de @obs/ingest (openai 6, @google/genai 2, zod 4; SIN @obs/core; lib DOM)
- `packages/llm/test/_helpers.ts` - `makeMockFetch` (body JSON, respuestas secuenciales para repair, default content-type application/json)
- `packages/llm/src/types.ts` - Contratos LLMProvider/EmbeddingProvider/EmbeddingResult/CompletionRequest/Criticality/Sensitivity (FND-06/07)
- `packages/llm/src/config.ts` - `loadRouterConfigFromEnv` (config swappable; keys solo de env)
- `packages/llm/src/validate.ts` - Compuerta zod unica + repair loop + LLMValidationError sin secretos
- `packages/llm/src/router.ts` - `selectProvider` fail-closed + RouterError + SensitiveRoutingError
- `packages/llm/src/providers/deepseek.ts` - DeepSeekProvider (json_object) via compuerta externa
- `packages/llm/src/json-schema.ts` / `data-routing.ts` / `providers/minimax.ts` / `providers/gemini-embeddings.ts` - STUBS de 02-02/03 (typechequean)
- `packages/llm/src/index.ts` - Barrel completo de la fase (propiedad de 02-01)
- `packages/llm/src/*.test.ts` + `e2e.test.ts` (4) - Tests por requisito, sin red
- `tsconfig.json` (raiz) - Referencia a packages/llm; `deno.json` - import-map `@obs/llm/`
- `pnpm-workspace.yaml` / `pnpm-lock.yaml` - openai@6 agregado a minimumReleaseAgeExclude por el install

## Decisions Made
- **Compuerta zod externa al adapter** - `parseAndValidate` es el unico validador; ni DeepSeek ni (futuro) MiniMax hacen su propio safeParse. Esto es lo que hace que "cambiar de modelo" sea seguro: la garantia transversal vive en un solo lugar.
- **LLMValidationError sin secretos** - construye un message GENERICO ("LLM output failed schema validation") y guarda una copia defensiva de los issues (code/path/message); jamas el prompt ni la key (espeja la regla de fetcher.ts; test lo asserta, T-02-03).
- **Router sin fallback en el gate sensible** - no hay branch catch/`||` que sustituya un provider que entrena por otro; `personal && trainsOnInputs` aborta con `SensitiveRoutingError` (fail-closed, T-02-01).
- **Barrel propiedad de la rebanada 0** - `index.ts` re-exporta todo (real + stubs) y solo 02-01 lo toca; 02-02/03 rellenan stubs => cero colision de archivo compartido entre las waves paralelas.
- **makeMockFetch default content-type application/json** - el SDK openai v6 solo parsea el body de la respuesta si el content-type lo declara; sin esto el adapter recibia `choices` undefined. (Resuelto en Task 3, ver Desviaciones.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, test infra] El SDK openai v6 no parseaba el body del mock (choices undefined)**
- **Found during:** Task 3 (GREEN del adapter DeepSeek)
- **Issue:** `makeMockFetch` devolvia la respuesta sin `content-type`; el SDK openai v6 solo deserializa el body a objeto cuando el header lo declara `application/json`, dejando `res.choices` undefined y rompiendo `complete()`.
- **Fix:** `makeMockFetch` setea `content-type: application/json` por defecto (overridable via `spec.headers`).
- **Files modified:** packages/llm/test/_helpers.ts
- **Verification:** Suite deepseek + e2e (5 tests) verde; suite completa 13/13.
- **Committed in:** GREEN de Task 3 (`37ac5fb`)

**2. [Rule 1 - Bug] Colision de identificador `headers` en el test helper**
- **Found during:** Task 3 (transform esbuild tras el fix #1)
- **Issue:** El fix #1 declaraba `const headers` que colisionaba con la `headers` ya capturada del request en `makeMockFetch` (esbuild: "symbol headers has already been declared").
- **Fix:** Renombrado a `responseHeaders`.
- **Files modified:** packages/llm/test/_helpers.ts
- **Verification:** Transform OK; 13/13 verde.
- **Committed in:** GREEN de Task 3 (`37ac5fb`)

---

**Total deviations:** 2 auto-fixed (ambas en la infra de test, necesarias para correr la suite contra el SDK real). Sin cambios arquitectonicos. Sin scope creep. El plan se ejecuto en el orden previsto (Task 1 scaffold + placeholders -> Task 2 validate/router -> Task 3 deepseek/e2e).

## Known Stubs

Stubs INTENCIONALES, por diseno del plan (habilitan las waves 2 paralelas sin colision de `index.ts`); cada uno typechequea y lanza `not implemented` en runtime, y sera rellenado por su rebanada:
- `packages/llm/src/json-schema.ts` (`zodToToolSchema`) - rellena **02-02** (MiniMax tool-calling)
- `packages/llm/src/data-routing.ts` (`assertNoRutInLlmInput`, `assertSensitivityAllowed`, `RutInLlmInputError`) - rellena **02-02**
- `packages/llm/src/providers/minimax.ts` (`MiniMaxProvider`) - rellena **02-02**
- `packages/llm/src/providers/gemini-embeddings.ts` (`GeminiEmbeddingProvider`, `l2normalize`; consts EMBEDDING_MODEL/DIMS/VERSION ya finales) - rellena **02-03**

No bloquean el objetivo de 02-01 (rebanada LLM end-to-end con DeepSeek): la pila router->DeepSeek->zod esta completa y verde. No hay datos hardcodeados que fluyan a UI (no hay UI en esta fase).

## Threat Flags

Sin superficie nueva fuera del `<threat_model>` del plan. Mitigaciones del registro STRIDE implementadas y verificadas por tests:
- **T-02-01** (fail-closed): `SensitiveRoutingError` ante `personal && trainsOnInputs`; e2e asserta 0 fetch.
- **T-02-02** (tampering salida LLM): compuerta zod unica; salida invalida -> repair o `LLMValidationError`, nunca pasa cruda. Schema con enums/rangos rechaza valores adversarios.
- **T-02-03** (disclosure en error/logs): `LLMValidationError` lleva solo issues zod; test asserta ausencia de prompt y key.
- **T-02-04** (keys): solo de env (`loadRouterConfigFromEnv` no hardcodea); adapters reciben la key por constructor, nunca la loguean.
- **T-02-SC** (npm installs): openai@6/@google/genai@2/zod@4 — SDKs oficiales de primera mano + zod ya en repo; instalados sin checkpoint humano (RESEARCH Package Legitimacy Audit, sin flags ASSUMED/SUS/SLOP).

## Issues Encountered
- Solo las 2 desviaciones de infra de test (SDK openai v6 requiere content-type para parsear). La suite (13 tests) corre en ~1s sin red. `deno check` de deepseek/validate/router sin error (consumo Edge confirmado).

## Next Phase Readiness
- **Rebanada 02-02 (MiniMax)** puede implementar `MiniMaxProvider` (tool-calling forzado), `zodToToolSchema` (via `z.toJSONSchema`) y `data-routing` (assertNoRutInLlmInput/assertSensitivityAllowed) rellenando sus stubs; `index.ts` ya los re-exporta.
- **Rebanada 02-03 (Gemini embeddings)** puede implementar `GeminiEmbeddingProvider` + `l2normalize` contra el contrato `EmbeddingProvider`/`EmbeddingResult` ya exportado (consts EMBEDDING_MODEL/DIMS/VERSION definidas).
- Ambas son Wave 2 paralelas y NO tocan `index.ts` (cero colision).

## Self-Check: PASSED

- Archivos declarados: package.json, tsconfig.json, vitest.config.ts, test/_helpers.ts, index.ts, types.ts, config.ts, validate.ts, router.ts, json-schema.ts, data-routing.ts, providers/deepseek.ts, providers/minimax.ts, providers/gemini-embeddings.ts, validate.test.ts, router.test.ts, deepseek.test.ts, e2e.test.ts, 02-01-SUMMARY.md — todos presentes.
- Commits: b885b02 (T1), c4b9e37/9884287 (T2 RED/GREEN), e7d6199/37ac5fb (T3 RED/GREEN) — verificados en el historial.
- Suite: 13 tests verdes (4 archivos); `pnpm -w typecheck` exit 0; `deno check` de los 3 modulos core sin error.
