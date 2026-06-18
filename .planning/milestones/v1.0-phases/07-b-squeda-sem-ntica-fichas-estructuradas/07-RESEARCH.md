# Phase 7: Búsqueda Semántica + Fichas Estructuradas - Research

**Researched:** 2026-06-18
**Domain:** Semantic search pipeline (LLM extraction + Gemini embeddings + pgvector kNN) over Chilean legislative text, with Next.js 16 search UI
**Confidence:** HIGH

## Summary

Phase 7 closes Milestone 1 by adding a semantic-search front-end over the `proyecto` corpus already populated in Phases 5-6. The phase is almost entirely an **extension exercise**, not a greenfield one: every hard part (LLM provider with prompt-cache + external zod gate, Gemini 768-dim L2-normalized embeddings, `@obs/ingest` fetch policy, golden-set-as-CI-gate, RLS public-read migration pattern, Server-Component ficha) already exists in the codebase and is verified working. The new work is (1) a download+extraction+embedding **pipeline package**, (2) two new DB tables + an HNSW index + a kNN RPC in migration `0011`, and (3) a small Next.js 16 search surface (landing + `/buscar` + ficha sections).

Three things demand real research-grade care because they are net-new behaviors and carry the project's existential guardrail #2 (the system must never interpret or connect facts): the **extraction golden set + benchmark** (mandatory per STATE flag — the literal, non-interpretive DeepSeek prompt must be measured before it is committed); the **asymmetric embedding** (query `RETRIEVAL_QUERY` vs document `RETRIEVAL_DOCUMENT`), which requires a minimal extension to the existing `GeminiEmbeddingProvider` that currently sends no `taskType`; and the **kNN RPC** (HNSW cosine `match_proyectos` with self-exclusion and a distance threshold) consumed server-only from a Next 16 Server Component.

Two known environment constraints force degraded-but-honest behavior and must be planned around explicitly: **R2 S3 returns 401** (raw text write is gated by credential presence — mirror `backup-parlamentario`) and **Supabase remote DDL is blocked** (migration `0011` runs against the *local* Docker Supabase; remote push is an operator step). Neither blocks the phase; both are pre-existing patterns.

**Primary recommendation:** Build a new `packages/fichas` (extraction+embedding pipeline) and `packages/busqueda` (or a thin search module reused by the app) that compose the existing `@obs/llm`, `@obs/ingest`, and `@obs/tramitacion`. Extract the full-text link from the **already-present** `<descripcion><link_mensaje_mocion>` field of the Senado tramitación XML (the parser does not read it yet). Write migration `0011_fichas_embeddings.sql` with `proyecto_ficha` + `proyecto_embedding(vector(768))` + an HNSW `vector_cosine_ops` index + a `match_proyectos` RPC, all RLS public-read. Gate the prompt behind a 15-20 case extraction golden set that fails CI when literal-extraction fidelity drops below threshold.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Extracción LLM + Golden Set (guardrail riesgo existencial #2)**
- Construir un golden set de extracción (~15-20 proyectos anotados a mano) como gate de calidad de CI, espejo del patrón de identidad (Fase 4). Atiende el research flag P7: benchmarkear antes de comprometer el prompt.
- Modelo: DeepSeek V4 Flash (tier `bulk`, prompt-cache) vía la capa `LLMProvider` existente, con compuerta zod externa (`parseAndValidate`); MiniMax M3 disponible como fallback para casos difíciles.
- Prompt restrictivo = extracción literal: idea matriz como cita textual cuando exista en el texto; cuerpos legales como lista normalizada (número de ley/código + artículos citados). El prompt NUNCA interpreta, resume abstractivamente ni conecta hechos (guardarraíl #2). Resumen abstractivo queda RECHAZADO.
- Texto íntegro no disponible (R2 401 / sin link / fetch falla): degradación honesta — la ficha se genera sin idea matriz extraída, marcada "no disponible", y el embedding se computa sobre título + materia. Nunca se fabrica idea matriz ni se bloquea la ficha.

**Búsqueda — consulta y resultados**
- Embedding asimétrico: la consulta del usuario se embebe con Gemini `RETRIEVAL_QUERY`; las fichas con `RETRIEVAL_DOCUMENT`. Mismo modelo/dims/versión (gemini-embedding-001, 768, L2-normalizado).
- Un vector por proyecto, computado sobre la concatenación título + materia + idea matriz + cuerpos legales.
- Búsqueda semántica con atajo exacto por boletín: si el query coincide con el patrón de número de boletín, se resuelve directo a la ficha; en caso contrario, kNN semántico.
- Resultados: top-K=20 con umbral de distancia coseno para descartar ruido; paginado simple.

**UI de búsqueda + proyectos similares**
- La home reemplaza la scaffold default de Next por una landing de búsqueda (input grande); `/buscar` como ruta de resultados.
- Resultados como tarjetas de ficha resumida (boletín, título, materia, estado, badge de frescura, enlace), reusando componentes existentes: `camara-chip`, `etapa-badge`, `provenance-badge`, `ui/card`.
- "Proyectos similares" en la página de ficha `proyecto/[boletin]` como sección kNN que excluye el propio proyecto.
- Todo el search es server-only (Route Handler / Server Action): el embedding de la consulta y el kNN de pgvector corren en el servidor; la API key de Gemini nunca llega al cliente. Sigue el patrón de `createServerSupabase` (anon key server-only, sin `NEXT_PUBLIC_`).

**Orquestación del pipeline (idempotente/reanudable)**
- Versionado/reanudación: `embedding_version` + estado por ficha (`pendiente`/`embebido`). El pipeline reanuda los pendientes; un bump de versión re-embebe todo. Nunca se mezclan versiones en el mismo índice (patrón FND-07).
- Carga inicial masiva en GitHub Actions (escape hatch ya usado por seeders/conectores, sin límite de 10 min de Edge Functions); incremental diario por cron/Edge Function. Mismo código de pipeline en ambos.
- Tablas nuevas: `proyecto_ficha` (idea_matriz text, cuerpos_legales jsonb, texto_r2_path, estado/versión de extracción) + `proyecto_embedding` (vector(768) con índice HNSW, model/dims/version) en relación 1:1 con `proyecto`. RLS public-read explícito (mismo patrón que migraciones 0008/0010) + GRANT SELECT; nunca exponer datos personales.
- R2 crudo gateado por presencia de credencial (mismo patrón que `backup-parlamentario`): escribe el crudo a R2 si hay key, si no degrada sin abortar. El 401 de R2 es estado conocido hoy.

### Claude's Discretion

- Nombres concretos de columnas/funciones SQL, estructura de los CLIs de pipeline, formato exacto del prompt de extracción (dentro de la restricción literal), y composición visual fina de la landing/tarjetas quedan a discreción de Claude siguiendo las convenciones del repo.

### Deferred Ideas (OUT OF SCOPE)

- Búsqueda facetada / filtros avanzados (por cámara, estado, materia) más allá del atajo por boletín — posible mejora v2.
- Re-embedding masivo disparado por cambio de modelo (Gemini Embedding 2) — soportado por el versionado, pero no se ejecuta en esta fase.
- Exposición del texto íntegro completo en la UI — la fase muestra idea matriz + cuerpos legales con enlace a la fuente, no el cuerpo completo.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEM-01 | Descarga del texto íntegro de mensajes y mociones (links XML Senado + BCN `obtxml`) | `<descripcion><link_mensaje_mocion>` ya presente en el XML del Senado (verificado en fixture `senado-tramitacion.xml`); el parser actual NO lo extrae → extender `parseSenadoTramitacion`. Descarga vía `@obs/ingest` (allowlist→robots→rate-limit→fetcher→r2-store). R2 gateado por credencial (401 conocido). |
| SEM-02 | Extracción idea matriz + cuerpos legales (DeepSeek prompt-cache) | `DeepSeekProvider` existente (`response_format json_object`, system-prefix estable, repair loop, `parseAndValidate`). Prompt restrictivo espeja `SYSTEM_ADJUDICACION` de `@obs/adjudication`. Golden set como gate (espeja `golden-set.test.ts`). |
| SEM-03 | Embeddings Gemini 768-dim + índice HNSW pgvector | `GeminiEmbeddingProvider` (768, L2, versionado) existente; extender con `taskType`. Migración `0011` con `vector(768)` + HNSW `vector_cosine_ops`. pgvector 0.8.x ya habilitado (`0001_extensions.sql`). |
| SEM-04 | Buscar en lenguaje natural → fichas con trazabilidad | Server-only search: embed query `RETRIEVAL_QUERY` → RPC `match_proyectos` → render `SearchResultCard` reusando `ProvenanceBadge`. Next 16 Server Component + `redirect` atajo boletín. |
| SEM-05 | "Proyectos similares" por kNN | RPC `match_proyectos` con `exclude_boletin` (self-exclusion); sección `ProyectosSimilares` en la ficha. |
| SEM-06 | Ficha unifica boletín/título/iniciativa/autores/cámara/materia/idea matriz/cuerpos legales/estado/enlace | `proyecto` (Fase 5) + `proyecto_ficha` (nueva) leídos por Server Components; `IdeaMatrizBlock` + `CuerposLegalesList` (UI-SPEC §6). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Descarga texto íntegro (SEM-01) | Pipeline (Deno/TS, GitHub Actions o Edge Function) | R2 (object storage) | Llamada a fuente gov = server-only (WAF/CORS); raw crudo va a R2 inmutable (FND-02). Nunca desde el navegador. |
| Extracción LLM (SEM-02) | Pipeline (Deno/TS) | DeepSeek API | Cómputo LLM tras `LLMProvider`; el dominio nunca conoce el modelo. Texto público → tier `bulk`. |
| Embedding de fichas (SEM-03 write) | Pipeline (Deno/TS) | Gemini API + Database (pgvector) | Embedding versionado (FND-07) escrito a `proyecto_embedding`; índice HNSW vive en Postgres. |
| Embedding de la consulta (SEM-04) | Frontend Server (Next 16 RSC/Route Handler) | Gemini API | La query del usuario se embebe server-only; la Gemini key nunca llega al cliente. |
| kNN search + similares (SEM-04/05) | Database (Postgres RPC) | Frontend Server (supabase-js rpc) | El cálculo de vecindad vive en Postgres (`match_proyectos`); el RSC solo invoca y renderiza. |
| Render de ficha/resultados (SEM-04/06) | Frontend Server (RSC) | Browser (client island `SearchBox` solo) | Server Components leen Supabase con anon key + RLS public-read; única isla cliente = `SearchBox` (navegación). |
| Orquestación reanudable | Pipeline CLI + pg_cron/GitHub Actions | Database (estado `pendiente`/`embebido`) | Lo masivo/largo → GitHub Actions; lo incremental → cron/Edge Function. Mismo código (regla del repo). |

## Standard Stack

All core dependencies are **already first-party packages in this monorepo** — no new external runtime packages are required for the pipeline. The only new install is a single shadcn UI primitive.

### Core (existing, reuse verbatim)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@obs/llm` `DeepSeekProvider` | workspace | Extracción idea matriz + cuerpos legales | `response_format json_object` + stable system prefix (prompt-cache) + external `parseAndValidate` repair loop. `[VERIFIED: packages/llm/src/providers/deepseek.ts]` |
| `@obs/llm` `GeminiEmbeddingProvider` | workspace | Embeddings 768-dim L2-normalized, versionados | `EMBEDDING_MODEL/DIMS/VERSION`, `l2normalize`, `batchEmbedContents` REST con `fetchFn` inyectable. `[VERIFIED: packages/llm/src/providers/gemini-embeddings.ts]` |
| `@obs/ingest` | workspace | Fetch policy + R2 raw store | `assertAllowedUrl → robots → rateLimiter.wait → fetcher.get → R2Store.putImmutable`. `[VERIFIED: packages/ingest/src/index.ts]` |
| `@obs/tramitacion` | workspace | `Proyecto` model + Senado XML parser | El parser ya lee `<descripcion>`; falta extraer `<link_mensaje_mocion>`. `[VERIFIED: packages/tramitacion/src/parse-senado-tramitacion.ts]` |
| pgvector | 0.8.x | `vector(768)` + HNSW index | Ya habilitado en `0001_extensions.sql`. HNSW = default 2026, cosine. `[VERIFIED: supabase/migrations/0001_extensions.sql]` |
| Next.js | 16.2.9 | Search UI (RSC + Route Handler/Server Action) | Installed locally; App Router, Server Components default. `[VERIFIED: app/node_modules/next/package.json]` |
| `@supabase/supabase-js` | 2.108.2 (installed) | `rpc()` kNN call + table reads | `createServerSupabase` anon key server-only. `[VERIFIED: app/lib/supabase.ts]` |

### Supporting (existing transitive)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `openai` | ^6.44.0 (installed) | OpenAI-compatible client inside `DeepSeekProvider` | Already wired via `baseURL`. Note: CLAUDE.md says v5; installed is v6 — no action needed, provider works. `[VERIFIED: npm view openai = 6.44.0 + packages/llm/package.json]` |
| `@google/genai` | ^2.8.0 (installed) | (Embedding provider uses raw REST, not the SDK) | Provider deliberately uses `batchEmbedContents` REST with injectable fetch. `[VERIFIED: packages/llm/package.json]` |
| `zod` | ^4.4.3 (installed) | Extraction output schema (idea matriz + cuerpos legales) | External validation gate for LLM JSON. `[VERIFIED: packages/llm/package.json]` |
| `fast-xml-parser` | 5.x | Parse `link_mensaje_mocion` from Senado XML | Already used by `parse-senado-tramitacion.ts`. `[VERIFIED: packages/tramitacion/src/parse-senado-tramitacion.ts]` |

### New install (UI only)
| Library | Source | Purpose |
|---------|--------|---------|
| shadcn `input` | shadcn official registry | `SearchBox` input. `pnpm dlx shadcn@latest add input`. `[CITED: 07-UI-SPEC.md §0]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DeepSeek (bulk) for extraction | MiniMax M3 (critical, tool-calling) | MiniMax is the fallback for hard cases (CONTEXT.md). Default bulk volume = DeepSeek prompt-cache. Don't reach for MiniMax unless the golden set shows DeepSeek failing literal fidelity. |
| HNSW index | IVFFlat | IVFFlat needs training data + degrades on changing data. HNSW is the 2026 default. Corpus is small/changing → HNSW. `[CITED: CLAUDE.md §3]` |
| `vector(768)` float32 | `halfvec(768)` | At 768 dims float32 is fine; halfvec only needed >2000 dims. Keep `vector(768)`. `[CITED: CLAUDE.md §3]` |
| One vector per proyecto over concatenated text | Per-section vectors / chunking | CONTEXT locks one vector over título+materia+idea matriz+cuerpos legales. No chunking in this phase. |

**Installation:**
```bash
# Pipeline: no new runtime deps — workspace packages only.
# UI:
cd app && pnpm dlx shadcn@latest add input
```

## Package Legitimacy Audit

> No new external runtime packages are introduced by this phase. The pipeline composes existing workspace packages (`@obs/*`) whose transitive deps (`openai`, `@google/genai`, `zod`, `fast-xml-parser`, `@supabase/supabase-js`, `aws4fetch`) were vetted and locked in Phases 1-6. The only new addition is a shadcn UI block from the official registry.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `openai` (already installed) | npm | mature | very high | github.com/openai/openai-node | not re-run (installed since P2) | Approved (existing) |
| `@google/genai` (already installed) | npm | mature | high | github.com/googleapis/js-genai | not re-run (installed since P2) | Approved (existing) |
| `@supabase/supabase-js` (already installed) | npm | mature | very high | github.com/supabase/supabase-js | not re-run (installed since P5) | Approved (existing) |
| shadcn `input` | shadcn official registry | n/a (code block, not npm pkg) | n/a | ui.shadcn.com | n/a (official registry) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was not run because the phase installs no new npm runtime packages. Should the planner introduce a new package (e.g. a markdown/PDF text-extraction lib for `obtxml` bodies), it MUST be gated behind the Package Legitimacy Gate + a `checkpoint:human-verify` before install.*

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────── WRITE PATH (pipeline) ───────────────────────┐
                         │                                                                       │
  proyecto rows ──┐      │  for each boletín pendiente:                                          │
  (Fase 5, DB)    │      │                                                                       │
                  ▼      │   1. read link_mensaje_mocion  ──► @obs/ingest                        │
        ┌──────────────┐ │      (Senado XML <descripcion>)   assertAllowedUrl→robots→            │
        │ pipeline CLI │─┼─────► [SEM-01] fetch texto íntegro  rateLimiter.wait→fetcher.get       │
        │ (packages/   │ │             │                              │                            │
        │   fichas)    │ │             ▼                              ▼                            │
        └──────────────┘ │     R2Store.putImmutable ◄── (gated: r2Enabled? else skip, degrade)   │
                  │      │             │                                                          │
                  │      │   2. [SEM-02] DeepSeekProvider.complete(restrictivo, FichaSchema)      │
                  │      │        → { idea_matriz | null, cuerpos_legales[] }  (zod-validated)    │
                  │      │             │                                                          │
                  │      │   3. compose embed text = título+materia+idea_matriz+cuerpos           │
                  │      │      [SEM-03] GeminiEmbeddingProvider.embed([text], RETRIEVAL_DOCUMENT)│
                  │      │        → vector(768) L2, versionado                                    │
                  │      │             │                                                          │
                  │      │             ▼                                                          │
                  │      │   upsert proyecto_ficha (idea/cuerpos/r2_path/estado=embebido)         │
                  │      │   upsert proyecto_embedding (vector, model/dims/version)               │
                  │      └───────────────────────────────────────────────────────────────────────┘
                  │                                   │ (Supabase LOCAL; remote = operator step)
                  ▼                                   ▼
        ┌─────────────────────────── Postgres (Supabase) ──────────────────────────────┐
        │  proyecto · proyecto_ficha · proyecto_embedding(HNSW vector_cosine_ops)        │
        │  RPC match_proyectos(query_embedding, match_count, match_threshold,            │
        │                       exclude_boletin)  →  cosine kNN, self-exclusion          │
        └───────────────────────────────────────────────────────────────────────────────┘
                  ▲                                   ▲
                  │ supabase-js rpc (anon, RLS read)  │ supabase-js .from('proyecto_ficha')
                  │                                   │
        ┌─────────┴───────── READ PATH (Next 16, server-only) ──────────┴──────────────┐
        │                                                                               │
        │  /buscar  (RSC)                         /proyecto/[boletin] (RSC)             │
        │   q → trim/cap                            ├─ IdeaMatrizBlock (proyecto_ficha) │
        │   ├─ boletín regex? → redirect(/proyecto/q)  ─ CuerposLegalesList             │
        │   └─ else: GeminiEmbedding(q, RETRIEVAL_QUERY)  └─ ProyectosSimilares         │
        │            → rpc match_proyectos → SearchResultCard[]   → rpc match_proyectos │
        │                                                          (exclude self)        │
        │   landing /  → SearchBox ("use client" island → navigates /buscar?q=)         │
        └───────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
packages/fichas/                 # NEW: download + extract + embed pipeline
├── src/
│   ├── model.ts                 # FichaSchema (idea_matriz, cuerpos_legales[]), zod
│   ├── prompt.ts                # SYSTEM_EXTRACCION (restrictivo) + construirPromptExtraccion
│   ├── extraer.ts               # DeepSeekProvider.complete → Ficha (validated)
│   ├── texto-fuente.ts          # read link_mensaje_mocion + obtxml; @obs/ingest fetch + R2 gate
│   ├── embed-ficha.ts           # compose text + GeminiEmbeddingProvider.embed(RETRIEVAL_DOCUMENT)
│   ├── pipeline.ts              # orquesta: pendientes → fetch → extract → embed → write
│   ├── writer-supabase.ts       # upsert proyecto_ficha + proyecto_embedding (service key)
│   ├── pipeline-cli.ts          # reanudable: --limite, --boletines, --reembed, --dry-run
│   └── golden/
│       ├── golden-set.ts        # 15-20 casos anotados a mano (idea matriz + cuerpos)
│       └── golden-set.test.ts   # GATE de CI: fidelidad literal >= umbral
supabase/migrations/
└── 0011_fichas_embeddings.sql   # proyecto_ficha + proyecto_embedding + HNSW + match_proyectos RPC + RLS
app/
├── app/page.tsx                 # REPLACE scaffold → landing + SearchBox
├── app/buscar/page.tsx          # NEW: results (server-only embed + rpc)
├── app/proyecto/[boletin]/page.tsx  # ADD idea-matriz / cuerpos-legales / similares sections
├── components/search-box.tsx    # "use client" island
├── components/search-result-card.tsx
├── components/idea-matriz-block.tsx
├── components/cuerpos-legales-list.tsx
├── components/proyectos-similares.tsx
└── lib/buscar.ts                # server-only: embed query + rpc match_proyectos
.github/workflows/
└── fichas-backfill.yml          # NEW: bulk extract+embed (escape hatch, no 10-min limit)
```

### Pattern 1: Restrictive (literal-only) extraction prompt — espeja `SYSTEM_ADJUDICACION`
**What:** A Spanish system prompt that forbids interpretation/abstraction/connection of facts (guardrail #2). Idea matriz = verbatim quote when present, else null. Cuerpos legales = normalized list (ley/código number + cited articles), extracted literally, never inferred.
**When to use:** Every extraction call in `packages/fichas/extraer.ts`.
**Example (model the structure on the proven adjudication prompt):**
```typescript
// Source: packages/adjudication/src/prompt.ts (SYSTEM_ADJUDICACION) — proven pattern
export const SYSTEM_EXTRACCION = `Eres un motor de extracción literal sobre el texto de un proyecto de ley chileno.
Tu única tarea es COPIAR información que aparece EXPLÍCITAMENTE en el texto. Reglas estrictas:
- idea_matriz: transcribe TEXTUALMENTE la frase del texto que enuncia la idea matriz/fundamental
  (suele estar tras "idea matriz", "objeto", "tiene por objeto"). Si el texto NO la enuncia
  explícitamente, devuelve null. NUNCA la resumas, parafrasees ni la redactes tú.
- cuerpos_legales: lista SOLO las normas (Ley N°, Código, DFL, decreto) que el texto cita
  textualmente como modificadas/afectadas, con sus artículos citados. Si no cita ninguna, [].
- NUNCA infieras intención, efecto, causa ni conexión entre hechos. NUNCA uses conocimiento
  externo. Si dudas si algo es literal, NO lo incluyas.
Responde un único objeto JSON. Output solo JSON, sin prosa.`;
```
The `DeepSeekProvider` already prepends a stable system prefix for prompt-cache and runs the external zod gate — pass `system: SYSTEM_EXTRACCION` and `FichaSchema`.

### Pattern 2: HNSW index + cosine kNN RPC with self-exclusion + threshold
**What:** A SQL function `match_proyectos` that ranks `proyecto_embedding` by cosine distance against a query vector, applies a distance threshold, and optionally excludes a boletín (for "similares").
**When to use:** Both `/buscar` (no exclusion) and `ProyectosSimilares` (exclude self).
**Example:**
```sql
-- Source: pgvector README (HNSW + <=> + 1-distance) + Supabase match function pattern
-- [VERIFIED: github.com/pgvector/pgvector] [CITED: supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes]
create index proyecto_embedding_hnsw
  on proyecto_embedding using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);   -- pgvector defaults; explicit for clarity

create or replace function match_proyectos(
  query_embedding vector(768),
  match_count     int       default 20,
  match_threshold float8    default 0.0,   -- min cosine SIMILARITY (1 - distance)
  exclude_boletin text      default null
)
returns table (boletin text, similarity float8)
language sql stable
as $$
  select e.boletin,
         1 - (e.embedding <=> query_embedding) as similarity
  from proyecto_embedding e
  where (exclude_boletin is null or e.boletin <> exclude_boletin)
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by e.embedding <=> query_embedding   -- ASC distance = best first; uses HNSW
  limit match_count;
$$;
```
Note: order by the raw `<=>` distance (ascending) so the HNSW index is used; compute `similarity = 1 - distance` for the threshold and the return value. Never surface similarity to the UI (UI-SPEC §5: no relevance score).

### Pattern 3: Asymmetric Gemini embedding — minimal provider extension
**What:** The existing `GeminiEmbeddingProvider.embed()` sends `outputDimensionality: 768` but **no `taskType`**. Asymmetric retrieval needs `RETRIEVAL_DOCUMENT` on fichas (write) and `RETRIEVAL_QUERY` on the user query (read). Add an optional `taskType` to each request object in the `batchEmbedContents` body.
**When to use:** Pipeline embeds with `RETRIEVAL_DOCUMENT`; `/buscar` embeds with `RETRIEVAL_QUERY`.
**Example:**
```typescript
// Source: ai.google.dev/api/embeddings — taskType is per-request in batchEmbedContents
// [CITED: ai.google.dev/api/embeddings] — extends packages/llm/src/providers/gemini-embeddings.ts
const body = {
  requests: texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMS,
    taskType,                       // "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
  })),
};
```
Minimal change: add a `taskType?: TaskType` option to `embed()` (or a sibling method `embedQuery`/`embedDocuments`). Keep the existing dim-mismatch guard and L2-normalize step unchanged — both remain mandatory at 768 dims. `[VERIFIED: packages/llm/src/providers/gemini-embeddings.ts — current body has no taskType]`

### Pattern 4: Golden-set-as-CI-gate (mirror `@obs/adjudication`)
**What:** A `golden-set.test.ts` that runs the extraction against 15-20 hand-annotated cases with a **mocked provider in CI** (no network, no key) and a **gated LIVE block** (`FICHAS_GOLDEN_LIVE=1`) measuring real DeepSeek fidelity. A metric below threshold FAILS the test → blocks deploy.
**When to use:** The mandatory P7 research-flag gate.
**Metric design (this is the part needing judgment):**
- **Cuerpos legales:** F1 over the set of cited legal bodies (norma + articulos). Precision-weighted: a *fabricated* cuerpo legal (one not in the text) is the existential-risk failure mode → counts as a false positive that drives precision down, exactly like an auto-accepted wrong id in identity. Set `PRECISION_MIN` high (≥0.95) and `RECALL_MIN` moderate (≥0.80).
- **Idea matriz:** human-judged literal-fidelity label per case, encoded in the golden set as `expected` (a verbatim substring that MUST appear, or `null` for "should degrade to no disponible"). The test asserts the extracted idea_matriz is a literal substring of the source text (verbatim check, not semantic) OR is null when expected null. A paraphrase that is not a substring = failure. **An adversarial case** (text with no explicit idea matriz where a naive model would hallucinate one) makes the gate non-tautological — exactly the `g23-adversario` pattern.
```typescript
// Source: packages/adjudication/src/golden/golden-set.test.ts — proven gate structure
const PRECISION_MIN = 0.95;  // fabricated cuerpo legal = fp (existential risk #2)
const RECALL_MIN = 0.80;
// CI: mock provider keyed by source text → returns fixture extraction (no network).
// LIVE (FICHAS_GOLDEN_LIVE=1): real DeepSeekProvider, same threshold, skipped by default.
```

### Pattern 5: Migration 0011 RLS public-read (mirror 0008/0010)
**What:** New tables are public data → `enable row level security` + `create policy ... for select to anon using (true)` + `grant select ... to anon`. Without both the policy AND the grant, the deny-by-default inherited from Phases 1-4 leaves the ficha/search blank.
**When to use:** `proyecto_ficha` and `proyecto_embedding` in migration 0011.
```sql
-- Source: supabase/migrations/0008_tramitacion.sql / 0010_agenda.sql — proven pattern
alter table proyecto_ficha     enable row level security;
alter table proyecto_embedding enable row level security;
create policy proyecto_ficha_public_read     on proyecto_ficha     for select to anon using (true);
create policy proyecto_embedding_public_read on proyecto_embedding for select to anon using (true);
grant select on proyecto_ficha     to anon;
grant select on proyecto_embedding to anon;
-- Also grant EXECUTE on the RPC so the anon role can call it:
grant execute on function match_proyectos(vector, int, float8, text) to anon;
```
**Critical addition vs 0008/0010:** the kNN RPC must be `grant execute ... to anon`, otherwise the server-side anon client cannot call it.

### Anti-Patterns to Avoid
- **Abstractive summarization of idea matriz** — explicitly REJECTED (CONTEXT). The prompt extracts a verbatim quote or returns null. A paraphrase is a guardrail-#2 violation, not a feature.
- **Fabricating idea matriz / cuerpos legales when text is unavailable** — degrade honestly (null → "no disponible"), embed on título+materia. Never invent.
- **Surfacing cosine distance / "% match" / rank numbers to the user** — UI-SPEC §5 forbids it (implies false precision). Distance is server-side ordering only.
- **Calling Gemini/DeepSeek from a Client Component** — every model call is server-only (key leakage + WAF/CORS). Only `SearchBox` is `"use client"`, and it merely navigates.
- **`order by 1 - (embedding <=> q) desc`** — wrapping the distance in `1 - (...)` in the ORDER BY can defeat HNSW index usage. Order by raw `<=>` ascending.
- **Symmetric embedding** (same taskType for query and document) — measurably worse retrieval; CONTEXT locks asymmetric.
- **Mixing embedding versions in one index** — a version bump re-embeds everything; never query across versions. Filter or fully re-embed (FND-07 pattern).
- **Hardcoding pgvector `ivfflat`** — use HNSW (CLAUDE.md "What NOT to Use").
- **Heredoc / `cat <<EOF` for the migration or prompt files** — use the Write tool (repo convention + GSD rule).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM JSON validation + repair | Custom safeParse in the extractor | `parseAndValidate` via `DeepSeekProvider.complete(req, FichaSchema)` | Single external gate already handles repair loop, secret-safe errors (T-02-03). |
| Prompt-cache plumbing | Manual message assembly | `DeepSeekProvider` stable system prefix | Already optimized for DeepSeek prompt-cache. |
| Embedding normalization | Manual L2 / dim checks | `GeminiEmbeddingProvider` (`l2normalize`, dim-mismatch guard) | At 768 dims Gemini does NOT normalize; provider already does + guards FND-07. |
| Rate-limit / robots / SSRF / R2 raw | New fetch loop | `@obs/ingest` (`assertAllowedUrl→robots→rateLimiter.wait→fetcher.get→R2Store`) | LOCKED order; 2-3s serial per host; immutable If-None-Match R2. |
| kNN ranking | App-side cosine over fetched vectors | `match_proyectos` SQL RPC over HNSW | Index does the work in Postgres; app never pulls vectors. |
| Idempotent writes | Insert + dedupe logic | supabase-js `upsert({ onConflict })` by boletín | Proven idempotent pattern (writer-supabase.ts). |
| Boletín-shortcut parsing | New regex/validator | Reuse `/^\d{3,6}(-\d{1,2})?$/` from `proyecto/[boletin]/page.tsx` | Same validator already guards path injection. |
| Golden-set gate harness | New metric runner | Mirror `evaluarGolden` + `golden-set.test.ts` | Proven CI gate (mock in CI, gated LIVE). |
| Resumable bulk job | Cron loop in Edge Function | GitHub Actions escape hatch (`backfill.yml` shape) | No 10-min limit; same TS code (repo rule). |

**Key insight:** This phase is composition, not invention. The only genuinely *new* logic is (a) the extraction prompt + its schema, (b) the golden-set metric for literal fidelity, (c) the `match_proyectos` SQL, and (d) the `taskType` extension. Everything else is wiring proven parts together.

## Common Pitfalls

### Pitfall 1: The Senado XML full-text link is present but the parser ignores it
**What goes wrong:** SEM-01 looks for "where is the texto íntegro link" and reaches for BCN `obtxml` first, missing that the Senado tramitación XML already carries `<descripcion><link_mensaje_mocion>` (the mensaje/moción full text).
**Why it happens:** `parseSenadoTramitacion` reads `<descripcion>` for título/materia/estado but never extracts `link_mensaje_mocion` (verified — it is not in the parser).
**How to avoid:** Extend `parseSenadoTramitacion` (or read the raw XML in the pipeline) to capture `descripcion.link_mensaje_mocion`. This is the primary texto-íntegro source per boletín. BCN `obtxml?opt=7&idNorma=` is the *secondary* source for the resulting norm text once a project becomes law.
**Warning signs:** Pipeline reports "no link" for projects that clearly have one in the source XML.

### Pitfall 2: kNN RPC not granted EXECUTE to anon → search returns nothing
**What goes wrong:** Tables get RLS public-read but the `match_proyectos` function isn't `grant execute ... to anon`; the server-side anon client gets a permission error and `/buscar` shows empty/error.
**Why it happens:** 0008/0010 only granted SELECT on tables — there was no RPC. The RPC is new and needs its own grant.
**How to avoid:** Add `grant execute on function match_proyectos(...) to anon;` in migration 0011, and `security invoker` semantics are fine since the function only reads public tables.
**Warning signs:** `/buscar` always hits the error/empty state even with data loaded.

### Pitfall 3: ORDER BY wrapping the distance defeats the HNSW index
**What goes wrong:** Writing `order by (1 - (embedding <=> q)) desc` for "highest similarity" can prevent the planner from using the HNSW index → sequential scan, slow.
**Why it happens:** HNSW indexes the `<=>` distance directly; transforming it in ORDER BY breaks index matching.
**How to avoid:** `order by embedding <=> query_embedding` (ascending distance) and compute `1 - distance` only in the SELECT/WHERE.
**Warning signs:** `EXPLAIN` shows a seq scan; queries slow as the corpus grows.

### Pitfall 4: R2 401 silently dropping raw text + Supabase remote DDL block
**What goes wrong:** Pipeline tries to write raw text to R2 and aborts (401), or migration 0011 is pushed to the remote and fails on missing DDL credentials.
**Why it happens:** Known current state (probed 2026-06-18): R2 S3 creds return 401; `SUPABASE_SECRET_KEY` is a service key, not a management PAT → no remote DDL.
**How to avoid:** Gate the R2 write on credential presence (`r2Enabled` flag, mirror `backup-parlamentario` / Fase 3 `r2Enabled=false`) — degrade without aborting; the extraction can proceed on the in-memory/streamed text. Run migration 0011 against the **local** Supabase (Docker); remote push is an explicit operator checkpoint.
**Warning signs:** Pipeline throws on R2 PUT; `supabase db push` to remote returns 401 "JWT could not be decoded".

### Pitfall 5: Embedding the "no disponible" ficha on empty text
**What goes wrong:** When idea matriz is null (text unavailable), composing the embed text as `título + materia + null + []` yields a degenerate or empty string → bad/zero vector.
**Why it happens:** Naive concatenation with null/empty parts.
**How to avoid:** Compose defensively: filter null/empty parts; when only título+materia exist, embed on that (CONTEXT: "el embedding se computa sobre título + materia"). The `l2normalize` guard already returns the vector unchanged on zero-norm, but avoid feeding empty strings — `embed([])` and empty-text edge cases must be handled (the provider already no-ops on `texts.length === 0`).
**Warning signs:** Proyectos with unavailable text never appear in or dominate kNN results.

### Pitfall 6: DeepSeek `json_object` returns valid JSON that still hallucinates structure
**What goes wrong:** `response_format: json_object` guarantees *parseable* JSON, not *correct* extraction — the model can return a fabricated idea matriz that passes zod.
**Why it happens:** Schema validation checks shape, not literal fidelity to the source.
**How to avoid:** This is exactly why the golden set exists. The literal-substring check in the gate (idea_matriz must be a substring of the source text) is the real defense — zod alone cannot catch a fluent hallucination.
**Warning signs:** Golden set passes shape validation but the LIVE block shows low literal-fidelity precision.

## Runtime State Inventory

> Phase 7 is primarily greenfield (new tables, new pipeline, new UI). It does NOT rename or migrate existing data. Inventory included for the one cross-cutting concern: embedding versioning.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New tables only (`proyecto_ficha`, `proyecto_embedding`). No existing data is renamed. `proyecto` (Fase 5) is read-only here. | None — additive migration. |
| Live service config | None. No external service stores a Phase-7 string. | None — verified: pipeline is in-repo TS + Supabase + R2. |
| OS-registered state | None new. GitHub Actions workflow `fichas-backfill.yml` is new (in git), not an OS registration. | None. |
| Secrets/env vars | `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, R2 creds, `SUPABASE_URL`/`SUPABASE_ANON_KEY`/service key — all already in `.env`. No new secret names. | None — code reads existing names. |
| Build artifacts | New `packages/fichas` (+ optional `packages/busqueda`) need workspace install + build; shadcn `input` adds a component file. | `pnpm install` after adding the package; `pnpm dlx shadcn add input`. |
| Embedding version (FND-07) | `EMBEDDING_VERSION = "v1"` in `gemini-embeddings.ts`. `proyecto_embedding` stamps model/dims/version per row. | A future version bump triggers full re-embed (deferred); this phase writes `v1` only. Never mix versions in one query. |

## Code Examples

### Extraction output schema (FichaSchema)
```typescript
// Source: pattern from packages/adjudication/src/prompt.ts (AdjudicacionSchema) + zod ^4
import { z } from "zod";

export const CuerpoLegalSchema = z.object({
  norma: z.string().max(200),                 // "Ley N° 19.628", "Código del Trabajo", "DFL N° 1"
  articulos: z.array(z.string().max(50)).max(50).default([]),  // ["artículo 4", "artículo 12 bis"]
});

export const FichaSchema = z.object({
  // idea matriz = cita textual o null (NUNCA paráfrasis). El gate verifica que sea substring.
  idea_matriz: z.string().max(4000).nullable(),
  cuerpos_legales: z.array(CuerpoLegalSchema).max(100).default([]),
});
export type Ficha = z.infer<typeof FichaSchema>;
```

### Server-only search helper (`/buscar` data layer)
```typescript
// Source: app/lib/supabase.ts (createServerSupabase) + redirect.md (Next 16) + match_proyectos RPC
import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase";
import { GeminiEmbeddingProvider } from "@obs/llm";

const BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/;   // same validator as proyecto/[boletin]

export async function buscarProyectos(qRaw: string) {
  const q = qRaw.trim().slice(0, 300);
  if (q.length === 0) return [];
  if (BOLETIN_RE.test(q)) redirect(`/proyecto/${q}`);   // shortcut, before embedding

  const gemini = new GeminiEmbeddingProvider({ apiKey: process.env.GEMINI_API_KEY! });
  const [emb] = await gemini.embed([q] /*, taskType: "RETRIEVAL_QUERY" */);  // extension
  const sb = createServerSupabase();
  const { data } = await sb.rpc("match_proyectos", {
    query_embedding: emb.vector,
    match_count: 20,
    match_threshold: 0.0,     // tune from golden/observed distribution; never shown to user
    exclude_boletin: null,
  });
  return data ?? [];
}
```

### Resumable pipeline state (idempotent / FND-07)
```typescript
// Source: packages/tramitacion/src/ingest-cli.ts (flag-validated CLI) + writer-supabase upsert
// proyecto_ficha.estado in ('pendiente','embebido'); pipeline reads pendientes,
// or --reembed bumps and re-processes all. Upsert by boletín (1:1 with proyecto).
//   --limite N         acota el lote (default acotado, como ingest-cli)
//   --boletines a,b    explícitos
//   --reembed          re-embebe todo (version bump)
//   --dry-run          sin escribir DB; sin service key → degrada a dry-run con aviso
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IVFFlat default | HNSW default | pgvector 0.5+→0.8; Supabase 2026 | Use HNSW `vector_cosine_ops`; no training, robust to changing data. |
| Symmetric embeddings | Asymmetric (`RETRIEVAL_QUERY`/`RETRIEVAL_DOCUMENT`) | Gemini embedding GA | Better retrieval; requires `taskType` per request. |
| Pages Router | App Router (Server Components default) | Next 13→16 | All data fetching server-side; only `SearchBox` is a client island. |
| `response_format: json_schema` assumed universal | DeepSeek `json_object` + external zod gate | DeepSeek V-series | Shape-valid ≠ correct; literal-fidelity must be measured by the golden set. |

**Deprecated/outdated:**
- BCN `obtenerinfoley` → use `obtxml?opt=7&idNorma=` (CLAUDE.md). For SEM-01 the *primary* link is the Senado `link_mensaje_mocion`; `obtxml` is for the enacted-norm text.
- CLAUDE.md cites `openai@5`; installed is `openai@6.44.0` — no action, the provider works on v6.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gemini `batchEmbedContents` accepts `taskType` per request object (not only via the newer `embedContentConfig`) | Pattern 3 | If the REST shape requires `embedContentConfig`, the provider extension uses a slightly different field nesting; verify against a live call in a gated smoke test before bulk embed. Discovered via WebFetch of ai.google.dev (the fast-model summary flagged a deprecated-vs-config nuance). `[ASSUMED]` |
| A2 | `<descripcion><link_mensaje_mocion>` is consistently present for mensajes/mociones across the live corpus (seen in the fixture) | Pitfall 1, SEM-01 | Some boletines may lack it → those degrade to "no disponible" (acceptable per CONTEXT, but recall of texto íntegro drops). Verify coverage on a live sample. `[ASSUMED from fixture]` |
| A3 | A literal-substring check is a sufficient automated proxy for "idea matriz is verbatim" | Pattern 4 | Whitespace/encoding normalization may be needed (the text may differ by accents/spacing); the gate should normalize before substring-checking, else false failures. `[ASSUMED]` |
| A4 | `match_threshold` default 0.0 (return all, rely on ordering) is acceptable for v1; a real threshold tuned later | Pattern 2, code example | Too-low threshold surfaces noise in "Sin resultados" vs results; UI handles empty gracefully, but the threshold should be tuned against the observed distance distribution once data exists. `[ASSUMED]` |
| A5 | Embedding 4000-char idea matriz + título + materia + cuerpos fits Gemini's input limit at 768 dims | FichaSchema, embed | Very long mensajes could exceed input token limits; truncate the composed text defensively before embed. `[ASSUMED]` |

## Open Questions

1. **Gemini `taskType` exact REST field for `batchEmbedContents`**
   - What we know: `taskType` is the field name and `RETRIEVAL_QUERY`/`RETRIEVAL_DOCUMENT` are valid values; `outputDimensionality` coexists.
   - What's unclear: whether the current `batchEmbedContents` accepts `taskType` directly in each `requests[]` item or expects it nested in a config object (docs mention a newer `embedContentConfig`).
   - Recommendation: Add a single gated LIVE smoke test (`FICHAS_EMBED_LIVE=1`) that sends one query+one document with each taskType and asserts 768-dim output, before wiring the bulk pipeline. Cheap insurance against A1.

2. **`obtxml` necessity for SEM-01**
   - What we know: `link_mensaje_mocion` covers the project's own message/motion text.
   - What's unclear: whether the phase needs `obtxml` at all in M1, given the deferred decision "no exposure of full body in UI" and that idea matriz comes from the mensaje/moción, not the enacted norm.
   - Recommendation: Treat `obtxml` as optional/secondary for this phase; primary source is `link_mensaje_mocion`. Don't block on `obtxml` integration.

3. **Distance threshold value**
   - What we know: top-K=20 with a cosine threshold to drop noise (CONTEXT).
   - What's unclear: the actual cosine-similarity cutoff that separates "relevant" from "noise" for this corpus.
   - Recommendation: Ship with a permissive default, add a CLI/SQL parameter, and tune empirically once the corpus is embedded. The UI's "Sin resultados" / "Aún no hay similares" states make a conservative threshold safe.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase LOCAL (Docker) | migration 0011, pipeline writes, RPC | ✓ | Postgres 15+ / pgvector 0.8.x | — (remote push = operator step) |
| pgvector extension | HNSW index, `vector(768)` | ✓ | 0.8.x (enabled 0001) | — |
| Gemini API (embeddings) | SEM-03/04 | ✓ (key in .env, reads gov OK) | gemini-embedding-001 | If quota exhausted: pipeline pauses; query path errors → UI error state |
| DeepSeek API (extraction) | SEM-02 | ✓ (key in .env) | deepseek-v4-flash | MiniMax M3 fallback for hard cases (CONTEXT) |
| Senado XML source | SEM-01 texto íntegro link | ✓ (live read 200 confirmed) | wspublico | Per-boletín degrade to "no disponible" |
| Cloudflare R2 (S3) | SEM-01 raw text store | ✗ (401, probed 2026-06-18) | — | **Gate on credential presence; skip raw write, degrade honestly** (mirror backup-parlamentario) |
| Supabase REMOTE DDL | push migration 0011 to prod | ✗ (service key, not mgmt PAT) | — | Run against LOCAL; remote push = operator checkpoint (needs DB password / `sbp_` PAT) |
| Next.js 16 / pnpm | search UI | ✓ | next 16.2.9 | — |

**Missing dependencies with no fallback:** none block the phase.
**Missing dependencies with fallback:**
- R2 S3 (401) → credential-gated raw write, honest degradation. Extraction/embedding proceed on streamed text.
- Supabase remote DDL → migration runs LOCAL; remote is an explicit operator step (pre-existing constraint since Phase 1/3).

## Validation Architecture

> nyquist_validation: no `.planning/config.json` override found disabling it; treated as ENABLED. The extraction golden set is the centerpiece of this phase's validation and is also the mandatory STATE research flag.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 (workspace standard, every `@obs/*` package) `[VERIFIED: packages/llm/package.json]` |
| Config file | per-package `vitest.config.ts` (e.g. `packages/adjudication/vitest.config.ts`) |
| Quick run command | `pnpm --filter @obs/fichas test` |
| Full suite command | `pnpm -r test` (all packages) + `pnpm --filter app build`/typecheck |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEM-01 | Extract `link_mensaje_mocion` from Senado XML; R2 gated by credential | unit | `pnpm --filter @obs/fichas test -t "texto-fuente"` | ❌ Wave 0 |
| SEM-02 | DeepSeek extraction returns schema-valid idea matriz + cuerpos | unit (mock provider) | `pnpm --filter @obs/fichas test -t "extraer"` | ❌ Wave 0 |
| SEM-02 | **Golden gate: literal fidelity ≥ threshold (BLOCKS deploy)** | gate (mock CI + gated LIVE) | `pnpm --filter @obs/fichas test -t "golden"` | ❌ Wave 0 (mandatory) |
| SEM-03 | Embedding text composition (degrades on null idea matriz); `RETRIEVAL_DOCUMENT` | unit | `pnpm --filter @obs/fichas test -t "embed-ficha"` | ❌ Wave 0 |
| SEM-03 | Migration 0011 applies; HNSW index + RPC exist | integration (pgTAP or supabase local) | `supabase db reset` then RPC smoke | ❌ Wave 0 |
| SEM-04 | `match_proyectos` returns kNN; boletín shortcut redirects | unit + integration | `pnpm --filter @obs/fichas test -t "match"` | ❌ Wave 0 |
| SEM-05 | kNN excludes self (`exclude_boletin`) | unit/integration | RPC test with `exclude_boletin` | ❌ Wave 0 |
| SEM-06 | Ficha sections render idea matriz / cuerpos / "no disponible" states | component (or E2E slice RED→green) | `app` slice test | ❌ Wave 0 |
| All | E2E slice in RED as the phase target (imports absent → waves turn green) | e2e | `pnpm --filter @obs/fichas test -t "slice.e2e"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/fichas test` (fast, mocked — no network/key).
- **Per wave merge:** `pnpm -r test` + `pnpm --filter app build`.
- **Phase gate:** full suite green (incl. golden gate) before `/gsd:verify-work`. LIVE golden block (`FICHAS_GOLDEN_LIVE=1`) is informational/operator-run; CI gate is the mocked one (never depends on network/key — mirror identity gate Pitfall 5).

### Wave 0 Gaps
- [ ] `packages/fichas/src/golden/golden-set.ts` — 15-20 hand-annotated cases (idea matriz verbatim + cuerpos legales), incl. ≥1 adversarial "no explicit idea matriz" case to keep the gate non-tautological.
- [ ] `packages/fichas/src/golden/golden-set.test.ts` — precision/recall gate (F1 on cuerpos, literal-substring on idea matriz) + gated LIVE block.
- [ ] `packages/fichas/src/model.test.ts` — `FichaSchema` contract.
- [ ] `packages/fichas/src/slice.e2e.test.ts` — RED walking-skeleton (imports absent).
- [ ] `packages/fichas/vitest.config.ts` — mirror `packages/adjudication/vitest.config.ts`.
- [ ] Migration 0011 integration check (RPC + HNSW present after `supabase db reset` on LOCAL).
- [ ] Mock embedding/LLM providers for offline tests (mirror `MockMiniMaxProvider`).

## Security Domain

> security_enforcement: no `.planning/config.json` override found; treated as ENABLED.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Search is public read-only; no user auth in this phase. |
| V3 Session Management | no | Stateless search; no sessions. |
| V4 Access Control | yes | RLS public-read explicit on new tables + `grant select`/`grant execute` to anon. `parlamentario` (rut/email) stays deny-by-default. Service key server-only (writes); anon key server-only, never `NEXT_PUBLIC_`. |
| V5 Input Validation | yes | `searchParams.q` trimmed + length-capped (≤300) + boletín regex; supabase-js parameterizes the RPC (no raw SQL interpolation). LLM/embedding inputs are public text only. |
| V6 Cryptography | yes (delegated) | R2 SigV4 via aws4fetch (no hand-rolled signing); no new crypto. API keys via header (`x-goog-api-key`), never in URL/body/logs. |

### Known Threat Patterns for {Next 16 RSC + Supabase + LLM pipeline}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via search query | Tampering | supabase-js `.rpc()` parameterization; query never string-interpolated into SQL; length-cap + regex on `q`. |
| API key exfiltration to client bundle | Information Disclosure | All embed/LLM calls server-only; `import "server-only"`; keys not `NEXT_PUBLIC_`; keys via headers, never logged (existing provider rule). |
| Over-exposure of personal data via new tables | Information Disclosure | New tables carry NO personal data (idea matriz/cuerpos are public legislative text). RLS public-read is safe; `parlamentario` untouched. |
| Prompt injection in legislative text → fabricated extraction | Tampering / Spoofing | Restrictive literal-only prompt + zod schema gate + golden-set literal-fidelity gate. Output never presented as fact beyond verbatim framing (UI blockquote). |
| SSRF via texto-íntegro fetch | Tampering | `@obs/ingest` `assertAllowedUrl` (gov allowlist) before any fetch — already enforced. |
| Path injection via boletín shortcut | Tampering | Reuse `/^\d{3,6}(-\d{1,2})?$/` before `redirect`. |
| Denial of wallet (LLM/embedding quota) | DoS | Pipeline is operator-triggered/cron-gated, not user-triggered; query embedding is one small call per search; repair-loop attempts clamped (`MAX_REPAIR_ATTEMPTS_CEILING`). |

## Sources

### Primary (HIGH confidence)
- `packages/llm/src/providers/{deepseek.ts,gemini-embeddings.ts}`, `validate.ts`, `router.ts`, `types.ts` — provider contracts, prompt-cache, L2/dim guards, external zod gate `[VERIFIED: codebase]`
- `packages/adjudication/src/prompt.ts` + `golden/golden-set.{ts,test.ts}` — restrictive prompt + golden-gate pattern `[VERIFIED: codebase]`
- `packages/ingest/src/{index.ts,r2-store.ts}` — fetch policy + immutable R2 `[VERIFIED: codebase]`
- `packages/tramitacion/src/parse-senado-tramitacion.ts` + `test/fixtures/senado-tramitacion.xml` — `<link_mensaje_mocion>` present, not parsed `[VERIFIED: codebase]`
- `supabase/migrations/{0001_extensions.sql,0008_tramitacion.sql,0010_agenda.sql}` — pgvector enabled + RLS public-read pattern `[VERIFIED: codebase]`
- `app/{lib/supabase.ts,app/proyecto/[boletin]/page.tsx}` — server-only anon client + RSC ficha `[VERIFIED: codebase]`
- `app/node_modules/next/dist/docs/01-app/.../redirect.md`, `06-fetching-data.md` — Next 16 server data + redirect `[CITED: local Next 16 docs]`
- `github.com/pgvector/pgvector` — HNSW params (m=16, ef_construction=64), `<=>`, `1-distance` `[VERIFIED: pgvector README]`
- MEMORY `env-credentials-reality.md` — R2 401 + Supabase remote DDL block (probed 2026-06-18) `[VERIFIED: live probe]`

### Secondary (MEDIUM confidence)
- `ai.google.dev/api/embeddings` — `taskType` values + `outputDimensionality` (per-request vs config nuance flagged) `[CITED]`
- `supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes` — HNSW DDL + `<=>` operator `[CITED]`

### Tertiary (LOW confidence)
- (none — all critical claims cross-verified against codebase or official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every core piece is an existing, tested workspace package; versions verified on registry + lockfile.
- Architecture: HIGH — mirrors three proven migrations (0008/0010), the adjudication golden gate, and the existing RSC ficha.
- Pitfalls: HIGH — derived from reading the actual parser, migrations, and the probed env constraints (R2 401, remote DDL).
- Gemini `taskType` REST shape: MEDIUM — A1 flagged; gated LIVE smoke test recommended before bulk embed.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable; re-verify Gemini `taskType` REST shape and pgvector defaults if the embedding provider or pgvector is upgraded)
