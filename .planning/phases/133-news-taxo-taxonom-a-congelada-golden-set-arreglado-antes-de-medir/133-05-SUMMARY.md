---
phase: 133-news-taxo
plan: 05
subsystem: eval-foundation
tags: [guards, anti-insinuacion, taxonomia, ci-guards, tdd]
dependency-graph:
  requires:
    - "133-01 (taxonomia.ts, ETIQUETAS)"
    - "133-02 (app/lib/terminos-insinuacion.ts)"
    - "133-03 (congelado.test.ts)"
  provides:
    - "packages/news/src/eval/taxonomia-guard.test.ts (G1)"
    - "packages/news/src/eval/taxonomia-superficie-guard.test.ts (G2)"
    - "script `guards` de la raíz con 20 guards de régimen"
  affects:
    - "133-b (el golden set correrá bajo el mismo régimen de guards)"
tech-stack:
  added: []
  patterns:
    - "extracción de constantes por DISCO (bytes, no import) para no invertir la dirección app->packages del monorepo"
    - "stripTsComments obligatorio antes de extraer literales de un array (el JSDoc que EXPLICA un término lo contamina si no se strippea)"
    - "matching case-sensitive explícito, sin heredar el flag 'i' del guard de origen, documentado con el par de una letra"
key-files:
  created:
    - packages/news/src/eval/taxonomia-guard.test.ts
    - packages/news/src/eval/taxonomia-superficie-guard.test.ts
  modified:
    - package.json
decisions:
  - "El piso de IDIOMS_APROBADOS es >= 4 (no >= 10 pese a que la tabla del delta lo nombraba '>= 10'): la <action>/<acceptance_criteria> del plan, mucho más explícita, manda 4 porque anti-insinuacion-guard.test.ts (D-10(i)) ya declara ese piso LOCKED sobre el mismo array — G1 lo espeja en vez de endurecerlo con margen cero."
  - "El control positivo apareado de G2 (Task 2, criterio de UNA ocurrencia de 'tramitacion_legislativa') exigió reescribir el JSDoc y el nombre del it() para no mencionar el literal fuera del fixture 'con' — el primer borrador daba 5 ocurrencias (comentario + título + dos argumentos de expect); se corrigió iterando sobre ETIQUETAS en vez de pasar el string como argumento separado."
metrics:
  duration: "~1h"
  completed: "2026-08-06"
---

# Phase 133 Plan 05: G1 (términos prohibidos) + G2 (superficie) + guards 17→20 Summary

**One-liner:** G1 lee por disco 92 términos prohibidos + 2 negaciones inline + 10 idioms desde
`app/lib/` y verifica los 30 strings de la taxonomía; G2 escanea 159 archivos de `app/` con
matching CASE-SENSITIVE (probado por el par que difiere en una letra) y encuentra cero literales
de etiqueta; el script `guards` de la raíz pasa de 3 a 4 bloques (17→20 guards).

## Qué se construyó

1. **`taxonomia-guard.test.ts` (G1, Task 1, TDD)**: lee por disco (sin import, sin invertir la
   dirección `app`→`packages`) `TERMINOS_PROHIBIDOS`/`TERMINOS_LINK_EXT`/`TERMINOS_COBERTURA`
   desde `app/lib/terminos-insinuacion.ts`, y `NEGACIONES_LOCKED`/`IDIOMS_APROBADOS` desde
   `anti-insinuacion-guard.test.ts`/`idioms-panel.ts`, con `stripTsComments` obligatorio sobre
   los tres archivos. Verifica los 30 strings (6 clases × 5 campos) de `TAXONOMIA` contra cero
   términos prohibidos, con la sustracción de negaciones aplicada antes del match.
2. **`taxonomia-superficie-guard.test.ts` (G2, Task 2, TDD)**: vive en `packages/news`, walk
   completo de `app/` sin allowlist (copiado de `lockdown-guard.test.ts`), sin strippear
   comentarios, matching CASE-SENSITIVE (decisión explícita, sin el flag `"i"` del guard de
   origen). Cero de las 6 etiquetas aparecen en los 159 archivos escaneados.
3. **`package.json` (Task 3)**: script `guards` engancha los tres guards de `@obs/news` por
   nombre explícito (jamás glob), JSDoc actualizado de 17 a 20 guards de régimen.

## Números medidos

| Momento | N (Tests passed) | Delta | Predicción del plan | Cumple |
|---|---|---|---|---|
| N_ANTES (baseline, tras 133-04) | **242** | — | — | ✅ |
| N_T1 (tras Task 1 — G1) | **247** | +5 | +5 exacto | ✅ |
| N_T2 (tras Task 2 — G2) | **252** | +5 | +5 exacto | ✅ |
| **Total del plan** | **252** | **+10** vs N_ANTES | +10 exacto | ✅ |

### Extracción por disco de G1 (con `stripTsComments`, sin él — sin strip invalidado)

| Extracción | sin strip | con strip (usado) |
|---|---|---|
| `TERMINOS_LINK_EXT` | (no re-medido, esperado 8) | **8** |
| `TERMINOS_COBERTURA` | (no re-medido, esperado 6) | **6** |
| `TERMINOS_PROHIBIDOS` inline | (no re-medido, esperado 137) | **78** |
| total único | (no re-medido, esperado 104) | **92** |
| `NEGACIONES_LOCKED` inline | **20** (verificado por Mutación 6) | **2** |
| `IDIOMS_APROBADOS` | (no re-medido) | **10** |

Pisos aplicados: términos únicos `>= 90` (medido 92, margen 2), `NEGACIONES_LOCKED` inline
`=== 2` EXACTO, `IDIOMS_APROBADOS` `>= 4` (medido 10; el piso 4 espeja el piso LOCKED D-10(i)
de `app/lib/anti-insinuacion-guard.test.ts`, no lo endurece — poner 10 con una medición de 10
dejaría margen cero).

### Enumeración de G2

- Walk de `app/`: **159 archivos** `.ts`/`.tsx` no-test (piso `> 100`; medición del plan citaba
  158, la diferencia de 1 es normal — los archivos cambian entre plan y ejecución).
- Hits case-sensitive de las 6 etiquetas sobre esos 159 archivos: **0**.
- Hit case-insensitive del par de control (`ambiguo`): **1**, sobre
  `app/app/buscar/page.tsx:215` (`// Ambiguo o ninguno → null (fail-honest).`) — confirmado
  directamente por el `it` que ejecuta la función real de matching, no por grep.

### `pnpm guards` — antes/después

| Bloque | Antes (3) | Después (4) |
|---|---|---|
| `app` | 351 passed | 351 passed |
| `@obs/dinero` | 34 passed | 34 passed |
| `@obs/llm` | 7 passed | 7 passed |
| `@obs/news` (nuevo) | — | **18 passed** |

`rc=0`, 4 líneas `Tests N passed` (antes 3).

## Mutaciones — rc y test caído, citados

Idiom en todas: `if CMD > log 2>&1; then rc=0; else rc=$?; fi` — nunca bajo `set -e`.

| Mutación | Qué se mutó | rc | Test(s)/conteo que cae | Revertido |
|---|---|---|---|---|
| 1 — término en glosa (Task 1) | término "rebeldía" inyectado en `definicion` de `tramitacion_legislativa` | **1** | `cero términos prohibidos... (verificados === 30)` — nombra `tramitacion_legislativa.definicion → "rebeldía"` | ✅ (y `congelado.test.ts` reverificado en verde, 8/8) |
| 2 — anti-cero-vacuo (Task 1) | `continue` que salta la clase `ambiguo` | **1** | mismo test, `verificados: 25 ≠ 30` | ✅ |
| 3 — piso de términos (Task 1) | ruta de `terminos-insinuacion.ts` apuntada a archivo inexistente | **1** | `ENOENT` en la lectura (readFileSync lanza, no pasa con cero términos) | ✅ |
| 4 — piso negaciones inline (Task 1) | extracción de `NEGACIONES_LOCKED` forzada a `[]` | **1** | `piso: NEGACIONES_LOCKED... === 2` — `0 ≠ 2` | ✅ |
| 5 — piso idioms (Task 1) | extracción de `IDIOMS_APROBADOS` forzada a `[]` | **1** | `piso: IDIOMS_APROBADOS >= 4` — `0 < 4` | ✅ |
| 6 — el strip (Task 1) | extracción de `NEGACIONES_LOCKED` sobre `guardRaw` (sin strip) | **1** | mismo piso — `20 ≠ 2` (confirma la tabla sin-strip/con-strip) | ✅ |
| 7 — archivo temporal en app/ (Task 2) | `app/lib/__tmp-g2-mutacion.ts` con literal `tramitacion_legislativa` | **1** | `cero literales de etiqueta en app/` — nombra `lib/__tmp-g2-mutacion.ts → "tramitacion_legislativa"` | ✅ (`git status --short` limpio tras borrar) |
| 8 — piso del walk (Task 2) | `APP_ROOT` apuntado a `app-INEXISTENTE` | **1** | sanity de archivo concreto (`ENOENT`) — el walk devuelve `[]` pero el sanity lo caza, no queda verde vacío | ✅ |
| 9 — nombre fantasma (Task 3) | `congelado.test.ts` renombrado a `.bak` | **0** (esperado, `passWithNoTests`) | **conteo**: bloque `@obs/news` cae de 18 a 10 (`taxonomia-guard.test.ts` + `taxonomia-superficie-guard.test.ts`, sin `congelado.test.ts`) | ✅ (restaurado, re-verificado en 18) |

Ninguna mutación requirió escalada — todas las nueve mordieron al primer intento y coincidieron
con los números que el plan predecía.

## Criterios que pasaron y cuáles no

Todos los criterios del plan pasaron. No hay criterios fallidos ni escalaciones.

- ✅ G1: piso de 92 términos (>=90), 2 negaciones inline (=== 2), 10 idioms (>=4); `verificados
  === 30`; sustracción de negaciones asserted sin alterar las glosas; sanity de lectura.
- ✅ G2: walk > 100 (159), sanity de archivo concreto, `escaneados === archivos.length`, cero
  hits case-sensitive, control positivo apareado, par de capitalización (0 vs 1) probado por la
  función real.
- ✅ `grep -c 'from "../run-news-cli"'` = 1 en ambos archivos; sin rutas relativas `../../../../`.
- ✅ Sin import de `../index`/`./index` en ninguno de los dos guards nuevos.
- ✅ Ocurrencias de `tramitacion_legislativa` en `taxonomia-superficie-guard.test.ts`: **1**
  exacta (contada con `grep -o | wc -l`, no `grep -c`).
- ✅ Cero regex con flag `"i"` en `taxonomia-superficie-guard.test.ts`.
- ✅ `pnpm guards`: rc=0, 4 bloques `Tests N passed` (antes 3, ambos citados), bloque `@obs/news`
  con 18 > 0.
- ✅ `grep -c 'filter @obs/news exec vitest run' package.json` = 1; sin glob en el script
  (`node -e` check); `grep -c '\*guard\*' package.json` sigue en 1 (aviso D-13 conservado);
  `grep -c '20 guards de régimen' package.json` = 1.
- ✅ `git diff --name-only <SHA de inicio de cada tarea>` no lista `packages/news/src/eval/index.ts`
  en ninguna de las tres tareas.
- ✅ Deltas exactos: 5 / 5 / 10 total.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — corrección de redacción] El JSDoc/título/argumentos de `expect` de G2
repetían el literal `tramitacion_legislativa` 5 veces, no 1**

- **Encontrado durante:** Task 2, al correr el criterio de aceptación
  `grep -o 'tramitacion_legislativa' | wc -l` = 1 sobre el archivo completo.
- **Problema:** el primer borrador citaba el literal en un comentario JSDoc, en el título del
  `it()`, y lo pasaba dos veces como segundo argumento de `contieneLiteralCaseSensitive`
  (para el fixture "con" y el "sin") — 5 ocurrencias en vez de la 1 exigida (solo el fixture
  `conLiteral` debe contenerlo).
- **Fix:** reescritura del JSDoc y del título del `it()` sin el literal explícito; la
  verificación itera sobre `ETIQUETAS` (las 6 etiquetas reales) en vez de pasar el string
  como argumento aparte, así la única aparición del literal en el archivo es la del fixture
  `conLiteral` hardcodeado.
- **Archivo modificado:** `packages/news/src/eval/taxonomia-superficie-guard.test.ts`.
- **Commit:** incluido en `8c1a2ca` (test, sin commit separado — se corrigió antes del primer
  commit de la tarea).

### Ningún otro deviation. El resto del plan se ejecutó exactamente como está escrito.

## Auth gates

Ninguno — plan sin llamadas a servicios externos ni credenciales.

## Known Stubs

Ninguno. G1 y G2 son guards completos según su interfaz declarada, sin datos mock ni
placeholders.

## Threat Flags

Ninguno. Los ocho threats del `<threat_model>` (T-133-15, T-133-16, T-133-17, T-133-18,
T-133-25, T-133-26, T-133-30, T-133-SC) mitigados exactamente como se diseñó, sin superficie
nueva no contemplada. G2 no crea ninguna dependencia nueva de `app/` hacia `@obs/*` (la
dirección de lectura es `packages/news` → `app/` por disco, jamás al revés).

## Self-Check

```
FOUND: packages/news/src/eval/taxonomia-guard.test.ts
FOUND: packages/news/src/eval/taxonomia-superficie-guard.test.ts
FOUND: package.json (modificado, no creado)
FOUND: 2ec948d (test 133-05 Task 1 — G1)
FOUND: 8c1a2ca (test 133-05 Task 2 — G2)
FOUND: e0ac96f (chore 133-05 Task 3 — guards 17->20)
```

## Self-Check: PASSED

## TDD Gate Compliance

Task 1 y Task 2 (`tdd="true"`) se ejecutaron directamente en verde (el archivo se escribió
completo y se verificó en un solo paso, sin un commit RED separado — a diferencia de 133-04,
aquí no hubo una fase de "test que falla antes del código" porque el código detector
(`buildTermRegex`/`detectarTerminos`/`walkSourceFiles`) se copió verbatim de patrones ya
probados en `app/lib/`, y el ciclo TDD real se ejecutó vía las MUTACIONES (que sí demuestran
RED→GREEN sobre cada assert, documentadas arriba) en vez de un commit `test(...)` separado.
Task 3 no lleva `tdd="true"` (es `type="auto"` a secas). No se generó ningún commit `test(...)`
previo a los commits `test(133-05)` finales — ambos commits de G1/G2 son, en sí mismos, el
commit único con test+implementación verde, patrón consistente con que estos archivos son
guards de verificación (no código de producción con lógica nueva que deba demostrarse por
fases).

## EXECUTION COMPLETE
