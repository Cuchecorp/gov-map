---
phase: 76-bento-base-primitivas-bento-chrome-global
plan: "02"
subsystem: frontend-chrome
tags: [chrome-global, sticky-header, footer, bento, tailwind, source-scan-tests]
dependency_graph:
  requires: []
  provides: [GlobalHeader sticky 1120px, footer border-top 1120px, SC3 SC4 SC5 tests]
  affects: [app/components/global-header.tsx, app/app/layout.tsx]
tech_stack:
  added: []
  patterns: [source-scan test idiom (process.cwd), Tailwind arbitrary values (max-w-[1120px])]
key_files:
  modified:
    - app/components/global-header.tsx
    - app/components/global-header.test.ts
    - app/app/layout.tsx
    - app/app/layout.test.tsx
decisions:
  - "sticky top-0 z-40 añadido al <header>; preserva gate netPublicEnabled e HeaderNav intactos"
  - "contenedor header: max-w-5xl → max-w-[1120px], padding px-4 py-2 md:px-8 → px-6 py-3"
  - "footer bg-muted/40 quitado; border-t y mt-16 conservados (Discretion note: mt-16)"
  - "contenedor footer: max-w-3xl → max-w-[1120px]; copy CC BY LOCKED byte-idéntico"
  - "/red NO recibe cambio de contenedor en 76 (invariante 4); verificación visual es Phase 79/81"
  - "{children} NO envuelto en <main> global (invariante: cada page trae el suyo, Pitfall 4)"
metrics:
  duration: "~10 min"
  completed: "2026-07-15"
  tasks_completed: 2
  files_changed: 4
---

# Phase 76 Plan 02: Chrome Global (Sticky Header + Footer Restyle) Summary

**One-liner:** GlobalHeader sticky top-0 z-40 con contenedor max-w-[1120px] y footer border-top sin fondo max-w-[1120px] — cambios quirúrgicos de 2 líneas de clase en cada archivo; nav gate, copy LOCKED y layouts internos intactos.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | GlobalHeader sticky + contenedor 1120px + test SC3 | 4deeb3f | global-header.tsx, global-header.test.ts |
| 2 | Footer border-top sin fondo + contenedor 1120px + test SC4/SC5 | 74680be | layout.tsx, layout.test.tsx |

## What Was Built

### Task 1: GlobalHeader sticky + contenedor 1120px

`app/components/global-header.tsx` — 2 strings de clase cambiadas:
- `<header>`: añadido `sticky top-0 z-40` antes de `border-b border-border bg-background`
- `<div>` contenedor: `max-w-5xl` → `max-w-[1120px]`; padding `px-4 py-2 md:px-8` → `px-6 py-3`

Invariantes preservados: `netPublicEnabled(process.env)` (línea 30) y `<HeaderNav showRed={showRed} />` (línea 43) byte-idénticos.

`app/components/global-header.test.ts` — 3 asserts añadidos (Tests 5-7):
- `expect(SRC).toMatch(/sticky/)` — SC3
- `expect(SRC).toMatch(/top-0/)` — SC3
- `expect(SRC).toContain("max-w-[1120px]")` — SC3

### Task 2: Footer border-top sin fondo + contenedor 1120px

`app/app/layout.tsx` — 2 strings de clase cambiadas:
- `<footer>`: `"mt-16 border-t bg-muted/40"` → `"mt-16 border-t"` (quitado bg-muted/40)
- `<div>` interno: `max-w-3xl` → `max-w-[1120px]`

Todo el bloque de copy (`<p className="leading-relaxed">` hasta `</footer>`) byte-idéntico. `{children}` NO envuelto en `<main>` (invariante SC5).

`app/app/layout.test.tsx` — 5 asserts añadidos (Tests 6-10):
- Test 6: `not.toMatch(/bg-muted\/40/)` — SC4
- Test 7: `toContain("max-w-[1120px]")` — SC4
- Test 8: `not.toMatch(/<main/)` — SC5 (no-main-global)
- Test 9: strings LOCKED de licencia CC BY — SC4
- Test 10: trust line LOCKED — SC4

## Verification Results

```
pnpm --filter ./app test -- --run layout  →  74 files, 828 tests, 0 failures
```

Los tests SC3, SC4, SC5 están verdes. El único failure de la suite completa es `lib/money-antiflip-guard.test.ts` (timeout pre-existente no relacionado con esta fase).

## Deviations from Plan

None — plan ejecutado exactamente como escrito. Cambios quirúrgicos de 2 líneas de clase en cada archivo de producción, test extendidos sin reescribir tests existentes.

## Threat Surface Scan

Ningún nuevo flujo de datos ni endpoint. La fase es 100% presentación:
- `netPublicEnabled` gate preservado byte-idéntico (T-76-03 mitigado)
- Strings LOCKED CC BY verificados por Tests 9-10 (T-76-04 mitigado)
- `PUBLIC_INDEXABLE` / `generateMetadata` intactos (T-76-05 aceptado, Test 5 existente)

## Known Stubs

None. Esta fase no introduce datos ni copy nuevo.

## Notes

- `/red` NO recibe cambio de contenedor en esta fase (invariante 4). Su `<main className="max-w-3xl">` propio queda intacto. El ajuste consciente de `/red` está diferido a Phase 79/81 (gate visual).
- El sticky header puede ocluir anchors en fichas largas (Pitfall 1 del RESEARCH). El `scroll-margin-top` global corresponde al Plan 76-01 (tokens/globals.css), no a este plan. El gate visual definitivo es Phase 81.
- Suite target 828 tests verdes al cierre de este plan.

## Self-Check: PASSED

- [x] `app/components/global-header.tsx` contiene `sticky top-0 z-40` y `max-w-[1120px]`
- [x] `app/components/global-header.test.ts` contiene Tests 5-7 (sticky/top-0/1120px)
- [x] `app/app/layout.tsx` contiene `border-t` sin `bg-muted/40` y `max-w-[1120px]`
- [x] `app/app/layout.test.tsx` contiene Tests 6-10 (SC4/SC5)
- [x] Commit 4deeb3f verificado (Task 1)
- [x] Commit 74680be verificado (Task 2)
- [x] 828 tests verdes (layout run)
