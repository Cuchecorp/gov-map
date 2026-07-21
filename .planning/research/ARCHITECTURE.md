# Architecture Research — v9.0 Integration

**Domain:** Civic data platform (Next.js 16 App Router + Supabase, service_role + RPC allowlist), subsequent-milestone hardening
**Researched:** 2026-07-21
**Confidence:** HIGH (grounded in repo reads; every integration point below cites a real file/line)

> This is an **integration** map, not a greenfield architecture. It answers "where does each v9.0 feature attach to what already exists, what is new vs modified, and where the data gaps are." Ordering follows the LOCKED three-pass structure (P1 búsqueda/PL → P2 personas/agenda → P3 seguridad).

---

## System Overview (as-built, relevant slice)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER (client islands only: SearchBox, FichaRail scrollspy, toggles)    │
│  — NUNCA llama fuentes ni modelos; navega y filtra ya-fetcheado.           │
├──────────────────────────────────────────────────────────────────────────┤
│  NEXT.JS 16 APP ROUTER  (app/app/**)  — Server Components por defecto       │
│   /buscar    /proyecto/[boletin]   /parlamentario/[id]   /agenda           │
│      │              │                     │                  │             │
│   lib/buscar   leerProyecto/         getParlamentarioPublico  lib/agenda-  │
│   (embed+RPC)  leerFicha/leerAutores  + *Section RPCs         buscar (FTS) │
├──────────────────────────────────────────────────────────────────────────┤
│  DATA ACCESS: createServerSupabase() = service_role                        │
│   ▸ .from(<tabla pública>)  ▸ .rpc(<solo PUBLIC_RPC_ALLOWLIST>)             │
│   Guards: lockdown-guard (grants>0044), PII/allowlist, anti-insinuación    │
├──────────────────────────────────────────────────────────────────────────┤
│  SUPABASE POSTGRES  (migrations 0001–0054, psql direct)                    │
│   proyecto · proyecto_ficha · proyecto_embedding(HNSW) · votacion/voto     │
│   parlamentario(maestra, deny-by-default: partido/rut/email OCULTOS)       │
│   citacion/citacion_punto/citacion_invitado · sesion_sala/sesion_tabla_item│
│   lobby_audiencia/lobby_contraparte · cruce_senal · entidad_tercero        │
│   RPCs security-definer (proyectan solo campos públicos PII-safe)          │
├──────────────────────────────────────────────────────────────────────────┤
│  INGESTA (packages/@obs/*, Deno/TS)  — DOS ETAPAS LOCKED fuente→R2→Supabase │
│   crons = GitHub Actions semanales · backfill masivo = LOCAL · --from-r2   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Load-bearing invariants for every v9.0 change:**
1. New public data path = **new migration** (`NNNN_*.sql`, psql direct, `> 0044` → **zero `grant … to anon/public`**, verified by `app/lib/lockdown-guard.test.ts`) **+** a **security-definer RPC added to `PUBLIC_RPC_ALLOWLIST`** (same file, line 165) **+** the server component reading it via `createServerSupabase().rpc(...)`.
2. The site client is `service_role` → the DB no longer blocks anything; **the guard is the wall**. Any `.rpc()` from the public tree must be in the allowlist; any `.from(<PII tabla>)` fails the PII guard.
3. Anti-insinuación linter (`app/lib/anti-insinuacion-guard.test.ts`) + carril-aislado `mt-12` rule apply to every new surface.

---

## Feature-by-feature integration (new vs modified)

### Q1 — Hybrid retrieval (why literal title words miss; least-invasive fix)

**Current query path** (`app/app/buscar/page.tsx` → `app/lib/buscar.ts:177`):
`qRaw` trim/cap 300 → `BOLETIN_RE` shortcut → **Gemini `RETRIEVAL_QUERY` embed** → `sb.rpc("match_proyectos", {query_embedding, match_count, match_threshold: 0.59, exclude_boletin})` (`supabase/migrations/0011_fichas_embeddings.sql:55`) → returns `(boletin, similarity)` → page hydrates rows from `proyecto`.

**Why a LITERAL title word misses:** `match_proyectos` is **pure cosine kNN over `proyecto_embedding` only**, with `match_threshold = 0.59` (`buscar.ts:67`). The embedding is built from the *ficha* (idea matriz / cuerpos legales), not the title, and only ~84,6% of the corpus is embedded (v6.1: 3.100/3.657). So a query that is an exact substring of `proyecto.titulo` has **no lexical path at all** — if the title's semantics don't clear 0.59, or the proyecto has no embedding row, it returns nothing. There is no FTS/`ILIKE`/trigram over `proyecto.titulo`/`materia`/`boletin_num`.

**The template already exists in-repo:** `0032_agenda_search.sql` built a `spanish` FTS generated column + GIN index + `websearch_to_tsquery` RPC (`buscar_citaciones`) over `citacion`. **Reuse that exact pattern on `proyecto`.**

**Least-invasive hybrid (new + modified):**
- **NEW migration** `00NN_proyecto_search.sql`: `alter table proyecto add column busqueda_tsv tsvector generated always as (to_tsvector('spanish', coalesce(titulo,'')||' '||coalesce(materia,''))) stored;` + GIN index. Then a **NEW RPC `buscar_proyectos_hibrido(q text, query_embedding vector(768), match_count int, match_threshold float8)`** (security-definer, `set search_path=''`) that UNIONs: (a) boletín-exact on `boletin`/`boletin_num`; (b) FTS `busqueda_tsv @@ websearch_to_tsquery('spanish', q)`; (c) semantic `match_proyectos`-style kNN — merged/deduped by boletín with a deterministic rank (lexical hits float above semantic, or RRF). Returns `(boletin, rank)` only — **never** non-public columns (mirror `0011` T-07-03). **Add `buscar_proyectos_hibrido` to `PUBLIC_RPC_ALLOWLIST`** and **`grant execute … to service_role`** (NOT anon — `> 0044` guard).
- **MODIFIED** `app/lib/buscar.ts`: `buscarProyectos` calls the new RPC (still embeds `q` for the semantic leg; passes `q` text for the lexical legs — parametrized, never interpolated). Keep the boletín shortcut. The page (`buscar/page.tsx`) is untouched except that the "no embedding → 0 results" failure mode disappears.
- **SPIKE gate (P1 requires it):** golden queries incl. exact title words, número de boletín, idea NL, norma afectada. Decide the merge/rank empirically before wiring. `match_proyectos` stays for `ProyectosSimilares` (kNN self-exclusion) — do not remove it.

**Confidence: HIGH** — the FTS-on-Supabase pattern is proven in `0032`; `pgvector` HNSW already indexed.

---

### Q2 — Client-side filters over already-fetched results

**Current result shape** (`buscar/page.tsx:129` hydration): full `ProyectoRow` (`app/lib/types.ts:13`) with `boletin, boletin_num, titulo, iniciativa, camara_origen, autores[], materia, estado, etapa, subetapa, origen, fecha_captura`.

**Facet data availability (honest gap analysis):**

| Facet | Source in `proyecto` | Gap? |
|-------|----------------------|------|
| **Año** | derive from `boletin_num` (`NNNNN-YY`) or `fecha_captura` | present (derivable) |
| **Mensaje / moción** | `iniciativa` (`"Mensaje"` vs other — used at `proyecto/[boletin]/page.tsx:554`) | present |
| **Estado (archivado / en trámite)** | `estado` / `etapa` (free text) | present but **needs a normalizer** (bucket free-text → {en trámite, archivado, publicado, …}) — no enum today |
| **Cámara de origen** | `camara_origen` | present |
| **Partido de autores** | `autores` is `string[]` of raw names; `proyecto_autor` (0051) links to maestra by name — but **`parlamentario.partido` is deny-by-default (LEGAL-03)** and never surfaced publicly | **BLOCKED** — see Q4; do not build a partido filter in P1 unless the legal gate for partido opens |

**Pattern for the client island (matches repo idiom):** the page already renders in a Server Component and paginates server-side. For "reorder/filter WITHOUT re-query," follow the existing **server-fetch → serialize → client island** contract (same as `FichaRail`: server passes fully-derived data, island never touches Supabase). **NEW client component** `components/buscar-filtros.tsx` (`"use client"`): receives the full page slice as a prop, filters/sorts in-memory over `año/iniciativa/estado-bucket/camara`, ranking toggle (mensajes > mociones, recencia). **MODIFIED** `buscar/page.tsx` to fetch a larger slice (the RPC already returns ranked boletines) and mount the island. Ranking (mensajes del Ejecutivo > mociones, recencia) is a **pure sort** on `iniciativa` + `boletin_num` year — belongs in the island or as a stable secondary sort in the hybrid RPC.

**Do not** add a URL round-trip for these filters — the requirement is explicitly "sin re-buscar." Keep the boletín/q flow server-side; make facets client-only.

---

### Q3 — Ficha /proyecto/[boletin]: per-section deep-links to oficial pages

**Where source links render today:** every carril uses `ProvenanceBadge` with `sourceUrl`. The header link is `proyecto.enlace` (`ProyectoRow.enlace`); tramitación events each carry `enlace` (`TramitacionEventoRow.enlace`); votaciones carry `enlace` (`VotacionRow.enlace`). **But two sections show `sourceUrl={null}` on purpose:** idea-matriz (`page.tsx:327` — `texto_r2_path` is an internal R2 key, not a public URL) and the tramitación section badge (`page.tsx:430`).

**Data to build deep-links:** `proyecto.enlace` is the canonical project page (Cámara `pl_numero_boletin` or Senado `ficha`). Per-section deep-links (jump to the exact part of senado.cl/camara.cl) need either (a) fragment/anchor construction on top of `proyecto.enlace`, or (b) the `link_mensaje_mocion` (BCN/Senado document URL) that PROJECT.md flags as **not yet plumbed end-to-end** (`v1.0-MILESTONE-AUDIT` follow-up #4). **This is a data-plumbing task, not just UI:** the honest deep-link for idea-matriz/cuerpos requires persisting the real source document URL (BCN `obtxml`/Senado ficha) so the badge stops showing `null`.

**Integration:** MODIFIED — add a `link_fuente`-style column (or reuse existing `enlace` + a computed anchor) surfaced through `leerFicha`/`leerProyecto`; the P1 "deep-link de validación" is best delivered as a **per-boletín validated link** (construct + BrowserOS-verify it resolves to the right page section). No new RPC needed if the URL already lives on `proyecto`/`proyecto_ficha`; a small ingesta backfill IS needed for `link_mensaje_mocion` to make idea-matriz/cuerpos badges non-null.

---

### Q4 — Ficha /parlamentario/[id]: bio oficial + partido + cross-links

**Where bio/partido would mount:** header via `getParlamentarioPublico` (`parlamentario/[id]/page.tsx:116`) calling RPC `parlamentario_publico` (`0020`), which returns `id, nombre, camara, region, distrito, circunscripcion, periodo, origen, fecha_captura, enlace`. A bio/partido block would mount in `ParlamentarioHeader` or a new above-fold section.

**Existing maestra fields (`0005_parlamentario.sql`):** `partido` (**column EXISTS**, nullable, line 29), `region`, `distrito`, `circunscripcion`, `periodo`, `nombres/apellido_*`. **There is NO `biografia` column** and no bio ingesta today.

**THE HARD CONSTRAINT (call it out honestly):** `partido` is **deliberately withheld**. `0020` (lines 15-17) and `ParlamentarioPublicoRow` docstring (`types.ts:104`) state: *"NUNCA `partido` (afiliación política, dato SENSIBLE Ley 21.719)."* So v9.0 feature (d) "ficha con partido político" is **not a code gap — it is a legal-gate decision**. Two options for the roadmap:
- **(A)** Treat partido as gated (like `MONEY`/`NET`/`cruces`): add a `partido` projection to a **new** security-definer RPC (or extend `parlamentario_publico` behind a flag `PARTIDO_PUBLIC_ENABLED`), deny-by-default, flipped only by human legal sign-off (Ley 21.719, plena vigencia 2026-12-01). An agent NEVER flips it.
- **(B)** Ship bio (biography is arguably less sensitive than afiliación) in P2, and leave partido behind the gate until sign-off.

**Bio ingesta under DOS-ETAPAS LOCKED:** biografías oficiales live on camara.cl (ficha del diputado) / senado.cl (ficha del senador). New connector in `@obs/identity` (or a new `@obs/bio` slice) following the LOCKED pattern: **fuente → R2 content-addressed (`bio/camara|senado/<id>/<sha256>.html`, `If-None-Match:*`) → parse (cheerio) → `parlamentario` (new `biografia`/`profesion` columns via new migration) or a sibling `parlamentario_bio` table**. Hash-check before download; rate-limit 2-3s; `--from-r2` replay. Surface via an extended/new PII-safe RPC (bio text is public on the official ficha → safe to project; RUT/email stay hidden).

**Cross-links (same party/committee/region) reuse existing machinery:**
- **Region:** `parlamentario_publico` already emits `region`/`distrito`/`circunscripcion` → a "same region" cross-link needs only a **new RPC `parlamentarios_por_region(region)`** (PII-safe, projects the listado 7 cols) added to the allowlist; the directory RPC `parlamentarios_publico` (0026) is the template.
- **Same party:** blocked by the partido gate (same as above).
- **Committee (comisión):** **no comisión-membership model exists today** — citaciones have `comision` (text) but there's no `parlamentario ↔ comisión` table. This is a **data gap** requiring new ingesta (comisiones integrantes) before any "same committee" cross-link.
- **Relaciones entre parlamentarios:** `/red` (subgrafo_red RPC, allowlisted) + `cruces_de_parlamentario` already exist — reuse, don't rebuild.

**Confidence: HIGH on the constraint (0020/types.ts are explicit); MEDIUM on bio ingesta shape (connector not yet written).**

---

### Q5 — Lobby: legible + link to PLs

**Current component:** `app/components/lobby-de-parlamentario.tsx` (`LobbySection` server + `LobbyView` pure). **Titles are NOT truncated in the DB** — `lobby_audiencia.materia` stores the full verbatim asunto (`@obs/lobby model.ts:93`) and the RPC `lobby_de_parlamentario` projects `materia` in full; the cronológica view renders `Asunto: {a.materia}` untruncated (`lobby-de-parlamentario.tsx:445`). The "confusing" perception is a **UI/legibility problem** (raw materia strings, and the grouped-by-contraparte DEFAULT view hides the asunto entirely), not a data gap. Fix is presentational (P2 "lobby legible").

**Where full materia lives:** `lobby_audiencia.materia` (DB) → `LobbyAudienciaRpcRow.materia` → `LobbyAudienciaRow.materia`. Already end-to-end; nothing to backfill for the title itself.

**Linking audiencia → proyecto:** the LOCKED rule (`lobby-de-parlamentario.tsx:20-30`) forbids a lobby row from linking a concrete `/proyecto/[boletin]` — carril aislado, anti-insinuación. BUT the requirement says "relación con PLs en movimiento con links específicos." Reconcile carefully:
- Boletín mentions **do** appear inside `materia` free text (e.g. "boletín 14309-04"). A regex extraction (`BOLETIN_RE`-style over materia) could surface candidate boletines.
- **This collides with the anti-insinuación LOCK.** The safe pattern already exists: `LobbyEnTramitacionSection` / RPC `lobby_en_tramitacion` (0048, allowlisted) does the **temporal juxtaposition** on the *proyecto* ficha (not the parlamentario lobby carril). The v9.0 "lobby → PL link" should route through that existing surface, or a **new PII-safe RPC** that links audiencia→proyecto **only by explicit boletín mention in materia** (factual, not inferred), rendered with the mandatory caveat. Decide with a legal/anti-insinuación review, not silently. **New migration + RPC + allowlist** if a direct link is approved; otherwise reuse `lobby_en_tramitacion`.

**Confidence: HIGH** (materia is full in DB; the anti-insinuación constraint is explicit in the component).

---

### Q6 — Citaciones: coverage audit (what is / isn't scraped)

**Current agenda model** (`@obs/agenda model.ts`): `Citacion` (comisión + fecha + materia + `invitados[]` + `puntos[]` with boletín) and `SesionSala` + `SesionTablaItem` (orden del día de sala). Tables: `citacion`, `citacion_punto`, `citacion_invitado`, `sesion_sala`, `sesion_tabla_item` (0010). Search: `buscar_citaciones` FTS (0032/0033).

**Connectors present:**

| Source | Connector | Status |
|--------|-----------|--------|
| **Cámara comisiones citaciones** | `connector-camara.ts` (`citaciones_semana.aspx?prmSemana=`, week enumeration, anti-Cloudflare headers) | scraped |
| **Cámara sala (tabla semanal)** | `connector-camara.ts fetchPdfTabla()` — **PDF only, base pkg exposes URL for honest degradation** | PARTIAL — memory (`camara-tabla-y-buscador-agenda`) says a **DeepSeek-from-PDF path is LIVE** (sesion_tabla_item populated 2026-06-23) but only 1 session/W26; **no historical backfill** |
| **Senado comisiones citaciones** | `connector-senado.ts` (`web-back.senado.cl/api/commissions_citations`) — **FORWARD-ONLY window, sin histórico** | scraped (forward-only) |
| **Senado sala (tabla semanal)** | `connector-senado.ts` (`web-back.senado.cl/api/weekly_table`) | scraped |

**Gap analysis (the P2 "auditoría de cobertura antes de tocar UI" is real work):**
- **Senado comisiones is FORWARD-ONLY** (`connector-senado.ts:54`) → past citaciones are not captured; the API is a moving window.
- **Cámara sala tabla depends on a fragile PDF→DeepSeek path** with no backfill; base `@obs/agenda` treats it as honest-degradation-only.
- **Comisiones membership** (who sits on each comisión) is **not modeled at all** — needed for Q4 committee cross-links.
- **No committee-specific citaciones tables beyond `citacion`** — the model already covers comisión citaciones generically (`camara` enum + `comision` text), so "committee citaciones" needs **no new table**, only **coverage/backfill** (fill the forward-only Senado gap + Cámara sala historical) and richer per-day structuring/filters in `/agenda`.

**Integration:** mostly **ingesta coverage + backfill (LOCAL, `--from-r2`)**, not schema. New UI: `/agenda` per-day grouping + journalist/citizen filters is a **modified `app/app/agenda/page.tsx`** using the existing `citacion`/`sesion_tabla_item` tables and `buscar_citaciones`. The audit itself (which sources are stale/missing) uses the existing `pnpm freshness` CLI.

**Confidence: HIGH on what's scraped; MEDIUM on the exact Cámara-sala DeepSeek state (memory says live-but-thin).**

---

### Q7 — Security validation (P3): what to re-run/extend vs what the final audit adds

**Existing guards (re-run + extend, do not duplicate):**

| Guard | File | v9.0 action |
|-------|------|-------------|
| Lockdown (no `grant … to anon/public` in migrations > 0044) | `app/lib/lockdown-guard.test.ts` | **Re-run** — every new v9.0 migration must pass |
| PUBLIC_RPC_ALLOWLIST (public tree only calls allowlisted RPCs) | same file, line 165 | **Extend** — add `buscar_proyectos_hibrido`, any new region/bio/lobby-link RPC |
| PII guard (no `.from(<PII tabla>)` in `app/`) | CI guard (ci.yml) | **Re-run** — bio/partido must go through RPCs, never `.from(parlamentario)` |
| Anti-insinuación linter | `app/lib/anti-insinuacion-guard.test.ts` | **Extend** — new lobby-link + cruce copy scanned |
| Money/NET/cruces anti-flip guards | `money-antiflip-guard.test.ts`, gates | **Re-run** — ensure no v9.0 change flips a flag; if partido becomes gated, add `PARTIDO_PUBLIC_ENABLED` chokepoint mirroring `money-gate.ts` |
| pgTAP | `supabase/tests/*` | **Extend** — new RPCs get PII-safe assertions (never project partido/rut/email) |
| HTTP security headers | `app/next.config.ts` | **Extend** — P3 "seguridad del sitio": promote **CSP Report-Only → enforced** (currently Report-Only, line 33; needs nonces/hashes that OpenNext doesn't inject — this is the P3 hard task) + configure report-uri |

**What the FINAL audit phase adds (net-new, non-duplicative):**
- **Supabase-side audit:** verify PROD grants match the guards (the guards check *migrations*; the audit checks the *live DB* — that `anon` truly has zero routine/table privileges post-0044, RLS on for every table, no orphan grants). Rotate DB password (B26, long-standing operator debt).
- **Public-repo audit:** the repo is public → scan for leaked secrets in history, confirm `.env` never committed, confirm no service_role key in client bundle.
- **CSP enforcement:** move from Report-Only to enforced (requires OpenNext nonce work) — the single biggest net-new site-security item.
- **Third-party surface:** BrowserOS empirical check that no PII (partido/rut) leaks through any new v9.0 surface, and that every new deep-link resolves.

---

## Suggested build order (dependencies)

```
PASS 1 — Búsqueda / PL  (Phases ~86–89)
  86  SPIKE hybrid retrieval (golden queries) ──► decides merge/rank
       │  (blocks 87; no schema until the spike picks the algorithm)
  87  Migration 00NN_proyecto_search (tsv+GIN) + RPC buscar_proyectos_hibrido
       + allowlist + rewire lib/buscar.ts   [MODIFIED buscar.ts; NEW migration/RPC]
  88  estado-bucket normalizer + client filter island (components/buscar-filtros)
       + ranking (mensaje>moción, recencia)  [NEW island; MODIFIED buscar/page.tsx]
  89  Deep-link de validación por boletín (plumb link_mensaje_mocion / anchor)
       [ingesta backfill + MODIFIED ficha badges]  ── BrowserOS gate

PASS 2 — Personas / Agenda  (Phases ~90–94)  [/clear before]
  90  Bio ingesta connector (@obs/identity, DOS-ETAPAS, R2) + migration
       (biografia col / parlamentario_bio) + PII-safe RPC + allowlist   [NEW]
  91  Ficha parlamentario: mount bio + region cross-links (parlamentarios_por_region)
       [NEW RPC; MODIFIED parlamentario/[id]/page.tsx + header]
      ── PARTIDO stays GATED (PARTIDO_PUBLIC_ENABLED, deny-by-default, legal sign-off)
  92  Lobby legible (presentational) + audiencia→PL link via lobby_en_tramitacion
       (or new PII-safe RPC if legally approved)  [MODIFIED lobby component]
  93  Citaciones COVERAGE AUDIT (freshness) — Senado comisiones forward-only gap,
       Cámara sala PDF backfill  [ingesta LOCAL --from-r2]  ── before UI
  94  /agenda per-day structure + journalist filters  [MODIFIED agenda/page.tsx]
       ── BrowserOS gate

PASS 3 — Seguridad  (Phases ~95–96)  [/clear before]
  95  Re-run + extend all guards (lockdown/PII/anti-insinuación/pgTAP) over new RPCs
  96  FINAL AUDIT: live-DB grant/RLS audit + public-repo secret scan + CSP enforced
       + rotate DB password (operator)  ── net-new, non-duplicative
```

**Hard dependencies:**
- 86 (spike) gates 87 (no migration until the algorithm is chosen empirically).
- 90 (bio ingesta) gates 91 (ficha can't mount bio without the connector + column).
- 93 (coverage audit) gates 94 ("antes de tocar UI" is explicit in PROJECT.md).
- Partido and any concrete audiencia→PL link are **legal gates**, not agent decisions — build to the gate, deny-by-default.
- Every new public data path threads the same needle: **migration (>0044, no anon grant) + security-definer RPC + PUBLIC_RPC_ALLOWLIST entry + service_role `.rpc()`** — this is the single most repeated integration motion in v9.0.

---

## Anti-Patterns (specific to this codebase)

**Adding a new `.rpc()` without updating the allowlist** → `lockdown-guard.test.ts` fails CI. Instead: add the RPC name to `PUBLIC_RPC_ALLOWLIST` in the same PR and confirm it's PII-safe.

**`.from("parlamentario").select("partido"|"rut"|"email")` to "just show the party"** → PII guard fails, and it violates LEGAL-03/Ley 21.719. Instead: gate partido behind a flag + human sign-off; project bio (public on official ficha) via a security-definer RPC.

**Linking a lobby row to a concrete `/proyecto/[boletin]`** inside the lobby carril → breaks the LOCKED anti-insinuación rule. Instead: route through `lobby_en_tramitacion` (temporal juxtaposition on the *proyecto* side) or a factual boletín-mention link with the mandatory caveat, after review.

**`grant … to anon` in a migration > 0044** (even for an allowlisted RPC) → guard fails; the site is `service_role`, anon is dead. Instead: grant to `service_role` only.

**Parsing the Cámara sala PDF as if structured** → it's PDF-only (DeepSeek-from-PDF, thin coverage). Instead: honest degradation + explicit backfill task; never fabricate `sesion_tabla_item` rows.

---

## Integration Points

### External sources (all server-only, DOS-ETAPAS)

| Source | Pattern | Notes for v9.0 |
|--------|---------|----------------|
| camara.cl / senado.cl bio fichas | cheerio over R2-cached HTML | NEW bio connector; rate-limit 2-3s, `--from-r2` |
| web-back.senado.cl/api/commissions_citations | JSON, forward-only | coverage gap — historical citaciones not captured |
| Cámara `verDoc.aspx?...TABLASEMANAL` (PDF) | DeepSeek-from-PDF | thin; needs backfill |
| BCN `obtxml` / Senado ficha | XML/URL | plumb `link_mensaje_mocion` for deep-links + non-null idea-matriz badge |

### Internal boundaries

| Boundary | Communication | v9.0 consideration |
|----------|---------------|--------------------|
| Server Component ↔ Supabase | `createServerSupabase()` (service_role) + allowlisted `.rpc()` / public `.from()` | every new read follows this; guards enforce |
| Server Component → client island | fully-serialized props, island never imports Supabase | buscar-filtros follows FichaRail contract |
| Ingesta (@obs/*) ↔ Supabase | writer-supabase (service key, bypasses RLS) | bio/citaciones writers reuse existing writer pattern |

## Sources

- Repo reads (HIGH): `app/lib/buscar.ts`, `app/app/buscar/page.tsx`, `app/lib/types.ts`, `app/app/proyecto/[boletin]/page.tsx`, `app/app/parlamentario/[id]/page.tsx`, `app/components/lobby-de-parlamentario.tsx`, `app/app/agenda/page.tsx`, `app/next.config.ts`
- Migrations (HIGH): `0005_parlamentario.sql`, `0011_fichas_embeddings.sql`, `0020_parlamentario_publico.sql`, `0032_agenda_search.sql`
- Packages (HIGH): `packages/agenda/src/{model,connector-camara,connector-senado}.ts`, `packages/lobby/src/model.ts`, `packages/fichas/src/model.ts`
- Guards (HIGH): `app/lib/lockdown-guard.test.ts` (PUBLIC_RPC_ALLOWLIST line 165, grants>0044), `app/lib/anti-insinuacion-guard.test.ts`, `money-antiflip-guard.test.ts`
- Project context (HIGH): `.planning/PROJECT.md` (v9.0 goal, LEGAL-03, Ley 21.719, DOS-ETAPAS LOCKED), MEMORY (Camino A service_role cutover, camara-tabla DeepSeek)

---
*Architecture research for: Observatorio del Congreso 360 — v9.0 robustez de productos estrella + seguridad final*
*Researched: 2026-07-21*
