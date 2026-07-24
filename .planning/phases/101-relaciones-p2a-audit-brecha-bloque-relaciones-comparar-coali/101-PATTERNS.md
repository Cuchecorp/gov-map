# Phase 101: RELACIONES P2a — Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 11 (new/modified)
**Analogs found:** 11 / 11 (exact or role-match — every surface has a live precedent)

> **Rector insight (from RESEARCH):** Phase 101 is re-composition + one new route + one new secure RPC. There is NO net-new architecture. Every relationship surface in this codebase is a security-definer RPC read server-side + a presentational component under an anti-insinuación contract. The planner's job is to compose existing molds VERBATIM, not invent data paths.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/phases/101-*/101-AUDIT-RELACIONES.md` | doc (audit) | request-response (psql) | `.planning/milestones/v9.0-phases/93-*/93-AUDITORIA-CITACIONES.md` | exact (mold) |
| `app/app/parlamentario/[id]/page.tsx` | route (server) | request-response | itself (in-file re-composition of lines 283-294) | exact (self) |
| `app/components/relaciones-section.tsx` (NEW) | component | request-response | `app/components/cross-links-parlamentario.tsx` + page.tsx:283-294 | role-match |
| `app/app/comparar/page.tsx` (NEW) | route (server, force-dynamic) | request-response (CRUD read) | `app/app/parlamentarios/page.tsx` + ficha `page.tsx` searchParams | role-match |
| `app/components/comparar-selector.tsx` (NEW, optional split) | component (island/form) | request-response | `app/app/parlamentarios/page.tsx` §DirectoryFilter + `parlamentarios-filtro.tsx` | role-match |
| `app/components/relaciones-eje-comparar.tsx` (NEW, optional split) | component | transform (intersection render) | `cross-links-parlamentario.tsx` (list rendering) | role-match |
| `supabase/migrations/0067_militancia_historica_compartida.sql` (NEW) | migration (secdef RPC) | CRUD (read) | `supabase/migrations/0061_cross_links_conteo_honesto_orden.sql` §E.1 | exact (mold) |
| `supabase/tests/0067_militancia_historica_compartida.test.sql` (NEW) | test (pgTAP) | — | `supabase/tests/0061_cross_links_conteo_honesto_orden.test.sql` | exact (mold) |
| `app/lib/anti-insinuacion-guard.test.ts` | test (vitest guard) | — | itself (SUPERFICIES_PANEL Wave-0 addition, lines 305-308) | exact (self) |
| `app/lib/lockdown-guard.test.ts` | test (vitest guard) | — | itself (PUBLIC_RPC_ALLOWLIST Set, lines 165-193) | exact (self) |
| `app/app/comparar/page.test.tsx` (NEW) + `relaciones-section.test.tsx` (NEW) | test (RTL) | — | existing component `.test.tsx` suite | role-match |

---

## Pattern Assignments

### `app/app/parlamentario/[id]/page.tsx` (route, request-response — MODIFY, REL-02)

**Analog:** itself. The four cross-link blocks are ALREADY mounted at lines 283-294 at the END of the content column. REL-02 = move them UP into a `<section id="relaciones">` wrapper placed immediately after `<MilitanciasSection>` (line 236-238) and BEFORE `<CarrilesSection>` (line 271-273). The internal `CrossLinkBloque` component stays byte-intact.

**Current mount (lines 283-294) — the block to relocate + wrap:**
```tsx
<Suspense fallback={null}><CrossLinkCopartidarios id={id} /></Suspense>
<Suspense fallback={null}><CrossLinkMismaZona id={id} /></Suspense>
<Suspense fallback={null}><CrossLinkCoComisionados id={id} /></Suspense>
<Suspense fallback={null}><CrossLinkCoautores id={id} /></Suspense>
```

**Cross-link block sub-components (lines 320-382) stay INTACT.** They read a cached RPC via `crossLinkReader(rpc)` (lines 185-199) and build `CrossLinkBloque` with `totalReal(filas)` (lines 314-317). Each `conteoTexto` is a factual count string — do NOT re-sort by any count.

**LOCKED patterns to preserve (page.tsx JSDoc lines 45-69, 275-282):**
- Each carril = own `<section className="mt-12">` — the `mt-12` is the anti-insinuación frontier. NEVER collapse into a wrapper NOR strip from the inner blocks.
- The 2×2 grid is visual layout INSIDE the new section; it does NOT dissolve the per-block `mt-12` (RESEARCH Pitfall A4 — flag ui-review for double-spacing; Discretion: neutralize inner `mt-12` in a grid-cell wrapper via `[&>section]:mt-0` WITHOUT touching CrossLinkBloque).
- `#34`: RPC error THROWS (lines 189-191), `[]` = honest empty. Never degrade to "sin relaciones".

**force-dynamic + searchParams gotcha already correct here (lines 201-210):** `params`/`searchParams` awaited BEFORE `notFound()` and the id validated against `PARLAMENTARIO_ID_RE` (line 208). This is the exact pattern `/comparar` must copy (Phase 45 gotcha).

**"Comparar con…" link (REL-03 integration):** add a link pre-filling slot A (`/comparar?a=${id}`) — model it on the gated `<nav>` at lines 253-262 (pure navigation, does NOT compose another parlamentario's facts, so it does not cross the anti-insinuación frontier).

---

### `app/components/relaciones-section.tsx` (component, request-response — NEW, REL-02)

**Analog:** `app/components/cross-links-parlamentario.tsx` (presentational contract) + the wrapper shape from RESEARCH §"Move the four blocks".

**Wrapper shape (RESEARCH-verified, UI-SPEC §Interaction):**
```tsx
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
```

**Group legend (LOCKED):** reuse `LEYENDA_CROSS_LINK` VERBATIM (exported from `cross-links-parlamentario.tsx:48-49`). Because it is already registered in `NEGACIONES_LOCKED` (guard line 446), re-using it verbatim needs NO new negation entry. A NEW group-level legend string that negates a prohibited term ("afinidad"/"influencia") MUST be registered in `NEGACIONES_LOCKED` Wave 0 (RESEARCH Pitfall 6).

**Style candados (CONTEXT Discretion):** cero-hex, `var(--text-*)` tokens, `text-xl font-semibold` heading matches the sibling carriles' `CarrilHeader` (page.tsx:661-674).

---

### `app/app/comparar/page.tsx` (route, force-dynamic — NEW, REL-03)

**Analog:** `app/app/parlamentarios/page.tsx` (selector + RPC read + honest-empty) merged with the ficha `page.tsx` force-dynamic/searchParams discipline.

**force-dynamic + canonical URL (RESEARCH Pattern 2, Phase 45 gotcha — VERBATIM):**
```typescript
export const dynamic = "force-dynamic";
export default async function CompararPage({ searchParams }: { searchParams: Promise<{a?:string;b?:string}> }) {
  const sp = await searchParams;                 // read FIRST — never notFound() before this
  const [a, b] = [sp.a, sp.b].filter(Boolean).sort();  // canonical alphabetical order
  // no params → empty selectors (NOT notFound)
}
```

**Input validation (V5, SECURITY §V5):** whitelist `a`/`b` against `PARLAMENTARIO_ID_RE` (imported `from "@/lib/buscar"`, used at ficha page.tsx:5,208) BEFORE any RPC call. NEVER string-interpolate into SQL.

**Selector reuse (RESEARCH "Don't Hand-Roll"):** read `parlamentarios_publico_v2` (no-arg RPC) exactly as `parlamentarios/page.tsx:117` (`DirectoryList`), filter server-side by name. Model the form on §DirectoryFilter (lines 67-106, GET form, progressive enhancement).

**RPC read + error≠empty (VERBATIM from parlamentarios/page.tsx:116-121):**
```typescript
const sb = createServerSupabase();
const { data, error } = await sb.rpc("parlamentarios_publico_v2");
if (error) throw new Error(`parlamentarios_publico_v2 falló: ${error.message}`);  // #34: error, never "sin resultados"
```

**Server-side intersection (RESEARCH Pattern 3) — per axis:**
- **comisiones:** read `comisiones_de_parlamentario(a)` + `(b)`, intersect by `nombre` set. DERIVABLE, no new RPC.
- **co-autoría (count):** read `coautores_de_parlamentario(a)`, look up `b.id`, read `n_proyectos`. DERIVABLE. (For "proyectos en común con enlace" a NEW `boletines_compartidos(a,b)` RPC may be needed — CONTEXT Discretion; decide in plan.)
- **militancia histórica:** MUST use the NEW alias-keyed RPC `militancia_historica_compartida` — NOT derivable from `militancias_de_parlamentario` display output (Pitfall 1: `partido` ≠ `partido_alias`).
- **zona:** compare `circunscripcion`/`distrito` from `parlamentario_publico_v2`. ⚠ diputados = NULL → honest "no comparten zona" for two diputados (declare it).

**Layout container:** `<main className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16">` (matches both analog routes).

---

### `supabase/migrations/0067_militancia_historica_compartida.sql` (migration secdef RPC — NEW, REL-04)

**Analog:** `supabase/migrations/0061_cross_links_conteo_honesto_orden.sql` §E.1 `copartidarios_de_parlamentario` (VERBATIM mold).

**Mold (0061 §E.1 lines 44-77) — copy every locked element:**
```sql
drop function if exists public.militancia_historica_compartida(text);
create or replace function public.militancia_historica_compartida(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer set search_path = '' as $$
  select d.id, d.nombre, d.camara, count(*) over () as total_n
  from (
    select distinct on (p2.id)
           p2.id,
           coalesce(
             nullif(trim(concat_ws(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
             p2.nombre_normalizado
           ) as nombre,
           p2.camara
    from public.parlamentario_militancia m1
    join public.parlamentario_militancia m2
      on m2.partido_alias = m1.partido_alias      -- KEY on ALIAS not display (Pitfall 1)
     and m2.parlamentario_id <> m1.parlamentario_id
    join public.parlamentario p2 on p2.id = m2.parlamentario_id
    where m1.parlamentario_id = p_id
    -- OPEN QUESTION (plan decides w/ audit): net-new-only (696, exclude current-alias
    -- copartidario pairs) vs shared-ever (1966). Recommendation: net-new-only.
    order by p2.id
  ) d
  order by d.nombre
  limit 20;
$$;
revoke all on function public.militancia_historica_compartida(text) from public;
revoke all on function public.militancia_historica_compartida(text) from anon, authenticated;
```

**LOCKED elements (0061 header lines 36-41):** `security definer` + `set search_path = ''` + schema-qualified names + `p_id` parametrized + `count(*) over ()` as `total_n` + DROP-before-create + double-revoke + ZERO grant. Emit ONLY `id/nombre/camara/total_n` — NEVER `rut`/`email`/`partido_alias`.

**Apply (CLAUDE.md LOCKED):** `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0067_*.sql`. NEVER `supabase db push`.

---

### `supabase/tests/0067_militancia_historica_compartida.test.sql` (pgTAP — NEW, REL-04)

**Analog:** `supabase/tests/0061_cross_links_conteo_honesto_orden.test.sql` (VERBATIM mold, 16 asserts → subset for one RPC).

**Assert set (mirror 0061 lines 12-48) for the single new RPC:**
```sql
begin;
select plan(4);
select has_function('public', 'militancia_historica_compartida', ARRAY['text'], 'existe');
select is((select prosecdef from pg_proc where proname = 'militancia_historica_compartida'), true, 'es security definer');
select is(has_function_privilege('anon', 'public.militancia_historica_compartida(text)', 'execute'), false, 'anon SIN execute');
select ok(pg_get_function_result('public.militancia_historica_compartida(text)'::regprocedure) ~* '\ytotal_n\y', 'emite total_n');
select * from finish();
rollback;
```
Run: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0067_*.test.sql`. pgTAP is the ONLY valid DDL proof (Pitfall 6).

---

### `app/lib/anti-insinuacion-guard.test.ts` (vitest guard — MODIFY, REL-02/03 Wave 0)

**Analog:** itself — the `SUPERFICIES_PANEL` addition (lines 305-308) is the exact Wave-0 precedent (declare surfaces BEFORE the files exist; the loader try/catch at lines 532-537 tolerates missing files → guard GREEN today, BITES when the file lands).

**Add a new `SUPERFICIES_RELACIONES` array (mirror SUPERFICIES_PANEL comment style):**
```typescript
const SUPERFICIES_RELACIONES: string[] = [
  "components/relaciones-section.tsx",
  "components/relaciones-eje-comparar.tsx",
  "app/comparar/page.tsx",
  "components/comparar-selector.tsx",
];
```
**Wire into the scan loop (line 529):** add `...SUPERFICIES_RELACIONES` to the array literal alongside `...SUPERFICIES_PANEL`.

**NEGACIONES_LOCKED (lines 435-457):** reusing `LEYENDA_CROSS_LINK` verbatim needs NO entry (already at line 446). A NEW group/militancia legend string that negates a prohibited term MUST be added verbatim (RESEARCH Pitfall 6). Add a mutation self-check test mirroring the PANEL one (lines 720-746) that proves the guard BITES on the new surface.

---

### `app/lib/lockdown-guard.test.ts` (vitest guard — MODIFY, REL-04)

**Analog:** itself — `PUBLIC_RPC_ALLOWLIST` Set (lines 165-193), alphabetically maintained.

**Add the new RPC (between `match_proyectos` line 185 and `militancias_de_parlamentario` line 186 to keep alphabetical):**
```typescript
"militancia_historica_compartida",   // ← NEW (must also exist in supabase/migrations/0067_*.sql)
```
Direction-A (served ⊆ allowlist) fails if the ficha/comparar invokes it un-allowlisted; Direction-B (allowlist ⊆ defined) fails if the name is typo'd vs the migration (Pitfall 5).

---

### `app/app/comparar/page.test.tsx` + `relaciones-section.test.tsx` (RTL — NEW, Wave 0)

**Analog:** existing component `.test.tsx` suite (vitest + RTL; `votos-por-parlamentario.test.tsx` referenced in guard JSDoc line 38).

**comparar coverage (RESEARCH Test Map):** force-dynamic present; canonical URL (a/b sorted); server intersection renders factual line ("comparten N comisiones: X, Y"); no-params → empty selectors (NOT notFound); RPC-error THROWS (not "sin relaciones").
**relaciones-section coverage:** section present + above-fold position; 4 blocks intact; group legend rendered; `mt-12` frontier preserved.

---

## Shared Patterns

### Secure RPC read (server-only, #34)
**Source:** `app/app/parlamentario/[id]/page.tsx:185-194` (`crossLinkReader`) + `parlamentarios/page.tsx:116-121`.
**Apply to:** every RPC read in `/comparar` and the relaciones section.
```typescript
const sb = createServerSupabase();
const { data, error } = await sb.rpc(rpc, { p_id: id });
if (error) throw new Error(`${rpc} falló para ${id}: ${error.message}`);  // #34
return (data ?? []) as CrossLinkRow[];   // [] = honest empty, error = throw
```
Wrap per-read in `React.cache` (page.tsx line 186) to dedup when both A and B slots read the same RPC.

### Anti-insinuación / anti-ranking contract (T-52-13 LOCKED)
**Source:** `cross-links-parlamentario.tsx` JSDoc (lines 7-41) + guard `TERMINOS_PROHIBIDOS` (lines 319-427).
**Apply to:** every new copy string, legend, and heading.
- Orden ALFABÉTICO always; counts are DATA, never sort keys (never re-sort by `n_proyectos`/`total_n`).
- No score/ranking/eje ideológico — not even as easter egg (anti-DW-NOMINATE).
- Relation is DECLARED by an official source, never inferred.

### Honest empty vs error vs coverage-declared
**Source:** `cross-links-parlamentario.tsx:91` (`if (filas.length === 0) return null`) + `totalN` truncation declaration (lines 96-143).
**Apply to:** relaciones section (empty block omitted), /comparar axes (honest "no comparten zona"), every new relation (declare its N/M from the audit in copy: "en las fuentes consultadas al [fecha]").

### force-dynamic + searchParams (Phase 45 gotcha)
**Source:** `app/app/parlamentario/[id]/page.tsx:201-210`.
**Apply to:** `/comparar` — await `searchParams` FIRST, validate ids against `PARLAMENTARIO_ID_RE`, declare `export const dynamic = "force-dynamic"`, never `notFound()` before reading searchParams.

### PII-safe RPC ACL (Camino A)
**Source:** `supabase/migrations/0061_*.sql` header (lines 36-41) + double-revoke on each function.
**Apply to:** the new 0067 RPC — security definer, `search_path=''`, double-revoke, ZERO grant, emit no `rut`/`email`/`partido_alias`; add to `PUBLIC_RPC_ALLOWLIST`.

---

## No Analog Found

None. Every file has an exact or role-match precedent in the codebase.

**Conditional / audit-gated files (may not materialize — RESEARCH):**

| File | Role | Data Flow | Gate |
|------|------|-----------|------|
| `boletines_compartidos(a,b)` RPC (0068?) | migration | CRUD read | Only if /comparar "proyectos en común con enlace" is required (CONTEXT Discretion). Same 0061 mold. |
| lobby-misma-contraparte RPC | migration | CRUD read | DIFERIDA by default — `lobby_contraparte.contraparte_id` is 100% NULL (Pitfall 3). Ships only on explicit operator name-match provenance decision. |
| coalición connector + R2 ingest | service (Deno) | file-I/O two-stage | Gated on in-phase REL-05 probe (Servel pactos / comités Senado). DIFERIDA if probe non-viable. Analog: existing two-stage R2 connectors (CLAUDE.md convention 1). |

---

## Metadata

**Analog search scope:** `app/app/`, `app/components/`, `app/lib/`, `supabase/migrations/`, `supabase/tests/`, `.planning/milestones/`
**Files scanned:** 8 read in full (page.tsx ficha, page.tsx parlamentarios, cross-links-parlamentario.tsx, 0061 migration, 0061 pgTAP, anti-insinuacion-guard.test.ts, lockdown-guard.test.ts allowlist section, types.ts CrossLinkRow section)
**Pattern extraction date:** 2026-07-24
