---
phase: 88-b-squeda-p1c-ranking-explicable-filtros-client-side-island
plan: "03"
subsystem: busqueda
tags: [linter, enriquecimiento-slice, island, search-result-card, chips-neutros]
dependency_graph:
  requires: ["88-01", "88-02"]
  provides: [FILT-01, FILT-02, FILT-03, RANK-01]
  affects: [app/app/buscar/page.tsx, app/components/search-result-card.tsx, app/lib/anti-insinuacion-guard.test.ts]
tech_stack:
  patterns: [server-component-enrich-then-island, honest-null-propagation, min-fecha-tramitacion-evento]
key_files:
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
    - app/app/buscar/page.tsx
    - app/components/search-result-card.tsx
    - app/app/buscar/resultados-error.test.tsx
decisions:
  - "año derivado exclusivamente de min(tramitacion_evento.fecha) por boletín; nunca fecha_captura ni sufijo boletín"
  - "error de tramitacion_evento produce banner honesto idéntico al de hidratación (nunca ?? [] silencioso)"
  - "chip año null → 'Sin dato' visible (Advisory #4, coherente con faceta isla)"
  - "iniciativa null → chip omitido (honesto, no placeholder)"
  - "truthy-trim fallback estado → etapa antes de estadoBucket() (Advisory #3)"
  - "mock resultados-error actualizado para soportar cadena .in().order() (Rule 1 auto-fix)"
metrics:
  duration: "~15 min"
  completed: "2026-07-22"
  tasks_completed: 3
  files_modified: 4
---

# Phase 88 Plan 03: Wiring server + card + linter Summary

Server-component /buscar enriches each result row with year (from `min(tramitacion_evento.fecha)`), `estadoBucket`, and `iniciativa`, mounts the `BuscarFiltros` island, and `SearchResultCard` renders neutral Mensaje/Moción + year chips — with the anti-insinuación linter now scanning both new files.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add SUPERFICIES_BUSQUEDA to anti-insinuacion linter scan loop | 19953aa |
| 2 | Enrich slice in page.tsx (year from tramitacion_evento) + mount island | 018a1e3 |
| 3 | Chip Mensaje/Moción + año in SearchResultCard (no score) | 018a1e3 |

## Verification

- `pnpm exec vitest run`: 1059 tests, 84 test files — all green
- `pnpm exec tsc --noEmit`: clean
- Grep confirms: no `fecha_captura` used for year in page.tsx
- Grep confirms: no `?? []` after `tramitacion_evento` error path
- Grep confirms: no score/cosine/rank/similarity in search-result-card.tsx render
- Anti-insinuación linter scans `buscar-filtros.tsx` and `buscar/page.tsx`; mutation self-check green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock did not support `.in().order()` chain**
- **Found during:** Task 2 full suite run
- **Issue:** `resultados-error.test.tsx` mock built `from().select().in()` returning a Promise directly; the new `tramitacion_evento` read chains `.order()` after `.in()`, causing `TypeError: .order is not a function`
- **Fix:** Refactored mock to differentiate `from("proyecto")` vs `from("tramitacion_evento")`, adding `.order()` support on the eventos chain; reset state properly in `beforeEach`
- **Files modified:** `app/app/buscar/resultados-error.test.tsx`
- **Commit:** 018a1e3

## Self-Check: PASSED

- `app/app/buscar/page.tsx` — exists, contains `.from("tramitacion_evento")`, `BuscarFiltros`, `estadoBucket`, `deriveAnio`
- `app/components/search-result-card.tsx` — exists, contains `iniciativa?`, `anio?`, Badge chips, no score
- `app/lib/anti-insinuacion-guard.test.ts` — exists, contains `SUPERFICIES_BUSQUEDA`, updated scan loop
- Commits 19953aa, 018a1e3 — confirmed in git log
