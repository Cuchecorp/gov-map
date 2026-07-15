---
phase: 79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores
plan: "03"
subsystem: ui
tags: [bento, testing, guard, no-regression, tailwind, next.js]

requires:
  - phase: 79-01
    provides: coherencia bento propagada a rutas de primer nivel (8 rutas con contenedor 1120px)
  - phase: 79-02
    provides: coherencia bento propagada a fichas interiores + scroll-mt reconciliado con header 80px

provides:
  - Guard CI `bento-coherencia-guard.test.ts` que congela el firewall D3 (card.tsx sin radius-tile) y la exclusion de /red (max-w-3xl, no 1120px), con mutation self-check por ambos ejes
  - Assert de no-regresion de ancho en page.test.tsx de /red (source-scan: max-w-3xl presente, max-w-[1120px] ausente)
  - Suite completa verde (885 tests), tsc limpio, globals.test.ts + red-graph.test.tsx verdes
  - Documentacion de la exclusion de /red con racional en este SUMMARY

affects: [fase-81-gate-visual, bento-tiles, /red, card.tsx]

tech-stack:
  added: []
  patterns:
    - "Guard source-scan con mutation self-check EN MEMORIA: detector puro (strings) probado sin disco, aplicado a archivos reales en test separado"
    - "readFileSync + process.cwd() (no import.meta.url) para source-scan en vitest — leccion 45-01"

key-files:
  created:
    - app/lib/bento-coherencia-guard.test.ts
  modified:
    - app/app/red/page.test.tsx

key-decisions:
  - "/red EXCLUIDO del contenedor bento 1120px (invariante 4): mover /red a 1120px cambiaria el ancho disponible del grafo (layout B aprobado 2026-07-13) sin beneficio de coherencia comparable; el chrome global (header/footer) ya da coherencia visual suficiente; la no-regresion de px se confirma con getComputedStyle en Phase 81 (gate 75)"
  - "card.tsx intocable (firewall D3): el swap de radio bento va SOLO en call sites como clase extra; el primitivo mantiene rounded-lg; guard falla si alguien mete rounded-[var(--radius-tile)] dentro del primitivo"
  - "/admin/revisar-entidades NO tocado: ruta admin sin valor de coherencia publica, fuera del alcance de BENTO-04"
  - "Fichas no recibieron swap de radio: correcto por construccion — los unicos rounded-lg en fichas son skeletons; scroll-mt-6 reconciliado con header 80px en Plan 79-02"

patterns-established:
  - "Mutation self-check EN MEMORIA: el test del guard incluye un bloque que aplica el detector a strings mutados en memoria (sin disco) para probar que el guard muerde por cada eje, antes de aplicarlo a los archivos reales"

requirements-completed: [BENTO-04]

duration: 15min
completed: 2026-07-15
---

# Phase 79 Plan 03: Candados de no-regresion BENTO-04 Summary

**Guard source-scan `bento-coherencia-guard.test.ts` con mutation self-check que congela el firewall D3 (card.tsx sin radius-tile) y la exclusion de /red (max-w-3xl, no 1120px); suite 885 verde + tsc limpio**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-15T13:00:00Z
- **Completed:** 2026-07-15T13:15:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Guard `bento-coherencia-guard.test.ts` (8 tests): detector puro + test verde sobre archivos reales (0 offenders) + mutation self-check por ambos ejes (FIREWALL + EXCLUSION-RED)
- Assert source-scan en `page.test.tsx` de /red: `max-w-3xl` presente + `max-w-[1120px]` ausente (2 tests nuevos, describe de invariante 4)
- Suite completa 885 tests verde, tsc limpio, `globals.test.ts` (guard tipografico) + `red-graph.test.tsx` (.net-chip 11px) verdes

## Task Commits

1. **Task 1: Guard source-scan firewall D3 + exclusion /red (mutation self-check)** - `dc94ded` (test)
2. **Task 2: Assert no-regresion de ancho en page.test.tsx de /red** - `dec92a3` (test)
3. **Task 3: Gate de no-regresion de fase + SUMMARY** - (docs)

## Files Created/Modified

- `app/lib/bento-coherencia-guard.test.ts` - Guard nuevo: detectarViolaciones(card, red) -> offenders; test real 0 offenders; mutation self-check EN MEMORIA por eje FIREWALL y EXCLUSION-RED
- `app/app/red/page.test.tsx` - Extendido con describe "no-regresion de ancho (invariante 4, BENTO-04)": source-scan max-w-3xl presente + max-w-[1120px] ausente; nota inline Phase 81

## Decisiones documentadas

### Exclusion de /red del contenedor bento (invariante 4)

**Decision:** /red NO recibe el contenedor `max-w-[1120px]` de la coherencia bento. Sus `<main>` permanecen en `max-w-3xl mx-auto` en las dos ramas (picker/honest L82 y grafo L163).

**Racional:**
- El layout B de /red fue aprobado el 2026-07-13 como resultado de un proceso de diseno deliberado (seed columna fan-out). Cambiar el ancho del area del grafo requiere una decision propia de diseno, no una herencia de coherencia bento.
- La isla `.net-*` (incluyendo `.net-chip` 11px, DEBT-05) es pixel-intocable.
- El chrome global (header/footer con el contenedor coherente) ya aporta la coherencia visual que necesita /red; ensanchar su `<main>` no agrega beneficio comparable.
- La no-regresion de pixeles reales (que el ancho no haya cambiado en deploy) se confirma con el gate visual `getComputedStyle` de Phase 81, que tambien cierra el gate 75.

### /admin/revisar-entidades no tocado

La ruta `/admin/revisar-entidades` es una superficie admin gateada, sin valor de coherencia publica. No fue modificada en ninguno de los tres planes de la fase 79.

### Fichas sin swap de radio

Las fichas (plan 79-02) no recibieron el swap `rounded-[var(--radius-tile)]` en Card: por construccion, los unicos `rounded-lg` en fichas son skeletons de carga, no card primitivos con contenido bento. El swap de radio va solo en call sites de los tiles de la grid bento, no en las fichas de detalle. El `scroll-mt-6` local fue reconciliado con el header de 80px (`scroll-mt-24`) en Plan 79-02.

### Handoff de capturas al orquestador

Las capturas BrowserOS antes/despues por ruta (8 rutas propagadas + /red no-regresion) son responsabilidad del ORQUESTADOR sobre `pnpm --filter ./app dev`, archivadas en `captures/`. NO son tarea del executor.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Candados de no-regresion BENTO-04 activos: cualquier regresion en firewall D3 o exclusion /red fallara en CI
- Phase 81 (gate visual): ejecutar BrowserOS para confirmar getComputedStyle en deploy real; cierra gate 75
- Las 8 rutas propagadas (Plans 79-01 y 79-02) + /red excluida estan documentadas y testeadas

---
*Phase: 79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores*
*Completed: 2026-07-15*

## Self-Check: PASSED

- `app/lib/bento-coherencia-guard.test.ts`: FOUND
- `app/app/red/page.test.tsx` (extended): FOUND
- Commit dc94ded: FOUND (Task 1)
- Commit dec92a3: FOUND (Task 2)
- Suite: 885 tests verde
- tsc: limpio
