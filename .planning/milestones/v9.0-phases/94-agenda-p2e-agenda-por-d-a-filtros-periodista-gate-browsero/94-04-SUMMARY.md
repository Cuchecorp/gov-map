---
phase: 94-agenda-p2e-agenda-por-d-a-filtros-periodista-gate-browsero
plan: 04
subsystem: deploy + gate empírico (cierre de fase)
tags: [deploy-cloudflare, opennext-docker, browseros-gate, tz-chile, cobertura-declarada, CIT-02, CIT-03, CIT-04, CIT-05]
requires:
  - "94-01: banner de cobertura + estado en CitacionCard + agrupación día-Chile (montados)"
  - "94-02: island agenda-filtros (facetas + counts honestos) + linter extendido"
  - "94-03: fixes de wiring de la ficha (citacionesPasadas + enTablaSala)"
  - "docker-cf-build.sh + app/wrangler.jsonc (runbook deploy 89-03/92-04)"
provides:
  - "Deploy Cloudflare LIVE (9aba6a1a-748e-457f-98b8-4641b6d2f82a) — arrastra 94-01/02/03"
  - "Gate BrowserOS 'comprensible' corrido sobre el deploy real con evidencia DOM (4 sujetos LOCKED)"
  - "SC#1 (backfill dos-etapas) declarado cerrado por Phase 93 — no repetido"
affects:
  - "Fase 94 CERRADA: agenda por día tz-Chile + filtros periodista + cobertura declarada + 2 fixes de ficha LIVE en producción"
tech-stack:
  added: []
  patterns:
    - "build OpenNext Docker node:22-slim con fuente staged a NTFS local (C:/Temp) — evita la lentitud del bind mount sobre OneDrive (tar de /host tardaba indefinidamente)"
    - "deploy desde staging: wrangler del host + --config al wrangler.jsonc staged (los symlinks pnpm del bundle Linux se rompen al copiar a OneDrive; NTFS los preserva)"
    - "gate DOM-first sobre el deploy real vía flight RSC decodificado + REST embed + psql PROD cuando el MCP BrowserOS no está expuesto al ejecutor (cláusula de degradación del plan)"
    - "conteos derivados vivos: el banner (164/9sem) y 'En tabla de sala 3 veces' reflejan el dato real al render, no cifras congeladas"
key-files:
  created:
    - ".planning/phases/94-agenda-p2e-agenda-por-d-a-filtros-periodista-gate-browsero/94-BROWSEROS-GATE.md"
  modified: []
decisions:
  - "Deploy ejecutado por el AGENTE (Docker + wrangler OAuth disponibles, precedente 89-03/91-03/92-04); versión 9aba6a1a registrada"
  - "Fuente staged a C:/Temp/obs-build (robocopy) en vez de bind-mount directo de OneDrive: el tar del árbol OneDrive dentro del contenedor no progresaba; NTFS local resolvió build + preservó los symlinks pnpm del bundle Linux"
  - "Gate corrido con evidencia del DOM servido por el deploy real (flight RSC verbatim + REST + psql), NO análisis de código, porque los mcp__browseros__* no resolvían desde el subagente ejecutor — degradación declarada por el plan"
  - "Cold-read humano del operador = HANDOFF (patrón v7/v8), no bloquea el cierre de la pasada"
metrics:
  duration: "~50 min"
  completed: "2026-07-22"
  tasks: 2
  files: 1
---

# Phase 94 Plan 04: Deploy Cloudflare + gate BrowserOS "comprensible" Summary

**One-liner:** Cierre empírico de la Fase 94: el sitio se despliega a Cloudflare
(**`9aba6a1a`**, OpenNext build en Docker Linux + wrangler OAuth) arrastrando la pasada
agenda (banner de cobertura declarada + island de filtros de periodista + día tz-Chile + los
2 fixes de ficha), y el gate "comprensible" (criterio LOCKED) se corre sobre el DEPLOY REAL
con evidencia DOM sobre los 4 sujetos: **W26** (53 citaciones en 3 días tz-Chile, ambas
cámaras), **vigente W30** (banner 4 celdas con Cámara derivada 164/9sem, island con counts
honestos, cancelación sobria sin destructive), **18193-06** ("Citado el 21 jul 2026 en de
Economía (sesión pasada)" — gap #1 FIXED, antes 0), **13665-07** ("En tabla de sala 3 veces"
con links a W30/W29/W28 — gap #2 FIXED, antes 0). Veredicto: **COMPRENSIBLE**. SC#1 (backfill
dos-etapas) declarado cerrado por Phase 93.

## What Was Built

### Task 1 — Build + deploy Cloudflare + registrar versión
- **Precondición verificada:** suite app **1206/1206 verde** (92 files); `tsc --noEmit` exit 0.
- **Build:** OpenNext en Docker `node:22-slim` (Linux — Windows rompe el worker, MEMORY).
  Fuente staged a `C:/Temp/obs-build` con robocopy (NTFS local, excluye node_modules/.git/
  .next/.open-next/.wrangler). `pnpm install --no-frozen-lockfile` + `pnpm rebuild esbuild
  workerd` + `opennextjs-cloudflare build` → `Worker saved in .open-next/worker.js`. El bundle
  Linux (con symlinks pnpm) se copió a un mount NTFS separado (`/open-next-out`).
- **Deploy:** `wrangler deploy --config <staged wrangler.jsonc>` con el wrangler del host
  (4.102.0, OAuth `sanchez.rossi@gmail.com`, scope workers:write). Los symlinks del bundle
  requieren NTFS (copiar a OneDrive los rompe) → se desplegó desde el staging.
  **Versión `9aba6a1a-748e-457f-98b8-4641b6d2f82a`** live en
  `https://observatorio-congreso.thevalis.workers.dev`. `Total Upload 7153.19 KiB / gzip 1512.79 KiB`.
- **Smoke `curl -sI` (HTTP 200):** `/agenda`, `/agenda?semana=2026-W26`, `/proyecto/18193-06`,
  `/proyecto/13665-07` → **200** todos; headers `no-cache, no-store` + `x-opennext: 1` (render
  dinámico → evidencia del worker nuevo, no de una página cacheada).

### Task 2 — Gate BrowserOS "comprensible" sobre el deploy real
Evidencia DOM verbatim en `94-BROWSEROS-GATE.md` para los 4 sujetos LOCKED (+ integridad tz):

- **(a) W26 histórico:** días tz-Chile (Lunes 22 / Martes 23 / Miércoles 24 de junio, es-CL),
  12+19+22 = **53 citaciones** (coincide DB), ambas cámaras, banner + island + leyenda LOCKED,
  0 destructive/red.
- **(b) vigente W30:** nav "Semana 30 · 20 jul–26 jul 2026"; días tz-Chile; chips Senado (67)
  vs Cámara (3) → degradación honesta; **banner 4 celdas** con la celda Cámara-comisiones
  DERIVADA (`164` citaciones / `9` semanas en font-mono, no hardcodeado) + celdas estructurales
  forward-only + intro LOCKED; **island** "Filtrar la agenda" con "Conteos sobre estas N",
  facetas cámara/comisión/rango/boletín, "Esta semana"; **cancelación** "Suspendida"(2)/"Sin
  efecto"(28) en muted, **0 destructive/bg-red/text-red**.
- **(c) 18193-06:** DB PROD = 1 citación 2026-07-21 (de Economía) < hoy 2026-07-22; el REST
  embed devuelve la fila; el DOM del deploy renderiza `<p>Citado el 21 jul 2026 en de Economía
  (sesión pasada)</p>` en `text-muted-foreground`. **Gap #1 CERRADO** (antes "Citado" = 0).
- **(d) 13665-07:** DB PROD = 3 filas de sala Senado (W28/W29/W30), 0 citaciones; el DOM
  declara **"En tabla de sala 3 veces:"** con links petróleo a `/agenda?semana=2026-W30|W29|W28`.
  **Gap #2 CERRADO** (antes "tabla de sala" = 0; el conteo creció 2→3 vivo).
- **(e) tz Chile:** NINGÚN día en UTC — rótulos es-CL sobre día-calendario Chile en W26 y W30
  (mitiga T-94-09 en producción, no sólo en test unitario).

**Veredicto: COMPRENSIBLE** — un periodista entiende qué pasa esta semana, qué está cancelado
y qué cobertura falta, sin leer el código. CIT-03/CIT-04/CIT-05 validados empíricamente en el
deploy real; CIT-02 declarado cerrado por 93.

## SC#1 (backfill dos-etapas) — DECLARADO cerrado por Phase 93

CIT-02 se cerró en Phase 93 (§5/§7 de 93-AUDITORIA + 93-WIRING-EVIDENCIA): backfill acotado
Cámara + runbook masivo LOCAL, dos etapas Fuentes→R2→Supabase. **Esta fase NO re-scrapea ni
re-ingesta** — todos los fixes de 94 operan sobre datos ya en DB (verificado por psql PROD que
los 4 sujetos existían). No repetido aquí.

## Deviations from Plan

**None de tipo Rule 1-4 en el código de la aplicación.** Dos ajustes operativos del runbook de
deploy (infra, no código), declarados como desviación de proceso:

**1. [Rule 3 - Blocking] El bind-mount directo de OneDrive no progresaba en el build Docker**
- **Found during:** Task 1 (primer intento con `docker run -v $(pwd -W):/host`).
- **Issue:** el `tar --exclude … /host` del `docker-cf-build.sh` sobre el árbol montado desde
  OneDrive quedaba indefinidamente en "copying source…" (I/O de OneDrive sobre bind mount).
- **Fix:** stagear la fuente a `C:/Temp/obs-build` (NTFS local) con robocopy y montar ESE dir —
  patrón del `run-docker-build.ps1` de deploys previos (89-03/92-04). El build corrió normal.
- **Files:** ninguno del repo (infra de deploy).

**2. [Rule 3 - Blocking] Los symlinks pnpm del bundle Linux se rompen al copiar a OneDrive**
- **Found during:** Task 1 (al copiar `.open-next` al repo `app/` para deployar desde ahí).
- **Issue:** `cp -r` del bundle (server-functions con symlinks a `node_modules/.pnpm/…`) a la
  carpeta OneDrive falla ("cannot create symbolic link") → bundle roto para wrangler.
- **Fix:** deployar desde el staging NTFS (`wrangler deploy --config <staged wrangler.jsonc>`
  con el wrangler del host), donde los symlinks quedan intactos. El repo `app/.open-next` se
  removió (no se versiona el bundle). Deploy exitoso (`9aba6a1a`).
- **Files:** ninguno del repo.

**3. [Degradación declarada por el plan] MCP BrowserOS no expuesto al subagente ejecutor**
- El plan prevé: "si el MCP BrowserOS está caído: documentar y degradar a evidencia curl del
  SSR". Los `mcp__browseros__*` no resolvían desde el ejecutor. El gate se corrió con evidencia
  del **DOM servido por el deploy real** (flight RSC decodificado verbatim + REST embed exacto
  del worker + psql PROD) — render REAL de producción, no análisis de código. El cold-read
  humano del operador queda como HANDOFF (no bloquea).

## Known Stubs

Ninguno. La pasada agenda está LIVE end-to-end: banner con conteos derivados reales, island
operando sobre el slice real, cancelación desde `citacion.estado` verbatim, los 2 fixes de
ficha leyendo filas reales de DB. Cero mock/placeholder.

## Threat Flags

Ninguno nuevo. El deploy no introduce endpoint/auth path/schema en frontera de confianza fuera
del threat model de la fase. Mitigaciones verificadas en PROD: T-94-08 (banner declara
parcialidad; ningún día vacío se lee como "no hubo actividad") y T-94-09 (días en tz-Chile, no
UTC) confirmadas en el DOM real. T-94-SC (build supply chain): build desde el repo verificado,
wrangler OAuth, cero paquete nuevo.

## Verification

- Deploy LIVE `9aba6a1a` — 4 rutas HTTP 200 (`curl -sI`); render dinámico (no cacheado).
- `94-BROWSEROS-GATE.md` (228 líneas) con evidencia DOM verbatim de los 4 sujetos + veredicto.
- Suite app pre-deploy **1206/1206** verde; `tsc --noEmit` exit 0.
- SC#1 declarado cerrado por Phase 93 (no repetido).
- Veredicto: **COMPRENSIBLE**.

## Self-Check: PASSED

- FOUND: .planning/phases/94-…/94-BROWSEROS-GATE.md
- FOUND commit: dce068d (feat 94-04 deploy + gate)
- LIVE: deploy 9aba6a1a respondiendo 200 en /agenda, /agenda?semana=2026-W26, /proyecto/18193-06, /proyecto/13665-07
