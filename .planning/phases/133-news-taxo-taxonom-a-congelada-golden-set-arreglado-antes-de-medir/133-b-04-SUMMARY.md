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
  patterns: ["doble candado allowlist+denylist", "denylist con no-sobre-amplitud verificable", "guard recursivo sobre documento completo"]
key-files:
  created:
    - packages/news/src/eval/calibracion.ts
    - packages/news/src/eval/calibracion.test.ts
    - packages/news/src/eval/calibracion-ceguera-guard.test.ts
    - packages/news/src/eval/calibracion-cli.ts
    - packages/news/src/eval/calibracion-20.json
  modified: []
decisions: []
metrics:
  duration: "~50 min"
  completed: "2026-08-07"
---

# Phase 133 Plan b-04: calibracion.ts + calibracion-cli.ts — 20 casos a ciegas congelados, PLAN DETENIDO EN CHECKPOINT

Selección determinista de los 20 casos de calibración (12 de P por cuota de outlet, 5 de
N-alea, 3 de N-sonda) desde la muestra congelada de 133-b-02, con doble candado de ceguera
(allowlist estructural + denylist recursiva sobre el documento completo). **El plan se
detiene aquí — ningún caso fue etiquetado, ni por máquina ni por humano.**

## Qué NO se cumplió

Nada. Todos los gates numéricos, las 8 mutaciones y la reproducibilidad byte a byte salieron
exactos en la primera corrida, coincidiendo con `133-b-ADJUDICACION.md` §D-133b-5 sin ajustar
ningún literal.

## Precondición verificada

`133-b-03-SUMMARY.md` declara `gate=PASA` (línea 69: `umbral=0.95 gate=PASA`) — la cobertura
del censo P ya fue confirmada al 100,00 % antes de empezar este plan, tal como exige
D-133b-3.

## Números medidos

**`SHA_BASE`**: `ceba923870ef6c2f65ec14b9f463900c73e8cae5`

**Conteos de tests:**

| Momento | Tests | Delta |
|---|---|---|
| `N_ANTES` | 304 | — |
| Tras Task 1 (selección de los 20) | 310 (conceptual) | +6 |
| Tras Task 2 (artefacto + guard) | 317 | +13 total |

`317 - 304 = 13`, exactamente los 6 (Task 1) + 7 (Task 2) declarados.

**Cuota de P calculada** (piso 1 por outlet + mayores restos por déficit, desempate
alfabético explícito) sobre el censo real 74 = 50/11/6/6/1:

```
{ latercera: 8, lacuarta: 1, exante: 1, biobiochile: 1, cooperativa: 1 }
```

Coincide exacto con el literal de `<cuota_derivada>` del plan, suma 12.

**Línea `calibracion: ...` de la corrida real** (`pnpm --filter @obs/news exec tsx src/eval/calibracion-cli.ts`):

```
calibracion: casos=20 P=12 alea=5 sonda=3 outlets=5 sinDescripcion=2 clavesEscaneadas=128 ceguera=OK
```

Todos los gates numéricos exactos: `casos=20`, `P=12`, `alea=5`, `sonda=3`, `outlets=5` (los 5
outlets del censo tienen representación), `clavesEscaneadas=128 ≥ 100` (piso anti-cero-vacuo
del guard), `ceguera=OK`.

**Reparto real de los 20 por estrato y por outlet:**

| Estrato | n |
|---|---|
| P | 12 |
| N-alea | 5 |
| N-sonda | 3 |

| Outlet | n |
|---|---|
| latercera | 10 |
| lacuarta | 5 |
| biobiochile | 2 |
| cooperativa | 2 |
| exante | 1 |

(El reparto por outlet mezcla los 12 de P con lo que cayó de N-alea/N-sonda por outlet — los
5 outlets del censo P están representados en la cuota; N-alea/N-sonda no llevan cuota por
outlet, solo por estrato, así que su distribución de outlet es la que salió del sorteo.)

**Casos sin descripción: 2 de 20** (10 %, consistente con la tasa global de 10,9 % del
corpus — no se excluyeron ni se concentraron).

**Ceguera verificada sobre el archivo en disco (dos controles independientes):**

```
maquina_en_artefacto (calibracion-20.json) = 0
maquina_en_muestra   (muestra-133b.json, control positivo) = 308
```

El grep de denylist da 0 en el artefacto ciego y >0 en la muestra (que sí lleva
`estrato`/`url_hash`), confirmando que el patrón realmente busca algo.

**Sanity de un caso concreto** (primer `id` del artefacto):

```
id: latercera:130066a75a08
titulo: "Es un día negro para los municipios de Chile": alcaldes de oposición arremeten
        contra aprobación de la megarreforma y cuestionan compensación a comunas
outlet: latercera
claves del ítem ciego: [descripcion, fecha, id, outlet, titulo]  (exactamente 5, ninguna más)
```

Verificado a mano en `muestra-133b.json`: este `caso_id` pertenece al estrato **P**. Ese dato
**no está** en el artefacto ciego — confirmado por la lista de claves de arriba.

**Glosa derivada, verificada (W6 — `grep -oc` PROHIBIDO, se usó `grep -o | wc -l`):**

```
marca_decisoria (grep -c, hay al menos 1)   = 1 línea presente
marca_decisoria (grep -o | wc -l, conteo real) = 6
"etiqueta" (grep -o | wc -l)                = 6
```

Las 6 clases están, cada una con su `marca_decisoria`, y la clave `etiqueta` aparece
exactamente 6 veces — solo en la glosa (ningún caso la lleva, por `ItemCiegoSchema.strict()`).

**Reproducibilidad byte a byte:** `sha256sum calibracion-20.json` idéntico en dos corridas
consecutivas: **`061c7c6867801241fe5d4080766b18f16b1e1eb75f7d5ac89c2aef9d8154ba94`**.
**ADVERTENCIA EXPLÍCITA: este NO es el hash del `golden-set.json`** — ese se emite una sola
vez, al final, en el plan 133-b-07.

## Mutaciones (8, todas rojas nombrando su `it`, todas revertidas)

| Task | Mutación | Resultado |
|---|---|---|
| T1 | A — reparto proporcional puro (sin piso) | rc≠0, nombra **los dos** `(a)` y `(b)` (cooperativa cae a 0) |
| T1 | B — estratos colapsados (sonda tomada de N-alea) | rc≠0, nombra `(c)` |
| T1 | C — semilla ignorada | rc≠0, nombra `(e)` |
| T1 | D — filtro por descripción antes del sorteo | rc≠0, nombra `(f)` |
| T2 | A — denylist vacía | rc≠0, nombra **los dos** `(b)` y `(c)` |
| T2 | B — escaneo de un solo nivel (sin recursión) | rc≠0, nombra `(c)` |
| T2 | C — cero vacuo (quitar el `throw` de `casos:[]`) | rc≠0, nombra `(d)` |
| T2 | D — guard sobre-amplio (`etiqueta` añadida a la denylist) | rc≠0, nombra `(g)` |

**Nota sobre la Mutación C (T2) y el `it` (d):** el fixture inicial de (d)
(`{ ...artefactoBase(), casos: [] }`) no aislaba la mutación: al quitar el `throw` explícito de
"cero vacuo", el piso de conteo genérico (`objetosEscaneados<20 || clavesEscaneadas<100`)
seguía lanzando por una razón distinta (el artefacto base sin casos tiene pocas claves), así
que la mutación no ponía nada rojo por sí misma — coincidencia que habría ocultado una
regresión real. Se corrigió el fixture añadiendo relleno benigno (25 objetos, 125 claves, cero
claves de la denylist) para que el único motivo de fallo posible fuera el chequeo explícito de
`casos:[]`. Verificado: sin la corrección, la mutación no mordía (falso verde); con ella, sí.

## Deviations from Plan

**1. [Rule 1 — fixture insuficiente para aislar la mutación, corregido durante la ejecución]**
Ver nota de la Mutación C arriba. Corregido en `calibracion-ceguera-guard.test.ts` antes de
cualquier commit.

**2. [Rule 2 — ampliación menor del tipo, no contemplada literalmente por el plan]**
`CasoMuestraCalib` (que refleja `muestra-133b.json`) no tiene campo `descripcion` en el
archivo real. Para poder escribir el `it` (f) de Task 1 ("la selección no excluye los casos
sin descripción") de forma que la mutación asociada (insertar un filtro por descripción)
fuera genuinamente ejercitable, se añadió un campo `descripcion?: string | null` **opcional**
a la interfaz, usado solo por el fixture sintético del test — `muestra-133b.json` real nunca
lo trae, y `seleccionarCalibracion` nunca lo lee salvo en la mutación de prueba. No afecta el
comportamiento de producción.

## Lo que sí se cumplió

- Los 20 casos se seleccionan con la **misma semilla** (`133-b-golden-2026`), congelados
  **antes** de que exista una sola etiqueta de máquina.
- Cuota P exacta `{latercera:8, lacuarta:1, exante:1, biobiochile:1, cooperativa:1}`, calculada
  desde el censo real (no hardcodeada).
- Los 5 outlets del censo P tienen representación (`outlets=5`).
- **La ceguera se cumple por guard, no por promesa:** doble candado (allowlist estricta de 5
  claves + denylist recursiva sobre el documento completo), con su control positivo (Mutación
  A de T2 tumba el guard) y su control de no-sobre-amplitud **ejecutable** (Mutación D de T2:
  añadir `etiqueta` a la denylist SÍ tumba el guard sobre el artefacto real, confirmando que el
  escaneo cubre la glosa).
- El artefacto es byte-estable, reproducible sin red, y NO contiene ningún campo de máquina
  (verificado sobre el archivo en disco, no solo en memoria).
- `fecha_pub` se copia tal cual (offset original del feed) — `grep toISOString` = 0.
- `pnpm --filter @obs/news exec tsc --noEmit` sin errores. Suite completa: **317 passed**.
- Cero `pnpm add`. `git diff --name-only` lista exactamente los 5 archivos declarados.
- **El plan NO etiquetó ni un solo caso** — ni de máquina ni de humano. Ningún anotador corrió.
- No existe todavía ningún `golden-set.json`.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno — superficie coincide con `<threat_model>` de `133-b-04-PLAN.md` (T-133-52 a T-133-59,
T-133-65, T-133-SC), todas mitigadas.

## ⛔ ESTADO: DETENIDO EN CHECKPOINT DE OPERADOR (indelegable)

**El plan queda aquí.** El artefacto `packages/news/src/eval/calibracion-20.json` está
congelado y listo. **Ninguna etiqueta —de máquina o de humano— existe todavía.**

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
   estrato y el veredicto del pre-filtro de cada caso.

**Solo después** de recibir los 20 pares se corren los anotadores A/B (plan 133-b-05).

## Self-Check: PASSED

- `packages/news/src/eval/calibracion.ts` — FOUND
- `packages/news/src/eval/calibracion.test.ts` — FOUND
- `packages/news/src/eval/calibracion-ceguera-guard.test.ts` — FOUND
- `packages/news/src/eval/calibracion-cli.ts` — FOUND
- `packages/news/src/eval/calibracion-20.json` — FOUND
- commit `f90ced5` — FOUND en `git log --oneline`
- commit `b5e209d` — FOUND en `git log --oneline`
