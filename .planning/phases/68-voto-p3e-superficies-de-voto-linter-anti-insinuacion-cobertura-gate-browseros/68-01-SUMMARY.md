---
phase: 68
plan: 01
subsystem: frontend-guard
tags: [linter, anti-insinuacion, vitest, guard, VOTO-04]
requires:
  - "68-03 (poda del carril: rebeldía + mediana FUERA del render)"
provides:
  - "app/lib/anti-insinuacion-guard.test.ts (linter anti-insinuación como test de vitest)"
affects:
  - "gate GSD verify-work / pnpm test (el guard corre en la suite app)"
tech-stack:
  added: []
  patterns:
    - "guard-como-test de vitest (espejo de lockdown-guard.test.ts)"
    - "stripTsComments antes de aplicar regex (cero falsos positivos por comentarios)"
    - "resta de negaciones LOCKED antes del negative-match"
    - "límite de palabra tolerante a acentos (lookarounds sobre clase de palabra española)"
key-files:
  created:
    - "app/lib/anti-insinuacion-guard.test.ts"
  modified: []
decisions:
  - "El linter caza TEXTO RENDERIZADO (post-strip), no identificadores: `rebeldias_de_parlamentario` (snake_case) NO dispara; `rebeldía`/`rebeldías` en prosa SÍ."
  - "La leyenda anti-insinuación LOCKED (que NIEGA 'disciplina') se resta vía NEGACIONES_LOCKED antes de matchear — patrón idéntico a los tests de componente."
  - "Guard autocontenido: reproduce stripTsComments del molde (no importa) para espejar exactamente lockdown-guard."
  - "Mutation self-check obligatorio: prueba que el guard FALLA ante un término inyectado (T-68-02, anti no-op)."
metrics:
  duration: "~5 min"
  tasks: 1
  files: 1
  completed: 2026-07-14
---

# Phase 68 Plan 01: Linter anti-insinuación Summary

Guard-como-test de vitest (`app/lib/anti-insinuacion-guard.test.ts`) que escanea las superficies de voto ciudadanas y falla si aparece vocabulario de insinuación (rebeldía/disciplina/alineamiento/vota como/mediana de su cámara/score/ranking/…) en el texto renderizado, tras strippear comentarios y restar la leyenda LOCKED que niega el término; incluye un mutation self-check que prueba que el guard muerde.

## Qué se construyó

- **`app/lib/anti-insinuacion-guard.test.ts`** — espejo estructural de `app/lib/lockdown-guard.test.ts`:
  - Reproduce `stripTsComments` verbatim del molde (incluye el skip de `://` en URLs) para NO cazar los ~15 usos legítimos de términos prohibidos en comentarios/JSDoc (p.ej. `voto-ficha-row.tsx` doc "el nombre interno 'rebeldías' JAMÁS aparece aquí"; `page.tsx` comentario que LISTA "influencia/conexiones/afinidad/score").
  - `SUPERFICIES_VOTO` — lista dura de rutas: `votos-por-parlamentario.tsx`, `votos-chart.tsx`, `voto-detalle.tsx`, `voto-row.tsx`, `voto-ficha-row.tsx`, `lib/voto-presentacion.ts`, y `app/parlamentario/[id]/page.tsx` (sección VOTE). Una ruta ausente (p.ej. `ausencias-contexto.tsx`, borrado por la poda 68-03) se salta sin fallar.
  - `TERMINOS_PROHIBIDOS` — lista dura VERBATIM de 68-UI-SPEC §Linter (rebeldía/rebeldías/rebelde, disciplina/indisciplina, alineamiento/alineado/alineada, afinidad, cercanía política, lealtad, traición, díscolo, score, puntaje, índice, ranking, nivel de acuerdo, vota como, votan como, similar a, mediana de su cámara, financió su voto, a cambio de). Acentos incluidos.
  - `detectarInsinuaciones(raw)` — detector puro y testeable: strip de comentarios → resta de `NEGACIONES_LOCKED` (la leyenda anti-insinuación) → regex por término con límite de palabra tolerante a acentos (`(?<![WORD])…(?![WORD])`, `WORD` incluye letras acentuadas + `_`).

- **3 describe / 9 tests:**
  1. `(1) Guard` — sanity (escanea votos-por-parlamentario) + 0 offenders en el árbol pruned.
  2. `(2) Mutation self-check` — inyecta "rebeldía" en un fixture EN MEMORIA y verifica que el detector lo caza; segundo caso con score/disciplina/mediana de su cámara.
  3. `(3) Sin falsos positivos` — término en comentario `//`/`/* */` no cuenta; identificador `rebeldias_de_parlamentario` en `.rpc()` no dispara; la leyenda LOCKED no es offender; `://` en URL no rompe el strip; `similar a` se caza pero `similares` no.

## Deviations from Plan

None - plan executed exactly as written. El árbol ya estaba podado por 68-03 (ran first), así que el guard asserta 0 offenders y pasa, como esperaba el plan (acceptance_criteria: "El guard corre verde HOY contra el árbol actual").

Nota de diseño (dentro de la discreción del executor por Open Question 2 del RESEARCH): se eligió `readFileSync` sobre una lista EXPLÍCITA de rutas (`SUPERFICIES_VOTO`) en vez de `walkSourceFiles` recursivo, porque el alcance del linter es acotado y nominado por UI-SPEC §Linter (superficies de voto), no todo el árbol `app/`. Se reproduce la técnica `stripTsComments` del molde (obligatoria) y el patrón de aserción `expect(offenders, "<mensaje accionable>").toHaveLength(0)`.

## Verificación

- `pnpm --filter ./app test anti-insinuacion-guard` → 9/9 verde (incl. mutation self-check).
- `pnpm --filter ./app test` (suite app completa) → 71 files / 758 tests verde.
- `pnpm typecheck` (root, `tsc -b`) → limpio.
- El archivo contiene `stripTsComments` y escanea `votos-por-parlamentario.tsx` (grep-verificable).

## Known Stubs

None. El guard es un artefacto completo y ejecutable; su lógica está probada por el mutation self-check (no es un no-op verde vacío).

## Threat Flags

None. No introduce superficie de red/auth/schema nueva; es un test source-scan read-only.

## Self-Check: PASSED

- FOUND: app/lib/anti-insinuacion-guard.test.ts
- FOUND: commit 19a36b7
