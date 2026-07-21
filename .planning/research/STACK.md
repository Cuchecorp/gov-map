# Stack Research — v9.0 (Robustez de productos estrella + seguridad)

**Domain:** Retrieval híbrido de PL + deep-links de validación + bio/partido oficial + citaciones sala/comisiones (ambas cámaras) + validación de seguridad — sobre stack ya validado (Next.js 16 / Supabase PG15 + pgvector 0.8 / TS-Deno / R2 / service_role + allowlist)
**Researched:** 2026-07-21
**Confidence:** HIGH (extensiones y URL patterns verificados; SPARQL BCN MEDIUM)

> **Regla de alcance:** NO re-investigar lo ya validado (pgvector HNSW 768-dim, RPC `match_proyectos`, FTS `buscar_citaciones` mig 0032, conectores Cámara/Senado/BCN, dos-etapas fuente→R2→Supabase, sitio lee con service_role + allowlist de RPCs — anon muerta). Todo lo de abajo es SÓLO lo nuevo. **Cero librerías nuevas de runtime** para lo central: el retrieval híbrido es **100% extensiones de Postgres + SQL** dentro del modelo `service_role + allowlist` existente. Los deep-links y bio/citaciones reutilizan `fetch`/`cheerio`/`fast-xml-parser` que ya están en el repo.

---

## 1. Retrieval híbrido de proyectos de ley (el núcleo de v9.0)

Hoy la búsqueda es **semántica-sólo** → falla con la palabra LITERAL del título (inaceptable en el producto estrella). La solución es **Postgres nativo**: FTS spanish + `unaccent` + `pg_trgm`, `tsvector` con pesos, y **fusión con pgvector vía Reciprocal Rank Fusion (RRF)** — el patrón oficial de Supabase. No entra ninguna dependencia de aplicación.

### Extensiones de Postgres (todas disponibles en Supabase, `create extension`)

| Extensión | Versión (Supabase PG15) | Propósito | Confianza |
|-----------|--------------------------|-----------|-----------|
| `unaccent` | built-in (contrib) | Quitar diacríticos → "citacion" matchea "citación". Base de FTS y trgm accent-insensitive. | HIGH |
| `pg_trgm` | built-in (contrib) | `similarity()`, `word_similarity()`, operadores `%` / `<->` / `<%`; índices `gin_trgm_ops` / `gist_trgm_ops`. Cubre typos y match parcial del título/nombre. | HIGH |
| `vector` (pgvector) | **0.8.2** (feb-2026; fija CVE-2026-3172) | Ya en uso (semántica 768-dim, HNSW). v9.0 sólo lo referencia en la RPC híbrida. | HIGH |
| `fuzzystrmatch` | built-in (contrib) | `levenshtein()`, `metaphone` — OPCIONAL, sólo si `pg_trgm` no basta para apellidos. No recomendado de entrada. | HIGH |
| `rum` | disponible en Supabase (Search & Indexing) | Índice invertido mejorado sobre GIN: guarda posiciones → `ts_rank_cd` más rápido y permite ordenar por rank dentro del índice. **NO adoptar en v9.0**: índice más grande y escrituras más lentas; el corpus (~3.657 PL) es chico y GIN basta. Anotado como escape hatch. | MEDIUM |

> `unaccent` **no es IMMUTABLE** por defecto → para indexar hay que envolverlo:
> ```sql
> create extension if not exists unaccent;
> create extension if not exists pg_trgm;
> create or replace function public.f_unaccent(text) returns text
>   language sql immutable parallel safe strict
>   as $$ select public.unaccent('public.unaccent', $1) $$;
> ```

### Text search config spanish accent-insensitive (una vez)

```sql
create text search configuration public.es_unaccent ( copy = spanish );
alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word
  with public.unaccent, spanish_stem;
```

### tsvector con pesos (A título / B idea matriz / C normas)

`setweight` A > B > C materializa la prioridad del producto (el título literal debe ganar). Generado + indexado:

```sql
alter table proyecto add column fts tsvector
  generated always as (
    setweight(to_tsvector('public.es_unaccent', coalesce(titulo,'')),        'A') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(idea_matriz,'')),   'B') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(normas_afectadas,'')),'C')
  ) stored;
create index idx_proyecto_fts on proyecto using gin (fts);
-- trgm para título/nombre (typos + substrings, sin stemming):
create index idx_proyecto_titulo_trgm
  on proyecto using gin (f_unaccent(titulo) gin_trgm_ops);
```

**Coste de índices:** GIN sobre `fts` y GIN trgm son baratos a esta escala (~3.657 filas; MB, no GB). El GIN trgm es el más pesado de los dos pero irrelevante aquí. Sin impacto en el plan Pro.

### Número de boletín — normalización (regla explícita del milestone)

El boletín es la llave de cruce más fuerte y el caso "obvio" que hoy falla. Tratarlo **fuera del FTS**, como short-circuit exacto:

- Normalizar la query: si matchea `^\s*(\d{3,6})(-\d{1,2})?\s*$` → es un boletín.
- `"16733-07"` debe hacer match exacto; `"16733"` debe traer `16733-07` (mismo número, cualquier sufijo de materia).
- SQL: `where boletin = :q or boletin like :num || '-%'` (indexar `boletin` con btree; opcional columna generada `boletin_num int`).
- **Este match exacto va PRIMERO** y con score máximo, antes de FTS/semántica. Un ciudadano que pega un boletín nunca debe recibir "sin resultados".

### Fusión: Reciprocal Rank Fusion (patrón oficial Supabase) — VERIFICADO

Fuente: `supabase.com/docs/guides/ai/hybrid-search` (Context7 `/llmstxt/supabase_llms-full_txt`). Combina dos CTEs (FTS + semántica) con `full outer join` y suma de rangos recíprocos. Fórmula:

```
score = coalesce(1.0/(rrf_k + fts.rank_ix),      0.0) * full_text_weight
      + coalesce(1.0/(rrf_k + semantic.rank_ix), 0.0) * semantic_weight
```

Detalles del patrón oficial a respetar:
- **`websearch_to_tsquery`** (no `plainto_tsquery`): entiende comillas y operadores del usuario, y **no lanza error** con sintaxis suelta (`plainto_` sí puede). Recomendado para input ciudadano.
- **`ts_rank_cd`** dentro del CTE FTS (cover density; premia proximidad de términos). No es indexable, pero sólo rankea las filas del `where fts @@ query` (subconjunto chico) → sin problema.
- `rrf_k = 50` (default Supabase; suaviza el peso de los primeros puestos). `full_text_weight`/`semantic_weight` como parámetros para el SPIKE.
- **RRF usa RANGOS, no scores crudos** → no hay que normalizar distancia coseno vs `ts_rank`. Ésa es la razón de elegir RRF sobre "sumar scores".
- Semántica: mantener el operador y `ops` que YA usa `match_proyectos` (coseno `<=>` / `vector_cosine_ops`). El ejemplo de Supabase usa `<#>`/`vector_ip_ops`; **no cambiar el operador existente** — RRF sólo necesita el orden, no la métrica.

Firma sugerida (nueva RPC en la allowlist, `security definer`, `service_role`):

```sql
create or replace function buscar_proyectos_hibrido(
  query_text text,
  query_embedding vector(768),
  match_count int  default 20,
  full_text_weight float default 1.0,
  semantic_weight  float default 1.0,
  rrf_k int default 50
) returns setof proyecto
language sql stable
as $$
  with full_text as (
    select id, row_number() over (
             order by ts_rank_cd(fts, websearch_to_tsquery('public.es_unaccent', query_text)) desc
           ) as rank_ix
    from proyecto
    where fts @@ websearch_to_tsquery('public.es_unaccent', query_text)
    order by rank_ix limit least(match_count, 30) * 2
  ),
  semantic as (
    select id, row_number() over (order by embedding <=> query_embedding) as rank_ix
    from proyecto
    where embedding is not null
    order by rank_ix limit least(match_count, 30) * 2
  )
  select p.* from full_text
    full outer join semantic on full_text.id = semantic.id
    join proyecto p on p.id = coalesce(full_text.id, semantic.id)
  order by
    coalesce(1.0/(rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
    coalesce(1.0/(rrf_k + semantic.rank_ix), 0.0) * semantic_weight desc
  limit match_count;
$$;
```

> **El boletín exacto NO va en esta RPC** — resuélvelo en la capa de aplicación (o una RPC aparte `buscar_por_boletin`) y antepón sus resultados. Mezclar un match exacto dentro del RRF lo diluye.

### Ranking + filtros client-side (producto 1b)

- **Ranking de negocio** (mensaje del Ejecutivo > moción, recencia): aplicar como `order by` secundario / boost sobre el resultado del híbrido, NO dentro del RRF. Mantenerlo en SQL o en TS post-fetch — es determinista y barato.
- **Filtros client-side** (año, mensaje/moción, partido, archivado/en tramitación): la RPC devuelve un lote (p.ej. top 50) con TODOS los campos de faceta; el filtrado/reordenado ocurre **en el cliente sin re-buscar**. Cero librería nueva (React state). No introducir un motor de búsqueda cliente (Fuse.js/FlexSearch) — el corpus por página es chico y el orden ya viene del servidor.

### SPIKE empírico (lo exige el milestone)

El milestone pide elegir la estrategia por golden queries. Montar 3 candidatas contra el mismo golden set y medir recall@k del "caso obvio":
1. FTS-sólo (pesos A/B/C),
2. semántica-sólo (baseline actual),
3. RRF híbrido (recomendado).
Casi con certeza gana (3), pero el número honesto sale del SPIKE, no de la fe.

---

## 2. Deep-links de validación por boletín (producto 1c) — URLs VERIFICADAS

Cada PL debe ofrecer un link que el ciudadano abre para **verificar en la fuente oficial**. Patrones probados (búsqueda en vivo 2026-07-21):

| Cámara/origen | Patrón de URL | Notas | Confianza |
|---------------|---------------|-------|-----------|
| **Senado** (tramitación) | `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini={BOLETIN}` | `{BOLETIN}` con sufijo (`17441-15`) → ficha directa. **Sin** sufijo (`12616`) → página de "boletines encontrados" (lista). Usar SIEMPRE el boletín completo. | HIGH |
| **Cámara** (tramitación) | `https://www.camara.cl/legislacion/proyectosdeley/tramitacion.aspx?prmID={ID}&prmBOLETIN={BOLETIN}` | Requiere `prmID` (ID interno del proyecto) **además** del boletín. `prmBOLETIN` solo NO garantiza la ficha. El `prmID` ya viene en `doGet.asmx`/`WSLegislativo` → persistirlo por proyecto. | HIGH |
| **BCN LeyChile** (norma final) | `https://www.bcn.cl/leychile/navegar?idNorma={ID}` | Para la ley promulgada (cuando existe). El `idNorma` sale del XML `obtxml` ya ingerido. | MEDIUM |

**Regla de implementación:** guardar `prmID` (Cámara) e `idNorma` (BCN) como columnas del proyecto durante la ingesta que YA corre — no re-scrapear para el link. Fragmentos/anchors (`#...`) en estas páginas ASP.NET/PHP no son estables → NO depender de ellos; el deep-link a nivel de boletín es la unidad verificable estable. El texto del link debe seguir la regla rectora: "Ver en {Senado|Cámara} oficial · fuente · fecha".

---

## 3. Bio oficial + partido de parlamentarios (producto 2d)

Dos fuentes máquina-legibles; usar la de Cámara como primaria para diputados por ser estructurada y ya en el stack, y BCN para la biografía narrativa/histórica y senadores.

| Fuente | Endpoint | Qué entrega | Confianza |
|--------|----------|-------------|-----------|
| **Cámara — WSCamaraDiputados** | `https://opendata.congreso.cl/wscamaradiputados.asmx?op=getDiputados` (también `getDiputados_Vigentes`, `getDiputados_Periodo`) | **Partido incluido**: `Militancia_Actual` (partido vigente con fechas/estado) + `Militancias_Periodos` (histórico), más `Distrito`, `Sexo`, `Fecha_Nacimiento`, `Correo`, `DIPID`. **HTTP GET devuelve XML directo** (sin envelope SOAP) → `fetch` + `fast-xml-parser`, igual patrón que Senado. | HIGH |
| **BCN — Biografías Parlamentarias** | SPARQL endpoint `datos.bcn.cl` (ontología `bcn-biographies` / prefijo `bcnbio:`), ruta web `.../sparql`; ~3.900 congresistas 1811→hoy | Biografía histórica/trayectoria política narrativa. RDF/OWL, `SELECT` SPARQL → JSON. **No hay REST por-ID documentado**; se consulta por SPARQL. Útil para senadores y para la "historia política" cruzable. | MEDIUM |

**Recomendación de fuente de partido:** para **diputados**, `Militancia_Actual` de WSCamaraDiputados (estructurado, autoritativo, ya scrapeable con el toolkit actual). Para **senadores**, cruzar `senadores_vigentes.php` (ya en uso, trae PARLID) con BCN si se necesita partido; la militancia de senadores también aparece en su ficha del portal Senado. Evitar inventar partido por heurística — fail-closed si la fuente no lo trae.

**Integración SPARQL (si se adopta BCN):** cliente = `fetch` con `Content-Type: application/sparql-query` (POST) o query-string (GET), `Accept: application/sparql-results+json`. **Cero librería nueva** — no hace falta un cliente RDF; parsear el JSON de resultados con `JSON.parse`. Guardar el crudo en R2 (dos-etapas LOCKED) igual que las demás fuentes. MEDIUM porque el endpoint exacto y la estabilidad del SPARQL de BCN deben probarse en un SPIKE antes de comprometerlo.

---

## 4. Citaciones COMPLETAS: sala + comisiones, ambas cámaras (producto 2f)

El milestone pide **auditoría de cobertura antes de tocar UI**. Endpoints que existen para sala Y comisiones:

| Cámara | Recurso | Endpoint | Tipo / toolkit | Confianza |
|--------|---------|----------|----------------|-----------|
| **Cámara** | Citaciones semana (sala + comisiones) | `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana={AAAA}-{NN}` | HTML ASP.NET (ya en uso). `prmSemana` = año-semana ISO (`2025-49`). Cubre la agenda semanal. | HIGH |
| **Cámara** | Comisiones vigentes | `wscamaradiputados.asmx?op=getComisiones_Vigentes` (opendata.congreso.cl) | XML vía HTTP GET → `fast-xml-parser`. Catálogo de comisiones (para estructurar). | HIGH |
| **Cámara** | Sesiones (sala) | `getSesiones` / `getSesionDetalle` (mismo WS) | XML. Detalle de sesión de sala. | HIGH |
| **Senado** | Citaciones por comisión / por fecha | `https://tramitacion.senado.cl/appsenado/index.php?mo=comisiones&ac=citacionesComision&tipo_consulta={1\|4}` | App PHP clásica (`tipo_consulta=1` por fecha, `=4` por comisión). HTML → `cheerio`. **Distinto del portal Next.js** — más estable, sin `buildId`. | HIGH |
| **Senado** | Listado de comisiones | `https://tramitacion.senado.cl/appsenado/index.php?mo=comisiones&ac=listado` | HTML → `cheerio`. Catálogo. | HIGH |
| **Senado** | Citaciones (portal actual) | portal Next.js `__NEXT_DATA__` (ya en uso, `buildId` autodetectado) | Mantener como está; el PHP de arriba es respaldo/complemento para comisiones. | MEDIUM |

**Auditoría de cobertura primero:** cruzar lo que hoy se ingiere (`citacion`, `sesion_tabla_item`) contra estos endpoints para cuantificar el gap (sala vs comisiones, Cámara vs Senado) — es un ejercicio de **datos + SQL de conteo**, no de librerías. Nueva superficie estructurada por día con filtros = React state (igual que 1b). Cero dependencia nueva.

---

## 5. Validación de seguridad final (producto 3) — breve, ya hay guards

El repo es **público** y hay lockdown (guard CI PII, anon muerta, service_role + allowlist, headers/CSP Report-Only live desde v8.1). Herramientas actuales a correr como gate:

| Herramienta | Qué valida | Cómo | Confianza |
|-------------|-----------|------|-----------|
| **Supabase Splinter** (database linter / Security Advisor) | RLS deshabilitada, policies laxas, `security definer` views inseguras, funciones expuestas, columnas sensibles. | Dashboard → Advisors, o SQL de `supabase/splinter` en CI. Es EL linter de seguridad oficial de Supabase. | HIGH |
| **`index_advisor`** (extensión Supabase) | Sugiere índices faltantes para las queries nuevas (híbrido/citaciones). | `create extension index_advisor`; complementa, no reemplaza `explain`. | HIGH |
| **`pnpm audit`** | CVEs en dependencias npm del monorepo. | `pnpm audit --prod` en CI; ya hay Dependabot npm apuntado a la raíz (commit c29087a). | HIGH |
| **Secret scanning / push protection** | Claves filtradas en repo público. | GitHub secret scanning + push protection (repo público lo trae); complementa el guard PII propio. | HIGH |
| **CSP** | Endurecer de `Report-Only` a enforcing. | Revisar reportes acumulados; mover a `Content-Security-Policy` enforce cuando el ruido sea 0. Evaluar con Mozilla Observatory / CSP Evaluator (manual). | MEDIUM |
| **pgvector 0.8.2** | CVE-2026-3172 (buffer overflow en build HNSW paralelo). | Confirmar que Supabase corre ≥0.8.2. Acción de verificación, no de código. | HIGH |

No añadir DAST/scanners pesados: el modelo ya es deny-by-default (anon muerta, RPCs allowlisted). El foco es **correr Splinter + audit + confirmar CSP enforce + versión pgvector**, no herramienta nueva.

---

## Installation

```bash
# NADA nuevo en package.json para el núcleo. Todo el retrieval híbrido es SQL/extensiones:

# Postgres (migración nueva, aplicar por psql --db-url como las anteriores):
#   create extension if not exists unaccent;
#   create extension if not exists pg_trgm;
#   -- (opcional seguridad) create extension if not exists index_advisor;
#   -- f_unaccent(), text search config es_unaccent, columnas fts + índices GIN/trgm,
#   -- RPC buscar_proyectos_hibrido() + buscar_por_boletin() → añadir a la allowlist.

# Conectores (Deno) — reusar lo que YA está importado:
#   import * as cheerio from "npm:cheerio@1.2.0";          # HTML Senado PHP / Cámara semana
#   import { XMLParser } from "npm:fast-xml-parser@5";     # WSCamaraDiputados getDiputados (XML)
#   fetch nativo                                            # deep-links, SPARQL BCN, opendata
```

## Alternatives Considered

| Recomendado | Alternativa | Cuándo usar la alternativa |
|-------------|-------------|-----------------------------|
| RRF (rangos) en SQL | Sumar scores normalizados (ts_rank + coseno) | Nunca aquí — normalizar dos métricas distintas es frágil; RRF es el patrón oficial Supabase y usa rangos. |
| GIN sobre tsvector | `rum` index | Sólo si `ts_rank_cd` se vuelve cuello de botella a corpus mucho mayor; hoy overkill (más disco, escrituras lentas). |
| `websearch_to_tsquery` | `plainto_tsquery` / `phraseto_tsquery` | `plainto_` si NO se quiere que el usuario use operadores; pero `websearch_` es más robusto a input libre y no lanza error. |
| `pg_trgm` para fuzzy | `fuzzystrmatch` (levenshtein/metaphone) | Sólo si trgm falla en apellidos compuestos; medir antes de añadir. |
| WSCamaraDiputados para partido de diputados | BCN SPARQL para partido | BCN para biografía narrativa/histórica y senadores; para partido vigente de diputados, el WS es más directo. |
| Filtros client-side (React state) | Motor cliente (Fuse.js/FlexSearch) | Nunca — el corpus por página es chico y el orden ya lo da el servidor; añadir un motor cliente duplica lógica. |
| Senado comisiones vía app PHP (`?mo=comisiones`) | Portal Next.js `__NEXT_DATA__` | El portal para lo que ya cubre; PHP para comisiones (más estable, sin `buildId`). |

## What NOT to Use

| Evitar | Por qué | En su lugar |
|--------|---------|-------------|
| Motor de búsqueda externo (Elasticsearch/Typesense/Meilisearch) | Infra extra que contradice "todo en Supabase"; PG FTS+trgm+RRF cubre 3.657 PL de sobra. | Postgres nativo (FTS + pg_trgm + RRF con pgvector). |
| Meter el match de boletín DENTRO del RRF | Diluye un match exacto y determinista con rangos aproximados. | Short-circuit exacto ANTES del híbrido. |
| `unaccent()` crudo en índices | No es IMMUTABLE → el índice no se puede crear. | Wrapper `f_unaccent()` IMMUTABLE. |
| `ts_rank_cd` como columna indexada | No es indexable; intentarlo es error. | Calcularlo en el CTE FTS sobre el subconjunto del `where` (patrón Supabase). |
| Anchors/fragmentos `#` en deep-links oficiales | No estables en ASP.NET/PHP; rompen silenciosamente. | Deep-link a nivel de boletín (unidad verificable estable). |
| `prmBOLETIN` solo para el link de Cámara | La ficha requiere `prmID`; sin él puede no resolver. | Persistir `prmID` en ingesta y usar `prmID`+`prmBOLETIN`. |
| Cliente RDF pesado para BCN SPARQL | Innecesario; el endpoint devuelve JSON de resultados. | `fetch` + `JSON.parse` + guardar crudo en R2. |
| Inventar partido por heurística cuando la fuente calla | Riesgo existencial #1 (afirmación falsa creíble). | Fail-closed: sin fuente, sin dato. |
| DAST/scanner pesado nuevo para la pasada de seguridad | Modelo ya deny-by-default; ruido sin señal. | Splinter + pnpm audit + CSP enforce + versión pgvector. |

## Stack Patterns by Variant

**Si el SPIKE muestra recall insuficiente del "caso obvio" aún con RRF:**
- Subir `full_text_weight` y añadir un boost explícito a match de título por `word_similarity()` (trgm) antes de la semántica.
- Porque el fallo del producto estrella es literal-en-título; el peso A + trgm lo ataca directamente.

**Si crece el corpus a decenas de miles y `ts_rank_cd` pesa:**
- Evaluar `rum` index sobre el tsvector.
- Porque rum guarda posiciones y acelera el ranking; a la escala actual no compensa.

**Si BCN SPARQL resulta inestable en el SPIKE:**
- Degradar a biografía mínima desde WSCamaraDiputados (diputados) + ficha portal Senado (senadores), sin narrativa histórica.
- Porque partido/período vigente ya cubre el cruce; la biografía histórica es "nice to have".

## Version Compatibility

| Paquete/extensión | Compatible con | Notas |
|-------------------|----------------|-------|
| pgvector 0.8.2 | Postgres 15 (Supabase) | Fija CVE-2026-3172; confirmar que la nube corre ≥0.8.2. |
| unaccent / pg_trgm | Postgres 15 (contrib, Supabase) | `create extension`; wrapper IMMUTABLE para indexar unaccent. |
| RRF (patrón Supabase) | pgvector 0.8 + GIN tsvector | Usa rangos; independiente del operador de distancia — mantener `<=>`/coseno de `match_proyectos`. |
| cheerio 1.2.0 | Deno 2.x | Ya en uso; Senado PHP comisiones + Cámara semana. |
| fast-xml-parser 5.10.1 | Deno 2.x | Ya en uso; `getDiputados` XML de opendata.congreso.cl (quedarse en 5.x, v6 experimental). |
| WSCamaraDiputados HTTP GET | fetch + fast-xml-parser | Devuelve XML directo (sin SOAP envelope) por GET. |

## Sources

- [Hybrid search — Supabase Docs](https://supabase.com/docs/guides/ai/hybrid-search) + Context7 `/llmstxt/supabase_llms-full_txt` — SQL RRF exacto (`ts_rank_cd`, `websearch_to_tsquery`, `<#>`, `full outer join`, `rrf_k=50`, pesos) — HIGH
- pg_trgm / unaccent — Postgres 15 + Supabase (contrib); wrapper `f_unaccent` IMMUTABLE; config `es_unaccent`; [dev.to full-text search Supabase](https://dev.to/reclusivecoder/skip-elasticsearch-build-blazing-fast-full-text-search-right-in-supabase-58pf) + [PostgreSQL docs F.48 unaccent](https://www.postgresql.org/docs/current/unaccent.html) — HIGH
- [RUM — Supabase Docs](https://supabase.com/docs/guides/database/extensions/rum) + [64+ extensions ranked](https://1bench.dev/extensions/postgresql/on-supabase) — rum disponible, no recomendado a esta escala — MEDIUM
- [pgvector 0.8.2 released — postgresql.org](https://www.postgresql.org/about/news/pgvector-082-released-3245) — CVE-2026-3172, halfvec, iterative scan — HIGH
- Deep-link Senado: [tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=17441-15](https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=17441-15) (verificado; sin sufijo → lista) — HIGH
- Deep-link Cámara: `camara.cl/legislacion/proyectosdeley/tramitacion.aspx?prmID=…&prmBOLETIN=…` (varios ejemplos en vivo) — requiere `prmID` — HIGH
- [BCN Biografías Parlamentarias — ontología](https://datos.bcn.cl/ontologies/bcn-biographies/doc/) + [Consultas SPARQL](https://datos.bcn.cl/es/documentacion/consultas-sparql) — endpoint SPARQL, `bcnbio:`, ~3.900 congresistas; sin REST por-ID — MEDIUM
- [WSCamaraDiputados — opendata.congreso.cl](https://opendata.congreso.cl/wscamaradiputados.asmx) — `getDiputados` trae `Militancia_Actual`/`Militancias_Periodos`/`Distrito`; HTTP GET devuelve XML directo; `getComisiones_Vigentes`, `getSesiones`, `getSesionDetalle` — HIGH
- Cámara citaciones semana: `camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2025-49` (HTML, sala+comisiones) — HIGH
- Senado comisiones (app PHP): `tramitacion.senado.cl/appsenado/index.php?mo=comisiones&ac=citacionesComision&tipo_consulta=1|4` + `ac=listado` — HIGH
- [Splinter — Supabase Postgres Linter](https://github.com/supabase/splinter) + [Supabase Security Retro 2025](https://supabase.com/blog/supabase-security-2025-retro) — linter oficial RLS/security; `index_advisor`; push protection 2026 — HIGH

---
*Stack research for: retrieval híbrido PL + deep-links + bio/partido + citaciones sala/comisiones + validación de seguridad (v9.0)*
*Researched: 2026-07-21*
