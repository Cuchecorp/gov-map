---
phase: 114
plan: 03
subsystem: verificación de superficies (fix de contrato HTTP + cierre de fase)
tags: [links, 404, streaming, notFound, LINK-02, cierre-de-fase]
requires:
  - "114-01 (manifiesto 95 entradas + runner + 114-CORRIDA-PRE.json/.txt)"
  - "114-02 (114-HALLAZGOS.md — lista cerrada: H-01 único)"
  - "deploy real https://observatorio-congreso.thevalis.workers.dev"
provides:
  - "fix H-01: /proyecto/<boletín inexistente> emite 404 real (comprobación elevada fuera del boundary de streaming)"
  - "114-CORRIDA-POST.txt/.json — estado DESPUÉS de los fixes + bloque === DELTA PRE→POST ==="
  - "114-VERIFICACION.md — evidencia antes/después por hallazgo + veredicto de los 4 SC del ROADMAP"
affects:
  - "125 (E2E final): deploya el fix y re-corre el runner; 4.2.b-404 debe pasar de FAIL a PASS"
tech-stack:
  added: []
  patterns:
    - "El status HTTP se decide ANTES de abrir cualquier <Suspense>: un notFound() bajo streaming pinta la UI pero no cambia el status"
    - "Mutación como prueba de que el test muerde (68-01, 100-01, 114-02): neutralizar el guard debe tumbar tests"
    - "Honest-404 vs honest-error (#34): notFound() sólo con 0 filas; un fallo de DB sigue lanzando"
key-files:
  created:
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-POST.txt
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-POST.json
    - .planning/phases/114-link-int-links-internos-exhaustivos/114-VERIFICACION.md
  modified:
    - app/app/proyecto/[boletin]/page.tsx
    - app/app/proyecto/[boletin]/page.test.tsx
decisions:
  - "El fix reusa `leerProyecto` (React.cache) en vez de añadir una lectura: cero query extra y cero cambio de dato"
  - "`FichaSection` conserva su propio notFound() — guard defensivo; no se relajó nada al elevar la comprobación"
  - "SC#3 cierra como PASS con limitación declarada, no PASS pelado: el fix no es observable contra el deploy hasta la Phase 125"
  - "El FAIL residual de la corrida POST se marca literalmente `FIX EN CÓDIGO — se re-verifica en 125` en vez de maquillarse"
metrics:
  duration: ~25 min
  completed: 2026-07-28
---

# Phase 114 Plan 03: Fixes con evidencia + corrida POST-FIX + cierre — Summary

El único defecto accionable de la fase quedó corregido en código: `/proyecto/<boletín inexistente>`
ya emite un **404 real** porque la comprobación de existencia subió al componente de página, fuera del
boundary de streaming — con test que muerde por mutación, suite en baseline+3, y la fase cerrada con
veredicto honesto en los 4 success criteria.

## Qué se construyó

| Tarea | Artefacto | Commit |
|-------|-----------|--------|
| 1 | Fix `H-01` en `app/app/proyecto/[boletin]/page.tsx` + 3 tests + `114-VERIFICACION.md` §Fixes | `10f1106` |
| 2 | `114-CORRIDA-POST.txt` / `.json` + bloque `=== DELTA PRE→POST ===` | `7650539` |
| 3 | `114-VERIFICACION.md` — veredicto por SC, cobertura, reproducción, deuda, régimen | `f401e83` |

## El fix (H-01): por qué el status mentía

El único `notFound()` de existencia vivía en `FichaSection`, **dentro** de un `<Suspense>`. Para un
boletín con formato válido (que pasa `BOLETIN_RE`) pero sin fila, Next ya había emitido el shell con
las cabeceras puestas: la UI de not-found se pintaba, pero el status se quedaba en **200**. El
contraste que lo probaba (114-02): `/parlamentario/D0000000` **sí** 404ea, porque allí la
comprobación ocurre antes de emitir.

El fix eleva `await leerProyecto(boletin)` + `notFound()` al componente de página, antes del `return`.
Reusa la lectura **ya cacheada** (`React.cache`) que consumen el rail, la ficha, la tramitación y la
validación de fuente ⇒ **cero query extra**. `FichaSection` mantiene su guard defensivo. Nada de copy,
dato, conteo, fecha ni gate cambió — por eso el linter anti-insinuación **no** necesitó extenderse
(no hubo Wave-0 de copy: la UI de not-found es la ya existente).

**El test muerde:** neutralizando el guard (`if (false)`), **2 de 13** tests del archivo caen (el de
rechazo con `NEXT_NOT_FOUND` y el estructural de orden). Revertida la mutación, 13/13 PASS.

**Gotcha propio:** la primera versión del test estructural comparaba contra `src.indexOf("<Suspense")`
y falló — mi propio comentario explicativo menciona `<Suspense>` en prosa **antes** del código. Se
ancló al JSX real (`"<Suspense fallback="`). Un source-scan que busca un token de código puede
morder su propia documentación.

## Corrida POST-FIX y delta

`node scripts/verificar-links-internos.mjs --out …/114-CORRIDA-POST` →
95 entradas · **PASS 94 · FAIL 1 · MISSING-SSR 0** (`2026-07-28T01:21:14.971Z`), conjunto de ids
**idéntico** al de la corrida PRE.

| Categoría del delta | N |
|---|---:|
| FAIL → PASS | 0 |
| Sigue FAIL, **con fix en código** (`4.2.b-404`, marcado `FIX EN CÓDIGO — se re-verifica en 125`) | 1 |
| Sigue FAIL sin fix | 0 |
| **Regresión PASS → FAIL** | **0** |

El FAIL residual **no es una falla del plan**: el deploy de esta fase está diferido a la Phase 125 por
decisión LOCKED, así que el runner sigue interrogando un bundle previo al fix. La evidencia del fix es
el diff citado + el test de respaldo, y así se declara — no se afirma verificado lo que no lo está.

**Cobertura re-confirmada:** 73 refs cubiertas por el manifiesto + 4 por `EXCLUIDOS` = **77 = 77**,
diferencia simétrica vacía en ambos sentidos. Cero gaps.

## No-regresión

| Chequeo | Baseline | Observado |
|---|---|---|
| `packages/*` | 176 files / 1535 tests / 11 skipped | **176 / 1535 / 11** — idéntico |
| `app` | 107 files / 1428 tests | **107 / 1431** (**+3**: los tests de H-01) |
| Total | 283 / 2963 | **283 / 2966** |
| `pnpm typecheck` (`tsc -b`) | exit 0 | **exit 0** |

**Guards de régimen 9/9 verdes:** anti-insinuación 33 · lockdown 22 · vsim-antiflip 20 ·
notif-antiflip 20 · money-antiflip 20 · bento 114 · bento-coherencia 8 · name-match-rut 15 ·
env-example 16.

## Veredicto de la fase

| SC | Veredicto | Evidencia |
|----|-----------|-----------|
| SC#1 links no-404 | **PASS** | 63/63 entradas `status` con `espera=no-404` en PASS |
| SC#2 anclas en el DOM | **PASS** | 20/20 `ancla` PASS, MISSING-SSR 0, aserción probada por mutación (6/10 fixtures caen al relajarla) |
| SC#3 todo roto corregido | **PASS con limitación declarada** | 1/1 hallazgo corregido con ANTES/DESPUÉS + diff + test; la observación contra el deploy ocurre en la **Phase 125** |
| SC#4 corrida reproducible | **PASS** | PRE y POST con el mismo comando (sólo cambia `--out`), salidas commiteadas, universo declarativo |

## Deviations from Plan

**Ninguna.** El plan se ejecutó como está escrito. Las dos ramas condicionales que contemplaba no
aplicaron y se declaran para que no se lean como omisiones:

- **Wave-0 de copy: NO aplicó** — el fix no introdujo texto visible nuevo, así que el linter
  anti-insinuación no se extendió (extenderlo sin copy nuevo habría sido ruido).
- **Hallazgos diferidos: NINGUNO** — `H-01` era corregible dentro del alcance de la fase.

## Threat Flags

Ninguno. El único cambio de código es de **orden de ejecución** dentro de una page ya existente: no
añade endpoint, ni ruta, ni acceso a datos, ni cambia el esquema. La superficie de datos es idéntica
(misma lectura `leerProyecto`, misma tabla, mismo filtro).

## Verificación

| Criterio | Resultado |
|----------|-----------|
| `pnpm test` | **exit 0** — 283 files / 2966 tests / 11 skipped |
| `pnpm typecheck` | **exit 0** |
| 9 guards de régimen | **9/9 verdes** (conteos arriba) |
| `git diff --stat .env .env.example` | **vacío** — cero flags tocados |
| Paquete npm nuevo (T-114-SC) | **CERO** (`package.json` / `pnpm-lock.yaml` sin cambios) |
| Delta PRE→POST | **0** regresiones PASS→FAIL; ids idénticos (95 = 95) |
| Cobertura del universo | **77/77**, cero gaps |
| Cero RUT en los artefactos | **OK** (`114-CORRIDA-POST.{txt,json}`, `114-VERIFICACION.md`) |
| Deploy | **NO ejecutado** — viaja con la Phase 125 |

## Self-Check: PASSED

- `.planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-POST.txt` — FOUND
- `.planning/phases/114-link-int-links-internos-exhaustivos/114-CORRIDA-POST.json` — FOUND
- `.planning/phases/114-link-int-links-internos-exhaustivos/114-VERIFICACION.md` — FOUND
- `app/app/proyecto/[boletin]/page.tsx` — FOUND (modificado)
- Commits `10f1106`, `7650539`, `f401e83` — FOUND en `git log`
