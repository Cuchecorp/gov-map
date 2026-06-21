---
phase: 18-net-grafo-de-influencia-xyflow-react
plan: 02
subsystem: NET — grafo de influencia (Candado B presentación + ruta /red)
tags: [next16, app-router, server-only, fail-closed, gated-off, rsc, anti-insinuacion, tdd]
status: complete
requires:
  - app/lib/money-gate.ts (patrón espejo del flag server-only fail-closed)
  - app/app/contraparte/[id]/page.tsx (patrón espejo del gate notFound() como primera sentencia)
  - app/lib/buscar.ts (PARLAMENTARIO_ID_RE — validación de semilla antes de DB)
  - app/lib/supabase.ts (createServerSupabase — consumo server-side del RPC)
  - subgrafo_red(text,int,text[],timestamptz,timestamptz) RPC (Plan 18-01, ya aplicado al remoto)
provides:
  - app/lib/net-gate.ts (Candado B presentación, server-only fail-closed)
  - app/app/red/page.tsx (RSC gateada que consume subgrafo_red por semilla)
  - app/app/red/not-found.tsx (404 sobrio ES — gate OFF + semilla inválida)
  - app/components/red/red-graph.tsx (isla 'use client' placeholder con contrato de props Subgrafo)
affects:
  - Plan 03 (UI xyflow: reemplaza el cuerpo de RedGraph manteniendo la firma de props y el import path)
tech-stack:
  added: []
  patterns:
    - flag server-only fail-closed (import "server-only" + comparación estricta === "true", sin NEXT_PUBLIC_) — espejo money-gate.ts
    - gate notFound() como PRIMERA sentencia de la RSC, antes de searchParams/RPC/heading — espejo contraparte/[id]
    - searchParams Promise en Next 16 (await) + validación de semilla antes de tocar DB
    - isla 'use client' aislada en components/red/ (frontera de bundle) con contrato de props estable para handoff
    - estado honesto para grafo vacío (0 aristas) — nunca un error
key-files:
  created:
    - app/lib/net-gate.ts
    - app/lib/net-gate.test.ts
    - app/app/red/page.tsx
    - app/app/red/page.test.tsx
    - app/app/red/not-found.tsx
    - app/components/red/red-graph.tsx
  modified: []
decisions:
  - "netPublicEnabled es espejo carácter-por-carácter de moneyPublicEnabled: import server-only línea 1, env.NET_PUBLIC_ENABLED === 'true', sin truthiness laxa, sin prefijo NEXT_PUBLIC_"
  - "El gate (notFound() OFF) es la PRIMERA sentencia ejecutable de la RSC — precede a await searchParams, al RPC y a todo heading (line 43 < line 56 <h1 < line 73 rpc); cero filtración de DOM de NET mientras OFF"
  - "La semilla viene de searchParams.seed (Promise en Next 16); se valida con PARLAMENTARIO_ID_RE (D####/S####) ANTES de tocar la DB (V5/T-18-07)"
  - "Sin semilla => estado honesto (picker), NUNCA subgrafo_red seedless — evita enumeración de todos los nodos (espejo WR-03/0025)"
  - "Grafo vacío (0 aristas) => estado honesto en la isla ('aún no hay relaciones para mostrar'), NUNCA un error — la deuda de datos (7 audiencias no_confirmado) se ve como estado honesto, no como fallo"
  - "Error real del RPC => throw (degradación honesta); el camino vacío queda SOLO para grafos genuinamente sin aristas — espejo del try/catch de buscar/HeaderSection"
  - "La isla RedGraph se CREA como placeholder real (no stub roto): fija el contrato de props Subgrafo y la frontera 'use client'; Plan 18-03 reemplaza solo el cuerpo con @xyflow/react sin cambiar firma ni import path"
  - "Comentarios anti-insinuación reformulados para describir la prohibición SIN usar las palabras-gatillo (puntaje/ranking/afinidad/cercanía), así el grep negativo de CI pasa limpio sobre page.tsx/not-found.tsx/red-graph.tsx"
metrics:
  duration: ~5min
  completed: 2026-06-21
  tasks_completed: 2
  tasks_total: 2
  files: 6
---

# Phase 18 Plan 02: NET Candado B (net-gate) + ruta /red gateada Summary

Candado B (presentación) del doble candado NET: `app/lib/net-gate.ts` (`netPublicEnabled`, server-only, fail-closed, espejo exacto de `money-gate.ts`) y la ruta `/red` como Server Component que (1) gatea con `notFound()` como PRIMERA sentencia cuando `NET_PUBLIC_ENABLED` está OFF (default) — sin filtrar DOM de NET —, y (2) cuando ON, valida la semilla del parlamentario, consume el RPC `subgrafo_red` vía `createServerSupabase()` y pasa el JSON plano a la isla cliente `<RedGraph>`. La isla se crea como placeholder real (contrato de props `Subgrafo` + frontera `'use client'`) para que Plan 18-03 monte `@xyflow/react` sin romper el import. Grafo vacío (la deuda de datos actual: 0 aristas, 7 audiencias `no_confirmado`) se trata como estado honesto, nunca como error. TDD en ambas tareas; 232/232 vitest verde + tsc limpio.

## What Was Built

### Task 1 — `app/lib/net-gate.ts` + `net-gate.test.ts` (commit `3c0b0a3`)
- **`netPublicEnabled(env = process.env): boolean`** — `import "server-only"` en línea 1; retorna `env.NET_PUBLIC_ENABLED === "true"`. Espejo carácter-por-carácter de `moneyPublicEnabled`: comparación estricta (no `Boolean(...)`, no truthiness laxa), sin prefijo `NEXT_PUBLIC_`. Docstring declara: Candado B del doble candado NET; default OFF fail-closed; encender requiere F17 (`17-LEGAL-DOSSIER signoff: approved`); chokepoint enforzado cuando `/red` enruta su visibilidad SOLO por esta función.
- **`net-gate.test.ts`** — 5 casos (espejo de `money-gate.test.ts`): ausente / `"false"` / `"1"` / `"TRUE"` => `false`; `"true"` => `true` (único valor que enciende). RED verificado (módulo ausente) → GREEN (5/5).

### Task 2 — ruta `/red` + isla + not-found + test (commit `e6c399e`)
- **`app/app/red/page.tsx`** (RSC, sin `'use client'`): `if (!netPublicEnabled(process.env)) notFound();` como PRIMERA sentencia (línea 43, antes del `await searchParams`, del RPC línea 73 y del `<h1` línea 56). Cuando ON: lee `seed` de `searchParams` (Promise en Next 16); sin semilla → estado honesto sobrio (picker ES), nunca seedless; valida `PARLAMENTARIO_ID_RE.test(seed)` antes de tocar la DB → `notFound()` si inválida; `createServerSupabase().rpc("subgrafo_red", { p_id: seed, p_depth: 1 })`; `throw` si `error`; `<RedGraph subgrafo={data} />`.
- **`app/components/red/red-graph.tsx`** (`'use client'`): placeholder real que fija el contrato de props (`Subgrafo` = `{ nodos: SubgrafoNodo[]; aristas: SubgrafoArista[] }`, PII-safe: nodo = id/nombre/camara) y la frontera de bundle. Grafo vacío (0 aristas) → estado honesto ("aún no hay relaciones para mostrar"), nunca error. Render de respaldo: lista sobria de nodos + aristas con enlace a fuente, sin valoración ni medida de relación. Comentario de handoff: Plan 18-03 reemplaza el cuerpo con `@xyflow/react` manteniendo firma e import path.
- **`app/app/red/not-found.tsx`**: 404 sobrio ES (espejo de contraparte/[id]/not-found); sirve el gate OFF y la semilla inválida; cero heading/dato de NET.
- **`app/app/red/page.test.tsx`** (RTL, mocks de `next/navigation`/`@/lib/net-gate`/`@/lib/supabase`): 6 casos — OFF (default) → `notFound()` + cero toque de DB + cero DOM de NET; sin semilla → picker sin RPC; semilla inválida → `notFound()` antes de DB; semilla válida → `subgrafo_red(p_id=seed)` + isla con datos ("Ada Aguilar"); grafo vacío → estado honesto (no lanza); error del RPC → `throw`. RED verificado → GREEN (6/6).

## Deviations from Plan

**1. [Rule 1 — Bug] Comentarios anti-insinuación reformulados para pasar el grep negativo de CI**
- **Found during:** Task 2, verificación del `acceptance_criteria` (negative-match anti-insinuación sobre `page.tsx` + `not-found.tsx`).
- **Issue:** Los docstrings *describían la prohibición* enumerando las palabras-gatillo ("NO renderiza puntaje, ranking, afinidad, cercanía..."), por lo que el grep negativo de Cr I (`puntaje|score|ranking|afinidad|cercan|...`) hacía MATCH sobre comentarios benignos — un falso positivo que igualmente rompería el check de CI de la §Validation del RESEARCH.
- **Fix:** Reformulé los comentarios en `page.tsx` y `red-graph.tsx` para expresar la regla SIN las palabras-gatillo ("describe hechos tipados con fuente y fecha; jamás una valoración ni una relación de proximidad, y nunca lenguaje de causa"). El grep negativo ahora pasa limpio sobre los tres archivos.
- **Files modified:** app/app/red/page.tsx, app/components/red/red-graph.tsx
- **Commit:** e6c399e

Sin otras desviaciones. El criterio "el flag se lee SOLO vía `netPublicEnabled(...)`" se interpretó como "ningún `process.env.NET_PUBLIC_ENABLED` ejecutable" (verificado: 0 ocurrencias); el nombre de la var aparece únicamente en un docstring que explica el chokepoint.

## Empty-Graph Handling (deuda de datos documentada)

El grafo está actualmente VACÍO (0 aristas — las 7 audiencias de lobby son `no_confirmado`, deuda de datos documentada en 18-01). La ruta y la isla lo tratan como **estado honesto**, NO como error: con semilla válida pero sin aristas, `subgrafo_red` devuelve `{ nodos: [...], aristas: [] }` y `<RedGraph>` renderiza "aún no hay relaciones para mostrar" en vez de lanzar. El test `grafo VACÍO (0 aristas) → estado honesto, NO error` pinea este comportamiento.

## Handoff a Plan 18-03 (xyflow)

`<RedGraph subgrafo={data} />` es un placeholder client-island REAL (no un stub roto): compila, typecheck-ea y renderiza. Plan 18-03 reemplaza SOLO el cuerpo del componente por el grafo `@xyflow/react@12` (`import "@xyflow/react/dist/style.css"`, nodos/aristas controlados, filtros por tipo/tiempo, tooltips Radix de procedencia) **sin cambiar la firma de props `RedGraphProps` ni el import path `@/components/red/red-graph`**, de modo que `/red/page.tsx` sigue compilando. `@xyflow/react` aún NO está instalado (es trabajo de 18-03); la isla actual no lo importa, así que no hay dependencia faltante ni bundle inflado.

## Known Stubs

**`app/components/red/red-graph.tsx`** — isla placeholder INTENCIONAL. Renderiza datos reales del RPC (no datos mock; recibe el JSON real de `subgrafo_red`) pero con un render de respaldo (listas) en vez del grafo interactivo. Resolución planificada: **Plan 18-03** monta `@xyflow/react` sobre el mismo contrato de props. No bloquea el objetivo de este plan (Candado B + ruta gateada): la ruta gatea, valida y consume el RPC correctamente; el grafo interactivo es la capa de presentación de la siguiente ola. Documentado en el comentario de handoff del componente.

## Self-Check: PASSED

- FOUND: app/lib/net-gate.ts
- FOUND: app/lib/net-gate.test.ts
- FOUND: app/app/red/page.tsx
- FOUND: app/app/red/page.test.tsx
- FOUND: app/app/red/not-found.tsx
- FOUND: app/components/red/red-graph.tsx
- FOUND commit: 3c0b0a3 (Task 1)
- FOUND commit: e6c399e (Task 2)
- vitest: 232/232 verde (incluye net-gate 5/5 + red/page 6/6); tsc --noEmit limpio
- Grep negativo anti-insinuación: 0 ocurrencias de palabras-gatillo en page.tsx/not-found.tsx/red-graph.tsx; 0 `process.env.NET_PUBLIC_ENABLED` crudo en la ruta
