---
phase: 18-net-grafo-de-influencia-xyflow-react
plan: 03
subsystem: NET — grafo de influencia (UI client island @xyflow/react)
tags: [next16, react19, xyflow, client-island, anti-insinuacion, provenance, cc-by-4.0, tdd, gated-off]
status: complete
requires:
  - app/app/red/page.tsx (RSC 18-02 que pasa el JSON de subgrafo_red a la isla)
  - app/components/red/red-graph.tsx (placeholder 18-02 con el contrato de props Subgrafo a honrar)
  - app/components/ui/tooltip.tsx (Radix tooltip ya existente — provenance popover)
  - app/lib/utils.ts (safeExternalHref — saneo anti-XSS del enlace de la fuente)
  - "@xyflow/react@12.11.0 (dep client-island, instalada en app/)"
provides:
  - app/components/red/red-graph.tsx (isla 'use client' @xyflow/react con filtros tipo/tiempo + provenance)
  - app/components/red/nodo-parlamentario.tsx (nodo custom: nombre + cámara, sin afiliación/imagen/insignia)
  - app/components/red/arista-hecho.tsx (arista custom: copy del hecho + ventana + tooltip de procedencia + CC BY 4.0)
  - app/components/red/red-graph.test.tsx (RTL: nodo/arista sobrios, filtros, provenance, estado honesto)
affects:
  - Plan 18-04 (verificación de fase / cierre NET)
  - "F17 (operador): encender NET_PUBLIC_ENABLED tras signoff legal — la UI ya está lista detrás del gate"
tech-stack:
  added:
    - "@xyflow/react@12.11.0 (client island; peer react>=17; sin deps node-only)"
  patterns:
    - isla 'use client' con import de @xyflow/react SOLO bajo components/red/ (frontera de bundle — no infla rutas server)
    - import "@xyflow/react/dist/style.css" en la raíz de la isla (red-graph.tsx)
    - nodeTypes/edgeTypes custom para proyectar copy sobrio (nodo = nombre+cámara; arista = hecho tipado + ventana)
    - layout rejilla determinista por cámara — jamás simulación física (la proximidad visual no se lee como relación)
    - filtros client-side (useState + useMemo) sobre el subgrafo ya recibido, sin round-trips
    - procedencia siempre en el DOM (trazabilidad a la fuente) + tooltip Radix como ayuda ampliada
    - propagación de atribución por fila (CC BY 4.0 solo si la fila trae licencia; NULL => sin atribución)
    - href de fuente saneado con safeExternalHref (javascript:/data: => sin enlace)
    - estado honesto para grafo vacío (0 aristas) — nunca error ni nodo inventado
key-files:
  created:
    - app/components/red/nodo-parlamentario.tsx
    - app/components/red/arista-hecho.tsx
    - app/components/red/red-graph.test.tsx
  modified:
    - app/components/red/red-graph.tsx
    - app/app/globals.css
    - app/app/red/page.test.tsx
    - app/package.json
    - pnpm-lock.yaml
decisions:
  - "El cuerpo de RedGraph se reemplazó por el grafo real @xyflow/react manteniendo la firma de props (Subgrafo|null) y el import path @/components/red/red-graph — la RSC /red sigue compilando sin cambios"
  - "Layout = rejilla determinista agrupada por cámara, NUNCA una simulación física; la proximidad visual entre nodos no debe leerse como una relación entre las personas (anti-insinuación)"
  - "Copy de arista por tipo: co_lobby_contraparte => 'Ambos recibieron audiencia de {contraparte}' + ventana temporal; describe la co-ocurrencia observable, sin valoración, sin medida de proximidad, sin motivo"
  - "Procedencia (origen + ventana + registro + licencia + enlace) se renderiza SIEMPRE en el DOM, no solo tras hover: la trazabilidad a la fuente es principio rector; el tooltip Radix la duplica como ayuda visual"
  - "Mecanismo CC BY 4.0: la licencia se pinta solo si la fila la trae; con NULL no se afirma atribución. En el MVP las aristas (co_lobby) llevan licencia NULL (atribución leylobby), así que el mecanismo existe pero no muestra CC BY 4.0 todavía — listo para aristas derivadas de InfoProbidad"
  - "Filtros por tipo (checkbox por tipo presente) y por ventana (date desde/hasta) operan client-side sobre el subgrafo ya recibido; una arista se oculta si su tipo está destildado o si su ventana no solapa el rango"
  - "El enlace de la fuente pasa por safeExternalHref: un esquema peligroso (javascript:) degrada a 'sin enlace' en vez de inyectar (espejo de ProvenanceBadge #9)"
  - "Test de isla: @xyflow/react se mockea con un doble ligero (invoca nodeTypes/edgeTypes con sus datos) porque el lienzo SVG mide DOM y no funciona en jsdom; el render real del lienzo es solo de navegador"
  - "DEVIACIÓN page.test.tsx: el assert 'monta la isla' estaba acoplado a un comportamiento incidental del placeholder (listar nombres de nodo en el caso vacío). La isla real NO inventa un nodo aislado como grafo; el assert ahora verifica el estado honesto del subgrafo sin aristas, que prueba igual que la isla consumió el JSON del RPC"
  - "Comentarios anti-insinuación reformulados para describir la prohibición SIN las palabras-gatillo (el grep de CI no distingue describir de violar) — mismo cuidado que 18-02"
  - "DEVIACIÓN lockfile: el plan nombró app/package-lock.json pero el workspace usa pnpm; el lockfile real actualizado es pnpm-lock.yaml en la raíz"
  - "@testing-library/user-event NO está instalado; las interacciones de filtro se prueban con fireEvent (ya disponible) en vez de añadir una dependencia de test"
metrics:
  duration: ~12min
  completed: 2026-06-21
  tasks_completed: 3
  tasks_total: 3
  files: 7
---

# Phase 18 Plan 03: NET UI — isla @xyflow/react del grafo de relaciones (NET-02) Summary

Reemplazo del placeholder `red-graph.tsx` por la isla real `@xyflow/react@12.11.0` (`'use client'`, `import "@xyflow/react/dist/style.css"`) que renderiza el subgrafo que la RSC `/red` (18-02) le pasa por props, honrando el mismo contrato `Subgrafo|null` sin romper el import ni la ruta. La isla ofrece nodo custom sobrio (nombre + cámara, sin afiliación/imagen/insignia de orden de personas), arista custom como hecho tipado ("Ambos recibieron audiencia de {contraparte}") con su ventana temporal, tooltip de procedencia por arista (origen + ventana + registro + enlace + licencia) y el mecanismo de propagación de atribución CC BY 4.0 listo para aristas derivadas de InfoProbidad. Filtros client-side por tipo de relación y por ventana temporal operan sobre el subgrafo ya recibido. El grafo vacío (deuda de datos actual: 0 aristas) se trata como estado honesto, nunca error. xyflow queda estrictamente contenido en la client island bajo `components/red/` — no infla el bundle server de las rutas existentes. NET sigue gateado-OFF (sin exposición pública hasta el signoff F17). TDD en la tarea de UI; vitest 246/246 verde, tsc limpio, eslint limpio, negative-match anti-insinuación limpio.

## What Was Built

### Task 1 — [LEGITIMIDAD] checkpoint @xyflow/react (ya resuelto antes de esta sesión)
El gate de legitimidad blocking-human ya estaba aprobado: `@xyflow/react@12.11.0` instalado en `app/` (org oficial xyflow, peer `react>=17`, sin deps node-only, dist/style.css presente). No se re-instaló ni se re-gateó.

### Task 2 — `@xyflow/react@12.11.0` en `app/` (commit `6b8bb8d`)
Dep client-island registrada en `app/package.json` y `pnpm-lock.yaml` (lockfile del workspace). Verificado: resoluble desde `app/node_modules`, versión 12.11.0, `dist/style.css` presente. No importada en ningún archivo server/compartido.

### Task 3 — isla RedGraph + nodo/arista custom + provenance + filtros + globals.css (commits `48fc977` RED, `c65f910` GREEN)
- `red-graph.tsx`: isla `'use client'` (línea 1) con `import "@xyflow/react/dist/style.css"`. Mapea `subgrafo.nodos`/`subgrafo.aristas` a nodes/edges de xyflow con `nodeTypes`/`edgeTypes` custom. Layout rejilla determinista por cámara (jamás simulación física). Filtros client-side por tipo (checkbox) y por ventana (date desde/hasta) con `useState`/`useMemo`. Grafo vacío => estado honesto.
- `nodo-parlamentario.tsx`: nodo custom que proyecta SOLO nombre + cámara (cámara como identidad institucional, etiqueta humana). Nunca afiliación, imagen del rostro, identificador tributario ni insignia de valoración/orden.
- `arista-hecho.tsx`: arista custom con label = copy del hecho tipado + ventana temporal; procedencia (origen + periodo + registro + licencia + enlace saneado) siempre en el DOM, más tooltip Radix. `etiquetaHecho`/`ventanaTexto` exportadas como helpers puros.
- `globals.css`: extendido con los estilos de la isla (tokens crema/petróleo de Phase 19); `civic-tokens.css` intacto.
- `red-graph.test.tsx`: 14 casos RTL cubriendo los 6 comportamientos del plan (nodo sobrio sin partido/foto/score, arista = hecho + ventana sin afinidad/causa, provenance con licencia y con NULL, href peligroso no enlazado, filtros tipo/tiempo que alteran las aristas visibles, estado honesto vacío y subgrafo null).

## Verification

- `cd app && npx vitest run` → **246/246 verde** (24 archivos), incluye los 14 de `red-graph.test.tsx` y los 6 de `app/red/page.test.tsx`.
- `cd app && npx tsc --noEmit` → **limpio** (exit 0).
- `cd app && npx eslint components/red` → **limpio** (0 errores, 0 warnings).
- Negative-match anti-insinuación sobre los 3 componentes red/* → **CERO** ocurrencias de `puntaje|score|ranking|afinidad|cercan|alinead|bloque de votos|por eso|a cambio de|conexión sospechosa|fuerza|force`; **CERO** `partido`/`rut`/`foto` en el nodo.
- Bundle isolation: `@xyflow/react` se importa SOLO en archivos `'use client'` bajo `components/red/` (y el test). La RSC `app/app/red/page.tsx` solo lo menciona en un comentario, no lo importa en runtime.

## Anti-insinuación (superficie más insinuante del producto)

- Nodo: identidad pública confirmada (nombre + cámara) — sin la afiliación (vedada por piso PII 0018/0021/0022), sin imagen del rostro, sin identificador tributario, sin insignia que valore u ordene personas.
- Arista: hecho tipado con fuente + ventana; el copy describe la co-ocurrencia observable ("Ambos recibieron audiencia de {contraparte}"), jamás una valoración, una medida de proximidad ni un motivo. Sin medida agregada de co-ocurrencia, sin orden de personas, sin camino presentado como hallazgo.
- Layout neutral (rejilla por cámara) en vez de simulación física: la cercanía visual entre nodos no se debe leer como una relación entre las personas.
- Docstrings que NOMBRAN las prohibiciones reformulados para no usar las palabras-gatillo (el grep de CI no distingue describir de violar).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lockfile real = pnpm-lock.yaml (no app/package-lock.json)**
- **Found during:** Task 2.
- **Issue:** El plan nombró `app/package-lock.json`, pero el workspace usa pnpm con un único `pnpm-lock.yaml` en la raíz; no existe `package-lock.json`.
- **Fix:** Se commiteó `app/package.json` + `pnpm-lock.yaml` (el lockfile efectivamente actualizado por el install).
- **Commit:** `6b8bb8d`.

**2. [Rule 3 - Blocking] @testing-library/user-event no instalado → fireEvent**
- **Found during:** Task 3 (RED).
- **Issue:** El test inicial usaba `@testing-library/user-event`, que no está en el repo; instalar una dep nueva está fuera del auto-fix.
- **Fix:** Las interacciones de filtro se prueban con `fireEvent` (de `@testing-library/react`, ya disponible). Sin nueva dependencia.
- **Commit:** `c65f910`.

**3. [Rule 1 - Test acoplado a comportamiento incidental] page.test.tsx 'monta la isla'**
- **Found during:** Task 3 (GREEN).
- **Issue:** El assert de 18-02 verificaba que el nombre del nodo semilla apareciera incluso con 0 aristas — acoplado a que el placeholder listaba nodos en el estado vacío. La isla real, correctamente, NO inventa un nodo aislado como si fuera un grafo (anti-insinuación + estado honesto).
- **Fix:** El assert ahora verifica el estado honesto del subgrafo sin aristas (`/aún no hay relaciones/i`), lo que prueba igual que la isla consumió el JSON del RPC con la firma de props estable y sin lanzar.
- **Commit:** `c65f910`.

## Known Stubs

Ninguno que impida el objetivo del plan. El mecanismo de propagación CC BY 4.0 está implementado y probado (se muestra cuando la fila trae `licencia`), pero en el MVP las aristas `co_lobby_contraparte` llevan `licencia = NULL` (atribución leylobby por fila, no CC BY 4.0). Esto es **intencional y documentado** (17-DOSSIER §6 / 18-RESEARCH §8 Pitfall): ninguna arista del MVP deriva de InfoProbidad, así que ninguna porta CC BY 4.0 todavía. El mecanismo queda listo para cuando lleguen aristas InfoProbidad-derived.

## Estado del requisito y del gate

- **NET-02 (UI client island con filtros tipo/tiempo, provenance por arista, CC BY 4.0 propagado):** mecanismo entregado y probado. Públicamente **gateado-OFF** hasta el signoff legal F17 (`17-LEGAL-DOSSIER` `signoff: approved`).
- **NET-01 (datos):** aplicado al remoto en 18-01; el grafo está vacío por deuda de datos (lobby todo `no_confirmado`), lo que la isla muestra como estado honesto.

## Self-Check: PASSED

- Archivos creados/modificados verificados en disco: `red-graph.tsx`, `nodo-parlamentario.tsx`, `arista-hecho.tsx`, `red-graph.test.tsx`, `globals.css`, `18-03-SUMMARY.md` — todos FOUND.
- Commits verificados en git: `48fc977` (test/RED), `6b8bb8d` (chore/dep), `c65f910` (feat/GREEN) — todos FOUND.

