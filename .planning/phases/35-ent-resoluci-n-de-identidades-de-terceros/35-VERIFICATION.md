---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
verified: 2026-06-23T23:45:00Z
status: gaps_found
score: 4/6 must-have truths verified (2 blocked by CR-01); requirements 4/5 (ENT-01 pending PROD apply)
overrides_applied: 0
gaps:
  - truth: "El backfill LOCAL es idempotente/reanudable: una 2da corrida produce 0 entidades/vinculos nuevos (ENT-05)"
    status: failed
    reason: >-
      CONFIRMED CR-01 (independent of 35-REVIEW.md). The entity-master upsert targets
      ON CONFLICT (tipo_entidad, nombre_normalizado) but NO unique index with those columns
      exists on entidad_tercero. Migration 0034 creates only a PARTIAL unique index on (rut)
      WHERE rut IS NOT NULL. The (tipo_entidad, mencion_normalizada) total index exists on a
      DIFFERENT table (vinculo_entidad, 0035). A real upsert throws SQLSTATE 42P10
      ("there is no unique or exclusion constraint matching the ON CONFLICT specification"),
      so runBackfillEntidad -> upsertEntidades -> writer.upsert cannot persist any row and the
      "2nd run = 0 new" criterion can never be exercised against the real schema. The parlamentario
      mirror (writer-supabase.ts) sidesteps this by upserting on the PK `id` because `id` is DERIVED
      deterministically from the natural key; the entidad `id` is NOT derived — it comes from the DB
      sequence entidad_id_seq (0034 L27-31) and is empty for new rows (seeder-entidad.ts L18-20),
      so upserting on the natural key was the right choice — but the matching index was never created.
      Tests pass ONLY because fakeClient() (writer-entidad-supabase.test.ts L41-44) stubs upsert to
      return {error:null} without touching a database.
    artifacts:
      - path: "supabase/migrations/0034_entidad_tercero.sql"
        issue: "Only unique index is partial entidad_tercero_rut_key on (rut); no index on (tipo_entidad, nombre_normalizado)"
      - path: "packages/identity/src/writer-entidad-supabase.ts"
        issue: "Line 52/69: onConflict defaults to 'tipo_entidad,nombre_normalizado' with no matching index"
      - path: "supabase/tests/0034_entidad_tercero.test.sql"
        issue: "pgTAP asserts no natural-key index and no double-insert throws_ok('23505'); gap can recur even after apply"
    missing:
      - "Add TOTAL unique index to 0034: create unique index entidad_tercero_clave_natural on entidad_tercero (tipo_entidad, nombre_normalizado);"
      - "Add pgTAP in 0034 test: assert the index exists, is non-partial (is_indexed_partial = false), plus a double-insert throws_ok('23505')"
      - "Confirm dedup semantics vs the partial rut index before applying (two rows same (tipo,nombre) different RUTs would now collide)"
  - truth: "Existe la maestra entidad_tercero + vinculo_entidad + revision_entidad aplicadas por psql --db-url con pgTAP verde (ENT-01)"
    status: partial
    reason: >-
      All three migrations (0034/0035/0036) + three pgTAP files are written and well-formed, but
      they are NOT applied to remote PROD. Task 4 of 35-01 is a blocking-human-action checkpoint
      (the agent does not apply DDL). REQUIREMENTS.md still lists ENT-01 as Pending. ENT-01's
      acceptance explicitly includes "aplicadas por psql --db-url con pgTAP verde" — unmet until
      the operator applies them. CR-01 above ALSO means the operator must apply a FIXED 0034
      (or the seeder/backfill will throw post-apply).
    artifacts:
      - path: "supabase/migrations/0034_entidad_tercero.sql"
        issue: "Written/committed but not applied to PROD (last PROD migration is 0033); also carries CR-01"
    missing:
      - "Operator applies 0034 (fixed)/0035/0036 via psql --single-transaction, registers schema_migrations rows, runs the 3 pgTAP green, probes anon permission-denied"
human_verification:
  - test: "Operator applies migrations 0034/0035/0036 to remote PROD (psql --db-url --single-transaction) and runs the 3 pgTAP suites"
    expected: "3 migrations applied, 3 rows in schema_migrations, pgTAP 0034/0035/0036 with 0 failures, anon SELECT on entidad_tercero -> permission denied"
    why_human: "Blocking-human-action checkpoint (Task 4, autonomous:false); the agent never applies DDL to PROD. Cannot be verified programmatically by the verifier."
---

# Phase 35: ENT — Resolución de identidades de terceros Verification Report

**Phase Goal:** Build the third-party identity subsystem `entidad_tercero` mirroring the parliamentary identity machinery: master + alias + vinculo_entidad + revision_entidad (RLS deny-by-default), deterministic matcher (Δ2 jurídica-solo-RUT, fail-closed), LLM adjudication pipeline (RUT never to LLM), human review queue + RPC resolver_entidad, reconcilers populating lobby_contraparte.contraparte_id and contratista.entidad_id, LOCAL idempotent backfill + JSON custody.
**Verified:** 2026-06-23T23:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DB subsystem (master+alias+vinculo+revision) with RLS deny-by-default + anti-demotion guards | ✓ VERIFIED (code) / ⚠ not applied to PROD | 0034: entidad_tercero with tipo_entidad CHECK, estado default no_confirmado, RLS-on + `revoke all from anon,authenticated` (L60-70), COERCION trigger (L77-95). 0035: vinculo_entidad + revision_entidad, RAISE guards incl. Δ2 jurídica (L80-173), force RLS + revoke (L177-183). 0036: RPC + FKs + exact 10-type revoke/grant. Migrations NOT applied to PROD (ENT-01 gap). |
| 2 | Deterministic matcher fail-closed, jurídica-solo-RUT (Δ2), RUT never to LLM (ENT-02) | ✓ VERIFIED | deterministic-entidad.ts: jurídica branch returns no_confirmado 'juridica-sin-rut' without touching the name branch (L88-97); natural confirms only on exactly-one (L101-123); reuses normRut from ./deterministic. 13 tests pass (≥10 required). |
| 3 | LLM pipeline: gate RUT over exact prompt before complete(); jurídica skips LLM; auto-accept -> 'probable' only (ENT-02/04) | ✓ VERIFIED | pipeline-entidad.ts: `assertNoRutInLlmInput(SYSTEM+user)` before complete (L185); jurídica returns no_confirmado before any prompt (L136-155); auto-aceptar -> estado 'probable' metodo 'llm' (L201-208). 6 tests pass. |
| 4 | Doubtful matches -> revision_entidad 'pendiente'; promotion only human via RPC resolver_entidad (ENT-04) | ✓ VERIFIED | pipeline enqueues 'pendiente' (L224-233); admin page + revisor-entidad-cli resolve via .rpc('resolver_entidad', {...p_promover, p_tipo_entidad}); RPC is UPDATE-guarded-on-pendiente + UPSERT + audit, atomic (0036 L48-97). page.test.tsx + revisor-entidad-cli.test.ts pass. |
| 5 | Reconcilers populate lobby_contraparte.contraparte_id and contratista.entidad_id (ENT-03) | ✓ VERIFIED | reconciliar-sujeto.ts: contraparteId via matchDeterministaEntidad -> confirmarEntidad, null otherwise (L186, L206-215); reconciliar-contrato.ts: entidadId via resolverEntidadProveedor, RUT never to LLM/jsonb (L280-313, L492-513). 9 + 19 tests pass. |
| 6 | LOCAL backfill idempotent (2nd run = 0 new) + JSON custody (ENT-05) | ✗ FAILED | Custody side OK: backup-entidad.ts deterministic export to supabase/seeds/entidad_tercero.seed.json (6 tests pass). Idempotency side BLOCKED by CR-01: upsert ON CONFLICT key has no matching index on entidad_tercero -> SQLSTATE 42P10 at runtime; idempotency proven only against a mock. |

**Score:** 4/6 truths fully verified. Truth 1 partial (code complete, PROD apply pending). Truth 6 failed (CR-01).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| supabase/migrations/0034_entidad_tercero.sql | master+alias+seq+trigger+RLS | ⚠ STUB-ON-CONTRACT | Substantive, but missing the (tipo_entidad,nombre_normalizado) unique index its writer depends on (CR-01) |
| supabase/migrations/0035_vinculo_entidad.sql | vinculo+revision+RAISE guards+total index | ✓ VERIFIED | Total unique index present; Δ2 DB guard present |
| supabase/migrations/0036_entidad_fk.sql | FKs + RPC resolver_entidad (10 params) | ✓ VERIFIED | FK, columns, RPC, on-conflict matches 0035 index, exact-signature grants |
| packages/identity/src/deterministic-entidad.ts | matcher Δ1/Δ2 fail-closed | ✓ VERIFIED | 13 tests |
| packages/identity/src/enlace-entidad-confirmado.ts | branded type, private symbol | ✓ VERIFIED | unique symbol not exported |
| packages/identity/src/writer-entidad-supabase.ts | idempotent upsert | ✗ WIRED-TO-MISSING-INDEX | onConflict has no matching DB index (CR-01) |
| packages/identity/src/seeder-entidad.ts | idempotent seed | ⚠ depends on writer (CR-01) | Logic correct; blocked downstream |
| packages/identity/src/backup-entidad.ts | deterministic JSON custody | ✓ VERIFIED | 6 tests |
| packages/identity/src/backfill-entidad-cli.ts | LOCAL idempotent CLI | ⚠ compiles; runtime blocked by CR-01 | Chains matcher+seeder+custody |
| packages/adjudication/src/pipeline-entidad.ts | orchestrator + RUT gate | ✓ VERIFIED | 6 tests |
| packages/adjudication/src/prompt-entidad.ts | schema /^E\d{5}$/ + SYSTEM | ✓ VERIFIED | 8 tests |
| packages/adjudication/src/writer-revision-entidad.ts | cola + RPC | ✓ VERIFIED | 6 tests |
| packages/adjudication/src/revisor-entidad-cli.ts | revisor CLI | ✓ VERIFIED | 8 tests |
| packages/lobby/src/reconciliar-sujeto.ts | contraparte_id | ✓ VERIFIED | 9 tests |
| packages/dinero/src/reconciliar-contrato.ts | entidad_id | ✓ VERIFIED | 19 tests |
| app/app/admin/revisar-entidades/page.tsx | protected review queue | ✓ VERIFIED | server gate first stmt; 9 tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| writer-entidad-supabase.ts | entidad_tercero unique index | onConflict 'tipo_entidad,nombre_normalizado' | ✗ NOT_WIRED | No matching index on entidad_tercero (CR-01) — the central contract failure |
| reconciliar-sujeto.ts | matchDeterministaEntidad/confirmarEntidad | resolve each contraparte | ✓ WIRED | L206-215 |
| reconciliar-contrato.ts | contratista.entidad_id | resolverEntidadProveedor | ✓ WIRED | L284, L492-513 |
| writer-revision-entidad.ts / admin page | resolver_entidad RPC | .rpc with p_tipo_entidad (10 args) | ✓ WIRED | matches 0036 signature |
| RPC resolver_entidad on-conflict | vinculo_entidad_clave_natural | (tipo_entidad, mencion_normalizada) | ✓ WIRED | byte-matches 0035 index |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| identity matcher/seeder/custody | pnpm --filter @obs/identity test | 110 passed (incl. deterministic-entidad 13, seeder-entidad 4, backup-entidad 6, writer-entidad 5) | ✓ PASS |
| adjudication pipeline/prompt/writer/cli | pnpm --filter @obs/adjudication test | 89 passed/1 skipped (pipeline-entidad 6, prompt-entidad 8, writer-revision-entidad 6, revisor-entidad-cli 8) | ✓ PASS |
| lobby reconciler | pnpm --filter @obs/lobby test reconciliar-sujeto | 9 passed | ✓ PASS |
| dinero reconciler | vitest run packages/dinero/src/reconciliar-contrato.test.ts | 19 passed | ✓ PASS |
| admin page | pnpm --filter app test revisar-entidades | 9 passed | ✓ PASS |

Note: all suites mock the Supabase client. The ENT-05 idempotency test passes against a mock that never validates ON CONFLICT — it does NOT exercise the real index (root of CR-01).

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| pgTAP 0034/0035/0036 | psql against PROD | Not run — requires PROD apply (operator checkpoint) | SKIP (human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ENT-01 | 35-01 | Master + vinculo + revision applied via psql with pgTAP green | ✗ BLOCKED | Migrations written/well-formed but not applied to PROD; REQUIREMENTS.md = Pending; also carries CR-01 |
| ENT-02 | 35-02/03 | Deterministic matcher fail-closed + jurídica-solo-RUT + RUT-never-to-LLM (≥10 tests) | ✓ SATISFIED | deterministic-entidad (13 tests), pipeline gate (6 tests) |
| ENT-03 | 35-01/04 | Reconcilers populate FKs + RPC resolver_entidad | ✓ SATISFIED | reconciliar-sujeto/contrato + 0036 RPC |
| ENT-04 | 35-01/03/04 | Doubtful -> revision queue; promotion only human; admin UI | ✓ SATISFIED | pipeline enqueue + admin page + revisor-cli + RPC |
| ENT-05 | 35-02 | LOCAL idempotent backfill (2nd run = 0 new) + JSON custody | ✗ BLOCKED | Custody OK; idempotency blocked by CR-01 (no matching ON CONFLICT index) |

All 5 requirement IDs accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| writer-entidad-supabase.ts | 14-16 | Docstring claims a "índice único TOTAL en 0034/0035" backs the natural key — that index does not exist in 0034 | 🛑 Blocker | Contract drift; misleads; is the root of CR-01 |
| reconciliar-contrato.ts | 474-478 | Bare `catch {}` on best-effort enqueueRevision (CR-02 from 35-REVIEW) | ⚠ Warning | Sensitive linking decision lost silently if durable enqueue fails; no log |
| app/.../revisar-entidades/page.tsx | 105-128 | Server action trusts client-supplied mencion_normalizada (WR-03) | ⚠ Warning | Could upsert/overwrite wrong vinculo or key on ("natural","") |
| writer-revision-entidad.ts | 124-132,194-202 | insert().select() result ignored; no row-count assert (WR-02) | ⚠ Warning | Silent partial/RLS-filtered audit insert undetectable |

No TBD/FIXME/XXX debt markers found in phase files.

### Human Verification Required

1. **Operator applies migrations 0034/0035/0036 to remote PROD + pgTAP green**
   - Test: Apply (psql --db-url --single-transaction), register schema_migrations rows, run 3 pgTAP suites, probe anon SELECT.
   - Expected: 3 migrations applied, 3 schema_migrations rows, pgTAP 0/0 failures, anon -> permission denied.
   - Why human: Blocking-human-action checkpoint (Task 4, autonomous:false); agent never applies DDL to PROD.
   - PREREQUISITE: 0034 must be FIXED for CR-01 first, or the seeder/backfill throws post-apply.

### Gaps Summary

The TS layer of Phase 35 is strong and behaviorally verified: the deterministic matcher (Δ1/Δ2 fail-closed, jurídica-only-RUT), the branded EnlaceEntidadConfirmado, the RUT gate over the exact prompt, the jurídica-skips-LLM rule, LLM-auto-accept-to-probable-only, the human-only promotion via the transactional RPC, the two wired reconcilers, the protected admin queue, and deterministic JSON custody — all pass their suites (236 tests across 5 packages). The DDL is well-formed and the RPC on-conflict byte-matches the vinculo_entidad index.

Two things block the phase goal:

1. **CR-01 (BLOCKER, independently confirmed — NOT refuted):** The entity-master upsert targets `ON CONFLICT (tipo_entidad, nombre_normalizado)` but 0034 creates only a PARTIAL unique index on `(rut)`. The matching total index lives on a different table (vinculo_entidad). Unlike the parlamentario mirror (which upserts on the deterministically-derived PK `id`), the entidad `id` comes from a DB sequence, so upserting on the natural key was correct — but the index was never created. A real run throws SQLSTATE 42P10, so ENT-05 idempotency cannot hold. Tests pass only because the Supabase client is mocked, and even pgTAP would not catch it (0034 test has no index assertion).

2. **ENT-01 PROD apply (human checkpoint):** Migrations are not yet applied to PROD; ENT-01 acceptance requires "aplicadas por psql --db-url con pgTAP verde". This is a deliberate operator checkpoint, not a defect — but it keeps ENT-01 unmet for now. The operator must apply a CR-01-fixed 0034.

Recommended sequencing: fix CR-01 in 0034 (+ pgTAP assertion + double-insert throws_ok) FIRST, then the operator applies all three and runs pgTAP.

---

_Verified: 2026-06-23T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
