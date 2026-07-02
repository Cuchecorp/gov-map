---
phase: quick-260702-rbb-fix-b20-b21
plan: 01
subsystem: NET (grafo /red + ficha)
tags: [net, red-graph, anti-insinuacion, pre-flip, quick]
requires:
  - "app/lib/net-gate.ts (netPublicEnabled fail-closed)"
  - "RPC parlamentarios_publico (allowlisted, PII-safe)"
  - "PARLAMENTARIO_ID_RE (@/lib/buscar)"
provides:
  - "red-graph: rfNodes sin huerfanos + layout determinista por carril de camara"
  - "/red sin semilla: selector JS-free (form GET + optgroups por camara)"
  - "ficha: enlace gated a /red?seed=<id> (nodo ausente con NET OFF)"
affects:
  - "app/components/red/red-graph.tsx"
  - "app/app/red/page.tsx"
  - "app/app/parlamentario/[id]/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Contador por carril (laneCounters) -> indice LOCAL por camara para posicion()"
    - "Filtro de nodos por Set de aristas visibles (nodosVisiblesIds)"
    - "Selector server-rendered espejo de DirectoryFilter/DirectoryList (throw-on-error #34)"
    - "Enlace gated espejo de gates cruces/money ({gate(process.env) && ...})"
key-files:
  created: []
  modified:
    - "app/components/red/red-graph.tsx"
    - "app/components/red/red-graph.test.tsx"
    - "app/app/red/page.tsx"
    - "app/app/red/page.test.tsx"
    - "app/app/parlamentario/[id]/page.tsx"
    - "app/app/parlamentario/[id]/page.test.tsx"
decisions:
  - "El enlace NET de la ficha es <nav>, NO <section id> - es navegacion pura, no un carril de dominio; asi respeta el invariante LOCKED section<->CarrilAccordion 1:1 (page-estructura Test 2)"
  - "posicion() pasa a indice por carril (col = floor(laneIndex/3), row = laneIndex%3) manteniendo bandas por camara; rejilla determinista pura, cero fisica (anti-insinuacion LOCKED)"
metrics:
  duration: ~10min
  completed: 2026-07-02
---

# Phase quick-260702 Plan 01: Fix B20+B21 pre-flip NET (/red grafo + nodos) Summary

Cuatro correcciones sobre la superficie NET ya existente que la dejan usable/precisa
sin tocar el candado ni la frontera anti-insinuacion: nodos huerfanos excluidos del
lienzo (B20a), layout real por carril de camara (B20b), selector de semilla JS-free en
/red (B21a), y enlace gated desde la ficha a /red (B21b). Prerrequisito de codigo para
el flip de NET_PUBLIC_ENABLED (que hace el operador despues del sign-off legal F17).

## Tasks

### Task 1 - red-graph: huerfanos (B20a) + layout por carril (B20b) - commit 2c958e5
- B20a: rfNodes se deriva de nodosVisibles = nodos.filter(n => nodosVisiblesIds.has(n.id))
  en lugar de nodos - ningun nodo sin arista visible llega al lienzo. El early-return de
  aristas.length === 0 (estado honesto) queda intacto.
- B20b: posicion recibia un indice GLOBAL con Math.floor(index/1) (no-op) -> los
  "carriles" no existian. Ahora un laneCounters: Record<string,number> lleva un contador
  LOCAL por camara; posicion(laneIndex, camara) usa col = floor(laneIndex/3),
  row = laneIndex%3, y = fila*ROW*3 + row*ROW (banda por camara). Rejilla determinista
  pura, cero simulacion fisica.
- Tests: el doble de @xyflow/react ahora expone data-x/data-y por nodo. +3 tests:
  huerfano ausente, destildar tipo -> lienzo ausente, layout por carril separa camaras y es
  determinista. 17/17 verde.

### Task 2 - /red: selector de semilla JS-free (B21a) - commit b7019e3
- El branch if (!seed) reemplaza el estado textual por un <form method="get" action="/red">
  con <select name="seed"> agrupado en <optgroup label="Camara">/<optgroup label="Senado">,
  placeholder deshabilitado y required. Alimentado por parlamentarios_publico (allowlisted,
  PII-safe) con throw-on-error (#34, nunca degrada a "sin opciones").
- Gate (primera sentencia), orden validacion-antes-de-DB y path con-semilla intactos. Cero RPC
  nueva. El GET recarga /red?seed=<id> -> cae en el path de validacion PARLAMENTARIO_ID_RE.
- Tests: rpcMock pasa a dispatch por nombre; test sin-semilla actualizado (optgroups + form
  GET + subgrafo_red NUNCA invocado) + test throw del picker. 7/7 verde.

### Task 3 - ficha: enlace gated a /red?seed=<id> (B21b) - commit 53fb3fd
- Import de netPublicEnabled; enlace <a href={`/red?seed=${id}`}> envuelto en
  {netPublicEnabled(process.env) && (...)} - espejo exacto de los gates cruces/money. Con OFF
  (default fail-closed) el nodo entero esta AUSENTE del DOM.
- Copy sobrio "Ver relaciones con otros parlamentarios"; negative-match de vocabulario prohibido
  (influencia/conexiones/afinidad/score) verde.
- Tests: mock inyectable de @/lib/net-gate; +OFF sin enlace, +ON con /red?seed=P00001.
  6/6 verde.

## Deviations from Plan

### Auto-fixed Issues

1. [Rule 3 - Blocking] Enlace NET de la ficha = <nav>, no <section id>
- Found during: Task 3 (full-suite verification)
- Issue: El plan sugeria "seccion minima propia con mt-12". Al usar <section id="relaciones-enlace" className="mt-12"> se rompio page-estructura.test.ts Test 2, que exige un invariante LOCKED section<->CarrilAccordion 1:1 sobre los 7 carriles de dominio (CARRIL_IDS). Una <section id> de mas desbalancea el conteo.
- Fix: El enlace es navegacion PURA (no un carril de dominio, no compone hechos de otro parlamentario), asi que se usa <nav aria-label="Relaciones entre parlamentarios" className="mt-12">. Conserva el espaciado mt-12 como frontera pero no se cuenta como carril (el regex de matchSections solo casa <section id=).
- Files modified: app/app/parlamentario/[id]/page.tsx
- Commit: 53fb3fd (amend)

## Verification

- pnpm vitest run (suite app/ completa): 412 passed / 43 files (baseline 406, +6 tests nuevos).
- pnpm exec tsc -b: exit 0 (limpio).
- pnpm vitest run lib/lockdown-guard.test.ts: 7/7 (allowlist intacta, cero RPC nueva).

## Constraints honored

- Cero RPC nueva, cero DDL, cero flip de flag (parlamentarios_publico ya allowlisted; el flip de
  NET_PUBLIC_ENABLED sigue siendo deuda de operador post-F17).
- Anti-insinuacion LOCKED: layout determinista por carril (jamas fisica), copy sin causa/afinidad/
  score, negative-match verde, frontera mt-12 intacta.
- netPublicEnabled server-only fail-closed: enlace de la ficha con OFF => nodo ausente del DOM.

## Self-Check: PASSED

- Commits verificados en git log: 2c958e5, b7019e3, 53fb3fd (todos presentes en master).
- Archivos modificados presentes en disco: red-graph.tsx/.test.tsx, red/page.tsx/.test.tsx,
  parlamentario/[id]/page.tsx/.test.tsx.
- Suite 412 verde, tsc exit 0, lockdown 7/7.
