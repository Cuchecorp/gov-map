---
phase: 133-news-taxo
plan: 02
subsystem: guard-anti-insinuacion
tags: [guards, taxonomia, tdd]
dependency-graph:
  requires: []
  provides:
    - "app/lib/terminos-insinuacion.ts (TERMINOS_PROHIBIDOS, TERMINOS_LINK_EXT, TERMINOS_COBERTURA)"
  affects:
    - "133-05 (G1, packages/news/src/eval/taxonomia-guard.test.ts, lee este módulo por disco)"
tech-stack:
  added: []
  patterns:
    - "extracción de constantes de un .test.ts a un módulo .ts de producción, importado por el guard (mismo patrón que IDIOMS_APROBADOS)"
    - "leerSuperficie() que lanza en vez de saltar en silencio (allowlist fail-loud)"
key-files:
  created:
    - app/lib/terminos-insinuacion.ts
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "Reescritura de dos fragmentos de JSDoc que citaban literalmente '.tsx'/'@/components'/'NEGACIONES_LOCKED'/'readFileSync ... continue' — tripeaban los mismos grep -c que el plan manda correr sobre el archivo completo. Mismo patrón de deviation que 133-01."
metrics:
  duration: "~1h"
  completed: "2026-08-06"
---

# Phase 133 Plan 02: Extracción de TERMINOS_PROHIBIDOS + cierre de los dos skips silenciosos (G3) Summary

**One-liner:** `TERMINOS_PROHIBIDOS`/`TERMINOS_LINK_EXT`/`TERMINOS_COBERTURA` movidos verbatim a
`app/lib/terminos-insinuacion.ts` (vía B, D-133-J2) y los DOS `try/catch { continue }` del guard
más sensible del repo cerrados a fallo duro vía `leerSuperficie()` (D-133-J3), con delta de tests
exacto de `app/`: **+4**.

## Números medidos

| Medición | Valor | Predicción del plan | Cumple |
|---|---|---|---|
| SHA base (Task 1) | `8924c39bb8275fb93c3a4b682f218924b02038d0` | — | — |
| N_ANTES (`app/` completo) | **1799** | 1799 | ✅ |
| Test Files ANTES | **121** | — | ✅ |
| G_ANTES (guard solo) | **57** | — | ✅ |
| N_DESPUES (`app/` completo) | **1803** | 1799+4 | ✅ |
| Test Files DESPUES | **121** (sin cambio) | igual | ✅ |
| **Delta N_DESPUES - N_ANTES** | **4** | =4 exacto | ✅ |
| G_DESPUES (guard solo) | **61** (57+4) | — | ✅ |
| `TERMINOS_PROHIBIDOS.length` real | **92** | ≥90 (medido con strip: 92) | ✅ |
| `TERMINOS_LINK_EXT.length` | **8** | 8 | ✅ |
| `TERMINOS_COBERTURA.length` | **6** | 6 | ✅ |
| `TODAS_LAS_SUPERFICIES.length` | **63** | ≥63, 0 faltantes | ✅ |
| Rutas faltantes re-verificadas en ejecución | **0** | 0 | ✅ |
| `-A2 \| grep -c continue` ANTES / DESPUES | **1 / 0** | (implícito, no citado) | ✅ |
| `-A4 \| grep -c continue` ANTES / DESPUES | **2 / 0** | — | ✅ |
| `-A6 \| grep -c continue` ANTES / DESPUES | **2 / 0** | 2→0 | ✅ |

Todos los conteos se extrajeron con el idiom `NO_COLOR=1 ... | tee LOG; grep -oE 'Tests[^0-9]+[0-9]+
passed' LOG | grep -oE '[0-9]+'`.

## Qué se construyó

1. **`app/lib/terminos-insinuacion.ts`** — módulo nuevo, sin JSX, sin imports de componentes ni de
   `@obs/*`, que exporta los tres arrays movidos byte-por-byte (incluidos los dos spreads dentro de
   `TERMINOS_PROHIBIDOS`). `NEGACIONES_LOCKED` **no** se movió (importa constantes `.tsx`).
2. **`app/lib/anti-insinuacion-guard.test.ts`**: importa el módulo extraído en vez de re-tipear;
   añade `leerSuperficie(rel)` que lanza `"Superficie declarada inexistente: <rel>. Un allowlist con
   una ruta muerta es un guard ciego que sale verde…"` en vez de saltar en silencio; sustituye los
   DOS `try { readFileSync } catch { continue }` (test `(1)` y test `(1b)` WR-03) por llamadas al
   helper; añade 4 `it` planos (piso ≥90, no-hueco ≥63, control positivo, control positivo
   apareado). Sin `it.each` en ninguno.

## Mutaciones ejecutadas (todas fuera de `set -e`, con `if CMD; then rc=0; else rc=$?; fi`)

1. **Piso — borrar 5 entradas de `TERMINOS_PROHIBIDOS`** (92→87, bajo el piso 90):
   `rc=1`, cae el test de piso (además de 3 tests colaterales que usaban esos términos —
   esperado, no un bug). Revertido con `cp` del backup; suite verificada verde tras revertir.
2. **Ruta inventada `components/no-existe-jamas.tsx` añadida a `SUPERFICIES_VOTO`, con AMBOS
   skips ya cerrados:** `rc=1`, `grep -c 'no-existe-jamas' log` = **9**. Antes del cierre esa
   misma mutación salía verde (comportamiento previo del `try/catch continue`, verificado por
   inspección del código original).
3. **Mutación por sitio, dirección A (revertir solo el skip del test `(1)`):** `-A6 | grep -c
   continue` = **1**. Filtro `-t "ningún término prohibido aparece en el texto renderizado"` +
   ruta inventada → `rc=0` (skip vivo, no muerde). Filtro `-t "1b\) WR-03"` (paréntesis escapado)
   sobre el sitio ya cerrado → `rc=1` (muerde). Ambos con conteo de tests seleccionados
   assertado (`N=1` para el caso verde).
4. **Mutación por sitio, dirección B (revertir solo el skip del test `(1b)` WR-03):** `-A6 | grep
   -c continue` = **1**. Con ruta inventada: filtro `1b\) WR-03` → `rc=0` (skip vivo). Filtro del
   test `(1)` (ya cerrado) → `rc=1` (muerde).

Ambas direcciones probadas y revertidas; estado final: los dos sitios usan `leerSuperficie`, sin
ruta inventada en `SUPERFICIES_VOTO`, suite completa en 61/61.

## Desviaciones del plan

### Auto-fixed Issues (Rule 1 — corrección necesaria para cumplir los propios acceptance_criteria del plan)

**1. Literales prohibidos por `grep -c == 0` aparecían en comentarios/JSDoc explicativos**

- **Encontrado durante:** Task 2 (criterios `.tsx"|@/components` y `NEGACIONES_LOCKED` sobre
  `terminos-insinuacion.ts`) y Task 3 (criterio `-A6 ... continue` sobre el guard: el propio JSDoc
  del helper `leerSuperficie` citaba `readFileSync` y `continue` en la misma línea, cayendo dentro
  de su propia ventana de detección).
- **Fix:** se re-redactaron los tres fragmentos sin usar los literales prohibidos, preservando el
  significado (p.ej. "componentes de UI" en vez de `.tsx`/`@/components`; "la lista de negaciones
  LOCKED del guard" en vez de `NEGACIONES_LOCKED`; "bloques de lectura-con-salto-silencioso" en vez
  de `readFileSync ... continue`).
- **Archivos:** `app/lib/terminos-insinuacion.ts`, `app/lib/anti-insinuacion-guard.test.ts`.
- **Commit:** incluido en `d9fab16` (mismo commit, antes de la verificación final — no hubo commit
  separado porque se corrigió antes de cerrar la tarea).
- **Verificado:** los 5 `grep -c`/`grep -cE` de los acceptance_criteria de Task 2 y el `-A6`
  de Task 3 dan exactamente los valores esperados (0, 0, 1, 0/2→0).

Precedente idéntico al de `133-01-SUMMARY.md` §Deviations — mismo gotcha, mismo tratamiento.

### Flake diagnosticado (no es deviation del código)

**`lib/vsim-antiflip-guard.test.ts` (WR-03) — timeout de 5000ms en la primera corrida completa de
`app/`**, no relacionado con este plan (escanea `packages/`, no `app/lib/`). Re-corrido en
aislamiento: **20/20 verde en 74ms**. Re-corrida completa de `app/`: **1803/1803 verde, 121/121
archivos**. Diagnóstico impreso antes de aceptar el número, tal como manda el plan: conteo por
archivo del log fallido (1 archivo, 1 test, timeout) → causa identificada como contención de
recursos bajo la corrida completa, no un fallo determinista del código tocado por este plan.

### Ningún otro deviation. El resto del plan se ejecutó exactamente como está escrito.

## Auth gates

Ninguno.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno. T-133-04, T-133-05, T-133-06, T-133-20, T-133-27, T-133-SC del `<threat_model>` mitigados
exactamente como diseñado.

## Self-Check

```
FOUND: app/lib/terminos-insinuacion.ts
FOUND: app/lib/anti-insinuacion-guard.test.ts (modificado)
FOUND: d9fab16 (feat 133-02, ambos archivos en el mismo commit)
```

`git diff --name-only 8924c39bb8275fb93c3a4b682f218924b02038d0` → exactamente
`app/lib/anti-insinuacion-guard.test.ts` y `app/lib/terminos-insinuacion.ts`.

## Self-Check: PASSED
