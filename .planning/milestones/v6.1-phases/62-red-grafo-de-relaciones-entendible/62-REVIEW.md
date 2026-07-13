---
phase: 62-red-grafo-de-relaciones-entendible
reviewed: 2026-07-10T00:46:42Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - app/app/globals.css
  - app/components/red/nodo-parlamentario.tsx
  - app/components/red/red-graph.test.tsx
  - app/components/red/red-graph.tsx
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: fixes_applied
fix_summary:
  fixed: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-05]
  deferred: [WR-06]
  skipped: [IN-01, IN-02, IN-03, IN-04, IN-05]
  tests_passed: true
  test_count: 750
---

# Phase 62: Code Review Report

**Reviewed:** 2026-07-10T00:46:42Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the radial ego-network implementation for `/red` (RED-01 cap 24 + overflow honesto, RED-02 layout radial determinista + fallback móvil + borde institucional por cámara) plus its CSS and test suite. Cross-referenced against `app/app/red/page.tsx`, `arista-hecho.tsx`, `lib/format.ts` (`formatNombre`), `lib/utils.ts` (`safeExternalHref`), `lib/buscar.ts` (`PARLAMENTARIO_ID_RE`), `app/styles/civic-tokens.css` and `tailwind.config.ts` (Tailwind v4.3).

The core invariants hold in the happy path: the layout is pure trig (no force-simulation), neighbor order is alphabetical and input-order-invariant (proven by test), the cap is honest, external links pass through `safeExternalHref`, and the empty state never fabricates nodes. However, there is one reachable violation of the project's own B20a/anti-insinuación invariant (orphan seed node + blank mobile content under date filters), and the flagship "borde institucional por cámara" is effectively invisible in light mode because it consumes a background token (94% lightness) as a border color. The known P1 `.net-vecinos` leak fix is present and correct at default font size, but it hardcodes `768px` against a rem-based Tailwind v4 `md` breakpoint, reintroducing a dead zone under non-default root font sizes — the same class of bug it fixed.

## Critical Issues

### CR-01: Date filters can strand the seed as an orphan node on desktop and leave mobile with no content at all (violates B20a invariant)

**Status:** FIXED (commit b32f41e) — requires human verification of the logic. Added `sinVecinosVisibles = seedNodo && rendered.length === 0`; the "Ninguna relación coincide" message now also shows when filters strand the seed. Added mobile-only notice for the no-`seedNodo` fallback branch. Test added (seed Jan edge + vecino↔vecino Mar edge, filter desde=feb → no lone seed node + visible message).

**File:** `app/components/red/red-graph.tsx:251-291, 352-361, 431-470`
**Issue:** `seedNeighbors` is derived from `aristasVisibles` (line 192-207). The subgraph also carries vecino↔vecino edges (acknowledged at line 188-190). If the user sets a date window that filters out **all seed↔vecino edges** while at least one vecino↔vecino edge survives (windows are independent per edge, so this is reachable with real lobby data), then:
- `aristasVisibles.length > 0` → the "Ninguna relación coincide" message (line 431) does **not** show;
- `rendered = []`, so on the seed path `rfNodes = [seedNodo]` alone and `rfEdges = []` (line 325-326 filters both endpoints against `renderedIds = {seed}`) → **desktop renders a single seed node floating with zero edges** — exactly the "persona suelta sin hecho que la vincule" that the file's own B20a comment (line 242-246) declares must never reach the canvas;
- on mobile (<768px) the canvas is hidden and `vecinosLista.length === 0` (line 470) → the user sees the legend + filters and **no content, no message** — a silent dead end.

The same blank-mobile symptom occurs on the fallback branch (line 292-310) whenever `seedNodo` is null: the canvas is `hidden md:block` but the vecinos list requires `seedNodo`, so `<768px` renders nothing.
**Fix:** Treat "seed has no visible neighbor" as its own honest state. After computing `rendered`, if `seedNodo && rendered.length === 0`, render the "Ninguna relación coincide con los filtros" message instead of the canvas/lista block:

```tsx
const sinVecinosVisibles = Boolean(seedNodo) && rendered.length === 0;
{aristasVisibles.length === 0 || sinVecinosVisibles ? (
  <p className="mt-4 text-sm ...">Ninguna relación coincide con los filtros…</p>
) : ( /* canvas + lista + overflow */ )}
```
Additionally, for the no-`seedNodo` fallback branch, render the vecinos-list equivalent (or at minimum a visible notice) below `md`, so mobile is never blank while `aristasVisibles.length > 0`. Add a test: seed with one Jan edge + vecino↔vecino Mar edge, set `desde=2024-02-01`, assert no lone seed node and a visible message.

## Warnings

### WR-01: Institutional cámara border is nearly invisible in light mode (background token used as border color)

**Status:** FIXED (commit 173644f) — `.net-nodo--camara/--senado` now use `--camara-muted-foreground` / `--senado-muted-foreground` instead of the 94%-lightness background tokens.

**File:** `app/app/globals.css:237-245` (tokens: `app/app/styles/civic-tokens.css:12,18`)
**Issue:** `.net-nodo--camara` / `.net-nodo--senado` set `border-left-color: var(--camara-muted)` / `var(--senado-muted)`. In light mode those tokens are `hsl(213 60% 94%)` and `hsl(355 40% 94%)` — 94%-lightness **background** tokens (used as chip backgrounds in `camara-chip.tsx`, always paired with their `-foreground` variants). Against the node body `hsl(var(--card))` = `hsl(40 30% 99%)`, the contrast is ≈1.1:1: the 3px institutional border — the phase's RED-02 distinguisher — is imperceptible, and as a meaningful graphical indicator it fails WCAG 1.4.11 (3:1 non-text contrast). Dark mode has the same problem inverted (14-15% lightness border on a 12% card).
**Fix:** Use the foreground variants, which exist precisely for this contrast role:

```css
.net-nodo--camara { border-left-width: 3px; border-left-color: var(--camara-muted-foreground); }
.net-nodo--senado { border-left-width: 3px; border-left-color: var(--senado-muted-foreground); }
```

### WR-02: Cascade contradicts the stated intent — cámara border overrides the seed border, not the other way around

**Status:** FIXED (commit 173644f) — added `.net-nodo--seed.net-nodo--camara, .net-nodo--seed.net-nodo--senado` rule (specificity 0,2,0) so the seed's 2px `--foreground` left border wins over the institutional 3px border.

**File:** `app/app/globals.css:226-245`; `app/components/red/nodo-parlamentario.tsx:57-69`
**Issue:** The comment at line 235-236 claims "el borde de seed (2px --foreground) tiene prioridad", but `.net-nodo--camara`/`--senado` (lines 237-245) come **after** `.net-nodo--seed` (line 226) with equal specificity (0,1,0). A seed node always carries both classes (the component applies `camaraClase` unconditionally, nodo-parlamentario.tsx:63-69), so the seed's left border becomes 3px in the near-invisible muted color (see WR-01) while the other three sides are 2px `--foreground` — the seed marker looks broken on its left edge. Either the comment or the behavior is wrong.
**Fix:** Make the declared priority real:

```css
.net-nodo--seed.net-nodo--camara,
.net-nodo--seed.net-nodo--senado {
  border-left-width: 2px;
  border-left-color: hsl(var(--foreground));
}
```
(or place `.net-nodo--seed` last and document the chosen precedence).

### WR-03: P1 fix hardcodes `768px` against Tailwind v4's rem-based `md` (48rem) — dead zone where BOTH canvas and vecinos list are hidden

**Status:** FIXED (commit 12ba154) — `.net-vecinos` hide query changed from `@media (min-width: 768px)` to `@media (min-width: 48rem)`, matching Tailwind v4 `md`.

**File:** `app/app/globals.css:355-359` (vs `red-graph.tsx:442,471`)
**Issue:** The canvas wrapper uses Tailwind utilities `hidden md:block` and the list uses `md:hidden`; in Tailwind v4 `md` compiles to `min-width: 48rem` (rem-based). The specificity fix hides `.net-vecinos` at `@media (min-width: 768px)` (px-based). These only coincide at a 16px root font size. With a larger user default font (e.g. 20px → md fires at 960px CSS px), between 768px and 960px the canvas is still `hidden` (below 48rem) **and** the list is `display:none` (above 768px) → no graph content at all. Note the adjacent filtros query (line 197) correctly uses `47.99rem` — the new fix is the only px-based one.
**Fix:**

```css
@media (min-width: 48rem) {
  .net-vecinos { display: none; }
}
```

### WR-04: A self-loop edge on the seed would put the seed into its own neighbor ring (duplicate node id / React key collision)

**Status:** FIXED (commit d0f4c5e) — `seedNeighbors` now guards `a.a === seedId && a.b !== seedId` / `a.b === seedId && a.a !== seedId`, excluding the seed from its own ring. Test added (self-loop does not duplicate the seed node).

**File:** `app/components/red/red-graph.tsx:192-207, 267-291`
**Issue:** In `seedNeighbors`, `if (a.a === seedId) ids.add(a.b)` — when `a.a === a.b === seedId` (a malformed self-loop from the RPC), `seedId` enters `ids`, survives the `nodos.filter`, and lands in `rendered`. `rfNodes` then contains the seed **twice** (center + ring) with the same `id` → duplicate React keys and duplicate node ids in xyflow (undefined behavior/console errors). The component otherwise defends against data it "should never receive" (see nodo-parlamentario.tsx doc comment); this path doesn't.
**Fix:** Exclude the seed explicitly:

```ts
for (const a of aristasVisibles) {
  if (a.a === seedId && a.b !== seedId) ids.add(a.b);
  else if (a.b === seedId && a.a !== seedId) ids.add(a.a);
}
```

### WR-05: `nombre ?? id` fallback lets an empty-string nombre render links with empty accessible names (inconsistent with NodoParlamentario)

**Status:** FIXED (commit d0f4c5e) — added shared `displayNombre(n) = formatNombre(n.nombre?.trim() || n.id)` helper, replacing `nombre ?? id` at all 4 sites (sort, seedNombre, mobile list, overflow). Test added (empty-name vecino falls back to its id).

**File:** `app/components/red/red-graph.tsx:202-205, 349-350, 489, 557`
**Issue:** `NodoParlamentario` defends against empty names with `data.nombre?.trim() || data.id` (nodo-parlamentario.tsx:43). The mobile list, overflow list, heading and the alphabetical sort instead use `n.nombre ?? n.id` — `??` does **not** catch `""` or whitespace-only strings, so a row with `nombre: ""` (the column is nullable text; empty string is representable) produces a `<Link>` whose visible/accessible name is empty in the mobile list and in the overflow control, and sorts before everything. Same data, two different fallback semantics.
**Fix:** One shared helper used everywhere:

```ts
const displayNombre = (n: SubgrafoNodo) => formatNombre(n.nombre?.trim() || n.id);
```

### WR-06: xyflow canvas initializes inside `display:none` on mobile — fitView/measurement runs against a 0×0 container

**Status:** DEFERRED — the reviewer flagged the matchMedia-gated mount as "too invasive/risky" and offered "at minimum verify the rotate-to-desktop path in a real browser and document the result" as the alternative. Gating the mount on `matchMedia("(min-width: 48rem)")` would: (1) break the current test contract — the suite explicitly asserts the canvas is wrapped in `hidden md:block` and that `rf-canvas` is present in jsdom (jsdom `matchMedia` defaults to false, so the canvas would never mount in tests); (2) introduce SSR/CSR hydration-mismatch risk in Next.js 16 (server has no `matchMedia`), requiring a hydration-safe useEffect+useState mount refactor of the client island. Deferred to the RED-03 BrowserOS loop, which already exercises the desktop+390px real-browser paths and is the correct venue to verify the rotate-to-desktop framing. No half-fix shipped (per reviewer guidance).

**File:** `app/components/red/red-graph.tsx:442-462`
**Issue:** The `<ReactFlow>` island is always mounted; below `md` its ancestor is `display:none`, so on a phone the canvas initializes with zero dimensions (nodes measure 0×0, `fitView` has no viewport to fit). If the viewport later crosses the breakpoint (rotation, resize, external display), the graph's initial framing depends on xyflow's ResizeObserver recovery rather than the declared `fitView` init path — a misframed or blank canvas is plausible and is not covered by any test (jsdom can't exercise it). Mounting it hidden also runs the full graph render on devices that will never show it.
**Fix:** Gate mounting on the breakpoint instead of hiding with CSS (e.g. a `matchMedia("(min-width: 48rem)")` state in the client island, rendering the canvas only when true), or at minimum verify the rotate-to-desktop path in a real browser and document the result.

## Info

### IN-01: Tailwind utilities on `.net-vecinos` are dead — unlayered `margin: 0` beats layered `mt-4` (same mechanism as the fixed P1 bug)

**Status:** SKIPPED (not trivial) — wrapping the fix in `@layer components` requires enclosing the whole `.net-*` block (globals.css lines ~134–443, including two nested media queries) in a layer. Layering changes cascade precedence and would interact with the just-landed WR-02 seed-border cascade fix and the WR-03 media query; not a trivial in-place change while touching globals.css, so deferred per scope guidance. The specific dead-`mt-4` symptom is cosmetic and does not affect the shipped layout.

**File:** `app/app/globals.css:344-351`; `app/components/red/red-graph.tsx:471`
**Issue:** In Tailwind v4, utilities live in `@layer utilities`; the `net-*` rules in globals.css are unlayered and therefore win regardless of order/specificity. `.net-vecinos { margin: 0 }` silently kills the `mt-4` on the list (red-graph.tsx:471) — the exact mechanism that caused the P1 `display:flex` vs `md:hidden` leak. Every future utility applied to a `net-*` element risks the same silent loss.
**Fix:** Wrap the NET styles in `@layer components { … }` (utilities then win by layer order), or drop the conflicting declarations; then the WR-03 media-query patch could even become unnecessary for `md:hidden`.

### IN-02: Class naming asymmetry — `net-nodo--camara` means "diputados"

**Status:** SKIPPED (out of scope) — Info finding, not in the CR+WR fix scope for this pass.

**File:** `app/components/red/nodo-parlamentario.tsx:57-62`; `app/app/globals.css:237`
**Issue:** The diputados modifier is named `--camara` while senado gets `--senado`; "cámara" is also the generic word for both chambers throughout the codebase (`camara: "diputados" | "senado"`). Easy to misread in CSS and tests.
**Fix:** Rename to `net-nodo--diputados` (update the two tests asserting the class).

### IN-03: Seed ids interpolated into `href` without encoding

**Status:** SKIPPED (out of scope) — Info finding, not in the CR+WR fix scope for this pass. No injection today (ids re-validated by `PARLAMENTARIO_ID_RE`).

**File:** `app/components/red/red-graph.tsx:485, 554`
**Issue:** `href={`/red?seed=${vecino.id}`}` — ids originate from the trusted RPC and the route re-validates with `PARLAMENTARIO_ID_RE` (`^[DSP]\d{3,5}$`), so there is no injection today, but an id containing `&`/`#` would silently corrupt the query.
**Fix:** `href={`/red?seed=${encodeURIComponent(vecino.id)}`}`.

### IN-04: Ring 2 starts at the same angle as ring 1 (node 13 sits radially behind node 1) and the fallback branch overloads ring 2 without bound

**Status:** SKIPPED (out of scope) — Info finding, cosmetic (fallback unreachable via `/red` today); not in the CR+WR fix scope for this pass.

**File:** `app/components/red/red-graph.tsx:126-139, 298-308`
**Issue:** Both rings start at `-π/2`, so with >12 neighbors the first ring-2 node is radially aligned with the first ring-1 node and its seed-edge passes through/behind it. Also, `radialPos` is called from the no-seed fallback with `total = nodosVisibles.length` (uncapped) — everything past index 12 piles into ring 2 (e.g. 100+ nodes on one circle). Fallback is unreachable via `/red` today (the page always passes a validated seed), so cosmetic.
**Fix:** Offset ring 2 by half a step (`theta += Math.PI / countInRing` when `ring === 1`), and/or generalize `radialPos` to `ring = Math.floor(index / perRing)` with `R = RING1_R + ring * (RING2_R - RING1_R)`.

### IN-05: Vecinos list heading is an `<li>`, not a heading element

**Status:** SKIPPED (out of scope) — Info finding, not in the CR+WR fix scope for this pass.

**File:** `app/components/red/red-graph.tsx:471-474`
**Issue:** `"Vecinos de {nombre}"` is a styled `<li className="net-vecinos__heading">` inside the `<ul aria-label="Vecinos">` — screen readers announce it as list item 1 of N+1, inflating the item count and hiding the heading semantics.
**Fix:** Move it out of the `<ul>` as a `<p>`/`<h2 className="net-vecinos__heading">` preceding the list, and let `aria-label` (or `aria-labelledby` pointing at it) name the list.

---

_Reviewed: 2026-07-10T00:46:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
