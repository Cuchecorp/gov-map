---
phase: 88-b-squeda-p1c-ranking-explicable-filtros-client-side-island
plan: "02"
subsystem: buscar
tags: [react, client-island, filtros, facetas, aria-pressed, useMemo, useState]
dependency_graph:
  requires:
    - phase: 88-01
      provides: [BuscarSliceRow, EstadoBucket, ETIQUETA_BUCKET, deriveAnio]
  provides:
    - BuscarFiltros island client (filtrado/orden en memoria, zero-network)
    - 22 tests jsdom cubriendo facetas, counts, orden, aria, empty-state
  affects: [88-03-page-wiring]
tech_stack:
  added: []
  patterns: [zero-network-island, useMemo-filter-reorder, aria-pressed, honest-counts]
key_files:
  created:
    - app/components/buscar-filtros.tsx
    - app/components/buscar-filtros.test.tsx
key_decisions:
  - "Labels de estado de faceta via ETIQUETA_BUCKET directo (Advisory #1: no re-pasar por EtapaBadge que re-corre su propio resolver con el bug ley-antes-de-tramit)"
  - "Counts computados sobre el slice completo recibido, no sobre la lista filtrada (FILT-02 honesto)"
  - "aria-pressed introducido al repo (0 usos previos) espejando el tratamiento aria-current de ficha-rail.tsx"
  - "Faceta partido: no renderiza si ninguna fila trae partido; aparece si hay datos (BIO-03/P2 forward-compat sin placeholder confuso)"
  - "Order mode 'relevancia' preserva el orden de entrada = rank del retrieval; sort stable en JS garantiza determinismo"
requirements-completed: [FILT-01, FILT-02, RANK-01]
duration: ~20 min
completed: "2026-07-22"
---

# Phase 88 Plan 02: BuscarFiltros island — facetas + counts honestos + orden explicable

Island client `"use client"` que recibe `BuscarSliceRow[]` del server y filtra/reordena EN MEMORIA con `useState`/`useMemo` — cero red, cero Supabase, 22 tests jsdom verdes.

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-22
- **Tasks:** 2 (Task 1 island + Task 2 tests — ejecutados juntos como TDD net-new)
- **Files created:** 2

## Accomplishments

- Island `BuscarFiltros` con facetas año/iniciativa/estado/cámara filtrando en memoria (FILT-01)
- Counts honestos "de estos N" sobre el slice recibido + leyenda LOCKED visible (FILT-02)
- Facetas count-0: `disabled` + `aria-disabled="true"` + `opacity-40`, nunca removidas
- Toggle de orden 3 modos explicables (RANK-01): Relevancia · Más recientes · Mensajes primero
- `aria-pressed` introducido al repo (Advisory #2: cero usos previos) espejando ficha-rail petróleo
- Faceta partido no renderizada (BIO-03/P2 forward-compat); sin placeholder que confunda
- Empty-after-filter con heading + body exactos LOCKED
- sin_dato bucket y año Sin dato siempre visibles en facetas

## Task Commits

1. **Task 1+2: Island + tests (TDD net-new)** — `a11819d` (feat)

## Files Created

- `app/components/buscar-filtros.tsx` — Island client de filtros/orden; props `{ slice: BuscarSliceRow[], renderRow? }`; cero import @/lib/supabase
- `app/components/buscar-filtros.test.tsx` — 22 tests jsdom: counts, leyendas exactas, toggle faceta, disabled count-0, sin_dato, 3 modos orden, empty-after-filter, partido ausente

## Decisions Made

- Labels de estado de faceta via `ETIQUETA_BUCKET[bucket]` directo — Advisory checker #1 obliga a NO pasar buckets por `EtapaBadge` (re-corre su propio resolver con el bug ley-antes-de-tramit)
- Counts sobre el slice completo, no sobre la lista filtrada post-aplicación — garantiza honestidad FILT-02
- `aria-pressed={engaged ? "true" : "false"}` como string explícito para cumplir el contrato WAI-ARIA sin sorpresa (Advisory #2)

## Deviations from Plan

None — plan ejecutado exactamente como escrito. Advisory #1 (no EtapaBadge en chips de faceta) y Advisory #2 (aria-pressed como novedad) ya incorporados como spec, no como desvío.

## Known Stubs

Ninguno. El island recibe el slice ya computado; no hay datos mockeados ni placeholders que bloqueen el objetivo del plan.

## Threat Flags

Ninguno. T-88-04 mitigado (cero import supabase verificado por grep). T-88-05 mitigado (JSX interpolation, sin dangerouslySetInnerHTML). T-88-07 mitigado (leyenda LOCKED + test que la fija).

## Self-Check: PASSED

- `app/components/buscar-filtros.tsx` existe con `"use client"` y sin import supabase
- `app/components/buscar-filtros.test.tsx` existe con 22 tests verdes
- `pnpm exec vitest run components/buscar-filtros.test.tsx` — 22 passed
- `pnpm exec tsc --noEmit` — limpio
- Commit: a11819d
