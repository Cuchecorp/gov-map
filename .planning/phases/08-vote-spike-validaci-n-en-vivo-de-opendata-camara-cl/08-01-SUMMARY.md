---
phase: 08-vote-spike-validaci-n-en-vivo-de-opendata-camara-cl
plan: 01
subsystem: testing
tags: [spike, votos, camara, opendata, deterministic-mapping, live-validation, vitest]

# Dependency graph
requires:
  - phase: 05 (Tramitación Cámara/Senado)
    provides: CamaraConnector + parseCamaraVotacion + parseCamaraVotoDetalle + reconciliarVotosCamara + fixture real
  - phase: 03 (Identidad determinista)
    provides: maestra parlamentario.seed.json con id_diputado_camara (155 diputados)
provides:
  - "Decisión binaria VOTE-01: CONFIRMAR — construir Phase 10 tal cual"
  - "Validación LIVE de opendata.camara.cl getVotacion_Detalle (DIPID+Opcion no null, mapeo 100%)"
  - "Spike throwaway packages/votos (gate vitest offline+LIVE-gated)"
affects: [phase-10-votos, vote-block]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spike confirm-or-replan que reusa símbolos v1.0 verbatim (cero código de producción nuevo)"
    - "Gate vitest mitad-offline-siempre-verde + mitad-LIVE-gated por env (VOTE_SPIKE_LIVE=1)"

key-files:
  created:
    - packages/votos/spike/spike.ts
    - packages/votos/spike/spike.test.ts
    - packages/votos/package.json
    - packages/votos/tsconfig.json
    - packages/votos/vitest.config.ts
    - .planning/phases/08-vote-spike-validaci-n-en-vivo-de-opendata-camara-cl/08-SUMMARY.md
  modified:
    - .planning/STATE.md
    - pnpm-lock.yaml

key-decisions:
  - "Phase 8 VOTE spike CONFIRMÓ: getVotacion_Detalle entrega DIPID+Opcion no-null, totales reconcilian, DIPID mapea a id_diputado_camara al 100% en la muestra Leg-58 — construir Phase 10 tal cual"
  - "El allowlist NO requiere edición: camara.cl ya está como sufijo, opendata.camara.cl pasa el guard SSRF"

patterns-established:
  - "Spike desechable: paquete fuera del build graph raíz (tsc -b no lo referencia), sin src/ de producción"
  - "LIVE-gated test verbatim del patrón llm/smoke.test.ts: (LIVE ? describe : describe.skip)"

requirements-completed: [VOTE-01]

# Metrics
duration: ~12min
completed: 2026-06-19
---

# Phase 8 Plan 01: VOTE Spike Summary

**Spike confirm-or-replan que validó EN VIVO `opendata.camara.cl/getVotacion_Detalle`: voto por diputado con DIPID+Opcion no null, totales reconciliados y mapeo determinista DIPID→id_diputado_camara al 100% sobre 6 votaciones Leg-58 → DECISIÓN: CONFIRMAR.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-19T03:20:29Z
- **Completed:** 2026-06-19T03:25:00Z (aprox)
- **Tasks:** 2 (Task 1 auto/tdd + Task 2 checkpoint LIVE)
- **Files modified:** 8

## Accomplishments
- Paquete spike throwaway `packages/votos` que reusa los símbolos v1.0 de `@obs/tramitacion` verbatim (sin reimplementar fetch/parse/cruce, sin `BaseConnector.run`, sin tocar Supabase/R2).
- Gate vitest: mitad offline siempre verde sobre el fixture real (58 si / 81 no, DIPID 815 confirmado) + mitad LIVE-gated por `VOTE_SPIKE_LIVE=1`.
- Corrida LIVE deliberada ejecutada con éxito contra el WAF gubernamental: 6 votaciones, 8 requests, 0 errores, mapeo 100%, totales reconciliados.
- FINDINGS + decisión binaria CONFIRMAR registrados en `08-SUMMARY.md` y `STATE.md`.

## Task Commits

1. **Task 1: Spike desechable + gate vitest** - `a444ae3` (test)
2. **Task 2: Corrida LIVE + FINDINGS + decisión binaria** - docs (este SUMMARY + 08-SUMMARY.md + STATE.md, en el commit de metadata)

_La corrida LIVE no produce código; su deliverable es la decisión registrada._

## Files Created/Modified
- `packages/votos/spike/spike.ts` - `runSpike` ensambla CamaraConnector con la política LOCKED de @obs/ingest, tira la muestra, reconcilia, imprime FINDINGS.
- `packages/votos/spike/spike.test.ts` - gate offline (fixture real) + LIVE-gated (4 criterios VOTE-01).
- `packages/votos/{package.json,tsconfig.json,vitest.config.ts}` - manifest throwaway (workspace deps, fuera del build graph raíz).
- `.planning/.../08-SUMMARY.md` - FINDINGS conciso + decisión binaria (deliverable de la fase).
- `.planning/STATE.md` - decisión + cierre del blocker del gate Phase 8.

## Decisions Made
- **CONFIRMAR** (no replanificar): los 4 criterios de VOTE-01 pasan sobre la muestra Leg-58. Ver `08-SUMMARY.md` para la evidencia (tabla por votación).
- Spike fuera del `tsc -b` graph raíz para mantenerlo throwaway sin contaminar el typecheck del monorepo.

## Deviations from Plan

None - plan executed exactly as written. El allowlist no requirió edición (confirmando el hallazgo de RESEARCH: `camara.cl` ya es sufijo permitido).

## Issues Encountered
None. La corrida LIVE respondió tras el WAF sin 429 ni RetryableError; el delay 2–3s LOCKED se reflejó en las latencias (306–3361ms).

## User Setup Required
None - el spike es solo lectura sobre un endpoint público; no requiere secretos ni configuración externa.

## Next Phase Readiness
- **Phase 10 (`@obs/votos` producción) DESBLOQUEADA**: construir tal cual el spike confirmó (conector + modelo de voto + reconciliación + ficha).
- El paquete `packages/votos` es throwaway; Phase 10 lo reemplaza con código de producción (`src/`, modelo, migración).
- Phase 9 (Identidad) puede correr en paralelo (VOTE Cámara usa DIPID, no RUT).

## Self-Check: PASSED

---
*Phase: 08-vote-spike-validaci-n-en-vivo-de-opendata-camara-cl*
*Completed: 2026-06-19*
