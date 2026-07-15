---
phase: 79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores
plan: "01"
subsystem: frontend-layout
tags: [bento, layout, css-tokens, radius, container]
dependency_graph:
  requires: []
  provides: [BENTO-04]
  affects: [buscar, parlamentarios, agenda, sobre, metodologia, search-result-card, parlamentario-directory-row]
tech_stack:
  added: []
  patterns: ["rounded-[var(--radius-tile)]", "max-w-[1120px]", Tailwind-4-CSS-var-syntax]
key_files:
  created: []
  modified:
    - app/app/buscar/page.tsx
    - app/components/search-result-card.tsx
    - app/app/parlamentarios/page.tsx
    - app/components/parlamentario-directory-row.tsx
    - app/app/agenda/page.tsx
    - app/app/sobre/page.tsx
    - app/app/metodologia/page.tsx
    - app/app/buscar/coverage.test.tsx
    - app/app/parlamentarios/page.test.tsx
    - app/app/agenda/page.test.tsx
    - app/components/search-result-card.test.tsx
decisions:
  - "Swap acotado a call sites de primer nivel enumerados en interfaces block; interiores byte-idénticos (invariante D3)"
  - "card.tsx no editado (firewall D3); override vía className en el call site con tailwind-merge"
  - "Sintaxis SIEMPRE rounded-[var(--radius-tile)], nunca [--radius-tile] (CR-01 Phase 76)"
metrics:
  duration: "~15 min"
  completed: "2026-07-15"
  tasks_completed: 3
  files_modified: 11
requirements: [BENTO-04]
---

# Phase 79 Plan 01: Bento Coherencia — Propagación Acotada a Rutas Interiores Summary

**One-liner:** Propagación quirúrgica de `max-w-[1120px]` + `rounded-[var(--radius-tile)]` a 5 rutas de primer nivel y sus 2 componentes de tarjeta, sin tocar interiores ni card.tsx.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Swap container + radius en /buscar, /parlamentarios, /agenda | 1f0731b | buscar/page.tsx, search-result-card.tsx, parlamentarios/page.tsx, parlamentario-directory-row.tsx, agenda/page.tsx |
| 2 | Swap container en /sobre y /metodologia (prosa) | 98de9db | sobre/page.tsx, metodologia/page.tsx |
| 3 | Extender tests BENTO-04 | 12e3b75 | coverage.test.tsx, page.test.tsx x2, search-result-card.test.tsx |

## What Was Built

### Production changes

- **5 `<main>` containers** swapeados de `max-w-3xl`/`max-w-5xl` a `max-w-[1120px]` (rutas: /buscar, /parlamentarios, /agenda, /sobre, /metodologia).
- **SearchResultCard** (`search-result-card.tsx`): `<Card>` pelado recibe `className="rounded-[var(--radius-tile)]"` — tarjeta de primer nivel de /buscar con radio bento.
- **ParlamentarioDirectoryRow** (`parlamentario-directory-row.tsx`): root `rounded-lg` a `rounded-[var(--radius-tile)]`.
- **buscar/page.tsx**: 3 boxes (error L93, empty L105, error L139) `rounded-lg` a `rounded-[var(--radius-tile)]`.
- **parlamentarios/page.tsx**: honest-empty box `rounded-lg` a `rounded-[var(--radius-tile)]`.
- **agenda/page.tsx**: error box + empty box + `<li>` resultado `rounded-lg` a `rounded-[var(--radius-tile)]`.
- **card.tsx**: no editado (firewall D3 respetado; git diff limpio).
- Skeletons, inputs de filtro, pills `rounded-full`, acordeones/charts/tablas: byte-idénticos.

### Test changes

- `buscar/coverage.test.tsx`: assert `max-w-[1120px]` presente, `max-w-3xl` ausente en BuscarPage.
- `parlamentarios/page.test.tsx`: asserts `rounded-[var(--radius-tile)]` en fila directorio y en honest-empty box.
- `search-result-card.test.tsx`: assert `container.innerHTML` contiene `rounded-[var(--radius-tile)]`.
- `agenda/page.test.tsx`: AgendaPage full render via `renderToStaticMarkup` — assert `max-w-[1120px]`.

## Deviations from Plan

None — plan executed exactly as written. All 12 swaps in the interfaces block applied verbatim.

## Known Stubs

None — este plan es de presentacion pura; cero datos, cero stubs.

## Threat Flags

None — fase 100% presentacional; cero endpoints nuevos, cero inputs de usuario nuevos.

## Self-Check: PASSED

- Commits verificados: 1f0731b, 98de9db, 12e3b75.
- card.tsx sin modificar (git diff limpio).
- 7 archivos de produccion modificados, 4 archivos de test extendidos.
- Cero hex, sintaxis `[var(--radius-tile)]` en todos los swaps.
