---
phase: 42-lockdown-api-supabase-rol-web-reader
plan: "02"
subsystem: supabase-security
tags: [lockdown, rls, anon, revoke, pgTAP, migration]
dependency_graph:
  requires: [42-01 (0043 applied), LOCKDOWN-03 deployed to Cloudflare]
  provides: [0044_lockdown_revoke_anon.sql, 0044_revoke_anon.test.sql]
  affects: [anon/authenticated grants, supabase API public access]
tech_stack:
  added: []
  patterns: [ALTER DEFAULT PRIVILEGES FOR ROLE postgres, DROP POLICY IF EXISTS, pgTAP post-apply]
key_files:
  created:
    - supabase/migrations/0044_lockdown_revoke_anon.sql
    - supabase/tests/post-apply/0044_revoke_anon.test.sql
  modified: []
decisions:
  - "ALTER DEFAULT PRIVILEGES uses explicit FOR ROLE postgres (not implicit) — corrects draft ambiguity; required because Supabase's baked-in grants were created by postgres role"
  - "USAGE ON SCHEMA public NOT revoked from anon — inofensivo sin grants de objeto; menor blast radius; 42501 es la respuesta correcta, no 'schema no existe'"
  - "Test lives in supabase/tests/post-apply/ (outside glob) — asserts revoked end-state which would fail pre-lockdown if picked up by the regular suite"
  - "plan(109) = draft 107 + 2 new asserts (vista pg_all_foreign_keys + PII tabla parlamentario) mandated by VALIDATION B1/B5"
metrics:
  duration: "~15 min"
  completed: "2026-06-24"
  tasks_completed: 2
  tasks_deferred: 1
  files_created: 2
---

# Phase 42 Plan 02: LOCKDOWN-02 Migration + pgTAP Post-Apply Test Summary

Migration `0044_lockdown_revoke_anon.sql` (LOCKDOWN-02, PASO 3 ULTIMO del cutover) + pgTAP post-apply test with exact RPC signatures, view and PII negative asserts, plan(109).

## What Was Built

### Task 1: supabase/migrations/0044_lockdown_revoke_anon.sql

LOCKDOWN-02 migration that kills the public Supabase API channel. In order:

1. **LOUD header** — "PASO 3 DE 3 (ULTIMO) DEL CUTOVER", inline `reverse-0044` rollback (recreate 26 `_public_read` policies to anon + re-grant SELECT/EXECUTE + reverse ALTER DEFAULT PRIVILEGES).
2. **Guard** — `do $$ begin if not exists (select 1 from pg_roles where rolname='web_reader') then raise exception ...` — aborts if 0043 was not applied first.
3. **Drop 26 `_public_read` policies** — `drop policy if exists <t>_public_read on public.<t>` for all 26 tables from `_FACTS-live-prod.md`. The `_wr` policies are NOT touched.
4. **Revoke ALL on ALL** — `revoke all on all tables/routines/sequences in schema public from anon, authenticated` — catch-all covering the 35 tables + 2 views anon held (not just the 26 public ones).
5. **ALTER DEFAULT PRIVILEGES FOR ROLE postgres EXPLICIT** — `alter default privileges for role postgres in schema public revoke all on tables/routines/sequences from anon, authenticated` — neutralizes future postgres-owned object re-grants (the repo's recurring gotcha, VALIDATION BLOCKER 2 resolved).
6. **USAGE ON SCHEMA public NOT revoked** — decision documented in inline comment.

### Task 2: supabase/tests/post-apply/0044_revoke_anon.test.sql

pgTAP post-apply test with `plan(109)`. Sections:

| Section | What | Count |
|---------|------|-------|
| A | anon NOT EXECUTE on 15 RPCs (exact signatures) | 15 |
| B | authenticated NOT EXECUTE on 15 RPCs | 15 |
| C | anon NOT SELECT on 4 tables + vista pg_all_foreign_keys + PII parlamentario | 6 |
| D | 26 `_public_read` policies gone (is_empty) | 26 |
| E | 26 `_public_read_wr` policies intact (isnt_empty) | 26 |
| F | web_reader STILL has EXECUTE on 15 RPCs (regression) | 15 |
| G | web_reader STILL has SELECT on 4 tables (regression) | 4 |
| H | service_role sanity (2 checks) | 2 |
| **TOTAL** | | **109** |

## Static Acceptance Results

All 6 migration structural checks passed:

| Check | Result |
|-------|--------|
| `raise exception` guard present | PASS (1 occurrence) |
| Exactly 26 `drop policy if exists` lines | PASS (26 confirmed) |
| Zero `_wr` policies dropped | PASS |
| 3 `revoke all on all tables/routines/sequences` | PASS (3 confirmed) |
| `alter default privileges for role postgres` explicit (3 lines) | PASS |
| No `revoke usage on schema public from anon` | PASS |

Test file checks:

| Check | Result |
|-------|--------|
| `plan(109)` | PASS |
| `pg_all_foreign_keys` vista assert present | PASS |
| `parlamentario` PII assert present | PASS |
| 5 corrected RPC signatures (buscar_citaciones, comparar_declaraciones, match_proyectos, subgrafo_red, votos_de_parlamentario) | PASS |
| Total asserts = 109 (grep count) | PASS |
| File in `supabase/tests/post-apply/` (outside glob) | PASS |

## Deviations from Plan

### Auto-fixed Issues (draft corrections)

**1. [Rule 1 - Bug] ALTER DEFAULT PRIVILEGES made explicit FOR ROLE postgres**
- **Found during:** Task 1 read_first of draft
- **Issue:** Draft left the block with only implicit role (the role running the script), with a comment saying "if runner is NOT postgres, add FOR ROLE postgres". VALIDATION.md BLOCKER 2 and `_FACTS-live-prod.md §"connection role = postgres"` confirm: must be explicit always.
- **Fix:** Changed all 3 `alter default privileges in schema public revoke...` to `alter default privileges for role postgres in schema public revoke...`

**2. [Rule 1 - Bug] Five RPC signatures corrected in test (draft had truncated types)**
- **Found during:** Task 2 comparison of draft signatures vs RESEARCH §1 exact signatures
- **Issue:** Draft used wrong signatures: `buscar_citaciones(text)`, `comparar_declaraciones(text, text)`, `match_proyectos(vector)`, `subgrafo_red(text, integer)`, `votos_de_parlamentario(text)`
- **Fix:** Replaced with exact signatures from RESEARCH §1 / `_FACTS-live-prod.md`: `buscar_citaciones(text, integer, text)`, `comparar_declaraciones(text, date[])`, `match_proyectos(vector, integer, double precision, text)`, `subgrafo_red(text, integer, text[], timestamptz, timestamptz)`, `votos_de_parlamentario(text, integer, integer)`

**3. [Rule 2 - Missing critical] Added 2 negative asserts for vista + PII table**
- **Found during:** Task 2 per plan requirement + VALIDATION B1/B5
- **Added:** `not has_table_privilege('anon', 'public.pg_all_foreign_keys', 'select')` and `not has_table_privilege('anon', 'public.parlamentario', 'select')`
- **plan(N) updated:** 107 (draft) -> 109

## Deferred: Task 3 (CHECKPOINT OPERADOR)

Task 3 is a `checkpoint:human-action` gate — NOT executed in this run. The migration was WRITTEN but NOT applied to PROD. Application requires:

1. 42-01 (0043) applied to PROD (web_reader exists with its grants).
2. LOCKDOWN-03 (42-03) deployed to Cloudflare and smoke-tested (server reads as web_reader).
3. Only then: `psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0044_lockdown_revoke_anon.sql`
4. Post-apply pgTAP: `psql -tA -f supabase/tests/post-apply/0044_revoke_anon.test.sql`
5. Live curl probe (behavioral gate, VALIDATION B5): anon key against RPC + table + view + PII → expect 401/42501 on all four.
6. Site smoke (web_reader serves all surfaces).

See plan Task 3 for the full checklist and rollback procedure.

## Self-Check: PASSED

- `supabase/migrations/0044_lockdown_revoke_anon.sql` — EXISTS
- `supabase/tests/post-apply/0044_revoke_anon.test.sql` — EXISTS
- 26 drop policy lines confirmed
- 3 revoke all on all confirmed
- FOR ROLE postgres explicit confirmed
- plan(109) matches grep count of 109 asserts
