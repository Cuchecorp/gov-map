# Phase 11: INT Lobby — Reuniones de lobby + sub-maestra de contrapartes - Research

**Researched:** 2026-06-19
**Domain:** Civic-data ingestion — Ley del Lobby (Ley 20.730) audiencias from `leylobby.gob.cl`, counterpart sub-master, lobby section of `/parlamentario/[id]`
**Confidence:** HIGH on access method (re-validated live 2026-06-19), HIGH on connector/writer/identity/RLS patterns (verified in v1.0 code + Phase 9 summaries), MEDIUM on the exact congress institution codes + counterpart column layout (validated on a non-congress institution; congress codes need a one-line lookup at plan time)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**INT Lobby:**
- **Acceso a leylobby.gob.cl (research-gated):** bulk CSV/descarga masiva preferente (research v2.0 vio 503 → re-validar la ruta y estructura del archivo en el research de fase); fallback `cheerio` sobre HTML por-registro. Reusa `@obs/ingest` en el orden LOCKED (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get; `leylobby.gob.cl` ya en la allowlist v1.0). Provenance por fila.
- **Sub-maestra de contrapartes:** tabla propia (lobistas/gestores de interés), construida EN ESTE BLOQUE (no diferida a NET). Keyed por el id estable de leylobby si existe; si no, por nombre normalizado (reusa `normalizarNombre`). La contraparte se muestra como TEXTO CRUDO; solo se enlaza a una identidad si está confirmada.
- **Enlace reunión→parlamentario:** solo con match `determinista`/`confirmado` vía `correrPipeline` (el parlamentario "audiencia/sujeto pasivo" cruza contra la maestra); cada decisión deja una fila en `identidad_audit`. El FK se fija vía el invariante tipado `EnlaceConfirmado` (Phase 9). `probable`/`revision`/`no_confirmado` → NULL + mención cruda + IdentityMarker.
- **Regla anti-insinuación (UI, LOCKED para todo el frente):** la sección de lobby vive en su propio carril en `/parlamentario/[id]`; NINGUNA unidad de UI compone una reunión de lobby junto a un voto (u otro dataset) como una sola unidad destacada. Sin lenguaje causal/afinidad. Cada fila con fuente/fecha/enlace (ProvenanceBadge).

### Claude's Discretion
- Exact table/column names of the new migration (≥0021), as long as they follow the 0018 deny-by-default convention and the keying rules below.
- Whether the counterpart sub-master is its own table vs. a typed subset of `pii_contraparte_declaracion` (recommendation below: own table).
- The shape of the read RPC / query for the ficha section, as long as it respects RLS public-read and honest empty states.
- Whether `@obs/lobby` is a brand-new package or mirrors `@obs/agenda` file-for-file (recommendation: new package, mirror structure).

### Deferred Ideas (OUT OF SCOPE)
- Patrimonio/intereses (InfoProbidad) → Phase 12.
- Dinero (SERVEL/ChileCompra) → Phases 14-16.
- Grafo NET (las aristas lobby↔parlamentario alimentan NET, pero el grafo se construye en Phase 18).
- Cruces inter-bloque (lobby junto a voto/dinero) → diferido por regla anti-insinuación + legal.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | El conector `@obs/lobby` ingiere las reuniones de la Ley del Lobby (`leylobby.gob.cl`) y crea una sub-maestra de contrapartes (lobistas/gestores de interés). | §"leylobby Access (re-validated live)" maps the exact HTML route, pagination and the stable `Identificador` key; §"Connector reuse" gives the `@obs/agenda` mirror; §"Data Model" gives `lobby_audiencia` + `lobby_contraparte` (the sub-master) with idempotent natural keys. |
| INT-02 | El ciudadano ve la lista de reuniones de lobby de un parlamentario, con la contraparte como texto crudo (sin enlazar a una identidad salvo que esté confirmada) y provenance por fila. | §"Identity guard + counterpart confidence" (raw text, no link unless exact id match); §"Queries for the ficha section" (RPC + honest empty states); §"UI section" (own lane, ProvenanceBadge, IdentityMarker, three-state empties). |
</phase_requirements>

## Summary

The Phase-11 work is **a fourth ingestion connector cloned from `@obs/agenda`, two new deny-by-default tables, and one new stacked `<section>` on the existing `/parlamentario/[id]` shell.** No new libraries, no new infra. Everything rides machinery that already shipped: `@obs/ingest` (allowlist already contains `leylobby.gob.cl`), `correrPipeline` + `identidad_audit` for the identity cross, the `EnlaceConfirmado` typed writer invariant from Phase 9, and the 0018 RLS deny-by-default PII convention also from Phase 9.

**The research-gated access question is resolved.** The documented `ayuda.leylobby.gob.cl/descargas/` bulk path still returns **503** (re-validated 2026-06-19 — same as v2.0 research), and the per-listing CSV route (`/instituciones/{CODE}/audiencias/{year}/csv`) returns **500**. So the **bulk CSV path is NOT usable** and the LOCKED fallback is the real path: **`cheerio` over the per-institution / per-sujeto-pasivo HTML audiencias listing**, which is live (HTTP 200), paginated (`?page=N`), and exposes a **stable audiencia identifier** (`{INST}AW{N}`, e.g. `AQ001AW1442944`) plus a clean `<table>` of attendees with roles. This is the same connector shape as the Cámara citaciones connector (`cheerio` over WebForms-ish HTML), so `@obs/lobby` mirrors `@obs/agenda` almost file-for-file.

**Primary recommendation:** Build `@obs/lobby` as an `@obs/agenda`-shaped package that fetches the per-congress-institution audiencias HTML via `@obs/ingest` in the LOCKED order, parses with `cheerio` into a `LobbyAudiencia` model keyed by the source `Identificador`, derives a `lobby_contraparte` sub-master keyed by that same identifier (raw counterpart text; **link to an identity only on an exact id match — for parliamentarians never, for counterparts essentially never in this phase**), reconciles the *sujeto pasivo* against the parlamentario master via `correrPipeline` (FK set only on `confirmado`/`determinista` through `EnlaceConfirmado`), persists both tables under the 0018 deny-by-default RLS convention (with a public-read RPC for the non-sensitive ficha fields), and renders a self-contained lobby `<section>` with `ProvenanceBadge` + `IdentityMarker` + three-state honest empties. Use a **blocking-drift** policy for this PII source (per PITFALLS C4), and a **bounded LIVE run that degrades to a fixture (never fabricates)** if leylobby is unreachable in the execution environment.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch leylobby audiencias HTML (rate-limited, robots, SSRF) | API/Ingest (`@obs/ingest` policy, Deno) | — | Server-only; gov WAF + minimization posture forbid browser fetch. Reuses LOCKED order. |
| Parse HTML → `LobbyAudiencia` + counterparts | API/Ingest (`@obs/lobby` parser, `cheerio`) | — | Pure parsing; no DB, no identity. Mirrors `parseCamaraCitaciones`. |
| Reconcile sujeto pasivo → `parlamentario_id` | Identity (`@obs/adjudication` `correrPipeline`, `@obs/identity` `EnlaceConfirmado`) | — | The single reconciliation choke point; only `determinista`/`confirmado` mints a FK. |
| Persist audiencia + counterpart sub-master | Database/Storage (`SupabaseLobbyWriter`, service role) | — | Idempotent upsert by natural key; RUT/PII never leaves server; raw to R2. |
| Counterpart sub-master construction | Database/Storage + API/Ingest | — | Built in this block; raw text rows keyed by source id; identity NOT confirmed by default. |
| Lobby section read (ficha) | Frontend Server (Next.js Server Component) | Database (public-read RPC) | anon reads only the non-sensitive public columns via RPC; deny-by-default columns never reach the client. |
| Anti-insinuation lane (UI) | Frontend Server | — | Own `<section>`, no cross-dataset composed unit; copy gate at content-review time. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cheerio` | 1.2.0 (already installed) | Parse the leylobby audiencias HTML tables (clean `<table>` / `<td>` structure) | `[CITED: CLAUDE.md Technology Stack]` Already the project's HTML parser; `@obs/agenda` Cámara connector uses it the same way. No DOM, server-side, jQuery-like. |
| `@obs/ingest` | workspace (locked) | Rate-limit 2-3s + robots + SSRF allowlist + R2 raw + drift | `[VERIFIED: packages/ingest/src/allowlist.ts]` `leylobby.gob.cl` already in `DEFAULT_ALLOWED_SUFFIXES`. Reuse in LOCKED order, NOT `BaseConnector.run`. |
| `@obs/adjudication` `correrPipeline` | workspace (locked) | Reconcile the *sujeto pasivo* name → parlamentario master | `[VERIFIED: packages/tramitacion/src/reconciliar-senado.ts]` The single reconciliation entry; deterministic resolution short-circuits before the LLM (0 calls). |
| `@obs/identity` `confirmar` / `EnlaceConfirmado` / `normalizarNombre` | workspace (locked) | Typed writer invariant + name normalization | `[VERIFIED: 09-01-SUMMARY.md]` A raw-string FK is a compile error. `affects` list explicitly names `phase-11-lobby`. |
| `zod` | 3.x/4.x (locked) | Validate parsed audiencia rows before write | `[CITED: CLAUDE.md]` Contract-validation gate, same as `CitacionSchema`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` v2 | locked | `SupabaseLobbyWriter` (service role, bypass RLS, server-only) | Mirror `SupabaseAgendaWriter`: `upsert(..., { onConflict })` by natural key. |
| `@obs/llm` `assertPiiDocumentSafeForLlm` | workspace (locked) | Gate if ANY LLM extraction is added to a counterpart/materia free-text field | `[VERIFIED: 09-03-SUMMARY.md]` Only if a future task extracts from free text; **Phase 11 needs no LLM** (parsing is structured HTML; the sujeto-pasivo cross is name-only and deterministic). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cheerio` over per-institution HTML | bulk CSV (`ayuda.leylobby.gob.cl/descargas/`) | **REJECTED for now:** 503 on 2026-06-19 (re-validated). If it recovers, a CSV path would be simpler — but it is not reachable, and the LOCKED decision already designates HTML+cheerio as the fallback. Keep the connector parser isolated so a CSV path can be added later. |
| `cheerio` over per-institution HTML | per-listing CSV route `/instituciones/{CODE}/audiencias/{year}/csv` | **REJECTED:** returns HTTP 500 (route exists in the Laravel app but errors — likely needs auth/CSRF or a param). Do not depend on it. |
| New `@obs/lobby` package | fold into `@obs/agenda` | **REJECTED:** different source, different model, different RLS posture (lobby has a deny-by-default counterpart sub-master; agenda is fully public). A separate package keeps boundaries clean (matches ARCHITECTURE "one package per feature"). |
| Own `lobby_contraparte` table | reuse the `pii_contraparte_declaracion` exemplar | **Prefer own table** (the exemplar is a template, not a shared store), but copy its RLS convention verbatim. |

**Installation:** None. No new dependencies. (`cheerio@1.2.0`, `zod`, `@supabase/supabase-js`, all `@obs/*` packages already present.)

**Version verification:** No new packages to verify — Phase 11 adds zero dependencies. `cheerio@1.2.0` confirmed present and used by `packages/agenda/src/parse-camara-citaciones.ts` `[VERIFIED: codebase]`.

## Package Legitimacy Audit

> Phase 11 installs **no external packages.** Every dependency is either a locked v1.0 library already in the lockfile or a workspace `@obs/*` package.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | No external installs in this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## leylobby Access (re-validated LIVE 2026-06-19)

> This is the research-gated deliverable. All probes used a 2-3s-discipline single request with an identifying UA, from the execution environment.

### Verdict: bulk CSV is unavailable; HTML + cheerio is the path (matches the LOCKED fallback)

| Endpoint | Result (2026-06-19) | Disposition |
|----------|---------------------|-------------|
| `https://ayuda.leylobby.gob.cl/descargas/` | **HTTP 503** | `[VERIFIED: curl]` Bulk download path still down (same as v2.0 research). **Do not depend on it.** |
| `https://www.leylobby.gob.cl/descargas` | HTTP 404 | `[VERIFIED: curl]` No site-level bulk route. |
| `https://www.leylobby.gob.cl/instituciones/{CODE}/audiencias/{year}/csv` | **HTTP 500** | `[VERIFIED: curl]` Route exists in the Laravel app but errors (needs CSRF/auth/param). **Do not depend on it.** |
| `https://www.leylobby.gob.cl/` | HTTP 200 | `[VERIFIED: curl]` Live. |
| `https://www.leylobby.gob.cl/instituciones` | HTTP 200, **paginated** (100+ pages of institutions) | `[VERIFIED: curl + WebFetch]` Searchable institution list. |
| `https://www.leylobby.gob.cl/instituciones/{CODE}/audiencias/{year}` | HTTP 200, paginated `?page=N` | `[VERIFIED: curl]` The per-institution per-year audiencias listing. **This is the entry point.** |
| `https://www.leylobby.gob.cl/instituciones/{CODE}/audiencias/{year}/{rowId}` | HTTP 200, HTML `<table>` of audiencias | `[VERIFIED: curl + WebFetch]` Per-sujeto-pasivo detail listing with the stable `Identificador`. |
| `https://www.leylobby.gob.cl/api/v1/audiencias` | HTTP 404 | `[VERIFIED: curl]` No JSON API. |

**Platform:** Laravel app (sets `XSRF-TOKEN` + `portal_lobby_session` cookies; `X-Frame-Options`, HSTS, served behind Azure front door — `x-azure-ref`). `robots.txt` returns **403 Forbidden** (an Apache error page, not a real robots file) `[VERIFIED: curl]`. **Implication for the connector:** the existing `RobotsGuard` must treat a 403/non-200 robots fetch as "no robots policy retrievable" (fail-open-to-allowed OR fail-closed-to-disallowed) — **the planner must confirm `RobotsGuard`'s behavior on a 403 robots.txt and choose the conservative-but-functional path** (the Cámara connector already deals with WAF 403s, so the precedent exists). Open Question 1.

### Field map (verified on `AQ001/audiencias/2023/461926`)

The detail page is a **per-sujeto-pasivo listing of that official's audiencias**. Each audiencia is one logical record:

| Source column | Example value | Maps to |
|---------------|---------------|---------|
| **Fecha** | `2023-12-26 13:00:00-03` (ISO-ish w/ offset; `data-toggle="moment" data-format="DD-MM-YYYY"`) | `lobby_audiencia.fecha` (parse to timestamptz; raw kept) |
| **Identificador** | `AQ001AW1442944` (= `{INST_CODE}AW{N}`) | `lobby_audiencia.identificador` — **the stable natural key** (NOT the URL `rowId`) |
| **Asistentes** | rows of `{rol, nombre}`: one `Sujeto Pasivo` = the official (`Winston Kennedy Núñez Mundaca`), others = the lobby counterparts | sujeto pasivo → reconcile to parlamentario; the rest → `lobby_contraparte` raw rows |
| **Representados** | entity/firm the lobbyist represents (may be empty) | `lobby_contraparte.representado_text` (raw) |
| **Materia** | subject-matter summary | `lobby_audiencia.materia` (raw) |
| **Detalle** | "Ver Detalle" link to the full acta | `lobby_audiencia.enlace_detalle` (raw link only; do NOT scrape the acta in Phase 11) |

**Critical keying insight `[VERIFIED: curl, detail HTML]`:** the URL path number (`461926`) is an internal row id of the *listing page*, **not** the audiencia identity. The real stable key is the **`Identificador`** cell (`AQ001AW1442944`). Key the audiencia and the sub-master rows on `Identificador`, not on the URL number — the URL number is unstable across the listing.

**Counterpart shape `[VERIFIED: detail HTML, MEDIUM]`:** every attendee row carries a `rol` cell (`Sujeto Pasivo`, and other roles for the lobbyist/gestor) and a `nombre` cell. AQ001 is the Subsecretaría de Bienes Nacionales (not a congress body), so the *exact* set of non-`Sujeto Pasivo` roles and whether a "Lobbista/Gestor" label + represented firm appear as distinct columns **must be confirmed on a real congress institution page at plan time** (Open Question 2). The model below is column-agnostic: it stores `rol` + `nombre` + `representado_text` raw for every non-sujeto-pasivo attendee, which is robust to the exact role taxonomy.

### Congress institution codes (TO CONFIRM at plan time — Open Question 2)

The institution list is paginated (100+ pages); the congress bodies (Cámara de Diputados, Senado) are not on page 1. `[VERIFIED: WebFetch]` The Cámara also publishes its own lobby page at `camara.cl/transparencia/ley_de_lobby.aspx` (returned 403 to WebFetch — gov WAF; the project's curl-with-browser-headers transport may reach it) `[VERIFIED: WebSearch + WebFetch 403]`. **Plan task:** resolve the leylobby institution code(s) for the Cámara de Diputados and the Senado (search `leylobby.gob.cl/instituciones?q=...` or paginate), AND decide whether to also/instead use the Cámara's own published lobby data. Both hosts (`leylobby.gob.cl`, `camara.cl`) are already allowlisted.

## Architecture Patterns

### System Architecture Diagram

```
                 pg_cron (schedule, existing lane)
                        │  encola tareas (una institución-año por mensaje)
                        ▼
                 pgmq  ──read(vis=backoff)──►  Edge Fn worker (Deno)  [or GitHub Actions for backfill]
                                                      │ ensambla @obs/lobby con colaboradores reales
                                                      ▼
   ┌──────────────────── @obs/lobby connector ─────────────────────────┐
   │ for each (institución, año, page):                                 │
   │   assertAllowedUrl(url)  → robots.isAllowed  → rateLimiter.wait     │   LOCKED order
   │     → fetcher.get({url, BROWSER_HEADERS})  → R2 raw (immutable)     │   (NOT BaseConnector.run)
   │     → DriftDetector (BLOCKING for this PII source)                  │
   │     → parseLobbyAudiencias(html)  (cheerio)                         │
   └───────────────┬────────────────────────────────────────────────────┘
                   │  LobbyAudiencia[] (Identificador, fecha, materia, asistentes[])
                   ▼
        reconciliarSujetoPasivo(audiencias, maestra, provider, writer)
           │  sujeto pasivo name → correrPipeline → ResultadoPipeline
           │     determinista → confirmar(id) : EnlaceConfirmado          ── identidad_audit row
           │     probable/revision/no_confirmado → null + raw mención
                   ▼
        SupabaseLobbyWriter (service role, idempotent upsert)
           │  lobby_audiencia      onConflict 'identificador'
           │  lobby_contraparte    onConflict 'identificador,nombre,rol'   (sub-master, raw)
                   ▼
        Supabase Postgres  (lobby_audiencia public-read RPC; lobby_contraparte deny-by-default)
                   ▲
                   │  anon reads via RPC lobby_de_parlamentario(p_id)
        Next.js Server Component  →  <section id="lobby"> (own lane, ProvenanceBadge, IdentityMarker)
```

### Recommended Project Structure (mirror `@obs/agenda`)
```
packages/lobby/src/
├── model.ts                  # LobbyAudiencia + LobbyContraparte + zod schemas + ProvenanceInline
├── connector-leylobby.ts     # fetch HTML in LOCKED order (mirror connector-camara.ts)
├── parse-leylobby.ts         # cheerio parser → LobbyAudiencia[] (mirror parse-camara-citaciones.ts)
├── reconciliar-sujeto.ts     # sujeto pasivo → correrPipeline → EnlaceConfirmado (mirror reconciliar-senado.ts)
├── writer.ts                 # LobbyWriter interface + InMemoryLobbyWriter (mirror writer.ts)
├── writer-supabase.ts        # SupabaseLobbyWriter (mirror writer-supabase.ts)
├── ingest-run.ts             # orchestration: enumerate (institución,año,page); honest degrade (mirror ingest-run.ts)
├── ingest-cli.ts             # bounded LIVE run / fixture fallback (mirror ingest-cli.ts)
├── live-leylobby.probe.ts    # bounded live probe (mirror live-camara.probe.ts)
└── index.ts                  # barrel
```

### Pattern 1: Reuse `@obs/ingest` policy in the LOCKED order (NOT `BaseConnector.run`)
**What:** The connector fetches each resource through `assertAllowedUrl → robots.isAllowed → rateLimiter.wait(host) → fetcher.get`, exactly as the Cámara citaciones connector does.
**When to use:** Every fetch in this phase.
**Example:**
```typescript
// Source: packages/agenda/src/connector-camara.ts (VERIFIED — mirror it)
private async fetch(url: string): Promise<string> {
  const parsed = assertAllowedUrl(url, this.deps.allowlist);     // SSRF + allowlist (leylobby.gob.cl ✓)
  if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
  await this.deps.rateLimiter.wait(parsed.host);                 // 2-3s serial per host
  const body = await this.deps.fetcher.get({ url, headers: { ...BROWSER_HEADERS } });
  return new TextDecoder().decode(body);
}
```

### Pattern 2: Single reconciliation choke point mints the typed FK
**What:** Only `reconciliar-sujeto.ts` calls `confirmar()`. Determinista → `confirmar(id, "determinista")`; everything else → `enlace: null` + raw mention.
**When to use:** The sujeto-pasivo cross.
**Example:**
```typescript
// Source: packages/tramitacion/src/reconciliar-senado.ts (VERIFIED — mirror it)
const res = await correrPipeline(mencion, maestra, provider, writer);
switch (res.tipo) {
  case "determinista":
    v = { enlace: confirmar(res.parlamentarioId, "determinista"), estado_vinculo: "confirmado" };
    break;
  default: // probable | revision | no_confirmado
    v = { enlace: null, estado_vinculo: "no_confirmado" };  // FK null + raw mención + IdentityMarker
}
```

### Pattern 3: Idempotent writer by natural key, root-before-children, dedupe-before-batch
**What:** `SupabaseLobbyWriter.upsertAudiencias` upserts `lobby_audiencia` by `identificador`, then the counterpart rows by `(identificador, nombre, rol)`, de-duping each batch first (Postgres aborts a batch with two rows of the same conflict key).
**When to use:** All writes. Running ingest twice with the same input must not duplicate rows.
**Example:** Mirror `SupabaseAgendaWriter` (`dedupePorClave` + `chunk` + `upsert({ onConflict })`) `[VERIFIED: packages/agenda/src/writer-supabase.ts]`.

### Anti-Patterns to Avoid
- **Keying on the URL row number** (`.../2024/461926`) instead of the `Identificador` cell — the URL number is a listing artifact, not the audiencia identity. `[VERIFIED: detail HTML]`
- **`BaseConnector.run`** — its daily cache would skip re-runs; the project forbids it for these connectors. `[VERIFIED: connector-camara.ts header comment]`
- **Composing a lobby meeting next to a vote as one UI unit** — LOCKED anti-insinuation rule; PITFALLS B1.
- **Setting `parlamentario_id` from a raw string** — compile error by the Phase-9 invariant; route through `confirmar()` only on determinista.
- **Linking a counterpart (lobbyist/firm) to a person** — third-party private data; raw text only (see below).
- **Non-blocking drift for this source** — PITFALLS C4: a silent parser break on a PII source emits empty/garbage that reads as "no lobby". Use blocking drift here.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate-limit / robots / SSRF / R2 / drift | A bespoke fetch loop | `@obs/ingest` collaborators in LOCKED order | Policy applied once, verified, allowlist already includes leylobby. |
| Name reconciliation | A `JOIN ON nombre` | `correrPipeline` + `EnlaceConfirmado` | A naive name join silently fabricates attributions (PITFALLS A1/A3); the guard is the spine. |
| PII RLS posture | A new RLS scheme | Copy the 0018 deny-by-default convention | `[VERIFIED: 09-03-SUMMARY]` Template + pgTAP exist; copy-paste. |
| Idempotent upsert | Insert + manual existence check | `upsert({ onConflict })` by natural key | `[VERIFIED: writer-supabase.ts]` Proven idempotent in `@obs/agenda`. |
| Typed FK guard | A runtime `if (confirmado)` check only | `EnlaceConfirmado` branded type | `[VERIFIED: 09-01-SUMMARY]` Makes a raw-string FK a *compile* error, not a runtime hope. |
| Name normalization | A new normalizer for leylobby names | `normalizarNombre` (extend golden set) | PITFALLS A3: reuse + extend goldens with real leylobby name strings; don't fork. |

**Key insight:** Phase 11 is overwhelmingly *assembly* of shipped parts. The only genuinely new code is the cheerio parser for one HTML shape, two table DDLs, one RPC, and one React section — everything else is a mirror of `@obs/agenda` + Phase-9 conventions.

## Data Model (migration ≥0021)

> Last applied migration is **0020** `[VERIFIED: CONTEXT.md + migrations dir 0010/0015/0016/0017/0018 present]`. New migration ≥ 0021. Follows the 0018 deny-by-default convention. **Authoring the DDL and applying it + pgTAP are SEPARATE tasks** — build/typecheck do NOT prove the schema applied (PITFALLS / 09-03 convention). The 09-03 operator applied 0018 to the remote sa-east-1 pooler successfully, so a remote apply is feasible here too.

### `lobby_audiencia` — public-read (the non-sensitive meeting fact)
```sql
create table lobby_audiencia (
  identificador     text primary key,        -- "AQ001AW1442944" (source Identificador; STABLE natural key)
  institucion_codigo text not null,          -- "AQ001" / the congress code
  -- sujeto pasivo (the official): FK SOLO si enlace confirmado/determinista (IDENT-12)
  parlamentario_id  text references parlamentario(id) on delete set null,  -- nullable
  mencion_sujeto    text not null,           -- raw name of the sujeto pasivo as published
  estado_vinculo    text,                    -- 'confirmado' | 'no_confirmado' | null
  fecha             timestamptz,             -- parsed; raw also kept if parse fails
  fecha_raw         text,                    -- the source string ("2023-12-26 13:00:00-03")
  materia           text,                    -- raw subject matter
  enlace_detalle    text,                    -- "Ver Detalle" link (NOT scraped in P11)
  -- provenance inline (FND-08)
  origen            text not null,           -- "leylobby-audiencias"
  fecha_captura     timestamptz not null default now(),
  enlace            text not null            -- the listing URL consulted
);
alter table lobby_audiencia enable row level security;
create policy lobby_audiencia_public_read on lobby_audiencia for select to anon using (true);
grant select on lobby_audiencia to anon;
create index lobby_audiencia_parlamentario_idx on lobby_audiencia (parlamentario_id);
```
> **Why public-read:** the meeting fact (date, materia, the official's link, the source link) is public data the source already publishes, exactly like `citacion` in 0010. anon must read it or the ficha is blank.

### `lobby_contraparte` — the sub-master (deny-by-default; raw third-party text)
```sql
-- Sub-maestra de contrapartes (lobistas/gestores de interés). Third-party PRIVATE data.
-- Copies the 0018 deny-by-default convention VERBATIM: RLS on, ZERO policies, no grant to anon.
create table lobby_contraparte (
  id                bigint generated always as identity primary key,
  identificador     text not null references lobby_audiencia(identificador) on delete cascade,
  nombre            text not null,           -- raw counterpart name as published (third party)
  rol               text not null default '',-- raw role (lobbista/gestor/asesor/...) — '' if absent
  representado_text text,                     -- the firm/entity represented (raw), nullable
  -- contraparte_id: a STABLE link to a counterpart identity ONLY on an exact source-id match.
  -- In Phase 11 this is essentially always NULL (no exact-id registry cross available). See below.
  contraparte_id    text,                     -- nullable; internal-use; NOT a parlamentario FK
  origen            text not null,
  fecha_captura     timestamptz not null default now(),
  enlace            text not null,
  unique (identificador, nombre, rol)         -- natural key for idempotent upsert
);
alter table lobby_contraparte enable row level security;
-- (intentionally NO create policy; intentionally NO grant to anon — deny-by-default per 0018)
```
> **Why deny-by-default:** counterparts are **private third parties** (lobbyists, firms, citizens). PITFALLS D2/D4 + Ley 21.719: minimization for non-office-holders. The ficha RPC (below) exposes the counterpart **name as published** only through a curated security-definer RPC that returns exactly the fields the source already shows — the table itself stays unreadable to anon so a future sensitive column added here can never leak.

**Keying summary (matches ARCHITECTURE table):**

| Entity | Natural/PK key | Cross to parlamentario | FK set when |
|--------|----------------|------------------------|-------------|
| `lobby_audiencia` | `identificador` (`{INST}AW{N}`) | sujeto-pasivo name → `correrPipeline` | only `determinista`/`confirmado` (else NULL + `mencion_sujeto` raw) |
| `lobby_contraparte` | `(identificador, nombre, rol)` | **none** (third party) | never to `parlamentario`; `contraparte_id` only on exact-id match (≈never in P11) |

### Read RPC for the ficha (public, security definer over the deny-by-default table)
```sql
-- lobby_de_parlamentario(p_id): returns ONLY the source-published fields, joining the
-- public audiencia to its counterpart rows. SECURITY DEFINER so anon can read the curated
-- non-sensitive projection of lobby_contraparte WITHOUT a blanket grant on the table.
-- Mirror pattern: parlamentario_publico / votos_de_parlamentario (security definer RPCs).
create function public.lobby_de_parlamentario(p_id text)
returns table (
  identificador text, fecha timestamptz, fecha_raw text, materia text,
  enlace_detalle text, origen text, fecha_captura timestamptz, enlace text,
  contraparte_nombre text, contraparte_rol text, representado text
)
language sql security definer set search_path = '' as $$
  select a.identificador, a.fecha, a.fecha_raw, a.materia, a.enlace_detalle,
         a.origen, a.fecha_captura, a.enlace,
         c.nombre, c.rol, c.representado_text
  from public.lobby_audiencia a
  left join public.lobby_contraparte c on c.identificador = a.identificador
  where a.parlamentario_id = p_id          -- ONLY confirmed-linked audiencias
  order by a.fecha desc nulls last;
$$;
revoke execute on function public.lobby_de_parlamentario(text) from public;
-- grant to anon (mirror votos_de_parlamentario grant posture)
```
> **Why this is safe:** the RPC returns only the fields the source already publishes (no RUT, no internal `contraparte_id`), and only for **confirmed-linked** audiencias (`parlamentario_id = p_id`). Unconfirmed audiencias never appear under a parlamentario — exactly the honest-empty posture.

## Sub-Master Design — counterpart identity confidence

**Recommendation (conservative default, LOCKED-aligned):**

1. **Counterparts are raw text by construction.** Every non-`Sujeto Pasivo` attendee becomes a `lobby_contraparte` row with `nombre` + `rol` + `representado_text` exactly as published. No reconciliation, no normalization-driven merge in Phase 11.
2. **"Confirmed" for a counterpart means an EXACT id match — and leylobby provides no such cross key for parliamentary counterparts in this phase.** The audiencia `Identificador` (`{INST}AW{N}`) identifies the *meeting*, not the *counterpart*. There is no per-counterpart stable id exposed on the detail page `[VERIFIED: detail HTML]`. Therefore `contraparte_id` stays **NULL** for essentially all rows. This is correct and intended: a private third party is shown as text and is never silently elevated to a linked identity (PITFALLS D2, CONTEXT decision).
3. **`contraparte_id` is NOT a `parlamentario` FK** and is internal-use only — it exists so a *future* phase (NET / a real lobbyist registry) can attach an exact-id-matched counterpart identity. It must never be populated by a name guess. The default is NULL; populating it requires an exact id from an authoritative registry that this phase does not have.
4. **The sub-master is the table itself** (`lobby_contraparte`), built in this block (not deferred), keyed by the audiencia `Identificador` + raw counterpart name/role. "Building the sub-master" = persisting the deduplicated counterpart rows with provenance; it satisfies INT-01 without any identity adjudication of third parties.

> **One subtlety for the planner:** if the same counterpart name appears across many audiencias, the sub-master can optionally compute a *display-only* normalized grouping (`normalizarNombre` over the raw name) for aggregation in a later phase — but this is a **derived view, not a confirmed identity**, and must carry no link and no "same person" assertion. Recommend deferring even that grouping to NET; in Phase 11, store raw rows only.

## Queries for the ficha section

- **Read path:** Server Component calls `sb.rpc("lobby_de_parlamentario", { p_id: id })` (mirror of `VotosSection` calling `votos_de_parlamentario`) `[VERIFIED: votos-por-parlamentario.tsx]`.
- **The RPC returns only confirmed-linked audiencias** (FK match), so an unconfirmed sujeto-pasivo mention never shows under the wrong legislator.
- **Honest empty states (three states, PITFALLS E4)** — mirror `VotosView`:
  1. **Not ingested:** lobby ingest hasn't run for this legislator → "Aún no hemos ingerido las reuniones de lobby de este parlamentario. Esto no significa que no tenga reuniones." (must be distinguishable from "ingested, zero" — the planner needs an ingest-marker; same gap `VotosView.noIngestado` flags today).
  2. **Ingested, zero confirmed:** "No hay reuniones de lobby confirmadas para este parlamentario." (with a note that unverified mentions are not shown as his).
  3. **Has confirmed audiencias:** render the list, each row with `ProvenanceBadge` (fecha/origen/enlace) and the counterpart as raw text.
- **Never let "empty" read as "clean".** Empty = "not ingested" or "none confirmed", never "this person has no lobby activity".

## Connector Reuse — how closely `@obs/lobby` mirrors `@obs/agenda`

| `@obs/agenda` file | `@obs/lobby` analog | Delta |
|--------------------|---------------------|-------|
| `connector-camara.ts` (cheerio over WebForms HTML, LOCKED order, WAF 403 handling) | `connector-leylobby.ts` | Different URLs (institución/año/page); reuse `BROWSER_HEADERS` pattern; handle 403/503 + the 403-robots quirk. |
| `parse-camara-citaciones.ts` (cheerio) | `parse-leylobby.ts` | Parse the audiencias `<table>`: `Identificador`, `Fecha`(+raw), `Materia`, attendee rows (`rol`,`nombre`,`representado`). |
| `reconciliar-senado.ts` (name → correrPipeline → EnlaceConfirmado) | `reconciliar-sujeto.ts` | Cross the **sujeto pasivo** only; counterparts are NOT reconciled. Same determinista-only guard. |
| `writer.ts` / `writer-supabase.ts` (idempotent upsert, dedupe-before-batch) | `writer.ts` / `writer-supabase.ts` | `lobby_audiencia` onConflict `identificador`; `lobby_contraparte` onConflict `(identificador,nombre,rol)`. |
| `ingest-run.ts` (tolerant, honest degrade, no fabrication) | `ingest-run.ts` | Enumerate (institución,año,page); a blocked/unreachable institution degrades honestly (records degradación), never fabricates. |
| `ingest-cli.ts` + `live-camara.probe.ts` (bounded live run) | `ingest-cli.ts` + `live-leylobby.probe.ts` | Bounded LIVE run; if leylobby unreachable in the environment → fixture + `human_verification` marker (CONTEXT "Specific Ideas"). |

**Idempotency:** natural-key upsert (`identificador` for the meeting; `(identificador,nombre,rol)` for counterparts) makes a 2× run produce identical counts. **Bounded LIVE run:** the CLI caps the number of (institución,año,page) tuples (e.g. one congress institution, current year, page 1) and respects the 2-3s discipline. **Never fabricate:** an unreachable source records a `Degradacion` and writes zero rows (mirror the Cámara-tabla-PDF degradation). **Blocking drift (PITFALLS C4):** unlike `@obs/agenda` (non-blocking drift), this PII source must **quarantine the run on a structural drift** (parser shape change) rather than emit empty/garbage that reads as "no lobby". The planner wires `DriftDetector` in blocking mode for `@obs/lobby`.

## Common Pitfalls

### Pitfall 1: Treating the URL row number as the audiencia key
**What goes wrong:** Keying `lobby_audiencia` on `461926` (URL path) instead of `AQ001AW1442944` (the `Identificador` cell). The URL number is a listing-page artifact; re-pagination or a source tweak reshuffles it → duplicate or orphaned rows on re-run.
**How to avoid:** Natural key = the `Identificador` cell. `[VERIFIED: detail HTML]`
**Warning signs:** Row counts grow on a 2nd identical run; the same meeting appears twice.

### Pitfall 2: Under-linking presented as "no lobby" (PITFALLS E4)
**What goes wrong:** The determinista-only guard correctly drops unconfirmed sujeto-pasivo matches to NULL; the ficha then looks empty and reads as "this legislator has no lobby".
**How to avoid:** Three honest empty states; "not ingested" ≠ "none confirmed" ≠ "no activity". Mirror `VotosView.noIngestado`.
**Warning signs:** A legislator with known lobby meetings shows a blank lobby section with no "unverified/pending" distinction.

### Pitfall 3: Silent parser break on a PII source (PITFALLS C4)
**What goes wrong:** leylobby (Laravel + Azure front door) changes its HTML; the cheerio parser emits zero/garbage; non-blocking drift lets the run "succeed" with empty data.
**How to avoid:** **Blocking drift** for `@obs/lobby`; pin the parser to a captured fixture + golden-test it; re-capture on a schedule. The 403-robots and 503-descargas quirks already show this source is volatile.
**Warning signs:** Row counts collapse to zero after a leylobby redeploy; drift alerts repeating.

### Pitfall 4: Linking a counterpart to a person (PITFALLS D2)
**What goes wrong:** Normalizing a counterpart name and matching it to a parlamentario or another identity, asserting "lobbyist X is person Y".
**How to avoid:** Counterparts are raw text; `contraparte_id` only on an exact authoritative id match (none in P11). No `parlamentario` FK on `lobby_contraparte`. No counterpart RUT stored.
**Warning signs:** A `lobby_contraparte` row with a non-null link; a counterpart rendered as a clickable identity.

### Pitfall 5: `.env` BOM / remote-apply gotcha (carried from v1.0)
**What goes wrong:** The migration authoring task passes typecheck but the schema is never applied; or a BOM in `.env` breaks the remote pooler connection used to apply + pgTAP.
**How to avoid:** Separate "author DDL" from "apply + pgTAP" tasks (09-03 convention). The 09-03 operator applied 0018 to the remote sa-east-1 pooler successfully, so the remote apply path works; reuse it. `[VERIFIED: 09-03-SUMMARY]`

## Code Examples

### Reconcile only the sujeto pasivo; counterparts pass through raw
```typescript
// Source: mirror of packages/tramitacion/src/reconciliar-senado.ts (VERIFIED)
for (const aud of audiencias) {
  // 1. sujeto pasivo → identity cross (the ONLY mint site)
  const mencion = toMencion(aud.sujetoPasivoNombre, "leylobby", PERIODO);
  const res = await correrPipeline(mencion, maestra, provider, writer);
  const enlace = res.tipo === "determinista" ? confirmar(res.parlamentarioId, "determinista") : null;

  // 2. counterparts → raw rows, NO reconciliation, NO link
  const contrapartes = aud.asistentes
    .filter((a) => a.rol !== "Sujeto Pasivo")
    .map((a) => ({ nombre: a.nombre, rol: a.rol ?? "", representado_text: a.representado ?? null }));

  out.push({ identificador: aud.identificador, enlace, mencion_sujeto: aud.sujetoPasivoNombre,
             /* ...provenance... */ contrapartes });
}
```

## Runtime State Inventory

> Phase 11 is **greenfield ingestion + additive schema** — it creates new tables and a new package; it does not rename or migrate existing runtime state. Categories below verified as not-applicable.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new tables only (`lobby_audiencia`, `lobby_contraparte`); no existing keys renamed. | none |
| Live service config | None — reuses existing pg_cron/pgmq lane; a new job kind is *added* to `util.process_ingest_jobs()`, not a rename. (Plan task: add the dispatch arm.) | add dispatch arm (additive) |
| OS-registered state | None. | none |
| Secrets/env vars | None new — reuses `SUPABASE_DB_URL`/service key/R2 already in `.env`. | none |
| Build artifacts | New `packages/lobby` workspace package → a `pnpm install`/build registers it; no stale artifact from a rename. | `pnpm install` after package scaffold |

**Nothing found requiring a data migration of existing rows** — all writes are to brand-new tables.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v2.0 research assumed bulk CSV from `ayuda.leylobby.gob.cl/descargas/` (saw 503) | **HTML + cheerio over per-institution audiencias** (CSV still 503 on 2026-06-19) | re-validated 2026-06-21… 2026-06-19 | Connector built on the LOCKED HTML fallback, not the bulk path. |
| Identity guard as a runtime convention (v1.0 TRAM-06) | Typed `EnlaceConfirmado` invariant (Phase 9, IDENT-12) | 2026-06-19 | A raw-string FK is a compile error; `@obs/lobby` reuses it. |
| PII RLS decided per-table ad hoc | 0018 deny-by-default convention + pgTAP template | 2026-06-19 | `lobby_contraparte` copy-pastes the convention. |

**Deprecated/outdated:**
- `ayuda.leylobby.gob.cl/descargas/` bulk path: **not usable** (503). Do not build on it.
- `/instituciones/{CODE}/audiencias/{year}/csv`: **errors** (500). Do not build on it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Congress institution codes (Cámara/Senado) exist on leylobby and follow the `{LETTERS}{DIGITS}` pattern like `AQ001`. | leylobby Access | LOW — if absent, fall back to the Cámara's own `camara.cl/transparencia/ley_de_lobby.aspx` (already allowlisted). Plan task confirms the code(s). |
| A2 | Non-`Sujeto Pasivo` attendee rows carry the counterpart (lobbyist/gestor) name + represented firm, and there is NO per-counterpart stable id. | Sub-Master / Field map | MEDIUM — validated on a non-congress institution (AQ001). If a congress page exposes a counterpart id, `contraparte_id` could be populated on exact match; the schema already allows it. Confirm on a congress page. |
| A3 | `RobotsGuard` can be configured to proceed when `robots.txt` returns 403 (the leylobby case). | leylobby Access | MEDIUM — if `RobotsGuard` hard-disallows on a non-200 robots fetch, the connector can't run. Open Question 1; the Cámara connector's WAF-403 handling is precedent. |
| A4 | The remote sa-east-1 pooler is reachable to apply migration ≥0021 + pgTAP, as it was for 0018 in 09-03. | Data Model | LOW — if not, the apply becomes a deferred operator checkpoint (09-03 already handles this split). |
| A5 | A bounded LIVE run can reach leylobby from the execution environment within the 2-3s discipline. | Validation Architecture | LOW — if unreachable, degrade to fixture + `human_verification` marker (CONTEXT "Specific Ideas"); never fabricate. |

## Open Questions

1. **`RobotsGuard` behavior on a 403 `robots.txt`.**
   - What we know: leylobby's `robots.txt` returns a 403 Apache error page (not a real robots policy). `[VERIFIED: curl]`
   - What's unclear: whether the existing `RobotsGuard.isAllowed` fails open (allow) or closed (disallow) on a non-200 fetch.
   - Recommendation: planner reads `packages/ingest/src/robots.ts` and, if it fails closed, adds a narrow allow-on-unretrievable-robots option scoped to this host (the source publishes data for public consumption; a 403 robots is a server quirk, not a disallow directive). Document the decision.

2. **Congress institution code(s) + exact counterpart column layout.**
   - What we know: the audiencias HTML structure (Identificador, attendee rows with rol/nombre) is verified on AQ001. `[VERIFIED]`
   - What's unclear: the Cámara/Senado leylobby codes (list is 100+ pages) and whether a congress page labels the counterpart differently or includes a represented-firm column distinctly.
   - Recommendation: a plan task resolves the code(s) (search/paginate `/instituciones`) and re-captures a real congress audiencias fixture to pin the parser. Decide leylobby-only vs. also `camara.cl/transparencia/ley_de_lobby.aspx`.

3. **"Not ingested" marker for the ficha.**
   - What we know: `VotosView` already needs but lacks a real `noIngestado` source (hardcoded `false`). `[VERIFIED: votos-por-parlamentario.tsx]`
   - What's unclear: where the per-legislator ingest-completeness marker lives.
   - Recommendation: a small per-legislator ingest-status (e.g. a row recording "lobby ingested through {date}") so state (a) "not ingested" is distinguishable from (b) "ingested, none confirmed". Keep it minimal; reuse for Phase 12+.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `leylobby.gob.cl` HTML audiencias | INT-01 ingest | ✓ (HTTP 200, live 2026-06-19) | — | Fixture + `human_verification` marker (never fabricate) |
| `ayuda.leylobby.gob.cl/descargas/` bulk CSV | (preferred path, gated) | ✗ (HTTP 503) | — | HTML + cheerio (LOCKED fallback — the real path) |
| Supabase remote sa-east-1 pooler | apply migration ≥0021 + pgTAP | ✓ (09-03 applied 0018 there) | PG15 | Defer apply to operator checkpoint (09-03 split) |
| `cheerio@1.2.0`, `zod`, `@obs/*` | connector/parser/writer | ✓ (in lockfile) | 1.2.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** bulk CSV (503) → HTML+cheerio; leylobby unreachable at run time → fixture + human_verification.

## Validation Architecture

> `workflow.nyquist_validation` not set to false → section included. Test framework is **vitest** (mirror `packages/agenda/vitest.config.ts` `[VERIFIED: glob]`), plus **pgTAP** for schema (mirror `supabase/tests/0018_piso_pii.test.sql`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (per-package) + pgTAP (schema) |
| Config file | `packages/lobby/vitest.config.ts` (Wave 0 — mirror agenda) |
| Quick run command | `pnpm --filter @obs/lobby test` |
| Full suite command | `pnpm -r test && pnpm -r typecheck` |

### Phase Requirements → Test Map (observable checks proving INT-01/INT-02)
| Req | Behavior | Test type | Automated command | File |
|-----|----------|-----------|-------------------|------|
| INT-01 | Parser maps a captured leylobby audiencias fixture → `LobbyAudiencia[]` keyed by `Identificador` (not URL number) | unit | `pnpm --filter @obs/lobby test -t parse-leylobby` | ❌ Wave 0 |
| INT-01 | Writer upsert is idempotent: 2× same input → identical row counts (audiencia + counterpart) | unit | `pnpm --filter @obs/lobby test -t writer` | ❌ Wave 0 |
| INT-01 | Counterpart sub-master built: every non-sujeto-pasivo attendee → a `lobby_contraparte` raw row; `contraparte_id` NULL | unit | `pnpm --filter @obs/lobby test -t contraparte` | ❌ Wave 0 |
| INT-01/INT-02 | Sujeto-pasivo cross: determinista → `EnlaceConfirmado` + FK + `identidad_audit` row; probable/revision/no_confirmado → NULL + raw mención (no audit-less FK) | unit | `pnpm --filter @obs/lobby test -t reconciliar-sujeto` | ❌ Wave 0 |
| INT-02 | Counterpart never linked to a person; `lobby_contraparte` has no parlamentario FK | unit + pgTAP | `pnpm --filter @obs/lobby test -t no-link` + schema test | ❌ Wave 0 |
| INT-02 | `lobby_contraparte` is RLS-enabled with ZERO policies (deny-by-default); `lobby_audiencia` is public-read | pgTAP | `psql -f supabase/tests/0021_lobby.test.sql` (apply first) | ❌ Wave 0 |
| INT-02 | Ficha section is its own lane; no UI unit composes a lobby meeting with a vote; no causal/affinity copy (content gate) | RTL + content-gate | `pnpm --filter @obs/app test -t lobby-section` | ❌ Wave 0 |
| INT-02 | Three honest empty states (not-ingested / ingested-zero / has-data); empty never reads as "clean" | RTL | `pnpm --filter @obs/app test -t lobby-empty` | ❌ Wave 0 |
| INT-01 | Bounded LIVE run reachable OR honest degrade to fixture (never fabricates rows) | probe (manual/CI-gated) | `pnpm --filter @obs/lobby test -t live-leylobby.probe` | ❌ Wave 0 |
| INT-01 | Blocking drift: a mutated fixture (structural change) quarantines the run, emits 0 rows | unit | `pnpm --filter @obs/lobby test -t drift-blocking` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/lobby test` (+ `pnpm --filter @obs/app test` for UI tasks)
- **Per wave merge:** `pnpm -r test && pnpm -r typecheck`
- **Phase gate:** full suite green + pgTAP green against an APPLIED schema before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/lobby/vitest.config.ts` — mirror `packages/agenda`
- [ ] Captured leylobby audiencias **fixture** from a real **congress** institution page (Open Question 2) — pins the parser golden
- [ ] `supabase/tests/0021_lobby.test.sql` — pgTAP: `lobby_contraparte` RLS-on + zero policies; `lobby_audiencia` public-read; provenance NOT NULL (mirror 0018 test)
- [ ] Golden-set extension with real leylobby sujeto-pasivo name strings (PITFALLS A3; the ≥0.95 gate is the acceptance test for the new normalization corpus)
- [ ] Per-legislator ingest-status marker so `noIngestado` is real (Open Question 3)

## Security Domain

> `security_enforcement` absent = enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth; anon read + service-role write (existing). |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS: `lobby_audiencia` public-read; `lobby_contraparte` deny-by-default (0018 convention). RPC `lobby_de_parlamentario` revoked from public, granted to anon, returns only source-published fields. |
| V5 Input Validation | **yes** | `zod` validates parsed rows before write; `assertAllowedUrl` validates every fetch URL (SSRF). |
| V6 Cryptography | no | No new secrets; reuse R2/Supabase creds. |
| V8 Data Protection / Privacy | **yes** | Ley 21.719 minimization: counterpart third-party data deny-by-default; no third-party RUT stored; no counterpart→person link; no LLM on PII (no LLM used at all in P11). |

### Known Threat Patterns for {Deno connector + Postgres + Next.js}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via connector URL | Tampering/Info-disclosure | `assertAllowedUrl` deny-by-default allowlist (leylobby already listed); never fetch user-supplied hosts. `[VERIFIED: allowlist.ts]` |
| PII leak to anon (counterpart third parties) | Info disclosure | `lobby_contraparte` RLS deny-by-default; only the curated RPC projection reaches anon. |
| False attribution (wrong sujeto-pasivo link) | Spoofing/Repudiation | `EnlaceConfirmado` typed invariant; determinista-only FK; `identidad_audit` row per decision. |
| Insinuation / "máquina de sospechas" | (product/legal risk) | Own UI lane; no composed cross-dataset unit; content gate on causal/affinity language. |
| Silent partial/empty PII scrape | Tampering (integrity) | Blocking drift; fixture-pinned golden parser; never fabricate; honest degradation. |

## Sources

### Primary (HIGH confidence)
- `packages/agenda/src/{connector-camara,parse-camara-citaciones,writer,writer-supabase,ingest-run,index}.ts` — the connector pattern to mirror — `[VERIFIED: codebase]`
- `packages/tramitacion/src/reconciliar-senado.ts` — the reconciliation choke point + `EnlaceConfirmado` minting — `[VERIFIED: codebase]`
- `packages/ingest/src/allowlist.ts` — `leylobby.gob.cl` already allowlisted; SSRF posture — `[VERIFIED: codebase]`
- `supabase/migrations/0010_agenda.sql` — public-read RLS table pattern — `[VERIFIED: codebase]`
- `supabase/migrations/0018_piso_pii.sql` + `09-03-SUMMARY.md` — deny-by-default PII convention + pgTAP template — `[VERIFIED: codebase + summary]`
- `09-01-SUMMARY.md` — `EnlaceConfirmado` typed writer invariant (affects phase-11-lobby) — `[VERIFIED: summary]`
- `app/app/parlamentario/[id]/page.tsx` + `app/components/votos-por-parlamentario.tsx` — stackable section shell + honest empty states + security-definer RPC read — `[VERIFIED: codebase]`
- Live probes of `leylobby.gob.cl` (curl, 2026-06-19): descargas 503, csv-route 500, audiencias listing 200 paginated, detail 200 with `Identificador` `AQ001AW1442944` + attendee table — `[VERIFIED: curl]`
- `.planning/research/{STACK,ARCHITECTURE,PITFALLS}.md` (v2.0) — `[CITED]`

### Secondary (MEDIUM confidence)
- WebFetch of `leylobby.gob.cl` institution list + audiencia detail (AQ001) — field labels + counterpart shape — `[CITED: leylobby.gob.cl]`
- `camara.cl/transparencia/ley_de_lobby.aspx` exists as an alternate lobby source (403 to WebFetch — gov WAF) — `[CITED: WebSearch + WebFetch 403]`

### Tertiary (LOW confidence)
- Exact congress institution codes on leylobby (paginated list; not yet resolved) — Open Question 2.

## Metadata

**Confidence breakdown:**
- leylobby access method: HIGH — re-validated live; bulk path confirmed dead, HTML path confirmed live with a stable key.
- Connector/writer/identity/RLS patterns: HIGH — directly mirrored from verified v1.0 code + Phase-9 conventions.
- Exact congress institution codes + counterpart column taxonomy: MEDIUM — verified on a non-congress institution; plan task confirms on a congress page.
- `RobotsGuard` 403 behavior: MEDIUM — needs a code read (Open Question 1).

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 for stable items; **7 days** for the leylobby access probes (the source is volatile — Laravel + Azure front door, 503/500/403 quirks observed; re-probe before the connector wave).
