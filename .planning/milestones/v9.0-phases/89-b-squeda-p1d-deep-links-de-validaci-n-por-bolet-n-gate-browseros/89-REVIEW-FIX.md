---
phase: 89-b-squeda-p1d-deep-links-de-validaci-n-por-bolet-n-gate-browseros
fixed_at: 2026-07-22T02:36:00Z
review_path: .planning/phases/89-b-squeda-p1d-deep-links-de-validaci-n-por-bolet-n-gate-browseros/89-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 8
skipped: 2
tests_passed: true
test_command: "pnpm --filter ./app test --run && pnpm --filter ./packages/tramitacion test --run"
status: all_fixed
---

# Phase 89: Code Review Fix Report

**Fixed at:** 2026-07-22T02:36:00Z
**Source review:** 89-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (CR-01, WR-01..WR-06, IN-01, IN-02, IN-03)
- Fixed: 8
- Skipped: 2 (IN-02 operator data dependency; IN-03 cosmetic comment)
- Test gate: PASSED (app: 85 files / 1070 tests; tramitacion: 18 files / 171 tests)

## Test Gate

- PASSED — `pnpm --filter ./app test --run && pnpm --filter ./packages/tramitacion test --run` exited 0 after all fixes. 1070 app tests + 171 tramitacion tests green.

## Fixed Issues

### CR-01: R2 write failure in backfill swallowed — two-stage invariant not enforced

**Files modified:** `packages/tramitacion/src/connector-camara.ts`, `packages/tramitacion/src/run-backfill-prmid-cli.ts`
**Commit:** `4486389`
**Applied fix:** Split the per-op `try` block in `enumerarProyectosConIdXAnno` into two separate blocks: one for `this.fetch()` (best-effort per op, increments `fallos`), and one for `onXml()` (R2 write — propagates to caller's per-year catch with no `continue`). A real R2 failure now propagates to the CLI's `catch (e)` block, increments `totalErrAnos`, and skips the Etapa 2 UPDATEs for that year. CLAUDE.md Conventions §1 LOCKED invariant is now enforced.

### WR-05: `errAnno` dead bookkeeping

**Files modified:** `packages/tramitacion/src/run-backfill-prmid-cli.ts`
**Commit:** `4486389` (combined with CR-01)
**Applied fix:** Removed `errAnno` local variable and `void errAnno; // lint` line. The aggregate `totalErrAnos++` is the only error counter needed.

### WR-01: Cámara URL path casing diverges from verified-live pattern

**Files modified:** `app/components/validacion-fuente.tsx`, `scripts/validar-deeplinks.mjs`
**Commit:** `062deaa`
**Applied fix:** Changed `proyectosdeley` to `ProyectosDeLey` in both `buildCamaraUrl` functions, matching the casing documented in the migration comment, CLI header, and RESEARCH.

### WR-02: content-match assert too weak (base number only)

**Files modified:** `scripts/validar-deeplinks.mjs`
**Commit:** `9308d00`
**Applied fix:** `assertResponse` now checks `body.includes(boletin)` (full boletín with suffix, e.g. `"14309-04"`) instead of `body.includes(boletinBase)`. Removed the `boletinBase` split. Added explanatory comment.

### WR-03: `esR2PathPermitido` not anchored against traversal-style keys

**Files modified:** `app/components/validacion-fuente.tsx`, `app/components/validacion-fuente.test.tsx`
**Commit:** `d74a5e7`
**Applied fix:** Added `&& !r2_path.includes("..") && !r2_path.includes("\\")` to `esR2PathPermitido`. Added a test case asserting that `tramitacion/../infoprobidad/...` produces no respaldo block (T-89-06 boundary).

### WR-04: `similarity: 0` sentinel is lossy — cannot be distinguished from real score

**Files modified:** `app/lib/types.ts`, `app/lib/buscar.ts`
**Commit:** `2a4a6a9`
**Applied fix:** Widened `MatchProyectoRow.similarity` from `number` to `number | null` with a doc comment explaining the null semantics. Changed `similarity: 0` to `similarity: null` in the hybrid path in `buscar.ts`.

### WR-06: `normalizarIniciativa` substring match can misclassify ambiguous strings

**Files modified:** `app/app/buscar/page.tsx`
**Commit:** `e98a8c3`
**Applied fix:** Replaced `v.includes("mensaje")` / `v.includes("mocion")` with `/\bmensaje\b/` and `/\bmocion\b/` regexes. Made the match exclusive: if both words appear, returns `null` (fail-honest) instead of first-match. Added explanatory comment about source corpus.

### IN-01: `formatFethedAt` typo

**Files modified:** `app/components/validacion-fuente.tsx`
**Commit:** `830073d`
**Applied fix:** Renamed `formatFethedAt` to `formatFetchedAt` (both the function declaration and its call site).

## Skipped Issues

### IN-02: Backfill validation sample prmIds are all null

**File:** `scripts/validar-deeplinks.mjs:36-53`
**Reason:** This requires operator data — the real prmIds for the golden boletines must be populated by the operator after running `run-backfill-prmid-cli.ts` and querying the DB (`SELECT boletin, prm_id_camara FROM proyecto WHERE boletin IN ('14309-04', '16572-06')`). Populating hardcoded values here without running the backfill would introduce unverified data. The comment in the script already documents the dependency.

### IN-03: Migration comment contradicts idempotent DDL

**File:** `supabase/migrations/0058_proyecto_prm_id_camara.sql:12,18-19`
**Reason:** Skipped as low-risk cosmetic comment in a migration file. The DDL itself is correct and idempotent (`add column if not exists`). Touching migration files risks confusion about re-run status in environments where the migration has already been applied. The operator can verify idempotency from the DDL directly.

---

_Fixed: 2026-07-22T02:36:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
