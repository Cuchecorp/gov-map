# Phase 86: BÚSQUEDA P1a — SPIKE retrieval híbrido + golden set congelado (GATE de 87) - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recomendaciones auto-aceptadas por directiva del operador, PROMPT-v9.0)

<domain>
## Phase Boundary

SPIKE empírico que elige la estrategia de retrieval híbrido ANTES de escribir cualquier schema. Entrega: (1) golden set CONGELADO ≥30 queries, (2) medición reproducible FTS-solo vs semántico-solo vs RRF sobre ese set, (3) decisión registrada (algoritmo, pesos, `rrf_k`, límite de candidatos, plan de flag). NO entrega: migraciones, RPC nueva, cambios de UI — eso es fase 87. El spike NO escribe nada en la DB de PROD (read-only estricto).

</domain>

<decisions>
## Implementation Decisions

### Golden set: composición y formato
- Fixture JSON versionado en el repo (congelado por commit), con `query`, `expected` (boletín/es esperados), `category` y notas por caso.
- ≥30 queries derivadas del corpus REAL de PROD (proyectos existentes), cubriendo TODAS las clases mandatadas: título literal, paráfrasis NL, normas/cuerpos legales, boletín en los 3 formatos (`14309-04`, `14309`, `14.309-04`), ñ/acentos/topónimos ("Ñuñoa", "Aysén", "medio ambiente"), y casos "proyectos similares" (no regresionar SEM-05).
- Métricas: hit@5 y MRR por categoría + agregado. Para queries de boletín el criterio es hit@1 (el boletín correcto SIEMPRE #1 — short-circuit determinista).
- El set queda CONGELADO al cierre de la fase: cambios posteriores requieren decisión explícita registrada, no ediciones silenciosas.

### Estrategias candidatas y medición
- Tres estrategias núcleo: FTS-solo (`spanish` + unaccent), semántico-solo (baseline actual `match_proyectos`, piso 0.59), RRF FTS∪semántico (patrón oficial Supabase: fusión por RANK, jamás suma ponderada de scores). Opcional cuarta variante: contribución `pg_trgm` como fallback fuzzy si FTS+RRF no cubre typos.
- Grid de parámetros medido, no asumido: `rrf_k` (50 como punto de partida ± vecinos), límite de candidatos por rama (20/50/100), pesos A/B/C del tsvector si aplica.
- FTS durante el spike corre con expresiones ad-hoc `to_tsvector('spanish', f_unaccent-equivalente inline)` en queries de SOLO lectura — sin crear columnas, índices ni funciones (corpus ~3.6k lo tolera sin índice). CERO huella de schema.
- `websearch_to_tsquery` SIEMPRE para el input del usuario (jamás `to_tsquery` crudo — pitfall #3, 500s con `sub-secretaría`/`16733-07`).
- Criterio de victoria: la estrategia elegida debe ARREGLAR las categorías literal/boletín Y no regresionar las categorías NL/similares vs el baseline semántico.

### Ejecución del spike (harness)
- CLI TS local, read-only, siguiendo el patrón de CLIs existente del repo; conexión vía `SUPABASE_DB_URL` con el patrón establecido `PGCLIENTENCODING=UTF8 psql` (o cliente pg equivalente si ya existe en packages — discreción según lo que el repo ya tenga).
- Embeddings de las queries del golden set: reusar el contrato Gemini existente (`RETRIEVAL_QUERY`, 768 dims, L2 — espejo de `app/lib/buscar.ts::defaultEmbedder`), con caché local en archivo para reproducibilidad y respeto de rate-limit.
- Regla dura: el harness JAMÁS ejecuta DDL/DML contra PROD. Solo SELECT.
- Baseline reproducible: mismo corpus, mismos embeddings cacheados, salida de scoring en archivo versionable (tabla por estrategia × categoría).

### Registro de decisión + regresión permanente
- Decisión registrada en el SUMMARY de la fase: algoritmo elegido, pesos, `rrf_k`, límite de candidatos, y el plan de flag (RPC vieja `match_proyectos` se CONSERVA; la híbrida entra tras flag hasta dominar el golden set — el flag y el rewire son de fase 87).
- Golden set queda como test de regresión permanente: test vitest que corre el scoring cuando hay credenciales DB en el entorno y se SKIPEA honesto sin ellas (patrón skip-sin-env), + ejecutable como CLI para gates locales. `match_proyectos` ("proyectos similares") entra al set para que la híbrida no lo rompa.
- Gate de 87 explícito: sin dominación demostrada sobre el golden set, no hay rewire.

### Claude's Discretion
- Ubicación exacta del harness (packages/ vs scripts/) y formato exacto del fixture — seguir convenciones del repo.
- Selección concreta de las ≥30 queries (derivarlas del corpus real; distribuir razonablemente entre categorías).
- Si psql-parse o cliente pg programático — lo que menos fricción tenga con lo ya existente.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/lib/buscar.ts` — capa actual: `buscarProyectos` (trim/cap 300, atajo `BOLETIN_RE` → redirect, embed Gemini RETRIEVAL_QUERY 768 L2, `rpc match_proyectos` piso 0.59). El atajo de boletín actual SOLO cubre formato `\d{3,6}(-\d{1,2})?` — el formato `14.309-04` (con punto) NO matchea hoy: caso obligatorio del golden set.
- `supabase/migrations/0011_fichas_embeddings.sql` — RPC `match_proyectos` (kNN pgvector, HNSW 768).
- `supabase/migrations/0032_agenda_search.sql` — template FTS probado en repo (`buscar_citaciones`, FTS spanish): referencia para las expresiones ad-hoc del spike y para el SQL de 87.
- `app/lib/lockdown-guard.test.ts` — `PUBLIC_RPC_ALLOWLIST` (la RPC nueva de 87 deberá entrar ahí; el spike no toca esto).
- CLIs de ingesta existentes en packages (patrón `*-cli` + `.env` + psql UTF8) — patrón para el harness.

### Established Patterns
- Server-only para todo lo que toca Gemini/Supabase; `.rpc()` parametrizado.
- `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` para SQL directo (NUNCA `db push`).
- PostgREST cap 1k → paginar `.order().range()` siempre (si el harness lee corpus vía supabase-js).
- Tests vitest con inyección de dependencias (embedder mockeable en `buscar.test.ts`).

### Integration Points
- El spike NO integra nada al runtime del sitio. Sus productos (golden set + scoring + decisión) alimentan la fase 87 (migración + RPC híbrida + rewire de `buscar.ts`).
- Corpus objetivo: tabla `proyecto` (título, idea matriz, normas) + embeddings de fichas existentes (84,6% cobertura — los proyectos SIN embedding son en sí un caso de medición: FTS los encuentra, el semántico no).

</code_context>

<specifics>
## Specific Ideas

- ROADMAP §86 + research/SUMMARY.md + research/STACK.md ya especifican el SQL candidato (RRF sobre rank, `rrf_k=50` punto de partida, pesos A título/B idea matriz/C normas) — el spike los TRATA como hipótesis a medir, no como decisión tomada.
- El bug estrella documentado: `/buscar` solo-semántico falla con palabras LITERALES del título y con boletines en formatos no cubiertos por `BOLETIN_RE`. El golden set debe contener los casos exactos que hoy fallan.
- Proyectos sin embedding (15,4% del corpus) son evidencia clave a favor del camino híbrido: medir cuántos golden-hits caen ahí.

</specifics>

<deferred>
## Deferred Ideas

- Migración/índices/RPC híbrida/flag/rewire → fase 87 (gated por esta).
- Filtros client-side y ranking explicable → fase 88.
- Deep-links de validación → fase 89.

</deferred>
