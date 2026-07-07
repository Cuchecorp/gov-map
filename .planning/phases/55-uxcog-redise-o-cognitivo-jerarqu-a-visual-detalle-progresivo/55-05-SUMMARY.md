---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
plan: 05
subsystem: frontend-ui
tags: [ui, ia, progressive-disclosure, agenda, red, xyflow, ego-network, anti-insinuacion]
requires:
  - "CarrilAccordion (Radix single/collapsible + forceMount, F45)"
  - "@xyflow/react@12.11.0 (isla NET ya instalada) — fitViewOptions.nodes (@xyflow/system 0.0.77)"
  - "netPublicEnabled gate + subgrafo_red(p_id, p_depth:1) seed-scoped (ya existentes)"
provides:
  - "agenda semanal agrupada día → comisión con días colapsables (CarrilAccordion headingLevel=h3)"
  - "CarrilAccordion con headingLevel/headingClassName opcionales (backward-compatible)"
  - "/red con ?seed= centrado en el ego-network del seed (fitViewOptions.nodes) + nodo semilla marcado sobrio"
  - "token de marca de nodo semilla .net-nodo--seed (borde neutro reforzado, no-ranking)"
affects:
  - "Superficies secundarias del rediseño IA (agenda + /red); F47/F49 se montan sobre estructura estable"
tech-stack:
  added: []
  patterns:
    - "Sub-agrupamiento presentacional sobre filas ya leídas (cero query nueva, Assumption A4)"
    - "Ego-framing con fitViewOptions.nodes (props @xyflow ya disponibles, cero física nueva)"
    - "Marca de wayfinding sobria no-ranking (borde neutro, sin petróleo reservado)"
key-files:
  created:
    - app/app/agenda/page.test.tsx
  modified:
    - app/app/agenda/page.tsx
    - app/components/carril-accordion.tsx
    - app/components/red/red-graph.tsx
    - app/components/red/red-graph.test.tsx
    - app/components/red/nodo-parlamentario.tsx
    - app/app/red/page.tsx
    - app/app/red/page.test.tsx
    - app/app/globals.css
decisions:
  - "Nota /red sin-seed: se CONSERVA la guía honesta del selector; NO se renderiza el LOCKED 'Mostrando toda la red' (no existe vista global en este gated → sería deshonesto; honestidad OVERRIDE, Rule 1)"
  - "CarrilAccordion reusado con headingLevel=h3 para el día (jerarquía tipográfica clara bajo el h2 de la sección) — prop opcional additiva, default h2 intacto"
  - "Marca de seed = borde neutro (--foreground), NUNCA petróleo (reservado a cruces/drill-down/scrollspy)"
metrics:
  duration: ~12min
  completed: 2026-07-07
  tasks: 2
  files: 9
---

# Phase 55 Plan 05: Agenda + /red del rediseño cognitivo Summary

Rediseño cognitivo de las dos superficies secundarias: la **agenda** semanal ahora se lee día → comisión con jerarquía tipográfica clara y bloques colapsables por día (reusando `CarrilAccordion`), y **/red** con `?seed=` abre centrado en el ego-network del parlamentario semilla (encuadre del vecindario 1-hop vía `fitViewOptions.nodes`) con el nodo de partida marcado de forma sobria, en vez del fitView global de 136 nodos. Cero query nueva, cero dep nueva, gate de /red intacto.

## What Was Built

### Task 1 — Agenda día→comisión con días colapsables (`a736bce`)
- `CitacionesSection` (modo semana): sobre el `grupos` Map por día ya existente, se agrega un **segundo nivel presentacional por comisión** dentro de cada día (Map por `comision` sobre las filas ya leídas — **cero query nueva**, Assumption A4). Jerarquía: día `<h3>` → comisión `<h4>` (sub-encabezado subordinado) → `CitacionCard`.
- Cada día se envuelve en un `CarrilAccordion` colapsable (el encabezado del día ES el trigger; cuerpo `forceMount`). El primer día arranca abierto (lo más próximo visible), el resto colapsados → acorta el scroll de 11.606px sin ocultar contexto.
- `CarrilAccordion` gana props opcionales `headingLevel` (default `"h2"`) y `headingClassName` (default `"text-xl font-semibold"`) — la agenda pasa `h3`/`text-base` para que el día quede tipográficamente subordinado al `<h2>` de la sección. **Backward-compatible**: los usos F45 conservan el `<h2>` y sus tests pasan.
- Cross-links a boletín intactos (`primerBoletin(c)` → `CitacionCard` → `/proyecto/{boletin}`). `SalaTableServer` y las anclas/`mt-*` de las secciones sin tocar.
- Test nuevo `agenda/page.test.tsx`: (1) día→comisión (h4 por comisión dentro del día h3), (2) día colapsable (trigger `aria-expanded` + cuerpo `forceMount` en el DOM), (3) cross-link a boletín preservado.

### Task 2 — /red framing ego del seed + marca del nodo semilla (`608d117`)
- `red-graph.tsx`: `RedGraphProps` gana `seedId?`. Con semilla se construye `egoIds = [seedId, ...aristasVisibles.flatMap(a=>[a.a,a.b])]` (dedupe) y se pasa `fitViewOptions={{ padding:0.2, nodes: egoIds.map(id=>({id})), minZoom:0.2 }}` — encuadra el **vecindario inmediato** del seed. Sin semilla, se conserva el `fitViewOptions={{ padding:0.05 }}` global shipped. Layout grid determinista por cámara (`posicion`) intacto — jamás física.
- Nodo semilla marcado vía `data.esSeed` → `nodo-parlamentario.tsx` añade la clase `.net-nodo--seed` y el aria `(punto de partida)`; `globals.css` define `.net-nodo--seed` con borde neutro reforzado (`--foreground`, 2px). Es **wayfinding no-ranking**: sin petróleo (reservado), sin insignia de puntaje.
- `red/page.tsx`: pasa `seedId={seed}` y renderiza la nota de uso LOCKED `"Centrado en {nombre} y su vecindario inmediato."` — `{nombre}` = nombre público del nodo semilla tomado del subgrafo YA leído (cero query nueva), con degradación honesta si no viene. Gate `netPublicEnabled` + `export const dynamic="force-dynamic"` sin tocar.
- Tests: `red-graph.test.tsx` extiende el doble de `ReactFlow` para exponer `fitViewOptions.nodes` (`data-fitview-nodes`) → asertar ego (seed+vecino) con seedId, `[]` sin seedId, y la marca `.net-nodo--seed` sólo en el seed (con negative-match de ranking). `red/page.test.tsx` asierta la nota de uso con nombre (seeded) y la guía honesta conservada (sin-seed).

## Deviations from Plan

### Auto-fixed / honestidad

**1. [Rule 1 - Honestidad] Nota /red sin-seed: NO se renderiza el LOCKED "Mostrando toda la red"**
- **Found during:** Task 2
- **Issue:** El copy LOCKED sin-seed ("Mostrando toda la red. Abre una ficha y usa 'Ver relaciones'…") asume una vista de grafo global que **no existe** en esta implementación gated: la rama sin-seed de `/red` es un SELECTOR (`subgrafo_red` exige semilla; el whole-graph seedless fue eliminado deliberadamente por anti-enumeración, WR-03). Renderizar "Mostrando toda la red" sería falso.
- **Fix:** Se CONSERVA la guía honesta del selector ("Elige un parlamentario para ver…") como nota de uso sin-seed (satisface must-have #4 "conserva … nota de uso"); se aplica el LOCKED seed-note (que sí es preciso). El principio de honestidad de fuente (CLAUDE.md) OVERRIDE el copy del plan.
- **Files:** app/app/red/page.tsx, app/app/red/page.test.tsx
- **Commit:** 608d117

**2. [Rule 3 - Blocking] `CarrilAccordion` hardwired `<h2 class="text-xl">` impedía la jerarquía día→comisión**
- **Found during:** Task 1
- **Issue:** El plan pide reusar `CarrilAccordion` con "el `<h3>` del día como trigger" y "jerarquía tipográfica clara", pero la primitiva fijaba `<h2>`/`text-xl` — el día habría quedado del mismo nivel/tamaño que el `<h2>` de la sección.
- **Fix:** props opcionales `headingLevel`/`headingClassName` (default `h2`/`text-xl`, backward-compatible; F45 tests verdes). La agenda pasa `h3`/`text-base`.
- **Files:** app/components/carril-accordion.tsx
- **Commit:** a736bce

**Nota:** `app/app/globals.css` (fuera de `files_modified` del plan) se tocó para definir `.net-nodo--seed` — necesario para que la marca de seed sea visible (soporte de Task 2).

## Verification

- `cd app && npx vitest run` → **614 tests verdes** (baseline 608; +6: 3 agenda día→comisión + 3 red ego-framing). Nunca decrece.
- `pnpm typecheck` (root, `tsc -b`) → limpio.
- `cd app && npx vitest run lib/lockdown-guard.test.ts` → 8/8 verde.
- CERO deps nuevas, CERO query nueva (agenda = agrupación presentacional sobre filas ya leídas; /red = solo props @xyflow ya disponibles), CERO física nueva. Gate `netPublicEnabled` + `export const dynamic` de /red intactos. Petróleo NO usado para la marca de seed (reservado). banned-vocab negative-match verde (suite completa).

## Self-Check: PASSED

- app/app/agenda/page.test.tsx — FOUND
- app/app/agenda/page.tsx — FOUND
- app/components/carril-accordion.tsx — FOUND
- app/components/red/red-graph.tsx — FOUND
- app/components/red/red-graph.test.tsx — FOUND
- app/components/red/nodo-parlamentario.tsx — FOUND
- app/app/red/page.tsx — FOUND
- app/app/red/page.test.tsx — FOUND
- app/app/globals.css — FOUND
- commits a736bce, 608d117 — FOUND
