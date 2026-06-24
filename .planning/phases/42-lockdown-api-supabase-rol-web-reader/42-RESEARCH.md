# Phase 42 LOCKDOWN — RESEARCH (synthesized)

**Method:** sonnet-swarm (3 drafters, one per deliverable) + 2 adversarial Opus validators, all grounded on a LIVE PROD inventory queried directly (`information_schema`, `pg_policies`, `pg_proc`, `pg_class`, `pg_default_acl`, `pg_roles`). Authority = `_FACTS-live-prod.md` (+ `_inventory-live.txt`, `_inv3` PROD outputs). Do NOT re-derive from .sql.

**Decision (LOCKED by operator, confirmed feasible):** dedicated minimum-privilege role `web_reader` (NOT service_role). Server reads PROD as web_reader via a signed `role:web_reader` JWT; anon/authenticated lose all data access. RLS/PII floor preserved.

---

## 0. The one design correction the validators forced (BLOCKER, resolved)

The initial idea — clone anon by `GRANT SELECT/EXECUTE ON ALL … TO web_reader` — **BREAKS gate 3 and opens an RLS-bypass.** Proven against PROD:
- `ALL ROUTINES` would grant web_reader EXECUTE on `resolver_entidad` (admin-only; anon=**f**) → web_reader gets MORE than anon → gate-3 violation.
- `ALL TABLES` would grant web_reader SELECT on the **2 pgTAP VIEWS** anon holds (`pg_all_foreign_keys`, `tap_funky`, `relkind=v`) and any future owner-privileged view → **views bypass RLS** → defense-in-depth downgrade.
- anon's grant surface is Supabase's blanket `ALTER DEFAULT PRIVILEGES` (ALL tables, EXECUTE all funcs incl pgTAP+pgvector), NOT a curated set.

**Resolution → ENUMERATED grants** (a strict subset of anon, never a superset). This single change sidesteps three problems at once: the resolver_entidad over-grant, the resolver_entidad signature fragility, and the view RLS-bypass. web_reader gets exactly: SELECT on the 26 policy-backed public-read tables + EXECUTE on the 15 curated RPCs + USAGE on schema public + membership in authenticator. Nothing else.

---

## 1. Authoritative inventory (the set to replicate / revoke)

### The 26 public-read tables (each has policy `<t>_public_read FOR SELECT TO anon USING(true)`)
```
aporte, aportes_ingesta_estado, citacion, citacion_invitado, citacion_punto,
contrato, contratos_ingesta_estado, declaracion, declaracion_accion_derecho,
declaracion_actividad, declaracion_bien_inmueble, declaracion_bien_mueble,
declaracion_pasivo, declaracion_valor, lobby_audiencia, lobby_ingesta_estado,
probidad_ingesta_estado, proyecto, proyecto_embedding, proyecto_ficha, sector,
sesion_sala, sesion_tabla_item, tramitacion_evento, votacion, voto
```
(anon also holds the *grant* SELECT on 9 more PII tables + 2 views, but with NO policy → reads 0 rows. web_reader will NOT receive those grants → strictly less than anon.)

### The 15 curated RPCs — EXACT signatures (grant EXECUTE TO web_reader)
```
agregado_por_contraparte(p_id text)
aportes_de_parlamentario(p_id text)
bienes_de_parlamentario(p_id text)
buscar_citaciones(q text, limite integer, p_camara text)
comparar_declaraciones(p_id text, fechas date[])
contratos_de_parlamentario(p_id text)
cruces_de_parlamentario(p_id text)
declaraciones_de_parlamentario(p_id text)
lobby_de_parlamentario(p_id text)
match_proyectos(query_embedding vector, match_count integer, match_threshold double precision, exclude_boletin text)
parlamentario_publico(p_id text)
parlamentarios_publico()
rebeldias_de_parlamentario(p_id text)
subgrafo_red(p_id text, p_depth integer, p_tipos text[], p_desde timestamptz, p_hasta timestamptz)
votos_de_parlamentario(p_id text, p_limit integer, p_offset integer)
```
**NOT granted:** `resolver_entidad(...)` (admin, anon=f). Confirmed absent from anon's executable set.

### secdef=f RPCs run as the caller (web_reader) — their needs are covered:
- `match_proyectos`: reads `proyecto_embedding` (∈26 ✓) and uses `<=>`. **pgvector operator funcs are PUBLIC-executable** (PROD ACL `=X/supabase_admin` on `cosine_distance`/`vector_*`) → web_reader inherits via PUBLIC; **no pgvector grant needed.** Body confirmed: only proyecto_embedding.
- `buscar_citaciones`: reads `citacion` (∈26 ✓).
- `rebeldias_de_parlamentario`, `votos_de_parlamentario`: read votacion/voto/proyecto (∈26 ✓).
The other 11 RPCs are `secdef=t` (run as owner) → caller needs only EXECUTE.

### Roles (PROD): anon/authenticated/service_role NOLOGIN; `authenticator` LOGIN. `web_reader` does not exist. Connection role = `postgres`.

---

## 2. JWT / credential feasibility — HOLDS (validated)

- anon key = legacy **HS256** JWT `{iss:'supabase',ref:'bctyygbmqcvizyplktuw',role:'anon',iat,exp}`. The server uses it today → the legacy symmetric JWT secret is live and accepted by PostgREST.
- web_reader token = same minimal shape, `role:'web_reader'`, signed with the SAME secret. PostgREST reads ONLY the `role` claim (no `aud`/`sub` needed — the live anon key carries none) and `SET ROLE`s to it. PostgREST keeps **no role allowlist**; the sole gate is `GRANT web_reader TO authenticator` (enables `SET ROLE`).
- **apikey vs bearer:** Kong validates the `apikey` header by JWT signature, independent of DB grants → the anon key stays valid as `apikey` forever (even after anon's grants are revoked). The DB role comes from the `Authorization: Bearer` JWT. Verified in `@supabase/supabase-js@2.108.2`: `apikey` is always the `createClient` key; bearer falls back to the anon key **only if `accessToken()` returns null**.
- **supabase-js mechanism (confirmed in installed 2.108.2 types, `accessToken?: () => Promise<string|null>`):**
  ```ts
  createClient(url, anonKey, {
    accessToken: async () => mintWebReaderToken(),   // MUST throw if secret missing — never return null
    auth: { persistSession: false, autoRefreshToken: false },
  })
  ```
  `.from()`/`.rpc()` route through `fetchWithAuth` (apikey=anonKey + bearer=callback). Caveat: with `accessToken` set, `client.auth.*` throws — app has **zero** `.auth.` usage → safe.
- **Signing lib:** `node:crypto` `createHmac('sha256',…).digest('base64url')` — zero new deps (jose absent). Runs on Cloudflare's Node-compat runtime.
- **New env var: `SUPABASE_JWT_SECRET`** (Dashboard → Settings → API → JWT Settings → JWT Secret). Add to `.env` (local) + Cloudflare Pages env (prod). NOT `SUPABASE_SECRET_KEY` (that is the `sb_secret_` service key, bypasses RLS, wrong tool).
- **Operator checkpoint before cutover:** obtain the secret and verify offline it re-signs a token whose signature matches the live anon key's scheme (proves the project isn't asymmetric-only). The working anon key proves HS256 is *accepted*; it does not prove the operator holds the secret yet.

---

## 3. The three deliverables (final spec)

### LOCKDOWN-01 — migration `0043_lockdown_web_reader.sql` (idempotent; NO effect on live API)
1. `create role web_reader nologin;` guarded by `if not exists (select 1 from pg_roles where rolname='web_reader')`.
2. `grant web_reader to authenticator;` guarded against re-run (`if not exists (… pg_auth_members …)`).
3. `grant usage on schema public to web_reader;`
4. `grant select on <each of the 26 tables> to web_reader;` (explicit list — NOT `ALL`).
5. `create policy <t>_public_read_wr on <t> for select to web_reader using (true);` for the 26 (each `drop policy if exists` first for idempotency).
6. `grant execute on function public.<each of the 15 RPCs>(<exact sig>) to web_reader;` (explicit — NOT `ALL`; resolver_entidad excluded by omission, no signature footgun).
7. No sequence grants, no write grants, no pgvector grants (PUBLIC covers it), no views.
8. LOUD header: step 1 of 3; does NOT revoke anything; safe to apply early; after this, BOTH anon and web_reader read identically (safe window).
- **pgTAP `0043_web_reader.test.sql`** (`plan(N)` exact): web_reader exists + nologin; web_reader ∈ authenticator; SELECT on proyecto/votacion/declaracion; EXECUTE on parlamentario_publico + match_proyectos (secdef=f/pgvector) + cruces_de_parlamentario; a `_public_read_wr` policy exists on proyecto (+ assert count = 26 wr-policies); **negative:** web_reader has NO EXECUTE on resolver_entidad; web_reader has NO SELECT grant on `parlamentario` (PII) and NO SELECT on `pg_all_foreign_keys` (view); anon still has its grants (untouched).

### LOCKDOWN-03 — server reads as web_reader (deploy BEFORE revoke)
- New `app/lib/web-reader-jwt.ts`: `mintWebReaderToken(): Promise<string>` — HS256 via node:crypto, payload `{iss:'supabase',ref,role:'web_reader',iat,exp}`, TTL ~5 min, in-process cache re-minting ~60 s before exp, **throws** if `SUPABASE_JWT_SECRET` missing (fail-closed — never returns null/anon). `ref` derived from `SUPABASE_URL` host (or env).
- Modify `app/lib/supabase.ts` `createServerSupabase()`: keep `import "server-only"`, keep `SUPABASE_URL` + `SUPABASE_ANON_KEY` (anon key stays the apikey), add the `accessToken` option calling `mintWebReaderToken`. Signature/exports unchanged → callers untouched.
- Tests `web-reader-jwt.test.ts` (vitest, no network): token decodes to `role:'web_reader'`; exp in future; sign/verify roundtrip with a test secret; missing secret throws.
- **Operator deploy note:** set `SUPABASE_JWT_SECRET` in Cloudflare Pages env, build OpenNext on Linux/Docker, deploy — BEFORE applying 0044.

### LOCKDOWN-02 — migration `0044_lockdown_revoke_anon.sql` (applied LAST)
1. LOUD header: step 3 of 3; applying before 03 deploys = SITE DOWN; rollback inline.
2. Guard: `if not exists (… web_reader …) then raise exception` (protects wrong order).
3. `drop policy if exists <t>_public_read on <t>;` for the 26 (kills public read via RLS deny-by-default). Do NOT drop the `_wr` policies.
4. `revoke all on all tables in schema public from anon, authenticated;`
5. `revoke all on all routines in schema public from anon, authenticated;`
6. `revoke all on all sequences in schema public from anon, authenticated;`
7. `alter default privileges in schema public revoke all on tables from anon, authenticated;` (+ `on routines`, `on sequences`) — implicit `FOR ROLE postgres` (our connection role) → neutralizes future re-grants on **postgres-owned** objects (the repo's recurring "ALTER DEFAULT PRIVILEGES re-grants anon" scar). The parallel `supabase_admin`-owned default ACL governs Supabase-internal objects, not project data, and is not alterable by `postgres`; the CI guard backstops it.
8. Do NOT revoke `usage on schema public` (it is held via PUBLIC; with zero object grants anon already gets permission-denied; lower blast radius).
9. Untouched: web_reader, service_role, ingesta/cron.
- **pgTAP post-apply `0044_revoke_anon.test.sql`** (location: `supabase/tests/post-apply/`, OUTSIDE the normal glob — it asserts the revoked end-state): anon+authenticated have NO EXECUTE on each of the 15 RPCs; anon has NO SELECT on a sample (proyecto, votacion, declaracion, lobby_audiencia) **and on a view (pg_all_foreign_keys) and a PII table (parlamentario)**; the 26 `_public_read` policies are gone while the 26 `_wr` remain; web_reader STILL has EXECUTE+SELECT (regression); service_role intact. `plan(N)`.

### LOCKDOWN-04 — verification + guard + runbook
- **Live curl probe (operator, post-0044):** with the anon key as both apikey and bearer, hit (a) an RPC `POST /rest/v1/rpc/parlamentario_publico`, (b) a table `GET /rest/v1/proyecto?select=*`, (c) a view → expect 401/`42501`/permission-denied on all. Then load the site (reads as web_reader) and confirm proyecto, votaciones, lobby, patrimonio, dinero, NET, cruces, búsqueda, agenda, parlamentarios render. (Exclude the admin surface — see §5.)
- **CI anti-regression guard:** fail if a new migration introduces `grant … to anon` / `… to anon … using` (re-exposure), and fail if server code adds a `.auth.` call on the web_reader client or selects a known PII column. Extend the existing money/net-gate-style guard test.
- **Runbook + rollback** (see §4).

---

## 4. Cutover runbook & rollback (load-bearing order)

| Step | Action | Who | Effect | If it fails |
|---|---|---|---|---|
| 0 | Add `SUPABASE_JWT_SECRET` to `.env` + Cloudflare env; verify offline re-sign matches anon-key scheme | operator | none | abort; do not proceed |
| 1 | Apply `0043` (`psql --single-transaction` + schema_migrations row) | operator/agent-if-authorized | web_reader created+granted; **both** anon & web_reader read (safe window) | rollback = `drop role web_reader` (after dropping its 26 _wr policies); nothing else touched |
| 2 | Deploy LOCKDOWN-03 to Cloudflare; smoke-test the LIVE site reads via web_reader (it does even while anon still works) | operator | server now reads as web_reader | rollback = redeploy previous build; anon still works so site stays up |
| 3 | Apply `0044` (revoke) LAST | operator/agent-if-authorized | public anon API dead; site unaffected (web_reader) | **rollback = reverse-0044**: recreate the 26 `_public_read` policies `to anon` + `grant select`/`grant execute` back to anon + reverse the `alter default privileges`. Keep this script ready. |

**Failure modes:** if 0044 is applied before step 2, the server (still anon) 500s on all 10 `.from()` + 7 `.rpc()` calls → restore by reverse-0044 or finish the deploy. If `SUPABASE_JWT_SECRET` is wrong/missing in CF, the fail-closed `accessToken` throws → the site errors at step 2 (BEFORE revoke) → caught early, anon still works, fix the secret. The safe window after step 1 (both roles work) is intentional and harmless.

---

## 5. Hidden-read audit (HOLDS)
- No `@supabase/ssr`, no `createBrowserClient`, no `NEXT_PUBLIC_SUPABASE_*`. Only two `createClient` sites: `createServerSupabase` (migrate) and `createAdminSupabase` (service, untouched).
- **Out-of-scope flag:** `createAdminSupabase()` reads `SUPABASE_SERVICE_KEY`, but `.env` defines only `SUPABASE_SECRET_KEY` → the admin client is mis-wired today (masked because the admin surface is gated OFF). Do NOT fix here; just EXCLUDE the admin surface from cutover smoke tests to avoid a false alarm.

## Validation Architecture
- **Structural (pgTAP vs PROD-applied schema):** 0043 test proves web_reader's exact grant/policy set incl negative asserts (no resolver_entidad, no PII table, no view). 0044 post-apply test proves anon/authenticated are stripped while web_reader+service_role survive. Run via `psql -tA -f` against PROD after each apply (the repo's hard lesson: catalog truth, not mocks; `ALTER DEFAULT PRIVILEGES` silently re-grants — the negative asserts catch it).
- **Behavioral (live HTTP probe):** structural pgTAP can pass while a `Bearer anon` still reads via a view or PUBLIC grant → LOCKDOWN-04's curl probe (RPC + table + **view** + PII table) is the mandatory end-to-end gate. Site render = the positive end-to-end (web_reader serves every surface).
- **Continuous (CI guard):** no new `grant … to anon`; no `.auth.*` on web_reader client; no PII-column select in server reads. Prevents regression of the lockdown.
- **Adversarial provenance:** 2 Opus validators (`_validation-A-jwt-pii.md`, `_validation-B-cutover-revoke.md`) pressure-tested the design; their BLOCKERs (ALL-grants → gate-3/view bypass; default-ACL `FOR ROLE` reversal; fail-closed accessToken) are folded into this spec.

## Drafts produced (starting material for execute-phase; correct to this spec)
`drafts/0043_lockdown_web_reader.sql`, `drafts/0043_web_reader.test.sql`, `drafts/web-reader-jwt.ts`, `drafts/supabase.ts`, `drafts/web-reader-jwt.test.ts`, `drafts/0044_lockdown_revoke_anon.sql`, `drafts/0044_revoke_anon.test.sql`. NOTE: 0043/0044 drafts used the broad `GRANT/REVOKE … ON ALL …` form — execute-phase must convert 0043 to the ENUMERATED grants above (§3) and ensure 0044 includes the `ALTER DEFAULT PRIVILEGES … FOR ROLE postgres` reversal + view/PII negative asserts.
