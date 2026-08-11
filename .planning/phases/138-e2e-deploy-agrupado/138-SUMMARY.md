---
phase: 138-e2e
subsystem: deploy
tags: [deploy, browseros, evidencia-dom, flags-off]
dependency-graph:
  requires: [129, 130, 131, 137]
  provides: [deploy d8d33ad8, evidencia E2E]
metrics:
  completed: "2026-08-11"
---

# Phase 138 — E2E: deploy agrupado verificado sobre producción real

## SC1 — Deploy agrupado, versión anclada

Runbook 104-02 verbatim: robocopy /MIR → `C:/Temp/obs-build` (PowerShell), purga
`.pnpm-store`, build OpenNext en `node:22-slim` (worker.js emitido), deploy en el MISMO
contenedor con el OAuth del host montado. **Version ID nuevo:
`d8d33ad8-dea9-4e18-8538-8bfb149f9613`** (baseline previo distinto, registrado). Ventana de
propagación respetada; `Server: cloudflare` + CSP enforced verificados por curl.

## SC2 — Pasada BrowserOS (fragmentos por `textContent` + capturas no-vacías)

| Superficie | Evidencia DOM (textContent) | Captura |
|---|---|---|
| Panel (landing) | título OK, tiles con contenido de sala/comisiones/votaciones, links internos vivos | `assets/138-landing-desktop.png` (80 KB) |
| Ficha proyecto 17142-05 | `section#prensa` presente; "Ningún titular o bajada de la prensa monitoreada…" (ausencia honesta) + nota "mención textual del boletín…" | `assets/138-ficha-17142-05-prensa.png` (356 KB, fullPage) |
| Ficha parlamentario D1170 | **"3777 votaciones" visible = psql `3777` EXACTO** (B-01 muerto); cero "(1000)"; **sin sección Prensa** (T9 fail-closed) | `assets/138-parlamentario-D1170-votos.png` |
| /comparar | carga completa, cero marcadores de truncamiento | — (DOM) |
| /metodologia/prensa | "Cómo clasificamos las noticias", "n=154", "87,66 %", "no está medido" | `assets/138-metodologia-prensa.png` (429 KB, fullPage) |

## SC3 — Flags

`MONEY_PUBLIC|NOTIF_PUBLIC` markers en el HTML servido: **0** (curl -c). DOM: money/notif
markers false; panel (VSIM/NET/CRUCES) renderizado presente = control positivo apareado.
**Ningún flag fue flipeado por agente en todo el milestone.**

## SC4 — Suites y conteos

- @obs/news **384** verdes; app **1808** verdes (122 archivos); pgTAP 0086 13/13, 0087
  12/12, 0088 3/3 contra PROD.
- Conteo clave cuadrado psql↔superficie: votos D1170 = 3777 (verbatim `psql -tA`, jamás
  REST) = cifra renderizada.
- Estado news PROD: 112 clasificadas / 2 descartadas / 0 pendientes; dead-letter 2 causas;
  ledger por corrida.

## Nota

Captura móvil 390px: omitida en esta pasada (BrowserOS sin control de viewport; el truco
iframe de v8 queda para 139-PANEL-DASH, que es la fase de diseño del panel).
