---
phase: 77-bento-home-superior-hero-tile-acento-tarjetas-de-entrada
plan: "01"
subsystem: frontend/design-tokens
tags: [bento, tokens, tailwind, search-box, contrast, dark-mode]
dependency_graph:
  requires: [76-01]
  provides: [accent-product-foreground token, bento-accent-fill token, accent BentoTile variant fix, SearchBox hero restyle]
  affects: [app/components/bento/bento-tile.tsx, app/components/search-box.tsx]
tech_stack:
  added: []
  patterns: [cva-variant-token, dark-stable-token, hsl-var-idiom, source-scan-test]
key_files:
  created: []
  modified:
    - app/app/globals.css
    - app/tailwind.config.ts
    - app/app/globals.test.ts
    - app/components/bento/bento-tile.tsx
    - app/components/bento/bento-tile.test.tsx
    - app/components/search-box.tsx
    - app/components/search-box.test.tsx
decisions:
  - "dark-stable tokens: --bento-accent-fill pinned a petróleo (183 38% 26%) en :root Y .dark para evitar que el tile acento adopte el mid-teal .dark donde blanco cae a 3.30:1 FAIL"
  - "hsl(var(...)) idiom en tailwind.config.ts colors (mirror accent-product line 46) — NO @theme inline (evita doble-hsl gotcha 54-04)"
  - "rounded-[var(--radius-control)] (CR-01: NUNCA bare [--radius-control])"
metrics:
  duration: "~12 min"
  completed: "2026-07-15"
  tasks_completed: 3
  files_changed: 7
---

# Phase 77 Plan 01: Token Foundation + BentoTile Accent Fix + SearchBox Hero Restyle Summary

Token foundation y contratos visuales que Plan 02 consume: dos tokens dark-stable registrados en globals.css+tailwind.config.ts, variante accent de BentoTile reescrita con fill pinned+foreground legible+hover, y rama hero de SearchBox restyled a 52px+radius-control con /buscar aislado.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Register accent-foreground + dark-stable accent-fill tokens | b1225a6 | globals.css, tailwind.config.ts, globals.test.ts |
| 2 | Fix accent BentoTile variant | f6e17e6 | bento-tile.tsx, bento-tile.test.tsx |
| 3 | Restyle SearchBox hero branch | 8c0398b | search-box.tsx, search-box.test.tsx |

## What Was Built

### Task 1: Token Registration
- `--accent-product-foreground: 183 30% 96%` en `:root` y `.dark` (idénticos, dark-stable)
- `--bento-accent-fill: 183 38% 26%` en `:root` y `.dark` (idénticos, petróleo pinned)
- `tailwind.config.ts` colors: `"accent-product-foreground": "hsl(var(--accent-product-foreground))"` y `"bento-accent-fill": "hsl(var(--bento-accent-fill))"` — mirror del idiom de la línea 46
- 4 nuevos tests en globals.test.ts (value presence + count ≥2 en ambos bloques)

### Task 2: BentoTile Accent Variant Fix
- `accent` cva string: `"bg-bento-accent-fill text-accent-product-foreground hover:bg-bento-accent-fill/90"`
- Elimina `bg-accent-product` (lightens en dark a 3.30:1 FAIL) y `text-primary-foreground` (invertía mal)
- Resuelve UI-review warnings 76 #1 (foreground), #2 (hover ausente), #3-fill (fill dark)
- 3 nuevos tests (class presence + negative guards)

### Task 3: SearchBox Hero Restyle
- Input hero: `h-[52px] rounded-[var(--radius-control)] pl-9 text-base`
- Button hero: `h-[52px] rounded-[var(--radius-control)] whitespace-nowrap bg-accent-product px-6 font-semibold text-background hover:bg-accent-product/90`
- Default /buscar branch: byte-identical (`h-12`, sin radius-control, sin font-semibold)
- 4 nuevos tests (hero h-52+radius, default isolation)

## Verification

- Suite: 856 tests passed (77 files) — incremento desde 850 base
- `pnpm exec tsc --noEmit`: clean (0 errores)
- Grep guards: zero `#` hex en bento-tile.tsx y search-box.tsx hero/accent strings; zero bare `[--token]`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — edits son CSS tokens, cva variant string, y className branch. Sin nueva superficie de red, auth ni input handling.

## Self-Check: PASSED

- b1225a6 existe en git log
- f6e17e6 existe en git log
- 8c0398b existe en git log
- globals.css contiene `--accent-product-foreground: 183 30% 96%` en :root y .dark
- tailwind.config.ts contiene `accent-product-foreground`
- bento-tile.tsx contiene `text-accent-product-foreground`
- search-box.tsx contiene `rounded-[var(--radius-control)]`
