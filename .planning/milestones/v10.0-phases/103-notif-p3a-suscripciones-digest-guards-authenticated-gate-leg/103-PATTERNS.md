# Phase 103: NOTIF P3a — Suscripciones + digest + guards authenticated + gate legal - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18 (1 no-analog: EGRESO cron package internals — closest partial match documented)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/lib/lockdown-guard.test.ts` (MODIFY) | test/guard | transform (static scan) | *itself* (extend `anonGrantOffenders`/`definedRpcNames` machinery) | exact (self-extend) |
| `supabase/migrations/0069_suscripcion_rls.sql` | migration | CRUD (RLS) | `supabase/migrations/0043_lockdown_web_reader.sql` (RLS+policy idiom) | role-match (policy shape; new `to authenticated`) |
| `supabase/migrations/0070_notificacion_envio.sql` | migration | event-driven (queue/cursor) | `0043` (grants idiom) + `0053_leylobby_cursor_estado` (cursor) | role-match |
| `supabase/migrations/0071_consentimiento.sql` | migration | CRUD (RLS) | `0069` (own new sibling) / `0043` | role-match |
| `supabase/tests/0069_suscripcion_rls.test.sql` | test (pgTAP) | request-response | `supabase/tests/0065_actualidad_senal.test.sql` (structure) + RESEARCH two-user idiom | role-match |
| `supabase/tests/0070_notificacion_envio.test.sql` | test (pgTAP) | request-response | `0065` + `has_table_privilege` assertions | role-match |
| `supabase/tests/0071_consentimiento.test.sql` | test (pgTAP) | request-response | `0069` sibling / `0065` | role-match |
| `app/lib/notif-gate.ts` | config (flag chokepoint) | request-response | `app/lib/vsim-gate.ts` | exact |
| `app/lib/notif-antiflip-guard.test.ts` | test/guard | transform (static scan) | `app/lib/vsim-antiflip-guard.test.ts` | exact |
| `app/app/cuenta/actions.ts` | controller (Server Actions) | request-response | `app/app/spike-auth/actions.ts` | exact (OTP) + new subscription actions |
| `app/app/cuenta/page.tsx` | component (RSC) | request-response | `app/app/comparar/page.tsx` (gate+force-dynamic+searchParams) | role-match |
| `app/app/notificaciones/confirmar/page.tsx` | route (public RSC, token) | request-response | `app/app/comparar/page.tsx` (RSC shape) — token lookup novel | partial |
| `app/app/notificaciones/baja/page.tsx` | route (public RSC, token) | request-response | same as confirmar | partial |
| `app/components/seguir-button.tsx` | component | request-response | gate pattern from `comparar/page.tsx:501-502` (`return null` before render) | role-match |
| `packages/notificaciones/package.json` | config | — | `packages/actualidad/package.json` | exact |
| `packages/notificaciones/src/run-digest-prod-cli.ts` + `resend.ts` + `digest.ts` | service (EGRESO) | event-driven / batch / streaming out | `packages/actualidad/src/run-actualidad-prod-cli.ts` (shape) — Resend send novel | partial |
| `.github/workflows/digest-daily.yml` | config (cron) | event-driven | `.github/workflows/actualidad-refresh.yml` | exact |
| `docs/legal/103-LEGAL-DOSSIER-NOTIF.md` | doc | — | `docs/legal/102-LEGAL-DOSSIER-VSIM.md` | role-match |

---

## Pattern Assignments

### `app/lib/lockdown-guard.test.ts` (MODIFY — test/guard, transform) — FIRST COMMIT (NOTIF-02)

**Analog:** the file extends ITSELF. The existing machinery is the exact clone target — do NOT rewrite, ADD Block D/E next to the existing `(A)`/`(A2)` blocks.

**Machinery to clone — `anonGrantOffenders` (lockdown-guard.test.ts:222-230):**
```typescript
function anonGrantOffenders(strippedLowerSql: string): string[] {
  const offenders: string[] = [];
  const grantToAnon = /grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\b(anon|public)\b/;
  for (const stmt of strippedLowerSql.split(";")) {
    if (!grantToAnon.test(stmt)) continue;
    offenders.push(stmt.trim().replace(/\s+/g, " ").slice(0, 100));
  }
  return offenders;
}
```
Clone as `authenticatedGrantOffenders(strippedLowerSql, allowlist)`: swap `(anon|public)` → `authenticated`, then INVERT to a positive allowlist — a `grant/create policy … to authenticated` on a table NOT in `USER_OWNED_TABLES` is the offender. Extract the target table name per statement to check membership.

**Allowlist constant to add (mirror the existing `PII_TABLES` / `PUBLIC_RPC_ALLOWLIST` const style, lines 133 / 165):**
```typescript
const USER_OWNED_TABLES = new Set(["suscripcion", "consentimiento"]);
// NOT notificacion_envio — service_role-only queue (Block E).
```

**Mutation self-check idiom to clone — `definedRpcNames` + `parseDefinedRpcNames` self-check (lines 376-430):** the existing Direction-B block proves the detector BITES using an in-memory fixture with the REAL regex object. Replicate exactly: exercise `authenticatedGrantOffenders` on three fixtures:
- (a) `grant select on public.proyecto to authenticated;` → offender (not user-owned)
- (b) `grant insert on public.notificacion_envio to authenticated;` → offender (Block E)
- (c) `create policy x on suscripcion for select to authenticated using (...);` → NOT offender (allowlisted)

**`.from()` scan reuse (Block B, lines 505-527):** the existing `walkSourceFiles(APP_ROOT)` + `PII_TABLES` `.from()` scan is the template. Add an assertion that the service_role chokepoint `app/lib/supabase.ts` never does `.from('suscripcion'|'consentimiento'|'notificacion_envio')`, and that `app/` never does `.from('notificacion_envio')` (cron-only table).

**Sequencing (RESEARCH §Pattern 2):** write RED first — it must fail if a later 0069+ migration grants `authenticated` outside the allowlist. Land BEFORE any migration.

---

### `supabase/migrations/0069_suscripcion_rls.sql` (migration, CRUD/RLS)

**Analog:** `supabase/migrations/0043_lockdown_web_reader.sql` (RLS + `create policy … for select to <role> using` idiom, drop-if-exists idempotency, `enable row level security`). NEW element vs 0043: `to authenticated` + `auth.uid()=user_id` (0043 uses `to web_reader using (true)`).

**Policy shape (from RESEARCH §Pattern 1, verified against 0043 policy idiom):**
```sql
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
create policy suscripcion_select_own on suscripcion
  for select to authenticated using ( (select auth.uid()) = user_id );
create policy suscripcion_insert_own on suscripcion
  for insert to authenticated with check ( (select auth.uid()) = user_id );
create policy suscripcion_delete_own on suscripcion
  for delete to authenticated using ( (select auth.uid()) = user_id );
-- NO grant to anon/public/web_reader. service_role bypasses RLS.
```

**Migration header + apply convention (clone 0043 header block, lines 1-41):** BIG banner comment, `-- APLICACIÓN: psql "$SUPABASE_DB_URL" --single-transaction -f …` with `PGCLIENTENCODING=UTF8`, and the closing `-- insert into schema_migrations (version) values ('0069');` note (0043:274-276).

**Deny-by-default note:** anon/web_reader receive NO policy → 0 rows (mirror 0043's PII-tables comment lines 135-137). `(select auth.uid())` wrapper (not bare) per RESEARCH init-plan optimization.

---

### `supabase/migrations/0070_notificacion_envio.sql` (migration, event-driven queue/cursor)

**Analog:** `0043` (grants idiom) for the ZERO-grant assertion; cursor precedent is the `*_ingesta_estado` tables (RESEARCH cites `0053_leylobby_cursor_estado.sql`). Table is `enable row level security` with NO `to authenticated` policy at all — service_role-only.

**Key excerpt (the invariant the guard Block E + pgTAP both enforce):**
```sql
alter table notificacion_envio enable row level security;
-- NO policy for authenticated, NO grant to authenticated (queue is service_role-only).
-- Per-user idempotent cursor column (ultimo_evento_visto) advanced atomically on send.
```

---

### `supabase/migrations/0071_consentimiento.sql` (migration, CRUD/RLS — Ley 21.719)

**Analog:** `0069` sibling shape. RLS `to authenticated` insert own + service_role read (cron confirms licitud). Columns `version_texto`, `metodo` (e.g. `'doble_opt_in_email'`), `created_at` (RESEARCH §Pattern 7).

---

### `supabase/tests/0069_suscripcion_rls.test.sql` (test/pgTAP, two-user isolation)

**Analog:** `supabase/tests/0065_actualidad_senal.test.sql` for the file structure (header block explaining what's asserted, `begin; select plan(N); … select * from finish(); rollback;`). The two-user RLS idiom is NOT in an existing test yet — use RESEARCH §Code Examples (the tree `set local role authenticated` + `set local request.jwt.claims` idiom, NOT basejump `tests.authenticate_as` which is NOT installed).

**Structural header + wrapper (clone 0065 style, lines 1-31):**
```sql
-- 0069_suscripcion_rls.test.sql
-- Verifica RLS user-owned (A no ve B) CONTRA UN SCHEMA APLICADO. Corre vía `psql -tA -f`.
-- build/typecheck NO prueban que el DDL se aplicó (Pitfall 5). Espeja 0065 style.
begin;
select plan(6);
```

**Two-user isolation core (from RESEARCH §Code Examples — the LOCKED idiom for this repo):**
```sql
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a','a@test.local'),
  ('00000000-0000-0000-0000-00000000000b','b@test.local');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into suscripcion (user_id, tipo, objetivo_id)
  values ('00000000-0000-0000-0000-00000000000a','proyecto','14309-04');
select results_eq($$ select count(*)::int from suscripcion $$, $$ values (1) $$, 'A ve su propia suscripcion');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is_empty($$ select 1 from suscripcion $$, 'B NO ve la suscripcion de A (RLS aisla)');
reset role;
select is( has_table_privilege('anon','suscripcion','select'), false, 'anon SIN select');
```
**Pitfall 2 (RESEARCH):** never assert as `postgres`/service_role (bypasses RLS → green no-op). Always `set local role authenticated` + JWT claims.

---

### `supabase/tests/0070_notificacion_envio.test.sql` (test/pgTAP, zero-grant)

**Analog:** same 0065 wrapper. Core assertions from RESEARCH §Code Examples (mirror the 0068 `has_table_privilege` idiom):
```sql
select is( has_table_privilege('authenticated','notificacion_envio','select'), false,
  'authenticated SIN select sobre notificacion_envio (cola service_role-only)');
select is( has_table_privilege('authenticated','notificacion_envio','insert'), false,
  'authenticated SIN insert sobre notificacion_envio');
```

---

### `app/lib/notif-gate.ts` (config, flag chokepoint) — NOTIF-05

**Analog:** `app/lib/vsim-gate.ts` (byte-for-byte, swap VSIM→NOTIF).

**Full excerpt to clone (vsim-gate.ts:33-37 + `import "server-only"` line 1):**
```typescript
import "server-only";
export function notifPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NOTIF_PUBLIC_ENABLED === "true";
}
```
Keep the JSDoc chokepoint doctrine (vsim-gate.ts:3-32): single `=== "true"`, no `NEXT_PUBLIC_`, ausencia = OFF (NOT throw), flag is the ONLY reader of `NOTIF_PUBLIC_ENABLED`. **DISTINCTION (RESEARCH §Pattern 8):** for VSIM the flip is pending operator deuda; for NOTIF the operator PRE-AUTHORIZED the flip this run — but `.env.example` STAYS `=false` and the flip happens at deploy-time (Worker env var), never committed.

---

### `app/lib/notif-antiflip-guard.test.ts` (test/guard) — NOTIF-05

**Analog:** `app/lib/vsim-antiflip-guard.test.ts` (byte-for-byte, swap VSIM→NOTIF). This is the single richest clone target — reuse ALL of it.

**Clone wholesale:** `stripTsComments` (lines 54-64), `walkSourceFiles`+`SKIP_DIRS` (73-114), `RAW_ENV_ALLOWLIST` (122-131) with rel `lib/notif-gate.ts`, `detectarRelajacionGate` (149-224) V1a-V1d + V2a/V2b, `detectarRawEnvEnRuta` (231-235), the three describe blocks (Vector 1/2/3 scanning BOTH `app/` and `packages/`), and the §4 mutation self-check (337-434).

**Env target to add to `.env.example`:** `NOTIF_PUBLIC_ENABLED=false` in the flags section (after VSIM block at line 82 — mirror the VSIM comment block lines 72-82).

---

### `app/app/cuenta/actions.ts` (controller, Server Actions) — NOTIF-01

**Analog:** `app/app/spike-auth/actions.ts` (OTP send/verify verbatim in shape). The `/spike-auth` route is DELETED; its actions.ts is the template for `/cuenta`.

**OTP validation helpers to clone (spike-auth/actions.ts:34-56):**
```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const OTP_RE = /^\d{6}$/;
function validarEmail(email: unknown): string {
  if (typeof email !== "string") throw new Error("cuenta: email inválido");
  const limpio = email.trim();
  if (limpio.length === 0 || limpio.length > EMAIL_MAX || !EMAIL_RE.test(limpio))
    throw new Error("cuenta: email inválido"); // NUNCA echar el valor (WR-02)
  return limpio;
}
```

**Cookie adapter + user client (spike-auth/actions.ts:59-72):**
```typescript
async function clienteConCookies() {
  const cookieStore = await cookies();
  return createUserClient({
    getAll() { return cookieStore.getAll(); },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
    },
  });
}
```

**OTP flow (spike-auth/actions.ts:79-132):** gate fail-closed FIRST (`if (!notifPublicEnabled(process.env)) throw`), then validate BEFORE GoTrue (WR-01), `signInWithOtp({ email, options: { shouldCreateUser: true } })` / `verifyOtp({ email, token, type: "email" })`, generic error, NEVER interpolate GoTrue message/email/token (WR-02) — log only `{ status, name }`.

**NEW — subscription actions (RESEARCH §Pattern 4 + Pitfall 5):** `seguir`/`dejarDeSeguir` build `createUserClient(cookieAdapter)` (user session → RLS applies), read `user_id` from `getClaims()` sub server-side (NEVER from client FormData), `.from('suscripcion').insert({ user_id, tipo, objetivo_id })` / `.delete()`. The RLS `with check ((select auth.uid()) = user_id)` is the backstop.

---

### `app/app/cuenta/page.tsx` (component/RSC) — NOTIF-01

**Analog:** `app/app/comparar/page.tsx` for the LOCKED gotchas: `export const dynamic = "force-dynamic"` and reading `searchParams` (Promise in Next 16) BEFORE any `notFound()` (RESEARCH §Pattern 4, LOCKED Phase 45/102). Gate the subscription surfaces via `notifPublicEnabled(process.env)`.

---

### `app/app/notificaciones/{confirmar,baja}/page.tsx` (route, public token, no login) — NOTIF-04

**Analog:** partial — `app/app/comparar/page.tsx` gives the RSC + gate shape, but the opaque-token lookup (public, no session, `robots: noindex`, service_role client) is NOVEL (no in-repo analog). Use RESEARCH §Pattern 6:
```typescript
const raw  = crypto.randomBytes(32).toString("base64url");     // in the email link
const hash = crypto.createHash("sha256").update(raw).digest("hex");  // stored in DB
// verify: hash the query-param token, look up by hash (service_role bypasses RLS; token IS the auth)
```
One-click unsubscribe (link = intent, no extra confirm). `robots: noindex`. Service_role client = `app/lib/supabase.ts` (the existing service_role chokepoint) — but note the guard forbids `.from('suscripcion')` from there; the token lookup must use a dedicated helper or an RPC, coordinate with the lockdown-guard Block D/E allowlist decision.

---

### `app/components/seguir-button.tsx` (component) — NOTIF-05

**Analog:** the gate-before-render idiom from `comparar/page.tsx:501-502`:
```typescript
let ejeSimilitud: React.ReactNode = null;
if (vsimPublicEnabled(process.env)) { … }  // return null BEFORE any DOM/RPC
```
For the button: `if (!notifPublicEnabled(process.env)) return null;` as the FIRST statement (flag OFF ⇒ absent from DOM, not CSS-hidden). Placement: ficha proyecto (`app/app/proyecto/[boletin]/page.tsx`) and ficha parlamentario (`app/app/parlamentario/[id]/page.tsx`). `aria-pressed` for toggle state.

---

### `packages/notificaciones/package.json` (config)

**Analog:** `packages/actualidad/package.json` (exact clone).
```json
{
  "name": "@obs/notificaciones",
  "version": "0.0.0", "private": true, "type": "module",
  "main": "src/index.ts", "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc -b", "run-prod": "tsx src/run-digest-prod-cli.ts" },
  "dependencies": { "@supabase/supabase-js": "^2.108.2" },
  "devDependencies": { "@types/node": "^20.19.43", "tsx": "^4.22.4", "vitest": "^3.0.0" }
}
```
**NO Resend SDK** — email send = global `fetch` (Node 22); token = built-in `node:crypto` (RESEARCH §Standard Stack). Also copy `tsconfig.json` + `vitest.config.ts` from `packages/actualidad`.

---

### `packages/notificaciones/src/{run-digest-prod-cli.ts,resend.ts,digest.ts}` (service, EGRESO)

**Analog:** partial — `packages/actualidad/src/run-actualidad-prod-cli.ts` gives the CLI shape (service_role client from `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY`, `index.ts` barrel, `kmeans.test.ts` unit-test pattern). Resend send is NOVEL. Use RESEARCH §Code Examples:
```typescript
const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from: "Observatorio del Congreso 360 <resumen@dominio-verificado>",
    to: [destinatario], subject: `Tu resumen del Congreso · ${fecha}`, html, text,
    headers: {
      "List-Unsubscribe": `<${baseUrl}/notificaciones/baja?t=${rawBajaToken}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }),
});
```
**Hard-cap 100/day in code** (Pitfall 3): count sends, stop at 100, leave over-cap cursors un-advanced. **PII redaction** (Pitfall 4): NEVER `console.log` the raw email — log `<REDACTED>` or a hash. `RESEND_API_KEY` absent ⇒ dry-run (mirror `@obs/dinero` dry-run precedent). Idempotent cursor (Pattern 5): advance `ultimo_evento_visto` atomically on send success only.

---

### `.github/workflows/digest-daily.yml` (config, cron EGRESO)

**Analog:** `.github/workflows/actualidad-refresh.yml` (exact clone — the "cron that doesn't touch sources" precedent).

**Structural excerpt to clone (actualidad-refresh.yml:25-64):** `permissions: { contents: read }`, `concurrency: { group: …, cancel-in-progress: false }`, pinned-SHA `actions/checkout` + `pnpm/action-setup` + `setup-node` (node 22, cache pnpm), `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm --filter @obs/notificaciones exec tsx src/run-digest-prod-cli.ts`.

**EGRESO header comment (REQUIRED deliverable, model on actualidad-refresh.yml:3-13 "NO toca fuentes" comment):** state "patrón EGRESO: NO dos-etapas, NO R2, NO rate-limit gubernamental; el destinatario es Resend, no una fuente. La ÚNICA cota es el hard-cap 100/día (código) + redacción de PII en logs."

**GATED launch (RESEARCH §Pattern 3, mirror roster-weekly):** ship `workflow_dispatch` only (schedule commented) until a manual green run. NEW secret `RESEND_API_KEY` alongside existing `SUPABASE_API_URL`+`SUPABASE_SECRET_KEY`.

---

### `docs/legal/103-LEGAL-DOSSIER-NOTIF.md` (doc) — NOTIF-05

**Analog:** `docs/legal/102-LEGAL-DOSSIER-VSIM.md` (clone structure). Scope (RESEARCH §Security Domain): DPA/subencargado Resend, base de licitud (consent double opt-in in `consentimiento`), ARCO-P (one-click unsubscribe + preference center + `on delete cascade`), retención, `signoff: approved` recorded verbatim (operator pre-authorized 2026-07-26; agent documents, operator authorizes).

---

## Shared Patterns

### Authentication (OTP session)
**Source:** `app/lib/supabase-user.ts` (`createUserClient` + `updateSession`, publishable key, `import "server-only"`) + `app/middleware.ts` (Edge fail-open).
**Apply to:** `app/app/cuenta/actions.ts` (all user-session actions). LOCKED by Phase 97 — do NOT touch the pattern, do NOT migrate to `proxy`, do NOT widen CSP.
```typescript
// supabase-user.ts:88-102 — user client bound to a context cookie adapter (publishable key, RLS-gated)
export function createUserClient(cookieAdapter: {...}) {
  const { url, publishableKey } = leerEnv();
  return createServerClient(url, publishableKey, { cookies: { getAll, setAll } });
}
```

### Generic-error / no-PII discipline (WR-02)
**Source:** `app/app/spike-auth/actions.ts:93-101` — never interpolate the GoTrue message/email/token; log only `{ status, name }`.
**Apply to:** all `cuenta/actions.ts` auth actions AND the EGRESO cron (email redaction, Pitfall 4).

### Flag chokepoint + anti-flip guard
**Source:** `app/lib/vsim-gate.ts` + `app/lib/vsim-antiflip-guard.test.ts`.
**Apply to:** NOTIF flag gating the Seguir button. Single `=== "true"` reader, `.env.example=false`, deploy-time flip only.

### RLS migration + apply convention
**Source:** `supabase/migrations/0043_lockdown_web_reader.sql` (banner header, `--single-transaction` apply note, `PGCLIENTENCODING=UTF8`, `schema_migrations` insert note, drop-if-exists idempotent policies).
**Apply to:** 0069/0070/0071.

### pgTAP against applied schema
**Source:** `supabase/tests/0065_actualidad_senal.test.sql` (structure) + `has_table_privilege` idiom + RESEARCH two-user `set local role authenticated` idiom.
**Apply to:** all three 0069-0071 test files. Run `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f …` pre-apply (local) and post-apply (PROD).

### CI guard mutation self-check
**Source:** `app/lib/lockdown-guard.test.ts:403-430` (`parseDefinedRpcNames` in-memory fixture proving the REAL regex BITES) + `vsim-antiflip-guard.test.ts:337-434`.
**Apply to:** the `authenticatedGrantOffenders` Block D self-check AND the NOTIF anti-flip self-check. Every new guard MUST prove it bites in-memory (not a green no-op).

### Package layout (monorepo pnpm)
**Source:** `packages/actualidad/` (package.json, tsconfig.json, vitest.config.ts, src/index.ts barrel, src/*.test.ts, src/run-*-prod-cli.ts).
**Apply to:** `packages/notificaciones/`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Resend send (`packages/notificaciones/src/resend.ts`) | service | streaming-out (email egress) | No outbound-email code exists in the repo; EGRESO is a net-new pattern. Use RESEARCH §Code Examples (fetch POST to Resend, List-Unsubscribe header, 100/day hard-cap). |
| Opaque-token confirm/unsubscribe lookup | route | request-response | No login-less token-capability route exists. `node:crypto` randomBytes+sha256 per RESEARCH §Pattern 6; grep for an existing token helper first (Assumption A1) — none expected. |

Both have STRONG shape scaffolding from analogs (CLI shell, RSC shell), only the novel core (Resend HTTP / token hashing) comes from RESEARCH. The lockdown-guard `authenticated` extension is the single highest-risk NOVEL logic — it self-extends but the `authenticated` concept is new; write RED-first with the mutation self-check.

## Metadata

**Analog search scope:** `app/lib/`, `app/app/`, `app/components/`, `supabase/migrations/`, `supabase/tests/`, `packages/*`, `.github/workflows/`, `docs/legal/`, `.env.example`.
**Files scanned:** ~14 read in full/targeted (spike-auth actions, vsim-gate, supabase-user, 0043 migration, lockdown-guard.test, vsim-antiflip-guard.test, actualidad-refresh.yml, actualidad package.json, 0065 test, comparar page gate, middleware, .env.example flags) + directory listings for packages/tests/migrations/ficha pages.
**Latest migration confirmed:** 0068 → new migrations start at 0069.
**Pattern extraction date:** 2026-07-26
