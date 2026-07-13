---
phase: 62-red-grafo-de-relaciones-entendible
plan: 02
subsystem: frontend / red (grafo de relaciones)
tags: [red, mobile-fallback, camara-border, anti-insinuacion, provenance, tdd]
requires:
  - "62-01 radial ego layout + cap (shipped) — construye encima"
  - "etiquetaHecho/ventanaTexto de arista-hecho.tsx"
  - "safeExternalHref de @/lib/utils"
  - "civic-tokens.css (--camara-muted/--senado-muted, ya-wrapped)"
provides:
  - "borde institucional por cámara en el nodo (.net-nodo--camara/--senado) — no posición, no partido, no petróleo"
  - "fallback móvil <768px como lista honesta de vecinos con enlaces + hecho + procedencia (.net-vecinos)"
  - "canvas radial envuelto en hidden md:block (solo ≥768px); nota band-aid eliminada"
affects:
  - "app/components/red/red-graph.tsx (isla cliente /red)"
  - "app/components/red/nodo-parlamentario.tsx"
  - "app/app/globals.css (.net-* block)"
  - "app/components/red/red-graph.test.tsx"
tech-stack:
  added: []
  patterns:
    - "clase de borde por cámara compuesta con filter(Boolean).join(' ') — conserva net-nodo + net-nodo--seed"
    - "tokens cívicos ya-wrapped consumidos DIRECTO (var(--camara-muted)), NUNCA doble-wrap hsl(var(...))"
    - "canvas hidden md:block + lista md:hidden — el canvas sigue en el árbol DOM (test de clases token intacto)"
    - "procedencia en el DOM de cada fila móvil (fuente + ventana + Ver fuente oficial vía safeExternalHref)"
key-files:
  created: []
  modified:
    - "app/components/red/red-graph.tsx"
    - "app/components/red/nodo-parlamentario.tsx"
    - "app/app/globals.css"
    - "app/components/red/red-graph.test.tsx"
decisions:
  - "Lista móvil por vecino renderizado (rendered), no por arista: una fila por vecino con su(s) hecho(s) anidados — legible a 390px y espeja el orden alfabético del anillo."
  - "El conteo de Links /red?seed= del test RED-01 de overflow se acotó a .net-vecinos-mas: la lista móvil también enlaza a /red?seed= por vecino, así que el aserto de '6 overflow' se scopea al bloque de truncación (no a todo el DOM)."
  - "Borde de cámara como border-left 3px en el tono -muted (institucional sutil, wayfinding), coexiste con el seed 2px --foreground que mantiene prioridad visual."
metrics:
  duration: "~14 min"
  completed: "2026-07-09"
  tasks: 2
  files: 4
---

# Phase 62 Plan 02: Fallback móvil vecinos-list + borde por cámara Summary

Cerré las dos dimensiones que faltaban tras el core radial de 62-01: (1) el nodo ahora distingue Cámara vs Senado por un **borde institucional izquierdo** (`.net-nodo--camara`/`--senado`, tono cívico -muted, nunca posición, nunca partido, nunca petróleo); (2) a **<768px** `/red` con seed muestra una **lista honesta de vecinos con enlaces** (`.net-vecinos`, `md:hidden`) — nombre + cámara + hecho compartido + ventana temporal + "Ver fuente oficial" por fila — reemplazando la nota band-aid "se lee mejor en pantalla ancha", mientras el anillo radial se conserva ≥768px dentro de un wrapper `hidden md:block`. Cero DDL, cero cambios a page.tsx/RPC.

## What Was Built

- **Task 1 (TDD RED→GREEN): borde por cámara.**
  - RED (`test(62-02)` `b52fbf5`): 3 tests nuevos en el describe "nodo sobrio" — `diputados` → `.net-nodo--camara`, `senado` → `.net-nodo--senado`, `null` → ninguna; ningún nodo con partido/`accent-product` inline. 1 en rojo confirmado contra el nodo sin clase de cámara.
  - GREEN (`feat(62-02)` `f96df76`): `nodo-parlamentario.tsx` compone la clase con `filter(Boolean).join(" ")` conservando `net-nodo` + `net-nodo--seed`; `globals.css` añade `.net-nodo--camara`/`--senado` con `border-left: 3px` consumiendo `var(--camara-muted)`/`var(--senado-muted)` **directo** (sin doble-wrap). `aria-label` intacto; solo el borde, nada de partido/foto/RUT.

- **Task 2 (TDD RED→GREEN): fallback móvil como lista de vecinos.**
  - RED (`test(62-02)` `7788f47`): eliminé los 2 tests de la nota band-aid y añadí: (i) el string "mejor en pantalla ancha" ya no existe; (ii) el canvas vive en un wrapper `hidden md:block`; (iii) `.net-vecinos md:hidden` con heading "Vecinos de", filas Link a `/red?seed=`, hecho `etiquetaHecho` y "Ver fuente oficial"; (iv) la lista no aparece en el estado vacío. 3 en rojo confirmados.
  - GREEN (`feat(62-02)` `4b6336f`): `red-graph.tsx` importa `etiquetaHecho`/`ventanaTexto`/`safeExternalHref`; arma `vecinosLista` (por vecino renderizado, con sus aristas seed↔vecino); elimina la nota band-aid; envuelve el canvas en `hidden md:block`; añade la `<ul className="net-vecinos md:hidden">` — cada fila un Link a `/red?seed=<id>` con nombre + cámara + hecho(s) anidados (ventana `font-mono` + "Ver fuente oficial ↗" vía `safeExternalHref`). `globals.css` añade `.net-vecinos*` (filas 44px touch, procedencia muted, petróleo solo en el enlace de fuente). Suite 747/747 + typecheck verdes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El test RED-01 de overflow contaba TODOS los Links `/red?seed=` del DOM**
- **Found during:** Task 2 (GREEN).
- **Issue:** El test shipped de 62-01 "aparece 'Ver 6 vecinos más'" contaba `container.querySelectorAll("a")` con `/red?seed=` esperando exactamente 6. Con la nueva lista móvil, cada vecino renderizado (24) también enlaza a `/red?seed=`, elevando el conteo a 30 → test roto por una interacción legítima de Task 2.
- **Fix:** Acoté el aserto al bloque de truncación `.net-vecinos-mas` (el control de overflow), que sigue teniendo exactamente 6 Links. La intención original del test (6 vecinos de overflow) se preserva; la lista móvil es una superficie distinta.
- **Files modified:** `app/components/red/red-graph.test.tsx`
- **Commit:** `4b6336f`

### TDD Gate Compliance

- **Task 1** — RED: `test(62-02)` `b52fbf5` (1 en rojo). GREEN: `feat(62-02)` `f96df76` (745 verde).
- **Task 2** — RED: `test(62-02)` `7788f47` (3 en rojo). GREEN: `feat(62-02)` `4b6336f` (747 verde).
- REFACTOR: no fue necesario en ninguna tarea.

## Verification Evidence

- `pnpm test -- red-graph` → **747 passed (70 files)**, incluye borde de cámara ×3, lista móvil ×4 (band-aid ausente, wrapper hidden md:block, lista con hecho+fuente, lista ausente en vacío), filtros intactos, más todos los tests de 62-01/55-05/B20a/provenance.
- `pnpm test` (suite completa) → **747 passed**, sin regresión.
- `pnpm typecheck` → verde (`tsc --noEmit`, sin salida de error).
- Grep: `red-graph.tsx` sin "mejor en pantalla ancha"; con `net-vecinos`+`md:hidden`, "Vecinos de", `/red?seed=`. `globals.css` sin `hsl(var(--camara`; con `.net-nodo--camara`, `.net-nodo--senado`, `.net-vecinos` (filas `min-height: 2.75rem`, enlace en `--accent-product`).

## Threat Surface

- **T-62-03 (Tampering/XSS — mitigado):** cada enlace de fuente de la fila móvil pasa por `safeExternalHref(h.enlace)`; con esquema peligroso (`javascript:`) no se emite `<a>` (espejo del comportamiento ya testeado de `arista-hecho.tsx`).
- **T-62-04 (Info Disclosure — aceptado):** el borde de cámara usa el token institucional cívico (identidad de cámara, no partido); la cámara ya se muestra como label textual, no expone dato vedado.

## Notes for the Next Plan

- **RED-02 queda funcionalmente cerrado** (radial 62-01 + móvil-list + borde de cámara 62-02). Falta solo verificación visual/UI.
- **RED-03** (BrowserOS cold-read desktop + 390px con/sin seed → veredicto "comprensible", + deploy runbook 61-02) es el gate de ops out-of-band restante de la fase — no cubierto por este plan de código.
- La rama fallback SIN seed (legacy) no monta la lista móvil (`vecinosLista` requiere `seedNodo`); el foco de la fase es el path CON seed y el estado no-seed es el selector JS-free de page.tsx.

## Self-Check: PASSED

- FOUND: app/components/red/red-graph.tsx (modified — imports, vecinosLista, hidden md:block wrapper, .net-vecinos list)
- FOUND: app/components/red/nodo-parlamentario.tsx (modified — camaraClase append)
- FOUND: app/app/globals.css (modified — .net-nodo--camara/--senado, .net-vecinos*)
- FOUND: app/components/red/red-graph.test.tsx (modified — camara-border tests, mobile-list tests, scoped overflow assert)
- FOUND commit: b52fbf5 (test(62-02) RED Task 1)
- FOUND commit: f96df76 (feat(62-02) GREEN Task 1)
- FOUND commit: 7788f47 (test(62-02) RED Task 2)
- FOUND commit: 4b6336f (feat(62-02) GREEN Task 2)
