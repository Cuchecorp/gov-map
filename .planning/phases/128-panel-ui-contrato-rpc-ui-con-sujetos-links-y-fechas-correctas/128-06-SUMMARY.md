---
phase: 128-panel-ui
plan: 06
subsystem: panel-actualidad (portada)
tags: [rsc, panel, wiring, tests]
dependency-graph:
  requires: ["128-01", "128-02", "128-03", "128-04", "128-05"]
  provides: ["panel-actualidad-orquestador"]
  affects: ["app/app/page.tsx (render, no tocado)"]
tech-stack:
  added: []
  patterns:
    - "whitelist explícita de tipo_senal (O-3/P8) en vez de ORDEN_TIPO.filter permisivo"
    - "cruce L5 en render vía urgenciaVigentePorBoletin, pasado como prop Map a 2 tiles"
    - "vistas puras compuestas en el test (cero DB, cero mocks de red) — mismo patrón que PanelActualidad"
key-files:
  created: []
  modified:
    - app/components/panel-actualidad.tsx
    - app/components/panel-actualidad.test.tsx
    - .gitignore
decisions:
  - "Task 1 y Task 2 son interdependientes: tsc -b solo pasa completo tras Task 2 (el test viejo importaba TileSenal, que muere en Task 1) — se documentó y ejecutó en la secuencia prevista por el plan, no como desviación"
  - "El test de cierre (Task 3) escribe app/.artifacts/panel-render.html usando container.innerHTML (jsdom), no un render server real — es evidencia de correctitud por composición de vistas puras, no un snapshot del deploy (D-10 lo reserva para 129)"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 128 Plan 06: Panel-actualidad orquestador de 6 tiles Summary

Reescritura de `panel-actualidad.tsx` como orquestador RSC de los 6 tiles editoriales (D-01, O-5 sala primero), con filtro explícito de `agrupacion_materia` (O-3/P8), cruce L5 de urgencias calculado en render y suite de tests reescrita con evidencia de cierre (5 greps DOM en verde).

## What Was Built

- **`app/components/panel-actualidad.tsx`** reescrito íntegramente: mata `TITULO`, `FRAMING`, `fuenteLabel`, `TileSenal`, `SPAN_TIPO`, `ORDEN_TIPO` (con ellos, la única ocurrencia funcional de `"datos al"` en `app/`). Conserva `SenalRow`, `TIPOS_AGENDA`, `fechaValida`, `rotuloFecha` (docblock F-14/WR-05 íntegro, exportado, 5 tests vivos). Nuevo: `TIPOS_RENDERIZADOS` (whitelist explícita de 6 tipos), cruce L5 vía `urgenciaVigentePorBoletin(parseEvidenciaProyectos(...).items)` pasado como `Map` a `PanelTileSala` y `PanelTileComisiones`. Orden de montaje D-01: sala → comisiones → urgencias → movimiento → votaciones → ingresos.
- **`app/components/panel-actualidad.test.tsx`** reescrito: fixture `makeSenal()` con grafía viva (`"Cámara de Diputados"`) y `evidencia` realista (no `{}`); describe "composición del panel completo" que replica el ruteo whitelist + cruce L5 sobre fixtures fijos y compone las vistas puras (`PanelTileSala`, `PanelTileComisiones`, `PanelTileUrgencias`, `PanelTileMovimiento`, `PanelTileVotacionesView` con stub, `PanelTileIngresos`) — cero DB, cero mocks de red. Los 5 tests F-14 de `rotuloFecha` se conservan íntegros.
- **Test de cierre (D-10):** escribe `app/.artifacts/panel-render.html` (vía `mkdirSync`+`writeFileSync`) y asserta en-proceso los 5 controles del research; el bloque `<verify>` los repite sobre el archivo con `grep -o | wc -l`.
- **`.gitignore`:** alta de `app/.artifacts/` (artefacto de test).

## Evidencia de cierre (5 greps sobre `app/.artifacts/panel-render.html`)

```
datos_al=0 segun=6 materia=0 captura=0 links=6
```

Los 5 controles piden: `datos al`=0 ✓, `según fuente al`>=1 ✓ (6), `(sin materia)`=0 ✓, `fecha_captura`=0 ✓, `href="/proyecto/`>=1 ✓ (6).

## Verificación

- `tsc -b --pretty false`: sin errores.
- `pnpm guards`: 11 archivos / 345 tests, todos verdes (anti-insinuación, lockdown, bento, antiflip×3, env-example, name-match-rut, bento-coherencia, co-votacion-red, create-view).
- `pnpm test`: **118 archivos / 1774 tests** — ESTRICTAMENTE MAYOR al baseline pre-06 (1773/118), gate W-4 cumplido.
- `panel-actualidad.test.tsx`: 17 tests propios, todos verdes.
- Cero `"use client"` en el árbol del panel (RSC puro, D-08). Cero RPC nueva, cero flags tocados.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - orden de tareas] Task 1 no compilaba en aislamiento (tsc -b incluye tests)**
- **Encontrado durante:** Task 1
- **Issue:** `panel-actualidad.test.tsx` (aún sin reescribir) importaba `TileSenal`, que Task 1 elimina — `tsc -b` fallaba hasta completar Task 2. Es una dependencia estructural entre las dos tareas del mismo plan, no un bug.
- **Fix:** se ejecutó Task 1 y Task 2 en la secuencia prevista, verificando `tsc -b` completo recién tras Task 2 (como indica el flujo de ejecución: cada tarea se verifica y commitea antes de avanzar, pero la compilación TOTAL del árbol solo es estable una vez ambas tareas están aplicadas).
- **Commits:** `c0eb197` (Task 1), `8627bcd` (Task 2).

**2. [Rule 1 - gate de suite] El conteo neto de tests bajó de 16→14 al reescribir la suite (menos describes que el original)**
- **Encontrado durante:** verificación final (`pnpm test` dio 1771 < baseline 1773)
- **Issue:** la suite reescrita tenía menos tests netos que la original (algunos describes MUEREN sin reemplazo 1:1, p.ej. WR-02 se fusionó dentro del test de orden del DOM).
- **Fix:** se agregaron 3 tests adicionales de valor real (duplicados de tile, ausencia de chip L5 sin match, `agrupacion_materia` sola sin crashear) → 1774 tests, estrictamente mayor al baseline 1773.
- **Commit:** `6660870`.

## Known Stubs

Ninguno — `PanelTileVotaciones` (wrapper async, lectura real de `public.votacion`) no se ejerce en este archivo de test (su cobertura vive en `128-05`); el test de composición usa `PanelTileVotacionesView` con un stub de un ítem, exactamente como prevé el plan ("el wrapper async de votaciones no se ejerce aquí").

## Self-Check: PASSED

- `app/components/panel-actualidad.tsx` — FOUND
- `app/components/panel-actualidad.test.tsx` — FOUND
- `app/.artifacts/panel-render.html` — FOUND (gitignored, no versionado)
- Commit `c0eb197` — FOUND
- Commit `8627bcd` — FOUND
- Commit `f1e5de0` — FOUND
- Commit `6660870` — FOUND
