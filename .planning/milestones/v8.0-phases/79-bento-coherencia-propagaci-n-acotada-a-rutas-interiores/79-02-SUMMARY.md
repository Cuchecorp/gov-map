---
phase: 79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores
plan: "02"
subsystem: frontend-fichas
tags: [bento, container, scroll-mt, fichas, layout]
dependency_graph:
  requires: []
  provides: [BENTO-04-fichas]
  affects: [app/app/parlamentario, app/app/proyecto, app/app/contraparte]
tech_stack:
  added: []
  patterns: [tailwind-arbitrary-value, global-scroll-margin-top]
key_files:
  created: []
  modified:
    - app/app/parlamentario/[id]/page.tsx
    - app/app/proyecto/[boletin]/page.tsx
    - app/app/contraparte/[id]/page.tsx
    - app/app/parlamentario/[id]/page.test.tsx
    - app/app/parlamentario/[id]/page-estructura.test.ts
    - app/app/proyecto/[boletin]/page.test.tsx
    - app/app/proyecto/[boletin]/page-cruces.test.ts
decisions:
  - "container 1120px aplicado a las 3 fichas (parlamentario/proyecto/contraparte)"
  - "scroll-mt-6 removido de todas las <section id=...> y div-anclas de ficha; aplica global scroll-margin-top: 5rem (Phase 76)"
  - "4 tests de ficha reconciliados: NOT scroll-mt-6 + max-w-[1120px]; gate visual real en Phase 81"
  - "money-antiflip-guard.test.ts timeout: pre-existente, fuera de alcance (escanea packages/ que no existe en worktree)"
metrics:
  duration: "~12 minutos"
  completed: "2026-07-15"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 7
---

# Phase 79 Plan 02: Bento Coherencia — Fichas (container 1120px + scroll-mt reconciliado) Summary

**One-liner:** container max-w-[1120px] propagado a las 3 fichas + scroll-mt-6 local removido para que aplique el offset global de 80px; 4 tests de ficha reconciliados y verdes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Swap container 1120px en las 3 fichas | 9e37b49 | page.tsx x3 |
| 2 | Reconciliar scroll-mt-6 local con header sticky | 699e410 | parlamentario/page.tsx, proyecto/page.tsx |
| 3 | Reconciliar tests de ficha (parlamentario + proyecto) | 2261b16 | 4 test files |

## What Was Built

**Task 1 — Container swap (3 fichas):**
- `/parlamentario/[id]`: `max-w-5xl` → `max-w-[1120px]` (origen: max-w-5xl)
- `/proyecto/[boletin]`: `max-w-5xl` → `max-w-[1120px]` (origen: max-w-5xl)
- `/contraparte/[id]`: `max-w-3xl` → `max-w-[1120px]` (origen: **max-w-3xl**, NO max-w-5xl — diferente al par parlamentario/proyecto; documentado para evitar doc-drift con CONTEXT)
- Interiores byte-idénticos: cero swap de radio (los únicos rounded-lg son skeletons/aria-hidden — verificado)
- `mx-auto px-4 md:px-8 py-8 md:py-16` preservados VERBATIM

**Task 2 — Fix scroll-mt (fichas con anclas):**
- `/parlamentario/[id]`: removido `scroll-mt-6` de 8 `<section id=...>` + 1 `<div id="cruces-detalle">` + `<section id="financiamiento-pendiente" className="mt-12 opacity-60">`
- `/proyecto/[boletin]`: removido `scroll-mt-6` de 9 `<section id=...>` (incluyendo `<section id="cruces">`)
- `/contraparte/[id]`: sin anclas scroll-mt-6 — no requería fix
- Aplica el global `scroll-margin-top: 5rem` (80px) de `globals.css L106` (Phase 76)
- `md:top-6` del FichaRail intacto (posición de columna, no offset de ancla)
- Comentario de prosa en parlamentario/page.tsx actualizado para no mentir sobre el offset

**Task 3 — Reconciliación de tests (4 archivos):**
- `parlamentario/[id]/page.test.tsx L398`: `toContain("mt-12 scroll-mt-6")` → `toContain("mt-12")` + `not.toContain("scroll-mt-6")`
- `parlamentario/[id]/page-estructura.test.ts L97-100`: `.toContain("scroll-mt-6")` → `.not.toContain("scroll-mt-6")` por cada sección; prosa L10 reconciliada
- `proyecto/[boletin]/page.test.tsx`: `max-w-5xl` → `max-w-[1120px]`; `not.toContain("max-w-5xl")`; `countOccurrences scroll-mt-6 >= 6` → `not.toContain("scroll-mt-6")`; nombre del `it(...)` reconciliado
- `proyecto/[boletin]/page-cruces.test.ts L27`: `mt-12 scroll-mt-6` → `mt-12`; asserts de placement/gate (L30-44) sin cambios
- Todos los tests incluyen comentario señalando el gate visual de Phase 81 (BrowserOS deploy real)

## Verification

- tsc --noEmit: limpio (Task 1 y Task 2)
- Suite con filtro parlamentario+proyecto: **870 tests green** (77 archivos de test)
- Suite completa: 869/870 — 1 fallo pre-existente (`money-antiflip-guard.test.ts` timeout al escanear `packages/` que no existe en worktree; fuera del alcance de este plan)
- Ninguna `<section id=...>` de ficha con `scroll-mt-6` en className (confirmado con grep)
- Las 3 fichas con `max-w-[1120px]`
- Cero swap de radio; cero hex nuevo

## Deviations from Plan

None - plan executed exactly as written, with one pre-existing test issue documented below.

## Known Pre-existing Issue (out of scope)

`lib/money-antiflip-guard.test.ts` — `WR-03: ningún archivo fuente de packages/ nombra MONEY_PUBLIC_ENABLED crudo`: timeout en 5000ms porque escanea el directorio `packages/` que no existe en el worktree (este test pasa en el repo principal). Pre-existente, no introducido por este plan. Documentado en `deferred-items.md` si aplica.

## Known Stubs

None.

## Threat Flags

None — fase 100% presentación, cero datos/RPC/red.

## SUMMARY Note

La contraparte usaba `max-w-3xl` (NO `max-w-5xl` como las fichas parlamentario/proyecto). Origen por ruta:
- `/parlamentario/[id]`: max-w-5xl → max-w-[1120px]
- `/proyecto/[boletin]`: max-w-5xl → max-w-[1120px]
- `/contraparte/[id]`: max-w-3xl → max-w-[1120px]
- `/red`: EXCLUIDO (invariant 4, documentado en CONTEXT/UI-SPEC)

## Self-Check: PASSED

- [x] app/app/parlamentario/[id]/page.tsx: contiene max-w-[1120px], no contiene scroll-mt-6
- [x] app/app/proyecto/[boletin]/page.tsx: contiene max-w-[1120px], no contiene scroll-mt-6
- [x] app/app/contraparte/[id]/page.tsx: contiene max-w-[1120px]
- [x] 4 test files reconciliados y verdes
- [x] Commits 9e37b49, 699e410, 2261b16 existen
