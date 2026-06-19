# Phase 16: MONEY Agregación — Contratos/aportes por contraparte - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 6 (1 migration, 1 pgTAP, 1 page, 1 not-found, 1+ components, optional listing page)
**Analogs found:** 6 / 6 (every artifact has an exact in-repo analog)

> Phase 16 is a PURE CONSUMER: no connectors, no ingestion. Every artifact mirrors
> an existing MONEY artifact almost verbatim, changing only the aggregation key
> (`*_de_parlamentario` → `*_por_contraparte`) and adding the hard PII filter
> `tipo_persona = 'juridica'`. Copy structure; do not invent.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0025_agregacion.sql` | migration (security-definer RPC) | CRUD / aggregate | `supabase/migrations/0023_dinero.sql` + `0024_servel.sql` (the two `*_de_parlamentario` RPCs) | exact (role + flow) |
| `supabase/tests/0026_agregacion.test.sql` | test (pgTAP) | request-response | `supabase/tests/0025_servel.test.sql` (+ `0024_dinero.test.sql`) | exact |
| `app/app/contraparte/[id]/page.tsx` | route (Server Component page) | request-response | `app/app/parlamentario/[id]/page.tsx` | role-match (gate applies to PAGE, not section) |
| `app/app/contraparte/[id]/not-found.tsx` | route (404 boundary) | request-response | `app/app/parlamentario/[id]/not-found.tsx` | exact |
| `app/components/contratos-por-contraparte.tsx` | component (lane: contratos) | request-response | `app/components/contratos-de-parlamentario.tsx` | exact |
| `app/components/aportes-por-contraparte.tsx` | component (lane: aportes) | request-response | `app/components/financiamiento-de-parlamentario.tsx` | exact |
| `app/app/contraparte/page.tsx` (optional listing, Claude's discretion) | route (index/search) | request-response | `app/app/parlamentario/[id]/page.tsx` (Suspense + RPC shell) | partial (no list page exists yet) |

Next free migration number = **0025** (last applied is `0024_servel.sql`; the `0023_money_gate`/`0024_dinero`/`0025_servel` files in `tests/` are TESTS, not migrations). Next free pgTAP number = **0026** (`0025_servel.test.sql` is the highest test).

---

## Pattern Assignments

### `supabase/migrations/0025_agregacion.sql` (security-definer aggregation RPC)

**Analogs:** `0023_dinero.sql` (`contratos_de_parlamentario`) and `0024_servel.sql` (`aportes_de_parlamentario`).

This migration adds NO tables — it only adds RPC(s) over the existing `contrato`/`aporte` fact tables + `contratista`/`donante` sub-masters (which stay deny-by-default). The two existing RPCs are the exact skeleton to copy; the only new behavior is the `GROUP BY` aggregation and the `tipo_persona = 'juridica'` PII filter.

**RPC declaration skeleton — copy verbatim** (`0023_dinero.sql:149-155`):
```sql
create function public.contratos_de_parlamentario(p_id text)
returns table ( ... )
language sql stable security definer set search_path = '' as $$
  select ...
  from public.contrato c
  where c.parlamentario_id = p_id
  order by ...
$$;
```
Mirror the `language sql stable security definer set search_path = ''` clause EXACTLY (`0023_dinero.sql:155`, `0024_servel.sql:186`). `search_path = ''` means every table reference must be schema-qualified (`public.contrato`, `public.aporte`).

**revoke-from-public + grant-execute-to-anon — copy verbatim** (`0023_dinero.sql:166-167`, identical at `0024_servel.sql:198-199`):
```sql
revoke execute on function public.contratos_de_parlamentario(text) from public;
grant execute on function public.contratos_de_parlamentario(text) to anon;
```
The RPC is the ONLY public channel; the sub-masters `contratista`/`donante` keep their deny-by-default (RLS-enabled, zero policies, `revoke all ... from anon, authenticated`) — see `0023_dinero.sql:116-127` and `0024_servel.sql:145-156`. **Do NOT add any policy or grant to `contratista`/`donante` in this migration.**

**PII-exclusion filter — THE load-bearing new line.** The CONTEXT decision (`16-CONTEXT.md:22-24`) is: only persona JURÍDICA is exposed by name. The fact tables already carry `tipo_persona` (`contrato.tipo_persona` at `0023_dinero.sql:75`; `aporte.tipo_persona` at `0024_servel.sql:91`). The aggregation must filter to juridica. Note the existing UI test for juridica is `tipoPersona.includes("jur")` (`contratos-de-parlamentario.tsx:117`) — but in SQL prefer exact `tipo_persona = 'juridica'` (the DB stores `'natural' | 'juridica'` per `0023_dinero.sql:75` comment). New WHERE clause shape:
```sql
where c.tipo_persona = 'juridica'
  and (p_id is null or <contraparte-key> = p_id)
```

**Aggregation contract — what the RPC may project (and may NOT).**
- Contratos keyed by `rut_proveedor` / `mencion_proveedor` / `proveedor_nombre`; aportes keyed by `donante_id` / `donante_nombre`.
- MAY project: juridica name + counts + totals (the "X aparece N veces" fact) + per-row provenance (`origen`, `fecha_captura`, `enlace`, `fecha_corte`, `licencia`).
- MUST NOT project: any persona-natural name, `rut_donante`, `donante_id`, or any raw column of `contratista`/`donante`. This mirrors the prohibition already enforced + tested for `aportes_de_parlamentario` (header comment `0024_servel.sql:42-44, 173-178`; the RPC body deliberately omits `rut_donante`).
- CERO cómputo de montos in the parlamentario RPCs is a hard UI rule (`contratos-de-parlamentario.tsx:34, 230`), but counts/row-counts ARE the permitted aggregate (CONTEXT `16-CONTEXT.md:25`). Totals here are an explicit phase requirement — keep them VERBATIM-derived (count of rows, not summed money) unless CONTEXT/plan says otherwise; `monto` is stored as `text` verbatim (`0023_dinero.sql:78`), so any monetary total is a deliberate new decision, not a copy.

**Migration header convention — copy the doc-block style** of `0024_servel.sql:1-59`: state "last applied migration is 0024", "this is 0025", the "APLICACION = CHECKPOINT DE OPERADOR" note, the GATE note, and the "pgTAP uses the next free number 0026" note.

**No `cron.schedule`** in this migration (CONTEXT defers materialized view; MVP = runtime RPC). Mirror the "no pg_cron in the migration" note at `0023_dinero.sql:46-48` / `0024_servel.sql:57-59`.

---

### `supabase/tests/0026_agregacion.test.sql` (pgTAP)

**Analogs:** `0025_servel.test.sql` (richest, has the body-introspection asserts) and `0024_dinero.test.sql` (the RPC privilege block).

**File header + plan + begin/rollback wrapper** (`0025_servel.test.sql:1-23, 135-136`):
```sql
begin;
select plan(<N>);
...
select * from finish();
rollback;
```

**RPC existence + security-definer + execute-privilege block — copy verbatim** (`0024_dinero.test.sql:84-97`, identical shape at `0025_servel.test.sql:111-125`):
```sql
select has_function('public', 'contratos_de_parlamentario', ARRAY['text'], '...');
select is( (select p.prosecdef from pg_proc p join pg_namespace n ... where ... proname = '...'), true, '... es security definer');
select ok( has_function_privilege('anon', 'public.<rpc>(text)', 'execute'), 'anon tiene EXECUTE ...');
select ok( not has_function_privilege('public', 'public.<rpc>(text)', 'execute'), 'public NO tiene EXECUTE ...');
```

**THE phase-defining assert — RPC excludes persona-natural names.** Copy the `pg_get_functiondef` body-introspection pattern that `0025_servel.test.sql:127-133` already uses to prove the donor RUT is never projected:
```sql
select ok(
  pg_get_functiondef('public.<rpc>(text)'::regprocedure) not ilike '%rut_donante%',
  'el cuerpo del RPC NO proyecta rut_donante (Ley 21.719)');
```
Adapt this to assert (a) the body FILTERS to juridica — `... ilike '%tipo_persona%juridica%'` or `... ilike '%juridica%'`; and (b) the body does NOT project the natural-person name column / `donante_id` / `rut_donante` — `... not ilike '%rut_donante%'`, `... not ilike '%donante_id%'`. This is the assert CONTEXT (`16-CONTEXT.md:30, 67`) demands: "el pgTAP lo hace verificable, no solo convención."

**Sub-masters STILL deny-by-default — the three-assert block.** Re-assert that `contratista` and `donante` remain RLS-enabled + zero policies + anon-without-grant, copying `0024_dinero.test.sql:61-71` (contratista) and `0025_servel.test.sql:89-99` (donante). The new RPC must not have loosened them:
```sql
select is((select count(*)::int from pg_class where relname = 'donante' and relrowsecurity = true), 1, 'RLS enabled en donante');
select is((select count(*)::int from pg_policies where tablename = 'donante'), 0, 'donante sin policies');
select is((select count(*)::int from information_schema.role_table_grants where table_name = 'donante' and grantee = 'anon' and privilege_type = 'SELECT'), 0, 'anon NO tiene grant SELECT sobre donante');
```

Remote apply + `supabase test db` against the APPLIED schema = OPERATOR CHECKPOINT (mirror note `0025_servel.test.sql:17-19`).

---

### `app/app/contraparte/[id]/page.tsx` (gated PAGE — not a gated section)

**Analog:** `app/app/parlamentario/[id]/page.tsx`. **Key difference: the gate wraps the WHOLE PAGE, not a `<section>`.**

In the parlamentario page the gate is applied per-section — `{moneyPublicEnabled(process.env) && (<section>…</section>)}` (`page.tsx:97-106` for contratos, `:119-135` for financiamiento). For `/contraparte/[id]` the ENTIRE page is a MONEY artifact, so the gate must fail the whole route: call `notFound()` (or return it) when OFF, so that with the flag OFF the route 404s and no heading/DOM leaks. Pattern to adapt (combine the gate import with the `notFound()` validation):
```tsx
import { notFound } from "next/navigation";
import { moneyPublicEnabled } from "@/lib/money-gate";

export default async function ContrapartePage({ params }: PageProps) {
  if (!moneyPublicEnabled(process.env)) notFound();   // whole-page gate (default OFF → 404)
  const { id } = await params;
  if (!<CONTRAPARTE_ID_RE>.test(id)) notFound();        // validate id BEFORE touching DB
  ...
}
```

**Imports + PageProps + async-params + id-validation-before-DB** — copy `page.tsx:1-44`:
- `import { Suspense } from "react";` + `import { notFound } from "next/navigation";` (`page.tsx:1-2`)
- `import { createServerSupabase } from "@/lib/supabase";` (`page.tsx:4`)
- `interface PageProps { params: Promise<{ id: string }>; searchParams: Promise<...>; }` (`page.tsx:30-33`) — `params`/`searchParams` are Promises in Next 16; `await` them (`page.tsx:39-40`).
- Validate `[id]` against a regex BEFORE any DB call (`page.tsx:42-44`, mirrors `PARLAMENTARIO_ID_RE = /^P\d{5}$/` at `app/lib/buscar.ts:34`). Phase 16 needs its own contraparte-id regex (Claude's discretion on shape).

**Separate-lanes layout (anti-insinuación) — copy the `mt-12` sibling-section discipline** (`page.tsx:46-136`). Each lane (contratos / aportes) is its own `<section className="mt-12">` with its own `<h2>` + `<Suspense fallback={…}>`, NEVER nested. The `mt-12` IS the lane boundary (`page.tsx:59-64, 88-96`). HARD RULE (`16-CONTEXT.md:14, 34`): a money counterparty and a vote NEVER share a UI unit — and `/contraparte` shows money only, so it must contain NO vote lane at all.

**Header/not-found honest split — copy `HeaderSection`** (`page.tsx:177-195`): read via RPC with `.maybeSingle()`, distinguish "not found" (→ `notFound()`) from a real DB error (→ `throw`, honest error UI). Same `#34` discipline used in every section.

**Skeletons** — copy the `*Skeleton` pattern at `page.tsx:253-279` (shape-matched, `aria-hidden="true"`).

> `node_modules/next/dist/docs/` per `app/AGENTS.md`: this is a non-stock Next.js build — read the routing/Suspense guide before writing the page; do not assume Pages-Router or stock App-Router conventions.

---

### `app/app/contraparte/[id]/not-found.tsx` (404 boundary)

**Analog:** `app/app/parlamentario/[id]/not-found.tsx` (whole file, 23 lines). Copy verbatim, changing only the copy ("Contraparte no encontrada" + body text). Keep the rules it encodes (`not-found.tsx:3-7`): sober Spanish, NEVER says "error" for absent data, never reads as a clean record, `<Link href="/">` back-home. This same file ALSO serves the gate-OFF 404 when the page calls `notFound()`.

---

### `app/components/contratos-por-contraparte.tsx` (contratos lane)

**Analog:** `app/components/contratos-de-parlamentario.tsx` (whole file). Mirror its three-part structure: pure `*View` (props, RTL-testable with fixtures) + `*Section` Server Component (gate → RPC → marker → View) + per-row `*Fila`. NO `"use client"` in the file (`contratos-de-parlamentario.tsx:40`).

**Imports — copy `contratos-de-parlamentario.tsx:1-7`:**
```tsx
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { fechaCorta } from "@/lib/format";
import { sourceLabel, type ContratoRpcRow } from "@/lib/types";
```

**Section gate — copy `contratos-de-parlamentario.tsx:294-299`:** `if (!moneyPublicEnabled(process.env)) return null;` (defense-in-depth even though the page already 404s when OFF).

**RPC call + honest error (#34) — copy `contratos-de-parlamentario.tsx:309-318`:** `const { data, error } = await sb.rpc("<agregado-rpc>", { p_id: id });` then `if (error) throw new Error(...)` — a real DB error is NEVER degraded to "sin contratos".

**Per-row render + ProvenanceBadge — copy `ContratoFila` (`contratos-de-parlamentario.tsx:113-187`):** subject = the juridica entity (`text-base` prominent), null-safe fallbacks ("No publicado"), `<dl>` of literal fields, and the mandatory per-row badge (`contratos-de-parlamentario.tsx:177-184`):
```tsx
<ProvenanceBadge
  capturedAt={captured}
  sourceName={sourceLabel(c.origen)}
  sourceUrl={c.enlace}
/>
```
`sourceLabel()` already has a chilecompra branch (`app/lib/types.ts:409`) — no change needed.

**Honest states + neutral count** — copy the three-state `ContratosView` (`contratos-de-parlamentario.tsx:190-277`). For a counterparty the states differ slightly (no "no consultado" marker per parlamentario), but reuse the neutral-count + paginated-list shape (`:230-274`) and the "vacío NUNCA se lee como limpio" rule. CERO cómputo de montos (`:34, 230`).

---

### `app/components/aportes-por-contraparte.tsx` (aportes lane)

**Analog:** `app/components/financiamiento-de-parlamentario.tsx` (whole file). Same three-part structure (`*View` + `*Section` + `*Fila`).

**Imports — copy `financiamiento-de-parlamentario.tsx:1-7`** (same set; `type AporteRpcRow` instead of `ContratoRpcRow`).

**Gate / RPC / #34 / per-row badge** — same lines as the financiamiento analog: gate `:457-459`, RPC + error `:470-479`, `AporteFila` + badge `:155-225`. **`donante_nombre` is the subject; the donor RUT is NEVER rendered** (`financiamiento-de-parlamentario.tsx:171-172`, Ley 21.719) — preserve this. `sourceLabel()` already has a servel branch (`app/lib/types.ts:410`).

**Grouping** — the parlamentario analog groups by `eleccion` (`financiamiento-de-parlamentario.tsx:289-307`). For `/contraparte` the grouping axis changes (one counterparty across elections/organisms — Claude's discretion), but reuse the `agruparPor*` + neutral-count + honest-empty scaffolding. Keep the HARD anti-insinuación rule: NEVER place a money fact next to a vote, no causal/affinity language (`financiamiento-de-parlamentario.tsx:15-42`; `16-CONTEXT.md:14, 34`).

---

## Shared Patterns

### MONEY exposure gate (server-only flag)
**Source:** `app/lib/money-gate.ts:30-34` (`moneyPublicEnabled(env = process.env)`).
**Apply to:** the `/contraparte/[id]` PAGE (whole-page `notFound()` when OFF) AND both lane Server Components (`if (!moneyPublicEnabled(process.env)) return null;`, defense in depth).
- `import "server-only"` is line 1 — the flag NEVER reaches the client bundle. NEVER read `MONEY_PUBLIC_ENABLED` raw; always go through `moneyPublicEnabled()` (chokepoint WR-02, `money-gate.ts:26-28`).
- Fail-closed: only the literal `"true"` enables it (`money-gate.ts:33`).

### Security-definer RPC as the only public channel
**Source:** `0023_dinero.sql:155-167` + `0024_servel.sql:186-199`.
**Apply to:** the new aggregation RPC(s).
`language sql stable security definer set search_path = ''` + `revoke execute ... from public` + `grant execute ... to anon`. Sub-masters (`contratista`/`donante`) stay deny-by-default; the RPC reads them with definer privilege and projects ONLY safe columns.

### Deny-by-default sub-master (unchanged, re-asserted)
**Source:** `0023_dinero.sql:116-127` (contratista), `0024_servel.sql:145-156` (donante).
**Apply to:** nothing is modified, but the pgTAP MUST re-assert RLS-enabled + zero-policies + anon-without-grant for both (`0024_dinero.test.sql:61-71`, `0025_servel.test.sql:89-99`).

### Provenance per row
**Source:** `ProvenanceBadge` usage at `contratos-de-parlamentario.tsx:177-184` + `sourceLabel()` at `app/lib/types.ts:401-412` (chilecompra + servel branches already present).
**Apply to:** every row in both lanes — `capturedAt` / `sourceName={sourceLabel(origen)}` / `sourceUrl={enlace}`. Every fact carries fuente + fecha + enlace (FND-08).

### Honest error vs absence (#34)
**Source:** `contratos-de-parlamentario.tsx:314-318`, `page.tsx:185-192`.
**Apply to:** every RPC/DB read in the new page + components. A real DB/network error is `throw`n (honest error boundary); 0 rows is an honest empty state, NEVER "limpio"/"sin datos ✓".

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/app/contraparte/page.tsx` (optional listing/search index) | route | request-response | No top-level listing page exists; only `/parlamentario/[id]` detail pages. If built, reuse the Suspense + RPC-shell from `page.tsx` and the existing search primitives in `app/lib/buscar.ts`. Claude's discretion (`16-CONTEXT.md:39`). |

Note: there is NO existing top-level gated PAGE — only gated SECTIONS inside `/parlamentario/[id]`. The whole-page-`notFound()`-when-OFF behavior is the one genuinely new gate-wiring decision in this phase (analog gives section-level gating only).

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/tests/`, `app/app/parlamentario/[id]/`, `app/components/`, `app/lib/`.
**Files scanned:** 0023_dinero.sql, 0024_servel.sql, 0024_dinero.test.sql, 0025_servel.test.sql, parlamentario/[id]/page.tsx, parlamentario/[id]/not-found.tsx, money-gate.ts, contratos-de-parlamentario.tsx, financiamiento-de-parlamentario.tsx, types.ts, buscar.ts.
**Pattern extraction date:** 2026-06-19
