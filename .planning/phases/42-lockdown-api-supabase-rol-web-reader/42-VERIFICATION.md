---
phase: 42-lockdown-api-supabase-rol-web-reader
verified: 2026-06-24T17:35:00Z
status: passed
score: 4/4 must-haves verified (write-complete; cutover correctly deferred to operator)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
notes: >
  WRITE-COMPLETE / CUTOVER-DEFERRED phase (mirror of Phase 41 pre-encendido). The 5 LOCKED
  gates require the agent to WRITE all artifacts but NEVER apply DDL to PROD nor deploy to
  Cloudflare — those are operator checkpoints in a load-bearing order (gate 1/gate 4).
  "web_reader does not exist in PROD yet" and "anon still has grants" are the operator's
  cutover steps, correctly deferred — NOT gaps. Verification confirms the ARTIFACTS achieve
  the goal and the checkpoints are correctly structured.
---

# Phase 42: LOCKDOWN — Cierre de la API pública de Supabase (`web_reader`) Verification Report

**Phase Goal:** Eliminar la superficie de API pública de Supabase (rol `anon`). Crear un rol Postgres dedicado de mínimo privilegio `web_reader` con EXACTAMENTE los permisos curados que hoy tiene `anon`; hacer que `createServerSupabase` lea como `web_reader` (JWT firmado `role: web_reader`, NO la service key); revocar TODO de `anon`/`authenticated`; preservar RLS/PII; con un orden de cutover load-bearing.
**Verified:** 2026-06-24T17:35:00Z
**Status:** passed (write-complete)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (the 4 ROADMAP Success Criteria)

| # | Truth (SC) | Status | Evidence |
|---|---|---|---|
| 1 | **LOCKDOWN-01:** migración 0043 crea `web_reader` NOLOGIN + `grant web_reader to authenticator`; concede a `web_reader` EXACTAMENTE el set vivo de anon (execute RPCs + select tablas + policies `for select`), enumerado desde PROD, idempotente; pgTAP cubre RPC + tabla; NO revoca nada | ✓ VERIFIED | `0043_lockdown_web_reader.sql`: rol guarded por `pg_roles`; `grant web_reader to authenticator` guarded por `pg_auth_members`; **26** `grant select on public.` + **15** `grant execute on function public.` (exact sigs RESEARCH §1) + **26** `create policy %_public_read_wr`; **0** active `on all`, **0** active `resolver_entidad`; header "PASO 1 de 3 — NO REVOCA NADA". pgTAP `0043_web_reader.test.sql` plan(17): positives (proyecto/votacion/declaracion/proyecto_embedding SELECT; parlamentario_publico/match_proyectos 4-arg/cruces EXECUTE) + 3 negatives (resolver_entidad, parlamentario PII, pg_all_foreign_keys view) + is(count,26) + anon-still-granted regression |
| 2 | **LOCKDOWN-03:** `createServerSupabase` se autentica como `web_reader` (JWT firmado), server-only; tests del cliente; deploy ANTES del revoke (gate) | ✓ VERIFIED | `web-reader-jwt.ts`: `import "server-only"`, `node:crypto` `createHmac('sha256')`, async `mintWebReaderToken()`, **throws** on missing `SUPABASE_JWT_SECRET` (fail-closed, no anon fallback), no `jose`/`jsonwebtoken` import, payload `{iss:'supabase',ref,role:'web_reader',iat,exp}`, 5-min TTL + 60s refresh cache. `supabase.ts`: `import "server-only"` line 1, `accessToken: async () => mintWebReaderToken()`, anon key still `apikey`, `createServerSupabase` signature/exports unchanged. `supabase-admin.ts` untouched (still SERVICE key, gated). Tests `web-reader-jwt.test.ts` (11) + `lockdown-guard.test.ts` (7) green. Cutover-order documented; deploy = operator checkpoint (gate 4) |
| 3 | **LOCKDOWN-02:** migración 0044 revoca TODO de anon/authenticated (execute RPCs + select tablas + drop policies `to anon`); aplica ÚLTIMA; pgTAP: anon/authenticated sin execute/select en todo el inventario, web_reader intacto | ✓ VERIFIED | `0044_lockdown_revoke_anon.sql`: guard `raise exception` si web_reader no existe (protege orden); **26** `drop policy if exists %_public_read on public.`; `revoke all on all tables/routines/sequences from anon, authenticated` (×3); `alter default privileges for role postgres ... revoke all` (×3, tables/routines/sequences — BLOCKER 2 resuelto); NO revoca usage on schema; header "PASO 3 DE 3 (ÚLTIMO)" + SITE DOWN warning + inline reverse-0044. pgTAP post-apply `0044_revoke_anon.test.sql` plan(109): 15 anon + 15 authenticated NOT EXECUTE (exact sigs), anon NOT SELECT 4 tablas + view + PII, 26 `_public_read` gone, 26 `_wr` present, 15 web_reader EXECUTE + 4 SELECT, service_role intact. Lives in `tests/post-apply/` (outside normal glob) |
| 4 | **LOCKDOWN-04:** verificación end-to-end — probe live anon → permission denied; sitio renderiza todas las superficies; guard anti-regresión CI; runbook + rollback | ✓ VERIFIED | `lockdown-guard.test.ts`: Block A scans migrations >0044 for `grant … to anon` + `create policy … to anon` (comment-stripped); Block B scans `supabase.ts` for `.auth.` method + PII columns (rut/donante_id/partido) + PII tables (parlamentario/donante/…); honest-scope note re supabase_admin default-ACL. `RUNBOOK-lockdown-cutover.md`: ordered cutover (Paso 0 secret → 1 → 2 → 3), SITE DOWN warning, curl probe incl RPC+table+**view**+**PII**, per-step rollback, reverse-0044 (with ALTER DEFAULT PRIVILEGES reversal), site smoke table (admin excluded), residual-risk + pgTAP-backstop cadence section |

**Score:** 4/4 truths verified (write-complete)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/0043_lockdown_web_reader.sql` | 26 select grants, 15 execute grants, 26 _wr policies, no on-all, no resolver_entidad, 4-arg match_proyectos, idempotency, header | ✓ VERIFIED | All counts exact (26/15/26), 0 active on-all, 0 active resolver_entidad, `match_proyectos(query_embedding vector, match_count integer, match_threshold double precision, exclude_boletin text)`, `do $$ if not exists` guards, header "PASO 1/NO REVOCA" present |
| `supabase/tests/0043_web_reader.test.sql` | positives + negatives (resolver_entidad, PII, view), is(...26...) | ✓ VERIFIED | plan(17); 3 negatives present; is(count,26); anon-regression assert |
| `supabase/migrations/0044_lockdown_revoke_anon.sql` | guard raise, 26 drop policy _public_read, revoke all ×3, alter default priv for role postgres ×3, no revoke usage | ✓ VERIFIED | All present, exact counts; reverse-0044 inline in header comment |
| `supabase/tests/post-apply/0044_revoke_anon.test.sql` | anon/authed no EXECUTE 15 RPCs exact sigs; anon no SELECT incl view+PII; 26 _public_read gone; 26 _wr present; web_reader+service_role intact; plan(N) | ✓ VERIFIED | plan(109); math checks: 15+15+4+1+1+26+26+15+4+2=109 |
| `app/lib/web-reader-jwt.ts` | server-only, node:crypto HS256 async, fail-closed throw, no jose/jsonwebtoken | ✓ VERIFIED | `import "server-only"`; `createHmac`; throws on missing secret; no external JWT lib (only mentioned in a comment) |
| `app/lib/supabase.ts` | import server-only L1; accessToken→mintWebReaderToken; anon key apikey; signature unchanged; admin untouched | ✓ VERIFIED | L1 server-only; accessToken option added; anon key passed to createClient as apikey; `createServerSupabase()` signature unchanged; admin file confirmed untouched |
| `app/lib/lockdown-guard.test.ts` | scans migrations>0044 for grant-to-anon; scans supabase.ts for .auth.+PII; honest-scope note | ✓ VERIFIED | Block A (grant + policy to anon), Block B (.auth. + PII col/table), supabase_admin honest-scope note in JSDoc |
| `docs/RUNBOOK-lockdown-cutover.md` | ordered cutover + SITE DOWN + curl probe incl view+PII + per-step rollback + reverse-0044 + residual-risk | ✓ VERIFIED | All sections present |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `supabase.ts` | `web-reader-jwt.ts` | `import { mintWebReaderToken }` + `accessToken: async () => mintWebReaderToken()` | ✓ WIRED | Import present (L5); used in createClient accessToken (L45) |
| `supabase.ts` createClient | Kong/PostgREST | anon key as `apikey` + bearer = web_reader JWT | ✓ WIRED | anonKey passed as 2nd arg; accessToken overrides bearer per request (supabase-js 2.108.2 confirmed — `accessToken` in installed types) |
| `mintWebReaderToken` | PostgREST role | HS256 JWT claim `role:'web_reader'` | ✓ WIRED | payload includes `role:'web_reader'`; signed with SUPABASE_JWT_SECRET (operator provides at cutover) |
| 0043 grants/policies | `web_reader` role | enumerated GRANT + 26 _wr policies | ✓ WIRED | role created + 26 SELECT + 15 EXECUTE + 26 policies all target web_reader |
| 0044 revoke | `anon`/`authenticated` | revoke all + drop _public_read + alter default priv | ✓ WIRED | guard ensures web_reader exists first (order enforced) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| TS deliverables typecheck | `cd app && npx tsc -b` | exit 0 | ✓ PASS |
| JS/TS test suite (incl jwt + guard) | `cd app && npx vitest run` | 32 files / 316 tests passed; `web-reader-jwt.test.ts` 11, `lockdown-guard.test.ts` 7 | ✓ PASS |
| supabase-js supports accessToken | `node -e require pkg` + grep types | v2.108.2; `accessToken` in index.d.mts/d.cts | ✓ PASS |
| 0043 grant/policy counts | grep `^grant select`/`^grant execute`/`_public_read_wr` | 26 / 15 / 26 | ✓ PASS |
| 0043 no active on-all / resolver_entidad | grep non-comment | 0 / 0 | ✓ PASS |
| 0044 revoke/drop/alter counts | grep | 26 drop + 3 revoke-all + 3 alter-default-priv; 0 revoke-usage | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| pgTAP 0043 / post-apply 0044 | (runs against PROD-applied schema) | N/A — these are operator post-apply checkpoints (gate 4); cannot run pre-apply since web_reader does not yet exist in PROD by design | ? DEFERRED (operator) |
| Live curl probe (anon → 42501) | curl with anon key | N/A — requires 0044 applied to PROD; operator step 3 | ? DEFERRED (operator) |
| PROD read-only inventory recheck | psql role grants | Authoritative inventory already captured in `_FACTS-live-prod.md` (queried directly against PROD 2026-06-24): 26 RLS policies + 15 RPC sigs confirmed; server `.from()`/`.rpc()` usage all ⊂ curated sets. Fresh re-query not run (adds no signal; operator pgTAP validates at apply) | ✓ COVERED (research evidence) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| LOCKDOWN-01 | 42-01 | crear web_reader + re-conceder set curado enumerado + pgTAP | ✓ SATISFIED | 0043 + test (Truth 1) |
| LOCKDOWN-02 | 42-02 | revocar todo de anon/authenticated + default privileges + pgTAP post-apply | ✓ SATISFIED | 0044 + post-apply test (Truth 3) |
| LOCKDOWN-03 | 42-03 | createServerSupabase lee como web_reader (JWT HS256 fail-closed) + tests | ✓ SATISFIED | web-reader-jwt.ts + supabase.ts + tests (Truth 2) |
| LOCKDOWN-04 | 42-04 | guard CI anti-regresión + runbook ordenado + rollback | ✓ SATISFIED | lockdown-guard.test.ts + RUNBOOK (Truth 4) |

No orphaned requirements: all 4 LOCKDOWN-0x mapped to plans and satisfied.

### Gate Compliance (the 5 LOCKED gates)

| Gate | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Cutover order load-bearing (01 → deploy 03 → 02) | ✓ HONORED | Headers in 0043/0044 + RUNBOOK enforce order; 0044 guard raises if web_reader absent; SITE DOWN warning |
| 2 | web_reader NOT service_role for reads | ✓ HONORED | supabase.ts uses anon key + web_reader JWT; admin (service key) untouched & gated; jwt mints `role:'web_reader'` |
| 3 | PISO PII intacto — exactly anon's curated set, no PII extra | ✓ HONORED | Enumerated grants (subset of anon); negative pgTAP asserts (parlamentario PII, pg_all_foreign_keys view, resolver_entidad excluded); guard scans PII tables/cols |
| 4 | Agent does NOT apply to PROD nor deploy | ✓ HONORED | No DDL applied; no deploy run; all apply/deploy steps are documented operator checkpoints (42-01 Task 3 deferred; RUNBOOK pasos operador) |
| 5 | No tocar ingesta/cron (service_role) ni flags *_PUBLIC_ENABLED | ✓ HONORED | 0044 §"ALCANCE: solo anon y authenticated; service_role, web_reader e ingesta NO se tocan"; no flag changes in diff |

### Anti-Patterns Found

None. No debt markers (TBD/FIXME/XXX/HACK/PLACEHOLDER) in any deliverable. No stubs, no empty returns, no `grant … to anon` reintroduced. The single `jose` token in web-reader-jwt.ts is a JSDoc comment stating no external lib is added (spec-compliant).

### Human Verification Required

The phase is **write-complete with cutover deferred**. The remaining items are the operator's load-bearing checkpoints (gate 4), NOT verification gaps — they cannot be performed by the agent by design and require live PROD/Cloudflare access:

1. **Obtain + verify `SUPABASE_JWT_SECRET`** — Dashboard → Settings → API → JWT Secret; add to `.env` + Cloudflare; verify offline re-sign matches anon-key scheme. (RUNBOOK Paso 0)
2. **Apply 0043 + run pgTAP 0043** against PROD (operator/agent-if-authorized). Expect 17 ok.
3. **Deploy LOCKDOWN-03 to Cloudflare + site smoke** (web_reader live in the safe window).
4. **Apply 0044 (LAST) + run pgTAP post-apply** (expect 109 ok) + **live curl probe** (anon → 42501 on RPC+table+view+PII) + full site smoke (admin excluded).

These are the correctly-deferred operator cutover steps in the gate-1 order.

### Gaps Summary

No gaps. All 4 Success Criteria are satisfied by substantive, wired artifacts; all 5 LOCKED gates are honored; the cutover (apply DDL + deploy) is correctly deferred to the operator per gate 4. The JS/TS deliverables typecheck clean and pass 316/316 tests including the dedicated jwt and lockdown-guard suites. The SQL artifacts match the authoritative PROD-grounded spec (RESEARCH §1/§3) with exact enumerated counts (26/15/26 in 0043; 26 drops + 3+3 revokes in 0044) and the required idempotency guards, order-protection guard, negative PII/view asserts, and the ALTER DEFAULT PRIVILEGES reversal that closed VALIDATION BLOCKER 2.

This is a write-complete phase: PASSED.

---

_Verified: 2026-06-24T17:35:00Z_
_Verifier: Claude (gsd-verifier)_
