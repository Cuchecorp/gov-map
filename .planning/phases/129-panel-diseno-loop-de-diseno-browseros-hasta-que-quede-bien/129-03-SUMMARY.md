---
phase: 129-panel-diseno-loop-de-diseno-browseros-hasta-que-quede-bien
plan: 03
subsystem: frontend-panel
tags: [diseno, copy, i18n-es-cl, higiene-secretos, panel]
requires:
  - 129-01 (capturas del deploy 4c6fdbda)
  - 129-02 (129-H01-DEBUG.md, arrastre BN-3)
provides:
  - "app/lib/plural.ts — helper general de pluralizacion es-CL"
  - "129-CRITICA.md — critica de diseno vs baselines v13, con §Hallazgos/§Presupuesto/§Diferidos/§Plural/§Deuda"
  - "07-01-SUMMARY.md redactado (B26)"
affects:
  - "129-04 Task 1 consume §Hallazgos y §Presupuesto de iteraciones"
tech-stack:
  added: []
  patterns:
    - "pluralizacion explicita (ambas formas como argumento), sin heuristica morfologica"
key-files:
  created:
    - app/lib/plural.ts
    - app/lib/plural.test.ts
    - .planning/phases/129-.../129-CRITICA.md
  modified:
    - app/components/panel-tile-comisiones.tsx
    - app/components/panel-tile-comisiones.test.tsx
    - app/components/panel-tile-urgencias.tsx
    - app/components/panel-tile-urgencias.test.tsx
    - app/components/panel-tile-votaciones.tsx
    - app/components/panel-tile-votaciones.test.tsx
    - .planning/milestones/v1.0-phases/07-.../07-01-SUMMARY.md
decisions:
  - "El helper de plural NO entra a IDIOMS_APROBADOS: los sustantivos contados no son stems de fecha ni de procedencia"
  - "3 de los 4 hallazgos ACEPTAR lo son porque el defecto aparente es una decision ya arbitrada (O-3, W-6/O-6, anti-agregacion), no por falta de criterio"
  - "El alcance restante del project-ref se publica como 49 (git grep, tracked), no como el ~96 del plan: el grep recursivo del working tree agoto el timeout"
metrics:
  duration: ~35 min
  tasks: 3
  tests_delta: "+10 (31 -> 41 en las rutas del plan); suite total 1786"
  completed: 2026-07-30
requirements: [PANEL-09]
---

# Phase 129 Plan 03: Crítica de diseño + fix de plural + higiene B26 — Summary

Crítica de diseño escrita contra los baselines v13 con 9 hallazgos clasificados y criterios de
cierre verificables; el bug de concordancia de plural muerto de forma general en los 4 moldes vía
`app/lib/plural.ts`; y el project-ref, el host y el pooler de Supabase redactados en
`07-01-SUMMARY.md` sin perder una sola línea del archivo. **Este plan no deployó.**

## Lo que se hizo

### Task 1 — `129-CRITICA.md`

Se leyeron las 3 capturas del deploy `4c6fdbda` y los 3 baselines v13, más `it1-landing-full.png`
(la única captura de página COMPLETA, y la que hizo visible el hallazgo de mayor impacto).

**9 hallazgos, con archivo responsable y criterio de cierre por fila:**

| veredicto | ids | resumen |
|---|---|---|
| **FIX** | C-01, C-02, C-03, C-04 | huecos de la grilla bento · token del CTA de `/comparar` · fecha ISO en `/comparar` · plural (ya cerrado aquí) |
| **ACEPTAR** | C-05, C-06, C-07, C-08 | tile `Por materia` muerto (mejora) · remanente sin link en urgencias · 3 votaciones del mismo boletín · wrap de la nav a 390 |
| **DIFERIR** | D-1, D-2, D-3 | resiliencia SSR de `/comparar` (arrastre BN-3) · aislamiento de M-A · placeholder recortado a 390 |

El hallazgo **C-01** no salió de una impresión estética sino de una **derivación mecánica**: la
grilla es de 6 columnas (`bento-grid.tsx:25`) y el orden de montaje es
sala(4)·comisiones(4)·urgencias(2)·movimiento(4)·votaciones(4)·ingresos(2)
(`panel-actualidad.tsx:182-187`), lo que bajo auto-placement produce exactamente
`[4|hueco2] [4+2] [4|hueco2] [4+2]` — y es exactamente lo que muestra la captura.

**C-02** se sostiene en un conteo, no en un gusto: `bg-accent-product` aparece en 17 archivos de
`components/` y `bg-foreground` en 2, de los cuales el otro no es un botón ⇒ el CTA de `/comparar`
es el único CTA primario fuera del token.

Tres de los cuatro `ACEPTAR` lo son porque **el defecto aparente es una decisión ya arbitrada** y
documentada en el propio componente (O-3, W-6/O-6 "FIJADO, cero discreción", y la invariante
testeada que prohíbe agregar votaciones del mismo boletín). Ninguno se coló como FIX y ninguno se
despachó con "falta pulido".

**§Presupuesto de iteraciones:** 1 de 3 gastada (en C-04), **2 disponibles** para `129-04`, con
orden declarado C-01 > C-02 > C-03.

### Task 2 — `plural()` y los 4 moldes

TDD: `plural.test.ts` escrito y visto fallar (RED, módulo inexistente) antes de crear `plural.ts`.

```ts
export function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}
```

Sin heurística morfológica **a propósito**: `citación → citaciones` y `abstención → abstenciones`
pierden la tilde y ninguna regla de sufijo lo acierta. `idioms-panel.ts` quedó intacto.

| molde | antes (n=1) | ahora |
|---|---|---|
| `panel-tile-comisiones.tsx:38` | `1 citaciones del Senado` | `1 citación del Senado` |
| `panel-tile-urgencias.tsx:161` | `1 proyectos con {grado}` | `1 proyecto con {grado}` |
| `panel-tile-votaciones.tsx:65` | `1 abstenciones` | `1 abstención` |
| `panel-tile-votaciones.tsx:66` | `1 pareos` | `1 pareo` |

`a favor` / `en contra` no se tocaron: son locuciones adverbiales, no sustantivos contados.

**Delta de tests: 31 → 41 (+10).** El base se registró ANTES de crear nada, con el comando que
omite `lib/plural.test.ts`; el posterior con las 4 rutas explícitas. Suite completa 1786 passed
(119 files), `pnpm guards` exit 0.

### Task 3 — B26

Tres ocurrencias redactadas en `07-01-SUMMARY.md` (project-ref y pooler en la 176, host de la API en
la 181) por marcadores `<…_REDACTADO>`, conservando el sentido de cada frase. `wc -l` = **186 antes
y después**: se redactó, no se borró. Criterio `grep -oE … | wc -l` = **0**, apareado con control
positivo en el mismo archivo (`supabase` = 6) ⇒ cero fuerte.

§Deuda de operador publica la recomendación de **rotar la password de la DB** (redactar un artefacto
no invalida una credencial) y cuantifica el alcance restante.

## Desviaciones del plan

**1. [Rule 1 — Bug] La crítica reintrodujo el secreto que el propio plan mandaba redactar**

- **Encontrado en:** Task 3, al verificar.
- **Problema:** la primera versión de `129-CRITICA.md` documentaba la redacción **transcribiendo los
  literales** (el project-ref, el host de la API y el del pooler) en la tabla de §Deuda y en los comandos
  de verificación. Redactar un archivo para reimprimir el ref en otro archivo tracked del mismo
  commit es un no-fix: el criterio del plan solo miraba `07-01-SUMMARY.md`, así que habría pasado en
  verde.
- **Fix:** los literales se sustituyeron por descripciones (`el project-ref del proyecto nube (20
  caracteres)`) y los comandos se parametrizaron con `$REF`/`$DOMINIO`. Verificado:
  `grep -oE 'ref|supabase\.co|…' 129-CRITICA.md | wc -l` = 0, con control positivo `Supabase` = 2 y
  `supabase` = 5 sobre el mismo archivo.
- **Commit:** `3b5924b`

**2. [Rule 3 — Bloqueante] El `grep -rlF` del plan agotó el timeout**

- **Encontrado en:** Task 3.
- **Problema:** `grep -rlF … --exclude-dir=node_modules --exclude-dir=.git . | wc -l`, el comando que
  el plan citaba para cuantificar el alcance restante (`~96`), **no terminó en 2 minutos** — el repo
  vive bajo OneDrive y el recorrido recursivo del working tree es patológicamente lento.
- **Fix:** se midió con `git grep -lF "$REF" -- .` → **49 archivos tracked**, con control positivo
  apareado (`git grep -lF 'supabase'` → 793) que prueba que el recorrido sí funciona. La diferencia
  49 vs 96 se explica porque el recorrido del working tree incluye artefactos no versionados. **Se
  publica el número medido, 49, con su comando al lado** — no el número heredado del plan.
- **Commit:** `6bf22d4`

**3. [Método] Dos de mis propias verificaciones cayeron en el gotcha `grep -i` + `-F`**

Al comprobar `rotar` y el control positivo `supabase` en la crítica usé `grep -oiF`, que devuelve 0
siempre. Se detectó porque el resultado (0) contradecía el texto que acababa de escribir, y se
re-midió con `-F` solo: `rotar` = 1, `ROTAR` = 1, `Supabase` = 2, `supabase` = 5. **Ninguna cifra de
la crítica ni de este summary proviene de esa medición fallida.**

## Verificación

| criterio | resultado |
|---|---|
| `129-CRITICA.md` con las 6 columnas + §Presupuesto + §Diferidos + §Plural + §Deuda | ✔ (5 secciones `§` presentes) |
| cada fila FIX nombra archivo existente | ✔ `test -f` OK en los 8 archivos citados |
| arrastre BN-3 (`pronunciamiento del operador`) | **2** (≥ 1) |
| salvedad del escalón (b) en la cabecera de la tabla | ✔ (sección propia antes de §Hallazgos) |
| `grep -oF 'citaciones del Senado' panel-tile-comisiones.tsx` | **0** (control apareado `del Senado` = 3) |
| `from "@/lib/plural"` en los 3 tiles | **1 / 1 / 1** |
| `1 citación del Senado` / `1 proyecto con` / `1 abstención` en los tests | **2 / 2 / 2** |
| vitest 4 rutas explícitas | **41 passed**, base 31 ⇒ **+10** |
| `pnpm --filter ./app test` | **1786 passed**, exit 0 |
| `pnpm guards` | exit 0 |
| `git diff --name-only app/lib/idioms-panel.ts` | vacío |
| B26 `grep -oE … 07-01-SUMMARY.md` | **0** (control apareado `supabase` = 6; `wc -l` 186 = 186) |
| `git status --porcelain .env` / `supabase/migrations` | vacío |
| CSP (`next.config.ts`, `_headers`, `middleware.ts`, `wrangler.jsonc`) | sin cambios |
| deploys en este plan | **ninguno** |

## Known Stubs

Ninguno. `plural.ts` es una función completa, no un placeholder, y los 4 call-sites están cableados.

## Deferred Issues

D-1 (resiliencia SSR de `/comparar`, requiere pronunciamiento del operador sobre el contrato LOCKED
#34), D-2 (aislamiento de M-A) y D-3 (placeholder a 390) quedan en §Diferidos de `129-CRITICA.md`
con propuesta de fix y criterio de cierre futuro cada uno.

## Para 129-04

Consumir `129-CRITICA.md` §Presupuesto de iteraciones: quedan **2 iteraciones**, orden
**C-01 → C-02 → C-03**. La tabla de §Hallazgos ya trae la columna `estado` vacía en las filas FIX
pendientes, lista para marcarse `CERRADO` o `AGOTADAS ITERACIONES`.

## Self-Check: PASSED

Archivos creados verificados con `test -f` (4/4 FOUND); commits verificados con
`git log --oneline --all | grep -qF` (`a22c8de`, `3b5924b`, `6bf22d4`, 3/3 FOUND).

**Hallazgo del propio self-check (Rule 1, corregido antes de cerrar):** este SUMMARY también
transcribía el project-ref una vez, en la narrativa de la Desviación 1 — el mismo error que la
desviación describe, cometido al describirlo. Redactado. Medición final: `grep -oE` del patrón B26
sobre este archivo = **0**, con control positivo apareado `grep -oF 'supabase'` = 8 sobre el mismo
archivo ⇒ cero fuerte, no vacuo.
