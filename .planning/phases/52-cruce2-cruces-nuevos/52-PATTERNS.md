# Phase 52: CRUCE2 — Cruces nuevos con datos ya disponibles (P3) - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 9 (2 modified-CLI/SQL, 1 new SQL migration, 1 new pgTAP, 3 new/extended components, 1 new home surface, 1 guard update, +RTL tests)
**Analogs found:** 9 / 9 (every new/modified file has a strong in-repo analog; zero greenfield)

> **Doctrine reminder for the planner:** the whole phase is REUSE. The only genuinely new logic is (1) a load filter in the lobby CLI, (2) an RPC that mirrors 0047 mechanically, (3) three RSC read blocks. Copy the analogs literally; do not invent new patterns. All `app/` reads use `createServerSupabase()` (service_role, server-only), NEVER `.from()` on a PII table.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/cruces/src/clasificar-lobby-cli.ts` (add `--solo-confirmadas` + `sector_id is null` load) | CLI / batch | batch (transform + DB write) | self + `clasificar-fichas-cli.ts` `cargarFichas` | exact (self-modify) |
| `supabase/migrations/0048_lobby_en_tramitacion.sql` (NEW) | migration / RPC | request-response (read-only RPC) | `0047_rebeldias_honestas.sql` | exact idiom mirror |
| `supabase/tests/0048_lobby_en_tramitacion.test.sql` (NEW) | test (pgTAP) | request-response | `0047_rebeldias_honestas.test.sql` + `0021_lobby.test.sql` | exact idiom mirror |
| `app/components/lobby-en-tramitacion.tsx` (NEW) | component (RSC + pure view) | request-response (RPC consume) | `cruces-de-parlamentario.tsx` | exact (RPC-consuming carril) |
| `app/components/estado-actual-block.tsx` (extend: citación line) | component (RSC + pure derive) | request-response (`.from` no-PII) | self | exact (self-extend) |
| `app/app/proyecto/[boletin]/page.tsx` (new carril + wiring) | route (RSC page) | request-response | self | exact (self-extend) |
| `app/app/page.tsx` + `app/components/actualidad-*.tsx` (NEW home module) | route + components (RSC) | request-response (`.from` no-PII) | `agenda/page.tsx` sections + `red/page.tsx` (force-dynamic) | role-match |
| `app/lib/lockdown-guard.test.ts` (allowlist +1) | test / guard config | config | self (`PUBLIC_RPC_ALLOWLIST` Set) | exact (self-edit) |
| RTL tests (`lobby-en-tramitacion.test.tsx`, `actualidad-*.test.tsx`, extend `estado-actual-block.test.tsx`) | test (RTL) | request-response | `cruces-de-parlamentario.test.tsx`, `estado-actual-block.test.tsx` | role-match |

---

## Pattern Assignments

### `packages/cruces/src/clasificar-lobby-cli.ts` — add `--solo-confirmadas` load mode (SC1)

**Analog:** self + `clasificar-fichas-cli.ts:123-151` (`cargarFichas`).

The BLOCKING gap (RESEARCH Pitfall 1): `cargarContrapartes` (lines 88-91) does a flat `.from("lobby_contraparte").select(...).limit()` — no confirmed-audience join, no `where sector_id is null`, no offset. Planner must add a filtered load path.

**Current load to replace/branch** (`clasificar-lobby-cli.ts:88-98`):
```typescript
const { data, error } = await client
  .from("lobby_contraparte")
  .select("identificador, nombre, rol")
  .limit(limite);
if (error) throw new Error(`cargarContrapartes falló: ${error.message}`);
```

**Flag-parse pattern to copy** (`clasificar-fichas-cli.ts:70-104`, shared `parseArgs`): add a boolean `--solo-confirmadas` case to the switch (mirror `--dry-run` boolean case). The lobby CLI re-exports this parser via `parseArgsBase` (`clasificar-lobby-cli.ts:21-23,64-66`) — extend the base parser in `clasificar-fichas-cli.ts` and surface the field on `LobbyCliOptions` (`clasificar-lobby-cli.ts:37-49`).

**Load-shape to add** (mirror the `cargarFichas` join style at `clasificar-fichas-cli.ts:135-138`): distinct contrapartes that (a) appear in a `lobby_audiencia` with `estado_vinculo='confirmado' and parlamentario_id is not null` AND (b) have `lobby_contraparte.sector_id is null`. Because supabase-js `.from()` cannot express a distinct semi-join cleanly, prefer a dedicated RPC or a `.select(...).is("sector_id", null)` with an inner-join embed filter; the planner picks the surface (RESEARCH Open Question 1). Keep the `if (opts.filas !== undefined) return opts.filas;` test-injection escape hatch (line 83) intact — RTL/unit tests inject `filas`.

**Test pattern:** unit test injects `filas` + a mock provider/writer and asserts the filtered query shape (Wave 0 gap). Existing `writer.actualizarSectorContraparte(identificador, nombre, sector_codigo, rol)` call (lines 160-165) is unchanged.

**Run command (verbatim from 36-04, RESEARCH Pattern 1):**
```bash
node scripts/run-with-env.mjs pnpm --filter @obs/cruces exec tsx src/clasificar-lobby-cli.ts --solo-confirmadas --limite N --service-key "$SUPABASE_SECRET_KEY" [--dry-run]
node scripts/run-with-env.mjs pnpm --filter @obs/cruces exec tsx src/clasificar-fichas-cli.ts --limite 74 --service-key "$SUPABASE_SECRET_KEY" [--dry-run]
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select cruces.materializar_cruces();"
```

**Load-bearing invariant:** `clasificarContraparte(inputDeFila(fila), provider)` runs `assertNoRutInLlmInput` FIRST (line 152, comment). Do NOT wrap in try/catch — a dirty name must abort. The MiniMax key is read from env at line 118, never logged.

---

### `supabase/migrations/0048_lobby_en_tramitacion.sql` (NEW) — RPC (SC2)

**Analog:** `0047_rebeldias_honestas.sql` (exact idiom). Also cite `0021_lobby.sql` (audiencia/contraparte schema) and `0020` parlamentario_publico (public projection).

**Key divergence from 0047:** `lobby_en_tramitacion` is a NEW function → NO `drop function` needed (0047 needed `drop` at line 44 ONLY because it changed an existing `returns table`, error 42P13). Use `create or replace` directly.

**Function idiom to copy** (`0047:46-51`):
```sql
create or replace function public.lobby_en_tramitacion(p_boletin text)
returns table (...)
language sql stable security definer set search_path = '' as $$
  ...
$$;
```

**ACL double-revoke — copy VERBATIM** (`0047:101-102`, the load-bearing part — RESEARCH Pattern 2 + Anti-Patterns):
```sql
revoke all on function public.lobby_en_tramitacion(text) from public;
revoke all on function public.lobby_en_tramitacion(text) from anon, authenticated;
```
**CERO grant.** The site reads with service_role (bypasses ACL); anon is at zero grants since 0044. Any `grant ... to anon/public` fails the CI guard (Block A, no exceptions — the F51 exemption was reverted, `lockdown-guard.test.ts:195-204`).

**PII-safe body** (RESEARCH Code Examples §RPC, A3): read `public.parlamentario` INTERNALLY via `security definer` but emit ONLY public columns (nombre público + camara). NEVER rut/partido/email. Confirm the exact public-name column against `parlamentario_publico` (0020/0026) when writing — RESEARCH flags `p.nombre_normalizado` as `[ASSUMED]` (A3).

**Semana-ISO join (Pitfall 2 / A1):** normalize timezone explicitly to match how `citacion.semana_iso` was populated:
```sql
join public.lobby_audiencia a
  on to_char((a.fecha at time zone 'America/Santiago'), 'IYYY"-W"IW') = c.semana_iso
```
Document the timezone assumption in the migration header (like 0047's header block). Confirm against a real `(fecha, semana_iso)` pair in `citacion` during the plan.

**Header block:** mirror 0047's header (lines 1-41) — explain the yuxtaposición-pura semantics, the checkpoint-operador apply note, and `psql --single-transaction` / NEVER `supabase db push`.

---

### `supabase/tests/0048_lobby_en_tramitacion.test.sql` (NEW) — pgTAP (SC2/SC5)

**Analog:** `0047_rebeldias_honestas.test.sql` (contract asserts) + `0021_lobby.test.sql` (lobby fixture shapes).

**Structure to copy** (`0047_*.test.sql:9-10,154-155`): `begin; select plan(N); ... select * from finish(); rollback;`. NOT in the vitest glob (`.test.sql`); operator runs `psql -tA -f` post-apply.

**Contract asserts to copy** (`0047_*.test.sql`):
- `has_function('public','lobby_en_tramitacion', array['text'], ...)` (lines 13-15)
- positional `returns table` pin via `array_to_string(proargnames, ',')` (lines 19-24) — the client maps by position; this is the project idiom, NOT `pg_get_function_result`.
- `prosecdef = true` (security definer, lines 27-32)
- `proconfig ... like '%search_path=%'` (lines 35-40)
- `not has_function_privilege('anon', 'public.lobby_en_tramitacion(text)', 'execute')` (lines 46-48) — Camino A deny.
- non-PII returns assert: `array_to_string(proargnames,',') !~* '\y(partido|rut|email)\y'` (lines 54-60).

**Fixture pattern** (`0047_*.test.sql:69-115` + `0021_lobby.test.sql`): insert `parlamentario` + `proyecto` + `citacion` + `citacion_punto` + `lobby_audiencia` in the SAME ISO week, assert the semana-match returns the expected row. Use the `parlamentario`/`proyecto`/`votacion` insert column lists from `0047_*.test.sql:69-89` verbatim where they overlap.

---

### `app/components/lobby-en-tramitacion.tsx` (NEW) — RSC carril (SC2)

**Analog:** `cruces-de-parlamentario.tsx` (exact: pure view + Server Component that consumes an allowlisted RPC with an anti-insinuación content gate).

**Structure to copy** (`cruces-de-parlamentario.tsx`):
- Split into a PURE view (`CrucesView`, lines 84-174) + Server Component (`CrucesSection`, lines 177-192). RTL tests the pure view with fixtures; NO `"use client"`.
- Server read (lines 177-192):
```typescript
export async function LobbyEnTramitacionSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("lobby_en_tramitacion", { p_boletin: boletin });
  // ... degrade / throw ...
}
```
- Content-gate header block (lines 18-42): copy the 9-point gate verbatim — CARRIL AISLADO, CERO CAUSALIDAD, provenance per row, empty-is-a-fact.
- Empty-honest state (lines 96-107) and per-row `ProvenanceBadge` with `sourceUrl` = the row's `enlace_detalle` (lines 160-166).
- Caveat 1×/section ("coincidencia temporal; no implica relación") — mirror the honest intro `<p>` at lines 88-94.

**CRITICAL divergence — degrade honesto pre-apply (RESEARCH Pitfall 3 / A2):** unlike `CrucesSection` (which throws on ANY error, line 183), this carril renders BEFORE 0048 is applied (apply = checkpoint operador). So distinguish:
- `error?.code === 'PGRST202'` OR message matches "does not exist"/"schema cache" → **return null** (path 1, RPC absent, no DOM leaked).
- any other `error` → **throw** (path 3, #34 — real DB/red failure is not "sin coincidencias").

This is the `red/page.tsx` gate-off spirit (force-dynamic + honest degrade) applied at the component level. Do NOT use a blanket catch.

**force-dynamic:** the proyecto page is already dynamic per-segment (`[boletin]`); confirm no static baking. The carril is a `mt-12` sibling section in `proyecto/[boletin]/page.tsx` (see below).

---

### `app/components/estado-actual-block.tsx` (extend) — citación line (SC3)

**Analog:** self (self-extend). This is the F51 "¿Dónde está hoy?" block.

**Extend `EstadoActual` interface** (lines 20-27): add `citacionVigente?: { comision: string; fecha: Date }`.

**Add to the `Promise.all`** (`EstadoActualBlock`, lines 159-171) — a THIRD query over non-PII tables (guard OK, RESEARCH Code Examples §SC3):
```typescript
sb.from("citacion_punto")
  .select("citacion:citacion(comision, fecha, semana_iso)")
  .eq("boletin", boletin);
```
Derive the nearest future/vigente citación (`citacion.fecha >= hoy`); omit if none.

**Omit-when-not-derivable pattern** (lines 82-104): mirror `etapaLinea`/`ultimoHito` — each field OPTIONAL; absent ⇒ line omitted, NEVER "—". A real read error → throw (#34, lines 175-184). Render the line in `EstadoActualView` (lines 112-149) guarded by `{citacionVigente && ...}`, fecha in `font-mono` via `fechaCorta` (line 129).

**Test:** extend `estado-actual-block.test.ts` for `derivarEstadoActual` (pure) — the citación-line omit case (RESEARCH Test Map SC3).

---

### `app/app/proyecto/[boletin]/page.tsx` (extend) — new carril wiring (SC2/SC3)

**Analog:** self. Copy the existing section-wrapping idiom (lines 65-97): each carril is `<section id="..." className="mt-12">` wrapping a `<Suspense fallback={<XSkeleton />}>` + async Section component.

Add a new `<section id="lobby-tramitacion" className="mt-12">` for `LobbyEnTramitacionSection` (sibling of `#votaciones`/`#idea-matriz`). The SC3 citación line rides inside the existing `<EstadoActualBlock>` (line 61-63) — no new section. Add a matching skeleton (copy `IdeaMatrizSkeleton` lines 335-343). `BOLETIN_RE.test(boletin)` validation already gates the page (lines 37-39).

---

### `app/app/page.tsx` + `app/components/actualidad-*.tsx` (NEW) — home module (SC4)

**Analogs:** `agenda/page.tsx:1-60` (RSC page reading non-PII tables via `createServerSupabase`, sections in `<Suspense>`) + `red/page.tsx:37-43` (`force-dynamic` idiom + comment) + `estado-actual-block.tsx` `urgenciaVigente` (reused for "Urgencias vigentes").

**force-dynamic — copy the idiom + comment rationale** (`red/page.tsx:37-43`):
```typescript
export const dynamic = "force-dynamic";
```
RESEARCH: post-F50 gotcha — a statically-baked route with live data = stale/500. Home currently has ZERO queries (lines 30-70, only hero SearchBox) — the 4 pills and hero copy are LOCKED (lines 22-28); the actualidad module is ADDED BELOW the hero, hero untouched.

**Three server blocks, each `.from()` on non-PII tables only** (RESEARCH Pitfall 4 — the guard fails on PII tables `aporte`/`contrato`/`declaracion*`/`donante`/`cruce_senal`/`parlamentario`):
- "Votado esta semana" → `.from("votacion")` (has `resultado/total_si/total_no`); render tally via `conteoVotacion(si, no)` (`format.ts:96`).
- "Urgencias vigentes" → reuse `urgenciaVigente(eventos)` from `estado-actual-block.tsx:43` over `tramitacion_evento`.
- "Última actualización de datos" → `max(fecha_captura)` per non-PII source (`votacion`/`proyecto`/`tramitacion_evento`/`citacion`/`lobby_audiencia`/`proyecto_ficha`):
```typescript
sb.from("votacion").select("fecha_captura").order("fecha_captura",{ascending:false}).limit(1);
```

**Read patterns:** `.limit()` acotado per block; wrap shared reads in `React.cache` (proyecto page `leerFicha`, lines 105-120, is the cache idiom). `#34` honest-error: a real read error → throw, never fabricate an empty block (mirror `VotacionesSection` lines 238-242). Fechas in Mono via `fechaCorta`/`relativeTimeEs` (`format.ts`).

**Zero new client JS, zero carousel** (CONTEXT SC4). Each block degrades independently to an honest empty state (RTL Wave 0 gap).

---

### `app/lib/lockdown-guard.test.ts` (extend) — allowlist +1 (SC5)

**Analog:** self. Add `"lobby_en_tramitacion"` to `PUBLIC_RPC_ALLOWLIST` (Set at lines 165-181, alphabetical — insert after `lobby_de_parlamentario`). This is the ONLY guard edit; the Block-A no-anon-grant rule (lines 208+) already covers 0048's double-revoke (which has ZERO grants → nothing to allow).

---

## Shared Patterns

### RPC PII-safe idiom (0047 mirror)
**Source:** `supabase/migrations/0047_rebeldias_honestas.sql:46-102` + `supabase/tests/0047_rebeldias_honestas.test.sql`
**Apply to:** `0048_lobby_en_tramitacion.sql` + its pgTAP
```sql
create or replace function public.<name>(<args>)
returns table (...) language sql stable security definer set search_path = '' as $$ ... $$;
revoke all on function public.<name>(<args>) from public;
revoke all on function public.<name>(<args>) from anon, authenticated;
```
NEW function → no `drop` prefix. CERO grant. Reads PII internally, emits only public derivatives. pgTAP pins positional `returns table` + `not has_function_privilege('anon',...)`.

### Server-Component honest-read (`createServerSupabase` + #34)
**Source:** `app/components/estado-actual-block.tsx:156-193`, `app/app/proyecto/[boletin]/page.tsx:147-283`
**Apply to:** every new RSC read (lobby carril, estado-actual citación, home blocks)
```typescript
const sb = createServerSupabase();               // service_role, server-only
const { data, error } = await sb.from("<non-PII>")... ;
if (error) throw new Error(`... ${error.message}`);   // #34: real error ≠ "sin datos"
// absent rows → omit line / null block (honest-state), NEVER fabricated "—"
```
NEVER `.from()` a PII table from `app/` (guard fails). Cruce señales read ONLY via allowlisted RPC.

### Degrade honesto pre-apply (RPC absent)
**Source:** `red/page.tsx:37-43` (force-dynamic + gate) + RESEARCH Pitfall 3
**Apply to:** `LobbyEnTramitacionSection` (0048 not yet applied at build)
```typescript
if (error?.code === 'PGRST202' /* or message ~ /does not exist|schema cache/ */) return null; // path 1
if (error) throw new Error(...); // path 3 (#34)
```

### Anti-insinuación content gate
**Source:** `app/components/cruces-de-parlamentario.tsx:18-42` (9-point gate)
**Apply to:** the lobby-en-tramitación carril
- Carril aislado (`mt-12` own `<section>`, never composed with a voto/proyecto in the same `<article>`).
- CERO causalidad; caveat 1×/section; provenance (`enlace_detalle`) per row.
- Contraparte/parlamentario name public only; empty is a fact, never "limpio/transparente".

### Agent-run LIVE data corrida (SC1)
**Source:** RESEARCH Pattern 1 (verbatim 36-04) + `scripts/run-with-env.mjs`
**Apply to:** the classifier run
golden LIVE gate (`CRUCES_GOLDEN_LIVE=1`, cobertura ≥0.7) → dry-run acotado → LIVE `--solo-confirmadas` → `psql select cruces.materializar_cruces();` → read-only psql verification (before/after counts) pasted into SUMMARY. NEVER `supabase db push`.

---

## No Analog Found

None. Every file has a strong in-repo analog. The only NEW logic (per RESEARCH "Key insight"): (1) the `--solo-confirmadas` load filter, (2) the 0048 RPC body (mechanical 0047 mirror), (3) three RSC read blocks. Zero new domain logic, zero new dependency.

---

## Metadata

**Analog search scope:** `packages/cruces/src/`, `supabase/migrations/`, `supabase/tests/`, `app/components/`, `app/app/`, `app/lib/`
**Files scanned:** ~14 read in full/targeted (2 CLIs, 3 SQL, 1 pgTAP, 5 components/pages, format.ts, lockdown-guard, agenda page)
**Pattern extraction date:** 2026-07-03
