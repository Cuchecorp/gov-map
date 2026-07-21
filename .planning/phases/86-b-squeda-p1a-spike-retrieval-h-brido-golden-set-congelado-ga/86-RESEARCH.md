# Phase 86: BÚSQUEDA P1a — SPIKE retrieval híbrido + golden set congelado (GATE de 87) - Research

**Researched:** 2026-07-21
**Domain:** Empirical retrieval SPIKE — FTS `spanish`+unaccent vs semantic (pgvector kNN) vs RRF, scored over a frozen golden set, read-only against PROD. TS/Node monorepo (tsx), Supabase PG15.
**Confidence:** HIGH (repo patterns, schema, and DB-access idioms verified by direct file reads; RRF/FTS mechanics verified in milestone research `.planning/research/STACK.md`+`PITFALLS.md`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Golden set: composición y formato**
- Fixture JSON versionado en el repo (congelado por commit), con `query`, `expected` (boletín/es esperados), `category` y notas por caso.
- ≥30 queries derivadas del corpus REAL de PROD, cubriendo TODAS las clases mandatadas: título literal, paráfrasis NL, normas/cuerpos legales, boletín en los 3 formatos (`14309-04`, `14309`, `14.309-04`), ñ/acentos/topónimos ("Ñuñoa", "Aysén", "medio ambiente"), y casos "proyectos similares" (no regresionar SEM-05).
- Métricas: hit@5 y MRR por categoría + agregado. Para queries de boletín el criterio es hit@1 (el boletín correcto SIEMPRE #1 — short-circuit determinista).
- El set queda CONGELADO al cierre de la fase: cambios posteriores requieren decisión explícita registrada.

**Estrategias candidatas y medición**
- Tres estrategias núcleo: FTS-solo (`spanish` + unaccent), semántico-solo (baseline actual `match_proyectos`, piso 0.59), RRF FTS∪semántico (patrón oficial Supabase: fusión por RANK, jamás suma ponderada de scores). Opcional cuarta variante: `pg_trgm` como fallback fuzzy.
- Grid de parámetros medido, no asumido: `rrf_k` (50 ± vecinos), límite de candidatos por rama (20/50/100), pesos A/B/C del tsvector si aplica.
- FTS durante el spike corre con expresiones ad-hoc `to_tsvector('spanish', f_unaccent-equivalente inline)` en queries de SOLO lectura — sin crear columnas, índices ni funciones. CERO huella de schema.
- `websearch_to_tsquery` SIEMPRE (jamás `to_tsquery` crudo).
- Criterio de victoria: la estrategia elegida debe ARREGLAR literal/boletín Y no regresionar NL/similares vs el baseline semántico.

**Ejecución del spike (harness)**
- CLI TS local, read-only, siguiendo el patrón de CLIs existente; conexión vía `SUPABASE_DB_URL` con el patrón `PGCLIENTENCODING=UTF8 psql` (o cliente pg equivalente si ya existe — discreción según lo que el repo tenga).
- Embeddings de queries: reusar el contrato Gemini existente (`RETRIEVAL_QUERY`, 768, L2 — espejo de `app/lib/buscar.ts::defaultEmbedder`), cacheados en archivo para reproducibilidad.
- Regla dura: el harness JAMÁS ejecuta DDL/DML contra PROD. Solo SELECT.
- Baseline reproducible: mismo corpus, mismos embeddings cacheados, salida de scoring en archivo versionable.

**Registro de decisión + regresión permanente**
- Decisión registrada en el SUMMARY: algoritmo, pesos, `rrf_k`, límite de candidatos, plan de flag (`match_proyectos` se CONSERVA; la híbrida entra tras flag hasta dominar el golden set — flag y rewire son fase 87).
- Golden set queda como test de regresión permanente (vitest que corre el scoring con credenciales DB, SKIP honesto sin ellas) + ejecutable como CLI. `match_proyectos` entra al set.
- Gate de 87 explícito: sin dominación demostrada sobre el golden set, no hay rewire.

### Claude's Discretion
- Ubicación exacta del harness (packages/ vs scripts/) y formato exacto del fixture — seguir convenciones del repo.
- Selección concreta de las ≥30 queries (derivarlas del corpus real; distribuir entre categorías).
- Si psql-parse o cliente pg programático — lo que menos fricción tenga con lo ya existente.

### Deferred Ideas (OUT OF SCOPE)
- Migración/índices/RPC híbrida/flag/rewire → fase 87 (gated por esta).
- Filtros client-side y ranking explicable → fase 88.
- Deep-links de validación → fase 89.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RETR-03 | Retrieval híbrido keyword ∪ semántico elegido por SPIKE empírico con golden queries | `## Standard Stack` (psql read-only + Gemini query-embed cache), `## Architecture Patterns` (3-strategy harness), `## Code Examples` (ad-hoc FTS SELECT, RRF-in-TS, semantic via `.rpc(match_proyectos)`), golden-set fixture pattern mirrored from `packages/fichas/src/golden/` |
| RETR-04 | Golden set congelado ≥30 queries como test de regresión permanente en CI (skip-sin-env) | `## Architecture Patterns` (`.live.test.ts` + `vitest.live.config.ts` + `describe.skip`-gate pattern from `packages/votos`), `## Code Examples` (scoring harness with hit@1/hit@5/MRR), `## Common Pitfalls` (golden-gate honesty) |
</phase_requirements>

## Summary

Phase 86 is a **pure read-only empirical SPIKE**: it measures three retrieval strategies (FTS-only, semantic-only, RRF) against a frozen ≥30-query golden set derived from the real PROD corpus, and registers a data-driven decision (algorithm, weights, `rrf_k`, candidate limit, flag plan). It writes NO schema — FTS is exercised via ad-hoc `to_tsvector('spanish', unaccent(...))` expressions inside read-only SELECTs (the ~3.6k-row corpus tolerates no index). The milestone research (`.planning/research/`) already settled the *mechanics* (RRF on rank, `websearch_to_tsquery`, `f_unaccent` immutability, boletín short-circuit); this phase's research answers the *repo-integration* questions the planner needs: where the corpus columns live, how the harness talks to the DB, how the golden test skips-without-env, and how scoring is reported.

The single most important discovery: **the repo has two distinct DB-access idioms, and the spike needs BOTH.** (1) Arbitrary SQL (the ad-hoc FTS, `websearch_to_tsquery`, counting embeddings) can only run through **`psql "$SUPABASE_DB_URL"`** — PostgREST/supabase-js cannot express `to_tsvector`/FTS. `psql` 17.9 is on PATH and the exact read-only pattern already exists in `scripts/verify-cobertura.sql` (`psql "$SUPABASE_DB_URL" -At -f`). (2) The **semantic baseline is already a callable RPC** — `match_proyectos(query_embedding, match_count, match_threshold, exclude_boletin)` — reachable via either `psql` (`select * from match_proyectos(...)`) or supabase-js `.rpc()`. There is **no `pg` npm dependency anywhere** in the monorepo; adding one is unnecessary — shelling out to `psql` (or `psql -f` a temp SQL file / heredoc via stdin) matches the established `scripts/*.sql` + `run-with-env.mjs` pattern and adds zero deps.

**Primary recommendation:** Build the harness as a **new `spike/` module inside `packages/fichas/`** (it already owns `golden/`, embeddings, and Supabase reads) OR a self-contained `packages/retrieval-spike/` package; run it with `tsx` via `run-with-env.mjs`; embed the ≥30 golden queries with a **verbatim copy of `app/lib/buscar.ts::defaultEmbedder`** (Gemini REST, `RETRIEVAL_QUERY`, 768, L2) cached to a JSON file; run all three strategies through `psql -At` (CSV/tab output), compute RRF in TypeScript from the two rank lists, and emit a `estrategia × categoría` table (hit@1/hit@5/MRR). Register the golden set as a `retrieval-golden.live.test.ts` gated by an env flag + a dedicated `vitest.live.config.ts` (exact pattern from `packages/votos`), plus the CLI for local gates. **`match_proyectos` and the piso 0.59 must be a golden category so the hybrid does not break "proyectos similares."**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ad-hoc FTS `to_tsvector`/`websearch_to_tsquery` over corpus | Database (psql, SELECT-only) | — | PostgREST cannot express arbitrary SQL/FTS; only `psql "$SUPABASE_DB_URL"` can. Read-only. |
| Semantic kNN (baseline) | Database (`match_proyectos` RPC) | Harness (TS) | RPC already exists (0011); harness supplies the query vector, DB does the kNN + HNSW order. |
| Query embedding (`RETRIEVAL_QUERY`, 768, L2) | Harness (TS, Gemini REST) | Filesystem cache | Mirror `buscar.ts::defaultEmbedder` exactly; cache to file for reproducibility + rate-limit respect. |
| RRF fusion (rank merge) | Harness (TS) | — | Spike computes RRF in TS from the two rank lists (no schema); fusion-on-rank needs no normalization. |
| Scoring (hit@1/hit@5/MRR per category) | Harness (TS) | — | Pure computation over golden `expected` vs strategy output. |
| Golden set (frozen fixture) | Filesystem (versioned JSON/TS) | — | Committed, immutable at phase close; consumed by CLI + live test. |
| Regression gate | vitest (`.live.test.ts`, env-gated) | CLI | Skip-sin-env in CI; runs the scoring when `SUPABASE_DB_URL`+`GEMINI_API_KEY` present. |

## Standard Stack

### Core (all already in the repo — ZERO new runtime deps for the spike core)

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `psql` | 17.9 (on PATH) | Read-only ad-hoc SQL: FTS `to_tsvector`/`websearch_to_tsquery`, semantic RPC call, corpus/embedding counts | `[VERIFIED: psql --version → 17.9]`. Established repo idiom for direct DB SQL (`scripts/verify-cobertura.sql`, migrations). Only path for arbitrary SQL — PostgREST can't do FTS. |
| `tsx` | 4.22.4 | Run the TS harness/CLI | `[VERIFIED: npx --no-install tsx --version → 4.22.4]`. Every CLI in the repo runs under tsx (`freshness` root script, `pipeline-cli`). |
| `@supabase/supabase-js` | ^2.108.2 | (Optional) semantic baseline via `.rpc("match_proyectos")` if TS-side preferred over psql | `[VERIFIED: app + packages depend on it]`. Already the app's search path. |
| Gemini REST `batchEmbedContents` (via `fetch`) | `gemini-embedding-001`, 768 dims, L2 | Embed the 30+ golden queries as `RETRIEVAL_QUERY` | `[VERIFIED: app/lib/buscar.ts:99-156]`. Must MIRROR `defaultEmbedder` verbatim — see pitfall below on why `@obs/llm` can't be reused directly. |
| `scripts/run-with-env.mjs` | in-repo | BOM-safe `.env` → `process.env` loader for the CLI | `[VERIFIED: scripts/run-with-env.mjs]`. Also mirrored as inline `loadEnv` in `*.live.test.ts` (votos). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^3.0.0 | The permanent golden regression test | `[VERIFIED: packages/*/vitest]`. Use the `.live.test.ts` + separate `vitest.live.config.ts` split (votos pattern) so CI's normal suite EXCLUDES the live test and it's `describe.skip` without env. |
| `findWorkspaceRoot` | `@obs/tramitacion` export | Locate repo root to read `.env` from a test/CLI | `[VERIFIED: packages/tramitacion/src/ingest-cli.ts:149 export]`. Used by votos live tests. |
| `zod` | (in `@obs/fichas`) | (Optional) validate golden fixture shape / psql JSON output | `[VERIFIED: fichas depends on zod]`. Only if you want a schema gate on the fixture. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `psql "$SUPABASE_DB_URL"` for ad-hoc FTS | `pg` npm client (node-postgres) | `pg` is NOT a dependency anywhere `[VERIFIED: grep across all package.json → none]`; adding it needs `pnpm-workspace.yaml onlyBuiltDependencies` review + slopcheck. `psql` is already the repo idiom and adds nothing. Prefer `psql` unless the planner wants programmatic parsing without shelling out. |
| psql for semantic baseline | supabase-js `.rpc("match_proyectos", …)` | supabase-js is cleaner for the ONE existing RPC (returns JSON, no CSV parsing) but PostgREST caps at 1000 rows (irrelevant here, match_count≤100) and still can't do the FTS arm — so you need psql regardless. Simplest: do BOTH arms in psql for uniformity. |
| New `packages/retrieval-spike/` | `packages/fichas/src/spike/` | fichas already owns `golden/`, Supabase reads, and the Gemini contract sibling — lower friction. A new package is cleaner isolation but needs a `package.json`+`vitest.config.ts`+`tsconfig` scaffold. Claude's discretion; fichas is the path of least resistance. |
| Copy `defaultEmbedder` into the harness | Import `app/lib/buscar.ts` | `buscar.ts` is `import "server-only"` and Next-coupled (`next/navigation`) — cannot be imported into a package/CLI. Copy the `defaultEmbedder` REST logic (with `RETRIEVAL_QUERY`) into the harness. |
| Copy `defaultEmbedder` | Reuse `@obs/llm` `GeminiEmbeddingProvider` | `[VERIFIED: packages/llm/src/types.ts:87]` its `embed(texts)` interface takes NO `taskType` — it cannot emit `RETRIEVAL_QUERY`. Query-side asymmetry (SEM-03) requires the taskType, which is exactly why `buscar.ts` re-implements the REST call. Mirror `buscar.ts`, not `@obs/llm`. |

**Installation:** No `pnpm add` needed for the core. If a `pg` client is chosen (not recommended), it must pass the Package Legitimacy Audit + `onlyBuiltDependencies` review.

```bash
# No new deps. Run the harness (from repo root):
node scripts/run-with-env.mjs pnpm --filter @obs/fichas exec tsx src/spike/retrieval-cli.ts --report out.md
# psql read-only probe (env already loaded):
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -At -f <ad-hoc-fts.sql>
```

## Package Legitimacy Audit

The spike core adds **NO external packages** — every tool (`psql`, `tsx`, `@supabase/supabase-js`, `vitest`, `zod`, `@obs/*` workspace) is already present in the monorepo and pinned in existing `package.json`/lockfile. slopcheck/registry verification is **N/A** because no `npm install` occurs.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No new external dependency introduced by this phase. |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> If the planner elects to add `pg` (node-postgres) instead of shelling to `psql`, that ONE package must then run the full Package Legitimacy Gate (slopcheck + `npm view pg version` + postinstall check) and be added to `pnpm-workspace.yaml onlyBuiltDependencies` if it ships a build script. Recommendation: avoid it — `psql` is already the idiom.

## Architecture Patterns

### System Architecture Diagram

```
golden-set.ts (≥30 queries, frozen)          .env (SUPABASE_DB_URL, GEMINI_API_KEY)
   │  {query, expected[], category, nota}        │  (loaded BOM-safe via run-with-env / loadEnv)
   ▼                                              ▼
┌─────────────────────────── retrieval-spike harness (tsx, read-only) ───────────────────────────┐
│                                                                                                 │
│  1. boletín detector  ──►  is q a boletín (3 formats)? ──► short-circuit: expected #1 (hit@1)   │
│                                                                                                 │
│  2. query embed (Gemini REST, RETRIEVAL_QUERY, 768, L2)  ──►  file cache (query → vector)       │
│         └── mirror of app/lib/buscar.ts::defaultEmbedder                                         │
│                                                                                                 │
│  3. THREE strategies, each returns a ranked list of boletines:                                  │
│     ┌── FTS-only ───────►  psql: to_tsvector('spanish', unaccent(titulo||idea_matriz||normas))  │
│     │                             @@ websearch_to_tsquery('spanish', unaccent(q)); ts_rank_cd   │
│     ├── Semantic-only ──►  psql `select * from match_proyectos(:vec, N, 0.59)`  (or .rpc())     │
│     └── RRF (TS merge) ─►  fuse FTS.rank_ix + Semantic.rank_ix by 1/(rrf_k+rank) (rank, not sum) │
│                                                                                                 │
│  4. score each strategy × category:  hit@1 (boletín), hit@5, MRR   (expected vs ranked list)    │
│                                                                                                 │
└──────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                            ▼
                         scoring-report.md  (estrategia × categoría table)  ──►  DECISION in 86-SUMMARY
                                            │
                         retrieval-golden.live.test.ts  (env-gated; asserts winner dominates baseline)
```

### Recommended Project Structure (Claude's discretion — fichas path shown)

```
packages/fichas/src/spike/            # OR new packages/retrieval-spike/
├── golden-set.ts                     # ≥30 frozen queries: {id, query, expected[], category, nota}
├── embed-query.ts                    # verbatim mirror of buscar.ts::defaultEmbedder (RETRIEVAL_QUERY)
├── embed-cache.ts                    # query-text → vector JSON cache (committed for reproducibility)
├── strategies.ts                     # runFtsOnly / runSemanticOnly / runRrf → boletin[] (ranked)
├── psql.ts                           # thin exec wrapper: psql "$SUPABASE_DB_URL" -At (read-only)
├── score.ts                          # hit@1 / hit@5 / MRR per category + aggregate
├── retrieval-cli.ts                  # tsx entry: parseArgs → run all strategies → write report
└── retrieval-golden.live.test.ts     # env-gated regression gate (describe.skip without env)
packages/fichas/vitest.live.config.ts # include: ["src/**/*.live.test.ts"] (NOT in normal suite)
```

### Pattern 1: Read-only ad-hoc SQL via psql (established repo idiom)

**What:** Run arbitrary SELECT-only SQL (FTS, counts) against PROD without touching schema.
**When to use:** The FTS arm, embedding-coverage counts — anything PostgREST can't express.
**Example:**
```bash
# Source: scripts/verify-cobertura.sql header (verified in-repo)
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -At -f scripts/<probe>.sql
# -At = tuples-only, unaligned (easy TS parse). Add -F',' or --csv for CSV.
# --single-transaction + read-only enforced by writing only SELECTs (spike rule: zero DDL/DML).
```

### Pattern 2: Env-gated LIVE test with dedicated config (votos idiom)

**What:** A regression test that runs against the live DB when env is present, and honestly skips (not fails) otherwise; excluded from the normal CI suite.
**When to use:** The permanent golden gate (RETR-04).
**Example:**
```typescript
// Source: packages/votos/src/spike-votacion-detalle.live.test.ts + vitest.live.config.ts (verified)
const LIVE = !!process.env.SUPABASE_DB_URL && !!process.env.GEMINI_API_KEY;
(LIVE ? describe : describe.skip)("retrieval golden — hybrid dominates baseline", () => {
  it("winner ≥ baseline on literal/boletín AND no regression on NL/similares", async () => { /* score + assert */ });
});
// vitest.live.config.ts: include: ["src/**/*.live.test.ts"]; normal vitest.config.ts EXCLUDES it.
// Run: SUPABASE_DB_URL=... GEMINI_API_KEY=... pnpm --filter @obs/fichas exec vitest run --config vitest.live.config.ts
```

### Pattern 3: Golden fixture mirroring the fichas golden-set

**What:** A committed, typed fixture with per-case category + expected + notes, plus a pure `evaluar*` scorer — exactly the shape already proven in `packages/fichas/src/golden/golden-set.ts`.
**When to use:** The golden query set + scorer (RETR-03/04).
**Example:** Reuse the `CasoGolden` / `evaluarGolden` structure: `{ id, category, query, expected: string[], nota }` and a `evaluarRetrieval(set, ejecutarEstrategia) → { porCategoria: {hit1, hit5, mrr}, agregado }`. The fichas file even shows a `normalizarLiteral` (NFD + strip diacritics) helper you can reuse for accent-insensitive expected-matching.

### Anti-Patterns to Avoid

- **Importing `app/lib/buscar.ts`:** it's `server-only` + Next-coupled → copy `defaultEmbedder`, don't import.
- **Reusing `@obs/llm` GeminiEmbeddingProvider for queries:** its `embed()` has no `taskType` → cannot produce `RETRIEVAL_QUERY` (breaks SEM-03 asymmetry). Mirror `buscar.ts`.
- **Weighted score sum (cosine + ts_rank):** LOCKED-forbidden; RRF on rank only.
- **`to_tsquery` on raw input:** LOCKED-forbidden; `websearch_to_tsquery` always (500s on `sub-secretaría`/`16733-07`).
- **Boletín inside RRF:** short-circuit exact match BEFORE fusion; a boletín query must be hit@1.
- **Any DDL/DML in the harness:** SELECT-only, no `create`/`alter`/`insert`/`update` — even a temp `f_unaccent()` function is a schema footprint the spike forbids; inline `unaccent(...)` in the SELECT instead.
- **Un-committed embedding cache:** commit the query→vector cache so the golden run is reproducible and doesn't re-hit Gemini in CI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB access for arbitrary SQL | A new `pg` connection layer | `psql "$SUPABASE_DB_URL" -At` | Established idiom; zero new deps; read-only by construction. |
| Semantic kNN baseline | Re-implement cosine kNN in TS | `match_proyectos(...)` RPC (0011) | Already the baseline the spike must NOT regress; HNSW-indexed. |
| Query embedding | New Gemini client | Copy `buscar.ts::defaultEmbedder` | Must match the app's exact contract (768/L2/RETRIEVAL_QUERY) or the baseline comparison is invalid. |
| Env loading | Custom dotenv | `run-with-env.mjs` / inline `loadEnv` | BOM-safe (repo `.env` has a BOM); already solved twice. |
| Golden fixture + scorer | New abstraction | Mirror `packages/fichas/src/golden/` | Same team pattern; typed cases, categories, pure scorer, live-gate — already reviewed and shipped. |
| RRF | Search library | ~10 lines of TS over two rank lists | Fusion-on-rank is `Σ 1/(rrf_k + rank_ix)`; no library, no normalization. |

**Key insight:** The spike is 95% *wiring proven repo pieces together* (psql + match_proyectos + defaultEmbedder + golden-set + live-test-gate). The only genuinely new logic is (a) the ad-hoc `spanish`+unaccent FTS SELECT, (b) the TS RRF merge, and (c) the hit@1/hit@5/MRR scorer.

## Runtime State Inventory

> Not a rename/refactor phase. Included briefly because the phase reads PROD state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Corpus lives in `proyecto` (titulo, iniciativa, camara_origen, autores[], materia, estado, etapa, boletin, boletin_num), `proyecto_ficha` (idea_matriz, cuerpos_legales jsonb), `proyecto_embedding` (vector(768), embedding_version) `[VERIFIED: 0008/0011 migrations]` | READ-ONLY. Spike selects; never writes. |
| Live service config | None touched | None — read-only. |
| OS-registered state | None | None. |
| Secrets/env vars | `SUPABASE_DB_URL`, `GEMINI_API_KEY` present in `.env` `[VERIFIED: .env key scan]` | Read only; never logged (Gemini key via header, never in messages — mirror `buscar.ts`). |
| Build artifacts | None | None. |

## Common Pitfalls

### Pitfall 1: Norma/cuerpos legales column assumed wrong
**What goes wrong:** `.planning/research/STACK.md` sketches `setweight(... coalesce(normas_afectadas,'') 'C')` — but there is **NO `normas_afectadas` column**. Normas live in `proyecto_ficha.cuerpos_legales` (jsonb array of `{norma, articulos[]}`) `[VERIFIED: 0011 migration]`.
**How to avoid:** For the FTS "normas" weight-C arm, flatten the jsonb (e.g. `jsonb_path_query_array` / `->>` extraction, or `array_to_string` over `cuerpos_legales`) into text in the ad-hoc SELECT. The title (weight A) is `proyecto.titulo`; idea matriz (weight B) is `proyecto_ficha.idea_matriz` (joined by boletin). Document the exact join in the spike so phase 87's generated column mirrors it.
**Warning signs:** FTS "normas" category scores 0 because the column doesn't exist.

### Pitfall 2: Embedding coverage gap silently skews the semantic arm
**What goes wrong:** ~15.4% of projects have no embedding (semantic can't find them; FTS can). The CONTEXT calls measuring this "evidencia clave". `proyecto_embedding` is a separate 1:1 table; `match_proyectos` only sees embedded rows.
**How to avoid:** Add a psql count (mirror `scripts/verify-cobertura.sql`): `proyecto` total, `proyecto_embedding` total, and the delta. Include ≥1 golden query whose expected boletín is a NON-embedded project (find one via `proyecto LEFT JOIN proyecto_embedding … WHERE embedding IS NULL`) so the scorer demonstrates FTS finds what semantic misses. Report per-golden-hit whether the target is embedded.
**Warning signs:** Semantic-only hit rate looks fine because every golden target happens to be embedded — the whole point is missed.

### Pitfall 3: Spanish FTS config / unaccent mismatch (from milestone PITFALLS #2)
**What goes wrong:** `unaccent()` is STABLE not IMMUTABLE; ñ/accents ("Ñuñoa", "Aysén", "medio ambiente") break asymmetrically; `spanish` stemmer misses partial words (politi/politic). In the spike there's no stored column, so use the **same `unaccent(...)` wrapping on BOTH sides** of the ad-hoc expression: `to_tsvector('spanish', unaccent(col)) @@ websearch_to_tsquery('spanish', unaccent(:q))`. (No `f_unaccent()` function — that's a schema object; inline `unaccent()` is fine in a read-only SELECT since immutability only matters for indexing.)
**How to avoid:** Put Ñuñoa/Aysén/"medio ambiente" cases IN the golden set (CONTEXT mandates them). Verify the same config string appears on index-expression and query side (here, both inline).
**Warning signs:** One accented term works, another returns empty.

### Pitfall 4: Golden set tuned by feel (milestone PITFALLS #1 — the load-bearing one)
**What goes wrong:** Choosing weights/`rrf_k` by eyeballing one query = anecdote; silently regresses NL/similares while fixing literal.
**How to avoid:** Freeze the ≥30 queries and their `expected` BEFORE running any strategy. Score all three strategies over the SAME frozen set + SAME cached embeddings. The decision is the numeric `estrategia × categoría` table, not a vibe. `match_proyectos`/similares is a category so RRF can't break it.
**Warning signs:** "It feels better." No before/after per category. A single blended float tuned by hand.

### Pitfall 5: Boletín format `14.309-04` (with dots) not detected
**What goes wrong:** The app's current `BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/` `[VERIFIED: app/lib/buscar.ts:28]` does NOT match `14.309-04` (dotted) — CONTEXT flags this as an obligatory golden case that fails today.
**How to avoid:** The spike's boletín detector must normalize all three forms (`14309-04`, `14309`, `14.309-04`) — strip dots, split base/suffix — and match `proyecto.boletin` (full) OR `proyecto.boletin_num` (base) `[VERIFIED: 0008 has both columns]`. `14309` (base only) should return `14309-04` (same number, any suffix). All three are hit@1 golden cases.
**Warning signs:** Dotted boletín falls through to FTS/semantic and doesn't hit@1.

## Code Examples

### Ad-hoc FTS arm (read-only, no schema) — corpus join
```sql
-- Source: composed from 0008 (proyecto) + 0011 (proyecto_ficha) schema + 0032 FTS template (all verified in-repo)
-- Weight A=titulo, B=idea_matriz, C=normas(from jsonb). Same unaccent() both sides. websearch_to_tsquery always.
with q as (select websearch_to_tsquery('spanish', unaccent(:q)) as tsq)
select p.boletin,
       ts_rank_cd(
         setweight(to_tsvector('spanish', unaccent(coalesce(p.titulo,''))), 'A') ||
         setweight(to_tsvector('spanish', unaccent(coalesce(f.idea_matriz,''))), 'B') ||
         setweight(to_tsvector('spanish', unaccent(coalesce(
             (select string_agg(c->>'norma',' ') from jsonb_array_elements(f.cuerpos_legales) c), ''))), 'C'),
         q.tsq) as rank
from proyecto p
left join proyecto_ficha f on f.boletin = p.boletin, q
where (setweight(to_tsvector('spanish', unaccent(coalesce(p.titulo,''))), 'A') ||
       setweight(to_tsvector('spanish', unaccent(coalesce(f.idea_matriz,''))), 'B')) @@ q.tsq
order by rank desc
limit 50;
-- NOTE: verify jsonb shape of cuerpos_legales against a live row before finalizing the string_agg.
```

### Semantic baseline arm (existing RPC, unchanged)
```sql
-- Source: 0011_fichas_embeddings.sql (verified). Spike supplies the cached query vector.
select boletin, similarity from match_proyectos(:query_embedding, 50, 0.59, null);
-- Or via supabase-js: sb.rpc("match_proyectos", { query_embedding, match_count: 50, match_threshold: 0.59, exclude_boletin: null })
```

### RRF merge in TypeScript (rank, not score)
```typescript
// Fuse two ranked boletin[] lists by reciprocal rank. No normalization, no library.
function rrf(fts: string[], sem: string[], rrfK = 50, wFts = 1, wSem = 1): string[] {
  const score = new Map<string, number>();
  fts.forEach((b, i) => score.set(b, (score.get(b) ?? 0) + wFts / (rrfK + i + 1)));
  sem.forEach((b, i) => score.set(b, (score.get(b) ?? 0) + wSem / (rrfK + i + 1)));
  return [...score.entries()].sort((a, z) => z[1] - a[1]).map(([b]) => b);
}
```

### Query embedder (verbatim mirror of buscar.ts::defaultEmbedder)
```typescript
// Source: app/lib/buscar.ts:99-156 (verified). Copy — do NOT import (server-only). taskType REQUIRED.
// POST {GEMINI_API_BASE}/v1beta/models/gemini-embedding-001:batchEmbedContents
// body.requests[].taskType = "RETRIEVAL_QUERY"; outputDimensionality = 768; key via x-goog-api-key header; L2-normalize.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Semantic-only `/buscar` (piso 0.59) | Hybrid FTS∪semantic via RRF | This milestone (v9.0) | Fixes literal-title + boletín misses; spike chooses the exact params |
| `BOLETIN_RE` matches `NNNNN-NN` / `NNNNN` only | Detector also matches dotted `14.309-04` | Phase 86/87 | Dotted boletín stops being a "no results" |

**Deprecated/outdated:**
- STACK.md's `normas_afectadas` column name — does NOT exist; use `proyecto_ficha.cuerpos_legales` jsonb.
- STACK.md's `embedding is not null` on `proyecto` — the embedding lives in the separate `proyecto_embedding` table, not on `proyecto`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `unaccent` extension is installed/enabled on the PROD Supabase DB | Code Examples (FTS) | LOW — Supabase ships `unaccent` as contrib; but the spike should probe `select unaccent('áé')` first and, if absent, degrade to `to_tsvector('spanish', ...)` without unaccent + note it (or accept that phase 87 enables it). VERIFY early. |
| A2 | The 15.4% no-embedding figure is current | Pitfalls #2 | LOW — measurable directly in the spike (count proyecto vs proyecto_embedding). Treat the exact % as measured-not-assumed; document the live count. |
| A3 | `cuerpos_legales` jsonb elements have a `norma` string key | Code Examples (FTS weight C) | MEDIUM — schema comment says `{norma, articulos}` but the spike must confirm against a live row before finalizing `string_agg(c->>'norma')`. |
| A4 | `SUPABASE_DB_URL` grants read access to `proyecto`/`proyecto_ficha`/`proyecto_embedding` under the connecting role | Standard Stack | LOW — it's the DB-owner/postgres URL used for migrations; full read. Probe with a `select count(*) from proyecto` first. |

## Open Questions

1. **Is `unaccent` enabled on PROD?**
   - What we know: Supabase ships it as contrib; other migrations use `spanish` FTS (0032) but not `unaccent`.
   - What's unclear: whether `create extension unaccent` was ever run.
   - Recommendation: First psql probe of the spike runs `select unaccent('Ñuñoa')`; if it errors, either (a) note it and run FTS without unaccent for the spike (accent cases will show the gap → evidence FOR enabling it in 87), or (b) ask operator to enable. Do NOT `create extension` from the spike (schema footprint forbidden).

2. **Exact `cuerpos_legales` jsonb shape in live data.**
   - What we know: 0011 declares `jsonb not null default '[]'`; fichas model uses `{norma, articulos[]}`.
   - What's unclear: whether all rows conform / are non-empty.
   - Recommendation: `select cuerpos_legales from proyecto_ficha where jsonb_array_length(cuerpos_legales) > 0 limit 5` before finalizing the weight-C extraction.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| psql | Ad-hoc read-only FTS + counts | ✓ | 17.9 | none needed |
| tsx | TS harness/CLI | ✓ | 4.22.4 | none needed |
| `SUPABASE_DB_URL` | psql connection to PROD | ✓ (in .env) | — | — |
| `GEMINI_API_KEY` | Query embedding | ✓ (in .env) | — | Use cached embeddings once generated |
| `unaccent` ext (PROD) | Accent-insensitive FTS | ? (probe) | — | FTS without unaccent (documents the gap) |
| `pg` npm client | (only if chosen over psql) | ✗ | — | psql (recommended) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `unaccent` on PROD (fallback: FTS sans unaccent, note as evidence for 87); `pg` (fallback: psql, recommended anyway).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | Normal: `packages/fichas/vitest.config.ts` (excludes live). NEW: `packages/fichas/vitest.live.config.ts` (include `src/**/*.live.test.ts`) — Wave 0 |
| Quick run command | `pnpm --filter @obs/fichas exec vitest run` (fixture-shape + scorer unit tests, no env) |
| Full suite command | `pnpm test` (root: `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`) |
| Live gate command | `SUPABASE_DB_URL=… GEMINI_API_KEY=… pnpm --filter @obs/fichas exec vitest run --config vitest.live.config.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RETR-03 | Golden ≥30 queries cover all mandated categories; scorer computes hit@1/hit@5/MRR | unit (no env) | `pnpm --filter @obs/fichas exec vitest run` | ❌ Wave 0 |
| RETR-03 | Winner strategy dominates baseline on literal/boletín, no regression on NL/similares | live (env-gated) | `… vitest run --config vitest.live.config.ts` | ❌ Wave 0 |
| RETR-04 | Golden set runs as permanent regression, SKIPS honestly without env | live (env-gated, `describe.skip`) | same as above | ❌ Wave 0 |
| RETR-04 | Boletín detector matches all 3 formats incl. dotted `14.309-04` | unit | `pnpm --filter @obs/fichas exec vitest run` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/fichas exec vitest run` (offline unit: fixture shape, boletín detector, RRF merge, scorer math).
- **Per wave merge:** root `pnpm test` (no regression elsewhere).
- **Phase gate:** live golden run green (with env) before `/gsd:verify-work`; scoring report + decision committed.

### Wave 0 Gaps
- [ ] `packages/fichas/src/spike/golden-set.ts` — ≥30 frozen queries covering RETR-03 categories
- [ ] `packages/fichas/src/spike/retrieval-golden.live.test.ts` — env-gated regression gate (RETR-04)
- [ ] `packages/fichas/src/spike/*.test.ts` — offline units for boletín detector, RRF merge, scorer
- [ ] `packages/fichas/vitest.live.config.ts` — live config (mirror `packages/votos/vitest.live.config.ts`)
- [ ] Committed embedding cache (query→vector) for reproducible live runs

## Security Domain

> `security_enforcement: true`, ASVS level 1. The spike is read-only against PROD, no new public surface, no UI — the attack surface is minimal, but the LOCKED project rules still apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Spike is a local operator CLI; no auth surface. |
| V3 Session Management | no | — |
| V4 Access Control | yes | `SUPABASE_DB_URL` is the privileged owner URL — spike must be READ-ONLY (SELECT only). No DDL/DML. Enforced by review + no write statements. |
| V5 Input Validation | yes | `websearch_to_tsquery` (never raw `to_tsquery`); query vector PARAMETRIZED to psql/`.rpc` (never string-interpolated); boletín detector strict regex. |
| V6 Cryptography | no | No new crypto. |
| V7 Error/Logging | yes | Gemini key via `x-goog-api-key` header, NEVER in URL/body/logs/error messages (mirror `buscar.ts`). Committed embedding cache holds vectors only, no key. |
| V12 Data Protection | yes | Spike touches only PUBLIC data (`proyecto`/ficha/embedding — no PII columns). Golden fixture stores boletines + public query strings only. No secrets committed (env from `.env`, not hardcoded). |

### Known Threat Patterns for this spike

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental write to PROD via owner URL | Tampering | SELECT-only harness; no `create`/`alter`/`insert`/`update`; code review asserts it. |
| SQL injection via golden query text | Tampering | `websearch_to_tsquery` + bind params via psql `-v`/parameterized or `.rpc()`; never interpolate `q` into SQL. |
| Gemini key leakage | Info Disclosure | Header-only key; never logged; `.env`-driven; committed cache is vectors only. |
| Committing a secret in the fixture/cache | Info Disclosure | Fixture = public queries + boletines; cache = float vectors; no env values in either. |

## Sources

### Primary (HIGH confidence — verified this session)
- `app/lib/buscar.ts` (BOLETIN_RE line 28; defaultEmbedder 99-156, RETRIEVAL_QUERY/768/L2; server-only) — repo read
- `supabase/migrations/0008_tramitacion.sql` (proyecto columns: titulo, boletin, boletin_num, iniciativa, materia, estado, etapa, autores[]) — repo read
- `supabase/migrations/0011_fichas_embeddings.sql` (proyecto_ficha.idea_matriz/cuerpos_legales jsonb; proyecto_embedding.vector(768); match_proyectos signature) — repo read
- `supabase/migrations/0032_agenda_search.sql` (FTS `spanish` + `websearch_to_tsquery` + `ts_rank` template; SECURITY INVOKER `set search_path=''`) — repo read
- `packages/fichas/src/golden/golden-set.ts` + `golden-set.test.ts` (golden fixture + `evaluar*` scorer + LIVE-gate-by-env pattern) — repo read
- `packages/votos/vitest.live.config.ts` + `spike-votacion-detalle.live.test.ts` (`.live.test.ts` split, `describe.skip` gate, BOM-safe `loadEnv`, `findWorkspaceRoot`) — repo read
- `packages/fichas/src/pipeline-cli.ts` + `writer-supabase.ts` (CLI arg-parse/env pattern; supabase-js `.from`/`.rpc`; PostgREST 1k pagination) — repo read
- `scripts/verify-cobertura.sql` + `scripts/run-with-env.mjs` (`psql "$SUPABASE_DB_URL" -At -f` read-only idiom; BOM-safe env loader) — repo read
- `.env` key scan (SUPABASE_DB_URL, GEMINI_API_KEY present) / `psql --version` 17.9 / `tsx --version` 4.22.4 / `grep pg` across package.json (none) — tool-verified

### Secondary (MEDIUM confidence — milestone research, already synthesized)
- `.planning/research/STACK.md` — RRF SQL (`rrf_k=50`, `websearch_to_tsquery`, `ts_rank_cd`, weights A/B/C), `f_unaccent` immutability, boletín short-circuit
- `.planning/research/PITFALLS.md` — #1 golden gate, #2 Spanish FTS/unaccent, #3 tsquery+RRF, #4 boletín formats, performance traps (candidate limit×2, 1k cap)
- `.planning/research/SUMMARY.md` — phase 86 framing, gates 87, "empirical scoring IS the research"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every tool verified present; zero new deps; DB idioms read directly.
- Architecture (harness/golden/live-gate): HIGH — all three patterns exist in-repo and were read.
- Pitfalls: HIGH — schema-level corrections (normas column, embedding table) verified against migrations; FTS/RRF from milestone research.
- Live PROD specifics (unaccent enabled, exact jsonb shape, embedding %): MEDIUM — measurable in the spike; flagged as probe-first assumptions (A1–A4).

**Research date:** 2026-07-21
**Valid until:** ~2026-08-20 (stable — repo patterns and Supabase mechanics change slowly; re-verify if migrations >0052 alter proyecto/ficha/embedding schema)
