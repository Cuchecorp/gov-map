# Phase 7: Búsqueda Semántica + Fichas Estructuradas - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 22 new/modified (8 pipeline `packages/fichas` + 1 migration + 1 provider extension + 1 parser extension + 1 workflow + 7 frontend components/routes + 3 frontend lib/types)
**Analogs found:** 21 / 22 (one near-greenfield: golden-set literal-fidelity metric, which adapts an existing harness)

> This phase is **composition, not invention** (RESEARCH §"Don't Hand-Roll"). Almost every new file has a strong analog already in the repo. The planner should instruct executors to mirror the cited analog file + lines rather than design from scratch.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/fichas/src/model.ts` | model | transform | `packages/adjudication/src/prompt.ts` (AdjudicacionSchema) | role+flow exact |
| `packages/fichas/src/prompt.ts` | utility | transform | `packages/adjudication/src/prompt.ts` (SYSTEM_ADJUDICACION) | exact |
| `packages/fichas/src/extraer.ts` | service | request-response | `packages/llm/src/providers/deepseek.ts` (complete usage) | role-match |
| `packages/fichas/src/texto-fuente.ts` | service | file-I/O | `packages/ingest/src/{index.ts,r2-store.ts}` + `packages/identity/src/backup.ts` (r2Enabled gate) | role+flow exact |
| `packages/fichas/src/embed-ficha.ts` | service | transform | `packages/llm/src/providers/gemini-embeddings.ts` (embed usage) | role-match |
| `packages/fichas/src/pipeline.ts` | service | batch | `packages/tramitacion/src/ingest-run.ts` | role+flow exact |
| `packages/fichas/src/writer-supabase.ts` | service (writer) | CRUD | `packages/tramitacion/src/writer-supabase.ts` | exact |
| `packages/fichas/src/pipeline-cli.ts` | utility (CLI) | batch | `packages/tramitacion/src/ingest-cli.ts` + `packages/identity/src/seed-cli.ts` | exact |
| `packages/fichas/src/golden/golden-set.ts` | test fixture | batch | `packages/adjudication/src/golden/golden-set.ts` | role+flow exact |
| `packages/fichas/src/golden/golden-set.test.ts` | test (gate) | batch | `packages/adjudication/src/golden/golden-set.test.ts` | exact (metric differs) |
| `packages/fichas/src/index.ts` | config (barrel) | n/a | `packages/tramitacion/src/index.ts` | exact |
| `supabase/migrations/0011_fichas_embeddings.sql` | migration | CRUD + kNN | `supabase/migrations/0008_tramitacion.sql` + `0010_agenda.sql` | role+flow exact |
| `packages/llm/src/providers/gemini-embeddings.ts` (MODIFY) | service | transform | self (add `taskType` to existing body) | self-extension |
| `packages/tramitacion/src/parse-senado-tramitacion.ts` (MODIFY) | utility (parser) | transform | self (add `link_mensaje_mocion` extraction) | self-extension |
| `.github/workflows/fichas-backfill.yml` | config (CI) | batch | `.github/workflows/backfill.yml` | role+flow exact |
| `app/app/page.tsx` (REPLACE) | route (RSC) | request-response | `app/app/agenda/page.tsx` (shell) + `app/app/proyecto/[boletin]/page.tsx` | role-match |
| `app/app/buscar/page.tsx` (NEW) | route (RSC) | request-response | `app/app/agenda/page.tsx` (searchParams) | role+flow exact |
| `app/lib/buscar.ts` (NEW) | service (server-only) | request-response | `app/lib/supabase.ts` + RESEARCH code example | partial (new wiring) |
| `app/components/search-box.tsx` (NEW) | component (client island) | event-driven | UI-SPEC §3 (no exact analog; only client island) | spec-driven |
| `app/components/search-result-card.tsx` (NEW) | component (RSC) | request-response | `app/components/citacion-card.tsx` | exact |
| `app/components/{idea-matriz-block,cuerpos-legales-list,proyectos-similares}.tsx` (NEW) | component (RSC) | request-response | `app/components/citacion-card.tsx` + UI-SPEC §6 | role-match |
| `app/lib/types.ts` (MODIFY) | model (row types) | transform | self (add `ProyectoFichaRow`, `MatchProyectoRow`) | self-extension |

---

## Pattern Assignments

### `packages/fichas/src/model.ts` (FichaSchema — zod contract)

**Analog:** `packages/adjudication/src/prompt.ts` lines 26-42 (AdjudicacionSchema as the untrusted-LLM-output contract).

Mirror the structure: a top-level zod object with bounded fields (`.max(...)`, `.nullable()`, `.default([])`). RESEARCH §"Code Examples" gives the exact target shape (`CuerpoLegalSchema` + `FichaSchema`). The schema is the gate passed to `DeepSeekProvider.complete(req, FichaSchema)`.

Key constraints from RESEARCH:
- `idea_matriz: z.string().max(4000).nullable()` — null is first-class (honest degradation), never fabricated.
- `cuerpos_legales: z.array(CuerpoLegalSchema).max(100).default([])`.

The adjudication analog uses a cross-field `.refine(...)` (line 37-39); FichaSchema does not need one, but copy the bounded-field discipline.

---

### `packages/fichas/src/prompt.ts` (SYSTEM_EXTRACCION restrictive prompt)

**Analog:** `packages/adjudication/src/prompt.ts` lines 44-91.

Two exports to mirror:
1. `SYSTEM_ADJUDICACION` (lines 48-58) — a **stable** (prompt-cache friendly) Spanish system string that forbids inference/causality (riesgo existencial #2). Copy the "Reglas estrictas:" bullet structure and the closing "NO uses conocimiento externo" line. RESEARCH §"Pattern 1" provides the exact `SYSTEM_EXTRACCION` text to use (literal extraction: idea_matriz = verbatim quote or null; cuerpos_legales = literally cited norms only).
2. `construirPromptAdjudicacion(...)` (lines 66-91) — a function that builds the `user` string. Mirror as `construirPromptExtraccion(textoFuente, proyecto)`.

**Guardrail (load-bearing):** the prompt NEVER interprets, summarizes abstractively, or connects facts. Abstractive summary is REJECTED (CONTEXT). This is a legal guardrail, not a preference.

---

### `packages/fichas/src/extraer.ts` (DeepSeek extraction + zod gate)

**Analog:** `packages/llm/src/providers/deepseek.ts` lines 59-101 (the `complete<T>(req, schema)` contract) — but `extraer.ts` is a **consumer**, not a re-implementation.

The provider already does everything: fail-closed gates (lines 65-68), stable system prefix for prompt-cache (line 70-75), `response_format: { type: "json_object" }` (line 81), and the external `parseAndValidate` repair loop (lines 90-100). The new file just calls it:

```typescript
// pass the restrictive system prompt + FichaSchema; provider runs the zod gate + repair
const ficha = await deepseek.complete(
  { system: SYSTEM_EXTRACCION, user: construirPromptExtraccion(texto, proyecto), sensitivity: "publico" },
  FichaSchema,
);
```

**Do NOT hand-roll** `safeParse`/repair (RESEARCH §"Don't Hand-Roll"): the single external gate (`packages/llm/src/validate.ts`, `parseAndValidate`) handles it, and it never leaks the prompt/key into errors.

---

### `packages/fichas/src/texto-fuente.ts` (download texto íntegro + R2 gate)

**Analog A (fetch policy):** `packages/ingest/src/index.ts` lines 11-41 — reuse the exported collaborators in LOCKED order. The connectors in `packages/tramitacion/src/ingest-cli.ts` lines 167-174 show the assembly: `new Fetcher()`, `new HostRateLimiter()`, `new RobotsGuard()`. The order is `assertAllowedUrl → robots → rateLimiter.wait → fetcher.get` (CONTEXT/RESEARCH).

**Analog B (R2 write + credential gate):** `packages/identity/src/backup.ts` lines 84-113 is the canonical `r2Enabled` gating pattern:

```typescript
// R2 GATEADO: sólo si está habilitado y hay target. Best-effort, no bloquea.
let r2Ok = false;
if (opts.r2Enabled && opts.r2) {
  try { r2Key = await opts.r2.put(content); r2Ok = true; }
  catch { r2Ok = false; }   // 401 / fallo: la extracción procede sobre el texto en memoria
}
```

R2 returns 401 today (MEMORY `env-credentials-reality.md`); default `r2Enabled = false`. The raw R2 write is `packages/ingest/src/r2-store.ts` `putImmutable(...)` (lines 55-79) — content-addressed, `If-None-Match: *`, 412 = idempotent OK.

**Degradation (RESEARCH Pitfall 4 + 5):** if link absent / fetch fails / R2 skipped, the pipeline still produces a ficha with `idea_matriz = null` and embeds on título+materia. Never abort.

---

### `packages/fichas/src/embed-ficha.ts` (compose text + Gemini RETRIEVAL_DOCUMENT)

**Analog:** `packages/llm/src/providers/gemini-embeddings.ts` lines 67-129 (the `embed(texts)` consumer contract). Provider already L2-normalizes (line 37-40, mandatory at 768 dims) and stamps model/dims/version (lines 122-127, FND-07). The new file:
1. Composes embed text defensively (RESEARCH Pitfall 5): filter null/empty parts before concatenation; when only título+materia exist, embed on that. Truncate long composed text (Assumption A5).
2. Calls `embed([text], "RETRIEVAL_DOCUMENT")` once the provider gains `taskType` (see provider MODIFY below).

**Do NOT** re-normalize or re-check dims — the provider owns FND-07 (RESEARCH §"Don't Hand-Roll").

---

### `packages/fichas/src/pipeline.ts` (orquestación pendientes → fetch → extract → embed → write)

**Analog:** `packages/tramitacion/src/ingest-run.ts` (the `runIngest(...)` orchestrator consumed by `ingest-cli.ts` lines 189-198). Mirror: accept injected collaborators (connectors/providers/writer) + a `log` callback + a `limite`, iterate the bounded set, collect per-item errors without aborting the run, return `{ counts, errores[] }`.

**Resumability (FND-07 / CONTEXT):** read `proyecto_ficha.estado = 'pendiente'`; `--reembed` bumps version and re-processes all. Upsert is idempotent by boletín. The error-collection-not-abort shape is visible in `ingest-cli.ts` lines 200-206.

---

### `packages/fichas/src/writer-supabase.ts` (upsert proyecto_ficha + proyecto_embedding)

**Analog:** `packages/tramitacion/src/writer-supabase.ts` (entire file, 1-111) — copy near-verbatim.

Mirror exactly:
- `createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })` (lines 53-57) — SERVICE key, server-side, bypasses RLS.
- `chunk(...)` (lines 32-36) + `dedupePorClave(...)` (lines 43-47) helpers.
- `upsert(filas, { onConflict: '<clave natural>', ignoreDuplicates: false })` (lines 60-64) — for fichas the conflict key is `boletin` (1:1 with proyecto), same as `upsertProyecto`.
- Error never interpolates the service key; only `error.message` from PostgREST (lines 64, 73).

Two writers: `upsertFicha` (onConflict `boletin`) and `upsertEmbedding` (onConflict `boletin`).

---

### `packages/fichas/src/pipeline-cli.ts` (resumable CLI)

**Analog:** `packages/tramitacion/src/ingest-cli.ts` (entire file). Copy the skeleton:
- `parseArgs(argv)` (lines 62-110) with `IngestCliArgsError` thrown **before** any network/DB. Flags per RESEARCH §"Code Examples": `--limite N` (default bounded, lines 79-87), `--boletines a,b` (lines 88-99), `--reembed` (new, version bump), `--dry-run` (lines 67-69), `--service-key K` (lines 100-102).
- `findWorkspaceRoot(start)` (lines 116-128) if it needs the workspace root.
- **Dry-run-without-key degradation** (lines 161-165): no service key → degrade to dry-run with a warning (never aborts, never touches DB). This is the same gating philosophy as the R2 gate.
- Entry-point guard `isMain` (lines 217-241) with `process.exit` codes (2 = bad flags, 1 = run error).

`seed-cli.ts` (`packages/identity/src/seed-cli.ts`) is the secondary analog for a resumable seeder if the planner wants checkpoint semantics.

---

### `packages/fichas/src/golden/golden-set.ts` + `golden-set.test.ts` (CI gate — MANDATORY P7 flag)

**Analog (fixture):** `packages/adjudication/src/golden/golden-set.ts` lines 1-80. Mirror: a typed `CasoGolden` interface (lines 36-55) with `id`, `categoria`, the input, the **mocked LLM output** (`llmEsperado`), and the gold label (`expected`). 15-20 hand-annotated cases (RESEARCH §"Wave 0 Gaps") + **≥1 adversarial case** (text with no explicit idea matriz where a naive model would hallucinate) to keep the gate non-tautological — mirrors the `GOLDEN_SET_ADVERSARIO` / `g23-adversario` pattern.

**Analog (gate test):** `packages/adjudication/src/golden/golden-set.test.ts` (entire file, 1-139). Copy the two-block structure:
1. **CI block (default, no network, no key):** mock provider keyed by source text (`mockDelGolden`, lines 40-52, which REJECTS duplicate keys at construction) → assert metric ≥ threshold (lines 71-79). `const PRECISION_MIN = 0.95; const RECALL_MIN = 0.8;` (lines 28-29).
2. **Meta-test:** prove the fp branch is reachable (lines 89-115) so the gate is not theater.
3. **LIVE block (gated):** `process.env.FICHAS_GOLDEN_LIVE === "1"` (mirror `IDENTITY_GOLDEN_LIVE`, lines 118-139) instantiates the real `DeepSeekProvider`, skipped by default.

**Metric difference (the genuinely new judgment, RESEARCH §"Pattern 4"):**
- **cuerpos_legales:** F1 over cited bodies; a *fabricated* cuerpo legal = false positive (existential risk). `PRECISION_MIN ≥ 0.95`, `RECALL_MIN ≥ 0.80`.
- **idea_matriz:** literal-substring check (normalize whitespace/accents first — Assumption A3) OR `null` when expected null. A paraphrase that is not a substring = failure (zod alone cannot catch a fluent hallucination — RESEARCH Pitfall 6).

The `evaluarGolden(...)` harness shape is in `golden-set.ts` (imported at test line 25); adapt it to compute the new precision/recall metric.

---

### `packages/fichas/src/index.ts` (barrel)

**Analog:** `packages/tramitacion/src/index.ts` (entire file). Mirror the grouped `export` / `export type` block style with section comments. Export `FichaSchema`/`Ficha`, `SYSTEM_EXTRACCION`/`construirPromptExtraccion`, the pipeline + writer + CLI `main`/`parseArgs`.

---

### `supabase/migrations/0011_fichas_embeddings.sql` (tables + HNSW + RPC + RLS)

**Analog:** `supabase/migrations/0008_tramitacion.sql` (table DDL + RLS) and `0010_agenda.sql` lines 93-115 (the RLS public-read + GRANT block).

**RLS public-read pattern (copy verbatim, 0008 lines 89-108):**
```sql
alter table proyecto_ficha     enable row level security;
alter table proyecto_embedding enable row level security;
create policy proyecto_ficha_public_read     on proyecto_ficha     for select to anon using (true);
create policy proyecto_embedding_public_read on proyecto_embedding for select to anon using (true);
grant select on proyecto_ficha     to anon;
grant select on proyecto_embedding to anon;
```
The policy AND the grant are both required (0008 line 103-104 comment: "el privilegio Y la policy deben coincidir") — without both the ficha/search reads 0 rows.

**Critical addition vs 0008/0010 (RESEARCH Pitfall 2):** the RPC needs its own grant, which has no analog (0008/0010 have no functions):
```sql
grant execute on function match_proyectos(vector, int, float8, text) to anon;
```

**HNSW + kNN RPC (RESEARCH §"Pattern 2", no codebase analog — from pgvector README):**
```sql
create index proyecto_embedding_hnsw
  on proyecto_embedding using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create or replace function match_proyectos(
  query_embedding vector(768), match_count int default 20,
  match_threshold float8 default 0.0, exclude_boletin text default null
) returns table (boletin text, similarity float8) language sql stable as $$
  select e.boletin, 1 - (e.embedding <=> query_embedding) as similarity
  from proyecto_embedding e
  where (exclude_boletin is null or e.boletin <> exclude_boletin)
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by e.embedding <=> query_embedding   -- raw distance ASC → uses HNSW (Pitfall 3)
  limit match_count;
$$;
```
**Provenance/version columns** on both tables follow the inline-provenance discipline of 0008 (lines 30-33): `proyecto_embedding` stamps `embedding_model`/`embedding_dims`/`embedding_version` (FND-07). `proyecto_ficha` carries `texto_r2_path`, `estado` (`pendiente`/`embebido`), `idea_matriz text`, `cuerpos_legales jsonb`. Both 1:1 with `proyecto` (FK on `boletin`).

**Runs against LOCAL Supabase** (Docker) only — remote DDL is blocked (RESEARCH Pitfall 4; remote push = operator checkpoint).

---

### `packages/llm/src/providers/gemini-embeddings.ts` (MODIFY — add taskType)

**Analog:** self, lines 67-90. The current `embed()` builds the `batchEmbedContents` body with `outputDimensionality` but **no `taskType`** (lines 74-80). Minimal extension (RESEARCH §"Pattern 3"):
```typescript
async embed(texts: string[], taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<EmbeddingResult[]> {
  // ...
  requests: texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMS,
    ...(taskType ? { taskType } : {}),   // additive — keep existing callers working
  })),
```
Keep the dim-mismatch guard (lines 116-120) and `l2normalize` (line 123) unchanged. **Verify the REST shape with a gated LIVE smoke test** (`FICHAS_EMBED_LIVE=1`) before bulk embed (RESEARCH Assumption A1 / Open Question 1: `taskType` may need nesting in `embedContentConfig`).

---

### `packages/tramitacion/src/parse-senado-tramitacion.ts` (MODIFY — extract link_mensaje_mocion)

**Analog:** self, lines 57-99. The parser reads `<descripcion>` for título/materia/estado (lines 65, 87-99) but **never reads `link_mensaje_mocion`** (RESEARCH Pitfall 1 — verified absent). Add one line in the `<descripcion>` extraction:
```typescript
link_mensaje_mocion: txt(desc.link_mensaje_mocion),
```
Use the existing `txt(...)` helper (lines 26-36). Add the field to `ProyectoSchema` (in `model.ts`) and the `proyecto` DB row, OR return it as a sidecar from the parser for the pipeline to consume. This is the **primary** texto-íntegro source per boletín; BCN `obtxml` is secondary/optional (RESEARCH Open Question 2).

---

### `.github/workflows/fichas-backfill.yml` (NEW — bulk extract+embed escape hatch)

**Analog:** `.github/workflows/backfill.yml` (entire file). Mirror: `workflow_dispatch` manual trigger (lines 11-17), `permissions: contents: read` (lines 19-20), secrets via `${{ secrets.* }}` never in cleartext (lines 37-48). Add the Phase-7 env names: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, plus the existing `SUPABASE_*` and `R2_*`. Same code as the CLI (repo rule: masivo/largo → GitHub Actions, no 10-min limit).

---

### `app/app/page.tsx` (REPLACE scaffold → landing)

**Analog (shell):** `app/app/agenda/page.tsx` lines 44-56 (the `<main className="max-w-3xl mx-auto px-4 md:px-8 ...">` + `<h1 className="text-3xl font-semibold leading-tight">` shell). Current file (`app/app/page.tsx`, 1-66) is the Next scaffold — **delete entirely** (and remove `page.module.css` import per UI-SPEC §12.1).

Server Component shell embedding the `<SearchBox autoFocus />` client island. Exact copy/structure in UI-SPEC §2 (`py-16 md:py-24`, H1 "Observatorio del Congreso 360", purpose line, hint). No fabricated stats.

---

### `app/app/buscar/page.tsx` (NEW — results, server-only embed + kNN)

**Analog:** `app/app/agenda/page.tsx` lines 40-48 (the `searchParams: Promise<{...}>` + `await searchParams` + untrusted-param validation pattern). Reuse the boletín validator from `proyecto/[boletin]/page.tsx` line 16: `const BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/;`.

Server flow (UI-SPEC §4 / RESEARCH §"Code Examples"): trim + length-cap `q` (≤300) → if `BOLETIN_RE.test(q)` `redirect(`/proyecto/${q}`)` **before** embedding → else call `buscarProyectos(q)` from `app/lib/buscar.ts` → render `SearchResultCard[]` in a `<Suspense>`. Mirror the per-section `<Suspense>` + skeleton pattern from `proyecto/[boletin]/page.tsx` lines 37-49 and 111-146.

---

### `app/lib/buscar.ts` (NEW — server-only embed query + rpc match_proyectos)

**Analog:** `app/lib/supabase.ts` (the `import "server-only"` + `createServerSupabase()` pattern, lines 1-34) + RESEARCH §"Code Examples" (server-only search helper). New wiring — no exact analog — but composes existing parts:
```typescript
import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase";
import { GeminiEmbeddingProvider } from "@obs/llm";
// embed q with RETRIEVAL_QUERY → sb.rpc("match_proyectos", { query_embedding, match_count, match_threshold, exclude_boletin })
```
Gemini key read server-only from `process.env.GEMINI_API_KEY` (never `NEXT_PUBLIC_`, mirror `supabase.ts` lines 21-29). supabase-js `.rpc()` parameterizes — never string-interpolate `q` into SQL.

---

### `app/components/search-result-card.tsx` (NEW — summarized ficha tile)

**Analog:** `app/components/citacion-card.tsx` (entire file, 1-127) — copy the structure exactly (UI-SPEC §5 says "Mirrors CitacionCard structure"). Reuse `Card`/`CardHeader`/`CardContent`, `CamaraChip`, `ProvenanceBadge` (imports lines 1-9). Add `EtapaBadge` (from `@/components/etapa-badge`). Title is a `<Link href={`/proyecto/${boletin}`}>` (mirror citacion-card lines 109-119). `ProvenanceBadge` at the bottom of `CardContent` (lines 121-123). `sourceName` via `sourceLabel(origen)` from `@/lib/types` (lines 67-73). **No relevance score** (UI-SPEC §5).

Props per UI-SPEC §5: `{ boletin, titulo, materia, estado, camaraOrigen, provenance }`.

---

### `app/components/{idea-matriz-block,cuerpos-legales-list,proyectos-similares}.tsx` (NEW — ficha sections)

**Analog:** `app/components/citacion-card.tsx` (Server Component composition style) + the degraded-state styling from the existing components. Each is a Server Component receiving data props (UI-SPEC §6):
- `IdeaMatrizBlock`: `<blockquote className="border-l-2 ...">` for the verbatim quote OR the "no disponible" block `border-border bg-muted/40` (NOT `border-destructive` — absence ≠ error). Exact markup in UI-SPEC §6.1.
- `CuerposLegalesList`: `<ul>` of `{ norma, articulos[] }` or empty paragraph. UI-SPEC §6.1.
- `ProyectosSimilares`: async Server Component that calls `match_proyectos` with `exclude_boletin = self`, renders `SearchResultCard` rows or honest empty copy. UI-SPEC §6.2.

These mount in `app/app/proyecto/[boletin]/page.tsx` as new `<section>` + `<Suspense>` blocks after Votaciones (mirror lines 44-49), without touching the existing header/timeline/votaciones sections (UI-SPEC §12.6).

---

### `app/components/search-box.tsx` (NEW — only client island)

**Analog:** none in the repo (this is the first `"use client"` island). Drive entirely from UI-SPEC §3: a `<form role="search" method="get" action="/buscar">` (progressive enhancement, works without JS) + controlled `Input` (shadcn, added via `pnpm dlx shadcn@latest add input`) + `Button`. `router.push("/buscar?q=" + encodeURIComponent(q))` for snappy transitions. Empty-submit guard (no navigation on blank). Does NOT call Gemini/pgvector.

---

### `app/lib/types.ts` (MODIFY — add row types)

**Analog:** self, lines 10-73. Add `ProyectoFichaRow` (idea_matriz, cuerpos_legales, texto_r2_path, estado), `MatchProyectoRow` ({ boletin, similarity }) mirroring the snake_case `ProyectoRow` shape (lines 10-24). Extend `sourceLabel` already handles "bcn" (line 71).

---

## Shared Patterns

### Server-only data access (anon key, no NEXT_PUBLIC_)
**Source:** `app/lib/supabase.ts` lines 1-34.
**Apply to:** `app/lib/buscar.ts`, `app/app/buscar/page.tsx`, all new ficha-section Server Components.
```typescript
import "server-only";
// SUPABASE_URL + SUPABASE_ANON_KEY (NOT NEXT_PUBLIC_); RLS public-read constrains anon.
```

### Service-key writer (server-side, bypasses RLS) + idempotent upsert by natural key
**Source:** `packages/tramitacion/src/writer-supabase.ts` lines 49-65.
**Apply to:** `packages/fichas/src/writer-supabase.ts`.
```typescript
createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
.upsert(rows, { onConflict: "boletin", ignoreDuplicates: false });
```

### Credential-gated external write (degrade, never abort)
**Source:** `packages/identity/src/backup.ts` lines 94-105 (`r2Enabled` gate); `packages/tramitacion/src/ingest-cli.ts` lines 161-165 (dry-run-without-key).
**Apply to:** `packages/fichas/src/texto-fuente.ts` (R2 write), `pipeline-cli.ts` (no service key → dry-run).

### LLM JSON validation via single external gate
**Source:** `packages/llm/src/validate.ts` `parseAndValidate` (lines 81-111), invoked inside `packages/llm/src/providers/deepseek.ts` lines 90-100.
**Apply to:** `packages/fichas/src/extraer.ts` — call `deepseek.complete(req, FichaSchema)`; never hand-roll safeParse/repair.

### @obs/ingest LOCKED fetch order (allowlist → robots → rate-limit → fetch)
**Source:** `packages/ingest/src/index.ts` (exports) + `packages/tramitacion/src/ingest-cli.ts` lines 167-174 (assembly).
**Apply to:** `packages/fichas/src/texto-fuente.ts`.

### Vector versioning (FND-07)
**Source:** `packages/llm/src/providers/gemini-embeddings.ts` lines 25-27, 116-127.
**Apply to:** `packages/fichas/src/embed-ficha.ts` (consume provider stamps) + migration 0011 (`embedding_model/dims/version` columns). Never mix versions in one query.

### RLS public-read + GRANT (policy AND privilege)
**Source:** `supabase/migrations/0008_tramitacion.sql` lines 89-108; `0010_agenda.sql` lines 93-115.
**Apply to:** migration 0011 (`proyecto_ficha`, `proyecto_embedding`) — plus the NEW `grant execute on function match_proyectos(...) to anon` (no analog; RESEARCH Pitfall 2).

### Boletín validator (path-injection guard, reused for shortcut)
**Source:** `app/app/proyecto/[boletin]/page.tsx` line 16 (`/^\d{3,6}(-\d{1,2})?$/`).
**Apply to:** `app/app/buscar/page.tsx` + `app/lib/buscar.ts` (boletín shortcut before embedding).

### Golden-set-as-CI-gate (mock in CI, gated LIVE, non-tautological)
**Source:** `packages/adjudication/src/golden/golden-set.test.ts` (entire file) + `golden-set.ts`.
**Apply to:** `packages/fichas/src/golden/golden-set.test.ts` — mock keyed by source text, `PRECISION_MIN`/`RECALL_MIN` thresholds, adversarial case, `FICHAS_GOLDEN_LIVE=1` block.

### Card-based UI reuse (CamaraChip + EtapaBadge + ProvenanceBadge)
**Source:** `app/components/citacion-card.tsx` lines 1-9, 57-126.
**Apply to:** `SearchResultCard`, `ProyectosSimilares`. Title link to `/proyecto/[boletin]`; `ProvenanceBadge` per card.

### searchParams as untrusted input in RSC
**Source:** `app/app/agenda/page.tsx` lines 40-48.
**Apply to:** `app/app/buscar/page.tsx` (`searchParams.q` trim + length-cap, no redirect on blank).

---

## No Analog Found

| File | Role | Data Flow | Reason | Mitigation |
|------|------|-----------|--------|------------|
| `packages/fichas/src/golden/golden-set.test.ts` (metric body) | test gate | batch | The harness structure is analogous (adjudication), but the **literal-substring + cuerpos-F1 metric** is net-new (no prior phase measured literal fidelity). | RESEARCH §"Pattern 4" specifies the metric; reuse `evaluarGolden` shape, swap the scoring fn. |
| `match_proyectos` RPC + HNSW DDL (within 0011) | migration | kNN | No prior migration defines a SQL function or a vector index (0008/0010 are plain tables). | RESEARCH §"Pattern 2" provides verbatim SQL from pgvector README + Supabase docs. |
| `app/components/search-box.tsx` | component | event-driven | First `"use client"` island in the app; all prior components are Server Components. | UI-SPEC §3 gives the full markup + progressive-enhancement contract. |

---

## Metadata

**Analog search scope:** `packages/{fichas-targets→llm,ingest,tramitacion,adjudication,identity}/src`, `supabase/migrations`, `app/{app,components,lib}`, `.github/workflows`.
**Files scanned:** ~18 analog files read in full or in targeted ranges.
**Pattern extraction date:** 2026-06-18
