---
phase: quick-260713-izo
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - app/components/red/red-graph.tsx
  - app/components/red/red-graph.test.tsx
  - app/components/red/arista-hecho.tsx
  - app/components/red/nodo-parlamentario.tsx
  - app/app/globals.css
  - app/package.json
autonomous: false
requirements: [RED-LAYOUT-B]
must_haves:
  truths:
    - "En /red?seed=<id> (≥768px) el operador ve la tarjeta seed a la IZQUIERDA y una COLUMNA de vecinos a la derecha, ya NO un anillo radial apiñado"
    - "Conectores SVG curvos parten repartidos (fan-out) del borde derecho del seed y llegan al borde izquierdo de cada fila; seleccionar una fila destaca su curva y atenúa las demás"
    - "Clic/Enter en una fila expande el detalle inline con etiquetaHecho + ventana + procedencia (Fuente/Periodo/Registro/Ver fuente oficial) SIEMPRE en el DOM + microcopy anti-insinuación + link a /red?seed=<vecino>"
    - "La paginación 10/página cubre TODOS los vecinos con pager honesto ('Vecinos 1–10 de 24 · página 1 de 3 · orden alfabético'); ningún vecino descartado"
    - "A <768px la misma columna se muestra sin conectores SVG con la nota 'en pantallas angostas las líneas se omiten'; ya no hay dos ramas canvas/lista"
    - "@xyflow/react no se usa en ningún path de /red; la dependencia sale de package.json si no queda otro uso en el app"
    - "Los estados honestos existentes (0 aristas early-return, seed sin vecinos CR-01, aviso fallback sin seedNodo) y los filtros por tipo/ventana siguen funcionando"
  artifacts:
    - path: "app/components/red/red-graph.tsx"
      provides: "Layout B seed→columna con conectores SVG, paginación 10/pág, detalle inline, sin xyflow"
      contains: "useLayoutEffect"
    - path: "app/app/globals.css"
      provides: "Island .net-* reescrita al layout B (seedcol, list, row, conectores, detalle)"
      contains: ".net-b-row"
    - path: "app/components/red/red-graph.test.tsx"
      provides: "Suite reescrita sin vi.mock(@xyflow/react), tests de comportamiento del layout B"
  key_links:
    - from: "app/components/red/red-graph.tsx"
      to: "etiquetaHecho / ventanaTexto"
      via: "import desde arista-hecho.tsx"
      pattern: "etiquetaHecho|ventanaTexto"
    - from: "app/app/red/page.tsx"
      to: "<RedGraph subgrafo seedId>"
      via: "firma de props intacta"
      pattern: "RedGraph"
---

<objective>
Reescribir la vista `/red` al layout B "Diagrama seed → columna" elegido por el operador en el sketch 002 (variante marcada ★ Elegida). Reemplaza el canvas radial `@xyflow/react` —que sigue viéndose apiñado en producción (24 nodos convergiendo al centro en un anillo de 260px)— por un diagrama DOM legible: tarjeta del seed a la izquierda, columna paginada de vecinos a la derecha, conectores SVG curvos con fan-out, y detalle inline expandible con procedencia siempre en el DOM.

Purpose: El operador reportó post-v6.1 que `/red` "sigue apiñado" y pidió "más visual + explicaciones más detalladas". El sketch 002 es el contrato visual aprobado; este plan lo calca en el componente real respetando el design system y todos los invariantes anti-insinuación LOCKED.

Output: `red-graph.tsx` reescrito (sin xyflow), island CSS `.net-*` reescrita, tests reescritos, dependencia xyflow eliminada, deploy a producción y loop BrowserOS de lectura fría con evidencia archivada.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/sketches/002-red-rediseno-visual/index.html
@.planning/HANDOFF-red-visual-2026-07-13.md
@app/components/red/red-graph.tsx
@app/components/red/arista-hecho.tsx
@app/components/red/nodo-parlamentario.tsx
@app/components/red/red-graph.test.tsx
@app/app/red/page.tsx

<interfaces>
<!-- Contratos que el ejecutor usa DIRECTO — sin explorar el codebase. -->

Firma de props de <RedGraph> (INTACTA — page.tsx la monta así):
```typescript
interface RedGraphProps { subgrafo: Subgrafo | null; seedId?: string; }
interface SubgrafoNodo { id: string; nombre: string | null; camara: string | null; }
interface SubgrafoArista {
  tipo: string; a: string; b: string; contexto: string | null;
  desde: string | null; hasta: string | null;
  dataset: string; origen: string; enlace: string; licencia: string | null;
}
interface Subgrafo { nodos: SubgrafoNodo[]; aristas: SubgrafoArista[]; }
```

Helpers exportados por arista-hecho.tsx (CONSERVAR — el layout B los reutiliza):
```typescript
export function etiquetaHecho(tipo: string, contexto: string | null): string;
export function ventanaTexto(desde: string | null, hasta: string | null): string | null;
```

Helpers/util del app (usar los existentes, no reimplementar):
```typescript
// @/lib/format
export function formatNombre(nombre: string): string;
// @/lib/utils
export function safeExternalHref(url: string): string | null; // null si esquema peligroso
```

Design tokens REALES del app (el sketch usa --color-*; MAPEAR a estos):
- petróleo/focus/links: hsl(var(--accent-product))   (NUNCA relleno de fila/nodo)
- cámara (borde civic): var(--camara-muted-foreground)
- senado (borde civic): var(--senado-muted-foreground)
- superficie tarjeta:   hsl(var(--card))
- borde neutro:         hsl(var(--border))
- texto:                hsl(var(--foreground))
- texto atenuado:       hsl(var(--muted-foreground))
- fondo atenuado:       hsl(var(--muted))
- radio:                var(--radius)
- seed (borde reforzado neutro): 2px hsl(var(--foreground))
Breakpoint md de Tailwind v4 = min-width:48rem. Media queries del island SIEMPRE en rem.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Reescribir red-graph.tsx al layout B (seed→columna, conectores SVG, paginación, detalle inline) + island CSS + tests</name>
  <files>app/components/red/red-graph.tsx, app/app/globals.css, app/components/red/red-graph.test.tsx</files>
  <behavior>
    Tests de COMPORTAMIENTO (jsdom NO evalúa layout ni getBoundingClientRect real → NO asertar coordenadas de curvas):
    - Con seedId + N vecinos: se renderiza la tarjeta seed (nombre del seed) + una columna de filas; NO existe canvas de xyflow (ya no hay data-testid rf-canvas ni imports de xyflow).
    - Paginación: con 24 vecinos, la página 1 muestra exactamente 10 filas y el pager dice "Vecinos 1–10 de 24 · página 1 de 3 · orden alfabético". Avanzar página muestra las siguientes 10; ningún vecino se pierde (24 → 3 páginas).
    - Orden alfabético es-locale invariante al orden del array de entrada (reordenar nodos de entrada no cambia el orden de filas).
    - Clic/Enter en una fila la marca seleccionada (clase sel) y expande el detalle: aparece etiquetaHecho ("Ambos recibieron audiencia de …"), la ventana, el bloque de procedencia (Fuente/Registro), el enlace "Ver fuente oficial" con href correcto y target _blank, la microcopy anti-insinuación, y el link "Ver la red de esta persona →" a /red?seed=<id>.
    - safeExternalHref: un enlace javascript: NO produce <a> (sin link de fuente).
    - licencia: presente → se muestra "CC BY 4.0"; null → no se afirma atribución.
    - El SVG de conectores existe en el DOM cuando hay ≥1 fila (aria-hidden), y re-renderizar/paginar/seleccionar no lanza (drawConn defensivo si offsetParent/rects son null — jsdom da ceros).
    - Filtros por tipo y ventana temporal intactos (los labels existen; destildar un tipo o poner una ventana fuera de rango oculta las filas afectadas); filtrar RESETEA a página 1.
    - Estados honestos: 0 aristas → early-return "aún no hay relaciones" + link único a /parlamentarios (F-03 byte-idéntico); subgrafo null → mismo estado sin crash; seed sin vecinos visibles tras filtro (CR-01) → mensaje "Ninguna relación coincide"; con seedId pero sin seedNodo → aviso fallback.
    - Leyenda "Cómo leer este diagrama": declara literal "orden alfabético" y "no cercanía"/"no indican afinidad"; el scan de banned-vocab (afinidad/cercanía/aliado/red de poder como AFIRMACIÓN, removiendo las negaciones LOCKED) pasa; sin "partido"/"puntaje/score/ranking".
    - Sin seedId (rama fallback): misma columna SIN seed-card, sobre nodosVisibles, sin romper.
  </behavior>
  <action>
    Calcar la variante B del sketch 002 (`.planning/sketches/002-red-rediseno-visual/index.html`, sección `#variant-b` + funciones renderB/drawConnB/selB/bPageMove) al componente React real, mapeando el copy, la estructura y el comportamiento 1:1 pero adaptado a React + los design tokens reales.

    Estructura del render (path CON seed):
    - Header/leyenda: `<details>` "Cómo leer este diagrama" ABIERTO por defecto, con la lista ordenada paso a paso EXACTA de la variante B (izquierda persona elegida / línea = hecho(s), largo o curva NO significan nada / clic destaca y detalla / relación = hecho documentado nunca afinidad / filo izquierdo = cámara) + nota de fuente "Ley del Lobby (Ley 20.730) y votaciones de sala". Chips cámara con borde civic (nunca relleno).
    - Nota móvil "En pantallas angostas las líneas se omiten; el orden sigue siendo alfabético…".
    - Contenedor `.net-b-layout` (position relative) con: `<svg>` conectores (absolute, inset 0, pointer-events none, aria-hidden); `.net-b-seedcol` (sticky top, IZQUIERDA) con la tarjeta seed (nombre del seed via displayNombre/formatNombre, chip cámara, resumen "N vecinos · M hechos documentados", nota "el orden de la columna es alfabético; la posición no implica afinidad"); `.net-b-list` (columna de filas).
    - Cada fila `.net-b-row` (con `.net-b-row--camara`/`--senado` para borde izquierdo 3px color cámara, `.net-b-row--sel` al seleccionar): nombre semibold, chip cámara, conteo "N hechos →" en petróleo (--accent-product), tabIndex=0, onClick + onKeyDown(Enter) → selecciona/deselecciona; detalle inline (solo visible en fila seleccionada) con, por cada hecho seed↔vecino: etiquetaHecho + ventanaTexto (mono) + bloque procedencia SIEMPRE en DOM (Fuente / Periodo / Registro / "Ver fuente oficial ↗" con safeExternalHref) + microcopy borde-petróleo "Una relación aquí es un hecho público documentado. No indica afinidad, acuerdo ni motivo entre las personas." + `<Link href={/red?seed=<id>}>` "Ver la red de esta persona →".
    - Pager `.net-b-pager`: botones "← Anteriores"/"Siguientes →" (disabled en extremos) + estado "Vecinos {a}–{b} de {total} · página {p} de {P} · orden alfabético".

    Conectores SVG (fan-out): implementar `drawConn()` con refs + `useLayoutEffect` + `ResizeObserver` sobre el contenedor, y redibujar en resize/cambio de página/selección vía `requestAnimationFrame`. Puntos: salida REPARTIDA verticalmente por el borde derecho de la tarjeta seed (NUNCA convergen a un punto) via `getBoundingClientRect` relativo al contenedor; llegada al borde izquierdo de cada fila. Curvas cúbicas (path C con control x en el punto medio). Stroke `hsl(var(--accent-product))` 1.5px opacity .5; fila seleccionada → su curva 2.5px opacity 1, las demás .13. `drawConn` DEFENSIVO: si el contenedor no tiene offsetParent (móvil/oculto) o los rects dan 0, salir sin dibujar (jsdom). Solo client-side (el componente ya es "use client"). El SVG NO se dibuja <768px (los conectores se omiten; controlar por clase/estado responsive — usar la nota móvil, y que drawConn salga temprano bajo el breakpoint).

    Paginación 10/página sobre TODOS los vecinos: `const B_PAGE = 10`; estado `bPage` + `bSel`. Reemplaza el `CAP = 24` + bloque "Ver N vecinos más" (ELIMINARLOS). `seedNeighbors` sigue siendo el memo alfabético es-locale existente (conservar `displayNombre`, WR-04 exclusión self-loop, WR-05 fallback nombre vacío al id). Filtrar por tipo/ventana o cambiar seed → resetear bPage a 0 y bSel a null.

    Móvil <768px: MISMA columna sin conectores, seed-card arriba (no sticky). Esto ABSORBE la lista móvil `.net-vecinos` actual → una sola estructura responsive (elimina la doble rama canvas/lista y WR-06). Elimina el wrapper `hidden md:block` + `.net-lienzo` + `<ReactFlow>`.

    Rama fallback SIN seed: misma columna (sin seed-card, sin conectores obligatorios) sobre `nodosVisibles`, determinista. Conservar el aviso solo-móvil `avisoMovilFallback` si aplica.

    Imports: ELIMINAR todo `@xyflow/react` (ReactFlow, Provider, Background, Controls, Edge, Node) y su CSS import. CONSERVAR el import de `etiquetaHecho`/`ventanaTexto` desde `./arista-hecho`, `formatNombre` de `@/lib/format`, `safeExternalHref` de `@/lib/utils`, `Link` de next/link. Ya no se usan `NodoParlamentario` ni `AristaHecho`/nodeTypes/edgeTypes.

    CSS island (`app/app/globals.css`, bloque `.net-*` líneas ~128–448): REESCRIBIR. Eliminar `.net-lienzo`, `.net-nodo*`, `.net-arista__path`, y las reglas de la lista móvil `.net-vecinos*` que ya no aplican. Conservar/reusar `.net-filtros*`, `.net-prov*`. Añadir las nuevas clases del layout B: `.net-b-layout`, `.net-b-seedcol`, `.net-b-seed`, `.net-b-seednote`, `.net-b-list`, `.net-b-row` (+`--camara`/`--senado`/`--sel`), `.net-b-row__fila`, `.net-b-row__nombre`, `.net-b-row__nhechos` (petróleo), `.net-b-row__detalle`, `.net-b-pager`, `.net-b-nota-movil`, `.net-b-conn` (svg), `.net-leyenda*`, `.net-microcopy`, `.net-chip*`. GOTCHA cascada: media queries en rem (`@media (min-width:48rem)` para sticky/gap desktop, la columna móvil es el default), y considerar envolver el island en `@layer components` para que Tailwind utilities ganen predeciblemente (la cascada `.net-*` vs Tailwind ya mordió 2 veces). Alinear typography al design system (NO 15px/13px sueltos: usar los tamaños del token/escala como el resto del sketch — text-sm/xs equivalentes). Chips: borde civic 1.5px, `background: transparent`, JAMÁS relleno de color de cámara/partido.

    Tests (`red-graph.test.tsx`): ELIMINAR `vi.mock("@xyflow/react")` completo y el shim de ResizeObserver-para-xyflow (mantener un stub mínimo de ResizeObserver global porque el componente lo usa ahora). Reescribir los asserts que dependían de `rf-canvas`/`rf-node-*`/`data-x`/`data-y`/`data-fitview-nodes` a los asserts de comportamiento del bloque <behavior> (selectores por texto/rol/clase `.net-b-row`, `.net-b-conn`, pager). Conservar la intención de cada test original (nodo sobrio, arista=hecho, procedencia, filtros, estados honestos, orden alfabético, leyenda anti-insinuación, móvil) trasladada al layout B. Los tests de "cap 24 / N vecinos más" se REEMPLAZAN por tests de paginación 10/página (ningún vecino descartado). Mockear/stubear `getBoundingClientRect` NO es necesario si drawConn es defensivo ante ceros.
  </action>
  <verify>
    <automated>cd app; pnpm test -- red-graph</automated>
  </verify>
  <done>La suite red-graph pasa verde; no queda ningún import ni mock de @xyflow/react en red-graph.tsx ni en red-graph.test.tsx; el DOM del path-con-seed muestra seed-card + columna paginada de 10 + conectores svg + detalle inline con procedencia; los estados honestos y filtros siguen verdes.</done>
</task>

<task type="auto">
  <name>Task 2: Purgar @xyflow/react residual (nodo-parlamentario, arista-hecho) + quitar la dependencia si queda huérfana + suite completa verde</name>
  <files>app/components/red/nodo-parlamentario.tsx, app/components/red/arista-hecho.tsx, app/package.json</files>
  <action>
    Con el layout B ya sin xyflow, purgar los usos residuales de `@xyflow/react`:
    - `arista-hecho.tsx`: eliminar el componente `AristaHecho` (usa BaseEdge/EdgeLabelRenderer/getStraightPath/EdgeProps de xyflow) y el import de xyflow. CONSERVAR exportados `etiquetaHecho`, `ventanaTexto` (los consume el layout B) y, si aún aportan valor, `EtiquetaArista`/`AristaHechoData` sin dependencia de xyflow; si `EtiquetaArista` ya no se usa en ningún lado (grep), eliminarla también. El archivo puede quedar reducido a los helpers `etiquetaHecho`/`ventanaTexto` (+ `fechaLiteral` interno).
    - `nodo-parlamentario.tsx`: importa `Handle`/`Position`/`NodeProps` de xyflow y ya no se monta en ningún path → ELIMINAR el archivo por completo (verificar con grep que nada lo importa tras la Task 1). Si algún resto lo importa, primero quitar ese import.
    - `package.json`: hacer `grep -rn "@xyflow/react" app/` (excluyendo node_modules). Si NO quedan usos en `app/` (código fuente), eliminar la línea `"@xyflow/react": "12.11.0"` de dependencies y correr `pnpm install` para actualizar el lockfile. Si por alguna razón queda un uso legítimo, NO tocar package.json y anotarlo en el SUMMARY.
    Verificar el grafo de imports completo tras los borrados (que no queden imports colgando a archivos eliminados).
  </action>
  <verify>
    <automated>cd app; pnpm test; pnpm exec tsc --noEmit</automated>
  </verify>
  <done>No queda ninguna referencia a @xyflow/react en app/ (código fuente); nodo-parlamentario.tsx eliminado; arista-hecho.tsx reducido a los helpers conservados; la suite COMPLETA (no solo red-graph) pasa verde y tsc --noEmit no reporta errores; package.json sin @xyflow/react si quedó huérfana.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Deploy a producción del layout B + loop BrowserOS de lectura fría. Claude AUTOMATIZA el deploy siguiendo el runbook 61-02 (Docker node:22-slim, pre-copiar fuente a C:/Temp/obs-build vía robocopy/PowerShell para evitar el cuello OneDrive, build OpenNext en el contenedor, `docker cp` de `.open-next` a Windows, deploy con `node "C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js" deploy --config wrangler.jsonc` desde app/ con OAuth local, MSYS_NO_PATHCONV). Tras el deploy, Claude corre el loop BrowserOS de lectura fría sobre el deploy REAL (URL https://observatorio-congreso.thevalis.workers.dev/red) en desktop y 390px, con un seed real (p.ej. ?seed=D1009) y sin seed, capturando pantallas y verificando: (a) YA NO se lee apiñado (columna legible, no telaraña), (b) las explicaciones detalladas están presentes y legibles (leyenda paso a paso, detalle inline con procedencia), (c) los invariantes son visibles (leyenda "orden alfabético, no cercanía"; procedencia fuente+fecha+enlace en el detalle; chips borde civic sin relleno; petróleo solo en conectores/links/focus). Si hay hallazgos, Claude aplica el fix y RE-CAPTURA. Evidencia (capturas + VEREDICTO.md) en `.planning/quick/260713-izo-redisenar-red-layout-b-seed-columna-con-/evidence/`.
  </what-built>
  <how-to-verify>
    1. Abre https://observatorio-congreso.thevalis.workers.dev/red?seed=D1009 en desktop.
    2. Confirma: ¿se lee como un diagrama izquierda→derecha legible (seed a la izquierda, columna de vecinos, líneas curvas repartidas) y YA NO como un anillo/telaraña apiñado?
    3. Pulsa un vecino: ¿se destaca su línea, se atenúan las demás, y se abre el detalle con el/los hecho(s), su fecha, y el enlace "Ver fuente oficial"?
    4. Revisa la leyenda "Cómo leer este diagrama": ¿está el paso a paso completo y declara "orden alfabético / no cercanía"?
    5. Estrecha a ~390px (o abre en móvil): ¿la misma columna se ve bien SIN líneas, con la nota de que las líneas se omiten?
    6. Abre /red sin seed (selector) y con un seed de senador: ¿todo coherente?
    7. Revisa las capturas y el VEREDICTO.md en evidence/.
    Responde "approved" si la lectura fría confirma (a)+(b)+(c); o describe qué sigue apiñado / qué explicación falta.
  </what-built>
  <resume-signal>Escribe "approved" o describe los hallazgos para re-fix + re-captura.</resume-signal>
</task>

</tasks>

<verification>
- `cd app; pnpm test` verde (suite completa, no solo red-graph).
- `cd app; pnpm exec tsc --noEmit` sin errores.
- `grep -rn "@xyflow/react" app/` (sin node_modules) → sin resultados en código fuente; package.json sin la dependencia si quedó huérfana.
- Deploy LIVE verificado por HTTP 200 en /red?seed=D1009 + contenido del layout B presente en el HTML.
- Loop BrowserOS de lectura fría con evidencia (capturas + VEREDICTO.md) en evidence/, veredicto (a)+(b)+(c) confirmado por el operador.
</verification>

<success_criteria>
- `/red` sirve el layout B "seed → columna" en producción; el operador confirma que ya NO se lee apiñado y que las explicaciones son detalladas y legibles.
- `@xyflow/react` eliminado del path de /red (y de package.json si quedó huérfana).
- Todos los invariantes LOCKED intactos: F18 (orden alfabético es-locale, layout determinista, cero force-simulation), anti-insinuación (petróleo solo conectores/links/focus, chips borde civic sin relleno, procedencia siempre en DOM, copy sin valoración/motivo), cero DDL, cero flags (NET_PUBLIC_ENABLED intacto), RPC subgrafo_red intacta, firma de props {subgrafo, seedId} intacta, page.tsx sin cambios.
- Paginación 10/página cubre TODOS los vecinos (espíritu RED-01 intacto, mecanismo distinto): ningún vecino descartado, conteos verdaderos.
- Estados honestos y filtros por tipo/ventana conservados.
</success_criteria>

<output>
Create `.planning/quick/260713-izo-redisenar-red-layout-b-seed-columna-con-/260713-izo-SUMMARY.md` when done.
Archive BrowserOS evidence (screenshots + VEREDICTO.md) in `.planning/quick/260713-izo-redisenar-red-layout-b-seed-columna-con-/evidence/`.
</output>
