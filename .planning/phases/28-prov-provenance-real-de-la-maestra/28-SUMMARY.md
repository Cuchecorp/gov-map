---
phase: 28-prov-provenance-real-de-la-maestra
plan: 01
subsystem: frontend
tags: [provenance, maestra, sourceLabel, ficha, header, fuente-desconocida, prov-01]

# Dependency graph
requires:
  - phase: 23
    provides: "RPC parlamentario_publico (devuelve origen/fecha_captura/enlace) aplicado al remoto"
provides:
  - "header de la ficha del parlamentario muestra la fuente real (Cámara/Senado) en vez de 'fuente desconocida'"
  - "fix de mislabel de lobby (camara-transparencia-lobby ya NO cae en InfoProbidad)"
affects: [Phase 32 (verificación prod del header)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "El origen CANÓNICO de la maestra es 'diputados'/'senado' (parse-camara/seeder) — NO 'camara'. El fix de provenance es de RENDERIZADO (sourceLabel), no de data (la data ya estaba completa y no se debe alterar el origen canónico)"
    - "Orden de los chequeos de sourceLabel importa: 'lobby' debe ir ANTES de 'transparencia' (el origen de lobby 'camara-transparencia-lobby' contiene 'transparencia')"

key-files:
  created:
    - app/lib/source-label.test.ts
    - .planning/phases/28-prov-provenance-real-de-la-maestra/28-CONTEXT.md
    - .planning/phases/28-prov-provenance-real-de-la-maestra/28-SUMMARY.md
  modified:
    - app/lib/types.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "La provenance de la maestra YA estaba completa en el remoto (origen/fecha_captura/enlace 186/186, 0 null). La premisa 'origen nulo' de la memoria estaba stale. El gap real era de renderizado"
  - "NO cambiar el origen de la data a 'camara': 'diputados' es canónico (parse-camara.ts ORIGEN, seeder ORIGENES_VIGENTES) → un re-seed lo revertiría y rompería validaciones. Fix correcto = sourceLabel"
  - "sourceLabel: (1) mapear 'diputad'→'Cámara'; (2) mover 'lobby' antes de 'transparencia' (bug latente expuesto por el origen de lobby de Phase 25)"

# Metrics
metrics:
  duration: ~15min
  completed: 2026-06-22
---

# Phase 28 Plan 01: PROV — Provenance real de la maestra Summary

El header de la ficha del parlamentario dejará de decir "fuente desconocida": la provenance de
la maestra ya estaba completa en el remoto; el gap era de RENDERIZADO en `sourceLabel`.

## What was diagnosed / fixed

- **Diagnóstico:** `parlamentario` remoto tiene origen/fecha_captura/enlace completos (186/186,
  0 null), con `origen` canónico "diputados"/"senado" y enlaces oficiales (opendata.camara.cl /
  tramitacion.senado.cl). El RPC `parlamentario_publico` ya los proyecta. La memoria "origen nulo"
  estaba stale.
- **Causa raíz de "fuente desconocida":** `sourceLabel("diputados")` no matcheaba ninguna rama
  (esperaba "camara") → fallback "fuente desconocida". Los senadores ("senado") sí resolvían.
- **Bug latente adicional:** el origen de lobby de Phase 25 ("camara-transparencia-lobby") contiene
  "transparencia" → `sourceLabel` lo mapeaba a "InfoProbidad" (la rama probidad iba primero).
- **Fix (`app/lib/types.ts sourceLabel`):** (1) `diputad` → "Cámara"; (2) chequeo "lobby" movido
  ANTES de "transparencia". + `app/lib/source-label.test.ts` (6 tests).

## Verification

- `pnpm --filter app exec vitest run lib/source-label.test.ts` → 6 passed.
- Comprobado: diputados→"Cámara", senado→"Senado", camara-transparencia-lobby→"Ley del Lobby",
  infoprobidad-sparql→"InfoProbidad", desconocido/null→"fuente desconocida".

## Deviations from Plan

- **NO fue una corrida de data** (el goal asumía origen nulo): la provenance ya estaba poblada y
  canónica. El fix correcto fue de renderizado (sourceLabel), preservando el origen canónico.

## Hand-off

- Phase 32: verificar visualmente en prod (tras redeploy) que el header de un diputado muestra
  "Cámara" + fecha + enlace, y que el badge de lobby dice "Ley del Lobby".

## Self-Check: PASSED
