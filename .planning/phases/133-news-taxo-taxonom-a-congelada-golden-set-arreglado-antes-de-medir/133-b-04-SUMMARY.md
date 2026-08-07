---
phase: 133-news-taxo
plan: b-04
subsystem: news-eval
tags: [golden-set, calibracion, ceguera, guard, checkpoint-operador]
dependency-graph:
  requires: [133-b-01, 133-b-02, 133-b-03]
  provides: [calibracion-20.json, seleccionarCalibracion, verificarCeguera]
  affects: [133-b-05]
tech-stack:
  added: []
  patterns: ["doble candado allowlist+denylist", "denylist con no-sobre-amplitud verificable", "guard recursivo sobre documento completo", "barajado final para romper correlacion orden-estrato"]
key-files:
  created:
    - packages/news/src/eval/calibracion.ts
    - packages/news/src/eval/calibracion.test.ts
    - packages/news/src/eval/calibracion-ceguera-guard.test.ts
    - packages/news/src/eval/calibracion-cli.ts
    - packages/news/src/eval/calibracion-20.json
  modified: []
decisions:
  - "La ceguera se define por la INFORMACION disponible, no por los campos presentes: aunque el artefacto no lleva el campo `estrato`, el ORDEN agrupado (12 P + 5 N-alea + 3 N-sonda) revelaba el veredicto del pre-filtro por posicion. Fix: barajado final determinista sobre los 20 ya seleccionados, con PRNG re-sembrado ${semilla}:calib:orden. El control vive SEPARADO del guard de campos (fuga por INDICE vs fuga por CAMPO)."
metrics:
  duration: "~50 min (+ ~20 min de fix post-cierre)"
  completed: "2026-08-07"
---

# Phase 133 Plan b-04: calibracion.ts + calibracion-cli.ts — 20 casos a ciegas congelados, PLAN DETENIDO EN CHECKPOINT

Selección determinista de los 20 casos de calibración (12 de P por cuota de outlet, 5 de
N-alea, 3 de N-sonda) desde la muestra congelada de 133-b-02, con doble candado de ceguera
(allowlist estructural + denylist recursiva sobre el documento completo) **más** un barajado
final que rompe la correlación entre el orden de presentación y el estrato de origen. **El
plan se detiene aquí — ningún caso fue etiquetado, ni por máquina ni por humano.**

**Este plan fue corregido post-cierre.** El cierre original (commits `f90ced5`/`b5e209d`)
devolvía los 20 casos CONCATENADOS por estrato (posiciones 1-12 = P, 13-17 = N-alea, 18-20 =
N-sonda). El guard de ceguera pasaba limpio (cero campos de máquina), pero el coordinador
detectó que la composición 12+5+3 está escrita en el plan y en la adjudicación —
`133-b-ADJUDICACION.md` §D-133b-5— así que cualquiera que la conociera podía leer del ÍNDICE
del artefacto qué casos había descartado el pre-filtro, sin necesitar ningún campo de máquina.
Ver "Deviations" para el relato completo.

## Qué NO se cumplió (en el cierre original, ya corregido)

**El cierre original tenía un defecto de fondo: la ceguera por CAMPO no implica ceguera por
ORDEN.** El artefacto no llevaba ningún campo prohibido, pero el orden agrupado de los 20
(exactamente la composición 12+5+3 documentada) permitía inferir el estrato —y por tanto el
veredicto del pre-filtro— de cada caso a partir de su posición. Un caso en la posición 15, por
ejemplo, es necesariamente de `N-alea` (descarte); saber eso es un prior fortísimo hacia
`no_legislativa` que contaminaría κ(humano↔máquina) por conocimiento compartido del veredicto,
no por convergencia real de criterio — la misma clase de avería estructural que el `N-alea`
vaciado de 133-b-02 (ningún test caía, la métrica salía optimista). Corregido en esta revisión.

## Precondición verificada

`133-b-03-SUMMARY.md` declara `gate=PASA` (línea 69: `umbral=0.95 gate=PASA`) — la cobertura
del censo P ya fue confirmada al 100,00 % antes de empezar este plan, tal como exige D-133b-3.

## Números medidos

**`SHA_BASE`** (corrida original): `ceba923870ef6c2f65ec14b9f463900c73e8cae5`

**Conteos de tests:**

| Momento | Tests | Delta |
|---|---|---|
| `N_ANTES` | 304 | — |
| Cierre original | 317 | +13 |
| **Tras el fix post-cierre (+1 test `(g)`)** | **318** | **+14 sobre 304** |

`318 - 304 = 14`: 6 (Task 1 original) + 7 (Task 2 original) + 1 (adenda `it` (g) de
no-correlación de orden).

**Cuota de P calculada** (piso 1 por outlet + mayores restos por déficit, desempate
alfabético explícito) sobre el censo real 74 = 50/11/6/6/1 — **sin cambios por este fix**:

```
{ latercera: 8, lacuarta: 1, exante: 1, biobiochile: 1, cooperativa: 1 }
```

**Línea `calibracion: ...` de la corrida real (post-fix):**

```
calibracion: casos=20 P=12 alea=5 sonda=3 outlets=5 sinDescripcion=2 clavesEscaneadas=128 ceguera=OK
```

Idéntica a la del cierre original en todos los gates numéricos — **la selección no cambió**,
solo el orden de presentación. `sinDescripcion=2` (10 %, consistente con la tasa global del
corpus).

**El número que cambió y por qué importa — la secuencia de estratos:**

| Momento | Secuencia (posiciones 1→20) | Transiciones |
|---|---|---|
| Antes (agrupado, defectuoso) | P×12, N-alea×5, N-sonda×3 | **2** |
| **Después (barajado, correcto)** | `P,N-sonda,P,N-alea,N-alea,N-sonda,P,P,P,N-alea,N-alea,P,N-sonda,P,P,P,P,P,P,N-alea` | **10** |

Con 2 transiciones, la posición predice el estrato con certeza. Con 10, no hay forma de
inferir el estrato desde el índice sin consultar `muestra-133b.json` (que el operador no debe
mirar). El `it` (g) nuevo asserta un piso conservador `>= 8` (no la cifra exacta 10, para no
acoplar el test a un valor que un cambio de semilla movería sin ser un regreso al bug).

**`sha256` de `calibracion-20.json` — antes y después del fix:**

| Momento | sha256 |
|---|---|
| Cierre original (orden agrupado, defectuoso) | `061c7c6867801241fe5d4080766b18f16b1e1eb75f7d5ac89c2aef9d8154ba94` |
| **Tras el fix (orden barajado, correcto, committeado)** | `8a050c8008e338acfbbb1b769eee80164eae710655498453c752d07fb8f4b4aa` |

**Reproducibilidad byte a byte (post-fix), verificada dos veces:** ambas corridas del CLI
produjeron `8a050c8008e338acfbbb1b769eee80164eae710655498453c752d07fb8f4b4aa` — idénticas.

**ADVERTENCIA EXPLÍCITA (sigue vigente):** ninguno de los dos hashes es el hash del
`golden-set.json`. Ese se emite una sola vez, al final, en el plan 133-b-07.

**Ceguera de CAMPO verificada sobre el archivo en disco (sin cambios por este fix):**

```
maquina_en_artefacto (calibracion-20.json) = 0
maquina_en_muestra   (muestra-133b.json, control positivo) = 308
```

**Sanity de un caso concreto** (primer `id` del artefacto tras el fix — cambió respecto al
cierre original porque el orden cambió):

```
id (posición 1, tras barajar): resuelto contra muestra-133b.json → estrato P
claves del ítem ciego: [descripcion, fecha, id, outlet, titulo]  (exactamente 5, ninguna más)
```

**Glosa derivada (sin cambios):** 6 `marca_decisoria`, 6 `"etiqueta"` (solo en la glosa).

## Mutaciones (9 tras el fix, todas rojas nombrando su `it`, todas revertidas)

| Task | Mutación | Resultado |
|---|---|---|
| T1 | A — reparto proporcional puro (sin piso) | rc≠0, nombra **los dos** `(a)` y `(b)` |
| T1 | B — estratos colapsados (sonda tomada de N-alea) | rc≠0, nombra `(c)` |
| T1 | C — semilla ignorada | rc≠0, nombra `(e)` |
| T1 | D — filtro por descripción antes del sorteo | rc≠0, nombra `(f)` |
| **T1** | **E (nueva, post-cierre) — orden agrupado (barajado final removido)** | **rc≠0, nombra `(g)`** |
| T2 | A — denylist vacía | rc≠0, nombra **los dos** `(b)` y `(c)` |
| T2 | B — escaneo de un solo nivel (sin recursión) | rc≠0, nombra `(c)` |
| T2 | C — cero vacuo (quitar el `throw` de `casos:[]`) | rc≠0, nombra `(d)` |
| T2 | D — guard sobre-amplio (`etiqueta` añadida a la denylist) | rc≠0, nombra `(g)` (de `calibracion-ceguera-guard.test.ts`, distinto del `(g)` de Task 1) |

**Nota sobre la Mutación C (T2) y el `it` (d) (histórico, sigue vigente):** el fixture inicial
de (d) no aislaba la mutación (el piso de conteo genérico atrapaba el caso por una razón
distinta). Se corrigió con relleno benigno para aislar el chequeo explícito de cero vacuo.

## Deviations from Plan

**1. [Rule 4 — amenaza de ceguera de fondo, corregida POST-CIERRE por el coordinador] El orden
de los 20 correlacionaba con el estrato de origen.**

- **Encontrado durante:** revisión del coordinador sobre el artefacto ya committeado
  (`sha256=061c7c68...`), cruzando el índice de `calibracion-20.json` contra
  `muestra-133b.json` y confirmando el patrón 12+5+3 exacto en las posiciones 1-20.
- **Síntoma:** 2 transiciones de estrato en la secuencia (el mínimo posible para 3 bloques
  contiguos), delatando agrupación perfecta.
- **Por qué NO era un problema de campos:** el guard de ceguera (`verificarCeguera`) escanea
  CLAVES, y el artefacto no tenía ninguna prohibida — el guard pasaba `ceguera=OK`
  correctamente, porque la fuga no está en ningún VALOR de ningún campo, está en la POSICIÓN
  de los elementos dentro del array. La ceguera se define por la información disponible, no
  por los campos presentes — un guard de campos, por diseño, no puede detectar una fuga de
  orden/índice.
- **Fix:** `seleccionarCalibracion` ahora aplica un barajado Fisher-Yates final, determinista,
  con un PRNG re-sembrado `` `${semilla}:calib:orden` ``, sobre los 20 ya seleccionados (la
  selección — composición 12+5+3 y qué `caso_id` entran — no cambia; solo el orden en que se
  presentan).
- **Verificación añadida:** `it` (g) nuevo en `calibracion.test.ts`, obligatorio: mide las
  transiciones de estrato en la secuencia final resolviendo el estrato contra
  `muestra-133b.json` (NUNCA contra el artefacto ciego, que no lo tiene), con anti-cero-vacuo
  explícito del join (si no resuelve los 20, el test debe fallar, no pasar vacío). Piso
  `>= 8`, medido real: **10**. Mutación apareada (quitar el barajado final) confirmada roja,
  nombrando `(g)`.
- **Documentación del porqué el control vive separado del guard:** el JSDoc de
  `verificarCeguera` en `calibracion.ts` explica explícitamente que el guard de campos NO
  cubre (a propósito) la correlación de orden, y por qué ambos controles se mantienen
  separados (atacan amenazas de naturaleza distinta: fuga por CAMPO vs. fuga por ÍNDICE) —
  para que nadie "ordene para que se lea mejor" en el futuro sin que ningún test lo note.
- **Archivos:** `packages/news/src/eval/calibracion.ts`, `calibracion.test.ts`,
  `calibracion-20.json`, y `133-b-04-PLAN.md` (nuevo `it` documentado como adenda, delta
  13→14, T-133-66 añadido al threat register).
- **Commits:** `2ea9092` (fix de código + test), `a004b17` (re-congelado del artefacto),
  `fcdf674` (corrección del plan).

## Lo que sí se cumplió (tras el fix)

- Los 20 casos se seleccionan con la **misma semilla** (`133-b-golden-2026`), congelados
  **antes** de que exista una sola etiqueta de máquina.
- Cuota P exacta `{latercera:8, lacuarta:1, exante:1, biobiochile:1, cooperativa:1}`.
- Los 5 outlets del censo P tienen representación.
- **La ceguera se cumple por guard en DOS DIMENSIONES, no por promesa:** ceguera de CAMPO
  (doble candado allowlist+denylist, con su control positivo y su control de
  no-sobre-amplitud) **y** ceguera de ORDEN (barajado final con piso de transiciones
  verificado y mutación apareada) — ambas controladas por test, no por inspección visual.
- El artefacto es byte-estable, reproducible sin red (`8a050c80...`), y NO contiene ningún
  campo de máquina.
- `pnpm --filter @obs/news exec tsc --noEmit` sin errores. Suite completa: **318 passed**.
- Cero `pnpm add`. `git diff --name-only` lista exactamente los 5 archivos declarados.
- **El plan NO etiquetó ni un solo caso** — ni de máquina ni de humano. Ningún anotador corrió.
  No se forzó CI ni se hizo push.
- No existe todavía ningún `golden-set.json`.

## Known Stubs

Ninguno.

## Threat Flags

**T-133-66 (nueva, post-cierre):** correlación orden↔estrato — ya mitigada (ver Deviations).
Resto de la superficie coincide con `<threat_model>` de `133-b-04-PLAN.md` (T-133-52 a
T-133-59, T-133-65, T-133-SC), todas mitigadas.

## ⛔ ESTADO: DETENIDO EN CHECKPOINT DE OPERADOR (indelegable)

**El plan queda aquí, con el artefacto CORREGIDO.** `packages/news/src/eval/calibracion-20.json`
(`sha256=8a050c8008e338acfbbb1b769eee80164eae710655498453c752d07fb8f4b4aa`) está congelado y
listo — orden barajado, ceguera de campo Y de orden verificadas. **Ninguna etiqueta —de
máquina o de humano— existe todavía.**

**Archivo exacto que el operador debe abrir para etiquetar:**

```
packages/news/src/eval/calibracion-20.json
```

**Instrucciones para el operador** (repetidas del `<how-to-verify>` del checkpoint):
1. Abrir el archivo de arriba.
2. Leer la sección `glosa`: las 6 clases con `definicion`, `marca_decisoria` y `frontera`.
   Precedencia LOCKED `1 > 2 > 3 > 4 > 5`; `ambiguo` es el escape.
3. Para cada uno de los 20 `casos`, decidir la etiqueta **solo sobre el texto que se ve**
   (`titulo` + `descripcion`). Si la descripción está vacía y el titular no alcanza para
   decidir, `ambiguo` es la respuesta correcta, no una rendición.
4. Devolver la lista de 20 pares `{id, etiqueta_humana}`.
5. **No mirar** `muestra-133b.json` ni `pool-133b.json` antes de etiquetar — revelan el
   estrato y el veredicto del pre-filtro de cada caso. **Esto ahora es doblemente cierto**: ni
   el orden ni los campos del artefacto delatan esa información por sí solos.

**Solo después** de recibir los 20 pares se corren los anotadores A/B (plan 133-b-05).

## Self-Check: PASSED

- `packages/news/src/eval/calibracion.ts` — FOUND
- `packages/news/src/eval/calibracion.test.ts` — FOUND
- `packages/news/src/eval/calibracion-ceguera-guard.test.ts` — FOUND
- `packages/news/src/eval/calibracion-cli.ts` — FOUND
- `packages/news/src/eval/calibracion-20.json` — FOUND
- commit `f90ced5` (cierre original) — FOUND en `git log --oneline`
- commit `b5e209d` (cierre original) — FOUND en `git log --oneline`
- commit `2ea9092` (fix código) — FOUND en `git log --oneline`
- commit `a004b17` (fix artefacto) — FOUND en `git log --oneline`
- commit `fcdf674` (fix plan) — FOUND en `git log --oneline`
