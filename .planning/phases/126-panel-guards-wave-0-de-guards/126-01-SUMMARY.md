---
phase: 126-panel-guards-wave-0-de-guards
plan: 01
subsystem: guards (anti-insinuacion, PANEL-08)
tags: [guards, vitest, panel, wave-0, tripwire]
dependency-graph:
  requires: []
  provides:
    - "SUPERFICIES_PANEL extendida (8 rutas: panel-actualidad.tsx + 7 tiles previstos)"
    - "assert anti-drift (1f) sobre app/components/panel-*.tsx"
    - "export IDIOMS_APROBADOS (4 stems fijos v13.0)"
    - "NEGACIONES_LOCKED extendida con IDIOMS_APROBADOS por spread"
    - "self-checks de no-hueco D-10(i)/(ii)"
  affects:
    - "Phase 128 (rediseño del panel): debe importar IDIOMS_APROBADOS verbatim y nombrar archivos con prefijo congelado components/panel-*.tsx"
tech-stack:
  added: []
  patterns:
    - "loader tolera archivos faltantes (try/catch continue) para alta preventiva Wave-0"
    - "assert anti-drift vía readdirSync comparado contra array declarado, excluyendo *.test.tsx?"
    - "control positivo apareado: ejecutar-y-revertir sobre fixture/archivo probe, verbatim documentado"
key-files:
  created: []
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "D-10(i) implementado con buildTermRegex directo sobre el stem, no con detectarTerminos (ver Deviations)"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 126 Plan 01: Panel Guards Wave-0 — SUPERFICIES_PANEL + IDIOMS_APROBADOS Summary

Extiende `app/lib/anti-insinuacion-guard.test.ts` (cero detector nuevo, cero copy, cero
componentes) para que el carril PANEL del guard anti-insinuación muerda ANTES de que
exista una sola línea de copy del rediseño del panel (Phase 128): alta preventiva de los
7 archivos previstos + assert anti-drift, y registro single-source de los 4 idioms
aprobados con self-checks de no-hueco.

## Conteo de tests

| Momento | Conteo | Comando |
|---|---|---|
| Baseline (antes de Task 1) | 42 passed | `npx vitest run lib/anti-insinuacion-guard.test.ts` |
| Después de Task 1 | 43 passed | ídem |
| Después de Task 2 | 49 passed | ídem |

Todos los conteos son de `npx vitest run lib/anti-insinuacion-guard.test.ts` corrido desde
`app/` (nunca glob).

## Task 1 — SUPERFICIES_PANEL + assert anti-drift (1f)

`SUPERFICIES_PANEL` pasó de 1 a 8 entradas: `components/panel-actualidad.tsx` (ya
existente, NO duplicado) + las 7 rutas D-06 (`panel-tile-sala.tsx`,
`panel-tile-comisiones.tsx`, `panel-tile-urgencias.tsx`, `panel-tile-movimiento.tsx`,
`panel-tile-votaciones.tsx`, `panel-tile-ingresos.tsx`, `panel-item-proyecto.tsx`).

Nuevo `it` `(1f) PANEL-08 anti-drift`: escanea `app/components/` con `readdirSync`
filtrando `/^panel-.+\.tsx$/` y excluyendo `/\.test\.tsx?$/` (para que
`panel-actualidad.test.tsx`, que existe hoy, NO haga fallar el guard), compara contra
`new Set(SUPERFICIES_PANEL)`, y falla con mensaje accionable si hay huérfanos. Incluye
assert anti-cero-vacuo (`archivosReales.length >= 1`).

### Control positivo apareado (Task 1) — resultado verbatim

Ejecutado y REVERTIDO en la misma sesión:

1. Creado `app/components/panel-tile-zzz-probe.tsx` con `export function P(){return null;}`.
2. Corrida `npx vitest run lib/anti-insinuacion-guard.test.ts` → **FALLA**, verbatim:
   ```
   FAIL  lib/anti-insinuacion-guard.test.ts > (1) Guard — ninguna superficie de voto ni MONEY insinúa (texto renderizado) > (1f) PANEL-08 anti-drift: todo panel-*.tsx real está declarado en SUPERFICIES_PANEL
   AssertionError: Archivo(s) panel-*.tsx real(es) NO declarado(s) en SUPERFICIES_PANEL: [components/panel-tile-zzz-probe.tsx]. Declara el archivo en SUPERFICIES_PANEL en el mismo commit que lo crea (prefijo congelado D-05).: expected [ Array(1) ] to have a length of +0 but got 1
   Tests  1 failed | 42 passed (43)
   ```
3. Borrado `app/components/panel-tile-zzz-probe.tsx` → corrida vuelve a **VERDE**, 43 passed.
4. Árbol final verificado: `ls app/components/panel*` devuelve solo `panel-actualidad.test.tsx`
   y `panel-actualidad.tsx`.

## Task 2 — IDIOMS_APROBADOS + NEGACIONES_LOCKED + self-checks

`export const IDIOMS_APROBADOS` declarado con los 4 stems byte-exactos: `Citado el`,
`vigente desde`, `En tabla de sala de la Cámara del`, `según fuente al`. `NEGACIONES_LOCKED`
los incorpora por `...IDIOMS_APROBADOS` (sin re-tipear).

Nuevo `it` `PANEL (126)`: fixture inline con el trío `exprés`/`señal`/`los más` en una
superficie panel representativa → `detectarInsinuaciones` reporta los tres (criterio 1).

Self-checks D-10:
- `(i)` no-hueco por idiom: ningún stem contiene término de `TERMINOS_PROHIBIDOS`.
- `(ii)` mutación: un término prohibido (`señal`) inyectado adyacente a un idiom aprobado
  verbatim (`En tabla de sala de la Cámara del …`) sigue siendo reportado — la resta del
  stem no enmascara.

### Conteo de TERMINOS_PROHIBIDOS (DEDUPE, verificado por comando)

```
awk '/^const TERMINOS_PROHIBIDOS/,/^\];/' app/lib/anti-insinuacion-guard.test.ts | grep -c '^\s*"'
```
Antes de editar: **78**. Después de Task 2: **78**. Iguales — ningún término se agregó a
`TERMINOS_PROHIBIDOS` (los del criterio 1 ya estaban).

### Controles positivos apareados (Task 2) — resultado verbatim

**Control (a) — D-10(i), stem contaminado:**
1. Añadido temporalmente `"señal en tabla"` a `IDIOMS_APROBADOS`.
2. Corrida → **FALLA**, verbatim:
   ```
   FAIL  lib/anti-insinuacion-guard.test.ts > (2) Mutation self-check — el guard SÍ muerde > D-10(i) no-hueco: el idiom aprobado señal en tabla NO contiene término prohibido
   AssertionError: El idiom aprobado "señal en tabla" contiene término(s) prohibido(s) [señal] — si un idiom futuro los contuviera, decide explícitamente antes de sumarlo a IDIOMS_APROBADOS/NEGACIONES_LOCKED (la resta amplia enmascararía el término).: expected [ 'señal' ] to have a length of +0 but got 1
   Tests  1 failed | 49 passed (50)
   ```
3. Revertido → **VERDE**, 49 passed.

**Control (b) — D-10(ii), término eliminado del fixture:**
1. Reemplazado temporalmente `señal` por `acuerdo` en el fixture de mutación.
2. Corrida → **FALLA**, verbatim:
   ```
   FAIL  lib/anti-insinuacion-guard.test.ts > (2) Mutation self-check — el guard SÍ muerde > D-10(ii) no-hueco: un término prohibido adyacente a un idiom aprobado sigue siendo reportado
   AssertionError: El detector NO cazó 'señal' inyectada adyacente al idiom aprobado 'En tabla de sala de la Cámara del' → la resta del stem estaría enmascarando un término prohibido vecino (hueco en NEGACIONES_LOCKED): expected [] to include 'señal'
   Tests  1 failed | 48 passed (49)
   ```
3. Revertido → **VERDE**, 49 passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D-10(i) implementado con `detectarTerminos` era circular y quedaba ciego**
- **Found during:** Task 2, al ejecutar el control positivo apareado (a).
- **Issue:** El plan (Task 2, acción d(i)) instruía usar `detectarTerminos(stem,
  TERMINOS_PROHIBIDOS)`. Pero `detectarTerminos`/`detectarInsinuaciones` restan
  `NEGACIONES_LOCKED` ANTES de matchear, y `NEGACIONES_LOCKED` ya incluye
  `IDIOMS_APROBADOS` por spread (Task 2a/b). Al pasar el stem contaminado `"señal en
  tabla"` (que vive simultáneamente en `IDIOMS_APROBADOS` y por tanto en
  `NEGACIONES_LOCKED`) por `detectarTerminos`, el propio texto se restaba a sí mismo
  antes del match — el self-check quedaba ciego (falso verde) exactamente en el
  escenario que debía cazar.
- **Fix:** Reemplazado por `TERMINOS_PROHIBIDOS.filter((t) =>
  buildTermRegex(t).test(stem))` — usa `buildTermRegex` (pieza existente) DIRECTO
  sobre el stem, sin pasar por la resta de negaciones. Sigue siendo "por código, no
  grep ni lista hardcodeada" (cumple la intención D-10(i)) y cero detector nuevo.
- **Files modified:** `app/lib/anti-insinuacion-guard.test.ts`.
- **Commit:** `66968a0`.

## Nota heredada para el planner de Phase 128

- **D-05 (prefijo CONGELADO):** todo componente nuevo del rediseño del panel DEBE
  nombrarse `components/panel-*.tsx`. El assert anti-drift `(1f)` de este plan hace
  fallar el guard ante cualquier archivo con ese prefijo que no esté declarado en
  `SUPERFICIES_PANEL` — declarar el archivo en el MISMO commit que lo crea.
- **D-08 (helper de links internos, PANEL-02):** el helper central de links internos que
  128 va a crear vive en `lib/` y NO entra a `SUPERFICIES_PANEL` (el anti-drift `(1f)`
  solo escanea `app/components/`). Si ese helper termina emitiendo labels visibles, 128
  debe sumarlo explícitamente al array.
- **IDIOMS_APROBADOS:** Phase 128 debe importar `IDIOMS_APROBADOS` verbatim desde
  `app/lib/anti-insinuacion-guard.test.ts` para el copy de fecha/procedencia, en vez de
  re-tipear los 4 stems.

## Self-Check: PASSED
