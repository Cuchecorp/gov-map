# Phase 42 LOCKDOWN — Adversarial Validation A: JWT feasibility + PII subset

**Validator:** Opus (adversarial). **Date:** 2026-06-24. **No code/DB touched** — design + live-FACTS + installed `@supabase/supabase-js@2.108.2` source inspection only. Drafts dir is empty (LOCKDOWN-01/03 not yet written); evaluated the design as described in `_FACTS-live-prod.md` + `42-CONTEXT.md`.

---

## TL;DR verdicts

| # | Claim | Verdict |
|---|-------|---------|
| 1 | JWT `{iss,ref,role:web_reader,iat,exp}` HS256 → PostgREST `SET ROLE web_reader` | **holds — with 2 must-verify checkpoints (JWT secret form; SET ROLE membership)** |
| 2 | anon key still passes Kong as `apikey` after DB grants revoked | **holds** |
| 3 | supabase-js `accessToken` keeps apikey=anonKey + overrides bearer; `.rpc()`/`.from()` work | **holds (verified in installed bundle)** |
| 4 | web_reader = anon's broad grants, read-only; no PII expansion; gate-3 clean | **BREAKS as written — `GRANT EXECUTE ON ALL ROUTINES` over-grants `resolver_entidad` → gate-3 violation. Fix below.** |
| 5 | No hidden client read path; admin path untouched | **holds for reads — but admin client is MISWIRED today (`SUPABASE_SERVICE_KEY` not in env). Flagged, out of scope.** |

**BLOCKER:** Claim 4. The "give web_reader the SAME broad grants anon has" shortcut (`GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO web_reader`) grants EXECUTE on `resolver_entidad`, which anon does **not** have (FACTS line 56: anon=f, admin-only). That is strictly MORE than anon → violates gate 3 ("EXACTAMENTE el set de anon"). Must be fixed in LOCKDOWN-01 before apply.

---

## 1. JWT feasibility — VERDICT: holds, 2 checkpoints

**Claim restated:** signing `{iss:'supabase',ref,role:'web_reader',iat,exp}` with the legacy HS256 JWT secret yields a token PostgREST accepts and `SET ROLE web_reader`s to.

**Reasoning:**
- Supabase's PostgREST (`pg-meta` / GoTrue-issued tokens) does NOT require `aud`. The default GoTrue `aud` is `authenticated`, but PostgREST's role selection reads **only the `role` claim** to choose the DB role to `SET ROLE` to. `sub` is optional. The decoded anon key itself (FACTS line 67) carries **no `aud` and no `sub`** — only `{iss,ref,role,iat,exp}`. Since that exact shape validates today, a web_reader token of identical shape will validate. ✅ This directly answers "is aud/sub required": **no** — proven by the anon key's own minimal payload.
- PostgREST does **not** maintain a config allowlist of acceptable roles for the `role` claim (no `db-anon-role`-style rejection of unknown roles). It issues `SET ROLE <claim.role>` inside the transaction. The ONLY gate is Postgres itself: the login role (`authenticator`) must be a **member** of the target role, else `SET ROLE` errors `42501`. Hence `GRANT web_reader TO authenticator;` is **necessary and sufficient** for `SET ROLE web_reader`. FACTS line 9 has this right. ✅
  - **Note:** `db-anon-role` only governs the role used when **no** JWT / no role claim is present (anonymous requests). It does not constrain an explicit `role` claim. So web_reader does NOT need to be registered anywhere in PostgREST/Kong config.

**Checkpoint 1.1 (HS256 secret validity vs new-format keys) — must confirm, low risk:**
The project has both the legacy HS256 anon JWT AND `sb_secret_…` new-format keys. Question: is the project mid-migration to **asymmetric (ES256/RS256) JWT signing keys**, which would invalidate HS256-signed tokens? Evidence it is NOT:
- The anon key in `.env` is HS256 and **works in production today** (server reads succeed). If the project had rotated to asymmetric-only signing, the HS256 anon key would already fail Kong/PostgREST — it doesn't.
- New-format `sb_publishable_`/`sb_secret_` keys are an **API-key surface** (Kong-level), orthogonal to the **JWT signing secret** used to mint role tokens. Their existence does NOT imply the symmetric JWT secret was retired.
- **HOWEVER**, the working anon key proves HS256 is accepted *as an apikey/bearer pair signed with the legacy secret*; it does **NOT** by itself prove the operator can re-sign a NEW token with that secret, because **the operator does not currently possess the secret** (FACTS line 69: `SUPABASE_JWT_SECRET` not in `.env`). 
- **Concrete check:** before writing LOCKDOWN-01/03, operator pulls `JWT Secret` from Dashboard → Settings → API → JWT Settings. Then a 5-line probe (offline, no DB): sign `{iss,ref,role:'anon',iat,exp:+60}` with that secret, base64-compare its signature to the existing anon key's signature for an identical payload — if they match, the secret is the live legacy secret and web_reader tokens will validate. If the Dashboard shows a "Legacy JWT secret (deprecated)" banner with asymmetric keys active, escalate (web_reader via JWT may need ES256 with the project's current signing key — change the signer, not the design).

**Checkpoint 1.2 (clock skew / TTL):** PostgREST rejects expired tokens (`exp`) and (by default, no leeway beyond GoTrue's) future `iat`. Mint with `iat = now - 5s` (small backdate for skew) and a sane TTL (e.g. 5 min) + in-process cache. Don't mint per-request without caching or you pay a sign on every render. Not a blocker, a plan detail.

**Residual risk:** LOW. The only real failure mode is "operator cannot obtain a usable symmetric JWT secret" (asymmetric-only project). Mitigated by checkpoint 1.1 BEFORE any revoke. Design is sound.

---

## 2. apikey vs bearer after revoke — VERDICT: holds

**Claim:** after anon's DB grants are revoked, the anon key still passes Kong as `apikey`; apikey validation is signature-based, independent of DB grants.

**Reasoning:**
- Kong's `key-auth`/JWT plugin validates the `apikey` header by **JWT signature against the project secret** — it never touches Postgres. Revoking `anon`'s table/routine GRANTs and dropping its RLS policies changes nothing about the apikey's cryptographic validity. The anon key remains a valid apikey "forever" (until the JWT secret rotates or `exp` 2097300064 ≈ year 2036). ✅ FACTS line 71 correct.
- The DB role used is chosen by PostgREST from the **`Authorization: Bearer` JWT's `role` claim**, AFTER Kong has admitted the request. So: `apikey=anonKey` (Kong OK) + `Authorization=web_reader JWT` (role=web_reader) → reads as web_reader. A bare attacker holding only the anon key sends `apikey=anonKey` + `Authorization=Bearer anonKey` → role=anon → revoked → `permission denied`. Exactly the intended outcome. ✅

**"Any path where supabase-js overrides the bearer back to the anon key?"** — Verified in installed bundle (`dist/index.cjs:930`):
```js
const accessToken = (await getAccessToken()) ?? supabaseKey;   // anon key only as FALLBACK
if (!headers.has("apikey")) headers.set("apikey", supabaseKey);          // apikey = anon key
if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
```
The bearer falls back to the anon key **only if `getAccessToken()` returns `null`/`undefined`**. So the one accidental-anon-read path is: **the `accessToken()` callback returns null** (e.g. JWT signing throws and the code swallows it to `null`). 
- **Concrete fix for LOCKDOWN-03:** the callback MUST throw (fail-closed) on signing failure, NEVER return null. If it returned null, the server would silently read as anon — which AFTER revoke is `permission denied` (site down, loud) but BEFORE revoke is a silent correctness hole during the cutover window. Add a unit test asserting the callback throws when the secret is missing/invalid, and that it returns a string with `role:"web_reader"` when valid.

---

## 3. supabase-js `accessToken` option — VERDICT: holds (verified at v2.108.2)

**Verified directly in `node_modules/@supabase/supabase-js@2.108.2`:**
- Type (`index.d.cts:279`): `accessToken?: () => Promise<string | null>;` — supported. ✅
- Constructor (`index.cjs:1254-1278`): when `accessToken` is set, `this.auth` is replaced by a **Proxy that throws** on any access (`"accessing supabase.auth.* is not possible"`), and `this.rest = new PostgrestClient(..., { fetch: this.fetch })` where `this.fetch = fetchWithAuth(supabaseKey, url, this._getAccessToken, ...)`. So **`.from()` and `.rpc()` route through `fetchWithAuth`** which injects apikey=anonKey + bearer=accessToken(). Reads work. ✅
- **Caveat (must heed):** with `accessToken` set, **do NOT also rely on the `auth:{persistSession:false}` option** — the current client passes it, but when `accessToken` is present the auth client is the throwing Proxy and that option is inert. Accessing `client.auth` anywhere crashes. Grepped the app: **no `.auth.` usage exists** (0 matches), so this is safe. Keep it that way — add the no-`.auth` invariant to the CI guard.
- **Version caveat:** `accessToken` (the "custom auth" / third-party-auth option) has been stable since ~v2.40; v2.108.2 is well past that. No risk. The `?? supabaseKey` fallback (claim 2) is the same code path — consistent across this version.
- **Realtime quirk (benign):** `index.cjs:1269` eagerly calls `accessToken()` once at construction to seed realtime auth, swallowing errors with `console.warn`. The app uses no realtime, but note: a signing error here is only warned, not thrown — reinforces fix in §2 that the REST-path callback must itself be fail-closed (the eager call's swallow does not protect REST reads, which re-invoke the callback per request).

---

## 4. PII subset / gate 3 — VERDICT: BREAKS as written (over-grant). Fix below. **BLOCKER.**

**Claim (FACTS line 58):** "Safest faithful approach = give web_reader the SAME broad grants anon has (`GRANT SELECT/EXECUTE ON ALL ... TO web_reader`) + recreate the 26 policies `TO web_reader`. This is byte-identical to anon."

**This is FALSE in two ways:**

### 4a. `GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO web_reader` is STRICTLY MORE than anon → gate-3 violation
- FACTS line 56: `resolver_entidad` has anon EXECUTE = **f** (admin-only, deny). 
- FACTS line 46: `cruces_de_parlamentario` is granted to anon but **NOT** to authenticated. 
- "ALL ROUTINES" grants EXECUTE on **every** function in `public` — including `resolver_entidad`. That gives web_reader a privilege anon lacks → **NOT "exactamente el set de anon"** → gate 3 ("ni una columna/tabla/RPC más") **violated**.
- Also collaterally grants EXECUTE on the **pgTAP harness** and internal helpers to web_reader. anon technically already has those via the same default-privilege mess (FACTS line 13), so for pgTAP/pgvector it is *not* strictly more than anon — BUT it is sloppy and widens the blast radius of a role that's supposed to be minimum-privilege. The whole POINT of web_reader is least privilege; cloning anon's accidental over-grants defeats it.

### 4b. The "byte-identical to anon" framing is the wrong target
Gate 3's intent is **functional parity for the curated public surface**, not **bug-for-bug replication of Supabase's default-privilege accidents**. The faithful set is the **15 curated RPCs minus resolver_entidad = exactly the 14 public RPCs**, plus SELECT on the 26 public-read tables, plus the pgvector EXECUTE that `match_proyectos` (secdef=f) actually needs.

### Is read-only-subset safe for the secdef=f RPCs? — YES, if grants are explicit
The 4 `secdef=f` RPCs run as the **caller** (web_reader), so web_reader needs the underlying privileges:
- `buscar_citaciones` → SELECT on `citacion` (∈ 26) + FTS functions. FTS operators (`to_tsvector`, `@@`, `websearch_to_tsquery`) are owned by `pg_catalog` and EXECUTE-able by PUBLIC — no explicit grant needed. ✅
- `rebeldias_de_parlamentario`, `votos_de_parlamentario` → SELECT on `votacion`/`voto`/`proyecto` (all ∈ 26). ✅
- `match_proyectos` → SELECT on `proyecto`/`proyecto_embedding` (∈ 26) **+ pgvector operator EXECUTE**. The `<=>` operator dispatches to `vector_cosine_distance` / `halfvec_*` backing functions. These are owned by the extension; in Supabase pgvector funcs are typically EXECUTE-able by PUBLIC, but **DO NOT assume** — verify and, if not PUBLIC, grant the **specific** pgvector functions the RPC uses, not "ALL ROUTINES." ✅ with explicit grant.
- SELECT-only (no INSERT/UPDATE/DELETE, no sequence USAGE) is correct and safe: none of the public RPCs write, and read paths never need sequences. ✅

### Does this give web_reader access to ANY PII table anon can't read? — NO
PII tables (FACTS lines 29-35) have **no `to anon` SELECT policy** → deny-by-default under RLS for BOTH anon and web_reader, regardless of the table-level GRANT. As long as LOCKDOWN-01 recreates **only the 26 `<table>_public_read` policies** `TO web_reader` and **creates no policy on any PII table**, web_reader reads 0 PII rows. ✅ The broad table GRANT is inert against RLS (same reason anon's ALL-grant is inert). The danger is NOT the table grants; it's the **routine** over-grant in 4a.

### Recommended precise fix for LOCKDOWN-01 (enumerate, don't wildcard)
Do NOT use `GRANT ... ON ALL ROUTINES/TABLES`. Instead, **drive grants off the live anon inventory** (the authority per CONTEXT line 38-42):
1. `GRANT EXECUTE` on each routine where `information_schema.role_routine_grants.grantee='anon'` — i.e. the **14** RPCs (the 15 minus resolver_entidad, which is anon=f so it won't appear). This *automatically* excludes resolver_entidad and the pgTAP/pgvector noise because **anon's curated EXECUTE grants were issued explicitly per-RPC in migrations 0040/0042/etc.**, NOT via ALL ROUTINES. ⚠️ VERIFY this assumption against live `role_routine_grants` — if anon shows EXECUTE on pgTAP/pgvector funcs there too (via default privilege), then mirroring "every anon EXECUTE grant" would re-introduce the noise. In that case, grant web_reader EXECUTE on **only the explicit 14 curated RPC names** (hardcoded list) + the **specific pgvector funcs** match_proyectos needs. This is the truly minimum-privilege, gate-3-clean set.
2. `GRANT SELECT` on exactly the 26 public-read tables (hardcoded names from FACTS lines 21-26), NOT "ALL TABLES."
3. `CREATE POLICY <table>_public_read_web_reader FOR SELECT TO web_reader USING(true)` on exactly those 26 tables. No policy on any PII table.
4. NO sequence GRANTs. NO INSERT/UPDATE/DELETE. NO `resolver_entidad`.
5. pgTAP for LOCKDOWN-01 must include a **negative** assert: `web_reader` has NO EXECUTE on `resolver_entidad`, and `web_reader` reads 0 rows from a representative PII table (e.g. `parlamentario`, `donante`). The current FACTS framing would have produced a plan that PASSES a naive "can web_reader run an RPC" test while FAILING gate 3 silently. The negative asserts are the guard.

**Bottom line:** The *intent* (read-only, RLS-bound, no PII) is correct and achievable. The *implementation shortcut* in FACTS line 58 ("ALL ROUTINES") is a gate-3 violation that must be rejected in favor of an enumerated grant set. Re-word FACTS line 58 before planning.

---

## 5. Hidden client reads + admin path — VERDICT: holds for reads; admin client miswired (out of scope, flag)

**No hidden client read path. Confirmed by grep across repo (excl node_modules):**
- `@supabase/ssr` — **not a dependency** (verified `app/package.json`; `ssr: undefined`). No `createBrowserClient`. ✅
- `NEXT_PUBLIC_…` — used only for non-Supabase gate flags' *anti-prefix* comments; **no `NEXT_PUBLIC_SUPABASE_*`** exists. The anon key never reaches the bundle. ✅
- `createClient` — only two call sites: `app/lib/supabase.ts` (anon, the chokepoint to migrate) and `app/lib/supabase-admin.ts` (service). No third client. ✅
- `SUPABASE_ANON_KEY` — read only in `app/lib/supabase.ts` + `.dev.vars.example`/`.env.example`. Single read path = `createServerSupabase`. ✅ (matches FACTS line 64)

So LOCKDOWN-03 touching only `createServerSupabase` is sufficient; nothing else reads as anon.

**Admin (service_role) path — UNTOUCHED by Phase 42 (correct), but MISWIRED today — FLAG:**
- `app/lib/supabase-admin.ts` reads `process.env.SUPABASE_SERVICE_KEY` and `SUPABASE_URL`.
- The runtime `.env` (verified, names only) contains: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_API_URL`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_ID`. **There is NO `SUPABASE_SERVICE_KEY`** — only `SUPABASE_SECRET_KEY` (`sb_secret_…`). `.env.example` and `.dev.vars.example` likewise define `SUPABASE_SECRET_KEY`, not `SUPABASE_SERVICE_KEY`.
- ⇒ `createAdminSupabase()` would currently **throw "Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY"** unless the operator separately set `SUPABASE_SERVICE_KEY` in the Cloudflare Worker secrets (the GitHub Actions workflows map `SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}` — but that's CI, not the CF Worker). The admin surface is gated OFF in prod (`ADMIN_REVISION_ENABLED=false`), so this latent misconfig has not surfaced.
- **Out of scope for Phase 42** (gate 5: don't touch service_role/admin). But flagging because: (a) it confirms the admin path is independent of web_reader and won't break; (b) if Phase 42's runbook ever instructs the operator to "verify admin still works" as a smoke test, it will fail for an unrelated reason (env-name mismatch), creating a false alarm during cutover. Recommend the runbook explicitly **excludes** the admin surface from the post-cutover smoke test, or a separate ticket fixes the `SUPABASE_SERVICE_KEY` vs `SUPABASE_SECRET_KEY` naming.

---

## Consolidated BLOCKER + must-do checklist for planning

1. **[BLOCKER] Reject the "GRANT ... ON ALL ROUTINES/TABLES" shortcut (claim 4).** Enumerate: EXECUTE on the **14** curated RPCs (exclude `resolver_entidad`), SELECT on the **26** named tables, the **specific** pgvector funcs match_proyectos needs. Re-word FACTS line 58. Add **negative** pgTAP asserts (web_reader: no EXECUTE on resolver_entidad; 0 rows on a PII table).
2. **[CHECKPOINT before any apply] Obtain + verify the symmetric JWT secret (claim 1.1).** Probe-sign an anon-shaped token offline and signature-match the existing anon key. If the project is asymmetric-only, change the signer, not the design.
3. **[LOCKDOWN-03] `accessToken()` must FAIL-CLOSED (claim 2).** Throw on signing failure; never return null (null → silent anon read during cutover window). Unit-test it. Cache the token (TTL ~5 min, iat backdated ~5s for skew).
4. **[invariant] No `.auth.*` usage** (claim 3) — currently 0; add to CI guard alongside the no-`grant to anon` guard.
5. **[runbook] Exclude the admin surface from post-cutover smoke tests** (claim 5) — it's miswired on an unrelated env-name mismatch and would false-alarm.

Design is fundamentally sound (JWT-as-web_reader is feasible and the apikey/bearer split is verified in the installed SDK). The one true correctness/security defect is the over-broad grant in claim 4; everything else is checkpoints and fail-closed hardening.
