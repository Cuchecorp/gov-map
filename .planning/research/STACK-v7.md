# Stack Research — v7.0 (Votos individuales + Dimensión dinero)

**Domain:** Civic data platform — additive fronts on an existing TS/Deno + Supabase + R2 stack
**Researched:** 2026-07-13
**Confidence:** HIGH (endpoints verified live/in-repo; two spikes flagged for re-confirmation)

## TL;DR for the roadmapper

**v7.0 needs essentially ZERO new stack.** The base stack (`@obs/ingest` framework, `fast-xml-parser@5`, `zod@4`, `@supabase/supabase-js@2`, R2 via `@obs/ingest`) already covers both new fronts. More importantly, **the connectors, parsers and models for BOTH P3 (voto individual) and P5 (dinero) already exist in the repo** — built code-complete during v2.0 and never fully wired/verified live at scale. The only non-base library in play is **`exceljs@4.4.0`** (SERVEL `.xlsx`), and it is **already installed** in `@obs/dinero`.

**So the roadmap's real work is NOT "choose libraries" — it is: (1) live spikes to re-confirm two uncertain sources, (2) wire existing connectors into the two-stage R2→Supabase pipeline with identity reconciliation, (3) coverage backfill, (4) deny-by-default surfaces.** Any phase plan that proposes adding a SOAP client, an OData client, a CSV lib, or a new HTTP framework is redundant — reject it.

The one genuinely new operational dependency is a **ChileCompra API ticket** (a secret the operator requests once via Clave Única), not a code dependency.

---

## Recommended Stack

### Core Technologies (all ALREADY IN REPO — reuse, do not re-add)

| Technology | Version | Purpose in v7.0 | Why (verified) |
|------------|---------|------------------|----------------|
| **`@obs/ingest` framework** | in-repo | Rate-limit 2–3s serial/host, robots, UA `Bot-Ciudadano/1.0`, R2 two-stage, hash-check | Both new connectors (`connector-chilecompra.ts`, `connector-servel.ts`) already call the LOCKED order `assertAllowedUrl → robots → rateLimiter.wait → fetcher.get`. `mercadopublico.cl` is already in `DEFAULT_ALLOWED_SUFFIXES`; SERVEL host scoped via `extraHosts`. HIGH |
| **fast-xml-parser** | `^5.9.2` | Parse Cámara `getVotacion_Detalle` (SOAP/XML per-deputy) and Senado `votaciones.php` (XML per-senator) | Already the parser in `parse-camara-votacion.ts` + `parse-senado-votacion.ts`, both handling `ignoreAttributes:false, parseTagValue:false`. The nil/`#text`/`@_Codigo` shape of the SOAP response is already handled. HIGH |
| **zod** | `^4.4.3` | Contract validation of vote XML + ChileCompra JSON + SERVEL xlsx rows | Already the validation gate across `@obs/tramitacion` and `@obs/dinero`. No new schema lib. HIGH |
| **`@supabase/supabase-js`** | `^2.108.2` | Write `voto` rows + `entidad_tercero`/aporte/contrato rows; RLS/service_role | Existing writer pattern (`writer-supabase.ts`, `writer-supabase-servel.ts`). Remember PostgREST 1k cap → paginate `.order().range()` (known gotcha). HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **exceljs** | `4.4.0` (already in `@obs/dinero`) | Parse SERVEL gasto-electoral `.xlsx` (Azure Blob `repodocgastoelectoral.blob.core.windows.net`) | SERVEL publishes manual per-election `.xlsx` (no REST API). `parse-servel.ts` already consumes it. This is the ONLY non-base library the money front needs. MEDIUM-HIGH |

### Development / operational dependencies (NOT code libraries)

| Item | Purpose | Notes |
|------|---------|-------|
| **ChileCompra API ticket** | Auth for `api.mercadopublico.cl` | Operator requests once via Clave Única form; one ticket per person; **10,000 requests/day** hard cap. Store in `.env` (`CHILECOMPRA_TICKET`), NEVER interpolate into logs/errors (connector already redacts via `redactarTicket`). Operator action, not a build step. |
| **SERVEL manual download** | Per-election gasto/aporte `.xlsx` | No API. Operator (or LOCAL backfill) downloads the workbook per election; connector then runs against the R2-cached crudo. Carga manual del operador, por elección. |

---

## Front-by-front findings

### P3 — Voto individual por diputado

**VERDICT: source validated, parsers already exist, code path already exists. Not blocked on stack — blocked on a live re-confirmation spike + wiring/coverage.**

The individual deputy vote that is `Votos=null` in `doGet.asmx` lives in the **opendata.camara.cl SOAP service `WSLegislativo.asmx` / `wscamaradiputados.asmx`**:

| Endpoint | Shape | Returns individual votes? | Confidence |
|----------|-------|---------------------------|------------|
| `WSLegislativo.asmx?op=retornarVotacionDetalle` (SOAP, ns `.../camaradiputados/v1`), param `prmVotacionId` | XML `<Votos><Voto><Diputado>…</Diputado><OpcionVoto/></Voto></Votos>` | **YES** — `<Diputado>` includes Id, name, and even RUT/birthdate in the GET variant; `<OpcionVoto>` is the roll-call choice | HIGH (WSDL schema fetched live) |
| `wscamaradiputados.asmx/getVotacion_Detalle` (ns `tempuri.org`), the REAL shape hit LIVE 2026-06-18 | XML `<Voto><Diputado><DIPID>…</DIPID></Diputado><Opcion Codigo="0/1/4">…</Opcion></Voto>` | **YES** — codes 1=A Favor→si, 0=En Contra→no, 4=No Vota→ausente (confirmed live); Abstención/Pareo by `#text` | HIGH (in-repo `parseCamaraVotoDetalle`, live test) |
| `getVotaciones_Boletin` (ns `tempuri.org`) | XML boletín list → yields the **votacion IDs** to feed the detail call | Provides the IDs, not the votes | HIGH |

**Key realization — the code ALREADY EXISTS:**
- `packages/tramitacion/src/parse-camara-votacion.ts` → `parseCamaraVotoDetalle()` already emits the full 5-option roll-call (si/no/abstencion/pareo/ausente), crosses by `DIPID`/`Id`, fail-closed on illegible options.
- `packages/votos/src/run-camara-votos.ts` + `run-votos-masivo-cli.ts` + `run-camara-votos.live.test.ts` already orchestrate the fetch → parse → write.
- The `voto` table already exists (migration `0008`); ARCHITECTURE guidance is "VOTE is enrichment, not a new model — write into the SAME `voto` table."

**Senado individual vote — ALREADY INGESTED at per-senator level:**
- `wspublico/votaciones.php?boletin=` returns `<votaciones><votacion><DETALLE_VOTACION><VOTO><PARLAMENTARIO>…</PARLAMENTARIO><SELECCION>…</SELECCION></VOTO>`.
- `packages/tramitacion/src/parse-senado-votacion.ts` → `parseSenadoVotaciones()` already extracts each `<VOTO>` per senator, maps `SELECCION`→si/no/abstencion/pareo, handles multiple same-day votes (CR-01 discriminator), and OMITS garbled tokens (fail-closed WR-03).
- Senado cross is by **normalized name** (`mencionNombre`), not an ID — so identity reconciliation is the real work, not parsing.

**SPIKE (Phase-1, required — flagged uncertain):** opendata.camara.cl was last hit live 2026-06-18 and again for enumeration (WSLegislativo enumeration confirmed no-WAF 2026-07-10). Before building on it at scale, a spike must re-confirm: (1) host reachable behind the gov WAF with 2–3s rate-limit + UA; (2) `getVotaciones_Boletin` returns vote IDs for current-legislature bills; (3) `getVotacion_Detalle` still populates `Diputado/Opcion` (not null); (4) Abstención/Pareo codes (Assumption A1 — never confirmed live, currently resolved by `#text`). Confidence on the endpoint SHAPE is HIGH; confidence that it is up TODAY at scale is MEDIUM until the spike runs.

**Stack additions for P3: NONE.** No SOAP client library needed — `fetch` + `fast-xml-parser` handle the ASMX GET/POST. Reject any proposal to add a SOAP/WSDL client, `soap` npm package, or headless browser.

---

### P5 — Dimensión dinero (ChileCompra + SERVEL)

**VERDICT: ChileCompra has a real REST API (HIGH); SERVEL is manual `.xlsx` per election (HIGH). Both connectors already exist. Hard prerequisite RUT-01 is DATA, not code.**

#### ChileCompra / Mercado Público — REST API (HIGH)

| Attribute | Finding | Confidence |
|-----------|---------|------------|
| Base URL | `https://api.mercadopublico.cl/servicios/v1/publico/` | HIGH |
| Auth | Per-person **ticket** via Clave Única form; email delivery; one ticket/person | HIGH |
| Rate limit | **10,000 requests/day per ticket** (hard, unmodifiable) | HIGH |
| Format | JSON / JSONP / XML by extension (`.json` preferred) | HIGH |
| Supplier by RUT | `…/Publico/Empresas/BuscarProveedor?rutempresaproveedor=70.017.820-k&ticket=…` — **RUT must include dots, hyphen, DV** | HIGH |
| Purchase orders | `…/servicios/v1/publico/ordenesdecompra.json?fecha=DDMMYYYY&ticket=…` or `?codigo=…&ticket=…` — **the API does NOT filter orders by RUT**, so it's a 2-step flow: BuscarProveedor(rut)→codigo, then orders by day/state | HIGH |
| Bulk (OCDS) | `datos-abiertos.chilecompra.cl` exists (CSV/OCDS bulk) as a fallback but bulk-download mechanics are undocumented on the page fetched → prefer the ticketed REST API | MEDIUM |

**In-repo reality:** `packages/dinero/src/connector-chilecompra.ts` already implements exactly this 2-step flow (`buscarProveedor` → `ordenesDeCompra`), reuses `@obs/ingest` LOCKED order, redacts the ticket from errors, and degrades honestly per-RUT on 403/429/503 (`ChileCompraBloqueadaError`). `parse-chilecompra.ts`, `reconciliar-contrato.ts`, `writer-supabase.ts` exist. There is even a `live-chilecompra.probe.ts`.

**RUT format gotcha (HIGH):** ChileCompra requires the RUT WITH dots+hyphen+DV (`70.017.820-k`). The identity master likely stores canonical/clean RUT → the query builder must format on the way out. Verify `query.ts`/`urlBuscarProveedor` does this in the wiring phase.

#### SERVEL — manual `.xlsx` per election (HIGH)

| Attribute | Finding | Confidence |
|-----------|---------|------------|
| API? | **NO REST API.** Public data via web portals (`aportes.servel.cl`, `www.servel.cl/centro-de-datos/…`) + downloadable workbooks | HIGH |
| Programmatic source | Gasto/aporte workbooks on Azure Blob `repodocgastoelectoral.blob.core.windows.net` (anonymous GET, `.xlsx`) | MEDIUM-HIGH (host in-repo, verified as connector target) |
| Auth | None (anonymous GET); no ticket | HIGH |
| Cadence | **Per election, manual.** SERVEL "gradually" incorporates open data; no stable programmatic feed of per-candidate aportes/gastos | HIGH |
| Parsing | `.xlsx` → `exceljs@4.4.0` (already installed) | HIGH |

**In-repo reality:** `connector-servel.ts` fetches the `.xlsx` from the Azure Blob host (scoped via `extraHosts` + https-only assertion, NOT added to default suffixes to avoid SSRF to all Azure tenants), captures ETag/Content-MD5/Last-Modified for idempotency. `parse-servel.ts`, `model-servel.ts`, `writer-servel.ts`, `reconciliar-aporte.ts`, `ingest-run-servel.ts`, `ingest-cli-servel.ts` all exist.

**What automates vs. what is operator toil:**
- **Automatable:** once the operator drops the per-election `.xlsx` URL (or the file into R2 crudo), the connector→parse→reconcile→write pipeline runs and re-runs from R2.
- **Operator toil (manual, per election):** discovering/downloading the correct workbook URL for each election cycle; SERVEL does not expose a stable machine-readable index. This matches PROJECT.md's "conector artesanal frágil, manual por elección."

#### RUT-01 — hard prerequisite (DATA, not stack)

Cross-by-RUT is impossible until RUTs physically exist in the `entidad_tercero` master. `packages/dinero/src/harvest-rut.ts` + `encolar-revision-rut.ts` exist for the backfill. This is a **data phase** the roadmap must sequence BEFORE any ChileCompra cross — it is not a flag an agent flips, and no library solves it. Personas jurídicas: match by exact RUT only, NEVER LLM (fail-closed) — RUT never crosses to the LLM.

**Stack additions for P5: NONE beyond the already-installed `exceljs`.** Reject proposals to add an OCDS SDK, a CSV parser, or a generic Excel lib other than the pinned `exceljs`.

---

## Installation

```bash
# NOTHING new to install for the core paths.
# @obs/dinero already declares exceljs@4.4.0 + zod@4 + @supabase/supabase-js@2 + @obs/ingest.
# @obs/votos + @obs/tramitacion already own the vote parsers.

# Operator (secrets in .env — not a package):
#   CHILECOMPRA_TICKET=<ticket from Clave Única form>   # 10k req/day cap
#   (SERVEL needs no secret — anonymous .xlsx GET)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `fetch` + `fast-xml-parser` for opendata.camara.cl ASMX | `soap`/`strong-soap` WSDL client | Never for this project — the ASMX exposes plain HTTP GET/POST; a SOAP client adds envelope ceremony and a dependency for zero benefit. Already proven with in-repo parser. |
| ChileCompra ticketed REST API (per-RUT, 2-step) | `datos-abiertos.chilecompra.cl` OCDS bulk (CSV) | Only if per-RUT volume exceeds 10k req/day for the diputado universe, OR if a full-history cross is needed. Bulk download mechanics undocumented → validate in a spike before relying on it. |
| `exceljs` for SERVEL `.xlsx` | `xlsx`/SheetJS | Only if `exceljs` chokes on a specific SERVEL workbook (merged cells / weird encoding). `exceljs` is already installed and proven in `parse-servel.ts`; do not add a second Excel lib. |
| Reuse `voto` table (`0008`) for individual votes | New `voto_individual` model/table | Never — ARCHITECTURE decision: VOTE is enrichment, not a new model. A parallel table duplicates the roll-call. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| A new SOAP/WSDL client for opendata.camara.cl | ASMX serves plain HTTP GET/POST; `fetch`+`fast-xml-parser` already parse it (live-verified) | Existing `parseCamaraVotoDetalle` |
| Headless browser (Puppeteer/Playwright) for any of these sources | All three (Cámara ASMX, Senado XML, ChileCompra JSON, SERVEL xlsx) are direct fetches; no JS rendering needed | `@obs/ingest` `fetcher.get` |
| Adding SERVEL host to `DEFAULT_ALLOWED_SUFFIXES` | Widens SSRF surface to ALL Azure Blob tenants | Scoped `extraHosts` + https-only assertion (already done in `connector-servel.ts`) |
| Interpolating the ChileCompra ticket into logs/errors | Secret leak | `redactarTicket` (already in `query.ts`); errors carry status only |
| Crossing by RUT before RUT-01 backfill | The join key doesn't exist → empty/wrong crosses | Sequence RUT-01 (`harvest-rut.ts`) as a data phase first |
| Sending RUT to the LLM for entity matching | PII to LLM is LOCKED-forbidden; jurídicas match by exact RUT | Deterministic exact-RUT match, fail-closed |
| `BaseConnector.run` for these connectors | Its daily cache would skip re-runs / backfills | LOCKED manual order `assertAllowedUrl → robots → rateLimiter.wait → fetcher.get` (already used) |
| New CSV/OData/OCDS SDK for ChileCompra | Ticketed REST JSON already covers the per-RUT need | `connector-chilecompra.ts` |

## Stack Patterns by Variant

**If the opendata.camara.cl spike FAILS (WAF/endpoint down/Opcion null):**
- Fall back to `getVotaciones_Boletin` for aggregates only + re-plan the VOTE block (PROJECT.md already plans for this contingency).
- Do NOT swap stacks — the failure would be source availability, not tooling.

**If ChileCompra per-RUT volume exceeds 10k req/day across the diputado universe:**
- Split the crawl across multiple days (backfill = LOCAL, reanudable) OR request additional operator tickets.
- Evaluate the `datos-abiertos.chilecompra.cl` OCDS bulk as a batch source — but validate download mechanics first.

**If SERVEL publishes a new election workbook mid-milestone:**
- Operator drops the `.xlsx` URL/file → R2 crudo → existing `ingest-run-servel.ts` reprocesses from R2. No code change.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| fast-xml-parser@5.9.2 | Deno 2.x / Node 20+ | Handles ASMX `@_Codigo`/`#text`/nil shapes; stay on 5.x (v6 experimental). |
| exceljs@4.4.0 | Node 20+ (tsx runner) | SERVEL `.xlsx`; pinned exact — do not float. |
| zod@4.4.3 | @obs/dinero + @obs/tramitacion | v4 line; already the repo standard for this milestone's packages. |
| @supabase/supabase-js@2.108.2 | PostgREST | Paginate reads (1k cap) via `.order().range()` — known gotcha at scale. |
| ChileCompra ticket | api.mercadopublico.cl v1 | 10k req/day; RUT must be dotted+hyphen+DV in the query. |

## Sources

- `https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx` (WSDL) + `?op=retornarVotacionDetalle` — SOAP method + response schema with `<Votos><Voto><Diputado>/<OpcionVoto>` incl. RUT — **HIGH** (schema fetched live)
- `https://opendata.camara.cl/pages/votacion_detalle.aspx` — confirms `getVotacion_Detalle` / `prmVotacionId` — HIGH
- In-repo `packages/tramitacion/src/parse-camara-votacion.ts` + `parse-senado-votacion.ts` — parsers already validated LIVE (2026-06-18); codes 1/0/4 confirmed — **HIGH**
- In-repo `packages/votos/*` + `packages/dinero/*` (connectors, parsers, models, live probes) — code-complete since v2.0 — **HIGH**
- `https://www.chilecompra.cl/api/` + `https://api.mercadopublico.cl/modules/api.aspx` — base URL, ticket flow, 10k/day, JSON/XML, `BuscarProveedor?rutempresaproveedor=…` + `ordenesdecompra.json` — **HIGH**
- `https://datos-abiertos.chilecompra.cl/` — OCDS/CSV bulk exists; mechanics undocumented on page — MEDIUM
- `https://www.servel.cl/centro-de-datos/estadisticas-de-datos-abiertos-4zg/` + `aportes.servel.cl` — open-data portals, NO REST API, gradual incorporation — **HIGH** (no API confirmed by absence + portal-only access)
- In-repo `connector-servel.ts` — Azure Blob `repodocgastoelectoral.blob.core.windows.net` `.xlsx` target, anonymous GET — MEDIUM-HIGH
- PROJECT.md / CLAUDE.md — SERVEL "manual por elección", RUT-01 hard prereq, LOCKED ingest order — HIGH

---
*Stack research for: v7.0 votos individuales + dimensión dinero (additive on existing stack)*
*Researched: 2026-07-13*
