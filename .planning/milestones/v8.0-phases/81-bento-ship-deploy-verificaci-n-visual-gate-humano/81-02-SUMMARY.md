---
phase: 81
plan: "02"
subsystem: verification
tags: [browseros, gate-visual, red, anchors, mobile]
requirements: [BENTO-07]
decisions:
  - "Móvil 390px verificado vía iframe same-origin (patrón F55) — window.resizeTo no funciona en window maximizado; popup window.open bloqueado"
  - "Gate visual fase 75 CERRADO: /red en deploy real con getComputedStyle — main 768px, .net-chip 11px, 78 elementos .net-*"
  - "Hallazgo REAL del gate: anchors de <section id> a 0px (el global de 76 solo cubría headings) → fix :where([id]) + redeploy fb88c8a4 en la misma sesión"
metrics:
  completed: "2026-07-15"
  captures: 10
---

# Phase 81 Plan 02: Verificación BrowserOS + gate humano — Summary

Verificación visual completa sobre el deploy real (ejecutada por el orquestador — los
executors no tienen BrowserOS). Evidencia en `captures/`; veredicto y checklist del
operador en `81-BROWSEROS-GATE.md`.

## Resultados

| Verificación | Resultado |
|--------------|-----------|
| Home desktop vs mockup | ✅ fiel (divergencias solo las mandadas por D1/invariante 2) |
| Home móvil 390px | ✅ 1 col, sin overflow-x, header OK |
| Rutas interiores (lista/ficha/prosa) | ✅ 1120px + radius, interiores intactos |
| /red (gate 75) | ✅ 768px + .net-chip 11px exacto — CERRADO |
| Anchors vs sticky | ⚠→✅ hallazgo real (0px en sections) corregido + redeployado |

## Capturas archivadas

mockup-1200, home-deploy-desktop, home-deploy-fullpage, home-deploy-390-top,
home-deploy-390-mid, red-deploy-seed-D1009, ficha-deploy-S1110, parlamentarios-deploy,
sobre-deploy (en `captures/`).

## Gate humano

`81-BROWSEROS-GATE.md` — status PENDING-HANDOFF (patrón v7): evidencia lista, checklist
de 7 puntos, la corrida cierra sin esperar el sign-off. Deuda de operador: registrar
veredicto de lectura fría.

## Deviations

- CDP timeouts recurrentes de save_screenshot → pausas 10-12s + probe MCP + retry (gotcha conocido, sin pérdida).
- Redeploy necesario (fix anchors) — Version final `fb88c8a4-dd05-4b9a-a017-0c373d0f185f`.
