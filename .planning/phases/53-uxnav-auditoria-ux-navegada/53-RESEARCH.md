# Phase 53: UXNAV — Auditoría UX navegada (BrowserOS) + fixes de orientación - Research

**Researched:** 2026-07-07
**Domain:** Auditoría UX con navegador real (BrowserOS MCP) + fixes de navegación/orientación en Next.js 16 App Router
**Confidence:** HIGH (mecánica BrowserOS verificada EN VIVO esta sesión contra el MCP y contra PROD; inventario de código verificado por file:line)

## Summary

La parte novedosa de esta fase — auditar PROD con BrowserOS vía `scripts/bros-cli.mjs` — quedó **verificada en vivo esta sesión** (7 requests a PROD, dentro del presupuesto). Hallazgo central de mecánica: **ni `create_hidden_window` ni `new_hidden_page` aceptan bounds, y `window.resizeTo()` es un no-op en páginas ocultas** (viewport medido quedó clavado en 772×728). El viewport de la página oculta NO es 1280×800 ni 390×844 y no es controlable directamente. La solución verificada es un **harness de iframe**: página oculta en `about:blank` + `<iframe>` inyectado con el ancho exacto del viewport deseado (390px o 1280px) apuntando a PROD. Las media queries responden al ancho del iframe (verificado: el nav colapsa a 2 filas a 390px), PROD no bloquea framing (sin X-Frame-Options/CSP), y `save_screenshot {fullPage:true}` captura el ancho completo del iframe aunque exceda el viewport del padre (verificado con iframe de 1280px en viewport de 772px). Un iframe ALTO (390×2500) + fullPage captura la página móvil completa en un solo shot (verificado contra `/proyecto/14309-04`).

Costo del harness: el iframe es cross-origin, así que `take_snapshot`/`get_page_content`/`click` no ven su interior, y `get_console_logs` NO captura la consola del iframe (solo mensajes browser-level). Por eso el protocolo es de **dos pistas**: Pista A (funcional — navegación DIRECTA de la página oculta por ruta: console logs, links, snapshot, contenido) y Pista B (visual — harness iframe a 390/1280 para screenshots de evidencia). Los fixes en sí son triviales y ya están contratados por el 53-UI-SPEC aprobado: extender `NAV_ITEMS` (+Red, label "Sobre"), un componente `Breadcrumbs` server puro con props literales (cero JS, cero dependencia nueva), y 1 línea de continuación en los empty states que la auditoría marque como callejón sin salida.

**Primary recommendation:** ejecutar la auditoría con el protocolo de dos pistas documentado abajo (comandos exactos medidos), producir `53-UX-AUDIT.md` con el esqueleto propuesto, e implementar los P0 EXCLUSIVAMENTE dentro del contrato del 53-UI-SPEC (nav+breadcrumbs+continuation-lines); todo hallazgo que exija más que eso es P1 → informe, no fix.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Forma de la navegación global (los fixes P0 esperados)**
- Header global: mantener el patrón actual (logo + links, cero JS nuevo) pero con **estado activo visible** (la sección actual marcada); considerar orden por journey: Buscar · Parlamentarios · Agenda · Red · Sobre. `/red` hoy NO está en el header — evaluar añadirlo (está LIVE desde 2026-07-02).
- Fichas (proyecto/parlamentario/contraparte): **breadcrumb ligero** ("Inicio / Proyectos / {id}") arriba del título. Sin JS.
- Cross-links SOLO donde ya es legal: nombre de parlamentario en listas de votos → su ficha; contraparte en el lobby del parlamentario → ficha contraparte; boletín en agenda → ficha proyecto. **PROHIBIDO** enlazar el nombre en el carril lobby×tramitación de la ficha de proyecto (texto plano LOCKED, decisión 52-03/UI-SPEC — contexto de yuxtaposición, no atribución).
- Estados vacíos honestos ganan 1 línea de continuación orientadora ("Prueba buscar por idea →" / link a una sección con datos), sin fabricar virtud ("limpio/transparente" PROHIBIDO).

**Alcance de los fixes**
- P0 (se arregla en esta fase) = SOLO orientación/navegación/bloqueo: "no sé dónde estoy", "no puedo llegar a X", callejón sin salida, affordance rota, error de consola grave. Rediseños visuales/jerarquía = P1/P2 → quedan en el informe para F54.
- 1 ciclo: auditoría completa → fixes de todos los P0 → 1 re-walkthrough de verificación con screenshots before/after. Sin loop abierto.
- **1 redeploy al final de la fase** (patrón docker-cf-build.sh + wrangler local, autorizado por el operador 2026-07-06); el re-walkthrough verifica contra el PROD re-desplegado.
- Móvil first-class: los P0 móviles cuentan igual que desktop.

**Evidencia y mecánica**
- Se audita PROD (workers.dev) — lo que verá el centro de estudios, con datos reales.
- Viewports: desktop 1280×800 y móvil 390×844. Ventanas/páginas OCULTAS de BrowserOS (no interferir con el navegador del operador). Para viewport móvil: usar `create_hidden_window` con bounds o `evaluate_script`/emulación según lo que soporte la API — el executor consulta `node scripts/bros-cli.mjs schema <tool>`.
- Evidencia commiteada en `.planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/` (screenshots numerados por journey; before/after para cada fix P0).
- `get_console_logs` por página del journey; error de consola = hallazgo automático (P0 si rompe función, P1 si es ruido).

### Claude's Discretion
- Redacción exacta de breadcrumbs/labels y microcopy de vacíos (factual, es-CL, sin promesas).
- Clasificación P0/P1/P2 de cada hallazgo (criterio arriba); ante la duda entre P0/P1 → P1 (la fase no debe crecer).
- Mecánica exacta del viewport móvil en BrowserOS (lo que la API soporte).

### Deferred Ideas (OUT OF SCOPE)
- Nombres presentables (Title Case), home con rutas de entrada guiadas, microcopy "cómo leer esto" → Phase 54 (UXDEMO).
- Cualquier hallazgo P1/P2 del informe → Phase 54 o backlog.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Navegabilidad (ROADMAP Phase 53): ≥4 journeys navegados en vivo desktop+móvil con evidencia; hallazgos P0/P1/P2; TODOS los P0 corregidos + redeploy + re-walkthrough; desde cualquier superficie volver al home / saltar a las demás en ≤2 clicks; toda página muestra dónde estás; ningún callejón sin salida; cero regresión (anti-insinuación, lockdown-guard, tsc, `mt-12`, gates) | §BrowserOS Audit Mechanics (protocolo dos pistas, comandos verificados), §Navigation Inventory (estado actual exacto file:line), §Breadcrumb Pattern, §Audit Report Structure, §Validation Architecture |

Nota: UX-01 no existe en `.planning/REQUIREMENTS.md` — es un requirement de roadmap (ROADMAP.md:1248). El planner mapea contra los Success Criteria de ROADMAP.md:1250-1255.
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement**: cambios de archivos solo dentro de fase GSD (esta fase lo es).
- **Stack**: TypeScript, Next.js 16 App Router, Server Components por defecto; JS cliente solo donde ya existe. `app/AGENTS.md`: "This is NOT the Next.js you know" — leer `app/node_modules/next/dist/docs/` ante cualquier duda de API.
- **Cero llamadas a fuentes gubernamentales desde el navegador** — esta fase no toca la capa de datos (solo chrome de navegación).
- **Ingesta respetuosa / rate-limit 2–3s**: aplica por analogía al crawl de PROD propio — `sleep 3` entre navegaciones.
- **Secrets en `.env`** — esta fase no necesita ninguna API key (BrowserOS MCP es local, sin auth).
- **Anti-insinuación**: vocabulario prohibido negative-match en todo string nuevo; carril `mt-12` LOCKED; sin partido/foto/PII en chrome nuevo.
- **CERO DDL, CERO flags** (CONTEXT): ninguna migración, ningún flip de `*_PUBLIC_ENABLED`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auditoría navegada (journeys, screenshots, console) | Herramienta externa (BrowserOS MCP local vía `bros-cli.mjs`) | — | Navegador real en el host; el repo solo aporta el wrapper y archiva evidencia |
| Informe `53-UX-AUDIT.md` + evidencia | Docs (`.planning/phases/53-*/`) | — | Artefacto de planning, committeado; no es código de app |
| Header nav (+Red, label Sobre, activo) | Browser/Client (isla `HeaderNav` existente) | — | Único código cliente tocado: array estático `NAV_ITEMS`; active-underline ya usa `usePathname` |
| Breadcrumbs | Frontend Server (Server Component) | — | Componente presentacional puro con props literales por página; cero JS, cero `usePathname` |
| Empty-state continuation lines | Frontend Server (Server Components) | Browser/Client SOLO para `/red` | La línea de `/red` vive en `red-graph.tsx` que ya es isla cliente (`"use client"`); las demás son server |
| Redeploy | Infra operada localmente (Docker build Linux + wrangler OAuth) | — | Patrón establecido `docker-cf-build.sh`; 1 redeploy al final |
| Verificación (suite, tsc, guard) | CI local (`pnpm --dir app test -- --run`) | — | 541 tests + lockdown-guard dentro de la misma suite vitest |

## Standard Stack

### Core (todo ya instalado — CERO instalación en esta fase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BrowserOS MCP (host) | live en `http://127.0.0.1:9200/mcp` | Navegación real, screenshots, console logs | Verificado esta sesión: `tools/list` responde, journeys + screenshots funcionan `[VERIFIED: probe en vivo 2026-07-07]` |
| `scripts/bros-cli.mjs` | repo (smoke-tested 2026-07-07) | Wrapper JSON-RPC del MCP para agentes sin tools MCP registrados | Único camino: los tools `mcp__browseros__*` NO están en la sesión del executor `[VERIFIED: codebase]` |
| Next.js | 16.2.9 | Breadcrumbs server, nav, páginas | `[VERIFIED: app/package.json]` |
| React | 19.2.4 | — | `[VERIFIED: app/package.json]` |
| Vitest + RTL | `app/vitest.config.ts` | Tests de nav/breadcrumb/continuation | Suite existente 541 tests `[VERIFIED: codebase + CONTEXT]` |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `docker-cf-build.sh` (repo root) + `npx wrangler deploy` desde `app/` | Redeploy único al final | Docker daemon 29.5.2 corriendo `[VERIFIED: docker info]`; wrangler OAuth `[ASSUMED — ver Assumptions A1]` |
| `curl` + suite RTL | Fallback si BrowserOS muere a mitad de fase | ROADMAP lo autoriza: "análisis de HTML servido por curl + suite RTL (la evidencia visual queda como deuda)" |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Harness iframe para viewports | `window.resizeTo()` | **NO FUNCIONA** — verificado no-op en página oculta (viewport quedó en 772×728) |
| Harness iframe | Ventana visible + resize | Viola la decisión LOCKED de ventanas ocultas; y no hay tool de resize de ventana de todos modos |
| Harness iframe | Emulación CDP (`Emulation.setDeviceMetricsOverride`) | El MCP no expone CDP crudo — no hay tool para ello `[VERIFIED: tools/list completo revisado]` |
| Playwright/Puppeteer local | BrowserOS | Decisión LOCKED del CONTEXT: BrowserOS vía bros-cli; además Puppeteer está en la lista "What NOT to Use" del CLAUDE.md |

**Installation:** ninguna. Esta fase no instala NINGÚN paquete.

## Package Legitimacy Audit

**No aplica — cero paquetes nuevos.** El 53-UI-SPEC declara "Zero new dependency of any kind" y el inventario confirmó que todos los assets (Radix, next/link, vitest) ya están instalados. slopcheck no fue necesario.

## BrowserOS Audit Mechanics (VERIFIED LIVE — the novel part)

Todo lo de esta sección fue **medido contra el MCP real y PROD el 2026-07-07** en esta sesión. El executor sigue estos comandos verbatim (bash desde repo root; el wrapper ya maneja SSE/JSON).

### Hechos medidos (schemas + comportamiento)

| Hecho | Valor medido | Implicación |
|-------|--------------|-------------|
| `create_hidden_window` schema | `{}` — **sin parámetros, sin bounds** | No sirve para viewport móvil |
| `new_hidden_page` schema | `{url (req), windowId?}` — sin bounds | Ídem |
| Viewport de página oculta | **772×728, dpr 1.25, outerWidth/Height 0** | NO es 1280×800; probablemente dependiente de la sesión — NUNCA asumirlo |
| `window.resizeTo(390,844)` en página oculta | **no-op** (innerWidth siguió 772) | Emulación por resize imposible |
| iframe 390px con PROD dentro | **renderiza layout móvil** (nav en 2 filas, hero apilado) | Media queries responden al ancho del iframe — harness válido |
| Framing de PROD | **permitido** (sin X-Frame-Options / CSP frame-ancestors) | El harness funciona hoy; ver Assumption A4 |
| `save_screenshot {fullPage:true}` con iframe 1280px en viewport 772px | capturó los **1280px completos** de ancho | fullPage captura todo el contenido scrolleable del padre, no solo el viewport |
| iframe alto (390×2500) + fullPage | capturó la **página móvil completa** de `/proyecto/14309-04` en 1 shot | No hace falta scrollear dentro del iframe (imposible por JS cross-origin) |
| Consola del iframe cross-origin | **NO capturada** — solo mensajes browser-level (ej. "Blocked autofocusing … in a cross-origin subframe") | Console logs SOLO por navegación directa (Pista A) |
| Acceso JS al iframe | `SecurityError` cross-origin | `take_snapshot`/`get_page_content`/`click` no ven el interior del iframe |
| `save_screenshot` primer intento | falló 1× con `CDP request timeout: Page.captureScreenshot`, OK al retry tras sleep 3 | El retry-once del header de bros-cli es real — SIEMPRE envolver en `cmd || (sleep 3; cmd)` |
| `get_console_logs` schema | `{page, level: error|warning|info|debug, search?, limit≤200, clear?}` | `clear:true` tras leer = atribución de logs POR RUTA al navegar la misma página |
| `save_screenshot` extras | `format: png|jpeg|webp`, `quality`, `fullPage`, `cwd` | jpeg q70 para evidencia committeada (fullPage png de fichas largas pesa MB) |
| dpr 1.25 | screenshots salen a 1.25× px CSS (iframe 390 → ~487px de ancho de imagen) | Normal; no es un bug del harness |
| `/red` en vivo | carga, console **0 entradas** | Baseline limpio; todo error de consola en la auditoría es señal real |
| `navigate_page` | `{page, action: url|back|forward|reload, url}` | Una sola página oculta REUTILIZADA para toda la Pista A (menos páginas huérfanas) |
| Page ID | incrementa por sesión de browser — parsear `"Page ID: N"` del output de `open` | Patrón: `PID=$(echo "$OUT" \| grep -oE "Page ID: [0-9]+" \| grep -oE "[0-9]+")` |

Tools disponibles relevantes (de `tools/list`): `new_hidden_page`, `navigate_page`, `close_page`, `take_snapshot`, `take_enhanced_snapshot` (árbol a11y con headings/landmarks — útil para auditar "¿la página anuncia dónde estás?"), `get_page_content`, `get_page_links`, `get_dom`, `search_dom`, `evaluate_script`, `get_console_logs`, `save_screenshot`, `click`, `fill`, `press_key`, `scroll`, `click_at`.

### Protocolo de DOS PISTAS (prescriptivo)

**Pista A — funcional (navegación DIRECTA, viewport nativo ~772px):** console logs por ruta, inventario de links, snapshot de elementos interactivos, verificación de affordances y dead-ends. Una sola página oculta reutilizada con `navigate_page`.

```bash
# Abrir UNA página oculta para toda la pista (parsear PID una vez)
OUT=$(node scripts/bros-cli.mjs open "https://observatorio-congreso.thevalis.workers.dev/")
PID=$(echo "$OUT" | grep -oE "Page ID: [0-9]+" | grep -oE "[0-9]+")
sleep 5

# Por CADA ruta del journey:
node scripts/bros-cli.mjs call get_console_logs "{\"page\":$PID,\"level\":\"warning\",\"clear\":true}"   # error de consola = hallazgo
node scripts/bros-cli.mjs links $PID          # inventario de salidas de la página (dead-end check)
node scripts/bros-cli.mjs snapshot $PID       # affordances interactivas
# (opcional para orientación) call take_enhanced_snapshot '{"page":N}'  → headings/landmarks

# Navegar a la siguiente ruta EN LA MISMA página (rate-limit respetuoso):
sleep 3
node scripts/bros-cli.mjs call navigate_page "{\"page\":$PID,\"action\":\"url\",\"url\":\"https://observatorio-congreso.thevalis.workers.dev/buscar\"}"
sleep 5
# ... repetir el bloque de arriba

# Interacción real puntual (ej. journey 2, buscar por idea):
#   snapshot → localizar el input y el botón por ID de elemento → fill → click
node scripts/bros-cli.mjs call fill "{\"page\":$PID,\"elementId\":<id-del-snapshot>,\"text\":\"protección de datos\"}"
node scripts/bros-cli.mjs call click "{\"page\":$PID,\"elementId\":<id-del-boton>}"
# (la búsqueda también es URL-driven: /buscar?q=... — preferir URL para reproducibilidad
#  y usar la interacción real UNA vez para validar la affordance del SearchBox)

# Al terminar la pista:
node scripts/bros-cli.mjs close $PID
```

**Pista B — visual (harness iframe, viewports EXACTOS 390 y 1280):** screenshots de evidencia por journey. Una página harness en `about:blank`, cambiando `src` y ancho del iframe.

```bash
OUT=$(node scripts/bros-cli.mjs open "about:blank")
HID=$(echo "$OUT" | grep -oE "Page ID: [0-9]+" | grep -oE "[0-9]+")

# Inyectar el iframe UNA vez (helper idempotente):
node scripts/bros-cli.mjs call evaluate_script "{\"page\":$HID,\"expression\":\"var f=document.getElementById('vp')||document.createElement('iframe'); f.id='vp'; f.style.cssText='width:390px;height:2500px;border:0;display:block'; document.body.style.margin='0'; if(!f.parentNode)document.body.appendChild(f); f.src='https://observatorio-congreso.thevalis.workers.dev/'; 'ok'\""
sleep 6   # SSR + hidratación dentro del iframe

# Screenshot fullPage con retry-once (el CDP timeout ES real, reproducido hoy):
SHOT='{"page":'$HID',"path":"C:/Users/Carlo/OneDrive - pjud.cl/Documentos/GitHub/Observatorio/.planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/j1-01-home-390.jpg","fullPage":true,"format":"jpeg","quality":70}'
node scripts/bros-cli.mjs call save_screenshot "$SHOT" || (sleep 3 && node scripts/bros-cli.mjs call save_screenshot "$SHOT")

# Siguiente ruta / viewport: re-ejecutar evaluate_script cambiando f.src y/o f.style.width
#   móvil:   width:390px;height:2500px   (alto generoso: fullPage captura todo, el blanco sobrante es inocuo)
#   desktop: width:1280px;height:2000px
sleep 3   # rate-limit entre cargas de PROD
```

**Reglas del protocolo:**
1. `sleep 4-6` tras cada carga (SSR + hidratación); `sleep 3` mínimo entre requests a PROD.
2. Ruta de screenshot SIEMPRE absoluta con forward-slashes (`C:/Users/...`) — verificado.
3. Retry-once en TODO `save_screenshot`.
4. Los P0 de consola se detectan en Pista A (el harness no captura la consola del iframe). Los journeys móviles comparten el mismo bundle JS que desktop — un error de consola móvil-only sería rarísimo; documentar este límite en el informe.
5. Al final de cada sesión de trabajo: `close` de todas las páginas abiertas (no dejar huérfanas en el browser del operador).
6. El gotcha de autofocus ("Blocked autofocusing on a <input> element in a cross-origin subframe") aparecerá en la consola del harness — es ruido del harness, NO un hallazgo del sitio.

### Datos reales para los journeys (verificados en PROD hoy o por memoria de deploy)

| Journey | Rutas con datos |
|---------|-----------------|
| J1 landing | `/` (hero + pill boletín 14309-04 + actualidad) |
| J2 proyecto por idea | `/buscar` → `/buscar?q=<idea>` → `/proyecto/14309-04` (ficha completa: timeline, votaciones, lobby×tramitación) |
| J3 parlamentario 360 | `/parlamentarios` → `/parlamentario/D1012` (votos/lobby/patrimonio con datos; link "Ver relaciones") → `/red?seed=D1012` (305 aristas) |
| J4 transversal | `/proyecto/14309-04` ↔ `/parlamentario/[id]` (VotoRow confirmado) ↔ `/agenda` (semana 28 con citaciones, verificado hoy) ↔ `/contraparte/[id]` (**404 esperado** — MONEY gate OFF; documentar como gated, NO como hallazgo P0) ↔ `/` |

## Navigation Inventory (estado actual, verificado file:line)

### Rutas existentes

| Ruta | Página | Estado |
|------|--------|--------|
| `/` | `app/app/page.tsx` | hero + búsqueda + actualidad |
| `/buscar` | `app/app/buscar/page.tsx` | h1 `sr-only` (línea 43) — orientación visual depende del hero del buscador |
| `/parlamentarios` | `app/app/parlamentarios/page.tsx` | directorio, `max-w-5xl` (¡distinto del resto `max-w-3xl`!) |
| `/parlamentario/[id]` | `app/app/parlamentario/[id]/page.tsx` | ficha 360, `<main>` línea 116 |
| `/proyecto/[boletin]` | `app/app/proyecto/[boletin]/page.tsx` | ficha, `<main>` línea 50; h1 dentro de `FichaSection` (Suspense) |
| `/contraparte/[id]` | `app/app/contraparte/[id]/page.tsx` | **MONEY-gated → notFound() con gate OFF** (PROD hoy = 404) |
| `/agenda` | `app/app/agenda/page.tsx` | semana + búsqueda FTS |
| `/red` | `app/app/red/page.tsx` | LIVE (force-dynamic), selector + grafo con `?seed=` |
| `/sobre`, `/metodologia` | páginas estáticas | con links internos a /buscar /agenda /parlamentarios (sobre/page.tsx:62-78) |
| `/admin/revisar-entidades` | gated server-side | fuera de la auditoría ciudadana |

### Header actual (los fixes van aquí)

- `app/components/header-nav.tsx:27-32` — `NAV_ITEMS` = Buscar, Parlamentarios, Agenda, **"Sobre / Metodología"** (4 ítems; **sin Red**). Comentario `// LOCKED (UI-SPEC §11.0)` → el 53-UI-SPEC re-abre esa decisión con autorización explícita; el executor DEBE actualizar ese comentario al editar.
- Active state YA SHIPPED: `esActivo` prefix-match (`:34-37`) + underline petróleo (`:59`). Verificado en vivo: "Agenda" aparece subrayada en `/agenda`. **Gap real de orientación:** en `/proyecto/*`, `/contraparte/*` y `/red` (pre-fix) NINGÚN ítem del nav queda activo — no existe ítem "Proyectos". El breadcrumb es el remedio contratado, no un ítem nuevo.
- `app/components/global-header.tsx` — wrapper server, NO se toca.
- Footer (`app/app/layout.tsx:69-88`): links a /metodologia, /sobre, mailto — "Metodología sigue alcanzable desde /sobre y el footer" (justifica acortar el label).

### Breadcrumbs

**No existe ningún breadcrumb en el repo** (grep `breadcrumb|Breadcrumb` = 0 archivos). Puntos de inserción (primer hijo de `<main>`, dentro del container `max-w-3xl mx-auto px-4 md:px-8`):
- `app/app/proyecto/[boletin]/page.tsx:50` — antes del `<Suspense><FichaSection>` (el h1 vive dentro de FichaSection; el crumb va fuera del Suspense, no necesita datos).
- `app/app/parlamentario/[id]/page.tsx:116` — ídem; el segmento actual usa el `nombre_normalizado` as-shipped (Title Case es F54, NO esta fase).
- `app/app/contraparte/[id]/page.tsx:62` — DESPUÉS del gate `notFound()` (primera sentencia); invisible en PROD de esta fase, future-proof, inofensivo.

### Empty states (candidatos a línea de continuación — file:line verificado)

| Superficie | Archivo:línea | Copy shipped (se mantiene VERBATIM) | Tipo |
|------------|---------------|-------------------------------------|------|
| `/buscar` sin resultados | `app/app/buscar/page.tsx:80-90` | "No se encontraron proyectos para "{q}". **Prueba con otras palabras, o ingresa un número de boletín.**" | Server. ⚠️ overlap con la línea del SPEC — ver Open Question 1 |
| Ficha parl. — votos no ingeridos | `app/components/votos-por-parlamentario.tsx:462-466` | "Aún no hemos ingerido las votaciones de este parlamentario…" | Server |
| Ficha parl. — lobby (a) no ingestado | `app/components/lobby-de-parlamentario.tsx:296-300` | "Aún no hemos ingerido las reuniones de lobby…" | Server |
| Ficha parl. — lobby (b) cero confirmadas | `app/components/lobby-de-parlamentario.tsx:310-314` | "No se registran reuniones de lobby confirmadas…" | Server |
| `/agenda` — semana sin citaciones | `app/app/agenda/page.tsx:294-297` | "No hay citaciones de comisiones registradas para esta semana." | Server |
| `/agenda` — búsqueda sin resultados | `app/app/agenda/page.tsx:199-202` | "No se encontraron citaciones para "{q}"…" | Server |
| `/agenda` — tabla Senado vacía | `app/app/agenda/page.tsx:486-489` | "No hay tabla de sala del Senado…" | Server |
| `/red` — grafo vacío | `app/components/red/red-graph.tsx:158-165` | "Aún no hay relaciones para mostrar…" | **Cliente** (isla `"use client"` existente — añadir el `<Link>` ahí NO crea isla nueva; permitido por el SPEC) |
| Home actualidad | `app/components/actualidad-module.tsx:216, 319` | — | **NO TOCAR** (SPEC: home no es dead end) |

Regla del SPEC: la línea se añade SOLO a superficies que la auditoría marque como callejón sin salida; superficie no marcada = copy byte-idéntico.

### Cross-links ya shipped (verificados file:line — la auditoría NO debe re-proponerlos)

| Cross-link | Evidencia |
|------------|-----------|
| Parlamentario en roll-call → ficha (guard confirmado) | `app/components/voto-row.tsx:33` (guard `estado_vinculo==="confirmado" && parlamentario_id!=null`), `:42` (Link) |
| Proyecto en lista de votos del parlamentario → ficha proyecto | `app/components/voto-ficha-row.tsx:119,126,199,206`; `votos-por-parlamentario.tsx:357,364,689,696` (guard espejo en `voto-ficha-row.tsx:160`) |
| Boletín en agenda → ficha proyecto | `app/components/citacion-card.tsx:112`, `app/app/agenda/page.tsx:255`, `app/components/sala-table-section.tsx:94` |
| Resultado de búsqueda → ficha proyecto | `app/components/search-result-card.tsx:50` |
| Directorio → ficha parlamentario | `app/components/parlamentario-directory-row.tsx:32` |
| Ficha parlamentario → `/red?seed=` ("Ver relaciones", NET gate ON en PROD) | `app/app/parlamentario/[id]/page.tsx:146` |
| Home actualidad → fichas proyecto | `app/components/actualidad-module.tsx:137,236` |

### Prohibiciones LOCKED (cualquier "fix" aquí es violación de contrato, no P0)

- `app/components/lobby-en-tramitacion.tsx` — nombre de parlamentario TEXTO PLANO (52-03; yuxtaposición ≠ atribución). **DO NOT TOUCH.**
- Contraparte en lobby del parlamentario → `/contraparte/[id]`: **NOT SHIPPABLE** esta fase (RPC sin `contraparte_id` + doctrina "texto crudo, NUNCA enlazada" + ruta MONEY-gated = 404 garantizado). Se registra como **gated finding** en el informe.

## Breadcrumb Pattern in Next 16 App Router (prescriptivo)

El patrón más simple e idiomático consistente con el repo — y el que el 53-UI-SPEC ya contrata — es un **Server Component presentacional puro con props literales por página**. Cero `usePathname` (Client-only en Next 16 — mismo motivo por el que `HeaderNav` es isla, `header-nav.tsx:8-11`), cero dependencia nueva (NO instalar el bloque breadcrumb de shadcn — sería dependencia conceptual nueva innecesaria para 3 usos literales).

```tsx
// app/components/breadcrumbs.tsx — NUEVO, server puro (sin "use client")
// Contrato completo en 53-UI-SPEC §Component Inventory (markup, clases, aria).
import Link from "next/link";

interface Crumb {
  label: string;
  href?: string; // sin href = segmento actual (texto plano, aria-current)
  mono?: boolean; // ej. "Boletín 14309-04"
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground mb-4">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-x-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-md underline-offset-4 hover:underline hover:text-accent-product focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={item.mono ? "font-mono text-foreground" : "text-foreground"}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

Uso por página (props literales, el crumb NO espera datos — para `/parlamentario/[id]` el nombre viene del fetch que la página ya hace para el header; si el header vive en un Suspense, el crumb con nombre debe renderizarse desde el MISMO server component que ya tiene el dato, o usar el segmento genérico — decisión del planner):

```tsx
// /proyecto/[boletin]/page.tsx — dentro de <main>, ANTES del Suspense del header
<Breadcrumbs items={[
  { label: "Inicio", href: "/" },
  { label: "Proyectos", href: "/buscar" },   // no existe /proyectos; /buscar es la superficie de hallazgo (SPEC)
  { label: `Boletín ${boletin}`, mono: true },
]} />
```

**Ojo con `/parlamentario/[id]`:** el `nombre_normalizado` del segmento actual requiere la fila del RPC. La página ya obtiene la cabecera vía `getParlamentarioPublico` (React.cache dedup, F52) — el breadcrumb puede vivir dentro del componente async de cabecera existente sin costo de RPC extra. Alternativa sin dato: current segment = el id (feo). Recomendación: breadcrumb dentro del header component cacheado.

## Audit Report Structure (esqueleto de `53-UX-AUDIT.md`)

```markdown
# 53-UX-AUDIT — Auditoría UX navegada (PROD, 2026-07-XX)

**Sitio:** https://observatorio-congreso.thevalis.workers.dev (versión desplegada: <id>)
**Mecánica:** BrowserOS MCP (bros-cli), 2 pistas: funcional directa (~772px nativo) + visual iframe (390×844 / 1280×800)
**Límite conocido:** console logs solo en pista funcional (el harness iframe no captura consola cross-origin)

## Resumen ejecutivo
- Hallazgos: N P0 · N P1 · N P2 | P0 corregidos en esta fase: N/N
- Veredicto por journey (1 línea c/u)

## Journey 1 — Visitante aterriza en `/`
| Paso | Ruta | Desktop | Móvil | Console | Hallazgos |
|------|------|---------|-------|---------|-----------|
| 1.1 | / | ux-evidence/j1-01-home-1280.jpg | ux-evidence/j1-01-home-390.jpg | limpio | F-01 |
(… pasos)

## Journey 2 — Proyecto por idea → ficha → "qué pasó, cuándo, según qué fuente"
## Journey 3 — Parlamentario 360 (votos → lobby → patrimonio → red)
## Journey 4 — Navegación transversal (proyecto ↔ parlamentario ↔ agenda ↔ contraparte ↔ home)

## Hallazgos

### F-01 · P0 · <título corto>
- **Dónde:** ruta + viewport(s) | **Evidencia:** ux-evidence/<archivo>
- **Qué pasa / por qué desorienta:** (factual, 2-3 líneas)
- **Criterio:** no-sé-dónde-estoy | no-puedo-llegar-a-X | callejón-sin-salida | affordance-rota | error-consola-grave
- **Fix:** (solo P0 — referencia al contrato UI-SPEC: nav / breadcrumb / continuation-line) → **archivo:línea del fix**
- **Verificación:** ux-evidence/fix-F01-before.jpg → ux-evidence/fix-F01-after.jpg

### F-02 · P1 · … (→ Phase 54, sin fix aquí)
### F-NN · GATED · … (ej. contraparte no enlazable: qué lo desbloquea)

## Matriz de cobertura de journeys
| Journey | Desktop | Móvil | Console (pista A) | Screenshots |
|---------|---------|-------|-------------------|-------------|

## Re-walkthrough (post-redeploy <nueva versión>)
| Fix | Ruta | Before | After | Estado |
```

Convención de nombres de evidencia (committeada en `ux-evidence/`): `j{journey}-{paso}-{slug}-{vp}.jpg` para la pasada de auditoría; `fix-F{NN}-before.jpg` / `fix-F{NN}-after.jpg` para los P0. jpeg q70.

## Architecture Patterns

### System Architecture Diagram (flujo de la fase)

```
[BrowserOS MCP :9200] ←JSON-RPC← [bros-cli.mjs] ←bash← [executor]
        │
        ├─ Pista A (directa): / → /buscar → ficha → … (console+links+snapshot por ruta)
        └─ Pista B (iframe 390/1280): screenshots fullPage → ux-evidence/*.jpg
                    │
                    ▼
            [53-UX-AUDIT.md: hallazgos P0/P1/P2]
                    │ (solo P0, solo dentro del contrato UI-SPEC)
                    ▼
   [fixes: header-nav.tsx +Red · breadcrumbs.tsx nuevo · continuation lines]
                    │
        [suite 541+ verde · tsc -b · lockdown-guard · negative-match]
                    ▼
      [1 redeploy: docker-cf-build.sh → docker cp → wrangler deploy]
                    ▼
      [re-walkthrough Pista B: before/after por fix P0 → informe cerrado]
```

### Pattern 1: Audit-then-fix en un ciclo (sin loop abierto)
**What:** la auditoría produce el universo COMPLETO de hallazgos ANTES de tocar código; los fixes se implementan de una vez; un único re-walkthrough verifica.
**When to use:** siempre en esta fase — el CONTEXT prohíbe el loop abierto.

### Pattern 2: Fix acotado por contrato
**What:** todo P0 debe resolverse con uno de los TRES remedios contratados (ítem de nav / breadcrumb / línea de continuación) o cross-link ya-legal según la matriz del SPEC. Si el remedio natural excede eso → se degrada a P1 por definición.
**Why:** evita que la auditoría infle la fase (regla del CONTEXT: ante la duda → P1).

### Anti-Patterns to Avoid
- **Screenshot sin sleep:** SSR+hidratación tardan; captura en blanco o skeleton = evidencia inválida.
- **Asumir Page ID = 1:** incrementa por sesión; SIEMPRE parsear.
- **Snapshot/click dentro del iframe del harness:** cross-origin, no funciona; interacción solo en Pista A.
- **Fijar el viewport confiando en la ventana oculta:** 772×728 medido HOY puede variar por sesión; el iframe es la única geometría determinista.
- **"Arreglar" el carril lobby×tramitación o la contraparte cruda:** LOCKED; registrar como gated finding.
- **Instalar el bloque Breadcrumb de shadcn o lucide-react para el separador:** cero dependencia nueva; glifos Unicode (`/`, `→`) inline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport móvil | emulación CDP a mano / proxy | harness iframe verificado | El MCP no expone CDP; el iframe ya está probado contra PROD |
| Cliente MCP | fetch propio JSON-RPC/SSE | `scripts/bros-cli.mjs` | Ya maneja SSE vs JSON, corta el ruido "Additional context", gotchas documentados |
| Active-state del nav | lógica nueva | `esActivo` shipped (`header-nav.tsx:34`) | Prefix-match probado; solo se AÑADE el ítem Red al array |
| Detección de rutas activas para breadcrumbs | `usePathname`/middleware | props literales por página | Server-only, cero JS; cada ficha conoce sus crumbs estáticamente |
| Deploy | pipeline nuevo | `docker-cf-build.sh` + wrangler | Patrón operativo probado (build Windows roto — 500ea; SIEMPRE Docker Linux) |

**Key insight:** en esta fase el único territorio técnico nuevo es la mecánica de auditoría — y quedó verificada. El código de fixes es 100% patrones shipped.

## Common Pitfalls

### Pitfall 1: Evidencia móvil con viewport falso
**What goes wrong:** capturar "móvil" en la página oculta nativa (772px) — renderiza layout sm/md, no el de 390px.
**Why it happens:** el viewport oculto parece "suficientemente chico".
**How to avoid:** TODO screenshot de evidencia sale del harness iframe (390 o 1280 exactos).
**Warning signs:** nav en una sola fila en un screenshot etiquetado 390px (a 390px el nav real envuelve a 2 filas — verificado hoy).

### Pitfall 2: Console log del harness atribuido al sitio
**What goes wrong:** reportar "Blocked autofocusing … cross-origin subframe" como hallazgo.
**How to avoid:** los hallazgos de consola salen SOLO de la Pista A (navegación directa); baseline verificado: `/red` = 0 entradas.

### Pitfall 3: CDP timeout tratado como fallo del harness
**What goes wrong:** primer `save_screenshot` tras una carga pesada falla con `CDP request timeout` y el executor abandona.
**How to avoid:** retry-once tras `sleep 3` — reproducido y resuelto así HOY.

### Pitfall 4: Romper los asserts RTL de empty states
**What goes wrong:** la línea de continuación cambia el texto del párrafo honesto shipped y revienta `getByText` exactos (ej. `actualidad-module.test.tsx:136`).
**How to avoid:** la línea nueva es un `<p>` HERMANO (`mt-2`), el shipped queda byte-idéntico; cada línea nueva gana su propio assert.

### Pitfall 5: El comentario LOCKED de NAV_ITEMS
**What goes wrong:** editar `NAV_ITEMS` dejando el comentario `// LOCKED (UI-SPEC §11.0)` apuntando al contrato viejo — confunde a fases futuras.
**How to avoid:** actualizar el comentario a la referencia del 53-UI-SPEC (re-open autorizado).

### Pitfall 6: `/contraparte` 404 clasificado como P0
**What goes wrong:** el journey 4 toca `/contraparte/[id]` y da 404 → "callejón sin salida".
**Why it happens:** MONEY gate OFF por diseño (fail-closed, firma legal pendiente).
**How to avoid:** documentar como **gated** en el informe; el breadcrumb de contraparte se implementa igual (invisible hoy, future-proof) y NINGÚN link ciudadano debe apuntar a la ruta gated (eso SÍ sería P0: link que renderiza 404).

### Pitfall 7: Evidencia pesada en git
**What goes wrong:** fullPage PNG de fichas largas (varios MB c/u) × ~40 screenshots infla el repo.
**How to avoid:** jpeg quality 70 (verificado legible); fullPage solo donde el hallazgo lo requiera, viewport-shot para lo demás.

## Code Examples

### Extensión de NAV_ITEMS (único código cliente tocado)
```tsx
// app/components/header-nav.tsx — contrato 53-UI-SPEC §(a)
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/buscar", label: "Buscar" },
  { href: "/parlamentarios", label: "Parlamentarios" },
  { href: "/agenda", label: "Agenda" },
  { href: "/red", label: "Red" },       // NUEVO — ruta LIVE desde 2026-07-02
  { href: "/sobre", label: "Sobre" },   // acortado para que 5 ítems quepan a 390px
];
```

### Línea de continuación (patrón por empty state)
```tsx
{/* SPEC §(c): párrafo hermano, shipped intacto arriba; 1 solo link petróleo */}
<p className="text-sm mt-2">
  Puedes{" "}
  <Link href="/buscar" className="text-accent-product underline underline-offset-2">
    buscar un proyecto de ley por su idea <span aria-hidden="true">→</span>
  </Link>
  .
</p>
```

### Journey loop completo (referencia ejecutable — ver §BrowserOS Audit Mechanics para el detalle)
```bash
BASE="https://observatorio-congreso.thevalis.workers.dev"
OUT=$(node scripts/bros-cli.mjs open "$BASE/"); PID=$(echo "$OUT" | grep -oE "Page ID: [0-9]+" | grep -oE "[0-9]+")
for ruta in "" "buscar" "buscar?q=proteccion%20de%20datos" "proyecto/14309-04" "parlamentarios" "parlamentario/D1012" "red?seed=D1012" "agenda"; do
  sleep 3
  node scripts/bros-cli.mjs call navigate_page "{\"page\":$PID,\"action\":\"url\",\"url\":\"$BASE/$ruta\"}"
  sleep 5
  node scripts/bros-cli.mjs call get_console_logs "{\"page\":$PID,\"level\":\"warning\",\"clear\":true}"
  node scripts/bros-cli.mjs links $PID
done
node scripts/bros-cli.mjs close $PID
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auditoría UX por lectura de código/RTL | Navegación real de PROD con BrowserOS MCP | F53 (BrowserOS verificado en host 2026-07-07) | Evidencia visual real, console logs reales, datos reales |
| "Sobre / Metodología" (label doble) | "Sobre" (Metodología vía footer + /sobre) | 53-UI-SPEC | 5 ítems caben en 390px |
| Nav de 4 ítems sin Red | 5 ítems con Red | 53-UI-SPEC (re-open autorizado de §11.0) | `/red` LIVE deja de ser huérfana del header |

**Deprecated/outdated:** nada que retirar; los fixes son aditivos.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `[ASSUMED]` wrangler OAuth sigue autenticado (último deploy exitoso 2026-07-02, versión ee6b7544/3ade68b8) | Environment | El redeploy final se bloquea → checkpoint operador para `wrangler login` |
| A2 | `[ASSUMED]` el viewport de la página oculta (772×728 medido hoy) varía por sesión/monitor | Mechanics | Ninguno si se sigue el protocolo (el harness iframe no depende de él) |
| A3 | `[ASSUMED]` errores de consola móvil-only son improbables (mismo bundle JS que desktop) | Mechanics | Un P0 de consola móvil pasaría inadvertido; límite documentado en el informe |
| A4 | `[ASSUMED]` PROD seguirá sin X-Frame-Options/CSP frame-ancestors durante la fase (medido hoy: framing permitido) | Mechanics | El harness muere; fallback = auditar visual en viewport nativo + curl; y el redeploy de esta fase NO debe añadir esos headers |
| A5 | `[ASSUMED]` los datos de journeys (14309-04, D1012, agenda semana en curso) siguen poblados el día de la auditoría | Journeys | Elegir otro boletín/ID desde el directorio/home en el momento — no bloquea |

## Open Questions (RESOLVED)

1. **Overlap de copy en `/buscar`:** el shipped ya dice "Prueba con otras palabras, o ingresa un número de boletín." (`buscar/page.tsx:85-86`) y la línea del SPEC empieza "Prueba con otras palabras, o revisa…" — aplicarla verbatim duplicaría la frase.
   - What we know: el SPEC exige shipped VERBATIM + línea nueva; también dice "the executor may vary placeholders, never register or meaning".
   - Recommendation: línea de continuación para /buscar = `También puedes revisar [la agenda legislativa de la semana →](/agenda).` — conserva registro y significado, evita el eco. Cae en Claude's Discretion (redacción de microcopy); dejar constancia en el informe para el ui-review.
2. **Breadcrumb de `/parlamentario/[id]` con nombre:** ¿dentro del header component cacheado (tiene el nombre) o fuera del Suspense (sin nombre)?
   - Recommendation: dentro del server component de cabecera que ya llama `getParlamentarioPublico` (React.cache, F52) — cero RPC extra, nombre disponible. El planner fija el punto exacto.
3. **¿La auditoría puede producir P0 sin remedio contratado?** (ej. affordance rota en un chart)
   - Recommendation: si el remedio excede nav/breadcrumb/continuation/cross-link-legal → P1 por definición del SPEC, aunque el dolor sea alto; anotarlo como "P1 alto" para que F54 lo priorice.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| BrowserOS MCP `127.0.0.1:9200/mcp` | auditoría navegada | ✓ (verificado hoy: tools/list + journeys + screenshots) | — | curl + RTL (deuda de evidencia visual, ROADMAP lo autoriza) |
| `scripts/bros-cli.mjs` | wrapper | ✓ | repo | — |
| Node | bros-cli, build | ✓ | 22.21.1 | — |
| pnpm | suite/tsc | ✓ | 11.3.0 | — |
| Docker daemon | redeploy (build Linux) | ✓ (server 29.5.2 respondiendo) | 29.5.2 | Start-Process Docker Desktop si se cae |
| wrangler (OAuth) | redeploy | `[ASSUMED]` A1 | vía npx en app/ | checkpoint operador (login) |
| PROD workers.dev | objeto de auditoría | ✓ (7 requests exitosos hoy; /red console limpia) | versión ee6b7544 | — |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** BrowserOS (fallback curl+RTL, degrada la evidencia); wrangler OAuth (checkpoint operador).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (`app/vitest.config.ts`) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --dir app exec vitest run components/header-nav.test.tsx` (o el archivo tocado) |
| Full suite command | `pnpm --dir app test -- --run` (541 tests hoy) + `pnpm --dir app exec tsc -b` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 nav | NAV_ITEMS = 5 ítems (incl. Red), label "Sobre", active-state intacto | unit RTL | `pnpm --dir app exec vitest run components/header-nav.test.tsx` | ❌ Wave 0 (no existe test del HeaderNav) |
| UX-01 breadcrumbs | Breadcrumbs render (links, aria-current, mono, sin heading) | unit RTL | `pnpm --dir app exec vitest run components/breadcrumbs.test.tsx` | ❌ Wave 0 (componente nuevo) |
| UX-01 fichas | páginas renderizan breadcrumb con crumbs correctos | unit RTL (page tests existentes) | `pnpm --dir app exec vitest run app/parlamentario` | ✅ extender page.test.tsx existentes |
| UX-01 continuation | shipped empty-copy byte-idéntico + línea nueva con 1 link | unit RTL | vitest run de cada componente tocado | ✅ extender tests existentes (votos/lobby/red-graph/agenda) |
| UX-01 anti-insinuación | negative-match banned-vocab sobre strings nuevos | unit (sweep existente) | full suite | ✅ |
| UX-01 no-regresión | lockdown-guard, tsc, suite completa | integración | `pnpm --dir app test -- --run` + `tsc -b` | ✅ |
| UX-01 journeys/evidencia | ≥4 journeys × 2 viewports con screenshots; before/after por P0 | **manual-only** (BrowserOS contra PROD) | protocolo §Mechanics; verificable por presencia de archivos en `ux-evidence/` + tablas del informe | — (naturaleza de auditoría en vivo) |

### Sampling Rate
- **Per task commit:** vitest run del archivo tocado + `tsc -b` si cambió un tipo
- **Per wave merge:** `pnpm --dir app test -- --run`
- **Phase gate:** full suite verde + tsc limpio ANTES del redeploy; re-walkthrough DESPUÉS del redeploy

### Wave 0 Gaps
- [ ] `app/components/header-nav.test.tsx` — 5 ítems, hrefs, label "Sobre", active por prefix
- [ ] `app/components/breadcrumbs.test.tsx` — links/current/aria/mono
- (las líneas de continuación se asertan en los test files existentes de cada componente — no son gap de Wave 0 porque dependen de qué superficies marque la auditoría)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | sitio público read-only; no se toca auth |
| V3 Session Management | no | — |
| V4 Access Control | sí (no regresión) | gates existentes intactos: MONEY/cruces/admin fail-closed; el breadcrumb de contraparte va DESPUÉS del `notFound()` del gate |
| V5 Input Validation | sí (mínima) | props de Breadcrumbs son literales de página (no user input); `/red?seed=` ya valida `PARLAMENTARIO_ID_RE` (shipped); ninguna query nueva |
| V6 Cryptography | no | — |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Filtración PII en chrome nuevo | Information Disclosure | Breadcrumbs/nav renderizan SOLO labels de ruta + nombres públicos shipped; lockdown-guard sigue en la suite |
| Link a superficie gated (fuga de existencia + dead end) | Information Disclosure / DoS UX | Matriz de legalidad del SPEC: link que puede renderizar 404 en PROD = prohibido |
| Screenshots con datos sensibles committeados | Information Disclosure | Solo se navega el sitio PÚBLICO (sin /admin en journeys); la evidencia es lo que cualquier visitante ve |
| Evidencia/console con secrets | Information Disclosure | El MCP es local sin auth; bros-cli no recibe env; console de PROD no emite keys (verificado hoy: /red limpia) |

## Sources

### Primary (HIGH confidence — medido en esta sesión)
- BrowserOS MCP `http://127.0.0.1:9200/mcp` — `tools/list` completo; schemas de `create_hidden_window`, `new_hidden_page`, `create_window`, `save_screenshot`, `take_screenshot`, `get_console_logs`, `evaluate_script`, `navigate_page`, `take_snapshot`, `get_page_links`; probes en vivo: viewport oculto 772×728/dpr1.25, `resizeTo` no-op, harness iframe 390/1280 renderizando PROD, fullPage más ancho que el viewport, iframe alto captura página completa, consola de iframe no capturada, CDP timeout + retry, `/red` console limpia.
- Codebase (file:line citados en §Navigation Inventory): `header-nav.tsx`, `layout.tsx`, páginas y componentes de empty states y cross-links.
- `53-CONTEXT.md`, `53-UI-SPEC.md` (approved), `ROADMAP.md:1243-1259`, `scripts/bros-cli.mjs` (gotchas header).

### Secondary (MEDIUM confidence)
- Memoria de proyecto: deploy 2026-07-02 (`3ade68b8`), gotcha force-dynamic, /red 305 aristas seed D1012, docker build Linux obligatorio.

### Tertiary (LOW confidence)
- Ninguna (no se necesitó WebSearch; cero paquetes nuevos, mecánica verificada localmente).

## Metadata

**Confidence breakdown:**
- BrowserOS audit mechanics: HIGH — cada afirmación medida en vivo hoy contra el MCP y PROD
- Navigation inventory: HIGH — verificado por grep/read con file:line
- Breadcrumb pattern: HIGH — contrato ya aprobado en UI-SPEC + patrones shipped idénticos en el repo
- Redeploy: MEDIUM — patrón probado, pero OAuth de wrangler es asunción (A1)

**Research date:** 2026-07-07
**Valid until:** 2026-07-21 (la geometría del viewport oculto y la versión de PROD pueden cambiar; re-medir el viewport nativo al iniciar la ejecución)
