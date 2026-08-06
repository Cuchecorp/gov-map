---
phase: 133-news-taxo
plan: 03
subsystem: eval-congelacion
tags: [congelacion, sha256, ci, tdd]
dependency-graph:
  requires:
    - "133-01 (taxonomia.ts, canonicalizar-json.ts, index.ts, .gitattributes)"
  provides:
    - "packages/news/src/eval/taxonomia.json (proyección canónica congelada)"
    - "packages/news/src/eval/thresholds.json (T1..T9 como array LOCKED)"
    - "packages/news/src/eval/CONGELADO.md (log de congelación)"
    - "packages/news/src/eval/congelado.test.ts (vara del drift)"
    - "step de CI para @obs/news en .github/workflows/ci.yml"
  affects:
    - "133-b (golden-set.json se congela con el mismo régimen)"
    - "133-04, 133-05 (misma wave; consumen taxonomia.json/thresholds.json congelados)"
tech-stack:
  added: []
  patterns:
    - "congelación por sha256 de bytes canonicalizados, patrón freeze.ts/disjuncion.test.ts sin dependencia de @obs/llm-bench"
    - "orden LOCKED en array (no objeto) para que la canonicalización no destruya la precedencia semántica"
key-files:
  created:
    - packages/news/src/eval/thresholds.ts
    - packages/news/src/eval/canonicalizar-cli.ts
    - packages/news/src/eval/taxonomia.json
    - packages/news/src/eval/thresholds.json
    - packages/news/src/eval/CONGELADO.md
    - packages/news/src/eval/congelado.test.ts
  modified:
    - .github/workflows/ci.yml
decisions:
  - "Reescritura de un fragmento del JSDoc de congelado.test.ts que citaba literalmente 'toEqual' — tripeaba el propio grep -c del acceptance_criteria sobre el archivo completo, mismo gotcha documentado en 133-01/133-02"
metrics:
  duration: "~1h"
  completed: "2026-08-06"
---

# Phase 133 Plan 03: Congelación por hash — taxonomia.json, thresholds.json, CONGELADO.md, congelado.test.ts, CI Summary

**One-liner:** Los dos JSON canónicos congelados y commiteados con LF en el índice, `thresholds.json`
con `umbrales` como array de 9 en el orden LOCKED `T1,T2,T3,T4,T5,T9,T6,T7,T8` (T9 presente, T3 con
su condición compuesta), `congelado.test.ts` que compara BYTES (demostrado por mutación de
reordenamiento de claves sobre los DOS archivos), y `@obs/news` corriendo en CI con el hash probado
estable en un clon limpio.

## Números medidos

| Momento | N (Tests passed) | Delta | Predicción del plan | Cumple |
|---|---|---|---|---|
| N_ANTES (baseline, antes de Task 1) | **219** | — | — | ✅ |
| N_T1 (tras Task 1 — generar/commitear JSON) | **219** | 0 | 0 exacto | ✅ |
| N_T2 (tras Task 2 — congelado.test.ts) | **227** | +8 | +8 exacto | ✅ (piso `>206` también ✅) |
| N_T3 (tras Task 3 — step de CI) | **227** | 0 | 0 exacto | ✅ |
| **Total del plan** | **227** | **+8** vs N_ANTES | +8 | ✅ |

Todos extraídos con `NO_COLOR=1 ... | tee LOG; grep -oE 'Tests[^0-9]+[0-9]+ passed' LOG | grep -oE
'[0-9]+'`, nunca por exit code solo.

## Los dos sha256 congelados (literales)

- **`taxonomia.json`:** `90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c`
- **`thresholds.json`:** `e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e`

Coinciden en las tres ubicaciones: constantes `HASH_TAXONOMIA`/`HASH_THRESHOLDS` de
`congelado.test.ts`, última entrada de `CONGELADO.md`, y el control positivo de clon limpio (abajo).

## `git ls-files --eol -- packages/news/src/eval` (tras Task 1)

```
i/lf    w/lf    attr/                 	packages/news/src/eval/canonicalizar-json.test.ts
i/lf    w/lf    attr/                 	packages/news/src/eval/canonicalizar-json.ts
i/lf    w/lf    attr/                 	packages/news/src/eval/index.ts
i/lf    w/lf    attr/text eol=lf      	packages/news/src/eval/taxonomia.json
i/lf    w/lf    attr/                 	packages/news/src/eval/taxonomia.test.ts
i/lf    w/lf    attr/                 	packages/news/src/eval/taxonomia.ts
i/lf    w/lf    attr/text eol=lf      	packages/news/src/eval/thresholds.json
```

`json_lf=2` — anti-cero-vacuo cumplido; los dos JSON tienen `i/lf` y `attr/text eol=lf`.

## Umbrales — forma y orden (`node -e`, rc=0)

```
OK T1,T2,T3,T4,T5,T9,T6,T7,T8
```

9 entradas, orden LOCKED preservado por ser array (la canonicalización solo ordena claves de
objetos planos, nunca reordena arrays). `T3.n_minimo=8`,
`T3.n_minimo_condicion="al menos 3 clases con n >= 8"`. `T4`/`T5`/`T9.n_minimo=25`. T9 presente.

## Mutaciones — rc y test caído, citados

Idiom en todas: `if CMD > log 2>&1; then rc=0; else rc=$?; fi` — nunca bajo `set -e`.

| Mutación | Archivo mutado | rc | Test(s) que cae | Revertido |
|---|---|---|---|---|
| Byte extra al final | `taxonomia.json` | **1** | `(a) sha256 vivo de taxonomia.json coincide con HASH_TAXONOMIA`, `(c) sincronía`, `(g) bytes limpios` | ✅ `git checkout --` |
| **Reordenamiento de claves** (sin cambiar semántica) | `taxonomia.json` | **1** | `(c) canonicalizar(TAXONOMIA) es byte a byte idéntico a taxonomia.json en disco` — cayó **solo** este entre los dos de sincronía; `(a)` también cayó porque el hash derivó | ✅ `git checkout --` |
| **Reordenamiento de claves** (sin cambiar semántica) | `thresholds.json` | **1** | `(d) canonicalizar(THRESHOLDS) es byte a byte idéntico a thresholds.json en disco` — cayó **solo** este entre los dos de sincronía; `(b)` también cayó por el hash derivado | ✅ `git checkout --` |
| Un carácter del hash en la última entrada | `CONGELADO.md` | **1** | `(f) la última entrada de CONGELADO.md contiene los dos hashes vigentes` | ✅ restaurado manualmente (archivo aún untracked en ese punto, `git checkout --` no aplica a untracked) |

**El criterio más importante del plan** — la mutación de reordenamiento corrida **dos veces**, una
por archivo — confirma que la sincronía compara bytes y no objetos parseados: en ambos casos el JSON
mutado es semánticamente idéntico al original (mismas claves, mismos valores) pero el test de
sincronía correspondiente cae porque los bytes serializados difieren. Ningún test pasó en verde con
las claves reordenadas.

`grep -c 'toEqual' packages/news/src/eval/congelado.test.ts` = **0** tras corregir el JSDoc (ver
Desviaciones); revisión manual confirma que los cuatro `it` de hashes/sincronía usan igualdad
estricta de strings, nunca comparación profunda de objetos.

## Control positivo del hash en clon limpio (D-133-E2.1)

```
sha256sum (working tree):
  90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c  taxonomia.json
  e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e  thresholds.json

sha256sum (clon limpio, git clone -q --no-hardlinks file://<repo>):
  90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c  taxonomia.json
  e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e  thresholds.json
```

`wc -l < hashes-clon.txt` = **2**, `wc -l < hashes-wt.txt` = **2** (anti-cero-vacuo, P-4, verificado
ANTES del diff). `diff` de las columnas de hash → **rc=0**. El clon fue del **commit** (Task 1, hash
`1ae3d87`), no del working tree — condición requerida por el plan.

**Control positivo apareado del propio control:** un byte mutado en `taxonomia.json` **en el working
tree, sin commitear** → `diff` contra el clon → **rc=1**. Revertido con `git checkout --`. Confirma
que el control mismo no es un cero-vacuo: distingue un working tree modificado de uno limpio.

## Step de CI

`grep -c 'filter @obs/news exec vitest run' .github/workflows/ci.yml` = **1**. `grep -c 'deuda'` =
**1** (comentario declara: *"CI corre 4 de ~17 workspaces (./app, @obs/llm, @obs/cruces, @obs/news);
los demás paquetes siguen CI-dark. Convertir a `pnpm test` podría destapar rojos de otros paquetes —
riesgo no presupuestado en 133-a"*). Steps preexistentes intactos: `@obs/llm` = 1, `@obs/cruces` = 1.
`git diff --name-only 56383e3` lista únicamente `.github/workflows/ci.yml`.

**La deuda de raíz se declara, NO se arregla** — decisión explícita de D-133-K2, respetada.

## Criterios que pasaron y cuáles no

Todos los criterios del plan pasaron. No hay criterios fallidos ni escalaciones.

- ✅ Los dos JSON congelados, commiteados, LF en el índice.
- ✅ `umbrales` array de 9 en orden LOCKED, con T9 y la condición compuesta de T3.
- ✅ Sincronía compara bytes (demostrado dos veces, una por archivo).
- ✅ Hash estable en clon limpio, control ejecutado con anti-cero-vacuo previo.
- ✅ `@obs/news` corre en CI; deuda de raíz declarada.
- ✅ `eval/index.ts` no fue tocado en ninguna tarea (`git diff --name-only <SHA>` verificado por tarea).
- ✅ `tsc -b --force` rc=0 en todas las corridas.
- ✅ Cero literales `import ... taxonomia.json|thresholds.json` en el código de producción.

## Qué se construyó

1. **`packages/news/src/eval/thresholds.ts`** — `THRESHOLDS`, objeto congelado con
   `umbrales` (array de 9 `Umbral`), `regla_de_intervalos`, `hipotesis_preregistrada`, `refutacion`
   (con `refutacion_parcial` sobre T9). Congelación profunda (`Object.freeze` sobre el array, cada
   entrada, y el objeto raíz).
2. **`packages/news/src/eval/canonicalizar-cli.ts`** — `generarProyecciones()` importa
   `TAXONOMIA`/`THRESHOLDS` por ruta relativa, canonicaliza y escribe los dos JSON con
   `writeFileSync(path, str, "utf8")`; imprime los dos sha256 por stdout cuando se invoca como
   entrypoint (`tsx src/eval/canonicalizar-cli.ts`).
3. **`taxonomia.json` / `thresholds.json`** — generados, `git add` normal + `--renormalize`,
   commiteados junto con `thresholds.ts`/`canonicalizar-cli.ts`.
4. **`packages/news/src/eval/CONGELADO.md`** — régimen del cambio legítimo, limitación declarada, y
   la primera entrada con `hash_anterior: (ninguno) → hash_nuevo: <sha256>` para ambos archivos;
   `golden-set.json` declarado ausente (133-b).
5. **`packages/news/src/eval/congelado.test.ts`** — 8 `it`, patrón de
   `packages/llm-bench/src/tasks/clasificacion/disjuncion.test.ts:52-70`, sin depender de
   `@obs/llm-bench`.
6. **Step de CI** en `.github/workflows/ci.yml`, tras el `run:` de `@obs/cruces`, con la deuda de
   raíz declarada por escrito en el YAML.

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — corrección, no está en el catálogo del plan pero necesaria para
cumplir sus propios acceptance_criteria)

**1. Literal prohibido por `grep -c 'toEqual' == 0` aparecía en un comentario JSDoc explicativo**

- **Encontrado durante:** Task 2, al correr el acceptance_criteria de `toEqual` sobre
  `congelado.test.ts` completo.
- **Problema:** el JSDoc superior del archivo citaba, por claridad, el nombre del matcher de
  comparación profunda que el plan prohíbe usar en los `it` de sincronía — el criterio del plan
  (`grep -c 'toEqual'`) es literal sobre el archivo completo, no solo sobre el código ejecutable.
- **Fix:** se re-redactó el JSDoc para preservar el significado sin el literal ("un matcher de
  igualdad profunda sobre JSON parseado" en vez de nombrar el matcher).
- **Archivo:** `packages/news/src/eval/congelado.test.ts`.
- **Verificado:** `grep -c 'toEqual' packages/news/src/eval/congelado.test.ts` = 0 tras el fix; el
  commit de Task 2 incluye la corrección (no hubo commit separado).
- **Precedente idéntico** al documentado en `133-01-SUMMARY.md` y `133-02-SUMMARY.md` — mismo
  gotcha del repo, mismo tratamiento.

### Ningún otro deviation. El resto del plan se ejecutó exactamente como está escrito.

## Auth gates

Ninguno — plan sin llamadas a servicios externos ni credenciales.

## Known Stubs

Ninguno. Los seis artefactos (`thresholds.ts`, `canonicalizar-cli.ts`, los dos JSON,
`CONGELADO.md`, `congelado.test.ts`) y el step de CI son completos según su interfaz declarada; sin
datos mock ni placeholders.

## Threat Flags

Ninguno. Los ocho threats del `<threat_model>` (T-133-07, T-133-08, T-133-09, T-133-10, T-133-21,
T-133-22, T-133-28, T-133-SC) mitigados exactamente como se diseñó, sin superficie nueva no
contemplada.

## Self-Check

```
FOUND: packages/news/src/eval/thresholds.ts
FOUND: packages/news/src/eval/canonicalizar-cli.ts
FOUND: packages/news/src/eval/taxonomia.json
FOUND: packages/news/src/eval/thresholds.json
FOUND: packages/news/src/eval/CONGELADO.md
FOUND: packages/news/src/eval/congelado.test.ts
FOUND: .github/workflows/ci.yml (modificado)
FOUND: 1ae3d87 (feat 133-03 Task 1)
FOUND: 56383e3 (test 133-03 Task 2)
FOUND: 037418e (chore 133-03 Task 3)
```

## Self-Check: PASSED
