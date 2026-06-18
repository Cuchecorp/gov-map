# Phase 2: Capa de Providers LLM/Embeddings - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega las interfaces enchufables que aíslan todo cómputo LLM y de embeddings tras un contrato estable, de modo que el dominio nunca conoce qué modelo concreto corre. Cubre FND-06 (`LLMProvider` con salida estructurada validada per-proveedor) y FND-07 (`EmbeddingProvider` que versiona cada vector). Vive en `/packages/core` (interfaces + zod) y un nuevo módulo de adapters (p.ej. `/packages/llm` o `/packages/core/src/providers`). NO incluye consumidores reales (extracción de fichas = Fase 7; adjudicación de identidad = Fase 4); esta fase entrega la capa + adapters + un smoke test por proveedor. NO genera embeddings de corpus real todavía.
</domain>

<decisions>
## Implementation Decisions

### Interfaces de providers, salida estructurada y política de datos
- **`LLMProvider`**: interfaz única (p.ej. `complete(req): Promise<T>` con `schema` zod), implementada por adapters concretos (MiniMaxProvider, DeepSeekProvider). Un **router** selecciona el provider por **(criticidad, sensibilidad)** de la tarea, no por volumen: adjudicación de identidad (crítico) → MiniMax; extracción de fichas (alto volumen) → DeepSeek V4 Flash. El modelo concreto es configuración (env/config), swappable sin tocar el dominio.
- **Salida estructurada per-proveedor** (sella el hallazgo "MiniMax sin `response_format` universal"):
  - MiniMax → **tool calling forzado** (función con JSON schema) para obtener salida estructurada.
  - DeepSeek V4 → **`json_object`** (+ prompt prefix estable para prompt-cache).
  - En **ambos** casos: parsear y **validar con zod** contra el schema esperado; retry/reparación ante salida inválida. La validación zod es la compuerta única, independiente del modo del proveedor.
- **`EmbeddingProvider`**: Gemini `gemini-embedding-001`, salida **truncada a 768-dim** (Matryoshka/MRL). Cada vector persiste `embedding_model`, `embedding_dims`, `embedding_version` en sus metadatos — **no existe vector anónimo**. Cambiar el modelo de embeddings obliga re-embeder; nunca mezclar vectores de modelos distintos en el mismo índice.
- **Política dato→proveedor (documentada en código, p.ej. un módulo `data-routing.ts` + doc):**
  - El **RUT** se matchea de forma determinista y **nunca** se envía a ningún LLM.
  - Dato personal (nombres en contexto de identidad, etc.) solo puede dirigirse a un **tier que NO entrena con inputs** (MiniMax/DeepSeek vías pagas / DPA). **Nunca** dato personal por el **free tier de Gemini** (entrena con inputs) — Gemini se usa solo para embeddings de texto público.
  - El router debe rechazar/abortar si una tarea marcada como sensible se enruta a un provider/tier no permitido (fail-closed).
- **Capa enchufable real**: agregar un modelo nuevo = un adapter nuevo + entrada de config; **cero cambios aguas arriba**.

### Claude's Discretion
- Nombres exactos de paquete/módulo, firma fina de las interfaces, mecánica del retry/reparación de JSON, y forma del objeto de config de routing quedan a discreción del planner, respetando lo anterior.
- SDK concreto: usar OpenAI-compatible SDK (`openai` v5) con `baseURL` por proveedor (verificado en research); confirmar `baseURL`/nombre de modelo de MiniMax y DeepSeek al implementar.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/packages/core` ya existe (Fase 1): tipos `Provenance`, control plane, y patrón de paquete TS compartido a Deno vía import map. Las interfaces de providers se exportan desde aquí o desde un paquete hermano consumible igual.
- `.env` ya tiene `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `DEEPSEEK_API_KEY`.
- Patrón de validación zod ya presente en el repo (Fase 1).

### Established Patterns
- STACK.md: `openai` SDK v5 con `baseURL` por proveedor; DeepSeek `json_object` + prompt caching; MiniMax SIN `response_format` (de ahí tool calling). Gemini embeddings 768-dim, HNSW (el índice se crea en Fase 7).

### Integration Points
- Fase 4 (adjudicación de identidad) consumirá `LLMProvider` (MiniMax tool calling).
- Fase 7 (extracción de fichas + embeddings) consumirá `LLMProvider` (DeepSeek) y `EmbeddingProvider` (Gemini) + el esquema de versionado de vectores.
</code_context>

<specifics>
## Specific Ideas

- La validación zod es la garantía transversal: sin importar si el proveedor devuelve via tool-call o json_object, el resultado solo se acepta si pasa el schema. Esto es lo que hace que "cambiar de modelo" sea seguro.
- El versionado de embeddings (`embedding_model/dims/version` por vector) es un requisito duro: habilita re-embedding incremental sin corromper el índice.
</specifics>

<deferred>
## Deferred Ideas

- Consumidores reales: extracción de idea matriz/cuerpos legales (Fase 7), adjudicación de identidad por LLM (Fase 4).
- Creación del índice HNSW / pgvector y embeddings del corpus real (Fase 7).
- Benchmark del golden set para elegir el modelo final de adjudicación (Fase 4).
</deferred>
