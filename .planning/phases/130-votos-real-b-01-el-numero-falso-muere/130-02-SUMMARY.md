---
phase: 130-votos-real-b-01-el-numero-falso-muere
plan: 02
subsystem: frontend-server-components
tags: [votos, b-01, deuda-tecnica, react-server-components]
dependency-graph:
  requires: ["130-01"]
  provides: ["contarCarriles (unico productor del carril de votos)", "VotosSection prop conteosGlobales"]
  affects: ["app/lib/parlamentario-resumen-conteos.ts", "app/components/votos-por-parlamentario.tsx", "app/app/parlamentario/[id]/page.tsx"]
tech-stack:
  added: []
  patterns: ["single-productor + prop-drilling (D-04)", "rotulo honesto de alcance sobre lo capado (VOTO-05)"]
key-files:
  created: []
  modified:
    - app/lib/lockdown-guard.test.ts
    - app/lib/types.ts
    - app/lib/parlamentario-resumen-conteos.ts
    - app/app/parlamentario/[id]/page.tsx
    - app/components/votos-por-parlamentario.tsx
    - app/lib/parlamentario-resumen-conteos.test.ts
    - app/app/parlamentario/[id]/page.test.tsx
    - app/components/votos-por-parlamentario.test.tsx
decisions:
  - "Task 1 + Task 2 en un unico commit (D-04 LOCKED): chip, capa-1 y VotosSection cambian de productor numérico atómicamente — cero ventana donde chip y sección puedan desincronizarse"
  - "resumirVotos renombrada a agregarConteoVotos (acumula n en vez de contar filas) — cero código muerto que invite a revertir al .length"
  - "conteoGlobalDisponible expuesto en VotosViewData para que el render distinga 'total real conocido' de 'solo lo cargado' (fable_blocker_1), en vez de inferirlo indirectamente de filasCargadas===totalVotos"
metrics:
  duration: "~50 min"
  completed: "2026-07-30"
---

# Phase 130 Plan 02: Chip + sección de votos leen el agregado real (D-04) Summary

Chip, capa-1 y `Ver detalle (N)` de votos ahora derivan del agregado SQL real
(`votos_conteo_de_parlamentario`, migración 0082) en vez del `.length` de las
1.000 filas capadas — el número falso de B-01 muere. Test centinela D-05
verificado morder por los dos lados: revertir al `.length` hace caer el
assert positivo (3752 ausente) y el negativo (3 reaparece) a la vez.

## What was built

- **`app/lib/lockdown-guard.test.ts`** — `votos_conteo_de_parlamentario` añadida
  a `PUBLIC_RPC_ALLOWLIST` en orden alfabético, inmediatamente antes de
  `votos_de_parlamentario` (assert A5). El comentario referencia la migración
  0082 y este plan (asserts A2+A5 verdes).
- **`app/lib/types.ts`** — `VotoConteoRow` (shape `{ seleccion: string; n: number }`
  de la fila del RPC 0082), documentada junto a `VotoFichaRow`.
- **`app/lib/parlamentario-resumen-conteos.ts`** — `contarCarriles` es ahora el
  ÚNICO productor de verdad numérica del carril de votos:
  - `resumirVotos` → **renombrada** `agregarConteoVotos` (acumula `n` por
    fila del agregado en vez de contar filas 1:1; misma semántica "selección
    desconocida se ignora").
  - El bloque de votos invoca `votos_conteo_de_parlamentario({p_id})` en vez
    de `votos_de_parlamentario({p_limit:1000})`. `votosTotal` = suma de las 5
    claves del breakdown en el orden LOCKED (no `Object.values`). `asistencia`
    se deriva del breakdown (`presentes = total − ausentes`).
  - El comentario WR-03 (deuda dormante del `.length`) fue eliminado — ya no
    describe una deuda existente.
  - `votos_de_parlamentario` queda intacta como carril EXCLUSIVO del listado
    paginado (D-03) — no se toca en este módulo.
- **`app/app/parlamentario/[id]/page.tsx`** — `<VotosSection>` recibe
  `conteosGlobales={conteos.votos.tipo === "dato" ? conteos.votosBreakdown : null}`
  (cero fetch adicional: reusa `contarCarrilesSeguro(id)` ya awaiteado).
- **`app/components/votos-por-parlamentario.tsx`**:
  - `VotosSection`/`derivarVotosViewData` aceptan `conteosGlobales:
    VotosBreakdown | null`. Sin tema activo y con el agregado disponible,
    `conteos`/`totalVotos` salen de `conteosGlobales` (no del `.length` del
    listado capado); con tema activo, WR-01 se preserva intacto (subconjunto
    filtrado, `conteosGlobales` ignorado).
  - Nuevo campo `conteoGlobalDisponible` en `VotosViewData` (verdad explícita
    de si el total mostrado es el real o solo lo cargado — evita inferirlo
    indirectamente de `filasCargadas === totalVotos`, que sería ambiguo en el
    camino de fallback).
  - Rótulos honestos añadidos: "N de M" cuando el listado muestra menos
    votaciones que el total real; scope declarado en la nota de cobertura por
    proyectos (`totalProyectos`) y en el chart "¿Cuándo votó?"; y el fix
    **fable_blocker_1**: cuando el conteo agregado NO está disponible (RPC en
    error) y no hay ausentes, el copy dice "Emitió N votos sobre las
    votaciones cargadas en este detalle" — NUNCA "Emitió N votos registrados."
    pelado (que en ese camino habría sido B-01 resucitado).
  - `p_limit: 1000` intacto — cero clamp (criterio 4 del research).

## Test centinela D-05 (SC4)

`app/app/parlamentario/[id]/page.test.tsx` — con `votos_conteo_de_parlamentario`
mockeado sumando 3752 (testigo D1165: si 1764/no 1772/abstención 171/pareo
16/ausente 29) y `votos_de_parlamentario` mockeado con solo 3 filas: el HTML
renderizado contiene `"Ver detalle (3752)"` y **no** contiene `"Ver detalle
(3)"`. Verificado invirtiendo el mock durante desarrollo — ambos asserts caen
juntos si se revierte al `.length`.

## Deviations from Plan

Ninguna — el plan se ejecutó según lo escrito. El único ajuste fue de
implementación menor: se introdujo el campo `conteoGlobalDisponible` en
`VotosViewData` (no mencionado explícitamente en el plan) para hacer el
fable_blocker_1 verificable de forma directa en el render, en vez de derivarlo
implícitamente de la comparación `filasCargadas === totalVotos` (que en el
camino de fallback son siempre iguales entre sí y no distinguen "sabemos que
es exacto" de "no lo sabemos"). Es una extensión de tipo puramente aditiva,
sin impacto en ningún consumidor existente.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno fuera del `<threat_model>` del plan — T-130-07..T-130-11 cubiertos
verbatim (allowlist literal, assert A2 satisfecho por 0082 de Plan 01, WR-01
preservado, `p_limit` sin subir, productor único + commit atómico).

## Self-Check: PASSED

- `app/lib/lockdown-guard.test.ts` — FOUND, modificado (commit `34e73a7`);
  `votos_conteo_de_parlamentario` en `PUBLIC_RPC_ALLOWLIST` — confirmado
  (`pnpm exec vitest run lib/lockdown-guard.test.ts` → 35/35 ok).
- `app/lib/types.ts` — FOUND, modificado (commit `34e73a7`); `VotoConteoRow`
  presente.
- `app/lib/parlamentario-resumen-conteos.ts` — FOUND, modificado (commit
  `34e73a7`); `agregarConteoVotos` presente, `resumirVotos`/`WR-03` ausentes
  (greps EXIGIDO:0 confirmados).
- `app/app/parlamentario/[id]/page.tsx` — FOUND, modificado (commit `34e73a7`);
  `conteosGlobales=` presente 1×.
- `app/components/votos-por-parlamentario.tsx` — FOUND, modificado (commit
  `34e73a7`); `conteosGlobales` presente ≥3×; `p_limit: 1000` intacto,
  `p_limit: 4000/3752` ausente; `"votos_de_parlamentario"` presente 1× (D-03).
- `app/lib/parlamentario-resumen-conteos.test.ts` — FOUND, modificado (commit
  `9caa84b`); 27/27 tests verdes.
- `app/app/parlamentario/[id]/page.test.tsx` — FOUND, modificado (commit
  `9caa84b`); 17/17 tests verdes, incluyendo el centinela D-05.
- `app/components/votos-por-parlamentario.test.tsx` — FOUND, modificado
  (commit `9caa84b`); 79/79 tests verdes.
- Commits `34e73a7` (Task 1+2, D-04) y `9caa84b` (Task 3) — FOUND en `git log`.
- `pnpm typecheck` — verde (`tsc -b`, cero errores).
- `pnpm guards` — 11 (app) + 3 (@obs/dinero) + 3 (@obs/llm) = 17 archivos,
  todos verdes (334 + 34 + 7 tests).
- `pnpm test` — 108 archivos / 1641 tests, todos verdes.
- `git diff | grep p_limit` — SOLO una mención en comentario, cero cambio de
  valor.
