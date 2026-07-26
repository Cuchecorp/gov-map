---
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg
plan: 02
subsystem: db-user-data-rls
tags: [migration, rls, authenticated, pgtap, two-user-isolation, queue, consent, 21719]
requires:
  - "authenticatedGrantOffenders Block D allowlist (Plan 01) — bites over-grants"
  - "USER_OWNED_TABLES = {suscripcion, consentimiento} (Plan 01)"
provides:
  - "suscripcion table (RLS owner-scoped CRUD, cascade from auth.users)"
  - "notificacion_envio table (service_role-only queue + ultimo_evento_visto cursor)"
  - "consentimiento table (21.719 registro: version_texto/metodo/created_at, insert+select own)"
  - "pgTAP two-user isolation + queue zero-grant + consent shape (validated post-0044 local)"
affects:
  - "Plan 03 (cuenta actions .from('suscripcion'/'consentimiento') via user session)"
  - "Plan 04 (notif-service.ts / digest cron reads notificacion_envio via service_role)"
  - "Plan 05 (PROD apply of 0069/0070/0071 + pgTAP against applied schema)"
tech-stack:
  added: []
  patterns:
    - "RLS to authenticated + (select auth.uid()) = user_id (init-plan wrapper)"
    - "explicit base grant to authenticated on user-owned tables (post-0044 requirement)"
    - "service_role-only queue: RLS enabled with NO policy at all"
    - "pgTAP two-user isolation via set local role authenticated + request.jwt.claims"
key-files:
  created:
    - supabase/migrations/0069_suscripcion_rls.sql
    - supabase/migrations/0070_notificacion_envio.sql
    - supabase/migrations/0071_consentimiento.sql
    - supabase/tests/0069_suscripcion_rls.test.sql
    - supabase/tests/0070_notificacion_envio.test.sql
    - supabase/tests/0071_consentimiento.test.sql
  modified: []
decisions:
  - "[Rule 2] post-0044 net-new tables give authenticated ZERO base grant (ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE); owner-scoped RLS was dead (permission denied) without an explicit grant. Added grant select,insert,delete on suscripcion + grant select,insert on consentimiento to authenticated. RLS still isolates rows; the grant only opens the table. These grants ARE the allowlisted to-authenticated the lockdown-guard Block D expects."
  - "suscripcion CRUD by owner is select/insert/delete only (NO update — estado moved by service_role confirm/baja flow)"
  - "consentimiento is append-only (insert+select, NO delete/update — baja is a new event, 21.719 traceability)"
  - "notificacion_envio has NO policy at all (service_role-only queue); zero authenticated grant enforced by Block E + pgTAP has_table_privilege false"
  - "confirm/baja tokens stored as sha256 hex hashes; raw token only in the email link (Plan 04)"
metrics:
  duration: ~18 min
  completed: 2026-07-26
  tasks: 3
  files: 6
---

# Phase 103 Plan 02: User-data tables (suscripcion / notificacion_envio / consentimiento) + RLS Summary

Created the first user-owned data in the system: three migrations (0069/0070/0071) with `to authenticated` + `(select auth.uid()) = user_id` deny-by-default RLS, a service_role-only queue with an idempotent cursor, and a 21.719 consent record — plus pgTAP two-user isolation tests validated against a scratch DB faithfully mirroring post-0044 PROD (20/20 ok, 0 not ok). The migrations were written AFTER Plan 01's guard, so Block D/E bite any over-grant.

## What was built

### Task 1 — Migrations 0069 (suscripcion) + 0071 (consentimiento) (commit 883d488, grant fix in eec645b)

- **`suscripcion`**: `id/user_id(→auth.users cascade)/tipo/objetivo_id/estado/confirm_token_hash/baja_token_hash/confirm_expira_at/created_at`, `unique(user_id,tipo,objetivo_id)`. RLS enabled + 3 owner-scoped policies (`select_own`/`insert_own`/`delete_own`) using `(select auth.uid()) = user_id` (init-plan wrapper, not bare). Tokens stored hashed (sha256 hex); raw token lives only in the email link (Plan 04).
- **`consentimiento`**: `id/user_id(→auth.users cascade)/version_texto/metodo(default doble_opt_in_email)/created_at`. RLS + insert-own + select-own (append-only; no delete/update — the baja is a new event for 21.719 traceability).
- Both: banner header cloned from 0043 (`APLICACIÓN` line with `PGCLIENTENCODING=UTF8 ... --single-transaction`, `schema_migrations` insert note), deny-by-default (no anon/public/web_reader grant).

### Task 2 — Migration 0070 (notificacion_envio) (commit 0c6c506)

- Cola/log del digest: `id/user_id(cascade)/suscripcion_id(→suscripcion cascade)/ultimo_evento_visto/enviado_at/estado/created_at`. RLS enabled with **NO policy at all** — service_role-only. `ultimo_evento_visto` is the idempotent cursor (advanced atomically only on send success). Zero authenticated grant (Block E enforces).

### Task 3 — pgTAP tests + local post-0044 validation (commit eec645b)

- **0069 test (6/6)**: table+RLS structural asserts, then two `auth.users` seeded, `set local role authenticated` + `request.jwt.claims` with two distinct `sub`: A inserts+sees its row (`results_eq 1`), B `is_empty` (RLS isolates), B's `delete ... returning 1` `is_empty` (owner-scoped), anon `has_table_privilege select = false`.
- **0070 test (6/6)**: table+RLS, `ultimo_evento_visto` column, `has_table_privilege('authenticated', ..., select/insert/update) = false`.
- **0071 test (8/8)**: table+RLS, `version_texto`/`metodo`/`created_at` columns, C-sees-own / D-cannot-read two-user isolation, anon no select.
- No assertion runs as postgres/service_role (Pitfall 2 avoided).

## Verification

- **pgTAP against a scratch DB mirroring post-0044 PROD** (Docker postgres:15 + pgtap, roles anon/authenticated/service_role, `auth.users` + `auth.uid()`, and crucially `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE ALL ON TABLES FROM anon, authenticated` to replicate 0044's durable revoke): all three migrations applied clean, then **20/20 ok, 0 not ok** across the three test files.
- `cd app && pnpm exec vitest run lib/lockdown-guard.test.ts` → **22/22 green** (Block D accepts the allowlisted `to authenticated` grants on suscripcion/consentimiento; Block E confirms notificacion_envio has zero authenticated grant).
- Non-comment grep: 0069/0071 contain zero `to anon`/`to public`/`to web_reader`; 0070 contains zero `to authenticated`.

## Threat register coverage

| Threat ID | Mitigation landed |
|-----------|-------------------|
| T-103-04 (user B reads A's subscriptions) | `(select auth.uid()) = user_id` select policy + pgTAP B `is_empty` |
| T-103-05 (user B deletes A's row) | delete policy owner-scoped + pgTAP B's delete returns empty |
| T-103-06 (authenticated touches queue) | notificacion_envio zero authenticated grant + Block E + pgTAP has_table_privilege false |
| T-103-07 (anon reads user tables) | no anon policy/grant (deny-by-default) + pgTAP anon-select false |
| T-103-SC (npm/pip installs) | ZERO new external packages this plan (no install task) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Explicit `grant ... to authenticated` on 0069/0071**
- **Found during:** Task 3 (first local pgTAP run failed with `permission denied for table suscripcion` when the `authenticated` role attempted its owner-scoped insert).
- **Issue:** The plan's migrations relied on `authenticated` holding a base table GRANT for the owner-scoped RLS policies to be usable. On Supabase, `ALTER DEFAULT PRIVILEGES` normally auto-grants `authenticated` on new `public` tables — **but 0044 ran `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`** (verified in `supabase/migrations/0044*.sql:185`). So on post-0044 PROD a net-new table gives `authenticated` **zero** base grant, and the RLS policies would be dead — every owner insert/select/delete would fail with permission-denied *before* RLS even evaluates. This makes the user-owned tables unusable by their owner (a correctness requirement, not a feature).
- **Fix:** Added `grant select, insert, delete on suscripcion to authenticated;` and `grant select, insert on consentimiento to authenticated;` (with an inline comment explaining the post-0044 requirement). The grant only opens the table; RLS `(select auth.uid()) = user_id` still isolates rows. These grants are exactly the allowlisted `to authenticated` on `USER_OWNED_TABLES` that Plan 01's lockdown-guard Block D expects, so the guard stays green.
- **Files modified:** `supabase/migrations/0069_suscripcion_rls.sql`, `supabase/migrations/0071_consentimiento.sql`
- **Validated:** re-ran the full pgTAP suite on a fresh scratch DB with the post-0044 default-privilege revoke in place (migrations supplying the grants, no manual grant) → 20/20 ok. Lockdown-guard re-run → 22/22 green.
- **Commit:** eec645b

## Deferred / Notes

- **PROD apply is Plan 05.** These tests ran pre-apply against a local scratch DB. Plan 05 applies 0069→0070→0071 (order matters: 0070 FK → suscripcion) via `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` and re-runs each pgTAP against the applied PROD schema.
- **MSYS_NO_PATHCONV=1** required for `docker cp ... /tmp/...` on Windows git-bash (else the container path is mangled to a Windows path). Noted for the operator's apply runbook.

## Known Stubs

None. All three migrations are complete, self-testing DDL; the pgTAP proves the RLS isolation, queue zero-grant, and consent shape end-to-end against a post-0044-faithful schema.

## Self-Check: PASSED

- supabase/migrations/0069_suscripcion_rls.sql — FOUND
- supabase/migrations/0070_notificacion_envio.sql — FOUND
- supabase/migrations/0071_consentimiento.sql — FOUND
- supabase/tests/0069_suscripcion_rls.test.sql — FOUND
- supabase/tests/0070_notificacion_envio.test.sql — FOUND
- supabase/tests/0071_consentimiento.test.sql — FOUND
- commit 883d488 (0069+0071) — FOUND
- commit 0c6c506 (0070) — FOUND
- commit eec645b (tests + Rule 2 grant fix) — FOUND
