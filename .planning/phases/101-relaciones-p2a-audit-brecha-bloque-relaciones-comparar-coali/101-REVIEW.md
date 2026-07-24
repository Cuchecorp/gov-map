---
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
reviewed: 2026-07-24T20:35:05Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - app/app/comparar/page.test.tsx
  - app/app/comparar/page.tsx
  - app/app/parlamentario/[id]/page.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/components/comparar-selector.tsx
  - app/components/relaciones-eje-comparar.tsx
  - app/components/relaciones-section.test.tsx
  - app/components/relaciones-section.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/lockdown-guard.test.ts
  - supabase/migrations/0067_militancia_historica_compartida.sql
  - supabase/tests/0067_militancia_historica_compartida.test.sql
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 101: Code Review Report

**Reviewed:** 2026-07-24T20:35:05Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Phase 101 relaciones/comparar surface: the new `/comparar` route (page + selector + eje component), the 5th cross-link block on the ficha, the new RPC 0067 + pgTAP, and the two guard suites (anti-insinuación + lockdown allowlist).

The regime plumbing is largely sound: PII-safe projection in 0067 (only id/nombre/camara/total_n), double-revoke re-emitted after DROP, `search_path = ''`, id validation before any `.rpc()`, force-dynamic + searchParams-before-notFound preserved, error≠empty (#34) honored in every reader, alphabetical ordering everywhere, allowlist + Direction-B wiring correct, and the RELACIONES tripwire registered in the anti-insinuación guard with a mutation self-check.

However, `/comparar` has a correctness core defect: **all four server-side intersections are computed from LIMIT-20-truncated RPC result sets**, which makes the page assert factually false absence statements ("no comparten X, según fuente al {fecha}") and understated counts — the exact class of "lying data" this project treats as its #1 risk. Additionally, the comisiones intersection keys on `nombre` alone, so a diputado and a senador who each sit in their own chamber's "Hacienda" are declared to "share a commission." The new RPC 0067 also regressed the bounded-RPC discipline (no `statement_timeout`) that 0064 established for every sibling cross-link RPC.

## Critical Issues

### CR-01: /comparar computes intersections and counts from LIMIT-20-truncated RPC rows → false "no comparten" declarations and understated counts

**File:** `app/app/comparar/page.tsx:220` (militancia), `app/app/comparar/page.tsx:292-293` (co-autoría), `app/app/comparar/page.tsx:225` and `302-304` (counts)
**Issue:** Both `militancia_historica_compartida` (0067) and `coautores_de_parlamentario` (0060/0061) return **at most 20 rows, ordered alphabetically by nombre** (`order by d.nombre limit 20`, verified in `supabase/migrations/0067_militancia_historica_compartida.sql:77-78` and `0060_bio_partido_publico.sql:295-296`). The page then decides the intersection by membership in that truncated list:

- `const compartenMilitancia = milA.some((r) => r.id === b);` (line 220)
- `const filaCoautB = coautA.find((r) => r.id === b);` → `nCoproyectos = filaCoautB?.n_proyectos ?? 0` (lines 292-293)

If parlamentario A has more than 20 partners on the eje and B sorts alphabetically after the 20th, B is absent from the rows and the page renders **"En las fuentes consultadas al {fecha}, no comparten militancia histórica."** / **"no comparten proyectos co-firmados."** — a factually false, source-and-date-attributed absence claim. With 20+ co-authors being entirely realistic (mociones carry up to 10 signatures each across a full period), this is not a theoretical edge.

The same truncated arrays feed the column copy: `ejeColMilitancia(nombreA, milA.length)` (line 225) and `` `${coautA.length} co-autores registrados` `` (lines 302-304) display the **capped** length (max 20) as if it were the total — the exact "conteo mentiroso" that WR-01 of Phase 91/0061 fixed on the ficha via `total_n`/`totalReal()`, regressed here. The rows already carry `total_n` (`CrossLinkRow.total_n`, `app/lib/types.ts:297`); the page ignores it.

**Fix:**
1. For the pairwise checks, do not derive presence from a capped list. Either add a bounded pairwise RPC (`militancia_historica_compartida_par(p_a, p_b)` / `coautoria_par(p_a, p_b)` returning a boolean/count — cheap, PII-safe, mirrors 0067 discipline), or as a minimal stopgap, treat `milA.length < (milA[0]?.total_n ?? 0)` as "list truncated" and query the reverse direction (`getMilitanciaHistorica(b).some(r => r.id === a)`) before declaring absence — declining to assert absence when both directions are truncated.
2. For the counts, reuse the ficha's honest-count pattern:
```tsx
const totalMilA = typeof milA[0]?.total_n === "number" ? milA[0].total_n : milA.length;
// ...ejeColMilitancia(nombreA, totalMilA)
const totalCoautA = typeof coautA[0]?.total_n === "number" ? coautA[0].total_n : coautA.length;
```

### CR-02: Comisiones intersection keyed by `nombre` alone → declares a shared commission across chambers that is factually false

**File:** `app/app/comparar/page.tsx:246-251`
**Issue:** The comisiones eje intersects by name string only:
```tsx
const setComB = new Set(nombresComB);
const comCompartidas = [...new Set(nombresComA.filter((n) => setComB.has(n)))]...
```
`ComisionRow` carries `camara` (the test fixture at `app/app/comparar/page.test.tsx:70` shows it), and both chambers have same-named permanent commissions (Hacienda, Constitución, Salud, Educación…). `/comparar` allows any A/B pair including diputado vs senador — for such a pair the page renders **"Comparten 1 comisión: Hacienda."** when A sits in the Cámara's Hacienda and B in the Senado's Hacienda: two different bodies, no shared membership. This is an asserted false fact with source attribution ("Fuente: Cámara/Senado"). Note the zona eje avoids exactly this trap by prefixing "Circunscripción"/"Distrito" so cross-type values can never match (`zonaDe`, lines 420-429) — the comisiones eje missed the same discipline.
**Fix:** Key the intersection on the composite identity, e.g.:
```tsx
const keyOf = (c: ComisionRow) => `${c.camara}::${c.nombre}`;
```
and only render the plain name in the shared list (identical camara by construction). If comisiones mixtas/bicamerales must intersect cross-chamber, gate that on the row's declared `tipo`/`origen`, never on the name string.

### CR-03: RPC 0067 omits `statement_timeout` — regression of the bounded security-definer discipline (0064 family standard)

**File:** `supabase/migrations/0067_militancia_historica_compartida.sql:40-42`
**Issue:** The function is declared `security definer set search_path = ''` but has **no `set statement_timeout`**. Migration 0064 (`0064_bounded_rpc_statement_timeout.sql`) added `set statement_timeout = '5s'` to all 9 interface RPCs precisely as the day-1 DoS cap, and 0066 explicitly carried the "molde 0064: security definer, search_path='', statement_timeout='5s', LIMIT" forward. 0067 mirrors 0061 (the pre-0064 shape) instead of the current standard — and it is the *heaviest* query of the cross-link family (self-join on `parlamentario_militancia` plus a correlated NOT EXISTS with a second self-join). The project's secdef discipline lists statement_timeout as mandatory; its absence here is an unbounded-execution regression on a service_role-reachable path.
**Fix:**
```sql
create or replace function public.militancia_historica_compartida(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$ ... $$;
```
Re-apply (drop/recreate re-triggers default privileges → keep the double-revoke) and add a pgTAP assertion on the config (see WR-05).

## Warnings

### WR-01: `FECHA_COBERTURA` hardcoded to "2026-07-24" — every provenance/absence claim on /comparar goes stale (false) from the next day onward

**File:** `app/app/comparar/page.tsx:45` (used at lines 237, 241, 260, 267, 279, 283, 303, 314, 331, 335, 356, 365, 379, 383)
**Issue:** All eje provenance lines ("Fuente: … · según fuente al 2026-07-24") and all absence declarations ("En las fuentes consultadas al 2026-07-24, no comparten…") interpolate a build-time constant equal to the ship date. The route is `force-dynamic`, so from 2026-07-25 onward the page permanently asserts a consultation date that is no longer true — on a platform whose core value is "qué pasó, cuándo y según qué fuente." The file's own comment claims "la provenance por dato viaja en cada fila" — but the row-level `fecha_captura` (present on `ComisionRow`) is never used.
**Fix:** Derive the date per eje from the rows' `fecha_captura` (max of A/B rows; fall back honestly when absent), or at minimum compute the date at request time (`new Date().toISOString().slice(0, 10)`) if the copy means "consulted now." Do not freeze it at authoring time.

### WR-02: Militancia absence copy is false for current co-partisans who also shared a historic party (net-new semantics leak)

**File:** `app/app/comparar/page.tsx:236-239`
**Issue:** The 0067 RPC is net-new-only by design: it **excludes** every pair that shares the vigente alias, even if that pair *also* shared a historic party. On the ficha that is correct (copartidarios covers the vigente case in a sibling block). But `/comparar` reuses it as the sole militancia source and renders, for two current co-partisans with shared history: **"En las fuentes consultadas al …, no comparten militancia histórica."** — a false statement produced by the net-new exclusion, not by the sources. (The positive copy at lines 229-234 correctly scopes itself with "(sin compartir el partido vigente)"; the absence copy does not.)
**Fix:** Scope the absence copy to the RPC's actual semantics, e.g. "…no registran militancia histórica compartida fuera del partido vigente." — or detect the vigente-shared case from the roster (`partido` is already on `ParlamentarioListadoRow`) and render the honest variant ("Comparten el partido vigente; la militancia histórica compartida adicional no se registra en este eje.").

### WR-03: 0067 matches on alias with no temporal-overlap check — "Compartieron militancia" can assert co-membership that never coincided in time

**File:** `supabase/migrations/0067_militancia_historica_compartida.sql:55-58`; copy at `app/app/parlamentario/[id]/page.tsx:445` and `app/app/comparar/page.tsx:231-233`
**Issue:** The join is `m2.partido_alias = m1.partido_alias` with no predicate on the militancy date ranges. A militated in party X 1990-1998; B joined X in 2015: they match, and the UI renders "Compartieron militancia en un partido" / "Compartieron militancia en algún partido" — past-tense phrasing that implies they were in the party *together*, a fact no source declares. `parlamentario_militancia` carries `desde` (used by `militancias_de_parlamentario` in 0060), so an overlap predicate is feasible.
**Fix:** Either add a range-overlap condition (`m1.desde/hasta` overlaps `m2.desde/hasta`, with NULL hasta = open-ended) to make the copy true, or soften the copy to what the data actually supports: "Ambos militaron en el mismo partido" (both were members at some point). Pick one deliberately; today the query and the copy disagree.

### WR-04: RelacionesSection renders heading + leyenda over an empty grid when all five blocks are N=0 — undeclared empty state

**File:** `app/components/relaciones-section.tsx:41-59`; mount at `app/app/parlamentario/[id]/page.tsx:264-290`
**Issue:** Every `CrossLinkBloque` returns `null` at N=0, and each Suspense fallback is `null`. For a parlamentario with zero relations on all five ejes, the ficha shows "Relaciones con otros parlamentarios" + the anti-causal leyenda above a completely empty grid — silence where the regime requires a declared absence ("vacío honesto declarado," the standard every other surface follows). The component's own JSDoc (lines 36-39) explicitly defers the total-omission contract to `page.tsx` "si se desea" — and `page.tsx` never implements it, so nobody owns the contract.
**Fix:** Either have `page.tsx` await the five readers before mounting (omit the section when all `total_n` are 0 — trades streaming for correctness), or render an explicit declared-absence line inside the section (e.g. "Sin relaciones registradas en las fuentes consultadas." as a grid-level empty fallback). The current comment-only deferral leaves the honest-empty rule unenforced.

### WR-05: pgTAP 0067 does not assert the full ACL/config posture — `authenticated` revoke and function config unchecked

**File:** `supabase/tests/0067_militancia_historica_compartida.test.sql:23` (and missing assertions)
**Issue:** The migration double-revokes `from public` and `from anon, authenticated` (0067:81-82), but the test only asserts `has_function_privilege('anon', …) = false`. The `authenticated` leg — a named part of the double-revoke discipline (lockdown-guard 0065 precedent: "lockdown-guard sin authenticated" was flagged as a gap before) — is untested, so a future drop/recreate that re-emits only the anon revoke passes green. There is also no assertion on `proconfig` (`search_path=''`, and `statement_timeout` once CR-03 lands), and the `prosecdef` check at line 20 uses a bare `proname` subquery that errors (multiple rows) if an overload ever appears.
**Fix:** Bump `plan(6)` → `plan(8)` and add:
```sql
select is(has_function_privilege('authenticated', 'public.militancia_historica_compartida(text)', 'execute'), false,
  'authenticated SIN execute sobre militancia_historica_compartida');
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.militancia_historica_compartida(text)'::regprocedure) ~ 'search_path=',
  'search_path fijado en la función');
```
and scope the prosecdef subquery by `oid = '…(text)'::regprocedure`.

## Info

### IN-01: Comment claims Suspense makes cross-link failures non-fatal — Suspense does not catch errors

**File:** `app/app/parlamentario/[id]/page.tsx:256-258`
**Issue:** The REL-02 comment states "Cada bloque conserva su propio `<Suspense fallback={null}>` para streaming independiente (un fallo no tumba la ficha…)". Suspense only handles pending promises; a thrown RPC error in a block propagates to the nearest error boundary (the route-level one — there is none nested here), degrading the whole route to its error UI. That outcome is actually what #34 wants (error ≠ empty), but the comment documents the opposite behavior and will mislead the next maintainer into relying on per-block isolation that does not exist.
**Fix:** Correct the comment: Suspense gives streaming independence, not fault isolation; a reader error surfaces at the route error boundary by design (#34).

### IN-02: lockdown-guard still anchors on `process.cwd()` while the sibling guard migrated to `import.meta.dirname` for the known pnpm cwd bug

**File:** `app/lib/lockdown-guard.test.ts:43`
**Issue:** `anti-insinuacion-guard.test.ts:64` explicitly moved to `import.meta.dirname` (WR-06) citing the v8.1 `process.cwd` bug under `pnpm --filter exec` that made a guard scan zero files silently. lockdown-guard keeps `APP_ROOT = process.cwd()`. Its sanity assertions (`sourceFiles.length > 10`, migrations `readdirSync` at collection time) make the failure loud rather than silent, so this is not exploitable today — but the inconsistency re-imports the footgun the other guard just documented away.
**Fix:** `const APP_ROOT = path.resolve(import.meta.dirname, "..");` (file lives in `app/lib/`), mirroring WR-06.

### IN-03: /comparar canonical-order "behavior" test is a source-regex scan; mock roster passed with `as never`

**File:** `app/app/comparar/page.test.tsx:195-199, 125`
**Issue:** The test named "orden canónico: page.tsx ordena a/b alfabéticamente" only greps the source for `.filter(...).sort()` — it never renders `?a=D1002&b=D1001` and asserts the slots normalized, so a broken comparator (e.g. `.sort(() => 0)` refactor) still passes. Separately, `roster: ROSTER_DEFAULT as never` (line 125) erases the type contract the fixture is supposed to exercise; `as ParlamentarioListadoRow[]` would keep the fixture honest against type drift.
**Fix:** Add one behavioral case: `renderPage({ a: "D1002", b: "D1001" })` asserting the A column renders "Ana Prueba" first (or that `CompararEjes` received `a="D1001"`); replace `as never` with the real row type.

### IN-04: Militancia eje column B is a dead-end ("Ver la ficha…" with no link)

**File:** `app/app/comparar/page.tsx:400-413`
**Issue:** `ejeColMilitancia(nombreB, undefined)` renders "Ver la ficha para el detalle de militancias." as plain text with no anchor to `/parlamentario/[id]`, so the instruction is not actionable from the page.
**Fix:** Render it as a link: `<a href={`/parlamentario/${id}`} className="underline …">Ver la ficha…</a>` (id is already regex-validated), or drop the instruction and mirror A's honest count once CR-01's `total_n` fix lands.

---

_Reviewed: 2026-07-24T20:35:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
