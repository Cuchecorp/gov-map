---
phase: 133-news-taxo
plan: 01
subsystem: eval-foundation
tags: [taxonomia, canonicalizacion, gitattributes, tdd]
dependency-graph:
  requires: []
  provides:
    - "packages/news/src/eval/taxonomia.ts (TAXONOMIA, ETIQUETAS, type Etiqueta)"
    - "packages/news/src/eval/canonicalizar-json.ts (canonicalizar, sha256)"
    - "packages/news/src/eval/index.ts (barrel, propiedad exclusiva de este plan)"
    - ".gitattributes (packages/news/src/eval/**/*.json text eol=lf)"
  affects:
    - "133-02, 133-03, 133-04 (consumen la taxonomía y el canonicalizador)"
tech-stack:
  added: []
  patterns:
    - "Object.freeze anidado (congelación profunda) para inmutabilidad en runtime"
    - "canonicalización JSON: claves ordenadas, arrays intactos, sha256 de node:crypto"
key-files:
  created:
    - .gitattributes
    - packages/news/src/eval/taxonomia.ts
    - packages/news/src/eval/taxonomia.test.ts
    - packages/news/src/eval/canonicalizar-json.ts
    - packages/news/src/eval/canonicalizar-json.test.ts
    - packages/news/src/eval/index.ts
  modified: []
decisions:
  - "Reescritura de comentarios JSDoc para evitar literales que los acceptance_criteria prohíben por grep -c == 0 (agenda_ejecutivo, prioridad, as const, localeCompare) — el significado se preservó, solo se cambió la redacción"
  - "Mutación de arrays con comparador basado en JSON.stringify (no .sort() por defecto): el .sort() sin comparador sobre un array de objetos es un no-op porque todos coercionan a la misma string '[object Object]', así que no habría probado nada"
metrics:
  duration: "~1h"
  completed: "2026-08-06"
---

# Phase 133 Plan 01: Fundación de 133-a — .gitattributes, taxonomía y canonicalizador Summary

**One-liner:** `.gitattributes` LOCKED primero, `taxonomia.ts` como SSoT ejecutable de las 6
clases de D-133-A2 con congelación profunda, y `canonicalizar-json.ts` con claves ordenadas
recursivas + arrays intactos + sha256 — las tres piezas que 133-b y los planes 03/04 necesitan
para congelar y hashear.

## Qué se construyó

1. **`.gitattributes`** (Task 1): una sola línea,
   `packages/news/src/eval/**/*.json text eol=lf`, commiteada sola, antes de que exista ningún
   JSON del directorio `eval/`. `git add --renormalize` **NO se ejecutó** en este plan (el
   directorio `eval/` no existía al momento de esta tarea → habría salido rc=128) — queda
   diferido al plan 133-03, tal como especifica el plan.

2. **`packages/news/src/eval/taxonomia.ts`** (Task 2, TDD): SSoT ejecutable de la taxonomía
   firmada D-133-A2. `TAXONOMIA` = array de 6 `ClaseTaxonomia` (`tramitacion_legislativa`,
   `actividad_parlamentaria`, `ley_vigente`, `politica_no_legislativa`, `no_legislativa`,
   `ambiguo`) en el orden de precedencia LOCKED. Congelación profunda (`Object.freeze` sobre
   cada objeto y luego sobre el array) — mutar `TAXONOMIA[0].etiqueta` lanza `TypeError` en
   runtime. `ETIQUETAS` se deriva de `TAXONOMIA.map(...)`.

3. **`packages/news/src/eval/canonicalizar-json.ts`** (Task 3, TDD): `canonicalizar(valor)`
   reordena las claves de objetos planos ascendente por code unit UTF-16 (recursivo), preserva
   el orden de los arrays (solo canonicaliza sus elementos), indentación 2 espacios, termina en
   `\n`. `sha256(raw)` usa `createHash("sha256")` de `node:crypto`. Cero dependencias nuevas.

4. **`packages/news/src/eval/index.ts`**: barrel del directorio, propiedad exclusiva de este
   plan, re-exporta exactamente `./taxonomia` y `./canonicalizar-json` (nada más — los módulos
   de 133-03/04 no existen todavía y `tsc -b` fallaría si se intentara re-exportarlos).

## Números medidos

| Momento | N (Tests passed) | Delta | Umbral del plan | Cumple |
|---|---|---|---|---|
| N_ANTES (baseline, antes de Task 2) | **206** | — | línea base documentada | ✅ coincide |
| N_T2 (tras Task 2 — taxonomia.ts) | **213** | +7 | delta fijo = 7 | ✅ exacto |
| N_T3 (tras Task 3 — canonicalizar-json.ts) | **219** | +6 (vs N_T2) | delta fijo = 6 | ✅ exacto |
| Total del plan | **219** | +13 (vs N_ANTES) | delta fijo = 13 | ✅ exacto |

Todos los conteos se extrajeron con el idiom obligatorio (`NO_COLOR=1 ... | tee LOG; grep -oE
'Tests[^0-9]+[0-9]+ passed' LOG | grep -oE '[0-9]+'`), nunca por exit code solo. Test Files pasó
de 12 a 14 (los dos `.test.ts` nuevos).

`pnpm --filter @obs/news exec tsc -b --force` → **rc=0** en las tres corridas (baseline, tras
Task 2, tras Task 3).

**`git check-attr`:**
```
packages/news/src/eval/x.json: text: set
packages/news/src/eval/x.json: eol: lf
packages/news/src/eval/sub/y.json: text: set
packages/news/src/eval/sub/y.json: eol: lf
packages/news/src/otro.json: text: unspecified
```
Control positivo (eval/x.json y eval/sub/y.json) y control negativo apareado (otro.json fuera
del directorio) verificados, ambos con el patrón `**` cubriendo subdirectorios.

**Pruebas de mutación (ambas fuera de `set -e`, con `if CMD; then rc=0; else rc=$?; fi`):**

- **Task 2 — orden de `TAXONOMIA`:** se intercambiaron las etiquetas de las dos primeras
  entradas. `vitest run taxonomia` → **rc=1**, 2 tests caen (el de orden exacto y el de
  `enruta_a`). Revertido con `cp` del backup (no `git checkout --`, porque el archivo aún no
  estaba trackeado en ese punto — el estado post-revert es idéntico: archivo untracked con el
  contenido original).
- **Task 3 — `.sort()` en arrays:** la primera mutación probada (`.sort()` sin comparador sobre
  un array de objetos) salió **rc=0** — no probaba nada, porque `Array.prototype.sort()` sin
  comparador coerciona cada objeto a `"[object Object]"` y todos empatan, dejando el orden
  intacto (sort estable). Se corrigió la mutación a un comparador real
  (`.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))`), que sí reordena por
  contenido. Con esa mutación: **rc=1**, cae exactamente el test `arrays no se reordenan:
  invertir ⇒ hash distinto`. Revertido.

## Desviaciones del plan

### Auto-fixed Issues (Rule 1 — corrección, no está en el catálogo del plan pero necesaria para cumplir sus propios acceptance_criteria)

**1. Literales prohibidos por `grep -c == 0` aparecían en comentarios JSDoc explicativos**

- **Encontrado durante:** Task 2 y Task 3, al correr los `acceptance_criteria` tras la primera
  redacción.
- **Problema:** los JSDoc que explican las decisiones de diseño citaban, por claridad, los
  términos que el propio plan prohíbe que aparezcan en el archivo (`agenda_ejecutivo`,
  `prioridad`, `as const` en `taxonomia.ts`; `localeCompare` en `canonicalizar-json.ts`). El
  criterio `grep -c '<término>' <archivo>` devuelve 0 es literal sobre el archivo completo, no
  solo sobre el código ejecutable.
- **Fix:** se re-redactaron los comentarios para preservar el significado sin usar esos
  literales (p.ej. "la sexta clase ejecutiva propuesta originalmente" en vez de nombrar
  `agenda_ejecutivo`; "una anotación de tipo puramente compile-time" en vez de `as const`; "un
  comparador sensible al locale de la máquina" en vez de `localeCompare`).
- **Archivos modificados:** `packages/news/src/eval/taxonomia.ts`,
  `packages/news/src/eval/canonicalizar-json.ts`.
- **Commits:** incluido en `777eb88` (taxonomia.ts) y `dc8081c` (canonicalizar-json.ts) — la
  corrección se hizo antes del commit GREEN, no como commit separado.
- **Verificado:** los cinco `grep -c` de los acceptance_criteria (agenda_ejecutivo, prioridad,
  as const, localeCompare, y el conteo de dependencias en package.json) devuelven 0 tras el
  fix.

**2. La mutación literal del plan (`.sort()` sobre arrays) no ejercitaba el test en objetos**

- **Encontrado durante:** Task 3, prueba de mutación.
- **Problema:** `Array.prototype.sort()` sin comparador coerciona cada elemento a string; para
  un array de objetos planos todos coercionan a `"[object Object]"`, así que el sort es un
  no-op (empate + sort estable). La primera corrida de la mutación salió rc=0, lo cual habría
  sido un falso verde silencioso si no se hubiera verificado el conteo/contenido del log.
- **Fix:** se ajustó la mutación a `.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))`,
  que sí reordena por contenido. Con esta mutación el test cae correctamente (rc=1).
- **Nota:** esto NO es un bug del código de producción — `canonicalizar-json.ts` nunca tuvo
  `.sort()`; es un ajuste al procedimiento de verificación (la mutación de prueba, no el
  artefacto) para que efectivamente ejerza el comportamiento que el test protege.

### Ningún otro deviation. El resto del plan se ejecutó exactamente como está escrito.

## Auth gates

Ninguno — plan sin llamadas a servicios externos ni credenciales.

## Known Stubs

Ninguno. `taxonomia.ts` y `canonicalizar-json.ts` son módulos puros y completos según su
interfaz declarada; no hay datos mock ni placeholders.

## Threat Flags

Ninguno. Los tres threats del `<threat_model>` (T-133-01, T-133-02, T-133-03, T-133-19) están
mitigados exactamente como se diseñó, sin superficie nueva no contemplada.

## Self-Check

Verificación de archivos y commits declarados:

```
FOUND: .gitattributes
FOUND: packages/news/src/eval/taxonomia.ts
FOUND: packages/news/src/eval/taxonomia.test.ts
FOUND: packages/news/src/eval/canonicalizar-json.ts
FOUND: packages/news/src/eval/canonicalizar-json.test.ts
FOUND: packages/news/src/eval/index.ts
FOUND: d9e52b8 (chore .gitattributes)
FOUND: 6b45c33 (test taxonomia RED)
FOUND: 777eb88 (feat taxonomia GREEN)
FOUND: 98c1163 (test canonicalizar RED)
FOUND: dc8081c (feat canonicalizar GREEN)
```

## Self-Check: PASSED

## TDD Gate Compliance

Task 2 y Task 3 (`tdd="true"`): ambas tienen `test(...)` commit (RED) seguido de `feat(...)`
commit (GREEN) en `git log`. No hubo `refactor(...)` — no fue necesario. Gate sequence completo
en ambas tareas.
