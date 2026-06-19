# Phase 14: MONEY Contratos — ChileCompra por RUT + sub-maestra de contratistas - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 18 (10 connector + 1 migration + 1 pgTAP + 1 ficha component + page.tsx mount + types.ts edit + RUT/EnlaceConfirmado reuse)
**Analogs found:** 18 / 18 (every artifact has an exact or role-exact sibling on disk)

> The whole phase mirrors `@obs/probidad` (connector), `0022_probidad.sql` + `0021_lobby.sql` (migration), and `lobby-de-parlamentario.tsx` / `patrimonio-de-parlamentario.tsx` (ficha). No new architecture. Copy file-by-file; the only NEW logic is RUT-exact linking (vs name-only) and the THREE honest states (vs two).

---

## File Classification

| New / Modified artifact | Role | Data Flow | Closest Analog | Match |
|--------------------------|------|-----------|----------------|-------|
| `packages/dinero/src/connector-chilecompra.ts` | connector | request-response | `packages/probidad/src/connector-infoprobidad.ts` | role-exact |
| `packages/dinero/src/parse-chilecompra.ts` | parser | transform | `packages/probidad/src/parse-infoprobidad.ts` | role-exact |
| `packages/dinero/src/model.ts` | model | — | `packages/probidad/src/model.ts` | exact |
| `packages/dinero/src/reconciliar-contrato.ts` | service | transform (RUT-exact link) | `packages/probidad/src/reconciliar-declarante.ts` | role-match (RUT vs name) |
| `packages/dinero/src/writer.ts` | writer (iface + in-mem) | CRUD | `packages/probidad/src/writer.ts` | exact |
| `packages/dinero/src/writer-supabase.ts` | writer (Supabase) | CRUD | `packages/probidad/src/writer-supabase.ts` | exact |
| `packages/dinero/src/ingest-run.ts` | orchestration | batch | `packages/probidad/src/ingest-run.ts` | exact |
| `packages/dinero/src/ingest-cli.ts` | cli | batch | `packages/probidad/src/ingest-cli.ts` | exact |
| `packages/dinero/src/live-chilecompra.probe.ts` | probe (manual) | request-response | `packages/probidad/src/live-infoprobidad.probe.ts` | exact |
| `packages/dinero/src/index.ts` | barrel | — | `packages/probidad/src/index.ts` | exact |
| `supabase/migrations/0023_dinero.sql` | migration | DDL | `supabase/migrations/0022_probidad.sql` + `0021_lobby.sql` | exact |
| `supabase/tests/0024_dinero.test.sql` | test (pgTAP) | — | `supabase/tests/0022_probidad.test.sql` | exact |
| `app/components/contratos-de-parlamentario.tsx` | component | request-response | `app/components/lobby-de-parlamentario.tsx` (+ `patrimonio-de-parlamentario.tsx`) | exact |
| `app/app/parlamentario/[id]/page.tsx` (MODIFY) | route shell | — | itself, lines 62-83 (lobby/patrimonio sections) | exact |
| `app/lib/types.ts` (MODIFY) | types | — | itself, `sourceLabel()` lines 343-352 | exact |

**Reused as-is (read-only, do NOT modify):**
- `packages/identity/src/deterministic.ts` — `isRutValido`, `normRut`
- `packages/identity/src/backfill-rut.ts` — DV-gate usage pattern
- `packages/identity/src/enlace-confirmado.ts` — `confirmar()` factory + `EnlaceConfirmado` type
- `app/lib/money-gate.ts` — `moneyPublicEnabled()`

---

## Pattern Assignments — Connector package `@obs/dinero`

Sibling-for-sibling map. `@obs/dinero` mirrors `@obs/probidad`'s file layout exactly (the only file in probidad with NO dinero counterpart is `sparql.ts` — replaced by ChileCompra REST query builders; CONTEXT §Claude's Discretion).

### `connector-chilecompra.ts` → `packages/probidad/src/connector-infoprobidad.ts`

The LOCKED `@obs/ingest` order is the load-bearing pattern. Copy verbatim, swap SPARQL for ChileCompra REST:

- **Inject deps + reuse @obs/ingest** (`connector-infoprobidad.ts:47-54`): `{ fetcher, rateLimiter, robots, allowlist? }`.
- **LOCKED fetch order** (`connector-infoprobidad.ts:87-103`):
  `assertAllowedUrl(url, allowlist)` → `robots.isAllowed(url)` → `rateLimiter.wait(host)` (2-3s) → `fetcher.get(...)`. NEVER `BaseConnector.run` (its daily cache would skip re-runs). NOTE: `mercadopublico.cl` IS already in `DEFAULT_ALLOWED_SUFFIXES` (`packages/ingest/src/allowlist.ts:27`) and `hostMatchesSuffix` matches subdomains, so `api.mercadopublico.cl` is already covered — expected outcome is "already present, no edit". Keep a verify-only step; do not edit the shared security-sensitive allowlist unless the suffix is genuinely absent. [CORRECTED — earlier draft wrongly said NOT present; RESEARCH.md is authoritative.]
- **Identificatory UA** (`connector-infoprobidad.ts:62-68`): keep the `Bot-Ciudadano/1.0` suffix; `Accept: application/json` (ChileCompra returns JSON, validate with zod per CLAUDE.md §1a).
- **Bloqueada error class** (`connector-infoprobidad.ts:37-45`): create `ChileCompraBloqueadaError(url, status)` mirroring `InfoProbidadBloqueadaError`; map 403/503 (and rate-limit/ticket-exhausted, e.g. 429) so `ingest-run` degrades honestly without aborting.

### `parse-chilecompra.ts` → `packages/probidad/src/parse-infoprobidad.ts`

Pure parser, no network. Returns the model rows; an unexpected response shape THROWS (caught by `ingest-run` as structural drift → quarantine). Validate the ChileCompra JSON with zod (CLAUDE.md §1a) and preserve literal money fields VERBATIM as strings (same discipline as probidad bienes — `model.ts:36-38`).

### `model.ts` → `packages/probidad/src/model.ts` (`model.ts:1-60`)

- **Provenance inline (FND-08)** (`model.ts:24-34`): every row carries `origen`, `fecha_captura`, `enlace`. Phase-14 NOTE: the source license is **"mención de la fuente"**, NOT `CC BY 4.0` — set `licencia` accordingly (UI-SPEC Copywriting), do not copy the `'CC BY 4.0'` default.
- **Version key**: probidad keys by `(fuenteId, fechaPresentacion)` (`model.ts:7-9`). For contracts, the version key is the ChileCompra record id + fecha de corte (Claude's discretion; mirror the "clave de versión accumulates, never overwrites" rule).
- Literal fields as `z.string().nullable()`, raw (`model.ts:41-60`); no computed sums/totals.
- **NEW vs probidad**: add a `contratista` sub-master row shape keyed by **proveedor RUT** + a `tipo_proveedor` ("natural" | "jurídica") tag (CONTEXT §natural-vs-jurídica). The contract subject is the proveedor entity, distinct from any parlamentario link.

### `reconciliar-contrato.ts` → `packages/probidad/src/reconciliar-declarante.ts`

**This is the one file that diverges in logic** — probidad links by NAME (source has no RUT); dinero links by **RUT-exact ONLY** (CONTEXT §Enlace RUT-exacto). Keep the SHAPE, swap the matcher:

- **Output shape** (`reconciliar-declarante.ts:72-108`): rows carry a branded `enlace: EnlaceConfirmado | null` + crude `mencion*` + `estadoVinculo: "confirmado" | "no_confirmado" | null`, plus the set of `parlamentariosConfirmados` (for `marcarIngestado`).
- **The guard** (`reconciliar-declarante.ts:164-178`): ONLY a deterministic/exact match mints `enlace = confirmar(id, "determinista")`; everything else → `enlace: null` + crude mención. NEVER fabricate a link.
- **REPLACE** the `correrPipeline` name-only call (`reconciliar-declarante.ts:140-162`) with a **RUT-exact join**: normalize both sides with `normRut`, require `isRutValido` on the proveedor RUT, and confirm ONLY on a unique exact match against the maestra's internal RUT (see RUT reuse below + `deterministic.ts:92-105` for the exact-RUT branch already written). No LLM provider needed — drop `PROVIDER_AUSENTE`/`correrPipeline` entirely.
- **IDENT-10 reality**: the maestra's internal RUT is NOT yet populated, so most parlamentarios have no internal RUT → no match → "no consultado todavía" honestly. Build it anyway (CONTEXT §RUT no poblado).

### `writer.ts` → `packages/probidad/src/writer.ts`

- **Interface + version key + in-memory fake** (`writer.ts:18-27`, `writer.ts:43-153`): `upsert*` (versioned, idempotent) + `marcarIngestado(parlamentarioIds, hasta)` writing the `*_ingesta_estado` marker (`writer.ts:148-152`). Re-run with same input → same counts.
- **NEW**: add a `contratista` sub-master upsert keyed by proveedor RUT (last-write-wins, mirror `dedupePorClave` in `writer-supabase.ts:46-51`).

### `writer-supabase.ts` → `packages/probidad/src/writer-supabase.ts`

- **Client + service key** (`writer-supabase.ts:74-83`): `createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false }})`; service key from env only, never interpolated into error messages.
- **Chunked idempotent upsert by `onConflict`** (`writer-supabase.ts:38-44`, `writer-supabase.ts:90-94`): `upsert(lote, { onConflict, ignoreDuplicates:false })`; on error `throw new Error(\`upsert X falló: ${error.message}\`)`.
- **Flat storage of the branded FK** (`writer-supabase.ts:54-69`): `parlamentario_id: f.enlace?.parlamentarioId ?? null`.
- **Ingesta marker upsert** (`writer-supabase.ts:261-271`): `onConflict: "parlamentario_id"` → `contratos_ingesta_estado`.

### `ingest-run.ts` → `packages/probidad/src/ingest-run.ts`

- **Per-task loop with honest degradation** (`ingest-run.ts:114-202`): bloqueada → push `degradaciones` and `continue` (NOT abort); structural drift → quarantine (0 rows, never fabricate); empty source → 0 rows.
- **Reconcile → upsert → mark** (`ingest-run.ts:182-207`): `reconciliarContrato(...)` → `writer.upsert(...)` → at the end `writer.marcarIngestado([...marcados], hasta)`.
- **Serial-by-RUT tasks**: replace `TareaDeclarante { nombre }` (`ingest-run.ts:28-31`) with `TareaRut { rut }` (serial sweep over the maestra's internal RUTs, CONTEXT §Estrategia; pgmq drives this in prod, GitHub Actions is the escape hatch for the bulk sweep).

### `ingest-cli.ts` → `packages/probidad/src/ingest-cli.ts`

- **Flag parse before any net/DB** (`ingest-cli.ts:62-85`); service key from env only (`ingest-cli.ts:93-98`); `--dry-run` or missing key → `InMemory*Writer` (never fabricate) (`ingest-cli.ts:103-125`).
- **Build REAL @obs/ingest collaborators** (`ingest-cli.ts:108-115`): `new Fetcher()`, `new HostRateLimiter()`, `new RobotsGuard({ allowlist: {} })`.
- **`isMain` entry-point guard** (`ingest-cli.ts:153-179`); swap `--nombre` flag for `--rut`.

### `live-chilecompra.probe.ts` → `packages/probidad/src/live-infoprobidad.probe.ts` (`live-infoprobidad.probe.ts:1-40`)

Manual LIVE probe (NOT CI): one real request respecting the 2-3s delay + UA, asserting the response shape. Mirror exactly.

### `index.ts` → `packages/probidad/src/index.ts`

Barrel re-exports. **Do NOT** re-export the branded `ENLACE_CONFIRMADO` symbol (it must stay module-private — `enlace-confirmado.ts:15-18`).

---

## Pattern Assignments — RUT / DV módulo-11 reuse (Phase 9 + identity)

The RUT-exact link MUST reuse existing identity symbols. Do NOT reimplement módulo-11.

| Need | Exact symbol | File:line |
|------|--------------|-----------|
| Validate proveedor RUT DV (módulo-11) | `isRutValido(rut)` | `packages/identity/src/deterministic.ts:63-78` |
| Normalize RUT for comparison (strip dots/dash, casefold k) | `normRut(rut)` | `packages/identity/src/deterministic.ts:52-54` |
| Exact-RUT unique-match branch (already written, currently dormant) | `matchDeterminista` RUT branch | `packages/identity/src/deterministic.ts:92-105` |
| DV-gate-before-write usage pattern (reject invalid → review log, never fabricate) | `aceptarRutBackfill` | `packages/identity/src/backfill-rut.ts:71-96` (imports at `:20`) |
| Mint the confirmed link (ONLY legitimate factory) | `confirmar(parlamentarioId, "determinista")` | `packages/identity/src/enlace-confirmado.ts:59-71` |
| Typed link invariant (FK type on the writer row) | `EnlaceConfirmado` | `packages/identity/src/enlace-confirmado.ts:36-43` |

**Rule (LOCKED, `enlace-confirmado.ts:13-25`):** the `ENLACE_CONFIRMADO` symbol is module-private; `confirmar()` is the ONLY factory. A grep gate rejects `confirmar(` outside reconciliation and `as ... EnlaceConfirmado` casts outside tests. A RUT with no unique exact match → `enlace: null`, never a fabricated link.

**Exact-RUT link logic** (from `deterministic.ts:98-104`): normalize the proveedor RUT with `normRut`, filter the maestra where `normRut(p.rut) === objetivo`; confirm ONLY when exactly one match (`porRut.length === 1`); 0 or 2+ → no confirmation. Gate the proveedor RUT through `isRutValido` first (`backfill-rut.ts:82` shows the gate).

---

## Pattern Assignments — Migration `0023_dinero.sql`

**Latest migration on disk = `0022_probidad.sql`. Next available = `0023`.** (NOTE: `0023_money_gate.test.sql` exists as a pgTAP test for Phase 13 but there is NO `0023_*.sql` migration file — Phase 13 was env-only. The next migration file number is 0023; pick the next free pgTAP number, `0024`, to avoid the existing `0023` test name collision — Claude's discretion per CONTEXT.)

Copy three section archetypes from 0022/0021:

### (1) Public-read table → `contrato` (mirror `declaracion`, `0022_probidad.sql:79-107`)
- Versioned composite PK (CONTEXT: never key by parlamentario alone — Pitfall 1): `primary key (fuente_id, fecha_corte)` style.
- Nullable `parlamentario_id text references parlamentario(id) on delete set null` + `mencion_*` crude + `estado_vinculo` (`0022:84-87`).
- Provenance inline NOT NULL (`0022:91-96`) — but `licencia` = "mención de la fuente", NOT the `'CC BY 4.0'` default.
- RLS public-read EXPLICIT (`0022:100-105`): `enable row level security` + `create policy ... for select to anon using (true)` + `grant select ... to anon`. Public contract facts must be readable or the ficha is blank.
- Index on `parlamentario_id` (`0022:107`).
- **GATE NOTE:** even though `contrato` itself is technically public-read content, the whole MONEY lane is OFF until F13 sign-off; the ficha is hidden by `moneyPublicEnabled()` (presentation chokepoint), and PII-bearing `contratista` is deny-by-default.

### (2) Deny-by-default PII table → `contratista` sub-master (mirror `lobby_contraparte`/`declaracion_familiar`, `0021_lobby.sql:64-98` / `0022_probidad.sql:250-279`)
Keyed by proveedor RUT. If it holds ANY PII (persona-natural name/RUT), copy VERBATIM:
- `alter table contratista enable row level security;` with **ZERO policies** (`0022:271`).
- **NO** `create policy ... to anon`, **NO** `grant select ... to anon`.
- `revoke all on contratista from anon, authenticated;` (`0022:279`, `0021:98`) — closes the Supabase default-privileges hole (LEGAL-03, Phase 11 lesson). service_role (writer) keeps its privileges + bypasses RLS.

### (3) Ingesta marker → `contratos_ingesta_estado` (mirror `probidad_ingesta_estado`, `0022_probidad.sql:361-368`)
- `parlamentario_id text primary key references parlamentario(id) on delete cascade`, `ingestado_hasta date`, `fecha_captura timestamptz not null default now()`.
- No PII → public-read: `enable row level security` + select policy + `grant select to anon` (`0022:366-368`). Lets the ficha distinguish "no consultado" (row absent) from "consultado sin contratos" (row present, 0 rows).

### (4) Security-definer RPC → `contratos_de_parlamentario(p_id text)` (mirror `declaraciones_de_parlamentario`, `0022_probidad.sql:287-302`)
- `language sql stable security definer set search_path = ''` (`0022:292`).
- Selects ONLY source-published fields (no internal `parlamentario_id`, no proveedor PII RUT unless intended public) where `parlamentario_id = p_id`, ordered fecha DESC (`0022:293-297`).
- `revoke execute on function ... from public;` + `grant execute on function ... to anon;` over the EXACT signature (`0022:301-302`). Sole public channel into the deny-by-default `contratista`.

### pgTAP test → `0024_dinero.test.sql` (mirror `0022_probidad.test.sql:1-70`)
- `begin; select plan(N);` then assert: tables exist + RLS enabled (`0022.test:18-41`); `contrato` PK is exactly the version key (`0022.test:46-53`); `contratista` deny-by-default = 0 policies + no anon SELECT grant (`0022.test:55-62`); `contrato` + marker public-read policy + grant (`0022.test:64-70`); RPC exists, is security definer, anon has EXECUTE. Application = operator checkpoint (CI does not prove the DDL ran); run via `supabase test db` with `--db-url` (BOM in `.env`).

---

## Pattern Assignments — Ficha section `app/components/contratos-de-parlamentario.tsx`

**Analog:** `app/components/lobby-de-parlamentario.tsx` (structure + 3-state) + `app/components/patrimonio-de-parlamentario.tsx` (`<dl>` discipline, attribution, stale).

- **Two exports, no `"use client"`** (`lobby-de-parlamentario.tsx:42-45`): `ContratosView` (pure, props-only, RTL-testable) + `ContratosSection` (Server Component reads gate + RPC + marker). NEW: `ContratosView` shows the **three** honest states (vs lobby's two — UI-SPEC §Layout).
- **`PAGE_SIZE = 20`** + `buildHref` preserving query, `#dinero` anchor, `?contratosPage=N` (`lobby:47`, `lobby:66-70`).
- **Intro line** muted `text-sm mb-4` (`lobby:101-107`) — Phase-14 copy is the exact UI-SPEC strings; source attribution line is the analog of patrimonio's `AtribucionCcBy` (`patrimonio-de-parlamentario.tsx:95`, `:208`) but says "mención de la fuente", NOT CC BY 4.0.
- **Three honest states** (extend lobby's `noIngestado` boolean, `lobby:109-134`): "No consultado todavía" (no internal RUT OR no marker row) / "Consultado sin contratos" (marker present, 0 RUT-exact rows) / "Enlazado" (≥1 row). Empty MUST NOT read as clean/positive (UI-SPEC Copywriting).
- **Per-row** `ProvenanceBadge` pushed right with `ml-auto` (`lobby:194-201`); `sourceName={sourceLabel(origen)}` → "ChileCompra".
- **Persona-jurídica subject** = the proveedor entity as crude text, mirror `ContraparteCruda` (`lobby:72-95`): proveedor name `text-base`, `(persona jurídica)` muted parenthetical, link fact as a SEPARATE muted line "Enlazado por RUT al parlamentario." — NEVER a possessive. Use `IdentityMarker` only if shown unconfirmed.
- **Literal contract fields** as NOUN-label + verbatim value via `<dl>`/`<dt>`/`<dd>` (`patrimonio-de-parlamentario.tsx:171-176`); UI computes nothing.
- **Server Component reads** (`lobby:282-344`): `sb.rpc("contratos_de_parlamentario", { p_id: id })`; **throw on `rpcError`** (#34, `lobby:303-307`) — a real error is NOT an empty state; read `contratos_ingesta_estado` via `.maybeSingle()` (`lobby:313-323`); server-driven pagination slice (`lobby:325-330`).
- **Gate inside the Server Component**: call `moneyPublicEnabled(process.env)` BEFORE any Supabase read; `false` → return `null` (no DOM, no skeleton). See Gate Consumption below.

### `app/lib/types.ts` (MODIFY) — `sourceLabel()` gap
`sourceLabel()` (`app/lib/types.ts:343-352`) has NO ChileCompra branch → currently returns "fuente desconocida" for contract rows. ADD a branch (place before the fallthrough):
```ts
if (o.includes("chilecompra") || o.includes("mercado")) return "ChileCompra";
```
Add the matching `ContratoRpcRow` interface alongside `DeclaracionRpcRow` (`types.ts:254-259`) and `LobbyAudienciaRpcRow`.

### `app/app/parlamentario/[id]/page.tsx` (MODIFY) — mount point
The shell already reserves the slot at lines 85-90 (the `<section id="dinero">` comment). ADD a NEW sibling `<section id="dinero" className="mt-12">` AFTER `#patrimonio` (`page.tsx:76-83`), mirroring the lobby/patrimonio blocks (`page.tsx:62-83`): its own `<h2>Contratos del Estado asociados al RUT</h2>` + `<Suspense fallback={<ContratosSkeleton />}>` + `<ContratosSection id={id} searchParams={sp} />`. Define `ContratosSkeleton` alongside the other skeletons (`page.tsx:143-170`), shape-matched to `ContratosView` (mirror `LobbySkeleton`/`PatrimonioSkeleton`). `mt-12` is the NON-NEGOTIABLE carril separator (anti-insinuación, Phase 11). The gate decides presence/absence of the whole `<section>`.

---

## Shared Patterns

### Exposure gate (server-only chokepoint, WR-02)
**Source:** `app/lib/money-gate.ts:30-34` — `moneyPublicEnabled(env = process.env)` returns `env.MONEY_PUBLIC_ENABLED === "true"` (strict literal, fail-closed OFF). `import "server-only"` (`money-gate.ts:1`) keeps it out of the browser bundle.
**Apply to:** the `<section id="dinero">` in `page.tsx` AND the public RPC read in `ContratosSection`. ALWAYS go through the function; NEVER read `MONEY_PUBLIC_ENABLED` raw. Wrap server-side: if `!moneyPublicEnabled(process.env)` → the section/component is fully absent (return `null` before any Supabase call). Default OFF until F13 legal sign-off.

### Typed-link invariant (no fabricated attribution)
**Source:** `packages/identity/src/enlace-confirmado.ts` — `confirmar()` is the only factory; `EnlaceConfirmado` brands the writer FK; storage flattens to `parlamentario_id: enlace?.parlamentarioId ?? null`.
**Apply to:** `reconciliar-contrato.ts` + both writers. RUT no-match → `null`, crude mención, `estado_vinculo` honest.

### Provenance + honest degradation
**Source:** `model.ts:24-34` (inline provenance NOT NULL) + `ingest-run.ts:114-202` (bloqueada/drift/empty → degrade or quarantine, never fabricate).
**Apply to:** model, parser, connector, ingest-run of `@obs/dinero`. R2 raw-snapshot is BLOCKED (proven) → omit it, leave a marker, do not block the phase (CONTEXT §Provenance).

---

## No Analog Found

None. Every artifact maps to an existing sibling. The only logic that is genuinely NEW (not copy-paste) is:
1. **RUT-exact reconciliation** (vs probidad's name-only) — but it reuses `isRutValido`/`normRut`/`confirmar` and the dormant exact-RUT branch at `deterministic.ts:92-105`.
2. **Three honest states** (vs lobby's two) — structural extension of the `noIngestado` boolean pattern.
3. **`contratista` sub-master** keyed by proveedor RUT — schema-shaped like the deny-by-default PII tables, deferred aggregation to Phase 16.

---

## Metadata

**Analog search scope:** `packages/probidad/src`, `packages/identity/src`, `supabase/migrations`, `supabase/tests`, `app/components`, `app/lib`, `app/app/parlamentario/[id]`
**Files scanned:** ~20
**Latest migration on disk:** `0022_probidad.sql` (next migration = `0023`; next free pgTAP = `0024`)
**Pattern extraction date:** 2026-06-19
