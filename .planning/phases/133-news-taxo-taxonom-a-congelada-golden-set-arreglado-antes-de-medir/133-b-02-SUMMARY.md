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
  - "CORREGIDO post-cierre: N-alea excluye SOLO los 30 casos efectivamente sorteados como sonda, NUNCA el pool elegible completo de 60 (D-133b-2: \"la población menos los YA TOMADOS\" = los sorteados). 505-30=475 es la cifra correcta; 445 (505-60) era un parentesis descuidado del premortem que el planner horneo en el acceptance_criteria, y que mi primera ejecucion siguio por estar doblemente corroborado en el texto del plan. El coordinador lo detecto midiendo 0 casos con token institucional en N-alea sobre el artefacto — la senal exacta del bug."
metrics:
  duration: "~55 min (+ ~25 min de fix post-cierre)"
  completed: "2026-08-07"
---

# Phase 133 Plan b-02: muestreo.ts + muestreo-cli.ts — PRNG sembrado, estratos disjuntos, muestra congelada

Muestreador determinista (semilla `133-b-golden-2026` escrita) que arma la muestra de 154
casos (74 P censo + 30 N-sonda + 50 N-alea) sobre el pool congelado de 133-b-01, con la regla
de matching de la sonda (prefijo-frontera-izquierda) verificada sobre el pool real: 60
elegibles, `subsecretari` aporta 4.

**Este plan fue corregido post-cierre.** El cierre original (commits `49876cf`/`bb6b8ed`)
implementó `N-alea` excluyendo el pool elegible completo (60), dando `restoTrasSonda=445`. El
coordinador detectó que esto era un defecto de fondo, no cosmético: **0 de los 50 casos de
`N-alea` llevaban token institucional**, vaciando sistemáticamente el estrato "aleatorio puro"
de los casos con mayor probabilidad de ser falso negativo del pre-filtro — exactamente lo que
ese estrato existe para detectar. Ver "Deviations" para el relato completo, incluyendo el
razonamiento (equivocado) que me llevó a la primera resolución.

## Qué NO se cumplió (en el cierre original, ya corregido)

**El cierre original tenía un defecto de fondo, no cosmético.** La primera implementación de
`resto` (N-alea) excluía el pool elegible completo (60 casos), dando `restoTrasSonda=445`. Esto
seguía la letra de `<cifras_de_entrada>` y `<acceptance_criteria>` del plan (que a su vez
horneaban un paréntesis descuidado de `133-b-PREMORTEM.md`), pero **contradecía la
adjudicación real** (D-133b-2: *"N-alea se sortea sobre la población menos los YA TOMADOS"* —
los 30 sorteados, no los 60 elegibles) y producía un estrato "aleatorio" sin NINGÚN caso con
token institucional. Corregido en esta revisión — ver Deviations para el detalle completo y la
autocrítica de por qué mi primera resolución fue el lado equivocado de la contradicción.

## Números medidos

**`SHA_BASE`** (antes de tocar nada, corrida original): `5ab13d1c9e69c3ecc568c76f781d4670604a51f1`

**Conteos de tests:**

| Momento | Tests | Delta |
|---|---|---|
| `N_ANTES` | 278 | — |
| Cierre original (293) | 293 | +15 |
| **Tras el fix post-cierre (+1 test `(j)`)** | **304** | **+16 sobre 278** |

El delta original de 15 (3 PRNG/orden + 9 estratos/regla + 3 hash/no-filtrado) se mantiene; se
añade el `it` (j) obligatorio exigido por el coordinador: *"N-alea contiene AL MENOS UN caso
con token institucional"*. `304 - 278 = 16` (delta total final, citado en el plan actualizado).

**Línea `muestra: ...` — ANTES del fix (defectuosa, corrida original):**

```
muestra: P=74 sonda=30 alea=50 total=154 elegiblesSonda=60 restoTrasSonda=445
sinDescripcion=7 tokenSubsecretari=4 hash=038e8ac83427852f11dbd5c79979114e3ebabe31a572baa4574634faca4eeb52
```

**Línea `muestra: ...` — DESPUÉS del fix (corrida real, corregida):**

```
muestra: P=74 sonda=30 alea=50 total=154 elegiblesSonda=60 restoTrasSonda=475 sinDescripcion=5
tokenSubsecretari=4 aleaConToken=4 hash=28538d9031e434fe3b0b11d06830c230feec683aa1508d3dbf5e8d9bf79dc379
```

**El número que cambió y por qué importa:** `restoTrasSonda` 445 → **475** (505 descartes − 30
sorteados, no − 60 elegibles). **`aleaConToken` (campo nuevo, gate permanente): 0 → 4.** Esa es
la medición que expone el defecto: con la exclusión incorrecta, ningún caso de `N-alea` podía
llevar token institucional POR CONSTRUCCIÓN (los 60 elegibles —que son precisamente los únicos
casos con token— quedaban todos fuera de `alea`, sorteados o no). Con la exclusión correcta,
los 30 elegibles-no-sorteados permanecen disponibles, y 4 de ellos cayeron en la muestra final
de 50.

`sinDescripcion` también cambió (7 → 5) porque el pool de 475 candidatos difiere del de 445:
es una consecuencia esperada del cambio de universo de muestreo, no un hallazgo nuevo.

**Regla de matching de la sonda (P-03, las tres cifras — sin cambios por este fix):**

| Regla | Elegibles | Veredicto |
|---|---|---|
| `String.includes` pelado | 68 | PROHIBIDA por régimen |
| **Prefijo con frontera izquierda** | **60** | **LA REGLA — implementada** |
| Frontera completa | 57 (`subsecretari`→0) | Anula el token stem |

**Sanity de un caso concreto de `sonda`** (sin cambios: `sonda` no se tocó por este fix):
`caso_id=latercera:97824d8f3b34`. En `pool-133b.json`: `estado=descarta`,
`causa=prefiltro_lexico`. Titular: *"Gobierno reitera que evalúa vender tierras..."* (token
`gobierno`); descripción: *"El **ministro** Daniel Mas lamentó..."* (token `ministro`).

**Reproducibilidad byte a byte (semilla oficial, tras el fix):** `sha256sum muestra-133b.json`
idéntico en dos corridas consecutivas:
`4aa298dfa3ca8ee4f9b4b20598cd55f157b65b871125ae9d0a88b0f878068585`.

**`hash_composicion` — antes y después del fix:**

| Momento | `hash_composicion` |
|---|---|
| Cierre original (defectuoso) | `038e8ac83427852f11dbd5c79979114e3ebabe31a572baa4574634faca4eeb52` |
| **Tras el fix (correcto, committeado)** | `28538d9031e434fe3b0b11d06830c230feec683aa1508d3dbf5e8d9bf79dc379` |

El cambio de hash es **esperado y no cuesta nada**: no se ha etiquetado ni un solo caso —
exactamente la razón por la que D-133b-3 exige congelar la muestra ANTES de etiquetar.

**Doble corrida cruzada (semilla oficial vs `133-b-golden-2026-X`, verificación previa al
fix, sigue vigente como control de determinismo):** hashes `038e8ac8...` vs `fa01eec7...`,
distintos como exige el control negativo. No se repitió tras el fix porque el mecanismo de
determinismo (PRNG, re-siembra por estrato) no cambió — solo cambió QUÉ conjunto de índices se
excluye antes de barajar `alea`.

**ADVERTENCIA EXPLÍCITA (sigue vigente):** `hash_composicion` **NO es el hash del
`golden-set.json`**. Ese se emite una sola vez, al final, en el plan 133-b-07.

## Mutaciones (12 tras el fix, todas rojas nombrando su `it`, todas revertidas)

| Task | Mutación | Resultado |
|---|---|---|
| T1 | A — PRNG sustituido por `Math.random` | rc≠0, nombra `(a)` |
| T1 | B — semilla ignorada | rc≠0, nombra `(b)` |
| T1 | C — comparador que devuelve 0 siempre | rc≠0, nombra `(c)` |
| T2 | A — frontera derecha añadida | rc≠0, nombra `(a)` **e** `(i)` |
| T2 | B — `String.includes` | rc≠0, nombra `(b)` |
| T2 | C — estratos solapados (alea sobre descartes completos) | rc≠0, nombra `(f)` |
| T2 | D — relleno silencioso (`min(n, elegibles)`) | rc≠0, nombra `(g)` |
| T2 | E — P sorteado a 50 | rc≠0, nombra `(h)` |
| **T2** | **F (nueva, post-cierre) — exclusión vuelta a `idsElegibles` (60) en vez de `idsSonda` (30)** | **rc≠0, nombra `(j)`** |
| T3 | A — hash insensible (literal fijo) | rc≠0, nombra `(a)` |
| T3 | B — sin canonicalizar | rc≠0, nombra `(b)` |
| T3 | C — filtro por descripción antes del sorteo | rc≠0, nombra `(c)` |

**Nota sobre el `it` (h) y la mutación E (histórico, sigue vigente):** la primera versión del
test (h) usaba una población sintética con solo 1 caso `pasa`, insuficiente para que un sorteo
fuera detectable. Se corrigió el fixture a 6 casos `pasa` con assert de orden exacto.

## Deviations from Plan

**1. [Rule 4 — defecto de fondo, corregido POST-CIERRE por el coordinador] La exclusión de
`N-alea` usaba el pool elegible completo (60) en vez de los sorteados (30).**

- **Encontrado durante:** revisión del coordinador sobre el artefacto ya committeado
  (`hash_composicion=038e8ac8...`), midiendo `aleaConToken=0` sobre los 50 casos de `N-alea`.
- **Síntoma:** `restoTrasSonda=445` (505 − 60 elegibles), en vez de **475** (505 − 30
  sorteados).
- **Lo que hice mal en el cierre original:** documenté correctamente la contradicción entre el
  `<action>` de la Task 2 (`resto = descartes − sonda`, los 30 tomados) y las
  `<cifras_de_entrada>`/`<acceptance_criteria>` (445 = 505−60), pero **elegí el lado
  equivocado**: seguí el número "doblemente corroborado" por dos secciones del plan en vez del
  texto normativo de la adjudicación (`133-b-ADJUDICACION.md` §D-133b-2: *"N-alea se sortea
  sobre la población menos los YA TOMADOS"*). Un número que aparece dos veces en un documento
  derivado no pesa más que la fuente que ese documento debía reflejar — y el propio premortem,
  al corregirse, confirmó que 445 nació de un paréntesis descuidado (505−60) que nunca debió
  escribirse así.
- **Por qué NO era cosmético:** con la exclusión de 60, **todos** los casos con token
  institucional (que son, por definición, exactamente los 60 elegibles) quedaban fuera de
  `N-alea` — sorteados como sonda o no. El estrato "aleatorio puro" que existe para estimar la
  tasa de falso negativo del pre-filitro FUERA del criterio de sonda quedaba sistemáticamente
  vaciado de los casos con mayor probabilidad de serlo. Habría producido una tasa de falso
  negativo optimista por construcción en la fase 135, sin que ningún test lo hubiera detectado
  — el defecto solo era visible midiendo la composición real del estrato, no sus tamaños.
- **Fix:** `resto = descartes.filter(c => !idsSonda.has(c.url_hash))` — excluir únicamente los
  `url_hash` de `sonda` (30), no de `elegibles` (60).
- **Verificación añadida:** `it` (j) nuevo, obligatorio: `N-alea` debe contener ≥1 caso con
  token institucional. Sobre el pool real: **4** casos (`lacuarta:e2081a3813b3`,
  `latercera:e431f21887e3`, `exante:a54c8f0936ec`, `cooperativa:4ad451b43944`). Mutación
  apareada (volver a `idsElegibles`) confirmada roja, nombrando `(j)`.
- **Archivos:** `packages/news/src/eval/muestreo.ts`, `muestreo.test.ts`, `muestreo-cli.ts`,
  `muestra-133b.json`, y `133-b-02-PLAN.md` (los 445 reemplazados por 475 en cifras_de_entrada,
  action, acceptance_criteria, threat register, verification, success_criteria).
- **Commits:** `e467f3f` (fix de código + test), `0e1202a` (re-congelado del artefacto),
  `a472919` (corrección del plan).

## Lo que sí se cumplió (tras el fix)

- Semilla `133-b-golden-2026` escrita en el módulo y en el artefacto.
- Determinismo demostrado con su control negativo.
- Orden total sobre `url_hash` en código, sin `localeCompare`/`ORDER BY`.
- Regla de matching prefijo-frontera-izquierda, congelada por test sobre el pool real (60
  elegibles, `subsecretari`=4).
- **Estratos disjuntos y CORRECTAMENTE construidos:** sonda (30 de 60) primero, alea (50 de
  475, con `aleaConToken=4` ≥ 1) sobre el resto, P censo (74). `sonda∩alea=∅`, `P∩(sonda∪alea)=∅`
  verificados sobre el artefacto final (0 intersecciones).
- Muestra de 154 casos (74+30+50), `tasa_sin_descripcion` registrada, `hash_composicion`
  byte-estable (`4aa298df...`) y explícitamente distinto del hash del golden.
- `pnpm --filter @obs/news exec tsc --noEmit` sin errores. Suite completa: **304 passed**.
- Cero `pnpm add`. `pool-133b.json` NO se tocó (verificado: solo 4 archivos modificados). El
  conector de news NO se corrió.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno nuevo. El defecto corregido corresponde a **T-133-40** (estratos solapados/sesgados)
del `<threat_model>` original de `133-b-02-PLAN.md` — el gate de disjunción (`it` (f)) pasaba
igual bajo ambas definiciones de `resto` porque disjunción no es lo mismo que composición sin
sesgo; el gate que faltaba (y que ahora existe como `it` (j)) es el de **composición mínima
del estrato**, no solo su tamaño o su disjunción.

## Self-Check: PASSED

- `packages/news/src/eval/muestreo.ts` — FOUND
- `packages/news/src/eval/muestreo.test.ts` — FOUND
- `packages/news/src/eval/muestreo-cli.ts` — FOUND
- `packages/news/src/eval/muestra-133b.json` — FOUND
- commit `49876cf` (cierre original) — FOUND en `git log --oneline`
- commit `bb6b8ed` (cierre original) — FOUND en `git log --oneline`
- commit `e467f3f` (fix código) — FOUND en `git log --oneline`
- commit `0e1202a` (fix artefacto) — FOUND en `git log --oneline`
- commit `a472919` (fix plan) — FOUND en `git log --oneline`
