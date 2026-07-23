# Phase 86: BÚSQUEDA P1a — SPIKE retrieval híbrido + golden set congelado - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 9 new + 1 modified
**Analogs found:** 9 / 9 (100% — this is a wiring phase; every piece has an in-repo analog)

## File Classification

All new files land in `packages/fichas/src/spike/` (Claude's-discretion location chosen per RESEARCH: fichas already owns `golden/`, the Gemini contract sibling, and Supabase reads → lowest friction, no new package scaffold).

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/fichas/src/spike/golden-set.ts` | fixture | transform (frozen data + scorer) | `packages/fichas/src/golden/golden-set.ts` | exact (same package, same team pattern) |
| `packages/fichas/src/spike/score.ts` | utility | transform (hit@1/hit@5/MRR) | `packages/fichas/src/golden/golden-set.ts::evaluarGolden` | exact (mirror the pure-scorer shape) |
| `packages/fichas/src/spike/embed-query.ts` | service | request-response (Gemini REST) | `app/lib/buscar.ts::defaultEmbedder` (lines 92-156) | exact (verbatim copy — CANNOT import, server-only) |
| `packages/fichas/src/spike/embed-cache.ts` | utility | file-I/O (query→vector JSON) | `scripts/run-with-env.mjs` (BOM-safe fs read) | partial (fs idiom; cache logic is new) |
| `packages/fichas/src/spike/psql.ts` | utility | request-response (shell → DB) | `scripts/verify-cobertura.sql` header + `run-with-env.mjs` `spawn` | role-match (psql idiom + spawn wrapper) |
| `packages/fichas/src/spike/strategies.ts` | service | CRUD-read (FTS + semantic + RRF) | `0011_fichas_embeddings.sql::match_proyectos` + `0032` FTS template | role-match (SQL composition) |
| `packages/fichas/src/spike/retrieval-cli.ts` | controller | event-driven (CLI entry) | `packages/fichas/src/pipeline-cli.ts` | exact (same package CLI pattern) |
| `packages/fichas/src/spike/retrieval-golden.live.test.ts` | test | event-driven (env-gated live) | `packages/votos/src/spike-votacion-detalle.live.test.ts` | exact (`.live.test.ts` + `describe.skip` + `loadEnv`) |
| `packages/fichas/src/spike/*.test.ts` (offline units) | test | transform | `packages/fichas/src/golden/golden-set.test.ts` | role-match |
| `packages/fichas/vitest.live.config.ts` (NEW) | config | — | `packages/votos/vitest.live.config.ts` | exact (copy) |
| `packages/fichas/vitest.config.ts` (MODIFY) | config | — | `packages/votos/vitest.config.ts` (line 11 exclude) | exact — **fichas config currently does NOT exclude `*.live.test.ts`; must add it** |

---

## Pattern Assignments

### `packages/fichas/src/spike/golden-set.ts` (fixture, transform)

**Analog:** `packages/fichas/src/golden/golden-set.ts`

**Typed-case shape** (mirror `CasoGolden`, lines 42-54 — adapt fields to retrieval):
```typescript
// Adapt to: { id, category, query, expected: string[], nota }
export type CategoriaRetrieval =
  | "titulo-literal"     // palabras textuales del título (el bug estrella)
  | "parafrasis-nl"      // paráfrasis natural (baseline semántico debe seguir ganando)
  | "normas"             // cuerpos legales / normas citadas
  | "boletin"            // los 3 formatos: 14309-04 / 14309 / 14.309-04 (hit@1)
  | "acentos-toponimos"  // Ñuñoa / Aysén / medio ambiente
  | "similares";         // "proyectos similares" (match_proyectos — NO regresionar SEM-05)

export interface CasoRetrieval {
  id: string;
  category: CategoriaRetrieval;
  query: string;
  expected: string[];   // boletín/es esperados (formato canónico proyecto.boletin)
  nota: string;
}
export const GOLDEN_SET: CasoRetrieval[] = [ /* ≥30 casos, CONGELADO al cierre */ ];
```

**REUSE `normalizarLiteral` verbatim** (lines 62-71) — NFD + strip diacritics + collapse whitespace + lowercase. RESEARCH calls this out explicitly: it enables accent-insensitive `expected`-matching without importing anything (it's exported from the sibling `golden/`). Import it OR copy it into the spike module:
```typescript
export function normalizarLiteral(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
```

**Frozen-at-close discipline:** the `golden/` file demonstrates the same "changes require an explicit decision, not silent edits" contract (`GOLDEN_SET_GATE` / `IDS_CASOS_ADVERSARIOS` filters, lines 411-432). Mirror the "subset filters over one frozen array" idiom if boletín/similares need isolated gating.

---

### `packages/fichas/src/spike/score.ts` (utility, transform)

**Analog:** `packages/fichas/src/golden/golden-set.ts::evaluarGolden` (lines 459-523)

**Pure-scorer signature** (dependency-injected `ejecutar`, per-category detail — copy the shape, swap precision/recall for hit@1/hit@5/MRR):
```typescript
// Mirror evaluarGolden: pure fn, injected strategy runner, per-category + aggregate table.
export interface MetricasRetrieval {
  porCategoria: Record<string, { hit1: number; hit5: number; mrr: number; n: number }>;
  agregado: { hit1: number; hit5: number; mrr: number; n: number };
  detalle: { id: string; category: string; rank: number | null; ok: boolean }[];
}
export async function evaluarRetrieval(
  set: CasoRetrieval[],
  ejecutar: (caso: CasoRetrieval) => Promise<string[]>,  // strategy → ranked boletin[]
): Promise<MetricasRetrieval> { /* rank of first expected hit → hit@k / MRR per category */ }
```
- **hit@1** is the win criterion for `category === "boletin"` (short-circuit deterministic, always #1).
- The `detalle[]` array (line 468, 517) is the load-bearing evidence: per-case rank, so the decision is a numeric `estrategia × categoría` table, NOT a vibe (Pitfall #4).

---

### `packages/fichas/src/spike/embed-query.ts` (service, request-response)

**Analog:** `app/lib/buscar.ts::defaultEmbedder` (lines 92-156) — **COPY, do NOT import** (`buscar.ts` is `import "server-only"` + `next/navigation`-coupled).

**Contract constants to copy verbatim** (lines 70-73):
```typescript
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = "v1beta";
```

**L2 normalize** (lines 92-96) + **REST call** (lines 105-156). Load-bearing details:
- `taskType: "RETRIEVAL_QUERY"` MUST be sent (query-side asymmetry SEM-03). This is exactly why `@obs/llm` `GeminiEmbeddingProvider` CANNOT be reused — its `embed()` has no `taskType` param.
- Key travels via header `"x-goog-api-key": apiKey`, NEVER in URL/body/logs (line 130). Error message must never include the key (line 135-138).
- `outputDimensionality: EMBEDDING_DIMS` (768) in each request; assert `values.length === 768` (lines 147-151).
- `batchEmbedContents` endpoint (line 116): `${BASE}/${VERSION}/models/${MODEL}:batchEmbedContents`.

```typescript
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
  body: JSON.stringify({ requests: texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMS,
    ...(taskType ? { taskType } : {}),
  })) }),
});
```

---

### `packages/fichas/src/spike/embed-cache.ts` (utility, file-I/O)

**Analog:** `scripts/run-with-env.mjs` (BOM-safe `readFileSync`, lines 4-14) for the fs idiom.

**New logic:** query-text → vector JSON map, COMMITTED to the repo (Anti-pattern: "un-committed embedding cache"). Reproducible + doesn't re-hit Gemini in CI. Read cache-first, embed only on miss, write back. Cache holds float vectors only — NO env values, NO key (Security Domain V7/V12).

---

### `packages/fichas/src/spike/psql.ts` (utility, request-response)

**Analog:** `scripts/verify-cobertura.sql` header (lines 7-8) + `scripts/run-with-env.mjs` `spawn` (line 21).

**psql read-only idiom** (from verify-cobertura.sql):
```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -At -f scripts/<probe>.sql
# -At = tuples-only + unaligned → trivial TS split by \n / tab. Add -F',' or --csv for CSV.
```

**Windows-safe spawn** (mirror run-with-env.mjs line 21 — `shell: process.platform === "win32"`):
```typescript
import { spawn } from "node:child_process";
// pass SQL via stdin or -f temp file; parse -At tab output. SELECT-ONLY (spike rule: zero DDL/DML).
```
- **SQL injection guard (V5):** query text goes ONLY into `websearch_to_tsquery('spanish', unaccent($1))` bound via psql `-v` OR into the RPC `.rpc()` param — NEVER string-interpolated. The query VECTOR is parametrized, never concatenated.
- **A1 probe first:** run `select unaccent('Ñuñoa')` before the FTS arm; if it errors (extension not enabled), degrade to FTS without `unaccent` and document the gap (evidence FOR enabling it in 87). Do NOT `create extension` (schema footprint forbidden).

---

### `packages/fichas/src/spike/strategies.ts` (service, CRUD-read)

**Analogs:** `0011_fichas_embeddings.sql::match_proyectos` (semantic arm) + `0032_agenda_search.sql` FTS template (FTS arm).

**Semantic arm** — the RPC already exists (0011 lines 55-71); spike supplies the cached vector:
```sql
select boletin, similarity from match_proyectos(:query_embedding, 50, 0.59, null);
-- signature: match_proyectos(query_embedding vector(768), match_count int=20, match_threshold float8=0.0, exclude_boletin text=null)
-- Via supabase-js: sb.rpc("match_proyectos", { query_embedding, match_count, match_threshold, exclude_boletin })
-- piso 0.59 = DEFAULT_MATCH_THRESHOLD (buscar.ts:67). The "similares"/SEM-05 category uses exclude_boletin.
```

**FTS arm** — ad-hoc `to_tsvector('spanish', unaccent(...))`, SELECT-only, ZERO schema. Weight A=`proyecto.titulo`, B=`proyecto_ficha.idea_matriz` (join on `boletin`), C=normas.
> **Pitfall #1 (schema correction):** there is NO `normas_afectadas` column. Normas live in `proyecto_ficha.cuerpos_legales` (jsonb, `[]` default, elements `{norma, articulos[]}` per 0011 line 25). Flatten via `string_agg(c->>'norma',' ')` over `jsonb_array_elements(f.cuerpos_legales)`. **Verify the jsonb `norma` key against a live row before finalizing** (Assumption A3).
- `websearch_to_tsquery` ALWAYS (never raw `to_tsquery` — 500s on `sub-secretaría`/`16733-07`).
- Same `unaccent(...)` wrapping on BOTH the tsvector and the tsquery side (Pitfall #3).

**RRF merge (TS, rank not score)** — ~10 lines, no library, no normalization:
```typescript
function rrf(fts: string[], sem: string[], rrfK = 50, wFts = 1, wSem = 1): string[] {
  const score = new Map<string, number>();
  fts.forEach((b, i) => score.set(b, (score.get(b) ?? 0) + wFts / (rrfK + i + 1)));
  sem.forEach((b, i) => score.set(b, (score.get(b) ?? 0) + wSem / (rrfK + i + 1)));
  return [...score.entries()].sort((a, z) => z[1] - a[1]).map(([b]) => b);
}
```
- **Boletín short-circuit BEFORE fusion:** a boletín query (3 formats, incl. dotted `14.309-04`) must be hit@1 — never enter RRF. Current `BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/` (buscar.ts:28) does NOT match dotted; the spike detector strips dots, splits base/suffix, matches `proyecto.boletin` (full) OR `proyecto.boletin_num` (base). (Pitfall #5.)
- **Weighted score sum FORBIDDEN** — RRF on rank only.

---

### `packages/fichas/src/spike/retrieval-cli.ts` (controller, event-driven)

**Analog:** `packages/fichas/src/pipeline-cli.ts`

**Flag-parse-before-any-network pattern** (lines 60-118) — dedicated `parseArgs` with a typed `*ArgsError` thrown BEFORE touching DB/net:
```typescript
export class SpikeCliArgsError extends Error { constructor(msg: string) { super(msg); this.name = "SpikeCliArgsError"; } }
export function parseArgs(argv: string[]): SpikeCliOptions { /* --report out.md, --rrf-k, --limit; fail-fast on missing value */ }
```

**Entry-point guard** (lines 244-269 — regex on `process.argv[1]`, try/catch parse → `exit(2)`, run → `exit(0/1)`):
```typescript
const isMain = typeof process !== "undefined" && process.argv[1] != null &&
  /retrieval-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) { try { parsed = parseArgs(process.argv.slice(2)); } catch (err) { console.error(...); process.exit(2); } main(parsed).then(...).catch(...); }
```

**Run invocation** (from RESEARCH, via `run-with-env.mjs` — BOM-safe `.env` → `process.env`):
```bash
node scripts/run-with-env.mjs pnpm --filter @obs/fichas exec tsx src/spike/retrieval-cli.ts --report out.md
```
- Env-driven, never hardcoded: `SUPABASE_DB_URL`, `GEMINI_API_KEY`. Emits a `estrategia × categoría` markdown report (feeds the DECISION in 86-SUMMARY). READ-ONLY: no writer, no upsert (unlike pipeline-cli — this spike NEVER writes).

---

### `packages/fichas/src/spike/retrieval-golden.live.test.ts` (test, event-driven)

**Analog:** `packages/votos/src/spike-votacion-detalle.live.test.ts`

**env-gate + honest skip** (lines 33, 49-51 — RESEARCH mandates BOTH env vars for the retrieval gate):
```typescript
const LIVE = !!process.env.SUPABASE_DB_URL && !!process.env.GEMINI_API_KEY;
(LIVE ? describe : describe.skip)("retrieval golden — hybrid dominates baseline", () => {
  it("winner ≥ baseline on literal/boletín AND no regression on NL/similares", async () => { /* score + assert */ });
});
```

**BOM-safe `loadEnv` + `findWorkspaceRoot`** (lines 22-47, 55-56 — copy verbatim; `findWorkspaceRoot` is exported from `@obs/tramitacion`):
```typescript
import { findWorkspaceRoot } from "@obs/tramitacion";
function loadEnv(root: string): Record<string, string> {
  const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}
const root = findWorkspaceRoot(process.cwd());
const env = loadEnv(root);
```
- **Assert winner dominates:** hit@1/hit@5/MRR of the chosen strategy ≥ baseline (`match_proyectos` piso 0.59) on literal/boletín AND ≥ baseline on NL/similares (no regression). The "similares" category makes RRF prove it doesn't break SEM-05.
- `testTimeout: 120_000` (config-level, mirror votos).

---

### `packages/fichas/vitest.live.config.ts` (config, NEW)

**Analog:** `packages/votos/vitest.live.config.ts` — copy near-verbatim:
```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.live.test.ts"],
    exclude: ["**/node_modules/**"],
    passWithNoTests: true,
    testTimeout: 120_000,
  },
});
```
Run: `SUPABASE_DB_URL=… GEMINI_API_KEY=… pnpm --filter @obs/fichas exec vitest run --config vitest.live.config.ts`

---

### `packages/fichas/vitest.config.ts` (config, MODIFY — GAP)

**Analog:** `packages/votos/vitest.config.ts` line 11.

**Current fichas config does NOT exclude `*.live.test.ts`** (verified — line 6 is just `include: ["src/**/*.test.ts"]`, no exclude). Since `*.live.test.ts` matches `*.test.ts`, the normal suite would COLLECT the live test. **Add the exclude** (mirror votos line 11):
```typescript
// Change fichas vitest.config.ts:
include: ["src/**/*.test.ts"],
exclude: ["**/node_modules/**", "**/*.live.test.ts"],  // ADD — keep live test out of the normal/CI suite
passWithNoTests: true,
```
This is a required modification, not net-new — without it the `describe.skip` env-gate is the ONLY defense and the live test gets collected in CI.

---

## Shared Patterns

### BOM-safe `.env` loader
**Source:** `scripts/run-with-env.mjs` (lines 9-14) / inline `loadEnv` in `packages/votos/spike-votacion-detalle.live.test.ts` (lines 39-47)
**Apply to:** `retrieval-cli.ts` (via `run-with-env.mjs` wrapper), `retrieval-golden.live.test.ts` (inline `loadEnv`), `embed-cache.ts` (fs idiom)
```javascript
const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");   // strip UTF-8 BOM
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}
```
The repo `.env` has a BOM; the `.replace(/^﻿/, "")` is load-bearing. `\r?\n` split handles Windows line endings.

### Read-only DB access, TWO idioms (the key discovery)
**Source:** `scripts/verify-cobertura.sql` (psql) + `0011_fichas_embeddings.sql` (RPC)
**Apply to:** `psql.ts`, `strategies.ts`
- Arbitrary SQL (FTS, counts, embedding-coverage delta) → `psql "$SUPABASE_DB_URL" -At` ONLY (PostgREST can't express `to_tsvector`). NO `pg` npm dep anywhere in the monorepo — do NOT add one.
- Semantic kNN → existing `match_proyectos` RPC via psql `select * from match_proyectos(...)` OR supabase-js `.rpc()`.
- **SELECT-ONLY, enforced by review.** No `create`/`alter`/`insert`/`update`. `SUPABASE_DB_URL` is the privileged owner URL (V4 access control).

### Embedding-coverage count (evidence for hybrid)
**Source:** `scripts/verify-cobertura.sql` (lines 22-28) — proyecto / proyecto_ficha / proyecto_embedding counts + `LEFT JOIN … WHERE embedding IS NULL` delta
**Apply to:** `strategies.ts` / `retrieval-cli.ts` report
`proyecto_embedding` is a SEPARATE 1:1 table (0011 line 37) — `match_proyectos` only sees embedded rows. Measure the ~15.4% no-embedding gap LIVE (Assumption A2) and include ≥1 golden query whose expected boletín is NON-embedded → proves FTS finds what semantic misses (Pitfall #2). NOTE: `embedding IS NULL` lives on `proyecto_embedding`, NOT on `proyecto` (STACK.md was wrong).

### Gemini key hygiene
**Source:** `app/lib/buscar.ts::defaultEmbedder` (lines 108-138)
**Apply to:** `embed-query.ts`
Key via `x-goog-api-key` header only; never in URL/body/logs/error strings; committed cache holds vectors only (V7/V12).

---

## No Analog Found

None. Every file has a strong in-repo analog. The only genuinely NEW logic (per RESEARCH "Don't Hand-Roll"):
- (a) the ad-hoc `spanish`+`unaccent` FTS SELECT with weight A/B/C over `proyecto`⋈`proyecto_ficha` (composed from 0011 + 0032 templates),
- (b) the TS RRF merge (~10 lines),
- (c) the hit@1/hit@5/MRR scorer (shaped after `evaluarGolden`),
- (d) the boletín 3-format detector (extends `BOLETIN_RE` to dotted).

## Corpus Schema Reference (for `strategies.ts` — verified against migrations)

| Column | Table | Source | Weight / Use |
|--------|-------|--------|--------------|
| `titulo` | `proyecto` | 0008 | FTS weight A |
| `boletin`, `boletin_num` | `proyecto` | 0008 | boletín short-circuit (full / base) |
| `idea_matriz` | `proyecto_ficha` (join on `boletin`) | 0011 | FTS weight B |
| `cuerpos_legales` jsonb `{norma,articulos[]}` | `proyecto_ficha` | 0011 | FTS weight C (flatten via `string_agg(c->>'norma')`) |
| `embedding vector(768)`, `embedding_version` | `proyecto_embedding` (1:1) | 0011 | semantic arm (via `match_proyectos`) |

## Metadata

**Analog search scope:** `app/lib/`, `packages/fichas/src/`, `packages/votos/src/`, `scripts/`, `supabase/migrations/`
**Files read:** buscar.ts, golden/golden-set.ts, votos vitest.live.config.ts + spike-votacion-detalle.live.test.ts + vitest.config.ts, run-with-env.mjs, verify-cobertura.sql, pipeline-cli.ts, 0011_fichas_embeddings.sql, fichas package.json + vitest.config.ts
**Pattern extraction date:** 2026-07-21
