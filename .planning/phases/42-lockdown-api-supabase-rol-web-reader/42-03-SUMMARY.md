---
phase: 42-lockdown-api-supabase-rol-web-reader
plan: "03"
subsystem: auth/server
tags: [lockdown, jwt, web_reader, server-only, supabase]
dependency_graph:
  requires: [42-01 (0043 web_reader DDL applied to PROD)]
  provides: [mintWebReaderToken, createServerSupabase reads as web_reader]
  affects: [app/lib/supabase.ts callers (all Server Components), Cloudflare Pages env]
tech_stack:
  added: []
  patterns: [HS256 via node:crypto, accessToken callback in supabase-js 2.108.2, in-proc JWT cache]
key_files:
  created:
    - app/lib/web-reader-jwt.ts
    - app/lib/web-reader-jwt.test.ts
  modified:
    - app/lib/supabase.ts
    - .env.example
decisions:
  - "export async function mintWebReaderToken(): Promise<string> — async to satisfy supabase-js accessToken: () => Promise<string|null> contract (draft was sync)"
  - "vi.resetModules() in both beforeEach and afterEach to guarantee fresh module cache for every test (including the fail-closed throw test)"
  - "import server-only added to web-reader-jwt.ts (consistent with supabase.ts; prevents the JWT secret from reaching the browser bundle)"
metrics:
  duration: ~10 min
  completed: "2026-06-24"
  tasks_completed: 2
  tasks_deferred: 1 (Task 3 - operator checkpoint)
  files_created: 2
  files_modified: 2
---

# Phase 42 Plan 03: LOCKDOWN-03 server reads as web_reader — Summary

**One-liner:** HS256 JWT minter (`node:crypto`, fail-closed, in-proc cache) wired into `createServerSupabase` via `accessToken` callback so the server reads PROD as `web_reader` instead of `anon`.

## What Was Built

### Task 1 — app/lib/web-reader-jwt.ts + web-reader-jwt.test.ts

New module `app/lib/web-reader-jwt.ts`:
- `import "server-only"` (prevents secret from reaching browser bundle)
- `import { createHmac } from "node:crypto"` — zero new dependencies
- Payload: `{iss:'supabase', ref, role:'web_reader', iat, exp}` with TTL=300 s
- `ref` extracted from `SUPABASE_URL` host via regex (`bctyygbmqcvizyplktuw`)
- In-process cache: re-mints when <60 s before expiry
- **Fail-closed**: throws `Error` containing `"SUPABASE_JWT_SECRET"` if env var absent — never returns null, never falls back to anon
- Exported as `async function mintWebReaderToken(): Promise<string>` (async to satisfy supabase-js `accessToken: () => Promise<string|null>` contract)

Test file `app/lib/web-reader-jwt.test.ts` (11 tests):
- JWT structure (3 parts)
- header alg=HS256, typ=JWT
- payload role="web_reader", iss="supabase", ref="bctyygbmqcvizyplktuw"
- exp in future, exp-iat=300 s (±2)
- HS256 roundtrip with test secret
- Negative: wrong secret fails verification
- Fail-closed: missing SUPABASE_JWT_SECRET rejects with that string
- Cache: two consecutive calls return same token

### Task 2 — app/lib/supabase.ts + .env.example

Modified `app/lib/supabase.ts`:
- Preserved `import "server-only"` line 1, `createServerSupabase(): SupabaseClient` signature, `SUPABASE_URL`+`SUPABASE_ANON_KEY` reads and env guard
- Added `import { mintWebReaderToken } from "./web-reader-jwt"`
- Added `accessToken: async () => mintWebReaderToken()` and `auth: { persistSession: false, autoRefreshToken: false }` to createClient options
- Updated header comment to document web_reader role, Kong apikey mechanics, and cutover order
- All existing callers (Server Components) remain untouched

Added to `.env.example`:
```
SUPABASE_JWT_SECRET=   # JWT secret from Dashboard → Settings → API → JWT Secret; NOT SUPABASE_SECRET_KEY
```

## Verification Results

| Check | Result |
|---|---|
| `npx vitest run lib/web-reader-jwt.test.ts` | **11/11 passed** |
| `npx vitest run` (full suite) | **309/309 passed** (31 test files) |
| `npx tsc -b` | **No errors** |

## Deviations from Plan

**1. [Rule 1 - Bug] Draft export was sync; corrected to async**
- Found during: Task 1 implementation review (plan instructions explicitly flagged this)
- Issue: Draft `mintWebReaderToken()` returned `string` (sync); `accessToken` callback requires `() => Promise<string|null>`
- Fix: Exported as `export async function mintWebReaderToken(): Promise<string>`; all test calls updated to `await mintWebReaderToken()`; throw test updated to `await expect(fresh()).rejects.toThrow(...)`
- Files: web-reader-jwt.ts, web-reader-jwt.test.ts

**2. [Rule 2 - Missing critical] vi.resetModules() moved to beforeEach**
- The draft only called `vi.resetModules()` in the throw test. To guarantee a fresh module (and fresh `_cache`) for every test, `vi.resetModules()` was added to both `beforeEach` and `afterEach`. This makes the cache test deterministic regardless of test execution order.

## Task 3 — DEFERRED (checkpoint:human-action)

Task 3 is a blocking operator checkpoint. The agent does NOT deploy to Cloudflare.

**Operator steps required before applying 0044 (revoke anon):**
1. Verify LOCKDOWN-01 (0043) is applied to PROD (`web_reader` role exists).
2. Obtain `SUPABASE_JWT_SECRET` from Dashboard → Settings → API → JWT Settings → JWT Secret. NOT `SUPABASE_SECRET_KEY`.
3. Verify offline: re-sign a token with that secret and confirm it matches the HS256 scheme of the live anon key.
4. Add `SUPABASE_JWT_SECRET` to `.env` (local) and Cloudflare Pages environment variables (prod).
5. Build OpenNext on Linux/Docker and deploy (docs/deploy-cloudflare.md).
6. Smoke-test LIVE site: /parlamentarios, /agenda, busqueda, ficha proyecto, votaciones, lobby, patrimonio, dinero, NET, cruces must render. Exclude admin surface (mis-wired, gated OFF).
7. If smoke-test passes: signal "03 deployado y sitio verde" to proceed to Task 3 (0044 revoke).

If `SUPABASE_JWT_SECRET` is wrong/missing in Cloudflare, the fail-closed `accessToken` throws on first request — the site errors at step 2 BEFORE the revoke, caught early while anon still works.

## Known Stubs

None. The module reads real env vars and performs real cryptographic operations. No placeholder data flows to UI rendering.

## Threat Flags

None new. The JWT secret is read server-only (`import "server-only"` + no `NEXT_PUBLIC_` prefix). The module does not open new network surfaces.

## Self-Check: PASSED

- `app/lib/web-reader-jwt.ts` — exists
- `app/lib/web-reader-jwt.test.ts` — exists
- `app/lib/supabase.ts` — modified (contains `accessToken`, `mintWebReaderToken` import)
- `.env.example` — contains `SUPABASE_JWT_SECRET`
- vitest full suite: 309/309 passed
- tsc: no errors
