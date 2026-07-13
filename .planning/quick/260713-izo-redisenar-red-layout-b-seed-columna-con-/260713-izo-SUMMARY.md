---
phase: quick-260713-izo
plan: "01"
subsystem: frontend-red
tags: [red, layout-b, xyflow-removal, anti-insinuacion, ui]
requires: [subgrafo_red RPC, etiquetaHecho/ventanaTexto, formatNombre, safeExternalHref]
provides: ["/red layout B (seed→columna) sin @xyflow/react"]
affects: [app/components/red/, app/app/globals.css, app/package.json]
tech-stack:
  removed: ["@xyflow/react 12.11.0"]
  patterns: ["diagrama DOM seed→columna", "conectores SVG fan-out useLayoutEffect+ResizeObserver", "paginación 10/pág honesta", "detalle inline con procedencia"]
key-files:
  created: []
  modified:
    - app/components/red/red-graph.tsx
    - app/components/red/red-graph.test.tsx
    - app/components/red/arista-hecho.tsx
    - app/app/globals.css
    - app/package.json
    - pnpm-lock.yaml
  deleted:
    - app/components/red/nodo-parlamentario.tsx
decisions:
  - "Layout B (sketch 002 ★ Elegida): tarjeta seed a la izquierda + columna paginada de vecinos + conectores SVG con fan-out, en vez del anillo radial xyflow apiñado"
  - "Una sola estructura responsive: la columna es el default (móvil, sin conectores); el layout de dos columnas + sticky + conectores se activa a ≥48rem — elimina la doble rama canvas/lista y WR-06"
  - "drawConn defensivo ante rects en cero / offsetParent null / <48rem: renderizar/paginar/seleccionar nunca lanza (jsdom da ceros)"
  - "Paginación 10/página cubre TODOS los vecinos (espíritu RED-01 intacto, mecanismo distinto del cap 24 + 'N vecinos más' que se eliminó): ningún vecino descartado"
metrics:
  duration_min: 18
  completed: "2026-07-13"
---

# Phase quick-260713-izo Plan 01: Rediseño /red al Layout B (seed → columna) Summary

Reescritura de la vista `/red` al layout B "Diagrama seed → columna" (sketch 002, variante ★ Elegida): reemplaza el canvas radial `@xyflow/react` —que seguía viéndose apiñado en producción (24 nodos convergiendo a un anillo de 260px)— por un diagrama DOM legible de lectura izquierda→derecha, con tarjeta seed a la izquierda, columna paginada de vecinos a la derecha, conectores SVG curvos con fan-out y detalle inline expandible con procedencia siempre en el DOM. `@xyflow/react` eliminado por completo del app.

## What Was Built

**Task 1 (commit `883b839`) — red-graph.tsx reescrito al layout B + island CSS + tests:**
- `red-graph.tsx`: diagrama DOM `.net-b-layout` (relative) con `<svg>` de conectores (absolute, aria-hidden), tarjeta seed sticky a la izquierda (`.net-b-seedcol`/`.net-b-seed`), y columna de vecinos (`.net-b-list`). Cada fila `.net-b-row` (borde civic por cámara, `--sel` al seleccionar) es `tabIndex=0` + `role=button`, con onClick/onKeyDown(Enter/Space) que abre el detalle inline (etiquetaHecho + ventana mono + procedencia Fuente/Periodo/Registro/"Ver fuente oficial" con `safeExternalHref` + microcopy anti-insinuación + link a `/red?seed=<vecino>`). Conectores fan-out vía `drawConn()` con refs + `useLayoutEffect` + `ResizeObserver` + `requestAnimationFrame`, defensivo ante rects en cero. Paginación `B_PAGE=10` sobre TODOS los vecinos con pager honesto ("Vecinos 1–10 de 24 · página 1 de 3 · orden alfabético"); filtrar/cambiar seed resetea a página 1. Eliminados: imports xyflow, `radialPos`, `CAP=24`, bloque "Ver N vecinos más", lista móvil `.net-vecinos`, wrapper `hidden md:block` + `<ReactFlow>`.
- `globals.css`: island `.net-*` reescrita dentro de `@layer components` (para que las utilities de Tailwind ganen predeciblemente — la cascada `.net-*` vs Tailwind ya mordió 2 veces). Nuevas clases: `.net-leyenda*`, `.net-chip*` (borde civic 1.5px, background transparente, JAMÁS relleno de marca), `.net-b-nota-movil`, `.net-b-layout`/`-seedcol`/`-seed`/`-seednote`/`-list`/`-row` (+`--camara`/`--senado`/`--sel`)/`-row__*`/`-conn`/`-pager`, `.net-b-hecho*`, `.net-microcopy`, `.net-b-link`. Media queries en rem (48rem = breakpoint md v4); la columna es el default (móvil), el layout de dos columnas + sticky se activa a ≥48rem. Conservadas `.net-filtros*` y `.net-prov*`. Petróleo (`--accent-product`) SOLO en conectores/enlaces/focus.
- `red-graph.test.tsx`: suite reescrita sin `vi.mock(@xyflow/react)` — tests de comportamiento del layout B (fila sobria, hecho tipado en el detalle, procedencia siempre en el DOM, selección clic/Enter, SVG de conectores presente, paginación 10/pág que cubre 24 vecinos sin pérdida, orden alfabético invariante al array de entrada, filtros tipo/ventana + reset a pág 1, estados honestos 0-aristas/null/CR-01/fallback, fallback nombre vacío WR-05, leyenda anti-insinuación + nota móvil). **31/31 verde.**

**Task 2 (commit `75a8617`) — purga de @xyflow/react residual:**
- `arista-hecho.tsx`: reducido a los helpers puros `etiquetaHecho`/`ventanaTexto` (+`fechaLiteral` interno); eliminados `AristaHecho`/`EtiquetaArista`/`AristaHechoData` y los imports de xyflow + tooltip/Info.
- `nodo-parlamentario.tsx`: **eliminado** (ya no se monta en ningún path; grep confirmó cero imports externos).
- `package.json` + `pnpm-lock.yaml` (raíz): `@xyflow/react 12.11.0` removido. Grep de `@xyflow/react` en `app/` (sin node_modules) → solo referencias en COMENTARIOS, cero imports.
- **Suite completa 751/751 verde; `tsc --noEmit` sin errores.**

## Verification Results

- `pnpm test` (suite completa): **71 archivos, 751 tests verde.**
- `pnpm exec tsc --noEmit`: **sin errores (exit 0).**
- `grep @xyflow/react app/` (sin node_modules): sin imports en código fuente; package.json y lockfile sin la dependencia.
- Firma de props `<RedGraph subgrafo seedId>` INTACTA; `page.tsx` sin cambios de código (RPC `subgrafo_red`, gate NET_PUBLIC_ENABLED, force-dynamic todos intactos).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test copy] Regex de banned-vocab en la suite chocaba con copy legítimo**
- **Found during:** Task 1 (GREEN)
- **Issue:** El check `/partido/i` casaba con "com**partido**s" (de "hechos públicos compartidos" en la leyenda), y el stripper de negaciones no cubría la copy real "Nunca indica afinidad, acuerdo ni motivo".
- **Fix:** El check pasó a `\bpartido\b` (token aislado de afiliación; "compartidos" es texto legítimo del hecho) y el stripper de negaciones se alineó a la copy LOCKED real de la leyenda antes de escanear afirmaciones prohibidas.
- **Files modified:** app/components/red/red-graph.test.tsx
- **Commit:** 883b839

**2. [Rule 3 - Blocking] pnpm añadió churn no relacionado a pnpm-workspace.yaml**
- **Found during:** Task 2 (`pnpm install`)
- **Issue:** La versión de pnpm agregó un bloque placeholder `allowBuilds:` (con "set this to true or false") a `pnpm-workspace.yaml` — config incompleta, no intencional.
- **Fix:** Revertido `pnpm-workspace.yaml` con `git checkout --`; solo se commiteó el drop real de xyflow en `pnpm-lock.yaml`.
- **Files modified:** ninguno (revertido)
- **Commit:** n/a

## Task 3 — checkpoint:human-verify (deploy + BrowserOS cold-read)

**Deploy: ✅ EJECUTADO por Claude y verificado por HTTP.**

- **Build OpenNext (Docker node:22-slim):** source pre-copiado a `C:/Temp/obs-build` (robocopy, evita el cuello OneDrive); `.open-next/worker.js` generado, build complete.
- **Deploy wrangler (OAuth local):** `wrangler deploy --config wrangler.jsonc` → `observatorio-congreso` desplegado. **Version ID `6534fe9f-52bf-4a5b-a527-e788f1b75250`**, URL `https://observatorio-congreso.thevalis.workers.dev`.
- **Verificación HTTP `/red?seed=D1009` → 200** + marcadores del layout B PRESENTES en el HTML (`net-b-layout`, `net-b-seedcol`, `net-b-list`, `net-b-row`, `net-b-conn`, `net-b-pager`, `net-leyenda`, `net-chip`) y clases xyflow antiguas AUSENTES (`net-lienzo`/`net-nodo`/`net-arista`/`net-vecinos`). Evidencia: `evidence/http-verificacion-deploy.txt` + `evidence/VEREDICTO.md`.

**Gotchas de deploy nuevos (documentar):**
- **`[Rule 3 - Blocking]` pnpm 11 + OpenNext deps-check:** pnpm 11 convirtió el warning `ERR_PNPM_IGNORED_BUILDS` en error duro dentro del `runDepsStatusCheck` de OpenNext → el build fallaba en el primer intento. Fix: `pnpm config set dangerouslyAllowAllBuilds true` antes del `pnpm install` en el contenedor.
- **`[Rule 3 - Blocking]` docker `-w /app` via git-bash:** MSYS convierte `/app` → `C:/Program Files/Git/app`. Correr `docker run` vía PowerShell (gotcha conocido reconfirmado).
- **`[Rule 3 - Blocking]` wrangler via PowerShell pipeline:** `node ... | Select-Object` hace que PS trate `node` como documento en pipeline. Fix: operador de llamada `& node.exe '...wrangler.js' deploy` con salida a archivo.

**RESUELTO (gate humano — checkpoint:human-verify, gate="blocking"):**
La lectura fría BrowserOS SÍ la ejecutó el orquestador (vía `scripts/bros-cli.mjs`, MCP 127.0.0.1:9200 — corrección al supuesto del ejecutor): 6 capturas (desktop cabecera/diagrama/detalle, 390px forzado ×2, sin seed) + verificación programática (10 filas/pág, paginación real a "Vecinos 11–20 de 92", 0 clases react-flow, microcopy y procedencia en DOM) sobre el deploy live `6534fe9f`. Veredicto: **COMPRENSIBLE / YA NO APIÑADO**. Detalle y hallazgo P3 no bloqueante en `evidence/VEREDICTO.md`.

El operador respondió **"aprobado"** el 2026-07-13 — gate CERRADO. /red layout B validado en producción.

## Self-Check: PASSED

**Archivos:**
- FOUND: app/components/red/red-graph.tsx
- FOUND: app/components/red/red-graph.test.tsx
- FOUND: app/components/red/arista-hecho.tsx
- FOUND: app/app/globals.css
- DELETED-OK: app/components/red/nodo-parlamentario.tsx

**Commits:**
- FOUND: 883b839 (Task 1)
- FOUND: 75a8617 (Task 2)

**Verificación:** suite 751/751 verde, `tsc --noEmit` exit 0, `@xyflow/react` sin imports en `app/`, deploy LIVE HTTP 200 con layout B en el HTML.
