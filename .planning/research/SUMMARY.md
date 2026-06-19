# Research Summary — v2.0 Parlamentarios 360

**Synthesized from:** STACK.md · FEATURES.md · ARCHITECTURE.md · PITFALLS.md (v2.0)
**Date:** 2026-06-18
**Overall confidence:** MEDIUM-HIGH (uncertainty concentrated in VOTE live behavior — spike resolves — and SERVEL, where fragility is the plan, not a surprise)

## Executive Summary

v2.0 adds a legislator-centric analysis front to a shipped bill-tracking product. The v1.0 identity master (186 confirmed legislators, golden-gated reconciliation pipeline) and ingest framework (BaseConnector, pgmq, pg_cron, R2, drift fingerprinting) are the complete substrate — nothing is rebuilt. v2.0 work is four new connector packages (`@obs/votos`, `@obs/lobby`, `@obs/probidad`, `@obs/dinero`), SQL migrations (attribution tables + graph edge cache), one new frontend dependency (`@xyflow/react@12`), and — the hard part — extending the confirmed-link identity guard to four new datasets that do not carry an official chamber ID.

The build order is forced by hard dependencies: VOTE spike first (gates its own block, does not block INT/MONEY), then identity completeness (RUT backfill), then INT, then MONEY, then NET last. NET is a pure consumer of the other three blocks; nothing to graph until they are populated. The "silent real cost" of INT and MONEY is the lobbyist/firm, donor, and contractor sub-masters those blocks must create — treating sub-master creation as a deferred NET problem is a planning error.

The overriding risk is the "máquina de sospechas" boundary: when money, meetings, and votes coexist on the same profile, the UI can imply causality even with neutral copy. Ley 21.719 (full force 2026-12-01) gives this legal weight — derived data from public sources is not exempt — and mandates a legal review gate before MONEY and NET are publicly exposed.

## Stack Additions

**One new dependency:** `@xyflow/react@12.11.0` (React Flow) for the NET influence graph. Chosen over Sigma.js (WebGL, client-only) and Cytoscape.js (no SSR). Suits the small curated ego-network (hundreds of nodes per view). The deprecated `reactflow` v11 package must NOT be used.

**Zero new ingestion libraries.** All five sources reachable with locked tools:

| Package | Source | Parse |
|---------|--------|-------|
| `@obs/votos` | `opendata.camara.cl` XML WS | `fast-xml-parser@5` |
| `@obs/lobby` | `leylobby.gob.cl` CSV/HTML | `fetch` + `cheerio` |
| `@obs/probidad` | `infoprobidad.cl` CSV/SPARQL | `fetch` + zod |
| `@obs/dinero` | SERVEL (cheerio + JSF 2-step) + ChileCompra (JSON REST) | `cheerio` / `fetch`+JSON |

**Postgres:** recursive CTEs over a normalized `entidad`/`arista` edge table — Apache AGE is unavailable on managed Supabase (PG15 vs AGE ≤ PG13). One allowlist change: add `servel.cl` / `aportes.servel.cl` to `@obs/ingest/allowlist.ts` (only missing host; leylobby, infoprobidad, mercadopublico pre-provisioned by v1.0).

## Per-Source Access & Confidence

| Source | Method | Confidence | Live status |
|--------|--------|------------|-------------|
| VOTE — `opendata.camara.cl` XML WS (`getVotaciones_Boletin` → `getVotacion_Detalle`) | HTTP GET → `fast-xml-parser`; crosses by official `Diputado/Id` → `id_diputado_camara` (deterministic, no LLM) | HIGH (documented) / **UNCONFIRMED live** | Phase-1 spike required |
| INT-lobby — `leylobby.gob.cl` | Bulk CSV (preferred) / cheerio HTML fallback | MEDIUM-HIGH | Bulk endpoint returned 503 at research time — re-validate |
| INT-assets — `infoprobidad.cl` | CSV catalogs + optional SPARQL (`datos.cplt.cl/sparql`) | HIGH | Allowlisted, CC BY 4.0, accessible |
| MONEY-contracts — `api.mercadopublico.cl` | JSON REST by proveedor RUT + ticket | HIGH | 10k req/day quota; documented |
| MONEY-finance — `aportes.servel.cl` | Artisanal cheerio + JSF 2-step | HIGH (that it's fragile) | No API; confirmed fragile by independent scrapers |

## Feature Blocks (table stakes / differentiators / anti-features)

**VOTE** — Table stakes: per-legislator vote list (A favor/En contra/Abstención/Pareo/Ausente) + attendance + identity guard on profile. Differentiators: vote × topic (reuses v1.0 embeddings), filter facets, "rebellions" metric. Anti-features: ideology score, pivotality index, ally/rival co-voting framing.

**INT** — Table stakes: lobby meetings list, asset declaration + filing date (InfoProbidad CC BY 4.0 visible), interest declaration (literal only), version history. Differentiators: lobby counterpart sub-master, patrimonio side-by-side (no delta verdict), bill adjacency context (legal sign-off). Anti-features: "conflict of interest" flags, family data exposed, "enrichment alert," lobby influence score.

**MONEY** — Table stakes: campaign finance verbatim (SERVEL), state contracts strictly worded ("contratos asociados al RUT", never "del parlamentario"), provenance + as-of-date per row. Differentiators: donor aggregation, contract aggregation by counterparty (both need sub-masters), money timeline. Anti-features: donation→vote correlation, company contracts as personal income, public RUT exposure.

**NET (last)** — Table stakes: relationship graph, every edge carries provenance, both endpoints `confirmado`. Differentiators: shared-counterparty discovery, interactive filter by edge type/time. Anti-features: influence scores, suspicious-cluster flags, LLM-inferred edges, accusatory path-finding.

## Build Order & Dependencies

```
VOTE spike (gate, parallel with identity work) → confirm WAF reachability, Diputado/Id + Opcion non-null, coverage, rate. Pass → @obs/votos enriches existing voto table by DIPID. Fail → replan VOTE only; INT/MONEY proceed.
Identity completeness (parallel) → backfill parlamentario.rut (internal-only); extend golden set with homonym cases. Prereq for all RUT-cross datasets.
INT (@obs/lobby + @obs/probidad) → meetings + lobby sub-master; declarations (CC BY 4.0); first /parlamentario/[id] sections; blocking drift for declarations.
MONEY (@obs/dinero, ChileCompra first, SERVEL last) → add servel.cl to allowlist; RUT DV validation + persona tagging; donor + contractor sub-masters here (not deferred); legal review gate before public exposure.
NET (last) → influencia_edge materialized by pg_cron + recursive-CTE RPC; @xyflow/react@12 client island; both endpoints confirmado; legal sign-off on framing.
```

## Watch Out For

1. **Confirmed-link guard as a typed writer-level invariant, not a convention.** Every new `*Writer` must structurally refuse to set a `parlamentario_id` FK on a non-confirmed match. A wrong lobby/money link on a public ficha = existential risk #1.
2. **RUT over-trust on SERVEL/ChileCompra.** Candidate/supplier RUTs ≠ chamber roster. Validate DV (módulo-11), tag persona-natural vs jurídica, constrain to electoral period. The v1.0 deterministic-by-official-id path does NOT generalize to these sources.
3. **Sub-masters are the silent real cost of INT and MONEY** (lobbyist/firm, donor, contractor) — prerequisites for NET edges. Do not defer them to "the NET phase."
4. **Temporal adjacency as implied causality.** "No single UI unit pairs a money/lobby event with a vote" must be a hard success criterion from the first multi-dataset section.
5. **Ley 21.719 full force 2026-12-01 — legal review is time-bounded.** Two explicit gates: before MONEY public exposure, before NET. Cover republication, sensitive data (afiliación política = dato sensible), private third parties (donors/lobbyists/relatives).
6. **SERVEL blocking drift** (not v1.0 non-blocking default). A structure change must quarantine the run, not silently emit fewer rows — half-scraped = false-by-omission.
7. **opendata.camara.cl spike is confirm-or-replan, not discovery.** Four tight checks. Do not size VOTE stories before spike results are in.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack additions | HIGH | One new dep; zero new ingestion libs; React Flow SSR verified |
| VOTE source | MEDIUM | Documented; live behavior unconfirmed; spike resolves |
| INT sources | MEDIUM-HIGH | InfoProbidad HIGH; leylobby bulk MEDIUM (503 at research) |
| MONEY — ChileCompra | HIGH | REST API documented, ticket-keyed |
| MONEY — SERVEL | HIGH (fragility) | Artisanal approach is the known-correct path |
| Architecture integration | HIGH | Verified vs v1.0 migrations + package contracts |
| Legal framing | HIGH | Ley 21.719 provisions + dates verified |
| Anti-feature boundaries | HIGH | Anchored to comparators + PROJECT.md LOCKED rules |

**Gaps to address:** VOTE live behavior (Phase-1 spike); leylobby bulk endpoint (re-validate before `@obs/lobby`); RUT completeness in v1.0 master (measure during backfill before sizing INT/MONEY); sub-master identity model for lobbyists/donors/contractors (design session before NET); legal review scope (milestone task with counsel before MONEY and NET ship).
