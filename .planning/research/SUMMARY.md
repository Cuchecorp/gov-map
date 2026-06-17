# Project Research Summary

**Project:** Observatorio del Congreso 360
**Domain:** Civic-tech de transparencia legislativa - scraping multi-fuente gubernamental + LLM/embeddings + busqueda semantica
**Researched:** 2026-06-17
**Confidence:** HIGH

## Executive Summary

El Observatorio del Congreso 360 es una plataforma civic-tech que ingesta datos publicos de multiples fuentes gubernamentales chilenas (Camara, Senado, BCN), los normaliza, los enriquece con LLM y los expone con busqueda semantica en lenguaje natural. El enfoque canonico es una tuberia con procedencia: crudo inmutable en R2, proyeccion normalizada en Postgres, orquestacion nativa via pg_cron + pgmq + pg_net + Edge Functions, y un subsistema de identidad aislado con compuerta humana.

Dos hallazgos tecnicos son load-bearing: (1) MiniMax NO soporta response_format universal via el endpoint OpenAI-compatible -- la interfaz LLMProvider debe implementar salida estructurada por-proveedor (tool calling para MiniMax, json_object + zod para DeepSeek); (2) Apache AGE no esta disponible en Supabase managed -- el grafo (P6) se implementa mediante recursive CTEs sobre el modelo relacional grafo-amigable de M1.

Los dos riesgos existenciales son de diseno: la reconciliacion de identidad que falla en silencio y la maquina de sospechas (framing que insinua causalidad). El orden de build es: Fundaciones -> Tabla maestra Parlamentario + Identidad -> P2 Tramitacion (conectores en orden ascendente de fragilidad: JSON -> XML -> WebForms/__VIEWSTATE -> Next.js/__NEXT_DATA__) -> P1 Busqueda semantica.
## Key Findings

### Recommended Stack

El stack base esta fijado por decision del proyecto. La investigacion lo profundiza con versiones verificadas: Deno 2.x, Supabase Postgres 15+ con pgvector 0.8.x (HNSW), Next.js 16 App Router con React 19.2, cheerio 1.2.0 para WebForms HTML, fast-xml-parser 5.x para XML, openai SDK v5 como cliente multi-proveedor via baseURL, @google/genai para embeddings Gemini 768-dim MRL, y zod 3/4 como compuerta de validacion universal.

**Core technologies:**
- **Deno 2.x / Edge Functions**: runtime de ingesta y procesamiento; pgmq + pg_cron como orquestador nativo sin Redis
- **Supabase Postgres 15+ / pgvector 0.8.x**: modelo normalizado + vectores HNSW + auth/RLS; crudo NO va aqui (va a R2)
- **Cloudflare R2**: fuente de verdad inmutable del crudo (append-only, versionado por fecha+hash); Postgres es proyeccion re-derivable
- **Next.js 16 App Router**: SSR con Server Components por defecto; todas las llamadas a fuentes externas server-only (WAF + CORS)
- **openai SDK v5 (multi-provider por baseURL)**: base de LLMProvider enchufable; DeepSeek V4 Flash para volumen, MiniMax M-series para identidad
- **@google/genai (Gemini gemini-embedding-001)**: embeddings 768-dim (MRL, outputDimensionality:768); versionar embedding_model/embedding_dims por fila
- **cheerio 1.2.0**: parsing HTML WebForms -- extraccion de __VIEWSTATE/__EVENTVALIDATION para flujo GET->POST de Camara
- **fast-xml-parser 5.x**: parsing XML Senado/BCN -- sin dependencias C, soporta Deno via npm:
- **zod 3/4**: validacion de esquema de crudo en ingesta Y validacion de salida JSON de LLMs cuando response_format no es confiable

**Advertencia critica (load-bearing):** MiniMax M2/M2.5 NO soporta response_format via endpoint OpenAI-compatible. La interfaz LLMProvider debe gestionar salida estructurada per-proveedor: tool calling para MiniMax, json_object + zod para DeepSeek. No asumir response_format universal.
### Expected Features

**Must have (table stakes para M1):**
- Framework de conectores con procedencia (fuente + fecha + enlace + snapshot) -- base de toda la trazabilidad
- Busqueda de proyectos (semantica NL + fallback lexico por boletin/titulo)
- Ficha de proyecto con estado/etapa actual
- Timeline de tramitacion cruzando Camara + Senado por boletin
- Resultados de votacion agregados (voto individual NO esta en doGet.asmx; bloquea P3/M2, no M1)
- Indicador de frescura por fuente
- Enlace a fuente original en cada dato
- Fichas estructuradas por idea matriz + cuerpos legales (extraccion LLM)
- Busqueda semantica en lenguaje natural (embeddings Gemini + pgvector HNSW)
- Proyectos similares por vecindad semantica -- alto valor, costo incremental minimo sobre los embeddings

**Defer (post-M1):**
- Alertas/suscripciones -- requiere auth, jobs de notificacion, email
- Voto individual por diputado -- opendata.camara.cl sin validar; bloquea P3/M2
- Comparador de proyectos
- Perfil 360 parlamentario, lobby+patrimonio, SERVEL+ChileCompra, grafo de influencia (M2+)

**Anti-features explicitas (nunca construir):**
- Afirmaciones de causalidad/intencion -- riesgo existencial 2, exposicion legal (injuria/calumnia)
- Rankings/scorecards morales
- Exposicion publica de RUT y datos de familiares -- Ley 21.719 (vigencia 01/12/2026)
- Conclusiones automaticas de LLM presentadas como hechos sin compuerta de validacion

### Architecture Approach

La arquitectura es una tuberia con procedencia de tres capas: Ingesta (Deno/Edge Functions -> R2 crudo inmutable + Postgres source_snapshot), Procesamiento (normalizacion idempotente -> subsistema de identidad aislado -> extraccion LLM -> embeddings), y Servicio (Edge Functions/PostgREST + Next.js SSR). El principio rector: crudo en R2 es la fuente de verdad, Postgres es proyeccion derivada y re-construible.

**Major components:**
1. **Connector Framework (Template Method)** -- politica unica de fetch respetuoso, rate-limit serial 2-3s, cache diaria, snapshot R2, drift detection
2. **R2 (crudo inmutable)** -- append-only por fuente/recurso/fecha/hash; procesamiento nunca toca la red externa
3. **Subsistema Identidad (aislado)** -- cascada determinista->LLM(MiniMax)->compuerta->humano->golden set; unico escritor de parlamentario_id; audit log inmutable
4. **LLMProvider / EmbeddingProvider (enchufables)** -- interfaz + router por criticidad/sensibilidad; salida estructurada per-proveedor; Gemini solo texto legislativo
5. **Orquestacion nativa (pgmq + pg_cron + pg_net)** -- cola durable exactly-once, patron chunk/lote para respetar limite ~400s Edge Functions
6. **API + Next.js SSR** -- PostgREST/RPC para fichas y busqueda; Server Components por defecto; frontend nunca llama fuentes externas

**Decision critica verificada:** Apache AGE NO esta disponible en Supabase managed. El grafo (P6) se implementa con recursive CTEs en M1. Decision de plataforma de grafo diferida a P6.

### Critical Pitfalls

1. **Reconciliacion de identidad silenciosa (EXISTENCIAL 1)** -- pipeline de cascada: determinista (PARLID/RUT) -> candidatos -> LLM critico (MiniMax, tier sin-entrenamiento) -> umbral conservador -> confirmacion humana -> golden set -> audit log. Nunca mostrar dato con identidad en estado candidato. Golden set como test de regresion.

2. **Maquina de sospechas -- framing acusatorio (EXISTENCIAL 2)** -- regla rectora: trazabilidad sobre interpretacion. Prohibir scores de riesgo, alertas de conflicto, aristas valoradas, adyacencia visual sugestiva y lenguaje causal. Pasada de asesoria legal antes del lanzamiento publico (bloqueante).

3. **WAF gubernamental bloquea rafagas** -- rate-limiter serial 2-3s en el framework comun, cola serial pgmq, User-Agent identificatorio, backoff exponencial ante 429/403, cache diaria.

4. **MiniMax sin response_format universal** -- LLMProvider con salida estructurada per-proveedor desde Fundaciones: tool calling para MiniMax, json_object + zod para DeepSeek.

5. **Embeddings sin versionado de modelo** -- guardar embedding_model, embedding_dims y embedding_version por fila desde P1. Plan de re-embedding idempotente y reanudable.

6. **Datos personales / Ley 21.719** -- vigencia plena 01/12/2026. Gemini SOLO embeddings de texto legislativo (nunca nombres+RUT). Adjudicacion de identidad -> MiniMax tier sin-entrenamiento + DPA. Pasada legal antes de release es bloqueante.
## Implications for Roadmap

### Phase 1: Fundaciones
**Rationale:** Bloquea todo lo demas. Los dos riesgos existenciales se sellan aqui. Sin framework de conectores no hay ingesta respetuosa; sin esquema/R2 no hay donde escribir; sin interfaces de provider no hay LLM enchufable; sin tabla maestra sembrada no hay identidad.
**Delivers:** Framework de conectores (rate-limit, cache, snapshot R2, drift, schema validation); esquema Postgres + R2; interfaces LLMProvider/EmbeddingProvider con router por criticidad; tabla maestra Parlamentario sembrada con revision humana; pipeline de identidad minimo (determinista + cola humana); politica de datos LLM documentada; respaldo externo de identidades; Supabase Pro como baseline.
**Addresses:** Framework de conectores con procedencia, indicador de frescura, enlace a fuente, tabla maestra Parlamentario
**Avoids:** Riesgo existencial 1 (identidad), riesgo existencial 2 (guardarrail de framing), WAF (rate-limiter), Ley 21.719 (politica LLM), Supabase free en produccion

### Phase 2: Tabla Maestra Parlamentario + Identidad completa
**Rationale:** Voto necesita parlamentario_id reconciliado antes de que P2 pueda atribuir votos. Enchufa la adjudicacion LLM (MiniMax) y madura el golden set con homonimos conocidos. Puede solaparse con Fundaciones si la maestra se siembra con datos deterministicos (PARLID/RUT de senadores_vigentes.php) desde el inicio.
**Delivers:** Pipeline de identidad completo (determinista -> LLM MiniMax -> compuerta -> revision humana -> golden set -> audit); prueba de regresion sobre golden set automatizada.
**Uses:** MiniMax adapter (tool calling para salida estructurada), LLMProvider router criticidad=true/sensitive=true, zod como compuerta
**Implements:** Subsistema Identidad aislado (unico escritor de parlamentario_id)

### Phase 3: P2 -- Tramitacion
**Rationale:** Con maestra e identidad operativas se pueden atribuir votos. Conectores en orden ascendente de fragilidad: JSON de doGet.asmx -> XML de wspublico -> WebForms __VIEWSTATE de Camara (cheerio GET->POST) -> portal Next.js del Senado __NEXT_DATA__/buildId dinamico. Timeline cross-camara vive en RPC Postgres (recursive CTE por boletin).
**Delivers:** Conectores Camara (doGet.asmx JSON + citaciones.aspx WebForms) y Senado (wspublico XML + portal Next.js __NEXT_DATA__); modelos Proyecto + Votacion + Tramitacion; voto atribuido via identity.reconcile(); timeline cross-camara; frontend: ficha de proyecto + timeline + indicador de frescura.
**Uses:** cheerio (WebForms), fast-xml-parser (XML), autodeteccion buildId (portal Senado), pgmq
**Avoids:** Hardcoding de buildId del Senado, __VIEWSTATE ignorado, llamadas desde el navegador

### Phase 4: P1 -- Busqueda semantica + fichas estructuradas
**Rationale:** Depende de proyectos ya cargados (P2). Cadena lineal: textos integros (R2) -> extraccion LLM (DeepSeek, prompt-cache) -> embeddings (Gemini 768-dim) -> pgvector HNSW -> buscador NL -> proyectos similares (kNN, casi gratis). Extraccion de idea matriz es el cuello de botella de calidad de todo P1.
**Delivers:** Descarga de textos integros (Senado + BCN obtxml -> R2); extraccion idea matriz/cuerpos legales (DeepSeek V4 Flash, prompt-cache); embeddings Gemini gemini-embedding-001 768-dim con columnas embedding_model/embedding_dims/embedding_version; indice HNSW; buscador NL con fichas estructuradas y trazabilidad; proyectos similares por kNN pgvector.
**Uses:** @google/genai (MRL outputDimensionality:768), openai SDK DeepSeek baseURL, pgvector HNSW, zod
**Implements:** EmbeddingProvider Gemini, Extraccion LLM con prompt-cache, plan de re-embedding reanudable

### Phase Ordering Rationale

- Fundaciones antes que todo: riesgos existenciales deben sellarse antes de que exista cualquier dato publico.
- Identidad antes de P2: Voto.parlamentario_id solo puede escribirlo el subsistema de identidad.
- P2 antes de P1: la busqueda semantica embeddea textos de proyectos; sin proyectos cargados no hay corpus.
- Conectores de P2 en orden de fragilidad ascendente (JSON -> XML -> WebForms -> Next.js): validan el framework antes de llegar a los mas fragiles.
- Proyectos similares en P1 (no despues): cae casi gratis una vez existen los embeddings; alto valor percibido, costo incremental minimo.
- AGE/grafo diferido: recursive CTEs son suficientes para M1; decision de plataforma de grafo se toma cuando los datos existan (P6, M2+).
- Alertas diferidas: requieren auth completa y superficie nueva no necesaria para validar el producto.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3 (P2 -- Tramitacion):** conectores WebForms y Next.js son fragiles. Hacer spike de validacion end-to-end antes de planificar. Estabilidad del portal Next.js del Senado es MEDIUM.
- **Phase 3 (voto individual):** opendata.camara.cl sin validar. Requiere spike antes de planificar P3/M2. No bloquea M1.
- **Phase 4 (calidad de embeddings):** calidad de extraccion LLM sobre texto legal en espanol es el cuello de botella. Construir golden set y benchmarkear antes de comprometer el prompt a produccion.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Fundaciones):** pgmq + pg_cron + pg_net, Connector Framework, R2 via AWS S3 SDK v3 -- patrones bien documentados, implementacion directa.
- **Phase 2 (Identidad):** pipeline especificado en detalle en ARCHITECTURE.md y PROJECT.md; tabla maestra sembrada manualmente.
- **Phase 4 embeddings (mecanica):** HNSW + Gemini 768-dim + pgvector es el patron canonico de Supabase Automatic Embeddings.
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versiones verificadas contra docs oficiales. Advertencia MiniMax confirmada en issues del repo oficial. |
| Features | HIGH | Table stakes y anti-features corroborados con GovTrack, Open States, TheyWorkForYou, Congreso Visible y PROJECT.md. Diferenciadores semanticos MEDIUM para produccion LatAm. |
| Architecture | HIGH | AGE ausente en Supabase managed confirmado. Limite ~400s Edge Functions verificado en docs. |
| Pitfalls | HIGH | Riesgos existenciales validados con fuentes primarias. Detalles tecnicos WebForms/buildId/MiniMax verificados. |

**Overall confidence:** HIGH

### Gaps to Address

- **opendata.camara.cl (voto individual):** fuente sin validar. Requiere spike antes de planificar P3/M2. No bloquea M1.
- **Calidad de extraccion LLM sobre texto legal en espanol:** sin benchmark propio aun. Construir golden set en P1 y medir antes de comprometer el prompt a escala.
- **Umbral de confianza del pipeline de identidad:** valor correcto depende del golden set real. Iniciar con umbral conservador alto.
- **Estabilidad del portal Next.js del Senado:** frecuencia de deploys no medida en produccion.
- **Decision de plataforma de grafo (P6/M2+):** AGE no disponible en Supabase managed. Opciones: postgres_fdw + segunda DB AGE, migrar a EDB/Azure, o self-hosted. Diferir hasta que el modelo este poblado.

## Sources

### Primary (HIGH confidence)

- .planning/PROJECT.md + Documento Maestro de Implementacion v2.0 -- endpoints validados en vivo al 17/06/2026
- https://supabase.com/docs/guides/functions/background-tasks -- limite ~400s confirmado
- https://supabase.com/docs/guides/ai/automatic-embeddings -- patron pgmq
- https://supabase.com/docs/guides/queues / https://supabase.com/docs/guides/cron
- https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes
- https://ai.google.dev/gemini-api/docs/embeddings
- https://github.com/MiniMax-AI/MiniMax-M2.5/issues/4 -- MiniMax NO soporta response_format via OpenAI-compat
- https://api-docs.deepseek.com/guides/json_mode -- json_object mode, prompt caching automatico
- https://github.com/orgs/supabase/discussions/40285 -- AGE ausente en Supabase managed confirmado
- https://www.bcn.cl/leychile/navegar?idNorma=1209272 -- Ley 21.719 texto oficial
- https://wikiguias.digital.gob.cl/datos-personales/guia-practica-implementacion-nueva-ley-datos-personales
- https://supabase.com/pricing
- https://nextjs.org/blog/next-16

### Secondary (MEDIUM confidence)

- https://www.govtrack.us/about, https://open.pluralpolicy.com/, https://www.mysociety.org/2025/10/23/theyworkforyou-update-a-richer-view-of-parliament/, https://congresovisible.uniandes.edu.co/ -- benchmarks civic-tech
- https://link.springer.com/article/10.1007/s10506-025-09482-6 -- busqueda semantica legislativa LegisSearch
- https://arxiv.org/pdf/2109.06527 -- proyectos similares por embeddings
- https://gdotv.com/blog/running-apache-age-docker-cloud/ -- opciones para AGE fuera de Supabase managed

### Tertiary (LOW confidence, necesitan validacion)

- opendata.camara.cl -- voto individual por diputado; sin validar; bloquea P3/M2
- Estabilidad del portal Next.js del Senado -- frecuencia de deploys no medida en produccion

---
*Research completed: 2026-06-17*
*Ready for roadmap: yes*