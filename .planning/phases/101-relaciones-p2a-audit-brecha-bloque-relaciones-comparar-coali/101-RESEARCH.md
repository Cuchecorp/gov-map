# Phase 101: RELACIONES P2a — Audit brecha + bloque relaciones + /comparar + coalición empírica - Research

**Researched:** 2026-07-24
**Domain:** Next.js 16 App Router (server components + searchParams) · Supabase secure RPCs (0060/0061 pattern) · anti-insinuación linter · pgTAP · dos-etapas R2 (coalición probe)
**Confidence:** HIGH (all data-reality claims verified via live psql against PROD; all code claims verified by reading source; coalición desk-research MEDIUM)

## Summary

Phase 101 is almost entirely **re-composition + one new route + one new secure RPC**, not net-new architecture. The four cross-link RPCs (`copartidarios_de_parlamentario`, `de_la_misma_zona`, `co_comisionados_de_parlamentario`, `coautores_de_parlamentario`) already exist in PROD (0060 hardened by 0061 with `total_n`), are already mounted at the END of the ficha content column (`page.tsx:283-294`), and already carry every anti-insinuación lock (leyenda verbatim, orden neutral, límite visual 8, honest total_n, WR-01/02/05, `return null` on empty). REL-02 moves those four blocks up into a `<section id="relaciones">` wrapper with a 2×2 grid — the internal component (`CrossLinkBloque`) stays byte-intact.

**Two decisive data-reality findings from live PROD (both change the plan):**
1. **`de_la_misma_zona` is DEAD for the Cámara.** All 155 diputados have `distrito` = NULL, `region` = NULL, `circunscripcion` = NULL. Only the 31 senators have `circunscripcion`. The "De la misma zona" block therefore returns 0 for every diputado (100% of the Cámara). This is a headline audit finding (REL-01) and forces an honest coverage declaration on the zona eje (or its de-facto senator-only scope).
2. **Militancia histórica compartida is real and substantial (696 net-new pairs)** but **cannot be intersected via the existing `militancias_de_parlamentario` RPC** because that RPC emits the *display* `partido` string, and `partido` ≠ `partido_alias` (35 distinct displays vs 35 aliases, but ≥3 parties map one display to two aliases). Correct pairwise matching must key on `partido_alias`, which is only reachable via a **NEW security-definer RPC** (`militancia_historica_compartida`) following the 0061 pattern. REL-04 militancia is GO.

**REL-04 lobby-misma-contraparte:** the CONTEXT assumption ("`contraparte_id` confirmadas") is **factually wrong** — `lobby_contraparte.contraparte_id` is **100% NULL** (0 distinct non-null of 17 681 rows); identity resolution for contrapartes never ran. A *name-based* fallback yields 3 749 pairs / 136 parlamentarios, and the top shared counterparts are substantive advocacy orgs/companies (CGE, Cámara Chilena de la Construcción, foundations) — NOT generic ministries. This is a real signal but requires name-normalization (`cge` / `cge s.a` / `cge s.a.` fragment) and is **weaker provenance** than an ID match. Recommendation: the audit (Plan 01) decides; default to **DIFERIDA with documented name-based query** unless the operator accepts name-match provenance, because shipping a "same counterpart" relation on unresolved names risks conflation.

**REL-05 coalición:** desk-research found Servel formalized 5 pactos for the 2025 parliamentary election (official, servel.cl + datos.gob.cl CSV). Comités del Senado live on `sitio.senado.cl` (301 redirect from `www.senado.cl`; the endpoint refused a plain fetch → needs the in-phase curl/BrowserOS probe). The probe runs IN-PHASE; this research supplies candidate URLs + the two-etapas R2 pattern.

**Primary recommendation:** Plan 01 = the audit (`101-AUDIT-RELACIONES.md`, mirror 93) running the verbatim psql queries below AND the coalición probe; it GATES the UI plans. Plan 02 = REL-02 re-composition (move 4 blocks into `<section id="relaciones">`) + Wave 0 linter surfaces. Plan 03 = `/comparar` route + the NEW `militancia_historica_compartida` RPC (0067) + optional co-autoría-boletines-compartidos RPC for the "proyectos en común con enlace" requirement.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brecha audit (REL-01) N/M counts | Database (psql direct) | Doc artifact | Coverage truth must come from psql -tA against PROD, NOT PostgREST (cap 1k underestimates) — Pitfall 4 precedent 93 |
| Relaciones block wrapper (REL-02) | Frontend Server (RSC) | — | Pure re-composition of already-mounted server components; zero new data channel |
| `/comparar` route (REL-03) | Frontend Server (RSC, force-dynamic) | Database (RPCs) | searchParams read server-side, intersection computed server-side from RPC reads |
| Militancia histórica compartida (REL-04) | Database (new secdef RPC) | Frontend Server | Pairwise match on `partido_alias` (internal) — must live in a secdef RPC, never in the client |
| Lobby misma contraparte (REL-04) | Database (audit query) | — | Blocked on identity resolution (`contraparte_id` NULL); audit-gated |
| Coalición ingest (REL-05) | Deno connector (two-stage R2) | Database | Source→R2 crudo→Supabase; runs as GH Actions/local, not Edge (probe first) |
| Anti-insinuación guard extension | Test tier (vitest) | — | Wave 0, source-scan guard, BEFORE any new copy lands |

## Standard Stack

No net-new libraries. Everything is already vendored and in use.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x App Router | `/comparar` route, RSC | [VERIFIED: app/AGENTS.md + page.tsx] existing ficha uses exact pattern (force-dynamic, searchParams Promise) |
| React | 19.2 | Server Components | [VERIFIED: codebase] |
| @supabase/supabase-js | v2 | `createServerSupabase()` + `.rpc()` | [VERIFIED: app/lib/supabase used throughout page.tsx] |
| vitest | (existing) | anti-insinuación guard + component tests | [VERIFIED: anti-insinuacion-guard.test.ts] |
| pgTAP | (Supabase) | RPC schema/ACL verification vs applied schema | [VERIFIED: supabase/tests/0061_*.test.sql] |

### Supporting (coalición REL-05 only, IF probe viable)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cheerio | npm:cheerio@1.2.0 | parse comités del Senado HTML / `__NEXT_DATA__` | IF senado comités page is HTML/SSR |
| fast-xml-parser | npm:fast-xml-parser@5 | parse Servel XML if any | IF servel exposes XML |
| @aws-sdk/client-s3 | v3 | write crudo to R2 (etapa 1) | dos-etapas LOCKED |

**Installation:** none — all imports are direct (`npm:`) in Deno connectors; app deps already present.

## Package Legitimacy Audit

Not applicable — Phase 101 installs **zero** new packages. All libraries are already vendored (`app/package.json`) or Deno direct-imports already used by existing connectors (cheerio, fast-xml-parser, @aws-sdk/client-s3 per CLAUDE.md stack). No registry install occurs in this phase.

## Runtime State Inventory

> Phase 101 is additive (new route, new RPC, wrapper re-composition) — no rename/refactor of stored keys. This section is included because the coalición probe (REL-05) *may* add ingest.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None renamed. New RPC `militancia_historica_compartida` reads existing `parlamentario_militancia` (363 rows) — no schema change. | none |
| Live service config | Coalición (REL-05) IF viable: new R2 prefix `servel/pactos/…` or `senado/comites/…` content-addressed. No existing config touched. | R2 write only if probe passes |
| OS-registered state | None. No cron changes in this phase (coalición ingest, if any, is backfill=LOCAL per CLAUDE.md convention 4). | none |
| Secrets/env vars | `SUPABASE_DB_URL` (audit queries), `SUPABASE_SECRET_KEY` (site RPCs), R2 creds (only if coalición ingest). All already present. | none |
| Build artifacts | New migration `0067_militancia_historica_compartida.sql` + pgTAP `supabase/tests/0067_*.test.sql`. New allowlist entry in `lockdown-guard.test.ts`. | apply migration via psql; add allowlist entry (else Direction-A guard fails) |

**Nothing found in categories requiring migration of existing records** — verified: the new RPC is read-only over unchanged tables.

## Architecture Patterns

### System Data Flow

```
REL-01 AUDIT (Plan 01):
  psql -tA "$SUPABASE_DB_URL"  ──▶  N/M matrix + coalición probe  ──▶  101-AUDIT-RELACIONES.md
       (PGCLIENTENCODING=UTF8)          (curl/BrowserOS)                  │ gates ▼

REL-02 FICHA (Plan 02):
  page.tsx  ──move──▶  <section id="relaciones" mt-12>
                          ├─ <h2> "Relaciones con otros parlamentarios"
                          ├─ group legend (LEYENDA_CROSS_LINK verbatim)
                          └─ grid grid-cols-1 md:grid-cols-2 gap-4
                               ├─ <Suspense> CrossLinkCopartidarios  (INTACT)
                               ├─ <Suspense> CrossLinkMismaZona      (INTACT, ⚠ 0 for diputados)
                               ├─ <Suspense> CrossLinkCoComisionados (INTACT)
                               └─ <Suspense> CrossLinkCoautores      (INTACT)
                          [+ optional 5th: militancia histórica — IF audit sustains]

REL-03 /comparar (Plan 03):  force-dynamic route
  searchParams {a,b} ─canonicalize alfabético─▶ two selectors (parlamentarios_publico_v2)
       │
       ├─ read militancias_de_parlamentario(a), (b)   → BUT intersect via NEW RPC (alias)
       ├─ read comisiones_de_parlamentario(a), (b)    → intersect by nombre (server) ✓
       ├─ read coautores_de_parlamentario(a)          → look up b.id → n_proyectos ✓
       │      └─ IF "proyectos en común con enlace" wanted → NEW RPC returns boletines
       └─ zona: compare circunscripcion/distrito from parlamentario_publico_v2 (⚠ diputados NULL)
       ▼
  side-by-side A/B table per axis + factual intersection line + fuente/fecha per datum

REL-04/05 (Plan 03 / conditional):
  militancia_historica_compartida(p_id) [NEW 0067, secdef, alias-keyed]  → 5th ficha block + comparar axis
  lobby-misma-contraparte → DIFERIDA (contraparte_id NULL) unless operator accepts name-match
  coalición → probe result decides ingest vs DIFERIDA
```

### Pattern 1: Secure RPC (0061 mold — VERBATIM for the new 0067)
**What:** security-definer, `set search_path = ''`, schema-qualified names, `p_id` parametrized, LIMIT bounded, `count(*) over ()` as `total_n`, DROP-before-create, double-revoke, ZERO grant.
**When to use:** the new `militancia_historica_compartida` RPC (REL-04).
**Example (structure to mirror — from 0061 co_comisionados, VERIFIED):**
```sql
-- Source: supabase/migrations/0061_cross_links_conteo_honesto_orden.sql
drop function if exists public.militancia_historica_compartida(text);
create or replace function public.militancia_historica_compartida(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer set search_path = '' as $$
  select d.id, d.nombre, d.camara, count(*) over () as total_n
  from (
    select distinct on (p2.id)
           p2.id,
           coalesce(nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
                    p2.nombre_normalizado) as nombre,
           p2.camara
    from public.parlamentario_militancia m1
    join public.parlamentario_militancia m2
      on m2.partido_alias = m1.partido_alias      -- KEY on ALIAS not display
     and m2.parlamentario_id <> m1.parlamentario_id
    join public.parlamentario p2 on p2.id = m2.parlamentario_id
    where m1.parlamentario_id = p_id
    -- NB: no es_actual filter → includes historical; to be NET-NEW over copartidarios,
    --     the plan decides whether to EXCLUDE pairs already sharing the CURRENT alias
    --     (696 net-new-only) or show all shared-ever (1966). Audit-driven.
    order by p2.id
  ) d
  order by d.nombre
  limit 20;
$$;
revoke all on function public.militancia_historica_compartida(text) from public;
revoke all on function public.militancia_historica_compartida(text) from anon, authenticated;
```
Apply: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0067_*.sql` — NEVER `db push`. pgTAP `supabase/tests/0067_*.test.sql` mirrors 0061 (has_function / prosecdef / has_function_privilege false / total_n in result).

### Pattern 2: force-dynamic route with searchParams (Phase 45 gotcha — VERIFIED in ficha)
**What:** read `searchParams` (a Promise in Next 16) BEFORE any `notFound()`; declare `export const dynamic = "force-dynamic"`.
**Why:** a `notFound()` that runs before `searchParams` is read bakes the route static → 500 with dynamic content (memory: Phase 45 / #34 pattern; ficha `page.tsx` does exactly this — validates id, awaits both `params` and `searchParams`).
**Example:**
```typescript
// Source: app/app/parlamentario/[id]/page.tsx (pattern) + UI-SPEC §Interaction
export const dynamic = "force-dynamic";
export default async function CompararPage({ searchParams }: { searchParams: Promise<{a?:string;b?:string}> }) {
  const sp = await searchParams;                 // read FIRST
  // canonical alphabetical order for URL stability (UI-SPEC)
  const [a, b] = [sp.a, sp.b].filter(Boolean).sort();
  // no params → empty selectors (NOT notFound)
  ...
}
```

### Pattern 3: server-side intersection from existing RPCs (REL-03)
**What:** read the per-parlamentario RPCs for A and B, compute the intersection in the RSC.
- **comisiones:** `comisiones_de_parlamentario` returns `nombre` → intersect by `nombre` set. DERIVABLE, no new RPC. [VERIFIED: 0060 §C returns nombre]
- **co-autoría (count):** `coautores_de_parlamentario(a)` returns rows incl. B's id + `n_proyectos` → look up B → count. DERIVABLE. [VERIFIED live: coautores('S1341') includes S1334 n=3]
- **co-autoría (boletines "con enlace"):** the RPC does NOT return the shared boletín list → **NEW RPC needed** if UI-SPEC's "proyectos en común con enlace" is required. Decide in plan (Claude's Discretion per CONTEXT).
- **militancia histórica:** MUST use the new alias-keyed RPC (see Pitfall 1). NOT derivable from `militancias_de_parlamentario` display output.
- **zona:** compare `circunscripcion`/`distrito` from `parlamentario_publico_v2`. ⚠ diputados have NULL → intersection is always "no comparten zona" for two diputados (honest absence, must be declared).

### Anti-Patterns to Avoid
- **Re-sorting cross-link rows by any count** (`n_proyectos`, `total_n`) — that is ranking by afinidad (T-52-13 LOCKED). Order is alphabetical, emitted by the RPC.
- **Intersecting militancia by display `partido` string** — mismatches alias splits (Pitfall 1).
- **Shipping lobby-misma-contraparte on unresolved names** without an explicit operator decision on provenance.
- **Collapsing the four blocks' `mt-12` into the grid wrapper** — the anti-insinuación frontier stays between the relations section and its siblings; the 2×2 grid is visual layout INSIDE the section (UI-SPEC LOCK).
- **`notFound()` before `searchParams` on /comparar** — bakes static (Phase 45).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pairwise militancia match | ad-hoc client join / display-string match | new secdef RPC keyed on `partido_alias` | alias≠display (Pitfall 1); PII/ACL must stay in DB (0061 mold) |
| Selector directory | new query | existing `parlamentarios_publico_v2` + `ParlamentariosFiltro` name-search pattern | already allowlisted, already the /parlamentarios channel |
| Anti-insinuación coverage | new CLI | extend `anti-insinuacion-guard.test.ts` arrays | existing vitest guard + mutation self-check |
| RPC ACL/schema proof | build/typecheck | pgTAP vs applied schema | typecheck can't prove Postgres ran the DDL (Pitfall 6, precedent 0060) |
| Coalición ingest | direct source→Supabase | dos-etapas R2 (crudo first) | LOCKED convention 1 |

**Key insight:** Every "relationship" surface in this codebase is a security-definer RPC with a hard anti-insinuación contract. The value of Phase 101 is composing existing RPCs + one new one that respects the same mold — not inventing a new data path.

## Common Pitfalls

### Pitfall 1: Militancia intersection by display string (SILENT wrong results)
**What goes wrong:** intersecting `militancias_de_parlamentario(a).partido` ∩ `(b).partido` by the display string.
**Why it happens:** `militancias_de_parlamentario` (0060 §B) emits `partido` (display), NOT `partido_alias` (the correct grouping key). Live PROD: ≥3 parties (Demócrata Cristiano, Liberal, PPD) map ONE display to TWO aliases → a naive display-match over/under-counts shared history.
**How to avoid:** the new `militancia_historica_compartida` RPC joins on `m2.partido_alias = m1.partido_alias` server-side. NEVER expose `partido_alias` (internal); emit only id/nombre/camara.
**Warning signs:** two members "share PPD" per display but never overlapped in the same alias tramo.

### Pitfall 2: "De la misma zona" looks broken (it's a data gap, not a bug)
**What goes wrong:** the zona block renders 0 for every diputado; someone "fixes" the RPC.
**Why it happens:** `parlamentario.distrito`/`region` is NULL for ALL 155 diputados (live-verified). `de_la_misma_zona` only matches on non-null distrito OR circunscripción → senators only.
**How to avoid:** the audit (REL-01) declares this honestly; the zona eje coverage is "solo Senado (31), Cámara sin dato de distrito ingerido". Do NOT fabricate distrito. If the operator wants Cámara zona, that's an INGEST task (out of this phase's scope — document as Future Requirement).
**Warning signs:** the "De la misma zona" block never appears on any diputado ficha.

### Pitfall 3: lobby-misma-contraparte assumes contraparte_id exists (it's 100% NULL)
**What goes wrong:** building the REL-04 lobby relation on `lobby_contraparte.contraparte_id`.
**Why it happens:** CONTEXT/UI-SPEC assumed resolved counterpart IDs. Live PROD: 0 of 17 681 rows have a non-null `contraparte_id` — identity resolution never ran for contrapartes.
**How to avoid:** either DIFER (documented) or use the name-based fallback (3 749 pairs / 136 parl) WITH normalization AND an explicit operator decision, because name-match is weaker provenance and risks conflation ("cge"/"cge s.a"/"cge s.a." are one entity).
**Warning signs:** the relation shows suspiciously round overlaps on generic names.

### Pitfall 4: PostgREST cap underestimates audit counts
**What goes wrong:** audit numbers computed via the site REST return ≤1000.
**Why it happens:** PostgREST caps at 1k (memory: v6.1). The audit must use `psql -tA`.
**How to avoid:** all N/M queries run `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "…"` (precedent 93).

### Pitfall 5: New RPC not in PUBLIC_RPC_ALLOWLIST → guard fails
**What goes wrong:** `militancia_historica_compartida` invoked from the ficha/`comparar` but not allowlisted → `lockdown-guard.test.ts` Direction-A (served ⊆ allowlist) fails; Direction-B (allowlist ⊆ defined) fails if the name is typo'd.
**How to avoid:** add the RPC name to `PUBLIC_RPC_ALLOWLIST` in `app/lib/lockdown-guard.test.ts` (Set is alphabetically maintained around line 165) AND ensure the migration file defines it. If read via `crossLinkReader("…")`, the A3 block also checks it.
**Warning signs:** guard offender listing the new RPC.

### Pitfall 6: New copy negating a prohibited term not registered in NEGACIONES_LOCKED
**What goes wrong:** the group-level relations legend or the 5th-block legend re-uses "afinidad"/"influencia" in a negation → the guard self-catches on the new surface.
**How to avoid:** Wave 0 (BEFORE copy): add new files to a `SUPERFICIES_*` array AND, if any new legend negates a prohibited term, register it verbatim in `NEGACIONES_LOCKED`. `LEYENDA_CROSS_LINK` is already registered — reusing it verbatim needs no new entry. New verbatim strings (e.g. a militancia-histórica legend) that negate a prohibited term DO.

## Code Examples

### Wave 0 — register new anti-insinuación surfaces (BEFORE any copy)
```typescript
// Source: app/lib/anti-insinuacion-guard.test.ts (pattern §SUPERFICIES_PANEL, tolerant loader)
// New array (or extend SUPERFICIES_PERSONAS). Loader try/catch tolerates not-yet-existing files
// → declare in Wave 0, guard GREEN today, BITES when the file lands.
const SUPERFICIES_RELACIONES: string[] = [
  "components/relaciones-section.tsx",       // wrapper <section id="relaciones">
  "components/relaciones-eje-comparar.tsx",  // A/B axis rows (if split out)
  "app/comparar/page.tsx",                   // new route
  "components/comparar-selector.tsx",        // selectors (if split out)
];
// add to the scan loop:  [...SUPERFICIES_PERSONAS, ...SUPERFICIES_RELACIONES, ...]
```

### Add RPC to allowlist (Direction-A + Direction-B guards)
```typescript
// Source: app/lib/lockdown-guard.test.ts:165 (alphabetical Set)
const PUBLIC_RPC_ALLOWLIST = new Set([
  // ...
  "militancia_historica_compartida",   // ← NEW (must also exist in supabase/migrations/0067_*.sql)
  // ...
]);
```

### Move the four blocks into the relations section (REL-02)
```tsx
// Source: composition of existing page.tsx:283-294 blocks (UI-SPEC §Interaction)
// Position: immediately after <HeaderSection>/<MilitanciasSection>, BEFORE <CarrilesSection>.
<section id="relaciones" className="mt-12">
  <h2 className="text-xl font-semibold">Relaciones con otros parlamentarios</h2>
  <p className="mt-2 text-sm text-muted-foreground">{LEYENDA_CROSS_LINK}</p>
  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
    <Suspense fallback={null}><CrossLinkCopartidarios id={id} /></Suspense>
    <Suspense fallback={null}><CrossLinkMismaZona id={id} /></Suspense>
    <Suspense fallback={null}><CrossLinkCoComisionados id={id} /></Suspense>
    <Suspense fallback={null}><CrossLinkCoautores id={id} /></Suspense>
  </div>
</section>
// NB (UI-SPEC LOCK): each CrossLinkBloque still emits its OWN <section className="mt-12">
// internally. Placing them in a grid nests those sections — acceptable as visual layout,
// but the grid must NOT strip/override the per-block mt-12 nor fuse two blocks into one <li>.
// Plan must verify the nested mt-12 does not visually double-space awkwardly (Discretion: grid
// cell may need the inner mt-12 neutralized WITHOUT touching CrossLinkBloque — e.g. a grid-cell
// wrapper with [&>section]:mt-0). This is the one real layout risk — flag for ui-review.
```

## Verbatim audit queries (Plan 01 — reproducible, run via psql -tA)

All run: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"`. Results below are LIVE 2026-07-24.

```sql
-- REL-01 militancia base
select count(*) from parlamentario_militancia;                              -- 363
select count(distinct parlamentario_id) from parlamentario_militancia;      -- 186
select count(*) from parlamentario_militancia where es_actual=false;        -- 177 (histórico)

-- REL-04 militancia histórica compartida — pairs (net-new over current copartidarios)
with actual_pairs as (
  select distinct least(m1.parlamentario_id,m2.parlamentario_id) a, greatest(m1.parlamentario_id,m2.parlamentario_id) b
  from parlamentario_militancia m1 join parlamentario_militancia m2
    on m2.partido_alias=m1.partido_alias and m1.es_actual and m2.es_actual and m2.parlamentario_id<>m1.parlamentario_id),
any_pairs as (
  select distinct least(m1.parlamentario_id,m2.parlamentario_id) a, greatest(m1.parlamentario_id,m2.parlamentario_id) b
  from parlamentario_militancia m1 join parlamentario_militancia m2
    on m2.partido_alias=m1.partido_alias and m2.parlamentario_id<>m1.parlamentario_id)
select (select count(*) from any_pairs), (select count(*) from actual_pairs),
       (select count(*) from any_pairs)-(select count(*) from actual_pairs);
-- 1966 | 1270 | 696   (696 = pares que SOLO comparten militancia histórica)

-- Pitfall 1 evidence: display ≠ alias
select partido, count(distinct partido_alias) from parlamentario_militancia
  group by partido having count(distinct partido_alias)>1;                  -- DC/Liberal/PPD → 2 alias c/u

-- REL-01 ZONA gap (headline finding)
select camara, count(*) total, count(distrito) con_distrito, count(circunscripcion) con_circ, count(region) con_region
  from parlamentario group by camara;
-- diputados|155|0|0|0    senado|31|0|31|31   → zona eje = SOLO senado

-- REL-04 lobby contraparte — ID is 100% NULL
select count(*) filter (where contraparte_id is not null) from lobby_contraparte;  -- 0  (of 17681)
-- name-based fallback pairs
with pa as (
  select distinct la.parlamentario_id, lower(trim(lc.nombre)) cp
  from lobby_audiencia la join lobby_contraparte lc on lc.identificador=la.identificador
  where la.estado_vinculo='confirmado' and trim(coalesce(lc.nombre,''))<>'' and la.parlamentario_id is not null)
select count(*) from (select distinct least(x.parlamentario_id,y.parlamentario_id) a, greatest(x.parlamentario_id,y.parlamentario_id) b
  from pa x join pa y on y.cp=x.cp and y.parlamentario_id<>x.parlamentario_id) z;   -- 3749 pares / 136 parl

-- /comparar axes coverage
select count(*) from comision_membresia;                                    -- 386  (34 comisiones)
select count(*) from proyecto_autor where estado_vinculo='confirmado';      -- 9937
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cross-links `limit 20`, count = `filas.length` (lied) | `total_n = count(*) over ()`, "Mostrando los primeros N" | 0061 (Phase 91) | conteo honesto already in place — Phase 101 inherits it |
| `partido` retenido como PII (0020) | `*_v2` RPCs emit partido (operator 2026-07-21) | 0060 | partido public; relations surfaces allowed |
| — | `comparar_declaraciones` RPC (patrimonio) | 0031/earlier | naming precedent for a comparison RPC (already allowlisted) |

**Deprecated/outdated in CONTEXT vs reality:**
- CONTEXT "lobby_audiencia with contraparte_id" — WRONG. Table has NO `contraparte_id` column; it's on `lobby_contraparte` and is 100% NULL.
- CONTEXT "315 dip + 48 sen = 363 militancias" — militancia rows = 363, but distinct parlamentarios = 186 (avg 1.95/parl). The 315/48 figure is stale phrasing; the 363 total holds.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Comités del Senado are a scrapeable factual source | REL-05 | probe (in-phase) may find no stable machable format → coalición DIFERIDA (already the documented fallback) |
| A2 | Servel pactos CSV (datos.gob.cl) machable to parlamentarios by deterministic name | REL-05 | pactos are party-level not member-level → mapping party→member via existing militancia; if names don't match → DIFERIDA |
| A3 | Name-based lobby-contraparte match is "substantive" (advocacy orgs, not ministries) | REL-04 | top-15 inspected were orgs/companies, but the long tail may include generic entities → needs full noise audit in Plan 01 before any surface |
| A4 | The nested `mt-12` in the 2×2 grid renders acceptably | REL-02 | may double-space; mitigated by a grid-cell wrapper neutralizing inner mt-12 (Discretion) — flag ui-review |

## Open Questions

1. **Militancia histórica: net-new-only (696) or shared-ever (1966)?**
   - Known: both computable; 696 excludes current-copartidario pairs (avoids duplicating the existing "Del mismo partido" block).
   - Recommendation: NET-NEW-ONLY (exclude current-alias pairs) so the 5th block adds information the copartidarios block doesn't. Decide in Plan with audit.
2. **Co-autoría "proyectos en común con enlace" on /comparar — new RPC?**
   - Known: `coautores_de_parlamentario` gives count but not the shared boletín list.
   - Recommendation: add a small `boletines_compartidos(a,b)` secdef RPC (returns boletín + link) OR show count-only if the enlace is deferred. CONTEXT marks this Claude's Discretion.
3. **lobby-misma-contraparte: DIFER or ship name-based?**
   - Recommendation: DIFER by default (contraparte_id NULL = no resolved identity); ship only if operator explicitly accepts name-match provenance + normalization is added. Audit documents both.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| psql | REL-01 audit queries | ✓ | (system) | — |
| `$SUPABASE_DB_URL` (.env) | audit + migration apply | ✓ | — | — |
| Live PROD read | audit evidence | ✓ (all queries ran) | — | — |
| curl / BrowserOS | REL-05 coalición probe | ✓ (BrowserOS MCP available) | — | mark coalición DIFERIDA |
| R2 (S3) creds | REL-05 ingest (only if viable) | assumed (CLAUDE.md stack) | — | probe-gated |

**Missing dependencies with no fallback:** none — all audit/build deps present.
**Missing dependencies with fallback:** coalición source stability (unverified) → DIFERIDA documented.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (app) + pgTAP (Supabase RPCs) |
| Config file | `app/vitest.config.ts` (existing); pgTAP via `psql -f` |
| Quick run command | `pnpm --filter ./app test` (root: `pnpm test`) |
| Full suite command | `pnpm test` + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0067_*.test.sql` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-01 | N/M matrix reproducible; zona-gap + contraparte-NULL findings recorded | audit doc + SQL | verbatim psql queries (above) re-run; doc `101-AUDIT-RELACIONES.md` | ❌ Wave 0 (Plan 01) |
| REL-02 | Relations section present, above-fold, 4 blocks intact, group legend, mt-12 frontier | component RTL + guard | `pnpm --filter ./app test` (new `relaciones-section.test.tsx`); anti-insinuación guard | ❌ Wave 0 |
| REL-02 | No insinuación term in new surfaces | source-scan guard | `anti-insinuacion-guard.test.ts` (extend SUPERFICIES_RELACIONES) | ✅ extend |
| REL-03 | `/comparar` force-dynamic; canonical URL; server intersection; honest empties; error≠empty | route/RTL | new `app/comparar/page.test.tsx` (intersection, no-params empty, RPC-error throws) | ❌ Wave 0 |
| REL-04 | `militancia_historica_compartida` secdef, total_n, anon no-execute, alias-keyed | pgTAP | `psql -tA -f supabase/tests/0067_*.test.sql` (mirror 0061: 16 asserts) | ❌ Wave 0 |
| REL-04 | RPC allowlisted (Direction-A/B) | vitest guard | `lockdown-guard.test.ts` (add entry) | ✅ extend |
| REL-04 | lobby DIFER/name-match decision recorded with N | audit doc | query in `101-AUDIT-RELACIONES.md` | ❌ Wave 0 |
| REL-05 | coalición viable→ingest test OR DIFERIDA documented with evidence | audit doc (+ connector test if ingest) | probe result in audit; if ingest: two-stage R2 idempotency test | ❌ Wave 0 |
| REL-02/03 | Live DOM evidence (block above-fold; /comparar renders A/B) | BrowserOS over deploy | gate on real deploy (memory: cascade CSS only caught in deploy) | manual gate |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test` (guards + component tests).
- **Per RPC change:** `psql -tA -f supabase/tests/0067_*.test.sql` against applied PROD schema (pgTAP is the ONLY valid DDL proof — Pitfall 6).
- **Phase gate:** full `pnpm test` green + pgTAP green + BrowserOS DOM evidence on deploy.

### Wave 0 Gaps
- [ ] `101-AUDIT-RELACIONES.md` — REL-01 matrix + coalición probe + lobby decision (Plan 01, GATES the rest)
- [ ] `supabase/migrations/0067_militancia_historica_compartida.sql` + `supabase/tests/0067_*.test.sql` — REL-04
- [ ] Extend `SUPERFICIES_RELACIONES` in `anti-insinuacion-guard.test.ts` (BEFORE copy) — REL-02/03
- [ ] Add `militancia_historica_compartida` to `PUBLIC_RPC_ALLOWLIST` in `lockdown-guard.test.ts` — REL-04
- [ ] `app/comparar/page.test.tsx` (force-dynamic, canonical URL, intersection, error≠empty) — REL-03
- [ ] `relaciones-section.test.tsx` (composition, legend, mt-12) — REL-02

## Security Domain

`security_enforcement: true` (config verified).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | site reads via service_role; RPCs deny-by-default (0044) |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | new RPC: security definer + double-revoke + PUBLIC_RPC_ALLOWLIST (Direction-A/B guards). Never grant anon. |
| V5 Input Validation | **yes** | `p_id` parametrized (never string interpolation); `/comparar` a/b whitelisted via `PARLAMENTARIO_ID_RE` (reuse ficha regex) before RPC |
| V6 Cryptography | no | — |
| V7 Error Handling | **yes** | #34: RPC error THROWS (honest error UI), `[]` = honest empty; error≠"sin relaciones" |
| V12 Data Protection (PII) | **yes** | RPC emits only id/nombre/camara; NEVER rut/email/partido_alias. Lobby contraparte name-match must not leak unresolved-identity as fact |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a/b params | Tampering | `.rpc()` parametrized + `PARLAMENTARIO_ID_RE` validation before query |
| Unbounded RPC (DoS) | DoS | `limit 20` + `statement_timeout` (0064 pattern) on new RPC |
| service_role executes non-allowlisted admin RPC from public tree | Elevation | `lockdown-guard.test.ts` Direction-A (served ⊆ allowlist) |
| Insinuación/defamation in copy | (reputational, project risk #1) | anti-insinuación guard extended Wave 0 + human legal sign-off |
| Presenting unresolved identity (contraparte name) as fact | Info disclosure / integrity | DIFER or explicit provenance framing "misma contraparte por nombre declarado" |

## Project Constraints (from CLAUDE.md)

- **Migrations:** `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` — NEVER `supabase db push`. pgTAP is the only valid DDL proof.
- **RPC ACL (Camino A, post-0044):** security definer, `set search_path=''`, schema-qualified, `p_id` parametrized, LIMIT bounded, double-revoke (`from public` + `from anon, authenticated`), ZERO grant.
- **Anti-insinuación / anti-ranking (T-52-13 LOCKED):** orden alfabético always; counts are data never sort keys; no score/ranking/eje ideológico; not even as easter egg (anti-DW-NOMINATE).
- **Ingesta dos-etapas LOCKED:** fuente→R2 crudo content-addressed first, R2→Supabase after; rate-limit 2–3s; hash-check before download; backfill masivo = LOCAL not GH Actions.
- **Server-only external calls:** all source/DB calls in RSC/Route Handlers; never client fetch. Cero-hex, `var(--text-*)` tokens, `mt-12` sibling frontier.
- **GSD workflow:** file changes only through a GSD command.

## Sources

### Primary (HIGH confidence)
- Live PROD via `psql -tA "$SUPABASE_DB_URL"` (PGCLIENTENCODING=UTF8) — all N/M, zona-gap, contraparte-NULL, alias≠display, pairs — HIGH (verified this session 2026-07-24)
- `supabase/migrations/0060_bio_partido_publico.sql`, `0061_cross_links_conteo_honesto_orden.sql` — RPC signatures/mold — HIGH
- `supabase/tests/0061_cross_links_conteo_honesto_orden.test.sql` — pgTAP mold — HIGH
- `app/app/parlamentario/[id]/page.tsx` — cross-link mounting, force-dynamic/searchParams/#34 pattern — HIGH
- `app/components/cross-links-parlamentario.tsx` — CrossLinkBloque contract — HIGH
- `app/lib/anti-insinuacion-guard.test.ts`, `app/lib/lockdown-guard.test.ts` — SUPERFICIES_*/NEGACIONES_LOCKED/PUBLIC_RPC_ALLOWLIST/Direction-A/B — HIGH
- `app/app/parlamentarios/page.tsx`, `app/components/parlamentarios-filtro.tsx` — selector reuse — HIGH
- `.planning/milestones/v9.0-phases/93-.../93-AUDITORIA-CITACIONES.md` — audit doc mold — HIGH
- `.planning/config.json` — nyquist_validation + security_enforcement = true — HIGH

### Secondary (MEDIUM confidence)
- [Servel pactos 2025](https://www.servel.cl/2025/08/19/pactos-elecciones-parlamentarias-2025/) — 5 formalized pactos — MEDIUM
- [Datos abiertos electorales](https://www.gobiernotransparentechile.cl/datos-abiertos/datos-electorales/) / datos.gob.cl — CSV availability — MEDIUM

### Tertiary (LOW confidence — needs in-phase probe)
- Comités del Senado at `sitio.senado.cl/senadores/comites` — 301 from www; endpoint refused plain fetch → format unknown until in-phase curl/BrowserOS probe — LOW

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all verified in codebase.
- Data reality (audit): HIGH — every figure ran live against PROD this session.
- Architecture / RPC mold: HIGH — 0060/0061/pgTAP read directly.
- Coalición (REL-05): LOW — desk-research only; probe is in-phase by design.

**Research date:** 2026-07-24
**Valid until:** 2026-08-07 (data counts drift as ingesta runs; re-run the audit queries in Plan 01 — they are the gate, not these snapshots)
