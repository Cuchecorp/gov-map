---
phase: 77-bento-home-superior-hero-tile-acento-tarjetas-de-entrada
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/app/page.tsx
  - app/app/page.test.tsx
  - app/app/globals.css
  - app/tailwind.config.ts
  - app/components/bento/bento-tile.tsx
  - app/components/bento/bento-tile.test.tsx
  - app/components/search-box.tsx
  - app/components/search-box.test.tsx
  - app/app/globals.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 77: Code Review Report

**Reviewed:** 2026-07-15
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 77 (BENTO-HOME-SUPERIOR) rewrites the landing `/` into a BentoGrid composition (hero span-4, accent span-2 `/sobre`, 3 entry span-2), registers two dark-stable design tokens (`--accent-product-foreground`, `--bento-accent-fill`) in both `globals.css` and `tailwind.config.ts`, fixes the `accent` BentoTile variant contrast, and restyles the hero SearchBox branch to 52px + `radius-control`.

The core invariants hold: **no `#` hex literals** in the bento/hero strings, **no bare `[--token]`** (all use `[var(--token)]`), **`hsl(var(...))` idiom** correctly mirrored on the two new colors (no double-hsl), **dark-stable pinning** is correct (fill L=26% under foreground L=96% → high contrast, avoiding the `.dark` mid-teal 3.30:1 failure), **`force-dynamic` preserved**, **single `h1`** with valid heading order (h1 → h2 accent → h2/h3 ActualidadModule), **copy LOCKED** byte-identical, and `focus-visible` rings on the tile links via `asChild`/Slot. Tailwind arbitrary values (`h-[52px]`, `rounded-[var(--radius-control)]`, `md:col-span-N`) are valid and merge correctly through `cn`/tailwind-merge. **No bugs, no security defects, no crashes** were found.

Two accessibility items warrant fixing: (1) the rewrite silently **dropped the `<nav aria-label="Secciones del sitio">` landmark** that previously wrapped the three entry cards, and (2) `autoFocus` on the hero search input is a known WCAG-friction pattern. Neither breaks functionality; both degrade the experience for assistive-technology users.

## Warnings

### WR-01: Entry-tile navigation landmark silently removed (a11y regression)

**File:** `app/app/page.tsx:130-163`
**Issue:** The three entry cards (`/buscar`, `/parlamentarios`, `/agenda`) are now bare `<Link>` elements mapped directly into the grid `<div>`, with **no wrapping landmark**. The prior version (`git show d02116e:app/app/page.tsx:111`) wrapped them in `<nav aria-label="Secciones del sitio">`, giving screen-reader users a named landmark to jump to the site's section links. Phase 77 removed that landmark, and the test migration (`page.test.tsx`, summary 77-02 Task 1) explicitly deleted the `<nav aria-label>` assertions, so the regression passed CI unnoticed. The links remain reachable in reading order and a global "Navegación principal" nav still exists in the header (`header-nav.tsx:66`), so this is degradation, not loss of navigability — hence WARNING, not BLOCKER. The review invariant list explicitly names "landmarks" as a checked property.
**Fix:** Wrap the entry-tile map in a named navigation landmark (grid layout is unaffected since `<nav>` can carry the grid or sit inside it):
```tsx
<nav aria-label="Secciones del sitio" className="contents">
  {ENTRY_CARDS.map((card) => (
    <BentoTile key={card.href} variant="default" span={2} asChild>
      {/* ...unchanged... */}
    </BentoTile>
  ))}
</nav>
```
(`className="contents"` keeps the `<nav>` transparent to the CSS grid so span/placement is preserved.) Re-add a landmark assertion to `page.test.tsx`.

### WR-02: `autoFocus` on the hero search input disorients AT / keyboard users

**File:** `app/app/page.tsx:94` (`<SearchBox autoFocus variant="hero" ... />`); consumes `app/components/search-box.tsx:120`
**Issue:** The landing auto-focuses the search input on every load. Programmatic focus-on-load moves the screen-reader cursor past the h1/kicker/subtitle (users never hear the page framing), can trigger an unexpected page scroll on small viewports, and is a recognized WCAG 2.4.3 / 3.2.1 friction pattern. It is not a functional bug and was a deliberate "the box is the hero" design choice, so WARNING.
**Fix:** Prefer removing `autoFocus` so the reading order (kicker → h1 → subtitle → search) is preserved for AT users; the input is already the first interactive control and visually dominant. If product insists on focus, gate it behind a reduced-motion / first-visit check, or at minimum ensure the h1 is announced first. Minimal change:
```tsx
<SearchBox variant="hero" exampleChips={EXAMPLE_CHIPS} />
```

## Info

### IN-01: Entry-tile titles are non-heading `<span>`s (not reachable by heading navigation)

**File:** `app/app/page.tsx:159` (`<span className="mt-3 text-lg font-semibold">{card.title}</span>`)
**Issue:** Each entry-tile title ("Proyectos de ley", etc.) renders as a styled `<span>`, so screen-reader users navigating by heading (a common strategy) will not land on the three main section entries. The titles are still part of each link's accessible name, so this is intentional-and-defensible, not a defect — noted for awareness. Using `<h3>` would also require the accent tile's h2 to remain the only intermediate level (order stays valid).
**Fix (optional):** Promote each title to `<h3>` if section-heading navigation is desired: `<h3 className="mt-3 text-lg font-semibold">{card.title}</h3>`. Heading order (h1 → h2 → h3) stays valid.

### IN-02: Hero `<section>` is an unnamed sectioning element (no landmark benefit)

**File:** `app/app/page.tsx:73`
**Issue:** The hero uses `<section>` without an accessible name (`aria-labelledby`/`aria-label`), so it is not exposed as a landmark and provides no navigational value over a `<div>`. Harmless, but the `<section>` conveys semantics it does not deliver. Since the hero contains the h1, an unnamed section is fine; noting only for consistency with the landmark discussion in WR-01.
**Fix (optional):** Either add `aria-labelledby` pointing at the h1, or use a plain `<div>` if no landmark is intended.

### IN-03: SearchBox JSDoc references a stale "Fase 21 SC1" variant contract

**File:** `app/components/search-box.tsx:22-27`
**Issue:** The component doc block still frames the `hero`/`default` variants as "Fase 21 SC1 — paridad con el mockup de la landing" while the hero-specific sizing (52px, `radius-control`) that this file now carries was introduced in Phase 77-01. Comment drift only — no runtime effect. Keeping doc provenance accurate helps the next reviewer trace which phase owns the hero branch.
**Fix (optional):** Add a one-line note that the 52px + `rounded-[var(--radius-control)]` hero sizing landed in Phase 77-01.

---

## Notes on invariants explicitly cleared (no finding)

- **Copy LOCKED / zero mockup strings:** hero h1, subtitle, trust line, `/sobre` formula body, and the 3 entry values are byte-identical to the LOCKED copy; `BANNED_VOCAB` (incl. `correlaci`/`irregularidad`) is enforced by `page.test.tsx:158`. Clear.
- **`[var(--token)]` syntax:** `rounded-[var(--radius-tile)]` (bento-tile) and `rounded-[var(--radius-control)]` (search-box hero) both use the `var()` form; negative guards in `bento-tile.test.tsx:101` and `search-box.test.tsx` confirm no bare `[--token]`. Clear.
- **Zero new hex in bento:** `bento-tile.test.tsx:94` source-scans for `#RRGGBB`; `page.tsx` hero/accent/entry strings carry none. Clear. (`BrandIcon`'s `#2A5859` default is overridden with `color="currentColor"` at `page.tsx:110`, so no hex reaches the accent tile.)
- **Dark-mode `--bento-accent-fill` / `--accent-product-foreground` pairing:** both pinned identically in `:root` and `.dark` (`globals.css:39-40,67-68`); fill L=26% under foreground L=96% clears AA/AAA and avoids the `.dark` mid-teal 3.30:1 failure. Dual-registered in `tailwind.config.ts:48,50` via `hsl(var(...))` (no double-hsl). Clear.
- **focus-visible on tile links:** `bentoTileVariants` base carries `focus-visible:ring-2 ... ring-offset-2`; via `asChild`/Slot it lands on the inner `<Link>`/`<a>` (verified `bento-tile.test.tsx:83-92`). Clear.
- **SearchBox `/buscar` isolation:** default branch keeps `h-12` + inherited `rounded-md`, no `radius-control`, no `font-semibold` (guarded `search-box.test.tsx:69-82`). Hero-only overrides confirmed. Clear.
- **force-dynamic + single island:** `export const dynamic = "force-dynamic"` retained (`page.tsx:14`, asserted `page.test.tsx:241`); the only `"use client"` is `search-box.tsx:1`. Clear.
- **Navigation safety / injection:** `navigate()` uses `encodeURIComponent` and a trim/empty guard (`search-box.tsx:62-68`); the native `<form method="get" action="/buscar">` fallback is the progressive-enhancement path. No injectable sink introduced. Clear.

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
