# Phase 16: MONEY Agregación — Contratos/aportes por contraparte - Research

**Researched:** 2026-06-19
**Domain:** Postgres aggregation (security-definer RPC over versioned MONEY facts) + gated Next.js 16 route; PII-safe projection (Ley 21.719)
**Confidence:** HIGH (codebase-grounded; this is a read-only consumer of already-shipped 0023/0024 schema — no new external dependencies)

## Summary

Phase 16 is a **pure read-only aggregation layer** over the MONEY facts already shipped in `0023_dinero.sql` (`contrato` + `contratista`) and `0024_servel.sql` (`aporte` + `donante`). There is **no connector, no ingestion, no new external dependency**. The deliverable is: one new migration `0025_agregacion.sql` containing a **security-definer RPC** (`agregado_por_contraparte`) plus a **listing RPC**, one new pgTAP test file, and one gated Next.js route `/contraparte/[id]`. The single hard constraint dominating every design decision is PII: the RPC is the **only** public path to contraparte data, the sub-maestras (`contratista`/`donante`) stay deny-by-default, and **persona-natural names and donor RUTs must never be projected**.

The central technical reality — and an honest limitation that must be documented rather than papered over — is that **the two sub-maestras do not share a join key**. `contratista` is keyed by `rut_proveedor` (a real RUT). `donante` is keyed by a synthetic `donante_id` (SERVEL publishes no RUT). A company that both contracts with the State *and* donates to campaigns is **not reliably joinable** across the two sources. The recommendation is to aggregate **within each source by its own key**, expose two independent contraparte facets, and **only merge across sources when a real shared RUT exists** (`donante.rut_donante` is nullable and today always NULL — so in MVP, no cross-source merge happens). Never falsely merge by name.

**Primary recommendation:** Ship a plain `language sql stable security definer` RPC with `GROUP BY` over the fact tables (runtime, no materialized view) — volume is hundreds–low-thousands of rows, well within runtime aggregation. The RPC filters to `tipo_persona = 'juridica'` on the **fact row** (`contrato.tipo_persona` / `aporte.tipo_persona`, both already present) so it never even needs to read the deny-by-default sub-maestra's `nombre` for the public name; use the fact row's `proveedor_nombre` / `donante_nombre` (which the public fact table already exposes for jurídica) as the displayed name. pgTAP asserts the RPC body never projects `contratista.nombre`/`donante.nombre`/`rut_donante`/`donante_id` and that it filters to jurídica.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregation of contratos/aportes by contraparte | Database / Storage (security-definer RPC, `GROUP BY`) | — | Aggregation over relational facts belongs in Postgres; the RPC is also the PII chokepoint (only public path) |
| PII filter (jurídica-only, no natural names) | Database (RPC `WHERE tipo_persona='juridica'` + projection list) | API/SSR (gate) | Filtering at the data tier means the privilege/path never exists for anon; defense-in-depth with deny-by-default RLS |
| Exposure gate (default OFF) | Frontend Server (SSR, `moneyPublicEnabled(process.env)`) | — | `server-only` flag; wraps the whole route/section so heading is absent when OFF |
| Contraparte page render (separate lanes, provenance per row) | Frontend Server (Server Components) | Browser (no client JS needed) | Mirrors existing `ContratosSection`/`FinanciamientoSection` pattern; anti-insinuación enforced in markup |
| Contraparte listing / addressing (`/contraparte/[id]`) | Frontend Server + Database (listing RPC) | — | Stable id scheme keyed per source; listing RPC returns only jurídica contrapartes |

## Standard Stack

This phase introduces **zero new packages**. It composes existing, already-shipped infrastructure.

### Core
| Library / Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Postgres + plpgsql/sql RPC | Postgres 15+ | `agregado_por_contraparte` security-definer RPC with `GROUP BY` | Exact mirror of shipped `contratos_de_parlamentario` / `aportes_de_parlamentario` (0023/0024) [VERIFIED: codebase `supabase/migrations/0023_dinero.sql:149`, `0024_servel.sql:180`] |
| pgTAP | (Supabase test harness) | Assert RPC excludes persona-natural names + sub-maestras stay deny-by-default | Mirror of `0024_dinero.test.sql` / `0025_servel.test.sql` [VERIFIED: codebase `supabase/tests/0025_servel.test.sql:127-133`] |
| Next.js | 16.x (App Router) | Gated `/contraparte/[id]` route, Server Components | Project standard; `params`/`searchParams` are Promises [VERIFIED: codebase `app/app/parlamentario/[id]/page.tsx:30-39`] |
| `@supabase/supabase-js` v2 | v2 | `createServerSupabase().rpc(...)` from Server Components | Project standard [VERIFIED: codebase `app/components/contratos-de-parlamentario.tsx:309`] |

### Supporting (existing reusable assets — DO NOT rebuild)
| Asset | Path | Purpose |
|-------|------|---------|
| `moneyPublicEnabled(env)` | `app/lib/money-gate.ts` | Candado B — default OFF, server-only [VERIFIED: codebase] |
| `ProvenanceBadge` | `app/components/provenance-badge.tsx` | Per-row source/date/link badge [VERIFIED: codebase] |
| `sourceLabel(origen)` | `app/lib/types.ts:401` | Has `chilecompra`→"ChileCompra" and `servel`→"SERVEL" branches already [VERIFIED: codebase `types.ts:409-410`] |
| `fechaCorta` | `app/lib/format.ts` | Date formatting [VERIFIED: codebase import in contratos component] |
| `ContratoRow`/`AporteRpcRow` shapes | `app/lib/types.ts:275,305` | Reference shapes for the per-row underlying rows |

**Installation:** None. No `npm install`, no new `npm:`/`jsr:` imports.

## Package Legitimacy Audit

> Not applicable. Phase 16 installs **zero external packages** — it is a SQL migration + pgTAP test + Next.js route composed entirely from shipped project code. No registry, slopcheck, or postinstall surface exists for this phase.

## Architecture Patterns

### System Architecture Diagram

```
                         anon (browser / public)
                                  │
                                  │  visits /contraparte/[id]   (or /contraparte listing)
                                  ▼
                    ┌────────────────────────────────┐
                    │  Next.js 16 Server Component     │
                    │  moneyPublicEnabled(process.env) │  ◄── Candado B (default OFF)
                    └───────────────┬──────────────────┘
                       OFF → render nothing (heading absent)
                       ON  ▼
                    createServerSupabase().rpc(...)
                                  │   (anon role)
                                  ▼
        ┌──────────────────────────────────────────────────────┐
        │  RPC agregado_por_contraparte(p_id)   [SECURITY DEFINER]│  ◄── Candado A
        │  + RPC contrapartes_listado()         [SECURITY DEFINER]│      (ONLY public path)
        │                                                         │
        │  WHERE tipo_persona = 'juridica'  (on the FACT row)     │
        │  GROUP BY contraparte key                               │
        │  projects: nombre(jurídica) + counts + totals + rows    │
        │  NEVER projects: contratista.nombre / donante.nombre    │
        │                  / rut_donante / donante_id             │
        └───────────────┬───────────────────────┬─────────────────┘
                        │                       │
              reads (definer privs)    reads (definer privs)
                        ▼                       ▼
              ┌──────────────────┐    ┌──────────────────┐
              │ contrato (0023)   │    │ aporte (0024)     │   ◄── public-read facts
              │  tipo_persona     │    │  tipo_persona     │       (already exposed)
              │  proveedor_nombre │    │  donante_nombre   │
              └────────┬──────────┘    └────────┬──────────┘
                       │ key: rut_proveedor*    │ key: donante_id*
                       ▼                        ▼
              ┌──────────────────┐    ┌──────────────────┐
              │ contratista(0023) │    │ donante (0024)    │   ◄── DENY-BY-DEFAULT
              │ DENY-BY-DEFAULT   │    │ DENY-BY-DEFAULT   │       (never read by anon;
              │ (nombre = PII)    │    │ (nombre/rut = PII)│        definer may read but
              └──────────────────┘    └──────────────────┘        must NOT project PII)

  * No shared join key across the two halves: rut_proveedor (real RUT) vs
    donante_id (synthetic). Merge across sources ONLY when a real shared RUT exists
    (donante.rut_donante, today always NULL) — otherwise present as separate entries.
```

### Recommended Project Structure
```
supabase/
├── migrations/
│   └── 0025_agregacion.sql        # NEW — the two RPCs (no new tables)
└── tests/
    └── 0026_agregacion.test.sql   # NEW — pgTAP (0025 test number is TAKEN by servel)

app/
├── app/contraparte/
│   ├── [id]/page.tsx              # NEW — gated detail route
│   └── page.tsx                   # NEW (optional) — gated listing/search
├── components/
│   └── contraparte-*.tsx          # NEW — pure View + Server Component (mirror contratos-de-parlamentario.tsx)
└── lib/
    └── types.ts                   # EXTEND — add AgregadoContraparteRpcRow shape(s)
```

### Pattern 1: Security-definer aggregation RPC (mirror of `contratos_de_parlamentario`)
**What:** A `language sql stable security definer set search_path = ''` function that `GROUP BY`s the fact table and returns aggregates + safe scalar columns only.
**When to use:** This is the single public path. The sub-maestra stays deny-by-default; the RPC is the chokepoint.

**Key design — filter PII at the data tier, and use the FACT row's name (not the sub-maestra's):**
Both fact tables already carry `tipo_persona` and a public name column on the **public-read fact row** itself:
- `contrato.tipo_persona` + `contrato.proveedor_nombre` [VERIFIED: codebase `0023_dinero.sql:75,74`]
- `aporte.tipo_persona` + `aporte.donante_nombre` [VERIFIED: codebase `0024_servel.sql:91,90`]

So the public name shown for a jurídica contraparte can come from the **already-public fact row**, and the RPC need not project `contratista.nombre`/`donante.nombre` at all. This is the cleanest way to guarantee the pgTAP "no persona-natural name" assertion: the function body simply never references the deny-by-default `nombre` columns.

```sql
-- Source: pattern mirrored from supabase/migrations/0023_dinero.sql:149 (contratos_de_parlamentario)
-- Aggregates the CONTRATOS facet of a contraparte, keyed by rut_proveedor, jurídica-only.
-- Returns per-period counts/totals + the underlying rows (each with source/fecha/enlace).
-- NEVER projects contratista.nombre (deny-by-default PII). Uses contrato.proveedor_nombre
-- (the already-public fact-row name) for the jurídica display name.
create function public.agregado_por_contraparte(p_id text)
returns table ( ... )   -- shape: facet, contraparte_nombre, periodo, conteo, rows(jsonb), provenance...
language sql stable security definer set search_path = '' as $$
  -- CONTRATOS facet
  select 'contrato'::text as facet,
         c.proveedor_nombre as contraparte_nombre,
         ... counts/totals grouped by period ...
  from public.contrato c
  where c.rut_proveedor_key = p_id          -- see addressing scheme below
    and lower(coalesce(c.tipo_persona,'')) like '%jur%'  -- jurídica-ONLY at the data tier
  ...
$$;
revoke execute on function public.agregado_por_contraparte(text) from public;
grant  execute on function public.agregado_por_contraparte(text) to anon;
```

> **NOTE — `contrato` has no `rut_proveedor` column today.** `0023_dinero.sql` stores `proveedor_nombre`, `codigo_orden`, `tipo_persona` on the fact, and `rut_proveedor` lives on `contratista` (the deny-by-default PK). The RPC therefore must **join** `contrato` → `contratista` on the link the connector established (the connector resolves `CodigoEmpresa`/RUT). The join is allowed inside a security-definer function (definer privileges read `contratista`), but the function must **project only `contrato`'s public columns + the jurídica name + aggregates** — never `contratista.nombre` or `contratista.rut_proveedor`. **Open question O1 below: confirm how `contrato` rows associate to a `rut_proveedor` so the RPC can key/group correctly.** If `contrato` has no FK/column to `contratista`, grouping by `rut_proveedor` requires reading `contratista` inside the definer function and grouping by its (non-projected) PK — feasible, but the planner must verify the actual link column.

### Pattern 2: Contraparte addressing scheme (`/contraparte/[id]`)
**What:** A stable, opaque-ish id for the route param that disambiguates which source/key the contraparte came from.
**Recommendation:** Use a **prefixed composite id** so the two non-joinable keyspaces never collide and the route stays unambiguous:
- Contractors: `id = "c:" + rut_proveedor` (e.g. `c:76123456-7`)
- Donors: `id = "d:" + donante_id`
- (Future, when a real shared RUT exists) a unified `id = "r:" + rut` that the RPC can resolve to *both* facets.

The RPC `agregado_por_contraparte(p_id)` parses the prefix and returns the matching facet(s). The listing RPC emits these prefixed ids. This avoids inventing a new identity table (none is needed for MVP) while keeping `/contraparte/[id]` deterministic and bookmarkable.

**Validate `[id]` with a regex before touching the DB** (mirror of `PARLAMENTARIO_ID_RE` guard at `parlamentario/[id]/page.tsx:42`) — e.g. `/^[cdr]:[A-Za-z0-9.\-]+$/` — and `notFound()` on mismatch (V5 input validation).

### Pattern 3: Gated route shell (mirror of the ficha MONEY sections)
**What:** Wrap the entire route body (heading included) in `moneyPublicEnabled(process.env)`; with OFF the page is effectively absent.
```tsx
// Source: pattern from app/app/parlamentario/[id]/page.tsx:97 and contratos-de-parlamentario.tsx:297
export default async function ContrapartePage({ params }: PageProps) {
  const { id } = await params;
  if (!CONTRAPARTE_ID_RE.test(id)) notFound();
  if (!moneyPublicEnabled(process.env)) notFound();  // gate the whole route, not just a section
  // ... RPC fetch, separate lanes, ProvenanceBadge per row
}
```
For a standalone route (vs an embedded section) prefer `notFound()` when gated OFF, so no empty shell or heading leaks — consistent with "heading absent with OFF".

### Anti-Patterns to Avoid
- **Projecting `contratista.nombre` / `donante.nombre` for the public name.** Use the fact row's `proveedor_nombre`/`donante_nombre` instead, and only for `tipo_persona='juridica'` rows. The deny-by-default `nombre` column must never appear in the RPC body. [pgTAP asserts `not ilike '%donante.nombre%'` etc.]
- **Projecting `rut_donante` / `donante_id` / `rut_proveedor`.** Donor RUT and any internal key never leave the RPC (Ley 21.719). Mirror of `0025_servel.test.sql:131` assertion.
- **Merging contratista + donante by NAME.** Names are not a key; a fuzzy name match would fabricate a false identity. Merge **only** by a real shared RUT (none exists in MVP). Otherwise present two separate contraparte entries.
- **Composing a money contraparte next to a vote in one UI unit, or any causal/affinity language.** Hard rule (anti-insinuación). Enforced in the Phase 16 UI-SPEC; research-level: never JOIN votes into this RPC or page.
- **Reading the deny-by-default tables from a Server Component via `.from('contratista')`.** anon has no SELECT (revoked) → returns nothing; always go through the RPC.
- **Filtering jurídica in the UI instead of the RPC.** The privilege boundary must be the data tier. If natural-person rows reach the client, the gate already failed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-row source/date/link badge | Custom badge JSX | `ProvenanceBadge` | Shipped, tested, handles staleness amber [VERIFIED: codebase] |
| Source name label | Inline `if origen===...` | `sourceLabel(origen)` | Already has chilecompra + servel branches [VERIFIED: `types.ts:409-410`] |
| Exposure gate | Reading `process.env.MONEY_PUBLIC_ENABLED` | `moneyPublicEnabled(env)` | Chokepoint WR-02; raw read forbidden [VERIFIED: `money-gate.ts`] |
| PII filtering | Filtering in TS after fetch | RPC `WHERE tipo_persona='juridica'` + projection list | Data-tier privilege boundary; pgTAP-verifiable |
| Cross-source identity merge | Name-similarity matching | Real shared RUT only (none in MVP) | Name merge fabricates identity (PROJECT.md: never fabricate identity) |
| Money totals as numbers | `SUM(monto::numeric)` | Count aggregation; montos are verbatim strings | `monto` is `text` verbatim, "NO numeric — sin computar" [VERIFIED: `0023_dinero.sql:78`, `0024_servel.sql:92`]. See pitfall below. |

**Key insight:** Almost everything this phase needs already exists. The only genuinely new artifact is the aggregation RPC + its pgTAP. The risk is **semantic/PII correctness**, not engineering volume.

## Materialized View vs Runtime RPC

**Recommendation: plain runtime security-definer RPC with `GROUP BY`. No materialized view for MVP.**

| Factor | Finding | Confidence |
|--------|---------|-----------|
| Expected volume | Hundreds–low-thousands of `contrato`/`aporte` rows (per-parlamentario sweeps, not a national crawl). `GROUP BY` over that is sub-millisecond. | HIGH (matches phase framing; CONTEXT §Deferred "vista materializada … si el volumen lo exige") |
| Existing pattern | The shipped `*_de_parlamentario` RPCs already do full scans + sort over the same tables at runtime with no matview. Consistency favors the same here. | HIGH [VERIFIED: codebase] |
| Index support | `contrato_parlamentario_idx`, `aporte_parlamentario_idx` exist; grouping by contraparte may want an index on the contraparte key (e.g. on `contratista(rut_proveedor)` PK already exists; consider an index on the `contrato`→contratista link column). | MEDIUM (depends on O1 link column) |
| pg_cron matview refresh | The pattern exists (`0003_orchestration.sql` registers cron jobs in SQL, version-guarded) if ever needed. **Deferred** — adds a staleness window + refresh-failure surface for no current benefit. | HIGH [VERIFIED: `0003_orchestration.sql:200-235`] |

**Decision rule (document for the planner):** Ship the runtime RPC. Add a `CREATE INDEX` on the contraparte grouping key if `EXPLAIN` shows a seq-scan cost worth removing. Only escalate to a `pg_cron`-refreshed materialized view if a real measured volume (>~50k fact rows or >200ms RPC latency) demands it — which is out of scope for MVP per CONTEXT Deferred.

## Reconciling Contraparte Identity (the honest limitation)

This is the load-bearing design fact of the phase. State it plainly in the plan and the UI.

| Source | Sub-maestra | Key | Has real RUT? |
|--------|-------------|-----|---------------|
| ChileCompra contracts | `contratista` | `rut_proveedor` (PK) | **Yes** — DV-validated RUT [VERIFIED: `0023_dinero.sql:103`] |
| SERVEL aportes | `donante` | `donante_id` (PK, synthetic) | **No** — `rut_donante` nullable, **today always NULL** (SERVEL publishes no donor RUT) [VERIFIED: `0024_servel.sql:133-134`] |

Consequences:
1. **No shared key in MVP.** A jurídica empresa that both contracts and donates cannot be reliably identified as the same entity, because the donor side has no RUT. **Do not merge by name** (would fabricate identity).
2. **Aggregate within each source by its own key.** Contracts grouped by `rut_proveedor`; aportes grouped by `donante_id`. Two independent facets.
3. **Cross-source merge is gated on a real shared RUT.** Only when `donante.rut_donante IS NOT NULL` AND it equals a `contratista.rut_proveedor` may the two facets be presented as one contraparte (the `r:`-prefixed unified id). Because `rut_donante` is universally NULL today, **no merge occurs in MVP** — and that is correct, not a gap to fix.
4. **Present separate entries honestly.** `/contraparte/c:<rut>` shows contracts; `/contraparte/d:<donante_id>` shows aportes. The UI must not imply that a same-named contractor and donor are the same legal entity.

This limitation is also a PII feature: because donor identity is synthetic + jurídica-only-exposed, the system structurally cannot reveal a private individual's combined money footprint.

## Runtime State Inventory

> Phase 16 is greenfield aggregation code (no rename/refactor of existing strings), **but** it adds a remote-applied migration and a new public route, so the operator-state categories matter.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no data migration. The phase reads existing `contrato`/`aporte`/`contratista`/`donante`; writes nothing. | None |
| Live service config | Remote Postgres schema: migration `0025_agregacion.sql` must be **applied to the remote** (sa-east-1) — DDL is invisible to CI/typecheck. | **OPERATOR CHECKPOINT**: apply 0025 via `db push --db-url` (BOM-safe extraction, same path as 0018–0024) + run pgTAP against applied schema |
| OS-registered state | None — no pg_cron job is created by this migration (MVP = runtime RPC; mirror of 0021–0024 which registered no cron in-migration). | None |
| Secrets/env vars | `MONEY_PUBLIC_ENABLED` already exists (Phase 13). The new route reads it via `moneyPublicEnabled()`. Turning it ON remains operator debt F13 (legal sign-off), out of scope. | None new |
| Build artifacts / installed packages | None — no new npm/jsr package; no egg-info/binary. Next.js route is source only. | None |

**The canonical question — after every file is updated, what runtime state still holds old/missing values?** Only the **remote Postgres schema**: without `0025` applied, the RPC does not exist and the route errors. That is the single operator action. Verified by: the same checkpoint pattern documented in `0023_dinero.sql:14-19` and `0024_servel.sql:17-22`.

## Common Pitfalls

### Pitfall 1: Choosing the wrong pgTAP test number (collision)
**What goes wrong:** Naming the test `0025_*.test.sql` collides — `0025_servel.test.sql` already exists.
**Why it happens:** The migration is `0025` but test files have their own running sequence offset by one (the money-gate test 0023 ate a number).
**How to avoid:** Migration = `0025_agregacion.sql`; **test = `0026_agregacion.test.sql`** (next free; existing tests run …0024_dinero, 0025_servel → 0026 is free). [VERIFIED: codebase `Glob supabase/tests` shows highest is `0025_servel.test.sql`]
**Warning signs:** `supabase test db` overwrites/duplicates a plan; two files claim 0025.

### Pitfall 2: DDL false-positive (build/typecheck pass, schema not applied)
**What goes wrong:** CI green but the RPC doesn't exist on the remote → route 500s at runtime.
**Why it happens:** TypeScript/Next build never executes Postgres DDL.
**How to avoid:** The only valid proof is pgTAP running against the **applied** schema; remote apply is the operator checkpoint (mirror of 0023/0024). Use `--db-url` explicitly because `.env` has a UTF-8 BOM.
**Warning signs:** `supabase.rpc('agregado_por_contraparte')` returns `PGRST202` (function not found) in prod.

### Pitfall 3: Summing verbatim `monto` strings
**What goes wrong:** "Total aportado: $X" requires `SUM`, but `monto` is `text` verbatim ("NO numeric — sin computar"), and for contracts `monto` is today **always NULL** (CR-02). A cast would crash or fabricate a total.
**Why it happens:** "agregados + totals" in CONTEXT reads as "sum money."
**How to avoid:** The safe, locked aggregate is the **neutral count** ("X aparece como contratista/donante N veces en periodo Y") — exactly the wording CONTEXT §Decisions and ROADMAP success-criterion 3 use. If a monetary total is ever shown it must be derived only where `monto` is reliably numeric across the group, with explicit "no publicado" handling; **for MVP, prefer count-only + per-row verbatim montos** (mirrors `ContratosView` which shows only a neutral count, never a sum [VERIFIED: `contratos-de-parlamentario.tsx:230-237`]).
**Warning signs:** `monto::numeric` in the RPC; a "$" total in the UI.

### Pitfall 4: Heading leaks when gate is OFF
**What goes wrong:** Rendering the `<h1>`/heading and only returning empty content from a child → heading visible with no data.
**Why it happens:** Gating the data fetch but not the heading.
**How to avoid:** Gate the **whole route** (`notFound()` when OFF) or wrap the entire section incl. heading in `moneyPublicEnabled(process.env)` — the locked pattern from `parlamentario/[id]/page.tsx:97` ("el nodo entero, heading incluido, está AUSENTE").
**Warning signs:** A bare contraparte heading renders in production while `MONEY_PUBLIC_ENABLED` is unset.

### Pitfall 5: Persona-natural leak via the join
**What goes wrong:** The RPC joins to `contratista`/`donante` to get a name and accidentally projects the deny-by-default `nombre`, exposing a private individual.
**Why it happens:** Reaching for the sub-maestra's name column.
**How to avoid:** Filter `tipo_persona='juridica'` on the **fact row** and project the **fact row's** `proveedor_nombre`/`donante_nombre`. Never reference `contratista.nombre`/`donante.nombre`/`rut_donante`/`donante_id` in the SELECT list. pgTAP asserts `pg_get_functiondef(...) not ilike '%donante.nombre%'` etc.
**Warning signs:** A persona-natural name appears in RPC output for any input.

## Code Examples

### pgTAP: assert the aggregation RPC is PII-safe (mirror of 0025_servel.test.sql:127-133)
```sql
-- Source: pattern from supabase/tests/0025_servel.test.sql:120-133 (functiondef introspection)
select has_function('public', 'agregado_por_contraparte', ARRAY['text'],
  'agregado_por_contraparte(text) existe');
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='agregado_por_contraparte'),
  true, 'agregado_por_contraparte es security definer');
select ok(has_function_privilege('anon','public.agregado_por_contraparte(text)','execute'),
  'anon tiene EXECUTE');
select ok(not has_function_privilege('public','public.agregado_por_contraparte(text)','execute'),
  'public NO tiene EXECUTE (revocado)');

-- PII assertions: the body filters jurídica and never projects PII columns.
select ok(
  pg_get_functiondef('public.agregado_por_contraparte(text)'::regprocedure) ilike '%juridica%',
  'el cuerpo filtra a persona jurídica (nunca natural por nombre)');
select ok(
  pg_get_functiondef('public.agregado_por_contraparte(text)'::regprocedure) not ilike '%rut_donante%',
  'el cuerpo NO proyecta rut_donante (Ley 21.719)');
-- (repeat not-ilike for donante_id, contratista.nombre, donante.nombre, rut_proveedor)

-- Sub-maestras STILL deny-by-default (regression guard).
select is((select count(*)::int from information_schema.role_table_grants
   where table_name='contratista' and grantee='anon' and privilege_type='SELECT'), 0,
   'contratista sigue deny-by-default tras 0025');
select is((select count(*)::int from information_schema.role_table_grants
   where table_name='donante' and grantee='anon' and privilege_type='SELECT'), 0,
   'donante sigue deny-by-default tras 0025');
```

### Server Component fetch + gate (mirror of contratos-de-parlamentario.tsx:287-318)
```tsx
// Source: pattern from app/components/contratos-de-parlamentario.tsx:287
if (!moneyPublicEnabled(process.env)) return null; // or notFound() at route level
const sb = createServerSupabase();
const { data, error } = await sb.rpc("agregado_por_contraparte", { p_id: id });
if (error) throw new Error(`agregado_por_contraparte falló para ${id}: ${error.message}`); // #34: never degrade to "empty"
```

## State of the Art

| Old Approach | Current Approach | Why |
|--------------|------------------|-----|
| Materialized view + cron for any aggregation | Runtime `GROUP BY` RPC at this volume | Simplicity; matview only when measured volume demands (CONTEXT Deferred) |
| Merge entities by normalized name | Merge only by real shared RUT (none in MVP) | Name merge fabricates identity (PROJECT.md hard rule) |
| Project sub-maestra `nombre` for display | Project the public fact-row name, jurídica-only | Keeps deny-by-default `nombre` out of the RPC body entirely |

**Deprecated/outdated:** None specific to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Expected volume is hundreds–low-thousands of fact rows → runtime RPC suffices, no matview | Materialized View vs Runtime RPC | If real volume is far larger, RPC latency may justify a matview; mitigated by the documented escalation rule |
| A2 | `contrato.proveedor_nombre` / `aporte.donante_nombre` are populated for jurídica rows and safe to display publicly (they live on the public-read fact table) | Pattern 1, Pitfall 5 | If the connector left these NULL for jurídica, the display falls back to "no publicado" (honest), but the RPC may then need the sub-maestra name — re-introducing PII review. Planner must confirm population. |
| A3 | `contrato` associates to a `rut_proveedor` via a link the connector set (join to `contratista`); the exact link column is not yet confirmed from 0023 alone | Pattern 1 NOTE, O1 | If there is no usable link, grouping contracts "by RUT" needs a different key (e.g. `proveedor_nombre`+`tipo_persona`) — weaker. See Open Question O1. |
| A4 | Test file `0026_agregacion.test.sql` is the next free number | Pitfall 1 | If a 0026 test is added before this phase, pick the next free; low risk |

## Open Questions

1. **O1 — How does a `contrato` row resolve to its `contratista` (rut_proveedor)?**
   - What we know: `contratista.rut_proveedor` is the PK; `contrato` carries `proveedor_nombre`, `tipo_persona`, `codigo_orden`, `nombre_orden` but **0023 shows no explicit `rut_proveedor` FK column on `contrato`**. The connector (`@obs/dinero`) resolves `CodigoEmpresa`/RUT during ingestion.
   - What's unclear: the exact column/relationship the RPC must `JOIN`/`GROUP BY` on to aggregate contracts per RUT.
   - Recommendation: Planner inspects the `@obs/dinero` writer (`reconciliar-contrato.ts`) and the live `contrato` schema to confirm the link column before writing the RPC. If contracts are keyed to contratista only via the connector's internal resolution and not stored on `contrato`, either (a) add the link column in `0025` (still no new *table*), or (b) group by `(proveedor_nombre, tipo_persona)` as a fallback contraparte key for contracts — documented as weaker than RUT-keyed.

2. **O2 — Listing route scope.** CONTEXT marks "cómo listar contrapartes (listado o búsqueda)" as Claude's discretion. Recommendation: a minimal gated `/contraparte` listing RPC (`contrapartes_listado()` returning jurídica contrapartes + their prefixed id + neutral count), behind the same gate. Search can be deferred. Planner confirms whether a listing page is in MVP scope or whether `/contraparte/[id]` is reached only from existing parlamentario links.

3. **O3 — Periodo for the "N veces en periodo Y" framing.** Aportes have `eleccion` (NOT NULL) as the natural period. Contracts have `fecha_oc`/`fecha_corte` but no electoral period. Recommendation: group aportes by `eleccion`; group contracts by year of `fecha_oc` (or present un-period-grouped with per-row dates). Planner/UI-SPEC fixes the exact period bucketing; the RPC should expose the raw period field so the UI decides.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Remote Supabase Postgres (sa-east-1) | Applying `0025_agregacion.sql` | ✓ (operator path proven 0018–0024) | Postgres 15+ | — (operator checkpoint) |
| `supabase` CLI + pgTAP | Running `0026_agregacion.test.sql` against applied schema | ✓ | project standard | — |
| Next.js 16 dev/build | `/contraparte/[id]` route | ✓ | 16.x | — |

No external runtime/service/network dependency is introduced. No connector, no LLM, no scraping. R2 is irrelevant to this phase.

## Validation Architecture

> `workflow.nyquist_validation` not inspected as explicitly false; included per default.

### Test Framework
| Property | Value |
|----------|-------|
| DB framework | pgTAP via `supabase test db` |
| UI framework | Vitest + React Testing Library (mirror `contratos-de-parlamentario.test.tsx`) |
| Config file | existing project config |
| Quick run (DB) | `supabase test db` (applied schema) |
| Quick run (UI) | `vitest run app/components/contraparte-*.test.tsx` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MONEY-05 | RPC aggregates contratos/aportes by contraparte, jurídica-only, rows carry source/fecha/enlace | pgTAP | `supabase test db` (0026) | ❌ Wave 0 |
| MONEY-05 | RPC never projects persona-natural name / donor RUT / internal keys | pgTAP (functiondef introspection) | `supabase test db` (0026) | ❌ Wave 0 |
| MONEY-05 | sub-maestras stay deny-by-default after 0025 | pgTAP (regression) | `supabase test db` (0026) | ❌ Wave 0 |
| MONEY-05 (UI) | route absent when gate OFF; separate lanes; ProvenanceBadge per row; no causal language | RTL | `vitest run` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `supabase/tests/0026_agregacion.test.sql` — covers MONEY-05 DB invariants (PII + deny-by-default + RPC existence/grants)
- [ ] `app/components/contraparte-*.test.tsx` — pure View fixtures (jurídica-only render, separate lanes, gate OFF)
- [ ] No framework install needed (pgTAP + vitest already in repo)

## Security Domain

> `security_enforcement` treated as enabled (absent = enabled). This phase is PII-dominated.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Deny-by-default RLS on sub-maestras + revoke; RPC is sole public path; `revoke execute from public` + `grant execute to anon` on exact signature |
| V5 Input Validation | yes | `CONTRAPARTE_ID_RE` regex on `[id]` before DB (mirror `PARLAMENTARIO_ID_RE`); `notFound()` on mismatch |
| V8 Data Protection / Privacy (Ley 21.719) | yes | RPC projects jurídica names only; never persona-natural `nombre`, never `rut_donante`/`donante_id`/`rut_proveedor`; pgTAP enforces |
| V2 Authentication | no | anon-only public read path; no auth introduced |
| V6 Cryptography | no | no crypto in this phase |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII disclosure of private individual via aggregation | Information Disclosure | jurídica-only filter at data tier + projection allow-list; pgTAP functiondef assertions |
| Donor RUT / synthetic key leak | Information Disclosure | RPC never selects `rut_donante`/`donante_id`; pgTAP `not ilike` guards (mirror 0025_servel) |
| Exposure before legal sign-off | Information Disclosure | `moneyPublicEnabled()` default OFF gates the entire route; operator F13 sign-off required to enable |
| Insinuation (money↔vote correlation) | (semantic harm) | No vote JOIN in RPC; separate UI lanes; no causal language — enforced UI-SPEC |
| SQL injection via `[id]` | Tampering | Parameterized RPC arg (`p_id text`); regex-validated param; `set search_path = ''` |
| Privilege escalation via default grants | Elevation of Privilege | Explicit `revoke all` already on sub-maestras; verify still present post-0025 (pgTAP regression) |

## Sources

### Primary (HIGH confidence — codebase, authoritative)
- `supabase/migrations/0023_dinero.sql` — `contrato`/`contratista` schema, `contratos_de_parlamentario` RPC, deny-by-default + revoke pattern, operator-checkpoint notes
- `supabase/migrations/0024_servel.sql` — `aporte`/`donante` schema, synthetic `donante_id`, nullable `rut_donante`, `aportes_de_parlamentario` RPC, "RUT del donante jamás sale al público"
- `supabase/tests/0024_dinero.test.sql`, `supabase/tests/0025_servel.test.sql` — pgTAP assertion patterns incl. `pg_get_functiondef` not-ilike PII guard
- `app/lib/money-gate.ts` — `moneyPublicEnabled` default-OFF chokepoint
- `app/components/contratos-de-parlamentario.tsx` — gated Server Component → RPC → View pattern, neutral-count-only aggregate, `#34` error-not-empty
- `app/app/parlamentario/[id]/page.tsx` — gated section pattern, `params` Promise, regex-validate-then-DB, RPC via `createServerSupabase`
- `app/lib/types.ts` — `ContratoRpcRow`/`AporteRpcRow` shapes, `sourceLabel` (chilecompra + servel branches)
- `supabase/migrations/0003_orchestration.sql` — pg_cron-in-SQL pattern (version-guarded) for the matview-deferred note
- `.planning/ROADMAP.md` — Phase 16 success criteria, MONEY-05, anti-insinuación rule
- `.planning/phases/16-.../16-CONTEXT.md` — authoritative decisions (jurídica-only, RPC chokepoint, 0025 + pgTAP, deferred matview)

### Secondary / Tertiary
- None required — phase is fully codebase-grounded; no external library research needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all assets verified in codebase
- Architecture (RPC + gate + addressing): HIGH — direct mirror of two shipped RPCs and the gated-section pattern
- Identity reconciliation limitation: HIGH — derived from the actual PK definitions in 0023/0024
- Aggregation link column (O1): MEDIUM — `contrato`→`contratista` join column needs confirmation from the writer
- Volume / matview decision: MEDIUM-HIGH — based on phase framing, not a measured count

**Research date:** 2026-06-19
**Valid until:** ~2026-09-19 (stable; bounded by the shipped 0023/0024 schema — re-check if those migrations change)
