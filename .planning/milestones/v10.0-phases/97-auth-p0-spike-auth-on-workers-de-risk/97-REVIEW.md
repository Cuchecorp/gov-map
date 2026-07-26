---
phase: 97-auth-p0-spike-auth-on-workers-de-risk
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - app/middleware.ts
  - app/lib/supabase-user.ts
  - app/app/spike-auth/actions.ts
  - app/app/spike-auth/page.tsx
  - app/package.json
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 97: Code Review Report

**Reviewed:** 2026-07-24
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the auth-on-Workers SPIKE: the repo's first `middleware.ts`, a low-privilege
publishable-key Supabase client (`supabase-user.ts`), and the unlinked `/spike-auth` OTP
test route (page + server actions). The listed security requirements are largely MET:

- **No service_role / secret exposure to browser:** VERIFIED. `supabase-user.ts` reads only
  `SUPABASE_PUBLISHABLE_KEY`, is `import "server-only"`, and lives in a module separate from
  the `service_role` client (`lib/supabase.ts`). No `NEXT_PUBLIC_` prefix.
- **No resurrection of dead anon legacy key:** VERIFIED. Only the new `sb_publishable_...` key
  is read; the anon key name never appears in the spike modules.
- **Middleware fail-OPEN when spike env absent:** VERIFIED. `middleware.ts:24-26` returns
  `NextResponse.next()` when `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_URL` are unset, so Camino A
  cannot 500. `process.env` is the established worker env source (mirrors `buscar.ts`,
  `supabase.ts`), so this is reliable under OpenNext.
- **CSP requires no widening:** VERIFIED. All Supabase calls run server-side; `connect-src
  'self'` and `form-action 'self'` in `next.config.ts` already cover the spike page.
- **No PII/OTP logging:** MOSTLY VERIFIED (see WR-02 for a residual leak vector).

The lockdown-guard (`lib/lockdown-guard.test.ts` block B) scans all of `app/`, but the spike
uses `supabase.auth.*` exclusively (no `.from()` / `.rpc()`), so it neither trips the PII-table
guard nor the RPC allowlist — consistent with the design note in `actions.ts`.

The dominant concern is that `/spike-auth` is deployed to production reachable-by-URL with an
unauthenticated OTP send that auto-creates users for **arbitrary** email addresses, gated only
by obscurity. That is a real abuse surface (CR-01). Remaining findings are input-validation
and hardening gaps plus missing test coverage for a security-critical first-middleware.

## Critical Issues

### CR-01: `/spike-auth` ships to production as an unauthenticated, ungated OTP relay for arbitrary emails

**File:** `app/app/spike-auth/page.tsx:20`, `app/app/spike-auth/actions.ts:43-57`
**Issue:** The route is only "unlinked" (security-by-obscurity) — there is no env-flag gate
(unlike every other sensitive surface in this repo, which uses `crucesPublicEnabled` /
`moneyPublicEnabled` / `netPublicEnabled` / `adminRevisionEnabled`), no `notFound()`, no auth
check, and no `robots`/`noindex`. It is `force-dynamic` and served on the public origin. Any
actor who guesses or discovers the path can POST arbitrary email addresses to `enviarOtp`,
which calls `signInWithOtp({ email, options: { shouldCreateUser: true } })`. Consequences:
(1) Supabase sends OTP emails to third-party addresses the operator does not control —
email-abuse / relay + sender-reputation risk; (2) `shouldCreateUser: true` silently
auto-creates GoTrue user rows for those addresses (unbounded user-table growth / pollution);
(3) the comment "solo direcciones propias del operador" is documentation, not an enforced
control. The spike's own de-risk goal (prove Set-Cookie survives OpenNext) does not require
the route to be reachable by the public.
**Fix:** Gate the entire route behind an env flag that is OFF in production, mirroring the
repo's existing gate pattern, so the spike is exercised only in preview / by the operator:
```ts
// app/app/spike-auth/page.tsx (top of the default export, before any work)
import { notFound } from "next/navigation";
// lib/spike-auth-gate.ts: export const spikeAuthEnabled = (env = process.env) =>
//   env.SPIKE_AUTH_ENABLED === "true";
export default async function SpikeAuthPage() {
  if (!spikeAuthEnabled(process.env)) notFound();
  // ...
}
```
Also add the same guard as the first statement of `enviarOtp` / `verificarOtp` (server actions
are independently invokable and must not rely on the page gate), and add `noindex` via the
route's metadata. Keep the flag unset in the production Worker.

## Warnings

### WR-01: No server-side email-format validation; empty-check only

**File:** `app/app/spike-auth/actions.ts:44-46, 63-69`
**Issue:** The header comment claims "Validación de input ANTES de la llamada," but the actual
validation only rejects non-string / whitespace-only values. `<input type="email">` in the page
is client-side and trivially bypassable (server actions accept any POST body). Malformed or
attacker-controlled strings are passed straight to `signInWithOtp` / `verifyOtp`. Combined with
CR-01 this widens the abuse surface (arbitrary non-email strings, very long inputs).
**Fix:** Validate shape and bound length before the Supabase call, e.g. with the `zod` already
in the stack:
```ts
const email = z.string().email().max(254).parse(rawEmail);
const token = z.string().regex(/^\d{6}$/).parse(rawToken); // 6-digit OTP
```
Reject on failure with a generic message (do not echo the input — see WR-02).

### WR-02: GoTrue error messages are interpolated into thrown errors and can surface PII / enumeration signal

**File:** `app/app/spike-auth/actions.ts:55, 79`
**Issue:** The code correctly avoids interpolating the email/token, but it does interpolate
`error.message` from GoTrue (`spike-auth: signInWithOtp falló: ${error.message}`). GoTrue error
messages are not guaranteed PII-free and can echo the submitted identifier or reveal
account-state differences (user-enumeration). Because this is a Server Action, the thrown error
propagates to logs and, in dev, to the client overlay. The V7 / Ley 21.719 requirement is "JAMÁS
loguear ni interpolar en mensajes de error el email ni el token" — interpolating an upstream
message that may contain the email is the same leak by proxy.
**Fix:** Do not interpolate the upstream message into a thrown/logged string. Return a fixed,
generic failure to the caller and, if diagnostics are needed, log only `error.code` /
`error.status` server-side:
```ts
if (error) {
  // log only non-PII fields server-side, e.g. error.status / error.name
  throw new Error("spike-auth: no se pudo enviar el código OTP");
}
```

### WR-03: `page.tsx` reads session with a no-op `setAll`, silently dropping any refresh cookies

**File:** `app/app/spike-auth/page.tsx:30-35, 35` (`getClaims()` under no-op `setAll`)
**Issue:** `getClaims()` internally calls `getSession()`, which can trigger a background token
refresh (verified in `@supabase/auth-js@2.108.2` `GoTrueClient.getClaims` → `getSession` →
`_useSession`). When a refresh occurs, new cookies are emitted through `setAll`, which here is a
deliberate no-op. This is the documented Supabase Server-Component pattern (the middleware owns
refresh), and the comment states as much — so it is acceptable IN THIS SPIKE. It becomes a
correctness bug the moment this pattern is copied to a route not covered by the middleware
matcher, or if the middleware is disabled: the user can be shown "sin sesión" or a stale expiry
while the refreshed token is discarded.
**Fix:** Keep as-is for the spike but add an explicit inline caveat that this no-op is safe ONLY
because the middleware matcher covers this route and performs the refresh. If session read is
ever needed off the middleware path, use `getClaims({ allowExpired: false })` on a request where
`setAll` can actually write, or read via a Route Handler/Server Action with writable cookies.

### WR-04: No test coverage for the repo's first middleware or the fail-open guard

**File:** `app/middleware.ts` (no `middleware.test.ts`), `app/lib/supabase-user.ts` (no test)
**Issue:** This is the first `middleware.ts` in the repo and the fail-open branch
(`middleware.ts:24-26`) is the explicit safety mechanism that keeps Camino A from 500-ing. There
is no test asserting (a) fail-open returns `NextResponse.next` when the publishable key is absent,
(b) `leerEnv()` is fail-loud when the key is missing, and (c) `updateSession` returns the
`supabaseResponse` unmutated. A silent regression to the fail-open condition (e.g. someone
"simplifies" the guard) would take down the public site, and the guard's own `||` polarity is
easy to invert. Security-critical branches without tests are a latent BLOCKER-in-waiting.
**Fix:** Add `app/middleware.test.ts` and `app/lib/supabase-user.test.ts` (the repo already tests
env-gated modules — see `supabase-admin.test.ts`): assert fail-open with env unset, fail-loud of
`leerEnv()` with the key removed, and that `updateSession`'s returned response is the same object
whose cookies were set.

## Info

### IN-01: `.dev.vars.example` not updated with the spike's env vars

**File:** `app/.dev.vars.example:8-13`
**Issue:** The root `.env.example` documents `SUPABASE_PUBLISHABLE_KEY` correctly, but the file
the operator copies for `opennextjs-cloudflare preview` (`app/.dev.vars.example`) still lists only
`SUPABASE_ANON_KEY` and describes it as "El frontend lee con RLS public-read" — which is both stale
(Camino A reads with `service_role`) and missing the new `SUPABASE_PUBLISHABLE_KEY` /
`SUPABASE_SECRET_KEY` the worker now needs. An operator following `.dev.vars.example` cannot
preview the spike (client is fail-loud) and will be misled about the auth model.
**Fix:** Add `SUPABASE_PUBLISHABLE_KEY=` (with the low-privilege note) and `SUPABASE_SECRET_KEY=`
to `app/.dev.vars.example`, and correct the stale anon-key comment.

### IN-02: Duplicated cookie-adapter boilerplate across three call sites

**File:** `app/lib/supabase-user.ts:57-70`, `app/app/spike-auth/actions.ts:26-35`,
`app/app/spike-auth/page.tsx:26-32`
**Issue:** The `getAll`/`setAll` cookie-adapter shape is hand-rolled three times with subtly
different write behavior (middleware mirrors into a fresh response; actions write to
`cookieStore`; page no-ops). This is easy to get wrong (WR-03 is exactly the failure mode) and
invites copy-paste drift as more auth routes are added.
**Fix:** Extract a small `cookieAdapterFromStore(cookieStore, { writable })` helper in
`supabase-user.ts` so the write/no-op decision is explicit and centralized.

### IN-03: Comment claims `getClaims()` always rotates the token; it is conditional

**File:** `app/lib/supabase-user.ts:47-49, 74`
**Issue:** The doc comment states `getClaims()` "rota el access token y re-emite Set-Cookie."
In `@supabase/auth-js@2.108.2`, `getClaims` only refreshes when the underlying `getSession`
decides the token needs it, and for symmetric (HS*) tokens it falls back to a `getUser()` network
call rather than a local verify. The comment overstates the behavior and could mislead a future
maintainer into assuming a Set-Cookie is always emitted.
**Fix:** Soften to "gatilla el refresh del access token cuando corresponde (y re-emite Set-Cookie
en ese caso)."

---

_Reviewed: 2026-07-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
