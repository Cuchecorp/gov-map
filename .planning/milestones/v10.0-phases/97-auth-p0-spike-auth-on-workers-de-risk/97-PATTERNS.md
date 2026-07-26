# Phase 97: AUTH P0 — SPIKE auth-on-Workers de-risk - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 7 (5 new, 2 modified)
**Analogs found:** 7 / 7 (all have a real in-repo analog)

> Spike de infraestructura. Superficie mínima: 1 dependencia npm nueva (`@supabase/ssr`), el PRIMER `middleware.ts` del repo, un cliente user separado, una ruta de prueba no enlazada, y 2 archivos de config/guard tocados. NINGUNA migración, NINGÚN grant, NINGÚN toque a `app/app/page.tsx`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/middleware.ts` (NEW) | middleware | request-response | *(none — primer middleware del repo)*; matcher desde `next.config.ts` headers shape | no-analog (structure from RESEARCH) |
| `app/lib/supabase-user.ts` (NEW) | service (client factory + `updateSession`) | request-response / session-refresh | `app/lib/supabase.ts` (`createServerSupabase`) | role-match (server-only Supabase client factory) |
| `app/app/spike-auth/page.tsx` (NEW) | route/page (server, gated, unlinked) | request-response | `app/app/admin/revisar-entidades/page.tsx` | exact (gated server page + supabase client + server action) |
| `app/app/spike-auth/actions.ts` or route handler (NEW) | route/action (OTP send/verify) | request-response | `resolverEntidadAdmin` action in `app/app/admin/revisar-entidades/page.tsx` (`"use server"` shape) | role-match (server action calling supabase) |
| `app/lib/supabase-user.test.ts` (NEW, optional) | test | — | `app/lib/env-example-guard.test.ts` §2 (mutation self-check idiom) | role-match |
| `.env.example` (MODIFY — add `SUPABASE_PUBLISHABLE_KEY=`) | config | — | existing `.env.example` block idiom + `env-example-guard.test.ts` | exact |
| `app/next.config.ts` (MODIFY ONLY IF browser-client — widen `connect-src`) | config | — | existing `securityHeaders` CSP array | exact |

## Pattern Assignments

### `app/lib/supabase-user.ts` (NEW — service client factory, request-scoped)

**Analog:** `app/lib/supabase.ts` (`createServerSupabase`) — same "server-only Supabase client factory reading env with a fail-loud throw" shape. The NEW file differs in TWO load-bearing ways: (1) it uses `createServerClient` from **`@supabase/ssr`** (not `createClient` from `@supabase/supabase-js`), and (2) it uses the LOW-PRIVILEGE `SUPABASE_PUBLISHABLE_KEY`, never the `SUPABASE_SECRET_KEY`. Keep it a SEPARATE module so the lockdown guard / any refactor never confuses the two clients (RESEARCH §Structure Rationale + AP2).

**`server-only` + env-throw pattern to copy** (`app/lib/supabase.ts` lines 1, 34-53):
```typescript
import "server-only";
// ...
export function createServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY ...");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```
Copy the `import "server-only"` line-1 discipline and the `if (!url || !key) throw new Error(...)` fail-loud check. **Do NOT copy** `persistSession:false/autoRefreshToken:false` verbatim into `updateSession` — the SSR client manages its own cookie-based session; instead follow the canonical `@supabase/ssr` `getAll`/`setAll` cookie adapter (RESEARCH Pattern 2).

**Env var naming convention to follow** (repo uses non-`NEXT_PUBLIC_` server-side names — see `app/lib/supabase.ts:35` `process.env.SUPABASE_URL`, `supabase-admin.ts:26`): name the new var `SUPABASE_PUBLISHABLE_KEY` (server-side; no `NEXT_PUBLIC_` unless a browser client is genuinely built — RESEARCH A3, discretion).

**Core pattern (`updateSession`)**: use RESEARCH §Pattern 2 VERBATIM (canonical Vercel `with-supabase` proxy.ts adapted to a `middleware()` call). Critical rule from the source: NO code between `createServerClient` and `auth.getClaims()`, and MUST return the `supabaseResponse` object unchanged.

---

### `app/middleware.ts` (NEW — middleware, request-response) — FIRST middleware in the repo

**Analog:** NONE (repo has never had `middleware.ts` — confirmed: `app/middleware.ts` and `app/proxy.ts` both absent). Structure comes from RESEARCH §Pattern 1. Planner uses RESEARCH, not a codebase analog, for the body.

**LOCKED shape (RESEARCH §Pattern 1 + Pitfall #1):**
- Filename MUST be the **deprecated `middleware.ts`** (OpenNext runs it as Edge). Do NOT create `proxy.ts`, do NOT run `npx @next/codemod middleware-to-proxy`, do NOT add `export const config = { runtime: ... }`.
- Body is minimal: `export async function middleware(request) { return await updateSession(request); }` importing `updateSession` from `@/lib/supabase-user`.
- `config.matcher` skips static assets.

**Import alias convention** (verified `app/tsconfig.json` `"paths": { "@/*": ["./*"] }` → `@/` = `app/` root): import as `import { updateSession } from "@/lib/supabase-user";` — matches how `admin/revisar-entidades/page.tsx:3-4` imports (`@/lib/admin-gate`, `@/lib/supabase-admin`).

**AGENTS.md constraint (LOAD-BEARING):** `app/AGENTS.md` says "This is NOT the Next.js you know … Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices." The planner MUST have the executor read `node_modules/next/dist/docs/.../proxy.md` before writing the middleware, and treat the deprecation warning as EXPECTED/acceptable (not a bug to fix by migrating).

---

### `app/app/spike-auth/page.tsx` (NEW — gated server page, unlinked) + OTP send/verify action

**Analog:** `app/app/admin/revisar-entidades/page.tsx` — EXACT match for "unlinked server page that builds a supabase client and exposes a server action". Copy its skeleton; swap the admin client + gate for the user client + OTP calls.

**Server-page skeleton to copy** (`admin/revisar-entidades/page.tsx` lines 1-4, 151-199):
```typescript
import { notFound } from "next/navigation";
import { adminRevisionEnabled } from "@/lib/admin-gate";
import { createAdminSupabase } from "@/lib/supabase-admin";
// ...
export default async function RevisarEntidadesPage() {
  if (!adminRevisionEnabled(process.env)) { notFound(); }  // gate = FIRST statement
  const casos = await listarPendientes();
  return ( <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16"> ... </main> );
}
```
For the spike: the page can be simply unlinked (RESEARCH: "una ruta de prueba no enlazada es aceptable"). A gate flag is OPTIONAL for a spike test route — if used, mirror `adminRevisionEnabled`'s "first statement" idiom, but it is NOT required (this route reads no PII).

**Server action idiom to copy** (`resolverEntidadAdmin`, lines 84-149) — the "async function that validates input then calls supabase, throwing on error" shape:
```typescript
export async function resolverEntidadAdmin(input: ...): Promise<number | null> {
  if (typeof input.revisor !== "string" || input.revisor.trim() === "") {
    throw new Error("... input inválido");                 // validate BEFORE the call
  }
  const sb = createAdminSupabase();
  const { data, error } = await sb.rpc("resolver_entidad", { ... });
  if (error) { throw new Error(`... falló: ${error.message}`); }  // throw on error
  return (data as number | null) ?? null;
}
```
For the spike, the send/verify actions replace the RPC with `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` and `supabase.auth.verifyOtp({ email, token, type: "email" })` (RESEARCH §Pattern 3). The supabase client here must be an SSR server client bound to the RESPONSE cookies (so `verifyOtp` success writes `Set-Cookie`).

**SECURITY (V7, 21.719):** NEVER log the OTP `token`, the session, or the operator `email`. Do not interpolate `email`/`token` into thrown error messages (contrast: `resolverEntidadAdmin` freely echoes `chosenId` — do NOT copy that for PII fields).

---

### `.env.example` (MODIFY — add `SUPABASE_PUBLISHABLE_KEY=`)

**Analog:** existing `.env.example` `# --- Supabase ---` block (lines 16-33) + the guard that polices it.

**Block idiom to copy** (`.env.example` lines 23-25, the anon-key comment style):
```
# Clave publica (publishable, sb_publishable_...) del proyecto Supabase — bajo privilegio,
# RLS-gated. La lee app/lib/supabase-user.ts (createServerClient). NO es la anon legacy
# (muerta, 0044) ni la service key (sb_secret_). Server-side; se setea como wrangler secret.
SUPABASE_PUBLISHABLE_KEY=
```
**Guard contract (`app/lib/env-example-guard.test.ts`):** the value MUST be an empty placeholder (`SUPABASE_PUBLISHABLE_KEY=` with nothing after `=`). `detectarValorNoPlaceholder` (line 42) treats `value === ""` as allowed (line 57). Any real-looking value (e.g. an `sb_publishable_…` string ≥20 chars) would trip the ≥20-char token regex (lines 103-110) and FAIL the guard. Add the KEY with an EMPTY value only.

> NOTE (RESEARCH §State of the Art): the existing `SUPABASE_ANON_KEY` comment (line 24) is STALE — it claims `createServerSupabase` uses the anon key, but the code uses `SUPABASE_SECRET_KEY`. Do NOT reuse or resurrect `SUPABASE_ANON_KEY` (dead, 401). Adding the publishable key is a NEW line; leave the dead anon line alone or fix its comment (out of spike scope — planner's call).

---

### `app/next.config.ts` (MODIFY ONLY IF a browser Supabase client is used — CSP `connect-src`)

**Analog:** the existing `securityHeaders` CSP array (lines 31-44).

**DEFAULT for the spike = DO NOT TOUCH.** RESEARCH Pitfall #3 + LOCKED constraint: prefer server-side auth calls → `connect-src 'self'` stays untouched, zero CSP change. Only if a browser-side Supabase client is genuinely built, widen `connect-src` MINIMALLY to the exact origin:
```typescript
"connect-src 'self' https://bctyygbmqcvizyplktuw.supabase.co",  // ONLY if browser calls Supabase
```
**LOCKED — never remove:** `"object-src 'none'"` (line 39) and `"frame-ancestors 'none'"` (line 40). Any diff must be documented (RESEARCH §Security).

---

### `app/lib/supabase-user.test.ts` (NEW, OPTIONAL unit — MAY be deferred)

**Analog:** `app/lib/env-example-guard.test.ts` — the repo's canonical mutation-self-check idiom (pure exported function + §1 real-file assertion + §2 in-memory self-check). Also `admin-gate.test.ts` for a tiny env-flag test if a gate is added.

**Idiom to copy** (`env-example-guard.test.ts` lines 28-30, 154-241): `APP_ROOT = process.cwd()` / `REPO_ROOT = path.resolve(APP_ROOT, "..")` anchors; a PURE exported function; a `describe("(2) Mutation self-check", ...)` proving the helper bites and does-not-bite. Per the Validation Architecture, this unit is OPTIONAL for the spike — the PRIMARY success artifact is the deploy smoke evidence (`97-SPIKE-EVIDENCE.md`), not a vitest file. Vitest is already present (no framework install).

## Shared Patterns

### `import "server-only"` at line 1 (all new server modules)
**Source:** `app/lib/supabase.ts:1`, `app/lib/supabase-admin.ts:1`, `app/lib/admin-gate.ts:1`
**Apply to:** `app/lib/supabase-user.ts` and any spike action module that reads secret env or builds a server client.
```typescript
import "server-only";
```
Guarantees the publishable key / session logic never bundles into the browser. `SUPABASE_PUBLISHABLE_KEY` must NOT carry a `NEXT_PUBLIC_` prefix (repo convention — every existing key is non-`NEXT_PUBLIC_`; see `.env.example` comments lines 78, 86, 101).

### `@/` import alias
**Source:** `app/tsconfig.json` `"paths": { "@/*": ["./*"] }`; used in `admin/revisar-entidades/page.tsx:3-4`
**Apply to:** all new files. `@/lib/supabase-user`, `@/lib/...`.

### Fail-loud env check + fail-closed feature flag
**Source (env throw):** `app/lib/supabase.ts:39-45` / `supabase-admin.ts:29-35` — throw `new Error(...)` when a required env is missing.
**Source (fail-closed flag):** `app/lib/admin-gate.ts:22-26` — `env.X === "true"` strict literal, ausencia = OFF (never `Boolean(env.X)`).
**Apply to:** `supabase-user.ts` (throw if `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` missing); any optional spike-route gate (strict `=== "true"`).

### Deploy runbook (REAL, not the stale doc)
**Source:** `app/package.json` scripts `cf-build` / `deploy` (lines 12-15); MEMORY v6.0/61-02; `app/wrangler.jsonc` (nodejs_compat).
**Apply to:** phase gate. Build OpenNext in Docker `node:22-slim` (NOT Windows/alpine), robocopy to `C:/Temp/obs-build`, wrangler global OAuth, pnpm 11 `dangerouslyAllowAllBuilds true`. `docs/deploy-cloudflare.md` is STALE (anon-key era) — do NOT follow it. The new `SUPABASE_PUBLISHABLE_KEY` must be set via `wrangler secret put` (secrets do NOT live in `wrangler.jsonc` — see its comment line 4).

### Lockdown guard interaction (no new grants; new module must stay clean)
**Source:** `app/lib/lockdown-guard.test.ts` — Block (A) migrations >0044, Block (B) `app/` tree scan.
**Apply to:** `supabase-user.ts` + spike route. The spike adds NO migration → Block A is trivially unaffected. Block B scans `app/` for `.from('<PII table>')` and `.rpc()` outside `PUBLIC_RPC_ALLOWLIST` — the new files must call NEITHER a PII table via `.from()` NOR any RPC (OTP goes through `supabase.auth.*`, which the guard does not police). If any `.rpc()` is introduced it must be allowlisted; the spike should use zero RPCs. Note the v10.0 `authenticated`-role gap is a Phase 103 concern — this spike creates no grants/policies so it is not triggered.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/middleware.ts` | middleware | request-response | The repo has NEVER had a `middleware.ts` (verified absent). Structure/body come from RESEARCH §Pattern 1 (deprecated Edge convention) + the Next.js 16 local docs `proxy.md`. This absence IS the phase's risk — first middleware in a fragile OpenNext pipeline. |
| `app/app/spike-auth/actions.ts` (OTP send/verify) | route/action | request-response | No route handler or server action exists anywhere in `app/app/` (verified: zero `route.ts`, zero `actions.ts`). Closest shape is the inline `resolverEntidadAdmin` action inside the admin page — reuse its validate-then-call-then-throw idiom, but the OTP call itself (`signInWithOtp`/`verifyOtp`) comes from RESEARCH §Pattern 3. |

## Metadata

**Analog search scope:** `app/lib/**` (client factories, guards, gates), `app/app/**` (pages, absence of route handlers/actions), `app/next.config.ts`, `app/wrangler.jsonc`, `app/open-next.config.ts`, `app/package.json`, `app/tsconfig.json`, `.env.example`.
**Files scanned:** ~14 (5 read in full: `supabase.ts`, `supabase-admin.ts`, `admin/revisar-entidades/page.tsx`, `env-example-guard.test.ts`, `lockdown-guard.test.ts`; 4 config files; globs to confirm absence of middleware/route handlers).
**Pattern extraction date:** 2026-07-23
