---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
reviewed: 2026-07-07T00:00:00Z
depth: deep
files_reviewed: 20
files_reviewed_list:
  - app/app/agenda/page.tsx
  - app/app/globals.css
  - app/app/parlamentario/[id]/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/app/red/page.tsx
  - app/app/styles/civic-tokens.css
  - app/components/capa1/cruces-capa1.tsx
  - app/components/capa1/lobby-capa1.tsx
  - app/components/capa1/patrimonio-capa1.tsx
  - app/components/capa1/tramitacion-stepper.tsx
  - app/components/capa1/votos-capa1.tsx
  - app/components/carril-accordion.tsx
  - app/components/detalle-colapsable.tsx
  - app/components/ficha-rail.tsx
  - app/components/parlamentario-resumen.tsx
  - app/components/red/nodo-parlamentario.tsx
  - app/components/red/red-graph.tsx
  - app/components/timeline-view.tsx
  - app/lib/parlamentario-resumen-conteos.ts
  - app/lib/use-scrollspy.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: clean
fixed_at: 2026-07-07
fixed:
  - WR-01
  - WR-02
  - WR-03
  - WR-04
  - IN-01
  - IN-02
  - IN-03
fix_commits:
  WR-01: 0de5ee4
  WR-02: 4d50eed
  IN-01: a66ca08
  WR-03: 4d7ad81
  WR-04: 3c81441
  IN-02: 4e5e08b
fix_note: >
  All 4 Warnings + IN-01/IN-02/IN-03 resolved (IN-03 resolved together with
  WR-01). IN-04 (heading sizes) deliberately not addressed — pre-existing,
  app-wide, out of scope. Suite green at 670 tests; tsc --noEmit clean.
---

# Phase 55: Code Review Report

**Reviewed:** 2026-07-07
**Depth:** deep
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 55 (UXCOG "Informe con rail") reorganizes the citizen surfaces into a
rail + progressive-disclosure pattern. The **security/lockdown posture is solid**:
`parlamentario-resumen-conteos.ts` keeps `import "server-only"` on line 1 and uses
only allowlisted RPCs; the gates (`netPublicEnabled` / `crucesPublicEnabled` /
`moneyPublicEnabled`) are read server-side and wrap the entire `<section>` **and**
the rail entry (rail derives from the gate-aware `construirChips`), so OFF = node
absent from HTML; `force-dynamic` is preserved on `/red`; the new client islands
(`ficha-rail`, `detalle-colapsable`, capa-1 views, `red-graph`, `nodo-parlamentario`)
import only `cn`/hooks/`type`-only symbols — no Supabase, no `*Section` — so the
no-leak contract holds; no PII (`rut`/`partido`) is rendered; path inputs are
regex-validated before any DB call; scrollspy cleanup (`obs.disconnect()`) and Radix
`forceMount` are correct; no hardcoded secrets, `eval`, `dangerouslySetInnerHTML`,
or hydration-nondeterminism was found.

The defects are in the **presentation layer** and cluster around the LOCKED petróleo
accent and the progressive-disclosure affordances: the scrollspy-current highlight
and the two flagship drill-down CTAs are wired in ways that make them silently
non-functional or reduce them to duplicated content. None are crashes or security
holes, so all are WARNING/INFO — but several directly break the phase's own LOCKED
design contract, so they should be fixed before this ships as "done".

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Petróleo scrollspy highlight and drill-down trigger emit invalid CSS (silently colorless)

**Status:** RESOLVED (commit 0de5ee4) — switched `ficha-rail.tsx` + `detalle-colapsable.tsx` to the registered flat utilities (`text-/border-/outline-accent-product`). Also resolves IN-03.

**File:** `app/components/ficha-rail.tsx:62-66`, `app/components/detalle-colapsable.tsx:44`
**Issue:**
`--accent-product` is declared as a **bare HSL triplet** in `globals.css`
(`--accent-product: 183 38% 26%;` light / `183 34% 46%` dark) — it is only valid
when wrapped as `hsl(var(--accent-product))`. The registered Tailwind utilities
(`text-accent-product` / `border-accent-product` / `bg-accent-product`, defined in
`tailwind.config.ts:46` as `"hsl(var(--accent-product))"`) do that wrapping. But the
new islands instead use the **arbitrary** form:

- `ficha-rail.tsx:66` (active nav item): `border-[color:var(--accent-product)] … text-[color:var(--accent-product)]`
- `ficha-rail.tsx:63` (hover): `hover:text-[color:var(--accent-product)]`
- `ficha-rail.tsx:64` (focus): `focus-visible:outline-[var(--accent-product)]`
- `detalle-colapsable.tsx:44` ("Ver detalle (N)" trigger): `text-[color:var(--accent-product)]`

These compile to `color: var(--accent-product)` → `color: 183 38% 26%`, which is an
**invalid CSS color** and is dropped by the browser. Result: the scrollspy-current
item renders the soft background (`bg-accent-product-soft` works) but **no petróleo
left-border and no petróleo text**, and the drill-down trigger text is not petróleo.
The scrollspy-current petróleo highlight is item #2 on the UI-SPEC LOCKED
reserved-accent list, so a LOCKED design invariant fails silently. (The same broken
pattern pre-exists in `parlamentario-resumen.tsx:93,95` `ResumenView`, which the new
code copied.)
**Fix:** use the already-registered flat utilities (they wrap in `hsl()`):
```tsx
// ficha-rail.tsx active state
activa &&
  "bg-accent-product-soft border-accent-product font-semibold text-accent-product",
// hover / focus
"text-foreground/80 hover:text-accent-product",
"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product",
// detalle-colapsable.tsx trigger
className="group flex min-h-11 items-center gap-2 text-left text-sm font-semibold text-accent-product"
```
(or, if arbitrary is required, `text-[color:hsl(var(--accent-product))]`).

### WR-02: "Explorar los N cruces" primary CTA is a dead button (does nothing on click)

**Status:** RESOLVED (commit 4d50eed) — the CTA is now an anchor to the cruces `DetalleColapsable` region (`#cruces-detalle`, `detalleHref` prop); CrucesCapa1 stays a server component and the no-leak contract holds.

**File:** `app/components/capa1/cruces-capa1.tsx:64-71`
**Issue:** `CrucesCapa1` is a Server Component (no `"use client"`), and the petróleo
primary button — described by the UI-SPEC as *the único énfasis* that "expands cruces
detail inline" — is rendered as `<button type="button">Explorar los {total} cruces</button>`
with **no `onClick`, no `aria-controls`, no form/anchor target**. It cannot have a
handler (server component) and is not wired to the separate `DetalleColapsable`
(page.tsx:366-373) that actually toggles the cruces detail. So the flagship CTA is
inert: users get two controls for the same detail — a working "Ver detalle (N)"
disclosure trigger and a dead petróleo button. This misleads on the single most
emphasized affordance of the page.
**Fix:** either (a) make the cruces detail live *inside* `CrucesCapa1` and drive the
Radix Collapsible from this button (convert to a thin client island with
`aria-controls`), (b) render it as an anchor to the disclosure region, or (c) remove
the button and rely on the `DetalleColapsable` trigger, relabeling that trigger to the
LOCKED "Explorar los {N} cruces" copy so the único-énfasis lives on the real control.

### WR-03: Tramitación capa-1 stepper renders the full event list — disclosure defeated, content duplicated

**Status:** RESOLVED (commit 4d7ad81) — added `hitosClaveStepper()`: capa-1 keeps grouped urgencia periods + structural hitos (votación/informe/oficio, cambios de etapa/comisión) + ingreso/actual, cap ~7; the exhaustive list stays only in the collapsed TimelineView. Test asserts the stepper renders fewer items than the timeline.

**File:** `app/components/capa1/tramitacion-stepper.tsx:107,143-158`
**Issue:** UI-SPEC §Per-Surface `/proyecto` specifies capa-1 = a stepper of **KEY
hitos only** (ingreso, cambios de etapa/comisión, informes, votaciones con desenlace,
urgencia vigente) with the *full* tramitación in the collapsed detail. Instead,
`TramitacionStepper` maps `construirItems(eventos)` — the **same** transform
`TimelineView` uses (timeline-view.tsx:237) — so capa-1 lists every structural event,
identical to the collapsed detail. Every event is therefore rendered twice in the DOM
(always-visible stepper + `forceMount` `TimelineView` inside `DetalleColapsable`).
This negates the cognitive-layering goal (capa-1 should be a preattentive ≤7-unit
summary) and works against the phase's own ~28.000px→~5.000px height-reduction target.
**Fix:** derive a reduced KEY-hitos set for capa-1 (e.g. filter `construirItems` to
structural milestone `tipo`s + the grouped urgencia lines, cap to ~5-7), and leave the
exhaustive list to the collapsed `TimelineView`. Do not re-render the full timeline in
both layers.

### WR-04: "ver todos" grouped-urgencia affordance links to its own section and reveals nothing

**Status:** RESOLVED (commit 3c81441) — "ver todos" now builds the real deep-link `/proyecto/{boletin}?urgencias={periodo.id}#timeline`, and the timeline `DetalleColapsable` opens (`defaultOpen`) when `?urgencias` is present, so the grouped trámites are visible on landing.

**File:** `app/components/capa1/tramitacion-stepper.tsx:77-82`
**Issue:** `LineaUrgenciaAgrupada` renders `{n} trámites de urgencia · ver todos` where
"ver todos" is `<a href="#timeline">`. `#timeline` is the very section the stepper
already lives in, and the link carries **no `?urgencias=<periodo.id>`** and does **not**
open the collapsed `DetalleColapsable`. Clicking it scrolls to the top of the current
section and reveals none of the N grouped urgencia trámites (the per-period expansion
in `TimelineView` requires the `?urgencias` param — timeline-view.tsx:246). The
affordance promises "all N" and delivers nothing, so the grouped data is effectively
unreachable from capa-1.
**Fix:** point the link at the actual expansion, e.g. build the same href
`TimelineView` uses — `/proyecto/{boletin}?urgencias={periodo.id}#timeline` — and ensure
the detail is open (or that the deep-link scrolls into the expanded run). Pass `boletin`
and the period id into `LineaUrgenciaAgrupada` so it can construct the real target.

## Info

### IN-01: Cruces section has no always-visible count suffix

**Status:** RESOLVED (commit a66ca08) — `CrucesCapa1` gains a `conteo` prop rendering `conteoLabel(conteos.cruces)` next to the `<h2>`, honest across all 3 states.

**File:** `app/app/parlamentario/[id]/page.tsx:360-376`, `app/components/capa1/cruces-capa1.tsx:46-49`
**Issue:** Every other carril renders `CarrilHeader` with an always-visible 3-state
count suffix, but the cruces `<section>` uses only `CrucesCapa1`'s internal
`<h2>Cruces con sectores</h2>` with **no count suffix**. The count only appears inside
the `total > 0` button. When cruces are `vacio` (gate ON, 0 sectores) the header shows
no count at all, deviating from the UI-SPEC "Section header `<h2>` + count suffix
ALWAYS visible" rule.
**Fix:** render the honest 3-state count (`conteoLabel(conteos.cruces)`) next to the
`CrucesCapa1` heading, matching the other carriles.

### IN-02: `/proyecto` `#cuerpos-legales` section has no rail entry (scrollspy dead zone)

**Status:** RESOLVED (commit 4e5e08b) — added `{ id: "cuerpos-legales", label: "Cuerpos legales" }` to `ProyectoRail.navEntries` (now 7 entries); scrollspy observes the section.

**File:** `app/app/proyecto/[boletin]/page.tsx:151-158,199-211`
**Issue:** The content column renders 7 sections but `ProyectoRail.navEntries` lists 6 —
`#cuerpos-legales` is omitted. `useScrollspy` therefore never observes it; while the
reader scrolls through "Cuerpos legales afectados" the rail keeps `idea-matriz` marked
current. This matches the UI-SPEC rail list (which does not enumerate cuerpos-legales),
so it is intentional, but it leaves a whole section unrepresented in the index.
**Fix:** either add a `{ id: "cuerpos-legales", label: "Cuerpos legales" }` entry, or
accept the gap knowingly — but be aware the current item will be "wrong" over that
section.

### IN-03: 55-01-SUMMARY's "CERO arbitrary color value" self-check is inaccurate

**Status:** RESOLVED via WR-01 (commit 0de5ee4) — the islands no longer use arbitrary color values, so the self-check is now accurate and the LOCKED "no arbitrary color value" convention holds.

**File:** `app/components/ficha-rail.tsx:62-66`, `app/components/detalle-colapsable.tsx:44`
**Issue:** The plan summary asserts "CERO arbitrary color value (`bg-[hsl(var(`)"
and treats the tokens as clean, but the shipped islands use arbitrary color values
`text-[color:var(--accent-product)]` / `border-[color:var(--accent-product)]` /
`outline-[var(--accent-product)]`. Beyond being broken (see WR-01), these violate the
repo's LOCKED "no arbitrary color value" convention. The green test suite did not catch
it because the assertions check class strings, not computed CSS validity.
**Fix:** resolved together with WR-01 by switching to the flat utilities; consider a
lint/grep guard for `\[color:var\(--` and `outline-\[var\(--` to prevent recurrence.

### IN-04: Section headings use `text-xl`/`text-3xl` vs UI-SPEC `text-lg` (18px)

**File:** `app/app/parlamentario/[id]/page.tsx:477`, `app/app/proyecto/[boletin]/page.tsx:122,145,152,161`, `app/app/agenda/page.tsx:77`
**Issue:** UI-SPEC §Typography fixes Heading at 18px `text-lg`/600. The carril `<h2>`s
use `text-xl` (20px) and the page `<h1>`/agenda title use `text-3xl`. This is a
pre-existing, app-wide convention (not newly introduced by this phase) and weights stay
at 600, so it is a low-priority spec-vs-impl drift rather than a regression.
**Fix:** none required for this phase unless the type scale is being enforced; if so,
normalize headings to `text-lg` per the spec.

---

_Reviewed: 2026-07-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
