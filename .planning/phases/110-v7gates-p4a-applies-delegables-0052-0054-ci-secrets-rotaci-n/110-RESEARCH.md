# Phase 110 — RESEARCH

**Gathered:** 2026-07-27 (live read-only PROD check by orchestrator)
**Status:** RESEARCH COMPLETE

## Decisive finding — live PROD migration state (read-only query, 2026-07-27)

Resolves the STATE.md contradiction (v8.1 memory said 0053/0054 applied; Phase 74 note said 0054 not applied). Queried PROD `bctyygbmqcvizyplktuw` read-only:

| Migration | Object checked | Live result | Action for Phase 110 |
|-----------|----------------|-------------|----------------------|
| **0052** `cruce_senal_lobby_sector_aporte` | `pg_constraint` def of `cruce_senal_tipo_senal_check` | `CHECK ((tipo_senal = 'lobby_sector'::text))` — **`lobby_sector_aporte` ABSENT** | **APPLY** (agent, delegable) + run pgTAP |
| **0053** `leylobby_cursor_estado` | `to_regclass('public.leylobby_cursor_estado')` | **exists (true)** | **NO-OP** — already applied; verify only |
| **0054** `leyes_rotacion_estado` | `to_regclass('public.leyes_rotacion_estado')` | **exists (true)** | **NO-OP** — already applied; verify only |

`max(schema_migrations.version)` = **0072** (schema_migrations has traces; 0053/0054 landed during v8.1 per memory `v8-1-demo-perfecto-shipped`).

## 0052 apply safety (read of `supabase/migrations/0052_*.sql`)

- **Bloque 1**: `drop constraint cruce_senal_tipo_senal_check` then `add constraint ... check (tipo_senal in ('lobby_sector','lobby_sector_aporte'))`. Constraint name **matches live** (verified above → Pitfall A1 precondition SATISFIED). Aditivo: only ADDS the token.
- **Bloque 2**: `create or replace function cruces.materializar_cruces()` — redefinition ONLY. The migration does **NOT** call/select the function, so applying it does **NOT** trigger the `delete from public.cruce_senal` full-rebuild at apply time. The `cruces-materializar` cron (0039) inherits the new branch on its next run. → apply is non-destructive at apply time.
- **NOT idempotent** (drop+add constraint) → apply exactly ONCE, `--single-transaction`. Re-run would fail on the drop (constraint would already be renamed/present). Guard: the apply plan must re-check `lobby_sector_aporte` ABSENT immediately before applying (fail-closed if already present).
- pgTAP: `supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql` exists (7 assertions per STATE 72-02). Run against APPLIED schema. Expect 7/7 ok, 0 not ok. Expected `count(*) where tipo_senal='lobby_sector_aporte'` = **0** honest (empresa→sector edge absent + RUT-01/backfill pending — NOT a bug).
- 0053/0054 have **no** pgTAP test files → verification = object-existence assertion (done) + column/constraint shape spot-check.

## Apply mechanics (runbook `72-.../72-APPLY-RUNBOOK.md`, note 74)

- `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0052_*.sql`. NEVER `supabase db push` (schema_migrations drift). BOM in `.env` → extract `SUPABASE_DB_URL` skipping BOM, pass `--db-url` explicit. Never print the URL.
- Read-only queries: `set -a; source .env; set +a` equivalent; filter `not exists (pg_depend deptype='e')` for object listings.

## Operator checkpoints (blocking-human — agent documents/verifies, NEVER executes)

- **SC2 — CI secrets**: operator loads `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in GH repo settings (deploy workflow YAML reference already correct — DEBT-03) + GH billing verified. Agent verifies via `gh secret list` if `gh` authed, else documents exact steps zero-credential-values.
- **SC3 — rotate DB password B26**: runbook `75-.../75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`. Blast radius = `SUPABASE_DB_URL` ONLY (CI/site use `SUPABASE_SECRET_KEY` REST → unaffected). Verify post-rotation: old url fails, new url works, CI/site green. Agent NEVER rotates or prints secret values.

## Requirements mapped
- **V7-01** = applies 0052/0053/0054 with pgTAP green (reduced to 0052 apply + 0053/0054 verify).
- **V7-07** = CI secrets + DB password rotation (operator checkpoints).

## RESEARCH COMPLETE
