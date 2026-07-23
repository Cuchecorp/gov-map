# Phase 87: BÚSQUEDA P1b — RPC híbrida `buscar_proyectos_hibrido` + rewire (fix del bug estrella) - Research

**Researched:** 2026-07-21
**Domain:** Postgres FTS + pgvector RRF sobre schema real (`proyecto` / `proyecto_ficha` / `proyecto_embedding`) + rewire server-only del data-layer con flag
**Confidence:** HIGH (schema, ACL pattern, harness y flag verificados file:line; SQL RRF ya validado empíricamente en el spike 86)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (SPIKE 86 — no rediscutir)
- **Algoritmo:** RRF FTS∪semántico por RANK, `rrf_k=50`, límite 50 por rama, `w_fts=w_sem=1`.
- **Boletín short-circuit determinista FUERA del RRF, en SQL:** match exacto sobre `boletin` O prefix-match determinista sobre número base (`14309` → `14309-04`), cubriendo los 3 formatos (`14309-04`, `14309`, `14.309-04` normalizado).
- **REQUISITO DURO:** `CREATE EXTENSION IF NOT EXISTS unaccent` + wrapper IMMUTABLE en la migración — PROD NO lo tiene (medido, 86-SCORING.md línea 14 `unaccent habilitado | false`).
- **Pesos tsvector:** A=título, B=idea matriz, C=normas/cuerpos legales.
- **`websearch_to_tsquery` SIEMPRE**, misma config en índice y consulta; jamás `to_tsquery` crudo.
- **`match_proyectos` (0011) queda INTACTA** — la usa "proyectos similares" (SEM-05).
- **Migración por `PGCLIENTENCODING=UTF8 psql --single-transaction -f`** (NUNCA `db push`); ledger `schema_migrations` reconciliado.
- **Cero `grant … to anon`** (post-0044, Camino A); el sitio lee con `service_role`.
- **Migración ADITIVA** (extension + tsv + índices + función): sin DROP destructivo, sin backfill destructivo → NO requiere checkpoint de operador.

### Claude's Discretion
- Nombre/número exacto de la migración (research resuelve: **`0055`**).
- Detalles del wrapper unaccent (función IMMUTABLE vs text search config custom).
- Si el tsv termina en `proyecto_ficha`, cómo manejar proyectos SIN ficha (criterio: ningún proyecto INBUSCABLE por texto).
- Wiring exacto del CLI spike para medir la RPC real.

### Deferred Ideas (OUT OF SCOPE)
- Filtros client-side, ranking mensaje>moción, recencia → **fase 88**.
- Deep-links de validación → **fase 89**.
- Retiro definitivo del camino viejo de /buscar (borrar flag) → **fase 95/96**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RETR-01 | Boletín en cualquier formato (`14309-04`, `14309`, `14.309-04`) SIEMPRE resultado #1 — short-circuit determinista fuera del RRF | Q4 resuelve: `proyecto.boletin_num` YA EXISTE (`text not null`, 0008:20) → `where boletin=:full or boletin_num=:base`. El detector de 3 formatos (`spike/boletin.ts::detectarBoletin`) se importa al server para normalizar el punteado ANTES de la RPC. |
| RETR-02 | Fragmento LITERAL del título SIEMPRE lo encuentra — FTS `spanish` + unaccent (hoy solo-semántico falla = EL bug) | Q2+Q3 resuelven: peso A = `titulo` (columna de `proyecto`, siempre presente) en la rama FTS; unaccent instalado por la migración. Todo proyecto (con o sin ficha) matchea al menos por título → cero inbuscables. |
| RETR-05 | Búsqueda por idea matriz y normas en NL con pesos A/B/C declarados + RPC allowlist + flag + golden no regresiona | Q2 (diseño tsvector A/B/C con LEFT JOIN a ficha), Q5 (RPC firma/ACL), Q6 (flag), Q7 (gate golden live sobre RPC real). |
</phase_requirements>

## Summary

Esta fase materializa en PROD la decisión ya validada del spike 86 (RRF domina: 43.8/68.8/53.6 vs 34.4/53.1/40.3 del semántico-solo). El trabajo es **100% SQL + rewire TS**, sin librerías nuevas. La migración `0055` instala `unaccent` + wrapper IMMUTABLE, define la rama FTS ponderada A/B/C, crea el índice GIN, y crea la RPC `buscar_proyectos_hibrido` con el idiom de lockdown post-0044 (SECURITY DEFINER + `set search_path=''` + doble-revoke, CERO grant — el sitio lee con `service_role`). `buscar.ts` gana un flag `BUSQUEDA_HIBRIDA_ENABLED` que enruta a la RPC nueva o al camino actual, y el harness del spike gana una estrategia que mide la RPC REAL para re-verificar el gate de dominancia.

**La única pregunta de diseño abierta (dónde vive el tsvector ponderado) tiene una respuesta clara:** el título vive en `proyecto`, mientras idea_matriz/normas viven en `proyecto_ficha` (1:1, PK compartida = boletín). Una columna generada STORED NO puede cruzar tablas, así que se descarta. La recomendación es **la rama FTS calculada en la query con `LEFT JOIN proyecto_ficha` (opción b)** — exactamente el SQL que el spike ya corrió y midió (`strategies.ts:45-72`), con un índice GIN sobre `to_tsvector('es_unaccent', unaccent(titulo))` de `proyecto` para acelerar el brazo del título (el peso A, que resuelve RETR-02, el bug estrella). Esto evita cualquier deuda de sincronización de triggers o vistas materializadas, garantiza que ningún proyecto quede inbuscable (el LEFT JOIN preserva los 559 proyectos sin ficha, matcheándolos por título), y es idéntico al código ya validado.

**Primary recommendation:** Rama FTS ad-hoc con `LEFT JOIN proyecto_ficha` (peso A=`proyecto.titulo`, B=`ficha.idea_matriz`, C=`jsonb norma`) + índice GIN de expresión sobre el tsv del título; NO columna generada, NO trigger, NO vista materializada. RPC `buscar_proyectos_hibrido(q text, query_embedding vector(768), match_count int default 20)`, SECURITY DEFINER, `set search_path=''`, doble-revoke, CERO grant. Migración `0055`. Config text-search `public.es_unaccent` (copy=spanish + mapping unaccent).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Short-circuit de boletín (RETR-01) | API/Backend (RPC SQL) | Frontend Server (buscar.ts redirect) | El redirect `BOLETIN_RE` en buscar.ts captura el caso obvio ANTES de tocar la DB; el short-circuit SQL dentro de la RPC es la red de seguridad determinista para lo que el redirect no capture (formato punteado). |
| FTS ponderado A/B/C (RETR-02/05) | Database (Postgres FTS) | — | 100% Postgres nativo; el tsvector + índice GIN + `websearch_to_tsquery` viven en la DB. |
| Fusión RRF FTS∪semántico | Database (RPC SQL) | — | Un solo full-outer-join de dos CTEs rankeadas dentro de la RPC. |
| Generación del embedding de la query | Frontend Server (buscar.ts) | — | La Gemini key es server-only (`buscar.ts:107`); el server embebe y pasa el vector parametrizado a la RPC. |
| Enrutamiento por flag (rewire) | Frontend Server (buscar.ts) | — | `BUSQUEDA_HIBRIDA_ENABLED` server-only decide RPC nueva vs `match_proyectos`. |
| Gate de dominancia (golden live) | Test harness (packages/fichas/spike) | — | El CLI spike mide la RPC real sobre el golden congelado; decide el flip del default. |

## Standard Stack

### Core
Cero librerías nuevas de runtime. Todo el retrieval es extensiones de Postgres + SQL, dentro del modelo `service_role + allowlist` existente.

| Componente | Versión | Propósito | Por qué estándar |
|------------|---------|-----------|------------------|
| `unaccent` | contrib (PG15, Supabase) | Quitar diacríticos → FTS accent-insensitive; requisito duro del spike | Built-in; el spike midió que su AUSENCIA degrada FTS a 9.4% |
| `pgvector` (`vector`) | 0.8.x (ya en uso) | Rama semántica del RRF vía `match_proyectos` intacta | Ya validado, HNSW cosine, 768-dim (0011) |
| Postgres FTS `spanish` | PG15 built-in | `to_tsvector`/`websearch_to_tsquery`/`ts_rank_cd` | Ya en uso en 0032 (`buscar_citaciones`) |

### Supporting
| Extensión | Estado | Decisión |
|-----------|--------|----------|
| `pg_trgm` | contrib disponible | **NO instalar en 87** salvo que el golden live-test sobre la RPC real muestre recall insuficiente. El SPIKE alcanzó el criterio de victoria sin trgm; añadirlo es escape-hatch de fase 88. CONTEXT.md línea 27 lo hace opcional. |

**Instalación (dentro de la migración `0055`, aplicada por psql):**
```sql
create extension if not exists unaccent;
-- NO pg_trgm (opcional, no requerido por el golden)
```

**Version verification:** `unaccent` y FTS `spanish` son contrib de PG15 — presentes en cualquier Supabase PG15+; el único gap medido es que `unaccent` no está *creado* (no que falte). No hay paquetes npm nuevos → no aplica auditoría de registro.

## Package Legitimacy Audit

**No aplica.** Esta fase NO instala ningún paquete externo (npm/PyPI/crates). Todo es SQL + extensiones contrib de Postgres ya presentes en Supabase PG15, más rewire de TypeScript existente. slopcheck/registry no tienen superficie que auditar.

## Architecture Patterns

### System Architecture Diagram

```
Navegador  ── qRaw ──▶  /buscar (Server Component, buscar.ts, server-only)
                              │
                    trim + cap ≤300 chars
                              │
                    ¿BOLETIN_RE / detectarBoletin?
                        │yes                    │no
                        ▼                        ▼
              redirect(/proyecto/{q})    ¿BUSQUEDA_HIBRIDA_ENABLED === "true"?
              (RETR-01 fast path)          │OFF                    │ON
                                           ▼                        ▼
                                   embed RETRIEVAL_QUERY     embed RETRIEVAL_QUERY (Gemini, server-only)
                                           │                        │
                                   rpc match_proyectos       rpc buscar_proyectos_hibrido(q, vector, n)
                                   (camino actual)                  │
                                                          ┌─────────┴──────────────────┐
                                                          │  DENTRO DE LA RPC (SQL):    │
                                                          │  0) short-circuit boletín   │  ← RETR-01 red de seguridad
                                                          │     (boletin=q OR num prefix)│
                                                          │  1) CTE full_text (GIN)     │  ← RETR-02/05 peso A/B/C
                                                          │     LEFT JOIN proyecto_ficha│
                                                          │  2) CTE semantic (HNSW)     │
                                                          │     proyecto_embedding      │
                                                          │  3) full outer join + RRF   │
                                                          │     por RANK, rrf_k=50      │
                                                          └─────────┬───────────────────┘
                                                                    ▼
                                                        (boletin, rank) PII-safe  ──▶ orden server-side ──▶ cards
```

### Recommended Migration Structure (`0055`)
```
supabase/migrations/0055_busqueda_hibrida.sql
├── SECCIÓN 0 — comentario-cabecera (orden de apply, patrón 0049)
├── SECCIÓN 1 — create extension unaccent
├── SECCIÓN 2 — f_unaccent(text) IMMUTABLE  +  text search config es_unaccent
├── SECCIÓN 3 — índice GIN de expresión sobre tsv del título (proyecto)
├── SECCIÓN 4 — drop + create function buscar_proyectos_hibrido (definer, search_path='')
└── SECCIÓN 5 — ACL: doble-revoke (from public; from anon, authenticated), CERO grant
supabase/tests/post-apply/0055_busqueda_hibrida.test.sql   (pgTAP)
```

### Pattern 1: RPC de lockdown post-0044 (espejo EXACTO de `cruces_de_proyecto`, 0049)
**What:** RPC SECURITY DEFINER con `set search_path=''`, nombres 100% schema-qualified, doble-revoke, CERO grant. `service_role` la ejecuta vía `.rpc()` sin necesitar grant (bypassa RLS/ACL).
**When to use:** Toda RPC nueva post-Camino-A.
```sql
-- Source: supabase/migrations/0049_cruces_de_proyecto.sql:55-115 (idiom verificado)
drop function if exists public.buscar_proyectos_hibrido(text, vector, int);

create or replace function public.buscar_proyectos_hibrido(
  q               text,
  query_embedding vector(768),
  match_count     int default 20
)
returns table (boletin text, rank int)   -- PII-safe: SOLO (boletin, rank)
language sql stable security definer set search_path = '' as $$
  -- SET LOCAL statement_timeout requiere plpgsql; ver Pattern 3 para la variante bounded.
  with
  -- normalización de boletín (los 3 formatos) resuelta en el server ANTES de llamar;
  -- aquí el short-circuit exacto usa boletin_num (0008:20) que YA EXISTE.
  boletin_hit as (
    select p.boletin, 0 as rank         -- rank 0 = tope absoluto (RETR-01)
    from public.proyecto p
    where q ~ '^\d{3,6}(-\d{1,2})?$'
      and (p.boletin = q or p.boletin_num = split_part(q, '-', 1))
    limit 1
  ),
  full_text as (
    select p.boletin,
           row_number() over (
             order by ts_rank_cd(
               setweight(to_tsvector('public.es_unaccent', coalesce(p.titulo,'')),      'A') ||
               setweight(to_tsvector('public.es_unaccent', coalesce(f.idea_matriz,'')), 'B') ||
               setweight(to_tsvector('public.es_unaccent', coalesce(
                 (select string_agg(c->>'norma',' ')
                  from jsonb_array_elements(f.cuerpos_legales) c), '')),               'C'),
               websearch_to_tsquery('public.es_unaccent', q)
             ) desc
           ) as rank_ix
    from public.proyecto p
    left join public.proyecto_ficha f on f.boletin = p.boletin   -- ← LEFT: preserva los sin-ficha (por título)
    where (
      setweight(to_tsvector('public.es_unaccent', coalesce(p.titulo,'')),      'A') ||
      setweight(to_tsvector('public.es_unaccent', coalesce(f.idea_matriz,'')), 'B') ||
      setweight(to_tsvector('public.es_unaccent', coalesce(
        (select string_agg(c->>'norma',' ')
         from jsonb_array_elements(f.cuerpos_legales) c), '')),               'C')
    ) @@ websearch_to_tsquery('public.es_unaccent', q)
    limit least(match_count, 50) * 2
  ),
  semantic as (
    select e.boletin,
           row_number() over (order by e.embedding <=> query_embedding) as rank_ix
    from public.proyecto_embedding e
    order by e.embedding <=> query_embedding                     -- distancia cruda = usa HNSW
    limit least(match_count, 50) * 2
  ),
  fused as (
    select coalesce(ft.boletin, sm.boletin) as boletin,
           row_number() over (
             order by
               coalesce(1.0/(50 + ft.rank_ix), 0.0) +            -- w_fts=1
               coalesce(1.0/(50 + sm.rank_ix), 0.0) desc         -- w_sem=1, rrf_k=50
           )::int as rank
    from full_text ft
    full outer join semantic sm on ft.boletin = sm.boletin
  )
  select boletin, 0 as rank from boletin_hit
  union all
  select boletin, rank from fused
  where not exists (select 1 from boletin_hit)                   -- si hubo boletín, solo ese
  order by rank
  limit least(match_count, 50);
$$;

revoke all on function public.buscar_proyectos_hibrido(text, vector, int) from public;
revoke all on function public.buscar_proyectos_hibrido(text, vector, int) from anon, authenticated;
-- CERO grant: service_role lee vía .rpc() (Camino A, espejo 0049:114-115).
```
> **Nota de firma:** el orden de params es `(q text, query_embedding vector(768), match_count int)`. Al fijar `search_path=''` toda referencia debe ser schema-qualified — incluyendo la text-search config `public.es_unaccent` (0032:29 usa `'spanish'::regconfig`; con search_path vacío la config custom DEBE llevar el schema).

### Pattern 2: Text search config accent-insensitive (una vez, en la migración)
**What:** Config `es_unaccent` = copy de spanish + mapping unaccent, para que el mismo pipeline (unaccent + spanish_stem) aplique en índice y consulta con `websearch_to_tsquery('public.es_unaccent', …)` — la LOCKED "misma config en índice y consulta".
```sql
-- Source: STACK.md:34-41 (patrón oficial PG unaccent F.48) + verificado indexable
create extension if not exists unaccent;
create or replace function public.f_unaccent(text)
  returns text language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent', $1) $$;   -- 2-arg = IMMUTABLE (indexable)
create text search configuration public.es_unaccent ( copy = spanish );
alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word
  with public.unaccent, spanish_stem;
```
> **Por qué config custom y NO `f_unaccent(titulo)` envuelto:** con `es_unaccent` el `unaccent` se aplica DENTRO del pipeline de tsvector/tsquery, así `websearch_to_tsquery('public.es_unaccent', q)` ya viene sin acentos — no hay que envolver la query con `f_unaccent` a mano (el spike lo hacía con `unaccent(:q)` porque corría sin config custom; la RPC de PROD usa la config, más limpio y ambos lados simétricos por construcción). El wrapper `f_unaccent` IMMUTABLE se conserva SOLO por si se quiere un índice trgm en fase 88.

### Pattern 3: Bounded desde el día 1 (statement_timeout local)
**What:** `SET LOCAL statement_timeout` requiere cuerpo `plpgsql`. Si se quiere el cap de tiempo dentro de la función (CONTEXT.md línea 34), envolver en `language plpgsql` con `set search_path=''` y `SET LOCAL statement_timeout = '3s'` antes del `RETURN QUERY`. Alternativa más simple y suficiente: mantener `language sql` y confiar en los caps de fila (`least(match_count,50)`, `limit …*2` por rama) — el corpus (3.659) hace que el timeout sea defensa redundante. **Recomendación:** `language sql` con caps de fila para 87 (simplicidad, ya probado en el spike); documentar el timeout como escape-hatch si fase 95 lo pide. Los caps de fila SÍ van desde el día 1.

### Índice GIN (acelera el brazo del título — RETR-02)
```sql
-- El peso A (título) es el que resuelve el bug estrella; indexar su tsv de proyecto.
create index if not exists idx_proyecto_titulo_fts
  on public.proyecto using gin (to_tsvector('public.es_unaccent', coalesce(titulo, '')));
```
> `ts_rank_cd` NO es indexable (STACK.md:241) — pero solo rankea el subconjunto del `where @@`. El GIN acelera el `@@` sobre el título. El tsv combinado A||B||C con LEFT JOIN NO es indexable como una sola expresión (cruza tablas); el `where` lo evalúa por-fila sobre 3.659 filas = trivial a esta escala. El índice del título cubre el caso caliente (literal en título).

### Anti-Patterns to Avoid
- **Columna generada STORED del tsv combinado A||B||C:** IMPOSIBLE — `idea_matriz`/`cuerpos_legales` viven en `proyecto_ficha`, no en `proyecto`; una generated column no referencia otra tabla (CONTEXT.md línea 26). **Descartado.**
- **Trigger que materializa un tsv combinado en `proyecto`:** deuda de sincronización silenciosa (el pipeline de fichas escribe `proyecto_ficha` en otro momento que `proyecto`; un trigger puede quedar desincronizado y no hay señal). CONTEXT.md pide "sin deuda de sincronización". **Descartado.**
- **Vista materializada del tsv:** requiere REFRESH programado (otro job pg_cron) + ventana de staleness; sobre-ingeniería para 3.659 filas. **Descartado.**
- **`INNER JOIN proyecto_ficha`:** dejaría 559 proyectos sin ficha (15.3%) INBUSCABLES por texto — viola el criterio duro. Usar **LEFT JOIN** (matchea por título siempre).
- **`to_tsquery` crudo:** 500s con input libre (`sub-secretaría`, `16733-07`). LOCKED: `websearch_to_tsquery` SIEMPRE.
- **`unaccent()` de 1 argumento en índice/generated column:** no es IMMUTABLE (depende de `default_text_search_config`) → el índice no se crea. Usar la forma 2-arg `unaccent('public.unaccent', $1)` o la config `es_unaccent`.
- **`grant … to anon | to service_role | to public`:** el guard CI (`lockdown-guard.test.ts:236`) FALLA con cualquier `grant … to anon/public`; `service_role` NO necesita grant (ejecuta por bypass). **CERO grant.**
- **Tocar `match_proyectos`:** LOCKED intacta (0011); la usa "proyectos similares".

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Fusión de dos rankings | Suma de scores normalizados (ts_rank vs coseno) | RRF por RANK (patrón Supabase, ya en `spike/rrf.ts`) | Normalizar dos métricas distintas es frágil; RRF usa solo rangos |
| Accent-insensitive | strip manual de tildes en TS | `unaccent` + config `es_unaccent` | El pipeline PG lo hace en índice y consulta simétricamente |
| Detección de boletín 3 formatos | regex nueva en la RPC | `detectarBoletin` (`spike/boletin.ts`) importado al server + `boletin_num` para el prefix en SQL | Ya maneja punteado + decimal-vs-boletín; `boletin_num` ya existe |
| Query parser | sanitizar `q` a mano | `websearch_to_tsquery` (tolera input arbitrario sin 500) + `.rpc()` parametriza | LOCKED |
| Motor de búsqueda | Elasticsearch/Typesense | Postgres FTS+RRF | "todo en Supabase"; 3.659 PL de sobra |

**Key insight:** El SQL de la RPC es esencialmente el `FTS_QUERY` + `SEMANTIC_QUERY` + `rrf()` que el spike YA corrió y midió (`strategies.ts:45-119`). La fase 87 lo TRANSCRIBE a una función SQL con la config `es_unaccent` (en vez de `unaccent(:q)` ad-hoc) y el idiom de lockdown. No hay algoritmo nuevo que inventar — solo portar lo medido a una RPC gobernada.

## Runtime State Inventory

| Categoría | Items encontrados | Acción requerida |
|-----------|-------------------|------------------|
| Stored data | `proyecto` (3.659), `proyecto_ficha` (idea_matriz + cuerpos_legales jsonb), `proyecto_embedding` (3.100 = 84.7%, 0011). NINGÚN dato se renombra ni migra. | Ninguna — migración aditiva; el tsv se calcula on-the-fly (no se persiste una columna nueva de datos). |
| Live service config | `unaccent` extension AUSENTE en PROD (medido 86-SCORING:14). | La migración `0055` la instala (`create extension if not exists`). |
| OS-registered state | Ninguno. | Ninguna. |
| Secrets/env vars | `BUSQUEDA_HIBRIDA_ENABLED` (NUEVA env server-only, sin prefijo `NEXT_PUBLIC_`). `GEMINI_API_KEY` (ya existe, `buscar.ts:108`). | Documentar la nueva var; el flag nace OFF (fail-closed) hasta que el gate de dominancia flipee el default. |
| Build artifacts | Ninguno. | Ninguna. |

**Nota:** Esta es una fase de creación (RPC + migración) más rewire, no un rename. El inventario confirma que NO hay estado runtime que renombrar; el único cambio de estado en PROD es la creación de la extensión + función (idempotente, aditivo).

## Common Pitfalls

### Pitfall 1: search_path='' rompe la config `es_unaccent` sin schema-qualify
**What goes wrong:** Con `set search_path=''`, `websearch_to_tsquery('es_unaccent', q)` falla ("text search configuration does not exist"). **How to avoid:** Siempre `'public.es_unaccent'` (schema-qualified) en la RPC. Espejo de 0049:69-103 que qualifica TODO (`public.proyecto`, `public.cruce_senal`).

### Pitfall 2: proyectos sin ficha desaparecen del FTS
**What goes wrong:** Un `INNER JOIN proyecto_ficha` o un `WHERE f.idea_matriz IS NOT NULL` elimina los 559 proyectos sin ficha → inbuscables aun por título (viola el criterio duro). **How to avoid:** `LEFT JOIN proyecto_ficha` + `coalesce(f.idea_matriz,'')` — el peso A del título (siempre presente en `proyecto`) los mantiene buscables. El spike ya usa LEFT JOIN (`strategies.ts:60`).

### Pitfall 3: el guard CI bloquea grant a service_role
**What goes wrong:** Añadir `grant execute … to service_role` "por las dudas" — el regex del guard (`lockdown-guard.test.ts:211`) solo bloquea `to anon/public`, así que un grant a service_role NO rompe el guard, PERO es innecesario y contradice el idiom 0049 (CERO grant). **How to avoid:** CERO grant; doble-revoke y nada más. `service_role` ejecuta por bypass.

### Pitfall 4: firma de la RPC en el allowlist / post-apply desalineada
**What goes wrong:** Añadir `buscar_proyectos_hibrido` al `PUBLIC_RPC_ALLOWLIST` pero con la firma incorrecta en el pgTAP → el `regprocedure` cast lanza "function does not exist" → rollback (visto en 0045:44 con el overload 2-arg fantasma de `buscar_citaciones`). **How to avoid:** El allowlist usa solo el NOMBRE (no la firma, `lockdown-guard.test.ts:165`); el pgTAP usa la firma EXACTA `buscar_proyectos_hibrido(text,vector,int)`. Verificar contra el `create function` real.

### Pitfall 5: el redirect de boletín en buscar.ts no cubre el formato punteado
**What goes wrong:** `BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/` (`buscar.ts:28`) NO matchea `14.309-04` → cae al camino FTS/semántico en vez de redirigir. **How to avoid:** Extender el redirect usando `detectarBoletin` (`spike/boletin.ts`, ya maneja punteado y distingue decimal de boletín) y normalizar antes de `redirect(/proyecto/{full})`. El short-circuit SQL de la RPC es la red de seguridad para lo que el redirect no capture. (RETR-01)

## Code Examples

### Rewire de buscar.ts con flag (server-only)
```typescript
// Source: espejo de app/lib/cruces-gate.ts:37-41 + app/lib/buscar.ts:177-209
// app/lib/busqueda-hibrida-gate.ts
import "server-only";
export function busquedaHibridaEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.BUSQUEDA_HIBRIDA_ENABLED === "true";   // solo el literal "true" enciende
}

// dentro de buscarProyectos(), tras el embed:
const sb = createServerSupabase();
if (busquedaHibridaEnabled()) {
  const { data, error } = await sb.rpc("buscar_proyectos_hibrido", {
    q,                                   // texto para FTS + short-circuit
    query_embedding: emb.vector,         // vector parametrizado
    match_count: opts.matchCount ?? 20,
  });
  if (error) throw new Error(`buscar_proyectos_hibrido RPC falló: ${error.message}`);
  return (data as MatchProyectoRow[] | null) ?? [];
}
// camino actual (match_proyectos) sin cambios — OFF por default.
```
> **Extensión del redirect (RETR-01):** reemplazar `if (BOLETIN_RE.test(q))` por una llamada a `detectarBoletin(q)` (importada de un módulo compartido) que normalice el punteado y redirija a `/proyecto/{base-sufijo}`.

### Nueva estrategia en el harness spike (mide la RPC REAL — gate de dominancia)
```typescript
// Source: espejo de packages/fichas/src/spike/strategies.ts:201-218 (runSemanticOnly)
// Nueva estrategia: llama la RPC real vía el mismo runSql (psql), un solo SELECT.
const RPC_HIBRIDA_QUERY = `
select boletin, rank
from buscar_proyectos_hibrido(:q, :query_embedding::vector, :match_count::int)
order by rank
`.trim();

export async function runRpcHibrida(
  query: string, vector: number[], opts: { runSql: SqlRunner; limit?: number },
): Promise<string[]> {
  const { runSql, limit = 20 } = opts;
  const rows = await runSql(RPC_HIBRIDA_QUERY, {
    q: query,
    query_embedding: `[${vector.join(",")}]`,
    match_count: String(limit),
  });
  return rows.map((r) => r[0]!).filter(Boolean);
}
```
> **Wiring mínimo (CONTEXT.md línea 52):** añadir una 4ª estrategia al `retrieval-cli.ts` (`--rpc-real` o siempre-on como columna extra) que llame `runRpcHibrida` sobre el mismo `GOLDEN_SET` congelado. Reusa `runSql`/`probeUnaccent`/`getCachedEmbeddings` intactos. La estrategia mide la RPC REAL (no el SQL ad-hoc del spike) → es el instrumento del gate de dominancia de 87.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (app) | vitest (config en `app/vitest.config.ts`; corre desde `app/`) |
| Framework (live gate) | vitest `vitest.live.config.ts` (golden live test, env-gated) |
| Framework (DB) | pgTAP post-apply (`supabase/tests/post-apply/`), corrido a mano por operador tras aplicar |
| Quick run (app) | `pnpm --filter <app> test` (o el `pnpm test` de la raíz que ahora cubre app/) |
| Golden live | corrida del `retrieval-cli.ts` con env `SUPABASE_DB_URL` + `GEMINI_API_KEY` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RETR-01 | boletín 3 formatos → #1 | unit (detectarBoletin/redirect) + golden-live (categoría `boletin` 4/4) | `pnpm --filter app test busqueda-hibrida` | ❌ Wave 0 (test del rewire) — `detectarBoletin` ya testeado en spike |
| RETR-01 | short-circuit SQL en la RPC | pgTAP post-apply (boletín exacto = rank 0) | `psql -tA -f supabase/tests/post-apply/0055_busqueda_hibrida.test.sql` | ❌ Wave 0 |
| RETR-02 | literal en título encuentra | golden-live (categorías `titulo-literal`/`acentos-toponimos` mejoran vs baseline) | `retrieval-cli.ts --report …` (estrategia rpc-real) | ⚠ extender CLI |
| RETR-05 | RPC allowlist + flag + golden no regresiona | unit (flag OFF/ON) + guard CI (allowlist) + golden-live (NL/similares ≥ baseline) | `pnpm --filter app test lockdown-guard busqueda-hibrida` | ❌ Wave 0 (flag test) |
| RETR-05 | anon DENEGADO en la RPC nueva | pgTAP post-apply (PUBLIC sin EXECUTE, espejo 0045) | `psql -tA -f supabase/tests/post-apply/0055_busqueda_hibrida.test.sql` | ❌ Wave 0 |
| RETR-05 | unaccent presente | pgTAP post-apply (`select 1 from pg_extension where extname='unaccent'`) | idem | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter app test <archivo tocado>` (flag test, rewire test, lockdown-guard).
- **Per wave merge:** suite completa de `app/` + `packages/fichas/`.
- **Phase gate:** (1) suite verde; (2) golden live-test sobre la RPC REAL muestra dominancia (≥ baseline semántico en NL/similares Y arregla literal/boletín) → recién ahí se flipea `BUSQUEDA_HIBRIDA_ENABLED` default a ON en el commit documentado; si NO domina, default OFF + hallazgo registrado (CONTEXT.md línea 40).

### Wave 0 Gaps
- [ ] `app/lib/busqueda-hibrida-gate.ts` + `.test.ts` — flag OFF/ON (espejo `cruces-gate.test.ts`, 5 casos: ausente/`false`/`1`/`TRUE`/`true`).
- [ ] `app/lib/buscar.test.ts` (o extender) — rewire: flag OFF llama `match_proyectos`, flag ON llama `buscar_proyectos_hibrido` (embedder mockeado, offline).
- [ ] Extender `PUBLIC_RPC_ALLOWLIST` en `lockdown-guard.test.ts:165` con `buscar_proyectos_hibrido` (sin esto el guard B falla al recablear buscar.ts).
- [ ] `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql` — pgTAP: (a) función existe con firma `(text,vector,int)`; (b) PUBLIC sin EXECUTE (aclexplode, espejo 0045); (c) `unaccent` en `pg_extension`; (d) config `es_unaccent` existe; (e) short-circuit boletín devuelve el boletín exacto.
- [ ] Extender `retrieval-cli.ts` con estrategia `runRpcHibrida` (mide la RPC real).
- [ ] `BOLETIN_RE` → `detectarBoletin`: mover `spike/boletin.ts` a un módulo compartido (o duplicar la lógica en `app/lib/`) y añadir su test en el árbol app/.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Ruta pública read-only; sin auth de usuario |
| V4 Access Control | yes | RPC SECURITY DEFINER + `search_path=''` + doble-revoke + CERO grant; `service_role` server-only (Camino A). El sitio JAMÁS llama la RPC desde el navegador (`import "server-only"`). |
| V5 Input Validation | yes | `q` trimeado + cap ≤300 (`buscar.ts:181`); `websearch_to_tsquery` tolera input libre; `.rpc()` parametriza el vector y `q` (nunca interpolación). Retorno PII-safe: SOLO `(boletin, rank)`. |
| V6 Cryptography | no | Sin cripto nueva |
| V7 Error Handling | yes | Fallo del RPC → `throw` (banner de error, no "sin resultados"), espejo `buscar.ts:204`. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection vía `q` | Tampering | `.rpc()` parametriza; `websearch_to_tsquery` no interpola; nunca string-building |
| Fuga de PII vía RPC | Information Disclosure | Retorno restringido a `(boletin, rank)`; la RPC NO lee tablas PII (solo `proyecto`/`proyecto_ficha`/`proyecto_embedding`, todas públicas) |
| Re-exposición de anon | Elevation of Privilege | doble-revoke + guard CI `lockdown-guard.test.ts` + pgTAP post-apply |
| DoS por query cara | Denial of Service | caps de fila (`least(match_count,50)`, `…*2` por rama) desde el día 1; timeout como escape-hatch |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Búsqueda solo-semántica (`match_proyectos`) | RRF FTS∪semántico + short-circuit boletín | Fase 87 (esta) | Arregla el bug estrella: literal en título y boletín ahora #1 |
| `web_reader` JWT como rol de lectura | `service_role` (Camino A) | 0046 (web_reader dropeado) | La RPC nueva NO necesita grant; service_role ejecuta por bypass |

**Deprecated/outdated:**
- `web_reader`: DROPEADO en 0046. Ninguna RPC nueva debe granthearle EXECUTE (no existe). El sitio lee con `service_role`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cuerpos_legales` jsonb tiene elementos con key `'norma'` (peso C) | Pattern 1 | Bajo — verificado en 0011:24 (`{norma, articulos[]}`) y ya usado en `strategies.ts:54`; si algún elemento no tiene `norma`, `string_agg` lo omite (degradación honesta, no error) |
| A2 | 559 proyectos sin ficha (3.659 − 3.100 con embedding) ≈ sin idea_matriz | Pitfall 2 | Bajo — el número exacto de sin-ficha ≠ sin-embedding, pero el LEFT JOIN los cubre por diseño sin importar la cardinalidad exacta |
| A3 | `service_role` ejecuta la RPC SECURITY DEFINER sin grant explícito | Pattern 1 | Bajo — verificado por el idiom 0049 (`cruces_de_proyecto`, CERO grant, consumida por el sitio) ya en PROD; el pgTAP post-apply lo re-confirma |

**Nota:** Ninguna de estas asunciones bloquea el plan; todas son verificables en el pgTAP post-apply y/o ya evidenciadas en migraciones aplicadas.

## Open Questions — RESUELTAS

1. **Schema real de `proyecto` y dónde vive idea_matriz/normas.**
   - `proyecto` (0008:19-34): PK `boletin text`, `boletin_num text not null` (base sin sufijo — clave para RETR-01), `titulo text not null`, `materia text`, `iniciativa`, `estado`, `etapa`, `autores text[]`, provenance. **NO existe columna `normas_afectadas`** (Pitfall #1 del spike).
   - `proyecto_ficha` (0011:20-34): PK `boletin` (1:1 con proyecto), `idea_matriz text` (nullable), `cuerpos_legales jsonb` (`{norma, articulos[]}`), `estado`. **Cardinalidad 1:1, PK compartida.** NO todos los proyectos tienen ficha (3.100 embeddings de 3.659).
   - **Resuelto:** título en `proyecto`; idea_matriz/normas en `proyecto_ficha`; unidos por LEFT JOIN.

2. **Diseño del tsvector ponderado A/B/C cruzando tablas.** → **Opción (b): rama FTS calculada en la query con LEFT JOIN** (peso A=`proyecto.titulo`, B/C=`proyecto_ficha` vía LEFT JOIN + coalesce). NO columna generada (imposible cruzar tablas), NO trigger (deuda de sync), NO vista materializada (staleness). Índice GIN de expresión sobre el tsv del título en `proyecto` (cubre el caso caliente literal-en-título). Ningún proyecto inbuscable: el peso A del título los mantiene. Es EXACTAMENTE el SQL ya medido en el spike (`strategies.ts:45-72`).

3. **unaccent en PG15.** → `create extension unaccent` + **config text-search `public.es_unaccent` (copy=spanish + mapping unaccent)** para simetría índice/consulta, más wrapper `f_unaccent` IMMUTABLE (2-arg, indexable) conservado para un futuro índice trgm. La config es lo indexable y estable; con `search_path=''` va schema-qualified (`public.es_unaccent`).

4. **Boletín short-circuit en SQL.** → `proyecto.boletin_num` (`text not null`, 0008:20) YA EXISTE → match exacto `boletin = q` OR prefix `boletin_num = split_part(q,'-',1)`. El formato punteado (`14.309-04`) se normaliza en el SERVER con `detectarBoletin` (`spike/boletin.ts`) ANTES de llamar la RPC (redirect) y como red de seguridad la RPC recibe `q` ya limpio.

5. **Firma y cuerpo de la RPC.** → `buscar_proyectos_hibrido(q text, query_embedding vector(768), match_count int default 20)` returns `table(boletin text, rank int)`. RRF por rank (full outer join de dos CTEs rankeadas + coalesce), caps de fila (`least(match_count,50)`, `…*2`/rama), SECURITY DEFINER + `set search_path=''`, doble-revoke + CERO grant — espejo EXACTO de `cruces_de_proyecto` (0049). `statement_timeout` local = escape-hatch (requiere plpgsql); caps de fila bastan para 87.

6. **Flag `BUSQUEDA_HIBRIDA_ENABLED`.** → Patrón espejo de `cruces-gate.ts` (`env.X === "true"`, fail-closed, `import "server-only"`, sin prefijo `NEXT_PUBLIC_`). Testeable offline con `env` inyectado (5 casos como `cruces-gate.test.ts`) y el rewire testeable con embedder mockeado (`buscar.ts` ya soporta `opts.embedder`).

7. **Extender el harness.** → Nueva estrategia `runRpcHibrida` (un SELECT sobre `buscar_proyectos_hibrido`, espejo de `runSemanticOnly`), añadida a `retrieval-cli.ts` sobre el mismo golden congelado + `runSql`/`getCachedEmbeddings` reusados. Cambio mínimo.

8. **Número de migración + ledger.** → Última = `0054` → **nueva = `0055`**. Ledger: aplicar por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0055_busqueda_hibrida.sql` + INSERT en `schema_migrations` versión `0055_busqueda_hibrida` + correr `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql` a mano (patrón 0045/0046). Migración ADITIVA → NO requiere checkpoint de operador (CONTEXT.md línea 47).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `unaccent` extension | FTS accent-insensitive | ✗ (no creada) | contrib PG15 | La migración la instala (`create extension`) |
| pgvector / HNSW | rama semántica | ✓ | 0.8.x (0011) | — |
| FTS `spanish` | rama FTS | ✓ | PG15 built-in (0032) | — |
| `SUPABASE_DB_URL` + `GEMINI_API_KEY` | golden live-test | ✓ (.env) | — | — |
| `psql` UTF8 | aplicar migración | ✓ (patrón repo) | — | — |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** `unaccent` — la migración `0055` la crea (aditivo, idempotente).

## Project Constraints (from CLAUDE.md)
- **Ingesta 2 etapas / cron:** no aplica (esta fase no ingiere; consume datos ya en Supabase).
- **Cero grant anon (post-0044):** honrado — doble-revoke, CERO grant, guard CI.
- **Migración por psql UTF8 `--single-transaction`, NUNCA `db push`:** honrado.
- **Secrets en `.env`:** `BUSQUEDA_HIBRIDA_ENABLED` server-only, sin prefijo público.
- **GSD workflow:** esta fase se ejecuta vía `/gsd:execute-phase`.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0008_tramitacion.sql:19-34` — schema `proyecto` (`boletin`, `boletin_num text not null`, `titulo`, `materia`).
- `supabase/migrations/0011_fichas_embeddings.sql:20-90` — `proyecto_ficha` (idea_matriz, cuerpos_legales jsonb), `proyecto_embedding`, `match_proyectos` (INTACTA).
- `supabase/migrations/0032_agenda_search.sql` — template FTS `spanish` + `websearch_to_tsquery` + GIN + RPC.
- `supabase/migrations/0049_cruces_de_proyecto.sql:55-115` — idiom RPC post-0044 (definer + search_path='' + doble-revoke + CERO grant).
- `supabase/migrations/0044_lockdown_revoke_anon.sql` + `0045_revoke_public_rpc_gap.sql` + `0046_drop_web_reader.sql` — Camino A (anon muerto, service_role, web_reader dropeado).
- `supabase/tests/post-apply/0045_revoke_public_rpc_gap.test.sql` — patrón pgTAP (aclexplode, PUBLIC sin EXECUTE, has_function_privilege).
- `app/lib/buscar.ts:28,177-209` — data-layer a recablear, `BOLETIN_RE`, embedder inyectable, throw-on-error.
- `app/lib/lockdown-guard.test.ts:165-217,236` — `PUBLIC_RPC_ALLOWLIST` + guard grant-a-anon.
- `app/lib/cruces-gate.ts` + `cruces-gate.test.ts` — patrón de flag server-only fail-closed.
- `packages/fichas/src/spike/strategies.ts:45-285` + `retrieval-cli.ts` + `boletin.ts` — SQL RRF ya medido + harness a extender + detector 3 formatos.
- `.planning/phases/86-.../86-SCORING.md` — evidencia de dominancia RRF + requisito duro unaccent.

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md:11-137` — patrón RRF Supabase (`ts_rank_cd`, `websearch_to_tsquery`, `full outer join`, `rrf_k=50`), config `es_unaccent`, wrapper `f_unaccent` IMMUTABLE.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — sin librerías nuevas; todo contrib PG + código ya en repo.
- Architecture (RPC + tsv design): HIGH — el SQL ya corrió en el spike; el idiom de lockdown ya está en PROD (0049).
- Schema resolution: HIGH — leído file:line de las migraciones reales.
- Pitfalls: HIGH — derivados de migraciones aplicadas y del guard CI real.

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 (estable; schema y patrones son código en repo, no dependencias externas)
