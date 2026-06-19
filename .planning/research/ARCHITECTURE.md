# Architecture Research — Parlamentarios 360 (v2.0)

**Domain:** Civic data platform — adding the "parlamentarios 360" analysis front to a shipped app
**Researched:** 2026-06-18
**Confidence:** HIGH (integration with existing v1.0 code, verified against migrations + packages) / MEDIUM (VOTE source shape — opendata.camara.cl unvalidated live; SERVEL connector shape)

> Supersedes the v1.0 ecosystem ARCHITECTURE.md (2026-06-17). The general platform architecture now lives in CLAUDE.md + MILESTONES.md; this file is the v2.0 milestone integration design.

---

## TL;DR for the roadmapper

- **Reuse, don't rebuild.** Every new connector subclasses `BaseConnector` from `@obs/ingest` and rides the existing `pg_cron → SQL dispatcher → pgmq → pg_net → Edge Function worker` orchestration. The SSRF allowlist already whitelists `leylobby.gob.cl`, `cplt.cl`, `infoprobidad.cl`, `mercadopublico.cl` — the v1.0 team pre-provisioned the v2.0 hosts. SERVEL is the one host NOT in the allowlist and must be added.
- **The identity guard is the spine.** Every per-legislator attribution (vote, meeting, declaration, contribution, contract) keys to the `parlamentario` master through the SAME `vinculo_identidad` / `correrPipeline` machinery used by votes in v1.0. The LOCKED rule holds verbatim: **only a `determinista` (RUT or unique-name-in-chamber+period) link populates a public `parlamentario_id`; everything else stays NULL + raw mention + IdentityMarker.**
- **RUT is the strongest cross key but is INTERNAL-ONLY.** It already lives in `parlamentario.rut` (nullable, RLS deny-by-default, never exposed to anon). New datasets that arrive keyed by RUT (SERVEL, ChileCompra) reconcile against `parlamentario.rut` **server-side in the writer**, then store ONLY the internal `parlamentario_id` on the public row. RUT never lands on a public table and never crosses to an LLM.
- **Graph = relational + compute-at-query, materialized into a cache table by a scheduled job.** Do NOT introduce a graph DB. Edges are derived rows; the graph view is a Postgres-built artifact refreshed on the same cron lane as ingest.
- **Build order is forced: VOTE spike (gates its own block) + identity-completeness → INT → MONEY → NET.** NET depends on all four being populated.

---

## Existing Architecture (v1.0, LOCKED — the substrate)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND  Next.js 16 App Router · Server Components · anon key SO     │
│  /proyecto/[boletin]   /buscar   /agenda      (read Supabase, RLS)     │
└───────────────┬──────────────────────────────────────────────────────┘
                │ reads public tables (RLS public-read); rut NEVER exposed
┌───────────────▼──────────────────────────────────────────────────────┐
│  DATA  Supabase Postgres 15 (cloud bctyygbmqcvizyplktuw, sa-east-1)    │
│   parlamentario(+alias, rut internal)  vinculo_identidad  *_audit      │
│   proyecto · votacion · voto · tramitacion_evento · citacion* · ficha  │
│   pgvector HNSW (768-dim) · pg_cron · pg_net · pgmq                    │
└───────────────▲───────────────────────────▲──────────────────────────┘
                │ writer (service role)      │ orchestration (SQL)
┌───────────────┴───────────┐   ┌───────────┴──────────────────────────┐
│ INGEST  @obs/ingest        │   │ pg_cron → util.process_ingest_jobs() │
│ BaseConnector (Template)   │   │  → pgmq.read(vis=backoff) → pg_net    │
│ policy ONCE: rate-limit    │   │  → Edge Fn `ingest-worker` (Deno)     │
│ 2-3s serial/host · robots  │   │  → ack pgmq.delete / read_ct>5 → DLQ  │
│ UA · daily cache · R2      │   │  GitHub Actions = same connector,     │
│ immutable (aws4fetch+INM)  │   │   escape hatch for long backfills     │
│ drift fingerprint · prov.  │   └──────────────────────────────────────┘
└────────────────────────────┘
          │ raw → Cloudflare R2 (content-addressed, immutable)
          │ normalized/derived → Postgres   (raw NEVER in Postgres)
┌─────────┴──────────────────────────────────────────────────────────────┐
│ IDENTITY (critical)  determinista (RUT/unique name) → blocking →         │
│   MiniMax adjudication (≥0.90) → revisor-cli (human gate) → golden ≥0.95 │
│   → immutable audit.  correrPipeline() is the single reconciliation entry│
└─────────────────────────────────────────────────────────────────────────┘
```

Facts that constrain v2.0 (verified in code):
- `voto.parlamentario_id` is a **nullable FK to `parlamentario(id)`**, populated only on `metodo='determinista'` / `estado_vinculo='confirmado'`; otherwise NULL + raw `mencion_nombre` (migration `0008`, `reconciliar-senado.ts`). **This is the template for every new attribution table.**
- `reconciliarVotosSenado(...)` → `correrPipeline(mencion, maestra, provider, writer)` is the reusable reconciliation call. New datasets that key by NAME reuse it as-is; deterministic resolution short-circuits before the LLM (0 calls).
- RLS is **public-read EXPLICIT** on public tables (`for select to anon using(true)` + `grant select`), **deny-by-default** on `parlamentario`, `vinculo_identidad`, `revision_identidad`, `identidad_audit`. New public tables follow the former; anything carrying RUT or family data follows the latter.
- The SSRF allowlist (`@obs/ingest/allowlist.ts`) already contains `leylobby.gob.cl`, `cplt.cl`, `infoprobidad.cl`, `mercadopublico.cl`. **SERVEL (`servel.cl` / `aportes.servel.cl` / `repodocgastoelectoral.blob.core.windows.net`) is NOT — add it.**
- `resolver_identidad` is a transactional RPC (`SECURITY INVOKER`, service-role only) — the established pattern for any new identity write.

---

## (a) Integration Points — New Connectors reuse `@obs/ingest` + orchestration

**Pattern (unchanged from v1.0): one package per feature, mirroring `@obs/tramitacion` / `@obs/agenda`.**

| New package | Source(s) | Connector type & parse | Reuses | Confidence |
|-------------|-----------|------------------------|--------|------------|
| `@obs/votos` (or module in `@obs/tramitacion`) | `opendata.camara.cl/wscamaradiputados.asmx` (`getVotaciones_Boletin` → vote detail with `Diputado`/`Opcion`) | XML → `fast-xml-parser` | `BaseConnector`, existing `Voto`/`votacion` model, Cámara deterministic cross by `Diputado/Id` | MEDIUM (shape per WS docs; **not validated live → Phase-1 spike**) |
| `@obs/lobby` | `leylobby.gob.cl` (audiencias/reuniones); CPLT `cplt.cl` if bulk dump exists | JSON/CSV → `fetch`+zod; cheerio fallback | `BaseConnector`, `correrPipeline` (name cross), R2 raw | MEDIUM |
| `@obs/probidad` | `infoprobidad.cl` (patrimonio + intereses, CC BY 4.0) | HTML/JSON → cheerio/zod | `BaseConnector`, RUT or name cross | MEDIUM |
| `@obs/dinero` | SERVEL aportes (`aportes.servel.cl`, `repodocgastoelectoral.blob...`) + ChileCompra `api.mercadopublico.cl` | SERVEL: **artisanal** (portal/blob, no clean REST → cheerio + careful pagination, expect fragility); ChileCompra: JSON REST by ticket | `BaseConnector`, RUT cross (server-side), R2 raw | LOW (SERVEL) / MEDIUM (ChileCompra) |

**How each rides the existing machinery (no new infra):**

1. **Connector** subclasses `BaseConnector` (Template Method) → policy (rate-limit 2–3s serial-per-host, robots, UA, daily cache, R2 immutable via `aws4fetch` + `If-None-Match`, drift fingerprint, provenance) is applied ONCE by the base. New code only implements source-specific request specs + parse.
2. **Allowlist:** confirm host suffix in `DEFAULT_ALLOWED_SUFFIXES`. **Action: add `servel.cl` (and the Azure blob host via a dedicated suffix or `extraHosts`) — it is the only missing one.** Defense-in-depth SSRF stays intact.
3. **Orchestration:** add the new job kind to `util.process_ingest_jobs()` dispatch (versioned SQL migration); `pg_cron` schedules it; `pgmq` carries tasks (one boletín / one legislator / one declaration per message); the `ingest-worker` Edge Function assembles the connector with real collaborators (R2, snapshot/drift via supabase-js). `read_ct > 5 → DLQ` unchanged.
4. **Long backfills** (full SERVEL history, full ChileCompra by-RUT sweep, vote backfill across all boletines) run the SAME connector under **GitHub Actions** — Edge Function ~400s/CPU limits make these unsuitable for the Edge lane. Established escape hatch.
5. **Writer:** each package ships an idempotent `*Writer` (in-memory for tests + `Supabase*Writer` with `upsert onConflict` on the natural key), mirroring `SupabaseTramitacionWriter` / `SupabaseAgendaWriter`. **The writer is also where RUT→`parlamentario_id` reconciliation happens server-side (see §e).**

**New vs modified — explicit:**

| Component | New / Modified |
|-----------|----------------|
| `@obs/votos`, `@obs/lobby`, `@obs/probidad`, `@obs/dinero` packages | **New** |
| `@obs/ingest` allowlist (add SERVEL host) | **Modified** (one-line suffix add + test) |
| `@obs/ingest` BaseConnector / policy / R2 / drift / fetcher | **Unchanged** (reused) |
| `util.process_ingest_jobs()` dispatcher | **Modified** (new job kinds; new pgmq queues optional or shared) |
| `@obs/adjudication` `correrPipeline` + `@obs/identity` | **Unchanged** (reused for every name cross) |
| `@obs/tramitacion` `Voto`/`votacion` model | **Reused** by VOTE (votes are the same shape; do NOT fork the model) |
| Migrations `0018+` (new data tables, graph cache, RPC) | **New** |
| Frontend `/parlamentario/[id]` + sections | **New** routes; reuse design system (`ProvenanceBadge`, `IdentityMarker`) verbatim |

> **Decision — VOTE is enrichment, not a new model.** The public vote tables already exist (`0008`). opendata.camara.cl supplies the per-diputado detail that `doGet.asmx` returned as `Votos=null`. Today only 996 Cámara votes are linked via DIPID; opendata extends that coverage. Recommend a **thin `@obs/votos` package OR a module inside `@obs/tramitacion`** writing into the SAME `voto` table — never a duplicate `voto` model.

---

## (b) New Data Model — keys to identity master + boletín

**Three cross keys (PROJECT.md):** **boletín** (projects/votes), **normalized name** (the most-used bridge), **RUT** (strongest, INTERNAL-ONLY). Every new table keys to `parlamentario(id)` via a **nullable FK populated only on a confirmed/deterministic link**, and (where applicable) to `proyecto(boletin)`. Every row carries provenance inline (`origen`, `fecha_captura`, `enlace`).

### VOTE — enriches existing `voto`/`votacion` (extends `0008`, no new attribution table)
- opendata vote detail maps onto existing `votacion` (by id/boletín) and `voto` (by `(votacion_id, fuente_voter_id)`). Cámara crosses **deterministically by `Diputado/Id` → `parlamentario.id_diputado_camara`** (no LLM, official id) — exactly the v1.0 path.
- Optional `voto_tema` (vote × topic): topic from `proyecto.materia` only; **inferred topic tagging deferred / correlational-only** (anti-causality).

### INT — lobby + asset/interest declarations
```
reunion_lobby
  id pk · parlamentario_id (FK parlamentario, NULLABLE) · mencion_nombre (raw) · estado_vinculo
  fecha · materia · asistentes_text (raw) · institucion · cargo_solicitante
  boletin (FK proyecto, NULLABLE — only if the meeting explicitly cites one)
  origen · fecha_captura · enlace

declaracion_patrimonio / declaracion_interes   (CC BY 4.0 — attribution visible)
  id pk · parlamentario_id (FK, NULLABLE) · estado_vinculo
  periodo · tipo · descripcion_text (as published) · monto? · entidad?
  origen · fecha_captura · enlace
```
- Lobby & declarations are published by legislator name (declarations often by RUT). Reconcile by RUT server-side if present, else `correrPipeline` by name. Public row stores only `parlamentario_id`.
- `reunion_lobby.boletin` is nullable, set only when the source explicitly cites a boletín — never inferred.

### MONEY — campaign finance + state contracts
```
aporte_campania            -- SERVEL, keyed by candidate (RUT internal)
  id pk · parlamentario_id (FK, NULLABLE) · estado_vinculo
  eleccion · periodo · tipo_aporte (publico/sin_publicidad/personal)
  aportante_text? (only if SERVEL publishes it) · monto · fecha
  origen · fecha_captura · enlace

contrato_estado            -- ChileCompra, keyed by RUT of supplier/related entity
  id pk · parlamentario_id (FK, NULLABLE) · estado_vinculo
  proveedor_text           -- entity name AS PUBLISHED (no raw third-party RUT on public row)
  organismo · monto · fecha · objeto_text · id_licitacion
  origen · fecha_captura · enlace
```
- **Highest-risk "máquina de sospechas" surface.** A money↔person link is a *derived cross* (Ley 21.719: derived data is protected). Show as fact-with-source, never as implication. Legislator FK must be `confirmado` via RUT-exact — no probabilistic linking of money to a person.

### Keying summary

| Dataset | Primary cross key | Secondary | `parlamentario_id` populated when | `boletin` FK |
|---------|-------------------|-----------|-----------------------------------|--------------|
| VOTE (Cámara) | `Diputado/Id` (deterministic) | — | always (official id) | via `votacion` |
| VOTE (Senado) | normalized name → `correrPipeline` | — | only `determinista` | via `votacion` |
| Lobby | RUT (if present) else name | name | RUT-exact OR `determinista` name | nullable, only if cited |
| Patrimonio/Intereses | RUT (declarations carry it) | name | RUT-exact OR `determinista` | n/a |
| Finance (SERVEL) | RUT (candidate) | name | RUT-exact | n/a |
| Contracts (ChileCompra) | RUT (supplier/entity) | name | RUT-exact ONLY (no name guess) | n/a |

---

## (c) Identity Guard per Dataset

The guard is **one rule, applied at the writer + enforced by the schema**: *a public attribution row links to a legislator ONLY when the link is deterministic/confirmed; otherwise `parlamentario_id` is NULL and the raw mention is shown with an `IdentityMarker`.*

| Dataset | How it crosses | Guard application |
|---------|----------------|-------------------|
| **VOTE — Cámara** | `Diputado/Id` → `id_diputado_camara` | Deterministic by official id → always linkable. **No LLM.** (verified: v1.0 does this) |
| **VOTE — Senado** | name → `correrPipeline` | Only `determinista` populates id; `probable`/`revision`/`no_confirmado` → NULL + raw mention. (verified: `reconciliar-senado.ts`) |
| **Lobby** | RUT if published, else name | RUT-exact = deterministic. Name-only → `correrPipeline`; only `determinista` links. Homonym → NULL + IdentityMarker. |
| **Patrimonio/Intereses** | declaration RUT | RUT-exact deterministic against `parlamentario.rut` (internal). Strongest case — high link rate. |
| **Finance (SERVEL)** | candidate RUT | RUT-exact only. SERVEL candidate ≠ always current legislator → unmatched RUT stays unlinked (don't fabricate). |
| **Contracts (ChileCompra)** | supplier/entity RUT | **RUT-exact ONLY; never name-guess.** Money↔person is the riskiest link; a wrong match here is existential risk #1 made worse. No exact RUT match → no attribution. |

**Reused machinery:** `correrPipeline` (blocking → MiniMax ≥0.90 → human revisor-cli → golden gate) and the `vinculo_identidad` / `revision_identidad` / `identidad_audit` tables are **unchanged**. New name-cross datasets enqueue into the SAME human queue and write through `resolver_identidad`. The golden set CI gate (≥0.95) **grows new cases per dataset** (a lobby homonym is a new golden case).

**UI guard:** the frontend's existing `IdentityMarker` + "link only if `estado_vinculo='confirmado'`" (TRAM-06) applies verbatim to every new section of `/parlamentario/[id]`.

---

## (d) Graph (NET) — Storage & Computation Decision

**Decision: relational edges + compute-at-query (recursive CTE), materialized into a refresh-on-cron cache table. NO graph database.**

Reasoning:
1. **Sparse + small data.** 186 legislators; edges = co-votes, shared meetings, finance overlaps, contract proximities — thousands of edges, not millions. A graph DB (Neo4j) adds a stateful service that contradicts "todo en Supabase" — same reason BullMQ was rejected in v1.0.
2. **Edges are DERIVED, not source facts.** A "relationship" is a cross computed from votes/meetings/money. Storing it as a first-class graph would blur the source-fact / derived-data boundary the whole product rests on. Keep raw facts in their tables; derive edges.
3. **Postgres does this natively.** Recursive CTEs handle path/neighborhood queries; a SQL/`pl/pgsql` job materializes the edge table on a schedule.

**Shape:**
```
influencia_edge   (DERIVED — refreshed by scheduled job, not ingested)
  origen_id   text references parlamentario(id)   -- both endpoints CONFIRMED only
  destino_id  text references parlamentario(id)
  tipo        text  -- 'co_voto' | 'lobby_compartido' | 'aporte_comun' | 'contrato_proximo'
  peso        numeric        -- count/strength, descriptive only
  evidencia   jsonb          -- pointers to source rows (votacion_id, reunion_id...) WITH enlaces
  ventana     daterange      -- temporal context (rule: correlation + time, never cause)
  fecha_calculo timestamptz
  primary key (origen_id, destino_id, tipo)
```

**Where computation lives:**
- **Build/refresh:** a **scheduled SQL/`pl/pgsql` procedure via `pg_cron`** aggregating the four source tables into `influencia_edge`, AFTER nightly ingest. Expensive full recompute → **GitHub Actions escape hatch** (same as big backfills).
- **Query:** frontend reads `influencia_edge` directly (RLS public-read); ego-network / k-hop expansion uses a **recursive-CTE RPC** (`SECURITY INVOKER`, granted to anon) — same RPC pattern as `match_proyectos` / `resolver_identidad`.
- **Render:** client graph lib (`react-flow` or `sigma.js`) chosen at NET time, fed by the RPC. Out of scope now.

**Hard constraints on NET (rule rectora):**
- Both endpoints of any edge MUST be `confirmado` legislators — a fabricated edge between misidentified people is the worst-case "máquina de sospechas".
- Every edge carries `evidencia` (source links) + `ventana` (time). UI shows "co-voted N times in period X, source Y", **never** "allied with / influenced by".
- Edges are descriptive aggregates; **no causal/intent language, no person-ranking score.**

**Rejected alternative — property graph (Neo4j / Apache AGE):** Neo4j = extra stateful infra, contradicts all-Supabase. **Apache AGE (Postgres graph extension) is not available on Supabase managed Postgres** → off the table. Recursive CTE covers the query needs at this scale.

---

## (e) Where "minimization + traceability" and RUT-internal-only are enforced (architecturally)

Enforcement is **layered, defense-in-depth** — never a single check.

1. **Schema / RLS (the floor).** `parlamentario.rut` is on a **deny-by-default RLS** table (no anon policy, no `grant select`) — verified `0005`. RUT is physically unreachable by the anon/frontend role. New public tables get **public-read EXPLICIT** RLS but **never carry a legislator RUT column** — only the internal `parlamentario_id`. Third-party RUTs (contract suppliers, donors) are **not stored raw on public rows** — store the entity name as published.
2. **Writer boundary (RUT used, then dropped).** RUT→`parlamentario_id` reconciliation happens **inside the `Supabase*Writer`, server-side, service role**: read `parlamentario.rut` (internal), match, write only `parlamentario_id` to the public row. RUT is an input to reconciliation, never an output to a public table.
3. **LLM data-routing gate (already built — reuse).** `@obs/llm`'s `assertNoRutInLlmInput` rejects a RUT before any LLM call (verified in MILESTONES). Name-cross datasets inherit this (the mention carries no RUT by construction, T-04-02/T-05-08). RUT-keyed datasets resolve deterministically → never touch the LLM.
4. **Identity audit (immutability).** Every link decision writes an append-only `identidad_audit` row (trigger + REVOKE — verified `0006`/`0007`). New datasets reuse it → full provenance of every attribution.
5. **Per-row provenance (traceability).** Every public row carries `origen` + `fecha_captura` + `enlace` (FND-08); `ProvenanceBadge` renders it, never hidden (TRAM-09). This is the core-value enforcement.
6. **Anti-causality (product rule).** No table stores "intent / alliance / influence-of". `influencia_edge.tipo` is mechanical, `evidencia` points to sources, `ventana` gives time. Sober Spanish UI copy, no causal language — carries over from v1.0.
7. **Legal gate (process).** Ley 21.719 full force 2026-12-01 → legal review BEFORE broad public exposure of the new fronts (especially MONEY/INT). CC BY 4.0 attribution visible for InfoProbidad.

---

## Suggested Build Order (respects hard dependencies)

```
Phase 1  VOTE SPIKE — validate opendata.camara.cl live          [GATE]
         ├─ Does getVotaciones_Boletin / vote detail return per-diputado
         │  Diputado/Id + Opcion?  (EXISTS in WS docs; NOT live-tested)
         ├─ YES → build VOTE (thin @obs/votos or @obs/tramitacion module):
         │        enrich voto.parlamentario_id by official DIPID (deterministic, no LLM)
         └─ NO  → REPLAN the VOTE block (PROJECT.md mandates this). Don't block INT/MONEY.

Phase 2  IDENTITY COMPLETENESS (precondition for ALL attribution)
         ├─ Backfill parlamentario.rut where missing (catalogs omit it — Pitfall 4)
         │  from declaration/SERVEL/official sources, server-side, internal-only.
         ├─ Grow golden set with per-dataset homonym cases.
         └─ Without this, RUT-cross datasets (Phase 3/4) can't link.
         (Phases 1 and 2 can run in parallel — VOTE Cámara uses DIPID, not RUT.)

Phase 3  INT — lobby + patrimonio/intereses (@obs/lobby, @obs/probidad)
         ├─ Declarations carry RUT → high deterministic link rate.
         ├─ Lobby by name → correrPipeline (reuse).
         └─ Frontend: first /parlamentario/[id] sections (declarations, meetings).

Phase 4  MONEY — SERVEL finance + ChileCompra contracts (@obs/dinero)
         ├─ Add servel.cl to allowlist. SERVEL = artisanal/fragile connector.
         ├─ RUT-exact linking ONLY (no name guessing for money).
         ├─ Highest legal/sensitivity surface → legal review gate before exposure.
         └─ Depends on Phase 2 (RUT) being solid.

Phase 5  NET — influence graph (@obs influencia)
         ├─ DEPENDS on VOTE+INT+MONEY being populated (edges derive from them).
         ├─ influencia_edge cache table + pg_cron refresh proc + recursive-CTE RPC.
         ├─ Both endpoints confirmado; evidence+ventana per edge; no causal language.
         └─ Pick react-flow/sigma.js here (deferred until now).
```

**Dependency rationale:**
- **Identity-first is non-negotiable** — risk existencial #1. No per-legislator attribution writes before the master can resolve the dataset's key (RUT backfill / golden cases). VOTE Cámara is the exception (official DIPID, no identity ambiguity), so its spike runs first/in parallel.
- **VOTE spike gates its own block only** — INT/MONEY don't depend on votes, so a failed opendata validation replans VOTE without stalling the rest.
- **NET is last** by construction — it computes edges over the other four datasets; nothing to graph until they exist.
- **MONEY before NET, after identity** — money edges in NET need ChileCompra/SERVEL rows.

---

## Anti-Patterns (specific to this milestone)

| Anti-pattern | Why wrong | Instead |
|--------------|-----------|---------|
| Forking the `voto`/`votacion` model in a new VOTE package | Two sources of truth for votes; breaks the boletín cross | Enrich the existing `0008` tables |
| Name-matching money to a legislator | A wrong money↔person link is the worst "máquina de sospechas" + false-but-credible claim | RUT-exact deterministic ONLY for MONEY |
| Storing legislator RUT (or supplier RUT) on a public table | Ley 21.719 violation; defeats minimization | RUT internal-only on `parlamentario`; public rows carry `parlamentario_id` |
| Introducing Neo4j / a graph DB for NET | Extra stateful infra, contradicts all-Supabase (same as BullMQ rejection); AGE unavailable on Supabase | Relational edges + recursive CTE + materialized cache |
| Computing the graph live on every page load | Recursive CTE over four datasets per request = slow | Materialize `influencia_edge` on cron; query the cache |
| Sending RUT to an LLM for adjudication | Privacy + data-routing gate forbids it | `assertNoRutInLlmInput` (built); RUT crosses are deterministic anyway |
| Hardcoding the SERVEL portal as a stable REST API | Artisanal portal/blob, no clean API → will break | Treat as fragile: cheerio + drift detection + GitHub Actions backfill, degrade honestly |
| Inferring `boletin` linkage for lobby meetings | Implies causality the source didn't state | Set `boletin` only when the source explicitly cites it |

---

## Integration Points Summary (for the roadmapper)

**External Services**

| Service | Host | Integration | Status |
|---------|------|-------------|--------|
| opendata.camara.cl (votes) | `opendata.camara.cl` (under `camara.cl` ✓ allowlisted) | XML WS → fast-xml-parser; deterministic by DIPID | **SPIKE — unvalidated live** |
| Ley Lobby | `leylobby.gob.cl` ✓ allowlisted | JSON/HTML → fetch+zod / cheerio | MEDIUM |
| InfoProbidad | `infoprobidad.cl` ✓ allowlisted (CC BY 4.0) | HTML/JSON; RUT-cross + name-cross | MEDIUM |
| CPLT | `cplt.cl` ✓ allowlisted | bulk dump if available | LOW |
| SERVEL finance | `servel.cl` / `aportes.servel.cl` / Azure blob | **artisanal cheerio; ADD to allowlist** | LOW (fragile) |
| ChileCompra | `api.mercadopublico.cl` ✓ allowlisted | JSON REST by RUT (ticket-keyed) | MEDIUM |

**Internal Boundaries**

| Boundary | Communication | Note |
|----------|---------------|------|
| new `@obs/*` connector ↔ `@obs/ingest` | subclass `BaseConnector`; reuse policy | unchanged contract |
| new writer ↔ `parlamentario` master | service-role read of `rut` for RUT-cross; write only `parlamentario_id` | RUT never leaves server |
| new name-cross ↔ `@obs/adjudication` | `correrPipeline(mencion, maestra, provider, writer)` | reused verbatim, same human queue |
| orchestration ↔ new jobs | `pg_cron` → `util.process_ingest_jobs()` → pgmq → Edge Fn | extend dispatcher (SQL migration) |
| NET ↔ source tables | scheduled SQL proc materializes `influencia_edge` | derived, not ingested |
| frontend ↔ new public tables | Server Components, anon key, RLS public-read | reuse `ProvenanceBadge`/`IdentityMarker` |

---

## Sources

- v1.0 codebase (HIGH): `supabase/migrations/0005_parlamentario.sql`, `0006_revision_identidad.sql`, `0008_tramitacion.sql`, `0015_resolver_identidad_rpc.sql`; `packages/ingest/src/allowlist.ts`, `index.ts`; `packages/tramitacion/src/reconciliar-senado.ts` — verified integration contracts, RLS posture, identity guard, allowlist pre-provisioning.
- `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `CLAUDE.md` — milestone goals, cross keys, sources, constraints (HIGH).
- [Cámara open data WS](https://opendata.camara.cl/wscamaradiputados.asmx?op=getVotaciones_Boletin) / [votacion_boletin](https://opendata.camara.cl/pages/votacion_boletin.aspx) — vote detail returns `Diputado`/`Opcion`, bulletin-keyed — MEDIUM (docs confirm shape; **live validation pending = Phase-1 spike**).
- [SERVEL aportes](https://www.servel.cl/aportes/) / [financiamiento de campaña](https://www.servel.cl/campanas-electorales/financiamiento-de-campana/) / [repodocgastoelectoral blob](https://repodocgastoelectoral.blob.core.windows.net/) — publishes contributor register via portal/blob, no clean REST → artisanal connector — LOW (fragility confirmed).
- Postgres recursive CTE + materialized cache for sparse derived graphs; Apache AGE unavailable on Supabase managed Postgres — HIGH (established Postgres capability + Supabase extension constraint).

---
*Architecture research for: parlamentarios-360 front (v2.0) on the shipped Observatorio del Congreso 360*
*Researched: 2026-06-18*
