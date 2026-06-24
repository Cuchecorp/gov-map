# Phase 42 LOCKDOWN — Adversarial Validation B (Revoke Completeness · Cutover · Rollback)

**Validator:** Opus (adversarial). **Date:** 2026-06-24. **Scope:** revoke completeness, cutover order, rollback, idempotency, pgTAP-vs-PROD.
**Inputs read:** `_FACTS-live-prod.md`, `42-CONTEXT.md`, `drafts/0043_lockdown_web_reader.sql` (present), `_inventory-live.txt` (live PROD dump), `_inv2.sql`, `app/lib/supabase.ts`. **0044 draft + test files NOT yet present** → evaluated from FACTS + inventory + the 0043 draft.

**Bottom line:** the architecture is sound and the cutover order is correct, but there are **2 BLOCKERs** and several HIGH-severity gaps that will either leave a residual anon read path or break idempotency/rollback. Fix before planning.

---

## 1. REVOKE COMPLETENESS

### VERDICT: CONDITIONAL PASS — but with 1 BLOCKER and 2 HIGH gaps. The "26 policies + REVOKE ALL ON ALL" plan is necessary but NOT provably sufficient as scoped in CONTEXT.

The mental model in CONTEXT ("drop 26 policies + revoke the inventory") is **under-counted**. The live inventory contradicts the 26-centric framing:

**Finding 1a (HIGH) — anon has SELECT on 37 tables/views, not 26.**
`===SELECT_TABLES_ANON===` lists **37** relations with a SELECT grant; only **26** carry a `*_public_read` policy. The extra 11 are: `parlamentario`, `parlamentario_alias`, `pii_contraparte_declaracion`, `vinculo_identidad`, `identidad_audit`, `drift_alert`, `ingest_run`, `revision_identidad`, `source_snapshot`, plus two **views** `pg_all_foreign_keys` and `tap_funky` (pgTAP). The 11 tables read 0 rows today *only because RLS denies them* (no policy) — the grant is real. **0044 must `REVOKE SELECT` from all 37**, i.e. use `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated` (catch-all), not a hand-list of 26. If 0044 is written table-by-table off the "26" list, the PII-table grants survive — still RLS-denied, but it violates gate 3's "exactamente el set" symmetry and leaves a latent footgun if any of those 11 later gets a stray policy. **VERDICT on the catch-all `REVOKE ALL ON ALL TABLES/ROUTINES/SEQUENCES`: correct and required — do NOT enumerate.**

**Finding 1b (BLOCKER) — VIEWS bypass RLS and are the real residual read path.**
`pg_all_foreign_keys` and `tap_funky` are **views** (pgTAP), and `RLS_ENABLED_TABLES` only lists `relkind='r'` (ordinary tables) — **views have no RLS of their own.** A view executes with the privileges of its *owner* unless `security_invoker=on`. If anon retains SELECT on a view owned by a privileged role, anon reads whatever the view selects, RLS-bypassed, **even after table policies are dropped**. Today these two are harmless pgTAP metadata, BUT:
  - The plan must **enumerate every view/materialized view in `public`** (`select relname, relkind, reloptions from pg_class where relnamespace='public'::regnamespace and relkind in ('v','m')`) and confirm none projects project data. The inventory dump did NOT capture views as a class — this is an audit hole.
  - `REVOKE ALL ON ALL TABLES IN SCHEMA public` **does** cover views and matviews (PG treats them as "tables" for grant purposes) → the catch-all revoke neutralizes them. **So the BLOCKER is not the revoke — it's that 0043 grants them to web_reader.** `GRANT SELECT ON ALL TABLES ... TO web_reader` (line 75) will hand web_reader SELECT on `pg_all_foreign_keys`/`tap_funky` and **any future view**. If someone later adds a `security definer`/owner-privileged view exposing PII and forgets a policy, **web_reader reads it RLS-free** — silently widening the public surface the server serves. Gate 3 ("ni una columna/tabla PII más") is at risk via the view vector.
  - **FIX:** (i) audit views now; (ii) in 0043, after the blanket grant, add explicit `REVOKE ... FROM web_reader` on any non-project view, OR convert the design to **enumerate the 26 tables for the SELECT grant** instead of `ON ALL TABLES` (see 1c trade-off); (iii) add a CI guard that fails if a new view in `public` lacks `security_invoker=on` (Postgres 15+ supports it). At minimum, document that web_reader's view exposure == anon's today (true) and that 0044 closes anon's.

**Finding 1c (design tension) — `GRANT ON ALL TABLES/ROUTINES TO web_reader` is broader than the 26+15 curated set.**
The draft justifies the blanket grant (comments a/b) because 4 RPCs are `secdef=f` and need pgvector operator EXECUTE, and SELECT-on-all is "a safer subset of anon." That reasoning is **correct for functional fidelity** but it means web_reader's *table grant surface* = anon's (all 37 + all future tables), gated only by which policies exist for web_reader. Since 0043 only creates 26 `_wr` policies, web_reader reads exactly the 26 today — **behaviorally identical to anon, good.** But the residual risk is the view/future-table path (1b). **Acceptable IF** the CI guard (§5) enforces "no new public view without security_invoker, no new `to web_reader` policy on a PII table." Recommend planning explicitly chooses: **Option A (faithful/broad, current draft)** + CI guard, or **Option B (least-privilege)**: `GRANT SELECT` on the 26 tables only + `GRANT EXECUTE` on the 15 RPCs + the specific pgvector operator functions match_proyectos needs. Option B is more work and risks missing a pgvector helper (→ match_proyectos 500s). **Recommend Option A + guard**, but the plan must say so.

**Finding 1d (BLOCKER) — `ALTER DEFAULT PRIVILEGES` is REQUIRED and the draft omits it; without it, future Supabase/migration objects auto-grant to anon and silently re-open the API.**
This is the repo's hard-won gotcha (MEMORY: "ALTER DEFAULT PRIVILEGES re-grants to anon"; FACTS line 12: Supabase's baked-in `ALTER DEFAULT PRIVILEGES ... GRANT ALL ... TO anon`). The live source of anon's ALL-on-every-table is a **default privilege**, almost certainly owned by `postgres` (and possibly `supabase_admin`). Consequences:
  - **Neither 0043 nor 0044 touches default privileges.** After 0044's `REVOKE ALL ... FROM anon`, the *next* table created in `public` by `postgres` (a future migration, a Supabase-managed feature, a `CREATE TABLE` in the dashboard) **auto-grants ALL to anon again** → anon silently regains SELECT on the new table. If that table later gets a `_public_read`-style policy (easy to copy-paste), the public API is back open for that table, undetected.
  - **0044 MUST include:** `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;` and the same `... ON FUNCTIONS/ROUTINES FROM anon, authenticated;` and `... ON SEQUENCES ...`. **The `FOR ROLE postgres` clause is load-bearing** — `ALTER DEFAULT PRIVILEGES` without `FOR ROLE` only affects defaults for objects created *by the current role*; the Supabase auto-grant is attached to the role that owns the existing default ACL. **Planning MUST first identify that owner** (`select defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl from pg_default_acl;`) and emit one `ALTER DEFAULT PRIVILEGES FOR ROLE <owner>` per (owner, objtype) that grants to anon/authenticated. There may be more than one owner (`postgres` and `supabase_admin`). **This is a BLOCKER: omit it and the lockdown leaks on the next migration.**
  - Caveat: even with this, a future `db push` that re-runs Supabase's bootstrap could re-add the default privilege. Mitigation = the CI guard in §5 (fail on any `grant ... to anon` / `alter default privileges ... to anon` in new migrations).

**Finding 1e (note) — functions still EXECUTE-able after revoke?**
`REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated` covers all 461. But **`EXECUTE` on functions is also a PUBLIC default** in stock Postgres for non-`security definer` SQL/PLpgSQL functions created with default ACL — verify the 15 RPCs are not granted to `PUBLIC` (`\df+` / `proacl`). If any RPC has `=X/owner` (PUBLIC execute) in its `proacl`, revoking from anon won't stop a `Bearer anon` call because anon inherits PUBLIC. **Plan must check `proacl` of the 15 RPCs for a `PUBLIC` (`=X`) entry and `REVOKE EXECUTE ... FROM PUBLIC` if present.** Same applies to the pgvector operator functions match_proyectos uses — if they're PUBLIC-executable, web_reader works regardless, which is fine, but it also means anon could still call them post-revoke (harmless without table SELECT, but include in the probe).

**Finding 1f (note) — `authenticated` policies: none exist.** `===POLICIES_ALL===` confirms all 26 policies are `roles=anon` only; there are zero `to authenticated` policies. So dropping anon policies + `REVOKE ... FROM authenticated` fully covers authenticated (it had grants but never had a permissive policy → already 0 rows; revoke removes the grant). Good — no hidden authenticated read path.

**Net §1:** the catch-all `REVOKE ALL ON ALL TABLES/ROUTINES/SEQUENCES FROM anon, authenticated` makes the anon key useless **for the 37 tables and 461 routines that exist now** — PROVIDED you ALSO (a) revoke default privileges `FOR ROLE <owner(s)>` [1d BLOCKER], (b) audit views/matviews and confirm none is an owner-privileged PII projection [1b BLOCKER], (c) check the 15 RPCs + pgvector funcs for PUBLIC execute [1e]. Tables added since the inventory: none can exist between audit and apply if you re-snapshot at apply time — **add a pre-apply assertion in 0044** that the live anon table-grant set ⊆ {37 known} (else abort), so a table added in the window is caught.

---

## 2. CUTOVER ORDER / FAILURE MODES

### VERDICT: PASS on order; HIGH gap on fail-closed behavior of LOCKDOWN-03; the "both work" window is SAFE.

Order `apply 0043 → deploy 03 → apply 0044` is correct. Step-by-step adversarial walk:

**Step 0043 applied (web_reader exists, anon untouched).** No effect on live API. ✓. Risk: `grant web_reader to authenticator` — if `authenticator` already errored or web_reader creation half-applied, PostgREST is unaffected (it still SET ROLEs anon). Safe.

**Window between 0043 and 0044 — BOTH anon and web_reader can read the 26.** Is it safe? **YES.** web_reader's grants are a faithful mirror; no PII expansion (no `_wr` policy on PII tables). The only "exposure" is that during this window the public anon API is still fully open — which is the *status quo*, not a regression. The window can last hours/days (operator deploys 03 between). No new attack surface. ✓. (Minor: web_reader is reachable by anyone who can mint a `role:web_reader` JWT — but that requires the JWT secret, same trust boundary as service_role. Acceptable.)

**Step 03 deploy (server switches to web_reader JWT) — BEFORE 0044.** Failure modes:
  - **If `SUPABASE_JWT_SECRET` is missing/wrong in Cloudflare:** this is the **HIGH gap**. The plan must specify **fail-closed-LOUD**. Two sub-cases:
    - *Missing secret, naive impl:* `createServerSupabase` falls back to the anon key (today's code path) → site keeps working **as anon** → operator sees green, deploys nothing wrong... until 0044 lands and the **entire site 500s** because the server is still effectively anon. This is the **silent-fallback trap.** **FIX:** `createServerSupabase` MUST `throw` at startup if `SUPABASE_JWT_SECRET` is absent (mirror the existing `throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY")` guard at supabase.ts:24). No anon fallback. A failed deploy is recoverable; a silent-anon deploy that detonates on 0044 is not.
    - *Wrong secret:* PostgREST rejects the JWT signature → **every** `.from()`/`.rpc()` returns 401 immediately, even before 0044. The operator sees a fully broken site on the 03 deploy itself → catches it pre-revoke. This is the *good* failure (loud, pre-revoke). Ensure the impl surfaces the 401 (don't swallow). **VERDICT: require fail-closed; add a deploy smoke test (curl the deployed site's /api or a known page) BEFORE applying 0044.**
  - **Token TTL / clock skew:** if the web_reader JWT is minted with a short TTL and cached, a stale token → intermittent 401s. Plan must define TTL + refresh (mint per-request or cache with margin). Not a cutover blocker but a runtime correctness item.

**Step 0044 applied (revoke) — LAST.** If mis-ordered (applied **before** 03 deploys): the live server still sends `Bearer <anonKey>` → role anon → **every read 500s**. Concretely which queries fail: **all 10 `.from()` targets** (proyecto, proyecto_ficha, tramitacion_evento, votacion, citacion, sesion_sala, *_ingesta_estado ×4) → permission denied on SELECT; **all 7 `.rpc()` calls** (parlamentario_publico, parlamentarios_publico, agregado_por_contraparte, buscar_citaciones, cruces_de_parlamentario, subgrafo_red, match_proyectos) → permission denied on EXECUTE. Note `buscar_citaciones` and `match_proyectos` are `secdef=f` → they fail on **both** the EXECUTE revoke AND the underlying table/operator revoke. **Result: total site outage**, every page. This is exactly why order is gated. ✓ correctly identified in FACTS/CONTEXT.

**Extra cutover risk (MEDIUM):** the operator applies 0044 via `psql --single-transaction`. If 0044 also drops the 26 anon policies AND revokes, and the transaction is **interrupted mid-way** (network), you could land in a partial state (some policies dropped, revoke not done). `--single-transaction` protects this (all-or-nothing) — **confirm 0044 is ONE transaction** and does NOT `\echo`-split into multiple. ✓ if convention followed.

---

## 3. ROLLBACK

### VERDICT: CONDITIONAL PASS — rollback of grants is straightforward; rollback of `ALTER DEFAULT PRIVILEGES` is REQUIRED and easy to forget; 03 rollback is independent and clean.

**Rollback of 0044 (re-open anon) — outline SQL:**
```sql
begin;
-- 1. Re-grant the broad table/routine privileges anon had (faithful to pre-0044 PROD).
grant select on all tables in schema public to anon, authenticated;
grant execute on all routines in schema public to anon, authenticated;
-- (anon also had ALL writes inert under RLS; re-granting SELECT is enough to restore READ.
--  To be byte-identical to pre-0044, re-grant ALL: `grant all on all tables ... to anon, authenticated;`
--  Recommended: restore ALL to match the captured pre-state, since writes were inert anyway.)
grant all on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon;          -- 26 seqs anon had
-- 2. Recreate the 26 _public_read policies (anon, for select, using(true)).
--    (drop-if-exists each, then create — see 0043 pattern but TO anon.)
--    e.g.:
drop policy if exists proyecto_public_read on proyecto;
create policy proyecto_public_read on proyecto for select to anon using (true);
--    ... repeat for all 26 ...
-- 3. CRITICAL: restore the default privileges so future tables auto-grant to anon again
--    (only needed if 0044 revoked them — it MUST, per §1d — so rollback MUST restore them):
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated;
alter default privileges for role postgres in schema public grant usage on sequences to anon;
--    (repeat FOR ROLE <each owner found in pg_default_acl pre-0044>)
commit;
```
**Gaps to flag in the rollback plan:**
- **(BLOCKER for rollback completeness) The `ALTER DEFAULT PRIVILEGES` reversal (step 3) is mandatory and the natural draft will omit it** — same blind spot as §1d. Without it, a rollback restores *current* tables to anon but leaves future tables non-granted to anon → drift. Capture the EXACT pre-0044 `pg_default_acl` state and reverse it explicitly.
- **Rollback must NOT drop the `_wr` policies or web_reader** — rollback re-opens anon as a *safety net while 03 is reverted*; web_reader staying alive is harmless and lets you re-attempt cutover. Only drop web_reader in a full teardown.
- **Idempotency of rollback:** use `drop policy if exists ... ; create policy ...` (not `create policy if not exists` — Postgres has no such form for policies). Re-running the rollback must be safe.

**Can the operator roll back 03 independently?** **YES — and this is the primary rollback lever.** Redeploying the previous Cloudflare build (server reads as anon again) is a pure deploy revert, no DB change. **Crucially, 03-rollback only restores the site IF anon still has grants** — i.e. it works in the window *before* 0044, or *after* a DB rollback. If 0044 has already been applied, rolling back 03 alone does NOT fix the site (anon is dead); you must roll back the DB (0044) first/too. **Document this dependency explicitly:** rollback order is the **reverse** of cutover — (1) redeploy old server [03], then optionally (2) re-grant anon [reverse 0044]; but if 0044 is live, you MUST do the DB re-grant to restore service. The cleanest rollback when fully cut over and something breaks: **re-grant anon (reverse 0044) first** — that instantly restores the site whether the server reads as anon (old build) OR web_reader (current build, web_reader still has its grants). So: **reverse-0044 is the single highest-leverage rollback**; 03 redeploy is secondary.

---

## 4. IDEMPOTENCY & RE-APPLY

### VERDICT: 0043 mostly idempotent with 1 HIGH non-idempotent line; 0044 idempotency depends on unwritten draft — specify now.

**0043:**
- Role creation: guarded `if not exists` ✓.
- `grant web_reader to authenticator;` (line 43): **re-runnable** (granting an existing membership is a no-op/notice, not an error) ✓.
- `grant select on all tables / execute on all routines` ✓ idempotent.
- 26 policies: `drop if exists` + `create` ✓ idempotent.
- **(HIGH) `revoke execute on function public.resolver_entidad(text) from web_reader;` (line 100):** if the signature is wrong (overload, different arg type) this **errors and aborts the whole `--single-transaction` apply** → 0043 fails to land. The draft's own comment (lines 90–98) flags this. **FIX before apply:** verify `pg_get_function_identity_arguments` for `resolver_entidad` in PROD; if uncertain, use the robust form `revoke execute on all routines in schema public from web_reader;` then re-grant the 15 explicitly — OR wrap the single revoke in a `do $$ ... exception when undefined_function then null; end $$;` block so a signature mismatch doesn't abort. As written, this line is the most likely cause of a failed 0043 apply.
- **Re-running 0043 after 0044 has been applied:** safe but **re-opens nothing for anon** (0043 never touched anon) — it just re-asserts web_reader. Good. But note: re-running 0043 after a *rollback that dropped web_reader* will recreate it cleanly ✓.

**0044 (not yet drafted) — specify these idempotency requirements:**
- `REVOKE ... FROM anon, authenticated` is **idempotent by nature** (revoking an absent privilege is a no-op) ✓ — so re-running 0044 is safe.
- `DROP POLICY IF EXISTS <name>_public_read ON <table>` for the 26 — **must use IF EXISTS** so re-run after the policies are already gone doesn't error ✓.
- `ALTER DEFAULT PRIVILEGES ... REVOKE` is idempotent ✓.
- **Re-running 0044 after a rollback (which re-granted anon):** correctly re-revokes — fine, it's the intended "re-cutover" path. ✓.
- **Guard (web_reader must exist):** 0044 SHOULD open with an assertion: `do $$ begin if not exists (select 1 from pg_roles where rolname='web_reader') then raise exception 'web_reader missing — apply 0043 first'; end if; end $$;`. **This guard protects the bad order** (revoke-before-create-role), but it does **NOT** protect the *real* bad order (revoke-before-03-deploy) — that's a deploy-state fact Postgres cannot see. **Stronger guard:** 0044 cannot verify the server is on web_reader. Mitigate operationally: the runbook must require a **green smoke test of the deployed site** (curl a page that exercises a `.rpc`) as a manual gate immediately before applying 0044. Consider an even harder gate: have 0044's first statement check `pg_stat_activity` for a recent `web_reader` session (`select count(*) from pg_stat_activity where usename='web_reader' ...`) and raise if zero — proves the server actually connected as web_reader at least once. This catches the silent-anon-fallback trap (§2) at the DB layer. (Best-effort: connection may have closed; treat as advisory, not gospel.)

---

## 5. pgTAP-vs-PROD GOTCHAS + RECOMMENDED PROBES/GUARD

### VERDICT: a structural pgTAP test is INSUFFICIENT to prove anon is dead; a LIVE curl probe through Kong/PostgREST is MANDATORY for LOCKDOWN-04.

The repo's scar tissue (MEMORY: pgTAP-vs-PROD; `ALTER DEFAULT PRIVILEGES` re-grants silently) applies directly:

**Why structural pgTAP under-proves:**
- A pgTAP test connects as the **migration/superuser role** and asserts catalog state (`has_function_privilege('anon', ...)`, `policies_are(...)`). That proves **grants/policies are gone in the catalog**, but it does **NOT** exercise the real PostgREST path: (a) Kong apikey validation, (b) the `SET ROLE` from the JWT `role` claim, (c) PUBLIC-inherited EXECUTE (§1e), (d) view/owner-privilege bypass (§1b), (e) default-privilege re-grants on objects created after the test was written. The historical bug was exactly "structurally looks revoked, but a re-grant put it back" — only a live call catches it.
- **`has_table_privilege('anon','proyecto','select')` can return FALSE while a real `Bearer anon` request still returns rows** if a view or PUBLIC grant provides the path. pgTAP checking the table won't see the view.

**MANDATORY live probe set (LOCKDOWN-04, operator runs post-0044):** with ONLY the anon key (`apikey: <anon>` + `Authorization: Bearer <anon>`), against the real PostgREST URL, expect **401 / 403 / `42501 permission denied`** on every one:
```
# Tables (expect permission denied / empty-with-error, NOT 200 with rows):
GET  /rest/v1/proyecto?select=id&limit=1
GET  /rest/v1/votacion?select=id&limit=1
GET  /rest/v1/citacion?select=id&limit=1
GET  /rest/v1/parlamentario?select=id&limit=1          # PII — must already be denied
GET  /rest/v1/pg_all_foreign_keys?limit=1             # the VIEW path (§1b) — must be denied
# RPCs (POST), expect permission denied on EXECUTE:
POST /rest/v1/rpc/parlamentarios_publico
POST /rest/v1/rpc/match_proyectos        {"query_embedding":[...],"match_count":1}
POST /rest/v1/rpc/buscar_citaciones      {"q":"x"}         # secdef=f path
POST /rest/v1/rpc/cruces_de_parlamentario {...}
POST /rest/v1/rpc/subgrafo_red {...}
# Positive control — the SITE still works (server as web_reader):
GET  https://<site>/parlamentarios   → 200 with data
GET  https://<site>/proyecto/<id>    → 200
# Negative control — a web_reader-signed JWT directly CAN read (proves role works):
GET  /rest/v1/proyecto  with Bearer <web_reader-jwt>  → 200
```
**Pass criteria:** every anon table/RPC call → denied; every site page → 200; web_reader-JWT direct → 200. **The `pg_all_foreign_keys` (view) and `parlamentario` (PII) probes are the two that catch the bypasses a structural test misses** — include them.

**Anti-regression CI guard (LOCKDOWN-04, in repo CI):**
1. **Migration grep:** fail CI if any new file under `supabase/migrations/` contains `to anon` or `to authenticated` in a `grant`/`alter default privileges ... grant` context (regex, case-insensitive; allow comments via a `-- ALLOW-ANON-GRANT:` opt-out token reviewed by a human). This directly prevents the default-privilege/re-grant regression.
2. **Server PII-column guard:** fail CI if `createServerSupabase()` call sites `.select(...)` a known PII column (`rut`, `partido`, `donante_id`, raw declaracion columns). Grep the `app/` data layer for these literals in `.from('parlamentario'...).select(...)` patterns. (Lighter version: assert the server never `.from('parlamentario'|'donante'|'pii_contraparte_declaracion'...)` directly — it must go through an RPC.)
3. **Live nightly probe (optional but recommended):** a scheduled job that runs the anon curl set above against PROD and alerts if any returns 200-with-rows → catches a re-grant introduced out-of-band (dashboard, Supabase platform change) that CI can't see. This is the only thing that catches the `ALTER DEFAULT PRIVILEGES` re-grant if a future `db push` re-runs Supabase bootstrap.

**0044 test recommendation:** keep a pgTAP test for catalog assertions (fast, deterministic: `policies_are`, `function_privilege` for the 15 RPCs = false for anon, web_reader = true) **AND** require the live curl probe as the actual LOCKDOWN-04 gate. The pgTAP test alone must NOT be accepted as proof anon is dead — state this in the plan.

---

## SUMMARY OF VERDICTS

| # | Area | Verdict | Severity of worst issue |
|---|------|---------|------------------------|
| 1 | Revoke completeness | CONDITIONAL PASS | **2 BLOCKERs** (default-privileges reversal missing; views bypass RLS / granted to web_reader) + HIGH (37≠26 tables) |
| 2 | Cutover order / failure | PASS on order | HIGH (LOCKDOWN-03 must fail-closed-loud; silent anon fallback trap) |
| 3 | Rollback | CONDITIONAL PASS | BLOCKER (ALTER DEFAULT PRIVILEGES reversal omitted); 03-rollback only works pre-0044 or post-DB-rollback |
| 4 | Idempotency | CONDITIONAL PASS | HIGH (`revoke ... resolver_entidad(text)` signature can abort 0043; add guard) |
| 5 | pgTAP-vs-PROD | structural test INSUFFICIENT | HIGH (live curl probe + CI grep guard mandatory; view+PII probes required) |

## BLOCKERS (must fix before planning/apply)
1. **0044 (and rollback) MUST reverse `ALTER DEFAULT PRIVILEGES`** for each owner found in `pg_default_acl` (`FOR ROLE postgres`/`supabase_admin`), or the next migration silently re-grants anon. [§1d, §3]
2. **Audit all views/matviews in `public`; web_reader must not retain SELECT on owner-privileged views (RLS bypass).** Confirm `pg_all_foreign_keys`/`tap_funky` are the only views and harmless; add `security_invoker` CI guard. [§1b]

## HIGH (fix in plan)
- Use catch-all `REVOKE ALL ON ALL TABLES/ROUTINES/SEQUENCES` (covers the 37 tables + 461 routines + views), not a 26/15 hand-list. [§1a]
- Check the 15 RPCs + pgvector functions for **PUBLIC (`=X`) execute** and revoke from PUBLIC if present. [§1e]
- LOCKDOWN-03 `createServerSupabase` must **throw if SUPABASE_JWT_SECRET absent** (no anon fallback) + green smoke test before 0044. [§2]
- Wrap/verify the `resolver_entidad(text)` revoke in 0043 so a signature mismatch can't abort the apply. [§4]
- Add 0044 guard: web_reader-exists assertion (+ advisory `pg_stat_activity` check). [§4]
- LOCKDOWN-04 = **live curl probe** (incl. a VIEW and a PII table) as the real gate, not pgTAP alone; + CI grep guard for `to anon`. [§5]
