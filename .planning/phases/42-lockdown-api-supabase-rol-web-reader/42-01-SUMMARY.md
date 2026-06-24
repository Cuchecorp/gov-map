---
phase: 42-lockdown-api-supabase-rol-web-reader
plan: "01"
subsystem: database-security
tags: [lockdown, web_reader, rls, pgTAP, migration]
dependency_graph:
  requires: []
  provides: [web_reader role, 26 RLS _wr policies, 15 RPC grants, pgTAP 0043]
  affects: [supabase/migrations, supabase/tests]
tech_stack:
  added: []
  patterns: [enumerated-grant, idempotent-migration, pgTAP-positive-negative]
key_files:
  created:
    - supabase/migrations/0043_lockdown_web_reader.sql
    - supabase/tests/0043_web_reader.test.sql
  modified: []
decisions:
  - "Enumerated GRANT (26 tables + 15 RPCs by exact signature) instead of ON ALL — enforces strict subset of anon, excludes resolver_entidad and pgTAP views (gate 3)"
  - "pg_auth_members guard added to grant web_reader to authenticator block for clean idempotency"
  - "resolver_entidad excluded by omission (not by revoke) — enumeration means it is never granted, no revoke block needed"
  - "match_proyectos uses 4-arg signature: (vector, integer, double precision, text) — corrected from draft 3-arg"
  - "plan(17) in pgTAP: 10 positives + 3 negatives + 2 policy existence + 1 count + 1 regression-anon"
metrics:
  duration: "~15 min"
  completed: "2026-06-24"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
---

# Phase 42 Plan 01: LOCKDOWN-01 web_reader Migration + pgTAP Summary

**One-liner:** Idempotent migration creating `web_reader` (NOLOGIN) with enumerated SELECT on 26 tables + EXECUTE on 15 exact-signature RPCs + 26 `_wr` RLS policies; pgTAP covers positives, 3 negatives (PII/vista/resolver_entidad), and regression guard for anon.

## What Was Built

**Task 1 — `supabase/migrations/0043_lockdown_web_reader.sql`**

LOCKDOWN-01: PASO 1 de 3 del cutover. Creates `web_reader` role with:
- `do $$` block with `pg_roles` check (idempotent role creation)
- `do $$` block with `pg_auth_members` check (idempotent `grant web_reader to authenticator`)
- `grant usage on schema public to web_reader`
- 26 enumerated `grant select on public.<table> to web_reader` statements (one per table from the audited list in `_FACTS-live-prod.md`)
- 15 enumerated `grant execute on function public.<rpc>(<exact sig>) to web_reader` statements (exact signatures from RESEARCH §1)
- 26 `drop policy if exists / create policy <t>_public_read_wr` blocks

The draft's `GRANT SELECT ON ALL TABLES` + `GRANT EXECUTE ON ALL ROUTINES` + `REVOKE resolver_entidad` form was rejected and replaced by the enumerated form. With enumeration, `resolver_entidad` is never granted so no revoke block is needed.

**Task 2 — `supabase/tests/0043_web_reader.test.sql`**

pgTAP suite with `plan(17)`:

| # | Type | Assert |
|---|------|--------|
| 1 | positive | `has_role('web_reader')` |
| 2 | positive | `web_reader` is NOLOGIN |
| 3 | positive | `authenticator` is member of `web_reader` |
| 4 | positive | SELECT on `public.proyecto` |
| 5 | positive | SELECT on `public.votacion` |
| 6 | positive | SELECT on `public.declaracion` |
| 7 | positive | SELECT on `public.proyecto_embedding` |
| 8 | positive | EXECUTE on `parlamentario_publico(text)` (secdef=t) |
| 9 | positive | EXECUTE on `match_proyectos(vector, integer, double precision, text)` (4-arg, secdef=f) |
| 10 | positive | EXECUTE on `cruces_de_parlamentario(text)` (secdef=t) |
| 11 | NEGATIVE | NOT EXECUTE on `resolver_entidad(text)` (never granted, mirrors anon=false) |
| 12 | NEGATIVE | NOT SELECT on `public.parlamentario` (PII table, gate 3) |
| 13 | NEGATIVE | NOT SELECT on `public.pg_all_foreign_keys` (pgTAP view, RLS bypass) |
| 14 | positive | policy `proyecto_public_read_wr` exists |
| 15 | positive | policy `voto_public_read_wr` exists |
| 16 | positive | `is(count(*), 26)` for `%_public_read_wr` policies |
| 17 | regression | `anon` still has EXECUTE on `parlamentario_publico(text)` (0043 revoked nothing) |

## Acceptance Criteria — Static Check Results

All checks run against the written files (no DB required):

| Check | Result |
|-------|--------|
| NO `on all tables/routines/sequences` in active SQL | PASS — all 5 occurrences are in comments only |
| NO `resolver_entidad` in active SQL | PASS — all 5 occurrences are in comments only |
| Exactly 26 `grant select on public.` | PASS — count = 26 |
| Exactly 15 `grant execute on function public.` | PASS — count = 15 |
| Exactly 26 `create policy %_public_read_wr` | PASS — count = 26 |
| `match_proyectos` 4-arg signature present | PASS — `(query_embedding vector, match_count integer, match_threshold double precision, exclude_boletin text)` |
| Header "PASO 1 de 3" present | PASS |
| Header "NO REVOCA" / "NO revoca" present | PASS |
| Test: `not has_function_privilege('web_reader', 'public.resolver_entidad(text)', 'execute')` | PASS |
| Test: negative assert on `public.parlamentario` (PII) | PASS |
| Test: negative assert on `public.pg_all_foreign_keys` (vista) | PASS |
| Test: `is(count(*), 26)` for `%_public_read_wr` | PASS |
| Test: `plan(17)` matches 17 actual asserts | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing idempotency] Added `pg_auth_members` guard to `grant web_reader to authenticator`**
- Found during: Task 1
- Issue: Draft had a bare `grant web_reader to authenticator;` with no guard — would error on re-run if membership already exists.
- Fix: Wrapped in `do $$` block checking `pg_auth_members` (member=authenticator oid, roleid=web_reader oid), matching the plan spec (RESEARCH §3.2).
- Files modified: `supabase/migrations/0043_lockdown_web_reader.sql`

**2. [Rule 1 - Bug] Corrected `match_proyectos` signature in test from 3-arg to 4-arg**
- Found during: Task 2
- Issue: Draft test used `match_proyectos(vector, double precision, integer)` (3-arg, wrong order). RESEARCH §1 and `_FACTS-live-prod.md` list the correct 4-arg: `(query_embedding vector, match_count integer, match_threshold double precision, exclude_boletin text)`.
- Fix: Updated to `match_proyectos(vector, integer, double precision, text)` in pgTAP.
- Files modified: `supabase/tests/0043_web_reader.test.sql`

**3. [Rule 2 - Missing coverage] Added 2 negative asserts and 1 extra table positive not in draft**
- Found during: Task 2
- Issue: Draft had 14 asserts but was missing the required negative on `public.parlamentario` (PII), the negative on `public.pg_all_foreign_keys` (RLS-bypass vista), and the `declaracion` positive (plan required it). Plan spec (Task 2 action) enumerated all 3.
- Fix: Added asserts 6 (declaracion positive), 12 (parlamentario negative), 13 (pg_all_foreign_keys negative); updated `plan(14)` → `plan(17)`.
- Files modified: `supabase/tests/0043_web_reader.test.sql`

## Deferred — Task 3 (Operator Checkpoint)

**Task 3 is a `checkpoint:human-action` (gate="blocking-human") and was NOT executed by the agent.**

The operator must apply 0043 to PROD:

```bash
# Load SUPABASE_DB_URL via node .env parse (strip BOM, never echo)
# PGCLIENTENCODING=UTF8
psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0043_lockdown_web_reader.sql
# Insert schema_migrations row:
psql "$SUPABASE_DB_URL" -c "insert into schema_migrations (version) values ('0043');"
# Verify:
psql -tA -f supabase/tests/0043_web_reader.test.sql
```

Expected: 17 `ok` lines, 0 `not ok`, `# Looks like you ran 17 tests`.

Sanity: site remains live (anon grants untouched; web_reader newly created but not yet used). This is the **ventana segura** — both roles read identically. Resume signal: `"0043 aplicada"`.

## Self-Check: PASSED

- `supabase/migrations/0043_lockdown_web_reader.sql` — file exists, 26 grants SELECT, 15 grants EXECUTE, 26 policies, no active `on all`, no active `resolver_entidad`.
- `supabase/tests/0043_web_reader.test.sql` — file exists, plan(17), 3 negatives, 1 count assert with 26.
