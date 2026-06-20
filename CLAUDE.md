<!-- GSD:project-start source:PROJECT.md -->

## Project

**Observatorio del Congreso 360**

Plataforma web ciudadana para consultar y cruzar datos públicos del Congreso de Chile, con dos frentes de igual peso: (1) **seguimiento de proyectos de ley** —en qué etapa está cada proyecto, cómo se ha votado, proyectos similares, búsqueda semántica por idea matriz y cuerpos legales— y (2) **análisis de parlamentarios 360** —qué proyectos presentan, cómo votan, con quién se reúnen (lobby), qué declaran en patrimonio e intereses, financiamiento y contratos del Estado que los rodean. Dirigida a público general y prensa, con trazabilidad a la fuente como principio rector.

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato mostrado lleva fuente, fecha y enlace original, sin afirmar nunca intención ni causalidad.

### Constraints

- **Tech stack**: TypeScript/Deno full (Edge Functions + conectores) — un solo lenguaje, integración nativa Supabase; reescribir el scraping de referencia (Python) a TS
- **Frontend**: Next.js (React, SSR) — ecosistema maduro para fichas, visualizaciones y, a futuro, grafos
- **Infra datos**: Supabase (Postgres + pgvector + auth/RLS); plan Pro ($25/mes, 8 GB) es la línea base de producción, no el free; tabla maestra de identidades respaldada fuera de Supabase sí o sí
- **Object storage**: Cloudflare R2 para el crudo (el free de Supabase da 500 MB de DB)
- **Cómputo LLM**: Gemini solo embeddings (free); MiniMax M3 (45k calls/sem gratis) para lo crítico/sensible (adjudicación de identidad); DeepSeek V4 Flash para volumen (extracción de fichas, prompt-cache). Capa enchufable; modelo final elegido por benchmark sobre golden set
- **Secrets**: todas las API keys en `.env`
- **Ingesta respetuosa**: rate-limit 2–3s, User-Agent identificatorio, respeto robots.txt, caché diaria
- **Legal**: pasada de asesoría legal antes del lanzamiento público; atribución CC BY 4.0 visible

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Deno** | 2.x (runtime de Supabase Edge Functions) | Runtime de conectores e ingesta | Un solo lenguaje, soporte nativo `npm:` y `jsr:`, fetch/Web APIs estándar, sandbox por permisos. Es el runtime sobre el que corren las Edge Functions. |
| **Supabase Postgres** | Postgres 15+ con `pgvector` 0.8.x | Modelo normalizado + vectores + auth/RLS | Postgres gestionado con pgvector, pg_cron, pgmq y pg_net integrados — todo el backend de datos+jobs en un solo plano. Plan Pro como línea base. |
| **Next.js** | 16.x (App Router) | Frontend SSR, fichas, timelines | App Router estable, Server Components por defecto (las llamadas a fuentes externas viven server-only → evita CORS del WAF gubernamental). React 19.2, React Compiler 1.0 estable, Turbopack default. |
| **React** | 19.2 | UI | Viene con Next.js 16. |
| **TypeScript** | 5.x | Lenguaje único | Tipado de esquemas de fuentes (validación de contrato) y de los providers LLM/Embedding. |
| **pgvector** | 0.8.x | Índice y tipo vectorial | Soporta `halfvec` (half-precision) e índices HNSW; 0.8 mejoró performance de HNSW notablemente. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **cheerio** | 1.2.0 | Parsing de HTML ASP.NET WebForms (citaciones Cámara, búsqueda de proyectos) | Extraer `__VIEWSTATE`/`__EVENTVALIDATION` y leer tablas/`GridView`. API tipo jQuery, server-side, sin DOM completo. Funciona en Deno vía `npm:cheerio@1.2.0`. |
| **fast-xml-parser** | 5.9.x (línea 5.x estable) | Parsing del XML del Senado (`wspublico/tramitacion.php`, `votaciones.php`) y del XML de BCN/LeyChile (`obtxml`) | Parser XML puro JS, rápido, sin dependencias C/C++, maneja archivos grandes. `npm:fast-xml-parser@5`. Preferir sobre DOM parsers para XML estructurado. |
| **openai** (SDK oficial JS/TS) | 5.x | Cliente OpenAI-compatible para DeepSeek V4 y MiniMax M-series | Un solo SDK para todos los endpoints OpenAI-compatibles vía `baseURL`. Import `npm:openai` en Deno. Base de la capa enchufable `LLMProvider`. |
| **@google/genai** | SDK GA actual de Gemini | `EmbeddingProvider` (Gemini `gemini-embedding-001`) | SDK oficial Gemini para embeddings. Soporta `outputDimensionality` (truncado MRL). Free tier para embeddings. |
| **zod** | 3.x / 4.x | Validación de esquema de respuestas de fuentes + validación de salida JSON de LLMs | Compuerta de validación de contrato (PROJECT.md: "validación de esquema"). También valida JSON de LLM cuando el modelo no soporta `json_schema` nativo. |
| **deno_dom** | `jsr:@b-fuze/deno-dom` (última) | Fallback de parsing HTML cuando se requiere DOM real | Solo si cheerio falla en algún HTML mal formado; cheerio es preferente por ergonomía. |
| **Supabase JS** | `@supabase/supabase-js` v2 | Cliente DB/Storage/Auth desde Edge Functions y Next.js | Acceso a Postgres, Storage, RPC y RLS. |
| **AWS SDK S3 client** | `@aws-sdk/client-s3` v3 | Escritura del crudo a Cloudflare R2 (API S3-compatible) | R2 expone API S3; el cliente S3 v3 apunta al endpoint R2. Guardar XML/JSON/HTML crudo versionado. |

### Visualization (frontend)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| **visx** (`@visx/*`) | última | Timeline de tramitación por boletín (custom) | Primitivas D3-sobre-React. Control total sobre el timeline cruzando ambas cámaras; SVG, SSR-friendly. Recomendado para el timeline a medida. |
| **Recharts** | última | Gráficos estándar (barras de votaciones, frescura por fuente) | React-first, rápido de implementar para gráficos comunes; no para el timeline a medida. |
| **D3** (módulos sueltos) | 7.x | Base de visx; futuro grafo de influencia (P6) | Para el grafo de redes a futuro evaluar `react-flow`/`sigma.js`; fuera de Milestone 1. |

### Background jobs / orquestación

| Tool | Purpose | Notes |
|------|---------|-------|
| **pg_cron** | Scheduler de ingesta | Programa la invocación de Edge Functions (vía pg_net) o ejecuta SQL. Recomendado: ≤8 jobs concurrentes, ≤10 min por job. |
| **pgmq** (Supabase Queues) | Cola durable de tareas de scraping | Entrega garantizada exactly-once con visibility window. Patrón: cron encola boletines → worker Edge Function los procesa con rate-limit. Reemplaza BullMQ/Redis sin infra extra. |
| **pg_net** | HTTP async desde Postgres | Necesario para que pg_cron invoque Edge Functions. |
| **GitHub Actions** | Scheduler de respaldo para jobs largos | Para crawls grandes que excedan los límites de Edge Functions (CPU/tiempo) o el snapshot completo inicial; corre Deno en CI con rate-limit. |

## Installation

# Conectores / Edge Functions (Deno — sin install, imports directos):

#   import * as cheerio from "npm:cheerio@1.2.0";

#   import { XMLParser } from "npm:fast-xml-parser@5";

#   import OpenAI from "npm:openai@5";

#   import { GoogleGenAI } from "npm:@google/genai";

#   import { DOMParser } from "jsr:@b-fuze/deno-dom";  # fallback

#   import { z } from "npm:zod";

#   import { S3Client } from "npm:@aws-sdk/client-s3@3";

# Frontend (Next.js)

# Postgres (SQL, una vez)

#   create extension if not exists vector;     -- pgvector 0.8.x

#   create extension if not exists pg_cron;

#   create extension if not exists pg_net;

#   create extension if not exists pgmq;

## Profundización por área (las 6 preguntas)

### 1. Scraping en TS/Deno por tipo de fuente

| Fuente | Tipo | Estrategia y librería | Confianza |
|--------|------|----------------------|-----------|
| **(a) Cámara `doGet.asmx`** | Web Service JSON ASP.NET | `fetch` directo → `await res.json()`. Devuelve `{"result":true,"data":[...]}`. Validar con **zod**. Es el camino **preferente** (sin HTML). Cuidado: voto individual NO viene (`Votos`=null). | HIGH |
| **(b) Cámara `citaciones_semana.aspx` / búsqueda de proyectos** | HTML ASP.NET WebForms con `__VIEWSTATE` | Patrón de **dos pasos**: (1) GET de la página, parsear con **cheerio** los hidden inputs `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`; (2) POST `application/x-www-form-urlencoded` reenviando esos tokens + `__EVENTTARGET`/`__EVENTARGUMENT` + campos del form. Mantener cookies de sesión entre GET y POST. Re-extraer los tokens en cada respuesta (cambian por postback). | HIGH |
| **(c) Senado `wspublico/tramitacion.php` y `votaciones.php`** | XML | `fetch` → texto → **fast-xml-parser** (`XMLParser`, `ignoreAttributes:false` si hay atributos). Mapear a modelo `Proyecto`/`Votacion`. Validar con zod. | HIGH |
| **(c') BCN/LeyChile `obtxml?opt=7&idNorma=`** | XML de la norma | Igual que (c): fast-xml-parser. Para textos íntegros → guardar crudo en R2, extraer idea matriz/cuerpos legales con LLM. | HIGH |
| **(d) Senado citaciones (portal Next.js)** | SSR `__NEXT_DATA__` | GET de la página → cheerio para extraer `<script id="__NEXT_DATA__">` → `JSON.parse` del contenido. El **`buildId` cambia por deploy**: NO hardcodear rutas `/_next/data/<buildId>/...`; leer `__NEXT_DATA__.buildId` de la página y construir la URL de datos dinámicamente, o simplemente parsear el `__NEXT_DATA__` embebido en la página SSR. | MEDIUM (depende de estabilidad del portal) |

### 2. Rate-limiting, cola, backoff y caché

- **Rate-limit 2–3s obligatorio** (PROJECT.md: el WAF gubernamental bloquea ráfagas). Implementar como delay entre requests dentro del worker, no como concurrencia paralela contra una misma fuente.
- **Cola: pgmq (Supabase Queues)**, NO BullMQ. BullMQ requiere Redis + un proceso Node persistente (Railway/VM) — infra extra que contradice "todo en Supabase". pgmq da entrega garantizada exactly-once con visibility window dentro de Postgres.
- **Patrón:** `pg_cron` encola boletines/tareas en pgmq → Edge Function "worker" desencola en lotes pequeños, respeta el delay 2–3s, y devuelve mensajes con backoff (visibility timeout) ante fallos.
- **Backoff:** exponencial con jitter sobre 429/5xx; aprovechar el visibility timeout de pgmq para reintentos diferidos.
- **Caché diaria:** snapshot crudo en R2 con clave versionada (`fuente/fecha/hash`) → si ya existe el snapshot del día, no re-scrapear (PROJECT.md: "caché diaria", "snapshots versionados"). R2 es la caché de respuestas además del archivo histórico.

### 3. pgvector en Supabase

| Decisión | Recomendación | Por qué | Confianza |
|----------|---------------|---------|-----------|
| **Índice** | **HNSW** | Default 2026 de Supabase: más rápido en lecturas, robusto ante datos cambiantes, sin fase de entrenamiento, sin requerir datos previos. IVFFlat solo tendría sentido en cargas insert-heavy (>100K writes/hora), que no es el caso. | HIGH |
| **Dimensiones del embedding** | **768** (truncado MRL de `gemini-embedding-001`) | Gemini emite 3072 por defecto pero soporta Matryoshka: 768 da ~25% del almacenamiento con solo ~0.26% de pérdida de calidad. 768 mantiene el índice barato en el plan Pro. Configurar `outputDimensionality: 768` en el SDK. | HIGH |
| **Tipo de columna** | `vector(768)` (halfvec opcional) | A 768 dims, `vector` (float32) basta. `halfvec` reduce a la mitad el almacenamiento y es obligatorio para indexar >2000 dims — no necesario a 768, pero disponible si se sube a 1536/3072. | HIGH |
| **Versionado del modelo** | Guardar `embedding_model` + `embedding_dims` + `embedding_version` por fila | Permite re-embeddizar incrementalmente cuando cambie el modelo (p.ej. Gemini Embedding 2) sin perder trazabilidad. Crítico para un proyecto que vive años. | HIGH |
| **Distancia** | Cosine (`vector_cosine_ops`) | Estándar para embeddings de texto normalizados; coincide con cómo Gemini produce los vectores. | HIGH |

### 4. Integración LLM por SDK (capa enchufable)

- **Un solo SDK: `openai` (npm:openai@5)** apuntado por `baseURL` a cada proveedor OpenAI-compatible. Esto materializa la interfaz `LLMProvider` enchufable con código mínimo.
- **Salida estructurada — ADVERTENCIA CRÍTICA:**
- **Prompt caching:**
- **Gemini embeddings** van por su SDK propio (`@google/genai`), no por el SDK OpenAI → la interfaz `EmbeddingProvider` es separada de `LLMProvider` (ya contemplado en PROJECT.md).

### 5. Next.js — versión, dónde corren las llamadas, visualización

- **Next.js 16, App Router.** Server Components por defecto.
- **Todas las llamadas a fuentes externas server-only** (Server Components, Route Handlers o Server Actions) — nunca desde el navegador. Esto resuelve el CORS del WAF gubernamental (PROJECT.md) y mantiene las API keys fuera del cliente. En la práctica, el frontend lee de Supabase (datos ya ingeridos), y la ingesta vive en Edge Functions/jobs; el frontend casi no toca las fuentes directamente.
- **Timeline de tramitación:** **visx** (primitivas D3+React, SSR-friendly) para el timeline a medida cruzando ambas cámaras. **Recharts** para gráficos estándar (votaciones, frescura).
- **Grafo de influencia (P6, fuera de Milestone 1):** evaluar `react-flow` o `sigma.js` cuando llegue; no decidir aún.

### 6. Orquestación de ingesta — Edge Functions vs jobs externos

- **Por defecto: Edge Functions + pg_cron + pgmq** (todo en Supabase). Para ingesta incremental diaria (la mayoría del trabajo): cron dispara, worker desencola y scrapea con rate-limit.
- **Límites de Edge Functions:** tiempo/CPU acotados (jobs ≤10 min recomendado, ≤8 concurrentes). Para crawls grandes (snapshot inicial completo, re-embeddizado masivo) usar **GitHub Actions** corriendo Deno con el mismo código de conectores y el mismo rate-limit. Es el "escape hatch" para trabajos largos.
- **Regla:** lo recurrente y acotado → Edge Functions; lo masivo/largo → GitHub Actions. Mismo código de conector en ambos (TS/Deno).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pgmq (Supabase Queues) | BullMQ + Redis | Solo si se externaliza el cómputo a un servicio Node persistente; añade Redis e infra — evitar mientras todo viva en Supabase. |
| cheerio | deno_dom (`@b-fuze/deno-dom`) | HTML tan mal formado que cheerio tropieza, o cuando se necesita un DOM W3C real. |
| fast-xml-parser | deno_dom / DOMParser para XML | XML con namespaces complejos o necesidad de XPath; el XML del Senado/BCN es estructurado y plano → fast-xml-parser basta y es más rápido. |
| visx | D3 puro / Highcharts Gantt / react-calendar-timeline | react-calendar-timeline si se quiere timeline de recursos llave-en-mano; Highcharts (licencia) si se necesita Gantt premium. visx da control total sin licencia. |
| HNSW | IVFFlat | Cargas insert-heavy >100K writes/hora con presupuesto de memoria ajustado — no es el caso. |
| 768 dims (MRL) | 1536 / 3072 dims | Si benchmarks sobre el golden set muestran pérdida de recall relevante en "proyectos similares"; subir a 1536 (+halfvec) antes que a 3072. |
| openai SDK (multi-provider por baseURL) | SDK propio de cada proveedor | Solo si un proveedor expone features que su endpoint OpenAI-compat no cubre (p.ej. tool calling con quirks). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`response_format: json_schema` asumido universal** | MiniMax M2/M2.5 NO lo soporta vía OpenAI-compat; DeepSeek solo da `json_object` (no schema estricto). Romperá la adjudicación de identidad si se asume. | Tool calling o prompt-forzado + **validación zod** por proveedor. |
| **Puppeteer / navegador headless para WebForms** | Pesado, frágil, caro en Edge Functions; el flujo `__VIEWSTATE` GET→POST con fetch+cheerio es suficiente y mucho más liviano. | fetch + cheerio (patrón de 2 pasos). |
| **BullMQ + Redis en Milestone 1** | Infra adicional (Redis + proceso Node persistente) que contradice "todo en Supabase". | pgmq + pg_cron + Edge Functions. |
| **Hardcodear el `buildId` del portal Next.js del Senado** | Cambia en cada deploy → rutas `/_next/data/<buildId>` rompen silenciosamente. | Leer `__NEXT_DATA__.buildId` de la página SSR en cada corrida. |
| **Llamar fuentes gubernamentales desde el navegador (Client Components)** | CORS del WAF + expone API keys + ráfagas bloqueadas. | Server-only: Edge Functions/Route Handlers/jobs. |
| **Pages Router de Next.js** | En modo mantenimiento; App Router es el camino soportado. | App Router (Next.js 16). |
| **IVFFlat por defecto** | Requiere entrenamiento sobre datos previos y degrada con datos cambiantes. | HNSW. |
| **`obtenerinfoley` de BCN** | Obsoleto (404, ver PROJECT.md). | `obtxml?opt=7&idNorma=`. |

## Stack Patterns by Variant

- Subir embeddings de 768 → 1536 dims con tipo `halfvec(1536)` + índice HNSW.
- Porque MRL permite subir sin re-arquitectura; halfvec contiene el costo de almacenamiento.
- Usar tool calling (function calling) de MiniMax para forzar estructura, con zod como compuerta de validación y reintento.
- Porque `response_format` no está disponible; el tool calling sí impone forma.
- Correr el mismo conector TS en GitHub Actions (cron) con rate-limit 2–3s.
- Porque CI no tiene el límite de 10 min/job y permite checkpoints.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16 | React 19.2 | React Compiler 1.0 estable, Turbopack default. |
| pgvector 0.8.x | Postgres 15+ (Supabase) | HNSW + halfvec disponibles. |
| openai@5 (SDK) | Deno 2.x | `import OpenAI from "npm:openai@5"`; `baseURL` para DeepSeek/MiniMax. |
| cheerio 1.2.0 | Deno 2.x | `npm:cheerio@1.2.0`; usa parse5/htmlparser2 10.x internamente. |
| fast-xml-parser 5.x | Deno 2.x | `npm:fast-xml-parser@5`; v6 aún experimental — quedarse en 5.x. |
| @aws-sdk/client-s3 v3 | Cloudflare R2 | R2 = API S3-compatible; configurar endpoint R2 + credenciales. |

## Sources

- `/websites/jsr_io_b-fuze_deno-dom` (Context7) — deno_dom como parser HTML DOM en Deno — HIGH
- [cheerio — npm](https://www.npmjs.com/package/cheerio) / [cheerio.js.org](https://cheerio.js.org/) — v1.2.0, Deno via `npm:`, htmlparser2 10.x — HIGH
- [fast-xml-parser — npm](https://www.npmjs.com/package/fast-xml-parser) / [GitHub releases](https://github.com/NaturalIntelligence/fast-xml-parser/releases) — v5.9.x, soporte Deno, v6 experimental — HIGH
- [Vector indexes — Supabase Docs](https://supabase.com/docs/guides/ai/vector-indexes) / [HNSW](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes) — HNSW default 2026, halfvec — HIGH
- [Embeddings — Gemini API](https://ai.google.dev/gemini-api/docs/embeddings) / [Gemini Embedding GA — Google Developers Blog](https://developers.googleblog.com/gemini-embedding-available-gemini-api/) — `gemini-embedding-001`, 3072 default, MRL 768/1536/3072 — HIGH
- [JSON Output — DeepSeek API Docs](https://api-docs.deepseek.com/guides/json_mode) — `json_object` mode (no schema estricto), prompt caching automático, modelos V4 — MEDIUM/HIGH
- [MiniMax-M2.5 issue #4: response_format support](https://github.com/MiniMax-AI/MiniMax-M2.5/issues/4) / [OpenAI SDK — MiniMax API Docs](https://platform.minimax.io/docs/api-reference/text-openai-api) — MiniMax NO soporta `response_format` vía OpenAI-compat; usar tool calling — MEDIUM
- [openai — npm](https://www.npmjs.com/package/openai) / [openai-node GitHub](https://github.com/openai/openai-node) — SDK v5, `baseURL`, import `npm:openai` en Deno — HIGH
- [Next.js 16 — nextjs.org/blog](https://nextjs.org/blog/next-16) / [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — App Router estable, React 19.2, Server Components default — HIGH
- [Supabase Queues — Docs](https://supabase.com/docs/guides/queues) / [PGMQ](https://supabase.com/docs/guides/queues/pgmq) / [Supabase Cron](https://supabase.com/docs/guides/cron) — pgmq + pg_cron + Edge Functions worker pattern — HIGH
- [Scheduling Edge Functions — Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net invoca Edge Functions; ≤8 jobs, ≤10 min — HIGH
- [Top timeline components 2026 — DEV](https://dev.to/lenormor/top-7-timeline-visualization-components-for-modern-web-apps-in-2026-420l) / [LogRocket React chart libraries 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/) — visx/Recharts/react-calendar-timeline — MEDIUM
- [How to scrape ViewState — HackerNoon/Zyte](https://medium.com/hackernoon/how-to-scrape-websites-based-on-viewstates-using-scrapy-39feb9445755) / [odetocode ViewState scraping](https://odetocode.com/articles/162.aspx) — patrón GET→parse `__VIEWSTATE`→POST — HIGH (patrón), aplicado a TS/cheerio

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

### Ingesta y Cron (regla arquitectónica — LOCKED)

1. **Ingesta en DOS ETAPAS, siempre separadas y re-ejecutables independientemente:**
   - **Etapa 1 — Fuentes → R2 (crudo):** todo lo descargado de una fuente se persiste PRIMERO como crudo inmutable en R2, content-addressed (`fuente/recurso/fecha/sha256.ext`, PUT `If-None-Match: *`; 412 = ya existía = éxito idempotente).
   - **Etapa 2 — R2 → Supabase:** la carga/parseo a Supabase lee del crudo en R2, NUNCA de la fuente. Re-ingestar a Supabase (error, cambio de schema, re-embed) se hace SIEMPRE desde R2 — no se vuelve a molestar al servidor de la fuente. R2 = verdad cruda versionada; Supabase = derivado reconstruible.
2. **Hash-check ANTES de descargar:** comprobar si ya está en R2 (sha256) y/o `ETag`/`If-None-Match`/`If-Modified-Since`; si no cambió, NO re-descargar (salir temprano cuando no hay novedades).
3. **Respeto al servidor:** rate-limit 2–3s/host, User-Agent identificatorio, robots.txt, caché diaria. Nunca ráfagas.
4. **Backfill masivo = LOCAL** (operador), NO GitHub Actions (minimizar minutos). Idempotente/reanudable.
5. **Cron de novedades = diario L–V**, minimizando minutos: lotes acotados incrementales, solo novedades, hash-check primero. Frecuencia exacta TBD. MONEY/SERVEL fuera del cron mientras gated.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
