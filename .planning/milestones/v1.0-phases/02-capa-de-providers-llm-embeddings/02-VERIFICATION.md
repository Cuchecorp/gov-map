---
phase: 02-capa-de-providers-llm-embeddings
verified: 2026-06-17T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 2: Capa de Providers LLM/Embeddings — Verification Report

**Phase Goal:** Todo computo LLM y de embeddings pasa por interfaces enchufables que aislan el modelo concreto, garantizan salida estructurada validada per-proveedor y versionan cada vector — el dominio nunca conoce que modelo corre.

**Verified:** 2026-06-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Todo acceso LLM pasa por `LLMProvider` con router por criticidad/sensibilidad; MiniMax usa tool calling y DeepSeek usa json_object, ambos validados con zod | VERIFIED | `router.ts` `selectProvider` despacha por `config.byCriticality[task.criticality]`; `deepseek.ts` usa `response_format:{type:"json_object"}`; `minimax.ts` usa `tools+tool_choice` forzado a `emit_result`; ambos delegan a `parseAndValidate` (compuerta zod unica) |
| 2 | Cambiar de modelo es un adaptador nuevo con cero cambios aguas arriba, seleccionable por configuracion | VERIFIED | `loadRouterConfigFromEnv` lee `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`, `MINIMAX_MODEL`, `MINIMAX_BASE_URL`, `LLM_CRITICAL_PROVIDER`, `LLM_BULK_PROVIDER` del entorno (WR-05 resuelto). MiniMax se agrego en 02-02 sin tocar `router.ts`, `validate.ts` ni `index.ts` — solo se relleno el stub del provider |
| 3 | Todo embedding pasa por `EmbeddingProvider` que fija y persiste embedding_model/dims/version junto al vector — no existe vector anonimo | VERIFIED | `GeminiEmbeddingProvider.embed()` siempre retorna `{vector, model:"gemini-embedding-001", dims:768, version:"v1"}`; validacion de dims pre-emision (WR-03 resuelto); L2-normalizado manual; `EmbeddingResult` no tiene campos opcionales — sin los 4 campos no se emite |
| 4 | La politica "que dato va a que proveedor/tier" queda documentada: ningun dato personal (RUT/nombres) puede dirigirse a un tier que entrena con inputs | VERIFIED | `data-routing.ts` documenta la politica en cabecera y la hace ejecutable: `assertNoRutInLlmInput` (RUT regex amplio — cuerpos 1-8 digitos, puntos opcionales, espacios alrededor del guion) corre al inicio de `DeepSeekProvider.complete` y `MiniMaxProvider.complete` antes de cualquier llamada de red; `assertSensitivityAllowed` aborta con `SensitiveRoutingError` si `sensitivity==="personal" && provider.trainsOnInputs`; `GeminiEmbeddingProvider` declara `trainsOnInputs=true`; gates son estructurales (no opt-in) tras CR-01/CR-02/CR-03 |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/llm/src/types.ts` | Contratos `LLMProvider`, `EmbeddingProvider`, `EmbeddingResult`, `CompletionRequest`, `Criticality`, `Sensitivity` | VERIFIED | Exportado y re-exportado desde barrel `index.ts` |
| `packages/llm/src/router.ts` | `selectProvider` fail-closed + `RouterError` + `SensitiveRoutingError` | VERIFIED | Implementacion real; gate `personal && trainsOnInputs` aborta sin fallback ni degradacion |
| `packages/llm/src/validate.ts` | `parseAndValidate` compuerta zod unica + repair loop + `LLMValidationError` sin secretos | VERIFIED | Compuerta unica; error solo lleva issues zod (code/path/message), nunca prompt ni key; `clampRepairAttempts` acota coste de round-trips (WR-01 resuelto) |
| `packages/llm/src/data-routing.ts` | `assertNoRutInLlmInput` + `assertSensitivityAllowed` + documentacion de politica | VERIFIED | Implementacion real con RUT regex amplio (CR-03 resuelto); politica documentada en cabecera del archivo |
| `packages/llm/src/providers/deepseek.ts` | Adapter DeepSeek con `json_object`, gates CR-01/CR-02 cableados | VERIFIED | `assertNoRutInLlmInput(req.user)` + `if (req.system) assertNoRutInLlmInput(req.system)` + `assertSensitivityAllowed(..., this)` corren antes de cualquier fetch; `response_format:{type:"json_object"}`; delega a `parseAndValidate` |
| `packages/llm/src/providers/minimax.ts` | Adapter MiniMax con tool-calling forzado, gates CR-01/CR-02 cableados | VERIFIED | Mismos gates al inicio de `complete()`; `tools:[{function:{name:"emit_result",parameters:zodToToolSchema(schema)}}]` + `tool_choice:{type:"function",function:{name:"emit_result"}}`; extrae arguments por nombre (WR-02 resuelto); delega a `parseAndValidate` |
| `packages/llm/src/providers/gemini-embeddings.ts` | `GeminiEmbeddingProvider` con versionado fijo, L2-normalizado, dim-check | VERIFIED | `trainsOnInputs=true`; `l2normalize` manual; dim-check pre-emision (WR-03); `EmbeddingResult` con los 4 campos siempre presentes |
| `packages/llm/src/config.ts` | `loadRouterConfigFromEnv` swappable via env | VERIFIED | Lee `DEEPSEEK_MODEL/BASE_URL`, `MINIMAX_MODEL/BASE_URL`, `LLM_CRITICAL_PROVIDER/LLM_BULK_PROVIDER`; `trainsOnInputs` NO es configurable via env (decision deliberada de compliance) |
| `packages/llm/src/index.ts` | Barrel completo que re-exporta toda la capa | VERIFIED | Re-exporta types, config, validate, router, json-schema, data-routing y los tres adapters |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DeepSeekProvider.complete` | `assertNoRutInLlmInput` | Llamada directa al inicio del metodo | WIRED | Linea 65-66 de `deepseek.ts` — antes de cualquier `this.client.*` |
| `DeepSeekProvider.complete` | `assertSensitivityAllowed` | Llamada directa al inicio del metodo | WIRED | Linea 68 de `deepseek.ts` — `assertSensitivityAllowed({sensitivity:req.sensitivity}, this)` |
| `MiniMaxProvider.complete` | `assertNoRutInLlmInput` | Llamada directa al inicio del metodo | WIRED | Linea 69-70 de `minimax.ts` — antes de cualquier `this.client.*` |
| `MiniMaxProvider.complete` | `assertSensitivityAllowed` | Llamada directa al inicio del metodo | WIRED | Linea 72 de `minimax.ts` |
| `MiniMaxProvider.complete` | `zodToToolSchema` | Derivacion de parameters de la tool function | WIRED | `const parameters = zodToToolSchema(schema)` — una sola fuente de verdad |
| Ambos providers | `parseAndValidate` | Compuerta zod unica externa | WIRED | Cada adapter delega la validacion/repair a `parseAndValidate`; el adapter NUNCA hace `safeParse` propio |
| `selectProvider` | `SensitiveRoutingError` | Gate de compliance en router | WIRED | `personal && provider.trainsOnInputs` -> `throw new SensitiveRoutingError(...)` sin fallback |
| `GeminiEmbeddingProvider.embed` | Versionado `{model,dims,version}` | Retorno explicito en `embed()` | WIRED | Cada `EmbeddingResult` lleva los 4 campos; dim-check previo aborta si Gemini no respeta `outputDimensionality` |

---

### Data-Flow Trace (Level 4)

No aplica para esta fase — backend-only sin UI. Los providers retornan objetos validados; no hay componentes que rendericen datos dinamicos. Los tests con mock-fetch cubren el flujo completo router -> provider -> zod gate -> resultado tipado o error.

---

### Behavioral Spot-Checks

Los tests corren sin red ni keys reales (mock-fetch inyectable). No hay servidor que levantar. Los siguientes comportamientos estan cubiertos por la suite de 68 tests:

| Behavior | Test Coverage | Status |
|----------|---------------|--------|
| RUT en `req.user` aborta antes del fetch | `deepseek.test.ts`, `minimax.test.ts` — assert `RutInLlmInputError` + 0 fetches | PASS |
| `sensitivity=personal` a provider con `trainsOnInputs=true` aborta | `data-routing.test.ts`, provider-level tests | PASS |
| MiniMax extrae arguments por nombre (no posicion) — function hallucination va a repair | `minimax.test.ts` — WR-02 fix covered | PASS |
| Gemini rechaza vector con dims incorrectas | `gemini-embeddings.test.ts` — WR-03: over-sized (3072) y truncado (512) | PASS |
| `loadRouterConfigFromEnv` respeta overrides de env | `config.test.ts` — defaults + overrides + flag no-configurable | PASS |
| Repair loop acotado por `clampRepairAttempts` | `validate.test.ts` — negative/NaN/over-ceiling/fractional | PASS |

---

### Probe Execution

Step 7c: No hay probes declarados en PLAN/SUMMARY ni scripts convencionales `probe-*.sh` para esta fase. Los tests de vitest son el mecanismo de verificacion automatizada.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FND-06 | 02-01, 02-02 | Capa LLM enchufable con router por criticidad/sensibilidad; adapters por proveedor; salida estructurada validada con zod | SATISFIED | `LLMProvider` interface + `selectProvider` router + `DeepSeekProvider` (json_object) + `MiniMaxProvider` (tool-calling forzado) + `parseAndValidate` compuerta unica |
| FND-07 | 02-01, 02-03 | Capa de embeddings enchufable; cada vector versiona model/dims/version — no existe vector anonimo | SATISFIED | `EmbeddingProvider` interface + `GeminiEmbeddingProvider` con `{vector,model,dims,version}` siempre presentes + dim-check pre-emision |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `02-VALIDATION.md` | `TBD` en columna Task ID (Task IDs los fija el planner) | Info | Artefacto de planificacion, no codigo de produccion; no afecta comportamiento |

Sin TBD/FIXME/XXX en codigo de produccion. Los dos items `INFO` del code review (IN-01: `additionalProperties:false` en zodToToolSchema; IN-03: version desacoplada de model identity) fueron marcados como deferred y no son debt markers sin referencia — son hardening no urgente documentado en 02-REVIEW.md.

---

### Human Verification Required

#### 1. Smoke test live por proveedor (MiniMax-M3, DeepSeek V4, Gemini Embeddings)

**Test:** Correr `pnpm --filter @obs/llm test --run` con `LLM_SMOKE=1` y las tres keys reales configuradas (`MINIMAX_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`).

**Expected:** Los tres sub-tests del smoke pasan: MiniMax retorna un objeto con tool_call cuya function.arguments parsea el schema; DeepSeek retorna JSON valido segun schema; Gemini retorna un batch de embeddings de 768 dims L2-normalizados.

**Why human:** Requiere API keys reales y conexion de red; gasta cuota; los tests automatizados cubren el comportamiento con mock-fetch pero no verifican que las APIs reales respondan con el shape esperado. Segun 02-VALIDATION.md este es el unico caso manual previsto para esta fase.

#### 2. Confirmar tier sin entrenamiento para MiniMax y DeepSeek

**Test:** Verificar en los paneles/terminos de cuenta de MiniMax.io y DeepSeek que el plan/tier contratado no entrena con los inputs de la API.

**Expected:** Ambos proveedores confirman que la cuenta esta en un tier que no usa inputs para entrenamiento (`trainsOnInputs=false` en config es correcto).

**Why human:** Requiere revision de terminos legales/contractuales del proveedor; no es verificable en codigo.

---

### Gaps Summary

No hay gaps que bloqueen el objetivo de la fase. Los tres blockers criticos del code review (CR-01: RUT gate no cableado, CR-02: sensitivity gate no cableado, CR-03: regex RUT con falsos negativos) fueron resueltos y sus fixes estan presentes en el codigo fuente verificado. Los cinco warnings (WR-01 a WR-05) tambien estan resueltos. Los dos items INFO (IN-01, IN-03) fueron diferidos conscientemente como hardening no urgente.

El unico item pendiente son los smoke tests live, que son verificacion humana opcional documentada en el plan desde el inicio — no un gap de implementacion.

---

_Verified: 2026-06-17_
_Verifier: Claude (gsd-verifier)_
