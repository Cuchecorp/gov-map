---
phase: 68-voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros
plan: 02
subsystem: infra
tags: [freshness, cobertura, votos, psql, cli, vitest]

# Dependency graph
requires:
  - phase: 64-67
    provides: "tablas votacion/voto pobladas (estado_vinculo confirmado/probable/no_confirmado, camara diputados/senado)"
provides:
  - "COBERTURA_VOTO_SENALES: array de cobertura del voto individual con denominador propio (sesiones de sala conocidas), separado del corpus"
  - "queryCoberturaVoto: runner psql read-only que reusa psql sin exponer dbUrl"
  - "renderCoberturaVoto + wiring en pnpm freshness: tabla N/M del voto por camara (Camara confirmado / Senado por nombre)"
affects: [voto, cobertura, freshness, VOTO-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Array de cobertura SEPARADO por denominador: cada CoberturaSenalConfig[] tiene su propio esDenominador, evaluateCobertura se reusa sin cambios"
    - "Degradacion honesta a null (NO 0) heredada del runner del corpus"

key-files:
  created: []
  modified:
    - packages/freshness/src/catalog.ts
    - packages/freshness/src/query-runner.ts
    - packages/freshness/src/cli.ts
    - packages/freshness/src/evaluate.test.ts

key-decisions:
  - "Opcion 2 (RESEARCH Open Question 1): array COBERTURA_VOTO_SENALES + renderCoberturaVoto separados en vez de extender evaluateCobertura — NO toca la semantica de denominador unico (proyecto) del corpus de busqueda"
  - "Denominador del voto = count(DISTINCT votacion.id) (sesiones/votaciones ingeridas), NO proyecto"
  - "Numerador Camara = sesiones diputados con >=1 voto estado_vinculo='confirmado' (determinista); Senado = sesiones con voto probable/no_confirmado (por nombre, techo honesto) — probable/no_confirmado NUNCA se cuenta como confirmado"
  - "evaluateCobertura se reusa TAL CUAL: funciona porque el array de voto marca su propio esDenominador"

patterns-established:
  - "Cobertura multi-denominador via arrays separados (no un evaluateCobertura multi-grupo)"

requirements-completed: [VOTO-05]

# Metrics
duration: ~12min
completed: 2026-07-14
---

# Phase 68 Plan 02: Cobertura del voto individual en `pnpm freshness` Summary

**`pnpm freshness` declara ahora la cobertura del voto individual N/M por cámara (Cámara confirmado determinista / Senado por nombre) como señal separada con denominador propio (sesiones de sala conocidas), sin romper la semántica del corpus de búsqueda, con degradación honesta a `n/d`.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-14T01:47:00Z
- **Completed:** 2026-07-14T01:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `COBERTURA_VOTO_SENALES` añadido como array **separado** de `CoberturaSenalConfig[]` con denominador propio (`sesiones` = `count(DISTINCT votacion.id)`) y dos numeradores por cámara (Cámara `confirmado` determinista, Senado por nombre `probable/no_confirmado`). `COBERTURA_SENALES` (corpus, denominador único `proyecto`) intacto.
- `queryCoberturaVoto(dbUrl)` reusa el `psql` read-only existente (nunca imprime dbUrl/password) y degrada honestamente a `null` (NO 0) cuando un count no se pudo leer.
- `renderCoberturaVoto` + wiring en el `main`: el operador ve la tabla "Cobertura del voto individual (VOTO-05)" **además** de la del corpus (append, no reemplazo). `--json` expone `coberturaVoto`.
- Tests de lógica pura en `evaluate.test.ts`: ambas cámaras, techo por causa (Senado como techo honesto, no atribución), degrade a `null`, denominador 0 → pct `null`, y aserción de SQL 100% estático.

## Task Commits

1. **Task 1: COBERTURA_VOTO_SENALES + queryCoberturaVoto** - `16bffe1` (feat, TDD RED→GREEN en un commit: test + array + runner)
2. **Task 2: renderCoberturaVoto + wiring en el main** - `1562f16` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/freshness/src/catalog.ts` - Añadido `COBERTURA_VOTO_SENALES` (array separado, denominador `sesiones`, numeradores `camara`/`senado`) tras `COBERTURA_SENALES` (sin tocarlo).
- `packages/freshness/src/query-runner.ts` - Añadido `queryCoberturaVoto` (espejo de `queryCobertura`, mismo `psql`, degrade a null); import de `COBERTURA_VOTO_SENALES`.
- `packages/freshness/src/cli.ts` - Añadido `renderCoberturaVoto` + wiring en `main` (queryCoberturaVoto → evaluateCobertura → render → stdout/JSON, append).
- `packages/freshness/src/evaluate.test.ts` - Bloque `describe("evaluateCobertura del voto (VOTO-05)")`: 5 casos (array separado, SQL estático, feliz ambas cámaras, degrade null, denominador 0).

## Decisions Made

- **Opción 2 (RESEARCH Open Question 1 / A1):** array + renderer separados en vez de extender `evaluateCobertura` para agrupar por denominador — menos acoplamiento, no toca la lógica del corpus. `evaluateCobertura` se reusa tal cual porque el array de voto marca su propio `esDenominador`.
- **Denominador = `count(DISTINCT votacion.id)`** (universo de sesiones/votaciones ingeridas de ambas cámaras), no `proyecto`.
- **Honestidad del linking:** Cámara filtra SOLO `estado_vinculo='confirmado'` (determinista por DIPID); Senado usa `probable/no_confirmado` y se etiqueta "voto por nombre / techo honesto", nunca "confirmado". `probable/no_confirmado` no se presenta como voto atribuido en la Cámara.

## Deviations from Plan

None - plan executed exactly as written. Nota menor: el script `build` no existe en el paquete `@obs/freshness` (solo `test` y `typecheck`); el `<verify>` de la Task 1 mencionaba `pnpm build`, se sustituyó por `pnpm --filter @obs/freshness typecheck` (equivalente, verifica compilación TS). No es una desviación de código.

## Issues Encountered

- El `<verify>` de la Task 1 (`pnpm build`) no aplica: el paquete no define `build`. Se usó `typecheck` (`tsc -b`) + `test` en su lugar. Sin impacto en el resultado.

## User Setup Required

None - no external service configuration required. (La corrida `pnpm freshness` es read-only y usa `SUPABASE_DB_URL` ya presente en `.env`.)

## Verification

- `pnpm --filter @obs/freshness test` → **20 tests verdes** (15 previos + 5 nuevos de voto).
- `pnpm --filter @obs/freshness typecheck` → limpio.
- `git grep COBERTURA_VOTO_SENALES packages/freshness/src` → matches en catalog + query-runner + cli (+ test).
- **`pnpm freshness` en vivo (DB real):** imprimió la tabla "Cobertura del voto individual (VOTO-05)" además del corpus — 4731 sesiones conocidas, Cámara 3765 (80%) confirmado, Senado 963 (20%) por nombre. Exit 1 es el contrato normal de freshness (una fuente `lobby-leylobby` está STALE), no un fallo de esta feature.

## Next Phase Readiness

- Mitad-freshness de VOTO-05 cumplida. La mitad-UI de VOTO-05 (nota N/M + techo por causa en `VotosView`) se cubre en otro plan de la fase 68 (68-03 podó el carril; la nota UI ya existe `COBERTURA_BAJA_UMBRAL`).
- Sin blockers introducidos. La señal degrada honestamente si la DB no responde.

## Self-Check: PASSED

- Files verified present: catalog.ts, query-runner.ts, cli.ts, evaluate.test.ts, 68-02-SUMMARY.md
- Commits verified in git log: `16bffe1` (Task 1), `1562f16` (Task 2)

---
*Phase: 68-voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros*
*Completed: 2026-07-14*
