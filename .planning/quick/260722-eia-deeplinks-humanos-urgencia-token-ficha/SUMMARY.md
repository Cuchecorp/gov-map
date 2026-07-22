---
quick: true
id: 260722-eia
title: Deep-links humanos + token de urgencia siempre visible en la ficha del proyecto
subsystem: frontend
tags: [deep-links, provenance, urgencia, ficha-proyecto, deploy, cloudflare]
key-files:
  created:
    - app/components/enlace-humano-proyecto.test.ts
    - app/components/ficha-header.test.tsx
  modified:
    - app/components/validacion-fuente.tsx
    - app/components/ficha-header.tsx
    - app/components/proyectos-similares.tsx
    - app/components/estado-actual-block.tsx
    - app/components/estado-actual-block.test.tsx
    - app/components/votacion-card.tsx
    - app/components/votacion-card.test.tsx
    - app/components/autor-row.tsx
    - app/components/autor-row.test.tsx
decisions:
  - "enlaceHumanoProyecto detecta el WS XML por HOST (tramitacion.senado.cl) + PATH (/wspublico/), nunca por substring suelto."
  - "El token de urgencia se dirige por urgenciaEstado (vigente|sin-vigente|ausente); urgenciaVigente legacy conservado para el stepper."
  - "Rerutear TODAS las superficies que emiten proyecto/votacion/autor.enlace (header, Similares, VotacionCard, AutorRow); la verificacion PROD revelo que AutorRow era la fuente de los 5 links wspublico en 16456-35 (mocion sin votaciones)."
metrics:
  duration: "~2h (builds Docker OpenNext + iteracion de verificacion PROD)"
  completed: "2026-07-22"
  tasks_completed: 6
  tasks_total: 6
version_id: d99b8fa9-9af9-44dd-9868-6e2769c2fee6
---

# Quick 260722-eia: Deep-links humanos + token de urgencia en la ficha del proyecto - Summary

Los links "fuente oficial" de la ficha del proyecto dejan de apuntar al WS XML roto
(wspublico/tramitacion.php) y aterrizan en la ficha HUMANA del Senado por boletin; se
anade "Ver en la Camara" cuando hay prm_id_camara; y el estado de urgencia es SIEMPRE
visible con 3 estados honestos (vigente / sin urgencia vigente / sin datos), fechado y con
fuente. Desplegado a PROD y verificado en vivo sobre /proyecto/16456-35.

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| validacion-fuente.tsx | + enlaceHumanoProyecto(enlace, boletin): reruta wspublico->buildSenadoUrl(boletin); resto verbatim (host+path, try/catch new URL). |
| enlace-humano-proyecto.test.ts | Unit (8): wspublico->boletin_ini, case-insensitive host, robusto a query, verbatim Senado-no-ws/Camara/malformado/boletin-en-query. |
| ficha-header.tsx | sourceUrl via enlaceHumanoProyecto; link condicional "Ver en la Camara" con buildCamaraUrl cuando prm_id_camara != null. |
| ficha-header.test.tsx | Render (4): href rerutado + Camara prmID condicional + verbatim no-ws. |
| proyectos-similares.tsx | sourceUrl de cada card via enlaceHumanoProyecto(p.enlace, p.boletin). |
| estado-actual-block.tsx | + urgenciaEstado 3-valores + urgenciaFuente; EstadoActualView renderiza token con "segun {fuente} al {fecha}"; urgenciaVigente legacy conservado. |
| estado-actual-block.test.tsx | +9 tests (a/b/c + fuente + anti-insinuacion); 2 legacy migrados. |
| votacion-card.tsx | sourceUrl via enlaceHumanoProyecto(votacion.enlace, votacion.boletin). [Rule 1] |
| votacion-card.test.tsx | +2 tests (wspublico->appsenado; opendata Camara verbatim). |
| autor-row.tsx | sourceUrl por autor via enlaceHumanoProyecto(autor.enlace, autor.boletin). [Rule 1] |
| autor-row.test.tsx | +2 tests (wspublico->appsenado; Camara verbatim). |

## Commits

| Commit | Descripcion |
|--------|-------------|
| dac6b66 | feat: helper enlaceHumanoProyecto + unit (Task 1, TDD) |
| fa89b2b | fix: header + Similares + link Camara (Task 2, TDD) |
| d45fb22 | feat: token urgencia 3 estados (Task 3, TDD) |
| 9e91c63 | fix: rerutear votacion.enlace (Rule 1) |
| b1ee8f7 | fix: rerutear autor.enlace (Rule 1) |

## Deploy

| Campo | Valor |
|-------|-------|
| Worker | observatorio-congreso |
| URL | https://observatorio-congreso.thevalis.workers.dev |
| Version ID | d99b8fa9-9af9-44dd-9868-6e2769c2fee6 |
| Build | Docker node:22-slim (OpenNext) + wrangler 4.109.0 global OAuth |
| Metodo | robocopy -> C:/Temp/obs-build -> docker run (MSYS_NO_PATHCONV) -> docker cp -> wrangler deploy |

4 deploys iterativos (d78f8a32 -> 2ab30006 -> 4372b28d -> d99b8fa9) a medida que la
verificacion PROD revelo VotacionCard y AutorRow. Version ID vigente = el ultimo.

## Verificacion LIVE (BrowserOS + curl) - /proyecto/16456-35 en PROD

| # | Criterio | Resultado | Evidencia |
|---|----------|-----------|-----------|
| 1 | Cero links visibles a wspublico | PASS | 0 anchors /wspublico/ (incl. 0 flight/tooltip); 12 anchors appsenado ...boletin_ini=. BrowserOS links: todas "Fuente oficial: Senado" -> appsenado. Estable 2 fetches. |
| 2 | Link Camara prmID=17024 | PASS | BrowserOS: .../tramitacion.aspx?prmID=17024&prmBOLETIN=16456-35. |
| 3 | Token urgencia 3 estados | PASS | BrowserOS content: "Donde esta hoy?" -> "Sin urgencia vigente. segun Senado al 10 jul 2026." (hecho negativo honesto + fuente, sin adjetivos). |

## Suite + guards

- pnpm test (app): corridas verdes completas 1093/1093 y 1095/1095. La ultima corrida dio
  1096/1097; el unico rojo (lib/money-antiflip-guard.test.ts, escaneo packages/) es FLAKY
  (20/20 en aislamiento y en repeticiones; race de lectura en paralelo, ajeno a app/).
- Guards verdes: anti-insinuacion-guard (19), bento-guards (97, anti-hex).
- tsc --noEmit: limpio (exit 0).

## Deviations from Plan

1. [Rule 1 - Bug] Rerutear votacion.enlace en VotacionCard. Found during Task 6 (verif PROD):
   5 links "Fuente oficial" al WS XML; plan solo cubria header+Similares. Fix: VotacionCard via
   enlaceHumanoProyecto. Commit 9e91c63.
2. [Rule 1 - Bug] Rerutear autor.enlace en AutorRow. Found during Task 6 (16456-35 = mocion sin
   votaciones -> los 5 badges eran ProvenanceBadge por autor). Fix: AutorRow via enlaceHumanoProyecto.
   Commit b1ee8f7.

Scope: el plan acoto a 2 call-sites, pero el criterio rector ("cero links a wspublico visibles";
trazabilidad que FUNCIONA para un humano) exige cubrir toda superficie que emite
proyecto/votacion/autor.enlace. Fuera de alcance conforme al plan: event.enlace del TimelineView y
cruce.enlace_fuente.

## BrowserOS gate - nota

links y content OK (evidencia primaria). save_screenshot fallo 3x con "CDP request timeout:
Page.captureScreenshot" (gotcha del MCP en rafaga; reintentos no lo resolvieron). Sin PNG; los 3
criterios quedan respaldados por links+content del DOM SSR renderizado en PROD.

## Known Stubs

Ninguno. Datos de columnas reales (proyecto.enlace, prm_id_camara, tramitacion_evento,
votacion.enlace, proyecto_autor.enlace).

## Threat Flags

Ninguno. Sin nueva superficie red/auth/PII. enlaceHumanoProyecto reescribe a hosts fijos existentes
(appsenado); safeExternalHref sigue siendo el guard anti-XSS.

## Self-Check: PASSED

- enlace-humano-proyecto.test.ts, ficha-header.test.tsx, validacion-fuente.tsx (helper) - FOUND
- Commits dac6b66, fa89b2b, d45fb22, 9e91c63, b1ee8f7 - FOUND
- Version ID d99b8fa9-9af9-44dd-9868-6e2769c2fee6 - confirmado por wrangler
- PROD /proyecto/16456-35: 0 wspublico, prmID=17024, "Sin urgencia vigente ... segun Senado al 10 jul 2026" - LIVE
