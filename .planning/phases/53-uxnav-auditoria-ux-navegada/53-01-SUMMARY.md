---
phase: 53-uxnav-auditoria-ux-navegada
plan: 01
subsystem: ui
tags: [browseros, mcp, ux-audit, navigation, breadcrumbs, orientation, next16, prod]

# Dependency graph
requires:
  - phase: 52-cruce2-cruces-nuevos
    provides: PROD desplegado (ee6b7544) con cruces y fichas a auditar; 53-UI-SPEC (contrato de remedios)
provides:
  - "53-UX-AUDIT.md — universo completo de hallazgos P0/P1/P2/GATED de los 4 journeys, con evidencia y file:line"
  - "3 P0 acotados al contrato UI-SPEC (nav Red+Sobre · breadcrumbs fichas · continuation lines) — insumo directo de la Wave 2"
  - "ux-evidence/ — 15 screenshots (4 journeys × 2 viewports + extras) + pista-a-log.md"
  - "Mecánica BrowserOS de dos pistas validada en vivo (harness iframe fresh-per-shot)"
affects: [53-02, 53-03, 53-04, 54-uxdemo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auditoría UX navegada con BrowserOS MCP vía bros-cli.mjs (páginas ocultas)"
    - "Protocolo dos pistas: funcional directa (console/links/snapshot) + visual harness iframe (viewports exactos 390/1280)"
    - "Fresh-harness-per-shot: reabrir página oculta por screenshot evita crashes acumulados del CDP"

key-files:
  created:
    - .planning/phases/53-uxnav-auditoria-ux-navegada/53-UX-AUDIT.md
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/pista-a-log.md
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/ (15 *.jpg)
  modified: []

key-decisions:
  - "3 P0 (nav Red+Sobre, breadcrumbs, continuation lines), cada uno mapeado a un remedio contratado del UI-SPEC con file:line"
  - "F-03 continuation lines clasificado P0 (no P1) porque el CONTEXT contrata la línea como remedio explícito de callejón-sin-salida, pese a que el header mitiga"
  - "Grafo /red ilegible en móvil = P1 → F54 (rediseño visual excede contrato)"
  - "woff2 preload warnings = P2 ruido (todas las rutas, cero errores de app)"
  - "/contraparte 404 = GATED (MONEY OFF, con recuperación), NO P0; cross-link contraparte-en-lobby NOT SHIPPABLE (3 candados)"

patterns-established:
  - "Búsqueda semántica usa Suspense streaming 6-9s con skeleton — lecturas de auditoría <6s dan falsos vacíos; esperar el streaming antes de concluir"
  - "get_page_links (a11y) no capta links envueltos en tarjeta; usar search_dom a[href*='...'] para inventario fiable de cross-links"

requirements-completed: [UX-01]

# Metrics
duration: ~95min
completed: 2026-07-06
---

# Phase 53 Plan 01: Auditoría UX navegada Summary

**Auditoría en vivo de PROD (ee6b7544) con BrowserOS: 4 journeys × 2 viewports, 15 screenshots, y 53-UX-AUDIT.md con 3 P0 acotados al contrato UI-SPEC (nav Red+Sobre · breadcrumbs · continuation lines) + 2 P1, 1 P2 y 1 GATED.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-07-06 (audit session)
- **Completed:** 2026-07-06
- **Tasks:** 3
- **Files created:** 17 (53-UX-AUDIT.md + pista-a-log.md + 15 jpg)

## Accomplishments
- Navegación funcional (Pista A) de los 4 journeys contra PROD: console limpia (solo baseline woff2), inventario de links, headings y afordancias por ruta — sin errores de app en ninguna superficie.
- Evidencia visual (Pista B) de 15 screenshots a viewports exactos vía harness iframe (móvil 390 con nav envuelto real, desktop 1280).
- `53-UX-AUDIT.md` con 3 P0 / 2 P1 / 1 P2 / 1 GATED, cada P0 con criterio + evidencia + remedio contratado + file:line del fix, matriz de cobertura, tabla P0→remedio y sección Re-walkthrough lista para la Wave 3.
- Confirmado que búsqueda (boletín + semántica), fichas, directorio, red y agenda funcionan y están interconectados; el único vacío real es de orientación (nav/breadcrumb), no de función.

## Task Commits

1. **Task 1: Pista A — navegación funcional de los 4 journeys** - `03a202e` (docs)
2. **Task 2: Pista B — 15 screenshots harness iframe** - `65ee744` (docs)
3. **Task 3: redacta 53-UX-AUDIT.md** - `2336504` (docs)

## Files Created/Modified
- `.planning/phases/53-uxnav-auditoria-ux-navegada/53-UX-AUDIT.md` - Informe de auditoría (journeys, hallazgos clasificados, matriz, re-walkthrough)
- `.planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/pista-a-log.md` - Log crudo Pista A (console/links/headings/interacciones)
- `.planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/*.jpg` - 15 screenshots (j1..j4 × 390/1280 + extras)

## Hallazgos P0 (superficies + remedio contratado — insumo Wave 2)

| P0 | Superficie | Remedio contratado (UI-SPEC) | Fix |
|----|-----------|------------------------------|-----|
| F-01 | Header nav | §a ítem "Red" (pos 4) + acortar "Sobre" | `app/components/header-nav.tsx:27-32` |
| F-02 | Fichas proyecto/parlamentario/contraparte | §b Breadcrumbs (server, props literales) | NUEVO `app/components/breadcrumbs.tsx` + `proyecto/[boletin]/page.tsx:50`, `parlamentario/[id]/page.tsx:116`, `contraparte/[id]/page.tsx:62` |
| F-03 | Empty states (buscar/votos/lobby/agenda/red) | §c Línea de continuación (1 link petróleo) | `buscar/page.tsx:80-90`, `votos-por-parlamentario.tsx:462-466`, `lobby-de-parlamentario.tsx:296-300/310-314`, `agenda/page.tsx:294-297/…`, `red/red-graph.tsx:158-165` |

**P1 (→ F54):** F-04 grafo /red ilegible en móvil 390. **P2 (→ backlog):** F-05 woff2 preload warnings.
**GATED:** F-06 `/contraparte/[id]` 404 (MONEY OFF, con recuperación) + cross-link contraparte-en-lobby NOT SHIPPABLE (RPC sin contraparte_id + doctrina texto-crudo + ruta gated).

## Decisions Made
- Ver `key-decisions` en frontmatter. Clave: F-03 (continuation lines) se mantiene P0 por mandato explícito del CONTEXT, aunque el header nav mitiga el dead-end; todos los P0 caben en el contrato (nada excedió → nada degradado a P1 por acotamiento, salvo lo que ya es rediseño visual = F-04).

## Deviations from Plan

None - plan executed exactly as written. Los 3 tasks se ejecutaron en orden (Pista A → Pista B → informe). No se tocó código de app (auditoría read-only). No se aplicó ninguna regla de deviación 1-4.

## Issues Encountered
- **Página oculta perdida ante hiccups del MCP** (`fetch failed` → `Unknown page N`): resuelto reabriendo la página y continuando. En Pista B el harness crasheaba tras 2-3 shots pesados → se adoptó **fresh-harness-per-shot** (reabrir + cerrar por screenshot), que capturó los 15 de forma fiable.
- **CDP request timeout en save_screenshot**: reproducido; resuelto con retry-once (hasta 3 intentos con sleeps escalonados), como documenta el header de bros-cli.
- **Falsos "vacíos" de búsqueda**: lecturas <6s durante el Suspense streaming de la búsqueda semántica parecían páginas sin resultados; verificado contra fuente (`buscar/page.tsx`) + espera de 9s que la búsqueda funciona (evitó un falso positivo P0). Documentado en pista-a-log.md.

## User Setup Required
None - no external service configuration required (BrowserOS MCP local sin auth; auditoría read-only de PROD).

## Next Phase Readiness
- Wave 2 (planes 02/03/04) tiene el universo completo de P0 con file:line y remedio contratado — puede implementar nav, breadcrumbs y continuation lines sin re-auditar.
- Wave 3 (re-walkthrough) tiene la sección lista y los before-screenshots identificados; requiere el redeploy final (patrón docker-cf-build.sh + wrangler; A1: OAuth de wrangler es asunción — posible checkpoint operador).
- Sin blockers para la Wave 2.

## Self-Check: PASSED

- FOUND: 53-UX-AUDIT.md (`## Journey 1`..`## Journey 4` present)
- FOUND: ux-evidence/pista-a-log.md
- FOUND: 15 screenshots in ux-evidence/*.jpg (≥8 required)
- FOUND commits: `03a202e` (Task 1), `65ee744` (Task 2), `2336504` (Task 3)

---
*Phase: 53-uxnav-auditoria-ux-navegada*
*Completed: 2026-07-06*
