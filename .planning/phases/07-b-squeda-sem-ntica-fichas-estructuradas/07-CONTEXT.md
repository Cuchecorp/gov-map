# Phase 7: Búsqueda Semántica + Fichas Estructuradas - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega el frente "proyectos" completo y cierra el milestone 1: un ciudadano puede
**buscar proyectos de ley en lenguaje natural** (por idea matriz o cuerpos legales) y descubrir
**"proyectos similares"**, recibiendo **fichas estructuradas** con plena trazabilidad a la fuente.

Cubre SEM-01..SEM-06:
- Descarga del texto íntegro de mensajes y mociones (links del XML del Senado + BCN `obtxml`) hacia R2.
- Extracción de **idea matriz** y **cuerpos legales** mediante parsing + LLM (DeepSeek, prompt-cache),
  con prompt restrictivo que **no interpreta ni conecta hechos** (guardarraíl riesgo existencial #2).
- Generación de embeddings (Gemini, 768-dim) e indexado en pgvector con índice HNSW; re-embedding
  idempotente y reanudable; cada vector versionado.
- Buscador en lenguaje natural que devuelve fichas estructuradas con trazabilidad.
- "Proyectos similares" por vecindad semántica (kNN).
- Ficha que unifica boletín, título, iniciativa, autores, cámara de origen, materia, idea matriz,
  cuerpos legales, estado y enlace a fuente.

**Fuera de scope** (heredado de PROJECT/REQUIREMENTS): voto individual por diputado, lobby/patrimonio,
dinero, grafo de influencia, y cualquier conclusión de causalidad/intención (regla rectora).
</domain>

<decisions>
## Implementation Decisions

### Extracción LLM + Golden Set (guardrail riesgo existencial #2)
- **Construir un golden set de extracción** (~15-20 proyectos anotados a mano) como **gate de calidad de CI**,
  espejo del patrón de identidad (Fase 4). Atiende el research flag P7 de STATE.md: la calidad de extracción
  LLM sobre texto legal en español es el cuello de botella → benchmarkear antes de comprometer el prompt.
- **Modelo: DeepSeek V4 Flash** (tier `bulk`, prompt-cache) vía la capa `LLMProvider` ya existente, con
  **compuerta zod externa** (`parseAndValidate`); MiniMax M3 disponible como fallback para casos difíciles.
- **Prompt restrictivo = extracción literal**: idea matriz como **cita textual** cuando exista en el texto;
  cuerpos legales como **lista normalizada** (número de ley/código + artículos citados). El prompt NUNCA
  interpreta, resume abstractivamente ni conecta hechos (guardarraíl #2). Resumen abstractivo queda RECHAZADO.
- **Texto íntegro no disponible** (R2 401 / sin link / fetch falla): **degradación honesta** — la ficha se
  genera sin idea matriz extraída, marcada "no disponible", y el embedding se computa sobre título + materia.
  Nunca se fabrica idea matriz ni se bloquea la ficha.

### Búsqueda — consulta y resultados
- **Embedding asimétrico**: la consulta del usuario se embebe con Gemini `RETRIEVAL_QUERY`; las fichas con
  `RETRIEVAL_DOCUMENT`. Mismo modelo/dims/versión (gemini-embedding-001, 768, L2-normalizado).
- **Un vector por proyecto**, computado sobre la concatenación **título + materia + idea matriz + cuerpos legales**.
- **Búsqueda semántica con atajo exacto por boletín**: si el query coincide con el patrón de número de boletín,
  se resuelve directo a la ficha; en caso contrario, kNN semántico.
- **Resultados: top-K=20 con umbral de distancia coseno** para descartar ruido; paginado simple.

### UI de búsqueda + proyectos similares
- **La home reemplaza la scaffold default de Next** por una landing de búsqueda (input grande); `/buscar`
  como ruta de resultados.
- **Resultados como tarjetas de ficha resumida** (boletín, título, materia, estado, badge de frescura, enlace),
  **reusando componentes existentes**: `camara-chip`, `etapa-badge`, `provenance-badge`, `ui/card`.
- **"Proyectos similares" en la página de ficha** `proyecto/[boletin]` como sección kNN que excluye el propio proyecto.
- **Todo el search es server-only** (Route Handler / Server Action): el embedding de la consulta y el kNN de
  pgvector corren en el servidor; la API key de Gemini nunca llega al cliente. Sigue el patrón de
  `createServerSupabase` (anon key server-only, sin `NEXT_PUBLIC_`).

### Orquestación del pipeline (idempotente/reanudable)
- **Versionado/reanudación**: `embedding_version` + estado por ficha (`pendiente`/`embebido`). El pipeline
  reanuda los pendientes; un bump de versión re-embebe todo. Nunca se mezclan versiones en el mismo índice
  (patrón FND-07 ya establecido en la capa de embeddings).
- **Carga inicial masiva en GitHub Actions** (escape hatch ya usado por seeders/conectores, sin límite de
  10 min de Edge Functions); incremental diario por cron/Edge Function. Mismo código de pipeline en ambos.
- **Tablas nuevas**: `proyecto_ficha` (idea_matriz text, cuerpos_legales jsonb, texto_r2_path, estado/versión
  de extracción) + `proyecto_embedding` (vector(768) con índice HNSW, model/dims/version) en relación 1:1 con
  `proyecto`. Mantiene `proyecto` limpio y permite re-embed sin tocar la entidad base. RLS public-read explícito
  (mismo patrón que migraciones 0008/0010) + GRANT SELECT; nunca exponer datos personales.
- **R2 crudo gateado por presencia de credencial** (mismo patrón que `backup-parlamentario`): escribe el crudo
  a R2 si hay key, si no degrada (texto en pipeline/skip) sin abortar. El 401 de R2 es estado conocido hoy.

### Claude's Discretion
- Nombres concretos de columnas/funciones SQL, estructura de los CLIs de pipeline, formato exacto del prompt
  de extracción (dentro de la restricción literal), y composición visual fina de la landing/tarjetas quedan a
  discreción de Claude siguiendo las convenciones del repo.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Capa LLM enchufable** (`packages/llm`): `LLMProvider` con `DeepSeekProvider` (prompt-cache, `response_format
  json_object`, compuerta zod externa `parseAndValidate`, repair loop), `GeminiEmbeddingProvider`
  (`gemini-embedding-001`, 768-dim, `l2normalize`, `EMBEDDING_MODEL/DIMS/VERSION`), router fail-closed y
  gates `assertNoRutInLlmInput`/`assertSensitivityAllowed`. La extracción de ficha es solo texto público.
- **`packages/ingest`**: `r2-store.ts` (escritura inmutable a R2 vía aws4fetch, If-None-Match), `cache`,
  `snapshot`, `rate-limiter`, `robots`, `allowlist`, `fetcher`, `drift`. SEM-01 reusa `@obs/ingest`
  (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get → r2-store) como ya hacen los seeders/conectores.
- **`packages/tramitacion`**: `model.ts` (`Proyecto`, clave boletín completo + `boletin_num` base, provenance
  inline `origen`/`fecha_captura`/`enlace`), `writer-supabase.ts`, conectores Cámara/Senado, `ingest-run`/`ingest-cli`.
  El texto íntegro proviene de los links del XML del Senado y `obtxml` de BCN ligados al boletín.
- **`packages/adjudication`** + **golden** dir: patrón de golden set como gate de deploy (precisión ≥ umbral)
  que la extracción debe replicar.
- **Frontend `app/`** (Next 16 App Router, Tailwind v4 + shadcn): `proyecto/[boletin]/page.tsx` (Server
  Components, Suspense), `lib/supabase.ts` (`createServerSupabase`, anon key server-only), componentes
  `camara-chip`, `etapa-badge`, `provenance-badge`, `autores-list`, `ficha-header`, `ui/card|badge|skeleton`,
  `lib/types.ts`, `lib/format.ts`.

### Established Patterns
- **Server-only data access**: anon key sin `NEXT_PUBLIC_`, lectura desde React Server Components, RLS
  public-read explícito por migración. Las llamadas a fuentes/LLM viven en backend (WAF/CORS + keys).
- **Idempotencia por clave natural** (boletín / claves naturales con índices únicos parciales; upsert).
- **Conectores reusan `@obs/ingest`** en orden LOCKED (allowlist → robots → rate-limit → fetch), NO BaseConnector
  para seeders/pipelines artesanales.
- **Vectores siempre versionados** (model/dims/version), L2-normalizados a 768; cosine en pgvector.
- **Slice E2E en RED** como diana de la fase (imports ausentes que las olas posteriores vuelven verde).
- **Degradación honesta** ante fuente caída (no fabricar filas) — patrón de Fase 6.

### Integration Points
- **DB**: nueva migración (siguiente número, 0011+) con `proyecto_ficha`, `proyecto_embedding`, índice HNSW,
  RLS public-read + GRANT SELECT; función RPC de kNN (cosine) consumida server-side.
- **Pipeline**: nuevo paquete (p.ej. `packages/semantica` / `packages/fichas`) que orquesta
  descarga → extracción (DeepSeek) → embedding (Gemini) → escritura; CLI reanudable + workflow de GitHub Actions.
- **Frontend**: home (`app/app/page.tsx`) reemplaza scaffold por landing de búsqueda; nueva ruta `/buscar`;
  Route Handler/Server Action de búsqueda; sección "proyectos similares" en `proyecto/[boletin]/page.tsx`.
- **Env**: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, credenciales R2 (gateadas), `SUPABASE_URL`/`SUPABASE_ANON_KEY`
  ya presentes (`.env`).
</code_context>

<specifics>
## Specific Ideas

- El research flag P7 de STATE.md es mandatorio: golden set de extracción + benchmark antes de comprometer el prompt.
- Reusar literalmente la capa LLM/embeddings y `@obs/ingest` ya construidas; no reescribir política de ingesta.
- La restricción del prompt (extracción literal, sin interpretar) es un guardarraíl legal del producto, no una preferencia.
</specifics>

<deferred>
## Deferred Ideas

- Búsqueda facetada / filtros avanzados (por cámara, estado, materia) más allá del atajo por boletín — posible mejora v2.
- Re-embedding masivo disparado por cambio de modelo (Gemini Embedding 2) — soportado por el versionado, pero no se ejecuta en esta fase.
- Exposición del texto íntegro completo en la UI — la fase muestra idea matriz + cuerpos legales con enlace a la fuente, no el cuerpo completo.
</deferred>
