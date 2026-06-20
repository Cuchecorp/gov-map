---
phase: 22-votaciones-instructivas-que-voto-cada-uno
plan: 03
subsystem: ui
tags: [react, next, rtl, vitest, anti-insinuacion, votaciones]

# Dependency graph
requires:
  - phase: 22-01
    provides: "conteoVotacion helper (format.ts) + RPC 0028 con resultado/totales (apply remoto diferido)"
  - phase: 22-02
    provides: "patron de frase factual de desenlace en VotoFichaRow (ficha parlamentario)"
provides:
  - "VotacionCard con desenlace explicito: 'El proyecto fue {resultado} {si}-{no}' (conteoVotacion mono) sobre EtapaBadge"
  - "Espejo en la ficha del proyecto: linea de contexto 'Que se voto: {extracto}' + ancla a #idea-matriz"
  - "Tests RTL de VotacionCard (desenlace + degradacion honesta + negative-match anti-insinuacion)"
affects: [redeploy-e2e, ficha-proyecto, votaciones]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Simetria proyecto<->parlamentario: el mismo hecho (resultado+conteo) se enmarca factual en ambas superficies, reusando conteoVotacion"
    - "Espejo via leerFicha cacheada (React.cache): conexion votacion<->idea matriz sin query extra ni anidar carriles"

key-files:
  created:
    - app/components/votacion-card.test.tsx
  modified:
    - app/components/votacion-card.tsx
    - app/app/proyecto/[boletin]/page.tsx

key-decisions:
  - "Desenlace = frase factual sobre EtapaBadge (no la reemplaza): 'El proyecto fue {resultado}' + conteoVotacion en Mono; resultado null omite SOLO la frase (barra/totales intactos)"
  - "Conexion a la idea matriz = linea de contexto 'Que se voto' + ancla #idea-matriz, leida de leerFicha cacheada (cero query nueva); idea_matriz null omite la linea (honest-state), nunca fabrica"
  - "Carriles #votaciones / #idea-matriz siguen hermanos mt-12 (no se anidan, no componen con dinero/lobby)"

patterns-established:
  - "Espejo instructivo: VotacionCard (proyecto) replica el framing factual de VotoFichaRow (parlamentario) reusando el mismo helper"
  - "Contexto de seccion via React.cache: una sola lectura de proyecto_ficha sirve a #idea-matriz y a la linea de contexto de #votaciones"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-06-20
---

# Phase 22 Plan 03: Espejo instructivo en la ficha del proyecto Summary

**VotacionCard enmarca el desenlace ('El proyecto fue {resultado} {si}–{no}', conteoVotacion en Mono) y la seccion de votaciones del proyecto conecta con su propia idea matriz via leerFicha cacheada — espejo factual de la ficha del parlamentario, cero juicio/causalidad.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-20T19:29Z
- **Completed:** 2026-06-20T19:33Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- VotacionCard ahora muestra el desenlace como frase factual sobre el EtapaBadge existente, reusando `conteoVotacion` de format.ts (en-dash, Mono) — simetria con VotoFichaRow de la ficha del parlamentario (Plan 22-02).
- `resultado` null omite SOLO la frase de desenlace; la VotacionBar y el desglose de totales se conservan (degradacion honesta).
- La seccion `#votaciones` de `/proyecto/[boletin]` conecta con la idea matriz del propio proyecto: linea de contexto "Que se voto: {extracto}" + ancla a `#idea-matriz`, leida de `leerFicha` cacheada (React.cache → cero query nueva).
- `idea_matriz` null omite la linea de contexto (honest-state, el bloque #idea-matriz ya dice "no disponible aun") — nunca fabrica texto.
- Carriles `#votaciones` / `#idea-matriz` siguen hermanos mt-12; no se anidan ni componen con dinero/lobby.

## Task Commits

1. **Task 1 (RED): failing RTL for VotacionCard desenlace** - `2729e09` (test)
2. **Task 1 (GREEN): VotacionCard enmarca el desenlace** - `c3bc2c7` (feat)
3. **Task 2: conecta votaciones con la idea matriz del proyecto** - `f72eebf` (feat)

_TDD: Task 1 RED→GREEN. Task 2 no-TDD (cambio de pagina cubierto por la suite completa + tsc)._

## Files Created/Modified
- `app/components/votacion-card.test.tsx` - Tests RTL del desenlace (resultado/conteo mono, degradacion con resultado null, abstencion/quorum/etapa cuando existen y cuando son null, negative-match anti-insinuacion).
- `app/components/votacion-card.tsx` - Importa `conteoVotacion`; anade la frase factual de desenlace sobre el EtapaBadge.
- `app/app/proyecto/[boletin]/page.tsx` - Importa `extractoIdea`; `VotacionesSection` lee `leerFicha` cacheada y muestra la linea de contexto + ancla a #idea-matriz.

## Decisions Made
- **Frase sobre el badge, no en lugar de el:** el EtapaBadge(resultado) se conserva; la frase factual lo precede como texto legible para el ciudadano. Evita perder la senal visual existente y agrega la sustancia textual.
- **Conexion via ancla + contexto, no anidacion:** se eligio una linea de contexto con extracto de la idea + ancla `#idea-matriz` (en vez de duplicar la idea completa o anidar secciones), respetando la frontera de carril mt-12 (DESIGN-SYSTEM §8).
- **leerFicha reutilizada:** la misma fila `proyecto_ficha` que sirve a #idea-matriz/#cuerpos-legales alimenta la linea de contexto — cero query adicional (React.cache).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- El test inicial asertaba `getByLabelText(/Resultado de la votación/i)` para verificar la barra presente con resultado null; el aria-label real de VotacionBar es "Resultado de votación —" (sin "la"). Se ajusto el test al label real antes de commitear la RED. No afecto el codigo de produccion.

## Known Stubs
None - no stubs introduced. La degradacion honesta (resultado null → sin frase; idea_matriz null → sin linea de contexto) es first-class, no placeholder.

## User Setup Required
None - no external service configuration required for this plan.

Nota de contexto: el apply remoto del RPC 0028 (checkpoint operador de 22-01 Task 3) sigue pendiente pero NO bloquea este plan — VotacionCard lee de `votacion` (RLS public-read ya verificado), no del RPC extendido.

## Next Phase Readiness
- Bloque C del runbook (espejo proyecto) completo. Listo para el Bloque D (redeploy Linux/Docker + verificacion e2e con browseros) cuando el operador lo corra.
- Suite `app` 214/214 verde (5 nuevos en votacion-card); tsc limpio; cero banned-vocab en votacion-card.tsx y page.tsx.

## Self-Check: PASSED

- Files: votacion-card.test.tsx, votacion-card.tsx, proyecto/[boletin]/page.tsx, 22-03-SUMMARY.md — all FOUND.
- Commits: 2729e09 (test RED), c3bc2c7 (feat GREEN), f72eebf (feat Task 2) — all FOUND.
- Suite 214/214 verde; tsc exit 0; anti-insinuacion grep 0 matches en ambos archivos tocados.

---
*Phase: 22-votaciones-instructivas-que-voto-cada-uno*
*Completed: 2026-06-20*
