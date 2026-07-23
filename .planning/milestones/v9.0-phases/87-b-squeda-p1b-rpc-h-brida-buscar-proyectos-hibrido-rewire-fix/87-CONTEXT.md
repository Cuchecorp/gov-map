# Phase 87: BÚSQUEDA P1b — RPC híbrida `buscar_proyectos_hibrido` + rewire (fix del bug estrella) - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recomendaciones auto-aceptadas por directiva del operador, PROMPT-v9.0)

<domain>
## Phase Boundary

Implementar la decisión del SPIKE 86 en producción: migración de búsqueda (unaccent + tsvector con pesos + índices), RPC `buscar_proyectos_hibrido` (boletín short-circuit + FTS + kNN fusionados por RRF), rewire de `app/lib/buscar.ts` tras flag, y gate de dominancia con el golden set live. NO entrega: UI de filtros/ranking (88), deep-links (89). `match_proyectos` queda INTACTA (la usa "proyectos similares").

</domain>

<decisions>
## Implementation Decisions

### Decisión del SPIKE (LOCKED por evidencia — 86-SCORING.md, no rediscutir)
- Algoritmo: RRF FTS∪semántico por RANK, `rrf_k=50`, límite 50 por rama, w_fts=w_sem=1.
- Boletín short-circuit determinista FUERA del RRF, en SQL: match exacto sobre `boletin` O prefix-match determinista sobre número base (`14309` → `14309-04`), cubriendo los 3 formatos (`14309-04`, `14309`, `14.309-04` normalizado).
- REQUISITO DURO: `CREATE EXTENSION IF NOT EXISTS unaccent` + wrapper IMMUTABLE (o config `es_unaccent` custom per ROADMAP) en la migración — PROD NO lo tiene (medido); el FTS del spike corrió sin unaccent, con la híbrida solo puede mejorar.
- Pesos tsvector: A=título, B=idea matriz, C=normas/cuerpos legales.
- `websearch_to_tsquery` SIEMPRE, misma config en índice y consulta; jamás `to_tsquery` crudo.

### Migración y schema (research resolverá el punto abierto)
- Nueva migración con el siguiente número libre (>0054), patrón `0032_agenda_search` como template; cero `grant … to anon` (post-0044).
- PUNTO ABIERTO CLAVE (para research): el ROADMAP pide tsvector STORED con pesos A/B/C, pero `idea_matriz` y `cuerpos_legales` viven en `proyecto_ficha` (1:1 aparte), NO en `proyecto` — una columna generada no puede referenciar otra tabla. Research debe leer el schema real (0005, 0011, migración de fichas) y decidir: tsv en `proyecto_ficha` + join, trigger de sincronización, o tsv por tabla con OR de rangos ponderados. Criterio: simplicidad + índice GIN usable + sin deuda de sincronización silenciosa.
- `pg_trgm` se instala si el diseño lo usa (fallback fuzzy); no obligatorio si FTS+unaccent cubre el golden set.
- Índices: GIN sobre el/los tsvector; ningún cambio a HNSW existente.
- pgTAP post-apply test (patrón post-apply/ existente) verificando: RPC existe con firma esperada, anon DENEGADO, extension unaccent presente.

### RPC `buscar_proyectos_hibrido` (la aguja de todo camino público nuevo)
- SECURITY DEFINER, PII-safe: devuelve SOLO (boletin, rank) — nada más.
- Firma: `(q text, query_embedding vector(768), match_count int default 20)` — el embedding lo genera el server (buscar.ts) como hoy; el texto `q` va para FTS/boletín.
- Bounded desde el día 1 (no esperar fase 95): cap duro de `match_count` (LEAST con 50), LIMIT interno por rama (50), `SET statement_timeout` local en la función.
- Entrada en `PUBLIC_RPC_ALLOWLIST` (`app/lib/lockdown-guard.test.ts`) + revoke/grant pattern de las RPCs existentes (service_role vía `.rpc()`; anon muerto).
- El input `q` se sanitiza solo con parametrización (`.rpc()` parametriza; dentro del SQL, `websearch_to_tsquery` tolera input arbitrario sin 500s).

### Rewire + flag + gate de dominancia
- `app/lib/buscar.ts`: flag `BUSQUEDA_HIBRIDA_ENABLED` (env server-only). OFF → camino actual (match_proyectos). ON → `buscar_proyectos_hibrido`. El atajo `BOLETIN_RE` → redirect se CONSERVA y se EXTIENDE al formato punteado (`14.309-04` hoy no matchea — caso del golden set); el short-circuit SQL cubre lo que el redirect no capture.
- Gate de dominancia EN ESTA FASE: correr el golden live test (86) contra la RPC real vía el flag ON; si la híbrida domina (≥ baseline semántico en NL/similares Y arregla literal/boletín), se flipea el default a ON en el mismo commit documentado. Si NO domina, default queda OFF y se registra hallazgo (no se fuerza).
- "Proyectos similares" (SEM-05) sigue en `match_proyectos` — cero cambios en ese camino.
- El harness spike (packages/fichas/src/spike/) se REUSA para medir la RPC real (estrategia nueva `rpc-hibrida` o flag del CLI) — mismo golden set congelado.

### Aplicación a PROD
- `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (NUNCA `db push`), patrón de ledger/schema_migrations reconciliado como en 0053/0054.
- Gate previo a aplicar: revisión de seguridad (agente supabase-reviewer o checklist equivalente en el plan: cero grant anon, definer con search_path fijado, caps presentes, retorno PII-safe).
- Migración ADITIVA (extension + columna/tabla tsv + índices + función): sin DROP, sin cambio de tipo, sin backfill destructivo → no requiere checkpoint de operador (los checkpoints de v9.0 son otros: MONEY/NET flags, sign-offs, B26).

### Claude's Discretion
- Nombre/número exacto de la migración; detalles del wrapper unaccent (función IMMUTABLE vs text search config custom) según lo que el template 0032 y Postgres 15 soporten mejor.
- Si el tsv termina en `proyecto_ficha`, cómo manejar proyectos SIN ficha (15.3% sin embedding hoy; FTS debe cubrirlos al menos por título — criterio: ningún proyecto queda INBUSCABLE por texto).
- Wiring exacto del CLI spike para medir la RPC real.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/0032_agenda_search.sql` — template FTS spanish probado (websearch_to_tsquery + GIN).
- `supabase/migrations/0011_fichas_embeddings.sql` — `match_proyectos` (RPC kNN, threshold 0.59) — NO tocar; referencia de firma/definer/grants.
- `packages/fichas/src/spike/` — golden set congelado (32), scorer MRR@5, estrategias, CLI, live test env-gated: el instrumento de medición del gate de dominancia.
- `app/lib/buscar.ts` — capa a recablear (flag + RPC nueva); `BOLETIN_RE` a extender con formato punteado (usar la lógica de `spike/boletin.ts::detectarBoletin`).
- `app/lib/lockdown-guard.test.ts` — `PUBLIC_RPC_ALLOWLIST` (agregar la RPC nueva).
- `supabase/tests/post-apply/` — patrón pgTAP post-apply (0044/0045) para el deny-anon de la RPC nueva.
- Patrón de gates de env: `lib/cruces-gate.test.ts`, `money-gate`, `net-gate` — para `BUSQUEDA_HIBRIDA_ENABLED`.

### Established Patterns
- Migraciones por psql UTF8 --single-transaction; ledger schema_migrations reconciliado.
- RPC security-definer PII-safe con revoke público + service_role only (0042-0045 lineage).
- Flags server-only leídos de env con default deny (patrón *_PUBLIC_ENABLED — aunque este flag es interno de camino, no de publicación de datos).

### Integration Points
- `app/buscar/page.tsx` consume `buscarProyectos` — el contrato (boletin+similarity/rank server-side) se mantiene; UI no cambia en esta fase.
- Datos reales: `proyecto` (3.659), `proyecto_ficha` (idea_matriz, cuerpos_legales jsonb), `proyecto_embedding` (3.100 = 84.7%).
- unaccent AUSENTE en PROD (medido 86) — la migración lo instala.

</code_context>

<specifics>
## Specific Ideas

- 86-SCORING.md es la fuente de la decisión: RRF domina (43.8/68.8/53.6 vs 34.4/53.1/40.3 del semántico). Los números del FTS del spike (9.4%) SUBESTIMAN el potencial (sin unaccent, sin índice) — la RPC real con unaccent debe superar eso.
- Success criterion #1 es absoluto: boletín en cualquier formato SIEMPRE #1. El spike lo logró 4/4 con short-circuit; la RPC debe replicarlo en SQL (boletin exacto OR boletin_num prefix).
- Golden live test post-fase = test de regresión permanente ya montado (vitest.live.config.ts): esta fase solo le agrega el modo RPC-real.

</specifics>

<deferred>
## Deferred Ideas

- Filtros client-side, ranking mensaje>moción, recencia → fase 88.
- Deep-links de validación → fase 89.
- Retiro definitivo del camino viejo de /buscar (borrar flag) → tras estabilidad, fase 95/96 o v9.x.

</deferred>
