---
phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador
plan: 01
subsystem: testing
tags: [vitest, guard, ci, cr-01, rut, name-match, dinero, static-analysis, mutation-testing]

# Dependency graph
requires:
  - phase: 68-comprension-del-voto
    provides: "molde del guard-como-test (anti-insinuacion-guard.test.ts) + stripTsComments con skip :// + mutation self-check"
provides:
  - "Guard-guardian ESTATICO del corte CR-01 (name-match NUNCA escribe el rut de la maestra) que MUERDE ante refactors rotos"
  - "Companion de COMPORTAMIENTO fail-closed que ejercita reconciliarContrato (0 cosechas name-only / 1 cosecha corroboracion)"
  - "Detector puro detectarViolacionesCorteRut (reusable, testeable) del edge revisionesRut->writer y cosechas.push fuera de corroboracion"
affects: [70-dinero-chilecompra, 71-servel, 72-materializador-lobby-sector, 73-money-gate-legal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard estatico app-side (fs, sin import cross-package) + companion de comportamiento package-side donde el pipeline resuelve"
    - "Detector puro con balance de parentesis/llaves para heuristicas estructurales robustas (dominancia de bloque if)"

key-files:
  created:
    - "app/lib/name-match-rut-guard.test.ts"
    - "packages/dinero/src/name-match-rut-guard.behavior.test.ts"
  modified: []

key-decisions:
  - "El guard app-side es ESTATICO (fs, espejo de lockdown/anti-insinuacion); el COMPORTAMIENTO vive en packages/dinero porque app NO depende de @obs/dinero (decoupling frontend<->pipeline, CLAUDE.md)"
  - "Detector cubre DOS clases de violacion: (A) revisionesRut como CUALQUIER argumento de runBackfillRut/runHarvestRut/updateRut; (B) cosechas.push fuera del bloque if(rutMaestra===rutNorm)"
  - "Mutation self-check probado contra el archivo REAL (2 cortes rotos inyectados -> guard falla, restaurado -> verde), no solo contra fixtures en memoria"

patterns-established:
  - "Guard bifurcado app(estatico)+package(comportamiento) cuando el frontend no puede importar el paquete que ejercita la logica"
  - "extraerArgumentos/pushDominadoPorCorroboracion: balance de delimitadores para dominancia sintactica sin AST"

requirements-completed: [RUT-01]

# Metrics
duration: ~35min
completed: 2026-07-14
---

# Phase 69 Plan 01: Guard-guardian name-match≠write-rut (CR-01) Summary

**Guard-guardian que congela el corte estructural "un name-match NUNCA escribe el `rut` de la maestra": estático (fs, mutation self-check probado contra el archivo real) en `app/lib/` + companion de comportamiento fail-closed que ejercita `reconciliarContrato` en `packages/dinero/`.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-14T02:38Z (approx)
- **Completed:** 2026-07-14T02:52Z (approx)
- **Tasks:** 1 (tdd)
- **Files modified:** 2 created (0 source files touched)

## Accomplishments

- **Guard ESTÁTICO** (`app/lib/name-match-rut-guard.test.ts`, 15 tests): espejo verbatim de `lockdown-guard`/`anti-insinuacion-guard` (stripTsComments con skip `://`, walkSourceFiles, SKIP_DIRS, APP_ROOT/REPO_ROOT). Detector puro `detectarViolacionesCorteRut` que aserta sobre `packages/dinero/src` + `packages/identity/src`: (A) `revisionesRut` NUNCA como argumento de `runBackfillRut`/`runHarvestRut`/`updateRut`; (B) todo `cosechas.push` dentro del bloque `if (rutMaestra === rutNorm)` (corroboración).
- **Mutation self-check que MUERDE**: 5 tests contra fixtures en memoria + **probado contra el archivo real** — inyecté 2 clases de corte roto (`runBackfillRut(revisionesRut, writer)` y `cosechas.push` fuera de la corroboración) y confirmé que el guard FALLA (3 y 2 tests rojos respectivamente), luego restauré → verde. No es un no-op verde.
- **Companion de COMPORTAMIENTO** (`packages/dinero/src/name-match-rut-guard.behavior.test.ts`, 3 tests): ejercita `reconciliarContrato` real con `MockMiniMaxProvider`. Fail-closed real: name-only (maestra sin rut coincidente) → `cosechas.length===0` + `revisionesRut.length===1`; namesake-collision → 0 cosechas + rut real no sobreescrito; corroboración (maestra ya tiene el rut, RUT-exacto fail-closed por 2 filas + nombre resuelve a una) → `cosechas.length===1`.
- **Cero modificación de código de producción**: `reconciliar-contrato.ts` y `harvest-rut.ts` intactos (el guard los PROTEGE). No se añadió `rut` a ninguna superficie pública (guard B de lockdown ya lo cubre).

## Task Commits

1. **Task 1: Guard-guardián name-match≠write-rut (comportamiento + estático) con mutation self-check** - `d707694` (test)

_TDD plan: los dos archivos de test se crearon y verificaron juntos; la garantía RED/GREEN se cumple vía el mutation self-check (probado que el guard falla ante el corte roto y pasa ante el árbol correcto)._

## Files Created/Modified

- `app/lib/name-match-rut-guard.test.ts` - Guard estático (fs) + mutation self-check + no-falsos-positivos; detector puro `detectarViolacionesCorteRut` con `extraerArgumentos`/`pushDominadoPorCorroboracion`; corre en la suite de `app` (776 tests).
- `packages/dinero/src/name-match-rut-guard.behavior.test.ts` - Companion fail-closed que ejercita `reconciliarContrato` (name-only → 0/1; corroboración → 1); corre en la suite de `dinero` (100 tests).

## Decisions Made

- **Guard bifurcado estático+comportamiento (deviation Rule 4 → architecture-preserving default).** El plan nombraba UN solo archivo (`app/lib/name-match-rut-guard.test.ts`) con test estático + comportamiento importando `reconciliarContrato`. Pero `app` NO depende de `@obs/dinero`/`@obs/adjudication`/`@obs/core` (CLAUDE.md: el frontend lee de Supabase; la ingesta vive en packages/Edge), y esos paquetes no están symlinkeados en `app/node_modules` — vitest de `app` no resuelve `@obs/dinero`. Añadir la dependencia habría acoplado el frontend al pipeline y requerido `pnpm install` (offline/sequential, prohibido). Resolución que preserva la arquitectura Y satisface la regla crítica: el guard estático + mutation vive en `app/lib/` (espejo de sus hermanos, fs-only); el test de COMPORTAMIENTO fail-closed vive en `packages/dinero/src/` donde `reconciliarContrato` resuelve nativamente. El guard estático de app aserta la EXISTENCIA + contenido del companion (link_key) para que el corte nunca quede solo-estático sin cobertura de comportamiento.
- **Detector cubre `revisionesRut` como CUALQUIER argumento** (no solo el primero): balance de paréntesis para extraer la lista completa de argumentos de cada llamada a writer, tolerando args anidados (`construirFilas(x)`).

## Deviations from Plan

### Auto-fixed / Architectural

**1. [Rule 4 - Architectural, resuelto sin STOP] Guard bifurcado en 2 archivos (app estático + dinero comportamiento)**
- **Found during:** Task 1 (al correr `pnpm --filter ./app test`)
- **Issue:** El plan pedía un único `app/lib/name-match-rut-guard.test.ts` con test estático + de comportamiento importando `reconciliarContrato` de `@obs/dinero`. `app` no declara ni resuelve `@obs/dinero`/`@obs/adjudication`/`@obs/core` (frontend decoupled del pipeline por CLAUDE.md); vitest falló con `Failed to resolve import "@obs/adjudication"`.
- **Fix:** Mantener el guard estático + mutation self-check en `app/lib/` (fs, sin import cross-package, espejo exacto de `lockdown-guard`/`anti-insinuacion-guard`) y mover el test de COMPORTAMIENTO a `packages/dinero/src/name-match-rut-guard.behavior.test.ts`, donde el paquete resuelve. El guard de app aserta la presencia y el contenido del companion. Ambos congelan el mismo corte CR-01.
- **Files modified:** `app/lib/name-match-rut-guard.test.ts` (estático), `packages/dinero/src/name-match-rut-guard.behavior.test.ts` (comportamiento, nuevo)
- **Verification:** app suite 776/776 verde (incluye 15 tests del guard); dinero suite 100/100 verde (incluye 3 tests del companion); mutation self-check probado contra el archivo real (guard falla ante 2 cortes rotos, verde tras restaurar).
- **Committed in:** `d707694`

**2. [Rule 1 - Bug] Detector no cazaba `revisionesRut` como argumento anidado/2.º**
- **Found during:** Task 1 (mutation self-check Test 5: `runBackfillRut(construirFilas(x), revisionesRut)`)
- **Issue:** El regex inicial `writer\(\s*(?:[A-Za-z0-9_.]+\s*,\s*)*revisionesRut` no matcheaba cuando un argumento previo contenía paréntesis/espacios (`construirFilas(x)`), dejando pasar un `revisionesRut` en 2.ª posición anidada → falso negativo del guard.
- **Fix:** Reescribí la rama (A) para extraer la lista de argumentos completa de cada llamada a writer con `extraerArgumentos` (balance de paréntesis) y buscar el token `revisionesRut` con límite de palabra en cualquier posición.
- **Files modified:** `app/lib/name-match-rut-guard.test.ts`
- **Verification:** el test de mutación `runBackfillRut(construirFilas(x), revisionesRut)` ahora reporta offender; suite app verde.
- **Committed in:** `d707694` (parte del commit de Task 1)

---

**Total deviations:** 2 (1 architectural resuelto sin STOP, 1 bug del detector auto-fixed)
**Impact on plan:** Ambos necesarios para que el guard sea correcto y honre la arquitectura frontend↔pipeline. Los must_haves del plan (behavioral + static + mutation self-check, ≥120 líneas, `reconciliarContrato` ejercitado, cero `revisionesRut→writer`) se cumplen todos — solo cambió la DISTRIBUCIÓN en 2 archivos. Sin scope creep; cero código de producción tocado.

## Issues Encountered

- **`@obs/*` no resoluble desde `app` vitest:** ver Deviation 1. Resuelto sin `pnpm install` (offline) partiendo el guard.
- **Corroboración: `cosechas.push` sólo se activa en un borde:** el paso 2 (RUT-exacto) confirma antes de llegar a la rama harvest en el caso común, así que para el test 4 de comportamiento se construyó el borde exacto (2 filas comparten el RUT → RUT-exacto fail-closed → nombre resuelve a una cuyo rut coincide → 1 cosecha). Coherente con el comentario del código en `reconciliar-contrato.ts:373-375`.

## User Setup Required

None - no external service configuration required. (El write remoto a la maestra vía db-url es checkpoint de operador en Plan 69-03, no aquí.)

## Next Phase Readiness

- El corte name-match≠write-rut queda CONGELADO contra refactors (estático + comportamiento + mutation que muerde). Listo para 69-02 (señal de cobertura N/M de RUT DV-válido) y 69-03 (runbook del write remoto + checkpoint operador).
- Sin blockers introducidos. El checkpoint de operador RUT-01 (write remoto) sigue siendo el bloqueante duro de todo P5, intacto.

## Self-Check: PASSED

- FOUND: `app/lib/name-match-rut-guard.test.ts` (477 líneas, ≥120 ✓)
- FOUND: `packages/dinero/src/name-match-rut-guard.behavior.test.ts`
- FOUND: `.planning/phases/69-.../69-01-SUMMARY.md`
- FOUND commit: `d707694`
- app suite 776/776 verde; dinero suite 100/100 verde; mutation self-check probado contra el archivo real (falla ante corte roto, verde tras restaurar).

---
*Phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador*
*Completed: 2026-07-14*
