---
phase: "89"
plan: "03"
subsystem: "frontend/buscar"
tags: [deploy, browseros-gate, deep-links, rsc-fix, pasada-1]
dependency-graph:
  requires: [89-01, 89-02, 88-02, 87-02]
  provides: [pasada-1-cerrada, buscar-live-verified, deep-links-live-verified]
  affects: [buscar-page, ficha-page]
tech-stack:
  added: []
  patterns:
    - "isRedirectError re-throw pattern (next/dist/client/components/redirect-error)"
    - "RSC serializable props pattern (embed card data en BuscarSliceRow)"
key-files:
  created:
    - ".planning/phases/89-.../89-BROWSEROS-GATE.md"
    - ".planning/phases/89-.../screenshots/*.png (4 files)"
  modified:
    - "app/app/buscar/page.tsx (isRedirectError + sliceEnriquecido con card data)"
    - "app/components/buscar-filtros.tsx (SearchResultCard inline, renderRow eliminado)"
    - "app/components/search-result-card.tsx (role=article)"
    - "app/lib/types.ts (BuscarSliceRow extended)"
decisions:
  - "RSC function-prop eliminado: card data serializable en BuscarSliceRow (materia, estado, fecha_captura, origen, enlace)"
  - "NEXT_REDIRECT re-thrown antes del catch de errores reales en Resultados"
  - "Mobile screenshot con CSS constraint (body maxWidth 390px) porque X-Frame-Options: DENY impide iframe"
metrics:
  duration: "~5 horas (3 Docker builds + 2 deploys + gate BrowserOS)"
  completed: "2026-07-22"
  tasks-completed: 2
  files-changed: 8
---

# Phase 89 Plan 03: Deploy Pasada 1 + Gate BrowserOS SUMMARY

**One-liner:** Deploy buscar semántico + filtros client-side + deep-links a fuentes oficiales a Cloudflare Workers version 9e15ebbd, con gate BrowserOS 5/5 puntos y 2 bugs RSC corregidos en vuelo.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Deploy + gate BrowserOS (incluye 2 bug fixes RSC) | ea3be50, 568ba3c | page.tsx, buscar-filtros.tsx, search-result-card.tsx, types.ts |
| 2 | Evidencia 89-BROWSEROS-GATE.md + 4 screenshots | 2b43374 | 89-BROWSEROS-GATE.md, screenshots/ |

## Gate BrowserOS — Resultado

| Punto | Estado |
|-------|--------|
| (a) query literal "datos personales" → 20 resultados | PASS |
| (a) boletín punteado 14.309-04 → redirect a ficha | PASS |
| (b) filters island (facetas + orden) visible y operable | PASS |
| (c) validar-deeplinks 12/12 Senado HTTP 200 + match | PASS |
| (d) "Valida en fuente" Senado+Cámara en ficha 16572-06 | PASS |
| (e) desktop + mobile 390px screenshots | PASS (mobile con CSS constraint) |

**VEREDICTO: PASADA 1 CERRADA** (fases 87+88+89 live y verificadas)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RSC function-prop renderRow serialization error**
- **Found during:** Task 1 (primera verificación post-deploy)
- **Issue:** `BuscarFiltros` ("use client") recibía `renderRow` prop función desde Server Component → error RSC `E{"digest":"1360811320"}` en producción. El error era silencioso localmente (no hay RSC streaming en dev).
- **Fix:** Embed de materia/estado/fecha_captura/origen/enlace como campos serializables en `BuscarSliceRow`. `SearchResultCard` renderizado directamente dentro del island cliente.
- **Files modified:** app/lib/types.ts, app/app/buscar/page.tsx, app/components/buscar-filtros.tsx, app/components/search-result-card.tsx
- **Commit:** ea3be50

**2. [Rule 1 - Bug] NEXT_REDIRECT capturado por try/catch en Resultados**
- **Found during:** Task 1 (gate punto a — boletín punteado 14.309-04 mostraba error)
- **Issue:** `redirect()` en `buscarProyectos` lanza `NEXT_REDIRECT` internamente. El try/catch en `Resultados` (page.tsx) lo capturaba como error de búsqueda. Detectado vía `wrangler tail`.
- **Fix:** `isRedirectError` de `next/dist/client/components/redirect-error` re-lanza antes del log de error real.
- **Files modified:** app/app/buscar/page.tsx
- **Commit:** 568ba3c

### Deferred Issues

- prmId backfill en prod pendiente (validar-deeplinks prueba solo Senado con prmId null)
- Mobile screenshot: X-Frame-Options: DENY impide iframe; CSS constraint es aproximación
- Senado timeout transient (16244-07): primera corrida del script fallaba; retry inmediato OK

## Self-Check

- [x] 89-BROWSEROS-GATE.md creado: FOUND
- [x] Screenshots (4): FOUND  
- [x] Commits ea3be50, 568ba3c, 2b43374: verificados via git log
- [x] Deploy 9e15ebbd: live en https://observatorio-congreso.thevalis.workers.dev

## Self-Check: PASSED
