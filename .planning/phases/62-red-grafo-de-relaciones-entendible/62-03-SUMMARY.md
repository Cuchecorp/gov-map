---
phase: 62-red-grafo-de-relaciones-entendible
plan: 03
subsystem: ui
tags: [browseros, cold-read, deploy, cloudflare-workers, react-flow, red-graph, css]

# Dependency graph
requires:
  - phase: 62-01
    provides: ego-network radial (seed + ≤24 vecinos alfabéticos + "N vecinos más") y leyenda "orden alfabético, no cercanía"
  - phase: 62-02
    provides: fallback móvil vecinos-list con enlaces + borde institucional por cámara
  - phase: 61-02
    provides: runbook de deploy (Docker node:22-slim + wrangler 4 global OAuth) y loop BrowserOS
provides:
  - Veredicto de lectura fría BrowserOS "COMPRENSIBLE" en las 4 combinaciones (seed+no-seed × desktop+390px) sobre /red live
  - Deploy live del fix 62-01+62-02 (Version 61d8fe13) con leyenda nueva servida
  - Evidencia before/after archivada en red-evidence/ + VEREDICTO.md
  - Fix P1 (lista móvil filtrada al desktop por cascada CSS) corregido y re-desplegado
  - Aprobación humana explícita del grafo comprensible en producción ("aprobado" 2026-07-09)
affects: [milestone v6.1 audit, futuras fases de visualización, deuda P2 densidad anillo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cold-read BrowserOS como gate de cierre: la comprensibilidad la dictamina la lectura fría sobre el deploy live, no la opinión del implementador."
    - "getComputedStyle sobre el deploy live caza bugs de cascada/media-query que jsdom no evalúa (los 747 tests pasaban con el bug presente)."

key-files:
  created:
    - .planning/phases/62-red-grafo-de-relaciones-entendible/red-evidence/VEREDICTO.md
    - .planning/phases/62-red-grafo-de-relaciones-entendible/red-evidence/ (13 capturas antes/después)
  modified:
    - app/app/globals.css

key-decisions:
  - "Fix P1 vía @media (min-width:768px){.net-vecinos{display:none}} — resuelve empate de especificidad con .md:hidden de Tailwind, la lista es solo <768px como contrata el UI-SPEC."
  - "P2 (densidad del anillo a 772px, ancho de la ventana BrowserOS) diferido como deuda no bloqueante — artefacto del ancho de captura, no defecto de comprensión; ajuste acotado (RING1_R/RING2_R o cap) si el operador lo reporta a ancho real."
  - "Captura 390px vía CSS inyectado (body{width:390px} + rama <md) porque BrowserOS no expone viewport/resize; comportamiento móvil verificado además programáticamente (24 filas, 61 enlaces de fuente, Links alfabéticos)."

patterns-established:
  - "Gate humano de comprensión: checkpoint blocking tras cold-read + deploy, cerrado solo con señal 'aprobado' del operador."

requirements-completed: [RED-03]

# Metrics
duration: ~90min
completed: 2026-07-09
---

# Phase 62 Plan 03: BrowserOS cold-read + deploy de /red comprensible Summary

**El grafo /red pasó de franja apiñada de ~93 nodos a ego-network radial (seed + ≤24 vecinos alfabéticos + "Ver N vecinos más" honesto) desplegado live, validado por lectura fría BrowserOS con veredicto "COMPRENSIBLE" en las 4 combinaciones y aprobado por el operador.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-07-09T15:29Z (aprox.)
- **Completed:** 2026-07-09
- **Tasks:** 3 (2 auto + 1 checkpoint human-verify)
- **Files modified:** 1 código (globals.css) + 14 artefactos de evidencia (VEREDICTO.md + 13 capturas)

## Accomplishments

- **Loop BrowserOS completo sobre /red:** captura "antes" (seed+no-seed × desktop+390px) → deploy fix 62-01+62-02 → re-captura "después" → lectura fría → veredicto.
- **Deploy live con runbook 61-02 (LOCKED):** Docker `node:22-slim` + wrangler 4 global OAuth. Version inicial `6b661987`, re-deploy con fix P1 `61d8fe13-8d0c-4ed9-af1a-eb3aaf412f0c`. Cero flags flipeados (gate F17 NET_PUBLIC_ENABLED respetado, ya estaba ON).
- **Veredicto "COMPRENSIBLE"** en las 4 combinaciones, verificado contra los Acceptance Hooks de 62-UI-SPEC: RED-01 conteo (25 `.net-nodo` vs 93 antes, truncación honesta "Ver 68 vecinos más"), RED-02 legibilidad+leyenda+móvil, RED-03 gate, anti-insinuación (sin petróleo/partido/score, procedencia en el DOM).
- **P1 cazado y corregido:** la lista de vecinos móvil se filtraba al desktop por empate de especificidad CSS; solo la lectura fría con `getComputedStyle` sobre el deploy live lo reveló (jsdom no evalúa la cascada real → 747 tests verdes con el bug). Fix + re-deploy + re-captura autoritativa (`red-seed-desktop-despues-ring-v2.png`).
- **Checkpoint humano cerrado:** el operador respondió **"aprobado"** el 2026-07-09 sobre el /red live.

## Task Commits

1. **Task 1: Capturar "antes" 390px + suite/build verdes + deploy** - `3a2bbc1` (chore) — capturas antes + deploy fix RED live (Version 6b661987)
2. **Task 2: Re-capturar "después" + lectura fría + veredicto (fix P1)** - `31fba72` (fix, globals.css) + `15eab66` (chore, capturas después + VEREDICTO comprensible) — re-deploy Version 61d8fe13
3. **Task 3: Checkpoint humano** - RESUELTO: operador respondió "aprobado" 2026-07-09 (sin commit — gate de verificación)

**Plan metadata:** este commit (docs: complete plan)

## Files Created/Modified

- `app/app/globals.css` - `@media (min-width:768px){.net-vecinos{display:none}}` para que la lista de vecinos sea solo <768px (fix P1).
- `.planning/phases/62-red-grafo-de-relaciones-entendible/red-evidence/VEREDICTO.md` - veredicto de lectura fría con tabla antes/después, verificación de Acceptance Hooks y hallazgos P1/P2.
- `.planning/phases/62-red-grafo-de-relaciones-entendible/red-evidence/*.png` - 13 capturas: antes (`red-seed-desktop-antes`, `red-seed-movil-antes`, `red-noseed-desktop-antes`), después seed desktop (`-viewport`, `-ring`, `-ring-v2` autoritativa post-fix, `-canvas`, fullPage), después seed móvil (`-lista`, `-despues`), después no-seed (`-desktop`, `-movil`).

## Decisions Made

- **Fix P1 con media-query explícita** en vez de tocar el marcado: `.net-vecinos{display:flex}` empataba en especificidad (0,1,0) con `.md:hidden` de Tailwind y ganaba por orden de cascada. La media-query `min-width:768px → display:none` resuelve el empate sin reordenar utilidades.
- **P2 diferido como deuda no bloqueante:** la densidad del anillo a 772px es artefacto del ancho de la ventana oculta de BrowserOS (apenas sobre el breakpoint md), no defecto de comprensión — etiquetas legibles, conteo correcto, leyenda presente. Ajuste acotado disponible si el operador lo reporta a ancho real.
- **Seed elegido a propósito:** `D1009` (Jorge Alessandri Vergara, 92 vecinos directos), el caso que producía la franja apiñada — para probar el peor escenario.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lista de vecinos móvil filtrada al desktop**
- **Found during:** Task 2 (lectura fría del deploy live)
- **Issue:** en desktop (≥768px) `.net-vecinos` daba `getComputedStyle().display = "flex"` pese al `md:hidden` del marcado → anillo radial **y** lista completa renderizados a la vez (contenido duplicado). Causa: empate de especificidad (0,1,0) entre `.net-vecinos{display:flex}` (globals.css) y `.md:hidden` de Tailwind; el `flex` ganaba por cascada.
- **Fix:** `@media (min-width:768px){.net-vecinos{display:none}}` en `globals.css` → lista solo <768px como contrata el UI-SPEC.
- **Files modified:** app/app/globals.css
- **Verification:** LIVE a 772px `.net-vecinos`=`display:none`, `.net-lienzo`=`display:block`, 25 nodos; `red-seed-desktop-despues-ring-v2.png` confirma anillo sin lista filtrada.
- **Committed in:** `31fba72` (Task 2 fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1)
**Impact on plan:** El fix era necesario para el veredicto "comprensible" y fue justo lo que RED-03 existe para cazar (bug de cascada invisible a jsdom). Sin scope creep — un solo cambio de CSS acotado a `globals.css`.

## Issues Encountered

- **BrowserOS sin viewport/resize nativo:** las páginas ocultas heredan el tamaño de la ventana del host (~772px). Las capturas "390px" se produjeron simulando el estado móvil vía CSS inyectado (`body{width:390px}` + forzar la rama `<md`); el comportamiento móvil se verificó además programáticamente (24 filas, heading "Vecinos de …", 61 enlaces de fuente, Links alfabéticos a `/red?seed=`) como evidencia autoritativa independiente del render visual. La captura "antes" 390px es best-effort por la misma limitación.

## Known Stubs

None — el plan no introduce stubs; el único cambio de código es un ajuste de CSS. Los datos de /red provienen del grafo NET ya poblado.

## Deferred Debt (P2 — no bloqueante)

- **Densidad del anillo a ancho "desktop" estrecho (772px):** a ese ancho, 24 nodos de 160px quedan visualmente densos (legibles pero ajustados hacia el centro). Artefacto del ancho de captura de BrowserOS, no defecto de comprensión. Ajuste acotado si se reporta a ancho real: subir `RING1_R`/`RING2_R` o bajar el cap en `red-graph.tsx`. Documentado en `red-evidence/VEREDICTO.md §Hallazgos P2`.

## Checkpoint Resolution

**Task 3 (checkpoint:human-verify, gate=blocking):** presentado el veredicto de lectura fría + capturas antes/después sobre el /red live (Version 61d8fe13). El operador respondió **"aprobado"** el 2026-07-09 — el grafo radial es comprensible en las 4 combinaciones. Gate F17 (NET_PUBLIC_ENABLED) respetado: ningún flag `*_PUBLIC_ENABLED` flipeado.

## User Setup Required

None - no external service configuration required. Deploy ejecutado por el operador con el runbook 61-02 (wrangler OAuth local; CI Cloudflare sigue bloqueado por falta de CLOUDFLARE_API_TOKEN en Cuchecorp/gov-map — deuda de operador conocida, fuera de alcance).

## Next Phase Readiness

- RED-03 cerrado: /red comprensible live y aprobado. Fase 62 completa (3/3 planes).
- Deuda P2 (densidad anillo) documentada y no bloqueante para el milestone v6.1.
- Listo para audit/complete-milestone de v6.1.

## Self-Check: PASSED

- FOUND: 62-03-SUMMARY.md
- FOUND: red-evidence/VEREDICTO.md
- FOUND: app/app/globals.css (fix P1)
- FOUND commits: 3a2bbc1, 31fba72, 15eab66

---
*Phase: 62-red-grafo-de-relaciones-entendible*
*Completed: 2026-07-09*
