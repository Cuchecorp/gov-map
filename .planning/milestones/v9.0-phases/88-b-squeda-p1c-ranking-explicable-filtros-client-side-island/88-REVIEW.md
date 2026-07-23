---
phase: 88-b-squeda-p1c-ranking-explicable-filtros-client-side-island
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - app/lib/estado-bucket.ts
  - app/lib/estado-bucket.test.ts
  - app/components/buscar-filtros.tsx
  - app/components/buscar-filtros.test.tsx
  - app/app/buscar/page.tsx
  - app/components/search-result-card.tsx
  - app/lib/types.ts
  - app/lib/anti-insinuacion-guard.test.ts
  - app/app/buscar/resultados-error.test.tsx
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 88: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 7 (+2 supporting: types.ts, camara-chip/etapa-badge cross-ref)
**Status:** issues_found

## Summary

Reviewed the filtros island (`buscar-filtros.tsx`), the state normalizer
(`estado-bucket.ts`), the slice-enrichment in `page.tsx`, the extended
`SearchResultCard`, and the test files. The normalizer is clean, honest, and
well-tested (order-matters precedence, `sin_dato` fallback, `deriveAnio` guards
all correct). XSS surface is clean — every source string renders through JSX
escape, zero `dangerouslySetInnerHTML`.

The dominant defect is architectural: **the island is wired into `page.tsx`
without a `renderRow` slot while a separate static result section is also
rendered**, so filtering/reordering has zero effect on the "real" result cards
and the page shows the result list twice. This makes the phase's core feature
(client-side filtering) non-functional as integrated. Several tests are
structurally vacuous (assertions guarded by `if` that can be skipped silently),
and the LOCKED relevance tie-break (Mensaje-before-Moción, then recency) is not
implemented in the default order mode.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Island filters/reorders are disconnected from the rendered result cards; result list is duplicated

**File:** `app/app/buscar/page.tsx:214-236`
**Issue:** `page.tsx` renders the island `<BuscarFiltros slice={sliceEnriquecido} />`
with **no `renderRow` prop**, then renders a **separate static `<section>`** of
`SearchResultCard`s directly below it (lines 215-236). Two consequences:

1. Because `renderRow` is omitted, the island falls back to its own minimal
   reference cards (`buscar-filtros.tsx:476-517`, `<article>` per row). So the
   full result set is rendered **twice** — once as island `<article>`s and once
   as `SearchResultCard`s — with every boletín/título appearing duplicated in
   the DOM.
2. The user-facing `SearchResultCard` list is server-rendered, static, and
   **never reacts** to the island's `useState` facet/order state. Clicking any
   facet chip or order toggle filters/reorders only the island's throwaway
   reference cards, not the primary cards the citizen reads. The phase's core
   deliverable (FILT-01 "facetas filtran sin re-buscar", RANK-01 reorder) does
   not affect the visible results.

The island was clearly designed to own rendering via `renderRow`
(`buscar-filtros.tsx:167,476`), but `page.tsx` never passes it and duplicates
the list instead.

**Fix:** Pass the card renderer into the island and delete the standalone
`<section>`, so a single filtered/reordered list is the source of truth:
```tsx
<BuscarFiltros
  slice={sliceEnriquecido}
  renderRow={(p) => {
    const raw = porBoletin.get(p.boletin);
    return (
      <SearchResultCard
        key={p.boletin}
        boletin={p.boletin}
        titulo={p.titulo}
        materia={raw?.materia ?? null}
        estado={raw?.estado ?? null}
        camaraOrigen={p.camaraOrigen}
        iniciativa={p.iniciativa}
        anio={p.anio}
        provenance={{
          capturedAt: raw?.fecha_captura ? new Date(raw.fecha_captura) : null,
          sourceName: sourceLabel(raw?.origen ?? null),
          sourceUrl: raw?.enlace ?? null,
        }}
      />
    );
  }}
/>
// remove the separate <section className="mt-6 space-y-4"> … </section>
```
Note `renderRow` must return an element with a stable `key`, or key the wrapper
inside the island's `listaVisible.map`.

## Warnings

### WR-01: LOCKED relevance tie-break (Mensaje > Moción, then recency) is not implemented

**File:** `app/components/buscar-filtros.tsx:60-83`
**Issue:** UI-SPEC §RANK-01 and CONTEXT LOCKED both state: "Relevance ties →
Mensaje (Ejecutivo) before Moción, then more recent before older." The default
`"relevancia"` branch in `applyOrder` (lines 61-64) returns `rows` unchanged —
it applies **no tie-break at all**. The declared, honest ranking rule shown in
the legend (`LEYENDA_ORDEN`) therefore does not match actual behavior: the
legend promises Ejecutivo-first + recency on ties, but nothing enforces it. This
is a correctness gap against a LOCKED spec and an honesty gap (legend claims a
rule the code does not apply).
**Fix:** Apply a stable tie-break within equal-relevance runs. Since the input
order already encodes relevance and JS sort is stable, a positional secondary
key is needed to preserve relevance as the primary sort:
```ts
if (mode === "relevancia") {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      // primary: retrieval rank (input index) — preserved as tie group
      // secondary within a tie is impossible without an explicit rank field;
      // if ties are not distinguishable in the slice, document that the
      // legend overstates and simplify the copy. Otherwise carry a `rank`
      // field on BuscarSliceRow and compare rank first, then Mensaje, then anio.
      return a.i - b.i;
    })
    .map((x) => x.r);
}
```
Either carry the retrieval rank explicitly on the slice so genuine ties can be
detected and broken by Mensaje/recency, or soften `LEYENDA_ORDEN` to match what
the code actually does. Do not ship a legend that claims an unimplemented rule.

### WR-02: Year derived from earliest event of ANY type, not the "Ingreso" event

**File:** `app/app/buscar/page.tsx:157-178`
**Issue:** UI-SPEC §Year facet specifies the year comes from "the earliest
tramitación event ('Ingreso') `fecha`". The query selects only `boletin, fecha`
(no `tipo`) and takes `min(fecha)` across **all** event types (lines 157-161,
173-177). If the earliest event for a boletín is not the filing/Ingreso event
(e.g. a back-dated or mis-typed event, or an event predating the actual ingreso),
the derived "year" silently misrepresents the project's filing year — presented
to the citizen as a factual year chip. The type doc (`types.ts:117`) calls it an
"earliest filing-date proxy", but the spec asked specifically for the Ingreso
event.
**Fix:** Select `tipo` and prefer the earliest event whose `tipo` matches the
Ingreso semantic; fall back to overall-min only if no Ingreso event exists:
```ts
.select("boletin, fecha, tipo")
// then: prefer first event where /ingreso/i.test(tipo), else first overall
```

### WR-03: `tramitacion_evento.fecha` typed non-null but Postgres/asc ordering + slice(0,4) can admit malformed dates

**File:** `app/app/buscar/page.tsx:171-177`
**Issue:** `eventos` is typed `Pick<TramitacionEventoRow,"boletin"|"fecha">` with
`fecha: string`. The min-per-boletín map takes whatever the first row's `fecha`
is. `.order("fecha", {ascending:true})` in Postgres sorts NULLs LAST for asc, so
a non-null min is picked when any non-null exists — acceptable. But `deriveAnio`
is the only guard against a malformed `fecha`; if `fecha` were ever an empty
string or non-ISO text, the earliest such row (empty string sorts before digits)
could become the "min" and yield `null` year even when a valid later date exists.
Low-likelihood given the source, but the min-selection trusts lexicographic
order to equal chronological order, which only holds for well-formed ISO dates.
**Fix:** Filter to parseable dates before taking min, or compute min via
`deriveAnio`-valid comparison rather than relying on lexical `.order()`:
```ts
const valid = eventos.filter((e) => deriveAnio(e.fecha) != null);
// min by actual date, then deriveAnio
```

### WR-04: Empty-after-filter test can pass with zero assertions

**File:** `app/components/buscar-filtros.test.tsx:410-422`
**Issue:** The core assertions of the empty-state test are wrapped in
`if (chipSenado) { … }`. If `chipSenado` is `undefined` (e.g. the "Senado" chip
query returns no unpressed match after a DOM change), the block is skipped and
the test passes **without asserting anything** — a false-green. An adversarial
refactor that breaks the empty-state would not be caught.
**Fix:** Assert the precondition, then assert unconditionally:
```ts
expect(chipSenado).toBeDefined();
fireEvent.click(chipSenado!);
expect(screen.getByText("Ningún resultado con estos filtros")).toBeInTheDocument();
```

### WR-05: "Mensajes primero" order test guards its only assertion behind an `if`

**File:** `app/components/buscar-filtros.test.tsx:371-373`
**Issue:** `if (firstMocion !== -1 && lastMensaje !== -1) { expect(...).toBeLessThan(...) }`.
If either index is -1 (which would itself indicate the render/order broke), the
assertion is skipped and the test is a no-op green. The test also relies on
`a.textContent?.includes("Mensaje")` — but the empty-state heading and other copy
never contain "Mensaje", so this is fragile substring matching rather than a
structural check of order.
**Fix:** Assert both indices are found, then compare unconditionally; prefer
reading the iniciativa chip text per `<article>` rather than whole-`textContent`
substring matching.

### WR-06: Anti-insinuación guard resolves scan paths from `process.cwd()`, fragile under pnpm workspace exec

**File:** `app/lib/anti-insinuacion-guard.test.ts:57,303-320`
**Issue:** `APP_ROOT = process.cwd()` and every scanned path is
`path.join(APP_ROOT, rel)`. Memory notes (v8.1) record a real prior bug where
CLIs under `pnpm --filter exec` had a `process.cwd()` mismatch. If vitest is ever
invoked from the repo root rather than `app/`, `readFileSync` throws, the
`catch { continue; }` swallows it, and **every** BÚSQUEDA surface is silently
skipped — the guard passes green while scanning nothing. The new
`SUPERFICIES_BUSQUEDA` entries (lines 153-156) inherit this blind spot. The
sanity test (line 302) only asserts one legacy file exists, not that the new
búsqueda files were actually scanned.
**Fix:** Anchor paths to the test file via `import.meta.dirname` (per project
gotcha "jsdom rompe new URL(import.meta.url)"), and add a sanity assertion that
`buscar-filtros.tsx` was read with non-trivial length, so a cwd/path miss fails
loudly instead of skipping:
```ts
const APP_ROOT = path.resolve(import.meta.dirname, "..");
// sanity: assert buscar-filtros.tsx is scannable
expect(readFileSync(path.join(APP_ROOT, "components/buscar-filtros.tsx"), "utf-8").length)
  .toBeGreaterThan(100);
```

## Info

### IN-01: `estado`/`etapa` fallback in page.tsx diverges slightly from documented call-site

**File:** `app/app/buscar/page.tsx:192`
**Issue:** `const estadoInput = (p.estado && p.estado.trim()) ? p.estado : p.etapa;`
passes the **untrimmed** `p.estado` (or `p.etapa`) into `estadoBucket`. The
`estado-bucket.ts` JSDoc (lines 110-112) recommends `p.estado?.trim() || p.etapa?.trim() || null`.
Functionally equivalent here because `estadoBucket` trims internally
(`if (!v.trim()) return "sin_dato"`), but a whitespace-only `p.etapa` would be
passed through rather than pre-normalized to `null`. Harmless given the internal
trim; align for consistency with the documented contract.
**Fix:** `const estadoInput = p.estado?.trim() || p.etapa?.trim() || null;`

### IN-02: `EtapaBadge` (used by SearchResultCard) still buckets any `"ley"` → Promulgado/Ley — the exact latent bug the normalizer avoids

**File:** `app/components/etapa-badge.tsx:19`
**Issue:** `SearchResultCard` renders `<EtapaBadge estado={raw?.estado} />`, and
`resolveVariant` matches `v.includes("ley")` → green "Promulgado / Ley" **before**
checking `tramit`. This is precisely the order-matters bug `estado-bucket.ts`
was written to fix (see its lines 68-81). So the card badge and the facet bucket
can disagree for a value like "En tramitación … ley …": the facet says
`En tramitación`, the badge says `Promulgado / Ley`. Not introduced by this
phase, but the two surfaces now sit side by side and the inconsistency becomes
visible. Consider having `EtapaBadge` consume `estadoBucket` + `ETIQUETA_BUCKET`
to unify.
**Fix:** Route `EtapaBadge` through the same normalizer, or reorder its checks so
`tramit` wins over bare `ley`.

### IN-03: `hasta` count uses `ordenados.length` but the island can filter the visible list

**File:** `app/app/buscar/page.tsx:206-209`
**Issue:** `countCopy` ("Resultados 1–20 …") is computed from `ordenados.length`
(the full hydrated page), but once CR-01 is fixed and the island filters the
list, the header count will not reflect the filtered subset. This is arguably
correct (the header describes the retrieval page, the island legend describes
"de estos N"), but the two counters sitting together may confuse — the header
says "20" while the visible list shows 3 after a facet is engaged. Consider a
note or letting the island own a "mostrando X de N" line.
**Fix:** Optional — clarify copy or surface a filtered-count line inside the
island.

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
