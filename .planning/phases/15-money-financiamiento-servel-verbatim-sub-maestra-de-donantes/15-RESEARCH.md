# Phase 15: MONEY Financiamiento — SERVEL verbatim + sub-maestra de donantes - Research

**Researched:** 2026-06-19
**Domain:** Ingesta verbatim de un repositorio de archivos Excel per-elección (SERVEL / gasto electoral), drift bloqueante + cuarentena, sub-maestra PII deny-by-default, enlace RUT-exacto, crudo → Supabase Storage, gate de exposición OFF.
**Confidence:** HIGH on the live source shape (probed it this session) · HIGH on the mirror pattern (read Phase 14 end to end) · MEDIUM on the xlsx-library choice (no slopcheck on Windows) · the single biggest finding is a LOCKED-decision tension (see Assumptions A1).

## Summary

The real SERVEL campaign-financing source is **not an API and not a `servel.cl` subdomain**. It is an **Azure Blob Storage repository** at `repodocgastoelectoral.blob.core.windows.net`, serving **per-election `.xlsx` files** under ad-hoc, per-election paths (e.g. `/public/Presidencial_Parlamentaria_2025/Definitivas/Reporte_Aportes_DEFINITIVAS_2025.xlsx`). I downloaded and parsed the live 2025 definitive file this session: ~16,257 data rows, 11 columns (A:K), one worksheet. This shape **justifies the "artesanal frágil" + BLOCKING-drift + quarantine design**: there is no stable API, no schema contract, the host is a third-party blob store (not in the gov allowlist), file paths drift by election/phase, and the columns are a hand-built spreadsheet whose headers could change between elections without notice.

**The load-bearing finding:** the published report has **NO RUT column** — neither for the donor (NOMBRE APORTANTE only) nor for the candidate (NOMBRE CANDIDATO-PARTIDO POLITICO only). I verified this directly (0 RUT-looking strings across all 5,042 shared strings). This collides with CONTEXT's LOCKED decision "enlace por RUT-exacto del candidato… nunca por nombre; sin match → sin atribución." With no candidate RUT in the source, the RUT-exact branch will **confirm zero rows** and the section will honestly read `verificado_sin_aportes` / `no_ingestado` for everyone — which is the safe, correct, fail-closed outcome and fully consistent with the IDENT-10 "RUT interno vacío" reality. The phase is still buildable exactly as specified; it just means the enlace pipeline is structurally dormant until a candidate-RUT bridge exists. This needs a one-line user confirmation (A1) — it is not a blocker, it is the honest state.

**Primary recommendation:** Mirror Phase 14 file-for-file (`connector` / `parse` / `reconciliar` / `writer` / `writer-supabase` / `ingest-run` / `ingest-cli` / `model`). Add `repodocgastoelectoral.blob.core.windows.net` as an **exact extra host** (NOT a gov suffix) to the SERVEL connector's allowlist. Parse the xlsx **verbatim, no LLM**, with a header-shape Zod-equivalent gate that THROWS on drift → run-level quarantine. Capture the file's `ETag`/`Content-MD5`/`Last-Modified` + the embedded cutoff marker (" APORTES TRANSFERIDOS AL 28-11-2025") + the in-sheet "TOTAL" as the completeness control; reconcile parsed-row count/total against it and **quarantine the whole run on mismatch (emit nothing)**. Write the raw `.xlsx` to **Supabase Storage** (R2 is 401) under `servel/<eleccion>/<fecha>/<hash>.xlsx`. Reuse `matchDeterminista` RUT branch + `confirmar()` exactly like `reconciliar-contrato.ts`; donor RUT never exists in source so it can never reach the LLM. Migration is **0024_servel.sql**. Remote apply, LIVE SERVEL fetch, and R2 migration are all OPERATOR checkpoints.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch SERVEL `.xlsx` (LIVE, rate-limited, allowlisted) | Connectors / ingest (`@obs/dinero`, Node+tsx) | GitHub Actions (escape hatch for the full per-election file) | Server-only; the source is a third-party blob host, never the browser. |
| Parse xlsx → rows VERBATIM (no LLM) + drift gate | Connectors / ingest (pure fn) | — | Pure, testable, fail-closed; a shape change THROWS. |
| Completeness reconciliation + quarantine | Connectors / ingest (run orchestration) | — | The quarantine boundary is the RUN, not the row. |
| Raw `.xlsx` → object storage | Connectors / ingest → **Supabase Storage** | R2 (deferred, 401) | Recoverability of the immutable crudo. |
| RUT-exact candidate link | Connectors / ingest (reuse `@obs/identity`) | — | Same `matchDeterminista`+`confirmar()` invariant as contratos. |
| Persist `aporte` / `donante` / marcador | Database (Supabase Postgres, migration 0024) | — | Versioned, idempotent, RLS deny-by-default on the PII table. |
| Public read (RPC, gated) | API (security-definer RPC) → Frontend SSR (gated section) | — | `moneyPublicEnabled()` candado B + RLS candado A. |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Conector SERVEL — ingesta verbatim + drift bloqueante**
  - Fuente/formato: `servel.cl` / `aportes.servel.cl` (agregar al allowlist `DEFAULT_ALLOWED_SUFFIXES`); parse **verbatim sin LLM**; el formato real (Excel/CSV/HTML descargable por elección) lo confirma research. *(Research correction: the real host is `repodocgastoelectoral.blob.core.windows.net`, an Azure blob store — NOT a `servel.cl` subdomain. See §SERVEL Source and A2. The allowlist edit is an exact-host addition on the SERVEL connector, NOT a `DEFAULT_ALLOWED_SUFFIXES` gov-suffix entry.)*
  - Drift **BLOQUEANTE** (NO el default no-bloqueante de v1.0): una corrida parcial se pone en **cuarentena** con reconciliación de completitud (conteos/totales por elección/candidato), nunca emite filas silenciosamente.
  - **Crudo → Supabase Storage** (decisión 2026-06-19): R2 devuelve 401; fallback a Supabase Storage. R2 = deuda de operador. No re-intentar R2 sin token nuevo verificado con `scripts/r2-probe.ts`.
  - Sub-maestra donantes: tabla `donante` cruda keyed por RUT donante (cuando exista) + nombre; deny-by-default a `anon` si contiene PII; construida en este bloque, no diferida a NET. *(Research: SERVEL does NOT publish a donor RUT in this report — only name + tipo. The `donante` table keys by name-derived id; the RUT column is nullable and will be NULL today. See A3.)*
- **Enlace + periodo electoral + estados honestos**
  - Enlace aporte→parlamentario: RUT-exacto del **candidato** contra la maestra interna (reusa `EnlaceConfirmado` RUT-only de Phase 9); **nunca por nombre**; sin match → sin atribución. *(Research: the source has NO candidate RUT either; the RUT branch confirms zero rows today — the safe, honest state. See A1.)*
  - Restricción por periodo electoral: cada aporte fechado y restringido por periodo; un aporte de una candidatura previa **nunca** se atribuye al mandato actual sin fecharlo (mostrar elección/periodo explícito).
  - Estados honestos: verificado / no-verificado / no-ingestado vía marcador de ingesta; un vacío nunca se lee como "limpio".
  - Dato sensible (afiliación, Ley 21.719): el RUT del donante queda interno/deny-by-default y pasa por la compuerta `data-routing` del LLM (ningún RUT/PII al LLM).
- **Ficha + gate de exposición**
  - Gate: sección financiamiento + RPC público detrás de `moneyPublicEnabled()` (default OFF); tablas deny-by-default a `anon` (RLS + `revoke all ... from anon, authenticated`).
  - Redacción/atribución: financiamiento **verbatim** con fuente/fecha/enlace por fila; atribución SERVEL = **términos por verificar** (NO CC BY 4.0); carril propio (`mt-12`) + `ProvenanceBadge`.
  - Anti-insinuación: sin lenguaje causal ni de afinidad; cada dataset en su propio carril.

### Claude's Discretion
- Nombres exactos de tablas/columnas y número de migración (siguiente tras 0023, = **0024**), consistentes con el esquema.
- Estructura interna del conector SERVEL dentro de `@obs/dinero` (espejando ChileCompra) y los parsers verbatim del formato real.
- API exacta del helper de Supabase Storage para el crudo (bucket, key versionada `servel/<eleccion>/<fecha>/<hash>`).

### Deferred Ideas (OUT OF SCOPE)
- Agregación de aportes por contraparte/donante — Phase 16.
- Encendido real de `MONEY_PUBLIC_ENABLED` + sign-off legal — operador (F13).
- Poblar el RUT interno de la maestra (IDENT-10) — operador; cobertura real ~0 hasta entonces.
- Migrar el crudo a R2 cuando el token R2 funcione (deuda operador).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MONEY-03 | Ingesta verbatim de aportes de campaña SERVEL, conector artesanal frágil con drift BLOQUEANTE → cuarentena ante corrida parcial; sub-maestra de donantes; crudo a object storage. | §SERVEL Source (live shape, why fragile), §BLOCKING Drift (control total = in-sheet "TOTAL" + cutoff marker + Content-MD5/ETag; quarantine boundary = run), §Raw → Supabase Storage, §DB + Gate (`aporte`, `donante`, `aportes_ingesta_estado`). |
| MONEY-04 | Enlace RUT-exacto del candidato + restricción por periodo electoral + estados honestos + gate de exposición OFF + RPC público gateado. | §RUT-exact Candidate Link (reuse `matchDeterminista`+`confirmar()`), §DB + Gate (RPC `aportes_de_parlamentario` grouped by election, RLS deny-by-default + revoke, `moneyPublicEnabled`), A1 (no candidate RUT in source → RUT branch dormant, honest fail-closed). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD enforcement:** all edits go through a GSD workflow; this is research only (no edits).
- **Tech stack single-language TS:** the `@obs/dinero` package is a **Node + tsx + vitest** package (`package.json` shows `tsx`/`vitest`, not Deno). The xlsx parser MUST run under Node/tsx, not only Deno. This narrows library choice (see §Standard Stack).
- **Ingesta respetuosa:** rate-limit 2–3s, identifying User-Agent, robots.txt, daily cache. The SERVEL connector reuses `@obs/ingest`'s `Fetcher`+`HostRateLimiter`+`RobotsGuard` in the LOCKED order (`assertAllowedUrl → robots → rateLimiter.wait → fetcher.get`), exactly like `ChileCompraConnector`.
- **Secrets in `.env`:** no SERVEL secret is needed — the blob files are public (anonymous GET, HTTP 200 confirmed). No `clave única` is required to DOWNLOAD the published report (only to MAKE a contribution). Do not add a SERVEL credential to `.env`.
- **Atribución:** SERVEL licence is "mención de la fuente / términos por verificar", NOT CC BY 4.0 (mirror of ChileCompra's `LICENCIA_DINERO = "mencion de la fuente"`).
- **Legal gate:** the whole public surface stays behind `moneyPublicEnabled()` (default OFF) until F13 sign-off.

## SERVEL Campaign-Financing Data Source (the real source)

> Confidence: **HIGH** — I downloaded and parsed the live files this session (2026-06-19).

### Where it actually lives

| Property | Value | Source |
|----------|-------|--------|
| Discovery page | `https://www.servel.cl/documentos-2025/` links the reports | [CITED: servel.cl/documentos-2025] |
| **Real data host** | `repodocgastoelectoral.blob.core.windows.net` (Azure Blob Storage, **NOT a servel.cl subdomain**) | [VERIFIED: live HEAD 200 this session] |
| Access shape | **Per-election downloadable `.xlsx` file** (anonymous public GET, no auth, no API) | [VERIFIED: curl HEAD + download] |
| Example URL (2025 definitive) | `/public/Presidencial_Parlamentaria_2025/Definitivas/Reporte_Aportes_DEFINITIVAS_2025.xlsx` (899 KB, `Content-Type: application/vnd.openxmlformats…spreadsheetml.sheet`, `Last-Modified: 2025-11-28`, `Content-MD5: 8Cp3XDQFfgf049h9Lhv7pA==`, has `ETag`) | [VERIFIED: live] |
| Example URL (2025 primaries) | `/public/Presidencial_Parlamentaria_2025/Primarias/Reporte_Aportes_PRIMARIAS_2025.xlsx` (72 KB, `Last-Modified: 2025-10-14`, own `Content-MD5`/`ETag`) | [VERIFIED: live] |
| Path pattern | `/public/<Eleccion>/<Fase: Definitivas|Primarias>/Reporte_Aportes_<FASE>_<YEAR>.xlsx` — **ad-hoc, drifts per election/phase** | [VERIFIED: two live examples; `[ASSUMED]` it generalizes] |
| `aportes.servel.cl` | A `clave única`-gated **transactional** portal for MAKING contributions — NOT a data source. Do NOT scrape it. | [CITED: servel.cl/aportes] |
| `servel.cl` open-data initiative | Promises to consolidate financing data "en el mediano plazo" — not a stable dataset today. | [CITED: servel.cl iniciativa datos abiertos] |

### Exact column schema (verified from the live 2025 definitive file)

The single worksheet (`sheet1`, dimension `A4:K16261`, ~16,257 data rows) has these 11 headers (row 4), all UPPERCASE, all text:

| # | Header (verbatim) | Meaning | Maps to |
|---|-------------------|---------|---------|
| A | `TIPO DE APORTE` | e.g. `APORTE MENOR SIN PUBLICIDAD`, `APORTE CON PUBLICIDAD`, `APORTE DE PARTIDO POLITICO` | `tipo_aporte` |
| B | `NOMBRE APORTANTE` | Donor name (or `-` for anonymous "aporte menor sin publicidad") | `donante_nombre` |
| C | `TIPO APORTANTE` | e.g. `PERSONA NATURAL` (and presumably `PERSONA JURIDICA`) | `tipo_persona` |
| D | `NOMBRE CANDIDATO-PARTIDO POLITICO` | **Candidate/party name — by NAME, no RUT** | candidate mención (name) |
| E | `TIPO DONATARIO` | e.g. `CANDIDATO` | donatario tipo |
| F | `ELECCION` | e.g. `DIPUTADO` | part of `eleccion` (combine with year/territory) |
| G | `TERRITORIO ELECTORAL` | e.g. `DISTRITO 23`, `DISTRITO 6` | `territorio` |
| H | `PACTO` | e.g. `CAMBIO POR CHILE`, `UNIDAD POR CHILE` | `pacto` |
| I | `PARTIDO` | e.g. `PARTIDO REPUBLICANO DE CHILE` | `partido` |
| J | `FECHA DE TRANSFERENCIA` | contribution date | `fecha_aporte` |
| K | `MONTO` | amount (verbatim string — never compute) | `monto` |

Title banner (row above headers): `ELECCIONES PRESIDENCIALES Y PARLAMENTARIAS 2025`. A trailing **footer** contains a `TOTAL` label and the cutoff marker ` APORTES TRANSFERIDOS AL 28-11-2025` (a corte/control row) — **load-bearing for the completeness reconciliation** (see §BLOCKING Drift).

### The PII / RUT reality (critical)

- **No donor RUT** is published (0 RUT-looking strings across all 5,042 shared strings). Donors appear by **name + tipo only**. The Ley 21.719 sensitive-data concern still holds (a named contribution can reveal political affiliation), so the donor still goes deny-by-default — but there is **no RUT to redact** because the source never had one.
- **No candidate RUT** either — the candidate is `NOMBRE CANDIDATO-PARTIDO POLITICO`, a name. This is the central tension with the LOCKED "RUT-exacto del candidato, nunca por nombre" rule. **Outcome:** the RUT-exact branch confirms **zero** rows today, which is the fail-closed, honest behavior (identical to the IDENT-10 "RUT interno vacío" reality already shipped). See A1 — needs a one-line user confirmation, not a redesign.

### Why this source is "artesanal frágil" (justifies BLOCKING + quarantine)

1. **No API, no schema contract** — a hand-built spreadsheet, not a versioned endpoint.
2. **Third-party host** — `*.blob.core.windows.net` is outside the gov allowlist; the URL is not under SERVEL's own DNS, so it can move.
3. **Per-election path drift** — `<Eleccion>/<Fase>/…` differs every election; no canonical "latest" URL.
4. **Header/format drift risk** — UPPERCASE Spanish headers in a free-form sheet; a column rename or reorder between elections silently breaks a positional parser. This is exactly why the parser must gate on **header text**, not column position, and THROW on mismatch.
5. **Whole-file semantics** — the file is the entire universe for an election; a truncated/partial download (or a mid-publish file) yields a silently incomplete dataset. Hence **run-level quarantine**, not row-level tolerance.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@obs/ingest` (workspace) | local | `Fetcher` + `HostRateLimiter` + `RobotsGuard` + `assertAllowedUrl` in the LOCKED order | Already the connector substrate for ChileCompra; reuse verbatim. [VERIFIED: read source] |
| `@obs/identity` (workspace) | local | `matchDeterminista` (RUT branch), `confirmar()`, `EnlaceConfirmado`, `normRut`, `isRutValido` | The RUT-exact invariant; reuse exactly as `reconciliar-contrato.ts` does. [VERIFIED: read source] |
| `@supabase/supabase-js` | `^2.108.2` (already a dep of `@obs/dinero`) | DB upserts (service key) **and** Storage upload (`.storage.from(bucket).upload`) | Already vendored; the same client does Storage. No new dep for storage. [VERIFIED: package.json + supabase-js API] |
| `zod` | `^4.4.3` (already a dep) | Shape gate on the parsed header/row model → THROW on drift | Mirror of `OrdenesResponseSchema`. [VERIFIED: package.json] |

### Supporting (NEW — the one external dependency this phase adds)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `exceljs` | `4.4.0` | Parse the `.xlsx` to rows under **Node/tsx** (the package is Node+vitest, not Deno) | RECOMMENDED. Mature (166 versions, GitHub-backed, maintainers `guyonroche`/`siemienik`), pure-JS, reads xlsx by header. Heavier dep tree (`jszip`, `saxes`, `archiver`, `unzipper`). [ASSUMED — slopcheck could not run on Windows; gate behind checkpoint] |
| `@e965/xlsx` | `0.20.3` | Alternative: maintained mirror of SheetJS (lighter, pure-JS) | Use IF you want a smaller dep tree and a simpler `sheet_to_json` API. The original `xlsx` on npm (`0.18.5`) is **abandoned on the registry** (SheetJS moved to a self-hosted CDN after CVE-2023-30533); prefer the `@e965` mirror over bare `xlsx`. [ASSUMED — verify provenance at checkpoint] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `exceljs` | `@e965/xlsx` (SheetJS mirror) | Lighter, simpler API, but SheetJS's npm story is messy (abandoned `xlsx`, CVE history). `exceljs` is heavier but unambiguously maintained. Pick ONE at the checkpoint. |
| xlsx parser | Convert xlsx→CSV out-of-band | Avoids the lib but adds a manual operator step that breaks the automated, idempotent pipeline. Reject. |
| `exceljs`/`@e965/xlsx` | bare `xlsx@0.18.5` from npm | **Do NOT** — abandoned on the registry, CVE-2023-30533 (prototype pollution) only fixed on the SheetJS CDN, not the npm artifact. |

**Installation (at the connector package, AFTER the legitimacy checkpoint):**
```bash
# pick ONE at the checkpoint:
pnpm --filter @obs/dinero add exceljs        # recommended
# or
pnpm --filter @obs/dinero add @e965/xlsx
```

**Version verification (run this session):**
- `exceljs@4.4.0` — `npm view` OK; repo `github.com/exceljs/exceljs`; `time.modified 2024-12-20`; 166 versions; maintainers present. [VERIFIED: npm registry metadata — but provenance for the build must still pass the checkpoint]
- `@e965/xlsx@0.20.3` — `npm view` OK. [ASSUMED — verify it is the legitimate SheetJS mirror at checkpoint]

## Package Legitimacy Audit

> slopcheck 0.6.1 is installed but **fails to run on Windows** (it shells out to `npm` via `subprocess` and hits `WinError 2`). Per the graceful-degradation protocol, the new xlsx library is tagged `[ASSUMED]` and the planner MUST gate its install behind a `checkpoint:human-verify` task.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `exceljs` | npm | mature (166 versions, modified 2024-12) | very high (well-known) | `github.com/exceljs/exceljs` | unavailable (Win) | **Flagged [ASSUMED]** — planner adds checkpoint before install |
| `@e965/xlsx` | npm | `0.20.3` | moderate | SheetJS mirror | unavailable (Win) | **Flagged [ASSUMED]** — verify it is the genuine SheetJS mirror at checkpoint |
| `xlsx` (bare) | npm | `0.18.5` ABANDONED on registry | high (legacy) | self-hosted CDN | n/a | **REMOVED** — CVE-2023-30533, registry artifact unmaintained |

**Packages removed due to known-bad verdict:** `xlsx` (bare npm artifact — abandoned + CVE).
**Packages flagged [ASSUMED] (planner inserts `checkpoint:human-verify` before install):** `exceljs`, `@e965/xlsx` (operator picks one).

All other dependencies (`@supabase/supabase-js`, `zod`, `@obs/*`) are already vendored in `@obs/dinero` — no new install.

## Architecture Patterns

### System Architecture Diagram

```
                         OPERATOR checkpoint: LIVE fetch
                                     │
   pg_cron / GitHub Actions ───▶ SERVEL ingest-cli (--eleccion <slug> --url <blob-url> [--dry-run])
                                     │
                                     ▼
   ┌──────────────────────── ServelConnector (mirror ChileCompraConnector) ───────────────────────┐
   │  assertAllowedUrl(url, {extraHosts:["repodocgastoelectoral.blob.core.windows.net"]})           │
   │    → robots.isAllowed → rateLimiter.wait(host) → fetcher.get(.xlsx bytes)                       │
   │  captures: ETag, Content-MD5, Last-Modified, byte length (drift/idempotency anchors)            │
   └───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                    │ raw .xlsx bytes
                       ┌────────────────────────────┼───────────────────────────────────┐
                       ▼                                                                  ▼
        ┌── raw → Supabase Storage ──┐                            ┌── parse-servel (pure, no LLM) ──┐
        │ bucket "crudo-servel"      │                            │ exceljs/@e965 → rows             │
        │ key servel/<eleccion>/     │                            │ HEADER-TEXT gate (zod-equiv):    │
        │   <fecha>/<hash>.xlsx      │                            │  missing/renamed col → THROW     │
        │ idempotent (upsert:false,  │                            │ MONTO/FECHA kept VERBATIM string │
        │  hash in key)              │                            └───────────────┬──────────────────┘
        └────────────────────────────┘                                            │ Aporte[] verbatim
                                                                                   ▼
                                       ┌──── COMPLETENESS RECONCILIATION (run-level) ─────┐
                                       │ control total = in-sheet "TOTAL" + cutoff marker │
                                       │ + Content-MD5 match; parsed_count vs declared    │
                                       │   ─ MISMATCH ─▶ QUARANTINE whole run, emit 0 ────┼──▶ degradación{cuarentena:true}
                                       │   ─ MATCH    ─▶ continue                          │
                                       └───────────────────────┬──────────────────────────┘
                                                               ▼
                            reconciliar-aporte (RUT-exact candidate link, mirror reconciliar-contrato)
                              matchDeterminista RUT branch + confirmar() → EnlaceConfirmado | null
                              (NO candidate RUT in source today → all null = honest fail-closed)
                                                               ▼
                            SupabaseServelWriter (service key, idempotent versioned upsert)
                              aporte (public-read, versioned)  ·  donante (deny-by-default + revoke)
                              aportes_ingesta_estado (marcador por parlamentario)
                                                               ▼
                            RPC aportes_de_parlamentario(p_id)  ── grouped period DESC, fecha DESC
                              security definer, revoke from public, grant execute anon
                                                               ▼
                            Frontend SSR  ── moneyPublicEnabled() OFF by default (candado B)
                              FinanciamientoSection → View (grouped by elección)
```

### Recommended Project Structure (new files in `packages/dinero/src/`)
```
packages/dinero/src/
├── connector-servel.ts        # mirror connector-chilecompra.ts (fetch .xlsx, capture ETag/MD5)
├── parse-servel.ts            # xlsx → Aporte[] VERBATIM + header-text drift gate (THROW)
├── reconciliar-aporte.ts      # mirror reconciliar-contrato.ts (RUT-exact candidate; null today)
├── reconciliar-completitud.ts # NEW: control-total vs parsed reconciliation → quarantine signal
├── storage-supabase.ts        # NEW: raw .xlsx → Supabase Storage (servel/<eleccion>/<fecha>/<hash>)
├── writer-servel.ts           # InMemory + interface (mirror writer.ts)
├── writer-supabase-servel.ts  # SupabaseServelWriter (mirror writer-supabase.ts)
├── ingest-run-servel.ts       # mirror ingest-run.ts; quarantine boundary = the RUN
├── ingest-cli-servel.ts       # mirror ingest-cli.ts; --dry-run, env-only secrets
└── model-servel.ts            # Aporte/Donante types + AporteSheetSchema (zod) + ORIGEN/LICENCIA
```
(Or fold into the existing files; CONTEXT leaves internal structure to discretion. Separate `-servel` files keep the ChileCompra connector untouched.)

### Pattern 1: Fetch with an EXACT extra host (not a gov suffix)
**What:** SERVEL's blob host is not gov-suffixed, so it must be allowed as an **exact host**, scoped to the SERVEL connector only — never added to `DEFAULT_ALLOWED_SUFFIXES` (that would widen SSRF for every connector).
**When:** the connector's `assertAllowedUrl` call.
```ts
// Source: mirror of connector-chilecompra.ts fetchJson + allowlist.ts assertAllowedUrl
const SERVEL_HOST = "repodocgastoelectoral.blob.core.windows.net";
// blob.core.windows.net is https-only and public; pass it as an EXACT extraHost.
const url = new URL(rawUrl);
assertAllowedUrl(rawUrl, { extraHosts: [SERVEL_HOST] }); // exact host, NOT a suffix
// NOTE: extraHosts currently also permits http; SERVEL is https — keep the URL https.
// If you want to forbid http for this host, add a one-line https assertion after.
```
**Anti-pattern:** adding `core.windows.net` (or `blob.core.windows.net`) to `DEFAULT_ALLOWED_SUFFIXES` — that would allowlist *every Azure tenant's* blob storage for *every* connector. Scope it to SERVEL, exact host.

### Pattern 2: Header-TEXT drift gate (not positional)
**What:** validate the parsed sheet by **header labels**, not column indices. A rename/reorder THROWS → quarantine.
```ts
// Source: mirror of OrdenesResponseSchema gate in parse-chilecompra.ts
const EXPECTED_HEADERS = [
  "TIPO DE APORTE","NOMBRE APORTANTE","TIPO APORTANTE",
  "NOMBRE CANDIDATO-PARTIDO POLITICO","TIPO DONATARIO","ELECCION",
  "TERRITORIO ELECTORAL","PACTO","PARTIDO","FECHA DE TRANSFERENCIA","MONTO",
] as const;
// after reading row 4 labels:
const got = headerRow.map((h) => String(h ?? "").trim().toUpperCase());
const missing = EXPECTED_HEADERS.filter((h) => !got.includes(h));
if (missing.length > 0) {
  throw new Error(`drift estructural SERVEL: faltan columnas [${missing.join(", ")}]`);
} // upstream → run-level quarantine, emit 0 rows (never silent partial)
```

### Pattern 3: Raw → Supabase Storage (idempotent, versioned key)
```ts
// Source: @supabase/supabase-js Storage API (createClient already in writer-supabase.ts)
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const key = `servel/${eleccionSlug}/${fechaCorte}/${sha256Hex}.xlsx`;
const { error } = await supabase
  .storage.from("crudo-servel")                 // bucket created via SQL/dashboard (operator)
  .upload(key, bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: false,                              // hash in key ⇒ same content = same key = idempotent
  });
// "Duplicate"/409 on re-run of identical content is EXPECTED idempotency, not an error — swallow it.
if (error && !/exists|duplicate|409/i.test(error.message)) throw new Error(`storage SERVEL: ${error.message}`);
```
**Bucket:** create `crudo-servel` (private) once — this is an **operator/SQL step** (`storage.buckets` insert or dashboard), not done by the connector at runtime. Mirror the "DDL = operator checkpoint" rule. The connector uses the **service key** (bypasses Storage RLS), same as the DB writer.

### Anti-Patterns to Avoid
- **Row-level drift tolerance:** ChileCompra tolerates a blocked RUT and degrades that RUT. SERVEL is ONE file = the whole universe; a partial parse must **quarantine the whole run**. Do not copy ChileCompra's per-RUT continue semantics for the drift case.
- **Positional column parsing:** breaks silently on reorder. Gate on header text.
- **Computing `monto`:** keep it a verbatim string (mirror of `monto: text` in 0023). Never sum/rank/parse to number.
- **Name-based candidate linking:** forbidden by CONTEXT and the `EnlaceConfirmado` invariant. The source has no candidate RUT → enlace stays null. Never fall back to name (the grep gate from Phase 9 forbids `confirmar(` outside the reconciler anyway).
- **Donor RUT to the LLM:** there is no donor RUT in the source, and this phase uses **no LLM** at all (verbatim parse). Keep it that way.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| xlsx parsing | A hand-rolled OOXML/zip+XML reader | `exceljs` or `@e965/xlsx` (post-checkpoint) | I had to unzip + regex sharedStrings just to inspect — fine for probing, a trap for production (styles, shared strings, inline strings, dates-as-serials). |
| RUT validity / normalization | New module-11 / strip logic | `isRutValido`, `normRut` from `@obs/identity` | Already canonical; re-impl drifts. |
| Confirmed link minting | `parlamentario_id: string \| null` by hand | `confirmar()` → `EnlaceConfirmado` | The branded type is the invariant; a raw string won't compile in the writer FK. |
| Idempotent versioned upsert | Custom dedup | `upsert(..., { onConflict })` with `fecha_corte` in the key | Mirror `writer-supabase.ts`; versions accumulate, re-runs don't duplicate. |
| Object storage client | New S3/HTTP client | `supabase.storage.from(bucket).upload` on the existing client | No new dep; R2 is 401 anyway. |
| Allowlist / SSRF | New URL check | `assertAllowedUrl(url, { extraHosts })` | Already covers SSRF; just pass the exact SERVEL host. |

**Key insight:** This phase is ~90% mirror of Phase 14. The only genuinely new pieces are (1) the xlsx parser, (2) the run-level completeness reconciliation + quarantine boundary, and (3) the Supabase Storage helper. Everything else is copy-and-adapt.

## Runtime State Inventory

> This is a greenfield ingestion slice (new tables, new connector, gate OFF) — there is no rename/refactor of existing runtime state. Included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New tables only (`aporte`, `donante`, `aportes_ingesta_estado`). No existing data renamed. | migration 0024 (operator apply) |
| Live service config | **New Supabase Storage bucket `crudo-servel`** must be created out-of-band (SQL `storage.buckets` insert or dashboard) — this is config that lives in the DB, not git. | OPERATOR checkpoint (create bucket) |
| OS-registered state | None — no Task Scheduler / cron registration is created by the migration (mirror of 0021/0022/0023: pg_cron is an operator checkpoint, not in the DDL). | None |
| Secrets/env vars | **No new SERVEL secret** (public blob, anonymous GET). Reuses `SUPABASE_*` + `MONEY_PUBLIC_ENABLED`. Possibly add `SERVEL_CRUDO_BUCKET=crudo-servel` (optional, defaultable in code). | None required / optional env doc |
| Build artifacts | New external dep (`exceljs` or `@e965/xlsx`) added to `packages/dinero/package.json` → `pnpm install` needed after the checkpoint. | install after checkpoint |

## Common Pitfalls

### Pitfall 1: Treating SERVEL like ChileCompra's per-RUT tolerance
**What goes wrong:** copying `ingest-run.ts`'s "block one RUT, continue" semantics for a drift in the SERVEL file → a partial/incomplete file gets emitted as if complete.
**Why:** the SERVEL file is the whole universe for an election; there is no per-RUT boundary.
**Avoid:** the quarantine boundary is the **RUN** (one election file). Any drift or completeness mismatch → emit 0 rows for the whole election, mark a `degradación{cuarentena:true}`.
**Warning sign:** a code path that pushes *some* aportes after catching a parse error.

### Pitfall 2: Positional column parsing
**What goes wrong:** the parser reads `row[3]` as candidate; SERVEL reorders columns next election; every aporte is misattributed.
**Avoid:** map by header text (Pattern 2). Missing/renamed header → THROW.
**Warning sign:** numeric column indices in the parser.

### Pitfall 3: Adding the blob host as a gov suffix
**What goes wrong:** `core.windows.net` in `DEFAULT_ALLOWED_SUFFIXES` opens SSRF to every Azure tenant for every connector.
**Avoid:** exact `extraHosts` scoped to the SERVEL connector (Pattern 1).
**Warning sign:** an edit to `allowlist.ts` `DEFAULT_ALLOWED_SUFFIXES` for this phase.

### Pitfall 4: Migration applied = CI green (false positive)
**What goes wrong:** build/typecheck pass but Postgres never ran the DDL (same lesson as 0023's header comment).
**Avoid:** remote apply via `supabase db push --db-url "$SUPABASE_DB_URL"` (BOM workaround), verified by pgTAP against an applied schema. This is an OPERATOR checkpoint.
**Warning sign:** a plan task that asserts the migration "done" from a typecheck.

### Pitfall 5: Expecting a donor or candidate RUT
**What goes wrong:** the parser/reconciler assumes a RUT column that doesn't exist → NPEs or fabricated keys.
**Avoid:** model donor by name (RUT column nullable, NULL today); candidate link via `matchDeterminista` RUT branch that simply confirms nothing today (honest null).
**Warning sign:** any `normRut(row.candidatoRut)` — there is no such field.

### Pitfall 6: Empty section read as "clean"
**What goes wrong:** zero confirmed aportes rendered as "sin aportes ✓".
**Avoid:** the three honest states (`no_ingestado` / `verificado_sin_aportes` / `enlazado`) from the UI-SPEC; empty is muted prose, never green/✓. (Already fully specified in 15-UI-SPEC.md.)

## Code Examples

### Completeness reconciliation → quarantine (the BLOCKING-drift heart)
```ts
// Source: derived from the live file's footer ("TOTAL" + " APORTES TRANSFERIDOS AL <fecha>")
// and the HTTP Content-MD5/ETag captured by the connector.
interface ControlTotal {
  declaredRowCount?: number;   // if a numeric "TOTAL" footer is parseable
  cutoffLabel?: string;        // " APORTES TRANSFERIDOS AL 28-11-2025"
  contentMd5?: string;         // from the HTTP header, base64
}
function reconciliarCompletitud(parsed: Aporte[], ctrl: ControlTotal, bytesMd5: string):
  { ok: true } | { ok: false; motivo: string } {
  if (ctrl.contentMd5 && ctrl.contentMd5 !== bytesMd5)
    return { ok: false, motivo: "Content-MD5 del archivo no coincide (descarga parcial/alterada)" };
  if (ctrl.declaredRowCount != null && ctrl.declaredRowCount !== parsed.length)
    return { ok: false, motivo: `conteo declarado ${ctrl.declaredRowCount} != parseado ${parsed.length}` };
  return { ok: true };
}
// in ingest-run-servel: if (!result.ok) → QUARANTINE the run, write 0 aportes, mark degradación.
```
> Note: the numeric "TOTAL" footer value was not extractable from shared-strings alone (it is a computed/numeric cell). At minimum, use **Content-MD5 equality** (always present on the HTTP HEAD) + **byte-length** as the control; the row-count footer is a best-effort secondary check. This is enough to make a partial/truncated download fail-closed. [VERIFIED: Content-MD5 + ETag present on live HEAD; numeric footer = `[ASSUMED]` extractable via exceljs cell read]

### RUT-exact candidate link (mirror reconciliar-contrato.ts)
```ts
// Source: reconciliar-contrato.ts lines 104-129 (read this session)
if (!isRutValido(candidatoRut)) { estadoVinculo = "cuarentena"; }   // no candidato RUT today → N/A path
else {
  const res = matchDeterminista({ rut: normRut(candidatoRut), nombreNormalizado: "", camara, periodo }, maestra);
  if (res.estado === "confirmado" && res.metodo === "rut") {
    enlace = confirmar(res.id, "determinista"); estadoVinculo = "confirmado";
  } else estadoVinculo = "no_confirmado";
}
// TODAY: candidatoRut does not exist in the source → enlace stays null for every row (honest).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xlsx` (SheetJS) on npm | self-hosted SheetJS CDN OR `@e965/xlsx` mirror | post-2023 (CVE-2023-30533) | Don't `npm i xlsx`; use `exceljs` or the `@e965` mirror. |
| R2 for crudo | Supabase Storage | 2026-06-19 (R2 401) | Storage helper, not S3 client. |
| CONTEXT assumed `servel.cl`/`aportes.servel.cl` data | Azure blob `repodocgastoelectoral.blob.core.windows.net` per-election `.xlsx` | this research | Allowlist = exact extra host; parser = xlsx, not HTML/JSON. |

**Deprecated/outdated:**
- `aportes.servel.cl` as a data source — it's a `clave única` transactional portal, not a dataset.
- Bare `xlsx@0.18.5` npm artifact — abandoned + CVE.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The source publishes **no candidate RUT**, so the RUT-exact branch confirms 0 rows today; this is the honest fail-closed state and is acceptable for this phase (the section will read `no_ingestado`/`verificado_sin_aportes` for everyone until a candidate-RUT bridge exists, e.g. matching SERVEL candidate name → maestra → RUT in a later phase). | Summary, SERVEL Source, RUT-exact Link | If the user expected visible enlaced aportes this phase, expectations must reset — the data simply doesn't support a RUT link yet. **Needs one-line user confirmation.** |
| A2 | The per-election URL pattern `/public/<Eleccion>/<Fase>/Reporte_Aportes_<FASE>_<YEAR>.xlsx` generalizes to future/past elections (only 2 live examples verified). | SERVEL Source | The connector may need the full URL passed per-run (which the CLI design already allows via `--url`), so low risk — treat the URL as an operator input, not a hardcoded pattern. |
| A3 | The `donante` table's RUT column is nullable and NULL today (source has no donor RUT). | DB + Gate, SERVEL Source | If a future SERVEL export adds donor RUT, the column is ready; no schema change risk. |
| A4 | `exceljs@4.4.0` (or `@e965/xlsx@0.20.3`) is the right parser and is legitimate. | Standard Stack, Legitimacy Audit | slopcheck didn't run (Windows). **Gate install behind `checkpoint:human-verify`.** |
| A5 | The numeric "TOTAL" footer is extractable via exceljs as a row-count/amount control (only the label was visible in shared strings). | BLOCKING Drift, Code Examples | If not extractable, fall back to Content-MD5 + byte-length as the control (always available) — still fail-closed. Low risk. |
| A6 | SERVEL's `robots.txt` (and the blob host's) permits the GET. The connector runs `robots.isAllowed` already; if it disallows, the run degrades honestly. | Architecture | If disallowed, this becomes an operator/legal question, not a code bug. |

## Open Questions

1. **Candidate-RUT bridge (the A1 question).**
   - What we know: SERVEL gives candidate NAME only; the maestra keys on RUT; CONTEXT forbids name linking.
   - What's unclear: whether a later phase will add a name→RUT bridge for SERVEL candidates (distinct from the donor side).
   - Recommendation: build the RUT-exact branch now (dormant, honest null), confirm A1 with the user, and defer any name→RUT candidate bridge to a future phase.
2. **`eleccion` field construction.**
   - The period grouping (UI-SPEC LOCKED #2) needs a verbatim `eleccion`/period string. The file gives `ELECCION` (e.g. `DIPUTADO`) + `TERRITORIO ELECTORAL` (e.g. `DISTRITO 23`) + the title year (`2025`).
   - Recommendation: compose `eleccion` verbatim as e.g. `"DIPUTADO — DISTRITO 23 — 2025"` (keep parts verbatim; do not normalize). Confirm the exact concatenation with the planner.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| SERVEL blob `.xlsx` (LIVE) | ingestion | ✓ (HTTP 200 this session) | 2025 def. 899KB / prim. 72KB | — (operator runs LIVE fetch as a checkpoint) |
| Supabase remote DDL (`db push --db-url`) | migration 0024 | ✓ (per env-credentials memory; BOM workaround) | sa-east-1 pooler | local docker pgTAP first |
| Supabase Storage | raw crudo | ✓ (same supabase-js client, service key) | supabase-js ^2.108.2 | git JSON snapshot (as in earlier phases) |
| R2 S3 | raw crudo (original) | ✗ (401, re-probed 2026-06-19) | — | **Supabase Storage (the chosen path)** |
| `exceljs`/`@e965/xlsx` | xlsx parse | ✗ (not yet installed) | 4.4.0 / 0.20.3 | install after checkpoint |
| Node/tsx/vitest | connector runtime+tests | ✓ | node v22.21.1 | — |
| slopcheck | legitimacy gate | ✗ (installed but Win-broken) | 0.6.1 | manual npm metadata check + human-verify checkpoint |

**Missing with no fallback:** none block the build.
**Missing with fallback:** R2 → Supabase Storage; slopcheck → manual+checkpoint; xlsx lib → install post-checkpoint.

## Validation Architecture

> `.planning/config.json` not read here for nyquist flag; `@obs/dinero` uses **vitest** (`"test": "vitest run"`). Pure functions (parser, reconciler, completeness) are unit-testable without network/DB, exactly like the existing `*.test.ts` siblings.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x (per `packages/dinero/package.json`) |
| Config file | workspace vitest config (existing) |
| Quick run command | `pnpm --filter @obs/dinero test` |
| Full suite command | `pnpm -r test` |
| DB schema test | pgTAP `supabase/tests/0024_servel.test.sql` against an APPLIED schema |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|-------------|
| MONEY-03 | header drift → THROW (quarantine) | unit | `pnpm --filter @obs/dinero test` | ❌ Wave 0 (`parse-servel.test.ts`) |
| MONEY-03 | Content-MD5/count mismatch → run quarantine, 0 rows | unit | same | ❌ Wave 0 (`reconciliar-completitud.test.ts`) |
| MONEY-03 | raw → Storage idempotent key | unit (fake client) | same | ❌ Wave 0 (`storage-supabase.test.ts`) |
| MONEY-03 | `donante` deny-by-default (anon 0 grant) | pgTAP | applied-schema pgTAP | ❌ Wave 0 (`0024_servel.test.sql`) |
| MONEY-04 | RUT-exact: no candidate RUT → enlace null | unit | same | ❌ Wave 0 (`reconciliar-aporte.test.ts`) |
| MONEY-04 | RPC grouped period DESC, fecha DESC; no PII columns | pgTAP | applied-schema pgTAP | ❌ Wave 0 |
| MONEY-04 | gate OFF → section + heading absent from HTML | RTL (pure View) | app test | ❌ Wave 0 (`financiamiento-de-parlamentario.test.tsx`) |

### Wave 0 Gaps
- [ ] `parse-servel.test.ts` — header-text gate + verbatim mapping (fixture xlsx)
- [ ] `reconciliar-completitud.test.ts` — quarantine on mismatch
- [ ] `reconciliar-aporte.test.ts` — RUT-exact null-today behavior
- [ ] `storage-supabase.test.ts` — versioned key + idempotency (fake)
- [ ] `0024_servel.test.sql` — pgTAP: anon SELECT 0 grant on `donante`; RPC signature/columns
- [ ] app RTL fixture test for `FinanciamientoView` (pure) + gate-off HTML absence
- [ ] xlsx fixture: a small `.xlsx` (trim the real file) committed as a test asset

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | source is public; no SERVEL credential |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS deny-by-default + `revoke all` on `donante`; RPC `revoke from public`/`grant anon`; `moneyPublicEnabled` gate |
| V5 Input Validation | **yes** | header-text gate (zod-equiv) THROW on drift; `assertAllowedUrl` (SSRF) on the blob host |
| V6 Cryptography | no (no hand-rolled crypto) | sha256 for the storage key hash via platform crypto |
| V12 Files & Resources | **yes** | xlsx is a zip — use a maintained parser (`exceljs`/`@e965`), never a bare/abandoned one; cap download size; the file is from an allowlisted exact host only |

### Known Threat Patterns for {SERVEL xlsx ingestion}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via attacker-supplied URL | Spoofing/EoP | `assertAllowedUrl(url,{extraHosts:[SERVEL_HOST]})` — exact host, https, no private IPs |
| Malicious/zip-bomb xlsx | DoS | maintained parser + size cap; the host is a fixed gov-published blob, low risk |
| Silent partial dataset | Repudiation/Tampering | Content-MD5/count completeness reconciliation → run quarantine |
| Misattribution by name | Tampering | RUT-exact only (`EnlaceConfirmado`); name linking forbidden + grep-gated |
| PII leak (donor affiliation, Ley 21.719) | Information disclosure | `donante` deny-by-default + revoke; RPC never projects donor identity beyond the verbatim public name; no LLM |
| Service key / secret in logs | Info disclosure | mirror ChileCompra: never interpolate keys in errors; only propagate PostgREST `error.message` |

## Sources

### Primary (HIGH)
- Live probe this session: `repodocgastoelectoral.blob.core.windows.net/public/Presidencial_Parlamentaria_2025/Definitivas/Reporte_Aportes_DEFINITIVAS_2025.xlsx` — HEAD 200 + full download + xlsx shared-strings/sheet parse (headers, ~16,257 rows, no RUT, "TOTAL"/cutoff footer).
- Live probe: `…/Primarias/Reporte_Aportes_PRIMARIAS_2025.xlsx` — HEAD 200, own ETag/MD5.
- Codebase read: `packages/dinero/src/{connector-chilecompra,parse-chilecompra,reconciliar-contrato,ingest-run,writer,writer-supabase,model,ingest-cli}.ts`; `packages/identity/src/{deterministic,enlace-confirmado}.ts`; `packages/ingest/src/allowlist.ts`; `supabase/migrations/0023_dinero.sql`; `app/lib/{money-gate,supabase}.ts`; `app/components/contratos-de-parlamentario.tsx`; `scripts/r2-probe.ts`; `.env.example`; `packages/dinero/package.json`.
- Memory: `env-credentials-reality.md` (R2 401 re-probed 2026-06-19; Supabase remote DDL via `--db-url`; BOM workaround).
- `https://www.servel.cl/documentos-2025/` — links the per-election `.xlsx` reports.

### Secondary (MEDIUM)
- `npm view exceljs` / `@e965/xlsx` / `xlsx` — versions, repo, maintainers, modified dates.
- `https://www.servel.cl/campanas-electorales/financiamiento-de-campana/` — "publicación semanal de aportes" (no inline dataset link).

### Tertiary (LOW)
- WebSearch result mentions of SERVEL open-data initiative (medium-term, not a current stable dataset).

## Metadata

**Confidence breakdown:**
- SERVEL source shape & columns: **HIGH** — downloaded and parsed the live file.
- No-RUT finding (donor & candidate): **HIGH** — 0 RUT strings verified across all shared strings.
- Per-election URL pattern generalization: **MEDIUM** — 2 live examples (A2).
- Mirror architecture (connector/writer/RPC/RLS): **HIGH** — read every Phase 14 source file.
- xlsx library choice & legitimacy: **MEDIUM** — npm metadata verified, slopcheck Win-broken (A4, checkpoint).
- Completeness control via numeric footer: **MEDIUM** — Content-MD5 is HIGH; numeric "TOTAL" extraction is A5.

**Research date:** 2026-06-19
**Valid until:** ~2026-07-19 for the mirror pattern; the SERVEL URL/format is per-election and could change at the next election — re-probe before each new election's ingest (LIVE operator checkpoint).
