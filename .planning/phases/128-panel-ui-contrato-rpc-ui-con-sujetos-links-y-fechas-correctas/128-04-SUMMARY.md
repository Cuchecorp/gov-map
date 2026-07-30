---
phase: 128-panel-ui
plan: 04
subsystem: panel-ui
tags: [panel, tramitacion, urgencias, movimiento, ingresos, anti-insinuacion]
dependency-graph:
  requires: ["128-01 (contrato jsonb/idioms)", "128-02 (panel-evidencia, links-internos, panel-item-proyecto)"]
  provides: ["panel-tile-urgencias.tsx", "panel-tile-movimiento.tsx", "panel-tile-ingresos.tsx"]
  affects: ["128-06 (wrapper async del panel)"]
tech-stack:
  added: []
  patterns:
    - "Vistas puras testeables (props FilaPanel[]) — el wrapper async vive en 128-06"
    - "Conteo por Set<boletin> (nunca por eventos) para el defecto D-01/O-3"
    - "Remanente sin link (O-6/W-6): texto plano, cero <a> agregado de tile"
key-files:
  created:
    - app/components/panel-tile-urgencias.tsx
    - app/components/panel-tile-urgencias.test.tsx
    - app/components/panel-tile-movimiento.tsx
    - app/components/panel-tile-movimiento.test.tsx
    - app/components/panel-tile-ingresos.tsx
    - app/components/panel-tile-ingresos.test.tsx
  modified: []
decisions:
  - "Grados desconocidos de gradoUrgencia (fallback honesto) se agregan al final del encabezado de urgencias, en orden de primera aparición — nunca se descartan ni rompen el orden institucional fijo"
  - "El remanente ('N más') en los tres tiles se declara como <p> de texto plano sin <a>, satisfaciendo O-6 sin fabricar un destino inexistente"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 128 Plan 04: Tiles 3/4/6 (urgencias, movimiento, ingresos) Summary

Tres tiles de tramitación con conteo por sujeto real (boletines/proyectos, nunca eventos) reemplazando los contadores sin sujeto del panel legado.

## What Was Built

- **`panel-tile-urgencias.tsx`** (Tile 3): agrupa urgencias por grado usando `Set<boletin>` — el "95" (conteo de eventos) muere y el encabezado factual es "5 proyectos con Discusión inmediata · 42 con Suma · 24 con Simple". Orden de grados FIJO (institucional, no ranking). Un boletín con múltiples urgencias cuenta una vez, mostrando la más reciente. Remanente sobre `maxItems` es texto sin link (O-6/W-6).
- **`panel-tile-movimiento.tsx`** (Tile 4): lista trámites de `velocity` con detalle `Trámite del {fecha} · {cámara}` — SIN fabricar descripción de trámite (P2: `velocity` no trae `descripcion`). La cámara viene de `cobertura_camara` de la fila; si es null, se omite el segmento y la barra cívica. Filas de dos cámaras preservan el orden de llegada (T-52-13).
- **`panel-tile-ingresos.tsx`** (Tile 6): fusiona `nuevos_ingresos` y `archivados` en un solo tile con dos subsecciones (`<h3>` distinguibles). Regla C conservada íntegra (causa de supresión verbatim como cuerpo, copy exacto de `panel-actualidad.tsx:182-201`). Conteo D-07: agrupa `archivados` por boletín y emite `{N} eventos de {M} proyecto(s)` con concordancia singular/plural correcta — literal "movimientos" prohibido. `cobertura_camara` de ingresos (etiqueta de ventana) nunca alimenta chip/barra de cámara.

Los tres son vistas puras (Server Components síncronos, sin fetch propio) que reciben `FilaPanel[]` ya resuelto; el wrapper async que llama a la RPC vive en 128-06.

## Verification

```
pnpm vitest run components/panel-tile-urgencias.test.tsx components/panel-tile-movimiento.test.tsx components/panel-tile-ingresos.test.tsx
→ 3 test files, 23 tests passed

pnpm guards
→ 11 guard suites, 342 tests passed (anti-insinuacion-guard incluido, sin drift de SUPERFICIES_PANEL — las 3 rutas ya estaban registradas preventivamente)

pnpm lint
→ 0 errores/warnings en los 6 archivos nuevos (los 6 errores/23 warnings preexistentes en el árbol son de archivos fuera de alcance de este plan)
```

## Deviations from Plan

None — plan ejecutado tal como escrito. Las interfaces de 128-01/128-02 (`parseEvidenciaProyectos`, `gradoUrgencia`, `etiquetaFuente`, `hrefProyecto`, `PanelItemProyecto`, `fechaCivilCorta`, `claseCamara`) se importaron sin re-implementar.

## Threat Model Compliance

| Threat ID | Mitigation | Verified |
|-----------|-----------|----------|
| T-128-11 | `Set<boletin>` como unidad de conteo de urgencias; test con fixture de 95 eventos / 71 boletines distintos, "95" ausente, "42" presente | ✓ |
| T-128-12 | Prohibición explícita de fabricar descripción de trámite en `velocity`; test de composición del ítem (solo boletín/título/fecha/cámara) | ✓ |
| T-128-13 | Molde `{N} eventos de {M} proyecto(s)` con concordancia probada (singular 2/1, plural 3/2) | ✓ |
| T-128-14 | Regla C conservada verbatim; test de causa como cuerpo + sufijo de fecha | ✓ |
| T-128-SC | Cero dependencias nuevas | ✓ |

## Known Stubs

Ninguno. Los tres tiles son vistas puras completas; no hay datos mockeados que persistan más allá de este plan — el wrapper async de 128-06 les proveerá `FilaPanel[]` real desde la RPC.

## Self-Check: PASSED

- `app/components/panel-tile-urgencias.tsx` — FOUND
- `app/components/panel-tile-urgencias.test.tsx` — FOUND
- `app/components/panel-tile-movimiento.tsx` — FOUND
- `app/components/panel-tile-movimiento.test.tsx` — FOUND
- `app/components/panel-tile-ingresos.tsx` — FOUND
- `app/components/panel-tile-ingresos.test.tsx` — FOUND
- Commit `0d86184` (Task 1) — FOUND in `git log`
- Commit `df5a5f1` (Task 2) — FOUND in `git log`
- Commit `8985e6b` (Task 3) — FOUND in `git log`
