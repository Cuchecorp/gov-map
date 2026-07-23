---
phase: 91-personas-p2b-ficha-bio-partido-directo-cross-links-factuale
reviewed: 2026-07-22T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - supabase/migrations/0060_bio_partido_publico.sql
  - supabase/tests/0060_bio_partido_publico.test.sql
  - app/lib/types.ts
  - app/lib/lockdown-guard.test.ts
  - app/lib/anti-insinuacion-guard.test.ts
  - app/components/partido-chip.tsx
  - app/components/comisiones-de-parlamentario.tsx
  - app/components/militancias-de-parlamentario.tsx
  - app/components/cross-links-parlamentario.tsx
  - app/components/parlamentarios-filtro.tsx
  - app/components/parlamentario-directory-row.tsx
  - app/components/parlamentario-header.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/parlamentarios/page.tsx
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: fixed
fixed_at: 2026-07-22
fixed_warnings: 6
migration_applied: "0061 (PROD, pgTAP 16/16 + 0060 30/30 verde)"
suite: "app 1112/1112 verde; tsc limpio; guards verdes"
fix_commits:
  - "98e22e6 fix(91): WR-01/WR-03/WR-06 migración 0061 endurece los 4 cross-links"
  - "b0b6eef fix(91): WR-04 PartidoChip plano (tooltip=false) en la fila del directorio"
  - "7547644 fix(91): WR-01 tipa total_n en CrossLinkRow"
  - "629bf94 fix(91): WR-02/WR-05 truncamiento visible + elimina PartidoChip muerto"
---

# Phase 91: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the PERSONAS P2b surface: migration 0060 (8 security-definer RPCs for bio + partido + 4 cross-links), the pgTAP suite, the row types, the two guard tests (lockdown + anti-insinuación), and the seven UI components/pages that consume them.

The security posture is solid: all 8 RPCs use `security definer set search_path = ''` with schema-qualified names, the double-revoke (`from public` + `from anon, authenticated`) is present verbatim on every RPC, `p_id` is parametrized (no string interpolation), every listable query is `LIMIT`-bounded, and the returns tables never expose `rut`/`email`/`partido_alias`/tercero data. The lockdown guard correctly allowlists the 8 new RPCs and would block any grant-to-anon regression. No SQL injection, no hardcoded secrets, no PII leak into the public tree. **Zero BLOCKERS.**

The defects are correctness/quality issues concentrated in two areas: (1) the "honest count" claim on the cross-link blocks is not actually honest — it caps silently at the RPC's `LIMIT 20` and presents the capped number as the total shared; (2) `co_comisionados_de_parlamentario` documents a "neutral alphabetical-by-name" order that its `DISTINCT ON` construction cannot deliver — it orders by `p2.id`. Plus a real accessibility defect: `PartidoChip` mounts a Radix Tooltip trigger (interactive) inside the directory row's `<Link>` (interactive), nesting focusable/clickable elements.

## Structural Findings (fallow)

No `<structural_findings>` block was provided with this review. Section intentionally left empty.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Cross-link "conteo honesto" silently caps at LIMIT 20 and misrepresents it as the total — FIXED (98e22e6 + 7547644 + 629bf94)

**FIXED:** 0061 proyecta `total_n = count(*) over ()` (conteo completo antes del cap) en las 4 cross-link RPCs. `CrossLinkRow.total_n` tipado; page.tsx deriva el conteo con `totalReal(filas)` (lee `total_n` de la fila 0), ya no `filas.length`. Verificado en PROD: un partido con 27 miembros ahora reporta total_n=27 con 20 filas cap-eadas.


**File:** `app/app/parlamentario/[id]/page.tsx:311,315` (and :326-331, :341-346, :356-361); `app/components/cross-links-parlamentario.tsx:22-24,66-67`
**Issue:** Each cross-link wrapper computes `const total = filas.length;` where `filas` is the RPC result, and every cross-link RPC ends in `limit 20` (0060 lines 204, 233, 262, 296). The conteo text then reads e.g. `` `${total} parlamentarios comparten el partido de la militancia vigente.` ``. For any party/committee/zone/co-authorship group with more than 20 members, the ficha renders "20 parlamentarios comparten…" as if 20 were the true shared count, when the real number is larger. This directly contradicts the component's own LOCKED contract ("CONTEO HONESTO: N = filas totales que emite la RPC", lines 22-24) and the `totalN`/`verTodosHref` "Ver los N" affordance (which is dead code here because `verTodosHref` is always `null`, so `excede` is always false — see WR-02). Chilean parties routinely seat far more than 20 diputados, so this fires in production (a party like UDI/RN/PS easily exceeds 20 sitting members).
**Fix:** Return the true total from the RPC independent of the row cap, e.g. add a `total_n` column via a windowed `count(*) over ()` (computed before the `limit`), and drive `conteoTexto` from that while still slicing rows to the visual limit. Alternatively make the copy honest about the cap ("Al menos 20 parlamentarios comparten…") and wire `verTodosHref` so "Ver los N" actually navigates. As written the count is a factual claim the data does not support.
```sql
-- in each cross-link RPC, project the true total alongside the bounded rows:
select ..., count(*) over () as total_n
from ...
order by nombre
limit 20;
```

### WR-02: `verTodosHref` is hardcoded `null` on all 4 blocks, making `totalN`/`excede`/"Ver los N" dead code — FIXED (629bf94)

**FIXED:** `CrossLinkBloque` ahora, cuando `totalN` excede lo mostrado y no hay `verTodosHref`, renderiza una leyenda explícita "Mostrando los primeros N de M." El truncamiento ya NUNCA es silencioso, aun sin cablear "Ver los N" (los ejes zona/comisión/co-autoría no tienen filtro de directorio equivalente todavía). Combinado con WR-01 (total real), el ciudadano ve el total verdadero y sabe cuántos se muestran.


**File:** `app/app/parlamentario/[id]/page.tsx:318,335,349,364`; `app/components/cross-links-parlamentario.tsx:87,124-131`
**Issue:** All four blocks pass `verTodosHref={null}`. In the component, `const excede = totalN > LIMITE_VISUAL && verTodosHref != null;` (line 87) is therefore always `false`, so the entire `{excede && (<a>Ver los {totalN}</a>)}` branch (lines 124-131) is unreachable. Combined with WR-01, this means: when a block truly has >20 members, the RPC caps to 20, `total===20`, the count says "20 comparten", and there is no "Ver los N" escape — the user has no signal that the list is truncated at all. The truncation is completely invisible. This is a WARNING (not just dead code) because it is the mechanism that makes WR-01's dishonest count user-facing with no mitigation.
**Fix:** Either wire `verTodosHref` for the partido axis (the SUMMARY notes the island doesn't accept `?partido=` yet — cabling that deep-link closes it) and surface a real total (WR-01), or add an explicit "mostrando los primeros 20" caption when the cap is hit so truncation is never silent.

### WR-03: `co_comisionados_de_parlamentario` claims neutral alphabetical order but `DISTINCT ON` forces order-by-id — FIXED (98e22e6)

**FIXED:** 0061 envuelve el `distinct on (p2.id)` en subconsulta y re-ordena por `d.nombre` en la externa. Verificado en PROD: el orden emitido es ahora alfabético por nombre real (Alejandro, Benjamín, Bernardo, Boris, Carlo, Carlos…), no por id interno. El contrato neutral documentado es ahora verdadero.


**File:** `supabase/migrations/0060_bio_partido_publico.sql:244-262`
**Issue:** The comment states "Orden neutral alfabético por nombre" (line 246), and the anti-insinuación principle requires a genuinely neutral (non-ranking) order. But the query is `select distinct on (p2.id) … order by p2.id, c.nombre` (lines 247, 261). Postgres requires the leftmost `ORDER BY` expressions to match the `DISTINCT ON` expressions, so the result set is ordered by `p2.id` (an internal identifier like `D1074`/`S1203`), **not** alphabetically by name. The component then preserves this order verbatim (`cross-links-parlamentario.tsx:85-86` "NO re-ordenar"). The delivered order is neither alphabetical-by-name (as documented) nor a stable neutral order a citizen would expect; it leaks the internal id sort into the public UI ordering. It is not a ranking-by-affinity, so it does not violate the anti-insinuación rule, but the documented contract is false and the order is effectively arbitrary from the user's perspective.
**Fix:** Wrap the `DISTINCT ON` in a subquery and re-sort by name in the outer query so the emitted order matches the documented neutral alphabetical order:
```sql
select id, nombre, camara, comision_nombre
from (
  select distinct on (p2.id) p2.id, <nombre expr> as nombre, p2.camara, c.nombre as comision_nombre
  from public.comision_membresia cm1
  join public.comision_membresia cm2 on cm2.comision_id = cm1.comision_id
  join public.comision c on c.id = cm1.comision_id
  join public.parlamentario p2 on p2.id = cm2.parlamentario_id
  where cm1.parlamentario_id = p_id and cm2.parlamentario_id <> p_id
  order by p2.id, c.nombre
) d
order by d.nombre
limit 20;
```

### WR-04: `PartidoChip` nests a Radix Tooltip trigger (interactive) inside the directory row's `<Link>` (interactive) — FIXED (b0b6eef)

**FIXED:** `PartidoChip` gana la prop `tooltip` (default `true`). Con `tooltip={false}` renderiza un `Badge` PLANO no interactivo cuya procedencia va en `title` + `aria-label` — sin `TooltipTrigger` Radix anidado. `ParlamentarioDirectoryRow` pasa `tooltip={false}` (la fila entera es un `<Link>`); `parlamentario-header.tsx` (chip hoja) mantiene el tooltip interactivo. Suite partido-chip 5/5 verde.


**File:** `app/components/parlamentario-directory-row.tsx:35-47`; `app/components/partido-chip.tsx:62-75`
**Issue:** `ParlamentarioDirectoryRow` wraps its entire content — including `<PartidoChip>` — in `<Link href="/parlamentario/{id}">` (an anchor). `PartidoChip` renders `<TooltipTrigger asChild>` over the Badge; Radix `Tooltip.Trigger` makes its child a focusable, event-bound interactive element (adds tabindex/handlers, defaults to button semantics). Nesting an interactive element inside an anchor is invalid/interaction-hostile: the chip becomes an independent focus stop inside a link, hover/focus that should open the tooltip competes with the link, and clicking the chip navigates the link instead of (or in addition to) showing provenance. The `parlamentario-header.tsx` usage (line 85) is safe because the header chip is not inside a link, but the directory-row usage is a real hydration/a11y defect on all 186 rows. (The `page.test.tsx` passes only because `renderToStaticMarkup` emits the static span and never exercises Radix's interactive behavior — the test does not cover this.)
**Fix:** In the directory row, render the partido as provenance without an interactive tooltip trigger (e.g. a plain badge whose `title`/`aria-label` carries "según fuente al [fecha]"), or move the PartidoChip outside the `<Link>` so the trigger is not nested in the anchor. Keep the tooltip variant only where the chip is not inside another interactive element.

### WR-05: Cross-link RPCs emit no `partido` provenance, so `CrossLinkBloque`'s per-row `PartidoChip` always renders nothing — FIXED (629bf94)

**FIXED:** Se eligió la opción honesta y barata: eliminar el `PartidoChip` por fila (era código muerto — siempre null). `CrossLinkFila` pasa a ser alias de `CrossLinkRow` (se quitan los campos opcionales `partido*`), los 4 bloques pasan `mostrarPartido={false}` (prop ahora deprecada/ignorada), y se quita la rama del chip del render. El partido de cada quien se ve en su propia ficha. Se documenta la decisión en el docstring del componente.


**File:** `app/components/cross-links-parlamentario.tsx:49-54,107-113`; `app/app/parlamentario/[id]/page.tsx:325-337,340-352`; `supabase/migrations/0060_bio_partido_publico.sql:213-234,242-263`
**Issue:** `CrossLinkFila` extends `CrossLinkRow` with optional `partido`/`partido_fecha_captura`/`partido_origen`, and the "misma zona" / "misma comisión" blocks default `mostrarPartido` to true and render `<PartidoChip partido={p.partido ?? null} …>`. But the underlying RPCs `de_la_misma_zona` and `co_comisionados_de_parlamentario` return only `(id, nombre, camara[, comision_nombre])` — they never select `partido`/`partido_fecha_captura`/`partido_origen`. The casts `(await getMismaZona(id)) as CrossLinkFila[]` (page.tsx:326, 341) launder the missing fields past the type system, so `p.partido` is always `undefined` → `PartidoChip` receives `null` → returns null. The "PartidoChip por fila añade contexto en misma zona/comisión" design (SUMMARY, component docstring lines 29-30) is inert: no partido chip ever appears in these blocks. Not a crash, but a silently unfulfilled requirement plus a type assertion masking the gap.
**Fix:** Either add `partido`/`partido_fecha_captura`/`partido_origen` (via the same `es_actual` lateral join used in `parlamentario_publico_v2`) to the `de_la_misma_zona` and `co_comisionados_de_parlamentario` returns tables and select them, or set `mostrarPartido={false}` on those blocks and drop the dead `PartidoChip` branch + the optional fields from `CrossLinkFila`. Avoid the `as CrossLinkFila[]` cast — type the reader to the actual RPC row shape.

### WR-06: `copartidarios` / `de_la_misma_zona` lack `DISTINCT`, risking duplicate rows from multi-row source data — FIXED (98e22e6)

**FIXED:** 0061 añade `distinct on (p2.id)` (envuelto + re-ordenado por nombre, misma técnica que WR-03) a `copartidarios_de_parlamentario` → un copartidario aparece exactamente una vez sin importar cuántas filas `es_actual`/`desde` tenga cualquiera de los dos lados. Esto también endurece el conteo (WR-01) contra inflación por duplicados. `de_la_misma_zona` (sin fan-out, single p2) no requiere DISTINCT — se documenta.


**File:** `supabase/migrations/0060_bio_partido_publico.sql:184-205,213-234`
**Issue:** `copartidarios_de_parlamentario` self-joins `parlamentario_militancia m1 → m2` on `partido_alias` with no `DISTINCT`. The uniqueness constraint on `parlamentario_militancia` is `(parlamentario_id, partido_alias, desde)` (0059:75), which permits a single parlamentario to have multiple `es_actual = true` rows for the same `partido_alias` with different `desde` values (nothing enforces exactly one current militancia per person). If either `m1` (the subject) or `m2` (a copartidario) has >1 such row, the result contains duplicate `id`/`nombre` rows, which then inflate `filas.length` → the conteo (already broken per WR-01) and repeat entries in the list. `de_la_misma_zona` is safe from fan-out (single `p2` table), but `copartidarios` and any future multi-militancia data are not.
**Fix:** Add `distinct` (or `distinct on (p2.id)` wrapped + re-sorted like WR-03) to `copartidarios_de_parlamentario`, so a co-partisan appears exactly once regardless of how many current militancia rows exist on either side. This also hardens the count against duplicate-driven inflation.

## Info

### IN-01: `es_actual` invariant (single current militancia) is assumed but not enforced

**File:** `supabase/migrations/0060_bio_partido_publico.sql:71-78,159-166`; `supabase/migrations/0059_bio_comisiones.sql:62-76`
**Issue:** The `parlamentario_publico_v2` / `parlamentarios_publico_v2` lateral joins rely on `order by mm.desde desc limit 1` to pick the vigente partido, which correctly tolerates multiple `es_actual=true` rows for the header. But nothing in the schema (no partial unique index `where es_actual`) guarantees at most one current militancia per parlamentario, so the "partido vigente" is silently the most-recent-by-`desde` among possibly several. Fine for the header (limit 1), but it is the same latent data shape that makes WR-06 possible.
**Fix:** Consider a partial unique index `unique (parlamentario_id) where es_actual` on `parlamentario_militancia` to make the invariant real, or document explicitly that "vigente = max(desde) among es_actual" is the intended tie-break everywhere.

### IN-02: `militancias-de-parlamentario.tsx` uses `new Date(desde)` on ISO date strings (UTC/local drift)

**File:** `app/components/militancias-de-parlamentario.tsx:25-29`
**Issue:** `rango()` does `fechaCorta(new Date(desde))` where `desde` is a `date` column serialized as `"YYYY-MM-DD"`. `new Date("2024-01-01")` parses as UTC midnight; when `fechaCorta` formats in a negative-offset timezone (Chile is UTC-3/-4) the displayed day can shift to the previous day. Militancia boundaries are not high-stakes, but the same `new Date(isoDate)` pattern silently off-by-one-days a "desde"/"hasta" for users west of UTC.
**Fix:** Parse date-only strings as local (split on `-` and construct `new Date(y, m-1, d)`), or route through the existing `fechaCortaSegura` helper if it already handles date-only inputs.

### IN-03: `de_la_misma_zona` and `copartidarios` self-join could be an expensive cross product but are not the documented concern

**File:** `supabase/migrations/0060_bio_partido_publico.sql:213-234`
**Issue:** `de_la_misma_zona` joins `parlamentario p1 × p2` on an `OR` of two equality predicates; with no index awareness this is a small scan (186 rows) so it is fine in practice, and performance is out of v1 scope. Noting only that the `OR`-join shape is the kind that would not use an index — acceptable at this table size, flagged so it is not mistaken for indexed.
**Fix:** None required at current scale. If the master grows, split into `distrito` and `circunscripcion` UNION branches to allow index usage.

### IN-04: `ComisionRow.camara` type is `"diputados" | "senadores"` while every other row type uses `"diputados" | "senado"`

**File:** `app/lib/types.ts:257` vs `:183,282` etc.
**Issue:** `ComisionRow.camara` is typed `"diputados" | "senadores"` (plural "senadores"), whereas `ParlamentarioPublicoRow`, `ParlamentarioListadoRow`, `CrossLinkRow`, `VotoRow`, etc. all use `"senado"`. `comisiones_de_parlamentario` selects `c.camara` raw from the `comision` table, whose values are not constrained here to either spelling. If any consumer compares `ComisionRow.camara` against a `"senado"` literal it will silently never match. Today `ComisionesDeParlamentario` only string-joins `c.camara` into a line, so it is cosmetic, but the type inconsistency is a latent mismatch.
**Fix:** Confirm the actual `comision.camara` values in PROD and normalize the type to the same union used everywhere (`"diputados" | "senado"`), or document why comisiones use a different spelling.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
