---
phase: 47-vchart-chart-de-votos-ausencias-del-parlamentario
plan: 01
subsystem: ui
tags: [recharts, react, next, votos, chart, anti-insinuacion, viz]

# Dependency graph
requires:
  - phase: 46-patrimonio-chart
    provides: "patrón F46 (isla cliente Recharts + agregador puro server-side, stacked-NO-line)"
  - phase: 55-ui-spec
    provides: "gramática LOCKED (tokens/tipografía/color, colores de voto semánticos)"
provides:
  - "agruparVotosPorTrimestre: agregador puro VotoPeriodo[] por trimestre calendario"
  - "votos-chart.tsx: isla cliente Recharts (stacked BarChart discreto por trimestre)"
  - "sub-bloque 'Cuándo votó' al tope del detalle de Votaciones (capa-2)"
affects: [ficha-parlamentario, votos, demo-centro-estudios]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isla cliente Recharts (use client + import type) alimentada por agregador puro server-side"
    - "guard de fecha ISO (slice+regex) con exclusión honesta antes de bucketing"
    - "degrade honesto: serie vacía → empty-state copy, jamás barra en cero fabricada"

key-files:
  created:
    - app/components/votos-chart.tsx
    - app/components/votos-chart.test.tsx
  modified:
    - app/components/votos-por-parlamentario.tsx
    - app/components/votos-por-parlamentario.test.tsx

key-decisions:
  - "Chart montado al TOPE del detalle (capa-2), no en capa-1 (placement LOCKED del UI-SPEC)"
  - "Bucketing por trimestre calendario (granularidad honesta para dataset disperso)"
  - "periodos computados sobre TODO el conjunto confirmado (global), independiente de la faceta de tema"
  - "Fills semánticos single-source con VotosCapa1 SEGMENTO; petróleo prohibido"

patterns-established:
  - "Agregador temporal puro exportado + isla cliente type-only: cruza la frontera sin arrastrar server"
  - "Negative-match test: 'tendencia' sólo permitido en la caption que la niega"

requirements-completed: [VIZ-02]

# Metrics
duration: 7min
completed: 2026-07-08
---

# Phase 47 Plan 01: Chart de evolución de votos por trimestre (VCHART) Summary

**Stacked BarChart discreto por trimestre ("Cuándo votó") montado al tope del detalle de Votaciones, alimentado por el agregador puro `agruparVotosPorTrimestre` sobre las filas ya fetcheadas — cero fetch/RPC/DDL/deps nuevas, patrón F46 verbatim.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-08T02:53:30Z
- **Completed:** 2026-07-08T03:00:00Z
- **Tasks:** 3 (TDD: RED→GREEN cada una)
- **Files modified:** 4 (2 creados, 2 modificados)

## Accomplishments
- `agruparVotosPorTrimestre(votos): VotoPeriodo[]` — agregador puro que bucketea por trimestre calendario (`AAAA · Tn`), con guard ISO que excluye filas sin fecha parseable (omisión honesta), sin fabricar trimestres vacíos entre medio, orden numérico ascendente estable.
- `votos-chart.tsx` — isla cliente Recharts (`"use client"` + `import type`) espejo de `patrimonio-chart.tsx`: stacked `BarChart` discreto, `stackId="votos"`, `YAxis allowDecimals={false}`, fills semánticos single-source con `VotosCapa1`, `role="img"` + aria-label. Sin `LineChart`/`AreaChart`, sin fuga del cliente Supabase.
- Sub-bloque "Cuándo votó" como PRIMER hijo del detalle, encima de "Cómo votó", con caption factual o empty-state honesto (nunca barra en cero); los early returns (no ingestado / cero confirmados) siguen ganando.
- `derivarVotosViewData` computa `periodos` sobre `todasConMateria` (global, no la faceta activa).

## Task Commits

Cada tarea TDD con su par RED→GREEN:

1. **Task 1 (test):** `ba4b872` — failing tests agregador
2. **Task 1 (feat):** `26a432a` — `agruparVotosPorTrimestre` + `VotoPeriodo` + wiring
3. **Task 2 (test):** `8b0b94c` — failing RTL + source-scan isla
4. **Task 2 (feat):** `3027196` — `votos-chart.tsx`
5. **Task 3 (test):** `1272317` — failing tests sub-bloque "Cuándo votó"
6. **Task 3 (feat):** `b6b8f68` — montaje del sub-bloque

## Files Created/Modified
- `app/components/votos-chart.tsx` — isla cliente Recharts (stacked BarChart discreto)
- `app/components/votos-chart.test.tsx` — RTL (mock recharts) + source-scan no-leak
- `app/components/votos-por-parlamentario.tsx` — `agruparVotosPorTrimestre`/`VotoPeriodo`, `periodos` en `VotosViewData`, wiring en `derivarVotosViewData`, sub-bloque "Cuándo votó" en `VotosView`
- `app/components/votos-por-parlamentario.test.tsx` — tests del agregador + sub-bloque; mock recharts añadido

## Decisions Made
- Seguí el placement LOCKED del UI-SPEC (chart en capa-2, capa-1 byte-idéntica).
- `periodos` global (arco completo) independiente de la faceta — el chart representa el registro entero, no el tema activo (test lo fija).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-scan tripaba sobre el token literal en el docstring**
- **Found during:** Task 2 (isla `votos-chart.tsx`)
- **Issue:** El test de no-leak asierta que el archivo NO contiene `--accent-product` (petróleo prohibido en fills); mi docstring mencionaba el token literal al explicar la prohibición, disparando el match.
- **Fix:** Reformulé el comentario a "El acento petróleo de producto está PROHIBIDO aquí" sin el token literal.
- **Files modified:** app/components/votos-chart.tsx
- **Verification:** `votos-chart.test.tsx` 7/7 verde.
- **Committed in:** `3027196` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Ajuste cosmético de comentario para no confundir la compuerta de no-leak. Cero scope creep.

## Issues Encountered
None — plan ejecutado según lo escrito.

## User Setup Required
None — sin configuración de servicios externos. El deploy de cierre de fase (que también acarrea los fixes F38 pendientes) queda para el checkpoint de fin de fase, fuera de este plan.

## Next Phase Readiness
- VIZ-02 completo: chart de evolución montado sobre datos ya fetcheados, sin RPC/DDL/deps.
- Suite completa verde (712, baseline 690 + 22 nuevos) + tsc limpio.
- Anti-insinuación LOCKED preservado: stacked-NO-line, colores semánticos (no petróleo), degrade honesto, negative-match verde.
- Listo para el checkpoint human-verify de fin de fase (evidencia visual + smoke + deploy).

---
*Phase: 47-vchart-chart-de-votos-ausencias-del-parlamentario*
*Completed: 2026-07-08*

## Self-Check: PASSED
- All 5 created/modified files verified present.
- All 6 task commits verified in git history.
