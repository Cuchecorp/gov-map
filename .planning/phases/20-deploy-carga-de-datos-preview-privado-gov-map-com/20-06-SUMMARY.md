---
phase: 20
plan: 06
subsystem: verificacion-e2e
tags: [deploy, verificacion, browseros, anti-insinuacion, money-gated]
requires:
  - "20-05 (Worker desplegado: https://observatorio-congreso.thevalis.workers.dev)"
provides:
  - "Verificación end-to-end del sitio en producción: landing, /buscar (20 resultados reales), ficha (votos reales), MONEY ausente, sin foto/partido, noindex"
  - "Evidencia visual: shots/01-landing.jpg, 02-buscar-salud.jpg, 03-ficha-D1054.jpg"
affects:
  - "Cierra los 5 Success Criteria de la fase 20"
tech-stack:
  added: []
  patterns:
    - "Verificación a nivel de respuesta (curl: HTTP/noindex/MONEY-grep) + evidencia visual (browseros bros.py screenshots)"
key-files:
  created:
    - ".planning/phases/20-deploy-carga-de-datos-preview-privado-gov-map-com/20-06-SUMMARY.md"
    - ".planning/phases/20-deploy-carga-de-datos-preview-privado-gov-map-com/shots/ (3 capturas)"
decisions:
  - "Verificación automatizada (curl) + visual (browseros) hecha por el agente; la sign-off humana final queda al operador (checkpoint)."
metrics:
  duration: "~8 min"
  completed: "2026-06-20"
  tasks: 2
  files: 1
---

# Phase 20 Plan 06: Verificación end-to-end — Summary

El sitio en producción (**https://observatorio-congreso.thevalis.workers.dev**) sirve data real y honra los principios rectores. Verificado por respuesta (curl) y visualmente (browseros).

## What was verified

- **Landing** (HTTP 200): hero "Observatorio del Congreso 360" con la búsqueda protagonista y la promesa fuente/fecha/enlace. `noindex,nofollow` presente.
- **/buscar** (HTTP 200): la búsqueda semántica devuelve **20 resultados reales** por query (`salud`, `educacion`, `ley`, `agua`). Captura `02-buscar-salud.jpg`: proyectos reales con boletín, título, estado "En tramitación", cámara, "Actualizado hace X min" y "fuente oficial" (trazabilidad).
- **Ficha** `/parlamentario/D1054` (HTTP 200, Francesca Muñoz González): sección **Votaciones** con barra de Asistencia (A favor 5 · En contra 4 · …) y **9 votos reales** fechados, con sentido (A favor/En contra), boletín enlazado (18296-05, 14309-04) y "fuente oficial" por fila. Secciones **Lobby** y **Patrimonio** presentes (honest-empty para este parlamentario — fuente sin datos enlazados). Captura `03-ficha-D1054.jpg`.
- **Principios rectores intactos**: NINGÚN marcador MONEY ("contratos del estado/aportes/financiamiento/servel") en el DOM (gate fail-closed); **sin foto**, **sin partido**; votos como hechos literales fechados y con fuente, sin lenguaje causal.
- Rutas `/proyecto/18302` y `/agenda` → HTTP 200.

## Self-Check: PASSED

- [x] Landing + /buscar (20 resultados reales) + ficha (votos reales) verificados en producción
- [x] MONEY ausente del DOM; sin foto/partido; noindex presente; anti-insinuación intacta
- [x] Evidencia visual capturada (3 screenshots)

## Operador (checkpoint diferido, no bloqueante)

- **Sign-off visual final** del operador sobre el sitio en vivo.
- **gov-map.com** custom domain (agregar a la cuenta Cloudflare + DNS) cuando se desee el dominio propio.
- **Flip a indexable** (`PUBLIC_INDEXABLE=true` como var del Worker) SOLO tras la pasada legal Ley 21.719.
