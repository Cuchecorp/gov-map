# Phase 2: Capa de Providers LLM/Embeddings - Research

**Researched:** 2026-06-17
**Domain:** Abstracción enchufable de cómputo LLM + embeddings (provider abstraction, structured-output adapters, zod validation gate, criticality/sensitivity router, embedding versioning)
**Confidence:** HIGH (patrones de paquete y SDK verificados contra el repo + docs oficiales); MEDIUM en detalles finos de endpoints emergentes (MiniMax M3 forced tool_choice, DeepSeek V4 model ids)

## Summary

Esta fase entrega **solo la capa**: dos interfaces (`LLMProvider`, `EmbeddingProvider`), adapters concretos (MiniMax via tool-calling forzado, DeepSeek V4 via `json_object`, Gemini embeddings), una compuerta de validación zod universal, un router (criticidad, sensibilidad)→provider con comportamiento *fail-closed*, y el esquema de versionado de vectores. **Cero consumidores reales** (adjudicación = Fase 4, extracción/embeddings de corpus = Fase 7). El smoke test por proveedor es opcional y gated por env — los tests de la fase corren sin red.

El repo ya estableció en Fase 1 el patrón exacto que esta fase debe reusar: paquetes en `/packages/*` con `package.json` `@obs/<name>`, `workspace:*` para depender de `@obs/core`, project-references de tsc, vitest con `passWithNoTests`, y — críticamente — **inyección de dependencias de red vía un parámetro `fetchFn?: typeof fetch`** con un helper `makeMockFetch` (ver `packages/ingest/src/fetcher.ts` + `packages/ingest/test/_helpers.ts`). El openai SDK es fetch-based y acepta un `fetch` custom en su constructor, así que el mismo patrón de mock-fetch sin red aplica directo. El código debe correr en **Node (vitest) y Deno (Edge Functions)** — lo que se logra con imports sin extensiones nativas, evitando APIs Node-only, y exponiendo el paquete por el import-map de `deno.json` igual que `@obs/core/`.

**Primary recommendation:** Crear un paquete nuevo `@obs/llm` en `/packages/llm` (no meter adapters en `@obs/core`, que es tipos puros sin deps de red). Definir `LLMProvider.complete<T>(req, schema): Promise<T>` donde el adapter produce JSON crudo (MiniMax→tool_calls.arguments, DeepSeek→message.content) y un **único `parseAndValidate(schema, raw)` con retry/repair** es la compuerta. `EmbeddingProvider.embed(texts): Promise<EmbeddingResult[]>` con `{vector, model, dims, version}` por texto, normalizando L2 manualmente a 768 (Gemini NO normaliza a dims ≠ 3072). Router como módulo de datos puro + tipos, fail-closed por defecto.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Interfaces `LLMProvider`/`EmbeddingProvider` | API/Backend (paquete `/packages/llm`) | — | Contrato consumido por Edge Functions (Deno) y jobs Node; nunca toca el navegador |
| Adapters concretos (MiniMax/DeepSeek/Gemini) | API/Backend | — | Encapsulan SDK + API keys; server-only por definición (keys en `.env`) |
| Compuerta zod + retry/repair | API/Backend | — | Lógica pura de validación; testeable sin red |
| Router (criticidad, sensibilidad)→provider | API/Backend (módulo de config/datos) | — | Decisión de política pura; fail-closed; sin I/O |
| Política dato→provider (`data-routing`) | API/Backend (módulo de datos + doc) | — | Regla de cumplimiento (RUT nunca al LLM; PII nunca a tier que entrena) |
| Versionado de embeddings (`embedding_model/dims/version`) | API/Backend (forma del resultado) + DB/Storage (persistencia en Fase 7) | — | La forma se fija aquí; las columnas pgvector se crean en Fase 7 |

**Nota:** Ninguna capacidad de esta fase pertenece al navegador ni al frontend SSR. Todo es backend puro. Las API keys (`GEMINI_API_KEY`, `MINIMAX_API_KEY`, `DEEPSEEK_API_KEY`) viven en `.env` y solo se leen server-side.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-06 | Todo acceso LLM pasa por una interfaz enchufable `LLMProvider` con salida estructurada validada por-proveedor (zod), seleccionable por configuración | Interface design (sección 4 del deep-dive); adapters MiniMax tool-calling forzado + DeepSeek `json_object`; compuerta zod única con retry/repair; router por (criticidad, sensibilidad) seleccionable por config/env |
| FND-07 | Todo embedding pasa por una interfaz `EmbeddingProvider` que fija y versiona modelo/dimensiones en los metadatos del vector | `EmbeddingProvider.embed()` devuelve `{vector, model, dims, version}` por texto; Gemini `gemini-embedding-001` a 768-dim (MRL) con normalización L2 manual; constante de versión por modelo; ningún vector anónimo |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **`LLMProvider`**: interfaz única (p.ej. `complete(req): Promise<T>` con `schema` zod), implementada por adapters concretos (MiniMaxProvider, DeepSeekProvider). Un **router** selecciona el provider por **(criticidad, sensibilidad)** de la tarea, no por volumen: adjudicación de identidad (crítico) → MiniMax; extracción de fichas (alto volumen) → DeepSeek V4 Flash. El modelo concreto es configuración (env/config), swappable sin tocar el dominio.
- **Salida estructurada per-proveedor** (sella el hallazgo "MiniMax sin `response_format` universal"):
  - MiniMax → **tool calling forzado** (función con JSON schema) para obtener salida estructurada.
  - DeepSeek V4 → **`json_object`** (+ prompt prefix estable para prompt-cache).
  - En **ambos** casos: parsear y **validar con zod** contra el schema esperado; retry/reparación ante salida inválida. La validación zod es la compuerta única, independiente del modo del proveedor.
- **`EmbeddingProvider`**: Gemini `gemini-embedding-001`, salida **truncada a 768-dim** (Matryoshka/MRL). Cada vector persiste `embedding_model`, `embedding_dims`, `embedding_version` en sus metadatos — **no existe vector anónimo**. Cambiar el modelo de embeddings obliga re-embeder; nunca mezclar vectores de modelos distintos en el mismo índice.
- **Política dato→proveedor** (documentada en código, p.ej. un módulo `data-routing.ts` + doc):
  - El **RUT** se matchea de forma determinista y **nunca** se envía a ningún LLM.
  - Dato personal (nombres en contexto de identidad, etc.) solo puede dirigirse a un **tier que NO entrena con inputs** (MiniMax/DeepSeek vías pagas / DPA). **Nunca** dato personal por el **free tier de Gemini** (entrena con inputs) — Gemini se usa solo para embeddings de texto público.
  - El router debe rechazar/abortar si una tarea marcada como sensible se enruta a un provider/tier no permitido (fail-closed).
- **Capa enchufable real**: agregar un modelo nuevo = un adapter nuevo + entrada de config; **cero cambios aguas arriba**.

### Claude's Discretion
- Nombres exactos de paquete/módulo, firma fina de las interfaces, mecánica del retry/reparación de JSON, y forma del objeto de config de routing quedan a discreción del planner, respetando lo anterior.
- SDK concreto: usar OpenAI-compatible SDK (`openai` v5) con `baseURL` por proveedor (verificado en research); confirmar `baseURL`/nombre de modelo de MiniMax y DeepSeek al implementar.

### Deferred Ideas (OUT OF SCOPE)
- Consumidores reales: extracción de idea matriz/cuerpos legales (Fase 7), adjudicación de identidad por LLM (Fase 4).
- Creación del índice HNSW / pgvector y embeddings del corpus real (Fase 7).
- Benchmark del golden set para elegir el modelo final de adjudicación (Fase 4).
</user_constraints>

## Project Constraints (from CLAUDE.md)

CLAUDE.md inyecta PROJECT.md + STACK.md (sin reglas adicionales en `rules/`). Directivas accionables que el planner DEBE respetar:

- **TS/Deno full**: un solo lenguaje. El paquete debe consumirse desde Edge Functions (Deno) **y** desde Node/vitest. Imports sin extensiones nativas; usar Web APIs estándar (`fetch`, `TextEncoder`).
- **Secrets en `.env`**: jamás hardcodear API keys; leerlas de `process.env`/`Deno.env`. `.env.example` ya tiene las 11 claves (Fase 1). Nunca loguear keys ni incluirlas en mensajes de error (patrón ya establecido en `fetcher.ts`: "No incluir headers de auth ni credenciales en el mensaje").
- **Cómputo LLM LOCKED**: Gemini SOLO embeddings (free); MiniMax para crítico/sensible; DeepSeek V4 Flash para volumen. Capa enchufable.
- **GSD workflow enforcement**: no editar fuera de un comando GSD.
- **Sin convenciones/arquitectura formal aún** (CONVENTIONS.md y ARCHITECTURE.md vacíos) → seguir los patrones de Fase 1 como ley de facto.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | **6.44.0** (latest) `[VERIFIED: npm registry 2026-06-17]` | Cliente OpenAI-compatible para MiniMax M-series y DeepSeek V4 vía `baseURL` por proveedor | Un solo SDK fetch-based para todos los endpoints OpenAI-compat; acepta `fetch` custom (mockeable sin red); corre en Deno vía `npm:openai`. **Nota:** STACK.md decía v5 (training-stale); el registry actual es v6.x — la API de `tool_choice`/`baseURL` es estable entre v5 y v6. |
| `@google/genai` | **2.8.0** (latest) `[VERIFIED: npm registry 2026-06-17]` | `EmbeddingProvider` (Gemini `gemini-embedding-001`) | SDK oficial GA de Gemini; soporta `outputDimensionality` (truncado MRL) en `embedContent`. SDK separado del openai SDK → justifica interfaz `EmbeddingProvider` aparte. |
| `zod` | **4.4.3** (latest) `[VERIFIED: npm registry 2026-06-17]` | Compuerta única de validación de salida estructurada de LLM | Ya es el validador del repo (Fase 1). `schema.safeParse(raw)` da `{success, data|error}`; `error.issues` alimenta el reprompt de reparación. **Nota:** el repo Fase 1 instaló zod; confirmar versión instalada (3.x vs 4.x) y alinear — la API `safeParse`/`.issues` es idéntica en ambas mayores. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^3.0.0 (ya en el repo) | Runner de tests unitarios (Node) | Tests de adapters con mock-fetch, router, validación zod, versionado. Patrón `passWithNoTests` ya configurado. |
| `@obs/core` | `workspace:*` | Tipos compartidos (si se decide exportar tipos de provider desde core) | Solo si el planner decide poner las *interfaces* en core y los *adapters* en `@obs/llm`. Recomendado: interfaces+tipos en `@obs/llm` para mantener `@obs/core` libre de deps; o tipos puros en core, impls en llm. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openai SDK multi-provider por `baseURL` | SDK nativo de cada proveedor (MiniMax/DeepSeek propios) | Solo si un endpoint OpenAI-compat no cubre un feature. MiniMax también expone Anthropic-compat; innecesario aquí. Mantener un SDK = capa enchufable mínima. |
| `@google/genai` para embeddings | Gemini vía endpoint OpenAI-compat | Gemini embeddings NO van por el openai SDK de forma fiable para `outputDimensionality`; usar el SDK propio. |
| Paquete nuevo `@obs/llm` | Meter en `@obs/core/src/providers` | `@obs/core` es tipos puros sin deps de red (Fase 1); meter openai/@google/genai ahí contamina su rol. Paquete hermano `@obs/llm` es más limpio y replica el patrón de `@obs/ingest`. |

**Installation:**
```bash
# packages/llm/package.json deps (Node/vitest):
pnpm --filter @obs/llm add openai@6 @google/genai@2 zod
pnpm --filter @obs/llm add -D vitest
# En Deno (Edge Functions) — imports directos, sin install:
#   import OpenAI from "npm:openai@6";
#   import { GoogleGenAI } from "npm:@google/genai@2";
#   import { z } from "npm:zod";
```

**Version verification (ejecutado 2026-06-17):**
- `npm view openai version` → `6.44.0`
- `npm view @google/genai version` → `2.8.0`
- `npm view zod version` → `4.4.3` (dist-tag `latest`)

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `openai` | npm | maduro (años) | ~decenas de M/sem | github.com/openai/openai-node | no ejecutado (ver nota) | Approved — SDK oficial OpenAI |
| `@google/genai` | npm | GA 2025+ | alto | github.com/googleapis/js-genai | no ejecutado | Approved — SDK oficial Google |
| `zod` | npm | maduro (años) | ~decenas de M/sem | github.com/colinhacks/zod | no ejecutado | Approved — ya en el repo (Fase 1) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> **Nota sobre slopcheck:** `slopcheck` 0.6.1 está instalado, pero su subcomando `install` *instala* paquetes (no es dry-run) y no soporta `--json`. Para evitar instalaciones colaterales no se ejecutó. Los tres paquetes son SDKs oficiales de primera mano (OpenAI, Google) y zod (ya presente en el repo desde Fase 1), todos con repos fuente públicos verificados y descargas masivas — riesgo de slopsquatting nulo. Si el planner quiere la verificación formal, correr `slopcheck scan` sobre el `package.json` resultante (modo no-instalador) tras crear el paquete.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   Caller (Fase 4/7,      │                  @obs/llm                    │
   NO en esta fase)       │                                             │
        │                 │   ┌──────────────────────────────────────┐  │
        │  TaskSpec       │   │  Router                              │  │
        │  { criticality, │   │  (criticality, sensitivity) → tier   │  │
        │    sensitivity, ├──▶│  + data-routing policy gate          │  │
        │    data }       │   │  FAIL-CLOSED si sensible→tier-entrena │  │
        │                 │   └───────────────┬──────────────────────┘  │
        │                 │                   │ selecciona provider      │
        │                 │     ┌─────────────┴─────────────┐            │
        │                 │     ▼                           ▼            │
        │                 │  ┌────────────────┐   ┌────────────────────┐ │
        │ complete<T>     │  │ MiniMaxProvider│   │ DeepSeekProvider   │ │
        │ (req, schema)   │  │ tool_choice:   │   │ response_format:   │ │
        │                 │  │ {function,name}│   │ {json_object}      │ │
        │                 │  │ → tool_calls   │   │ → message.content  │ │
        │                 │  │   .arguments   │   │   (JSON string)    │ │
        │                 │  └───────┬────────┘   └─────────┬──────────┘ │
        │                 │          │  raw JSON string     │            │
        │                 │          └──────────┬───────────┘            │
        │                 │                     ▼                        │
        │                 │       ┌──────────────────────────────┐       │
        │                 │       │ parseAndValidate(schema, raw) │       │
        │                 │       │  zod safeParse — COMPUERTA    │       │
        │                 │       │  ÚNICA. fail → repair loop:    │       │
        │                 │       │  reprompt con error.issues     │       │
        │                 │       │  (N reintentos) → throw final  │       │
        │                 │       └──────────────┬───────────────┘       │
        │◀────────────────┼──── validated T ─────┘                       │
        │                 │                                             │
        │  embed(texts)   │   ┌──────────────────────────────────────┐  │
        ├─────────────────┼──▶│ GeminiEmbeddingProvider              │  │
        │                 │   │ embedContent(outputDimensionality:768)│  │
        │ EmbeddingResult │   │ → L2-normalize (manual, dims≠3072)    │  │
        │ {vector,model,  │◀──│ → {vector, model, dims, version}      │  │
        │  dims,version}  │   └──────────────────────────────────────┘  │
        │                 │     ▲ openai SDK / @google/genai aceptan     │
        │                 │     │ fetch custom → mock-fetch en tests     │
        │                 │   ┌─┴────────────────────────────────────┐  │
        │                 │   │ fetchFn?: typeof fetch (inyectable)   │  │
        │                 │   └──────────────────────────────────────┘  │
                          └─────────────────────────────────────────────┘
                                       │ network (solo en runtime real)
                                       ▼
                        api.minimax.io / api.deepseek.com / Gemini API
```

### Recommended Project Structure
```
packages/llm/
├── package.json              # @obs/llm, deps openai/@google/genai/zod, workspace:* @obs/core opcional
├── tsconfig.json             # extends ../../tsconfig.base.json, references core si se usa
├── vitest.config.ts          # passWithNoTests, node
├── test/
│   └── _helpers.ts           # makeMockFetch para LLM/embeddings (espejo de ingest/_helpers.ts)
└── src/
    ├── index.ts              # API pública (interfaces, providers, router, tipos)
    ├── types.ts              # LLMProvider, EmbeddingProvider, CompletionRequest, EmbeddingResult, Criticality, Sensitivity
    ├── validate.ts           # parseAndValidate(schema, raw) + repair loop
    ├── validate.test.ts
    ├── providers/
    │   ├── minimax.ts        # MiniMaxProvider (tool_choice forzado)
    │   ├── minimax.test.ts
    │   ├── deepseek.ts       # DeepSeekProvider (json_object)
    │   ├── deepseek.test.ts
    │   ├── gemini-embeddings.ts
    │   └── gemini-embeddings.test.ts
    ├── router.ts             # selectProvider(taskSpec, config) fail-closed
    ├── router.test.ts
    ├── data-routing.ts       # política RUT-nunca-LLM, PII-nunca-tier-entrena + doc inline
    ├── data-routing.test.ts
    └── config.ts             # forma del config swappable (env→provider map, model ids, baseURLs)
```

### Pattern 1: Provider abstraction con `complete<T>(req, schema)`
**What:** Una interfaz única; el adapter produce JSON crudo de la forma que su API soporta; la validación zod es externa al adapter y única.
**When to use:** Todo acceso LLM estructurado (FND-06).
**Example:**
```typescript
// Source: diseño derivado de CONTEXT.md + openai SDK docs (developers.openai.com/api/docs/guides/function-calling)
import { z } from "zod";

export type Criticality = "critical" | "bulk";
export type Sensitivity = "public" | "personal"; // 'personal' = PII (nombres en contexto identidad)

export interface CompletionRequest {
  system?: string;          // prefijo ESTABLE (prompt-cache DeepSeek): instrucciones + schema + ejemplos
  user: string;             // parte variable al final
  criticality: Criticality;
  sensitivity: Sensitivity;
  maxRepairAttempts?: number;
}

export interface LLMProvider {
  readonly id: string;      // "minimax" | "deepseek"
  readonly trainsOnInputs: boolean; // false para tiers pagos/DPA; gate del router
  // T se infiere del schema zod; el adapter devuelve raw JSON, la compuerta valida
  complete<T>(req: CompletionRequest, schema: z.ZodType<T>): Promise<T>;
}
```

### Pattern 2: MiniMax — tool-calling forzado como structured output
**What:** MiniMax NO soporta `response_format`; se fuerza una función única con el JSON schema esperado y se lee `tool_calls[0].function.arguments`.
**Example:**
```typescript
// Source: WebSearch verificado (community.openai.com tool_choice forced) + MiniMax tool-calling docs
//   (platform.minimax.io/docs/guides/text-m3-function-call). baseURL CITADO.
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: env.MINIMAX_API_KEY,
  baseURL: "https://api.minimax.io/v1", // [CITED: platform.minimax.io/docs/guides/text-m3-function-call]
  fetch: fetchFn,                        // inyectable → mock en tests
});

const res = await client.chat.completions.create({
  model: "MiniMax-M2",                   // o "MiniMax-M3" — model id por config
  messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
  tools: [{
    type: "function",
    function: { name: "emit_result", description: "...", parameters: jsonSchemaFromZod },
  }],
  tool_choice: { type: "function", function: { name: "emit_result" } }, // FUERZA la función
});
const raw = res.choices[0].message.tool_calls?.[0]?.function.arguments; // JSON string
return parseAndValidate(schema, raw, req);
```

### Pattern 3: DeepSeek — `json_object` + prefijo estable (prompt-cache)
**What:** DeepSeek V4 soporta `response_format: { type: "json_object" }` (no schema estricto); se exige la palabra "json" + ejemplo en el prompt, contexto estable al INICIO para maximizar cache hits.
**Example:**
```typescript
// Source: [CITED: api-docs.deepseek.com/guides/json_mode] + WebSearch verificado (model ids V4)
const client = new OpenAI({
  apiKey: env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",   // [CITED: api-docs.deepseek.com]
  fetch: fetchFn,
});
const res = await client.chat.completions.create({
  model: "deepseek-v4-flash",            // NO "deepseek-chat" (retira 2026-07-24)
  messages: [
    { role: "system", content: req.system }, // prefijo estable: instrucciones+schema+ejemplo JSON
    { role: "user", content: req.user },      // variable al final → cache-hit del prefijo
  ],
  response_format: { type: "json_object" },
});
const raw = res.choices[0].message.content;  // JSON string
return parseAndValidate(schema, raw, req);
```

### Pattern 4: Compuerta zod única con repair loop
**What:** Independiente del modo del provider, el raw JSON solo se acepta si pasa el schema. Ante fallo, reprompt con los `error.issues` (hasta N reintentos), luego throw.
**Example:**
```typescript
// Source: diseño derivado de CONTEXT.md + zod safeParse API
export async function parseAndValidate<T>(
  schema: z.ZodType<T>,
  raw: string | undefined,
  ctx: { reprompt: (errors: string) => Promise<string | undefined>; maxAttempts: number },
): Promise<T> {
  let current = raw;
  for (let attempt = 0; attempt <= ctx.maxAttempts; attempt++) {
    let parsed: unknown;
    try { parsed = JSON.parse(current ?? ""); }
    catch { parsed = undefined; }
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    if (attempt === ctx.maxAttempts) {
      throw new LLMValidationError(result.error.issues); // sin incluir el prompt/keys
    }
    const errorMsg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    current = await ctx.reprompt(errorMsg); // re-llama al provider pidiendo corregir esos campos
  }
  throw new LLMValidationError([]);
}
```

### Pattern 5: Router fail-closed (criticidad, sensibilidad)
**What:** Mapeo puro de (criticality, sensitivity) → provider, con gate de cumplimiento: si la tarea es `sensitivity: "personal"` y el provider candidato `trainsOnInputs === true`, **abortar** (no degradar silenciosamente).
**Example:**
```typescript
// Source: diseño derivado de CONTEXT.md (política dato→proveedor, fail-closed)
export function selectProvider(
  task: { criticality: Criticality; sensitivity: Sensitivity },
  registry: Record<string, LLMProvider>,
  config: RouterConfig, // criticality → provider id (swappable por env)
): LLMProvider {
  const providerId = config.byCriticality[task.criticality]; // critical→minimax, bulk→deepseek
  const provider = registry[providerId];
  if (!provider) throw new RouterError(`no provider for criticality=${task.criticality}`);
  // FAIL-CLOSED: dato personal nunca a un tier que entrena con inputs
  if (task.sensitivity === "personal" && provider.trainsOnInputs) {
    throw new SensitiveRoutingError(
      `task is personal but provider ${provider.id} trains on inputs — refusing (fail-closed)`,
    );
  }
  return provider;
}
```

### Pattern 6: EmbeddingProvider con versionado y normalización L2 manual
**What:** Gemini emite 3072 por defecto; truncar a 768 vía `outputDimensionality`. **CRÍTICO:** a dims ≠ 3072 Gemini NO normaliza — hay que L2-normalizar manualmente. Cada vector lleva `{model, dims, version}`.
**Example:**
```typescript
// Source: [CITED: ai.google.dev/gemini-api/docs/embeddings] (768 MRL, normalización manual a dims≠3072)
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const EMBEDDING_VERSION = "v1"; // bump => re-embed; nunca mezclar versiones en un índice

function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

export interface EmbeddingResult {
  vector: number[];
  model: string;   // "gemini-embedding-001"
  dims: number;    // 768
  version: string; // "v1"
}

async embed(texts: string[]): Promise<EmbeddingResult[]> {
  const resp = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: { outputDimensionality: EMBEDDING_DIMS },
  });
  return resp.embeddings.map((e) => ({
    vector: l2normalize(e.values),   // OBLIGATORIO a 768
    model: EMBEDDING_MODEL, dims: EMBEDDING_DIMS, version: EMBEDDING_VERSION,
  }));
}
```

### Anti-Patterns to Avoid
- **Asumir `response_format` universal:** MiniMax M2/M2.5 NO lo soporta. Romperá la adjudicación (Fase 4) si el adapter MiniMax lo usa. Usar tool-calling forzado.
- **Validar dentro de cada adapter de forma distinta:** la compuerta zod debe ser ÚNICA y externa; si cada provider valida a su manera, "cambiar de modelo" deja de ser seguro.
- **Vector anónimo:** persistir un embedding sin `{model, dims, version}` rompe el re-embedding incremental (FND-07). Prohibido.
- **No normalizar a 768:** asumir que Gemini normaliza a dims≠3072. La distancia cosine en pgvector asume vectores normalizados; sin L2 manual, el recall se degrada.
- **Degradar en silencio en el router:** si una tarea sensible no tiene tier permitido, abortar, no caer a un tier que entrena.
- **`deepseek-chat`/`deepseek-reasoner`:** aliases que se retiran 2026-07-24. Usar `deepseek-v4-flash`/`-pro`.
- **Meter las keys en mensajes de error/logs:** patrón ya prohibido en Fase 1 (`fetcher.ts`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cliente HTTP OpenAI-compat (auth, retries SDK, streaming) | fetch crudo a `/chat/completions` | `openai` SDK con `baseURL` | El SDK maneja auth, parsing, tipos; un solo SDK = capa enchufable |
| Validación de JSON de LLM | parser/validador a mano | `zod` `safeParse` | Ya es el validador del repo; `.issues` alimenta el repair loop |
| Truncado/normalización de embeddings | reimplementar MRL/cosine | `outputDimensionality` del SDK + L2 manual mínima | El SDK trunca; solo el L2 es manual (5 líneas) |
| JSON-schema desde tipos para tool-calling | escribir el JSON schema a mano | derivar de zod (p.ej. `z.toJSONSchema` en zod v4, o `zod-to-json-schema`) | Mantiene una sola fuente de verdad: el schema zod |
| Mock de red en tests | interceptar globalThis.fetch | `fetchFn` inyectable + `makeMockFetch` (patrón Fase 1) | El SDK acepta `fetch` custom; espeja `packages/ingest/test/_helpers.ts` |

**Key insight:** El valor de esta fase es la *frontera*, no el cómputo. Todo lo pesado (HTTP, embeddings, schema) ya está en SDKs/zod; lo que se construye a mano es la *interfaz*, la *compuerta única*, el *router fail-closed* y el *versionado* — lógica pura, 100% testeable sin red.

## Common Pitfalls

### Pitfall 1: MiniMax sin response_format rompe la adjudicación
**What goes wrong:** El adapter MiniMax intenta `response_format: {json_object}` y la API lo ignora o falla → salida no estructurada → la adjudicación (Fase 4) recibe basura.
**Why it happens:** Asunción de paridad OpenAI. MiniMax solo lo soporta en `MiniMax-Text-01` (modelo viejo), no en M2/M2.5/M3 vía OpenAI-compat.
**How to avoid:** MiniMaxProvider usa exclusivamente tool-calling forzado (`tool_choice: {type:"function", function:{name}}`).
**Warning signs:** Respuestas con texto antes/después del JSON, o `message.content` no parseable.

### Pitfall 2: Embeddings sin normalizar a 768
**What goes wrong:** Búsqueda semántica con cosine devuelve vecinos malos.
**Why it happens:** Gemini normaliza solo a 3072 por defecto; a 768 (MRL) entrega vectores SIN normalizar.
**How to avoid:** L2-normalizar manualmente todo vector a dims≠3072 (verificado en docs Gemini).
**Warning signs:** Magnitudes de vector ≠ 1.0; recall bajo en "proyectos similares" (se notará en Fase 7).

### Pitfall 3: Router que degrada en vez de abortar
**What goes wrong:** Tarea sensible (PII) cae al free tier de Gemini o a un tier que entrena → fuga de dato personal a entrenamiento (riesgo legal del proyecto).
**Why it happens:** Patrón "fallback" por defecto en routers.
**How to avoid:** Fail-closed explícito: `SensitiveRoutingError` si `personal && trainsOnInputs`. Test que verifica el throw.
**Warning signs:** Cualquier rama `catch`/`||` que sustituya un provider sensible por otro sin checar `trainsOnInputs`.

### Pitfall 4: Mezclar versiones de embedding en un índice
**What goes wrong:** Vectores de `v1` y `v2` (o dims distintos) conviven en el mismo índice → distancias incomparables.
**Why it happens:** Cambiar el modelo sin bump de `embedding_version` + re-embed.
**How to avoid:** `embedding_version` por vector (FND-07); regla documentada: cambiar modelo ⇒ re-embed; nunca mezclar. La columna/constraint se materializa en Fase 7, pero la forma se fija aquí.
**Warning signs:** Vectores con `dims` distintos en el mismo conjunto.

### Pitfall 5: Código Node-only que rompe en Deno
**What goes wrong:** El adapter usa `Buffer`/`crypto` Node-only o imports con extensión → falla en Edge Functions (Deno).
**Why it happens:** Vitest corre en Node; el código corre en Deno.
**How to avoid:** Solo Web APIs estándar (`fetch`, `TextEncoder`, `crypto.subtle`); imports sin extensión nativa; exponer por `deno.json` import-map (`@obs/llm/`). Verificar con `deno check` además de `tsc`.
**Warning signs:** `import ... from "node:..."`; uso de `Buffer`.

## Runtime State Inventory

> Esta fase es **greenfield** (paquete nuevo, sin renombrar nada existente). No aplica inventario de estado runtime de rename/migración. La única "versión" introducida es `embedding_version="v1"` como constante de código — no hay datos previos que migrar (los embeddings de corpus son Fase 7). **None — verificado: Fase 2 no toca datos, servicios ni registros OS existentes; solo crea `/packages/llm`.**

## Code Examples

### Test de provider con mock-fetch (sin red)
```typescript
// Source: patrón de packages/ingest/src/fetcher.test.ts + test/_helpers.ts (repo Fase 1)
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { makeMockFetch } from "../test/_helpers";
import { DeepSeekProvider } from "./deepseek";

const schema = z.object({ decision: z.enum(["match", "no_match"]), confidence: z.number() });

it("DeepSeek: json_object válido pasa la compuerta zod", async () => {
  const mock = makeMockFetch({
    "https://api.deepseek.com/chat/completions": {
      status: 200,
      body: JSON.stringify({
        choices: [{ message: { content: '{"decision":"match","confidence":0.9}' } }],
      }),
    },
  });
  const provider = new DeepSeekProvider({ apiKey: "x", fetchFn: mock.fn });
  const out = await provider.complete({ user: "...", criticality: "bulk", sensitivity: "public" }, schema);
  expect(out.decision).toBe("match");
});
```

### Test del repair loop
```typescript
// Source: diseño parseAndValidate + zod
it("repara salida inválida reprompteando con los issues", async () => {
  // 1ª respuesta: confidence ausente → falla zod → reprompt → 2ª respuesta válida
  // assert: se llamó 2 veces; el 2º prompt incluye "confidence: required"
});
```

### Test del router fail-closed
```typescript
it("aborta (fail-closed) si tarea personal va a provider que entrena", () => {
  const registry = { gemini: { id: "gemini", trainsOnInputs: true } as any };
  expect(() =>
    selectProvider({ criticality: "bulk", sensitivity: "personal" },
      registry, { byCriticality: { bulk: "gemini", critical: "gemini" } }),
  ).toThrow(SensitiveRoutingError);
});
```

### Smoke test live opcional (gated por env)
```typescript
// Source: patrón estándar de skip condicional vitest
const LIVE = process.env.LLM_LIVE_SMOKE === "1";
(LIVE ? describe : describe.skip)("smoke live MiniMax", () => {
  it("devuelve un objeto válido contra la API real", async () => {
    // usa la key real de .env; quema cuota mínima; NO corre en CI por defecto
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `openai` SDK v5 (STACK.md) | `openai` v6.44.0 | registry 2026-06-17 | API `baseURL`/`tool_choice` estable; usar v6 |
| `deepseek-chat` / `deepseek-reasoner` aliases | `deepseek-v4-flash` / `deepseek-v4-pro` | retiro 2026-07-24 | Usar ids V4 directos |
| MiniMax M2/M2.5 | MiniMax-M3 (1M ctx) disponible, M2 aún ofrecido | docs 2026 | Model id por config; M2 default seguro, M3 si se quiere más contexto |
| Gemini embeddings 3072 default | `gemini-embedding-001` con MRL 768 + L2 manual | GA 2025+ | Truncar a 768; normalizar manual |

**Deprecated/outdated:**
- `response_format` asumido universal: nunca aplicó a MiniMax M2+.
- `deepseek-chat`/`deepseek-reasoner`: retiro 2026-07-24.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MiniMax acepta `tool_choice: {type:"function", function:{name}}` para forzar UNA función específica vía OpenAI-compat (confirmado para OpenAI; MiniMax docs muestran tool-calling estándar pero NO documentan explícitamente forced single-function) | Pattern 2 | Si MiniMax solo soporta `tool_choice:"auto"`/`"required"`, podría devolver 0 o >1 tool_calls — mitigable validando que haya exactamente 1 y repromptear; bajo riesgo |
| A2 | Model id `MiniMax-M2` (o `MiniMax-M3`) es el correcto vía OpenAI-compat; PROJECT.md dice "MiniMax M3", docs listan M2..M3 | Pattern 2 | Model id por config (swappable); riesgo nulo de arquitectura, solo de valor por defecto |
| A3 | `deepseek-v4-flash` es el id correcto para volumen y soporta `json_object` | Pattern 3 | WebSearch lo confirma contra docs; bajo riesgo |
| A4 | `@google/genai` `embedContent` acepta `config.outputDimensionality` y `contents: string[]` (batch) con `resp.embeddings[]` | Pattern 6 | Si la firma batch difiere (p.ej. método o forma de `contents`), ajustar al SDK 2.8.0 al implementar; verificar contra docs del SDK |
| A5 | zod v4 expone `z.toJSONSchema` para derivar el JSON schema de tool-calling; si el repo quedó en zod 3.x usar `zod-to-json-schema` | Don't Hand-Roll | Bajo riesgo; ambas opciones existen |
| A6 | `embedding_version="v1"` como string libre es suficiente; el formato exacto (semver vs entero) queda a discreción del planner | Pattern 6 | Cosmético; FND-07 solo exige que exista y se persista |

**Nota:** El planner/discuss-phase debería confirmar A1 y A4 contra el SDK/endpoint reales al implementar (un smoke test live de 1 llamada por provider resuelve ambos). El resto es bajo riesgo.

## Open Questions

1. **¿zod 3.x o 4.x quedó instalado en Fase 1?**
   - What we know: el registry latest es 4.4.3; STACK.md decía "3.x / 4.x".
   - What's unclear: la versión exacta en el lockfile del repo.
   - Recommendation: el planner debe leer el lockfile/`package.json` y alinear `@obs/llm` a la misma mayor. La API `safeParse`/`.issues` es idéntica; solo cambia `z.toJSONSchema` (v4) vs `zod-to-json-schema` (v3).

2. **¿Las interfaces viven en `@obs/core` o en `@obs/llm`?**
   - What we know: `@obs/core` es tipos puros sin deps de red; `@obs/llm` tendría openai/@google/genai.
   - What's unclear: preferencia del usuario (CONTEXT.md lo deja a discreción).
   - Recommendation: tipos/interfaces puros (`LLMProvider`, `EmbeddingProvider`, `Criticality`, `Sensitivity`, `EmbeddingResult`) en `@obs/core`; adapters concretos en `@obs/llm`. Mantiene `@obs/core` como contrato y `@obs/llm` como implementación. Alternativa válida: todo en `@obs/llm`.

3. **Forma exacta del config de routing swappable.**
   - What we know: debe mapear criticality→provider y leerse de env/config.
   - Recommendation: un objeto `RouterConfig { byCriticality: Record<Criticality, providerId>; models: Record<providerId, {model, baseURL, trainsOnInputs}> }` poblado desde env. A discreción del planner.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai` (npm) | Adapters MiniMax/DeepSeek | ✓ (registry) | 6.44.0 | — |
| `@google/genai` (npm) | GeminiEmbeddingProvider | ✓ (registry) | 2.8.0 | — |
| `zod` (npm) | Compuerta de validación | ✓ (en repo Fase 1) | 3.x/4.x | — |
| `vitest` | Tests | ✓ (en repo) | ^3.0.0 | — |
| Deno | Verificar consumo Edge (`deno check`) | ✓ (runtime del repo) | 2.x | — |
| API keys (MiniMax/DeepSeek/Gemini) | Smoke test live (opcional) | en `.env` (claves presentes, valores que el usuario debe llenar) | — | tests unitarios con mock-fetch NO requieren keys |

**Missing dependencies with no fallback:** Ninguna. Toda la fase es testeable sin red ni keys.
**Missing dependencies with fallback:** El smoke test live requiere keys reales en `.env`; si están vacías, el smoke test se salta (`describe.skip`) — los tests unitarios cubren toda la lógica.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 (Node) — ya en el repo |
| Config file | `packages/llm/vitest.config.ts` (nuevo, espeja `packages/core/vitest.config.ts` con `passWithNoTests`) |
| Quick run command | `pnpm --filter @obs/llm test` |
| Full suite command | `pnpm -w test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-06 | DeepSeek `json_object` válido pasa la compuerta zod | unit (mock-fetch) | `pnpm --filter @obs/llm test deepseek` | ❌ Wave 0 |
| FND-06 | MiniMax tool-call forzado → arguments → zod | unit (mock-fetch) | `pnpm --filter @obs/llm test minimax` | ❌ Wave 0 |
| FND-06 | Salida inválida dispara repair loop (reprompt con issues) y converge | unit | `pnpm --filter @obs/llm test validate` | ❌ Wave 0 |
| FND-06 | Salida inválida tras N reintentos lanza `LLMValidationError` (sin filtrar prompt/keys) | unit | `pnpm --filter @obs/llm test validate` | ❌ Wave 0 |
| FND-06 | Router selecciona provider por criticality (critical→minimax, bulk→deepseek) | unit | `pnpm --filter @obs/llm test router` | ❌ Wave 0 |
| FND-06 | Router FAIL-CLOSED: `personal && trainsOnInputs` ⇒ `SensitiveRoutingError` | unit | `pnpm --filter @obs/llm test router` | ❌ Wave 0 |
| FND-06 | data-routing: el helper rechaza un input que contiene RUT destinado a un LLM | unit | `pnpm --filter @obs/llm test data-routing` | ❌ Wave 0 |
| FND-07 | `embed()` devuelve `{vector, model, dims, version}` por texto — ningún vector anónimo | unit (mock-fetch) | `pnpm --filter @obs/llm test gemini` | ❌ Wave 0 |
| FND-07 | Vectores a 768 dims y L2-normalizados (‖v‖≈1.0) | unit | `pnpm --filter @obs/llm test gemini` | ❌ Wave 0 |
| FND-07 | `embedding_version` presente y constante; cambiar modelo ⇒ versión distinta | unit | `pnpm --filter @obs/llm test gemini` | ❌ Wave 0 |

**Por qué todo es unit-testable:** la corrección de la validación zod, el fail-closed del router y el versionado de embeddings son lógica pura sobre respuestas inyectadas (mock-fetch). Ningún test toca la red. El SDK openai acepta `fetch` custom y `@google/genai` también es fetch-based → ambos se mockean con el `makeMockFetch` del repo.

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/llm test`
- **Per wave merge:** `pnpm -w test`
- **Phase gate:** suite completa verde + `deno check packages/llm/src/**` (consumo Edge) antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/llm/vitest.config.ts` — config del runner (passWithNoTests)
- [ ] `packages/llm/test/_helpers.ts` — `makeMockFetch` para respuestas LLM/embeddings (adaptado de `packages/ingest/test/_helpers.ts`: las respuestas son JSON de chat-completions/embeddings, no bytes crudos)
- [ ] `packages/llm/package.json` + `tsconfig.json` — scaffold del paquete (deps openai/@google/genai/zod)
- [ ] Entrada en `deno.json` import-map: `"@obs/llm/": "./packages/llm/src/"`

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No hay auth de usuario en esta capa (server-only, keys de servicio) |
| V3 Session Management | no | Sin sesiones |
| V4 Access Control | parcial | El router fail-closed ES un control de acceso a datos sensibles (PII no va a tier que entrena) |
| V5 Input Validation | **sí** | zod `safeParse` como compuerta única sobre toda salida LLM; data-routing valida que el RUT no entre a un prompt |
| V6 Cryptography | no | No se implementa cripto propia; `crypto.subtle` solo si se necesita hash (no en esta fase) |
| V7 Error Handling & Logging | **sí** | Errores NUNCA incluyen API keys ni el prompt completo (patrón Fase 1); `LLMValidationError` lleva solo `issues` |
| V14 Configuration | **sí** | API keys solo de `.env`/env; nunca hardcodeadas ni logueadas; `.env` gitignored (Fase 1) |

### Known Threat Patterns for {capa LLM/embeddings server-side}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuga de PII a tier que entrena con inputs (free Gemini) | Information Disclosure | Router fail-closed: `personal && trainsOnInputs` ⇒ abort; Gemini solo texto público |
| RUT enviado a un LLM | Information Disclosure | `data-routing`: RUT se matchea determinista, NUNCA entra a un prompt — gate testeado |
| API key en logs/errores | Information Disclosure | Mensajes de error sin credenciales (patrón `fetcher.ts`); no loguear requests |
| Salida LLM no validada tratada como hecho | Tampering | Compuerta zod única; salida inválida ⇒ repair o throw, nunca pasa cruda |
| Prompt injection devolviendo JSON malicioso | Tampering | zod schema estricto (enums/rangos); el schema rechaza valores fuera de dominio |

**security_block_on: high** — ninguna amenaza de esta fase es bloqueante si los controles (fail-closed router, zod gate, no-keys-in-logs) están implementados y testeados.

## Sources

### Primary (HIGH confidence)
- `packages/ingest/src/fetcher.ts` + `packages/ingest/test/_helpers.ts` + `packages/core/package.json` (repo, Fase 1) — patrón de paquete, `fetchFn` inyectable, `makeMockFetch`, project-references — HIGH
- [ai.google.dev/gemini-api/docs/embeddings](https://ai.google.dev/gemini-api/docs/embeddings) — `gemini-embedding-001`, MRL 768, **normalización manual a dims≠3072** — HIGH
- [api-docs.deepseek.com/guides/json_mode](https://api-docs.deepseek.com/guides/json_mode) — `response_format: json_object`, exige "json" en el prompt — HIGH
- [developers.openai.com/api/docs/guides/function-calling](https://developers.openai.com/api/docs/guides/function-calling) — `tool_choice: {type:"function", function:{name}}` para forzar función — HIGH
- npm registry (`npm view`, 2026-06-17) — openai 6.44.0, @google/genai 2.8.0, zod 4.4.3 — HIGH

### Secondary (MEDIUM confidence)
- [platform.minimax.io/docs/api-reference/api-overview](https://platform.minimax.io/docs/api-reference/api-overview) + [text-m3-function-call](https://platform.minimax.io/docs/guides/text-m3-function-call) — model ids M2..M3, baseURL `https://api.minimax.io/v1`, tool-calling shape — MEDIUM
- [github.com/MiniMax-AI/MiniMax-M2.5/issues/4](https://github.com/MiniMax-AI/MiniMax-M2.5/issues/4) — MiniMax NO soporta `response_format` vía OpenAI-compat — MEDIUM
- WebSearch (verificado contra docs DeepSeek) — `deepseek-v4-flash`/`-pro`, retiro `deepseek-chat`/`-reasoner` 2026-07-24 — MEDIUM/HIGH
- WebSearch (verificado contra políticas Google) — free tier Gemini entrena con inputs; paid/DPA no — MEDIUM/HIGH

### Tertiary (LOW confidence)
- Forced single-function `tool_choice` en MiniMax específicamente (extrapolado de OpenAI; ver Assumption A1) — LOW, confirmar con smoke test

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versiones verificadas en registry; SDKs oficiales
- Architecture (interfaces, compuerta, router, versionado): HIGH — patrón de paquete probado en Fase 1; diseño deriva directo de CONTEXT.md
- Provider specifics (MiniMax forced tool_choice, DeepSeek V4 ids, Gemini batch shape): MEDIUM — docs oficiales citadas; A1/A4 a confirmar al implementar
- Pitfalls / security: HIGH — fail-closed y no-vector-anónimo son requisitos duros explícitos

**Research date:** 2026-06-17
**Valid until:** 2026-07-15 (fast-moving en LLM endpoints; el retiro de aliases DeepSeek el 2026-07-24 y los model ids MiniMax pueden cambiar — re-verificar baseURL/model ids al implementar)
