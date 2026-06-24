---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
verified: 2026-06-24T09:30:00Z
status: passed
score: 5/5 requirements satisfied; 6/6 observable truths verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "ENT-05 idempotency (CR-01): 0034 now creates TOTAL unique index entidad_tercero_clave_natural on (tipo_entidad, nombre_normalizado) — the writer ON CONFLICT now has a targetable index; 42P10 no longer thrown. pgTAP 0034 26/26 against PROD."
    - "ENT-01 PROD apply: 0034/0035/0036/0037 applied to PROD + rows in supabase_migrations.schema_migrations; full pgTAP suite green (0034 26/26, 0035 18/18, 0036 15/15, 0037 12/12); anon SELECT on entidad_tercero -> 42501 (deny-by-default)."
    - "ENT-03/ENT-04 (Issue 1, broken resolver_entidad audit FK): forward-fix 0037 adds identidad_audit.vinculo_entidad_id FK->vinculo_entidad + CHECK num_nonnulls<=1 + corrected INSERT; confirm-with-promote no longer throws 23503 against empty PROD. resolver_entidad grants: anon=f/authenticated=f/public=f/service_role=t."
    - "Issue 2 (0035 plan(18) vs 16 asserts): 35-07 added 2 real asserts anchored to real schema (revision_entidad no force-RLS; anon no INSERT on vinculo_entidad); 0035 now 18/18."
  gaps_remaining: []
  regressions: []
---

# Phase 35: ENT — Resolución de identidades de terceros Verification Report

**Phase Goal:** Maestra `entidad_tercero` (ID estable, alias, matcher determinista, pipeline de adjudicación con gate humano, deny-by-default) que extiende el subsistema de identidad a donantes/proveedores y gestores de lobby; conecta los reconciliadores existentes (antes dejaban `contraparte_id`/`contratista` NULL).
**Verified:** 2026-06-24T09:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (35-05 / 35-06 / 35-07). The prior 35-VERIFICATION (2026-06-23) predated those plans and was stale; both of its gaps are now closed and re-confirmed against code on disk + PROD ground truth.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DB subsystem (master+alias+vinculo+revision) with RLS deny-by-default + anti-demotion guards, applied to PROD with pgTAP green | ✓ VERIFIED | `0034` entidad_tercero+alias+seq+COERCION trigger (file L30-106), TOTAL natural-key index `entidad_tercero_clave_natural` (L61, **CR-01 fix**), RLS+revoke (L72-81). `0035` vinculo_entidad+revision_entidad, Δ2 jurídica-only-determinista RAISE guards (L121-126, L159-164), force RLS+revoke (L177-183). `0036` FK+RPC. `0037` audit FK forward-fix. **PROD ground truth:** 4 migrations in schema_migrations; pgTAP 0034=26/26, 0035=18/18, 0036=15/15, 0037=12/12; anon SELECT entidad_tercero -> 42501. |
| 2 | Deterministic matcher fail-closed, jurídica-solo-RUT (Δ2), RUT never to LLM (ENT-02) | ✓ VERIFIED | `deterministic-entidad.ts` jurídica branch returns no_confirmado 'juridica-sin-rut' without touching name branch (L88-97); natural confirms only on `=== 1` (L101-123); reuses `normRut` (L24). 13 tests. Pipeline gate `assertNoRutInLlmInput(SYSTEM+user)` before `complete()` (`pipeline-entidad.ts` L185). |
| 3 | LLM pipeline: jurídica skips LLM; RUT gate over exact prompt; auto-accept -> 'probable' only (ENT-02/04) | ✓ VERIFIED | `pipeline-entidad.ts` jurídica returns no_confirmado before any prompt (L136-155); gate at L185 before L188 complete; auto-aceptar -> estado 'probable' metodo 'llm' (L201-208, never 'confirmado'). 6 tests. |
| 4 | Doubtful matches -> revision_entidad 'pendiente'; promotion only human via RPC resolver_entidad (ENT-04) | ✓ VERIFIED | pipeline enqueues 'pendiente' (L224-233); admin page calls `.rpc('resolver_entidad', {10 args incl p_promover, p_tipo_entidad})` (`page.tsx` L132-143), metodo 'humano' (L124); page-level `notFound()` gate as first statement (L154-156). RPC UPDATE-guarded-on-pendiente (0036 L50-60). |
| 5 | Reconcilers populate lobby_contraparte.contraparte_id and contratista.entidad_id (ENT-03) | ✓ VERIFIED | `reconciliar-sujeto.ts` contraparteId via matchDeterministaEntidad->confirmarEntidad, null otherwise (L206-215); `reconciliar-contrato.ts` entidadId via resolverEntidadProveedor, RUT never to LLM/jsonb (L284, L492-513). 9 + 19 tests. RPC FKs in 0036 L19-24. |
| 6 | LOCAL backfill idempotent (2nd run = 0 new) + JSON custody (ENT-05) | ✓ VERIFIED | `backfill-entidad-cli.ts` LOCAL operator CLI (L2-15) chaining matcher->seeder->custody; idempotency via natural-key upsert (`writer-entidad-supabase.ts` onConflict L53) now backed by the TOTAL index 0034 L61 (CR-01 closed -> upsert no longer throws 42P10, "2nd run = 0 new" exercisable against real schema; pgTAP 0034 throws_ok('23505') on double-insert proves it). Custody export to `supabase/seeds/entidad_tercero.seed.json` (`backup-entidad.ts` L20, L89). 6 tests. |

**Score:** 6/6 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| supabase/migrations/0034_entidad_tercero.sql | master+alias+seq+trigger+RLS+TOTAL natural index | ✓ VERIFIED | TOTAL index `entidad_tercero_clave_natural` present (L61); CR-01 closed |
| supabase/migrations/0035_vinculo_entidad.sql | vinculo+revision+RAISE guards+total index+Δ2 | ✓ VERIFIED | Total unique index L49-50; Δ2 DB guards L121-126/L159-164 |
| supabase/migrations/0036_entidad_fk.sql | FKs + RPC resolver_entidad (10 params) | ✓ VERIFIED | FK L19-24, RPC L30-97, exact 10-type revoke/grant L102-119 |
| supabase/migrations/0037_resolver_entidad_audit_fix.sql | audit FK forward-fix + CREATE OR REPLACE | ✓ VERIFIED | vinculo_entidad_id FK L19-20, CHECK L22-24, corrected INSERT L88, deny-by-default after fn L105-122 |
| supabase/tests/0034..0037 .test.sql | pgTAP suites | ✓ VERIFIED | plan(26)/plan(18)/—/plan(12); CR-01 asserts present (0034 L65/L68-73/L78-81). PROD: all green |
| packages/identity/src/deterministic-entidad.ts | matcher Δ1/Δ2 fail-closed | ✓ VERIFIED | 13 tests |
| packages/identity/src/writer-entidad-supabase.ts | idempotent upsert | ✓ VERIFIED | onConflict L53 now matches 0034 TOTAL index; docstring corrected L14-17; 5 tests |
| packages/identity/src/seeder-entidad.ts | idempotent seed | ✓ VERIFIED | natural-key path now applies (CR-01 closed) |
| packages/identity/src/backup-entidad.ts | deterministic JSON custody | ✓ VERIFIED | 6 tests |
| packages/identity/src/backfill-entidad-cli.ts | LOCAL idempotent CLI | ✓ VERIFIED | LOCAL operator (L2-15), runtime unblocked |
| packages/adjudication/src/pipeline-entidad.ts | orchestrator + RUT gate + jurídica skip | ✓ VERIFIED | 6 tests |
| packages/adjudication/src/prompt-entidad.ts | schema + SYSTEM, no RUT | ✓ VERIFIED | 8 tests |
| packages/adjudication/src/writer-revision-entidad.ts | cola + RPC | ✓ VERIFIED | 6 tests |
| packages/adjudication/src/revisor-entidad-cli.ts | revisor CLI | ✓ VERIFIED | 8 tests |
| packages/lobby/src/reconciliar-sujeto.ts | contraparte_id | ✓ VERIFIED | 9 tests |
| packages/dinero/src/reconciliar-contrato.ts | entidad_id | ✓ VERIFIED | 19 tests |
| app/app/admin/revisar-entidades/page.tsx | protected review queue | ✓ VERIFIED | notFound gate first stmt L154; 10-arg RPC L132-143 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| writer-entidad-supabase.ts | entidad_tercero TOTAL index | onConflict 'tipo_entidad,nombre_normalizado' | ✓ WIRED | Now matches `entidad_tercero_clave_natural` (0034 L61). **Was the CR-01 failure; now closed.** |
| reconciliar-sujeto.ts | matchDeterministaEntidad/confirmarEntidad | resolve each contraparte | ✓ WIRED | L206-215 |
| reconciliar-contrato.ts | contratista.entidad_id | resolverEntidadProveedor | ✓ WIRED | L284, L492-513; FK 0036 L23-24 |
| admin page / revisor-cli | resolver_entidad RPC | .rpc with p_tipo_entidad (10 args) | ✓ WIRED | byte-matches 0036/0037 signature |
| resolver_entidad audit INSERT | identidad_audit.vinculo_entidad_id | FK -> vinculo_entidad | ✓ WIRED | 0037 L88 writes correct column; FK L19-20. **Was Issue 1; now closed.** |
| RPC resolver_entidad on-conflict | vinculo_entidad_clave_natural | (tipo_entidad, mencion_normalizada) | ✓ WIRED | byte-matches 0035 index |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| identity matcher/seeder/custody/writer | pnpm --filter @obs/identity test | 110 passed (deterministic-entidad 13, seeder-entidad, backup-entidad 6, writer-entidad 5) | ✓ PASS |
| adjudication pipeline/prompt/writer/cli | pnpm --filter @obs/adjudication test | 89 passed/1 skipped (pipeline-entidad 6, prompt-entidad 8, writer-revision-entidad 6, revisor-entidad-cli 8) | ✓ PASS |
| lobby reconciler | pnpm --filter @obs/lobby test reconciliar-sujeto | 9 passed | ✓ PASS |
| dinero reconciler | npx vitest run packages/dinero/src/reconciliar-contrato.test.ts | 19 passed | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| pgTAP 0034 | psql against PROD (per session ground truth) | 26/26, 0 failures | PASS |
| pgTAP 0035 | psql against PROD | 18/18, 0 failures | PASS |
| pgTAP 0036 | psql against PROD | 15/15, 0 failures | PASS |
| pgTAP 0037 | psql against PROD | 12/12, 0 failures | PASS |
| resolver_entidad grants | grant probe on PROD | anon=f, authenticated=f, public=f, service_role=t | PASS |
| anon SELECT entidad_tercero | PostgREST probe | 42501 permission denied | PASS |

Note: pgTAP/grant probes were executed against PROD this session (operator ground truth supplied to the verifier); not re-run here to avoid touching PROD. The corresponding pgTAP source files and CR-01/0037 assertions are confirmed present on disk.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ENT-01 | 35-01/05/07 | Master + vinculo + revision applied via psql with pgTAP green | ✓ SATISFIED | 0034/0035/0036/0037 applied to PROD + schema_migrations; pgTAP 26/18/15/12 all green; anon deny 42501 |
| ENT-02 | 35-02/03 | Deterministic matcher fail-closed + jurídica-solo-RUT + RUT-never-to-LLM (≥10 tests) | ✓ SATISFIED | deterministic-entidad.ts L88-123 (13 tests); pipeline gate L185 (6 tests) |
| ENT-03 | 35-01/04/06 | Reconcilers populate FKs + RPC resolver_entidad | ✓ SATISFIED | reconciliar-sujeto L206-215 + reconciliar-contrato L492-513; 0036 FK+RPC; 0037 audit FK closes confirm-with-promote 23503 |
| ENT-04 | 35-01/03/04/06 | Doubtful -> revision queue; promotion only human; admin UI | ✓ SATISFIED | pipeline enqueue L224-233; admin page gate+10-arg RPC; resolver_entidad deny-by-default (service_role only); pgTAP 0037 regression green |
| ENT-05 | 35-02/05 | LOCAL idempotent backfill (2nd run = 0 new) + JSON custody | ✓ SATISFIED | CR-01 closed: TOTAL index 0034 L61 backs onConflict; pgTAP throws_ok('23505') on double-insert; custody backup-entidad L20/L89 |

All 5 requirement IDs satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (CLOSED) writer-entidad-supabase.ts | 14-16 | Prior docstring claimed TOTAL index in 0034/0035 (false) | ✓ RESOLVED | Docstring corrected in 35-05; index now actually exists in 0034 |
| reconciliar-contrato.ts | ~474 | Bare `catch {}` on best-effort enqueueRevision (CR-02, 35-REVIEW) | ℹ Info | Sensitive linking decision could be lost silently if durable enqueue fails. Not goal-blocking; carry as future hardening. |
| writer-revision-entidad.ts | insert().select() result ignored (WR-02) | no row-count assert | ℹ Info | Silent partial/RLS-filtered audit insert undetectable. Not goal-blocking. |

No TBD/FIXME/genuine-XXX debt markers in phase files (the only matches are "Exxxxx" entity-id format placeholders inside docstrings).

### Human Verification Required

None outstanding. The migration-apply + pgTAP checkpoint that the prior verification deferred to human has been executed against PROD this session (ground truth) and is reflected above. The two residual Info-level items (bare catch in reconciliar-contrato; ignored insert result in writer-revision-entidad) are non-blocking hardening notes, not human gates.

### Gaps Summary

No gaps. Both blockers from the stale 2026-06-23 verification are closed and re-confirmed:

1. **CR-01 (ENT-05 idempotency)** — closed by 35-05: migration 0034 now creates the TOTAL unique index `entidad_tercero_clave_natural` on `(tipo_entidad, nombre_normalizado)` (file L61), exactly the key the writer's `ON CONFLICT` targets (writer-entidad-supabase.ts L53). A real upsert no longer throws 42P10; pgTAP 0034 (26/26) asserts the index exists, is non-partial (`indpred is null`), and a double-insert throws `23505`. Idempotency "2nd run = 0 new" is now exercisable against the real schema.

2. **ENT-01 PROD apply + full pgTAP** — closed by 35-05/06/07: 0034/0035/0036/0037 applied to PROD with rows in `schema_migrations`; full suite green (26/18/15/12); anon deny confirmed (42501). The two preexisting 35-01 defects that surfaced when the pgTAP first ran against PROD were both fixed: Issue 1 (broken `resolver_entidad` audit FK — was a BLOCKER for ENT-03/ENT-04) by forward-fix 0037 (`identidad_audit.vinculo_entidad_id` FK + CHECK + corrected INSERT; confirm-with-promote no longer throws 23503), and Issue 2 (0035 plan-count) by 35-07.

The TS layer (deterministic matcher Δ1/Δ2 fail-closed, jurídica-only-RUT, RUT gate over the exact prompt, jurídica-skips-LLM, LLM-auto-accept-to-probable-only, human-only promotion via the transactional RPC, both wired reconcilers, the gated admin queue, deterministic JSON custody) is fully present on disk and behaviorally verified (227 tests across the five packages). All five requirements (ENT-01..ENT-05) are SATISFIED.

**Overall phase verdict: COMPLETE.**

---

_Verified: 2026-06-24T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
