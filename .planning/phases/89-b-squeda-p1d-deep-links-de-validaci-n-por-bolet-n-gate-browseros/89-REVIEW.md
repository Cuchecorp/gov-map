---
phase: 89-b-squeda-p1d-deep-links-de-validaci-n-por-bolet-n-gate-browseros
reviewed: 2026-07-22T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - supabase/migrations/0058_proyecto_prm_id_camara.sql
  - packages/tramitacion/src/parse-camara-legislativo.ts
  - packages/tramitacion/src/connector-camara.ts
  - packages/tramitacion/src/run-backfill-prmid-cli.ts
  - app/components/validacion-fuente.tsx
  - app/components/validacion-fuente.test.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/app/buscar/page.tsx
  - app/lib/types.ts
  - app/components/buscar-filtros.tsx
  - app/lib/buscar.ts
  - scripts/validar-deeplinks.mjs
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 89: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed deep-links (validacion-fuente), the `prm_id_camara` backfill CLI + connector + parser, the migration, the RSC `renderRow` fix (data embedded in `BuscarSliceRow`), the `NEXT_REDIRECT` re-throw, and the curl validation script.

Overall the security posture is solid: URLs are built from fixed hosts + `encodeURIComponent`, `safeExternalHref` guards every external href, the R2 allowlist (`startsWith("tramitacion/")`) matches the actual stored key prefix (verified against `r2-store.ts:64` + `ingest-run.ts:340`), the Supabase UPDATE is parameterized (no injection), secrets never hit logs, and the curl script uses `spawnSync` with an argv array (no shell interpolation → no shell injection even if a caller passed a hostile `--muestra`).

The main defect is a **two-stage ordering violation**: an R2 write failure inside the backfill is swallowed as an op-skip and mislabeled as a fetch failure, so the "R2 crudo ANTES gatea la Etapa 2" invariant (CLAUDE.md Conventions §1, LOCKED) does not actually hold. Several warnings concern honest error handling, dead code, and a URL-casing divergence between the component and the verified-live pattern.

## Critical Issues

### CR-01: R2 write failure in backfill is swallowed and mislabeled — two-stage invariant not enforced

**File:** `packages/tramitacion/src/run-backfill-prmid-cli.ts:180-196` + `packages/tramitacion/src/connector-camara.ts:194-214`
**Issue:** CLAUDE.md Conventions §1 (LOCKED): "todo lo descargado se persiste PRIMERO como crudo inmutable en R2 … la carga a Supabase lee del crudo" and `ingest-run.ts:88` documents "un FALLO de `putImmutable` … GATEA la Etapa 2". In this CLI the `onXml` callback (which does the R2 `putImmutable`) is invoked **inside the per-op `try` block** of `enumerarProyectosConIdXAnno` (connector-camara.ts:197-206). If `putImmutable` throws a real R2 error (non-412 — auth failure, network, bucket misconfig), the `catch` at connector-camara.ts:207 swallows it, increments `fallos`, and logs it as `"${op} ${anno} omitido"` — i.e. as if the *fetch* failed. The enumeration then returns the pairs from the OTHER op (if it succeeded) and Etapa 2 runs the `UPDATE proyecto SET prm_id_camara` **even though the raw XML was never persisted to R2**. This produces exactly the forbidden state: a Supabase derivative with no reconstructible raw in R2. It also fails silently-per-year: the operator sees "omitido" and assumes a transient source hiccup, not a storage outage.
**Fix:** Make the R2 write gate the parse/UPDATE explicitly, and do not conflate R2 failures with fetch failures. Either (a) move the `putImmutable` out of the connector's fetch-`try`, or (b) distinguish the error class. Minimal fix in the connector:
```ts
for (const op of ops) {
  const url = `${BASE_LEG}/${op}?prmAnno=${encodeURIComponent(String(anno))}`;
  let xml: string;
  try {
    xml = await this.fetch(url);
  } catch (e) {
    fallos++;
    console.warn(`[connector-camara] fetch ${op} ${anno} omitido:`, e instanceof Error ? e.message : e);
    continue;
  }
  // Etapa 1 gatea Etapa 2: un fallo de R2 DEBE abortar (no contar como op-skip).
  if (onXml) await onXml(op, xml); // throws → propaga → año marcado errAnno, sin UPDATE parcial
  for (const par of parseCamaraLegislativo(xml)) { /* dedup + push */ }
}
```
With this, an R2 failure propagates to the CLI's per-year `catch` (run-backfill-prmid-cli.ts:221), the year is counted in `totalErrAnos`, and no `UPDATE` runs for that year — the two-stage invariant holds and the exit code is non-zero.

## Warnings

### WR-01: Cámara deep-link path casing diverges from the verified-live pattern

**File:** `app/components/validacion-fuente.tsx:61` (and mirrored in `scripts/validar-deeplinks.mjs:62`)
**Issue:** The component builds `.../legislacion/proyectosdeley/tramitacion.aspx` (lowercase `proyectosdeley`), but every reference pattern in this phase — the migration comment (`0058:6`, `0058:24`), the parser header (`parse-camara-legislativo.ts:28`), the CLI header (`run-backfill-prmid-cli.ts:5`), and 89-CONTEXT.md — uses `ProyectosDeLey` (mixed case). ASP.NET IIS paths are usually case-insensitive, but this is not guaranteed (URL-rewrite rules / WAF path matching can be case-sensitive), and the whole point of TRACE-02 is a *precise* deep-link that returns the ficha, not a redirect/404. The validation script mirrors the same lowercase form, so the script would not catch a casing regression — it validates the wrong string against itself.
**Fix:** Use the casing verified live in RESEARCH: `https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=...`. Align both `validacion-fuente.tsx:61` and `validar-deeplinks.mjs:62`.

### WR-02: content-match assert is too weak — matches on boletín base only, will pass on error/redirect pages

**File:** `scripts/validar-deeplinks.mjs:108-113`
**Issue:** `assertResponse` strips the suffix and checks `body.includes(boletinBase)` where `boletinBase = boletin.split("-")[0]` (e.g. `"14309"`). A 5-digit bare number is extremely likely to appear incidentally in a generic Senado/Cámara listing, a "no encontrado" page, a footer, an unrelated boletín, or a JS bundle — so an HTTP 200 that is actually the *list* page (the exact failure the suffix requirement in 89-CONTEXT.md guards against) or a soft-404 will pass the assert. This defeats the empirical guarantee of TRACE-02.
**Fix:** Assert on the full boletín with suffix (`body.includes(boletin)`), or better, match a fica-specific marker. For Senado the full `14309-04` should appear on the ficha; for Cámara assert the `prmID` echoes back. Fall back to base only if the full form legitimately never appears (document why).

### WR-03: `esR2PathPermitido` prefix check is not anchored against traversal-style keys

**File:** `app/components/validacion-fuente.tsx:43-45`
**Issue:** `startsWith("tramitacion/")` is correct for the current key scheme (verified: `r2-store.ts:64` builds `${source}/${resource}/...` and tramitación registers `r2_path = tramitacion/{boletin}/...`). But the guard only ever gates whether the *fetched_at + hash* line renders — the `r2_path` itself is never emitted as an href (good, and the test at :109-115 confirms it). The residual risk is small but real: if a future key were `tramitacion/../infoprobidad/...` it would pass `startsWith`. Since the value is never turned into a URL today this is not exploitable, but the allowlist is the documented PII boundary (T-89-06) and should be robust to path components, not just the literal prefix.
**Fix:** Tighten to `r2_path.startsWith("tramitacion/") && !r2_path.includes("..")`, or normalize/segment the key before comparing. Add a test case with a `..` component asserting the backup is omitted.

### WR-04: `similarity: 0` sentinel in the hybrid path is a lossy contract that downstream cannot distinguish from a real 0

**File:** `app/lib/buscar.ts:229-235`
**Issue:** The hybrid RPC returns `(boletin, rank)`; the boundary normalizes to `MatchProyectoRow { boletin, similarity: 0 }`. The comment says "similarity=0 es inofensivo" because order comes from the RPC. That is true for `/buscar` (which only reads `boletin`), but `MatchProyectoRow.similarity` is a typed field consumed elsewhere (e.g. "proyectos similares" self-exclusion path). Silently coercing every hybrid row to `similarity: 0` makes a legitimate future consumer that reads `similarity` (threshold, display gate) see all-zero and mis-behave, with no type-level signal that the value is n/a in hybrid mode.
**Fix:** Make the absence honest at the type level — either widen to `similarity: number | null` and set `null` in the hybrid branch, or document at the interface (`types.ts:98`) that `similarity` is `0` sentinel under the hybrid flag and MUST NOT be read as a score. Prefer `null`.

### WR-05: `void errAnno` is dead bookkeeping — the per-year error flag is written but never consumed

**File:** `packages/tramitacion/src/run-backfill-prmid-cli.ts:176,222,229`
**Issue:** `errAnno` is set to `true` on failure and then discarded via `void errAnno; // lint`. It carries no information (the aggregate `totalErrAnos` is what drives the exit code). It is pure dead code that reads as if per-year error state matters when it does not — a maintenance trap.
**Fix:** Delete the `errAnno` local and the `void errAnno` line; rely on `totalErrAnos++` alone.

### WR-06: `normalizarIniciativa` "moción" match can misclassify (substring, not word boundary)

**File:** `app/app/buscar/page.tsx:204-210`
**Issue:** `v.includes("mocion")` after lowercasing will match any source string containing the substring — fine for the current corpus, but it also silently classifies a source text like "sin moción" or "rechazo de la moción de mensaje…" purely by first-match order (`mensaje` is checked first, so "mensaje" wins even in a moción context, and vice-versa for strings containing both). This is a soft-honesty issue: the derived `iniciativa` faceta may not reflect the source. Low blast radius but worth hardening since the faceta is a filter.
**Fix:** Anchor to the known source vocabulary (exact-ish match on the leading token), or document that Cámara/Senado only ever emit clean "Mensaje"/"Moción" strings and the substring test is safe. If the latter, a comment citing the source enum suffices.

## Info

### IN-01: `formatFethedAt` — typo in function name

**File:** `app/components/validacion-fuente.tsx:152,199`
**Issue:** `formatFethedAt` is misspelled (should be `formatFetchedAt`). Cosmetic but it's a public-ish symbol used twice.
**Fix:** Rename to `formatFetchedAt`.

### IN-02: Backfill validation-sample prmIds are all `null` — the Cámara branch of the script is never exercised by default

**File:** `scripts/validar-deeplinks.mjs:36-53`
**Issue:** Every entry in `MUESTRA_DEFAULT` has `prmId: null`, so a default run validates only Senado. The Cámara deep-link (the whole reason `prm_id_camara` exists) is never asserted unless the operator hand-passes `--muestra`. The header comment acknowledges this ("null = no testar Cámara") but it means the phase's headline feature has no default empirical gate.
**Fix:** After the backfill runs, populate at least the golden `14309-04`/`16572-06` entries with their real prmIds so the default run exercises Cámara. Document the dependency ordering (script runs after backfill).

### IN-03: Migration comment claims non-re-executable but the DDL is idempotent

**File:** `supabase/migrations/0058_proyecto_prm_id_camara.sql:12,18-19`
**Issue:** The header says "Solo corrida ÚNICA (no re-ejecutable — ALTER COLUMN)" but the statement is `add column if not exists`, which is idempotent and safe to re-run. The comment contradicts the code and could scare an operator off a safe retry.
**Fix:** Update the comment to note the `if not exists` makes it re-runnable (only the `schema_migrations` bookkeeping must not double-count).

### IN-04: `safeExternalHref` on fixed-host URLs is defense-in-depth only — test forces it via empty boletín

**File:** `app/components/validacion-fuente.test.tsx:140-155`
**Issue:** The "guard muerde" test renders with `boletin: ""`, producing `...?boletin_ini=` — a well-formed https URL that the guard *passes*, so the test asserts only "no javascript:/data:" on a URL that could never have been either. It documents intent but provides no real coverage of the guard rejecting a hostile scheme (which is impossible here because hosts are fixed). Honest but low-value; not a false pass, just thin.
**Fix:** Either accept it as a smoke assertion (fine) or move the real `safeExternalHref` rejection coverage to `utils` unit tests and note here that this is only a fixed-host sanity check.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
