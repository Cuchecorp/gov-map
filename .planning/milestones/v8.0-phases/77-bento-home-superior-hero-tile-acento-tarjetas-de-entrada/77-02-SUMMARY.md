---
phase: 77-bento-home-superior-hero-tile-acento-tarjetas-de-entrada
plan: "02"
subsystem: frontend/home
tags: [bento, home, hero, accent-tile, entry-cards, tailwind, anti-insinuacion]
dependency_graph:
  requires: [77-01]
  provides: [bento home upper half, hero tile, accent tile /sobre, 3 entry tiles]
  affects: [app/app/page.tsx, app/app/page.test.tsx]
tech_stack:
  added: []
  patterns: [BentoGrid/BentoTile asChild, cva-variant-composition, force-dynamic-preserved, server-component-bento]
key_files:
  created: []
  modified:
    - app/app/page.tsx
    - app/app/page.test.tsx
decisions:
  - "Accent tile body = /sobre 'El principio' formula verbatim (not mockup correlaciones string) — T-77-03 mitigation"
  - "diamond SVG marker uses currentColor + fill inner path (not BrandIcon, which is two-diamond; single-diamond per plan spec)"
  - "Container pt-10 md:pt-14 chosen for top padding (within UI-SPEC discretion bounds)"
metrics:
  duration: "~8 min"
  completed: "2026-07-15"
  tasks_completed: 3
  files_changed: 2
---

# Phase 77 Plan 02: Bento Home Superior — Hero Tile + Accent + Entry Cards Summary

Rewrote `app/app/page.tsx` into a BentoGrid composition (5 tiles: hero span-4, accent span-2, 3 entry span-2) inside a `max-w-[1120px]` container; migrated `page.test.tsx` from nav-based Contract-2 to grid/link bento assertions; full suite 862/862 green, tsc clean, anti-insinuación green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate page.test.tsx — Contract-2 nav→grid; add bento assertions | f95e2a1 | app/app/page.test.tsx |
| 2 | Rewrite page.tsx to bento composition | d5dabfb | app/app/page.tsx |
| 3 | Full-suite + tsc + anti-insinuación gate | (no commit — verification only) | — |

## What Was Built

### Task 1: page.test.tsx migration
- Contract-2 nav-scoped assertions replaced with grid/link assertions (no `<nav aria-label>`)
- NEW kicker assertion: `OBSERVATORIO DEL CONGRESO` present
- NEW accent tile assertions: `href="/sobre"`, heading `¿Cómo leer esto?`, body contains `nunca se inventa`, CTA `Ver metodología →`
- BANNED_VOCAB extended to include `correlaci` and `irregularidad` (T-77-03)
- 3 entry tile link assertions by role across document (no nav scope)
- force-dynamic export assertion via `import * as HomeModule`
- All LOCKED hero strings preserved byte-identical (18 tests total)

### Task 2: page.tsx rewrite
- Imports: `BentoGrid`, `BentoTile` (Phase 76), `BrandIcon`
- Container: `max-w-[1120px] mx-auto px-4 md:px-8 pt-10 md:pt-14` wrapping `<BentoGrid>`
- Hero tile `span={4} asChild`: kicker (font-mono 11px uppercase) → h1 LOCKED → subtitle LOCKED → `<SearchBox variant="hero" autoFocus exampleChips={EXAMPLE_CHIPS} />` → trust line LOCKED; old `/sobre` inline link removed (migrated to accent tile)
- Accent tile `span={2} asChild` `Link href="/sobre"`: `BrandIcon color="currentColor" size={30}` → h2 `¿Cómo leer esto?` → /sobre formula body → `Ver metodología <span aria-hidden pl-1>→</span>`; no mockup strings
- 3 entry tiles `span={2} asChild` mapping `ENTRY_CARDS`: single-diamond SVG (currentColor, aria-hidden) + → arrow + title span + value p
- `force-dynamic` export preserved; `ActualidadModule` mounted below `</BentoGrid>` inside `<main>`
- Zero `#` hex, zero bare `[--token]`, zero whitespace `→` text nodes

### Task 3: Gate verification
- Full suite: 862 tests passed (77 files) — +6 from 856 base (18 tests in page.test.tsx vs 12 before)
- `pnpm exec tsc --noEmit`: clean (0 errors)
- `pnpm test -- --run anti-insinuacion`: green (18 tests)

## Deviations from Plan

None — plan executed exactly as written. The `→` CTA in accent tile uses `{" "}` space before the span (not a bare text node) to preserve reading; glyph span has `aria-hidden="true" className="pl-1"` per lesson F53.

## Known Stubs

None. All 5 BentoTiles render live data (SearchBox → /buscar, AccentTile → /sobre, entry tiles → real pages). ENTRY_CARDS copy is LOCKED verbatim, not placeholder.

## Threat Flags

None — presentation-only rewrite. No new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

- f95e2a1 exists in git log (test commit)
- d5dabfb exists in git log (feat commit)
- app/app/page.tsx contains `BentoGrid`
- app/app/page.tsx contains `ActualidadModule`
- app/app/page.tsx contains `force-dynamic`
- app/app/page.tsx contains `OBSERVATORIO DEL CONGRESO`
- app/app/page.tsx contains `nunca se inventa`
- app/app/page.tsx contains `href="/sobre"`
- app/app/page.test.tsx contains `OBSERVATORIO DEL CONGRESO`
- Suite: 862/862 green; tsc: clean; anti-insinuación: green
