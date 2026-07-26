---
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg
plan: 03
subsystem: notif-user-surfaces
tags: [otp-auth, server-actions, rls, opaque-token, feature-flag, anti-insinuacion, notif, 21719]
requires:
  - "notifPublicEnabled() chokepoint + notif-antiflip guard (Plan 01)"
  - "USER_OWNED_TABLES allowlist + NOTIF_SERVICE_TS tolerance (Plan 01)"
  - "suscripcion / consentimiento / notificacion_envio tables + RLS (Plan 02)"
  - "createUserClient (publishable key, RLS-gated) — Phase 97 LOCKED"
provides:
  - "/cuenta RSC (OTP login + subscriptions list + preference center + consent status)"
  - "cuenta/actions.ts (enviarOtp/verificarOtp/seguir/dejarDeSeguir/cerrarSesion, user_id server-derived)"
  - "app/lib/notif-service.ts (dedicated service_role token-lookup helper — the ONLY sanctioned user-table service_role access outside the user-session path)"
  - "opaque token helper (generarToken/hashToken, node:crypto, server-only)"
  - "login-less confirmar/baja routes (opaque token, noindex, one-click baja)"
  - "gated SeguirButton on both fichas (absent from DOM when NOTIF OFF)"
  - "SUPERFICIES_NOTIF registered in anti-insinuacion-guard BEFORE copy"
affects:
  - "Plan 04 (digest cron sends the confirm email carrying the raw token; reads notificacion_envio)"
  - "Plan 05 (PROD apply of 0069-0071 + OpenNext deploy drops /spike-auth route)"
tech-stack:
  added: []
  patterns:
    - "OTP Server Actions cloned from spike-auth (WR-01 validate-before-GoTrue, WR-02 generic error no-echo)"
    - "user_id from getClaims() sub server-side (Pitfall 5) + RLS with-check backstop"
    - "opaque 256-bit token: raw in email link, sha256 hex stored (non-enumerable, non-reversible)"
    - "dedicated service_role module SEPARATE from supabase.ts (lockdown-guard NOTIF_SERVICE_TS tolerance)"
    - "gate-before-render (return null before any DOM/RPC) for the flagged Seguir button"
key-files:
  created:
    - app/app/cuenta/page.tsx
    - app/app/cuenta/actions.ts
    - app/app/cuenta/cuenta.test.tsx
    - app/app/notificaciones/token.ts
    - app/lib/notif-service.ts
    - app/app/notificaciones/confirmar/page.tsx
    - app/app/notificaciones/baja/page.tsx
    - app/app/notificaciones/notificaciones.test.ts
    - app/components/seguir-button.tsx
    - app/components/seguir-button.test.tsx
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
    - app/app/proyecto/[boletin]/page.tsx
    - app/app/parlamentario/[id]/page.tsx
    - app/middleware.ts
    - .env.example
  deleted:
    - app/app/spike-auth/page.tsx
    - app/app/spike-auth/actions.ts
    - app/lib/spike-auth-gate.ts
decisions:
  - "SUPERFICIES_NOTIF registered BEFORE writing copy (Wave-0 tripwire); no NEGACIONES_LOCKED entry needed — 'avisos instantáneos' negates 'instantáneos' which is NOT a prohibited term (same case as AGENDA 'completo'/'confirma')"
  - "token helper (token.ts) created in Task 1 (not Task 2) because cuenta/actions.ts seguir generates the confirm/baja hashes — the raw never persists, only sha256 hex in DB"
  - "notif-service.ts is a SEPARATE service_role module from supabase.ts (lockdown-guard Block D/E tolerates only this file via NOTIF_SERVICE_TS); it is the ONLY user-table service_role access point outside the user-session path"
  - "SeguirButton is a Server Component (gate-before-render); toggle wires to cuenta seguir/dejarDeSeguir via a form Server Action; logged-out click → /cuenta?next=…"
  - "[Rule 3] deleted the orphaned spike-auth-gate.ts + dead SPIKE_AUTH_ENABLED .env.example config (both only served the deleted /spike-auth route); updated the middleware.ts comment to name /cuenta as the real auth route"
metrics:
  duration: ~12 min
  completed: 2026-07-26
  tasks: 3
  files: 18
---

# Phase 103 Plan 03: NOTIF user surfaces (/cuenta + Seguir button + confirmar/baja) Summary

Built the user-visible half of NOTIF: the `/cuenta` OTP login + subscriptions + preference center + consent status, the gated Seguir/Siguiendo button on both fichas (absent from the DOM when the flag is OFF), and the login-less opaque-token confirmar/baja landing routes backed by a dedicated `notif-service.ts` service_role helper. NOTIF surfaces were registered in the anti-insinuacion linter BEFORE any copy was written, and the old `/spike-auth` probe was deleted (verified `test ! -d`). Auth stays 100% server-side (Phase 97 LOCKED — CSP untouched); `user_id` is always derived from `auth.uid()` server-side; the opaque token is the login-less capability for one-click unsubscribe (21.719).

## What was built

### Task 1 — NOTIF linter registration + /cuenta OTP + subscription actions (commit 36b5d72)

- **`anti-insinuacion-guard.test.ts`**: added `SUPERFICIES_NOTIF` (`/cuenta` page+actions, `seguir-button.tsx`, `notificaciones/{confirmar,baja}`) to the scan loop as a Wave-0 tripwire, plus a mutation self-check proving the guard bites NOTIF-injected afinidad/ranking vocab (`afín`/`aliado`/`ranking`). No `NEGACIONES_LOCKED` entry needed — the copy negates "instantáneos", which is not a prohibited term.
- **`cuenta/actions.ts`**: `enviarOtp`/`verificarOtp` cloned from spike-auth (gate fail-closed FIRST, validate-before-GoTrue WR-01, generic error never echoing email/token/GoTrue message WR-02, log only `{status,name}`); new `seguir`/`dejarDeSeguir` build `createUserClient` (RLS applies), derive `user_id` from `getClaims()` sub server-side (never from FormData — Pitfall 5), validate `tipo`+`objetivo_id` (BOLETIN_RE / PARLAMENTARIO_ID_RE), insert `suscripcion` (estado 'pendiente' + confirm/baja token **hashes**, 48h `confirm_expira_at`) + a `consentimiento` row (21.719); `cerrarSesion` for logout.
- **`cuenta/page.tsx`**: `force-dynamic` RSC, reads `searchParams` before anything, gates the subscription surface via `notifPublicEnabled`. Logged-out → login form; logged-in → session banner + subscriptions list (populated OR empty state) + fixed-frequency copy + consent status. UI-SPEC copy verbatim.
- **`token.ts`** (`import "server-only"`): `generarToken()` (32-byte base64url raw + sha256 hex hash) + `hashToken(raw)`. The DB stores ONLY the hash; the email link carries the raw.
- **`cuenta.test.tsx`** (9 tests): OTP validation rejects bad email/token without echoing; `seguir` derives `user_id` server-side + stores hashed tokens + registers consent; rejects no-session/bad-objetivo; gate OFF refuses.

### Task 2 — Opaque-token helper + dedicated service_role helper + confirmar/baja routes (commit d86ed1a)

- **`notif-service.ts`** (`import "server-only"`): a DEDICATED service_role client (SUPABASE_SECRET_KEY, RLS bypass) SEPARATE from `app/lib/supabase.ts`. Exports `buscarSuscripcionPorConfirmToken`/`buscarSuscripcionPorBajaToken` (`.eq('confirm_token_hash'|'baja_token_hash', hash).maybeSingle()`), `marcarConfirmada`/`marcarBaja`. The token hash IS the authorization; this is the ONLY user-table service_role access point outside the user-session path (lockdown-guard tolerates it via `NOTIF_SERVICE_TS`).
- **`confirmar/page.tsx`** + **`baja/page.tsx`**: public RSC, NO login, `robots: noindex`, `force-dynamic`, read `?t=` before branching, hash via `hashToken`, look up through notif-service. Confirmar respects `confirm_expira_at` (expired → invalid copy) then `marcarConfirmada`; baja is one-click `marcarBaja` (link = intent, 21.719). UI-SPEC S3/S4 copy verbatim.
- **`notificaciones.test.ts`** (4 tests): token round-trip deterministic, hash sha256-hex 64-char, distinct tokens → distinct hashes (non-enumerable), hash not reversible.

### Task 3 — Gated Seguir button on both fichas + delete /spike-auth (commit 7d57f9a)

- **`seguir-button.tsx`**: FIRST statement `if (!notifPublicEnabled(process.env)) return null;` (flag OFF ⇒ absent from DOM). Server Component derives session + following-state via the user client (RLS scoped to own); logged-out renders a link to `/cuenta?next=…`; logged-in renders a form toggle wired to `seguir`/`dejarDeSeguir` with `aria-pressed`, `min-h-[2.75rem]` (44px), petróleo active fill (never `--camara`/`--senado`).
- Mounted in **`proyecto/[boletin]/page.tsx`** and **`parlamentario/[id]/page.tsx`** (under the header, own `<Suspense>`).
- **`seguir-button.test.tsx`** (4 tests): flag OFF renders `null` (absent), flag ON `aria-pressed` reflects state, logged-out links to `/cuenta?next`.
- **Deleted** `app/spike-auth/` (page+actions), the orphaned `lib/spike-auth-gate.ts`, and the dead `SPIKE_AUTH_ENABLED` `.env.example` block (all only served the deleted probe); updated the `middleware.ts` comment to name `/cuenta` as the real auth route.

## Verification

- `pnpm exec vitest run app/cuenta app/notificaciones components/seguir-button lib/anti-insinuacion-guard lib/lockdown-guard lib/notif-antiflip-guard` → all green (cuenta 9, notificaciones 4, seguir-button 4, anti-insinuacion 33, lockdown 22, notif-antiflip 20).
- **Full app suite**: `pnpm exec vitest run` → **106 files, 1401 tests passed**.
- `pnpm exec tsc --noEmit` → **exit 0** (after `next typegen` regenerated the stale `.next/types` that still referenced the deleted `/spike-auth` route; the regenerated routes list `/cuenta`, `/notificaciones/confirmar`, `/notificaciones/baja` and drops `/spike-auth`).
- `test ! -d app/spike-auth` → **PASS** (route deleted; OpenNext build in Plan 05 drops it from the deployed routes).
- lockdown-guard Block D/E stays green (notif-service.ts tolerated; `app/lib/supabase.ts` never `.from()`s user tables).

## Threat register coverage

| Threat ID | Mitigation landed |
|-----------|-------------------|
| T-103-08 (client-forged user_id on subscribe) | `user_id` from `getClaims()` sub server-side + RLS `with check` backstop; cuenta.test asserts it |
| T-103-09 (OTP relay / email echo in error) | validate-before-GoTrue (WR-01) + generic error, never echo email/token/GoTrue message (WR-02); test asserts no-echo |
| T-103-10 (unsubscribe token forgery/enumeration) | opaque 256-bit random, sha256-hashed at rest, non-derivable; notificaciones.test asserts non-reversible/non-colliding |
| T-103-11 (Seguir surface leaks when flag OFF) | `return null` before any DOM/RPC; seguir-button.test asserts absence |
| T-103-12 (CSP widened for auth) | auth 100% server-side (Phase 97 LOCKED); browser never calls Supabase; CSP untouched |
| T-103-22 (service_role user-table access sprawls) | single dedicated `notif-service.ts`; `supabase.ts` stays clean; Block D/E tolerates only NOTIF_SERVICE_TS |
| T-103-SC (npm/pip/cargo installs) | ZERO new external packages; token = `node:crypto` builtin |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Stale `.next/types` referenced the deleted `/spike-auth` route**
- **Found during:** Task 3 (`tsc --noEmit` after deleting `app/spike-auth/`).
- **Issue:** `tsconfig.json` explicitly includes `.next/types/**/*.ts`. The generated `validator.ts` still `import`ed `../../app/spike-auth/page.js` and `routes.d.ts` still listed `/spike-auth` → `tsc` failed with TS2307 on a module that no longer exists.
- **Fix:** ran `pnpm exec next typegen` to regenerate the route types; the regenerated files drop `/spike-auth` and add `/cuenta` + `/notificaciones/{confirmar,baja}`. tsc then exits 0. (`.next` is gitignored — no commit; the Plan 05 OpenNext build regenerates it anyway.)

**2. [Rule 3 - Dead code from deletion] Orphaned spike-auth gate lib + dead .env config**
- **Found during:** Task 3 (deleting the /spike-auth route).
- **Issue:** `app/lib/spike-auth-gate.ts` and the `SPIKE_AUTH_ENABLED` block in `.env.example` were consumed ONLY by the deleted `/spike-auth` route → dead code/config after the deletion.
- **Fix:** `git rm lib/spike-auth-gate.ts` + removed the `.env.example` block + updated the `middleware.ts` comment (which named `/spike-auth` as the real auth route) to name `/cuenta`. No behavior change to any live surface.
- **Commit:** 7d57f9a

## Authentication gates

None hit during execution — the NOTIF flag defaults OFF and the tests mock the OTP/session layer. Note the PRE-EXISTING operator gate (97-02, still pending): the runtime OTP flow needs the operator to provision `SUPABASE_PUBLISHABLE_KEY` + the Auth OTP template + the wrangler secret before `/cuenta` can exercise a live login on the deploy. That is documented in STATE.md Blockers and unchanged by this plan (the code path is complete and tested with mocks).

## Deferred / Notes

- **PROD apply is Plan 05.** The 0069-0071 migrations are not yet applied to PROD; with the tables absent the RSC subscription reads would error on PROD — but the NOTIF flag defaults OFF, so `/cuenta` renders the "no disponible" copy and the Seguir button is absent until the flag flips at deploy-time (post-apply, post-legal-signoff).
- **Confirm email (raw token) is Plan 04.** `seguir` generates and stores the hashes now; the digest cron sends the confirmation email carrying the raw token. Until then a subscription stays 'pendiente' and never confirms via the email path (the /cuenta list filters `estado != 'baja'`, so pendientes still show).

## Known Stubs

None. All surfaces are wired: `/cuenta` reads real suscripcion/consentimiento rows via the user client; the Seguir button reads real session + subscription state; confirmar/baja look up real rows via notif-service. The only "empty until data" states are honest (no subscriptions yet, flag OFF) — not stubs.

## Self-Check: PASSED

- app/app/cuenta/page.tsx — FOUND
- app/app/cuenta/actions.ts — FOUND
- app/app/cuenta/cuenta.test.tsx — FOUND
- app/app/notificaciones/token.ts — FOUND
- app/lib/notif-service.ts — FOUND
- app/app/notificaciones/confirmar/page.tsx — FOUND
- app/app/notificaciones/baja/page.tsx — FOUND
- app/app/notificaciones/notificaciones.test.ts — FOUND
- app/components/seguir-button.tsx — FOUND
- app/components/seguir-button.test.tsx — FOUND
- app/app/spike-auth — DELETED (test ! -d passes)
- commit 36b5d72 (Task 1) — FOUND
- commit d86ed1a (Task 2) — FOUND
- commit 7d57f9a (Task 3) — FOUND
