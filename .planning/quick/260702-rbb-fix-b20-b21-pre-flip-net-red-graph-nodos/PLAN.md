---
phase: quick-260702-rbb-fix-b20-b21
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [B20a, B20b, B21a, B21b]
files_modified:
  - app/components/red/red-graph.tsx
  - app/components/red/red-graph.test.tsx
  - app/app/red/page.tsx
  - app/app/red/page.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/parlamentario/[id]/page.test.tsx

must_haves:
  truths:
    - "El lienzo del grafo NO muestra nodos huérfanos: solo nodos que participan de una arista VISIBLE aparecen"
    - "El layout ubica los nodos en carriles reales por cámara (contador por carril), determinista, jamás simulación física"
    - "Con /red gate ON y sin semilla, el ciudadano elige un parlamentario en un selector server-rendered (form GET) agrupado por cámara"
    - "La ficha del parlamentario ofrece un enlace a /red?seed=<id> SOLO cuando netPublicEnabled(process.env) es true; con OFF el nodo está ausente del DOM"
  artifacts:
    - path: "app/components/red/red-graph.tsx"
      provides: "Filtrado de nodos huérfanos + layout determinista por carril de cámara"
      contains: "nodosVisiblesIds"
    - path: "app/app/red/page.tsx"
      provides: "Selector de semilla JS-free (form GET + select con optgroups por cámara vía parlamentarios_publico)"
      contains: "parlamentarios_publico"
    - path: "app/app/parlamentario/[id]/page.tsx"
      provides: "Enlace gated a /red?seed=<id> tras netPublicEnabled"
      contains: "netPublicEnabled"
  key_links:
    - from: "app/app/red/page.tsx"
      to: "parlamentarios_publico (RPC)"
      via: "createServerSupabase().rpc"
      pattern: "parlamentarios_publico"
    - from: "app/app/parlamentario/[id]/page.tsx"
      to: "app/lib/net-gate.ts"
      via: "netPublicEnabled(process.env)"
      pattern: "netPublicEnabled"
---

<objective>
Fix B20+B21 del diagnóstico gov-map 2026-07-02 — prerrequisito de código para
encender `NET_PUBLIC_ENABLED` (el flip lo hace el operador/orquestador DESPUÉS,
tras el sign-off legal F17). Cuatro correcciones sobre la superficie NET ya
existente: (B20a) nodos huérfanos flotando en el lienzo; (B20b) layout de
"carriles por cámara" que no existe; (B21a) /red sin semilla es un dead-end sin
forma de elegir; (B21b) la ficha no tiene camino a /red.

Purpose: la ruta /red y su grafo hoy son técnicamente correctos en el gate pero
inusables/imprecisos; estos fixes los dejan listos para exponerse sin retocar el
candado ni la frontera anti-insinuación.

Output: red-graph.tsx (filtrado + layout), red/page.tsx (selector de semilla),
parlamentario/[id]/page.tsx (enlace gated), + tests RTL extendidos en los tres.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/DIAGNOSTICO-govmap-2026-07-02.md

<constraints_locked>
- CERO RPC nueva, CERO DDL, CERO flip de flag en esta tarea (el flip = orquestador después).
- ANTI-INSINUACIÓN (LOCKED, 18-CONTEXT / 17-LEGAL-DOSSIER §2 / DESIGN-SYSTEM §8):
  grafo = hechos tipados con fuente; layout DETERMINISTA, JAMÁS simulación física
  (proximidad visual se leería como relación); copy sin causa/afinidad/score/
  "influencia"/"conexiones sospechosas"; negative-match de vocabulario prohibido.
- Suite app/ baseline 406 verde NO se rompe; `tsc -b` limpio; lockdown-guard 7/7.
- `parlamentarios_publico` YA está en PUBLIC_RPC_ALLOWLIST (lockdown-guard.test.ts
  línea ~168) → cero cambio de allowlist. `PARLAMENTARIO_ID_RE` ya existe en
  @/lib/buscar → NO tocar; reusar tal cual para validar la semilla.
- netPublicEnabled es server-only fail-closed (app/lib/net-gate.ts) → el enlace de
  la ficha con flag OFF ⇒ nodo AUSENTE del DOM (espejo del gate MONEY/cruces en
  esa misma page.tsx: `{gate(process.env) && <section>}`).
</constraints_locked>

<interfaces>
De app/components/red/red-graph.tsx (contrato ya existente, NO cambia firma de props):
  export interface SubgrafoNodo { id: string; nombre: string | null; camara: string | null; }
  export interface Subgrafo { nodos: SubgrafoNodo[]; aristas: SubgrafoArista[]; }
  function posicion(index: number, camara: string | null): { x: number; y: number }
  // nodosVisiblesIds: Set<string> ya se computa (líneas 164-168) pero NO se usa para filtrar rfNodes.

De app/lib/types.ts:
  export interface ParlamentarioListadoRow {
    id: string; nombre: string; camara: "diputados" | "senado";
    region: string | null; distrito: string | null; circunscripcion: string | null; ...
  }

De app/app/parlamentarios/page.tsx (patrón a espejar para el selector JS-free):
  <form method="get" action="/red"> + <select name="seed"> ; RPC `parlamentarios_publico` (sin args)
  → data as ParlamentarioListadoRow[]; error ⇒ throw (#34, honest degradation).

De app/lib/net-gate.ts:
  export function netPublicEnabled(env = process.env): boolean  // "true" literal ⇒ true, resto ⇒ false
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: red-graph — excluir nodos huérfanos (B20a) + layout real por carril de cámara (B20b)</name>
  <read_first>
    - app/components/red/red-graph.tsx (líneas 94-104 posicion; 163-192 rfNodes/rfEdges)
    - app/components/red/red-graph.test.tsx (dos_nodos, arista(), doble de @xyflow/react que renderiza nodeTypes con data)
  </read_first>
  <action>
    B20a — En RedGraph, DESPUÉS de construir `nodosVisiblesIds` (el Set ya computado
    a partir de `aristasVisibles`), derivar `const nodosVisibles = nodos.filter((n) =>
    nodosVisiblesIds.has(n.id));` y mapear `rfNodes` sobre `nodosVisibles` (NO sobre
    `nodos`). Así ningún nodo sin arista visible llega al lienzo. Mantener el early-
    return de `aristas.length === 0` intacto (estado honesto). El path
    `aristasVisibles.length === 0` (filtros sin match) ya no monta lienzo → sin nodos
    sueltos por ese lado tampoco.

    B20b — Reemplazar el layout global roto por uno determinista POR CARRIL. `posicion`
    hoy recibe un índice GLOBAL y hace `Math.floor(index/1)` (no-op) → la columna avanza
    aunque el nodo sea de otra cámara, así que los "carriles" no existen. Cambiar a un
    índice LOCAL por carril: al mapear `nodosVisibles`, mantener un contador separado por
    cámara (p.ej. un objeto/Map `laneCounters` con claves "senado"/otra) e incrementarlo
    por nodo según su `camara`; pasar ese índice-de-carril a `posicion(laneIndex, camara)`.
    Redefinir `posicion` para que `fila = camara === "senado" ? 1 : 0` (banda por cámara,
    como hoy) y DENTRO de la banda: `col = Math.floor(laneIndex / 3)`, `row = laneIndex % 3`,
    devolviendo `{ x: col * COL, y: fila * ROW * 3 + row * ROW }`. Resultado: cada cámara
    ocupa su propia banda horizontal y las columnas avanzan por-carril (no globalmente).
    Sigue LOCKED: rejilla determinista pura, SIN física, SIN medida de proximidad. Ajustar
    el JSDoc de `posicion` para reflejar "índice por carril" (no global). NO tocar la firma
    de props ni el copy de nodo/arista.
  </action>
  <verify>
    <automated>cd app; pnpm vitest run components/red/red-graph.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - Nuevo test "un nodo sin arista visible NO se monta en el lienzo": subgrafo con 3
      nodos (D1, D2, D3) y una sola arista D1↔D2 → `screen.getByText("...D3...")` ausente
      (queryByText del nombre de D3 === null) mientras D1/D2 presentes.
    - Nuevo test "destildar el tipo saca también sus nodos": tras `fireEvent.click` sobre
      el checkbox de tipo, el lienzo (`rf-canvas`) no está en el DOM (path aristasVisibles=0).
    - Nuevo test "layout por carril es determinista y separa cámaras": invocar/observar que
      dos nodos de la misma cámara comparten `fila` y difieren en columna solo cuando el
      índice-de-carril lo exige; un nodo senado cae en banda distinta (y != banda diputados).
      (Verificable exponiendo `posicion` o aseverando posiciones vía el prop `nodes` que el
      doble de xyflow recibe — usar el data-testid `rf-canvas` y las posiciones inyectadas.)
    - Vocabulario prohibido negative-match sigue verde (los tests existentes de
      partido/score/afinidad no regresan).
    - `pnpm vitest run components/red/red-graph.test.tsx` PASA (incluidos los tests previos).
  </acceptance_criteria>
  <done>rfNodes se deriva de nodosVisibles (huérfanos excluidos); posicion usa índice por carril con bandas por cámara; suite del componente verde.</done>
</task>

<task type="auto">
  <name>Task 2: /red — selector de semilla server-rendered JS-free (B21a)</name>
  <read_first>
    - app/app/red/page.tsx (bloque `if (!seed)` líneas 52-64)
    - app/app/parlamentarios/page.tsx (patrón form GET + RPC parlamentarios_publico + throw #34)
    - app/app/red/page.test.tsx (mocks de netPublicEnabled, createServerSupabase/rpcMock, notFound; test "sin semilla → picker, NUNCA seedless RPC")
  </read_first>
  <action>
    Reemplazar el estado honesto textual del branch `if (!seed)` por un selector de
    semilla server-rendered SIN JS de cliente, espejo de `DirectoryFilter`/`DirectoryList`
    de /parlamentarios. Dentro de ese branch (gate ya pasó, sigue ANTES de cualquier RPC
    por semilla): leer `createServerSupabase().rpc("parlamentarios_publico")` (sin args),
    y con `error` ⇒ `throw new Error(...)` (#34, NUNCA degradar a "sin opciones"). Mapear
    `data as ParlamentarioListadoRow[]` a un `<form method="get" action="/red">` con un
    `<select name="seed">` que agrupe las filas por cámara en dos `<optgroup label="Cámara">`
    / `<optgroup label="Senado">` (cada `<option value={r.id}>{r.nombre}</option>`), un
    `<option value="">` placeholder deshabilitado como prompt, y un `<button type="submit">`.
    Copy sobrio es-CL, sin lenguaje de influencia/afinidad/causa (reusar el tono del párrafo
    actual: "Elige un parlamentario para ver con qué otros comparte hechos públicos…").
    IMPORTANTE: este selector es JS-free (GET recarga /red?seed=<id> → cae en el path de
    validación PARLAMENTARIO_ID_RE ya existente, sin nueva superficie). NO tocar el gate
    (primera sentencia), ni el orden validación-antes-de-DB, ni el path con semilla. CERO
    RPC nueva: `parlamentarios_publico` ya allowlisted.
  </action>
  <verify>
    <automated>cd app; pnpm vitest run app/red/page.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - El test existente "gate OFF → notFound ANTES de tocar la DB; createServerSupabase NO
      llamado" DEBE seguir verde: el gate es la PRIMERA sentencia; el RPC del selector vive
      DENTRO del branch post-gate, así que con OFF la DB nunca se toca.
    - Actualizar/añadir el mock de `rpcMock` para que `parlamentarios_publico` devuelva
      `{ data: [ {id,nombre,camara:"diputados",...}, {id,nombre,camara:"senado",...} ], error:null }`.
    - Nuevo test "gate ON + sin semilla → renderiza selector con optgroups por cámara y form
      GET a /red": `renderToStaticMarkup` contiene `method="get"`, `name="seed"`,
      `<optgroup` con labels de ambas cámaras, y las `option value` con los ids fixture;
      `subgrafo_red` (rpc por semilla) NUNCA se invoca en este branch.
    - Nuevo test "error del RPC parlamentarios_publico en el picker → THROW (#34)": rpc del
      picker devuelve `{data:null, error:{message:"boom"}}` ⇒ `RedPage(makeProps(undefined))`
      rechaza con /boom/, sin notFound.
    - `pnpm vitest run app/red/page.test.tsx` PASA (incluidos los tests de gate previos).
  </acceptance_criteria>
  <done>/red sin semilla muestra un selector JS-free (form GET, optgroups por cámara) alimentado por parlamentarios_publico con throw-on-error; gate y validación intactos; suite de la page verde.</done>
</task>

<task type="auto">
  <name>Task 3: ficha parlamentario — enlace gated a /red?seed=&lt;id&gt; (B21b)</name>
  <read_first>
    - app/app/parlamentario/[id]/page.tsx (imports líneas 15-22; gates cruces/money `{gate(process.env) && <section className="mt-12">}` líneas 244-337)
    - app/lib/net-gate.ts (netPublicEnabled fail-closed server-only)
    - app/app/parlamentario/[id]/page.test.tsx (patrón de mock de gate inyectable + assert de nodo AUSENTE/PRESENTE en renderToStaticMarkup)
  </read_first>
  <action>
    Importar `netPublicEnabled` desde `@/lib/net-gate` (junto a los gates money/cruces ya
    importados). Añadir un enlace a `/red?seed=<id>` que aparezca SOLO cuando
    `netPublicEnabled(process.env)` es true — espejo EXACTO del patrón de gate de
    #cruces/#dinero: `{netPublicEnabled(process.env) && ( ... )}`, de modo que con OFF
    (default) el nodo entero esté AUSENTE del DOM (NO oculto por CSS ni dependiendo de que
    un hijo retorne null). Ubicación: a discreción cerca del resumen/cabecera o como una
    sección mínima propia; si es sección de carril, respetar la frontera `mt-12` LOCKED y
    NO componer con datos de otro dominio (el enlace es navegación pura, no muestra hechos
    de otro parlamentario). Copy SOBRIO es-CL: p.ej. "Ver relaciones con otros
    parlamentarios" — PROHIBIDO "influencia", "conexiones", "red de contactos", "sospechoso",
    afinidad, score o causa. Usar `<a href={`/red?seed=${id}`}>` (el id ya validó contra
    PARLAMENTARIO_ID_RE al inicio de la page). NO tocar los gates money/cruces ni la
    estructura de carriles existente.
  </action>
  <verify>
    <automated>cd app; pnpm vitest run "app/parlamentario/[id]/page.test.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - Extender el test con un mock inyectable de `@/lib/net-gate` (`netPublicEnabled: () => netEnabledMock()`), default OFF, espejo del mock de cruces-gate ya presente.
    - Nuevo test "NET gate OFF → la ficha NO contiene enlace a /red": `renderToStaticMarkup`
      NO contiene `href="/red?seed=` (nodo ausente), y no aparece el copy del enlace.
    - Nuevo test "NET gate ON → la ficha contiene enlace a /red?seed=<id>":
      `netEnabledMock.mockReturnValue(true)` ⇒ el HTML contiene `/red?seed=P00001` (el id
      del fixture) y el copy sobrio; la página resuelve truthy sin lanzar.
    - Negative-match: el HTML del enlace NO contiene /influencia|conexion|sospechos|afinidad|score/i.
    - `pnpm vitest run "app/parlamentario/[id]/page.test.tsx"` PASA (incluidos los tests de cruces/gate previos).
  </acceptance_criteria>
  <done>La ficha enlaza a /red?seed=<id> solo con NET ON (nodo ausente con OFF); copy sobrio; suite de la ficha verde.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → /red (searchParams) | `seed` es input no confiable; validado por PARLAMENTARIO_ID_RE ya existente antes de la DB (no se toca) |
| navegador → /red (POST-back del select) | el form es GET; el valor `seed` recorre el mismo path de validación |
| entorno → superficie NET | NET_PUBLIC_ENABLED gobierna la exposición; leído SOLO vía netPublicEnabled (chokepoint server-only) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-Q0702-01 | Information Disclosure | selector de semilla /red | mitigate | Usa `parlamentarios_publico` (mismo dato PII-safe ya expuesto en /parlamentarios; sin RUT/partido). NO habilita enumeración nueva: el subgrafo sigue exigiendo semilla válida. Cero RPC nueva. |
| T-Q0702-02 | Information Disclosure | enlace gated en la ficha | mitigate | El enlace se envuelve en `netPublicEnabled(process.env) && (...)`; con OFF (default fail-closed) el nodo está AUSENTE del DOM — no filtra la existencia de la superficie NET. Test load-bearing (gate OFF ⇒ sin `href="/red?seed=`). |
| T-Q0702-03 | Tampering | seed inyectada | accept | PARLAMENTARIO_ID_RE (ya existente, no tocado) valida `seed` antes de tocar la DB; el select solo emite ids reales del RPC. |
| T-Q0702-04 | Elevation/Insinuation | layout del grafo | mitigate | Layout DETERMINISTA por carril (contador por cámara, rejilla); JAMÁS simulación física — proximidad visual no codifica relación. Copy sin causa/afinidad/score; negative-match en tests. |
</threat_model>

<verification>
- `cd app; pnpm vitest run` — suite app/ completa verde (baseline 406, no regresión).
- `cd app; pnpm vitest run lib/lockdown-guard.test.ts` — 7/7 (allowlist intacta, cero RPC nueva).
- `cd app; pnpm exec tsc -b` (o el script de typecheck del repo) — limpio.
</verification>

<success_criteria>
- rfNodes excluye nodos huérfanos; layout por carril de cámara determinista.
- /red sin semilla ofrece selector JS-free (form GET, optgroups por cámara) vía parlamentarios_publico con throw-on-error.
- La ficha enlaza a /red?seed=<id> solo con NET ON (nodo ausente con OFF).
- Suite app/ verde, lockdown-guard 7/7, tsc limpio, cero RPC/DDL/flag flip nuevos.
</success_criteria>

<output>
Create `.planning/quick/260702-rbb-fix-b20-b21-pre-flip-net-red-graph-nodos/SUMMARY.md` when done
</output>
