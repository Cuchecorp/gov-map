---
phase: 07-b-squeda-sem-ntica-fichas-estructuradas
reviewed: 2026-06-18T00:00:00Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - packages/fichas/src/model.ts
  - packages/fichas/src/prompt.ts
  - packages/fichas/src/extraer.ts
  - packages/fichas/src/mock-provider.ts
  - packages/fichas/src/golden/golden-set.ts
  - packages/fichas/src/texto-fuente.ts
  - packages/fichas/src/embed-ficha.ts
  - packages/fichas/src/pipeline.ts
  - packages/fichas/src/writer-supabase.ts
  - packages/fichas/src/pipeline-cli.ts
  - packages/fichas/src/index.ts
  - packages/tramitacion/src/parse-senado-tramitacion.ts
  - packages/llm/src/providers/gemini-embeddings.ts
  - supabase/migrations/0011_fichas_embeddings.sql
  - supabase/tests/0011_fichas_embeddings.test.sql
  - app/lib/buscar.ts
  - app/lib/types.ts
  - app/components/search-box.tsx
  - app/components/search-result-card.tsx
  - app/components/idea-matriz-block.tsx
  - app/components/cuerpos-legales-list.tsx
  - app/components/proyectos-similares.tsx
  - app/app/page.tsx
  - app/app/buscar/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: findings
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** deep
**Files Reviewed:** 21+
**Status:** issues_found

## Summary

Phase 7 (Búsqueda Semántica + Fichas Estructuradas) is, on the security-critical axes the phase set out to defend, in good shape: the SSRF/robots/rate-limit ordering in `texto-fuente.ts` is correct and degrades honestly; the DeepSeek data-routing gate is delegated to the provider with `sensitivity: "public"`/`criticality: "bulk"`; the `match_proyectos` RPC returns only `(boletin, similarity)` and never touches `parlamentario`; keys are read server-only without `NEXT_PUBLIC_`; asymmetric embedding (`RETRIEVAL_QUERY` vs `RETRIEVAL_DOCUMENT`) is wired correctly; the HNSW `order by <=>` ASC and self-exclusion in the RPC are right; the golden gate genuinely measures literal fidelity and the adversarial meta-test proves it can fail.

However, two correctness defects undermine guarantees the phase explicitly claims. **CR-01:** `buscarProyectos` discards the Supabase RPC `error`, so a real RPC/DB failure silently returns `[]` and the UI renders "Sin resultados" instead of the error banner it was built to show — a false-negative that violates honest degradation (an error is not "no results"). **CR-02:** the public idea-matriz provenance links to `texto_r2_path` (an internal R2 object key, not a public URL), producing a broken "fuente oficial" link that directly contradicts the project's rector principle (every datum links to its real original source). The remaining findings are robustness gaps (empty-embed guard, flaky pgTAP zero-vector assertion, mock keying fragility) and a structural debt where the `link_mensaje_mocion` sidecar is never persisted, so the whole pipeline currently degrades 100% to null idea-matriz in LIVE.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `buscarProyectos` discards the RPC error → DB failures masquerade as "no results"

**File:** `app/lib/buscar.ts:155-162`
**Issue:** The RPC call destructures only `data` and drops `error`:
```ts
const { data } = await sb.rpc("match_proyectos", { ... });
return (data as MatchProyectoRow[] | null) ?? [];
```
When the RPC fails (permission/grant regression, network blip, malformed vector, Postgres error), supabase-js returns `{ data: null, error }`, so this returns `[]` **without throwing**. But `app/app/buscar/page.tsx:62-74` wraps the call in `try/catch` precisely to distinguish a failed search (error banner) from an empty/degraded one ("Sin resultados"). Because no error is ever thrown, every backend failure renders as "Sin resultados" — a false negative. This breaks the phase's "honest degradation: error ≠ vacío" intent and would silently hide a future `match_proyectos` grant/RLS regression in production.
**Fix:**
```ts
const { data, error } = await sb.rpc("match_proyectos", {
  query_embedding: emb.vector,
  match_count: opts.matchCount ?? 20,
  match_threshold: opts.matchThreshold ?? 0.0,
  exclude_boletin: opts.excludeBoletin ?? null,
});
if (error) {
  throw new Error(`match_proyectos RPC falló: ${error.message}`);
}
return (data as MatchProyectoRow[] | null) ?? [];
```
(`ProyectosSimilares` at `proyectos-similares.tsx:41` calls the same function with no try/catch; once this throws, confirm that section either catches or is acceptably allowed to surface a 500 — prefer a local catch that renders the existing honest empty state.)

### CR-02: Idea-matriz provenance links to the internal R2 key, not the public source

**File:** `app/app/proyecto/[boletin]/page.tsx:95-101`
**Issue:** The provenance for the literal idea-matriz quote is built as:
```ts
sourceUrl: ficha?.texto_r2_path ?? null,
```
`texto_r2_path` is the **internal R2 object key** written by `texto-fuente.ts` via `R2Store.putImmutable` (shape `fichas/texto-fuente/<fecha>/<sha>.txt`) — it is not a URL, let alone a public one. `ProvenanceBadge` (`provenance-badge.tsx:58-66`) renders `sourceUrl` directly as `<a href={sourceUrl} target="_blank">fuente oficial ↗</a>`. A bare key as an `href` resolves relative to the site origin (`https://site/fichas/texto-fuente/...`) → a dead "fuente oficial" link shown to the public. This directly violates the project's rector principle (CLAUDE.md core value: "cada dato lleva fuente, fecha y enlace original") and the phase's own provenance promise. The genuine source is the `link_mensaje_mocion` (BCN/Senado URL), which — per WR-05 — is not even persisted, so there is currently no correct value to use.
**Fix:** Do not expose the R2 key as a public link. Either (a) persist the original `link_mensaje_mocion` on `proyecto_ficha` and use it as `sourceUrl`, or (b) until then, pass `sourceUrl: null` so the badge shows source+date without a broken link:
```ts
provenance = ideaMatriz !== null
  ? {
      capturedAt: ficha?.fecha_captura ? new Date(ficha.fecha_captura) : null,
      sourceName: sourceLabel(ficha?.origen ?? null),
      sourceUrl: null, // texto_r2_path es una key R2 interna, no un enlace público
    }
  : undefined;
```

## Warnings

### WR-01: `embedFicha` can send an empty string to Gemini (no guard on composed text)

**File:** `packages/fichas/src/embed-ficha.ts:64-75` (and `componerTextoEmbed` 41-58)
**Issue:** `componerTextoEmbed` filters null/empty parts and can legitimately return `""` (degraded ficha where `titulo` and `materia` are both empty/null and `idea_matriz` is null). `embedFicha` then calls `gemini.embed([""], "RETRIEVAL_DOCUMENT")`. Gemini may 400 on empty content or return a degenerate vector; either way the pipeline persists/corrupts an embedding with no semantic content. The doc comment claims "Nunca devuelve '' si hay al menos título o materia" — but that condition is not enforced, and `leerPendientes` defaults `titulo` to `""` (`writer-supabase.ts:124`), so an empty title is reachable.
**Fix:** Guard the empty composition before embedding and surface it as a per-boletín error (collected, not aborting):
```ts
const texto = componerTextoEmbed(proyecto, ficha);
if (texto.trim().length === 0) {
  throw new Error("embedFicha: texto compuesto vacío (sin título/materia/idea) — no se embebe");
}
```

### WR-02: pgTAP zero-vector assertion will fail — cosine distance of a zero vector is NaN

**File:** `supabase/tests/0011_fichas_embeddings.test.sql:85-101`
**Issue:** The seed inserts `array_fill(0::float4, array[768])::vector` and then calls `match_proyectos((zero vector), 5, 0.0, null)` asserting `isnt_empty`. pgvector's cosine distance (`<=>`) is undefined for a zero-norm vector and returns `NaN`; the RPC's WHERE clause `1 - (e.embedding <=> query_embedding) >= match_threshold` becomes `NaN >= 0.0` = false, so the row is filtered out and the result set is empty → the assertion fails (or is flaky across pgvector versions). The test therefore does not actually prove anon can invoke the RPC against real data.
**Fix:** Seed a non-zero unit-ish vector so cosine is defined, e.g. set the first component to 1:
```sql
insert into proyecto_embedding (boletin, embedding, embedding_model, embedding_dims, embedding_version)
  values ('99999-99',
          (select array_fill(0::float4, array[767]) || array[1::float4])::vector,
          'gemini-embedding-001', 768, 'v1');
-- and query with the same non-zero vector
```

### WR-03: `cuerpos_legales` jsonb is type-cast to `CuerpoLegalRow[]` with no runtime validation at the read boundary

**File:** `app/app/proyecto/[boletin]/page.tsx:108` → `app/components/cuerpos-legales-list.tsx:16-37`; type at `app/lib/types.ts:80`
**Issue:** `proyecto_ficha.select("*")` returns `cuerpos_legales` as raw `jsonb`, asserted to `CuerpoLegalRow[]` purely by TypeScript. If a row ever holds a non-array or differently-shaped value (manual DB edit, future writer change, legacy row), `cuerpos.map(...)` / `c.articulos?.length` either throws at render or renders garbage. The whole phase's discipline elsewhere is "zod at boundaries"; this read boundary skips it.
**Fix:** Validate with the existing `CuerpoLegalSchema` array (or a frontend-local zod) before passing to the component, falling back to `[]` on parse failure — consistent with honest degradation.

### WR-04: Original source link (`link_mensaje_mocion`) is dropped — pipeline degrades to 100% null idea-matriz in LIVE

**File:** `packages/fichas/src/writer-supabase.ts:106-131` (`leerPendientes` sets `link_mensaje_mocion: null`)
**Issue:** The parser now extracts `linkMensajeMocion` (`parse-senado-tramitacion.ts:83`), but it is a sidecar that is never persisted, and `leerPendientes` hardcodes `link_mensaje_mocion: null`. Consequently `obtenerTextoFuente(null)` always returns `{ texto: null }`, `extraer` is never called, and **every** ficha in a real backfill degrades to `idea_matriz: null` / `cuerpos_legales: []`. The write-path is functionally a no-op for its core purpose until the link is wired through. The code comments acknowledge this ("Wiring del link = follow-up"), but as shipped the phase's headline capability (literal extraction) does not execute against production data.
**Fix:** Persist `link_mensaje_mocion` (e.g. a column on `proyecto` or `proyecto_ficha`) during tramitación ingest and select it in `leerPendientes`, or otherwise plumb the sidecar into `PipelinePendiente.link_mensaje_mocion`. Track as a blocking follow-up before claiming SEM-01/02 are live.

### WR-05: `--service-key` value is silently dropped when it is the last argv token

**File:** `packages/fichas/src/pipeline-cli.ts:99-101`
**Issue:** `case "--service-key": opts.serviceKey = argv[++i];` reads the next token with no bounds check. If `--service-key` is passed as the final argument (or with no value), `argv[++i]` is `undefined`, `serviceKey` becomes `undefined`, and `decidirDryRun` then silently downgrades the run to dry-run — the operator believes they are writing to the DB but nothing is persisted, with only an easily-missed log line. Other flags (`--limite`, `--boletines`) fail-fast on bad values; this one fails silent.
**Fix:** Validate the value like the other flags:
```ts
case "--service-key": {
  const raw = argv[++i];
  if (raw == null || raw.trim().length === 0) {
    throw new FichasCliArgsError("--service-key vacío (esperado una key)");
  }
  opts.serviceKey = raw;
  break;
}
```

### WR-06: Mock provider keys by `req.user.includes(k)` — first-match wins, vulnerable to substring collisions

**File:** `packages/fichas/src/mock-provider.ts:39`
**Issue:** `const clave = [...keys].find((k) => req.user.includes(k));` returns the **first** map key contained in the prompt, in Map insertion order, not the most specific match. If any golden `textoFuente` is a substring of another (or a future case is added that is), the wrong fixture silently matches and the gate measures the wrong extraction — exactly the failure the constructor's dedupe was meant to prevent, but at match time rather than build time. Current golden texts don't collide, so this is latent, but it is a fragile foundation for a gate that guards the project's #2 existential risk.
**Fix:** Require an exact full match of the embedded text (the prompt includes `textoFuente` verbatim between triple quotes), or pick the longest matching key, and throw on ambiguity (more than one key contained in the same prompt).

## Info

### IN-01: Duplicate `leerFicha` round-trip per ficha render

**File:** `app/app/proyecto/[boletin]/page.tsx:91-108`
**Issue:** `IdeaMatrizSection` and `CuerposLegalesSection` each call `leerFicha(boletin)` independently, issuing two identical `proyecto_ficha` SELECTs per page. Functionally correct (and Next.js request memoization may coalesce them), but it is an avoidable second query for one row. Consider a single fetch shared across both sections.

### IN-02: `BOLETIN_RE` and `MAX_QUERY_CHARS` duplicated across three files

**File:** `app/lib/buscar.ts:26,29`, `app/app/buscar/page.tsx:23-24`, `app/app/proyecto/[boletin]/page.tsx:21`
**Issue:** The boletín regex and query cap are re-declared in each file. They are consistent today, but a future edit to one (e.g. allowing 7-digit boletines) risks divergence between the redirect shortcut and the path validator, which could route a "valid here / invalid there" input inconsistently. Extract to a single shared constant (e.g. `app/lib/validation.ts`).

### IN-03: `embedding_dims` column is written but never cross-checked against the actual vector length at the DB

**File:** `supabase/migrations/0011_fichas_embeddings.sql:40-44`, `packages/fichas/src/pipeline.ts:156-161`
**Issue:** `embedding_dims` is stored from `emb.dims` (always 768 from the provider) while `embedding` is `vector(768)`; there is no CHECK tying the recorded `embedding_dims` to 768. The provider already validates real dims (`gemini-embeddings.ts:130`), so this is defense-in-depth only, but a `check (embedding_dims = 768)` would make the FND-07 invariant enforceable at the storage layer.

### IN-04: `reembed` version is informational only — only one embedding per boletín can ever exist

**File:** `packages/fichas/src/pipeline.ts:111,156-161`
**Issue:** `proyecto_embedding` PK is `boletin`, so `--reembed` upserts overwrite the prior row; `embedding_version` ('v1' vs 'v1-reembed') is never used to keep both versions or to scope the index. This is fine for the single-index design, but the version field gives a false impression of incremental/parallel re-embedding. Document that re-embed is destructive-in-place, or model versioning as part of the key if true incremental re-embed is ever needed.

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
