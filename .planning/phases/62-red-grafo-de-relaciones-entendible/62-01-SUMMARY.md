---
phase: 62-red-grafo-de-relaciones-entendible
plan: 01
subsystem: frontend / red (grafo de relaciones)
tags: [red, xyflow, radial-layout, anti-insinuacion, ego-network, tdd]
requires:
  - "subgrafo_red RPC (shipped, PII-safe, p_depth:1) — sin cambios"
  - "formatNombre de @/lib/format"
  - "@xyflow/react@12 client island"
provides:
  - "layout radial ego-céntrico determinista (radialPos) reemplaza la rejilla posicion()"
  - "cap duro de 24 vecinos alfabéticos + control honesto 'Ver N vecinos más' con Links /red?seed=<id>"
  - "leyenda reescrita: 'La posición en el anillo es orden alfabético, no cercanía'"
affects:
  - "app/components/red/red-graph.tsx (isla cliente /red)"
  - "app/components/red/red-graph.test.tsx"
tech-stack:
  added: []
  patterns:
    - "radial ego layout = position:{x,y} puro por trig (cero física, F18 LOCKED)"
    - "neighbor cap client-side + overflow list (sin DDL, RPC intacto)"
    - "banned-vocab scan que remueve negaciones LOCKED antes de escanear afirmaciones"
key-files:
  created: []
  modified:
    - "app/components/red/red-graph.tsx"
    - "app/components/red/red-graph.test.tsx"
decisions:
  - "Cap client-side (no en page.tsx/RPC): mantiene el RPC intacto y da la lista completa de vecinos gratis para 'N más' (RESEARCH open-question 1)."
  - "Solo aristas entre nodos renderizados (seed + 24): no se trazan líneas a vecinos capados; RESEARCH open-question 2 (star ego-céntrico)."
  - "banned-vocab: la copy LOCKED usa 'no cercanía'/'no indican afinidad' (negaciones); el scan remueve esas frases LOCKED y escanea el resto para bloquear afirmaciones — reconcilia UI-SPEC LOCKED con la aserción de Task 1."
metrics:
  duration: "~7 min"
  completed: "2026-07-09"
  tasks: 2
  files: 2
---

# Phase 62 Plan 01: Grafo radial ego-céntrico + cap honesto Summary

Reemplacé la rejilla por-cámara de `red-graph.tsx` por un layout radial ego-céntrico determinista (`radialPos`), capé los vecinos renderizados a 24 en orden alfabético con un control honesto "Ver N vecinos más" (cada nombre un Link a `/red?seed=<id>`), y reescribí la leyenda para declarar "La posición en el anillo es orden alfabético, no cercanía" — cerrando RED-01 (ego-network real + cap) y el núcleo de RED-02 (layout radial + leyenda). Cero force-simulation, cero DDL, cero cambios a page.tsx/RPC.

## What Was Built

- **Task 1 (TDD RED):** reescribí el bloque de tests de layout en `red-graph.test.tsx`:
  - Eliminé el describe "layout por carril" (rejilla `BANDA_SENADO`) — la rejilla ya no existe.
  - Test radial-determinista: seed en `(0,0)`; vecino alfabético 0 (Ana) a las 12 en punto (x≈0, y negativo); reordenar el array de entrada NO cambia ninguna posición (F18).
  - Test cap RED-01: con 30 vecinos, el DOM tiene exactamente 25 nodos (`[data-testid^="rf-node-"]`) y aparece "Ver 6 vecinos más" (30−24) con 6 Links `/red?seed=`.
  - Scan banned-vocab extendido a la leyenda (`/afinidad|cercan[íi]a|aliado|red de poder/i`) + exige la copy literal "orden alfabético" y "no cercanía".
  - Confirmado RED: 5 tests nuevos en rojo contra el código de rejilla, resto verde. Commit `4969df3` (`test(62-01)`).

- **Task 2 (TDD GREEN):** implementé en `red-graph.tsx`:
  - `radialPos(index, total)` (RING1_R=260, RING2_R=460, CAP=24, perRing=12; `theta = -π/2 + 2π·inRing/countInRing`, `Math.round`) reemplaza `posicion(laneIndex, camara)`.
  - `seedNeighbors` memo (otro extremo de cada arista visible que toca el seed, ordenado `localeCompare(..., "es")` sobre `formatNombre`) → `rendered = slice(0,24)`, `overflow = slice(24)`.
  - `rfNodes = [seed@(0,0), ...rendered@radialPos]`; rama fallback sin-seed conserva un render radial mínimo de `nodosVisibles`. `rfEdges` sólo entre nodos renderizados.
  - Docblock anti-insinuación + tercer `<li>` de leyenda reescritos con la copy LOCKED de UI-SPEC.
  - Control honesto de overflow bajo el canvas: "Se muestran los primeros 24 vecinos en orden alfabético." + "Ver {N} vecinos más" + lista de Links `/red?seed=<id>` (touch-target `min-h-11`).
  - Suite 742/742 verde, typecheck verde. Commit `ee03c95` (`feat(62-01)`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Conflicto entre el scan banned-vocab de Task 1 y la copy LOCKED de la leyenda**
- **Found during:** Task 2 (al escribir la leyenda con la copy LOCKED de UI-SPEC).
- **Issue:** La aserción de Task 1 exige `not.toMatch(/afinidad|cercan[íi]a|.../i)` sobre TODO el `textContent`, pero la copy LOCKED de UI-SPEC (L179) contiene literalmente "no **cercanía**" y "no indican **afinidad**" (negaciones que SON el anti-insinuación). Las dos condiciones eran mutuamente insatisfacibles tal cual.
- **Fix:** El scan remueve primero las dos frases negadas LOCKED (`orden alfabético, no cercanía` y `no indican afinidad ni relación`) y luego escanea el resto — bloquea las palabras usadas como AFIRMACIÓN, permite las negaciones LOCKED. Preserva la intención del guard (bloquear regresión de copy afinitaria) sin romper la copy contractual.
- **Files modified:** `app/components/red/red-graph.test.tsx`
- **Commit:** `ee03c95`

### TDD Gate Compliance

- RED gate: `test(62-01)` commit `4969df3` (5 tests en rojo confirmados antes de implementar).
- GREEN gate: `feat(62-01)` commit `ee03c95` (742/742 verde + typecheck verde).
- REFACTOR gate: no fue necesario.

## Verification Evidence

- `pnpm test -- red-graph` → **742 passed (70 files)**, incluye radial-determinism ×2, node-count cap ≤25, banned-vocab leyenda, más los tests preexistentes de nodo/arista/provenance/filtros/estado-honesto/ego (55-05)/móvil (F-04).
- `pnpm typecheck` → verde (`tsc --noEmit`, sin salida de error).
- Grep: `red-graph.tsx` NO contiene `posicion(` ni `laneCounters`; SÍ contiene `function radialPos(`, `const CAP = 24` y "orden alfabético". `red-graph.test.tsx` NO contiene "layout por carril" ni "BANDA_SENADO".

## Notes for the Next Plan

- RED-02 tiene ítems restantes fuera de este plan: **cámara-border cue** (`nodo-parlamentario.tsx` + `.net-*` en globals.css) y **móvil vecinos-list `<768px`** (este plan mantuvo la nota móvil shipped byte-idéntica; UI-SPEC pide reemplazarla por una lista real). Estos quedan para 62-02 según el roadmap.
- **RED-03** (BrowserOS cold-read + deploy runbook 61-02) es un gate de ops out-of-band, no cubierto aquí.
- La rama fallback sin-seed usa `radialPos` sobre el índice de llegada (determinista) sólo para no romper el render legacy; el foco de la fase es el path CON seed.

## Self-Check: PASSED

- FOUND: app/components/red/red-graph.tsx (modified — radialPos, CAP=24, leyenda, overflow control)
- FOUND: app/components/red/red-graph.test.tsx (modified — radial/cap/banned-vocab tests)
- FOUND commit: 4969df3 (test(62-01))
- FOUND commit: ee03c95 (feat(62-01))
