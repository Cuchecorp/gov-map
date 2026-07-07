# Phase 54: UXDEMO — Pulido presentacional para demo - Research

**Researched:** 2026-07-07
**Domain:** Frontend polish (Next.js 16 / Tailwind v4 / @xyflow/react) + real-data name formatting + demo evidence
**Confidence:** HIGH (todo verificado contra el código instalado, el build real y la DB de PROD)

> Scope note: el inventario de superficies (11 render points con file:line), los contratos de copy y las
> reglas del formatter YA viven en `54-UI-SPEC.md` (approved). Este research NO re-deriva ese inventario;
> investiga solo las incógnitas: mecánica F-04 con lo que xyflow 12.11.0 soporta, veredicto F-05 woff2,
> edge cases de `formatNombre` desde datos REALES, y la arquitectura de validación.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Nombres presentables (formatter display-only)**
- **Solo Title Case** con partículas en minúscula (de/del/la/las/los/van/von/y): "gonzalez sofia" → "González Sofía"… **SIN tildes nuevas** (no hay en el dato fuente; añadirlas = fabricar) y **SIN reordenar tokens** (el orden de `nombre_normalizado` es INCONSISTENTE en los datos — "irarrazaval juan" vs "diego vergara" — e inferir cuál token es apellido sería fabricar identidad). Nota: "González" en el ejemplo es ilustrativo — si el dato dice "gonzalez", el display es "Gonzalez" (sin tilde).
- Un único helper puro `formatNombre()` (p.ej. `app/lib/format.ts` junto a `fechaCorta`) con tests de partículas, tokens vacíos, y guiones/apóstrofes ("o'higgins" → "O'Higgins", "perez-mackenna" → "Perez-Mackenna").
- Aplicado en TODAS las superficies ciudadanas que rendericen nombres de parlamentarios o contrapartes: fichas (header parlamentario, contraparte), listas (directorio /parlamentarios), votos, lobby (incl. carril lobby×tramitación — el TEXTO sigue plano/no-enlazado, solo cambia el case), red (nodos/tooltips), breadcrumbs, resultados de búsqueda si muestran nombres.
- Datos subyacentes INTACTOS: `nombre_normalizado` sigue siendo clave de matching y proyección PII-safe. El formatter es frontend-only. Tildes faltantes se documentan como limitación conocida (1 línea en /metodologia si hay sección de datos).

**Home que explica + microcopy + set demo**
- 3 tarjetas de entrada entre el hero (LOCKED, intacto) y el módulo de actualidad: "Proyectos de ley" → /buscar, "Parlamentarios 360" → /parlamentarios, "Agenda de la semana" → /agenda. 1 línea de valor factual por tarjeta. Visibles sin scroll en desktop 1280×800 (junto con el hero). Server-rendered, cero JS.
- Microcopy "cómo leer esto": 1 línea factual al pie del heading en secciones complejas (cruces en ficha parlamentario, rebeldías/"votó distinto", patrimonio, red). NO duplicar caveats existentes — donde ya hay caveat anti-causal, la línea se integra o se omite. Tono: factual, sin promesas, es-CL.
- Set de demo: `docs/demo/` con ≥6 screenshots del sitio FINAL desplegado (home, buscar con resultados, ficha proyecto con carril lobby, ficha parlamentario, agenda, red), capturados con `scripts/rewalk-shot.mjs` (harness iframe), desktop 1280; nombrados por superficie.

**P1s heredados de F53 (todos entran)**
- **F-04** grafo /red móvil: fix acotado — altura de canvas adaptativa + leyenda colapsada/compacta en móvil; si sigue apretado, nota honesta "mejor en pantalla ancha" (visible, no bloqueante). NO rediseño.
- Botón submit de /buscar: del azul default al token petróleo del design system (primary action).
- Minors del 53-REVIEW/UI-REVIEW: IN-01 (import `within` sin uso), IN-02 (título de test), IN-03 (skeleton sin fila de breadcrumb → CLS), IN-04 (docstring nav stale), `bg-[--identity-warn-bg]` → sintaxis de token correcta, F-05 woff2 preload warnings (si el fix es de config Next, 1 línea; si no, documentar y diferir).
- **1 redeploy final** (patrón docker-cf-build.sh + wrangler, autorizado 2026-07-06) que arrastra TAMBIÉN los fixes post-deploy de F53 (WR-01 nav gate-aware, px-2 móvil, pl-1 flecha). Smoke post-deploy: ambos estados del gate NET (ON en PROD; OFF se verifica por test, no flipeando PROD), superficies clave 200, set de screenshots capturado DESPUÉS del deploy final.

### Claude's Discretion
- Copy exacto de tarjetas y microcopy (factual, es-CL, sin vocabulario causal).
- Diseño visual de las tarjetas dentro del design system (tokens, sin arbitrary values, min-h-11 en targets).
- Mecánica del fix móvil del grafo (lo que la lib xyflow soporte sin JS nuevo significativo).

### Deferred Ideas (OUT OF SCOPE)
- Restauración de tildes por diccionario / display-name en la proyección pública (mejora de datos, milestone futuro).
- Rediseño del grafo móvil.
- F-06 /contraparte (GATED por MONEY — sign-off F13 pendiente).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-02 | Presentabilidad demo: ningún nombre en minúscula cruda en superficie ciudadana; home con ≥3 rutas de entrada sin scroll; P1 de 53-UX-AUDIT corregidos o diferidos con razón; `docs/demo/` con ≥6 screenshots post-deploy; suite verde + tsc + lockdown-guard | §Real-Data Findings (censo completo de las 4 columnas de nombre → tests desde realidad, no supuestos); §F-04 (knobs xyflow verificados en tipos instalados + clases h-96/md:h-120 compiladas de verdad); §F-05 (veredicto RESOLVED: documentar y diferir); §Identity-warn (corrección load-bearing a la premisa "pixel-identical" del SPEC); §Validation Architecture (mapa req→test, cero gaps Wave 0 obligatorios) |
</phase_requirements>

## Summary

Fase de pulido display-only sin deps nuevas, sin DDL, sin flags. Los cuatro focos de research se resolvieron
todos con verificación empírica: (1) el fix F-04 del grafo móvil es viable con lo instalado — `@xyflow/react`
12.11.0 expone `minZoom` y `fitViewOptions` (verificado en los type defs instalados) y las clases del contrato
`h-96 md:h-120` **compilan** con el Tailwind 4.3.1 instalado (probado con un compile real contra el
`@config` legacy del proyecto: `h-120` → `height: calc(var(--spacing) * 120)` = 480px). (2) F-05 (warnings
woff2) es ruido de heurística de Chrome sobre fonts que SÍ se usan; el único knob (`preload: false`) trocaría
ruido invisible por riesgo de FOUT visible en el demo — veredicto: **documentar y diferir** (el propio
contrato 5e habilita esa salida). (3) El censo de datos REALES de las 4 columnas de nombre revela hechos que
los tests deben cubrir: `parlamentario.nombre_normalizado` es 100% minúsculas (186/186, cero tildes/guiones/
apóstrofes) con UNA fila de partícula en posición final ("enrique rysselberghe van"); `lobby_contraparte.nombre`
es 98.7% pre-caseado (passthrough) con una fila real que rompería un guard ASCII-only ("fundación mas familia
Ñuble" — Ñ mayúscula sin A-Z); `voto.mencion_nombre` y `citacion_invitado.nombre` son 100% pre-caseados
(el formatter es no-op passthrough ahí hoy).

Hallazgo load-bearing fuera de los focos pedidos: la premisa "zero visual delta / pixel-identical" del
Contract 5b (identity-warn) es **falsa**. El CSS compilado del build actual demuestra que `bg-[--identity-warn-bg]`
genera `background-color: --identity-warn-bg;` — CSS inválido que el navegador descarta. El marker "identidad
no verificada" se renderiza HOY sin su fondo/texto/borde ámbar. El fix de sintaxis por tanto RESTAURA el visual
diseñado (cambio visible e intencional), no lo preserva. El planner debe ajustar la evidencia de aceptación de
5b: before/after que documenta la restauración, no pixel-identidad.

**Primary recommendation:** planificar los 6 contratos tal como están en el UI-SPEC aprobado, con tres
correcciones de research: (a) acceptance de 5b = restauración visible, no pixel-identical; (b) guard de
passthrough de `formatNombre` con `/\p{Lu}/u` (Unicode), no `/[A-Z]/`; (c) F-05 = defer documentado, sin tocar
`layout.tsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `formatNombre()` + aplicación en 11 superficies | Frontend Server (SSR) | Browser (islas red/search) | Helper puro importado por Server Components y por las 2 islas cliente existentes; NUNCA capa de datos (`nombre_normalizado` intacto como clave/proyección) |
| Tarjetas de entrada (home) | Frontend Server (SSR) | — | Bloque server-rendered, cero JS (LOCKED); `<nav>` + `<Link>` estáticos |
| Microcopy "cómo leer esto" | Frontend Server (SSR) | — | Strings estáticos en componentes server existentes |
| F-04 grafo móvil | Browser / Client | CDN (CSS estático) | Vive dentro de la isla cliente `RedGraph` existente + CSS `net-*` en globals.css; cero isla nueva |
| Botón /buscar + identity-warn + skeletons | Frontend Server (SSR) | Browser (SearchBox es isla) | Cambios de className/tokens; sin lógica nueva |
| Screenshots demo + smoke post-deploy | Tooling operacional (scripts/) | — | `rewalk-shot.mjs` / `bros-cli.mjs` contra PROD; no es código de app |
| Redeploy final | CDN / Edge (Cloudflare Workers) | — | docker-cf-build.sh + wrangler (patrón autorizado); OpenNext build en Docker Linux, nunca Windows |

## Project Constraints (from CLAUDE.md)

Directivas accionables que gobiernan esta fase (extraídas de ./CLAUDE.md):

- **GSD Workflow Enforcement:** todo cambio de archivos entra por `/gsd:execute-phase` (fase planificada) — sin ediciones directas fuera de GSD.
- **Stack fijado:** Next.js 16 App Router, React 19.2, TS 5.x, Tailwind v4; Pages Router prohibido. Esta fase NO instala nada (coincide con CONTEXT "cero deps nuevas").
- **Server-only para fuentes externas:** irrelevante aquí (la fase no toca ingesta), pero las tarjetas/microcopy son server-rendered — consistente.
- **Secrets en `.env`:** `SUPABASE_DB_URL` usada solo para research read-only (este documento); ningún artefacto de la fase lee la DB directo.
- **Convención de ingesta/cron (LOCKED):** no aplica (fase display-only, cero ingesta).
- **`app/AGENTS.md`:** "This is NOT the Next.js you know — read `node_modules/next/dist/docs/`" — cumplido: las opciones `preload`/`adjustFontFallback` de esta research se leyeron de los docs bundled de Next 16.2.9, no de training data.

## Standard Stack

### Core (todo YA instalado — cero installs esta fase)

| Library | Version (instalada, verificada) | Purpose | Why Standard |
|---------|--------------------------------|---------|--------------|
| `@xyflow/react` | 12.11.0 (pinned) | Isla del grafo /red — F-04 usa solo props ya soportadas | [VERIFIED: node_modules/@xyflow/react/package.json] |
| `tailwindcss` + `@tailwindcss/postcss` | 4.3.1 | Clases token (`h-96 md:h-120`, `bg-identity-warn-bg`) | [VERIFIED: compile probe con el binario instalado] |
| `next` | 16.2.9 | `next/font/google` (Geist/Geist_Mono) — F-05 | [VERIFIED: package.json + docs bundled en node_modules/next/dist/docs/] |
| `vitest` | 3.2.6 + jsdom 29 + RTL 16.3 | Tests co-localizados | [VERIFIED: node_modules/vitest/package.json] |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `scripts/rewalk-shot.mjs` | Screenshots harness iframe (endurecido F53: isError check, width validado) | Contract 6, DESPUÉS del deploy final |
| `scripts/bros-cli.mjs` | Navegación BrowserOS general | Smoke post-deploy |
| `docker-cf-build.sh` + `npx wrangler deploy` | Redeploy final (build OpenNext en Docker Linux) | Contract 5f — NUNCA build Windows (gotcha 500ea) |
| `psql` 17.9 + `SUPABASE_DB_URL` | Solo research (este doc) — la fase NO consulta la DB | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `h-96 md:h-120` (spacing dinámico v4) | `h-[384px] md:h-[480px]` arbitrary | PROHIBIDO por el token rule del design system; innecesario — el compile probe demuestra que las clases del contrato existen |
| `@theme` block para identity-warn | `theme.extend.colors` en tailwind.config.ts (patrón accent-product) | Ambos compilan (probado). El UI-SPEC aprobado prescribe `@theme` → seguirlo. PELIGRO si se copia el patrón accent-product: NO envolver en `hsl()` (ver Pitfall 2) |
| Defer F-05 | `preload: false` en Geist/Geist_Mono | Elimina los warnings pero introduce riesgo real de FOUT en cold-cache — prohibido por el propio contrato 5e ("Never a layout/FOUT regression") |

**Installation:** ninguna. `CERO new dependencies` es un hard bound del UI-SPEC (LOCKED).

## Package Legitimacy Audit

**No triggered.** Esta fase instala CERO paquetes externos (hard bound LOCKED del 54-UI-SPEC y CONTEXT).
Todo lo usado ya está en `app/package.json` con lockfile pnpm existente. Sin auditoría requerida.

## Architecture Patterns

### System Architecture Diagram

```
[Datos PROD (Supabase, INTACTOS)]                     [PROD Cloudflare Worker]
  nombre_normalizado (raw, lowercase) ──RPC──► Server Components ──render──► HTML
                                                    │
                                                    │  formatNombre(raw)  ← SOLO en el punto de render
                                                    │  (keys/params/hrefs = raw SIEMPRE)
                                                    ▼
                          ┌─── 9 superficies server (fichas, directorio, votos, lobby, agenda…)
                          └─── 2 islas cliente ya existentes:
                                 RedGraph  (F-04: h-96 md:h-120 + net-filtros CSS + nota md:hidden)
                                 SearchBox (5a: className del branch no-hero)

[home /] hero (LOCKED, byte-identical) ──seam pb──► <nav> 3 tarjetas (server, 0 JS) ──► ActualidadModule

[deploy] docker-cf-build.sh ──► docker cp ──► wrangler deploy ──► smoke 200s ──► rewalk-shot.mjs ──► docs/demo/*.jpg
```

### Pattern 1: formatNombre — passthrough guard Unicode + Title Case por sub-token

**What:** helper puro en `app/lib/format.ts`; transforma SOLO strings 100% minúsculas; todo lo demás pasa verbatim.
**When to use:** exclusivamente en los 11 render points del inventario del UI-SPEC (Contract 1).
**Example (implementación de referencia — reglas del UI-SPEC + hallazgos de datos reales):**

```typescript
// app/lib/format.ts — junto a fechaCorta (patrón existente)
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "van", "von", "y"]);

export function formatNombre(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (s === "") return "";
  // Guard de passthrough — DEBE ser Unicode-aware (\p{Lu}), NO /[A-Z]/:
  // fila real "fundación mas familia Ñuble" tiene Ñ mayúscula y CERO A-Z.
  if (/\p{Lu}/u.test(s)) return s; // ya viene caseado por la fuente → verbatim
  return s
    .split(" ")
    .map((token, i) => {
      if (i > 0 && PARTICULAS.has(token)) return token; // partícula no-inicial: minúscula
      // Capitaliza cada sub-token separado por - o ' (delimitadores preservados):
      return token
        .split(/([-'])/)
        .map((part) =>
          part === "-" || part === "'"
            ? part
            : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join("");
    })
    .join(" ");
}
```

Notas verificadas: `"á".toUpperCase() === "Á"` (JS Unicode-aware) — las 35 filas lowercase con tildes
("camara chilena de la construcción") capitalizan bien sin fabricar tildes nuevas. Idempotencia se cumple
por construcción: la salida transformada contiene mayúsculas → segunda pasada = passthrough.

### Pattern 2: F-04 — altura por token + compactación CSS + knobs xyflow

**What:** los 3 cambios del Contract 4 usando solo lo instalado.
**Example:**

```tsx
// red-graph.tsx — reemplaza style={{ height: 480 }} (línea 283):
<div className="net-lienzo mt-4 h-96 md:h-120">
  {/* h-96=384px móvil / md:h-120=480px ≥768px — COMPILADO Y VERIFICADO con tailwind 4.3.1 instalado */}
  <ReactFlowProvider>
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.05 }}  // [VERIFIED: FitViewOptions en types instalados]
      minZoom={0.2}                        // default 0.5 — permite que fitView aleje más a 390px
      proOptions={{ hideAttribution: true }}
    >
```

```css
/* globals.css — bloque net-* existente (líneas 125-175). Compactación móvil CSS-only: */
@media (max-width: 47.99rem) { /* <768px = bajo el breakpoint md */
  .net-filtros { flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 0.5rem 0.75rem; }
  .net-filtros__ventana { gap: 0.5rem; }
}
```

Nota: `fitView` corre en el mount inicial — al no haber re-fit en resize, la altura por breakpoint es
estática por carga (correcto para el fix acotado; ningún JS nuevo). Ningún filtro se oculta.

### Pattern 3: identity-warn — registro @theme SIN hsl() wrapper

```css
/* globals.css — nuevo bloque (hoy NO existe ningún @theme; coexiste con @config, VERIFICADO por compile): */
@theme inline {
  --color-identity-warn-bg: var(--identity-warn-bg);
  --color-identity-warn-fg: var(--identity-warn-fg);
  --color-identity-warn-border: var(--identity-warn-border);
}
/* Genera: .bg-identity-warn-bg { background-color: var(--identity-warn-bg) } etc.
   civic-tokens.css define valores hsl() COMPLETOS — jamás envolver en hsl(var(...)) como accent-product. */
```

### Anti-Patterns to Avoid

- **Aplicar `formatNombre` a keys/params/hrefs/comparaciones:** rompe matching e identidad (invariante HARD §2 del SPEC). Solo el string RENDERIZADO.
- **Guard ASCII `/[A-Z]/`:** re-casearía "fundación mas familia Ñuble" (fila real). Usar `/\p{Lu}/u`.
- **Copiar el patrón `hsl(var(--accent-product))` para identity-warn:** los civic tokens son `hsl(...)` completos → doble wrap = color inválido otra vez.
- **`preload: false` en layout.tsx "para limpiar la consola":** trueque de ruido invisible por FOUT visible — prohibido por 5e.
- **Build de OpenNext en Windows:** worker roto (gotcha 500ea conocido). Solo Docker Linux.
- **Screenshots ANTES del deploy final:** el set demo es evidencia del sitio FINAL desplegado (LOCKED).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zoom/fit del grafo a 390px | Cálculo manual de viewport/transform | `fitView` + `fitViewOptions` + `minZoom` de xyflow (ya instalados) | [VERIFIED: component-props.d.ts instalado expone ambos] — contrato prohíbe JS nuevo significativo |
| Altura adaptativa del canvas | JS de resize listener | Clases responsive `h-96 md:h-120` | Compilan con el Tailwind instalado (probado); CSS puro, cero JS |
| Detección de mayúsculas Unicode | Lista manual de chars acentuados | Regex `/\p{Lu}/u` (ES2018+, soportado por TS 5/Node 22/browsers target) | Cubre Ñ/Á/… sin tabla a mano; contraejemplo real en datos |
| Restaurar tildes en nombres | Diccionario de nombres chilenos | NADA — deferred idea explícita | Añadir tildes = fabricar dato (LOCKED) |

**Key insight:** esta fase es célebre por lo que NO construye — todo el fix F-04 y el identity-warn son
configuración/clases de lo ya instalado; la única lógica nueva es `formatNombre` (~20 líneas puras).

## Real-Data Findings — formatNombre (censo psql de PROD, 2026-07-07, read-only)

[VERIFIED: psql contra SUPABASE_DB_URL, PGCLIENTENCODING=UTF8]

### `parlamentario.nombre_normalizado` (superficies 1, 2, 8, 9 — y la 6 vía RPC)

| Métrica | Valor |
|---------|-------|
| Total filas | 186 |
| 100% minúsculas | **186 (100%)** — TODAS se transforman |
| Con tildes / guiones / apóstrofes / puntuación | **0 / 0 / 0 / 0** |
| Con partícula (de/del/la/las/los/van/von/y) | **1** — `"enrique rysselberghe van"` |
| Orden de tokens | Inconsistente CONFIRMADO: "bustos daniel", "ivan moreira", "alberto cuello luis", "ordenes ximena" |

**Edge case real #1 — partícula en posición FINAL:** `"enrique rysselberghe van"` → con las reglas LOCKED
produce `"Enrique Rysselberghe van"` ("van" no es primer token → minúscula). Es display honesto del orden
scrambled de la fuente (Van Rysselberghe con tokens reordenados por la fuente, no por nosotros). RESOLVED:
no special-casing (sería reordenar/inferir apellido = fabricar); AGREGAR como test case.

### `lobby_contraparte.nombre` (superficies 5, 7)

| Métrica | Valor |
|---------|-------|
| Total filas | 17.681 |
| Con alguna mayúscula → **passthrough** | 17.451 (98,7%) |
| ALL-CAPS (sin minúsculas) | 2.097 (passthrough, p.ej. "AFP HABITAT"-style, "SINDICATO … - CHILE TE CUIDA") |
| 100% minúsculas → **se transforman** | 230 |
| — de esas, con partículas | 64 ("camara chilena de la construcción", "consejo de pastores de la serena") |
| — de esas, con tildes minúsculas | 35 ("construcción" — capitalizar 1ª letra no fabrica tildes) |
| — de esas, con dígitos/puntuación | 9 ("kypco spa" → "Kypco Spa"; "spa/s.a." queda "Spa"/"S.a." — cosmético, aceptable, documentar) |
| Con apóstrofe | 1 (ALL-CAPS "…SELK'NAM…" → passthrough; el caso "o'higgins" del SPEC no existe hoy en lowercase — test sigue siendo obligatorio por contrato) |
| Con guion | 359 (todas pre-caseadas → passthrough: "Coca-Cola de Chile S.A.") |

**Edge case real #2 — guard Unicode (CRÍTICO):** `"fundación mas familia Ñuble"` — 1 fila real con Ñ
mayúscula y CERO A-Z. Un guard `/[A-Z]/` la clasificaría como lowercase y la re-casearía. El guard DEBE ser
`/\p{Lu}/u`. AGREGAR como test case de passthrough.

### `voto.mencion_nombre` (superficies 3, 4)

394 nombres distintos, **0 en minúsculas** — todos pre-caseados por la fuente con tildes
("Marlene Pérez Cartes", "Chiara Barchiesi Chávez"). `formatNombre` es **no-op passthrough hoy** en votos;
se aplica igual (futuro-proof, contrato). Los tests de estas superficies deben asertar passthrough.

### `citacion_invitado.nombre` (superficie 11)

30 filas, **0 en minúsculas** — y NO son nombres: son párrafos de texto libre de la fuente
("Audiencia:Representantes de la Fundación Docere, Fernanda Badrie, Jefa de…"). El guard de passthrough
las deja verbatim (todas contienen mayúsculas). RESOLVED: aplicar el formatter igual (per contrato, riesgo
cero — no-op garantizado por el guard), documentar en el plan que la superficie 11 es passthrough en la práctica.

### Test cases adicionales desde datos reales (suman a la tabla obligatoria del UI-SPEC)

| Input (REAL en PROD) | Output esperado | Qué prueba |
|----------------------|-----------------|------------|
| `"enrique rysselberghe van"` | `"Enrique Rysselberghe van"` | Partícula en posición final (única fila con partícula en parlamentario) |
| `"camara chilena de la construcción"` | `"Camara Chilena de la Construcción"` | Partículas consecutivas "de la" + tilde lowercase preexistente intacta |
| `"fundación mas familia Ñuble"` | unchanged (passthrough) | Guard Unicode `\p{Lu}` — Ñ sin A-Z |
| `"kypco spa"` | `"Kypco Spa"` | Sigla lowercase queda Title Case (limitación cosmética documentada) |

## Common Pitfalls

### Pitfall 1: Asumir que el identity-warn actual "se ve bien" (premisa del SPEC rota)
**What goes wrong:** Contract 5b exige screenshot before/after "pixel-identical". Imposible: el CSS
compilado del build actual (`.next/dev/.../app_app_globals_css…css`) contiene literalmente
`.bg-\[--identity-warn-bg\] { background-color: --identity-warn-bg; }` — declaración inválida (falta
`var()`), descartada por el navegador. El marker se renderiza HOY sin fondo/texto/borde ámbar (solo el
borde base gris de `* { border-color: hsl(var(--border)) }` y color heredado).
**Why it happens:** Tailwind v4 eliminó el shorthand v3 `bg-[--var]`; en v4 el arbitrary-var es `bg-(--var)`.
El shipped class compila pero a CSS roto.
**How to avoid:** el planner reformula la aceptación de 5b: el fix **restaura** el visual ámbar diseñado
(cambio visible intencional); evidencia = before (sin ámbar) / after (ámbar) del marker.
**Warning signs:** un checker que exija pixel-diff == 0 en 5b bloqueará la fase con el fix correcto.

### Pitfall 2: Doble hsl() al registrar los tokens identity-warn
**What goes wrong:** copiar el patrón de `accent-product` (`"accent-product": "hsl(var(--accent-product))"`)
produce `hsl(hsl(38 92% 95%))` — inválido — porque `civic-tokens.css` define valores `hsl(...)` COMPLETOS
(a diferencia de los triples pelados de shadcn en `:root` de globals.css).
**How to avoid:** `@theme inline { --color-identity-warn-bg: var(--identity-warn-bg); … }` — sin wrapper.
Verificado por compile probe: genera `background-color: var(--identity-warn-bg)`.
**Warning signs:** marker sin fondo otra vez tras el "fix".

### Pitfall 3: Guard de passthrough ASCII-only
**What/avoid:** ver Real-Data Findings — `/\p{Lu}/u`, con test de `"fundación mas familia Ñuble"`.

### Pitfall 4: Tests RTL que aserten el nombre RAW tras aplicar el formatter
**What goes wrong:** tests existentes de las 11 superficies (p.ej. `parlamentario-header.test.tsx`,
`lobby-en-tramitacion.test.tsx`) aserten hoy strings como los emite el fixture. Si el fixture usa
lowercase (`"gonzalez sofia"`), el render pasará a "Gonzalez Sofia" y el `getByText` viejo falla.
**How to avoid:** el plan debe presupuestar la actualización de asserts en los tests co-localizados de las
superficies tocadas — y verificar que el React key de `lobby-en-tramitacion.tsx:237` sigue usando el RAW.
**Warning signs:** suite roja solo en tests de texto tras el wrap.

### Pitfall 5: Relocación del footnote de rebeldías rompiendo su assert byte-identical
**What goes wrong:** Contract 3 mueve el string del método (`votos-por-parlamentario.tsx:728-731`) bajo el
h3 SIN cambiar un byte; los RTL `getByText` existentes deben seguir pasando. Si además queda el original →
render doble (prohibido: "Never renders twice").
**How to avoid:** mover (no copiar) el `<p>`; correr el test del componente como quick-gate del task.

### Pitfall 6: Capturar screenshots con el viewport padre de 772px del harness
**What goes wrong:** F53 lesson explícita en el SPEC — captures 1280 salen right-cropped.
**How to avoid:** ensanchar la página/viewport del harness antes de capturar; gate: width imagen ≥1260px.

### Pitfall 7: Chequear el fold 1280×800 sin el seam de padding del hero
**What goes wrong:** el hero hoy termina en `py-16 md:py-24`; sin el cambio a `pt-16 pb-8 md:pt-24 md:pb-10`
las 3 tarjetas no entran en el fold y el acceptance shot falla.
**How to avoid:** aplicar el seam del Contract 2 (único lever permitido: bottom padding del `<section>` hero;
piso `pb-8 md:pb-8`), verificar con `rewalk-shot.mjs` a 1280.

## Code Examples

(Ver Architecture Patterns §1-§3 — implementación de referencia de `formatNombre`, knobs xyflow verificados
en tipos instalados, y el bloque `@theme inline`. Fuentes: type defs instalados de @xyflow/react 12.11.0;
compile probe con tailwindcss 4.3.1 instalado; docs bundled de Next 16.2.9.)

## F-05 — woff2 preload warnings: veredicto (RESOLVED: documentar y diferir)

**Evidencia (F53):** exactamente 2 warnings idénticos por ruta, TODAS las rutas de PROD —
`The resource /_next/static/media/…woff2 was preloaded using link preload but not used within a few seconds…`
(los 2 archivos = subsets latin de Geist Sans + Geist Mono). Cero errores de app. [CITED: 53-UX-AUDIT F-05 + ux-evidence/pista-a-log.md]

**Root cause:** `next/font/google` con `preload: true` (default) inyecta `<link rel="preload">` por subset
[CITED: node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md — §subsets, §preload].
Ambas fonts SÍ se usan (body `font-family: var(--font-geist-sans)` en globals.css:67 + `font-mono` en cifras) —
el warning es la heurística de timing de Chrome (~3s post window-load), disparada aun con fonts en uso
(caché caliente / paint rápido / consumo tardío del mono). Issue ampliamente reportado upstream sin fix
userland que conserve el preload [CITED: github.com/vercel/next.js/discussions/45294 y /discussions/49607].

**Knob disponible (1 línea por font):** `preload: false` existe y está documentado en los docs bundled de
Next 16.2.9 [CITED: font.md §preload]. Trade-off: elimina el `<link rel=preload>` → la font se descubre
recién al parsear CSS → riesgo real de FOUT en cold-cache (exactamente el escenario de una demo en una
máquina ajena). `adjustFontFallback` (default true) mitiga CLS pero no el flash de swap.

**Veredicto:** **documentar y diferir** — la salida que el propio Contract 5e habilita ("otherwise document
the finding in the phase summary and defer" / "Never a layout/FOUT regression"). Razones: (1) no es defecto
de app (0 errores); (2) el público de la demo mira el sitio, no la consola; (3) el único knob troca ruido
invisible por riesgo visible. Acción para el plan: 1 párrafo en el SUMMARY de la fase (root cause + knob +
por qué se difiere); `app/app/layout.tsx` NO se toca. El criterio de éxito 4 del ROADMAP ("cero errores de
consola") se cumple: los woff2 son `level:warning`, no `error` (así los clasificó ya el QA de F53).

## Discrepancy Note — ROADMAP vs CONTEXT (para el planner)

El texto del ROADMAP Phase 54 dice "orden consistente Nombre Apellido, manejo de … tildes". El CONTEXT
(posterior, LOCKED) lo **supersede explícitamente**: SIN reordenar tokens y SIN tildes nuevas — ambas cosas
serían fabricar identidad/dato. Los datos reales confirman por qué (orden inconsistente en 186/186 filas).
El planner debe seguir CONTEXT/UI-SPEC, no la frase del ROADMAP.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `bg-[--var]` shorthand | v4: `bg-(--var)` o token registrado (`@theme`) | Tailwind v4.0 | El shipped `bg-[--identity-warn-bg]` compila a CSS inválido — origen del Pitfall 1 |
| Escala de spacing fija (v3) | v4 spacing dinámico: `h-<n>` = `calc(var(--spacing) * n)` | Tailwind v4.0 | `h-120` existe sin config extra (verificado: theme.extend no pisa spacing) |
| `reactflow` v11 | `@xyflow/react` v12 (`fitViewOptions`, `minZoom` como props) | 2024 (v12) | Los knobs del Contract 4 son props de primera clase en la 12.11.0 instalada |

**Deprecated/outdated:** ninguno relevante nuevo esta fase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El warning woff2 de Chrome es heurística de timing y no un preload genuinamente sin uso (diagnóstico basado en discusiones upstream + uso real de ambas fonts; no se instrumentó Chrome DevTools esta sesión) | §F-05 | Bajo — el veredicto (defer) es correcto en ambos casos: aun si fuera un preload sin uso real, el único fix sigue siendo `preload:false` con el mismo trade-off FOUT |
| A2 | `minZoom={0.2}` + `fitViewOptions={{ padding: 0.05 }}` reducen el overlap a 390px lo suficiente (las props existen — verificado; el efecto visual exacto se valida con el screenshot 390 de aceptación) | §Pattern 2 | Bajo — el contrato ya prevé el fallback: la nota "mejor en pantalla ancha" es visible y no-bloqueante aunque el grafo siga apretado |
| A3 | Wrangler OAuth sigue vivo para el deploy (CONTEXT lo afirma al 2026-07-07; no se probó en research para no tocar creds de deploy) | §Environment | Medio — si expiró, el redeploy final (5f) requiere re-login del operador; checkpoint operador ya previsto en el patrón de deploy |

## Open Questions

1. **¿"Enrique Rysselberghe van" es aceptable como display?** — **RESOLVED.** Sí: las reglas LOCKED (no
   reordenar, partícula no-inicial en minúscula) lo producen; cualquier "arreglo" implicaría inferir apellido
   (fabricar identidad, prohibido). Recommendation: test case explícito + sin special-casing.
2. **¿Pixel-identical en 5b?** — **RESOLVED.** Imposible y no deseable: la clase shipped compila a CSS
   inválido (verificado en el build). Recommendation: el plan redefine la evidencia de 5b como "restauración
   del visual ámbar" con before/after; el resto del contrato (valores HSL intactos, utilities planas) queda igual.
3. **¿F-05 se arregla o se difiere?** — **RESOLVED.** Diferir con documentación (§F-05): el knob existe
   (`preload:false`, docs bundled Next 16.2.9) pero viola el propio guard anti-FOUT del contrato 5e.
4. **¿Aplicar formatNombre en la superficie 11 (invitados) que es texto libre?** — **RESOLVED.** Sí, per
   contrato: el guard de passthrough garantiza no-op en las 30 filas reales (todas con mayúsculas); riesgo cero.
5. **¿`h-120` existe en la escala Tailwind v4 del proyecto?** — **RESOLVED.** Sí: compile probe real contra
   el setup `@config` del proyecto genera `.h-120 { height: calc(var(--spacing) * 120) }` (480px) y
   `.md\:h-120`; el spacing dinámico está activo porque `tailwind.config.ts` solo usa `theme.extend`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | suite/build | ✓ | v22.21.1 | — |
| pnpm | suite monorepo | ✓ | 11.3.0 | — |
| Docker CLI | build OpenNext (deploy 5f) | ✓ | 29.5.2 | Docker Desktop puede requerir `Start-Process` (gotcha CONTEXT) |
| psql | solo research (hecho) | ✓ | 17.9 | — (la fase no lo necesita) |
| wrangler | deploy 5f | ✓ (devDep 4.102.0) | OAuth "vivo al 2026-07-07" per CONTEXT — no re-verificado (A3) | re-login operador |
| `scripts/rewalk-shot.mjs` + `bros-cli.mjs` | Contract 6 + smoke | ✓ (ambos existen) | endurecidos F53 | — |
| BrowserOS (harness runtime) | screenshots | asumido ✓ (usado en F53 esta semana) | — | checkpoint operador si no responde |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** wrangler OAuth (A3) — re-login operador si expiró.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.6 + jsdom 29 + @testing-library/react 16.3 (globals: true) |
| Config file | `app/vitest.config.ts` (+ `app/vitest.setup.ts`; alias `@` y shim `server-only` ya resueltos) |
| Quick run command | `cd app && npx vitest run lib/format.test.ts` (o el test del componente tocado) |
| Full suite command | `pnpm test` desde repo root (packages/* + app; baseline **565/565**) + `pnpm typecheck` (`tsc -b`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-02/C1 | `formatNombre`: tabla del SPEC + 4 casos de datos reales + idempotencia | unit | `cd app && npx vitest run lib/format.test.ts` | ✅ `app/lib/format.test.ts` (extender) |
| UX-02/C1 | 11 superficies renderizan formateado; keys/hrefs RAW | unit (RTL) | `cd app && npx vitest run components/parlamentario-header.test.tsx components/lobby-en-tramitacion.test.tsx …` | ✅ todos los componentes del inventario tienen test co-localizado (verificado por ls) |
| UX-02/C2 | 3 tarjetas: nav aria-label, 3 Links con hrefs, copy exacto, sin heading, banned-vocab | unit (RTL) | `cd app && npx vitest run app/page.test.tsx` | ✅ `app/app/page.test.tsx` (extender) |
| UX-02/C3 | Microcopy: cruces (1 frase integrada), rebeldías (string byte-identical relocalizado, nunca ×2), patrimonio (1 frase) | unit (RTL) | `cd app && npx vitest run components/cruces-de-parlamentario.test.tsx components/votos-por-parlamentario.test.tsx components/patrimonio-de-parlamentario.test.tsx` | ✅ los 3 existen (extender; banned-vocab negative-match ya es patrón en ellos) |
| UX-02/C4 | RedGraph: clases `h-96 md:h-120` en lienzo, nota `md:hidden`, filtros intactos, empty-state byte-identical | unit (RTL) | `cd app && npx vitest run components/red/red-graph.test.tsx` | ✅ existe (extender) |
| UX-02/C5a | SearchBox no-hero con clases petróleo; hero branch byte-identical | unit (RTL) | `cd app && npx vitest run components/search-box.test.tsx` | ❌ Wave 0 (nuevo, pequeño) |
| UX-02/C5b | IdentityMarker con utilities planas `bg-identity-warn-bg…` (sin arbitrary-var) | unit (RTL) | `cd app && npx vitest run components/identity-marker.test.tsx` | ❌ Wave 0 (nuevo, pequeño) — o assert dentro de `lobby-de-parlamentario.test.tsx` (✅ existe) |
| UX-02/C5c | Skeletons con fila breadcrumb (ParlamentarioHeaderSkeleton + HeaderSkeleton de contraparte) | unit (RTL) o code-review | — (skeletons viven inline en `app/app/parlamentario/[id]/page.tsx:440-451` y `app/app/contraparte/[id]/page.tsx:161-169`; asertables solo si se exportan — aceptable verificar por review + screenshot) | manual-ok |
| UX-02/C6 + smoke | Screenshots ≥6 full-width post-deploy + superficies 200 + gate NET ON live / OFF por test | manual-only | `node scripts/rewalk-shot.mjs …` + curl 200s | Justificación: requiere PROD desplegado + BrowserOS; el estado OFF del gate se cubre con el test existente `lib/net-gate.test.ts` (✅) — NUNCA flipeando PROD |

### Sampling Rate
- **Per task commit:** vitest run del/los archivo(s) de test co-localizados tocados (<30s c/u).
- **Per wave merge:** `pnpm --filter ./app test` + `pnpm typecheck`.
- **Phase gate:** `pnpm test` completo desde root (≥565 verde, sin regresión) + `tsc -b` limpio + lockdown-guard verde (dentro de la suite) antes de `/gsd:verify-work`; smoke + screenshots DESPUÉS del deploy final.

### Wave 0 Gaps
- [ ] `app/components/search-box.test.tsx` — cubre UX-02/C5a (branch hero byte-identical + no-hero petróleo)
- [ ] Assert de clases identity-warn — nuevo `app/components/identity-marker.test.tsx` O extender `lobby-de-parlamentario.test.tsx` (existe)
- Framework: ninguno que instalar — infraestructura completa (config, setup, jsdom, RTL, 565 tests baseline).

## Security Domain

`security_enforcement: true` (ASVS L1). Fase display-only, read-only product, sin superficies nuevas de entrada.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth nueva; producto público read-only |
| V3 Session Management | no | Sin sesiones |
| V4 Access Control | yes (invariante) | Gates existentes intactos: NET gate OFF verificado por test (`net-gate.test.ts`), MONEY gated, lockdown-guard CI verde — la fase NO toca RPCs ni el allowlist |
| V5 Input Validation | yes | `formatNombre` tolera null/undefined/whitespace (contrato); React escapa el output (JSX text nodes) — el formatter devuelve strings planos, nunca HTML |
| V6 Cryptography | no | Nada criptográfico |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS vía nombres de fuente externa (lobby/votos) | Tampering | Render como JSX text node (escape automático de React); `formatNombre` no genera markup ni usa dangerouslySetInnerHTML |
| Fuga de PII por cambio de proyección | Information Disclosure | N/A por diseño: cero cambios de RPC/DB; `nombre_normalizado` (ya PII-safe) sigue siendo la única proyección; formatter solo re-casea en render |
| Identidad fabricada por display (riesgo existencial #1 del proyecto) | Spoofing/Repudiation | Invariantes HARD del SPEC: sin reordenar, sin tildes, sin tocar link guards (`estado_vinculo === "confirmado"`), IdentityMarker intacto |
| Deploy con secrets en cliente | Information Disclosure | Sin env vars nuevas; deploy 5f repite el patrón autorizado (wrangler OAuth local, creds fuera del repo) |

## Sources

### Primary (HIGH confidence)
- **Compile probe real** con tailwindcss 4.3.1 + @tailwindcss/postcss instalados contra `app/tailwind.config.ts` — `h-96`/`h-120`/`md:h-120`/`bg-identity-warn-bg` (@theme) generan CSS; `bg-[--identity-warn-bg]` genera `background-color: --identity-warn-bg;` (inválido)
- **CSS del build dev** (`app/.next/dev/static/chunks/app_app_globals_css….css`) — confirma el CSS inválido shipped
- **Type defs instalados** `@xyflow/react@12.11.0` (`component-props.d.ts:403,529`) — `minZoom`, `fitViewOptions`
- **Docs bundled Next 16.2.9** (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`) — `preload` (default true), `subsets`→preload link, `adjustFontFallback`
- **psql PROD read-only** — censo de `parlamentario.nombre_normalizado`, `lobby_contraparte.nombre`, `voto.mencion_nombre`, `citacion_invitado.nombre` (queries y conteos en §Real-Data Findings)
- `.planning/phases/53-…/53-UX-AUDIT.md`, `53-REVIEW.md` (IN-01..IN-04 con file:line), `53-UI-REVIEW.md`, `ux-evidence/pista-a-log.md` — evidencia F-04/F-05 y minors
- Código fuente leído: `red-graph.tsx`, `layout.tsx`, `globals.css`, `civic-tokens.css`, `tailwind.config.ts`, `format.ts`, `search-box.tsx`, `identity-marker.tsx`, `vitest.config.ts`, package.json (app + root)

### Secondary (MEDIUM confidence)
- [github.com/vercel/next.js/discussions/45294](https://github.com/vercel/next.js/discussions/45294) y [discussions/49607](https://github.com/vercel/next.js/discussions/49607) — el warning woff2 es un problema conocido de next/font sin fix userland que conserve preload (diagnóstico A1)

### Tertiary (LOW confidence)
- Ninguna — no quedaron claims solo-WebSearch sin verificación.

## Metadata

**Confidence breakdown:**
- F-04 mecánica (clases + knobs xyflow): HIGH — verificado por compile probe y type defs instalados
- F-05 veredicto: HIGH en el veredicto (defer), MEDIUM en el diagnóstico fino del timing (A1 — irrelevante para la decisión)
- formatNombre edge cases: HIGH — censo exhaustivo de PROD, no muestras anecdóticas
- Identity-warn (corrección al SPEC): HIGH — CSS inválido observado en el build real
- Validation architecture: HIGH — inventario de tests por ls directo; baseline 565 confirmado por CONTEXT/53-REVIEW

**Research date:** 2026-07-07
**Valid until:** 2026-08-06 (stack pinned por lockfile; los line numbers del inventario son "as of 2026-07-07" — re-verificar si otra fase toca esos archivos antes)
