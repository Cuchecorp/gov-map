# Stack Research — v2.0 Parlamentarios 360 (additions only)

**Domain:** Civic-tech ingestion + analysis of Chilean parliamentary data (votes, lobby, assets, money, influence graph)
**Researched:** 2026-06-18
**Confidence:** HIGH on access methods (votes, lobby, assets, contracts), MEDIUM-HIGH on graph library, HIGH on Postgres-graph decision
**Scope note:** The v1.0 core stack is LOCKED (see STACK.md). Nothing here replaces it. Everything below either reuses an existing `@obs/*` package or is a small, justified addition.

---

## TL;DR

- **Zero new ingestion libraries needed.** Every government source is reachable with the tools already locked: `fetch` + `fast-xml-parser` (votes), `fetch` + JSON (ChileCompra), `cheerio`/CSV (lobby, assets, SERVEL). The work is new **connectors inside `@obs/ingest`**, not new dependencies.
- **The individual deputy vote IS reachable** via a documented HTTP-GET XML endpoint on opendata.camara.cl (`getVotacion_Detalle?prmVotacionID=`). It returns each `Diputado` with `DIPID` + `Opcion`. The live spike is still warranted (never validated live), but the source is documented, not hypothetical. Confidence on existence: HIGH; on live behavior: UNCONFIRMED until the spike runs.
- **SERVEL is the only genuinely fragile source** — no API, no bulk download, authenticated XHTML/JSF web app; must be a scraper (cheerio + WebForms/JSF 2-step, headless only as last resort in CI). Treat as artisanal exactly as PROJECT.md says.
- **Graph library: `@xyflow/react` (React Flow 12).** Best Next.js 16 / RC / SSR story of the three; the influence graph is small (hundreds of curated nodes, not a 100k-node hairball); v1.0 already uses visx/Recharts/React. Sigma.js is the right answer ONLY if the graph grows past ~5–10k visible nodes.
- **Graph queries: stay relational + recursive CTEs.** Apache AGE is NOT available on managed Supabase (AGE caps at PG13, Supabase is PG15). No `ltree`/AGE needed. Add a normalized `entidad`/`arista` edge table + recursive-CTE RPCs.

---

## Recommended Stack Additions

### Ingestion connectors (NEW connectors, NO new libraries)

| Capability | Library used | Status | Why |
|------------|--------------|--------|-----|
| **VOTE** — individual roll-call (`getVotacion_Detalle`) | `fetch` + `fast-xml-parser@5` (locked) | reuse | Endpoint returns XML; same parser as Senado `wspublico`. New `@obs/votaciones` (or extend `@obs/tramitacion`). |
| **INT-lobby** — leylobby.gob.cl audiencias | `fetch` + CSV + `cheerio` (locked) | reuse | Per-institution bulk CSV/Excel + InfoLobby; HTML listing fallback via `cheerio`. |
| **INT-assets** — InfoProbidad declaraciones | `fetch` + CSV catalogs + optional SPARQL over `fetch` | reuse | CSV catalogs + RDF/SPARQL at `datos.cplt.cl/sparql`; both plain HTTP. CC BY 4.0. |
| **MONEY-contracts** — ChileCompra / mercadopublico.cl | `fetch` + JSON (locked) | reuse | Documented REST API, JSON by default, queryable by proveedor RUT. |
| **MONEY-finance** — SERVEL aportes | `cheerio` (locked) + WebForms/JSF 2-step; headless only if forced | reuse / escalate | No API, no bulk dump. Authenticated JSF (`aportes.servel.cl`, `.xhtml`). Fragile by nature. |

### Frontend — influence graph (NET) — ONE new dependency

| Library | Version (2026-06) | Purpose | Why |
|---------|-------------------|---------|-----|
| **`@xyflow/react`** (React Flow 12) | **12.11.0** | Influence graph rendering in Next.js 16 frontend | First-class Next.js App Router + Server Components + SSR support (documented `<ReactFlowProvider initialNodes/initialEdges>` + `initialWidth/Height` + `fitView` for first render). React-native API matches v1.0's React/visx/Recharts patterns. Curated, small graph (hundreds of nodes) — DOM/SVG rendering is fine and gives full styling control + accessibility + per-node/edge provenance badges. |

> Note: the old `reactflow` npm package (latest 11.11.4) is **deprecated in favor of the scoped `@xyflow/react`** as of v12. Install `@xyflow/react`, not `reactflow`.

### Postgres — graph queries (NO new extension)

| Mechanism | Status | Purpose |
|-----------|--------|---------|
| **Recursive CTEs** (`WITH RECURSIVE`) | built-in PG15 | Multi-hop traversal (parlamentario → lobby → empresa → contrato/aporte). |
| **Normalized edge table** (`entidad` + `arista` with `tipo`, `provenance`, `fecha`, source link) | new migration, no dependency | Materializes cross-source relationships; queried by recursive-CTE RPCs, fed to React Flow. |
| **pgvector 0.8 (HNSW)** | already locked | Reused for "parlamentarios similares" if added — no change. |

---

## Per-Source Access Methods (concrete)

### VOTE — opendata.camara.cl individual roll-call — Confidence: HIGH (documented) / UNCONFIRMED (live)

The individual deputy vote that is `null` in `doGet.asmx` lives in the **opendata.camara.cl SOAP service `wscamaradiputados.asmx`**, which also exposes plain **HTTP GET**:

- Discover vote IDs for a bill:
  `GET https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin?prmBoletin={NNNNN-NN}` → XML list of `Votacion` with their `ID`.
- Fetch per-deputy detail:
  `GET https://opendata.camara.cl/wscamaradiputados.asmx/getVotacion_Detalle?prmVotacionID={ID}` → XML.

Response (`getVotacion_Detalle`) per the WSDL/op page includes:
- Vote metadata: `ID`, `Fecha`, `Tipo`, `Resultado`, `Quorum`, `Boletin`, `Articulo`, totals (`TotalAfirmativos`/`TotalNegativos`/`TotalAbstenciones`/`TotalDispensados`).
- **`Voto[]`**, each with a **`Diputado` object (`DIPID`, `Nombre`, `Apellido_Paterno`, `Apellido_Materno`, …) and `Opcion`** (the actual vote), plus `Pareos`.

**Integration:** parse with `fast-xml-parser@5`; map to the existing common `Votacion`/`Voto` model; cross to identity **deterministically by `DIPID` → `id_diputado_camara`** — exactly the path v1.0's Cámara reconciliation already uses (no LLM, official identifier). Clean fit with `@obs/identity`'s LOCKED guard.

**FLAG:** Despite being documented, opendata.camara.cl has never been hit live by this project. Phase-1 spike must confirm: (1) host reachable behind the gov WAF with the 2–3s rate-limit + UA; (2) `getVotaciones_Boletin` returns vote IDs for current-legislature bills; (3) `getVotacion_Detalle` actually populates `Diputado/Opcion` (not null like `doGet.asmx`). If any fails, the VOTE block replans (PROJECT.md already plans for this).

### MONEY-contracts — ChileCompra / mercadopublico.cl — Confidence: HIGH

Documented REST API, the cleanest source in v2.0:

- Base: `https://api.mercadopublico.cl/servicios/v1/publico/`
- Endpoints: `licitaciones.json`, `ordenesdecompra.json`, `Empresas/BuscarProveedor`, `Empresas/BuscarComprador`.
- **By RUT:** `…/Empresas/BuscarProveedor?rutempresaproveedor={RUT}&ticket={TICKET}` → provider code + name; then query OC by `CodigoProveedor`/`fecha`/`estado`.
- Formats: **JSON** (default), JSONP, XML. Auth: a **`ticket`** requested once by email.
- **Rate limit: 10,000 requests/day per ticket** (hard) → respect with `@obs/ingest` daily cache + serial pacing; keep the 2–3s discipline regardless.

**Integration:** `fetch` + `res.json()` + zod (locked pattern, identical to Cámara `doGet.asmx`). New `@obs/dinero` connector. Cross by RUT (internal-use key per PROJECT.md). The `datos-abiertos.chilecompra.cl` portal exists as a fallback but lacks documented bulk-download mechanics — prefer the REST API.

### INT-assets — InfoProbidad (declaraciones de patrimonio e intereses) — Confidence: HIGH

CPLT/Contraloría portal, explicitly open data, **CC BY 4.0** (matches PROJECT.md's attribution requirement):

- CSV catalogs / datasets at `infoprobidad.cl/DatosAbiertos/DatosAbiertos` (subjects, declarations, real estate, personal property, family members, etc.).
- RDF / **SPARQL endpoint: `https://datos.cplt.cl/sparql`** for linked-data queries.
- Per-declaration listing/UI at `infoprobidad.cl/Home/Listado`.

**Integration:** primary path = download CSV catalogs (`fetch` → CSV parse). SPARQL optional for targeted per-RUT/per-name queries. Cross by **normalized name** (bridge key) and RUT internal-use. **Sensitive-data posture (PROJECT.md + Ley 21.719):** only surface what the source already publishes; keep RUT/family data internal. Route any LLM extraction through `@obs/llm`'s `assertSensitivityAllowed` / `assertNoRutInLlmInput` gates.

### INT-lobby — leylobby.gob.cl / InfoLobby — Confidence: MEDIUM-HIGH

- Per-institution registries: `leylobby.gob.cl/instituciones/{CODE}/audiencias` (HTML).
- **Bulk downloads** documented at `ayuda.leylobby.gob.cl/descargas/` (returned 503 at research time — likely transient; this is the documented bulk path).
- Aggregated view at `infolobby.cl` (audiencias, viajes, donativos).

**Integration:** prefer bulk CSV/Excel downloads when reachable; fall back to `cheerio` over per-institution HTML audiencias tables. New connector under `@obs/lobby` (or fold into `@obs/intereses`). Cross by normalized name. **FLAG:** descargas endpoint must be re-validated live (503 at research time); bulk-file structure unconfirmed.

### MONEY-finance — SERVEL aportes de campaña — Confidence: HIGH that it's fragile

- **No public API, no documented bulk download.** Contribution data lives behind an authenticated JSF web app: `aportes.servel.cl/servel-aportes/inicio.xhtml` (ClaveÚnica login for donors), plus public consultation pages on `servel.cl`.
- Independent projects (LupaElectoral, `bastianolea/servel_scraping_votaciones`) reach SERVEL **only via web scraping** (RSelenium-class), confirming no machine-friendly endpoint.

**Integration:** treat as a **scraper**, not an API connector. First attempt `cheerio` + WebForms/JSF 2-step (re-extract JSF view-state per postback, keep session cookies) under the locked rate-limit. Only if the JSF flow is unscrapable with fetch should a headless browser be considered — and that belongs in the **GitHub Actions escape hatch**, never in Edge Functions (CPU/time limits). Expect breakage on every SERVEL redesign; isolate behind `@obs/dinero` so failure degrades honestly. Highest-risk, lowest-priority source — schedule it last.

---

## Graph Library Decision — React Flow vs Sigma.js vs Cytoscape

**Recommendation: `@xyflow/react` (React Flow 12.11.0).**

| Criterion | React Flow (`@xyflow/react` 12) | Sigma.js (`sigma` 3 + `graphology`) | Cytoscape.js (3.34) |
|-----------|-------------------------------|-------------------------------------|---------------------|
| Rendering | SVG/DOM | **WebGL** | Canvas/WebGL |
| Scale ceiling | ~hundreds–low-thousands of nodes | **100k+ nodes** | tens of thousands |
| Next.js 16 / RC / SSR | **Documented SSR/SSG config** (`ReactFlowProvider initialNodes/Edges`, `initialWidth/Height`, `fitView`) | client-only (`'use client'` + `dynamic ssr:false`); React via `@react-sigma/core` | client-only; `react-cytoscapejs` wrapper, no SSR |
| React-idiomatic | **Native React components** | wrapper layer | wrapper layer |
| Styling/accessibility control | **Full (DOM)** | limited (WebGL canvas) | moderate |
| Built-in graph algorithms | none (bring your own layout) | graphology ecosystem (layouts, metrics) | **rich (centrality, layouts, traversal)** |
| Fit with v1.0 (React/visx/Recharts) | **Best** | moderate | moderate |

**Why React Flow for THIS project:**
1. The influence graph is **curated and small** — relationships are computed server-side from the relational model (parlamentario ↔ lobby ↔ empresa ↔ contrato ↔ aporte), filtered to one parlamentario's neighborhood per view. Hundreds of nodes, not a global hairball. DOM rendering is more than adequate and buys full CSS styling (existing civic design tokens), provenance badges on nodes/edges, and accessibility — all things this project cares about (every datum shows source/date/link).
2. **Best SSR story** for Next.js 16 App Router + Server Components (the locked frontend). The other two are client-only canvas/WebGL needing `dynamic(..., { ssr: false })`.
3. **Lowest learning/maintenance cost** given the team already ships React + visx + Recharts.

**Choose Sigma.js (`sigma@3` + `graphology@0.26` + `@react-sigma/core@5`) instead IF** the influence view evolves into an explorable global network of **>5–10k simultaneously rendered nodes**. WebGL is then mandatory and graphology's layout/metrics ecosystem becomes valuable. Reassess then — do not pre-optimize now.

**Cytoscape.js** is the pick only if you need **built-in graph-theory algorithms client-side** (centrality, community detection). Here those analytics belong **server-side in Postgres/SQL** (traceable/auditable), so Cytoscape's main advantage is moot and its non-React, no-SSR nature fits worst.

---

## Postgres / pgvector for graph queries

**Recommendation: stay relational; use `WITH RECURSIVE` CTEs over a normalized edge table. Add no graph extension.**

- **Apache AGE: NOT available on managed Supabase.** AGE supports up to PG13/14-beta; Supabase stable is PG15 — not in the Supabase extension list, only via self-hosted Docker. Adopting it means leaving managed Supabase, contradicting locked infra. (Confidence: HIGH.)
- **`ltree`: wrong tool.** Models single-parent trees/hierarchies, not the many-to-many influence graph here. Skip.
- **Recursive CTEs are sufficient.** The graph is shallow (2–4 hops: parlamentario → audiencia/lobby → persona/empresa → contrato/aporte) and per-parlamentario scoped. PG15 recursive CTEs over an indexed edge table handle this comfortably at this data scale, keep everything auditable in SQL, and expose results via Supabase RPC (same pattern as `match_proyectos`).
- **Modeling:** one `entidad` table (typed nodes: parlamentario/empresa/persona/contrato/aporte/audiencia) + one `arista` table (typed, directional edges with `provenance`, `fecha`, source link). Every edge carries source/date/link to honor the rector rule (no causal claims; only sourced relationships). pgvector is unchanged.

---

## Installation (additions only)

```bash
# Frontend (Next.js app) — influence graph
pnpm --filter @obs/app add @xyflow/react@12

# Connectors (Deno Edge Functions / GitHub Actions) — NO new deps:
#   votes:     import { XMLParser } from "npm:fast-xml-parser@5"   (locked)
#   contracts: fetch + res.json() + zod                            (locked)
#   assets:    fetch CSV / SPARQL over fetch                       (locked)
#   lobby:     fetch CSV / cheerio                                 (locked)
#   servel:    cheerio (WebForms/JSF 2-step)                       (locked)

# Postgres: new migration only — entidad/arista tables + recursive-CTE RPC.
# No new extension (pgvector/pg_cron/pgmq/pg_net already enabled).
```

If a dedicated CSV parser is wanted for the InfoProbidad/lobby catalogs, prefer a tiny zero-dep one usable in Deno (`jsr:@std/csv`) over a Node-heavy package — but first check whether catalogs are small/simple enough to split manually. Do NOT pull a large CSV framework.

---

## Alternatives Considered

| Recommended | Alternative | When to use the alternative |
|-------------|-------------|------------------------------|
| `@xyflow/react` 12 (SVG/DOM) | Sigma.js 3 + graphology + `@react-sigma/core` 5 (WebGL) | Influence view becomes a global explorable network >5–10k simultaneous nodes. |
| `@xyflow/react` 12 | Cytoscape.js 3 + `react-cytoscapejs` | You need rich client-side graph algorithms instead of computing them server-side. |
| Recursive CTEs + edge table (managed Supabase) | Apache AGE (openCypher) | Only on self-hosted Postgres ≤13/14 — incompatible with managed Supabase PG15; do not adopt. |
| ChileCompra REST API (per-RUT) | `datos-abiertos.chilecompra.cl` bulk | If the per-ticket 10k/day limit bottlenecks large backfills and a documented bulk export is found. |
| InfoProbidad CSV catalogs | InfoProbidad SPARQL (`datos.cplt.cl/sparql`) | Targeted per-name/per-RUT lookups where downloading full catalogs is wasteful. |
| `getVotacion_Detalle` HTTP GET (XML) | SOAP 1.1/1.2 envelope to same `.asmx` | Only if plain GET is disabled/firewalled; GET is simpler and avoids SOAP envelopes. |

---

## What NOT to Add

| Avoid | Why | Use instead |
|-------|-----|-------------|
| **`reactflow` (old npm pkg, v11.x)** | Deprecated; v12 moved to scoped `@xyflow/react`. | `@xyflow/react@12`. |
| **Apache AGE / openCypher** | Not available on managed Supabase (PG15); needs self-host. Contradicts locked infra. | Recursive CTEs over an edge table. |
| **`ltree`** | Models single-parent trees, not a many-to-many influence graph. | Edge table + recursive CTEs. |
| **Neo4j / dedicated graph DB** | New infra, new query language, splits the data plane; graph is small and read-mostly. | Postgres recursive CTEs. |
| **Headless browser (Puppeteer/Playwright) in Edge Functions** | CPU/time limits; fragile and heavy — same warning as v1.0 WebForms. | `cheerio` + WebForms/JSF 2-step; headless only in GitHub Actions if SERVEL truly forces it. |
| **A new HTTP/scraping framework per source** | Every source is plain `fetch`; `@obs/ingest` already centralizes rate-limit/UA/robots/cache/provenance. | Add connectors inside `@obs/ingest`, not new libs. |
| **A new XML/JSON parser** | `fast-xml-parser@5` (votes, BCN) + native JSON (ChileCompra) cover all v2.0 sources. | Reuse locked parsers + zod. |
| **Treating SERVEL as an API** | No API and no bulk dump; assuming one breaks the MONEY block. | Plan SERVEL as an explicitly fragile scraper, scheduled last, isolated behind `@obs/dinero`. |
| **Assuming opendata.camara.cl works without a spike** | Documented but never validated live behind the gov WAF. | Phase-1 validation spike (reachability + non-null `Opcion`) before building VOTE. |
| **Sending RUT/family data to LLMs or the client** | Ley 21.719 + rector rule; identity data is internal-use. | `@obs/llm` data-routing gates; surface only source-published fields with provenance. |

---

## Version Compatibility

| Package | Version (2026-06-18) | Compatible with | Notes |
|---------|----------------------|-----------------|-------|
| `@xyflow/react` | 12.11.0 | React 19.2 / Next.js 16 App Router | Documented SSR/SSG config; use as a Client Component island (`'use client'`) inside Server-Component pages. |
| `sigma` (alt) | 3.0.3 | + `graphology` 0.26.0, `@react-sigma/core` 5.0.6 | WebGL; client-only (`dynamic ssr:false`). Only if scale demands. |
| `cytoscape` (alt) | 3.34.0 | + `react-cytoscapejs` | Client-only; not recommended here. |
| `fast-xml-parser` | 5.x (locked) | Deno 2.x | Parses `getVotacion_Detalle` XML — same as Senado `wspublico`. |
| Postgres recursive CTE | PG15 (Supabase) | pgvector 0.8 unchanged | No extension needed; expose via Supabase RPC like `match_proyectos`. |

---

## Sources

- [opendata.camara.cl — Votaciones por Proyecto de Ley](https://opendata.camara.cl/pages/votacion_boletin.aspx) — `getVotaciones_Boletin`, param boletín — HIGH
- [opendata.camara.cl — Detalle de Votación](https://opendata.camara.cl/pages/votacion_detalle.aspx) — `getVotacion_Detalle`, param vote ID — HIGH
- [opendata.camara.cl — wscamaradiputados.asmx?op=getVotacion_Detalle](https://opendata.camara.cl/wscamaradiputados.asmx?op=getVotacion_Detalle) — WSDL/op: `prmVotacionID`, `Voto[]`→`Diputado{DIPID,Nombre,...}`+`Opcion`, HTTP GET equivalent — HIGH (documented), live behavior UNCONFIRMED
- [opendata.congreso.cl](https://opendata.congreso.cl/) — index of Congreso open-data endpoints (XML); confirms `votacion_detalle` provides per-deputy detail — HIGH
- [ChileCompra — API de Mercado Público](https://www.chilecompra.cl/api/) — endpoints `licitaciones.json`/`ordenesdecompra.json`/`Empresas/BuscarProveedor`, `rutempresaproveedor`, ticket, 10k/day, JSON/XML — HIGH
- [api.mercadopublico.cl — Utilización](https://api.mercadopublico.cl/modules/api.aspx) — request/format details — MEDIUM-HIGH
- [InfoProbidad — Datos Abiertos Enlazados](https://www.infoprobidad.cl/DatosAbiertos/DatosAbiertos) — CSV catalogs + SPARQL `datos.cplt.cl/sparql`, CC BY 4.0 — HIGH
- [InfoProbidad — Declaraciones (Listado)](https://www.infoprobidad.cl/Home/Listado) — per-declaration access — HIGH
- [Ley del Lobby — Instituciones / audiencias](https://www.leylobby.gob.cl/instituciones) — per-institution HTML audiencias — MEDIUM-HIGH
- [Ayuda Ley del Lobby — Descargas](https://ayuda.leylobby.gob.cl/descargas/) — documented bulk-download path (503 at research time; re-validate) — MEDIUM, UNCONFIRMED live
- [SERVEL — Aportes](https://aportes.servel.cl/servel-aportes/inicio.xhtml) + [servel.cl/aportes](https://www.servel.cl/aportes/) — authenticated JSF web app, no API — HIGH (that it's fragile)
- [bastianolea/servel_scraping_votaciones (GitHub)](https://github.com/bastianolea/servel_scraping_votaciones) + [LupaElectoral](https://lupaelectoral.cl/datos/) — confirm SERVEL reachable only via scraping — MEDIUM-HIGH
- Context7 `/websites/reactflow_dev` — SSR/SSG configuration (`ReactFlowProvider initialNodes/initialEdges`, `initialWidth/Height`, `fitView`) — HIGH
- Context7 `/jacomyal/sigma.js`, `/websites/sigmajs`, `/dunnock/react-sigma` — WebGL large-graph rendering, graphology, React wrapper — HIGH
- Context7 `/cytoscape/cytoscape.js`, `/plotly/react-cytoscapejs` — graph-theory algorithms, React wrapper — HIGH
- npm registry (2026-06-18): `@xyflow/react`@12.11.0, `reactflow`@11.11.4 (deprecated→scoped), `sigma`@3.0.3, `graphology`@0.26.0, `@react-sigma/core`@5.0.6, `cytoscape`@3.34.0 — HIGH
- [Supabase Discussion #13263 — add Apache AGE](https://github.com/orgs/supabase/discussions/13263) — AGE not available on managed Supabase (PG15 vs AGE≤PG13) — HIGH

---
*Stack research for: v2.0 Parlamentarios 360 (additions to a locked v1.0 stack)*
*Researched: 2026-06-18*
