# Phase 103: NOTIF P3a — Suscripciones + digest + guards authenticated + gate legal — Research

**Researched:** 2026-07-26
**Domain:** Supabase Auth + RLS user-owned tables · CI lockdown-guard extension · Resend EGRESO cron · double opt-in / opaque tokens · Next.js 16 Server Actions on OpenNext/Workers · Ley 21.719 consent
**Confidence:** HIGH on codebase patterns (all read from tree); MEDIUM on Resend API surface (verified vs official docs, not exercised); HIGH on RLS/pgTAP idiom (matches existing tree convention).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth y login (Área 1):**
- Gate 0 (provisión operador: publishable key `sb_publishable_…`, plantilla OTP `{{ .Token }}`, `wrangler secret put SUPABASE_PUBLISHABLE_KEY`) NO bloquea la corrida: se construye TODO (schema, guards, UI, digest); el checkpoint de provisión + evidencia SC2 (curl block de 97-SPIKE-EVIDENCE.md) queda como checkpoint operador **al final** de la fase.
- Superficie de login: ruta `/cuenta` con OTP por email, reutilizando el patrón de `app/app/spike-auth/actions.ts`; la ruta `/spike-auth` se **ELIMINA** (era prueba no enlazada).
- Sesión LOCKED por Phase 97: `app/middleware.ts` Edge fail-open + `app/lib/supabase-user.ts` (publishable key, separado del service_role). CSP intacta (`connect-src 'self'` NO se amplía — auth 100% server-side). JAMÁS convención `proxy` de Next 16 ni anon legacy.
- UI de suscripción: botón "Seguir" en ficha de proyecto y de parlamentario (gated por flag NOTIF) + lista de suscripciones en /cuenta.

**Modelo de datos y seguridad (Área 2):**
- Tres tablas nuevas (migraciones **0069+**): `suscripcion` (user_id, tipo proyecto|parlamentario, objetivo_id, created_at), `notificacion_envio` (cola/log del digest, cursor idempotente), `consentimiento` (fecha, versión del texto, método — registro 21.719).
- RLS LOCKED (NOTIF-01): `to authenticated`, `auth.uid() = user_id`, deny-by-default, aisladas del plano service_role; pgTAP usuario-A-no-ve-B **obligatorio**.
- Lockdown-guard extendido al rol `authenticated` (allowlist de tablas-de-usuario + mutation self-check) como **PRIMER commit** de la fase (NOTIF-02).
- `notificacion_envio` la escribe **SOLO** service_role (cron EGRESO); `authenticated` jamás la toca (ni lectura).

**Digest por email (Área 3):**
- Digest diario L–V, corre después del cron de datos; cursor idempotente sobre novedades (actualidad_senal/tramitación) de las suscripciones del usuario. **JAMÁS instantáneo** — el copy lo declara.
- Proveedor: Resend free tier; techo **100 emails/día** declarado en docs **Y hard-cap en código**.
- Doble opt-in (confirmación por email antes de activar), unsubscribe por token opaco en footer **SIN login**, preference center mínimo en /cuenta.
- PII del email: **NUNCA** a LLM, logs de CI, ni R2; redacción en cualquier log del cron EGRESO. Patrón EGRESO (cola en tabla → GH Actions → Resend, **NO** dos-etapas) se documenta como patrón nuevo.

**Gate legal 21.719 (Área 4):**
- Operador (abogado) **PRE-AUTORIZÓ** el checkpoint legal en la invocación de esta corrida (2026-07-26). Se registra como sign-off humano en el dossier 21.719 — el agente solo documenta.
- Flag NOTIF: deny-by-default en código, pero **flip ON AUTORIZADO en esta corrida** — la captura de emails queda expuesta en el deploy final.
- Alcance dossier: DPA/subencargado Resend, base de licitud (consentimiento), derechos ARCO-P vía unsubscribe + preference center, política de retención.

### Claude's Discretion
- Naming exacto de columnas, shape del token opaco (opaco, no-JWT, no derivable), plantillas HTML del email, estructura interna de `@obs/notificaciones`, orden de planes tras el primer commit (guard).

### Deferred Ideas (OUT OF SCOPE)
- Web push / Service Worker (VAPID) — post-v10 (ya en Future Requirements).
- Notificaciones instantáneas — vetadas por diseño (crons).
- Suscripción por keyword/comisión — post-validación.
- Resúmenes LLM en el digest — anti-feature (fabricaciones vs trazabilidad).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **NOTIF-01** | Usuario autenticado (OTP) se suscribe/des-suscribe a proyecto o parlamentario; tablas user-owned con RLS `to authenticated`, `auth.uid()=user_id`, deny-by-default, aisladas del plano service_role | §Standard Stack (auth), §Pattern 1 (RLS shape), §Pattern 4 (Server Actions), §Validation (pgTAP two-user) |
| **NOTIF-02** | Lockdown-guard extendido al rol `authenticated` (allowlist tablas-de-usuario + mutation self-check) como **PRIMER commit** | §Pattern 2 (guard extension — exact mechanics from `lockdown-guard.test.ts`), §Pitfall 1 |
| **NOTIF-03** | Digest diario por email (Resend, techo 100/día) agrupa novedades; cursor idempotente, cola en tabla drenada por cron GH Actions (patrón EGRESO); jamás instantáneo | §Standard Stack (Resend), §Pattern 3 (EGRESO cron), §Pattern 5 (cursor), §Pitfall 3 (rate cap) |
| **NOTIF-04** | Doble opt-in, unsubscribe por token opaco (sin login), preference center, registro consentimiento; email PII nunca a LLM/CI/R2 | §Pattern 6 (opaque token), §Pattern 7 (consent record), §Pitfall 4 (PII), §Security Domain |
| **NOTIF-05** | Checkpoint legal 21.719 ANTES de exponer captura pública; DPA proveedor = gate operador; sin respuesta → flag OFF + handoff | §Pattern 8 (flag + anti-flip), §Security Domain (dossier scope), §Validation (dossier) |
</phase_requirements>

---

## Summary

Phase 103 introduces the **first user-owned data** in the system on top of the auth pipeline that Phase 97 already de-risked structurally (middleware.ts runs as Edge under OpenNext; Camino A + CSP intact; `supabase-user.ts` publishable-key client separate from service_role). Everything the phase needs on the auth side is **already in `master`** — the only open runtime dependency is the operator provisioning the publishable key (Gate 0), which by CONTEXT decision is a **non-blocking checkpoint at the END** of the phase.

The work splits into four tightly-coupled tracks: (1) three RLS-protected tables (`suscripcion`, `notificacion_envio`, `consentimiento`) starting at migration **0069**, with `to authenticated` + `auth.uid() = user_id` policies and a **two-user pgTAP** proving isolation; (2) the CI lockdown-guard extension to the `authenticated` role — this is the **first commit** and the single most delicate piece, because the existing guard (`app/lib/lockdown-guard.test.ts`) is currently anon-only and *has no concept of `authenticated` write access*; (3) a **new EGRESO pattern** — a `@obs/notificaciones` package drained by a GH Actions cron that calls Resend's REST API with a hard 100/day cap and a durable cursor; (4) double opt-in + opaque-token unsubscribe (public, login-less) plus a Ley 21.719 consent record and legal dossier.

**Primary recommendation:** Sequence the phase as CONTEXT dictates — **Plan 01 = guard extension (first commit, red-to-green mutation self-check), then schema+RLS+pgTAP, then Server Actions/UI, then the EGRESO package+cron, then flag flip + dossier**. Reuse `spike-auth/actions.ts` verbatim in shape for the OTP flow. Use `fetch` (not the Resend SDK) for the single POST endpoint. Model the NOTIF flag + anti-flip guard byte-for-byte on `vsim-gate.ts` / `vsim-antiflip-guard.test.ts`. Write RLS pgTAP with the tree's own `set local role authenticated` + `set local request.jwt.claims` idiom — **NOT** the basejump `tests.authenticate_as` helpers (that extension is not installed here).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OTP login (send/verify) | Frontend Server (Server Actions) | Supabase Auth (GoTrue) | Auth 100% server-side (LOCKED); publishable-key client writes Set-Cookie via cookie adapter. Browser never talks to Supabase. |
| Session refresh | Frontend Server (middleware.ts Edge) | — | `updateSession()` in Edge middleware; fail-open when key absent (Phase 97). |
| Subscription read/write (`suscripcion`) | Database (RLS `authenticated`) | Frontend Server (Server Action with user session) | RLS enforces `auth.uid()=user_id`; the user session (publishable key, NOT service_role) is the actor so RLS applies. |
| Digest queue write (`notificacion_envio`) | Database (service_role only) | Backend cron (GH Actions) | Cron owns the queue; `authenticated` has ZERO grant on it. |
| Consent record (`consentimiento`) | Database (RLS `authenticated` insert + service_role read for cron) | Frontend Server | Written at opt-in time via user session; read by cron to confirm licitud before send. |
| Email egress (digest send) | Backend cron (GH Actions → Resend REST) | — | Patrón EGRESO nuevo; NOT two-stage (no R2 crudo). |
| Double opt-in / unsubscribe landing | Frontend Server (public Route/RSC, no login) | Database (service_role token lookup) | Opaque token verified server-side WITHOUT a session; token → subscription row. |
| Flag gating of Seguir button | Frontend Server (RSC render) | — | `notifPublicEnabled()` chokepoint; OFF ⇒ absent from DOM (return null before render). |
| PII redaction | Backend cron + CI guard | — | Email never logged raw; CI guard blocks new user-tables from `app/` public tree misuse. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | already vendored (used by `supabase-user.ts`) | OTP session + cookie adapter | LOCKED by Phase 97; `createServerClient` + `updateSession` pattern proven on OpenNext. `[VERIFIED: codebase — app/lib/supabase-user.ts]` |
| `@supabase/supabase-js` | `^2.108.2` (per `packages/actualidad/package.json`) | service_role client in the EGRESO cron (queue drain, token lookup, envio log write) | Same client used by every existing cron package. `[VERIFIED: codebase]` |
| Supabase Auth (GoTrue) | project `bctyygbmqcvizyplktuw` | `signInWithOtp` / `verifyOtp` (`type: "email"`, 6-digit) | Already exercised in `spike-auth/actions.ts`. `[VERIFIED: codebase]` |
| Resend REST API | endpoint `https://api.resend.com/emails` (POST) | Digest email send | Free tier: 3,000/mo, **100/day** hard cap; default rate limit ~2 req/s (some accounts 10 req/s). Auth: `Authorization: Bearer re_...`. Custom headers (List-Unsubscribe) via `headers` object in the JSON body. `[CITED: resend.com/docs/api-reference/emails/send-email]` `[CITED: resend.com/docs/api-reference/rate-limit]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node `crypto` (built-in) | Node 22 | Opaque token generation (`randomBytes(32).toString('base64url')`) + `createHash('sha256')` to store token hashed | Token is opaque, non-derivable, non-JWT. Store the **hash**, compare on lookup. No dependency. `[ASSUMED — standard Node pattern]` |
| `tsx` | `^4.22.4` | Run the EGRESO CLI in GH Actions | Every cron package uses `tsx src/run-*-prod-cli.ts`. `[VERIFIED: codebase]` |
| `vitest` | `^3.0.0` | Package unit tests + the CI guard tests | Repo-wide test runner. `[VERIFIED: codebase]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch` to Resend `/emails` | `resend` npm SDK | SDK adds a dependency + slopcheck surface for ONE POST endpoint. `fetch` suffices and matches "NO SDK bloat if fetch suffices" (CONTEXT). Recommend **fetch**. |
| Raw `set local role authenticated` in pgTAP | basejump `supabase_test_helpers` (`tests.authenticate_as`) | The helper extension is **NOT installed** in this repo (every existing RLS test uses `set local role anon; … reset role;`). Using the helpers would fail to run. Recommend the **tree idiom**. |
| Node `crypto` opaque token | JWT / signed token | JWT is derivable/decodable and invites "just verify the signature" shortcuts; CONTEXT mandates **opaque, non-JWT, non-derivable**. Recommend **random+hashed**. |
| Resend batch endpoint (`/emails/batch`, up to 100) | per-recipient `/emails` | Batch is attractive for the 100/day cap but complicates per-recipient List-Unsubscribe + failure isolation. Start with per-recipient loop respecting the cap; revisit batch only if volume demands. `[CITED: resend.com/blog/introducing-the-batch-emails-api]` |

**Installation:**
```bash
# @obs/notificaciones package.json — mirror packages/actualidad/package.json:
#   dependencies: { "@supabase/supabase-js": "^2.108.2" }
#   devDependencies: { "@types/node", "tsx", "vitest" }
# NO Resend SDK. Email send = global fetch (Node 22). Token = node:crypto (built-in).
```

**Version verification:** `@supabase/supabase-js ^2.108.2` and `tsx ^4.22.4` are the versions already pinned across `packages/*` — reuse those exact ranges, do not bump. Resend API surface confirmed against official docs 2026-07-26 (endpoint, auth header, `headers` object). No new npm package is introduced beyond the workspace-standard set.

---

## Package Legitimacy Audit

> This phase introduces **ZERO new external npm packages**. `@obs/notificaciones` is an internal workspace package. Email send uses global `fetch`; tokens use built-in `node:crypto`. The only dependencies are workspace-standard (`@supabase/supabase-js`, `tsx`, `vitest`) already present and locked in `pnpm-lock.yaml`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@supabase/supabase-js` | npm | mature | very high | github.com/supabase/supabase-js | n/a (already in lockfile) | Approved (pre-existing) |
| `tsx` | npm | mature | very high | github.com/privatenumber/tsx | n/a (already in lockfile) | Approved (pre-existing) |
| `vitest` | npm | mature | very high | github.com/vitest-dev/vitest | n/a (already in lockfile) | Approved (pre-existing) |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages).
**Packages flagged as suspicious [SUS]:** none.

*No slopcheck run required — no new install. If the planner elects to add the Resend SDK (NOT recommended), gate it behind a `checkpoint:human-verify` and run the full Package Legitimacy Gate first.*

---

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────── BROWSER (no Supabase client) ──────────────────────┐
                            │  /cuenta  · Seguir button (RSC) · /notificaciones/confirmar · /baja        │
                            └───────────────┬──────────────────────────────────┬───────────────────────┘
                                            │ <form action={serverAction}>      │ GET (opaque token in query, no login)
                                            ▼                                    ▼
        ┌──────────── FRONTEND SERVER (Next.js 16 / OpenNext / Workers) ───────────────────────────────┐
        │  middleware.ts (Edge, fail-open) ── updateSession() refresh ──► Set-Cookie sb-<ref>-auth-token │
        │  Server Actions (user session, publishable key):                                              │
        │    enviarOtp / verificarOtp  ──► GoTrue (supabase.auth.*)                                      │
        │    seguir / dejarDeSeguir    ──► .from('suscripcion')  [RLS: auth.uid()=user_id]              │
        │  Public Route Handlers (service_role, token lookup):                                          │
        │    confirmar(token) / baja(token) ──► hash(token) → subscription row                          │
        └───────────────┬──────────────────────────────────────────────┬───────────────────────────────┘
                        │ RLS-scoped (authenticated)                     │ service_role (RLS bypass, token lookup)
                        ▼                                                ▼
        ┌──────────────────────────── SUPABASE POSTGRES ──────────────────────────────────────────────┐
        │  suscripcion (RLS authenticated: select/insert/delete own)                                    │
        │  consentimiento (RLS authenticated insert own; service_role read)                             │
        │  notificacion_envio (NO authenticated grant; service_role ONLY — queue + idempotent cursor)  │
        │  ── reads for digest: actualidad_senal / tramitacion_evento (novedades since cursor) ────────  │
        └───────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                                         │ service_role (drain queue, read novedades)
                                                         ▼
        ┌──────────── EGRESO CRON (GH Actions, L–V, after data cron) — patrón NUEVO, NO dos-etapas ────┐
        │  @obs/notificaciones CLI (tsx):                                                               │
        │   1. read active double-opted-in subscriptions + consent                                     │
        │   2. compute novedades since per-user cursor (idempotent)                                    │
        │   3. enforce HARD CAP 100/day (code) → pending rows stay queued for tomorrow                 │
        │   4. POST https://api.resend.com/emails (fetch, Bearer) w/ List-Unsubscribe header           │
        │   5. write notificacion_envio log + advance cursor  (email REDACTED in all logs)             │
        └─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/migrations/
  0069_suscripcion_rls.sql              # tabla + RLS to authenticated + auth.uid()=user_id
  0070_notificacion_envio.sql           # cola/cursor; service_role only (NO authenticated grant)
  0071_consentimiento.sql               # registro 21.719 (fecha/version/metodo)
  # (numbering exact count is planner discretion; start 0069, one table per migration recommended)
supabase/tests/
  0069_suscripcion_rls.test.sql         # TWO-USER isolation (A no ve B) — set local role authenticated
  0070_notificacion_envio.test.sql      # authenticated has ZERO grant; service_role writes
  0071_consentimiento.test.sql
app/lib/
  notif-gate.ts                         # chokepoint: notifPublicEnabled() (mirror vsim-gate.ts)
  notif-antiflip-guard.test.ts          # anti-flip (mirror vsim-antiflip-guard.test.ts)
  lockdown-guard.test.ts                # EXTEND: add authenticated allowlist + self-check (Plan 01)
app/app/
  cuenta/page.tsx  cuenta/actions.ts    # OTP + subscriptions list + preference center
  notificaciones/confirmar/page.tsx     # double opt-in landing (opaque token, no login, noindex)
  notificaciones/baja/page.tsx          # unsubscribe landing (opaque token, no login, noindex)
  # DELETE app/app/spike-auth/*
app/components/
  seguir-button.tsx                     # gated by notifPublicEnabled(); aria-pressed
packages/notificaciones/                # @obs/notificaciones — EGRESO package
  package.json  src/index.ts  src/run-digest-prod-cli.ts  src/resend.ts  src/digest.ts
.github/workflows/
  digest-daily.yml                      # L–V after data cron; RESEND_API_KEY secret; email REDACTED
docs/legal/
  103-LEGAL-DOSSIER-NOTIF.md            # DPA Resend, licitud, ARCO-P, retención, signoff
```

### Pattern 1: RLS user-owned table (`to authenticated` + `auth.uid() = user_id`)

**What:** Deny-by-default table where every row is owned by exactly one auth user; only that user can read/write it, enforced by the DB (not the app).
**When to use:** `suscripcion` (full CRUD by owner), `consentimiento` (insert by owner, read by cron).
**Shape (verified against tree conventions — 0043 migration + 0020 test idiom):**
```sql
-- Source: pattern synthesized from supabase/migrations/0043 + supabase/tests/0020 idiom [VERIFIED: codebase]
create table suscripcion (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('proyecto','parlamentario')),
  objetivo_id text not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente','confirmada','baja')),
  created_at  timestamptz not null default now(),
  unique (user_id, tipo, objetivo_id)
);
alter table suscripcion enable row level security;

-- deny-by-default: no policy for anon (anon stays 0 rows). Only authenticated, only own rows.
create policy suscripcion_select_own on suscripcion
  for select to authenticated using ( (select auth.uid()) = user_id );
create policy suscripcion_insert_own on suscripcion
  for insert to authenticated with check ( (select auth.uid()) = user_id );
create policy suscripcion_delete_own on suscripcion
  for delete to authenticated using ( (select auth.uid()) = user_id );
-- NO grant to anon, NO grant to public, NO grant to web_reader (dropped). service_role bypasses RLS.
```
- **`(select auth.uid())` wrapper** (not bare `auth.uid()`) is the Supabase-recommended form: it caches the function per-statement and avoids per-row re-eval (init-plan optimization). `[CITED: supabase.com/docs — RLS performance]`
- **`on delete cascade` to `auth.users`** so a deleted user's rows vanish (retention/ARCO-P hygiene).
- **CRITICAL lockdown interaction:** these are `create policy … to authenticated` — the lockdown-guard's block (A) only forbids `to anon`/`to public` (see Pitfall 1). A `to authenticated` policy is **allowed** by the current guard, but Plan 01 must add a *positive* allowlist so future non-user tables can't silently grant `authenticated`.

### Pattern 2: Extending the lockdown-guard to `authenticated` (NOTIF-02, FIRST commit)

**What:** The existing guard (`app/lib/lockdown-guard.test.ts`) enforces two invariants: (A) no migration >0044 does `grant … to anon/public` or `create policy … to anon`; (B) the `app/` public tree never touches PII tables via `.from()` nor calls a non-allowlisted `.rpc()`. It has **no concept of `authenticated`**. The hole: a future migration could grant `authenticated` broad access to a NON-user table, or the app could `.from('suscripcion')` from a context that leaks.

**How to extend (exact mechanics, matching the file's existing style):**
1. **Positive allowlist of user-owned tables** — add a `USER_OWNED_TABLES = new Set(['suscripcion','consentimiento'])` constant (NOT `notificacion_envio` — see below).
2. **Block D (new): `to authenticated` only on allowlisted user tables.** Scan migrations >0044 for `create policy … to authenticated` / `grant … to authenticated`; the target table must be in `USER_OWNED_TABLES`. Any other table getting an `authenticated` grant/policy is an offender. This is the "allowlist of tablas-de-usuario" CONTEXT requires.
3. **Block E (new): `notificacion_envio` has ZERO `authenticated` grant.** Assert no migration grants `authenticated` any privilege on `notificacion_envio` (queue is service_role-only). Also assert the `app/` public tree never does `.from('notificacion_envio')` (it's written only by the cron package, not `app/`).
4. **`.from('suscripcion')` allowance:** the user tables are NOT in `PII_TABLES`, so block (B) won't flag them. But confirm they should only be touched by the **user-session client**, never the public service_role reader (`app/lib/supabase.ts`). Add an assertion that `app/lib/supabase.ts` (the service_role chokepoint) does not `.from('suscripcion'|'consentimiento'|'notificacion_envio')`.
5. **Mutation self-check (mandatory — matches the file's existing self-check idiom, e.g. Direction-B `parseDefinedRpcNames`):** a pure detector (`authenticatedGrantOffenders(sql, allowlist)`) exercised in-memory with fixtures proving it BITES: (a) `grant select on public.proyecto to authenticated` → offender (proyecto not user-owned); (b) `grant insert on public.notificacion_envio to authenticated` → offender; (c) `create policy x on suscripcion for select to authenticated using (...)` → NOT offender (allowlisted). The self-check proves the guard is not a green no-op.

**Reference implementation to clone:** the anon-grant machinery in `anonGrantOffenders()` (lockdown-guard.test.ts:222) — same per-statement `split(";")` + regex + `stripSqlComments` approach, swapping `anon|public` for `authenticated` and inverting to a positive allowlist.

**Sequencing:** This is the **first commit** (NOTIF-02) — write it red (it should fail if any later plan's migration grants `authenticated` outside the allowlist), then land the migrations. This catches the hole before PROD.

### Pattern 3: EGRESO cron (patrón NUEVO — NO dos-etapas)

**What:** The project's LOCKED ingesta rule (CLAUDE.md §Conventions) is *two-stage*: source → R2 crudo → Supabase. **EGRESO is the inverse and does NOT apply the two-stage rule** — there is no source to be respectful of, no R2 crudo, no rate-limit 2–3s/host against a gov WAF, no robots.txt. The precedent for "a cron that doesn't touch sources" is `actualidad-refresh.yml` (reads own DB, writes own DB, no R2). EGRESO reads own DB (queue + novedades) and writes OUT to Resend.

**Document the difference explicitly** (a required deliverable — CONTEXT): a header comment in `digest-daily.yml` and in `@obs/notificaciones` stating "patrón EGRESO: NO dos-etapas, NO R2, NO rate-limit gubernamental; el destinatario es Resend, no una fuente. La ÚNICA cota es el hard-cap 100/día de Resend (código) + redacción de PII en logs."

**Cron shape (clone `actualidad-refresh.yml`):**
```yaml
# Source: clone .github/workflows/actualidad-refresh.yml [VERIFIED: codebase]
name: digest-daily
on:
  schedule:
    - cron: "0 12 * * 1-5"   # L–V, AFTER the data crons (planner picks exact hour post-data)
  workflow_dispatch: {}
permissions: { contents: read }
concurrency: { group: digest-daily, cancel-in-progress: false }
jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@... (pinned SHA)
      - uses: pnpm/action-setup@... (pinned SHA)
      - uses: actions/setup-node@... with { node-version: "22", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - name: Send daily digest (EGRESO — no dos-etapas, no R2)
        env:
          SUPABASE_API_URL: ${{ secrets.SUPABASE_API_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}   # NEW secret — operator loads
        run: pnpm --filter @obs/notificaciones exec tsx src/run-digest-prod-cli.ts
```
- **GATED launch** like `roster-weekly.yml`: ship with `workflow_dispatch` only (schedule commented) until a manual green run; add schedule after validation.
- **`RESEND_API_KEY` is a NEW GH secret** (operator deuda, like `SUPABASE_PUBLISHABLE_KEY`). The CLI must degrade honestly (no send, log "RESEND_API_KEY missing → dry run") when absent — mirror the `@obs/dinero` dry-run precedent (.env.example §MERCADOPUBLICO_TICKET).

### Pattern 4: OTP Server Actions + subscription Server Actions on OpenNext

**What:** Reuse `spike-auth/actions.ts` verbatim in shape (validation-before-GoTrue, generic errors WR-02, gate fail-closed CR-01) for `/cuenta`. Add subscription actions that use the **user-session** client so RLS applies.
**Key rules (from Phase 97 + the spike code):**
- OTP: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` then `verifyOtp({ email, token, type: "email" })`. Cookie adapter writes Set-Cookie. `[VERIFIED: codebase — spike-auth/actions.ts]`
- Subscription toggle: build the user client with `createUserClient(cookieAdapter)` and `.from('suscripcion').insert(...)` / `.delete()`. Because the actor is the publishable-key session, **RLS enforces ownership** — the app never sets `user_id` from client input; the DB derives it from `auth.uid()` via the `with check`. Pass only `tipo` + `objetivo_id`; let the policy + a `user_id default` OR an explicit `user_id = (select auth.uid())`… **Prefer explicit insert of `user_id` = the session uid read server-side** (from `getClaims()`), matched by the `with check` — never trust a client-supplied user_id.
- **`export const dynamic = "force-dynamic"`** on `/cuenta` and read `searchParams` (Promise in Next 16) before any `notFound()` — the LOCKED Phase 45/102 gotcha to avoid a statically-baked route 500ing under dynamic content.
- **Validation before GoTrue** (WR-01) + **generic error** (WR-02, never echo email/token/GoTrue message) — copy the `validarEmail`/`validarToken` helpers.

### Pattern 5: Idempotent cursor (queue drained)

**What:** `notificacion_envio` records, per user, the watermark of novedades already sent, so re-running the cron never double-sends and a mid-run failure resumes cleanly.
**Design:** Per user, store `ultimo_evento_visto` (a monotonic key over novedades — e.g. the max `tramitacion_evento`/`actualidad_senal` id or timestamp included in the last digest). The cron: reads novedades `> ultimo_evento_visto` for the user's subscriptions; if any, sends; on send success writes an `envio` row + advances the cursor **atomically**. On failure, cursor unchanged → retried next run. This mirrors the cursor pattern already used by ingesta state tables (`*_ingesta_estado`, e.g. `0053_leylobby_cursor_estado.sql`). `[VERIFIED: codebase — cursor precedent exists]`
- **Hard cap interaction:** if the daily 100-cap is hit, remaining users' cursors are NOT advanced → their novedades stay queued for tomorrow (the honest-degrade copy: "quedan guardadas y llegan en el próximo resumen").

### Pattern 6: Opaque token (confirm + unsubscribe, login-less)

**What:** Two opaque tokens per subscription: a confirmation token (double opt-in) and an unsubscribe token. Both are random, non-derivable, non-JWT, and **stored hashed**.
**Design:**
```
// Source: standard node:crypto pattern [ASSUMED — verify no repo helper already exists]
const raw  = crypto.randomBytes(32).toString("base64url");     // goes in the email link
const hash = crypto.createHash("sha256").update(raw).digest("hex");  // stored in DB
// verify: hash the query-param token, look up by hash; constant-time compare not needed (hash lookup)
```
- Store `confirm_token_hash` / `baja_token_hash` (+ optional `expires_at` for confirm). The email link carries the **raw** token; the DB only ever holds the hash → a DB leak doesn't expose usable links.
- Landing routes (`/notificaciones/confirmar`, `/notificaciones/baja`) are **public, no login**, `robots: noindex`, use the **service_role** client (token lookup bypasses RLS by design — the token IS the authorization). One-click unsubscribe (GDPR / 21.719 requirement) — the link is the intent, no extra confirmation step.
- **List-Unsubscribe header** in the Resend send so mail clients surface a native unsubscribe: `headers: { "List-Unsubscribe": "<https://…/notificaciones/baja?t=RAW>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }`. `[CITED: Resend headers object supports custom headers]`

### Pattern 7: Consent record (Ley 21.719)

**What:** `consentimiento` row captures **fecha, versión del texto informado, método** at opt-in — the licitud evidence.
**Design:** Insert a `consentimiento` row (RLS `to authenticated`, owner-scoped) when the user confirms double opt-in, storing `version_texto` (the version string of the consent copy shown), `metodo` (e.g. `'doble_opt_in_email'`), `created_at`. The cron reads consent (service_role) and refuses to send to a subscription lacking a confirmed consent row. `/cuenta` shows "Consentimiento registrado el {fecha} · versión {v}" (UI-SPEC copy).

### Pattern 8: NOTIF flag + anti-flip guard (NOTIF-05)

**What:** `NOTIF_PUBLIC_ENABLED` deny-by-default flag gating the Seguir button (absent from DOM when OFF). Modeled byte-for-byte on `vsim-gate.ts` + `vsim-antiflip-guard.test.ts`.
**Design:**
- `app/lib/notif-gate.ts`: `export function notifPublicEnabled(env = process.env) { return env.NOTIF_PUBLIC_ENABLED === "true"; }` — single strict `=== "true"`, `import "server-only"`, no `NEXT_PUBLIC_` prefix.
- `.env.example`: `NOTIF_PUBLIC_ENABLED=false` (never `=true` committed).
- `app/lib/notif-antiflip-guard.test.ts`: clone `vsim-antiflip-guard.test.ts` — Vector 1 (single `=== "true"` path, no `||`/`Boolean`/`!== "false"`/`.trim()`/`NODE_ENV`), Vector 2 (`.env.example=false`), Vector 3 (no raw `NOTIF_PUBLIC_ENABLED` outside the chokepoint, scanning both `app/` and `packages/`), plus the in-memory mutation self-check.
- **DISTINCTION from VSIM/MONEY:** for those flags the flip is a *pending* operator deuda. For NOTIF, CONTEXT says the operator **PRE-AUTHORIZED the flip this run** — so the deploy ends with the flag ON. But the **guard still enforces** that `.env.example` stays `=false` and the agent never commits `=true`; the flip happens at deploy-time (wrangler env / deploy config), NOT in the committed `.env.example`. The anti-flip guard is unchanged in strictness; only the deploy step turns it on.
- The Seguir button render: `if (!notifPublicEnabled(process.env)) return null;` BEFORE any DOM/RPC (mirror `/comparar` ejeSimilitud at page.tsx:501-502).

### Anti-Patterns to Avoid

- **Trusting client-supplied `user_id`** on subscription insert → always derive from `auth.uid()` server-side and match with the RLS `with check`.
- **`grant … to authenticated` on a non-user table** → the new guard Block D bites; user tables are an explicit allowlist.
- **Two-stage / R2 for the digest** → EGRESO is one-way out; no crudo, no rate-limit. Applying ingesta rules here is wrong.
- **Resend SDK for one endpoint** → use fetch.
- **JWT/derivable unsubscribe tokens** → opaque random + hashed storage.
- **Logging the email address** anywhere (CI, cron stdout, R2) → redact to `<REDACTED>` / hash; the CI guard + code review enforce it.
- **`connect-src` CSP widening** → auth is server-side; browser never calls Supabase or Resend. CSP stays LOCKED.
- **basejump `tests.authenticate_as` in pgTAP** → not installed; use `set local role authenticated` + `set local request.jwt.claims`.
- **`notFound()` before reading `searchParams`** on `/cuenta` → bakes a static route → 500 (LOCKED gotcha).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row-ownership enforcement | App-layer `where user_id = …` checks | Postgres RLS `to authenticated` + `auth.uid()=user_id` | The DB is the boundary; app checks are bypassable and the whole point of NOTIF-01. |
| OTP session/refresh on Workers | Custom cookie/JWT handling | `@supabase/ssr` `updateSession` (Phase 97 LOCKED) | Already de-risked; hand-rolling reopens the exact risk Phase 97 closed. |
| Email delivery | Raw SMTP | Resend REST (`fetch`) | SPF/DKIM/deliverability/List-Unsubscribe handled by the provider. |
| Flag gating | Ad-hoc env reads | `notif-gate.ts` chokepoint + anti-flip guard (clone VSIM) | The anti-flip guard is the CI proof the agent can't flip; ad-hoc reads bypass it (Vector 3). |
| Idempotent cursor | Timestamps + hope | `notificacion_envio` watermark advanced atomically on send | Prevents double-send; matches existing `*_ingesta_estado` cursor precedent. |
| Opaque token | JWT / base64 of the id | `randomBytes` + sha256-hashed storage | Non-derivable, non-forgeable, leak-resistant. |

**Key insight:** Almost everything here has an in-repo precedent to clone (RLS migration 0043, anon-grant guard, VSIM flag+antiflip, actualidad EGRESO-style cron, ingesta cursor, spike OTP actions). The phase is **pattern-composition, not invention** — the highest-risk *novel* piece is the lockdown-guard's `authenticated` extension, which has no prior art and must be written red-first with a mutation self-check.

---

## Runtime State Inventory

> This is a greenfield-data phase (first user data) but it touches live provisioning + CI + deploy config, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No pre-existing user data (first user tables). `auth.users` is populated only by real OTP logins (operator test emails during SC2). | None — tables created fresh at 0069+. |
| Live service config | (1) Supabase Auth: Email provider ON + OTP template `{{ .Token }}` — operator, PENDING (Gate 0, non-blocking end). (2) Resend account + verified sending domain + API key — operator, NEW deuda. (3) Wrangler secrets: `SUPABASE_PUBLISHABLE_KEY` (pending from 97) + deploy-time `NOTIF_PUBLIC_ENABLED=true` (authorized flip). | Operator provisioning checkpoint at phase end (97-DEPLOY-RUNBOOK §"Estado runtime" + SC2 block). |
| OS-registered state | None. | None. |
| Secrets/env vars | NEW: `RESEND_API_KEY` (GH secret + .env local). `SUPABASE_PUBLISHABLE_KEY` (already in .env.example, value pending). `.env.example` gains `NOTIF_PUBLIC_ENABLED=false` + `RESEND_API_KEY=`. | Add to `.env.example`; operator loads real values. CLI degrades to dry-run if `RESEND_API_KEY` absent. |
| Build artifacts | New `@obs/notificaciones` package → `pnpm-lock.yaml` updates (workspace link only, no new external deps). `/spike-auth` deleted → its route disappears from the OpenNext build. | `pnpm install` to relink; verify build drops `/spike-auth`. |

**Nothing found for OS-registered state** — verified: no Task Scheduler / pm2 / systemd involvement; all cron is GH Actions.

---

## Common Pitfalls

### Pitfall 1: The lockdown-guard currently ALLOWS `to authenticated` — silent hole
**What goes wrong:** The existing guard forbids only `to anon`/`to public`. A migration could `grant all on some_pii_table to authenticated` and pass CI green. Because Phase 103 is the first to use `authenticated`, this hole is now reachable.
**Why it happens:** `anonGrantOffenders` regex targets `\b(anon|public)\b` after `to`; `authenticated` is invisible to it.
**How to avoid:** Land the guard extension (Pattern 2) as the **first commit**, with a positive `USER_OWNED_TABLES` allowlist + mutation self-check, BEFORE any 0069+ migration. This is literally NOTIF-02's mandate.
**Warning signs:** Any migration granting `authenticated` on a table not in the allowlist; any `.from('notificacion_envio')` in `app/`.

### Pitfall 2: RLS pgTAP passes but doesn't actually prove isolation
**What goes wrong:** A test that only runs as one user, or that runs as `postgres`/service_role (which bypasses RLS), reports green while proving nothing.
**Why it happens:** Forgetting `set local role authenticated` + a JWT-claims `sub`, or asserting counts as the superuser.
**How to avoid:** Two-user pattern with the tree idiom (see Validation Architecture): create two `auth.users`, `set local role authenticated` + `set local request.jwt.claims '{"sub":"<uid_A>","role":"authenticated"}'`, insert A's row, then switch claims to B and assert `is_empty` on A's row. `reset role` between blocks.
**Warning signs:** Test never sets `request.jwt.claims`; assertions run without `set local role authenticated`.

### Pitfall 3: Resend 100/day cap hit mid-run → silent drops or crash
**What goes wrong:** Blindly POSTing all pending emails hits the free-tier cap; Resend returns 429/quota error; remaining users silently lost or the cron crashes.
**Why it happens:** No in-code cap; relying on Resend to reject.
**How to avoid:** **Hard-cap in code** (count sends, stop at 100), leave un-sent users' cursors un-advanced (queued for tomorrow), and surface the honest-degrade copy. Handle 429 with the documented rate-limit (respect `retry-after` / the ~2 req/s default) — space sends. `[CITED: resend.com/docs/api-reference/rate-limit]`
**Warning signs:** Any run attempting >100 sends; cursor advanced despite a failed send.

### Pitfall 4: Email PII leaking to logs / CI / R2
**What goes wrong:** `console.log(user.email)` in the cron, an email echoed in an error, or a raw email written to R2/an artifact → PII breach under 21.719.
**Why it happens:** Debug logging; interpolating email into error messages (the exact thing WR-02 forbids for OTP).
**How to avoid:** Never log the raw email — log a hash or `<REDACTED>`. No R2 write in EGRESO at all. Reuse the generic-error discipline from `spike-auth/actions.ts`. Add a code-review checklist item + (optionally) a guard scanning the cron package for `console.*` with an email-shaped interpolation.
**Warning signs:** `console.log` referencing `.email`; any `@obs/notificaciones` write to R2.

### Pitfall 5: Server Action sets `user_id` from client input → RLS bypass illusion
**What goes wrong:** Inserting `user_id` from a hidden form field lets a crafted POST claim another user's id — and if a policy is mis-written (`using(true)`), it succeeds.
**Why it happens:** Trusting the request body; server actions accept any POST body (the spike code's WR-01 warning).
**How to avoid:** Derive `user_id` from the session (`getClaims()` sub) server-side; the RLS `with check ((select auth.uid()) = user_id)` is the backstop. Never accept a client `user_id`.
**Warning signs:** `user_id` appearing in `FormData` parsing; a `with check (true)`.

### Pitfall 6: pgTAP is the only proof the DDL ran — typecheck/vitest don't touch Postgres
**What goes wrong:** Assuming a green vitest suite means the RLS works. It doesn't — the guards are static file scans; RLS lives in Postgres.
**Why it happens:** Conflating the CI guard (static) with DB behavior.
**How to avoid:** Run the RLS pgTAP against an applied schema (`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f`), pre-apply (local) and post-apply (PROD), per the tree convention (0068 test header).
**Warning signs:** No `supabase/tests/0069_*.test.sql`; relying on vitest alone for NOTIF-01.

---

## Code Examples

### Two-user RLS isolation pgTAP (the tree idiom — NOT basejump helpers)
```sql
-- Source: synthesized from supabase/tests/0020 (set local role) + Supabase RLS-claims docs [VERIFIED: idiom] [CITED: supabase.com pgtap-extended]
begin;
select plan(6);

-- has_table / RLS enabled / policies exist (structural)
select has_table('public','suscripcion','suscripcion existe');
select is( (select relrowsecurity from pg_class where relname='suscripcion'), true, 'RLS on');

-- seed two auth users as superuser (bypasses RLS for setup)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a','a@test.local'),
  ('00000000-0000-0000-0000-00000000000b','b@test.local');

-- ACT AS USER A: insert A's subscription
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into suscripcion (user_id, tipo, objetivo_id)
  values ('00000000-0000-0000-0000-00000000000a','proyecto','14309-04');
select results_eq($$ select count(*)::int from suscripcion $$, $$ values (1) $$,
  'A ve su propia suscripcion');

-- SWITCH TO USER B: must NOT see A's row (isolation)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is_empty($$ select 1 from suscripcion $$, 'B NO ve la suscripcion de A (RLS aisla)');

-- B cannot delete A's row
select is_empty(
  $$ delete from suscripcion where objetivo_id='14309-04' returning 1 $$,
  'B NO puede borrar la fila de A');

reset role;
select is( has_table_privilege('anon','suscripcion','select'), false, 'anon SIN select'); -- deny-by-default

select * from finish();
rollback;
```

### notificacion_envio: authenticated has ZERO grant
```sql
-- Source: mirror of 0068 authenticated-privilege assertion [VERIFIED: codebase idiom]
select is( has_table_privilege('authenticated','notificacion_envio','select'), false,
  'authenticated SIN select sobre notificacion_envio (cola service_role-only)');
select is( has_table_privilege('authenticated','notificacion_envio','insert'), false,
  'authenticated SIN insert sobre notificacion_envio');
```

### Resend send via fetch (no SDK) with List-Unsubscribe
```typescript
// Source: resend.com/docs/api-reference/emails/send-email [CITED]
// email address REDACTED in every log line; RESEND_API_KEY absent => dry-run.
const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "Observatorio del Congreso 360 <resumen@dominio-verificado>",
    to: [destinatario],                 // never logged raw
    subject: `Tu resumen del Congreso · ${fecha}`,
    html, text,                          // multipart HTML + plain
    headers: {
      "List-Unsubscribe": `<${baseUrl}/notificaciones/baja?t=${rawBajaToken}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }),
});
// handle 429: respect rate limit (~2 req/s default free tier); stop at 100/day hard cap.
```

### NOTIF flag chokepoint (clone vsim-gate.ts)
```typescript
// Source: app/lib/vsim-gate.ts [VERIFIED: codebase]
import "server-only";
export function notifPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NOTIF_PUBLIC_ENABLED === "true";
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| anon key + RLS `to anon` for public reads | service_role server-side (Camino A) + publishable key for user sessions | Phase 42-43 (0043/0044) | User tables must use `authenticated` (new role for the guard); anon is dead (0044). |
| `middleware.ts` (Next ≤15) | Next 16 renames to `proxy` (Node-only) — repo STAYS on deprecated `middleware.ts` (Edge) | Next 16 / Phase 97 | Deprecation warning is EXPECTED; never migrate to `proxy` (OpenNext rejects Node middleware). |
| basejump `tests.authenticate_as` helpers | raw `set local role` + `request.jwt.claims` | project convention | Do NOT introduce the helper extension; match the tree. |
| Resend legacy 100/day | Free tier now 3,000/mo with **100/day** cap | 2024+ | 100/day is the operative hard cap; code-cap to it. |

**Deprecated/outdated:**
- `/spike-auth` route: superseded by `/cuenta` — DELETE it (CONTEXT).
- `docs/deploy-cloudflare.md`: STALE (anon-key era) — follow 97-DEPLOY-RUNBOOK instead.
- `SUPABASE_ANON_KEY` in .env.example: legacy/dead for reads; user sessions use `SUPABASE_PUBLISHABLE_KEY`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomBytes(32).toString('base64url')` + sha256 is an acceptable opaque-token shape and no repo helper already exists for this | Pattern 6 | Low — standard; planner should grep for an existing token util before writing one. |
| A2 | Resend `headers` object honors `List-Unsubscribe` / `List-Unsubscribe-Post` as arbitrary custom headers | Pattern 6, Code Examples | Medium — docs confirm a `headers` object for customization but don't show this exact header; verify against a live send in the SC checkpoint. |
| A3 | Resend free-tier default rate limit is ~2 req/s (some accounts 10 req/s); 100/day cap is current | Standard Stack, Pitfall 3 | Low-Medium — cited from Resend docs 2026; the code hard-cap at 100 is safe regardless. |
| A4 | `auth.users(id)` FK + `on delete cascade` is permitted for user-owned tables (Supabase allows referencing `auth.users`) | Pattern 1 | Low — standard Supabase pattern; confirm FK grant in the migration. |
| A5 | The exact hour of the digest cron (post-data-cron) is planner discretion; data crons finish before 12 UTC | Pattern 3 | Low — sequencing detail; adjust to observed data-cron completion. |
| A6 | A verified sending domain exists / will be provisioned at Resend for the `from` address | Standard Stack, Runtime Inventory | Medium — operator deuda; without it Resend rejects sends. Flag in the operator checkpoint. |

**If any A2/A6 assumption fails at the SC checkpoint, the flag stays OFF and the phase closes with a documented handoff (NOTIF-05 fallback), exactly as CONTEXT permits.**

---

## Open Questions

1. **Exact "novedad" source for the digest cursor**
   - What we know: subscriptions target proyecto or parlamentario; novedades live in `actualidad_senal` and `tramitacion_evento`.
   - What's unclear: the precise join from a `parlamentario` subscription to "its novedades" (via authored proyectos? votes? citaciones?) vs a `proyecto` subscription (its tramitacion_evento).
   - Recommendation: Plan a small SPIKE/query-design task defining the novedad query per subscription type; keep it factual (fuente+fecha) and reuse RPCs where possible. Start with `proyecto → tramitacion_evento since cursor` (clearest) and `parlamentario → their authored proyectos' events`.

2. **Where the flip to `NOTIF_PUBLIC_ENABLED=true` is applied at deploy**
   - What we know: `.env.example` stays `=false`; the flip is authorized this run.
   - What's unclear: whether the deploy sets it via `wrangler secret`/env or the OpenNext deploy config.
   - Recommendation: Set as a Worker env var (not a secret — it's a boolean feature flag, like the .env.example note for MONEY). Document in the deploy step; the anti-flip guard remains green because `.env.example` is untouched.

3. **Does the operator's Resend account already have a verified domain?**
   - Recommendation: Surface as the first line of the operator checkpoint alongside `RESEND_API_KEY`; without it, dry-run only.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Auth (GoTrue, Email OTP) | NOTIF-01 login | Provisioning PENDING (Gate 0) | project bctyygbmqcvizyplktuw | Build proceeds; SC2 evidence deferred to operator (non-blocking). |
| `SUPABASE_PUBLISHABLE_KEY` | user session | ✗ (in .env.example, value pending) | — | middleware fail-open; `/cuenta` fail-loud 500 until loaded (isolated, like `/spike-auth`). |
| Resend account + API key + verified domain | NOTIF-03 send | ✗ (new deuda) | — | CLI dry-run (no send) when `RESEND_API_KEY` absent — degrade honestly. |
| `SUPABASE_SECRET_KEY` / `SUPABASE_API_URL` | cron service_role | ✓ (loaded in Cuchecorp/gov-map) | — | — |
| Postgres (DDL via `SUPABASE_DB_URL`) | migrations + pgTAP | ✓ (per env-credentials memory) | Postgres 15+ | — |
| Docker + wrangler (deploy) | final deploy | ✓ (per 97-DEPLOY-RUNBOOK) | node:22-slim | — |

**Missing dependencies with no fallback:** none block the *build* (CONTEXT makes provisioning a non-blocking end checkpoint).
**Missing dependencies with fallback:** publishable key (fail-open middleware / isolated 500), Resend key (dry-run), OTP template (SC2 deferred).

---

## Validation Architecture

> Nyquist: each success criterion has an automated or evidence-based validator. `workflow.nyquist_validation` treated as enabled (no config override read to false).

### Test Framework
| Property | Value |
|----------|-------|
| Framework (app + packages) | vitest `^3.0.0` |
| DDL/RLS framework | pgTAP via `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/00XX_*.test.sql` |
| Config file | `app/vitest.config.ts` (app); per-package vitest |
| Quick run command | `pnpm --filter ./app test -- --run` (CI guards) |
| Full suite command | `pnpm --filter ./app test -- --run && pnpm --filter ./app exec tsc --noEmit` (mirrors ci.yml) |
| Package tests | `pnpm --filter @obs/notificaciones test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command / Evidence | File Exists? |
|--------|----------|-----------|------------------------------|--------------|
| NOTIF-01 | RLS: A cannot see/modify B's rows; anon denied; deny-by-default | pgTAP (two-user) | `psql … -f supabase/tests/0069_suscripcion_rls.test.sql` | ❌ Wave 0 |
| NOTIF-01 | Subscribe/unsubscribe toggle via user session | vitest (Server Action, mocked user client) | `pnpm --filter ./app test` | ❌ Wave 0 |
| NOTIF-02 | Guard extended to `authenticated`; allowlist + mutation self-check BITES | vitest (CI guard, in-memory fixtures) | `pnpm --filter ./app test -- --run` (extended `lockdown-guard.test.ts`) | ⚠️ extend existing |
| NOTIF-02 | `notificacion_envio` zero `authenticated` grant | pgTAP + guard | `psql … -f supabase/tests/0070_notificacion_envio.test.sql` | ❌ Wave 0 |
| NOTIF-03 | Digest groups novedades; cursor idempotent (no double-send on re-run) | vitest (`@obs/notificaciones` unit, in-memory) | `pnpm --filter @obs/notificaciones test` | ❌ Wave 0 |
| NOTIF-03 | Hard-cap 100/day; over-cap users stay queued | vitest (unit, fake queue >100) | `pnpm --filter @obs/notificaciones test` | ❌ Wave 0 |
| NOTIF-03 | EGRESO cron shape (dispatch-only launch, secrets, no R2) | manual green `workflow_dispatch` + doc | GH Actions run log (email REDACTED) | ❌ Wave 0 |
| NOTIF-04 | Double opt-in / unsubscribe via opaque token, no login | vitest (route handler, token hash lookup) + curl on deploy | `pnpm test` + `curl /notificaciones/baja?t=…` | ❌ Wave 0 |
| NOTIF-04 | Consent record written (fecha/versión/método) | pgTAP + vitest | `psql … -f supabase/tests/0071_consentimiento.test.sql` | ❌ Wave 0 |
| NOTIF-04 | Email PII never logged raw | vitest guard (scan cron pkg for email-in-log) + code review | `pnpm --filter @obs/notificaciones test` | ❌ Wave 0 |
| NOTIF-05 | NOTIF flag deny-by-default + anti-flip (3 vectors + self-check) | vitest (clone `vsim-antiflip-guard.test.ts`) | `pnpm --filter ./app test -- --run` | ❌ Wave 0 |
| NOTIF-05 | Seguir button ABSENT from DOM when flag OFF | vitest (RTL, inject `NOTIF_PUBLIC_ENABLED` unset) + BrowserOS on deploy | `pnpm test` + BrowserOS DOM check | ❌ Wave 0 |
| NOTIF-05 | Legal dossier 21.719 (DPA/licitud/ARCO-P/retención) + signoff | doc review | `docs/legal/103-LEGAL-DOSSIER-NOTIF.md` (byte-check, signoff recorded) | ❌ Wave 0 |
| AUTH pipeline | SC2 end-to-end (Set-Cookie + refresh) | curl evidence (operator checkpoint) | 97-SPIKE-EVIDENCE §Reproducción SC2 block (REDACTED) | evidence-only |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test -- --run` (CI guards + antiflip + lockdown) — fast static scans, <30s.
- **Per migration:** the matching `supabase/tests/00XX_*.test.sql` pgTAP against local applied schema (pre-apply), then PROD (post-apply).
- **Per wave merge:** full app suite + `tsc --noEmit` + `@obs/notificaciones` package tests.
- **Phase gate:** full suite + all pgTAP green + guard suite green + dossier signoff recorded + (operator) SC2 evidence + manual green digest dispatch + BrowserOS DOM check (flag OFF ⇒ Seguir absent; flag ON ⇒ present).

### Wave 0 Gaps
- [ ] `supabase/tests/0069_suscripcion_rls.test.sql` — two-user isolation (NOTIF-01)
- [ ] `supabase/tests/0070_notificacion_envio.test.sql` — authenticated zero-grant (NOTIF-02)
- [ ] `supabase/tests/0071_consentimiento.test.sql` — consent shape (NOTIF-04)
- [ ] Extend `app/lib/lockdown-guard.test.ts` — Block D/E + `authenticatedGrantOffenders` self-check (NOTIF-02, first commit)
- [ ] `app/lib/notif-gate.ts` + `app/lib/notif-antiflip-guard.test.ts` (NOTIF-05, clone VSIM)
- [ ] `packages/notificaciones/` unit tests — cursor idempotency, 100-cap, PII-redaction, token hash (NOTIF-03/04)
- [ ] `app/app/cuenta/*` + `notificaciones/{confirmar,baja}` route/action tests (NOTIF-01/04)
- [ ] Seguir-button RTL test (flag OFF ⇒ null) (NOTIF-05)

---

## Security Domain

> `security_enforcement` treated as enabled (absent in config = enabled). This phase is the highest-PII-sensitivity phase to date (first user emails).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth OTP (GoTrue); validation-before-GoTrue; generic errors (no enumeration, WR-02). |
| V3 Session Management | yes | `@supabase/ssr` HttpOnly/Secure/SameSite=Lax cookies; Edge refresh; fail-open middleware. |
| V4 Access Control | yes | RLS `to authenticated` + `auth.uid()=user_id` deny-by-default; service_role isolated to cron; opaque token = capability for login-less unsubscribe. |
| V5 Input Validation | yes | `validarEmail`/`validarToken` regex + length; `tipo`/`objetivo_id` CHECK constraints + server-side validation; PARLAMENTARIO_ID_RE / boletín format before any query. |
| V6 Cryptography | yes | Opaque tokens via `node:crypto` `randomBytes` + sha256 hashed at rest; never hand-roll; no JWT for unsubscribe. |
| V7 Error/Logging | yes | Email/token NEVER in logs (redact); no GoTrue message interpolation; no R2 write in EGRESO. |
| V9 Data Protection (Ley 21.719) | yes | Consent record (licitud); double opt-in; one-click unsubscribe (ARCO-P); retention policy in dossier; DPA with Resend (subencargado). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OTP relay abuse (send to third-party email) | Spoofing / Abuse | Flag-gated surfaces; validation; real user tables (not spike auto-create loosely). Rate-limit is Supabase SMTP (2/hr) + Resend cap. |
| Cross-user data access (see B's subscriptions) | Information Disclosure | RLS `auth.uid()=user_id`; two-user pgTAP proves it. |
| Client-forged `user_id` on insert | Tampering / EoP | Derive user_id server-side from `auth.uid()`; `with check` backstop. |
| Unsubscribe token forgery/enumeration | Tampering | Opaque 256-bit random, hashed at rest, non-derivable. |
| Email PII leak (logs/CI/R2) | Information Disclosure | Redaction everywhere; no R2 egress; CI/code-review guard. |
| Feature flip without legal signoff | (governance) | Anti-flip guard (3 vectors + self-check); `.env.example=false`; flip is deploy-time + dossier signoff. |
| `authenticated` over-grant to non-user table | EoP | Lockdown-guard Block D allowlist (NOTIF-02, first commit). |
| CSP widening for auth/email | (integrity) | Auth server-side only; browser never calls Supabase/Resend; `connect-src 'self'` LOCKED. |

### Dossier scope (NOTIF-05 — `docs/legal/103-LEGAL-DOSSIER-NOTIF.md`)
- **DPA / subencargado:** Resend as data processor (email addresses transferred for delivery).
- **Base de licitud:** consent (double opt-in), recorded in `consentimiento` (fecha/versión/método).
- **Derechos ARCO-P:** unsubscribe (one-click, login-less) + preference center in /cuenta; deletion via `on delete cascade` / account removal.
- **Retención:** define retention of `notificacion_envio` logs and unsubscribed rows.
- **Signoff:** operator (abogado) PRE-AUTHORIZED 2026-07-26 this run — record verbatim as `signoff: approved` in the dossier (agent documents; operator authorizes). Clone the structure of `docs/legal/102-LEGAL-DOSSIER-VSIM.md`.

---

## Project Constraints (from CLAUDE.md)

- **Ingesta two-stage rule does NOT apply to EGRESO** — MUST document the difference (Pattern 3). No R2 crudo, no rate-limit 2–3s/host, no robots.txt for the digest cron; the "respectful ingestion" rules govern *incoming* gov sources, not *outgoing* email.
- **Secrets in `.env`** — `RESEND_API_KEY` + `SUPABASE_PUBLISHABLE_KEY` in `.env` (local) and GH/wrangler; never committed; `.env.example` gets the keys with empty values + the `NOTIF_PUBLIC_ENABLED=false` boolean.
- **TypeScript/Deno-or-Node single language** — the package is TS run via `tsx` (Node 22 in GH Actions), matching every existing cron package.
- **Next.js 16 App Router, Server Components default, all external calls server-only** — auth + Resend calls are server-side; browser never calls either. `AGENTS.md`: read `node_modules/next/dist/docs/` before writing Next code (heed the `middleware`→`proxy` deprecation — stay on `middleware.ts`).
- **GSD workflow enforcement** — this is planned phase work under `/gsd:execute-phase`.
- **Anti-insinuación linter** — NOTIF surfaces must be registered in `SUPERFICIES_*` BEFORE any copy (UI-SPEC §Copywriting); digest copy is factual, fuente+fecha per item, never promises instantaneity.
- **CC BY 4.0 attribution** visible (email footer per UI-SPEC).

---

## Sources

### Primary (HIGH confidence)
- Codebase (read this session): `app/middleware.ts`, `app/lib/supabase-user.ts`, `app/app/spike-auth/actions.ts`, `app/lib/spike-auth-gate.ts`, `app/lib/vsim-gate.ts`, `app/lib/vsim-antiflip-guard.test.ts`, `app/lib/lockdown-guard.test.ts`, `supabase/migrations/0043_lockdown_web_reader.sql`, `supabase/tests/0020_parlamentario_publico.test.sql`, `supabase/tests/0068_coincidencia_votos_par.test.sql`, `.github/workflows/{ci,roster-weekly,actualidad-refresh}.yml`, `app/app/comparar/page.tsx`, `.env.example`, `packages/actualidad/package.json`, `.planning/REQUIREMENTS.md`, `97-{FALLBACK-NOTIF-103,SPIKE-EVIDENCE,DEPLOY-RUNBOOK}.md`, `103-{CONTEXT,UI-SPEC}.md`.
- CLAUDE.md project instructions (stack, conventions, ingesta LOCKED rules).

### Secondary (MEDIUM confidence)
- [Resend — Send Email API](https://resend.com/docs/api-reference/emails/send-email) — endpoint, auth header, `headers` object, batch note.
- [Resend — Rate Limit](https://resend.com/docs/api-reference/rate-limit) — free tier 100/day, default rate limit.
- [Resend — Batch Emails API](https://resend.com/blog/introducing-the-batch-emails-api) — up to 100/call (alternative, not chosen).
- [Supabase — Advanced pgTAP Testing](https://supabase.com/docs/guides/local-development/testing/pgtap-extended) — RLS test patterns (note: repo uses raw `set local role`, not the basejump helpers shown there).

### Tertiary (LOW confidence — flagged for validation)
- `node:crypto` opaque-token shape (A1) — standard, but confirm no repo helper exists.
- Exact `List-Unsubscribe` acceptance by Resend `headers` object (A2) — verify at SC checkpoint.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — auth/DB/cron all reuse in-tree, version-pinned patterns; Resend surface MEDIUM (docs-verified, not exercised).
- Architecture: HIGH — every pattern has an in-repo precedent to clone; the one novel piece (authenticated guard extension) is fully specified against the existing guard file.
- Pitfalls: HIGH — derived directly from the guard code, the spike security notes, and the LOCKED gotchas.
- Security/legal: HIGH on controls; the dossier is an operator-signoff artifact (pre-authorized).

**Research date:** 2026-07-26
**Valid until:** ~2026-08-25 (30 days; Resend API surface is the only externally-moving part — re-verify the send endpoint + rate limit before implementing if later).
