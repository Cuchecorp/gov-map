# Phase 97: AUTH P0 — SPIKE auth-on-Workers de-risk — Research

**Researched:** 2026-07-23
**Domain:** Supabase Auth (GoTrue) session on Next.js 16 App Router deployed via OpenNext → Cloudflare Workers; cookie-based SSR session refresh through a proxy/middleware
**Confidence:** HIGH (repo facts read from code; the central OpenNext-vs-Next16 caveat verified against Next.js 16 local docs + two open upstream issues)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Middleware **Edge-style clásico** (`middleware.ts` raíz con `matcher`), **JAMÁS Node Middleware 15.2+** (caveat OpenNext verificado en research).
- El spike **NO resucita la anon key legacy muerta** (Camino A intacto) ni toca el plano service_role del sitio existente. El acceso nuevo del navegador = **publishable key nueva de bajo privilegio con RLS** (o server-side).
- **Verificación sobre DEPLOY REAL**, no local — el middleware nuevo es EL riesgo del build OpenNext. Runbook deploy: Docker `node:22-slim`, robocopy a `C:/Temp/obs-build`, wrangler global OAuth, pnpm 11 `dangerouslyAllowAllBuilds true`.
- Auth method: **magic-link/OTP por email** (base para 103). El SMTP interno de Supabase (2 emails/hora) basta para el SPIKE; Custom SMTP/Resend es de 103.
- Emails de prueba = SOLO direcciones del operador/test propias, jamás terceros.
- **CSP ENFORCED** en PROD: si Supabase Auth necesita un origen en connect-src, ajuste MÍNIMO documentado; **jamás quitar** frame-ancestors/object-src.

### Claude's Discretion
Todo lo demás (estructura del matcher, página de prueba del spike, cómo evidenciar el refresh, ruta de prueba oculta vs flag). Preferir superficie mínima: una ruta de prueba no enlazada es aceptable; no tocar navegación ni home.

### Deferred Ideas (OUT OF SCOPE)
- UI de login real, perfil de usuario, tablas `suscripcion` con RLS → Phase 103.
- Custom SMTP (Resend) para auth-emails → Phase 103.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | El deploy OpenNext/Cloudflare sostiene sesión Supabase Auth end-to-end (primer `middleware.ts` del repo, Edge-style — NO Node Middleware 15.2+; `@supabase/ssr`, Set-Cookie + refresh verificados sobre deploy real) ANTES de construir cualquier feature de usuario. | Central finding (§Summary + §Standard Stack + §Common Pitfalls #1/#2): the ONLY way to satisfy "Edge-style, not Node middleware" on Next.js 16.2.11 + OpenNext is to keep the *deprecated* `middleware.ts` filename (which OpenNext runs as Edge) and NOT migrate to `proxy.ts` (Node runtime, unsupported by OpenNext). Canonical `@supabase/ssr` code, OTP flow, cookie/CSP evidence commands all provided below. |
</phase_requirements>

## Summary

This is a **de-risk spike**, not a feature. The single question it answers empirically on the real deploy is: *does a Supabase Auth cookie session emitted through a Next.js middleware survive the OpenNext → Cloudflare Workers pipeline (Set-Cookie out, refresh in) — and does adding the repo's first `middleware.ts` break the OpenNext build?*

The research surfaced **one dominant, load-bearing fact that reframes the phase** and validates the ROADMAP's locked constraint precisely: **Next.js 16.0.0 renamed the `middleware` file convention to `proxy`, and `proxy` now runs on the Node.js runtime with the Edge runtime no longer selectable** `[CITED: node_modules/next/dist/docs/.../proxy.md line 223 + version-history line 774]`. Meanwhile **`@opennextjs/cloudflare` does NOT support Node.js proxy/middleware** — it errors with "Node.js middleware is not currently supported" `[CITED: cloudflare/workers-sdk#13755, vercel/next.js#86122]`. The escape hatch, which is exactly what the ROADMAP already locked: **keep the deprecated `middleware.ts` filename** — OpenNext still treats that as Edge middleware (supported), emitting only a build-time deprecation warning. Migrating to `proxy.ts` (the codemod's happy path) would BREAK this deploy. This is the "Version Trap" the spike exists to navigate.

Everything else is well-trodden: `@supabase/ssr` 0.12.3 is current (published 2026-07-14) and clean (slopcheck [OK], official repo). The canonical `createServerClient` + `getAll`/`setAll` cookie pattern is reproduced verbatim below. Email **OTP (6-digit code), NOT magic link**, sidesteps the redirect-URL problem for a headless curl/BrowserOS spike — but requires the Supabase email template to render `{{ .Token }}` and the call to omit `emailRedirectTo`. The publishable key (`sb_publishable_…`) exposes nothing today because there are zero live `to anon`/`to authenticated` policies and grants are revoked (Camino A + 0044) — RLS gates it to empty.

**Primary recommendation:** Ship a minimal **`middleware.ts`** (deprecated Edge convention, do NOT run the `middleware-to-proxy` codemod, do NOT add a `runtime` config) that calls `updateSession()` (canonical `@supabase/ssr` code) with a tight `matcher`, plus one unlinked test route that performs email-OTP `signInWithOtp` + `verifyOtp` and reads back `auth.getClaims()`. Deploy via the real Docker/wrangler runbook. Prove Set-Cookie emission + token refresh with curl (cookie jar) and BrowserOS on `observatorio-congreso.thevalis.workers.dev`. If OpenNext rejects the build or drops the cookie → document the honest fallback (server-side-only auth for NOTIF Phase 103) and close the phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session cookie refresh (read expired token, write fresh Set-Cookie) | **Frontend Server (SSR) — `middleware.ts`** | — | Server Components cannot write cookies; the middleware/proxy is the only place a fresh Set-Cookie can be emitted before render. This is the OpenNext pipeline surface under test. |
| Auth token issue (OTP → session) | **API / GoTrue (Supabase platform)** | Frontend Server (Route Handler calls it) | Token minting is GoTrue's job; the app only invokes `signInWithOtp`/`verifyOtp` from a Route Handler/Server Action and relays cookies. |
| Cookie storage / transport | **Browser / Client** | Frontend Server | Browser stores `sb-<ref>-auth-token` (chunked) HttpOnly cookies; SSR reads them each request. |
| Low-privilege data access (future) | **Database / Storage (RLS)** | Frontend Server (publishable-key client) | RLS is the real boundary for the `authenticated` role; publishable key alone grants nothing without a policy. Not exercised beyond "confirm it opens no surface" in this spike. |
| CDN caching of Set-Cookie | **CDN / Cloudflare** | Frontend Server | Cloudflare must NOT cache an auth Set-Cookie across users — a real cross-user session-leak risk (Pitfall #4). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | **0.12.3** (latest, published 2026-07-14) `[VERIFIED: npm registry — confirmed via npm view AND official supabase/ssr repo]` | Cookie-based server-side Supabase session for App Router: `createServerClient` with `getAll`/`setAll` cookie adapters | The vigente package (auth-helpers deprecated). Peer dep only `cookie@^1.0.2`, zero native deps → Workers-safe. slopcheck [OK]. |
| `@supabase/supabase-js` | `^2.108.2` (**already in repo** `app/package.json`) | `signInWithOtp` / `verifyOtp` / `auth.getClaims` under the hood of `@supabase/ssr` | Already a dependency; `@supabase/ssr` re-exports/wraps it. No version bump needed. |
| Next.js | `16.2.11` (**already in repo**) | `middleware.ts` (deprecated) as the Edge-runtime proxy surface | See Pitfall #1 — the version that renamed middleware→proxy; the deprecated filename is the OpenNext-compatible path. |
| `@opennextjs/cloudflare` | `^1.19.11` (**already in repo**) | Bundles the Worker; runs deprecated `middleware.ts` as Edge middleware | Supports classic Edge middleware; does NOT support Node proxy — the crux of the spike. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | The spike adds exactly ONE new npm dependency: `@supabase/ssr`. No email SDK (uses Supabase internal SMTP), no zod for this spike (OTP shape is trivial), no publishable-key client library (publishable key is a string passed to the same `createServerClient`). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `middleware.ts` (deprecated) | `proxy.ts` (Next 16 canonical) | `proxy.ts` runs Node runtime → OpenNext errors "Node.js middleware not supported" → **build/deploy breaks**. Deprecated `middleware.ts` is the only OpenNext-compatible option today. This is LOCKED by CONTEXT and confirmed by research. |
| Email OTP (6-digit code) | Magic link (email link) | Magic link needs a valid `emailRedirectTo` + click-through in a browser → awkward for headless curl evidence and depends on redirect handling surviving OpenNext. OTP code is copy-pasteable, testable via curl, and is the cleaner base for NOTIF-103. **Recommend OTP.** |
| Publishable key client in browser | Server-side-only auth (Route Handler validates, service_role writes) | For the SPIKE, neither is strictly required beyond proving the cookie survives. The Architecture research (v10.0) recommends the server-side-only model as the simplest/most auditable for NOTIF; the spike should NOT commit to exposing a browser client — just confirm the publishable key opens no surface. |
| Supabase internal SMTP (2/hr) | Custom SMTP / Resend | Custom SMTP is Phase 103. Internal SMTP's 2-emails/hour is enough for an operator testing by hand. **Do not add Resend in this phase.** |

**Installation:**
```bash
pnpm --filter app add @supabase/ssr   # 0.12.3 — the ONLY new dependency
```

**Version verification (done this session):**
- `npm view @supabase/ssr version` → `0.12.3`; `dist-tags.latest = 0.12.3`; `time.modified = 2026-07-14`; `repository.url = git+https://github.com/supabase/ssr.git`; `dependencies = { cookie: ^1.0.2 }`. `[VERIFIED: npm registry]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/ssr` | npm | Mature (Supabase org, active since 2023) | Very high (Supabase official SSR pkg) | github.com/supabase/ssr | [OK] | **Approved** |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`slopcheck install "@supabase/ssr"` returned `[OK] @supabase/ssr (npm) — 1 OK` this session. `npm view @supabase/ssr scripts.postinstall` → no postinstall script (empty). Official Supabase org package, git repo present, zero-native-dep. Safe to install without a human-verify checkpoint. (Note: only ONE package is added; the other dependencies are already vendored in the repo.)

## Architecture Patterns

### System Architecture Diagram (request/session flow under test)

```
                    ┌─────────────────────────────────────────────────────────────┐
  Browser / curl    │  1. GET /spike-auth  (no cookie yet)                          │
  (operator email)  │  2. POST /spike-auth/send   { email }  ──► Route Handler      │
        │           │        └─ supabase.auth.signInWithOtp({ email,               │
        │           │             options:{ shouldCreateUser:true } })  ──► GoTrue  │
        ▼           │             (Supabase internal SMTP → 6-digit code email)     │
   [enters code]    │  3. POST /spike-auth/verify { email, token } ─► Route Handler │
        │           │        └─ supabase.auth.verifyOtp({ email, token,            │
        │           │             type:'email' }) ─► GoTrue ─► session              │
        ▼           │           └─ Set-Cookie: sb-<ref>-auth-token(.0/.1 chunks)    │
                    │              HttpOnly; Secure; SameSite=Lax; Path=/           │
   ┌────────────────┴───────────── OpenNext Worker (Cloudflare) ───────────────────┐
   │  middleware.ts  (DEPRECATED filename = Edge runtime under OpenNext)            │
   │     export async function middleware(req) { return await updateSession(req) }  │
   │     updateSession():  createServerClient(url, PUBLISHABLE_KEY, {cookies:{      │
   │        getAll: req.cookies.getAll,                                             │
   │        setAll: writes to BOTH req.cookies and a fresh NextResponse }})         │
   │        └─ await supabase.auth.getClaims()  ◄── refreshes expired access token, │
   │           emits a NEW Set-Cookie when the token was refreshed                  │
   │     matcher: skip _next/static, _next/image, favicon, assets                   │
   └───────────────────────────────────────────────────────────────────────────────┘
                    │  4. subsequent GET with cookie → 200, claims present          │
                    │  5. after access-token expiry → middleware refresh → new      │
                    │     Set-Cookie (THE thing the spike must prove survives)      │
                    └───────────────────────────────────────────────────────────────┘

   CDN caveat: Cloudflare must NOT cache the auth Set-Cookie across users (Pitfall #4).
   CSP caveat: connect-src must allow the Supabase origin IF the client calls Supabase
   from the browser; if all auth calls are server-side, connect-src 'self' is untouched
   (Pitfall #3).
```

### Recommended Project Structure (deltas only — minimal surface)
```
app/
├── middleware.ts                 # NEW — deprecated Edge convention; calls updateSession()
├── lib/
│   └── supabase-user.ts          # NEW — updateSession() + createUserClient() (publishable key, RLS-respecting)
└── app/
    └── spike-auth/               # NEW — UNLINKED test route (not in nav, not on home)
        ├── page.tsx              # minimal: shows session state / claims via server client
        └── route handlers or actions for send/verify OTP
```
- **Do NOT** touch `app/app/page.tsx` (home, `force-dynamic`, LOCKED copy/guards).
- **Do NOT** add `to authenticated` / `to anon` policies or any migration — this spike is code-only (no DB writes). RLS work is Phase 103.
- Keep `supabase-user.ts` a **separate module** from `supabase.ts` (service_role) so a guard/refactor never confuses the two clients (Architecture research §Structure Rationale).

### Pattern 1: `middleware.ts` (deprecated Edge convention — the OpenNext-compatible surface)
**What:** Root `middleware.ts` exporting a `middleware` function + `config.matcher`. In Next.js 16 this filename is deprecated (renamed to `proxy`) but STILL FUNCTIONS and is treated by OpenNext as Edge middleware. **Do NOT** set a `runtime` config (proxy files throw on `runtime`; deprecated middleware defaults acceptably). **Do NOT** run `npx @next/codemod middleware-to-proxy` — that migration breaks OpenNext.
**When to use:** This phase, and any auth on OpenNext until `@opennextjs/cloudflare` announces Node-proxy support.
**Example:**
```typescript
// app/middleware.ts
// Source: Next.js 16 file-conventions/proxy.md (matcher shape) + Supabase SSR canonical proxy.ts
// NOTE: filename is intentionally the DEPRECATED `middleware.ts` (Edge under OpenNext).
// A build-time deprecation warning is EXPECTED and acceptable — do not migrate to proxy.ts.
import { updateSession } from "@/lib/supabase-user";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip static assets so auth logic never blocks CSS/JS/images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### Pattern 2: `updateSession()` — canonical `@supabase/ssr` cookie refresh (verbatim from current Vercel `with-supabase` example)
**What:** Creates a request-scoped `createServerClient`, mirrors cookies into a fresh `NextResponse`, and calls `getClaims()` (NOT `getUser()` in the newest example) to trigger token refresh.
**Critical rule:** do NOT run any code between `createServerClient` and `auth.getClaims()`, and MUST return the `supabaseResponse` unchanged (or copy its cookies) — otherwise users get randomly logged out.
**Example:**
```typescript
// app/lib/supabase-user.ts  — adapt the Vercel example's proxy.ts to a middleware() call.
// Source: github.com/vercel/next.js examples/with-supabase/lib/supabase/proxy.ts (canary, fetched 2026-07-23)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,                 // repo convention (not NEXT_PUBLIC_)
    process.env.SUPABASE_PUBLISHABLE_KEY!,     // sb_publishable_… — NEW env var (see Env Availability)
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do NOT insert code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  void user; // spike: no redirect gating; just refresh + emit Set-Cookie.

  // MUST return this object unchanged so the Set-Cookie survives.
  return supabaseResponse;
}
```

### Pattern 3: Email OTP send + verify (headless-friendly; NOT magic link)
**What:** `signInWithOtp` sends a 6-digit code; `verifyOtp({ type: 'email' })` exchanges it for a session and sets cookies.
**Critical config:** In the Supabase dashboard the **email OTP template must render `{{ .Token }}`** (not `{{ .ConfirmationURL }}`), and the code must **NOT pass `emailRedirectTo`** — otherwise Supabase sends a magic LINK instead of a numeric code.
**Example:**
```typescript
// Route Handler / Server Action — uses a server client bound to the response cookies.
// send:
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true }, // spike: auto-create the operator test user
});
// verify:
const { data, error } = await supabase.auth.verifyOtp({
  email,
  token,          // the 6-digit code the operator received
  type: "email",  // 'email' for sign-in/sign-up OTP
});
// on success: session cookies are written via setAll → Set-Cookie on the response.
```

### Anti-Patterns to Avoid
- **Running the `middleware-to-proxy` codemod / creating `proxy.ts`:** produces a Node-runtime proxy that OpenNext rejects → broken deploy. (Pitfall #1)
- **Setting `export const config = { runtime: "..." }` in the middleware/proxy file:** Next.js 16 proxy files throw on `runtime`; do not add it. `[CITED: proxy.md line 223]`
- **Inserting logic between `createServerClient` and `getClaims()`, or returning a new response without copying cookies:** causes random logouts. `[CITED: Vercel with-supabase proxy.ts inline warning]`
- **Reactivating the legacy anon key** (`SUPABASE_ANON_KEY`): dead by design (0044, 401). Use a NEW `sb_publishable_…` key. (LOCKED)
- **Using `service_role` for the user auth client:** service_role bypasses RLS; the publishable/authenticated client must be a separate, low-privilege client. (Architecture AP2)
- **Removing `frame-ancestors 'none'` / `object-src 'none'` from CSP:** LOCKED. Only `connect-src` may be minimally widened, and only if the browser calls Supabase directly.
- **Touching `app/app/page.tsx` or its guards:** out of scope; risks breaking bento/anti-insinuación/force-dynamic locks (v10.0 Pitfall #6).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-chunked session storage across SSR requests | Custom cookie serializer / JWT parser | `@supabase/ssr` `createServerClient` + `getAll`/`setAll` | Supabase chunks `sb-<ref>-auth-token` into `.0`/`.1`; the SSR pkg handles chunking, refresh, and cache headers (v0.10.0+). |
| Refresh-token rotation | Manual expiry check + refresh call | `supabase.auth.getClaims()` in the middleware | The library rotates and re-emits Set-Cookie atomically; hand-rolling causes the "random logout" bug the docs warn about. |
| OTP generation / verification | Custom email code + store | `signInWithOtp` / `verifyOtp` (GoTrue) | GoTrue owns rate-limiting, expiry, single-use. |
| CDN cache-safety of Set-Cookie | Manual `Cache-Control` juggling | `@supabase/ssr` ≥0.10.0 passes cache headers to `setAll` | Prevents caching an auth cookie across users; the library already handles it if `setAll` applies them. |

**Key insight:** For auth-on-Workers the entire value is in *not* hand-rolling the session/cookie/refresh dance — the one thing you MUST get right by hand is the *deployment shape* (deprecated `middleware.ts`, no `proxy.ts`, no `runtime` config), which is precisely what this spike verifies.

## Common Pitfalls

### Pitfall 1: The Next.js 16 "middleware → proxy" Version Trap breaks the OpenNext build
**What goes wrong:** Next.js 16.0.0 deprecated `middleware.ts` and renamed it to `proxy.ts`, and `proxy` runs on the **Node.js runtime with no Edge option** (`runtime` config throws). `@opennextjs/cloudflare` does NOT support Node-runtime proxy/middleware — it errors "Node.js middleware is not currently supported." If the executor "does the right thing" and creates `proxy.ts` (or runs the migration codemod), the deploy breaks.
**Why it happens:** The canonical, documented Next.js 16 path is `proxy.ts`; every fresh example and the codemod push toward it. OpenNext lags one architecture behind.
**How to avoid:** Use the **deprecated `middleware.ts` filename** (OpenNext runs it as Edge middleware). Accept the build-time deprecation warning. Do NOT run `middleware-to-proxy`. Do NOT set `runtime`. This is LOCKED in CONTEXT and now confirmed as the *only* viable path.
**Warning signs:** OpenNext build log line "Node.js middleware is not currently supported" / "switch to Edge Middleware"; a `proxy.ts` file appearing; a `runtime` throw at build.
`[CITED: node_modules/next/dist/docs/.../proxy.md lines 223, 774; cloudflare/workers-sdk#13755; vercel/next.js#86122]`

### Pitfall 2: The build itself is the risk — first middleware in a fragile OpenNext pipeline
**What goes wrong:** The repo has NEVER had a `middleware.ts`. Adding one changes the OpenNext bundle graph (middleware is bundled into the Worker). The pipeline is already delicate (Windows symlink EPERM → build must run on Linux; Docker `node:22-slim`; robocopy to `C:/Temp/obs-build`; wrangler global OAuth; pnpm 11 `dangerouslyAllowAllBuilds`).
**Why it happens:** Middleware is a distinct OpenNext output; a bundling or nodejs_compat edge case may only appear at build/deploy, not `next build`.
**How to avoid:** Deploy via the REAL runbook (Docker Linux, not Windows local; not the untested pure-CI path in the stale `docs/deploy-cloudflare.md`). Verify `pnpm --filter app build` (Next only) AND the full OpenNext build succeed. Keep the middleware body minimal so any failure isolates to *the middleware existing*, not its logic.
**Warning signs:** OpenNext build fails only after `middleware.ts` is added; `.open-next/worker.js` differs in structure; Worker 500s on every route (middleware runs on all matched requests).

### Pitfall 3: CSP `connect-src 'self'` blocks a browser-side Supabase call
**What goes wrong:** `next.config.ts` enforces `connect-src 'self'` (LOCKED, deployed v9.0). If the spike's client calls Supabase Auth *from the browser* (publishable-key client), the fetch to `https://<ref>.supabase.co` is CSP-blocked.
**Why it happens:** The current site does all Supabase I/O server-side, so `connect-src` was intentionally minimal.
**How to avoid:** **Prefer server-side auth calls** (Route Handler / Server Action) — then `connect-src 'self'` is untouched, zero CSP change. Only if a browser client is genuinely needed, widen `connect-src` MINIMALLY to include the exact Supabase origin (`https://bctyygbmqcvizyplktuw.supabase.co`), and **never** touch `frame-ancestors`/`object-src`. Document the diff.
**Warning signs:** Browser console `Refused to connect … violates Content-Security-Policy`; auth works via curl but not in BrowserOS.

### Pitfall 4: Cloudflare caches the auth Set-Cookie across users (session leak)
**What goes wrong:** When the middleware refreshes and emits a new `Set-Cookie`, if Cloudflare caches that response and serves it to another user, the second user is logged in as the first — a real cross-user session leak documented for Supabase SSR behind CDNs.
**Why it happens:** CDN response caching + a token-bearing Set-Cookie on a cacheable path.
**How to avoid:** `@supabase/ssr` ≥0.10.0 passes cache headers (`Cache-Control`, etc.) to `setAll` — apply them (the canonical `setAll` already writes cookies onto the response). The site's routes are `force-dynamic` (uncached) which helps. In the spike, VERIFY on the real deploy that two different cookie jars never receive each other's cookie (curl with two jars). 
**Warning signs:** A second curl with an empty jar receives a `Set-Cookie` for a session it never created; `cf-cache-status: HIT` on a response bearing `Set-Cookie`.

### Pitfall 5: Magic link vs OTP — Supabase sends a link when you expect a code
**What goes wrong:** `signInWithOtp` emails a magic LINK (not a 6-digit code) if the email template renders `{{ .ConfirmationURL }}` or the call passes `emailRedirectTo`. A link is awkward for headless/curl evidence and its redirect must survive OpenNext.
**How to avoid:** Set the Supabase **email OTP template to render `{{ .Token }}`**, and OMIT `emailRedirectTo`. Then `verifyOtp({ type: 'email', token })` accepts the copy-pasted code. (Dashboard action → document as an operator step; confirm by API first.)
**Warning signs:** Email contains a URL, not a 6-digit number; `verifyOtp` fails with "token not found".

### Pitfall 6: Internal SMTP rate limit (2 emails/hour) stalls iteration
**What goes wrong:** Supabase's built-in SMTP caps at ~2 auth emails/hour. Rapid re-testing hits the limit → no code arrives → false "auth broken" conclusion.
**How to avoid:** Space out sends; reuse an already-created session/refresh token to test *refresh* without a new OTP; test the refresh path (the real success criterion) independent of new-code sends. Custom SMTP is explicitly Phase 103, out of scope. Operator uses only their own email.
**Warning signs:** `signInWithOtp` returns an over-rate-limit error; emails stop arriving after the second send in an hour.

## Runtime State Inventory

> This is a **code-only spike**. No rename/refactor/migration of stored data. Included for completeness with explicit "none" findings.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no DB migration, no table create/alter, no data written. Auth users created via OTP live in Supabase-managed `auth.users` (platform), not in project schema. | none |
| Live service config | **Supabase dashboard Auth config** — Email provider must be enabled; OTP template must render `{{ .Token }}`. This is dashboard state NOT in git. | Operator step (confirm email provider ON + template); probe by API first. |
| OS-registered state | **None** — no cron, no scheduled task, no pm2 process. | none |
| Secrets/env vars | **NEW: `SUPABASE_PUBLISHABLE_KEY`** (`sb_publishable_…`) must be (a) added to `.env.example` as an empty placeholder or the env-example guard passes trivially but the var is undocumented, and (b) set as a **wrangler secret** on the Worker for the real deploy. The `.env.example` still documents the DEAD `SUPABASE_ANON_KEY` with a stale comment (line 25) — do NOT reuse it. | Add `SUPABASE_PUBLISHABLE_KEY=` to `.env.example`; `wrangler secret put SUPABASE_PUBLISHABLE_KEY` on the Worker. |
| Build artifacts | **`.open-next/` bundle changes** — adding `middleware.ts` alters the Worker output graph. Residual `C:/Temp/obs-build` node_modules lock (benign, documented in STATE). | Rebuild via OpenNext; delete `C:/Temp/obs-build` residue after. |

**Canonical question — after the code lands, what runtime state still needs touching?** Supabase dashboard Auth/email-template config (not in git) and one new wrangler secret. Nothing else.

## Code Examples

All three canonical patterns are inlined above under **Architecture Patterns** (middleware.ts, updateSession, OTP send/verify). Sources: current Vercel `with-supabase` example (`lib/supabase/proxy.ts`, `server.ts`, fetched via `gh api` 2026-07-23) and Next.js 16 local docs `proxy.md`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | ~2023–2024 | auth-helpers deprecated; use `@supabase/ssr` (0.12.3). |
| `middleware.ts` (Edge runtime) | `proxy.ts` (Node runtime, Edge removed) | **Next.js 16.0.0** | The rename + Node-runtime default is the whole reason this spike exists; OpenNext doesn't support the new form yet → stay on deprecated `middleware.ts`. |
| `supabase.auth.getUser()` in middleware | `supabase.auth.getClaims()` | 2025–2026 (asymmetric JWT era) | Newest Vercel/Supabase example uses `getClaims()`; both refresh the session. `getClaims()` is the current canonical call. |
| legacy `anon` / `service_role` JWT keys | `sb_publishable_…` / `sb_secret_…` | GA 2026, legacy retired end-2026 | This repo already migrated to `sb_secret_…` (Camino A). The publishable key is the new low-privilege browser key — introduced without resurrecting `anon`. |

**Deprecated/outdated:**
- `docs/deploy-cloudflare.md` in this repo is **STALE**: it describes the pre-Camino-A model (anon key + RLS public-read + pure GH-Actions deploy). The REAL model is `SUPABASE_SECRET_KEY` (service_role) and the Docker/wrangler-global runbook. Do not follow the anon-key instructions there.
- `SUPABASE_ANON_KEY` line + comment in `.env.example` is stale (says `createServerSupabase` uses it; it does not — it uses `SUPABASE_SECRET_KEY`). The key is dead (401).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The deprecated `middleware.ts` filename still functions in Next.js 16.2.11 (not just deprecated-with-warning but actually executed by OpenNext as Edge middleware). Verified from docs + upstream issues describing it as the *workaround*, but NOT executed on this exact repo+deploy. | Pitfall #1 / Standard Stack | If `middleware.ts` is hard-removed (not just warned) in 16.2.x, the spike must fall back to server-side-only auth (Phase 103 replan). **This is precisely what the spike proves empirically.** |
| A2 | Supabase session cookies (`sb-<ref>-auth-token`, chunked `.0`/`.1`) survive the OpenNext→Workers Set-Cookie path unchanged. Strongly expected (nodejs_compat) but unverified on this deploy. | Architecture diagram | If cookies are dropped/mangled → fallback documented, phase closes honestly (Success Criterion 4). |
| A3 | The env var name the repo will use is `SUPABASE_PUBLISHABLE_KEY` (repo convention favors non-`NEXT_PUBLIC_` server-side names; the Vercel example uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Planner's discretion; publishable key is safe to expose either way. | Env Availability / Pattern 2 | Low — naming only; both are functionally valid. Server-side calls make `NEXT_PUBLIC_` unnecessary. |
| A4 | Cloudflare will not cache the Set-Cookie because routes are `force-dynamic` + `@supabase/ssr`≥0.10.0 cache headers. Must be verified with two curl jars on the real deploy. | Pitfall #4 | If it caches → session leak; the spike's two-jar test catches it before any feature is built. |

## Open Questions

1. **Does OpenNext 1.19.11 emit a hard error or a soft warning for `middleware.ts` in Next 16.2.11?**
   - What we know: OpenNext supports Edge middleware and rejects Node proxy; the deprecated filename is the documented workaround.
   - What's unclear: whether 16.2.11 still routes deprecated `middleware.ts` to the Edge path OpenNext expects, on THIS bundle.
   - Recommendation: this is the spike's #1 empirical check — build via the real Docker runbook and read the OpenNext log; if it errors, execute the fallback.

2. **Which OTP call shape does the operator's Supabase project accept out-of-the-box (provider enabled? template = `{{ .Token }}`)?**
   - What we know: needs email provider ON and template rendering the token.
   - Recommendation: probe by API first (`signInWithOtp`); if it sends a link, flag the dashboard template change as an operator step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/ssr` (npm) | middleware session refresh | ✓ (installable, slopcheck OK) | 0.12.3 | none needed |
| `@supabase/supabase-js` | OTP calls | ✓ (in repo) | ^2.108.2 | — |
| `@opennextjs/cloudflare` | Worker build/deploy | ✓ (in repo) | ^1.19.11 | — |
| Docker `node:22-slim` + robocopy `C:/Temp/obs-build` + wrangler global (OAuth) | REAL deploy (Linux build) | ✓ (established runbook, memory v6.0/61-02) | — | GH Actions `deploy-cloudflare.yml` path exists but needs CF secrets in repo; Docker/local-wrangler is the proven path |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | user client / middleware | ✗ (must be created in Supabase dashboard + set as wrangler secret) | — | server-side-only auth still needs it for the SSR client; no fallback — operator creates it |
| Supabase Auth email provider + `{{ .Token }}` OTP template | OTP send/verify | ? (unverified; dashboard state) | — | probe by API; operator enables/edits template if needed |
| curl with cookie jar + BrowserOS | evidence capture | ✓ | — | — |

**Missing dependencies with no fallback:**
- `SUPABASE_PUBLISHABLE_KEY` must be created by the operator (Supabase dashboard → API Keys → create publishable key) and injected as a Worker secret. Without it the SSR client cannot init. This is an **operator checkpoint**.

**Missing dependencies with fallback:**
- Supabase email-OTP template config — probe by API; if it sends a link, operator flips the template to `{{ .Token }}`.

## Validation Architecture

> nyquist_validation is enabled (config key absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.6 (app), jsdom |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter app test` |
| Full suite command | `pnpm --filter app test && pnpm -r --filter './packages/**' test && pnpm --filter app run typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 (build) | Adding `middleware.ts` does NOT break the Next build | build | `pnpm --filter app build` | ✅ (script exists) |
| AUTH-01 (build) | OpenNext bundle succeeds with the new middleware | build | Docker `node:22-slim` → `pnpm run cf-build` (real runbook) | ✅ (script `cf-build`) |
| AUTH-01 (env guard) | `.env.example` still 0 offenders after adding `SUPABASE_PUBLISHABLE_KEY=` | unit | `pnpm --filter app test lib/env-example-guard.test.ts` | ✅ |
| AUTH-01 (lockdown) | No new `grant … to anon/public`; Block B scan of `app/` still clean with `supabase-user.ts` present | unit | `pnpm --filter app test lib/lockdown-guard.test.ts` | ✅ |
| AUTH-01 (cookie emit) | `verifyOtp` response carries `Set-Cookie: sb-…-auth-token` on real deploy | manual/smoke (curl) | `curl -i -c jar.txt -X POST https://observatorio-congreso.thevalis.workers.dev/spike-auth/verify -d '{...}'` → assert `Set-Cookie` present | ❌ Wave 0 (evidence script, not a unit test) |
| AUTH-01 (refresh survives) | After access-token expiry, a request with the cookie jar gets a NEW Set-Cookie (refresh through OpenNext) | manual/smoke (curl) | `curl -i -b jar.txt -c jar.txt https://…/spike-auth` after expiry → assert refreshed cookie | ❌ Wave 0 (evidence script) |
| AUTH-01 (no cross-user cache) | Two distinct cookie jars never receive each other's session cookie; no `cf-cache-status: HIT` on Set-Cookie responses | manual/smoke (curl ×2) | two-jar curl comparison | ❌ Wave 0 (evidence script) |
| AUTH-01 (Camino A intact) | Home + existing routes still 200 with the middleware matcher; service_role plane untouched | smoke (BrowserOS/curl) | `curl -I https://…/` and key routes → 200 | ❌ Wave 0 |
| AUTH-01 (CSP intact) | `frame-ancestors 'none'` + `object-src 'none'` still present; only `connect-src` minimally changed IF browser client used | unit + header check | grep `next.config.ts` CSP + `curl -I` header on deploy | partial (config is code) |

### Sampling Rate
- **Per task commit:** `pnpm --filter app test` (guards muerden: env-example, lockdown, bento/anti-insinuación unaffected).
- **Per wave merge:** full suite + `pnpm --filter app build`.
- **Phase gate:** OpenNext build green (real Docker runbook) + deploy + curl/BrowserOS evidence captured before `/gsd:verify-work`. If build/cookie FAILS → write the honest fallback doc (Success Criterion 4) and the phase still closes.

### Wave 0 Gaps
- [ ] `app/lib/supabase-user.test.ts` — optional unit around `updateSession` cookie mirroring (jsdom/NextRequest mock); MAY be deferred since the real signal is the deploy smoke test.
- [ ] Evidence script `97-SPIKE-EVIDENCE.md` (or `.sh`) — reproducible curl commands (send/verify/refresh/two-jar) + BrowserOS steps against the real deploy. **This is the primary success artifact**, not a vitest file.
- [ ] Confirm `SUPABASE_PUBLISHABLE_KEY` added to `.env.example` so `env-example-guard` documents it (empty placeholder passes).
- Framework install: none — vitest already present.

## Security Domain

> security_enforcement enabled (absent = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | Supabase GoTrue OTP; do not hand-roll. Single-use, expiring, rate-limited codes. |
| V3 Session Management | **yes** | `@supabase/ssr` HttpOnly, Secure, SameSite cookies; refresh via `getClaims()` in middleware; **cross-user cache-leak is the top risk (Pitfall #4)**. |
| V4 Access Control | **yes (defense-in-depth, not exercised)** | Publishable key = low-privilege; RLS is the boundary for `authenticated`. Spike must CONFIRM the publishable key opens no surface (zero live policies). The lockdown-guard's `authenticated`-role gap (v10.0 Pitfall #4) is a Phase 103 concern — this spike creates NO grants/policies, so the gap is not triggered here, but note it for the planner. |
| V5 Input Validation | minor | OTP `email`/`token` inputs — GoTrue validates; app passes them through. |
| V6 Cryptography | **yes (delegated)** | JWT signing/rotation is GoTrue's; never hand-roll. Publishable/secret keys are opaque strings. |
| V7 Error Handling / Logging | **yes** | Never log the OTP code, session token, or operator email (PII under 21.719). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CDN caches auth Set-Cookie → cross-user session | Information Disclosure / Spoofing | `@supabase/ssr`≥0.10.0 cache headers + `force-dynamic`; verify two-jar isolation on deploy (Pitfall #4) |
| Publishable key exposed re-opens REST surface | Elevation of Privilege | RLS deny-by-default; zero `to anon`/`to authenticated` policies live; grants revoked (0044). Confirm empty result set. |
| Node-proxy build silently ships broken auth | Denial of Service | Deprecated `middleware.ts`, no `proxy.ts`, no `runtime` config; verify OpenNext build log (Pitfall #1) |
| Operator email logged / sent to LLM | Information Disclosure (PII, 21.719) | Never log email/token; test emails = operator's own only |
| CSP relaxed too far to make browser auth work | Tampering | Prefer server-side auth (no CSP change); if browser client, widen `connect-src` to exact Supabase origin ONLY; never touch frame-ancestors/object-src |

## Sources

### Primary (HIGH confidence)
- `app/next.config.ts`, `app/wrangler.jsonc`, `app/open-next.config.ts`, `app/package.json`, `app/lib/supabase.ts`, `app/lib/env-example-guard.test.ts`, `app/lib/lockdown-guard.test.ts`, `.env.example`, `.github/workflows/deploy-cloudflare.yml`, `docs/deploy-cloudflare.md` (read this session — repo ground truth)
- `app/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (Next.js 16 local docs) — middleware→proxy rename, Node runtime default, `runtime` config throws, version history v16.0.0 — HIGH
- github.com/vercel/next.js `examples/with-supabase/lib/supabase/{proxy.ts,server.ts}` (canary, fetched via `gh api` 2026-07-23) — canonical `createServerClient` + getAll/setAll + getClaims + logout-warning — HIGH
- `.planning/research/{STACK,ARCHITECTURE,PITFALLS}.md` (v10.0) — publishable key, `@supabase/ssr`, OpenNext caveat, lockdown `authenticated` gap, 21.719 — HIGH
- `npm view @supabase/ssr` (version 0.12.3, 2026-07-14, repo, deps) + `slopcheck install @supabase/ssr` ([OK]) — HIGH

### Secondary (MEDIUM confidence)
- [opennext.js.org/cloudflare](https://opennext.js.org/cloudflare) — Middleware supported; "Node Middleware introduced in 15.2 not yet supported"; "All minor and patch versions of Next.js 16" supported — verified against upstream issues
- [cloudflare/workers-sdk#13755](https://github.com/cloudflare/workers-sdk/issues/13755) "Version Trap: Next.js 16 Proxy vs OpenNext adapter" + [vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122) "proxy.ts does not execute behind Cloudflare (middleware.ts works)" — the deprecated-middleware.ts workaround — MEDIUM/HIGH
- [Supabase JS signInWithOtp](https://supabase.com/docs/reference/javascript/auth-signinwithotp) / [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp) / [Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) — OTP shape, `{{ .Token }}` template, `shouldCreateUser`, no `emailRedirectTo` for numeric code — MEDIUM/HIGH
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) / [supabase/ssr#36 cookies](https://github.com/supabase/ssr/issues/36) / [supabase/supabase#30084 CDN cache](https://github.com/supabase/supabase/issues/30084) — publishable key low-privilege RLS-gated; CDN Set-Cookie cache leak + ≥0.10.0 fix — MEDIUM

### Tertiary (LOW confidence)
- [Supabase server-side auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — conceptual "Proxy refreshes token" language (code not in excerpt; filled from Vercel example) — LOW as code source, HIGH as concept

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm + in repo; slopcheck clean; one new dep.
- Architecture / the Version Trap: HIGH — confirmed in Next.js 16 local docs AND two upstream issues; this is the phase's crux and it is well-evidenced.
- Cookie/refresh survival on OpenNext: MEDIUM — strongly expected (nodejs_compat), but the whole point of the spike is to prove it empirically on the real deploy.
- Pitfalls: HIGH — anchored to repo guards, CSP config, and documented CDN/OTP behaviors.

**Research date:** 2026-07-23
**Valid until:** ~2026-08-06 (7 days — fast-moving: OpenNext may ship Node-proxy support any release, which would flip the entire middleware-vs-proxy decision; re-check `@opennextjs/cloudflare` changelog before planning if delayed).
