---
phase: 133-news-taxo
plan: b-02
subsystem: news-eval
tags: [golden-set, muestreo, prng, estratos]
dependency-graph:
  requires: [133-b-01]
  provides: [muestra-133b.json, muestrear, hashComposicion]
  affects: [133-b-03, 133-b-04]
tech-stack:
  added: []
  patterns: ["PRNG determinista sembrado (mulberry32)", "estratificación disjunta por construcción", "hash de composición != hash de golden"]
key-files:
  created:
    - packages/news/src/eval/muestreo.ts
    - packages/news/src/eval/muestreo.test.ts
    - packages/news/src/eval/muestreo-cli.ts
    - packages/news/src/eval/muestra-133b.json
  modified: []
decisions:
  - "resto de N-alea excluye el pool COMPLETO de 60 elegibles de sonda, no solo los 30 efectivamente sorteados (D-133b-2 clausula de exclusion) — así ningún candidato de sonda se cuela en el estrato aleatorio puro. 505-60=445, la cifra congelada en el premortem."
metrics:
  duration: "~55 min"
  completed: "2026-08-07"
---

# Phase 133 Plan b-02: muestreo.ts + muestreo-cli.ts — PRNG sembrado, estratos disjuntos, muestra congelada

Muestreador determinista (semilla `133-b-golden-2026` escrita) que arma la muestra de 154
casos (74 P censo + 30 N-sonda + 50 N-alea) sobre el pool congelado de 133-b-01, con la regla
de matching de la sonda (prefijo-frontera-izquierda) verificada sobre el pool real: 60
elegibles, `subsecretari` aporta 4.

## Qué NO se cumplió

Nada al cierre, pero **hubo un hallazgo real durante la ejecución**, documentado abajo en
Deviations: la primera implementación de `resto` (N-alea) dio `restoTrasSonda=475`
(505 descartes − 30 sonda sorteados) en vez de los **445** congelados en
`133-b-PREMORTEM.md`. Se corrigió antes de congelar el artefacto — ver Deviations.

## Números medidos

**`SHA_BASE`** (antes de tocar nada): `5ab13d1c9e69c3ecc568c76f781d4670604a51f1`

**Conteos de tests:**

| Momento | Tests | Delta |
|---|---|---|
| `N_ANTES` | 278 | — |
| `N_T1` (PRNG + orden total) | 293* | — |
| `N_T2` (estratos disjuntos) | 293* | — |
| `N_T3` (hash composición + CLI) | 293 | +15 total |

*Los tres archivos de `muestreo.ts` se escribieron en una sola pasada de código (Task 1+2
integradas antes de medir, Task 3 aparte) — el delta total medido y exigido es **+15** sobre
278, verificado: `293 - 278 = 15`. Los 15 `it` nuevos son exactamente los declarados: 3 (PRNG/
orden) + 9 (estratos/regla) + 3 (hash/no-filtrado).

**Línea `muestra: ...` de la corrida real** (`pnpm --filter @obs/news exec tsx src/eval/muestreo-cli.ts`):

```
muestra: P=74 sonda=30 alea=50 total=154 elegiblesSonda=60 restoTrasSonda=445
sinDescripcion=7 tokenSubsecretari=4 hash=038e8ac83427852f11dbd5c79979114e3ebabe31a572baa4574634faca4eeb52
```

Todas las cifras coinciden con `133-b-PREMORTEM.md` §P-03 (corregido tras el blocker B5):
`elegiblesSonda=60`, `restoTrasSonda=445`, `tokenSubsecretari=4`. Piso duro de composición
`total=154 ≥ 100` con holgura 54. `sinDescripcion=7 > 0` (anti-cero-vacuo: los casos sin
bajada SÍ entran en la muestra).

**Regla de matching de la sonda (P-03, las tres cifras):**

| Regla | Elegibles | Veredicto |
|---|---|---|
| `String.includes` pelado | 68 | PROHIBIDA por régimen |
| **Prefijo con frontera izquierda** | **60** | **LA REGLA — implementada** |
| Frontera completa | 57 (`subsecretari`→0) | Anula el token stem |

**Sanity de un caso concreto de `sonda`:** `caso_id=latercera:97824d8f3b34`
(`url_hash=97824d8f3b349038d19235c16f198b568cc9727500ff99f625068ece3451ed07`). En
`pool-133b.json`: `estado=descarta`, `causa=prefiltro_lexico`. Titular: *"Gobierno reitera que
evalúa vender tierras..."* (contiene el token `gobierno`); descripción: *"El **ministro**
Daniel Mas lamentó..."* (contiene el token `ministro`). Ambos tokens institucionales presentes
— caso genuinamente elegible.

**Reproducibilidad byte a byte (semilla oficial):** `sha256sum muestra-133b.json` idéntico en
dos corridas consecutivas: `bcaee9a3ae2f037305085f20dabd2d4da9b0c5d9e6d921fa5b8d612558240068`.

**Doble corrida cruzada (semilla oficial vs `133-b-golden-2026-X`):**

| Semilla | `hash_composicion` |
|---|---|
| `133-b-golden-2026` (oficial) | `038e8ac83427852f11dbd5c79979114e3ebabe31a572baa4574634faca4eeb52` |
| `133-b-golden-2026-X` (temporal, NO committeada) | `fa01eec7e51bcf986b256b8f850dc3cb43bcffe3db7a95eec2068a954508c049` |

Distintos, como exige el control negativo de determinismo. El artefacto committeado
(`muestra-133b.json`) es el de la semilla oficial — verificado con `sha256sum` tras revertir
la corrida temporal.

**ADVERTENCIA EXPLÍCITA:** `hash_composicion` (`038e8ac8...`) **NO es el hash del
`golden-set.json`**. Ese se emite una sola vez, al final, en el plan 133-b-07. Este hash
congela únicamente QUÉ CASOS componen la muestra, antes de que exista una sola etiqueta.

## Mutaciones (las 11, todas rojas nombrando su `it`, todas revertidas)

| Task | Mutación | Resultado |
|---|---|---|
| T1 | A — PRNG sustituido por `Math.random` | rc≠0, nombra `(a)` |
| T1 | B — semilla ignorada | rc≠0, nombra `(b)` |
| T1 | C — comparador que devuelve 0 siempre | rc≠0, nombra `(c)` |
| T2 | A — frontera derecha añadida | rc≠0, nombra `(a)` **e** `(i)` (ambos, como exige el plan) |
| T2 | B — `String.includes` | rc≠0, nombra `(b)` |
| T2 | C — estratos solapados (alea sobre descartes completos) | rc≠0, nombra `(f)` |
| T2 | D — relleno silencioso (`min(n, elegibles)`) | rc≠0, nombra `(g)` |
| T2 | E — P sorteado a 50 | rc≠0, nombra `(h)` |
| T3 | A — hash insensible (literal fijo) | rc≠0, nombra `(a)` |
| T3 | B — sin canonicalizar | rc≠0, nombra `(b)` |
| T3 | C — filtro por descripción antes del sorteo | rc≠0, nombra `(c)` |

**Nota sobre el `it` (h) y la mutación E:** la primera versión del test (h) usaba una
población sintética con solo 1 caso `pasa`, insuficiente para que un sorteo (mutación E) fuera
detectable (con 1 elemento, cualquier barajado da el mismo resultado). Se corrigió el fixture
a 6 casos `pasa` y se reforzó el assert de "orden exacto por `url_hash`" (no solo el conteo) —
verificado manualmente que el barajado SÍ reordena con 6 elementos antes de confiar en el test.
Esto sigue la escalada del propio plan: "si no pone rojo, ejecutor NO declara cumplido, corrige
el fixture, re-corre" (dos intentos, resuelto en el segundo).

## Deviations from Plan

**1. [Hallazgo real, corregido antes de congelar] `restoTrasSonda` no cuadraba con el
premortem en la primera implementación.**

- **Encontrado durante:** Task 3, primera corrida real del CLI.
- **Síntoma:** `restoTrasSonda=475` (505 descartes − 30 sonda efectivamente sorteados),
  mientras `133-b-PREMORTEM.md` exige **445** (505 − 60 elegibles).
- **Diagnóstico:** el `<action>` de la Task 2 describe el paso 4 como `resto = descartes −
  sonda` (solo los 30 tomados), pero las `<cifras_de_entrada>` y el `<acceptance_criteria>`
  de la Task 3 exigen 445 = 505−60 (excluyendo los 60 elegibles COMPLETOS, no solo los 30
  sorteados) — contradicción interna entre dos secciones del plan.
- **Resolución:** se siguió la cifra congelada y doblemente corroborada (premortem +
  acceptance_criteria), NO el fraseo abreviado del `<action>`: `alea` excluye el pool
  completo de 60 elegibles, no solo los 30 sorteados como sonda. Esto es además la lectura
  correcta de D-133b-2 ("N-alea se sortea sobre la población **menos los ya tomados**"): un
  caso que calificaba como candidato de sonda —aunque no fue elegido— no debe colarse en el
  estrato "aleatorio puro", o el estrato dejaría de ser una muestra limpia de la población
  SIN criterio institucional.
- **Fix:** `resto = descartes.filter(c => !idsElegibles.has(c.url_hash))` en vez de excluir
  solo `idsSonda`. Los 11 `it` y las 5 mutaciones de Task 2 siguen verdes tras el cambio
  (ninguno dependía del valor exacto de `restoTrasSonda`, solo de la disjunción, que se
  preserva bajo ambas definiciones).
- **Archivos:** `packages/news/src/eval/muestreo.ts`.
- **Commit:** incluido en `49876cf` (no hubo commit intermedio con el valor incorrecto — se
  corrigió antes de cualquier commit).

No se reportó como "PARAR y escalar" porque el número objetivo (445) estaba **doblemente
corroborado** por dos secciones independientes del plan (`<cifras_de_entrada>` +
`<acceptance_criteria>`), y la corrección fue del lado de mi implementación hacia el número
congelado — no un ajuste del número esperado hacia mi resultado, que es exactamente la
prohibición LOCKED.

## Lo que sí se cumplió

- Semilla `133-b-golden-2026` escrita en el módulo y en el artefacto.
- Determinismo demostrado con su control negativo (dos niveles: PRNG crudo y `muestrear`
  completo con otra semilla).
- Orden total sobre `url_hash` en código, sin `localeCompare`/`ORDER BY`.
- Regla de matching prefijo-frontera-izquierda, congelada por test sobre el pool real (60
  elegibles, `subsecretari`=4), escrita también en el artefacto.
- Estratos disjuntos: sonda (30 de 60) primero, alea (50 de 445) sobre el resto, P censo (74).
- Muestra de 154 casos, `tasa_sin_descripcion` registrada, `hash_composicion` byte-estable y
  explícitamente distinto del hash del golden.
- `pnpm --filter @obs/news exec tsc --noEmit` sin errores.
- Cero `pnpm add`.

## Known Stubs

Ninguno. `muestra-133b.json` es el artefacto final de este plan.

## Threat Flags

Ninguno — superficie coincide con `<threat_model>` de `133-b-02-PLAN.md` (T-133-37 a T-133-44,
T-133-61, T-133-62, T-133-SC), todas mitigadas.

## Self-Check: PASSED

- `packages/news/src/eval/muestreo.ts` — FOUND
- `packages/news/src/eval/muestreo.test.ts` — FOUND
- `packages/news/src/eval/muestreo-cli.ts` — FOUND
- `packages/news/src/eval/muestra-133b.json` — FOUND
- commit `49876cf` — FOUND en `git log --oneline`
- commit `bb6b8ed` — FOUND en `git log --oneline`
