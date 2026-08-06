---
phase: 133-news-taxo
plan: 06
subsystem: eval-foundation
tags: [gap-closure, zod, canonicalizacion, truncado, honestidad]
dependency-graph:
  requires:
    - "133-01..05 (taxonomia congelada, prefiltro, entrada-llm, caso-golden, guards)"
    - "133-REVIEW.md (code review: 0 CRITICAL, 3 HIGH, 5 MEDIUM, 5 LOW)"
  provides:
    - "packages/news/src/eval/caso-golden.ts (CasoGoldenSchema con superRefine de coherencia)"
    - "packages/news/src/eval/canonicalizar-json.ts (ordenar() lanza ante entradas no-canonicalizables)"
    - "packages/news/src/prefiltro-lexico.ts (truncarDescripcion nunca vacía la descripción)"
  affects:
    - "133-b (golden-set.json usará CasoGoldenSchema endurecido; la vara ya no acepta contradicciones)"
tech-stack:
  added: []
  patterns:
    - "superRefine con path por campo para coherencia cross-field en esquemas zod"
    - "canonicalizador que invierte el default: todo lo no reconocido LANZA, nunca degrada"
key-files:
  modified:
    - packages/news/src/eval/caso-golden.ts
    - packages/news/src/eval/caso-golden.test.ts
    - packages/news/src/eval/canonicalizar-json.ts
    - packages/news/src/eval/canonicalizar-json.test.ts
    - packages/news/src/prefiltro-lexico.ts
    - packages/news/src/prefiltro-lexico.test.ts
    - .planning/phases/133-news-taxo-taxonom-a-congelada-golden-set-arreglado-antes-de-medir/133-04-SUMMARY.md
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "HIGH-1/WR-01: CasoGoldenSchema gana un superRefine con 4 reglas de coherencia (acuerdo↔etiquetas, acuerdo↔resuelto_por, calibración↔etiqueta_humana, etiqueta final debe provenir de la revisión). Sin datos etiquetados aún (133-a sigue sin golden set)."
  - "HIGH-2/WR-02: canonicalizar() acepta Object.create(null) igual que {} (ambos son diccionarios planos), pero invierte el default — cualquier otro tipo (Map/Date/Set/función/undefined-en-array) LANZA en vez de degradar. Verificado: sha256 de taxonomia.json y thresholds.json IDÉNTICOS antes/después."
  - "HIGH-3/WR-03: truncarDescripcion nunca devuelve '' con entrada no vacía — si la limpieza de cola vacía el resultado, se devuelve el corte duro sin limpiar (recall-first: perder una palabra es preferible a perder la noticia)."
metrics:
  duration: "~1h"
  completed: "2026-08-06"
---

# Phase 133 Plan 06: gap closure — 3 HIGH + 2 honestidad del code-review de 133-a Summary

**One-liner:** Cierra los 3 HIGH del code-review (esquema golden que aceptaba contradicciones,
canonicalizador que degradaba en silencio, truncado que podía vaciar la descripción entera) y
los 2 ítems de honestidad (número de flips medido y comentarios JSDoc actualizados), sin tocar
contenido congelado ni etiquetar ningún caso.

## Qué se construyó

### HIGH-1 (WR-01) — `caso-golden.ts`

`CasoGoldenSchema` gana un `.superRefine()` con 4 reglas de coherencia interna, cada una con
su `path` por campo para que el mensaje de error señale el campo exacto:

1. `acuerdo` debe ser exactamente `(etiqueta_a === etiqueta_b)` — no puede declararse acuerdo
   con etiquetas divergentes ni desacuerdo con etiquetas iguales.
2. `acuerdo:true` exige `resuelto_por:"acuerdo"`; `acuerdo:false` prohíbe `resuelto_por:"acuerdo"`.
3. `en_calibracion_humana:true` exige `etiqueta_humana` no nula.
4. `etiqueta` (la de verdad-terreno) debe provenir de `etiqueta_a`, `etiqueta_b` o
   `etiqueta_humana` — no puede ser un valor inventado que ninguna revisión produjo.

8 tests nuevos en `caso-golden.test.ts` (6 negativos, uno por regla que puede violarse en dos
direcciones donde aplica, + 2 controles positivos apareados que confirman que un caso
coherente con calibración humana o con etiqueta proveniente de `etiqueta_humana` sigue
validando). Total del archivo: 7→15 tests.

### HIGH-2 (WR-02) — `canonicalizar-json.ts`

Dos cambios en `ordenar()`:

- `esObjetoPlano` ahora acepta **tanto** `Object.prototype` como `null` como prototipo válido
  (`Object.create(null)` es un diccionario plano igual que `{}`; antes caía a la rama
  "primitivo" y salía sin ordenar sus claves).
- La rama final (antes `return valor;` para cualquier no-array/no-objeto-plano) ahora
  **lanza** salvo que el valor sea `null`, `string`, `number` o `boolean` — los únicos
  primitivos JSON reales. `undefined` (incluso dentro de un array), `Map`, `Set`, `Date`,
  funciones, y cualquier objeto de prototipo no reconocido, lanzan con un mensaje que nombra
  el `typeof` y el `Object.prototype.toString`.

6 tests nuevos en `canonicalizar-json.test.ts` + 1 control positivo apareado (mismo objeto
sin el campo problemático no lanza). Total del archivo: 6→12 tests.

### HIGH-3 (WR-03) — `prefiltro-lexico.ts`

`truncarDescripcion` ya no puede devolver `""` con una entrada no vacía: si la limpieza de
cola (`\S*$` → `""`) deja el resultado vacío mientras el corte original (`cortado`) no lo
estaba, se devuelve `cortado` sin limpiar. Es el caso de un blob sin ningún espacio (slug/URL
largo) que cruza el límite de truncado.

2 tests nuevos en `prefiltro-lexico.test.ts`: el caso de blob puro (`"a".repeat(700)`) y un
control positivo apareado con espacios que confirma que el comportamiento normal (limpiar la
cola parcial) sigue intacto. Total del archivo: 35→37 tests.

## Sha256 antes y después de tocar `canonicalizar-json.ts`

| Archivo | sha256 ANTES | sha256 DESPUÉS | ¿Cambió? |
|---|---|---|---|
| `taxonomia.json` | `90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c` | `90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c` | **NO** |
| `thresholds.json` | `e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e` | `e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e` | **NO** |

Verificado ejecutando `canonicalizar-cli.ts` (vía `tsx`) tras el fix — los hashes impresos
coinciden byte a byte con los citados en `congelado.test.ts` (`HASH_TAXONOMIA`/
`HASH_THRESHOLDS`) y con el `git diff --stat` (vacío) sobre los dos JSON. `congelado.test.ts`
(8 tests, incluidas las comparaciones de sincronía byte-a-byte `.ts`→`.json`) sigue en verde.
El fix es de robustez ante tipos no soportados, no de contenido.

## Conteo de tests por ítem, con delta

| Archivo | Antes | Después | Delta |
|---|---|---|---|
| `caso-golden.test.ts` | 7 | 15 | +8 |
| `canonicalizar-json.test.ts` | 6 | 12 | +6 |
| `prefiltro-lexico.test.ts` | 35 | 37 | +2 |
| **`@obs/news` (suite completa)** | **252** | **268** | **+16** |
| `app/lib/anti-insinuacion-guard.test.ts` | 61 | 61 | 0 (solo prosa, HONESTIDAD-2) |

Extraído con `NO_COLOR=1 pnpm --filter @obs/news exec vitest run` → `Test Files 19 passed
(19)`, `Tests 268 passed (268)`. `tsc -b packages/news --force` → rc=0.

## Mutaciones — rc y test caído, citados

Idiom en todas: `if CMD > log 2>&1; then rc=0; else rc=$?; fi` — nunca bajo `set -e`.

| Mutación | Qué se mutó | rc | Test(s) que cae | Revertido |
|---|---|---|---|---|
| WR-01 | `.superRefine(...)` reemplazado por `function NOOP(){}` sin adjuntar al schema | **1** | Los 6 `it` negativos nuevos (acuerdo↔etiquetas ×2, acuerdo↔resuelto_por ×2, calibración↔etiqueta_humana, etiqueta-proveniencia) | ✅ |
| WR-02a (throw) | rama final vuelve a `return valor;` sin lanzar | **1** | 4 tests: `undefined` en array, `Map`, `Date`, función | ✅ |
| WR-02b (proto null) | `esObjetoPlano` solo acepta `Object.prototype` (quita `\|\| proto === null`) | **1** | `Object.create(null) con claves desordenadas ⇒ SÍ se reordenan` | ✅ |
| WR-03 | `truncarDescripcion` vuelve a `texto.slice(0, limite).replace(/\S*$/, "")` sin el guard de vacío | **1** | `WR-03: un blob sin espacios NUNCA devuelve la cadena vacía` | ✅ |

Ninguna mutación requirió escalada — todas mordieron al primer intento, sobre el archivo
exacto que su regla protege, sin afectar los tests preexistentes.

## HONESTIDAD-1 — medición del impacto de comportamiento (WR-04)

Reproducido independientemente sobre los 5 fixtures RSS reales (`biobiochile`, `cooperativa`,
`latercera`, `lacuarta`, `exante`): comparando `esLegislativo()` calculado con la función
`truncarDescripcion` **VIEJA** (buggy, `.replace` incondicional) vs. la **ACTUAL** (con los
dos guards: caso-corto de 133-04 + blob-sin-espacios de WR-03):

- **`total_items = 85`**
- **`bajo_límite = 68`** (68/85 descripciones tenían longitud ≤ límite de truncado — el
  100% de esas 68 estaban expuestas al bug original antes del fix de 133-04)
- **`flips = 0`** — ningún ítem cambió de veredicto (`esLegislativo` true/false) entre la
  función vieja y la actual.

Cifra idéntica a la citada por el reviewer en `133-REVIEW.md` WR-04 (0/85 flips, 68/85 bajo
el límite). Añadido a `133-04-SUMMARY.md` con la redacción corregida: el criterio de
"diff-cero" se distingue explícitamente entre "diff-cero de la SUITE preexistente" (cierto) y
"el comportamiento de producción cambió por diseño" (también cierto — es el bug fix), en vez
de la redacción original que conflaba ambos.

## HONESTIDAD-2 — comentarios JSDoc actualizados (`anti-insinuacion-guard.test.ts`)

12 comentarios en `app/lib/anti-insinuacion-guard.test.ts` prometían tolerancia silenciosa
ante rutas ausentes ("se salta sin fallar", "guard VERDE", "las rutas aún ausentes se saltan
hoy"), comportamiento que **G3** (plan 133-05, `leerSuperficie`) reemplazó por un `throw`
duro. Actualizados a prosa que describe el comportamiento VIGENTE (lanza, no salta) o, para
las 4 notas narrativas de Wave-0 que describían una fase transitoria ya cerrada, a pasado
("se declararon", "existía ya") con nota explícita de que G3 cambió la tolerancia. Solo
prosa — cero cambios de lógica.

**Conteo de tests verificado sin cambio:** `anti-insinuacion-guard.test.ts` 61/61 antes y
después. `pnpm guards` completo: `app` 351, `@obs/dinero` 34, `@obs/llm` 7, `@obs/news` 18 —
todos verdes, mismos conteos que antes de tocar los comentarios.

## Deuda anotada para 133-b (NO resuelta aquí — fuera de alcance por `<no_hacer>`)

**WR-05 de `133-REVIEW.md`: estampa de versión del pre-filtro.** `carga-run.ts:146` registra
el descarte con `causa: "prefiltro_lexico"` constante, sin versión. Las 25 filas de PROD
descartadas antes de 133-04/133-06 se filtraron con la versión **con** el bug de
`truncarDescripcion` (arrancaba la última palabra de descripciones cortas, y podía vaciar
descripciones-blob enteras); cualquier re-derivación desde R2 en 133-b correrá la versión
arreglada. **Decisión explícita de 133-06: NO se estampa la versión aquí** — es decisión de
133-b porque afecta el ledger y los datos ya en PROD (`<no_hacer>` de este plan lo prohíbe
explícitamente). **Queda escrito para 133-b:** las filas de `estado='descarta'` anteriores a
los commits `531d130` (fix caso-corto) y el commit de WR-03 de este plan deben re-derivarse
desde R2, no reutilizarse, si 133-b necesita reconstruir el universo de candidatos
descartados.

## Deviations from Plan

Ninguna. Los 3 HIGH y los 2 ítems de honestidad se cerraron exactamente como el prompt de
gap-closure los especificó, sin architecture changes ni bugs adicionales descubiertos fuera
de alcance.

## Auth gates

Ninguno.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno. Los cambios son endurecimiento de validación (zod refine), robustez de
canonicalización (throw en vez de degradar) y corrección de un bug preexistente de pérdida
de datos (recall-first) — ninguno introduce superficie nueva de red, auth, ni PII.

## Self-Check

```
FOUND: packages/news/src/eval/caso-golden.ts
FOUND: packages/news/src/eval/caso-golden.test.ts
FOUND: packages/news/src/eval/canonicalizar-json.ts
FOUND: packages/news/src/eval/canonicalizar-json.test.ts
FOUND: packages/news/src/prefiltro-lexico.ts
FOUND: packages/news/src/prefiltro-lexico.test.ts
FOUND: app/lib/anti-insinuacion-guard.test.ts
FOUND: .planning/phases/133-news-taxo-taxonom-a-congelada-golden-set-arreglado-antes-de-medir/133-04-SUMMARY.md
FOUND: 70519ff (fix WR-01 caso-golden.ts)
FOUND: 2fd9a82 (fix WR-02 canonicalizar-json.ts)
FOUND: 099767b (fix WR-03 prefiltro-lexico.ts)
FOUND: 04ee6a6 (docs HONESTIDAD-1 133-04-SUMMARY.md)
FOUND: 48280ad (docs HONESTIDAD-2 anti-insinuacion-guard.test.ts)
```

## Self-Check: PASSED
