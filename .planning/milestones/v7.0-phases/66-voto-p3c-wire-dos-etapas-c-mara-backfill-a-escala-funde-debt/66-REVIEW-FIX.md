---
phase: 66-voto-p3c-wire-dos-etapas
fixed_at: 2026-07-14T04:16:42Z
review_path: .planning/phases/66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt/66-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
tests_passed: true
test_command: pnpm --filter @obs/tramitacion test && pnpm --filter @obs/votos test
status: all_fixed
---

# Phase 66: Code Review Fix Report

**Fixed at:** 2026-07-14T04:16:42Z
**Source review:** .planning/phases/66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt/66-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (CR-01, WR-01, WR-04): 3
- Fixed: 3
- Skipped: 0
- Deferred (out of scope, noted below): WR-02 (folded into WR-01), WR-03/IN-03, WR-05, IN-01, IN-02
- Test gate: PASSED (`@obs/tramitacion` 147/147 + `@obs/votos` 28/28)

## Test Gate

- PASSED — cross-connector suite green after the shared `ingest-run.ts` change.
  - `@obs/tramitacion`: 17 files, 147 tests passed (exercises tramitacion/lobby/votos connectors through the shared `runIngest`).
  - `@obs/votos`: 3 files, 28 tests passed (includes new CR-01 Test E and WR-01 test (e)).
  - Typecheck (`tsc -b`) clean for both `@obs/tramitacion` and `@obs/votos`.

## Fixed Issues

### CR-01: Supabase vote write proceeds even when the R2 Stage-1 write throws

**Files modified:** `packages/tramitacion/src/ingest-run.ts`, `packages/votos/src/run-camara-votos.test.ts`
**Commit:** c22be8f
**Applied fix:** Restructured the Etapa-1 R2 block in `runIngest` so a `putImmutable` FAILURE (non-412 HTTP status or network fault) now GATES Etapa 2 for that boletín: the error is pushed to `errores` (etapa `r2-etapa1`) and the loop `continue`s, skipping the Supabase upsert. The 412 = idempotent-success path (`existed`) is preserved verbatim (still `continue`s = "sin novedades"). The `snapshotWriter` sub-block stays best-effort/non-fatal (its own inner try/catch is untouched) — only the content-addressed crudo put gates the write. Updated the `r2Store` doc comment to describe the new fail-closed semantics. This is strictly more conservative (fail-closed) and affects all connectors routed through `runIngest`.

Added **Test E** to `run-camara-votos.test.ts`: injects an R2Store whose `putImmutable` throws, and asserts (a) `upsertVotos` is never called (`upsertVotosTicks.length === 0`, `writer.votos.size === 0`, `res.votos === 0`) and (b) the boletín appears in `res.errores` with etapa `r2-etapa1`. Existing Test A (happy-path ordering) and Test D (idempotent `existed` skip) still pass — the 412 path is unchanged.

Note: this is a control-flow/fail-closed change (not a subtle logic condition); verified by the new negative test plus the full cross-connector suite, so no separate "requires human verification" flag is warranted.

### WR-01: Coverage invariant matched no_confirmado by DIPID number alone (recycle-trap false-positive)

**Files modified:** `packages/votos/src/cobertura.ts`, `packages/votos/src/cobertura.test.ts`
**Commit:** 3e1c83b
**Applied fix:** Scoped `contarDipidsMaestraNoConfirmados` to the Cámara by adding a PostgREST `!inner` join on `votacion` with `.eq("votacion.camara","diputados")`, so a vote from another cámara whose `fuente_voter_id` numerically collides with a current-maestra DIPID no longer inflates the invariant. `dipidsMaestra` remains the current (mono-period, gated by P65) maestra set. Documented the precondition loudly: the join suffices while the seed is single-period; a future multi-period seed needs an additional period filter on the votación (there is no period column on `voto` today).

**WR-02 folded in here (per brief):** rewrote the header comment (b), the `CoberturaReport.dipidsMaestraNoConfirmados` doc, and the function doc to state accurately what the invariant detects — *index/seed drift* (a current-maestra DIPID whose vote came back `no_confirmado`) — and to explicitly correct the false claim that it "catches a name-match regression" (it cannot; `reconciliarVotosCamara` never name-matches, and a bad name-link would surface as a false `confirmado`, which this `no_confirmado` count never sees).

Added test (e): a Senado vote with a colliding `fuente_voter_id` (843) stays out of the invariant (result 0), proving the recycle-trap scoping. Updated the fake supabase client to model the embedded `votacion.camara` filter (default `diputados` for rows without an explicit cámara, preserving existing tests a-d).

### WR-04: `--limit` parsing silently accepted garbage and non-integers

**Files modified:** `packages/votos/src/run-votos-masivo-cli.ts`
**Commit:** 1709be6
**Applied fix:** Replaced `Number(flagValue("--limit") ?? "1000")` with explicit parse + validation: default 1000 when the flag is absent; otherwise reject any non-integer or `<= 0` value with a clear `--limit inválido: '<raw>' (debe ser un entero > 0)` error. This stops `NaN`/`0`/fractional values from silently disabling or corrupting the WAF-safety limit. Typecheck clean; this CLI is a top-level `main()` entry with no unit test, so verification was Tier-1 (re-read) + Tier-2 (`tsc -b`).

## Deferred / Out-of-scope (noted, not fixed)

These were explicitly out of the fix scope (critical + the two named warnings) and are recorded as debt:

- **WR-02** — invariant description overclaim. NOT skipped: folded into the WR-01 comment rewrite (commit 3e1c83b) as the brief directed. The optional *additional* check it suggested (count `confirmado` votes whose `parlamentario_id` is outside the maestra id set, to guard misattribution-by-name) is NOT implemented — deferred as a possible future coverage metric.
- **WR-03 / IN-03** — R2 content-address includes the UTC calendar date, so the idempotent 412 skip and snapshot dedup break across a midnight boundary on long/resumed backfills (extra Supabase work + duplicate `source_snapshot` rows; no duplicate votes because the upsert key is natural). Deferred debt: drop the date from the content-address (`tramitacion/<boletin>/<sha>.json`) or check any date prefix before writing, and align `FakeR2Store` to key on the full `r2Path`. Not addressed here to keep the shared `ingest-run.ts` change minimal and focused on the CR-01 integrity gate.
- **WR-05** — `--from-r2` replay writes to a REMOTO Supabase with no dry-run confirmation and no boletín/period sanity check against the vigente maestra. Deferred: it needs a period cross-check (or a confirmation flag) that is more than a trivial edit and touches the replay path in `run-camara-votos.ts`; deferred as debt rather than shipped half-done.
- **IN-01** — non-null assertions (`SUPABASE_API_URL!`) after the `escribeReal` guard. Cosmetic/robustness; deferred.
- **IN-02** — `porEstado` hardcodes only two `estado_vinculo` states; a future `probable` would be silently omitted. Deferred; consider deriving via `group by` or asserting `sum(porEstado) === total`.

---

_Fixed: 2026-07-14T04:16:42Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
