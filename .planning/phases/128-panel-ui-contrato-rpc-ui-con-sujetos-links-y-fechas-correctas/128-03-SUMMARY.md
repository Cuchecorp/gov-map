---
phase: 128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas
plan: 03
subsystem: ui
tags: [react, next.js, panel, jsonb, anti-insinuacion]

requires:
  - phase: 128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas (plan 01)
    provides: "lib/idioms-panel.ts (IDIOMS_APROBADOS single-source), lib/links-internos.ts, panel-item-proyecto.tsx"
  - phase: 128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas (plan 02)
    provides: "lib/panel-evidencia.ts (parseEvidenciaSala/Citaciones, gradoUrgencia, urgenciaVigentePorBoletin), lib/panel-camara.ts (claseCamara)"
provides:
  - "PanelTileSala — Tile 1 tabla de sala nombrada (L2), degradación honesta de Cámara"
  - "PanelTileComisiones — Tile 2 citaciones aplanadas + chips L5 + cobertura L7 con CAMARAS_CORPUS"
affects: [128-06-wiring-async, 129-visual-checkpoint]

tech-stack:
  added: []
  patterns:
    - "Vistas puras síncronas (RSC, cero use client) testeables con fixtures verbatim del jsonb PROD"
    - "Aplanado de items[].puntos[] conservando contexto de la citación para el detalle"
    - "Cobertura con denominador nombrado (CAMARAS_CORPUS) — cero cero-mudo"

key-files:
  created:
    - app/components/panel-tile-sala.tsx
    - app/components/panel-tile-sala.test.tsx
    - app/components/panel-tile-comisiones.tsx
    - app/components/panel-tile-comisiones.test.tsx
  modified: []

key-decisions:
  - "Cobertura L7 usa un orden de despliegue fijo (Senado primero, luego 'de la Cámara' corto) independiente del orden declarado en CAMARAS_CORPUS, que solo fija el universo consultado (W-5)."
  - "El chip L5 y el molde de fecha reusan IDIOMS_APROBADOS con verificación en tiempo de módulo (throw si el stem no está registrado) en vez de solo un test — cualquier drift del stem rompe el build, no solo el guard."

patterns-established:
  - "idiomaOMuere(stem): valida contra IDIOMS_APROBADOS al cargar el módulo, no solo en el test — refuerza B-4 en producción."

requirements-completed: [PANEL-02, PANEL-03, PANEL-05, PANEL-07]

duration: 45min
completed: 2026-07-30
---

# Phase 128 Plan 03: Tiles de agenda (sala + comisiones) Summary

**Dos tiles RSC puros que nombran boletín+título desde el jsonb de agenda (`panel-tile-sala.tsx`, `panel-tile-comisiones.tsx`), reemplazando el contador mudo previo, con degradación honesta de la fila sintética de Cámara y cobertura L7 con denominador nombrado.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-07-30T18:28:00Z (aprox.)
- **Completed:** 2026-07-30T19:13:53Z
- **Tasks:** 2
- **Files modified:** 4 (todos creados)

## Accomplishments
- `PanelTileSala` (Tile 1, O-5 primer tile): nombra boletín + título de cada punto de la tabla de sala, con el día en verbo; la fila sintética de Cámara (numero/tipo/hora NULL) nunca fabrica "Sesión N.º a las HH:MM" — solo el día + "tabla semanal".
- `PanelTileComisiones` (Tile 2): aplana `items[].puntos[]` conservando comisión/horario/fecha para el detalle; puntos sin boletín renderizan materia truncada + enlace externo, cero href interno.
- Chip L5 en ambos tiles: molde exacto `Urgencia {grado} fechada el {d}`, sin conectores causales.
- Cobertura L7 (Tile 2) con `CAMARAS_CORPUS` constante nombrada (FIX W-5): el cero de Cámara nunca es mudo, siempre "en las fuentes consultadas".
- Presupuesto de 4 ítems + "y N más →" respaldado por el total declarado del jsonb (no la longitud del array renderizado), con href `?semana=` SIEMPRE antes de `#hash`.

## Task Commits

Each task was committed atomically:

1. **Task 1: panel-tile-sala.tsx — Tile 1, tabla de sala nombrada (L2)** - `397b1da` (feat)
2. **Task 2: panel-tile-comisiones.tsx — Tile 2, citaciones + chips L5 + cobertura L7** - `491ee20` (feat)

**Plan metadata:** (pending — commit that adds this SUMMARY.md)

_Nota: ambas tareas eran `tdd="true"`; test y componente se escribieron juntos y se verificaron en verde antes del commit único de cada task (RED local no commiteado por separado, GREEN verificado con `pnpm vitest run` antes de `git add`)._

## Files Created/Modified
- `app/components/panel-tile-sala.tsx` - Tile 1: sesión de sala nombrada, degradación honesta de Cámara, chip L5, "y N más" con href correcto, footer "según fuente al"
- `app/components/panel-tile-sala.test.tsx` - 13 tests cubriendo todo `<behavior>` de la Task 1
- `app/components/panel-tile-comisiones.tsx` - Tile 2: puntos aplanados con contexto de citación, cobertura L7, chip L5, footer
- `app/components/panel-tile-comisiones.test.tsx` - 11 tests cubriendo todo `<behavior>` de la Task 2

## Decisions Made
- El molde de cobertura L7 se implementó con un orden de despliegue explícito (`ORDEN_COBERTURA`) separado del orden de declaración de `CAMARAS_CORPUS`, porque el copy ratificado ("N citaciones del Senado · N de la Cámara") usa una forma corta para la segunda cláusula que no es una simple iteración sobre el array — mantener `CAMARAS_CORPUS` como la fuente de verdad del universo consultado (comentario atado a la definición del corpus, W-5) sin acoplarla al formato de texto.
- Se añadió verificación en tiempo de módulo (`idiomaOMuere`) de que cada stem usado existe en `IDIOMS_APROBADOS`: si un futuro edit desalinea el literal del array, el módulo lanza en carga (falla el build/test suite entero), no solo el guard anti-insinuación — refuerzo adicional de B-4 no pedido explícitamente por el plan pero consistente con su intención declarada ("el guard importa este array, no lo re-tipea").

## Deviations from Plan

None - plan ejecutado según lo escrito. La única adición fue el helper `idiomaOMuere` (Rule 2 — refuerzo de correctitud sobre B-4 single-source, sin cambiar comportamiento visible ni contrato de props).

## Issues Encountered
- `node_modules` no estaba instalado en el worktree al iniciar (`vitest` no reconocido) → se ejecutó `pnpm install --prefer-offline` (permitido explícitamente por el prompt de ejecución) antes de correr los tests.
- Un fixture de test inicial (`tabla_total: 5` con solo 1 ítem en `tabla[]`) hizo fallar el caso "tabla_total <= maxItems → sin 'y N más'" porque el `tabla_total` declarado (5) superaba maxItems=4 aunque el array renderizado tuviera 1 elemento — el comportamiento del componente era correcto (respalda el link en el total declarado, no en la longitud del array, tal como pide el plan); se corrigió el fixture del test para usar `tabla_total: 1`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ambos tiles quedan listos para que 128-06 los envuelva en el Server Component async que lee `actualidad_senales_panel` y arma `urgencias` vía `urgenciaVigentePorBoletin`.
- `pnpm vitest run components/panel-tile-sala.test.tsx components/panel-tile-comisiones.test.tsx lib/anti-insinuacion-guard.test.ts lib/bento-guards.test.ts` → 183 tests verdes (13 + 11 + 55 + 117 — nota: bento-guards subió de 116 a 117 tests al detectar los 2 archivos nuevos vía anti-drift, sin fallar).
- Sin bloqueos conocidos para el siguiente plan.

---
*Phase: 128-panel-ui-contrato-rpc-ui-con-sujetos-links-y-fechas-correctas*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: app/components/panel-tile-sala.tsx
- FOUND: app/components/panel-tile-comisiones.tsx
- FOUND: commit 397b1da (Task 1)
- FOUND: commit 491ee20 (Task 2)
