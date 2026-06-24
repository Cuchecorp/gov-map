# Phase 42 LOCKDOWN — VALIDATION (Opus adversarial pass, consolidated)

Two independent Opus validators reviewed the design against live PROD. Full critiques: `_validation-A-jwt-pii.md`, `_validation-B-cutover-revoke.md`. Verdicts + resolutions below. All BLOCKERs are resolved in `42-RESEARCH.md`.

## Verdicts

| # | Claim | Verdict | Resolution (baked into RESEARCH) |
|---|---|---|---|
| A1 | web_reader JWT (HS256, minimal `{iss,ref,role,iat,exp}`) accepted by PostgREST; `GRANT web_reader TO authenticator` enables SET ROLE | **HOLDS** | No `aud`/`sub` needed (live anon key has none). Operator checkpoint: obtain JWT secret, verify offline it isn't asymmetric-only. |
| A2 | anon key stays a valid `apikey` after its DB grants are revoked | **HOLDS** | Kong validates apikey by signature, independent of grants. Verified in supabase-js 2.108.2. |
| A3 | supabase-js `accessToken` keeps apikey=anon + overrides bearer per request | **HOLDS** | Confirmed in installed types. `client.auth.*` becomes unusable — app has zero auth usage. |
| A4 | "clone anon via GRANT … ON ALL … TO web_reader" | **BREAKS — BLOCKER** | Would grant `resolver_entidad` (anon=f) + the 2 pgTAP **views** (RLS bypass). → **ENUMERATED grants** (26 tables + 15 RPCs by signature). Strict subset of anon. Negative pgTAP asserts added. |
| A5 | No hidden browser/SSR Supabase client; only `createServerSupabase` to migrate | **HOLDS** | Admin client mis-wired (`SUPABASE_SERVICE_KEY` vs `.env`'s `SUPABASE_SECRET_KEY`) but gated OFF + out of scope → exclude from smoke tests. |
| B1 | "26 policies + REVOKE ALL" makes anon key useless for all data | **CONDITIONAL → PASS** | anon holds SELECT on 35 tables + 2 views (not 26); catch-all `REVOKE ALL ON ALL TABLES/ROUTINES/SEQUENCES` is correct & required. Probe must include a view + PII table. |
| B2 | Cutover order (01 → deploy 03 → 02) correct | **PASS (order); HIGH (fail-closed)** | `accessToken` must THROW on missing secret (never silent anon fallback). Folded into LOCKDOWN-03. |
| B3 | Rollback = re-grant anon + recreate 26 policies | **CONDITIONAL → PASS** | Must ALSO reverse `ALTER DEFAULT PRIVILEGES`. Reverse-0044 is the highest-leverage rollback (kept ready in runbook §4). |
| B4 | 0043/0044 idempotent / re-runnable | **CONDITIONAL → PASS** | Guard `grant web_reader to authenticator` + policy `drop if exists`; 0044 web_reader-exists guard. Enumeration removes the resolver_entidad-signature abort risk. |
| B5 | Structural pgTAP proves anon is dead | **INSUFFICIENT alone** | Catalog test can pass while `Bearer anon` reads via a view/PUBLIC grant → live curl probe (RPC+table+view+PII) is the mandatory LOCKDOWN-04 gate. |

## BLOCKERs (all resolved)
1. **ALL-grants → gate-3 violation + view RLS-bypass** → enumerated grants (RESEARCH §0, §3 LOCKDOWN-01).
2. **`ALTER DEFAULT PRIVILEGES` reversal** (owner `postgres`; also `supabase_admin` exists but governs Supabase internals, not project data, and isn't postgres-alterable) → included `FOR ROLE postgres` reversal in 0044 + reverse-0044 rollback; CI guard backstops supabase_admin (RESEARCH §3 LOCKDOWN-02/04).
3. **Fail-closed `accessToken`** (no silent anon fallback) → throw on missing secret (RESEARCH §3 LOCKDOWN-03).

## PROD facts that closed open questions
- pgvector funcs are **PUBLIC-executable** (`=X/supabase_admin` ACL) → `match_proyectos` (secdef=f) works for web_reader with no pgvector grant.
- `match_proyectos` body reads only `proyecto_embedding` (∈ the 26).
- anon SELECT relkind breakdown: 35 `r` + 2 `v` (`pg_all_foreign_keys`, `tap_funky`).
- connection role = `postgres`; `pg_default_acl` owners granting anon = `postgres` AND `supabase_admin`.
- 15 RPC exact identity signatures captured (RESEARCH §1).

## Residual operator checkpoints (not code-resolvable)
1. Obtain `SUPABASE_JWT_SECRET` from dashboard; add to `.env` + Cloudflare; verify offline re-sign.
2. Apply 0043, deploy 03, apply 0044 — strictly in that order (runbook §4).
3. Run the live curl probe + site smoke (exclude admin surface).
