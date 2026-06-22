# Phase 18: NET — Grafo de influencia (`@xyflow/react`) - Research

**Researched:** 2026-06-21
**Domain:** Graph-as-Postgres (entidad/arista + recursive CTE), `@xyflow/react@12` client island in Next.js 16 App Router, anti-insinuación edge taxonomy, double-gate exposure
**Confidence:** HIGH (codebase patterns + library facts verified); MEDIUM on legal sufficiency (by design — that's F17's job, not this phase's)

## Summary

Phase 18 builds a **complete but gated-OFF** influence graph. NET is a **pure consumer** of VOTE (`voto`/`votacion`), INT (`lobby_audiencia`/`lobby_contraparte`), and MONEY (gated) — it ingests **nothing new**. The entire surface (data model, materialization, RPC, UI) ships behind `NET_PUBLIC_ENABLED=false` (fail-closed) plus RLS deny-by-default, exactly mirroring the MONEY double-gate (Phases 13–16). Turning it on is operator debt F17, contingent on `17-LEGAL-DOSSIER.md` `signoff: approved` (currently `pending`).

The three hard problems each have a clean, precedented answer in this codebase: (1) **Graph-as-Postgres** — two tables (`entidad` nodes, `arista` edges) with provenance/temporal-window columns, materialized by a `pg_cron`-invoked idempotent plpgsql proc that **only emits an edge when BOTH endpoints are `confirmado`**; a `security definer` recursive-CTE RPC returns a depth-bounded subgraph, PII-safe (never `partido`/`rut`), mirroring `0019`/`0020`/`0021`/`0025`. (2) **`@xyflow/react@12.11.0`** installs in `app/`, is a `'use client'` island (peer `react>=17`, compatible with React 19.2), requires one CSS import, and stays out of every existing server route's bundle. (3) **Edge taxonomy** is the legal crux: the conservative defensible set is **co-votación on the same `votacion`** and **co-asistencia at the same lobby `contraparte`** — each a typed, sourced, time-windowed fact — while everything that only reads as insinuation (any score, ranking, affinity edge, money-derived edge while MONEY is gated, LLM-inferred edge, path-finding as a feature) is **excluded by construction**.

**Primary recommendation:** Build NET as 1 SQL migration (`0030`) + 1 pg_cron proc + 1 recursive-CTE RPC + 1 `net-gate.ts` + 1 `/red` client-island route, all gated OFF. Ship the **two-edge taxonomy** (co-vote, co-lobby-contraparte) only; defer money-derived edges behind the double gate; emit nodes with **zero `partido`/`rut`**, and propagate CC BY 4.0 **only** on InfoProbidad-derived rows (no edge type derives from InfoProbidad in the MVP taxonomy, so in practice no edge carries CC BY 4.0 yet — see §Edge Taxonomy and §6).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `entidad`/`arista` storage + RLS deny-by-default | Database / Storage | — | Graph lives as relational tables; no graph DB (locked) |
| Edge materialization (both-endpoints-confirmado, idempotent) | Database (pg_cron proc) | — | Server-side derivation from already-populated facts; never on-the-fly, never client |
| Bounded subgraph retrieval (recursive CTE, PII-safe) | API / Backend (Postgres RPC) | — | `security definer` is the ONLY public channel; mirrors 0020/0026 |
| Exposure gate (`NET_PUBLIC_ENABLED`) | Frontend Server (server-only flag) | Database (RLS) | Double candado: presentation flag + data RLS, mirrors money-gate |
| Graph rendering + filters + provenance tooltips | Browser / Client (`'use client'` island) | Frontend Server (route gate) | xyflow is interactive; must be client island, must not bloat server bundle |
| Route gating (`notFound()` when OFF) | Frontend Server (RSC) | — | Server decides visibility before any client JS loads |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Mode:** mvp. Operator macro-decision (2026-06-21): **"todo gated-OFF"** — build the COMPLETE graph (data model + materialization + RPC + UI) but **behind `NET_PUBLIC_ENABLED` OFF**, like MONEY 14–16. Public exposure does NOT turn on until legal sign-off (Phase 17, `17-LEGAL-DOSSIER.md` `signoff: approved`).
- **NET is a PURE CONSUMER** of VOTE/INT/MONEY. It ingests no new data. Every edge is a **public fact with source + temporal window**, **both endpoints identity `confirmado`**, **no causal language**.
- **Anti-insinuación HARD (LOCKED):** an edge or a path must NEVER read as an accusation (17-LEGAL-DOSSIER §2 nuclear risk). Each edge is a typed fact with source + time window; copy describes the fact, never a valuation or an affinity/closeness relation.
- **PROHIBITED:** suspicion/influence score, person ranking, path-finding presented as a headline feature ("connection between A and B"), causal language ("por eso", "a cambio de"), political affinity/closeness, **LLM-inferred edges** (permanently forbidden).
- **Both endpoints `confirmado`** (audited identity) — never an unverified mention as a node.
- **Partido NEVER reaches anon** (PII floor 0018; lobby/probidad 0021/0022). The node is the parlamentario without photo/partido.
- **Data model (NET-01):** tables `entidad` (node: confirmed parlamentario; type) and `arista` (type, extremo_a, extremo_b, provenance, temporal window `desde`/`hasta`, source dataset, licencia). RLS deny-by-default to anon (same pattern 0018/0021/0022).
- **Materialization by `pg_cron`** (not on-the-fly): a proc populates `arista` from already-populated blocks; both endpoints must be `confirmado` or the edge is not materialized. Idempotent.
- **Public RPC with recursive CTE**, PII-safe: returns the subgraph (nodes + edges) for exploration, WITHOUT partido/rut, only confirmed endpoints, with provenance + window per edge. Same LEGAL-03 gate as 0020/0026.
- **UI (NET-02):** `@xyflow/react@12` (install in `app/`), **client island** — rest of site stays server-first. The NET route (e.g. `/red`) is **gated by `NET_PUBLIC_ENABLED`** (server-side, `notFound()` or honest-state when OFF, mirror of MONEY).
- Filters by **edge type** and by **time** (temporal window). Each edge traceable to its source (tooltip/panel with link).
- **CC BY 4.0 (NET-02 / 17-DOSSIER §6):** nodes/edges derived from **InfoProbidad** propagate CC BY 4.0 attribution (in node/tooltip). Other datasets carry their own per-row attribution. **NEVER label the whole graph CC BY 4.0**, and **do NOT set `licencia text default 'CC BY 4.0'`** on `entidad`/`arista` — license is inherited per-row from the source block.
- **Gate:** `app/lib/net-gate.ts`: server-only flag `NET_PUBLIC_ENABLED` (default `false`, fail-closed) — exact mirror of `money-gate.ts`. Double candado: RLS deny-by-default on `entidad`/`arista` + presentation flag.
- Design Phase 19: tokens crema/petróleo, ES editorial voice, honest states. EXTENDS `globals.css`, does NOT touch `civic-tokens.css`.

### Claude's Discretion
- Final edge taxonomy (minimum defensible set); route name and flag name; pg_cron proc structure and recursive-CTE structure; graph layout (xyflow); whether the subgraph is bounded by selected node or served whole (**bounded is more sober** — recommended).

### Deferred Ideas (OUT OF SCOPE)
- **Turning NET on publicly** — waits for F17 sign-off (`17-LEGAL-DOSSIER` `signoff: approved`).
- **MONEY-derived edges exposed** — double gate (NET + MONEY).
- **Path-finding / centrality / network metrics** — insinuation risk; out of scope (not designed as a feature).
- **LLM-inferred edges** — permanently PROHIBITED (only edges with verifiable source).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NET-01 | Materialize `entidad`/`arista` via pg_cron proc + recursive-CTE RPC (no graph DB); each edge has provenance + temporal window; BOTH endpoints `confirmado` | §Data Model DDL, §Materialization Proc, §Recursive-CTE RPC |
| NET-02 | Citizen explores graph (UI `@xyflow/react@12`, client island) with filters by edge type and time, each edge source-traceable; CC BY 4.0 propagated from InfoProbidad | §xyflow Client-Island Integration, §Edge Taxonomy, §6 CC BY 4.0 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xyflow/react` | 12.11.0 | Graph/flow rendering as a client island | The maintained successor to `react-flow-renderer`; v12 added SSR/SSG support; React 19-compatible via peer `react>=17`. [VERIFIED: npm registry — `npm view @xyflow/react version` → 12.11.0, peerDeps `react: >=17`] |
| Supabase Postgres | 15+ (`pg_cron`, `pgmq`, `pg_net` already in use) | `entidad`/`arista` + materialization + recursive-CTE RPC | No graph DB (locked). Recursive CTE is native SQL; pg_cron already drives orchestration (0003). [VERIFIED: codebase grep — `0003_orchestration.sql` uses `cron.schedule`] |
| Next.js | 16.2.9 (App Router) | Route `/red`, server-side gate, client-island boundary | Already the app's framework; Server Components default, `'use client'` islands supported. [VERIFIED: codebase — `app/package.json` `next: 16.2.9`, `react: 19.2.4`] |
| React | 19.2.4 | UI | Already installed; satisfies xyflow peer `react>=17`. [VERIFIED: codebase — `app/package.json`] |

### Supporting (already installed — reuse, do not add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-tooltip` | ^1.2.10 | Provenance tooltips on nodes/edges (source + fecha + enlace + licencia) | Reuse existing dep for edge/node provenance popovers |
| `@supabase/supabase-js` | ^2.108.2 | Call the graph RPC from the RSC | `createServerSupabase()` already used by every route |
| `server-only` | ^0.0.1 | Line-1 import in `net-gate.ts` | Mirror `money-gate.ts:1` so the flag never reaches the browser bundle |
| `lucide-react` | ^1.20.0 | Icons in custom node/edge components | Already in use across UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@xyflow/react` | `sigma.js` / `react-force-graph` / `cytoscape` | xyflow is React-first, controlled-state, SSR-aware, and already named in CONTEXT (locked). Force-directed libs invite "closeness" reading — anti-insinuación liability. Use xyflow. |
| Recursive CTE in RPC | Materialized view + flat select | A bounded subgraph by selected node needs traversal; recursive CTE expresses depth bound directly. A flat MV is fine if you serve a **whole** small graph, but bounded-by-node is more sober (CONTEXT discretion → choose bounded). |
| pg_cron proc | On-the-fly edge computation in the RPC | Locked: materialization by pg_cron, NOT on-the-fly. Keeps the RPC cheap and the "both confirmado" invariant enforced once at write time. |

**Installation:**
```bash
# in app/ only (client-island dep — keep it out of every server route)
cd app && npm install @xyflow/react@12.11.0
```

**Version verification:** `npm view @xyflow/react version` → **12.11.0** (latest); `dist.unpackedSize` ≈ **1.20 MB**; `peerDependencies.react` = **`>=17`** (React 19.2.4 satisfied). [VERIFIED: npm registry, 2026-06-21]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@xyflow/react` | npm | mature (xyflow org, ex `react-flow-renderer`) | ~millions/wk | github.com/xyflow/xyflow | not run (CLI lacked `--json`; package is well-known, official xyflow org) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck 0.6.1 is installed but its `install --json` flag is unavailable in this version. `@xyflow/react` is the official xyflow-org package (successor to `react-flow-renderer`), version 12.11.0 confirmed via `npm view`, source repo `github.com/xyflow/xyflow`. Treated as Approved. If the planner wants belt-and-suspenders, gate the single install behind a `checkpoint:human-verify` task — but this is a household-name React library, not a slop candidate.*

## Architecture Patterns

### System Architecture Diagram

```
ALREADY-POPULATED SOURCE FACTS (NET ingests nothing)
  voto / votacion (VOTE)        lobby_audiencia / lobby_contraparte (INT)     [dinero/servel/agregacion (MONEY, gated)]
        │                                   │                                              │ (DOUBLE-GATED, excluded in MVP)
        └───────────────┬───────────────────┘                                              X
                        ▼
        ┌─────────────────────────────────────────────┐
        │  pg_cron proc  net.materializar_aristas()    │  idempotent; runs on schedule
        │  - INSERT ... ON CONFLICT DO NOTHING/UPDATE   │  (delete-and-reinsert per type, or upsert by natural key)
        │  - ONLY both endpoints estado_vinculo=        │
        │    'confirmado' → else edge NOT written       │
        └───────────────┬─────────────────────────────┘
                        ▼
   ┌────────────────┐        ┌────────────────────────────────────┐
   │ entidad (nodes)│◄───FK──│ arista (edges)                     │  RLS deny-by-default (anon: 0 rows)
   │ parlamentario  │        │ tipo, extremo_a, extremo_b,        │  REVOKE ALL FROM anon, authenticated
   │ confirmado only│        │ provenance, desde/hasta, dataset,  │
   └────────────────┘        │ licencia (per-row, inherited)      │
                             └───────────────┬────────────────────┘
                                             ▼
        ┌─────────────────────────────────────────────────────────────┐
        │ RPC subgrafo_red(p_id, p_depth, p_tipos[], p_desde, p_hasta) │  SECURITY DEFINER, search_path=''
        │ recursive CTE, depth-bounded; returns nodes + edges          │  NEVER emits partido/rut
        │ both endpoints confirmado; provenance + window per edge      │  revoke from public; grant execute anon
        └───────────────┬─────────────────────────────────────────────┘
                        ▼  (only reachable when gate ON)
   ┌────────────────────────────────────────────────────────────────────┐
   │ RSC  app/app/red/page.tsx                                          │
   │  if (!netPublicEnabled(process.env)) notFound();  ← FIRST statement│  server-only flag
   │  → fetch RPC via createServerSupabase()                            │
   │  → pass nodes/edges as props to <RedGraph> ('use client' island)  │
   └───────────────┬────────────────────────────────────────────────────┘
                   ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │ 'use client'  app/components/red/red-graph.tsx                     │  @xyflow/react island
   │  import '@xyflow/react/dist/style.css'                             │  custom node (sober ES label,
   │  controlled nodes/edges; filters (tipo, tiempo);                  │  no partido/photo) + custom edge
   │  Radix tooltip = provenance (origen/fecha/enlace/licencia)        │  (typed fact copy, time window)
   └────────────────────────────────────────────────────────────────────┘
```

### Data Model DDL Sketch (NET-01 — migration `0030_net.sql`)

Mirror the deny-by-default + provenance-inline conventions of `0021`/`0022`/`0025`. **Do NOT** put `licencia text default 'CC BY 4.0'` (17-DOSSIER §6 — license is per-row inherited).

```sql
-- 0030_net.sql  (last applied is 0028; 0029 is votos pgTAP → NET starts at 0030)
-- entidad / arista: graph-as-Postgres. DENY-BY-DEFAULT to anon (mirror 0018/0021/0022).
-- Candado A (datos). Candado B (presentación) = net-gate.ts. Nothing exposed until F17 sign-off.

-- ── entidad (NODE: confirmed parlamentario only) ──────────────────────────────
create table entidad (
  id            text primary key,                       -- = parlamentario.id (D####/S####)
  parlamentario_id text not null references parlamentario(id) on delete cascade,
  tipo          text not null default 'parlamentario',  -- node type (extensible; MVP = parlamentario)
  -- NO partido, NO rut, NO email columns here. The node is identity-only.
  -- provenance of the node = the parlamentario master; not duplicated.
  fecha_captura timestamptz not null default now(),
  unique (parlamentario_id)
);
alter table entidad enable row level security;          -- DENY-BY-DEFAULT: enable, zero policies
revoke all on entidad from anon, authenticated;         -- close default-privileges hole (0021 pattern)

-- ── arista (EDGE: typed public fact, both endpoints confirmado) ───────────────
create table arista (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('co_votacion','co_lobby_contraparte')),  -- MVP taxonomy
  extremo_a     text not null references entidad(id) on delete cascade,
  extremo_b     text not null references entidad(id) on delete cascade,
  -- the shared object that makes this a FACT (votacion_id, or lobby contraparte key)
  contexto_clave text not null,                          -- e.g. votacion_id, or normalized contraparte name
  contexto_detalle text,                                 -- e.g. seleccion compartida, materia, contraparte nombre
  -- temporal window per edge (17-DOSSIER §2 mandatory)
  desde         timestamptz,
  hasta         timestamptz,
  -- provenance inline NOT NULL (FND-08): per-row, inherited from the source block.
  dataset       text not null,                           -- 'votacion' | 'lobby'
  origen        text not null,
  fecha_captura timestamptz not null default now(),
  enlace        text not null,
  licencia      text,                                    -- per-row; NULL unless source row carries one
  -- canonical orientation so (A,B)==(B,A): enforce extremo_a < extremo_b at write time.
  check (extremo_a < extremo_b),
  -- idempotency: one edge per (type, ordered pair, shared context)
  unique (tipo, extremo_a, extremo_b, contexto_clave)
);
alter table arista enable row level security;            -- DENY-BY-DEFAULT
revoke all on arista from anon, authenticated;
create index arista_extremo_a_idx on arista (extremo_a);
create index arista_extremo_b_idx on arista (extremo_b);
create index arista_tipo_idx      on arista (tipo);
```

**Enforcing "both endpoints confirmado" at materialization time (cleanest approach):** the proc only ever inserts an `entidad` row for parlamentarios that already appear with `estado_vinculo='confirmado'` in the source facts, and only joins confirmed-to-confirmed source rows. Because `arista.extremo_a/b` are FKs to `entidad`, and `entidad` is populated solely from confirmed identities, the FK itself becomes the structural guarantee — an edge **cannot** reference a non-confirmed node. Belt-and-suspenders: the proc's source query filters `estado_vinculo='confirmado'` on both sides before the INSERT.

### Materialization Proc Structure (pg_cron-invoked, idempotent)

Pattern reuses `0003_orchestration.sql`: a `security definer set search_path=''` plpgsql function in a `net` schema, scheduled with `cron.schedule` (with the same pg_cron-version guard `0003` already established), plus a post-migration `cron.job` existence assertion.

```sql
create schema if not exists net;

create or replace function net.materializar_aristas()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- 1) refresh node set: every parlamentario that appears confirmed in any source fact.
  insert into public.entidad (id, parlamentario_id, tipo)
  select p.id, p.id, 'parlamentario'
  from public.parlamentario p
  where exists (
    select 1 from public.voto v
    where v.parlamentario_id = p.id and v.estado_vinculo = 'confirmado'
  ) or exists (
    select 1 from public.lobby_audiencia a
    where a.parlamentario_id = p.id and a.estado_vinculo = 'confirmado'
  )
  on conflict (id) do nothing;

  -- 2) CO-VOTACION edges: two confirmed parlamentarios in the SAME votacion.
  --    Fact = "votaron en la misma votación X el DD/MM"; context = votacion_id (+ shared seleccion if equal).
  insert into public.arista (tipo, extremo_a, extremo_b, contexto_clave, contexto_detalle,
                             desde, hasta, dataset, origen, fecha_captura, enlace, licencia)
  select 'co_votacion',
         least(va.parlamentario_id, vb.parlamentario_id),
         greatest(va.parlamentario_id, vb.parlamentario_id),
         va.votacion_id,
         null,                       -- MVP: do NOT assert shared sense as a relation; just co-presence in the votación
         vo.fecha, vo.fecha,
         'votacion', vo.origen, now(), vo.enlace, null
  from public.voto va
  join public.voto vb on vb.votacion_id = va.votacion_id
                      and va.parlamentario_id < vb.parlamentario_id      -- ordered pair, no self, no dup
  join public.votacion vo on vo.id = va.votacion_id
  where va.estado_vinculo = 'confirmado' and vb.estado_vinculo = 'confirmado'
    and va.parlamentario_id is not null and vb.parlamentario_id is not null
  on conflict (tipo, extremo_a, extremo_b, contexto_clave) do nothing;

  -- 3) CO-LOBBY-CONTRAPARTE edges: two confirmed parlamentarios who each received an
  --    audiencia from the SAME contraparte. Fact = "ambos recibieron audiencia de la contraparte Y".
  --    contexto_clave = normalized contraparte name (lobby_contraparte is deny-by-default,
  --    but this proc is security definer and the contraparte NAME is already public per the
  --    lobby_de_parlamentario RPC projection).
  insert into public.arista (tipo, extremo_a, extremo_b, contexto_clave, contexto_detalle,
                             desde, hasta, dataset, origen, fecha_captura, enlace, licencia)
  select 'co_lobby_contraparte',
         least(aa.parlamentario_id, ab.parlamentario_id),
         greatest(aa.parlamentario_id, ab.parlamentario_id),
         lower(trim(ca.nombre)),
         ca.nombre,
         least(aa.fecha, ab.fecha), greatest(aa.fecha, ab.fecha),
         'lobby', aa.origen, now(), aa.enlace, null
  from public.lobby_audiencia aa
  join public.lobby_contraparte ca on ca.identificador = aa.identificador
  join public.lobby_contraparte cb on lower(trim(cb.nombre)) = lower(trim(ca.nombre))
  join public.lobby_audiencia ab on ab.identificador = cb.identificador
                                 and aa.parlamentario_id < ab.parlamentario_id
  where aa.estado_vinculo = 'confirmado' and ab.estado_vinculo = 'confirmado'
    and aa.parlamentario_id is not null and ab.parlamentario_id is not null
  on conflict (tipo, extremo_a, extremo_b, contexto_clave) do nothing;
end;
$$;

-- schedule (mirror 0003 version guard + post-migration cron.job assertion).
select cron.schedule('net-materializar-aristas', '17 3 * * *',  -- daily, off-peak
       $cron$ select net.materializar_aristas(); $cron$);
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'net-materializar-aristas') then
    raise exception 'cron job net-materializar-aristas no quedó registrado';
  end if;
end $$;
```

> **[ASSUMED]** that `voto`, `votacion`, `lobby_audiencia`, `lobby_contraparte` column names above (`parlamentario_id`, `votacion_id`, `estado_vinculo`, `origen`, `enlace`, `fecha`, `identificador`, `nombre`) match what was verified in `0009`/`0019`/`0021`. The voto/lobby column names ARE [VERIFIED: codebase — `0009`, `0019`, `0021`]; `votacion.origen`/`votacion.enlace`/`votacion.fecha` are [VERIFIED: codebase — used in `votos_de_parlamentario` RPC, `0019`]. The planner should confirm `votacion` PK is `id` (it is — `0019` joins `votacion vo on vo.id = v.votacion_id`).

**Idempotency note:** `ON CONFLICT ... DO NOTHING` on the natural-key unique makes a 2× run produce identical counts. If source rows can change (rare for historical facts), prefer `DO UPDATE` on provenance columns, or a `delete from arista where tipo = '...'` + reinsert per type inside the proc (still idempotent, simpler reasoning). Recommend `DO NOTHING` for MVP since votación/lobby facts are append-only.

### Recursive-CTE RPC Sketch (PII-safe, depth-bounded)

`security definer set search_path=''` (mirror `0020`/`0021`/`0025`). Returns nodes + edges for a bounded neighborhood. **Never emits `partido`/`rut`.** Bounded-by-node (CONTEXT discretion → "acotado es más sobrio").

```sql
create or replace function public.subgrafo_red(
  p_id    text,                     -- seed node (parlamentario id)
  p_depth int default 1,            -- HARD bound (clamp 1..2; never unbounded)
  p_tipos text[] default null,      -- edge-type filter (null = all allowed types)
  p_desde timestamptz default null, -- temporal window filter
  p_hasta timestamptz default null
)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with recursive bound as (select least(greatest(coalesce(p_depth,1),1),2) as d),  -- clamp depth 1..2
  walk as (
    select e.id as node_id, 0 as nivel from public.entidad e where e.id = p_id
    union
    select case when a.extremo_a = w.node_id then a.extremo_b else a.extremo_a end, w.nivel + 1
    from walk w
    join public.arista a on (a.extremo_a = w.node_id or a.extremo_b = w.node_id)
    where w.nivel < (select d from bound)
      and (p_tipos is null or a.tipo = any(p_tipos))
      and (p_desde is null or a.hasta is null or a.hasta >= p_desde)
      and (p_hasta is null or a.desde is null or a.desde <= p_hasta)
  ),
  nodos as (
    select distinct w.node_id from walk w
  ),
  aristas as (
    select a.* from public.arista a
    where a.extremo_a in (select node_id from nodos)
      and a.extremo_b in (select node_id from nodos)
      and (p_tipos is null or a.tipo = any(p_tipos))
      and (p_desde is null or a.hasta is null or a.hasta >= p_desde)
      and (p_hasta is null or a.desde is null or a.desde <= p_hasta)
  )
  select jsonb_build_object(
    'nodos', (
      -- PII-SAFE: id + public name ONLY. NEVER partido/rut. (mirror parlamentario_publico/0020)
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre', coalesce(nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)),''),
                           p.nombre_normalizado),
        'camara', p.camara
      )), '[]'::jsonb)
      from nodos n join public.parlamentario p on p.id = n.node_id
    ),
    'aristas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', a.tipo, 'a', a.extremo_a, 'b', a.extremo_b,
        'contexto', a.contexto_detalle, 'desde', a.desde, 'hasta', a.hasta,
        'dataset', a.dataset, 'origen', a.origen, 'enlace', a.enlace, 'licencia', a.licencia
      )), '[]'::jsonb)
      from aristas a
    )
  );
$$;
revoke execute on function public.subgrafo_red(text,int,text[],timestamptz,timestamptz) from public;
grant  execute on function public.subgrafo_red(text,int,text[],timestamptz,timestamptz) to anon;
```

**INVOKER vs DEFINER:** must be **`security definer`** (like `0020`/`0021`/`0025`) — `entidad`/`arista` are deny-by-default to anon, so an invoker function running as `anon` would read zero rows. DEFINER runs as owner, reads the tables, and projects only PII-safe columns. The `parlamentario` join inside the function also needs DEFINER (partido/rut are deny-by-default; the function reads the master but emits only `id`/`nombre`/`camara`). [VERIFIED: codebase — exact rationale stated in `0019` header for `rebeldias_de_parlamentario`.]

**Depth bound is non-negotiable:** clamp `p_depth` to `1..2` in-SQL. An unbounded recursive walk on a dense co-votación graph (every pair in a votación is an edge → cliques) is both a performance hazard and an insinuation hazard (deep paths read as chains). Keep it shallow.

> **[ASSUMED] co-votación density warning:** every votación with N confirmed voters produces N·(N−1)/2 co-vote edges. A 155-deputy roll-call = ~12,000 edges for a single votación. Across thousands of votaciones this is **millions of rows** and a hairball graph. **The planner MUST address this** (see Pitfalls). Options: (a) only edge pairs who voted the SAME way (still huge), (b) aggregate — one edge per pair carrying a count of shared votaciones (collapses the multigraph; but a count edge drifts toward "closeness score" → anti-insinuación risk), (c) restrict co-votación edges to a bounded recent window, (d) drop co-votación from the MVP taxonomy and ship only co-lobby-contraparte (far sparser, far more defensible as a discrete fact). **Recommendation: ship co-lobby-contraparte as the primary edge; treat co-votación as discretionary and, if included, bound it hard (per-votación, depth-1, never aggregated into a weight).**

### xyflow Client-Island Integration Steps (NET-02)

1. **Install in `app/` only:** `npm install @xyflow/react@12.11.0`. [VERIFIED: npm — version, peer `react>=17`]
2. **Route is a Server Component that gates first:**
   ```tsx
   // app/app/red/page.tsx  (RSC — NO 'use client' here)
   import { notFound } from "next/navigation";
   import { netPublicEnabled } from "@/lib/net-gate";
   import { createServerSupabase } from "@/lib/supabase";
   import { RedGraph } from "@/components/red/red-graph";

   export default async function RedPage() {
     if (!netPublicEnabled(process.env)) notFound();   // FIRST statement (mirror contraparte/[id])
     const sb = createServerSupabase();
     const { data, error } = await sb.rpc("subgrafo_red", { p_id: /* seed */, p_depth: 1 });
     if (error) throw new Error(`subgrafo_red falló: ${error.message}`);
     return <RedGraph subgrafo={data} />;            // pass plain JSON props to the island
   }
   ```
3. **The graph itself is the ONLY `'use client'` file** — this is the bundle-isolation boundary:
   ```tsx
   // app/components/red/red-graph.tsx
   "use client";
   import { ReactFlow, ReactFlowProvider, Background, Controls } from "@xyflow/react";
   import "@xyflow/react/dist/style.css";   // REQUIRED — without it nodes/edges are unstyled [CITED: reactflow.dev]
   // map subgrafo JSON → nodes/edges; controlled state via useNodesState/useEdgesState;
   // custom node = sober ES label (nombre + cámara, NO partido/photo);
   // custom edge = typed-fact copy + time window; Radix tooltip = provenance.
   ```
4. **SSR boundary:** the route renders on the server, but `@xyflow/react` measures DOM, so the island hydrates on the client. v12 supports SSR if you provide node `width`/`height` and `handles` ([CITED: reactflow.dev/learn/advanced-use/ssr-ssg-configuration]). For an interactive explorer you do **not** need server-rendered graph HTML — render the island client-side after hydration; the RSC supplies the data as props. If a flash-of-unstyled is a concern, you may `next/dynamic` import with `ssr: false`, but that's optional and not required.
5. **Bundle isolation guarantee:** because `@xyflow/react` is imported **only** inside `'use client'` files under `app/components/red/` and the route, Next.js code-splits it into the `/red` route chunk. It will **not** appear in the server bundle of `/`, `/proyecto/[boletin]`, `/parlamentario/[id]`, `/buscar`, `/agenda`, `/parlamentarios`, or `/contraparte/[id]`. Verify with a build-size check after wiring (see Pitfalls). [VERIFIED: Next.js App Router code-splits client components per-route — standard behavior]
6. **Controlled vs uncontrolled:** use **controlled** (`useNodesState`/`useEdgesState`) so filters by tipo/tiempo re-derive the visible node/edge set from the RPC payload deterministically. Filters operate client-side over the already-fetched bounded subgraph (sober, no extra round-trips), or re-call `subgrafo_red` with `p_tipos`/`p_desde`/`p_hasta` for server-side filtering (cleaner — keeps the "both confirmado / PII-safe" invariant server-side). Recommend **server-side filter params** on the RPC; client filters only toggle visibility of already-returned edges.
7. **Custom node/edge for anti-insinuación copy:** custom node renders `nombre` + `cámara` only — **no partido, no photo, no score badge**. Custom edge label is the typed fact ("votaron en la misma votación del DD/MM" / "ambos recibieron audiencia de Y"), never an affinity word. Provenance (origen/fecha/enlace/licencia) lives in the Radix tooltip, per edge.

### Gate Wiring (`net-gate.ts` — exact mirror of `money-gate.ts`)

```ts
// app/lib/net-gate.ts
import "server-only";   // line 1 — flag never reaches the browser bundle (mirror money-gate.ts:1)

/**
 * Candado B (presentación) del doble candado NET. Default OFF (fail-closed):
 * solo el literal "true" enciende; undefined/""/"false"/"1"/"TRUE" => false.
 * Sin prefijo NEXT_PUBLIC_. Encender requiere 17-LEGAL-DOSSIER signoff: approved (deuda F17).
 */
export function netPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NET_PUBLIC_ENABLED === "true";
}
```
[VERIFIED: codebase — exact structure of `money-gate.ts`; `contraparte/[id]/page.tsx` shows the route-level `if (!moneyPublicEnabled(process.env)) notFound();` as the FIRST statement]

**Honest-state vs `notFound()`:** the contraparte route uses `notFound()` (serves `not-found.tsx`) — clean for a route that shouldn't exist while OFF. For `/red`, `notFound()` is the simplest mirror. If the Phase-19 design wants an honest "esta sección aún no está disponible" state instead of a 404, render that server-side after the gate check; either is acceptable per CONTEXT ("`notFound()` o honest-state"). **Recommend `notFound()`** for exact parity with MONEY and zero new copy surface while gated.

### Anti-Patterns to Avoid
- **On-the-fly edge computation in the RPC.** Locked: materialization by pg_cron. The RPC reads materialized `arista`, it does not compute edges.
- **Aggregating co-votación into a per-pair weight/count.** A "voted together N times" number is a de-facto closeness score → anti-insinuación violation. If co-votación ships, keep edges discrete and per-votación.
- **Force-directed / spring layout that visually clusters "close" nodes.** Clustering reads as affinity. Prefer a neutral layout (e.g. deterministic grid/dagre by camara, or simple manual positions); never a physics sim that implies gravitational closeness.
- **Putting `@xyflow/react` import in a shared/server file.** Bloats every route's bundle. Keep it strictly under `'use client'` files in `app/components/red/`.
- **`licencia text default 'CC BY 4.0'` on `entidad`/`arista`.** Wrong attribution (17-DOSSIER §6). License is per-row, NULL unless the source row carries one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph traversal / neighborhood | Custom recursion in TS over fetched edges | Postgres `WITH RECURSIVE` in the RPC | Keeps the bound + PII filter server-side; one round-trip; mirrors codebase RPC pattern |
| Graph rendering / pan/zoom/edges | Hand-rolled SVG/canvas | `@xyflow/react@12` | Locked dep; handles viewport, edges, custom nodes, controlled state |
| Exposure flag parsing | `Boolean(env.X)` truthiness | `netPublicEnabled()` (strict `=== "true"`) | Lax truthiness lets `"false"` through; fail-closed is the whole point |
| Provenance popover | Custom tooltip | `@radix-ui/react-tooltip` (already installed) | Accessible, already a dep |
| Both-endpoints-confirmado guarantee | App-layer validation | FK to `entidad` (confirmed-only) + proc filter | Structural invariant beats runtime checks |

**Key insight:** every hard part of NET already has a precedent in this repo — deny-by-default RLS (0018/0021/0022), security-definer PII-safe RPC (0019/0020/0025), pg_cron scheduling with version-guard + existence assertion (0003), and the server-only fail-closed gate (money-gate.ts). NET is **composition of existing patterns**, not new infrastructure. The genuinely new work is the **edge taxonomy decision** (legal, below) and the **xyflow client island** (mechanical, above).

## Edge Taxonomy Under Anti-Insinuación (THE legal crux — be conservative)

The 17-DOSSIER §2 nuclear risk is **composition-as-accusation**. The taxonomy is where that risk is won or lost. Each edge must be a **discrete, typed, sourced, time-windowed public fact** whose copy describes the fact and nothing more.

### INCLUDE (defensible as descriptive public facts)

| Edge type | Fact it states | Source + window | Why defensible | Recommendation |
|-----------|----------------|------------------|----------------|----------------|
| `co_lobby_contraparte` | "ambos recibieron audiencia de la contraparte Y" | lobby_audiencia + lobby_contraparte; window = the two audiencia dates | A discrete, individually-published fact (each audiencia is public on leylobby). Sparse → no hairball. The shared object (contraparte Y) is named and sourced. No sense/affinity asserted. | **PRIMARY edge of the MVP.** Ship this. |
| `co_votacion` | "votaron en la misma votación X el DD/MM" | voto + votacion; window = the votación date | Each votación is public/nominal. BUT density is extreme (cliques per roll-call) and risks reading as a voting-bloc/affinity. | **DISCRETIONARY.** If included: per-votación discrete edges only, depth-1, **never** aggregated into a weight, hard-bounded count, possibly recent-window-only. If density can't be tamed soberly, **EXCLUDE from MVP**. |

### EXCLUDE (only make sense as insinuation, or are locked out)

| Excluded thing | Why excluded |
|----------------|--------------|
| Any **money-derived edge** (shared contratista/donante) | DOUBLE-gated (NET + MONEY); MONEY is gated OFF. Out of scope this phase (CONTEXT deferred). |
| **Affinity / "closeness" / "aligned-with" edge** | No source fact says it; it's pure inference of relation. PROHIBITED (CONTEXT). |
| **Weighted "voted together N times" edge** | A weight is a de-facto closeness score → suspicion-score-by-the-back-door. PROHIBITED. |
| **Path / chain edge** ("A → lobby → contrato → B") | The canonical accusation structure (17-DOSSIER §2). No path-finding as a feature (CONTEXT). |
| **LLM-inferred edge** | Permanently PROHIBITED (CONTEXT deferred; 17-DOSSIER §4). Only verifiable-source edges. |
| **Shared-committee / co-sponsorship edge** | Not in the already-populated source blocks NET consumes; would be new ingest (out of scope). Also drifts toward "they work together" affinity reading. |
| **Sense-of-vote as a relation** (both voted "sí") | 17-DOSSIER §3/N3 flags shared vote-sense as a composition that intensifies imputative reading; the asesor may require hiding it. MVP co-votación edge carries `contexto_detalle = null` (co-presence in the votación, not shared sense). |

**Final recommended taxonomy:** **`co_lobby_contraparte` (ship) + `co_votacion` (discretionary, hard-bounded or dropped).** This is the minimum defensible set. Everything else is excluded by construction. The `check (tipo in (...))` constraint in `arista` codifies the allow-list — adding a type later requires a migration, which is the right friction.

## Common Pitfalls

### Pitfall 1: Migration numbering + remote schema_migrations drift
**What goes wrong:** Last applied migration is **0028**; **0029 is the votos pgTAP** (a test, not a forward migration) → NET DDL must start at **0030**. Separately, the remote `schema_migrations` table has **drift** (registers only up to 0025), so `supabase db push` will mis-compute what to apply and can re-run or skip.
**How to avoid:** Number NET `0030_net.sql` (+ `0031_net.test.sql` pgTAP). **Apply by direct `psql`/`--db-url`, NOT `supabase db push`** — same path used for 0018–0028 (the `.env` BOM also breaks the CLI; pass `--db-url` explicitly). [VERIFIED: codebase — every migration header 0019–0025 states this exact operator-checkpoint convention; CONTEXT confirms drift + 0030 start.]
**Warning signs:** `supabase db push` proposing to re-apply 0026/0027/0028, or build/typecheck "passing" while Postgres never ran the DDL (false positive — pgTAP against an applied schema is the only real proof).

### Pitfall 2: Co-votación edge explosion (millions of rows, hairball)
**What goes wrong:** N confirmed voters in a votación → N·(N−1)/2 edges. A full roll-call is ~12k edges; thousands of votaciones → millions of `arista` rows and an unreadable graph that itself looks like a conspiracy web (the exact insinuation the dossier fears).
**How to avoid:** Prefer `co_lobby_contraparte` (sparse) as primary. If co-votación ships: bound it (recent window, or specific high-salience votaciones), keep edges discrete per-votación, NEVER aggregate into a weighted "together count" (that's a closeness score). Index `arista` and clamp RPC depth to 1–2. Consider dropping co-votación from MVP entirely. [ASSUMED — arithmetic from roster sizes; planner must decide.]

### Pitfall 3: xyflow leaking into server bundles
**What goes wrong:** importing `@xyflow/react` (≈1.2 MB unpacked) anywhere a Server Component can pull it bloats every route.
**How to avoid:** import it **only** inside `'use client'` files under `app/components/red/`. Run a post-wire build-size check; confirm the xyflow chunk appears only in the `/red` route. [VERIFIED: npm size 1.2MB; Next App Router per-route code-splitting is standard.]

### Pitfall 4: PII leak through the RPC (partido/rut)
**What goes wrong:** the recursive-CTE RPC joins `parlamentario`; a careless `select *` emits `partido` (sensitive — afiliación política, Ley 21.719) or `rut`.
**How to avoid:** project **only** `id`/`nombre`/`camara` in the `nodos` jsonb (mirror `parlamentario_publico`/0020). pgTAP introspects the function body and asserts no `partido`/`rut` reaches anon (same test style as 0020/0026). [VERIFIED: codebase — 0019/0020 establish this exact discipline + pgTAP assertion.]

### Pitfall 5: Gate not fail-closed / leaking DOM while OFF
**What goes wrong:** rendering any heading/HTML before the gate check leaks NET DOM to crawlers; lax flag parsing lets `"false"` through.
**How to avoid:** `if (!netPublicEnabled(process.env)) notFound();` as the **first statement** of the RSC (before `await params`, before any RPC/heading) — exact mirror of `contraparte/[id]/page.tsx`. Strict `=== "true"`. Test asserts default OFF. [VERIFIED: codebase — money-gate.ts + contraparte route.]

### Pitfall 6: pg_cron version / sub-minute + silent non-scheduling
**What goes wrong:** scheduling fails silently → `arista` never materializes, no signal.
**How to avoid:** daily schedule (`'17 3 * * *'`) is standard 5-field cron (no sub-minute needed, so no 1.5 guard required — but reuse 0003's guard idiom defensively). Add a post-migration `do $$ ... raise exception if not exists in cron.job $$;` assertion (mirror 0003). [VERIFIED: codebase — 0003 establishes both the version guard and the existence assertion.]

### Pitfall 7: OpenNext / Cloudflare Workers build with xyflow
**What goes wrong:** a client-only lib with a node-only dependency could break the `opennextjs-cloudflare build`.
**How to avoid:** `@xyflow/react` is browser-only (DOM measurement, SVG) with peer deps only on react/react-dom — **no node-only deps**, so as a client island it should build clean on OpenNext/Workers. Deploy is **Linux/Docker only** (Windows OpenNext yields 500s per project memory). Since NET ships gated OFF, the redeploy exposes nothing (route 404s). Confirm the build passes after install. [VERIFIED: npm peerDeps = react/react-dom only; deploy constraint from project memory + CONTEXT.]

### Pitfall 8: CC BY 4.0 over-attribution
**What goes wrong:** labeling the whole graph or the `arista` table CC BY 4.0.
**How to avoid:** `licencia` is per-row, NULL unless the source row carries one. In the MVP taxonomy, **neither co-vote nor co-lobby derives from InfoProbidad**, so no edge carries CC BY 4.0 — co-vote = Cámara/Senado attribution, co-lobby = leylobby attribution. CC BY 4.0 only appears if/when an InfoProbidad-derived node/edge is added later. [VERIFIED: codebase — 0022 `licencia default 'CC BY 4.0'` is InfoProbidad-specific; 17-DOSSIER §6 table.]

## Runtime State Inventory

> NET is greenfield within an existing schema (new tables + proc + RPC + route). It is a refactor only in the sense of consuming existing data. Relevant runtime-state checks:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `arista`/`entidad` are NEW tables, initially empty. Materialization populates them from `voto`/`votacion`/`lobby_*` (already populated). | Run `net.materializar_aristas()` once after migration (operator), then pg_cron maintains. |
| Live service config | New pg_cron job `net-materializar-aristas` registered IN the migration (not clicked in dashboard). `schema_migrations` remote drift (registers ≤0025). | Apply 0030 by direct psql `--db-url`, NOT `supabase db push`. Verify cron.job row exists (assertion). |
| OS-registered state | None — no OS-level registrations. | None. |
| Secrets/env vars | New env var `NET_PUBLIC_ENABLED` (default absent → OFF). No prefix `NEXT_PUBLIC_`. Not in git (.env). | Operator does NOT set it until F17 `signoff: approved`. |
| Build artifacts | New `app/` dep `@xyflow/react` → `package-lock.json` changes; new `/red` route chunk. | `npm install` in `app/`; rebuild on Linux/Docker for deploy. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron | Materialization schedule | ✓ | in use since 0003 | — |
| Postgres recursive CTE | subgrafo RPC | ✓ | Postgres 15+ | — |
| `@xyflow/react` | Graph UI | ✗ (not installed) | 12.11.0 (target) | none needed — `npm install` |
| Linux/Docker (obsbuild) + wrangler | Deploy | ✓ (operator env) | — | Windows OpenNext = 500s (memory) → must build on Linux |
| Remote Supabase (sa-east-1) write via `--db-url` | Apply 0030 | ✓ | — | direct psql (NOT `supabase db push`) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `@xyflow/react` — install it (mechanical).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.6 (RTL) for UI; pgTAP for SQL |
| Config file | `app/` Vitest (jsdom 29); pgTAP under `supabase/tests/` |
| Quick run command | `cd app && npm run test` (vitest run) |
| Full suite command | `cd app && npm run test && npm run typecheck` + pgTAP via `--db-url` against applied schema |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NET-01 | anon cannot read `entidad`/`arista` directly | pgTAP | `0031_net.test.sql` (mirror 0021 deny-by-default asserts) | ❌ Wave 0 |
| NET-01 | every `arista` has both endpoints confirmado + provenance + window | pgTAP | introspect proc / assert constraints | ❌ Wave 0 |
| NET-01 | `subgrafo_red` never emits partido/rut; depth-bounded | pgTAP | introspect function body (mirror 0020/0026 no-PII assert) | ❌ Wave 0 |
| NET-02 | `netPublicEnabled` default false; strict `"true"` | vitest | `app/lib/net-gate.test.ts` (mirror money-gate.test.ts) | ❌ Wave 0 |
| NET-02 | `/red` 404s when gate OFF; no NET DOM leaked | vitest RTL | `app/app/red/page.test.tsx` (mirror contraparte page.test) | ❌ Wave 0 |
| NET-02 | RedGraph renders nodes without partido/photo/score; provenance tooltip | vitest RTL | `app/components/red/red-graph.test.tsx` | ❌ Wave 0 |
| anti-insinuación | copy has zero score/causal/affinity words; no path-as-feature | grep negative-match | CI grep over `app/` NET files | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd app && npm run test`
- **Per wave merge:** `cd app && npm run test && npm run typecheck` + pgTAP against applied schema
- **Phase gate:** full suite green + tsc clean + Linux redeploy (no NET exposed) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `supabase/migrations/0030_net.sql` — entidad/arista + proc + cron + RPC
- [ ] `supabase/tests/0031_net.test.sql` — pgTAP (deny-by-default, both-confirmado, no-PII, depth-bound)
- [ ] `app/lib/net-gate.ts` + `app/lib/net-gate.test.ts`
- [ ] `app/app/red/page.tsx` + `page.test.tsx` + (optional) `not-found.tsx`
- [ ] `app/components/red/red-graph.tsx` (`'use client'`) + custom node/edge + tests
- [ ] `npm install @xyflow/react@12.11.0` in `app/`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Public read-only via anon RPC; no auth surface added |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS deny-by-default on `entidad`/`arista`; `security definer` RPC as the only public channel; revoke from public + grant exact signature to anon (mirror 0020/0021/0025) |
| V5 Input Validation | **yes** | RPC params (`p_id`, `p_depth`, `p_tipos`, dates) validated/clamped in-SQL; route validates id before DB (mirror contraparte `CONTRAPARTE_ID_RE`) |
| V6 Cryptography | no | No new secrets beyond the env flag (server-only, no NEXT_PUBLIC_) |

### Known Threat Patterns for NET
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII leak (partido/rut) through graph RPC | Information Disclosure | DEFINER + project only id/nombre/camara; pgTAP asserts no-PII |
| Edge/path read as accusation | Information Disclosure / Repudiation | Typed-fact copy, time window, no score, no path-finding, conservative taxonomy |
| Exposure before sign-off (gate bypass) | Elevation of Privilege | Double candado: RLS (data) + fail-closed flag (presentation); flag default OFF, strict `"true"` |
| Recursive-CTE DoS (deep/unbounded walk) | Denial of Service | Clamp depth 1..2; bounded-by-node subgraph; indexed edges |
| Enumeration of all nodes via seedless RPC | Information Disclosure | Require a seed `p_id` (bounded-by-node); do NOT ship a "whole graph" / listing RPC to anon (mirror WR-03 deferral in 0025) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-flow-renderer` | `@xyflow/react` (v12) | xyflow rebrand (v12, 2024) | Use the `@xyflow/react` scope; v12 adds SSR/SSG support and React 19 compat |
| Graph DB (Neo4j etc.) for relationships | Recursive CTE over relational tables | n/a (locked decision) | No new infra; traversal in SQL; bounded + PII-filtered server-side |

**Deprecated/outdated:**
- `react-flow-renderer` (old package name) → `@xyflow/react`.
- Aggregated/weighted relationship edges as a graph feature → excluded here for anti-insinuación reasons (not a deprecation, a deliberate exclusion).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `votacion.origen`/`enlace`/`fecha` and `voto.estado_vinculo`/`parlamentario_id`/`votacion_id` are the exact column names for the materialization joins | Materialization Proc | Proc fails to compile; planner re-checks 0008/0009/0019 schema (most are already VERIFIED) |
| A2 | Co-votación edge density is prohibitive (millions of rows) at full scale | Pitfall 2, RPC warning | If wrong (e.g. few votaciones ingested), co-votación is cheaper than feared; planner can include it more freely |
| A3 | `@xyflow/react` has no node-only deps and builds clean on OpenNext/Workers as a client island | Pitfall 7 | Build break on deploy; mitigated by gated-OFF (no exposure) + Linux build verification |
| A4 | `notFound()` (vs honest-state) is the preferred OFF behavior for `/red` | Gate Wiring | Cosmetic; CONTEXT allows either; Phase-19 design may prefer honest-state |
| A5 | Normalizing contraparte name by `lower(trim())` is a sufficient join key for co-lobby edges | Materialization Proc | Name variants split/merge edges; planner may need a stronger contraparte key (lobby_contraparte has no stable id in P11) |
| A6 | slopcheck clean for `@xyflow/react` (CLI couldn't emit JSON; judged by official-org + npm presence) | Package Legitimacy Audit | Negligible — household-name library, official xyflow org |

## Open Questions

1. **Include co-votación at all?**
   - What we know: defensible as a discrete fact, but density is extreme and reads as a bloc.
   - What's unclear: whether the data volume already ingested makes it tractable; whether design can render it soberly.
   - Recommendation: ship `co_lobby_contraparte` first; treat `co_votacion` as discretionary, and if included, hard-bound it (per-votación, depth-1, never aggregated). Defer-able without missing NET-01/02.

2. **Bounded-by-node seed for `/red`.**
   - What we know: bounded-by-node is more sober (CONTEXT discretion) and avoids a whole-graph enumeration surface.
   - What's unclear: what the default seed is when a user lands on `/red` with no selection.
   - Recommendation: require a selected parlamentario (e.g. `/red?seed=D###` or a picker); do NOT ship a seedless "whole graph" RPC to anon (mirror WR-03 listing-deferral in 0025).

3. **Contraparte join key stability.**
   - What we know: `lobby_contraparte` has no authoritative `contraparte_id` in P11 (it's NULL by design).
   - What's unclear: whether `lower(trim(nombre))` over-merges/under-merges contrapartes.
   - Recommendation: use normalized name for MVP; document it as the known limitation; a future authoritative contraparte registry (NET could attach by exact id) tightens it.

## Sources

### Primary (HIGH confidence)
- Codebase: `app/lib/money-gate.ts`, `app/app/contraparte/[id]/page.tsx`, `supabase/migrations/0003_orchestration.sql`, `0019_voto_asistencia_y_ficha.sql`, `0020_parlamentario_publico.sql`, `0021_lobby.sql`, `0022_probidad.sql`, `0025_agregacion.sql`, `0026_parlamentarios_publico_listado.sql`, `app/package.json` — all patterns NET mirrors.
- `.planning/phases/18-.../18-CONTEXT.md` + `.planning/phases/17-.../17-LEGAL-DOSSIER.md` — locked decisions + nuclear-risk framing.
- npm registry: `npm view @xyflow/react` → version 12.11.0, peerDeps `react: >=17`, unpackedSize ≈1.2MB. [VERIFIED 2026-06-21]

### Secondary (MEDIUM confidence)
- [React Flow SSR/SSG docs](https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration) — v12 SSR (width/height/handles), required CSS import.
- [@xyflow React Flow 12 release discussion](https://github.com/xyflow/xyflow/discussions/3764) — v12 = `@xyflow/react`, SSR support.
- [Supabase pg_cron docs](https://supabase.com/docs/guides/database/extensions/pg_cron) + [Supabase Cron blog](https://supabase.com/blog/supabase-cron) — scheduling plpgsql procs, `cron.job_run_details` monitoring.

### Tertiary (LOW confidence)
- Co-votación edge-count arithmetic (A2) — derived, not measured against the live DB.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep verified (codebase + npm registry).
- Architecture (data model / proc / RPC / gate): HIGH — direct mirrors of applied migrations (0003/0019/0020/0021/0025) and the live money-gate.
- xyflow integration: HIGH on facts (version/peers/CSS/client-island); MEDIUM on the optional SSR nuances (not needed for an interactive explorer).
- Edge taxonomy / anti-insinuación: MEDIUM — the conservative include/exclude is well-reasoned from the dossier, but legal sufficiency is explicitly the asesor's call (F17), not this phase's to assert.
- Pitfalls: HIGH — sourced from codebase headers (migration numbering, BOM/`--db-url`, PII-safe RPC, cron assertion) + one ASSUMED density arithmetic.

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable; xyflow minor versions move but 12.x API is stable; recheck if React 20 lands)

## RESEARCH COMPLETE
