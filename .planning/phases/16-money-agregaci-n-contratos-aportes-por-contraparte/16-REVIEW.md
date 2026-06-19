---
phase: 16-money-agregaci-n-contratos-aportes-por-contraparte
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - supabase/migrations/0025_agregacion.sql
  - supabase/tests/0026_agregacion.test.sql
  - app/app/contraparte/[id]/page.tsx
  - app/app/contraparte/[id]/not-found.tsx
  - app/app/contraparte/[id]/page.test.tsx
  - app/components/contratos-por-contraparte.tsx
  - app/components/contratos-por-contraparte.test.tsx
  - app/components/aportes-por-contraparte.tsx
  - app/components/aportes-por-contraparte.test.tsx
  - app/lib/buscar.ts
  - app/vitest.config.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: fixes_applied
fixes:
  fixed_at: 2026-06-19
  scope: critical_warning
  tests: "dinero 88/88, app 178/178, tsc no new errors"
  resolved:
    CR-01: 9545e45  # normalize SERVEL tipo_persona to juridica|natural enum
    WR-01: edb628d  # remove unreachable 'consultado sin X' honest state (2 states)
    WR-02: 8a6d028  # widen CONTRAPARTE_ID_RE to Unicode letters (acentos/ñ)
    WR-03: 5f14c4b  # remove orphaned contrapartes_listado() RPC
    WR-04: edb628d  # drop fechaCorte-from-row-0 derivation (folded into WR-01)
    WR-05: 5802d67  # bound RPC filas payload (cap 500), conteo stays real count(*)
  operator_reapply_required:
    - "0025_agregacion.sql (WR-03 removal + WR-05 cap) -- re-apply to remote, then re-run 0026_agregacion.test.sql pgTAP against the applied schema"
  out_of_scope:
    - "IN-01, IN-03: Info, not fixed (per scope)"
    - "IN-02: folded into WR-05 (count line now uses RPC conteo)"
---

# Phase 16: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 16 adds the public aggregation RPC `agregado_por_contraparte` plus the
`/contraparte/[id]` page and its two MONEY lanes. I verified the five hard
SECURITY/HONESTY rules against the migration, the page, the components, and the
upstream writers/schemas they depend on.

**The PII guarantee and the whole-page gate hold.** The RPC keys exclusively off
public fact-row columns (`contrato.proveedor_nombre` / `aporte.donante_nombre`),
never references `contratista` / `donante`, never projects `donante_id` /
`rut_donante`, and the pgTAP introspects the function body to prove it. The
page-level gate is the first statement, runs before `await params` and before any
RPC, the test proves the DB is never touched with the gate OFF, and the
non-jurídica defense-in-depth `notFound()` is present and tested. Contratos and
aportes live in separate `mt-12` lanes, no vote data appears anywhere, no money
total is synthesized, and attribution strings are correct ("mención de la fuente"
/ "términos de uso por verificar", never CC BY 4.0).

**However, the jurídica PII filter is silently broken on the aportes facet.** The
RPC filters `aporte.tipo_persona = 'juridica'` (exact, accent-sensitive), but the
SERVEL writer stores that column as the *verbatim* "TIPO APORTANTE" spreadsheet
value (free-form `string`), not the normalized `'juridica' | 'natural'` enum that
the contrato path uses. The filter that is supposed to be the load-bearing PII gate
for aportes will not match the data the source actually produces. This is the
Critical finding. Four lower-severity correctness/robustness issues follow (an
unreachable honest state, an over-restrictive id regex that breaks accented company
names, an orphaned ungated listing RPC, and a state-derivation that can't
distinguish "checked, zero" from "never checked").

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Aportes jurídica filter does not match the data the SERVEL writer stores — PII gate is non-functional on the aportes facet

> **RESOLVED (9545e45):** Normalized `tipo_persona` at parse time in `parse-servel.ts`
> (`normalizarTipoPersona`) to the canonical `'juridica' | 'natural'` enum the ChileCompra
> path uses, fail-closed (unknown/empty → `'natural'`, never exposed by name). Tightened
> `model-servel.ts` types/zod to the enum, updated test fixtures, and added data-level pgTAP
> asserts proving a jurídica projects and a natural is excluded. Verified: parse-servel unit
> tests assert "Persona Jurídica" → `'juridica'` and that a natural never reaches the filter.

**File:** `supabase/migrations/0025_agregacion.sql:131-133`
**Issue:**
The aportes facet filters with an exact, case- and accent-sensitive equality:
```sql
where left(p_id, 2) = 'd:'
  and a.tipo_persona = 'juridica'
  and a.donante_nombre = substring(p_id from 3)
```
The PII guarantee for this phase rests on `tipo_persona = 'juridica'` reliably
excluding persona-natural donors. But on the aporte path that column is **not** the
normalized enum. The SERVEL parser writes it verbatim from the source spreadsheet:

- `packages/dinero/src/parse-servel.ts:225` → `tipoPersona: cruda.tipoAportante`
  (the raw `"TIPO APORTANTE"` cell, `parse-servel.ts:161`).
- `packages/dinero/src/model-servel.ts:51` → `export type TipoPersonaDonante = string;`
  (free-form, no enum, no normalization).
- `packages/dinero/src/writer-supabase-servel.ts:56` → `tipo_persona: f.tipoPersona`
  (written through unchanged).

Contrast the contrato path, which *does* normalize to the literal `'juridica'` /
`'natural'` (`packages/dinero/src/parse-chilecompra.ts:31`,
`packages/dinero/src/model.ts:70,97`). The migration's own O1 note and the analog
`0023_dinero.sql:75` comment ("'juridica'") describe the *contrato* convention and
were copied onto the aporte facet, but the aporte column does not follow it.

SERVEL's "TIPO APORTANTE" values are human-facing labels (e.g. `"Persona Jurídica"`,
`"PERSONA JURIDICA"`, `"Jurídica"`), none of which equal the lowercase, unaccented
literal `'juridica'`. Two failure modes, both bad:

1. **Silent total miss (most likely):** real aportes rows never satisfy
   `tipo_persona = 'juridica'`, so the aportes facet returns zero rows for every
   real jurídica donante. The lane renders "no consultado" forever — a false
   negative presented as honest absence. MONEY-05's aportes half is dead.
2. **PII leak (if the source label is lowercased/unaccented anywhere upstream, or
   a future export uses a different casing):** because the filter is the *only*
   thing standing between a persona-natural donor name and the public RPC output,
   any value that is NOT exactly `'juridica'` is excluded — which is fail-safe for
   leak *only by accident*. The guarantee is supposed to be "project ONLY jurídica",
   and it currently hinges on an exact string the writer never emits, which is not a
   guarantee, it is a coincidence. A casing/normalization change upstream (e.g.
   storing `"juridica"` for jurídica AND `"natural"` correctly) is the safe case;
   any other normalization (e.g. `"empresa"`, `"PJ"`, or leaving accents) breaks the
   invariant the phase is built on.

The pgTAP does NOT catch this: `0026_agregacion.test.sql:44-46` only asserts the
function *body* contains the substring `juridica` (`pg_get_functiondef(...) ilike
'%juridica%'`). It proves the literal is present in the SQL text, not that it
matches any stored data. The PII guarantee is "verifiable, not convention" only for
the contrato facet.

**Fix:**
Make the filter robust to the verbatim SERVEL label AND assert it against real data,
not just the function text. Either normalize at write time (preferred — mirror the
contrato path so the column is a true `'juridica' | 'natural'` enum), or normalize
in the RPC and tighten the test:
```sql
-- RPC: tolerate the verbatim SERVEL label until the writer normalizes it.
and lower(translate(a.tipo_persona, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) like '%juridica%'
```
and add a pgTAP assertion that inserts a `tipo_persona = 'Persona Natural'` aporte
row and proves the RPC returns ZERO rows for it (data-level, not body-level). The
durable fix is to normalize `tipoAportante → 'juridica' | 'natural'` in
`parse-servel.ts` / `model-servel.ts` so the contrato and aporte PII filters share
one canonical domain. Until then, the aportes lane is either broken or
silently relying on luck for its PII guarantee.

## Warnings

### WR-01: `consultado_sin_contratos` / `consultado_sin_aportes` honest states are unreachable — "checked, zero" collapses into "never checked"

> **RESOLVED (edb628d):** Took option (b). There is no per-contraparte ingestion marker
> (the `*_ingesta_estado` tables key by parlamentario, not contraparte) and the id is
> prefixed so each page dispatches only one facet — the "checked, zero" distinction cannot
> be made honestly from the data. Removed the dead third state from both components, leaving
> TWO honest states (`no_consultado` weak copy / `con_*`). The empty state always renders the
> weaker "aún no consolidado… esto no significa que no existan", never a verified-zero.
> Updated component tests. REQUIRES HUMAN VERIFICATION (state-derivation logic).

**File:** `app/components/contratos-por-contraparte.tsx:316-322` (mirror at `app/components/aportes-por-contraparte.tsx:363-369`)
**Issue:**
The spec (16-UI-SPEC §Honest States) defines three textually-distinct lane states,
and the components derive them as:
```ts
if (todos.length > 0)            estado = "con_contratos";
else if (facetaContratos === null) estado = "no_consultado";
else                              estado = "consultado_sin_contratos";
```
But the RPC uses `GROUP BY` (`0025_agregacion.sql:98,134`). A `GROUP BY` over zero
matching fact rows yields **zero groups**, so the RPC can never return a faceta row
whose `filas` array is empty. Therefore `facetaContratos` is either `null`
(no group) or non-null with `≥1` row — the middle branch
(`facetaContratos !== null && todos.length === 0`) is **dead code**. The honest
distinction the spec demands — "Revisamos ChileCompra y no se registran contratos a
esa fecha" vs. "Aún no hemos consolidado…" — collapses: a genuinely-empty result is
indistinguishable from a never-queried one, and both render the "no consultado"
copy. This is precisely the "zero rows ≠ clean / absence-of-query ≠ absence-of-facts"
honesty rule the phase is supposed to uphold, and it is silently violated.
**Fix:**
Either (a) add an aggregation/ingestion marker the RPC can return even with zero
fact rows (a `consultado` flag + `fecha_corte` per contraparte, mirroring the
`*_ingesta_estado` tables in 0023/0024), so the component can render the true
"checked, zero" state; or (b) if no such marker is available for a counterparty,
delete the unreachable branch and document in the UI-SPEC that this page has only
two states, so the dead `consultado_sin_*` copy is not mistaken for live behavior.

### WR-02: `CONTRAPARTE_ID_RE` rejects accented / ñ company names, making their routes permanently 404

> **RESOLVED (8a6d028):** Widened `CONTRAPARTE_ID_RE` to `/^[cd]:[\p{L}\p{N} .\-_&]+$/u`
> (Unicode letters/digits + ampersand), keeping it anchored, linear (single `+`, no ReDoS),
> and still rejecting control chars / path traversal (explicit class, no `.`). Added regex
> tests locking accented/ñ names ("Constructora Peñalolén") and traversal/control rejection.

**File:** `app/lib/buscar.ts:44`
**Issue:**
```ts
export const CONTRAPARTE_ID_RE = /^[cd]:[A-Za-z0-9 .\-_]+$/;
```
The aportes contraparte key is `donante_nombre`, and the listing RPC mints ids as
`'d:' || a.donante_nombre` (`0025_agregacion.sql:170`). Chilean razón-social names
routinely contain accents and ñ ("Constructora Ñandú Ltda", "Logística del Maule
S.A.", "Compañía…"). The charset `[A-Za-z0-9 .\-_]` excludes á-ú, Á-Ú, ñ, Ñ, and
ampersand. For any such jurídica donante, `CONTRAPARTE_ID_RE.test(id)` fails at
`page.tsx:57` and the route 404s **before** the DB is touched — the page is
unreachable for a large fraction of legitimate companies, and the contratos facet
(keyed by `rut_proveedor`, ASCII) works while the aportes facet silently does not.
No ReDoS (single linear `+`), and the prefix/traversal guard is sound — the problem
is over-restriction, not over-permissiveness.
**Fix:**
Widen the charset to cover Spanish orthography (and the ampersand), or — more
robustly — base the aportes id on a stable synthetic key (a hash / `donante_id`
surrogate that is itself ASCII and NOT the PII RUT) rather than the raw name, so the
URL contract does not depend on company-name orthography. At minimum:
```ts
export const CONTRAPARTE_ID_RE = /^[cd]:[\p{L}\p{N} .\-_&]+$/u;
```
and add a test fixture with an accented/ñ name to lock it.

### WR-03: `contrapartes_listado()` ships granted-to-anon with no consumer and no gate coupling

> **RESOLVED (5f14c4b):** Took option (a) — removed `contrapartes_listado()` and its grants
> from `0025_agregacion.sql` (confirmed no app consumer; listing page deferred). MONEY-05 is
> satisfied by `agregado_por_contraparte` alone. No pgTAP referenced the listing RPC, so no
> test changes. OPERATOR: re-apply 0025 to remote.

**File:** `supabase/migrations/0025_agregacion.sql:147-182`
**Issue:**
`contrapartes_listado()` is created, `revoke`d from public, and `grant`ed to `anon`,
but no page consumes it (the listing page is deferred per 16-UI-SPEC §Reaching the
route; only `[id]/` exists — confirmed by glob). The phase's exposure model is "data
lock = RPC, presentation lock = `moneyPublicEnabled`". With the page gate OFF
(default), this RPC is nonetheless directly callable by anyone holding the anon key
via Supabase REST, returning the full enumeration of every jurídica contraparte name
+ counts — with zero coupling to `moneyPublicEnabled`. The single-`[id]`
`agregado_por_contraparte` shares this property (it mirrors the shipped
`*_de_parlamentario` analog, which is an accepted, legal-gated debt), but the
*listing* RPC is new, enumerates the whole dataset at once, and has no UI that needs
it yet — it widens the pre-legal-signoff surface for no current benefit.
**Fix:**
Do not ship the public enumeration RPC until its gated consumer exists. Either
remove `contrapartes_listado()` from 0025 and add it with the listing page in a
later phase, or (if it must land now) leave it `revoke`d from `anon` until F13
sign-off so the data lock is real and not solely dependent on the operator never
distributing the anon key. The phase requirement (MONEY-05) is satisfied by the
`[id]` RPC alone.

### WR-04: `fechaCorte` for the "consultado sin" copy is read from row 0, but that branch is unreachable and the fallback masks it

> **RESOLVED (edb628d, folded into WR-01):** Dropped the `fechaCorte`-from-`todos[0]`
> derivation and the `fechaCorte` field from the view data in both components, since its only
> consumer was the unreachable `consultado_sin_*` branch removed in WR-01. Per-row `fecha_corte`
> (in `ContratoFila`/`AporteFila`) is untouched.

**File:** `app/components/contratos-por-contraparte.tsx:326` (mirror at `aportes-por-contraparte.tsx:371`)
**Issue:**
```ts
const fechaCorte = todos[0]?.fecha_corte ?? null;
```
`fechaCorte` is only consumed by the `consultado_sin_contratos` / `consultado_sin_aportes`
render branch (to print "corte al {fecha}"). Per WR-01 that branch is unreachable,
and even if it were reachable, `todos[0]` is empty in exactly that state (zero rows),
so `fechaCorte` is always `null` there and the copy silently degrades to the generic
"la fecha de corte" string — i.e. the one place a real cut-off date matters can never
show one. This is a latent honesty gap that becomes visible the moment WR-01 is fixed
naïvely (adding the state without also threading a real `fecha_corte` from a marker).
**Fix:**
Tie `fechaCorte` to the aggregation/ingestion marker proposed in WR-01 (a
per-contraparte `fecha_corte` returned by the RPC even with zero fact rows), not to
`todos[0]`. If the "consultado sin" state is dropped, drop this derivation too.

### WR-05: Client-side full-set pagination means the RPC returns every row of every contraparte in one payload

> **RESOLVED (5802d67):** Added a server-side bound on the `filas` payload — a new
> `agregado_por_contraparte_cap()` helper (500) applied via an ordered subquery `LIMIT` in
> both facets, so the serialized jsonb is bounded and a high-volume contraparte no longer
> risks a thrown RPC error. `conteo` stays the true `count(*)` over the full set. Wired the
> components to use the RPC `conteo` for the neutral count line and `filas.length` only for
> pagination (folds in IN-02, keeping the count truthful when capped). Added data-level pgTAP
> asserts. OPERATOR: re-apply 0025 + re-run 0026 pgTAP. REQUIRES HUMAN VERIFICATION (RPC shape).

**File:** `app/components/contratos-por-contraparte.tsx:329-333` (mirror at `aportes-por-contraparte.tsx:374-378`); `supabase/migrations/0025_agregacion.sql:78-93,111-127`
**Issue:**
The RPC `jsonb_agg`s *all* fact rows for a contraparte into a single `filas` array,
and the component paginates in memory (`todos.slice(start, start + PAGE_SIZE)`). The
"server-driven pagination, PAGE_SIZE 20" contract (16-UI-SPEC §Pagination) is
cosmetic: the full set is always fetched and serialized regardless of page. For a
high-volume jurídica (a large state supplier could have thousands of órdenes) this is
an unbounded single JSON payload. This is flagged not as a perf issue (out of v1
scope) but as a **correctness/robustness** risk: a sufficiently large `jsonb_agg`
result can hit Postgres/PostgREST response limits and surface as a *thrown* RPC error
(`#34` path), turning a legitimate high-activity contraparte into an error page
rather than a paginated list. The honest-error boundary will fire on real data.
**Fix:**
Push pagination into the RPC (accept `p_page` / `p_limit`, return a bounded slice
plus the total count for "Página N de M"), so the payload is bounded and the
"server-driven" claim is true. The neutral `conteo` the RPC already computes can
back the page count without shipping every row.

## Info

### IN-01: `searchParams` is awaited at page level but only consumed by the lanes — fine, but the page passes the resolved object, not the per-lane param

**File:** `app/app/contraparte/[id]/page.tsx:54,76,91`
**Issue:** The page resolves `sp = await searchParams` once and hands the whole
object to both lanes, each of which reads its own namespaced key
(`contratosPage` / `aportesPage`). Correct and intentional, but note both lanes call
`agregado_por_contraparte` independently (`contratos-…:282`, `aportes-…:331`),
issuing two identical RPCs per page render where one dispatched call could serve
both facets. Not a bug; a duplicated round-trip worth consolidating if the RPC is
later split or memoized.
**Fix:** Optional — fetch once in the page (or a shared cached loader) and pass the
faceted slice to each lane.

### IN-02: `conteo` returned by the RPC is never used by the UI; the count line is recomputed from `filas.length`

**File:** `app/components/contratos-por-contraparte.tsx:329` / `aportes-por-contraparte.tsx:374`; RPC `0025_agregacion.sql:77,110`
**Issue:** The RPC computes a neutral `conteo` (`count(*)`), but the components
ignore it and derive `totalContratos`/`totalAportes` from `todos.length`. They are
equal today only because the RPC ships all rows (see WR-05). If WR-05 is fixed by
returning a bounded slice, `filas.length` will diverge from the true count and the
"{N} contrato(s) registrado(s)" line will silently undercount. Decide which is the
source of truth now.
**Fix:** Use the RPC's `conteo` for the count line; reserve `filas.length` for the
rendered page only.

### IN-03: pgTAP `plan(16)` count is correct but the body-introspection asserts are substring checks that can be defeated by comments

**File:** `supabase/tests/0026_agregacion.test.sql:44-58`
**Issue:** The PII asserts use `pg_get_functiondef(...) [not] ilike '%…%'`. Because
`pg_get_functiondef` includes the SQL body but the migration's *explanatory* comments
live outside the function, the asserts are reasonably robust — but a future edit that
mentions `donante_id` in an in-body `--` comment would flip `not ilike '%donante_id%'`
to fail (false positive) or, worse, a refactor that selects `rut_donante` *into an
aliased column not named `rut_donante`* would pass while leaking. The test proves the
literal string is absent, not that the projected columns are PII-free.
**Fix:** Complement the body-substring asserts with a data-level assert: insert a
persona-natural contrato/aporte fixture, call the RPC, and assert the returned
`filas`/`contraparte_nombre` contain neither the natural-person name nor any RUT.
This makes the guarantee behavioral, matching the CR-01 remediation.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
