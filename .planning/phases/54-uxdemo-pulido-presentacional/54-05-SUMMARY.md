---
phase: 54-uxdemo-pulido-presentacional
plan: 05
subsystem: deploy-evidencia
tags: [deploy, cloudflare, smoke, screenshots, demo, browseros]
requires:
  - 54-01..54-04 (todo F54 en master antes del redeploy)
provides:
  - PROD redeployado con todo F54 + fixes post-deploy F53 (versión e2d876e7, 100%)
  - smoke 200 en superficies clave + NET gate ON verificado en vivo
  - docs/demo/ con 7 capturas full-width (6 canónicas + 04b patrimonio-cruces)
affects:
  - docs/demo/
tech-stack:
  added: []
  patterns:
    - "Screenshot iframe SAME-ORIGIN: harness = página PROD misma origin → iframe in-process rasteriza COMPLETO en fullPage (el iframe cross-origin file:// solo pinta el viewport padre 772x728)"
    - "Límite Chromium fullPage: >16384 device px la captura se TILEA (repite contenido) → cap ~12800 px lógicos a dpr 1.25 y dividir páginas largas"
key-files:
  created:
    - docs/demo/demo-01-home-1280.jpg
    - docs/demo/demo-02-buscar-1280.jpg
    - docs/demo/demo-03-proyecto-1280.jpg
    - docs/demo/demo-04-parlamentario-1280.jpg
    - docs/demo/demo-04b-parlamentario-patrimonio-cruces-1280.jpg
    - docs/demo/demo-05-agenda-1280.jpg
    - docs/demo/demo-06-red-1280.jpg
  modified: []
decisions:
  - "Set original (6e606c4) DESCARTADO: el harness file:// solo pintaba ~1180px de contenido (clipping OOPIF) — la home cortaba la 3ª tarjeta y la ficha parlamentario no mostraba lobby/patrimonio/cruces; recapturado con iframe same-origin"
  - "Ficha parlamentario (28.048px lógicos) dividida en demo-04 (votos+lobby) + demo-04b (patrimonio+cruces) por el límite de textura de Chromium"
  - "demo-03 usa boletín 14782-13 (sala cuna): carril lobby×tramitación con 5 filas"
metrics:
  duration: "2 sesiones (deploy 2026-07-07 madrugada; recaptura y cierre 2026-07-07)"
  completed: 2026-07-07
  tasks: "3 auto + 1 checkpoint human-verify (presentado)"
  commits: 2
  suite: 594/594 green pre-deploy
---

# Phase 54 Plan 05: Gate + redeploy final + set de demo Summary

Gate de fase verde, redeploy final a PROD (todo F54 + fixes post-deploy F53), smoke 200 en superficies clave, y set de screenshots de demo full-width capturado contra el sitio FINAL desplegado — recapturado en esta sesión tras detectar clipping en el set original.

## What Was Built

### Task 1 — Gate de fase (pre-deploy)
`pnpm test` 594/594 verde (baseline 589; lockdown-guard y banned-vocab incluidos) + `tsc -b` limpio. Ejecutado antes del deploy en la sesión del 2026-07-07 (madrugada).

### Task 2 — Redeploy final + smoke
- `npx wrangler whoami` OK (OAuth vivo, sin checkpoint de auth).
- Patrón autorizado: docker-cf-build.sh (OpenNext en Docker Linux) → docker cp → `wrangler deploy`.
- **Versión desplegada: `e2d876e7-d0f0-45fb-9034-06a17b71e50d` al 100%, creada 2026-07-07T05:36Z** (confirmada con `wrangler deployments status` al cierre).
- Smoke re-verificado al cierre (curl): `/`, `/buscar`, `/agenda`, `/red`, `/red?seed=D1012`, `/parlamentario/D1012`, `/proyecto/14309-04` → todos **200**.
- NET gate ON verificado EN VIVO: /red poblado (grafo con nodos + filtros, evidencia demo-06). Estado OFF cubierto por `lib/net-gate.test.ts` — PROD jamás se flipeó.

### Task 3 — Set de demo (RECAPTURADO) + QA navegado
El set original (`6e606c4`) tenía un defecto sistemático: el harness iframe file:// solo rasterizaba la intersección con el viewport padre (772×728) — cada captura mostraba ~1180px de contenido y el resto blanco; la home cortaba la 3ª tarjeta a la derecha y la ficha parlamentario no mostraba lobby/patrimonio/cruces. **Incumplía el quality gate del propio plan.**

Fix: **iframe same-origin** — el harness pasa a ser la propia página PROD y el iframe (misma origin) es in-process → rasteriza completo en fullPage. Segundo gotcha encontrado: capturas >16384 device px se **tilean** (límite de textura Chromium) → cap ~12800px lógicos y división de páginas largas.

| File | Superficie | Dimensiones | Evidencia |
|---|---|---|---|
| demo-01-home-1280.jpg | `/` | 1600×4000 | Hero + 3 tarjetas COMPLETAS + Votado esta semana/Urgencias + footer CC BY |
| demo-02-buscar-1280.jpg | `/buscar?q=protección de datos personales` | 1600×5683 | Resultados semánticos + botón Buscar petróleo |
| demo-03-proyecto-1280.jpg | `/proyecto/14782-13` | 1600×12989 | Tramitación completa + votación + **carril lobby×tramitación con 5 filas** (nombres Title Case) |
| demo-04-parlamentario-1280.jpg | `/parlamentario/D1012` | 1600×16000 | Header + chips + votos (Cómo votó) + lobby completo |
| demo-04b-parlamentario-patrimonio-cruces-1280.jpg | `/parlamentario/D1012` (scroll) | 1600×16000 | Chart patrimonio (F46) + declaraciones + cruces con sectores |
| demo-05-agenda-1280.jpg | `/agenda` | 1600×14508 | Citaciones + tabla de sala con cross-links |
| demo-06-red-1280.jpg | `/red?seed=D1012` | 1600×1515 | Grafo poblado + filtros + disclaimer anti-causal |

Todas ≥1260px de ancho (1600 device px = 1280 lógicos × dpr 1.25), JPEG q70, contra PROD post-deploy.

**QA navegado**: 0 errores de consola del sitio en las 7 navegaciones (los únicos 2 errores registrados fueron `file:///C:/Program Files/Git/...` autoinfligidos por el bug MSYS de path-conversion del primer intento de captura, no del sitio; los woff2 son warnings, aceptados por 54-04).

### Task 4 — Checkpoint human-verify
Set presentado al operador (SendUserFile) para verificación visual final. **Pendiente: "approved" del operador.**

## Deviations from Plan

1. **Executor original murió por session-limit** tras el deploy y el set inicial, antes de SUMMARY/checkpoint/estado — este cierre lo completa una sesión de continuación.
2. **Set de screenshots rehecho**: el original pasaba el check automatizado (`ls` + ancho ≥1260) pero fallaba el contenido (clipping OOPIF). Recapturado con la técnica same-origin; se agregó demo-04b (7 archivos, plan pedía ≥6).
3. `scripts/rewalk-shot.mjs` NO se modificó (sigue siendo la herramienta histórica de F53); la variante same-origin vivió en un helper temporal fuera del repo — si se necesita de nuevo, el patrón queda documentado aquí y en el memory.

## Verification

- `wrangler deployments status`: e2d876e7 al 100% (2026-07-07T05:36Z).
- curl smoke 7 rutas → 200.
- 7 JPEG en docs/demo/, todos 1600px de ancho; inspección visual: 3 tarjetas completas (01), botón petróleo (02), carril con filas (03), votos+lobby (04), patrimonio+cruces (04b), agenda con cross-links (05), grafo poblado (06).
- Checkpoint T4: presentado, esperando aprobación del operador.

## Self-Check: PASSED (salvo checkpoint humano pendiente)
