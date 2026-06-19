# Phase 15: MONEY Financiamiento — SERVEL verbatim + sub-maestra de donantes - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 13 new/modified artifacts
**Analogs found:** 12 / 13 (1 greenfield: Supabase Storage helper)

Phase 15 builds INSIDE the existing `@obs/dinero` package (Phase 14). Every connector
artifact has an exact sibling on disk in `packages/dinero/src/`. The dominant instruction is:
**clone the ChileCompra file, swap the source shape, and change drift from tolerant→BLOCKING.**

---

## File Classification

| New/Modified Artifact | Role | Data Flow | Closest Analog | Match Quality |
|-----------------------|------|-----------|----------------|---------------|
| `packages/dinero/src/connector-servel.ts` | connector | request-response (fetch) | `packages/dinero/src/connector-chilecompra.ts` | exact sibling |
| `packages/dinero/src/parse-servel.ts` | parser | transform (verbatim, no-LLM) | `packages/dinero/src/parse-chilecompra.ts` | exact sibling |
| `packages/dinero/src/reconciliar-aporte.ts` | service (matcher) | transform (RUT-exact) | `packages/dinero/src/reconciliar-contrato.ts` | exact sibling |
| `packages/dinero/src/writer-supabase.ts` (extend) + storage helper | writer | file-I/O (raw→Storage) + CRUD | `packages/dinero/src/writer-supabase.ts` | role-match; Storage = greenfield |
| `packages/dinero/src/ingest-run.ts` (servel variant) | orchestrator | batch (serial sweep) | `packages/dinero/src/ingest-run.ts` | exact sibling (diverges: drift BLOCKING) |
| `packages/dinero/src/ingest-cli.ts` (servel entry) | cli | batch | `packages/dinero/src/ingest-cli.ts` | exact sibling |
| `packages/dinero/src/model.ts` (Aporte/Donante additions) | model | — | `packages/dinero/src/model.ts` | same file, extend |
| `packages/ingest/src/allowlist.ts` (add `servel.cl`) | config | — | `packages/ingest/src/allowlist.ts:19-28` | same file, one-line add |
| `supabase/migrations/0024_servel.sql` (next number) | migration | — | `supabase/migrations/0023_dinero.sql` | exact sibling |
| `supabase/tests/0025_servel.test.sql` | test (pgTAP) | — | `supabase/tests/0024_dinero.test.sql` | exact sibling |
| `app/components/financiamiento-de-parlamentario.tsx` | component | request-response (RPC) | `app/components/contratos-de-parlamentario.tsx` | exact sibling |
| `app/app/parlamentario/[id]/page.tsx` (wire gate + skeleton) | route | — | same file, lines 96-105 + 189-199 | same file, sibling section |
| `app/lib/types.ts` (`sourceLabel` SERVEL branch + `AporteRpcRow`) | utility/type | — | `app/lib/types.ts:275-291,370-380` | same file, extend |

---

## Pattern Assignments

### `connector-servel.ts` (connector, request-response)

**Analog:** `packages/dinero/src/connector-chilecompra.ts` (clone whole file).

- **LOCKED fetch order** (lines 92-130): `assertAllowedUrl(url, allowlist)` → `robots.isAllowed(url)`
  → `rateLimiter.wait(parsed.host)` → `fetcher.get({url, headers})`. NEVER `BaseConnector.run`
  (its daily cache would skip re-runs). Copy verbatim.
- **Deps interface** (lines 53-60): `ChileCompraConnectorDeps { fetcher, rateLimiter, robots, allowlist? }`
  from `@obs/ingest`. → `ServelConnectorDeps`.
- **Identificatory UA** (lines 66-72): `HEADERS_CHILECOMPRA` with `Bot-Ciudadano/1.0` suffix. → `HEADERS_SERVEL`.
  Note SERVEL likely returns Excel/CSV/HTML (research-confirmed), so `Accept` and the parse step differ
  from ChileCompra's JSON — but the fetch wrapper is identical.
- **Blocked-source error** (lines 42-51): `ChileCompraBloqueadaError(url, status)` → `ServelBloqueadaError`,
  recognized by `ingest-run` for honest degradation. NEVER interpolate any secret in the message.
- **SSRF sanitization** (lines 94-104): `assertAllowedUrl` throws `HostNotAllowedError` with the RAW url;
  catch inside try and re-throw sanitized. ChileCompra also has `redactarTicket`/`urlSinQuery` for the
  `&ticket=` secret — SERVEL has no per-request ticket, so that sanitization may simplify, but keep the
  generic "never leak raw url in error" defense.

### `parse-servel.ts` (parser, verbatim transform)

**Analog:** `packages/dinero/src/parse-chilecompra.ts` (clone).

- **Zod shape gate → THROW on drift** (lines 58-66): `OrdenesResponseSchema.safeParse(json)`; on
  `!parsed.success` THROW a "drift estructural" Error. This THROW is what `ingest-run` catches to
  quarantine. → `AportesResponseSchema` (whatever SERVEL's real shape is — Excel rows/CSV).
- **Verbatim literal copy, NO compute** (lines 75-95): every field copied as-is; `monto` stays a raw
  string (here ChileCompra forces `monto: null`; SERVEL DOES publish amounts → keep verbatim string,
  never numeric). `orNull()` helper (lines 19-20).
- **Provenance inline** (lines 91-94): `origen`, `fecha_captura`, `enlace`, `licencia` stamped per row.
- **Deterministic sort** for idempotent tests (lines 98-99).
- **tipoPersona by RUT body** (lines 27-32): `cuerpo >= 50_000_000 → juridica` — reuse for the donor
  (`tipo_persona`/`tipo_persona` of the donante row).
- **CRITICAL divergence — `eleccion`/periodo is LOAD-BEARING non-null:** UI-SPEC marks `eleccion` as
  the always-present field. The parser MUST emit it per row; a row without a period is drift → quarantine.

### `reconciliar-aporte.ts` (service, RUT-exact matcher) — THE key reuse

**Analog:** `packages/dinero/src/reconciliar-contrato.ts` (clone; this is the `EnlaceConfirmado` RUT-only invariant).

- **The exact RUT-only match call** (lines 113-126):
  ```ts
  const res = matchDeterminista(
    { rut: normRut(c.rutProveedor), nombreNormalizado: "", camara, periodo },
    maestra,
  );
  if (res.estado === "confirmado" && res.metodo === "rut") {
    enlace = confirmar(res.id, "determinista");   // EnlaceConfirmado branded FK
    estadoVinculo = "confirmado";
  } else { estadoVinculo = "no_confirmado"; }      // IDENT-10 / 0 / 2+ / name-branch → null
  ```
  `nombreNormalizado: ""` (line 115) is the load-bearing guard: it forbids any name-branch match —
  **only `confirmado+rut` mints the FK.** Copy verbatim, keying on the **candidate RUT** instead of
  `rutProveedor`. NEVER match by name (sin match → sin atribución).
- **Three vinculo states** (lines 38, type `EstadoVinculoContrato`): `confirmado | no_confirmado | cuarentena`.
  Invalid DV (`!isRutValido`, lines 108-111) → `cuarentena`, never a confirmed row, never fabricates.
- **Pure function** — no net, no DB (header lines 18). Returns `{ rows, parlamentariosConfirmados, cuarentenados }`
  (lines 79-85).
- **Imports** (lines 20-24): `isRutValido, normRut, matchDeterminista, confirmar, type EnlaceConfirmado`
  from `@obs/identity`; `type Parlamentario` from `@obs/core`. Reuse module-11 RUT from `@obs/identity`
  (`deterministic.ts`) — do NOT reimplement.

### `writer-supabase.ts` (writer, CRUD) + Supabase Storage helper (raw)

**Analog:** `packages/dinero/src/writer-supabase.ts` (clone the upsert methods).

- **Client construction** (lines 86-92): `createClient(opts.url, opts.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })`,
  SERVICE key (bypasses RLS, server-side), accepts a pre-built `client` for tests. This is THE
  client-construction analog to extend for Storage.
- **Versioned upsert with onConflict** (lines 94-128):
  - `contrato` → `onConflict: "fuente_id,fecha_corte"` (version key INCLUDES fecha_corte — versions
    accumulate). → `aporte` keyed by `(fuente_id, fecha_corte)`.
  - `contratista` → `onConflict: "rut_proveedor"` (sub-maestra last-write-wins). → `donante` keyed by donor RUT.
  - `contratos_ingesta_estado` → `onConflict: "parlamentario_id"`. → `aportes_ingesta_estado`.
  - `chunk(500)` (line 31) + `dedupePorClave` (lines 40-44) per batch.
- **Writer interface** (`writer.ts:16-25`): `DineroWriter { upsertContratos, upsertContratistas, marcarIngestado }`
  + `InMemoryDineroWriter` (line 38) for dry-run. Add `upsertAportes`, `upsertDonantes`,
  `subirCrudo(...)` (or extend the existing methods).

**RAW → Supabase Storage — GREENFIELD (no analog).** Grep across the entire repo for
`.storage.from(` / `.upload(` returns ZERO hits — **no Storage usage exists anywhere.** The closest
analog to EXTEND is the `createClient(...)` in `writer-supabase.ts:86-92`. Build the helper on that
same SERVICE-key client:
```ts
await this.client.storage.from(bucket).upload(key, body, { upsert: true });
```
Versioned key per CONTEXT §Claude's Discretion: `servel/<eleccion>/<fecha>/<hash>`. NOTE: the existing
`ingest-run.ts:13` comment says "R2 BLOQUEADO -> sin snapshot crudo" — Phase 15 REPLACES that no-op with
the Supabase Storage upload (R2 stays operator debt, 401, see [[env-credentials-reality]]). This is the
only artifact with no on-disk pattern; the SERVICE-key client and the versioned-key idea are the carry-overs.

### `ingest-run.ts` (orchestrator, batch) — diverges: drift BLOCKING

**Analog:** `packages/dinero/src/ingest-run.ts` (clone, then HARDEN the drift posture).

- **Existing quarantine/degradation machinery already lives here** — this is the file the BLOCKING
  variant extends:
  - `DegradacionDinero { fuente, motivo, cuarentena? }` (lines 39-45) + `cuarentenados[]` (line 90).
  - Invalid DV → cuarentena, 0 rows, marker, never fabricate (lines 97-107).
  - **Structural drift → quarantine** (BuscarProveedor, lines 114-124; per-day parse, lines 175-184):
    `safeParse`/`parseContratos` failure pushes to `cuarentenados` + a `cuarentena: true` degradation,
    continues without aborting. **This is the exact site Phase 15 changes from per-task tolerance to
    WHOLE-RUN BLOCKING:** CONTEXT §"Drift BLOQUEANTE" — a partial run must quarantine the ENTIRE run with
    completeness reconciliation (counts/totals per election/candidate), never emit rows silently.
    Phase 14 quarantines the offending task and keeps going; Phase 15 must, on any completeness
    mismatch, refuse to emit ANY row for that election/candidate.
  - Blocked source → honest degradation, continue (lines 133-145, 154-166).
- **Serial sweep, no parallelism** (header lines 1-5): rate-limiter serializes per host; loop over tasks.
- **`marcarSinContratos` reuses `matchDeterminista` (rama RUT)** to mark "consultado" (lines 247-264) —
  same `nombreNormalizado: ""` guard, single-sourced with the reconciler. → mark `aportes_ingesta_estado`.
- **Marker write at end** (lines 222-224): `marcarIngestado([...marcados], hasta)`.

### `ingest-cli.ts` (cli, batch)

**Analog:** `packages/dinero/src/ingest-cli.ts` (clone).

- **Secrets from env only, dry-run fallback** (lines 99-121): `SUPABASE_DB_URL`/`SUPABASE_URL` +
  `SUPABASE_SERVICE_KEY`; missing key/url → DRY-RUN via `InMemoryDineroWriter`, never fabricate. SERVEL
  may need its own credential (CONTEXT §Integration: `.env.example`); ChileCompra's `MERCADOPUBLICO_TICKET`
  (line 106) is the pattern (env-only, never argv).
- **Real `@obs/ingest` collaborators** (lines 124-130): `new Fetcher()`, `new HostRateLimiter()`,
  `new RobotsGuard({ allowlist: {} })` → `ServelConnector`.
- **Flag parsing validated before any net/DB** (lines 59-91) + `is-main` entry guard (lines 171-195).

### `model.ts` (model, extend in place)

**Analog:** same file `packages/dinero/src/model.ts`.

- **Provenance inline block** (lines 21-30): `ProvenanceInline { origen, fecha_captura, enlace, licencia }`. Reuse.
- **Sub-maestra interface + schema** (lines 78-99): `Contratista` (keyed by RUT, PII → deny-by-default)
  + `ContratistaSchema`. → `Donante`. **The donor RUT is internal/deny-by-default and NEVER rendered**
  (Ley 21.719 sensitive-data — an aporte can reveal political affiliation; UI-SPEC).
- **Versioned root interface + schema** (lines 108-151): `Contrato` keyed by `(fuenteId, fechaCorte)`,
  `monto` verbatim string. → `Aporte` with the LOAD-BEARING non-null `eleccion`/periodo field +
  `monto` verbatim (SERVEL publishes it), `fecha_aporte`, `tipo_aporte` (all nullable except `eleccion`).
- **Origen/licencia constants** (lines 154-156): `ORIGEN_DINERO = "chilecompra"`, `LICENCIA_DINERO = "mención de la fuente"`.
  → `ORIGEN_SERVEL = "servel"`, `LICENCIA_SERVEL = "términos por verificar"` (NOT CC BY 4.0 — research-confirmed).
- **Response schemas** (lines 39-67): the `safeParse` gate shapes. → SERVEL's real shape (Excel/CSV rows).

### `0024_servel.sql` (migration) — next number is **0024**

**Analog:** `supabase/migrations/0023_dinero.sql` (clone section-by-section; it is itself a mirror of 0021/0022).

Latest migration on disk = `0023_dinero.sql`. NEXT migration number = **0024**.
(Caveat: `supabase/tests/0024_dinero.test.sql` already uses 0024 as a TEST number, and
`supabase/tests/0023_money_gate.test.sql` exists too — but those are `tests/`, not `migrations/`.
The next free **migration** file is `0024_*.sql`; pick a non-colliding **test** number = **0025**.)

Sections to copy from `0023_dinero.sql`:
- **Public-read versioned table** (lines 57-96): `create table contrato (... primary key (fuente_id, fecha_corte))`
  + `enable row level security` + `create policy ... for select to anon using (true)` + explicit
  `grant select ... to anon` + a `parlamentario_id` index. → `aporte` (add non-null `eleccion`).
- **Deny-by-default + REVOKE sub-maestra** (lines 103-127): `create table contratista (...)` + `enable
  row level security` (NO policy, NO grant) + **`revoke all on contratista from anon, authenticated;`**
  (lines 121-127 explain the Phase-11 default-privileges hole this closes). → `donante` (donor RUT = PII).
- **Ingesta marker, public-read** (lines 134-141): `contratos_ingesta_estado (parlamentario_id pk, ingestado_hasta, fecha_captura)`
  + policy + grant. → `aportes_ingesta_estado`.
- **Security-definer RPC** (lines 149-167): `create function public.contratos_de_parlamentario(p_id text)
  returns table (...) language sql stable security definer set search_path = ''` → projects ONLY
  source-published fields + `fecha_corte`, NO `parlamentario_id`, NO raw RUT; `revoke execute ... from
  public` + `grant execute ... to anon`. → `aportes_de_parlamentario(p_id)`. **DIVERGENCE: period-grouped**
  — `order by eleccion/periodo DESC, fecha_aporte DESC` (UI-SPEC §Data Contract), and the RPC must NEVER
  project the donor RUT (Ley 21.719). `fecha_oc desc nulls last` pattern at lines 160-162 is the
  nullable-date ordering guard to reuse for `fecha_aporte`.
- **Licencia default**: `licencia text not null default 'términos por verificar'` (NOT the `'mención de la fuente'`
  of dinero, NOT the `'CC BY 4.0'` of probidad).

### `0025_servel.test.sql` (pgTAP test)

**Analog:** `supabase/tests/0024_dinero.test.sql` (clone; header lines 1-15 explain the mirror).

- `plan(N)`; `has_table` for the 3 tables (lines 21-23); RLS-enabled `is(...relrowsecurity...)` (lines 26-33);
  PK = `(fuente_id, fecha_corte)` via `pg_constraint` (lines 38-40); public-read policy+grant on `aporte`
  + `aportes_ingesta_estado`; **deny-by-default triple-assert on `donante`** (RLS enabled + ZERO policies +
  anon has NO select grant); RPC `aportes_de_parlamentario(text)` exists + SECURITY DEFINER + anon EXECUTE +
  public NOT EXECUTE. Apply + pgTAP against an APPLIED schema is the operator checkpoint (CI false positive,
  Pitfall 3).

### `financiamiento-de-parlamentario.tsx` (component, RPC)

**Analog:** `app/components/contratos-de-parlamentario.tsx` (clone whole file).

- **Two-part structure:** PURE `ContratosView` (props, RTL-testable, lines 190-277) + Server Component
  `ContratosSection` (gate→RPC→marker→derive, lines 287-381). NO `"use client"`. → `FinanciamientoView`
  + `FinanciamientoSection`.
- **Double-candado gate** (lines 297-299): `if (!moneyPublicEnabled(process.env)) return null;` —
  re-check at top of the Server Component, mirror exactly.
- **RPC + #34 honest error** (lines 309-318): `sb.rpc("contratos_de_parlamentario", { p_id: id })`;
  `if (rpcError) throw new Error(...)` — a real DB error THROWS, never degrades to "sin aportes".
- **Marker via `.maybeSingle()`** (lines 336-345) → three honest states (lines 347-359):
  `enlazado` / `consultado_sin_contratos` / `no_consultado`. → `enlazado` / `verificado_sin_aportes` /
  `no_ingestado` (UI-SPEC §States). Absence of marker row = `no_ingestado`.
- **`ContratoFila` row** (lines 113-187): subject-prominent, SEPARATE muted link line ("Enlazado por RUT
  al parlamentario."), `<dl>` noun-label/value, per-row fecha-de-corte, `ProvenanceBadge` per row. →
  `AporteFila` with subject = DONOR ("Aporta: {donante_nombre}"), separate "Asociado por RUT al candidato.",
  `Elección:` as load-bearing always-present row, amber period-anterior caveat (frescura-only amber rule).
- **Pagination `<nav>` + `buildHref`** (lines 89-92, 245-274): `PAGE_SIZE = 20`, `#dinero` anchor,
  `min-h-[44px]` tap targets. → `?financiamientoPage=N`, `#financiamiento` anchor.
- **Imports** (lines 1-7): `createServerSupabase` from `@/lib/supabase`, `moneyPublicEnabled` from
  `@/lib/money-gate`, `ProvenanceBadge`, `fechaCorta`, `sourceLabel` + `ContratoRpcRow` from `@/lib/types`.
- **DIVERGENCE — attribution:** do NOT reuse the `AtribucionCcBy` helper (patrimonio); render a plain muted
  SERVEL "términos por verificar" line (UI-SPEC §Data Contract).

### `page.tsx` gate wiring + skeleton

**Analog:** `app/app/parlamentario/[id]/page.tsx` (same file; clone the `#dinero` block).

- **Gate block** (lines 96-105): `{moneyPublicEnabled(process.env) && ( <section id="dinero" className="mt-12">
  <h2 ...>Contratos del Estado asociados al RUT</h2> <Suspense fallback={<ContratosSkeleton/>}>
  <ContratosSection id={id} searchParams={sp}/></Suspense></section> )}`. The `<h2>` lives INSIDE the
  guard → absent from HTML when OFF (lines 90-94 explain the LOCKED rule). → new `<section id="financiamiento"
  className="mt-12">` SIBLING immediately AFTER the `#dinero` block, heading `Aportes de campaña registrados
  en SERVEL` (non-possessive).
- **Skeleton** (lines 189-199): `ContratosSkeleton` (intro + attribution + 3 rows) → `FinanciamientoSkeleton`
  (identical shape).
- **Import** (line 10): add `FinanciamientoSection` import alongside `ContratosSection`.

### `types.ts` extensions

**Analog:** same file `app/lib/types.ts`.

- **`sourceLabel` SERVEL branch** (lines 370-380): add `if (o.includes("servel")) return "SERVEL";`
  before the final fallback, mirroring the existing `chilecompra/mercado → "ChileCompra"` branch (line 378).
- **`AporteRpcRow`** modeled on `ContratoRpcRow` (lines 275-291): nullable source columns (`donante_nombre`,
  `tipo_persona`, `monto`, `fecha_aporte`, `tipo_aporte`) `string | null`; non-null `eleccion`, `origen`,
  `fecha_captura`, `fecha_corte`, `enlace`, `licencia`. NEVER include the donor RUT.

### `allowlist.ts` (config, one-line add)

**Analog:** `packages/ingest/src/allowlist.ts:19-28` — add `"servel.cl"` to `DEFAULT_ALLOWED_SUFFIXES`
(covers `aportes.servel.cl` as a subdomain, exactly as `mercadopublico.cl` covers `api.mercadopublico.cl`).

---

## Shared Patterns

### RUT-exact reconciliation (`EnlaceConfirmado` RUT-only invariant)
**Source:** `packages/dinero/src/reconciliar-contrato.ts:113-126`
**Apply to:** `reconciliar-aporte.ts`, `ingest-run.ts:marcarSinContratos`
The `matchDeterminista({ rut: normRut(...), nombreNormalizado: "", camara, periodo }, maestra)` call with
`nombreNormalizado: ""` + the `res.estado === "confirmado" && res.metodo === "rut"` guard is the SINGLE source
of truth for linking. Name-branch is structurally impossible. RUT module-11 from `@obs/identity` (`deterministic.ts`).

### Deny-by-default + REVOKE for PII sub-maestra
**Source:** `supabase/migrations/0023_dinero.sql:103-127`
**Apply to:** the `donante` table in `0024_servel.sql`
`enable row level security` with ZERO policies + ZERO grants + explicit `revoke all ... from anon, authenticated`
(closes the Supabase default-privileges hole — Phase 11 lesson). Verified by pgTAP triple-assert.

### Security-definer public RPC (revoke from public + grant to anon)
**Source:** `supabase/migrations/0023_dinero.sql:149-167`
**Apply to:** `aportes_de_parlamentario` RPC
`language sql stable security definer set search_path = ''`, projects only source fields + `fecha_corte`,
`revoke execute ... from public` + `grant execute ... to anon`. Nullable-date ordering: `... desc nulls last`.

### MONEY exposure gate (double-candado)
**Source:** `app/app/parlamentario/[id]/page.tsx:96-105` (presentation) + `contratos-de-parlamentario.tsx:297-299` (re-check) + `0023_dinero.sql` RLS (data)
**Apply to:** the `#financiamiento` section + `FinanciamientoSection`
Heading inside the `moneyPublicEnabled(process.env) &&` guard (absent from HTML when OFF) + Server Component
re-check returns `null` + table-level deny/revoke. NEVER read `MONEY_PUBLIC_ENABLED` raw (chokepoint WR-02).

### Verbatim parse with Zod shape-gate → THROW → quarantine
**Source:** `packages/dinero/src/parse-chilecompra.ts:58-66` + `ingest-run.ts:175-184`
**Apply to:** `parse-servel.ts` + `ingest-run.ts` (servel)
`safeParse` failure THROWS "drift estructural"; the orchestrator catches → quarantine. **Phase 15 hardens
this from per-task to WHOLE-RUN BLOCKING with completeness reconciliation** (the one deliberate divergence).

### Provenance inline + versioned upsert
**Source:** `packages/dinero/src/model.ts:21-30` + `writer-supabase.ts:94-128`
**Apply to:** `Aporte`/`Donante` models + writer
Every row carries `origen/fecha_captura/enlace/licencia` NOT NULL; `aporte` upsert `onConflict` INCLUDES
`fecha_corte` (versions accumulate); sub-maestra `onConflict` on donor RUT (last-write-wins).

---

## No Analog Found

| Artifact | Role | Data Flow | Reason |
|----------|------|-----------|--------|
| Supabase Storage raw-upload helper | utility | file-I/O | Grep `.storage.from(` / `.upload(` across the whole repo = ZERO hits. No Storage usage exists. Closest analog to EXTEND: the SERVICE-key `createClient(...)` in `writer-supabase.ts:86-92`. Build `client.storage.from(bucket).upload(key, body, { upsert: true })` on that same client; versioned key `servel/<eleccion>/<fecha>/<hash>`. Replaces the R2-blocked no-op at `ingest-run.ts:13`. (R2 stays operator debt — 401, see [[env-credentials-reality]].) |

---

## Metadata

**Analog search scope:** `packages/dinero/src/`, `packages/ingest/src/`, `supabase/migrations/`,
`supabase/tests/`, `app/components/`, `app/lib/`, `app/app/parlamentario/[id]/`
**Files scanned:** ~16 (full dinero package + migration 0023 + pgTAP 0024 + contratos component + page.tsx + types.ts + supabase client + allowlist)
**Latest migration on disk:** `0023_dinero.sql` → next migration = **0024**; next free pgTAP test = **0025**
**Storage greenfield confirmed:** repo-wide grep for `.storage.from(` / `.upload(` = 0 source hits
**Pattern extraction date:** 2026-06-19
