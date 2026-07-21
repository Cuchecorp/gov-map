# Project Research Summary

**Project:** Observatorio del Congreso 360 — v9.0 "Robustez de productos estrella + seguridad final"
**Domain:** Legislative-transparency web platform (civic tech, Chile Congress) — hardening an existing production system
**Researched:** 2026-07-21
**Confidence:** HIGH

## Executive Summary

v9.0 is **not greenfield** — it is a robustness pass over a production system (Next.js 16 App Router + Supabase PG15/pgvector, `service_role` + RPC allowlist, DOS-ETAPAS ingesta, anon dead). The research is unanimous on one point: **the flagship search is broken in exactly the way that most damages a transparency product** — it is semantic-only over a ficha-based embedding, so a citizen who types the LITERAL words of a title, or pastes a boletín number, can get "no results." The fix is entirely native Postgres — FTS `spanish` + `unaccent` + `pg_trgm`, fused with the existing pgvector kNN via **Reciprocal Rank Fusion (RRF)**, the official Supabase pattern — plus a deterministic boletín short-circuit. **Zero new runtime libraries** for the core; everything is SQL/extensions inside the existing `service_role + allowlist` model, and deep-links / bio / citaciones reuse `fetch`/`cheerio`/`fast-xml-parser` already in the repo.

The recommended approach follows the LOCKED three-pass structure: **P1 búsqueda/PL** (hybrid retrieval + client-side filters + validation deep-links), **P2 personas/agenda** (official bio, lobby legibility, citaciones coverage), **P3 seguridad** (final audit). The single most-repeated integration motion across all of P1/P2 is the same needle: **new migration (>0044, zero `grant … to anon`) + security-definer RPC (PII-safe) + `PUBLIC_RPC_ALLOWLIST` entry + `service_role .rpc()`**. Everything else is client-island filtering (React state, no re-query) and ingesta coverage backfill (LOCAL, `--from-r2`).

The dominant risk is **not technical — it is legal/correctness**. Three existential traps recur: (1) shipping hybrid search without a frozen golden-query gate → silently regressing the NL/similares cases while fixing the literal case; (2) republishing bio PII (Ley 21.719 applies even to public sources — "the source published it" is NOT a defense) and asserting stale/tenseless party affiliation; (3) linking lobby audiencias to bills by keyword regex → false influence claims (anti-insinuación LOCKED-prohibited). **Partido is a legal gate, not a code gap** — the `parlamentario.partido` column exists but is deliberately withheld (Ley 21.719); an agent NEVER flips it. Mitigation is baked into the phase order: SPIKE-with-golden-gate first, parser field-allowlist for bio, explicit-boletín-only lobby links, coverage audit before agenda UI, and a public-repo/hostile-subject security model (git-history secret scan, RPC-allowlist re-derivation, bounded RPCs, CSP enforce).

## Key Findings

### Recommended Stack

The core of v9.0 adds **no application dependencies** — hybrid retrieval is 100% Postgres extensions + SQL. See `.planning/research/STACK.md`. Deep-links, bio and citaciones reuse connectors already imported in the repo. Confidence is HIGH on everything except the BCN SPARQL biography endpoint (MEDIUM — needs a SPIKE).

**Core technologies (all new work is SQL/extensions):**
- **`unaccent` + `pg_trgm`** (Postgres contrib, Supabase built-in): accent-insensitive FTS + fuzzy/substring match for título/nombre — wrap `unaccent` in an IMMUTABLE `f_unaccent()` so it can be indexed.
- **FTS `spanish` + RRF fusion with pgvector** (official Supabase `hybrid_search` pattern): `websearch_to_tsquery` (never raw `to_tsquery`), `ts_rank_cd`, `full outer join`, `rrf_k=50` — fuses on RANK not raw scores, so no cosine-vs-`ts_rank` normalization. Reuses the proven `0032_agenda_search.sql` template.
- **pgvector 0.8.2** (already in use, HNSW 768-dim): only referenced by the new hybrid RPC — confirm cloud runs ≥0.8.2 (fixes CVE-2026-3172).
- **`cheerio` 1.2.0 / `fast-xml-parser` 5.x / `fetch`** (already in repo): Senado PHP comisiones, Cámara `citaciones_semana.aspx`, `WSCamaraDiputados getDiputados` (XML, HTTP GET, no SOAP), BCN SPARQL (JSON, no RDF client).
- **Splinter + `index_advisor` + `pnpm audit` + secret scanning** (P3): existing/native tools — no new heavy DAST scanner.

### Expected Features

Full analysis in `.planning/research/FEATURES.md`. Comparables: Congress.gov, GovTrack, OpenStates, TheyWorkForYou, OpenParliament.ca, InfoLobby.cl, Vota Inteligente. Everything respects **anti-insinuación LOCKED** (never causalidad/intención, never afinidad política) and **fuente+fecha+enlace**.

**Must have (table stakes):**
- **Cero-fallo en número de boletín** (`14309-04`, `14309`, `14.309-04`) — deterministic exact match, always #1. The flagship must never miss a correctly-typed boletín.
- **Cero-fallo en fragmento LITERAL del título** — FTS `spanish` over título/materia; this is THE explicit gap ("HOY falla con palabras LITERALES").
- **Retrieval híbrido keyword ∪ semántico (RRF)** — chosen by empirical SPIKE with golden queries.
- **Filtros/sort client-side** over already-fetched results (estado/tipo/año/cámara), chips + counts + faceta-vacía deshabilitada, **sin re-buscar**.
- **Deep-link de validación** por boletín al punto preciso oficial + fecha de captura.
- **Bio oficial en ficha** (partido —gated—, región/distrito, periodos, profesión, comisiones).
- **Cobertura completa de citaciones** (sala + comisiones, ambas cámaras) — auditoría ANTES de UI.

**Should have (competitive / differentiators):**
- **Ranking explicable** (mensaje Ejecutivo > moción, recencia) — reglas, no ML opaco.
- **Snapshot R2 link** como respaldo legal ("esto decía la fuente ese día").
- **Cross-links factuales** (mismo partido/comité/región) + co-autoría — jamás afinidad inferida.
- **Enlace audiencia → PL** como coincidencia de materia (leyenda anti-causal) — nadie en Chile lo hace bien.

**Defer (v9.x / v10+):**
- Filtro por tema/materia normalizada; frescura por-dato superficializada; alertas/seguimiento por boletín; grafo de influencia P6; notificaciones pre-votación.

**Anti-features (LOCKED-prohibited):** "voting summaries" estilo TheyWorkForYou; score/ranking de parlamentarios; "con quién se alía" por co-voto/co-lobby; ranking por polémica; filtro por polémica; predicción de aprobación.

### Architecture Approach

Integration map (not greenfield) in `.planning/research/ARCHITECTURE.md`, grounded in real repo file/line reads. Every new public data path threads the same needle: **migration (>0044, no anon grant) + security-definer PII-safe RPC + `PUBLIC_RPC_ALLOWLIST` entry + `service_role .rpc()`**. The site client is `service_role` (DB blocks nothing) → **the guard is the wall**.

**Major components:**
1. **`buscar_proyectos_hibrido` RPC** (NEW) — `busqueda_tsv` generated column + GIN on `proyecto`, unions boletín-exact + FTS + semantic kNN, merged by RRF, returns boletín+rank only. `match_proyectos` stays for "similares". Modifies `app/lib/buscar.ts`; gated by SPIKE.
2. **`components/buscar-filtros.tsx` island** (NEW, `"use client"`) — receives serialized slice, filters/sorts in-memory (año/iniciativa/estado-bucket/cámara). Needs an **estado-bucket normalizer** (free-text → enum). Follows the FichaRail contract (island never touches Supabase).
3. **Bio ingesta connector** (NEW, `@obs/identity` or `@obs/bio`, DOS-ETAPAS) — fuente→R2→minimizing load; new `biografia`/`profesion` columns or `parlamentario_bio` table; PII-safe RPC. **Partido stays gated** (`PARTIDO_PUBLIC_ENABLED`, deny-by-default, legal sign-off).
4. **Citaciones coverage backfill** (ingesta, LOCAL `--from-r2`) — Senado comisiones is FORWARD-ONLY (historical gap), Cámara sala is a thin PDF→DeepSeek path; the model already covers comisión citaciones generically → coverage/backfill, not schema. Then modified `/agenda` per-day + filters.
5. **Security guards** (extend, don't duplicate) — lockdown/PII/anti-insinuación/pgTAP re-run over new RPCs; final audit adds live-DB grant/RLS check + git-history secret scan + CSP enforce + DB-password rotation.

### Critical Pitfalls

Top pitfalls from `.planning/research/PITFALLS.md` (12 total, all project-specific):

1. **Hybrid swap without a frozen golden gate** — silently regresses NL/similares/boletín while fixing literal-title. Avoid: freeze ≥30 golden queries (literal title, paraphrase, norma, all boletín formats, NL, similares) BEFORE any hybrid code; keep old RPC behind a flag until it dominates.
2. **Spanish FTS config mismatch** (accents, ñ, `unaccent` STABLE-not-IMMUTABLE) — "Ñuñoa", "Aysén", "medio ambiente" break asymmetrically; index bypassed silently. Avoid: bake `unaccent` into a STORED generated tsvector with a custom `es_unaccent` config; query with the exact same config.
3. **Raw input → `to_tsquery` + naive score-mixing** — 500s on `sub-secretaría`/`16733-07`; cosine+`ts_rank` scale mismatch. Avoid: `websearch_to_tsquery` always; RRF on rank position, not weighted sum.
4. **Bio PII republished (Ley 21.719 minimización)** — "the source published it" is NOT a defense. Avoid: **field allowlist at the parser** (name/party/comité/cámara/región/vetted prose only); PII stays in R2 crudo, never loaded into Supabase-served tables; legal sign-off.
5. **Stale/tenseless party + comité≠partido; lobby→bill false links** — asserting current party from a stale snapshot, or linking audiencia→boletín by keyword, produces false claims about hostile-capable subjects (fuses existential risks #1 and #2). Avoid: timestamp party ("según fuente al fecha"), keep comité and partido distinct, link lobby→bill ONLY on explicit boletín pattern with anti-causal legend, run the anti-insinuación linter.
6. **Final security pass as ordinary OWASP** — misses the public-repo + service_role-bypass + hostile-subject threat model. Avoid: git-**history** secret scan (rotate ever-committed, incl. DB password B26), re-derive RPC allowlist over new P1/P2 RPCs, bound expensive RPCs (`LIMIT`+`statement_timeout`+`match_count` cap), flip CSP Report-Only → enforced, re-verify identity golden gate (correctness IS the legal defense).

## Implications for Roadmap

Based on combined research, the LOCKED three-pass structure maps to **~11 phases (86–96)** across three autonomous runs with `/clear` between passes.

### PASS 1 — Búsqueda / PL (Phases 86–89)

#### Phase 86: SPIKE — Hybrid retrieval + golden-query gate
**Rationale:** No schema until the algorithm is chosen empirically — the milestone mandates it, and Pitfall #1 makes it the load-bearing first step. Gates 87.
**Delivers:** Frozen golden set (≥30 queries incl. accent/ñ/place-name and all boletín formats), scored baseline (FTS-only vs semantic-only vs RRF), chosen merge/rank.
**Addresses:** Retrieval híbrido, golden queries gate (FEATURES P1).
**Avoids:** Pitfalls 1, 2, 3, 4 (all validated here before code).

#### Phase 87: Hybrid retrieval RPC + rewire
**Rationale:** Implements the SPIKE decision; the flagship bug fix.
**Delivers:** Migration `00NN_proyecto_search` (STORED `es_unaccent` tsvector + GIN + trgm), `buscar_proyectos_hibrido` RPC (boletín short-circuit outside RRF) + allowlist entry, rewired `app/lib/buscar.ts`.
**Uses:** `unaccent`/`pg_trgm`/FTS/RRF (STACK); reuses `0032` pattern (ARCHITECTURE).
**Implements:** Component 1 (hybrid RPC). **Avoids:** Pitfalls 2, 3, 4.

#### Phase 88: Client-side filters + explicable ranking
**Rationale:** Operates on what retrieval returns; pure client transform, no re-query.
**Delivers:** estado-bucket normalizer, `components/buscar-filtros.tsx` island (chips/counts/faceta-vacía), ranking (mensaje>moción, recencia).
**Addresses:** Filtros/sort client-side, ranking explicable (FEATURES P1).
**Avoids:** Pitfall 5 (facet counts labeled "de estos N resultados"; NULL-partido bucket explicit).

#### Phase 89: Deep-link de validación por boletín
**Rationale:** Enhances all fichas; data-plumbing (persist `prmID`/`idNorma`/`link_mensaje_mocion`), not just UI.
**Delivers:** Per-boletín validated deep-link (Senado `?boletin_ini=`, Cámara `prmID`+`prmBOLETIN`, BCN `idNorma`) + fecha captura + R2 snapshot link. **BrowserOS gate** (content-match 200, no buildId).
**Addresses:** Deep-link de validación (FEATURES P1). **Avoids:** Pitfall 6.

### PASS 2 — Personas / Agenda (Phases 90–94) — `/clear` before

#### Phase 90: Bio ingesta connector (DOS-ETAPAS)
**Rationale:** Gates 91 (ficha can't mount bio without connector + column).
**Delivers:** `@obs/identity`/`@obs/bio` connector (WSCamaraDiputados `getDiputados`; BCN SPARQL if SPIKE-approved) → R2 → **field-allowlist minimizing load** → new column(s) + PII-safe RPC + allowlist.
**Uses:** `fetch`+`fast-xml-parser`/`cheerio` (STACK). **Avoids:** Pitfalls 4, 7 (parser allowlist), 11 (confirmed-identity only).

#### Phase 91: Ficha parlamentario — bio + region cross-links
**Rationale:** Mounts P2 headline; partido stays GATED.
**Delivers:** Bio header (región/distrito/periodos/profesión/comisiones) + `parlamentarios_por_region` cross-link RPC + co-autoría (F48 LIVE). **Partido behind `PARTIDO_PUBLIC_ENABLED`, deny-by-default, human legal sign-off.**
**Addresses:** Bio oficial, cross-links factuales (FEATURES P1/P2). **Avoids:** Pitfall 8 (timestamped party, comité≠partido, no afinidad).

#### Phase 92: Lobby legible + audiencia→PL
**Rationale:** Materia is already full in DB — this is presentational + a fail-closed link.
**Delivers:** Legible materia UI + audiencia→PL via existing `lobby_en_tramitacion` (or new PII-safe RPC) **only on explicit boletín mention**, anti-causal legend.
**Addresses:** Lobby legible (FEATURES P2). **Avoids:** Pitfall 9.

#### Phase 93: Citaciones COVERAGE AUDIT
**Rationale:** LOCKED gate — "antes de tocar UI" is explicit. Gates 94.
**Delivers:** Coverage N/M declaration (Senado comisiones forward-only gap, Cámara sala PDF backfill via `--from-r2` LOCAL), comisiones unidas/especiales checked, curl-probed endpoints.
**Uses:** existing `pnpm freshness`, Cámara/Senado connectors (STACK/ARCHITECTURE). **Avoids:** Pitfall 10 (coverage honesty).

#### Phase 94: /agenda per-day + journalist filters
**Rationale:** Only after audit; reuses `citacion`/`sesion_tabla_item`/`buscar_citaciones`.
**Delivers:** Per-day grouping (**America/Santiago** tz), filters (cámara/comité/fecha/boletín), "esta semana", cancelled-state modeled. **BrowserOS gate.**
**Addresses:** Citaciones completas (FEATURES P1). **Avoids:** Pitfall 10 (tz, cancelled state).

### PASS 3 — Seguridad (Phases 95–96) — `/clear` before

#### Phase 95: Re-run + extend guards over new RPCs
**Rationale:** Every new P1/P2 RPC expanded the attack surface under service_role.
**Delivers:** lockdown/PII/anti-insinuación/pgTAP re-run + extended; new RPCs bounded (`LIMIT`+`statement_timeout`+`match_count` cap).
**Avoids:** Pitfall 12 (allowlist drift, unbounded RPC DoS).

#### Phase 96: FINAL AUDIT (net-new, non-duplicative)
**Rationale:** The guards check migrations; the audit checks the LIVE DB + public repo.
**Delivers:** Live-DB grant/RLS audit, git-**history** secret scan, `.env.example` placeholder check, generic error responses, **CSP Report-Only → enforced**, Splinter/`pnpm audit`, pgvector ≥0.8.2 confirm, **DB password rotation (operator B26)**, identity golden-gate re-verify.
**Avoids:** Pitfall 12.

### Phase Ordering Rationale

- **SPIKE gates the migration** (86→87): the algorithm must be chosen empirically before any schema exists — the milestone and Pitfall #1 both demand it.
- **Bio ingesta gates the ficha** (90→91): no bio column, no bio header.
- **Coverage audit gates the agenda UI** (93→94): "antes de tocar UI" is LOCKED; a partial calendar shown as complete deceives prensa.
- **Legal gates are human, not agent decisions:** partido (Ley 21.719) and any concrete audiencia→PL link are deny-by-default; agents build TO the gate and never flip it.
- **Security last** (95–96): new RPCs from P1/P2 must exist before their attack surface can be audited; live-DB + public-repo checks are net-new over the migration-level guards.

### Research Flags

Phases likely needing `/gsd:plan-phase --research-phase <N>` during planning:
- **Phase 86 (SPIKE):** empirical — the golden-set scoring IS the research; the RRF weights/`rrf_k`/candidate-limit for THIS corpus are unknown until measured.
- **Phase 90 (Bio ingesta):** BCN SPARQL endpoint stability is MEDIUM confidence (needs a probe SPIKE); connector shape not yet written; field-allowlist requires legal review.
- **Phase 93 (Coverage audit):** the audit itself is discovery work — the exact Cámara-sala DeepSeek state and Senado forward-only gap must be measured, not assumed.

Phases with standard/proven patterns (skip research-phase):
- **Phase 87 (Hybrid RPC):** the FTS-on-Supabase + RRF pattern is proven in `0032` and the official Supabase docs; SQL is fully specified in STACK.md.
- **Phase 88 (Filters):** client-island contract already exists (FichaRail); pure React state.
- **Phase 89 (Deep-links):** URL patterns verified live 2026-07-21; plumbing is known columns.
- **Phase 94 (/agenda UI):** reuses existing tables/RPC; modified page, no new schema.
- **Phases 91/92 (Ficha/lobby):** mostly presentational + one gated RPC; patterns established.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Extensions + URL patterns verified live; RRF is official Supabase pattern; only BCN SPARQL is MEDIUM (SPIKE-gated). Zero new runtime deps for the core. |
| Features | HIGH | Direct comparables (Congress.gov, GovTrack, OpenStates, TheyWorkForYou, InfoLobby, Vota Inteligente); anti-features map cleanly to LOCKED rules. |
| Architecture | HIGH | Every integration point cites a real repo file/line; the gaps (partido gate, comisión-membership model, Senado forward-only) are named honestly. Bio connector shape MEDIUM (not yet written). |
| Pitfalls | HIGH | FTS/RRF/deep-link mechanics verified against Supabase + Postgres docs; project rules from PROJECT.md/CLAUDE.md/MEMORY.md. |

**Overall confidence:** HIGH

### Gaps to Address

- **RRF weights / `rrf_k` / candidate-limit for this corpus** — unknown until the SPIKE; handle in Phase 86 (empirical golden-set scoring, old RPC behind a flag).
- **BCN SPARQL biography endpoint** — MEDIUM; probe in Phase 90 SPIKE, degrade to WSCamaraDiputados (diputados) + Senado ficha (senadores) if unstable.
- **Partido legal gate (Ley 21.719, plena vigencia 2026-12-01)** — NOT a code decision; build deny-by-default behind `PARTIDO_PUBLIC_ENABLED`, await human sign-off. Never flipped by an agent.
- **Comisión-membership model** — does not exist today; "same committee" cross-links require NEW ingesta (comisiones integrantes) before UI. Scope in Phase 90/91 or defer.
- **Cámara-sala DeepSeek coverage** — memory says live-but-thin; exact state measured in Phase 93 audit, not assumed.
- **estado-bucket normalizer** — `proyecto.estado`/`etapa` are free text; the bucketing enum must be defined in Phase 88.
- **Concrete audiencia→PL link legality** — requires anti-insinuación/legal review; default to reusing `lobby_en_tramitacion` unless explicitly approved.

## Sources

### Primary (HIGH confidence)
- Supabase Hybrid search (RRF, `websearch_to_tsquery`, `ts_rank_cd`, `rrf_k=50`, weights) — Context7 `/llmstxt/supabase_llms-full_txt` + docs
- Supabase Full text search + PostgreSQL Controlling Text Search / unaccent IMMUTABLE trap
- pgvector 0.8.2 (CVE-2026-3172) — postgresql.org
- WSCamaraDiputados (`getDiputados` -> `Militancia_Actual`, XML by GET) — opendata.congreso.cl
- Deep-links Senado `?boletin_ini=` / Cámara `prmID`+`prmBOLETIN` / BCN `idNorma` — verified live 2026-07-21
- Splinter (Supabase Postgres linter) + `index_advisor` — github.com/supabase/splinter
- Comparables: GovTrack, Congress.gov, OpenStates, TheyWorkForYou, InfoLobby.cl, Vota Inteligente
- Repo reads: `app/lib/buscar.ts`, `buscar/page.tsx`, `types.ts`, `proyecto/[boletin]/page.tsx`, `parlamentario/[id]/page.tsx`, `lobby-de-parlamentario.tsx`, `agenda/page.tsx`, migrations `0005/0011/0020/0032`, `lockdown-guard.test.ts` (PUBLIC_RPC_ALLOWLIST)
- PROJECT.md / CLAUDE.md / MEMORY.md — LOCKED rules (identity fail-closed, anti-insinuación, DOS-ETAPAS, WAF/curl, service_role+allowlist, buildId volatility, Ley 21.719, PostgREST 1k cap, CSP Report-Only)

### Secondary (MEDIUM confidence)
- BCN Biografías Parlamentarias — SPARQL endpoint, ontología `bcnbio:`, ~3.900 congresistas, no REST por-ID
- RUM index (Supabase) — available, not recommended at this corpus scale
- RRF vs weighted sum (scale mismatch) — paradedb, OpenSearch RRF
- Modern hybrid/faceted search patterns — general RRF/faceting references

### Tertiary (LOW confidence)
- Cámara-sala DeepSeek-from-PDF coverage state — memory says live-but-thin; verify in Phase 93 audit
- PostgreSQL Spanish stemmer partial-word misses (politi/politic) — bug thread, informs golden-set cases

---
*Research completed: 2026-07-21*
*Ready for roadmap: yes*
