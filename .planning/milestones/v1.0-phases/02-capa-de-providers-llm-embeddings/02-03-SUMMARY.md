---
phase: 02-capa-de-providers-llm-embeddings
plan: 03
subsystem: capa-de-providers-embeddings
tags: [typescript, deno, vitest, tdd, gemini, embeddings, l2-normalize, mrl-768, versionado, mock-fetch, fetch-inyectable]

# Dependency graph
requires:
  - "Contrato EmbeddingProvider/EmbeddingResult (02-01, types.ts)"
  - "Stub providers/gemini-embeddings.ts + re-export en barrel index.ts (02-01)"
  - "makeMockFetch (02-01, test/_helpers.ts)"
provides:
  - "GeminiEmbeddingProvider: embeddings gemini-embedding-001 de 768-dim (MRL), L2-normalizados manualmente, versionados {vector,model,dims,version}"
  - "l2normalize(v): normalizacion L2 con guard de norma 0 (Web APIs puras)"
  - "Constantes finales EMBEDDING_MODEL/EMBEDDING_DIMS/EMBEDDING_VERSION (bump => re-embed; nunca mezclar versiones)"
affects: [embeddings-fase-7, busqueda-semantica-fase-7, pgvector-cosine-fase-7]

# Tech tracking
tech-stack:
  added: []
  patterns: [embedding-provider-enchufable, l2-normalize-manual-mrl, vector-versionado-sin-anonimo, fetch-inyectable-mock, rest-directo-sin-sdk-fetch-injection, tdd-red-green]

key-files:
  created:
    - packages/llm/src/providers/gemini-embeddings.test.ts
  modified:
    - packages/llm/src/providers/gemini-embeddings.ts

key-decisions:
  - "REST directo (batchEmbedContents) con fetchFn inyectable en vez del SDK GoogleGenAI: @google/genai 2.8.0 NO expone punto de inyeccion de fetch en su API publica (solo el cliente next-gen interno) -> el plan preve esta contingencia (Assumption A4); REST documentado mantiene tests sin red/key y consumo Deno limpio"
  - "L2-normalizacion la hace el PROVIDER, no el mock: el mock devuelve un vector deliberadamente NO normalizado y el test asserta norma ~=1.0 -> prueba que la normalizacion es responsabilidad del provider (Gemini no normaliza a dims != 3072)"
  - "Ningun vector anonimo (FND-07): embed() siempre devuelve {vector,model,dims,version}; sin esos 4 campos no se emite"
  - "API key solo por header x-goog-api-key (nunca URL/body/logs); errores HTTP sin la key (patron fetcher.ts)"

requirements-completed: [FND-07]

# Metrics
duration: 5min
completed: 2026-06-17
---

# Phase 2 Plan 03: GeminiEmbeddingProvider (embeddings 768-dim versionados) Summary

**`GeminiEmbeddingProvider` rellena el stub de 02-01 implementando `EmbeddingProvider`: dado texto PUBLICO, devuelve un `EmbeddingResult` por texto con `{vector(768), model, dims, version}` — ningun vector anonimo (FND-07) — L2-normalizado manualmente por el provider (Gemini no normaliza a dims != 3072, condicion necesaria para cosine de pgvector en Fase 7). Modela la llamada REST `batchEmbedContents` con `outputDimensionality:768` via `fetchFn` inyectable (el SDK `@google/genai` 2.8.0 no expone inyeccion de fetch), corre sin red ni API key, y declara `trainsOnInputs=true` (free tier entrena -> solo texto publico, gobernado por el gate data-routing de 02-02). `index.ts` NO se toca.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 1 (TDD)
- **Files created:** 1 test; 1 modificado (stub -> implementacion real)
- **Tests:** 10 verdes (3 l2normalize + 7 provider), sin red ni key

## Accomplishments
- **GeminiEmbeddingProvider (FND-07):** `embed(texts)` -> `EmbeddingResult[]`; cada item carga `{vector, model:"gemini-embedding-001", dims:768, version:"v1"}`. Sin esos 4 campos no se emite ningun vector (test lo verifica por item, tambien en batch N->N).
- **L2-normalizacion manual (cosine-ready):** `l2normalize` con guard de norma 0; el provider normaliza la respuesta cruda de Gemini (que a 768 dims NO viene normalizada). El test entrega un vector deliberadamente no-normalizado y asserta `norma ~= 1.0` (tolerancia 1e-6) -> prueba que la normalizacion vive en el provider, no en el mock.
- **Request correcto:** POST a `…/v1beta/models/gemini-embedding-001:batchEmbedContents` con `requests[].content.parts[].text` y `outputDimensionality:768` por item; el test inspecciona el body capturado.
- **Sin red ni key, key fuera de logs:** `fetchFn` inyectable + `makeMockFetch`; la key viaja por header `x-goog-api-key` (test asserta que NO aparece en URL ni body); error HTTP no incluye la key en el mensaje.
- **Constantes de versionado finales:** `EMBEDDING_MODEL`/`EMBEDDING_DIMS`/`EMBEDDING_VERSION` ya definidas desde 02-01; cambiar el modelo obliga bump de version => re-embed, nunca mezclar versiones en un indice.

## Task Commits

1. **Task 1: GeminiEmbeddingProvider — 768-dim, L2-normalizado, versionado** (TDD)
   - `test(02-03)` RED `8eaa131` -> `feat(02-03)` GREEN `fe20c62`

## Files Created/Modified
- `packages/llm/src/providers/gemini-embeddings.ts` — Implementacion real: `l2normalize` (guard norma 0), `GeminiEmbeddingProvider` (REST batchEmbedContents, fetch inyectable, key por header, versionado por item). Web APIs puras (Math.sqrt/map/JSON/fetch); sin `node:`/`Buffer` (consumo Deno/Edge).
- `packages/llm/src/providers/gemini-embeddings.test.ts` — 10 tests: l2normalize ([3,4]->[0.6,0.8], guard [0,0]->[0,0], norma ~=1.0); provider (flags id/trainsOnInputs, versionado por texto, L2 por el provider, batch N->N, outputDimensionality:768 + textos en el body, key por header nunca en URL/body, error sin key).
- `packages/llm/src/index.ts` — NO tocado (barrel propiedad de 02-01; ya re-exporta este modulo).

## Decisions Made
- **REST directo en vez del SDK GoogleGenAI** — el SDK `@google/genai` 2.8.0 (`GoogleGenAI`/`GoogleGenAIOptions`/`HttpOptions`) NO expone un `fetch` inyectable en su API publica (solo el `BaseGeminiNextGenAPIClient` interno acepta `opts.fetch`). El plan anticipa exactamente este caso (Assumption A4: "si hay incertidumbre, modela la llamada HTTP con mock fetch matching la forma REST documentada"). Se modelo la forma REST verificada contra el bundle del SDK (`{model}:batchEmbedContents`, body `{requests:[{content.parts[].text, model:"models/…", outputDimensionality}]}`, respuesta `{embeddings:[{values}]}`, base `generativelanguage.googleapis.com/v1beta`, auth `x-goog-api-key`). Resultado: tests sin red/key y consumo Deno sin arrastrar el SDK Node.
- **Normalizacion responsabilidad del provider** — Gemini a dims != 3072 NO normaliza; el provider aplica `l2normalize` a cada `values`. El test usa un vector no-normalizado del mock para garantizar que la garantia es del provider.
- **Versionado duro (FND-07)** — `embed()` mapea cada `values` a un objeto con los 4 campos; no hay path que emita un vector "pelado". Bump de `EMBEDDING_VERSION` => re-embed; nunca mezclar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, SDK signature] El SDK @google/genai 2.8.0 no expone inyeccion de fetch -> se modelo la llamada REST directa**
- **Found during:** Task 1 (confirmacion de Assumption A4 al implementar)
- **Issue:** El plan asumia inyectar `fetchFn` via la opcion del constructor de `GoogleGenAI`/`httpOptions`. La inspeccion de los type defs y el bundle 2.8.0 confirmo que `GoogleGenAIOptions` y `HttpOptions` NO exponen `fetch`; solo el cliente interno `BaseGeminiNextGenAPIClient` lo acepta (no es API publica). Usar el SDK haria imposible los tests sin red/key.
- **Fix:** Modelar la llamada REST documentada (`batchEmbedContents`) directamente con el `fetchFn` inyectable, exactamente la contingencia que el plan prescribe (Assumption A4). Forma REST verificada contra el codigo del SDK (no asumida): endpoint, body `requests[]`, respuesta `embeddings[].values`, header `x-goog-api-key`.
- **Files modified:** packages/llm/src/providers/gemini-embeddings.ts (sin cambiar el contrato `embed()`)
- **Verification:** 10 tests verdes sin red ni key; `tsc -b` exit 0; `deno check` exit 0.
- **Committed in:** GREEN de Task 1 (`fe20c62`)

---

**Total deviations:** 1 auto-fixed (Rule 3, contingencia ya prevista por el plan en Assumption A4). Sin cambios arquitectonicos. Sin scope creep. El contrato `embed()` quedo intacto.

## Threat Flags

Sin superficie nueva fuera del `<threat_model>` del plan. Mitigaciones del registro STRIDE implementadas y verificadas por tests:
- **T-02-09** (free tier entrena con inputs): `trainsOnInputs=true` declarado -> el gate data-routing/router fail-closed de 02-02 impide que PII llegue; documentado en el modulo (solo texto publico).
- **T-02-10** (vector sin normalizar / anonimo): L2-normalizacion manual a 768 obligatoria (test de norma ~=1.0 con vector no-normalizado del mock); todo vector carga model/dims/version (test por item y en batch) -> sin vector anonimo (FND-07).
- **T-02-11** (key en logs): key solo por header `x-goog-api-key`; nunca en URL/body (test) ni en el mensaje de error HTTP (patron fetcher.ts); tests sin key.
- **T-02-SC** (npm install @google/genai): SDK ya instalado y auditado en 02-01 (RESEARCH Package Legitimacy Audit; SDK oficial de Google). No se instalo nada nuevo en este plan.

## Issues Encountered
- Solo la desviacion Rule 3 (firma del SDK distinta a la asumida; contingencia prevista). La suite gemini (10 tests) corre en ~30ms sin red. Suite completa @obs/llm: 37 verdes + 3 skipped (smoke live), sin regresiones.

## Next Phase Readiness
- **Fase 7 (embeddings + pgvector):** puede consumir `GeminiEmbeddingProvider` contra el contrato `EmbeddingProvider`; cada vector ya viene 768-dim L2-normalizado y versionado -> indexable con `vector(768)` + HNSW + `vector_cosine_ops`. El esquema de versionado (model/dims/version por fila) habilita re-embedding incremental sin corromper el indice.
- **Fase 2 completa:** las 3 rebanadas (LLM end-to-end DeepSeek, MiniMax tool-calling + data-routing, Gemini embeddings) entregan la capa de providers enchufable. Stubs de 02-01 todos rellenados.

## Self-Check: PASSED

- Archivos declarados: `packages/llm/src/providers/gemini-embeddings.ts` (modificado), `packages/llm/src/providers/gemini-embeddings.test.ts` (creado) — ambos presentes.
- Commits: `8eaa131` (RED test), `fe20c62` (GREEN feat) — verificados en el historial.
- TDD gate: existe `test(02-03)` seguido de `feat(02-03)` (RED -> GREEN). Sin refactor (implementacion limpia).
- Verificacion: gemini 10/10 verde; suite @obs/llm 37 verdes + 3 skipped; `pnpm -w typecheck` exit 0; `deno check` de gemini-embeddings.ts exit 0.
