---
phase: 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-
plan: 03
subsystem: agenda / ingesta (auditoría + backfill acotado)
tags: [auditoria, cobertura, citaciones, backfill, r2, dos-etapas, runbook, gate-94]

requires:
  - phase: 93-01
    provides: "93-AUDITORIA-CITACIONES.md §1-4 (matriz N/M, veredictos endpoints, hallazgos, frescura) + rango real de la celda Cámara"
  - phase: 93-02
    provides: "93-WIRING-EVIDENCIA.md (gaps de wiring #1/#2 con evidencia DOM PROD + causa raíz)"
provides:
  - "Backfill ACOTADO de citaciones Cámara W20-W24 corrido por dos-etapas (34→164 citaciones, 2→6 semanas ISO), Etapa 1 R2 crudo content-addressed"
  - "Etapa 1 R2 cableada en ingest-run step 1 (Cámara citaciones HTML) — espejo del patrón sala-PDF step 4"
  - "93-BACKFILL-CITACIONES-RUNBOOK.md (runbook operador-LOCAL del masivo histórico, espejo 66/67/70)"
  - "93-AUDITORIA-CITACIONES.md CERRADO (7 secciones): §5 backfill, §6 gaps wiring, §7 DECLARACIÓN de cobertura por celda"
affects:
  - "Phase 94 (fix UI /agenda + ficha): consume la DECLARACIÓN de cobertura por celda (§7) como banner/leyenda; los gaps de wiring (§6) como fixes; el runbook + --from-r2 pendiente como trabajo futuro"

tech-stack:
  added: []
  patterns:
    - "Etapa 1 R2 en step 1 de ingest-run: fetchSemanaBytes → putImmutable(camara/citaciones-semana, sha256, html) gateado r2Enabled, best-effort (un fallo R2 no aborta Etapa 2)"
    - "Backfill acotado por el agente (precedente 90-03/92-04) con counts N antes/después por psql; masivo histórico = runbook operador-LOCAL"
    - "CLI de agenda desde la RAÍZ del repo (./node_modules/.bin/tsx) para que loadEnv(process.cwd()) encuentre el .env — pnpm --filter exec rompe el cwd"

key-files:
  created:
    - .planning/phases/93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-/93-BACKFILL-CITACIONES-RUNBOOK.md
    - .planning/phases/93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-/93-03-SUMMARY.md
  modified:
    - packages/agenda/src/connector-camara.ts
    - packages/agenda/src/ingest-run.ts
    - packages/agenda/src/ingest-run.test.ts
    - .planning/phases/93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-/93-AUDITORIA-CITACIONES.md

key-decisions:
  - "Rango acotado = 2026-W20…W24 (5 semanas contiguas hacia atrás de W26, histórico confirmado por Probe 4b); W22 devolvió 0 citaciones (semana honesta, no error) → 4 semanas ISO nuevas"
  - "Etapa 1 R2 (MAJOR-1 LOCKED del orquestador) cableada solo en Cámara citaciones (paso 1) + tabla-sala PDF (paso 4 ya existía); Senado (pasos 2-3) sin R2 (API forward-only sin histórico) — declarado en reporte y runbook"
  - "--from-r2 para citaciones NO existe hoy (MAJOR-2): la cláusula --from-r2 de SC#3 la satisface el runbook futuro (94/operador), no esta fase; solo la mitad fuente→R2 está viva"

patterns-established:
  - "Backfill acotado agente + masivo runbook-LOCAL: la corrida acotada valida el wire dos-etapas; el masivo histórico es acto deliberado del operador"
  - "DECLARACIÓN de cobertura por celda con rango real + regla 'estado ausente ≠ vigente confirmado' como insumo directo del gate de la fase siguiente"

requirements-completed: [CIT-01]

duration: ~35min
completed: 2026-07-22
---

# Phase 93 Plan 03: Cierre de auditoría — backfill acotado dos-etapas + runbook LOCAL + DECLARACIÓN de cobertura Summary

**Backfill acotado de citaciones Cámara W20-W24 (34→164, 2→6 semanas ISO) con Etapa 1 R2 crudo content-addressed cableada en el paso 1 de `ingest-run` (espejo sala-PDF), + runbook operador-LOCAL del masivo histórico, + `93-AUDITORIA-CITACIONES.md` cerrado en 7 secciones con la DECLARACIÓN de cobertura parcial por celda como insumo del gate de 94.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-22T16:57:00Z
- **Completed:** 2026-07-22T17:12:00Z
- **Tasks:** 2
- **Files modified:** 6 (2 creados, 4 modificados)

## Accomplishments

- **Etapa 1 R2 cableada (MAJOR-1 LOCKED):** se agregó `CitacionesCamaraConnector.fetchSemanaBytes` (bytes crudos) y el paso 1 de `ingest-run.ts` persiste el HTML crudo por semana en R2 content-addressed (`camara/citaciones-semana/<fecha>/<sha256>.html`) gateado por `r2Enabled`, best-effort — espejo exacto del patrón sala-PDF (paso 4). 3 tests nuevos (fires / gateado / best-effort). Suite agenda 113 verde + typecheck.
- **Backfill acotado LIVE con dos etapas reales:** dry-run → write de `--desde 2026-W20 --hasta 2026-W24`. Etapa 1 R2 crudo por semana + Etapa 2 upsert PROD idempotente. **N Cámara 34→164 (+130), semanas ISO 2→6** (W20/W21/W23/W24 nuevas; W22=0 honesto). 0 errores, 0 degradaciones. Counts re-medibles por psql (verbatim en §5).
- **Runbook operador-LOCAL del masivo** (`93-BACKFILL-CITACIONES-RUNBOOK.md`, espejo 66/67/70): flags reales, dos-etapas, hash-check, rate-limit 2-3s, gotcha cwd, y la declaración explícita (MAJOR-2) de que `--from-r2` NO existe hoy (extensión de 94).
- **Reporte cerrado (7 secciones):** §5 backfill (rango/comando/counts/alcance R2/--from-r2), §6 gaps wiring (resumen + referencia a 93-WIRING-EVIDENCIA.md, DATOS vs WIRING), §7 DECLARACIÓN de cobertura por celda con rango real + regla "estado ausente ≠ vigente confirmado". Ninguna celda declarada completa.

## Task Commits

1. **Task 1: Backfill acotado Cámara W20-W24 + Etapa 1 R2 en step 1** - `f2fe621` (feat)
2. **Task 2: Runbook LOCAL del masivo + §6 gaps wiring + §7 DECLARACIÓN de cobertura** - `850a55a` (feat)

**Plan metadata:** (docs commit final con SUMMARY/STATE/ROADMAP)

## Files Created/Modified

- `packages/agenda/src/connector-camara.ts` - `fetchSemanaBytes` (bytes crudos para R2); `fetchSemana` ahora decodifica sobre él
- `packages/agenda/src/ingest-run.ts` - paso 1 Cámara citaciones: R2 `putImmutable(camara/citaciones-semana, sha256, html)` gateado + best-effort ANTES del parse/write
- `packages/agenda/src/ingest-run.test.ts` - fake con `fetchSemanaBytes`; 3 tests R2 (fires content-addressed / gateado / best-effort)
- `93-AUDITORIA-CITACIONES.md` - §5 backfill acotado, §6 gaps wiring, §7 DECLARACIÓN de cobertura (7 secciones totales)
- `93-BACKFILL-CITACIONES-RUNBOOK.md` - runbook operador-LOCAL del masivo histórico (nuevo)

## Decisions Made

- **Rango acotado = 2026-W20…W24:** 5 semanas contiguas hacia atrás de W26 (la DB tenía solo W26/W28), todas con histórico confirmado (Probe 4b ya había traído W20). W22 devolvió 0 citaciones — semana genuinamente vacía (fetch 200, no 403), no se fabricó fila → 4 semanas ISO nuevas, no 5.
- **Alcance de R2:** Etapa 1 R2 cableada en Cámara citaciones (paso 1, nuevo) + tabla-sala PDF (paso 4, ya existía). Senado (pasos 2-3) NO va a R2: API JSON forward-only sin histórico → extensión menor de mayor alcance, declarada pendiente en reporte §5 y runbook §7.
- **`--from-r2` inexistente (MAJOR-2):** hoy solo vive la mitad "fuente→R2" del dos-etapas para citaciones; no hay lector que reconstruya la Etapa 2 desde el crudo. La cláusula --from-r2 de SC#3 la satisface el runbook futuro, no esta fase — declarado explícitamente en §5 y en el runbook.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CLI de agenda no cargaba `.env` bajo `pnpm --filter exec` (cwd roto)**
- **Found during:** Task 1 (primer intento de WRITE real)
- **Issue:** `pnpm --filter @obs/agenda exec tsx …` cambia `process.cwd()` al dir del paquete; `loadEnv` lee el `.env` de la RAÍZ → cayó a InMemory writer + `[WARN] R2 no configurado`, escribiendo a ninguna parte (el log decía "DRY-RUN (in-memory)" sin `--dry-run`). Es el bug de `process.cwd()` bajo pnpm ya conocido (MEMORY v8.1).
- **Fix:** correr el CLI desde la RAÍZ del repo con el binario local `./node_modules/.bin/tsx packages/agenda/src/run-agenda-prod-cli.ts …` → cwd = raíz → `.env` cargado → writer PROD + R2 activos. No requirió cambio de código (el CLI ya usa `process.cwd()` por diseño; el fix es de invocación).
- **Files modified:** ninguno (fix de invocación); documentado como gotcha LOCKED en el runbook §1.
- **Verification:** el log de la corrida buena imprime `agenda: writer Supabase PROD (…)` + `HTML crudo en R2 (…)` por semana; counts 34→164 confirmados por psql.
- **Committed in:** parte del flujo de Task 1 (`f2fe621`) vía la sección §5 + runbook §1.

---

**Total deviations:** 1 auto-fixed (1 blocking, sin cambio de código — invocación).
**Impact on plan:** el fix fue necesario para que el backfill escribiera a PROD y a R2; sin scope creep. El gotcha quedó documentado en el runbook para el operador.

## Issues Encountered

- **Zero-width space (U+200B) en el runbook** disparó la alerta de prompt-injection del hook al escribir. Origen benigno: una secuencia `…` en un ejemplo de log. Se detectó y eliminó con un script node (0 chars invisibles restantes) antes de commitear. Sin impacto en contenido.

## User Setup Required

None - el backfill acotado ya corrió a PROD con credenciales de `.env`. El **backfill masivo histórico** es acto operador-LOCAL (runbook `93-BACKFILL-CITACIONES-RUNBOOK.md`) — NO es setup de esta fase, es trabajo opcional del operador/94.

## Next Phase Readiness

- **Insumo del gate de 94 listo:** `93-AUDITORIA-CITACIONES.md` cerrado (7 secciones). §7 DECLARACIÓN de cobertura por celda = banner/leyenda que 94 debe mostrar; §6 gaps wiring #1/#2 = fixes de ficha (WIRING, no cobertura); regla "estado ausente ≠ vigente confirmado" LOCKED.
- **Trabajo pendiente declarado (NO bloquea 93):** (a) `--from-r2` replay para citaciones (lector R2→Supabase, espejo del CLI de votos); (b) R2 en pasos Senado (opcional); (c) backfill masivo histórico Cámara (runbook operador-LOCAL). Todo en el runbook §7.

## Self-Check: PASSED

- FOUND: 93-BACKFILL-CITACIONES-RUNBOOK.md
- FOUND: 93-03-SUMMARY.md
- FOUND: 93-AUDITORIA-CITACIONES.md (7 secciones, §1-7 pobladas)
- FOUND commit f2fe621 (Task 1 — backfill + Etapa 1 R2)
- FOUND commit 850a55a (Task 2 — runbook + §6/§7)
- Verificaciones automatizadas: PASS (agenda suite 113 verde + typecheck; grep run-agenda-prod-cli=7, DECLARACIÓN de cobertura=2, estado ausente=3; N Cámara 34→164 re-medible por psql)

---
*Phase: 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-*
*Completed: 2026-07-22*
