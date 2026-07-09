---
phase: "61"
plan: "04"
name: "Deploy #2 + BrowserOS re-capture"
status: complete
date: "2026-07-09"
duration: "~45 min"
tasks_completed: 4
tasks_total: 4
files_modified: 1
requirements: [COMP-02]
key-decisions:
  - "Deploy #2 usa la misma ruta: Docker node:22-slim + robocopy a C:/Temp, extracción .open-next por docker cp, wrangler 4.109.0 OAuth local"
  - "Screenshots after muestran el fold superior; evidencia de fixes COMP-01–05 tomada directamente del HTML live (curl grep)"
  - "COMP-06 (rail label) confirmado visualmente en screenshot desktop: '◆ Lobby por sector  12'"
key-files:
  created:
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/61-04-PLAN.md
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/61-04-SUMMARY.md
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/comp-evidence/parlamentario-desktop-despues.png
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/comp-evidence/parlamentario-mobile-despues.png
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/comp-evidence/parlamentario-desktop-despues-cruces.png
  modified:
    - .planning/phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/61-COMP-AUDIT.md
decisions:
  - "Todos los hallazgos P0/P1 (COMP-01 al COMP-06) confirmados corregidos en producción — loop comprensión cerrado"
metrics:
  duration: "~45 min"
  completed: "2026-07-09"
  tasks_completed: 4
  tasks_total: 4
---

# Phase 61 Plan 04: Deploy #2 + BrowserOS Re-capture Summary

**One-liner:** Deploy #2 (versión 051a6cf0) publica los 6 fixes de comprensión; re-captura BrowserOS + inspección HTML confirman todos los hallazgos P0/P1 corregidos — loop captura→corrección→re-captura cerrado.

---

## Deployment Details

| Field | Value |
|-------|-------|
| Worker | observatorio-congreso |
| URL | https://observatorio-congreso.thevalis.workers.dev |
| Version ID | **051a6cf0-993f-4bcc-8708-fc70f33e95f8** |
| Build method | Docker node:22-slim + obs-build-cache volume + wrangler 4.109.0 OAuth local |
| Assets uploaded | 1 new / 60 cached (total 61 static assets) |
| Worker startup time | 23 ms |

---

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Pre-flight: suite 738/738 + tsc clean + git push origin master | PASS |
| 2 | Docker build + deploy #2 (versión 051a6cf0) | SUCCESS |
| 3 | HTTP + content checks LIVE | ALL PASS |
| 4 | BrowserOS re-capture + cold-read + audit update | DONE |

---

## Veredictos finales por hallazgo (P0/P1)

| ID | Severidad | Hallazgo | Veredicto final |
|----|----------|---------|----------------|
| COMP-01 | P0 | "Cruces con sectores" sin definición | **corregido** |
| COMP-02 | P0 | Caveat incomprensible sin contexto | **corregido** |
| COMP-03 | P1 | h2 no responde a pregunta | **corregido** |
| COMP-04 | P1 | "Cómo leer esto" escondido | **corregido** |
| COMP-05 | P1 | CTA reutiliza jargon "cruces" | **corregido** |
| COMP-06 | P1 | Rail label opaco + ◆ sin leyenda | **corregido** |

**Resultado: 6/6 hallazgos P0+P1 corregidos. 0 persisten.**

---

## Evidencia live (HTTP checks)

| Check | Resultado |
|-------|-----------|
| `/ ` → 200 | PASS |
| `/parlamentario/D1009` → 200 | PASS |
| h2 = "¿Con qué sectores tuvo reuniones de lobby?" | PRESENT |
| intro contextual Ley del Lobby (Ley 20.730) | PRESENT |
| triggerLabel = "Ver las 12 señales de lobby por sector" | PRESENT |
| "Explorar los" (old copy) | ABSENT |
| rail = "◆ Lobby por sector  12" | PRESENT (screenshot) |

---

## Veredicto por superficie (estado final)

| Superficie | Veredicto final |
|-----------|----------------|
| `/` (home) | **comprensible** |
| `/parlamentario/D1009` — top | **comprensible** |
| `/parlamentario/D1009` — cruces | **comprensible** (fixes P0/P1 LIVE) |
| `/proyecto/18325-06` (moción) | **comprensible** |
| `/proyecto/14309-04` (mensaje) | **comprensible** |
| `/red` | **comprensible** |
| `/buscar` | **comprensible** |
| `/agenda` | **comprensible** |

**Todas las superficies comprensibles. Loop de comprensión cerrado.**

---

## Evidencia en comp-evidence/

| Archivo | Descripción |
|---------|-------------|
| `parlamentario-desktop-antes.png` | Captura antes (Plan 03) — desktop top |
| `parlamentario-mobile-antes.png` | Captura antes (Plan 03) — mobile top |
| `parlamentario-desktop-despues.png` | Captura después (Plan 04) — desktop top (rail corregido visible) |
| `parlamentario-mobile-despues.png` | Captura después (Plan 04) — mobile top |
| `parlamentario-desktop-despues-cruces.png` | Captura cruces scrolled |

---

## Deviations from Plan

### Docker: volumen obs-build-cache contenía lock de build previo

**Hallazgo:** Primera ejecución del contenedor falló con "Another next build process is already running" — el volumen `obs-build-cache` tenía un `.next/` de la corrida del background job previo (bwdjd6ply, que sí completó exitosamente).
**Fix:** Se usó el resultado del background job que completó exitosamente (BUILD_OK) — el volumen ya tenía el bundle listo. Se extrajo con `docker cp` directamente.
**Impacto:** Ninguno — el bundle en el volumen era correcto y actualizado.

---

## Known Stubs

Ninguno — plan de deploy + evidencia, sin código nuevo.

## Threat Flags

Ninguno.

## Self-Check: PASSED

- Deploy versión `051a6cf0-993f-4bcc-8708-fc70f33e95f8`: confirmado por wrangler output
- HTTP / 200: PASS
- HTTP /parlamentario/D1009 200: PASS
- "¿Con qué sectores tuvo reuniones de lobby?" en HTML live: CONFIRMED
- "Ver las 12 señales de lobby por sector" en HTML live: CONFIRMED
- "Explorar los" absent: CONFIRMED
- Screenshots después: parlamentario-desktop-despues.png + parlamentario-mobile-despues.png CREATED
- 61-COMP-AUDIT.md: actualizado con "Estado final" por cada hallazgo
