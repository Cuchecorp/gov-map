# 43-validation-db.md — Adversarial Validation of DB-Layer Tech-Debt Findings

**Validator:** Opus, 1-by-1 re-read of actual SQL file:line.
**Scope:** `supabase/migrations/0001–0044`, `supabase/tests/`.
**Date:** 2026-06-24
**Gates respected:** migrations immutable (forward-fix 0045+ only, WRITE-not-APPLY); never `db push`; never apply; no PROD connection (live counts flagged).

**Ground truth re-confirmed from files:**
- `0044_lockdown_revoke_anon.sql` revokes `from anon, authenticated` ONLY — NOT `from public`. Its `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE` is scoped `IN SCHEMA public` ONLY (lines 159–187). Cron/`service_role`/`web_reader` untouched (line 85–86).
- Schemas `cruces` (0039:79) and `grafo` (0030:103) created with bare `create schema if not exists` and **NO `grant usage`** to anon/authenticated/public anywhere in 0001–0044 (grep returned 0 hits). This is load-bearing for DB-07/08.

---

## DB-01 — 8 public-schema RPCs missing `revoke execute from public`

- **REAL or FALSE-POSITIVE:** REAL (asymmetry confirmed), but blast-radius overstated.
- **File:line re-read:**
  - `0011:90` `grant execute on function match_proyectos(...) to anon;` — no revoke. (`match_proyectos` is **invoker**, not secdef — 0011:55, no `security definer`.)
  - `0019:103` `votos_de_parlamentario` grant-to-anon (note: function re-defined in `0028:38` `create or replace`, still grant-only `0028:73`).
  - `0019:104` `rebeldias_de_parlamentario` (secdef — see DB-03).
  - `0020:51` `parlamentario_publico` (secdef, 0020:34) — grant only.
  - `0026:53` `parlamentarios_publico()` (secdef, 0026:35) — grant only.
  - `0033:73` `buscar_citaciones` — grant only.
  - Contrast CONFIRMED via grep: `0021:124`, `0023:166`, `0024:198`, `0025:172/177`, `0030:253`, `0031:86/138`, `0040:55` all carry `revoke execute ... from public`. The asymmetry is real.
- **Root cause:** Inconsistent authoring convention — some RPC migrations added `revoke ... from public` defense-in-depth, the 6 listed did not. Supabase's `ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON ROUTINES TO anon` makes the explicit grant-to-anon redundant, masking the missing revoke.
- **What breaks (and when):** Nothing on current PROD — `0044` already revoked anon/authenticated and `ALTER DEFAULT PRIVILEGES ... IN SCHEMA public REVOKE` neutralizes future re-grants for the public schema. Risk bites ONLY in a **dev/staging env that replays 0001→0043 and stops before 0044**, or a **partial reverse-0044 that recreates policies/grants but is interrupted before re-securing**. There `public` (every role) retains EXECUTE on these 6 from the Postgres default `GRANT EXECUTE TO PUBLIC` on function creation.
- **Is forward-revoke-from-public SAFE?** YES. `revoke execute ... from public` does not touch explicit grants to `web_reader` (0043 grants by name), `service_role`, or the owner `postgres`. None of these 6 are called by pg_cron. No live caller breaks. It is a pure no-op against current PROD (where 0044 already removed anon/authenticated) and a genuine hardening for fresh/partial-rollback envs.
- **Protecting test:** Partial. `0044_revoke_anon.test.sql` (post-apply) asserts anon-denied at runtime, but no test locks `public`-denied independent of 0044. A 0045 test would lock `not has_function_privilege('public', <sig>, 'execute')` for each.
- **VERDICT:** FIX-NOW(write migration 0045)+CHECKPOINT(apply by operator). Cheap, safe, closes the asymmetry. Apply is operator-only (`psql --single-transaction` + schema_migrations row).
- **Migration SQL to WRITE (0045_revoke_public_rpc_gap.sql) — do NOT apply:**
  ```sql
  revoke execute on function public.match_proyectos(vector, int, float8, text)      from public;
  revoke execute on function public.votos_de_parlamentario(text, int, int)          from public;
  revoke execute on function public.rebeldias_de_parlamentario(text)                from public;
  revoke execute on function public.parlamentario_publico(text)                     from public;
  revoke execute on function public.parlamentarios_publico()                        from public;
  revoke execute on function public.buscar_citaciones(text, int, text)             from public;
  -- web_reader path (0043) and service_role/postgres explicit grants are untouched by revoke-from-public.
  ```
- **pgTAP asserts to lock it (new test, executes operator-side):** for each signature, `select ok( not has_function_privilege('public', 'public.<fn>(<types>)', 'execute'), ... )`; plus `ok( has_function_privilege('web_reader', ...) )` to prove the public path still works (regression guard against over-revoke).

---

## DB-02 — `0036` `vinculo_id` cross-FK write in INSERT body

- **REAL or FALSE-POSITIVE:** REAL as a *file-level lie*; FALSE-POSITIVE as an *operational bug* (neutralized).
- **File:line re-read:** `0036:86-89` inserts `v_vinculo_id` (id from `vinculo_entidad`, 0036:82 `returning id into v_vinculo_id`) into `identidad_audit.vinculo_id` (FK → `vinculo_identidad`). Wrong-FK cross-write confirmed.
- **0037 override re-read:** `0037:29-98` is a FULL `CREATE OR REPLACE function public.resolver_entidad(...)` — replaces the entire body; the INSERT at `0037:87-88` targets `vinculo_entidad_id` (correct column). `0037:19-24` adds the column + CHECK `num_nonnulls(vinculo_id, vinculo_entidad_id) <= 1`. Repo replays sequentially (0036 → 0037), so on any fresh `db reset` the buggy body is overwritten before any row exists.
- **Root cause:** Copy authoring error in 0036; PROD `vinculo_identidad` empty → first confirm-with-promote would have thrown 23503. Fixed forward by 0037 (already applied per memory).
- **What breaks (and when):** Nothing on PROD (0037 applied) and nothing on fresh reset (sequential overwrite). The only theoretical fire is an **abnormal interrupted replay halted between 0036 and 0037** — not a normal state. File is a maintenance trap for anyone reading 0036 in isolation.
- **Protecting test:** YES, already exists — see DB-10. `0037_...test.sql` assert #8 (`vinculo_entidad_id` non-null) + #9 (`vinculo_id` IS NULL) lock the correct behavior.
- **VERDICT:** WON'T-FIX (immutable file; cosmetic lie; operationally dead; already test-guarded). No 0045 needed. Editing 0036 is forbidden. Adding a clarifying comment to 0036 would itself violate immutability of an applied file — decline.

---

## DB-03 — `rebeldias_de_parlamentario` secdef, grant-to-anon, no revoke-from-public

- **REAL or FALSE-POSITIVE:** REAL (most sensitive instance of DB-01).
- **File:line re-read:** `0019:73-98` `create or replace function rebeldias_de_parlamentario(p_id text) ... language sql stable security definer set search_path=''`; body reads `public.parlamentario.partido` (0019:80, 87 — LEGAL-03 sensitive) with elevated privilege. `0019:104` `grant execute ... to anon`, no `revoke ... from public`. Output columns (0019:74-77) do NOT project `partido` — current output is PII-safe.
- **Root cause:** Same as DB-01; aggravated because secdef reads `partido` internally, so a privilege-layer defense is more valuable here.
- **What breaks (and when):** Current PROD: mitigated by 0044. Dev/staging stopping at 0043, or partial reverse-0044: `public` (incl. unauthenticated) can call it. Output stays safe UNLESS a future migration alters the body to project `partido` — then no privilege-layer backstop exists. This is defense-in-depth, not an active leak.
- **Is forward-revoke SAFE?** YES — identical reasoning to DB-01; no live caller (not cron-invoked); web_reader grant by name in 0043 preserved.
- **Protecting test:** Folded into DB-01's proposed 0045 test (`public` denied). No existing independent guard.
- **VERDICT:** FIX-NOW(write migration 0045)+CHECKPOINT(apply). Included in the DB-01 0045 block above (`revoke execute on function public.rebeldias_de_parlamentario(text) from public;`).

---

## DB-04 — 8 migrations with no test file

- **REAL or FALSE-POSITIVE:** PARTIALLY REAL — overstated; several "uncovered" migrations are incidentally exercised.
- **File:line re-read / cross-ref:**
  - `0009_voto_fuente_voter_id` — `voter_id` IS referenced in `0007`, `0019`, `0029` tests (grep). Coverage incidental, not a dedicated constraint/deny guard.
  - `0010_agenda` — agenda schema covered by `0008_agenda.test.sql` (overlap real).
  - `0013_proyecto_ficha_estado_error` — NO test references `estado_error`/ficha-error states. Genuine gap.
  - `0014_vinculo_no_confirmado_dedup` — no matching test. Genuine gap.
  - `0016_citacion_invitado_calidad` — `calidad` IS referenced in `0008` + `0032` tests. Partial coverage.
  - `0017_higiene_seguridad` — patches `set search_path=''` on `vinculo_identidad_guarda*` / `identidad_audit_immutable` (0017:8-10) + creates `util.cleanup_net_http`/`util.reserve_host_slot`. Search_path hardening not independently asserted.
  - `0028` — covered by `0029_votos_instructivos.test.sql` (name offset only — NOT a gap).
  - `0031` — see DB-09.
- **Root cause:** Tests authored per-feature, not 1:1 per migration; schema-only/patch migrations skipped.
- **What breaks (and when):** Silent drift — a renamed column or dropped constraint in 0013/0014/0017 would not fail CI. No runtime risk today; a future-maintenance trap.
- **Protecting test:** Missing for 0013, 0014, 0017 (search_path), thin for 0009/0016.
- **VERDICT:** FIX-NOW (test-file additions — agent can WRITE; execution is operator-side vs PROD via `psql -tA -f`). Lowest-value targets (0028, 0010) drop from the list. Recommend dedicated tests for **0013, 0014, 0017** (highest drift risk) with: `has_column`/`col_type_is`/`has_check`/constraint-existence + (for 0017) `is( (select proconfig ...) contains 'search_path=' )` on the three guard functions.
- **pgTAP to write (example, 0017):** `select is( (select array_to_string(p.proconfig,',') from pg_proc p where p.proname='vinculo_identidad_guarda'), 'search_path=', ... )` for each of the 3 functions.

---

## DB-05 — Stale `"supabase test db"` boilerplate in test headers

- **REAL or FALSE-POSITIVE:** REAL. grep: 25 test files contain the stale `supabase test db` runner note. Real runner is `psql -tA -f <file>` against applied PROD (per 0041/0043 tests + MEMORY.md; confirmed by the `set local role anon` / PROD-seeded-data assertions that only pass vs applied schema, e.g. 0039 cmp_ok>=5).
- **Root cause:** Boilerplate copied across the suite before the runner reality (PROD-only pgTAP, header "supabase test db" = stale) was established.
- **What breaks (and when):** Developer confusion / wrong runner invocation. No runtime or security impact. Documented as a recurring confusion source in MEMORY.md.
- **Protecting test:** N/A (documentation defect).
- **VERDICT:** FIX-NOW (mass header edit across 25 test files — pure repo edit, no migration, no PROD). Replace with `-- Corre vía: psql -tA -f supabase/tests/<file>` against applied PROD schema. Single PR, no checkpoint.

---

## DB-06 — `0039_cruce_senal.test.sql` plan(11)→plan(10) off-by-one

- **REAL or FALSE-POSITIVE:** FALSE-POSITIVE (already corrected AND statically verifiable — NOT a live-check item).
- **File:line re-read:** `0039 test:18` `select plan(10)`. Enumerated the actual top-level assertions: `has_table`(57), `is`RLS(58), `is`policies=0(63), `is`secdef(68), `ok`no-PII(77), `cmp_ok`>=5(85), `is`enlace_fuente(91), `is`crudo(98), `is`cron(105), `throws_ok`anon(111) = **exactly 10**. Matches `plan(10)`. (Discovery's grep undercounted because `cmp_ok` wasn't in its pattern — the count is correct.)
- **Root cause:** Historical off-by-one already fixed in Plan 04; comment documents the fix.
- **What breaks:** Nothing. plan(10) == 10 asserts.
- **Protecting test:** The test itself.
- **VERDICT:** WON'T-FIX (already correct; statically confirmed). Discovery's "needs live PROD check" is unnecessary — the count is determinable from the file. Re-classify from NEEDS-LIVE-CHECK to RESOLVED.

---

## DB-07 — `cruces.materializar_cruces()` no `revoke execute from public`

- **REAL or FALSE-POSITIVE:** The missing-revoke is REAL; the **blast-radius claim (anon can wipe `cruce_senal`) is a FALSE-POSITIVE.**
- **File:line re-read:** `0039:81-122` `create or replace function cruces.materializar_cruces() returns void language plpgsql security definer set search_path=''`; body `delete from public.cruce_senal` (0039:85) + re-insert — destructive full rebuild, confirmed. NO `revoke execute ... from public` follows.
- **Decisive nuance:** `cruces` schema (0039:79) is created with bare `create schema if not exists` and **NO `grant usage`** to anon/authenticated/public (grep across all migrations = 0 hits). Calling `cruces.materializar_cruces()` requires BOTH EXECUTE on the function AND USAGE on the `cruces` schema. Postgres `CREATE SCHEMA` grants USAGE only to the owner (postgres), never to PUBLIC. Therefore anon/authenticated **cannot reach** the function regardless of the PUBLIC execute default. The "unauthenticated caller wipes cruce_senal" scenario does not hold on current PROD.
- **Root cause:** Postgres default `GRANT EXECUTE TO PUBLIC` on function creation, not explicitly revoked. Latent, not exploitable via the API role path.
- **What breaks (and when):** No exploit path via anon (no schema USAGE). Residual concern is purely defense-in-depth: if a future migration ever `grant usage on schema cruces to anon` (mirroring the 0030/grafo pattern that the repo has flirted with), the un-revoked PUBLIC execute would become live. Also note 0044's durable `ALTER DEFAULT PRIVILEGES` protection is `IN SCHEMA public` only — it does NOT cover `cruces`, so a future function in `cruces` created by postgres re-inherits the PUBLIC default.
- **Is forward-revoke SAFE?** YES. pg_cron job `cruces-materializar` (0039:138-142) was scheduled by the migration connection role = `postgres` (the function owner); pg_cron runs it as that role. Owner always retains EXECUTE regardless of a PUBLIC revoke. `service_role` is superuser-like and unaffected. No live caller relies on the PUBLIC grant. Safe no-op hardening.
- **Protecting test:** `0039 test:111` proves anon can't READ `cruce_senal` (42501) but does NOT assert public-denied EXECUTE on the materializer. A 0045 test would add it.
- **VERDICT:** FIX-NOW(write migration 0045)+CHECKPOINT(apply) — LOW priority (latent, no current exploit path). Worth doing because it is free and closes the `cruces`-schema gap that 0044's public-only ADP does not cover.
- **Migration SQL to WRITE:** `revoke execute on function cruces.materializar_cruces() from public;`
- **pgTAP to lock:** `select ok( not has_function_privilege('public', 'cruces.materializar_cruces()', 'execute'), ... )`.

---

## DB-08 — `grafo.materializar_aristas()` no `revoke execute from public`

- **REAL or FALSE-POSITIVE:** Missing-revoke REAL; **blast-radius (anon wipes `entidad`/`arista`) FALSE-POSITIVE** — identical schema-USAGE reasoning to DB-07.
- **File:line re-read:** `0030:105` `create or replace function grafo.materializar_aristas() returns void language plpgsql security definer set search_path=''`; destructive (`delete from public.entidad ...`). NO revoke-from-public. `grafo` schema (0030:103) created bare, no `grant usage` (grep = 0).
- **Root cause / safety / what-breaks:** Same as DB-07. No anon USAGE on `grafo` → unreachable by the API role. Cron `net-materializar` scheduled as postgres (owner). 0044 ADP is public-schema-only → `grafo` uncovered for future functions. Forward-revoke is a safe no-op (owner + service_role retain execute).
- **Protecting test:** `0030_net.test.sql` — does not assert public-denied execute on the materializer (would be added by 0045 test).
- **VERDICT:** FIX-NOW(write migration 0045)+CHECKPOINT(apply) — LOW priority. Bundle with DB-07.
- **Migration SQL to WRITE:** `revoke execute on function grafo.materializar_aristas() from public;`
- **pgTAP to lock:** `select ok( not has_function_privilege('public', 'grafo.materializar_aristas()', 'execute'), ... )`.

---

## DB-09 — `bienes_de_parlamentario` (0031) not tested independently

- **REAL or FALSE-POSITIVE:** REAL (test gap), but the privilege half of the concern is already handled.
- **File:line re-read:** `0031:24` `create or replace function public.bienes_de_parlamentario(p_id text)`; `0031:86` `revoke execute ... from public` + `0031:87` grant-to-anon — so 0031 is NOT part of the DB-01 revoke gap (correctly authored). `0031:91` `create or replace comparar_declaraciones(text, date[])` OVERWRITES the 0022 definition; `0031:138` revoke-from-public present. `0022 test:138-148` tests `comparar_declaraciones` existence/secdef/anon-grant but NOT `bienes_de_parlamentario`, and predates the 0031 bienes-join body. No `0031_*.test.sql` exists.
- **Root cause:** RPC added without a dedicated test; 0022 test continues to pass against the 0031-overwritten `comparar_declaraciones` body, masking the absence of bienes coverage.
- **What breaks (and when):** Silent behavior drift in `bienes_de_parlamentario` (bienes join, return columns) or in the 0031 `comparar_declaraciones` extension would not fail CI. No runtime/security risk (revoke present). Maintenance gap only.
- **Protecting test:** Absent for the 0031 RPC bodies.
- **VERDICT:** FIX-NOW (test-file addition — agent WRITEs; execution operator-side vs PROD).
- **pgTAP to write (0031_probidad_bienes_rpc.test.sql):** `has_function('public','bienes_de_parlamentario',ARRAY['text'])`; secdef assert; `has_function_privilege('anon', 'public.bienes_de_parlamentario(text)', 'execute')` AND `not has_function_privilege('public', ..., 'execute')` (locks the 0031:86 revoke); plus a `results_eq`/`bag_eq` on return columns of a seeded `bienes_de_parlamentario(<id>)` call to lock the bienes-join shape.

---

## DB-10 — No test asserts the 0037 override kills the `vinculo_id` write

- **REAL or FALSE-POSITIVE:** FALSE-POSITIVE. The asserted-missing guard ALREADY EXISTS.
- **File:line re-read:** `0037_resolver_entidad_audit_fix.test.sql` `plan(12)`:
  - assert #8 (lines 70-73): `isnt( (select vinculo_entidad_id ...), null, 'audit row has vinculo_entidad_id non-null')`.
  - assert #9 (lines 76-79): `is( (select vinculo_id ...), null, 'audit row has vinculo_id null (correct XOR)')` — **exactly the regression guard DB-10 proposes to add.**
  - Plus assert #10 (88-96) locks the CHECK (23514 when both non-null) and #12 (108-113) locks the parliamentary FK rejects a `vinculo_entidad` id (23503).
- **Root cause:** Discovery did not read the test body; the XOR guard is present.
- **What breaks:** Nothing. A future migration re-introducing a `vinculo_id` write from `resolver_entidad` would fail assert #9.
- **VERDICT:** WON'T-FIX / RESOLVED (guard already present). No edit needed. Optionally a one-line comment could cross-link assert #9 to the 0036 lie, but that is cosmetic and not required.

---

## Reconciliation notes (cross-cutting)

- **0044 public vs anon:** Re-confirmed 0044 revokes `from anon, authenticated` only and ADP-revokes `IN SCHEMA public` only. This is why DB-01/03 (public-schema, anon-revoked-but-public-not) are no-ops on PROD yet still a fresh-reset/partial-rollback gap, and why DB-07/08 (`cruces`/`grafo`) get NO durable ADP protection from 0044.
- **Schema USAGE is the real gate for DB-07/08:** the absence of `grant usage on schema cruces|grafo to anon` (grep-verified 0 hits) is what actually protects the destructors today — more than the (missing) function-level revoke. Any future `grant usage` on these schemas to anon MUST be paired with the DB-07/08 revokes; flag this as a guardrail.
- **All proposed 0045 revokes are pure no-ops on current PROD and break no live caller** (owner postgres + cron + service_role + web_reader-by-name all retain access). The repo's recurring ADP re-grant bite (0041/0042/0044 history) does NOT recur here because `revoke ... from public` is not re-granted by Supabase's `FOR ROLE postgres ... TO anon` default (that targets anon, not PUBLIC).

---

## Compact Verdict Table

| ID    | Verdict | One-line reason |
|-------|---------|-----------------|
| DB-01 | FIX-NOW(write 0045)+CHECKPOINT(apply) | Real asymmetry; revoke-from-public is a safe no-op on PROD, hardens fresh/rollback envs. |
| DB-02 | WON'T-FIX | Immutable 0036; bug fully overwritten by 0037 on sequential replay; already test-guarded. |
| DB-03 | FIX-NOW(write 0045)+CHECKPOINT(apply) | secdef reads `partido`; same safe revoke-from-public, folded into DB-01's 0045. |
| DB-04 | FIX-NOW (tests; exec operator) | Overstated — 0009/0010/0016/0028 incidentally covered; real gaps = 0013, 0014, 0017. |
| DB-05 | FIX-NOW (mass header edit, no migration) | Confirmed 25 files with stale `supabase test db`; real runner is `psql -tA -f`. |
| DB-06 | WON'T-FIX / RESOLVED | plan(10) statically == 10 asserts; not a live-check item; already fixed. |
| DB-07 | FIX-NOW(write 0045)+CHECKPOINT — LOW | Missing revoke real, but anon has NO `cruces` schema USAGE → unreachable; revoke is free DiD. |
| DB-08 | FIX-NOW(write 0045)+CHECKPOINT — LOW | Same as DB-07 for `grafo`; bundle the two revokes. |
| DB-09 | FIX-NOW (test; exec operator) | `bienes_de_parlamentario` untested; revoke already present (not a DB-01 case). |
| DB-10 | WON'T-FIX / RESOLVED | 0037 test assert #9 already locks `vinculo_id IS NULL`; the proposed guard exists. |
