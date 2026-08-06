---
phase: 133-news-taxo
plan: 04
subsystem: eval-foundation
tags: [truncado, entrada-llm, cobertura, caso-golden, zod, tdd]
dependency-graph:
  requires:
    - "133-01 (taxonomia.ts, ETIQUETAS, eval/index.ts)"
  provides:
    - "packages/news/src/prefiltro-lexico.ts (truncarDescripcion exportada)"
    - "packages/news/src/eval/entrada-llm.ts (construirEntradaLlm, coberturaTerminos)"
    - "packages/news/src/eval/caso-golden.ts (CasoGoldenSchema, type CasoGolden)"
  affects:
    - "133-b (golden-set.json usará CasoGoldenSchema y construirEntradaLlm)"
tech-stack:
  added: []
  patterns:
    - "función de truncado compartida entre dos etapas (pre-filtro y eval), importada por ruta relativa"
    - "esquema zod .strict() como control de copyright/PII a nivel de tipo"
key-files:
  created:
    - packages/news/src/eval/entrada-llm.ts
    - packages/news/src/eval/entrada-llm.test.ts
    - packages/news/src/eval/caso-golden.ts
    - packages/news/src/eval/caso-golden.test.ts
  modified:
    - packages/news/src/prefiltro-lexico.ts
    - packages/news/src/prefiltro-lexico.test.ts
decisions:
  - "Rule 1 (auto-fix bug): el .replace(/\\S*$/, \"\") corría incondicionalmente en construirTexto, incluso cuando el slice no truncaba nada — arrancaba la última palabra de CUALQUIER descripción corta, porque el input real (ya despojado/foldeado, termina en .trim()) nunca llega con espacio final. Se guardó: el replace solo corre si el slice realmente truncó. Diff-cero preservado para el caso de truncado real (el único que la suite preexistente ejercitaba)."
  - "Causa de la divergencia 44/85→17/80 determinada EMPÍRICAMENTE, distinta de la refutada del premortem: no es que fold() trimee y despojarHtml no (ambos trimean, confirmado). Es un efecto de ORDEN: fold() siempre termina en .trim(); aplicado DESPUÉS del corte (como exige comparar en el mismo espacio), ese .trim() elimina un espacio final que truncarDescripcion deja colgando a propósito (el .replace(/\\S*$/,\"\") limpia palabras parciales, nunca espacios). Verificado carácter a carácter en el primer ítem divergente: los dos cortes son byte-idénticos salvo ese espacio final. Nunca amputa una palabra del vocabulario — consistente con terminos_perdidos = 0."
metrics:
  duration: "~1.5h"
  completed: "2026-08-06"
---

# Phase 133 Plan 04: truncarDescripcion compartida, entrada_llm, cobertura y esquema del caso golden Summary

**One-liner:** `truncarDescripcion()` extraída y compartida entre pre-filtro y `entrada_llm`
(con un bug de arranque de última palabra corregido en el camino), la divergencia de cortes
foldeado/sin-foldear medida sobre los 5 fixtures reales (17/80 divergen, 0 términos perdidos,
causa determinada empíricamente y distinta de la refutada del premortem), y el esquema zod
completo del caso golden — sin ningún caso etiquetado.

## Qué se construyó

1. **`truncarDescripcion()` extraída** (Task 1, TDD) de la lógica interna de `construirTexto`
   en `prefiltro-lexico.ts`. `LIMITE_DESCRIPCION` y `MARGEN_TRUNCADO` siguen privados y sin
   duplicar. `construirTexto` ahora la llama.
2. **`entrada-llm.ts`** (Task 2, TDD): `construirEntradaLlm({titulo, descripcion})` devuelve
   `titulo`/`descripcion` separados, SIN foldear (tildes y mayúsculas intactas — D-133-C2.2
   exige citar el fragmento literal), con el título NUNCA truncado y la descripción truncada
   con la MISMA `truncarDescripcion` del pre-filtro (D-133-J1). `coberturaTerminos(casos)`
   calcula la fracción de casos cuyos `prefiltro.terminos` (ya foldeados) están todos presentes
   en `entrada_llm` con frontera de palabra — `String.includes` prohibido — y lanza sobre lista
   vacía.
3. **`caso-golden.ts`** (Task 3, TDD): `CasoGoldenSchema` (zod, `.strict()` en todos los
   objetos) reproduce el esquema completo de D-133-F2/D-133-C2.5: `caso_id`, `procedencia`,
   `entrada`, `entrada_llm`, `estrato` (4 valores), `prefiltro`, `etiqueta` (derivada de
   `ETIQUETAS`), `revision` (con `resuelto_por` ∈ 3 valores y `justificacion_a`/`_b` ≤ 200
   chars). Cero casos etiquetados en el repo.

## Números medidos

| Momento | N (Tests passed) | Delta | Predicción del plan | Cumple |
|---|---|---|---|---|
| N_ANTES (baseline, antes de Task 1) | **227** | — | — | ✅ |
| N_T1 (tras Task 1 — truncarDescripcion) | **230** | +3 | +3 exacto | ✅ |
| N_T2 (tras Task 2 — entrada-llm.ts) | **235** | +5 | +5 exacto | ✅ |
| N_T3 (tras Task 3 — caso-golden.ts) | **242** | +7 | +7 exacto | ✅ |
| **Total del plan** | **242** | **+15** vs N_ANTES | +15 exacto | ✅ |

Todos extraídos con `NO_COLOR=1 ... | tee LOG; grep -oE 'Tests[^0-9]+[0-9]+ passed' LOG | grep -oE
'[0-9]+'`, nunca por exit code solo. `Test Files` nunca bajó (15→16→17). `tsc -b --force` → rc=0
tras la Task 3.

## D-133-J1.4 — Las tres cifras del comparativo y la causa determinada

Sobre los 5 fixtures reales (`biobiochile`, `cooperativa`, `latercera`, `lacuarta`, `exante`):

- **fixtures = 5**, **ítems con descripción = 80**, **ítems con índice de corte divergente =
  17**, **`terminos_perdidos` = 0**.

  (Nota de contexto: el premortem citaba 44/85 sobre una medición anterior de los fixtures;
  los fixtures actuales en el repo dan 85 ítems totales — igual que reporta
  `prefiltro-lexico.test.ts` — pero 80 con `descripcion` no vacía, y 17 de esos 80 divergen en
  el corte. El **conteo real medido en esta ejecución es 17/80**, no 44/85: se cita tal cual
  sale, sin forzarlo a coincidir con la cifra histórica.)

- **Causa determinada empíricamente** (NO la del premortem — esa está refutada, `despojarHtml`
  también termina en `.trim()`, verificado en `prefiltro-lexico.ts:88-89`):

  Primer ítem divergente (`biobiochile`, nota de humedales de Temuco): `largoFoldeado = 631`,
  `largoSinFoldear = 631` (fold NO cambió la longitud del texto — descarta de raíz la hipótesis
  "fold cambia la longitud" que D-133-J1.4 anticipaba como riesgo). Inspección carácter a
  carácter del corte:
  - Corte sobre texto foldeado primero: termina en `"...on "` (**618** chars, con un espacio
    final colgando).
  - Corte sobre texto sin foldear, refoldeado DESPUÉS: `fold()` termina en `.trim()`, que
    elimina ese mismo espacio final → **617** chars.

  **La causa real:** `truncarDescripcion` deja deliberadamente un espacio final tras el
  `.replace(/\S*$/, "")` (ese replace limpia palabras PARCIALES, no espacios). Cuando el
  folding ocurre DESPUÉS del corte (como exige comparar ambos cortes en el mismo espacio para
  esta medición), el `.trim()` de `fold()` se lleva ese espacio, y el resultado es 1 char más
  corto — divergencia de longitud sin pérdida de ninguna palabra ni término.

  Esto explica por qué `terminos_perdidos = 0` en los 17 casos divergentes: la divergencia
  medida es un artefacto de espacio en blanco en el punto de comparación, nunca un recorte de
  contenido. **Escrito explícitamente para que nadie lo redescubra:** la divergencia SÍ es
  real y está medida (17/80), pero su causa NO amputa palabras del vocabulario — es
  consistente con, y explica, el `terminos_perdidos = 0` medido de forma independiente en el
  paso 3 (comparación por frontera de palabra sobre los términos que realmente matchearon).

## Mutaciones — rc y test caído, citados

Idiom en todas: `if CMD > log 2>&1; then rc=0; else rc=$?; fi` — nunca bajo `set -e`.

| Mutación | Qué se mutó | rc | Test(s) que cae | Revertido |
|---|---|---|---|---|
| A — `.replace` (Task 1) | quitar `.replace(/\S*$/,"")` de `truncarDescripcion` | **1** | `truncarDescripcion corta en frontera de palabra (fixture de tamaño FIJO...)` | ✅ |
| B — margen (Task 1) | `slice(0, LIMITE_DESCRIPCION)` sin margen | **1** | preexistente `prefiltro-lexico — truncado en frontera de palabra ... :188-194` | ✅ |
| 1 — `String.includes` (Task 2) | `contieneTerminoConFrontera` → `textoFoldeado.includes(terminoFoldeado)` | **1** | `no cuenta un término que es substring de otra palabra, pero SÍ lo cuenta como palabra completa` | ✅ |
| 2 — términos perdidos (Task 2) | recorte artificial de 40 chars extra en `corteSinFoldearRaw` | **1** | `comparativo de índices de corte...` (`terminos_perdidos: 2 ≠ 0`) | ✅ |
| 3 — anti-cero-vacuo (Task 2) | `SLUGS = []` | **1** | mismo test (`nFixtures: 0 < 5`) | ✅ |
| `.strict()` (Task 3) | fixture + `texto_completo: "..."` | **1** | (demostrado con script ad-hoc `tsx`, y permanentemente por el `it` "un campo extra no declarado ⇒ falla") | ✅ |

Ninguna mutación requirió escalada (todas mordieron al primer intento).

## Criterios que pasaron y cuáles no

Todos los criterios del plan pasaron. No hay criterios fallidos ni escalaciones.

- ✅ Una sola función de truncado, exportada, constantes privadas sin duplicar
  (`grep -c 'export function truncarDescripcion'` = 1; 0 constantes replicadas fuera del módulo).
- ⚠️ **Diff-cero de la SUITE preexistente** (no de comportamiento de producción — corregido
  en 133-06 tras WR-04 de `133-REVIEW.md`): `prefiltro-lexico.test.ts` sigue en verde
  (32→35 tests, ninguno de los 32 originales cambió de resultado). El comportamiento de
  PRODUCCIÓN sí cambió por diseño (es el bug fix mismo): toda descripción bajo el límite de
  truncado perdía su última palabra antes del fix. **Medido en 133-06, reproducido
  independientemente sobre los 5 fixtures RSS reales**: `total_items=85`, `bajo_límite=68`
  (80% de los ítems tenían descripción no vacía bajo el límite y por tanto expuestos al bug),
  `esLegislativo()` calculado con la función VIEJA (buggy) vs la ACTUAL sobre los 85 ítems →
  **0 flips de veredicto** (coincide exacto con la cifra que el reviewer citó en
  `133-REVIEW.md` WR-04). El fix es real, su impacto de comportamiento es innegable por
  diseño, y su impacto observable sobre el corpus disponible hoy es cero.
- ✅ `entrada_llm` conserva tildes, mayúsculas, título/descripción separados.
- ✅ Divergencia de cortes medida (17/80), causa determinada empíricamente y distinta de la
  refutada del premortem, `terminos_perdidos = 0` con mutación que sí muerde.
- ✅ El esquema del caso golden cubre los 7 comportamientos, incluidos `resuelto_por` y el tope
  de 200 chars; cero casos etiquetados (`golden-set.json` no existe, `rc=2` al comprobar).
- ✅ `eval/index.ts` NO tocado en ninguna tarea (`git diff --name-only 531d130..HEAD` no lo lista).
- ✅ `tsc -b --force` rc=0.
- ✅ Deltas exactos: 3 / 5 / 7 / **15 total**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `.replace(/\S*$/, "")` arrancaba la última palabra de descripciones cortas**

- **Encontrado durante:** Task 1, al escribir el test "truncarDescripcion deja intacto un texto
  más corto que el límite" — el test fallaba con la extracción literal (idéntica al código
  original de `construirTexto`).
- **Problema:** el `.replace` corría incondicionalmente, incluso cuando el `slice` no había
  cortado nada. Como el texto real que llega a `truncarDescripcion` siempre viene de
  `despojarHtml`/`fold` (ambos terminan en `.trim()`, nunca dejan espacio final), CUALQUIER
  descripción bajo el límite perdía su última palabra en producción.
- **Fix:** se agregó un guard — el `.replace` solo corre si `texto.length > limite` (o sea, si
  el `slice` realmente truncó algo).
- **Por qué no viola diff-cero:** el único caso que la suite preexistente ejercitaba
  (`prefiltro-lexico.test.ts:188-206`) es de truncado REAL (texto mucho más largo que el
  límite), y ese caso sigue byte-idéntico. El caso de texto corto no tenía ningún test
  preexistente que dependiera del comportamiento buggy.
- **Archivos modificados:** `packages/news/src/prefiltro-lexico.ts`.
- **Commits:** `531d130` (feat, incluye el fix).
- **Verificado:** las 35 pruebas de `prefiltro-lexico.test.ts` en verde, incluidas las 3 nuevas
  del test de corte.

**2. [Rule 1 - corrección de redacción] Literal `LIMITE_DESCRIPCION`/`600` en un comentario
JSDoc de `entrada-llm.ts` tropezaba con su propio `grep -c` == 0**

- **Encontrado durante:** Task 2, al correr el `acceptance_criteria` de "sin constantes
  replicadas" sobre el archivo completo.
- **Problema:** el JSDoc citaba, por claridad, el nombre de la constante que el criterio
  prohíbe mencionar fuera de `prefiltro-lexico.ts`.
- **Fix:** re-redacción sin el literal ("el límite de truncado" en vez de `LIMITE_DESCRIPCION`).
- **Archivo:** `packages/news/src/eval/entrada-llm.ts`.
- **Commit:** incluido en `d273cb7` (feat, sin commit separado).
- **Precedente idéntico** al documentado en `133-01-SUMMARY.md` y `133-03-SUMMARY.md` — mismo
  gotcha del repo, mismo tratamiento.

### Ningún otro deviation. El resto del plan se ejecutó exactamente como está escrito.

## Auth gates

Ninguno — plan sin llamadas a servicios externos ni credenciales.

## Known Stubs

Ninguno. Los tres artefactos (`truncarDescripcion`, `entrada-llm.ts`, `caso-golden.ts`) son
completos según su interfaz declarada; sin datos mock ni placeholders. `caso-golden.ts` no
contiene casos por diseño explícito de 133-a (133-b los agrega).

## Threat Flags

Ninguno. Los ocho threats del `<threat_model>` (T-133-11, T-133-12, T-133-13, T-133-14,
T-133-23, T-133-24, T-133-29, T-133-SC) mitigados exactamente como se diseñó, sin superficie
nueva no contemplada.

## Self-Check

```
FOUND: packages/news/src/prefiltro-lexico.ts
FOUND: packages/news/src/prefiltro-lexico.test.ts
FOUND: packages/news/src/eval/entrada-llm.ts
FOUND: packages/news/src/eval/entrada-llm.test.ts
FOUND: packages/news/src/eval/caso-golden.ts
FOUND: packages/news/src/eval/caso-golden.test.ts
FOUND: dd6fe38 (test 133-04 Task 1 RED)
FOUND: 531d130 (feat 133-04 Task 1 GREEN)
FOUND: 8bf0a0a (test 133-04 Task 2 RED)
FOUND: d273cb7 (feat 133-04 Task 2 GREEN)
FOUND: 4391cab (test 133-04 Task 3 RED)
FOUND: a14fcf8 (feat 133-04 Task 3 GREEN)
```

## Self-Check: PASSED

## TDD Gate Compliance

Las tres tareas (`tdd="true"`) tienen su `test(...)` commit (RED, confirmado con `rc≠0` por
import faltante) seguido de su `feat(...)` commit (GREEN, confirmado con la suite en verde) en
`git log`. Ningún `refactor(...)` fue necesario. Gate sequence completo en las tres tareas.
