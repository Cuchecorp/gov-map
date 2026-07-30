---
phase: 128-panel-ui
plan: 05
subsystem: panel-ui
tags: [votaciones, L4, panel, anti-insinuacion, no-pii]
dependency-graph:
  requires: ["128-01"]
  provides: ["PanelTileVotaciones", "PanelTileVotacionesView", "grafiaCamaraCiudadana"]
  affects: ["app/components/actualidad-module.tsx"]
tech-stack:
  added: []
  patterns: ["async wrapper + vista pura (patron actualidad-module.tsx)", "lectura directa .from('votacion') NO-PII sin RPC"]
key-files:
  created:
    - app/components/panel-tile-votaciones.tsx
    - app/components/panel-tile-votaciones.test.tsx
  modified:
    - app/components/actualidad-module.tsx
decisions:
  - "leerTitulos exportada (una palabra) sin tocar firma/cuerpo/manejo de errores para reuso NO-PII en el tile L4"
  - "A1 ratificada: el tile NO se envuelve en vsimPublicEnabled() — ese flag gatea similitud de votacion, no el hecho de votacion, ya publico en /proyecto#votaciones (O-2). Ningun flag tocado."
  - "grafiaCamaraCiudadana normaliza diputados/senado en el RENDER (wrapper), con fallback verbatim honesto ante literal desconocido"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 128 Plan 05: Tile 5 — Votaciones recientes (L4) Summary

Tile de lectura directa `public.votacion` (bounded, `order fecha desc, id desc`) con una línea
por votación, resultado NULL literal "resultado no informado por la fuente" y grafía de cámara
normalizada en el render — sin RPC, sin allowlist, sin flags tocados.

## What Was Built

- **Task 1** — `leerTitulos` (`actualidad-module.tsx:517`) exportada (cambio de una palabra +
  JSDoc) para reuso NO-PII por el tile L4, sin tocar firma/cuerpo/call-sites existentes.
- **Task 2 (TDD)** — `PanelTileVotacionesView` (vista pura): título "Votaciones recientes",
  una `<li>` por votación (jamás agregada por boletín — probado con las 2 filas reales de
  `18384-08`), detalle `Votación en {cámara} el {fecha}: {resultado|literal fijo} — {si} a
  favor, {no} en contra, {abstención} abstenciones`, href `hrefProyecto(b,'votaciones')`,
  título ausente → boletín solo, empty-state honesto con causa, footer `Fuente: Votaciones ·
  según fuente al {d}`, leyenda `LEYENDA_ANTI_INSINUACION` importada verbatim (no re-tipeada).
- **Task 3** — `PanelTileVotaciones` (wrapper async): `.from("votacion")` con
  `.order("fecha",{ascending:false}).order("id",{ascending:false}).limit(maxItems)` (desempate
  obligatorio, gotcha B-01), `error` real → `throw` (#34, nunca `?? []`), filas con `fecha` null
  descartadas, `grafiaCamaraCiudadana(raw)` normaliza `"diputados"/"senado"` → `"Cámara de
  Diputados"/"Senado"` con fallback verbatim ante literal desconocido, `leerTitulos` reusada,
  `fechaFuente` = máxima `fecha` de las filas leídas (jamás `fecha_captura`). Cero
  `vsimPublicEnabled()` (decisión A1 documentada en el docblock).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree branch estaba detrás de la base declarada en el prompt**

- **Found during:** Task 2, verificación — `@/lib/links-internos`, `@/lib/idioms-panel` y
  `@/lib/panel-evidencia` no resolvían pese a existir en el checkout compartido.
- **Issue:** el branch del worktree (`worktree-agent-a0ccb895bb8aa839f`) tenía como HEAD un
  ancestro (`f0f2491`) de la base declarada en el prompt (`86617b1`, que ya incluye 128-01/128-02
  mergeados). El chequeo inicial de branch/HEAD no detectó el desfase porque solo comparó nombre
  de branch, no el commit base exacto.
- **Fix:** `git rebase 86617b1cd18e14d0140ddc07355e28cd81bed49e` sobre las 2 tasks ya committeadas
  (limpio, sin conflictos) — trae `lib/links-internos.ts`, `lib/idioms-panel.ts`,
  `lib/panel-evidencia.ts`, `components/panel-item-proyecto.tsx` de 128-01/128-02. Se reinstaló
  `pnpm install --prefer-offline` tras el rebase.
- **Files modified:** ninguno de contenido — solo historia de git (rebase).
- **Commit:** el rebase reescribió `fea7cd8`→`8cd1b7e` y `985d7d4`→`93594c9` (mismos diffs).

**2. [Rule 1 — Bug] Aserción propia del test "cero vocabulario prohibido" mordía su propio
control positivo**

- **Found during:** Task 2, primera corrida GREEN.
- **Issue:** el test verificaba ausencia de "disciplina" sobre el texto completo del DOM, pero
  la leyenda `LEYENDA_ANTI_INSINUACION` (que NIEGA "disciplina") también la contiene — el test
  fallaba sobre su propio control positivo, no sobre un bug del componente.
- **Fix:** se resta la leyenda LOCKED del texto ANTES de matchear (mismo patrón que
  `anti-insinuacion-guard.test.ts` con `NEGACIONES_LOCKED`), y la aserción de presencia de la
  leyenda se hace sobre el DOM sin restar.
- **Files modified:** `app/components/panel-tile-votaciones.test.tsx`.
- **Commit:** `0b07ff9` (incluida en el commit GREEN).

No otras desviaciones — el resto del plan se ejecutó tal como escrito.

## Verification

```
cd app && pnpm vitest run components/panel-tile-votaciones.test.tsx   → 13/13 passed
cd app && pnpm vitest run lib/anti-insinuacion-guard.test.ts           → 55/55 passed
cd app && pnpm vitest run components/actualidad-module.test.tsx        → 28/28 passed
cd app && pnpm vitest run lib/lockdown-guard.test.ts                   → 35/35 passed
cd app && pnpm vitest run lib/vsim-antiflip-guard.test.ts              → 20/20 passed
cd app && pnpm guards (suite completa)                                 → 340/340 passed
cd app && pnpm exec tsc --noEmit                                       → sin errores en panel-tile-votaciones.tsx
```

Cero flags tocados (`vsim-antiflip-guard` verde, ninguna referencia cruda a
`VSIM_PUBLIC_ENABLED` fuera del chokepoint). `panel-tile-votaciones.tsx` ya estaba declarado en
`SUPERFICIES_PANEL` (128-01) — sin cambios al guard necesarios.

## TDD Gate Compliance

Task 2 siguió RED→GREEN: commit `test(128-05): failing tests ... (RED)` seguido de
`feat(128-05): PanelTileVotacionesView ... (GREEN)`. El wrapper de Task 3 se escribió en el
mismo archivo que la vista de Task 2 y quedó incluido en el mismo commit GREEN (ambas tasks
comparten `files: [panel-tile-votaciones.tsx, panel-tile-votaciones.test.tsx]`); su
verificación (lockdown + antiflip + tests de `grafiaCamaraCiudadana`) se corrió y pasó
explícitamente antes de cerrar el plan.

## Known Stubs

Ninguno — el tile lee datos reales de `public.votacion`, sin mocks ni datos hardcodeados.

## Self-Check: PASSED

- `app/components/panel-tile-votaciones.tsx`: FOUND
- `app/components/panel-tile-votaciones.test.tsx`: FOUND
- `leerTitulos` exportada en `app/components/actualidad-module.tsx`: FOUND (`export async function leerTitulos`)
- Commit `8cd1b7e` (Task 1, post-rebase): FOUND en `git log`
- Commit `93594c9` (Task 2 RED, post-rebase): FOUND en `git log`
- Commit `0b07ff9` (Task 2+3 GREEN): FOUND en `git log`
