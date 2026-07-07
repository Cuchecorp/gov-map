---
phase: 54-uxdemo-pulido-presentacional
plan: 03
subsystem: ui
tags: [nextjs, server-components, home, navigation, tailwind, banned-vocab]

# Dependency graph
requires:
  - phase: 19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend
    provides: hero LOCKED (h1, subtítulo, SearchBox, chips, trust line) + design tokens crema/petróleo
  - phase: 52-uxnav (ActualidadModule)
    provides: módulo de actualidad server-rendered bajo el hero
provides:
  - "3 tarjetas de entrada server-rendered en el home (Proyectos de ley / Parlamentarios 360 / Agenda de la semana)"
  - "<nav aria-label='Secciones del sitio'> full-card entre hero y ActualidadModule, cero JS"
  - "seam del fold: bottom padding del hero reducido (pt-16 pb-8 md:pt-24 md:pb-10) sin tocar contenido"
affects: [54-04, 54-05, demo-screenshots, home]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tarjeta de entrada = <Link> full-card block con título <span> (no heading) + glyph → con pl-1"
    - "banned-vocab negative-match reutilizado como aserción de test sobre copy nuevo"

key-files:
  created: []
  modified:
    - app/app/page.tsx
    - app/app/page.test.tsx

key-decisions:
  - "Copy de tarjetas en const ENTRY_CARDS + map (server-rendered) para legibilidad; títulos LOCKED, líneas de valor verbatim del Contract 2"
  - "Seam del fold aplicado al valor recomendado (pb-8 md:pb-10), sin bajar al piso pb-8 md:pb-8 — verificación visual del fold queda en Plan 05"

patterns-established:
  - "Bloque de navegación de secciones sin heading, ubicado entre h1 del hero y h2 de actualidad (jerarquía de headings intacta)"

requirements-completed: [UX-02]

# Metrics
duration: 6min
completed: 2026-07-07
---

# Phase 54 Plan 03: 3 tarjetas de entrada en home + seam del hero Summary

**Home con `<nav>` de 3 tarjetas de entrada full-card server-rendered (Proyectos de ley / Parlamentarios 360 / Agenda de la semana) entre el hero LOCKED y ActualidadModule, con el bottom padding del hero reducido para respetar el fold a 1280×800.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-07T01:16:00Z
- **Completed:** 2026-07-07T01:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Bloque `<nav aria-label="Secciones del sitio">` con 3 `<Link>` full-card, clases exactas del Contract 2 (max-w-5xl, grid gap-4 sm:grid-cols-3, card rounded-lg border bg-card p-4 + hover/focus), glyph `→` con `pl-1` (nunca whitespace text node, lección F53), sin heading dentro del bloque
- Copy exacto: títulos LOCKED + 3 líneas de valor verbatim; hrefs estáticos /buscar, /parlamentarios, /agenda
- Seam del fold: hero `<section>` `py-16 md:py-24` → `pt-16 pb-8 md:pt-24 md:pb-10` (único lever permitido); contenido del hero byte-identical
- 5 tests nuevos: nav/aria, 3 hrefs+títulos, 3 líneas de valor, ausencia de heading nuevo, banned-vocab negative-match

## Task Commits

Each task was committed atomically:

1. **Task 1: Insertar el bloque de 3 tarjetas + ajustar el seam del hero** - `d02116e` (feat)
2. **Task 2: Tests del bloque de tarjetas** - `0fcb35b` (test)

## Files Created/Modified
- `app/app/page.tsx` - Añadido `const ENTRY_CARDS` + bloque `<nav>` con 3 `<Link>` full-card entre hero y ActualidadModule; reducido el bottom padding del hero para el seam del fold
- `app/app/page.test.tsx` - Añadido `describe` "Contract 2: tarjetas de entrada" (5 tests) + import `within`

## Decisions Made
- Copy de tarjetas modelado como `const ENTRY_CARDS` + `.map()` en lugar de tres bloques inline, por legibilidad y para evitar deriva de copy; todos los strings son estáticos server-rendered
- Aplicado el valor recomendado del seam (`pb-8 md:pb-10`) y no el piso (`pb-8 md:pb-8`); la validación empírica del fold a 1280×800 se cubre con el screenshot demo-01-home-1280.jpg del Plan 05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Suite completa verde (584 tests, +5 sobre baseline 579), `tsc -b` limpio.

## User Setup Required
None - no external service configuration required. Sin redeploy (Wave 3 lo consolida).

## Next Phase Readiness
- Tarjetas listas; la aceptación visual del fold (hero + 3 tarjetas sin scroll a 1280×800) se verifica en Plan 05 con el screenshot canónico.
- Hero content intacto (LOCKED F19); jerarquía de headings sin cambios.

## Self-Check: PASSED

- FOUND: app/app/page.tsx
- FOUND: app/app/page.test.tsx
- FOUND: .planning/phases/54-uxdemo-pulido-presentacional/54-03-SUMMARY.md
- FOUND commit: d02116e (Task 1)
- FOUND commit: 0fcb35b (Task 2)

---
*Phase: 54-uxdemo-pulido-presentacional*
*Completed: 2026-07-07*
