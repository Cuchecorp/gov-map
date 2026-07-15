---
phase: 76-bento-base-primitivas-bento-chrome-global
plan: "01"
subsystem: frontend/bento
tags: [bento, tokens, css, components, tdd]
dependency_graph:
  requires: []
  provides: [BentoGrid, BentoTile, --radius-tile, --radius-control, scroll-margin-top]
  affects: [app/app/globals.css, app/components/bento/]
tech_stack:
  added: []
  patterns: [cva + cn + forwardRef + asChild/Slot, source-scan test idiom, RTL class assertions]
key_files:
  created:
    - app/app/globals.test.ts
    - app/components/bento/bento-grid.tsx
    - app/components/bento/bento-grid.test.tsx
    - app/components/bento/bento-tile.tsx
    - app/components/bento/bento-tile.test.tsx
  modified:
    - app/app/globals.css
decisions:
  - "--radius: 0.5rem shadcn INTACTO (D4 LOCKED) — solo se añadieron --radius-tile y --radius-control"
  - "scroll-margin-top: 5rem en :where(h1,h2,h3)[id] — 80px > altura sticky header ~56px"
  - "BentoGrid como Server Component puro (sin use client), pattern de global-header.tsx"
  - "BentoTile usa cva+cn+forwardRef+asChild/Slot, pattern verbatim de button.tsx"
  - "gap-[14px] arbitrary off-step intencional del mockup — NO redondeado a gap-4/gap-3"
  - "Primitivas inertes — NO montadas en ninguna página en esta fase (77-78 las consumen)"
metrics:
  duration: "~15 min"
  completed: "2026-07-15"
  tasks_completed: 3
  files_created: 5
  files_modified: 1
---

# Phase 76 Plan 01: Primitivas BentoGrid/BentoTile + tokens radio + scroll-mt global Summary

One-liner: CSS tokens `--radius-tile: 16px` / `--radius-control: 11px` + regla `scroll-margin-top` global + primitivas `BentoGrid` (grid 6-col colapsable) y `BentoTile` (cva variants default/accent + span 2/4/6 + asChild) con 17 tests TDD verdes.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Tokens de radio + scroll-mt global | db5add9 | globals.css, globals.test.ts |
| 2 | BentoGrid (grid 6-col colapsable) | 4deea9d | bento-grid.tsx, bento-grid.test.tsx |
| 3 | BentoTile (cva variants + span + asChild) | 3599352 | bento-tile.tsx, bento-tile.test.tsx |

## Verification

- `pnpm --filter ./app test -- --run globals` verde (4/4 tests)
- `pnpm --filter ./app test -- --run components/bento` verde (13/13 tests: 5 grid + 8 tile)
- `pnpm --filter ./app test -- --run` full suite: 837/837 tests pasan (0 regresiones)
- `pnpm --filter ./app exec tsc --noEmit` limpio

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. Las primitivas son componentes de presentación pura sin datos — su no-montaje en páginas es intencional (fase 77-78 las consume).

## Threat Flags

None. Fase 100% presentación (CSS tokens + Server Components React). Sin nuevos flujos de datos, fetch cliente, ni endpoints.

## TDD Gate Compliance

- Task 1: RED (globals.test.ts fallo 3/4) → GREEN (tokens añadidos, 4/4 pasan)
- Task 2: RED (import falla, bento-grid.tsx no existia) → GREEN (component creado, 5/5 pasan)
- Task 3: RED (import falla, bento-tile.tsx no existia) → GREEN (component creado, 8/8 pasan)

## Self-Check: PASSED

- app/app/globals.css: FOUND (contains --radius-tile: 16px, --radius-control: 11px, scroll-margin-top)
- app/app/globals.test.ts: FOUND
- app/components/bento/bento-grid.tsx: FOUND (no "use client", no hex)
- app/components/bento/bento-grid.test.tsx: FOUND
- app/components/bento/bento-tile.tsx: FOUND (exports BentoTile + bentoTileVariants, no hex)
- app/components/bento/bento-tile.test.tsx: FOUND
- Commits db5add9, 4deea9d, 3599352: FOUND in git log
