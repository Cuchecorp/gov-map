# Phase 53: UXNAV — Auditoría UX navegada (BrowserOS) + fixes de orientación - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Auditar la UX del sitio EN VIVO (https://observatorio-congreso.thevalis.workers.dev) navegándolo con un navegador real (BrowserOS vía `scripts/bros-cli.mjs`, páginas OCULTAS), producir `53-UX-AUDIT.md` con hallazgos P0/P1/P2 con evidencia visual, y corregir TODOS los P0 de orientación/navegación en el mismo ciclo. Motivación del operador (2026-07-07): "está difícil de maniobrar"; el sitio se mostrará a un centro de estudios. Los P1 se difieren a la Phase 54 (pulido demo). CERO DDL, CERO flags.

Journeys mínimos (desktop 1280×800 + móvil 390×844 cada uno):
1. Visitante aterriza en `/` → entiende qué es el sitio y qué puede hacer.
2. Ciudadano busca un proyecto por idea → ficha → "qué pasó, cuándo, según qué fuente".
3. Periodista investiga un parlamentario 360 (votos → lobby → patrimonio → red).
4. Navegación transversal: ficha proyecto ↔ ficha parlamentario ↔ agenda ↔ contraparte ↔ home.

</domain>

<decisions>
## Implementation Decisions

### Forma de la navegación global (los fixes P0 esperados)
- Header global: mantener el patrón actual (logo + links, cero JS nuevo) pero con **estado activo visible** (la sección actual marcada); considerar orden por journey: Buscar · Parlamentarios · Agenda · Red · Sobre. `/red` hoy NO está en el header — evaluar añadirlo (está LIVE desde 2026-07-02).
- Fichas (proyecto/parlamentario/contraparte): **breadcrumb ligero** ("Inicio / Proyectos / {id}") arriba del título. Sin JS.
- Cross-links SOLO donde ya es legal: nombre de parlamentario en listas de votos → su ficha; contraparte en el lobby del parlamentario → ficha contraparte; boletín en agenda → ficha proyecto. **PROHIBIDO** enlazar el nombre en el carril lobby×tramitación de la ficha de proyecto (texto plano LOCKED, decisión 52-03/UI-SPEC — contexto de yuxtaposición, no atribución).
- Estados vacíos honestos ganan 1 línea de continuación orientadora ("Prueba buscar por idea →" / link a una sección con datos), sin fabricar virtud ("limpio/transparente" PROHIBIDO).

### Alcance de los fixes
- P0 (se arregla en esta fase) = SOLO orientación/navegación/bloqueo: "no sé dónde estoy", "no puedo llegar a X", callejón sin salida, affordance rota, error de consola grave. Rediseños visuales/jerarquía = P1/P2 → quedan en el informe para F54.
- 1 ciclo: auditoría completa → fixes de todos los P0 → 1 re-walkthrough de verificación con screenshots before/after. Sin loop abierto.
- **1 redeploy al final de la fase** (patrón docker-cf-build.sh + wrangler local, autorizado por el operador 2026-07-06); el re-walkthrough verifica contra el PROD re-desplegado.
- Móvil first-class: los P0 móviles cuentan igual que desktop.

### Evidencia y mecánica
- Se audita PROD (workers.dev) — lo que verá el centro de estudios, con datos reales.
- Viewports: desktop 1280×800 y móvil 390×844. Ventanas/páginas OCULTAS de BrowserOS (no interferir con el navegador del operador). Para viewport móvil: usar `create_hidden_window` con bounds o `evaluate_script`/emulación según lo que soporte la API — el executor consulta `node scripts/bros-cli.mjs schema <tool>`.
- Evidencia commiteada en `.planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/` (screenshots numerados por journey; before/after para cada fix P0).
- `get_console_logs` por página del journey; error de consola = hallazgo automático (P0 si rompe función, P1 si es ruido).

### Claude's Discretion
- Redacción exacta de breadcrumbs/labels y microcopy de vacíos (factual, es-CL, sin promesas).
- Clasificación P0/P1/P2 de cada hallazgo (criterio arriba); ante la duda entre P0/P1 → P1 (la fase no debe crecer).
- Mecánica exacta del viewport móvil en BrowserOS (lo que la API soporte).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/bros-cli.mjs` — wrapper JSON-RPC del MCP BrowserOS (host `http://127.0.0.1:9200/mcp`), smoke-tested 2026-07-07. Gotchas documentados en su cabecera: page ID incrementa (parsear "Page ID: N"), screenshot con retry-once (CDP timeout transitorio), sleep 4-5s post-open, `{page, path}` (no pageId/filePath).
- Header actual: `app/components/` (layout con nav — ver `app/app/layout.tsx`).
- Patrón empty-state honesto: en todos los componentes de F51/F52 (p.ej. `actualidad-module.tsx`, `lobby-en-tramitacion.tsx`).
- Deploy: `docker-cf-build.sh` (build Linux node:22 vía Docker Desktop — arrancarlo con Start-Process si no corre) + `docker cp` + `cd app && npx wrangler deploy` (OAuth ya autenticado). Última versión desplegada: `ee6b7544`.

### Established Patterns
- Design system: tokens Tailwind v4 (`text-accent-product`, NUNCA `text-[--accent-product]`), Mono para cifras, weights 400/600, `min-h-11` en targets táctiles, frontera de carril `mt-12` LOCKED.
- Anti-insinuación: negative-match de vocabulario causal en tests; caveat 1×/sección; conteo neutro.
- Server Components por defecto; JS cliente solo donde ya existe (acordeones Radix, charts Recharts).
- Suite: `pnpm --dir app test -- --run` (541 tests) + `pnpm --dir app exec tsc -b` desde repo root; lockdown-guard escanea `.from()` PII y `.rpc` no-allowlisted.

### Integration Points
- `app/app/layout.tsx` (header/nav global), `app/app/*/page.tsx` (fichas y listas), componentes de sección en `app/components/`.
- El sitio lee con service_role vía `createServerSupabase()` — los fixes de navegación NO tocan la capa de datos.

</code_context>

<specifics>
## Specific Ideas

- El operador describió el problema como "está difícil de maniobrar" — el foco es ORIENTACIÓN (dónde estoy, a dónde puedo ir), no estética.
- El demo es para un centro de estudios: los journeys 2 y 3 (proyecto por idea; parlamentario 360) son los que se van a demostrar en vivo.
- La evidencia visual (before/after) es parte del entregable: sirve para mostrar el trabajo al centro de estudios.

</specifics>

<deferred>
## Deferred Ideas

- Nombres presentables (Title Case), home con rutas de entrada guiadas, microcopy "cómo leer esto" → Phase 54 (UXDEMO).
- Cualquier hallazgo P1/P2 del informe → Phase 54 o backlog.

</deferred>
