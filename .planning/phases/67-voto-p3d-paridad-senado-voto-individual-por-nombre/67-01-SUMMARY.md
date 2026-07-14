---
phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre
plan: 01
subsystem: api
tags: [voto, senado, dos-etapas, from-r2, votXmlSenado, mapSeleccion, VOTO-01, replay]

# Dependency graph
requires:
  - phase: 66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt
    provides: wire dos-etapas R2 (envelope crudo + --from-r2 replay + CR-01 fail-closed)
provides:
  - "votXmlSenado en el envelope R2 (Etapa 1): el crudo de votaciones.php del Senado queda persistido y reconstruible"
  - "senadoFake.fetchVotaciones() sirve envelope.votXmlSenado en --from-r2 (run-camara-votos.ts + ingest-cli.ts): el replay reconstruye los votos del Senado en vez de descartarlos"
  - "mapSeleccion fail-loud: un token <SELECCION> desconocido LANZA con el token exacto (no se omite el voto en silencio)"
  - "tests offline: replay Senado reconstruye seq:<n> sin fetch; D-A1 ambos lados (único→confirmado, ausente→no_confirmado); retro-compat envelopes P66; token desconocido→throw"
affects: [68-voto-ficha-ciudadana, backfill-senado-live, phase-68]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Envelope R2 sincronizado en 3 sitios (ingest-run producer + run-camara-votos consumer + ingest-cli consumer): añadir un campo requiere tocar los tres"
    - "Fail-loud en frontera de fuente untrusted: token desconocido lanza (visible en errores) en vez de omitir en silencio (mentira de cobertura)"

key-files:
  created: []
  modified:
    - packages/tramitacion/src/ingest-run.ts
    - packages/tramitacion/src/ingest-cli.ts
    - packages/votos/src/run-camara-votos.ts
    - packages/votos/src/run-camara-votos.test.ts
    - packages/tramitacion/src/parse-senado-votacion.ts
    - packages/tramitacion/src/parse-senado-votacion.test.ts

key-decisions:
  - "D-A1 preservado: reconciliar-senado.ts NO se tocó (git diff vacío); determinista único → confirmado sigue siendo legítimo (paridad Cámara), solo ambiguo/homónimo → probable/no_confirmado"
  - "D-A4: token <SELECCION> presente-pero-desconocido LANZA con el token crudo; vacío/ausente sigue omitiéndose (distinción de 3 casos en mapSeleccion)"
  - "ingest-cli.ts sincronizado además de los 2 sitios del plan (comparte el envelope shape que produce ingest-run.ts): su senadoFake también sirve votXmlSenado"

patterns-established:
  - "Retro-compat de envelope: campo nuevo opcional (?? '') → envelopes viejos (P66) no rompen el replay, solo reconstruyen 0 votos Senado"
  - "TDD RED→GREEN por task: test que falla antes del fix (0 votos reconstruidos / token no lanza) y pasa después"

requirements-completed: [VOTO-01]

# Metrics
duration: ~20min
completed: 2026-07-14
---

# Phase 67 Plan 01: VOTO P3d — Paridad Senado (voto individual por nombre) Summary

**El replay `--from-r2` ahora RECONSTRUYE los votos del Senado desde `votXmlSenado` en el envelope R2 (antes los descartaba), y `mapSeleccion` falla ruidoso ante un token `<SELECCION>` desconocido en vez de omitir el voto en silencio.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-14T00:33:00Z
- **Completed:** 2026-07-14T00:38:00Z
- **Tasks:** 2 (ambos TDD)
- **Files modified:** 6

## Accomplishments

- **Cerrado el ÚNICO gap real de wiring de la paridad Senado (Pitfall 1):** el envelope R2 de la Etapa 1 (`ingest-run.ts`) ahora guarda `votXmlSenado` (el crudo de `votaciones.php`), y el `senadoFake.fetchVotaciones()` del modo `--from-r2` lo sirve (`run-camara-votos.ts` + `ingest-cli.ts`). Un backfill Senado que persiste crudo a R2 es ahora RECONSTRUIBLE por `--from-r2` — se honra la regla LOCKED "R2 = verdad cruda reconstruible; re-ingestar SIEMPRE desde R2", extendida al path Senado.
- **`mapSeleccion` fail-loud (D-A4):** un token `<SELECCION>` presente pero desconocido ("A FAVOR", un código numérico) LANZA con el token crudo exacto en el mensaje (se registra en `errores` de `runIngest` paso 4, no aborta el boletín) en vez de tragar el voto en silencio — una mentira de cobertura. `<SELECCION>` vacío/ausente distinguido (se omite, no lanza).
- **D-A1 verificado sin tocar el reconciliador:** `reconciliar-senado.ts` con `git diff` VACÍO; un test asserta ambos lados — nombre único en la maestra → `confirmado` + `parlamentario_id` poblado; nombre ausente → `no_confirmado`, FK null, NUNCA `confirmado`.
- **Retro-compatibilidad:** un envelope viejo (P66) sin `votXmlSenado` no rompe el replay — reconstruye 0 votos Senado sin lanzar (`?? ""`).

## Task Commits

Cada task se commiteó atómicamente:

1. **Task 1: votXmlSenado en el envelope + senadoFake lo sirve** - `6ce469d` (feat, TDD RED→GREEN en un commit)
2. **Task 2: mapSeleccion fail-loud ante token desconocido (D-A4)** - `c4d4529` (feat, TDD RED→GREEN en un commit)

_Nota: cada task siguió el ciclo RED (test falla) → GREEN (fix) verificado antes del commit; ambos consolidados en un commit `feat` por task._

## Files Created/Modified

- `packages/tramitacion/src/ingest-run.ts` - Captura `votXmlSenadoCrudo` (crudo `votaciones.php`) ANTES del parse en el paso 4 y lo añade al envelope de la Etapa 1.
- `packages/tramitacion/src/ingest-cli.ts` - Envelope type gana `votXmlSenado`; su `senadoFake.fetchVotaciones()` sirve el crudo (sincronización del 3.er sitio del shape).
- `packages/votos/src/run-camara-votos.ts` - Envelope type parseado gana `votXmlSenado`; `senadoFake.fetchVotaciones()` cambia de `return ""` a `return envelope.votXmlSenado ?? ""`.
- `packages/votos/src/run-camara-votos.test.ts` - `interface Envelope` gana `votXmlSenado`; fixture `votaciones.php` no vacío + maestra Senado; Tests F/G/H (replay reconstruye seq:<n>, D-A1 ambos lados, retro-compat).
- `packages/tramitacion/src/parse-senado-votacion.ts` - `mapSeleccion` distingue 3 casos (vacío→null, conocido→Seleccion, desconocido→throw con token crudo); comentario del caller actualizado.
- `packages/tramitacion/src/parse-senado-votacion.test.ts` - Tests D-A4 (token desconocido lanza con el token; vacío/ausente no lanza; conocidos mapean sin regresión); reemplaza el test WR-03 que asertaba omisión silenciosa del token garbled.

## Decisions Made

- **D-A1 (LOCKED):** preservada la rama `determinista → confirmado` del reconciliador (paridad Cámara VOTO-03). NO se degradó a `probable`. El invariante se VERIFICA con un test que asserta ambos lados, con `git diff` vacío en `reconciliar-senado.ts` como gate.
- **D-A4:** `mapSeleccion` fail-loud ante token desconocido. El test WR-03 anterior (que asertaba que `???` se omite en silencio) se reemplazó por los tests D-A4 — el nuevo comportamiento es que un token no-vacío desconocido LANZA. Vacío/ausente sigue omitiéndose (WR-03 en su parte legítima se mantiene: nunca se coacciona a 'abstencion').
- **ingest-cli.ts sincronizado (más allá del plan literal):** el plan menciona los 2 sitios de `ingest-run.ts`/`run-camara-votos.ts` y pide "si `ingest-cli.ts` comparte el shape, verificar y sincronizar también". Comparte el shape y tiene el mismo `senadoFake` con `fetchVotaciones() { return "" }`; se sincronizó para que su replay `--from-r2` también reconstruya el Senado.

## Deviations from Plan

None - plan executed exactly as written. La sincronización de `ingest-cli.ts` estaba prevista explícitamente en el `<action>` de Task 1 ("si `ingest-cli.ts` comparte el shape, verificar y sincronizar también"), no es una desviación.

## Issues Encountered

- **Aclaración del path de replay:** en el modo `--from-r2` de `run-camara-votos.ts`, el conector `senado` INYECTADO no se usa — el replay construye un `senadoFake` INTERNO. Por eso el test inyecta `senadoQueLanza()` (que lanza si se toca, probando 0 fetch a la fuente) mientras la reconstrucción real depende del `senadoFake` interno sirviendo `envelope.votXmlSenado`. Un helper `senadoSirveEnvelope` que había esbozado se eliminó por innecesario.

## User Setup Required

None - no external service configuration required. Este plan es 100% offline (fixtures, 0 fetch a la fuente, 0 write a PROD). El backfill LIVE de `votaciones.php` (rate-limit 2-3s) + write PROD es Wave 2 (Plan 02, operador-LOCAL, gated) — fuera de este plan.

## Next Phase Readiness

- El path Senado ya reconstruye votos por `--from-r2`; listo para el backfill LIVE operador-LOCAL (Plan 02) y para la superficie ciudadana del voto (Phase 68).
- **Riesgo residual gated (Plan 02):** los tokens reales de `<SELECCION>` del Senado LIVE no están confirmados (A4/Open Q2). El fail-loud de este plan los hace RUIDOSOS si difieren de lo esperado — un SPIKE LIVE acotado (operador) debe fijarlos con un fixture antes del backfill masivo.
- **SC#4 (disciplina de atribución):** verificado como invariante por el test D-A1 (solo `confirmado` puebla `parlamentario_id`); la UI del voto es Phase 68.

## Verification

- `pnpm --filter @obs/tramitacion test` — 150 tests verdes (17 files).
- `pnpm --filter @obs/votos test` — 31 tests verdes (3 files).
- `pnpm --filter @obs/tramitacion typecheck` + `pnpm --filter @obs/votos typecheck` (`tsc -b`) — verdes.
- `git diff --stat packages/tramitacion/src/reconciliar-senado.ts` — VACÍO (D-A1: reconciliador intacto).
- 0 fetch a la fuente y 0 write a PROD en toda la suite (fixtures inline + in-memory).

## Self-Check: PASSED

- Todos los archivos modificados existen (5 fuente + SUMMARY).
- Ambos commits de task existen en git (`6ce469d`, `c4d4529`).
- Grep-gates: `votXmlSenado` presente en `ingest-run.ts` (3) y `run-camara-votos.ts` (2).
- `reconciliar-senado.ts` sin cambios (`git diff` vacío).

---
*Phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre*
*Completed: 2026-07-14*
