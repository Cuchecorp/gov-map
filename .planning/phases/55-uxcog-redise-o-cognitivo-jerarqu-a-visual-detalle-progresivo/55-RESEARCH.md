# Phase 55: UXCOG — Rediseño cognitivo (jerarquía visual + detalle progresivo) - Research

**Researched:** 2026-07-07
**Domain:** Next.js 16 App Router / React 19.2 Server Components — information-architecture refactor of existing citizen surfaces (NO external APIs, NO DDL, NO new deps)
**Confidence:** HIGH (codebase read directly; every target file + section component + token + guard inspected)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Patrón ganador ELEGIDO POR EL OPERADOR: sketch 001 variante B "Informe con rail"** (`.planning/sketches/001-ficha-parlamentario-cognitiva/index.html`, commit f5c078b). El resto delegado a autónomo.
- **Rail izquierdo sticky (~208px/`w-52`)**: chip cámara, nombre `<h1>`, período, badge frescura compacto, nav local con conteos por sección (Votaciones 141 / Lobby 107 / Patrimonio 10 / **Cruces ◆ 12** / Financiamiento —), scrollspy (fondo petróleo suave + borde izquierdo petróleo), caveat anti-causal 1× en el rail.
- **Cada sección SIEMPRE visible pero SOLO su capa-1**: números grandes Mono (b-facts), 1 visual (stacked bar votos / barras horizontales lobby / mini-columnas patrimonio), botón "Ver detalle (N)" que expande el detalle INLINE (no navega, no modal). **Detalle colapsado por defecto.**
- **Cruces destacados**: borde petróleo 1.5px, título petróleo, chips "sector · N reuniones · M votos", botón primario "Explorar los N cruces". Único énfasis de color de producto.
- **Financiamiento pendiente**: sección atenuada (`opacity-60`), presente en rail con "—".
- **Móvil**: rail colapsa a barra superior compacta (mecánica a discreción del planner, sin perder conteos).
- **Ficha parlamentario** (28.048px→~5.000px default, cero dato perdido); listas completas (141/107/10/12) truncadas al expandir (~5–10 filas + "ver las N", carga incremental client-side de datos YA fetched, SIN RPC nueva).
- **Ficha proyecto** (10.391px): mismo rail (Dónde está / Tramitación / Votaciones / Lobby del período / Idea matriz / Similares). Capa-1 Tramitación = **stepper de etapas** + hitos clave visibles; trámites repetitivos de urgencia AGRUPADOS en 1 línea con conteo ("42 trámites de urgencia · ver todos") — agrupación presentacional, solo lo inequívoco.
- **Carril lobby×tramitación** (proyecto): capa-1 (conteo + semana) + detalle inline; nombre texto plano no-enlazado LOCKED (52-03).
- **Agenda** (11.606px): agrupar día → comisión, bloques colapsables por día, cross-links a boletín intactos.
- **/red**: vista inicial = ego-network del seed (centrar/zoom al vecindario, no fitView global de 136); solo props de @xyflow/react ya disponibles.
- **Home y /buscar NO se tocan; hero LOCKED. Estética Phase 19 LOCKED (crema+petróleo+civic).**
- **Reglas transversales**: capa-1 preatentiva (≤7 unidades por sección colapsada, color solo semántico, petróleo SOLO cruces/acción); 1 línea principal + 1 línea meta Mono por fila; fuente/fecha/enlace NUNCA desaparecen; disclosure con Radix (Collapsible/Accordion F45); scrollspy con IntersectionObserver (cero deps); anti-insinuación intacta (banned-vocab, caveat 1×, conteos neutros).
- **CERO DDL, cero flags, cero deps nuevas.**

### Claude's Discretion
- Mecánica exacta del truncado (5 vs 10 filas iniciales) y de "ver las N" (expandir todo vs paginar).
- Compactación móvil del rail.
- Qué hitos de tramitación cuentan como "clave" (mínimo: ingreso, cambios de etapa, informes de comisión, votaciones, urgencia vigente).
- Microcopy de las notas de uso (factual, es-CL).

### Deferred Ideas (OUT OF SCOPE)
- Sketch 002/003 como mockups separados — resueltos aplicando patrón B.
- Charts nuevos de votos (F47) y comparativo de ausencias (F49) — fases siguientes.
- Cruces en ficha de proyecto (F38) — hereda el patrón drill-down.
- Restauración de tildes por diccionario (milestone futuro).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-03 | Legibilidad cognitiva: jerarquía visual + detalle progresivo (overview→details-on-demand) sobre las superficies ciudadanas, sin perder ningún dato | Rail sticky + scrollspy (IntersectionObserver), capa-1 siempre visible + detalle colapsado (Radix Collapsible sobre datos ya fetched). Todos los datos ya llegan al server render; el trabajo es reordenar/colapsar, no re-fetchear. Ver Architecture Patterns §Rail, §Three-layer disclosure. |
| UX-01 (extiende) | "¿Dónde está hoy?" / breadcrumb ligero ya entregados (F53) | `EstadoActualBlock` existente se ELEVA a capa-1 de Tramitación (stepper). No re-implementar la derivación (`derivarEstadoActual`, `urgenciaVigente`, `citacionVigente` ya existen). |
| UX-02 (extiende) | Acordeones Radix + resumen 3-estado (F45) | `CarrilAccordion` + `ParlamentarioResumen`/`construirChips` existentes son la base; el rail GENERALIZA el resumen. La heurística F45 `abrePorDefecto` (auto-open carriles con datos) se INVIERTE: los detalles arrancan colapsados (UI-SPEC §Progressive-Disclosure). |
</phase_requirements>

## Summary

This is a **pure information-architecture refactor** of four already-working, fully server-rendered surfaces. Every datum the phase needs is **already fetched server-side** through existing RPCs and rendered into the HTML; nothing lazy-loads and no new query is introduced. The work is (1) add a sticky left **rail** with a local nav + honest per-section counts + IntersectionObserver **scrollspy**, (2) surface a preattentive **capa-1** (big Mono figures + one CSS mini-visual) per section that is always visible, (3) collapse the existing section bodies (the row lists) into a **client-side "Ver detalle (N)" disclosure** that keeps the SSR content in the DOM (the F45 `forceMount` pattern), and (4) elevate `EstadoActualBlock` into a Tramitación stepper while reusing the **already-existing urgencia-grouping logic** in `timeline-view.tsx`.

The single most important structural nuance: the F45 `CarrilAccordion` collapses the **entire** section body (including what would now be capa-1). The new pattern **inverts** this — capa-1 must render **outside** any collapsible, and only the detail (rows/lists) collapses. So `CarrilAccordion` is reused *conceptually* but the sections need a **new thin disclosure island** wrapping only the detail. The Component Inventory in 55-UI-SPEC already anticipates this ("Disclosure/truncation control — NEW thin client island").

**Primary recommendation:** Build one reusable client island `SeccionRail`-aware `<DetalleColapsable>` (Radix Collapsible = Accordion `type="single" collapsible`, `forceMount`, receives the existing `*Section` server component as `children`), a `<FichaRail>` client island (sticky `<aside>` + IntersectionObserver scrollspy hook), and per-section server-computed capa-1 summaries derived from the RPC rows **already read** by `parlamentario-resumen-conteos.ts`. Do NOT touch the RPCs, the gates, or the anti-insinuación invariants. For /red, pass `seedId` into `RedGraph` and frame it with `fitViewOptions.nodes` (the API exists in the installed version) — the RPC `subgrafo_red` is *already* seed-scoped (depth=1), so the ego-network is mostly a client framing/marker change.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rail sticky + local nav + counts | Frontend Server (SSR) renders structure | Browser/Client (scrollspy) | Counts come from `contarCarrilesSeguro` (server, allowlisted RPCs); scrollspy (current-section highlight) is a client concern (IntersectionObserver) — a thin island. |
| Scrollspy (current section) | Browser/Client | — | Requires DOM scroll position; must be `"use client"`. Zero deps (native IntersectionObserver). |
| Capa-1 summaries (figures + mini-visual) | Frontend Server (SSR) | — | Derived from RPC rows already fetched server-side; CSS-only visuals, no chart lib, always in DOM (preattentive, SSR). |
| Detail disclosure ("Ver detalle N") | Browser/Client (toggle) | Frontend Server (renders detail as children) | Toggle is client; the detail content is a server component passed as `children` (F45 no-leak contract — service_role never reaches browser). |
| Row data (141 votos / 107 lobby / 10 patrimonio / 12 cruces) | API/Backend (existing RPCs) | — | Already fetched by `VotosSection`/`LobbySection`/etc. NO new RPC, NO lazy-fetch. |
| Tramitación stepper + urgencia grouping | Frontend Server (SSR) | — | Presentational grouping over `tramitacion_evento.tipo`/`descripcion` already classified; grouping logic ALREADY exists in `timeline-view.tsx`. |
| /red ego-network framing | Browser/Client (@xyflow island) | API (seed-scoped RPC) | RPC `subgrafo_red(p_id, p_depth=1)` already returns the ego subgraph; framing/marker is client-only via `fitViewOptions.nodes`. |

## Standard Stack

**No new libraries.** Everything is already installed and in use.

### Core (all present)
| Library | Version | Purpose | Why Standard (here) |
|---------|---------|---------|--------------|
| Next.js | 16.2.9 | App Router, Server Components, `<Suspense>` streaming | Already the app runtime. `params`/`searchParams` are Promises. |
| React | 19.2.4 | Server Components + thin client islands | Already in use; `cache()` dedups server reads. |
| `@radix-ui/react-accordion` | 1.2.14 | Disclosure primitive (Accordion AND Collapsible) | Installed F45. Collapsible = Accordion `type="single" collapsible`. `forceMount` keeps SSR content in DOM. |
| `@xyflow/react` | 12.11.0 | /red graph island | Installed; `fitViewOptions.nodes` supported (see Code Examples). |
| Recharts | 3.9.0 | Patrimonio chart (F46) | Lives INSIDE the patrimonio detail; not touched for capa-1 (capa-1 = CSS mini-columns). |
| Tailwind v4 | (installed) | Styling on Phase-19 tokens | `@theme inline` token registration (see Pitfalls). |
| IntersectionObserver | native | Scrollspy | Zero deps, browser-native. |

### `## AGENTS.md` HARD CONSTRAINT
`app/AGENTS.md` states: **"This is NOT the Next.js you know … Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."** Any task touching routing/Server-Component/`searchParams` behavior MUST consult `node_modules/next/dist/docs/` first. This is a CLAUDE.md-authority directive for this repo.

**No installation. No `npm install`.** (If any task proposes one, it violates a locked decision — reject it.)

## Package Legitimacy Audit

**Not applicable — this phase installs ZERO external packages.** Every primitive (Radix Accordion, @xyflow/react, Recharts) is already in `app/package.json` and already imported in shipped code. No registry fetch, no `npm install`, no shadcn `add`. slopcheck/registry verification is moot.

## Current Structure of Target Files (verified by direct read)

### `app/app/parlamentario/[id]/page.tsx` (568 lines) — PRIMARY DELIVERABLE
- **Server component.** `params`/`searchParams` are `Promise`; `id` validated against `PARLAMENTARIO_ID_RE` before any DB touch.
- Container: `<main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">` → **must widen to `max-w-5xl`** for the rail (UI-SPEC; note the GlobalHeader is already `max-w-5xl`).
- Composition today: `HeaderSection` (Suspense) → `ParlamentarioResumen` (the above-fold chip index, Suspense) → optional `/red` link (netPublicEnabled) → `CarrilesSection` (Suspense).
- `CarrilesSection` renders each carril as **its own `<section id className="mt-12">` sibling**, each wrapping a `CarrilAccordion` whose `<h2>` header is always visible and whose **entire body** collapses. Order LOCKED: `#votos` → `#lobby` → `#patrimonio` → `#cruces` (gated) → `#dinero`/`#financiamiento` (money gated) → `#financiamiento-pendiente` (money OFF).
- Data reads: `getParlamentarioPublico(id)` = `React.cache`-deduped RPC `parlamentario_publico` (header/cámara/período). Each section fetches its own RPC inside its own `<Suspense>`.
- Counts: `contarCarrilesSeguro(id)` → 3-state honest per carril + `asistencia`. `abrePorDefecto(estado)` currently auto-opens carriles with `tipo === "dato"` — **this heuristic must be REMOVED/inverted** (details start closed for the ~5.000px target).
- **F45 client/server boundary (LOCKED):** `CarrilAccordion` NEVER imports a domain section or the server Supabase client; sections are passed as `children` from the server page. Preserve this for every new island.

### `app/app/proyecto/[boletin]/page.tsx` (395 lines)
- **Server component.** `boletin` validated against `BOLETIN_RE`. `?urgencias=<id>` normalized server-side.
- Composition: `Breadcrumbs` (server, F53) → `FichaSection` (header, Suspense) → `EstadoActualBlock` ("¿Dónde está hoy?", Suspense) → `#timeline` (`TimelineSection`→`TimelineView`) → `#votaciones` (`VotacionCard[]`) → `#lobby-tramitacion` (`LobbyEnTramitacionSection`) → `#idea-matriz` → `#cuerpos-legales` → `#similares`. All `<section className="mt-12">` siblings with **plain `<h2>`** (NOT accordions — the proyecto page has no disclosure today).
- `leerFicha(boletin)` = `React.cache`-deduped `proyecto_ficha` read (idea matriz / cuerpos legales, reused by votaciones for the "Qué se votó" line).
- Sections rail-target (UI-SPEC): Dónde está / Tramitación / Votaciones / Lobby del período / Idea matriz / Similares.

### `app/app/agenda/page.tsx` (563 lines)
- **Server component.** `?semana` (ISO week) + `?q`/`?camara` search. Search mode groups results **by comisión** already (`<h3>` per comisión). Week mode: `CitacionesSection` already groups **by day** (`<h3>` per día via `capitalizarPrimera(diaFmt…)`) + `SalaTableServer` (Senado/Cámara). The día→comisión grouping the phase wants is a **deeper sub-grouping inside each day**, plus collapsible day blocks. The day-grouping scaffolding already exists (`grupos` Map keyed by `fecha.slice(0,10)`).

### `app/components/red/red-graph.tsx` (314 lines) + `app/app/red/page.tsx` (165 lines)
- `red/page.tsx` is a server component with `export const dynamic = "force-dynamic"` (load-bearing — see STATE gotcha). Gate `netPublicEnabled` is the FIRST statement. **`subgrafo_red(p_id: seed, p_depth: 1)` already returns the seed's ego neighborhood** — there is NO seedless global-graph path (no seed → renders a `<select>` seed picker). So "ego-network initial view" ≈ frame + mark the seed inside the already-ego subgraph.
- `RedGraph` is `"use client"`, receives `subgrafo` JSON, builds a **deterministic per-cámara grid layout** (never a physics sim — anti-insinuación LOCKED), renders `<ReactFlow fitView fitViewOptions={{padding:0.05}} minZoom={0.2} … />`. It does **not currently know which node is the seed** — that prop must be threaded from the page.

### Section components (the capa-2 detail; all reused as `children`)
| Component | File | Server/client | Data shape / long-list rendering |
|-----------|------|---------------|----------------------------------|
| `VotosSection` / `VotosView` | `votos-por-parlamentario.tsx` (942 ln) | Server fetch + PURE view | RPC `votos_de_parlamentario(p_id, p_limit:1000)` → ALL rows client-visible; grouped by proyecto (arcos); `?votosVer` expands an arco; `?votosPage`/`?materia` facets; `rebeldias_de_parlamentario`. Capa-1 figures (72/66/2/1 + asistencia + stacked bar) are ALREADY computed here (`conteos`, `VotosView` "Cómo votó"). |
| `LobbySection` / `LobbyView` | `lobby-de-parlamentario.tsx` (625 ln) | Server fetch + PURE view | RPC `lobby_de_parlamentario` (all rows, left-join grouped to audiencias); `?vista=cronologica` toggle; `?lobbyPage`. Grouped-by-contraparte (freq DESC) is the default. Contraparte name PLAIN, never linked. |
| `PatrimonioSection` | `patrimonio-de-parlamentario.tsx` | Server fetch + PURE view | RPC `declaraciones_de_parlamentario`; Recharts chart lives here (F46, in detail). NEVER montos. |
| `CrucesSection` / `CrucesView` | `cruces-de-parlamentario.tsx` (196 ln) | Server fetch + PURE view | RPC `cruces_de_parlamentario` (gated); rows = (sector, tipo_senal) + `evidencia.items[]`. Petróleo-framed section. |
| `TimelineView` | `timeline-view.tsx` (272 ln) | PURE view | **Urgencia grouping ALREADY implemented**: `esEventoUrgencia`, `esRetiroUrgencia`, `tipoUrgenciaKey`, `construirItems`, `paresDeUrgencia`. Collapses contiguous same-type urgencia runs (≥2) into one line "ver todas" via `?urgencias=<id>`. |
| `EstadoActualBlock` | `estado-actual-block.tsx` (300 ln) | Server fetch + PURE view | "¿Dónde está hoy?" — derives etapa/estado + último hito + urgencia vigente + citación vigente. The stepper capa-1 elevates THIS. |
| `LobbyEnTramitacionSection` | `lobby-en-tramitacion.tsx` (277 ln) | Server fetch + PURE view | RPC `lobby_en_tramitacion(p_boletin)`; grouped by ISO week; nombre PLAIN (52-03); 3-path honest degrade (PGRST202→null). |

### Shared/reusable assets (verified present)
- `contarCarrilesSeguro` / `contarCarriles` (`lib/parlamentario-resumen-conteos.ts`, `server-only`, `cache()`): reads the SAME RPC rows a capa-1 needs (votos breakdown, lobby count, patrimonio count, cruces count, asistencia). **Extend this (within the allowlist) to also return the votos `conteos` breakdown** for capa-1 figures — do NOT add a new RPC (`votos_de_parlamentario` p_limit:1000 already loads them).
- `ParlamentarioResumen` / `construirChips` (`parlamentario-resumen.tsx`): the above-fold chip index — this is the **prototype of the rail nav** (per-carril label + 3-state count + `#anchor`, gate-aware order). Generalize it into the rail.
- `CarrilAccordion` (`carril-accordion.tsx`): the F45 disclosure island (Radix `type="single" collapsible`, `forceMount`, children-passed). Reuse the pattern; note the capa-1/detail split (below).
- `ProvenanceBadge`, `formatNombre` (F54), `Breadcrumbs` (F53), `IdentityMarker`, `fechaCorta`/`fechaCortaSegura`/`extractoIdea`/`conteoVotacion` (`lib/format`).

## Architecture Patterns

### System Architecture Diagram (parlamentario ficha, new)
```
                     server render (RSC, streaming via <Suspense>)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ page.tsx  (max-w-5xl, grid md:grid-cols-[13rem_1fr] gap-8 items-start) │
  │                                                                        │
  │  ┌── <FichaRail> (client island, sticky top-N) ──┐   ┌── <main> ────┐  │
  │  │  chip·nombre·período·frescura                  │   │ #votos       │  │
  │  │  nav: [Votaciones 141][Lobby 107]…[Cruces ◆12] │◀─▶│  capa-1 (SSR)│  │
  │  │  (scrollspy ← IntersectionObserver on sections)│   │  <Detalle>   │  │
  │  │  caveat anti-causal 1×                         │   │   VotosSection(children)
  │  └────────────────────────────────────────────────┘   │ #lobby …     │  │
  │        counts ← contarCarrilesSeguro(id) (server, allowlisted RPCs)   │  │
  └──────────────────────────────────────────────────────────────────────┘
   data flow: RPC rows (server) → capa-1 figures (SSR, always in DOM)
                                → detail rows (SSR, in DOM, hidden by CSS until toggled)
   NO lazy-fetch, NO new RPC, NO service_role in browser (children pattern)
```

### Pattern 1: Three-layer progressive disclosure (Shneiderman: overview→details)
**What:** capa-1 (SSR, always visible: big Mono figures + 1 CSS visual + count) → capa-2 (Radix Collapsible, client toggle over already-fetched rows) → capa-3 (fuente·fecha·enlace on every row + section frescura badge, always present).
**When:** every domain section on both fichas.
**Key structural rule:** capa-1 renders OUTSIDE the collapsible; only the detail collapses. This is the inverse of `CarrilAccordion` (which collapses the whole body). Build a new `<DetalleColapsable>` island.

### Pattern 2: `forceMount` disclosure over server children (F45, reuse verbatim)
```tsx
// carril-accordion.tsx (existing) — the contract to copy:
// - "use client" island
// - <AccordionPrimitive.Root type="single" collapsible defaultValue={open?"c":undefined}>
// - <AccordionPrimitive.Content forceMount className="... data-[state=closed]:hidden ...">
// - {children}  ← server component passed by the page; NEVER imported here
```
`forceMount` = SSR content stays in the HTML (traceability + no lazy-fetch); CSS hides it when closed. Detail default = CLOSED (invert `abrePorDefecto`).

### Pattern 3: Server-computed capa-1 (no new query)
Extend `parlamentario-resumen-conteos.ts` to return the votos `conteos` breakdown (si/no/abstención/pareo/ausente) and derive lobby top-materias counts from the rows it ALREADY reads. Capa-1 mini-visuals (stacked bar, horizontal bars, mini-columns) are **CSS on existing tokens** — no chart lib (UI-SPEC §Design System: "Capa-1 mini-visuals = CSS on tokens").

### Pattern 4: Scrollspy (IntersectionObserver, client)
```tsx
"use client";
// hook: observe each <section id> ; on intersect, set active id ; rail marks it.
// rootMargin biased so the "current" section is the one crossing ~top third.
// Reference impl already sketched in sketch 001 (scroll listener) — upgrade to
// IntersectionObserver (perf + no manual scroll math).
```

### Pattern 5: /red ego framing (cheapest correct mechanism)
The RPC is already seed-scoped. Thread `seedId` from `red/page.tsx` into `<RedGraph subgrafo seedId>`; (a) visually mark the seed node (distinct border/emphasis in `NodoParlamentario`), and (b) frame with `fitViewOptions.nodes` (seed + its 1-hop neighbors) so the seed is centered rather than the whole grid averaged. See Code Examples.

### Recommended new files (planner guidance)
```
app/components/ficha-rail.tsx          # NEW client island: <aside> sticky + nav + scrollspy
app/lib/use-scrollspy.ts               # NEW client hook: IntersectionObserver
app/components/detalle-colapsable.tsx  # NEW client island: Collapsible over detail children
app/components/capa1/*.tsx             # NEW server components: per-section capa-1 (CSS visuals)
# extend: parlamentario-resumen-conteos.ts (votos conteos breakdown), page.tsx (grid+rail)
```

### Anti-Patterns to Avoid
- **Collapsing capa-1.** capa-1 must always be visible; only detail collapses.
- **Importing a section into a client island.** Breaks the F45 no-leak contract (service_role to browser). Always pass sections as `children`.
- **New RPC / new query / lazy-fetch.** Explicitly forbidden. All data already loads.
- **Petróleo as generic chrome/hover-fill.** Reserved for cruces + drill-down + scrollspy-current ONLY (UI-SPEC §Color).
- **Moving `mt-12` onto a wrapper or nesting two domains in one section.** Frontier LOCKED.
- **`w-[210px]` / arbitrary color values.** Use tokens (`w-52` = 208px). Layout grid tracks (`md:grid-cols-[13rem_1fr]`) are geometry, permitted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapse/expand with a11y | Custom `useState` + `hidden` toggle | Radix Accordion (`type="single" collapsible`) via the F45 `CarrilAccordion` pattern | ARIA, keyboard, `forceMount` SSR-in-DOM already solved. |
| Urgencia run grouping | New grouping heuristic | `construirItems`/`paresDeUrgencia`/`esRetiroUrgencia` in `timeline-view.tsx` | Already collapses contiguous same-type urgencia runs ≥2, excludes retiros, handles invalid dates. The stepper reuses this. |
| "¿Dónde está hoy?" data | New derivation | `derivarEstadoActual`/`urgenciaVigente`/`citacionVigente` (estado-actual-block.tsx) | Already omits non-derivable lines; feeds the stepper capa-1. |
| Per-carril honest count | New count logic | `contarCarrilesSeguro` + `construirChips` (rail nav) | 3-state honest, gate-aware order, `cache()`-deduped, lockdown-guard-clean. |
| Scrollspy | Scroll-position math | IntersectionObserver | Native, perf-friendly, zero deps. |
| Graph subset framing | Manual viewport math | `fitViewOptions.nodes` (installed API) | See Code Examples; supported in @xyflow/system 0.0.77. |
| Name casing | Ad-hoc uppercasing | `formatNombre` (F54) | Passthrough if already cased; re-cases only all-lowercase. |

**Key insight:** ~80% of what this phase "needs" already exists as server-fetch + pure-view components; the new code is the rail, the scrollspy, the capa-1 summaries, and one detail-disclosure island. Resist rebuilding sections.

## Runtime State Inventory

> This is a code/CSS-only presentational refactor. No rename, no data migration, no stored-state change. Categories checked explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB writes, no key/collection renames. Verified: zero DDL, zero migration in scope (CONTEXT LOCKED). | None |
| Live service config | None — no cron/queue/webhook/service config touched. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None new. Gates (`crucesPublicEnabled`/`moneyPublicEnabled`/`netPublicEnabled`) read existing env vars unchanged; NO flag flip (LOCKED). | None |
| Build artifacts | None — no package install, no build-config change. Deploy path (docker-cf-build.sh + wrangler) unchanged. | Re-deploy at end (existing pipeline) |

**Nothing found in any category — verified by reading the phase boundary (CERO DDL/flags/deps) and every target file.**

## Common Pitfalls

### Pitfall 1: `CarrilAccordion` collapses capa-1 too
**What goes wrong:** Reusing `CarrilAccordion` verbatim on the sections hides the preattentive figures (defeats the ~5s-scan goal).
**Why:** its `<h2>` is the trigger and the whole body is the collapsible content.
**Avoid:** render capa-1 as always-visible SSR; wrap ONLY the detail in a new `<DetalleColapsable>` (Collapsible). Keep `CarrilAccordion` for spots where whole-body collapse is still wanted (e.g. financiamiento-pendiente).
**Warning sign:** the demo screenshot shows no numbers until you expand.

### Pitfall 2: `--color-primary-soft` does not exist in the site tokens
**What goes wrong:** The sketch/UI-SPEC scrollspy-current state uses `var(--color-primary-soft)` (≈`hsl(183 30% 93%)`), but `globals.css` only defines `--accent-product` (petróleo), `--background`, `--card`, `--muted`, `--border`. There is NO `*-soft` token.
**Why:** the sketch mirrors tokens in `.planning/sketches/themes/default.css`, which is a reference, not the site source.
**Avoid:** ADD `--accent-product-soft` (light + dark) in `civic-tokens.css` or `globals.css` and register the Tailwind utility via `@theme inline { --color-accent-product-soft: var(--accent-product-soft); }` — following the **exact identity-warn pattern** (line 65–69: token is a COMPLETE `hsl()` value, referenced WITHOUT a wrapping `hsl()`; double-`hsl()` = invalid color, the 54-04 gotcha).
**Warning sign:** scrollspy-current has no background (invalid CSS silently dropped).

### Pitfall 3: sticky offset — the GlobalHeader is NOT sticky
**What goes wrong:** UI-SPEC prescribes rail `sticky top-16` + `scroll-mt-16` assuming a 64px sticky header. The actual `GlobalHeader` is **non-sticky** and `min-h-14` (56px) — it scrolls away.
**Why:** header uses `border-b bg-background`, no `sticky`/`fixed`.
**Avoid:** since the header scrolls off, the rail can be `sticky top-4`/`top-8`; `scroll-mt` on sections only needs a small comfortable offset (not 64px). Planner must reconcile the UI-SPEC `top-16` against the real non-sticky 56px header — otherwise anchor jumps land with dead space or the rail floats oddly. (This is a real spec/impl mismatch worth flagging to the operator.)
**Warning sign:** clicking a rail link scrolls the section under a phantom header gap.

### Pitfall 4: Tailwind v4 arbitrary-color ban (54-04)
**What goes wrong:** Using `bg-[hsl(var(--accent-product))]`-style arbitrary color values (double-hsl) produces invalid CSS.
**Avoid:** register color tokens in `@theme inline` (value is a complete `hsl()`, referenced bare) → get flat utilities `bg-accent-product-soft` etc. Layout grid tracks (`md:grid-cols-[13rem_1fr]`) are geometry, NOT colors — permitted (UI-SPEC clarification).

### Pitfall 5: `"use client"` creep across the server boundary
**What goes wrong:** Making a section or the page client to get scrollspy/toggle → pulls the server Supabase (`service_role`, Camino A) into the browser bundle → lockdown-guard/PII exposure.
**Avoid:** islands (`FichaRail`, `DetalleColapsable`) receive server content as `children`; they never import a `*Section` or `@/lib/supabase`. This is asserted by the F45 grep-test; keep it green.

### Pitfall 6: CLS from collapsing content
**What goes wrong:** Detail default-closed with `forceMount` + `data-[state=closed]:hidden` is fine, but the capa-1 skeletons (`ResumenSkeleton`, `CarrilesSkeleton`) are shape-matched to the OLD layout (5 chips, accordion headers). Changing to rail+capa-1 without updating skeletons re-introduces layout shift.
**Avoid:** update the Suspense skeletons to match the new capa-1 shapes (IN-02/IN-03 anti-CLS pattern already in the codebase).

### Pitfall 7: Anti-insinuación regressions in new copy
**What goes wrong:** New capa-1/rail/microcopy introduces banned causal/affinity/score vocabulary, or composes a meeting+vote in one sentence, or moves `mt-12`, or nests domains.
**Avoid:** reuse LOCKED copy from UI-SPEC §Copywriting Contract verbatim; keep the caveat 1×/page (rail) + 1× in cruces; counts neutral; every section a sibling `<section className="mt-12">`. The per-component content-gate tests (e.g. `lobby-de-parlamentario.test.tsx`, `cruces-de-parlamentario.test.tsx`) enforce this — extend, don't weaken them.

### Pitfall 8: hero/LOCKED surfaces & 52-03 plain-name
**Avoid touching:** Home, `/buscar`, the hero. Lobby contraparte and lobby×tramitación parlamentario names stay PLAIN non-linked (52-03). Patrimonio never renders montos (F46).

## Code Examples

### Detail disclosure island (capa-1 stays outside)
```tsx
// detalle-colapsable.tsx — NEW client island (Collapsible = Accordion single/collapsible)
"use client";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
export function DetalleColapsable({
  n, labelTemplate, children,           // children = the existing *Section (server) 
}: { n: number; labelTemplate: (n: number, open: boolean) => string; children: React.ReactNode }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible /* default: CLOSED */>
      <AccordionPrimitive.Item value="d">
        <AccordionPrimitive.Header asChild>
          <AccordionPrimitive.Trigger className="min-h-11 ...">
            {/* "Ver detalle (141)" ↔ "Ocultar detalle" — data-state driven */}
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content forceMount className="data-[state=closed]:hidden pt-4">
          {children}
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}
```

### Scrollspy hook (IntersectionObserver)
```tsx
// use-scrollspy.ts — NEW client hook, zero deps
"use client";
import { useEffect, useState } from "react";
export function useScrollspy(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }, // "current" = crossing top third
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}
```

### /red ego framing (installed API — VERIFIED)
```tsx
// @xyflow/system 0.0.77 FitViewOptionsBase.nodes accepts (Node | {id})[]  [VERIFIED: node_modules]
// pass seedId from red/page.tsx → RedGraph; frame seed + 1-hop neighbors:
const egoIds = [seedId, ...aristasVisibles.flatMap(a => [a.a, a.b])].filter(Boolean);
<ReactFlow
  fitView
  fitViewOptions={{ padding: 0.2, nodes: egoIds.map((id) => ({ id })), minZoom: 0.2 }}
  /* …existing props… */
/>
// mark the seed node distinctly in NodoParlamentario via data.esSeed (sober, non-ranking).
// Alternative (imperative): const { setCenter } = useReactFlow(); setCenter(x, y, { zoom }).
```
Type confirmed at `node_modules/.pnpm/@xyflow+system@0.0.77/.../types/general.d.ts:150-161`:
`FitViewOptionsBase.nodes?: (NodeType | { id: string })[]`.

### Capa-1 votos figures (server, from rows already read)
```tsx
// extend parlamentario-resumen-conteos.ts to expose the breakdown it already reads:
//   const conteos = { si:0,no:0,abstencion:0,pareo:0,ausente:0 };
//   for (const v of votosRows) conteos[v.seleccion]++;   // votosRows already fetched, p_limit:1000
// capa-1 renders: <b class=mono>{conteos.si}</b> a favor · {conteos.no} en contra … + CSS stacked bar
// (identical numbers to VotosView "Cómo votó" — single source, no new RPC).
```

## State of the Art

| Old Approach (pre-55) | Current Approach (55) | Impact |
|--------------|------------------|--------|
| Whole-carril accordion, auto-open carriles with data (F45) | capa-1 always visible; detail collapsed by default | Hits ~5.000px default; scan-in-<5s |
| Above-fold chip index (`ParlamentarioResumen`) | Sticky rail nav + scrollspy (generalizes the chip index) | Persistent orientation while scrolling |
| Proyecto page: flat `<h2>` sections, no disclosure | Rail + stepper + grouped urgencia + collapsible detail | 10.391px → scannable |
| /red: `fitView` over whole per-cámara grid | `fitViewOptions.nodes` framed on seed ego | Seed-centered initial view |

**Deprecated for this phase:** the `abrePorDefecto` auto-open heuristic (F45) — superseded by "capa-1 is the always-visible layer, detail starts closed."

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Extending `parlamentario-resumen-conteos.ts` to return the votos `conteos` breakdown stays within the lockdown-guard allowlist (same RPC `votos_de_parlamentario`, no new query). | Patterns/Code Examples | LOW — same RPC already called there; guard scans for new `.from(PII)`/non-allowlist RPC, neither introduced. Planner should keep the guard test green. |
| A2 | The rail sticky offset should be small (`top-4`/`top-8`) because GlobalHeader is non-sticky, contradicting UI-SPEC `top-16`. | Pitfall 3 | MEDIUM — UI-SPEC is APPROVED (PASS 6/6); if the operator intends to ALSO make the header sticky, `top-16` is correct. Flag for confirmation; default to matching the real non-sticky 56px header. |
| A3 | `subgrafo_red(depth=1)` already returns only the seed's immediate neighborhood, so /red ego work is mostly client framing/marker (not a query change). | red-graph analysis | LOW — confirmed by reading `red/page.tsx` (p_depth:1, seed required, no seedless graph). |
| A4 | Agenda día→comisión grouping is a presentational sub-group inside the existing day grouping; no new query. | Agenda analysis | LOW — `CitacionesSection` already groups by day and has comisión on each row. |

## Open Questions (RESOLVED)

1. **Rail sticky offset vs. non-sticky header (A2).**
   - What we know: UI-SPEC says `sticky top-16` + `scroll-mt-16`; the real GlobalHeader is non-sticky, 56px.
   - What's unclear: whether the operator wants the header made sticky too.
   - Recommendation: default to a small rail offset that matches the scrolling header; keep `scroll-mt` modest; note in the demo checkpoint. Do NOT make the header sticky (out of scope, hero/header LOCKED).
   - **RESOLUTION (A2):** Rail `sticky top-6`, secciones `scroll-mt-6` — decision del orquestador que SUPERSEDE el `top-16` del UI-SPEC. El GlobalHeader queda NO-sticky (56px, scrollea; fuera de alcance). Aplicado en 55-01/55-03/55-04.

2. **capa-1 figures source for votos (A1).**
   - What we know: the breakdown is already read in two places (`VotosView`, conteos lib) but only totals/asistencia are returned by the conteos lib.
   - Recommendation: extend the conteos lib (single source) rather than re-reading in the rail/capa-1; keeps chip, capa-1, and section perfectly in sync (the F45 lesson about the p_limit:1000 cap applies — keep byte-for-byte parity).
   - **RESOLUTION (A1):** `votosBreakdown` (si/no/abstencion/pareo/ausente) se expone desde `contarCarrilesSeguro` en 55-02 Task 1, derivado de las MISMAS filas ya leidas (byte-parity con VotosView "Como voto"), sin RPC nueva. En la misma tarea se exponen tambien `lobbyTopMaterias`/`crucesSectores`/`patrimonioPorDeclaracion`/`rangoAnios` como productores REALES de las otras tres capa-1.

3. **Truncation mechanic (Claude's discretion).**
   - Recommendation: initial detail shows ~8 rows; "Ver las N" reveals the rest **client-side over already-rendered rows** (all rows are already in the DOM via the sections). Since `VotosSection`/`LobbySection` already paginate/gr­oup server-side via URL params, prefer keeping their existing server-driven paging INSIDE the detail and just gate the whole detail behind the disclosure — avoids a second, conflicting client-paginator.
   - **RESOLUTION (A3):** Conservar la truncacion/paginacion server existente DENTRO del disclosure (votos ?votosPage/?materia, lobby ?lobbyPage, patrimonio ?patrimonioPage). Para votaciones, si el detalle vuelca >~30 filas planas, aplicar "mostrar mas" client-side sobre datos YA renderizados (sin RPC nueva, sin lazy-fetch). Aplicado en 55-03.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@radix-ui/react-accordion` | disclosure | ✓ | 1.2.14 | — |
| `@xyflow/react` | /red framing | ✓ | 12.11.0 (`fitViewOptions.nodes` present) | — |
| Recharts | patrimonio detail | ✓ | 3.9.0 | — |
| Next.js / React | everything | ✓ | 16.2.9 / 19.2.4 | — |
| IntersectionObserver | scrollspy | ✓ (browser native) | — | scroll-listener fallback (sketch already has one) |
| vitest | test suite | ✓ | (`vitest run`) | — |

**No missing dependencies.** This is a code/CSS-only phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + React Testing Library (jsdom) |
| Config file | `app/vitest.config.ts` (runs from `app/`) |
| Quick run command | `cd app && pnpm test -- <file>` (or `pnpm vitest run <file>`) |
| Full suite command | `cd app && pnpm test` (`vitest run`) — baseline **594** green at F54 close |
| Type gate | `pnpm tsc -b` (root; use `references`, not `paths` — 43-DEBT gotcha) |
| Guards | `lib/lockdown-guard.test.ts` (Block A: no anon re-grant >0044; Block B: no `.from(PII)` in `app/`) + per-component banned-vocab content-gate tests |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| UX-03 | Rail present with one nav entry per PRESENT carril + honest 3-state count; gate-aware order | unit (RTL) | `pnpm vitest run components/ficha-rail.test.tsx` | ❌ Wave 0 (mirror `parlamentario-resumen.test.tsx`) |
| UX-03 | capa-1 figures render always-visible (NOT inside a collapsed region); numbers match section | unit (RTL) | `pnpm vitest run app/app/parlamentario/[id]/page.test.tsx` | ⚠️ exists — UPDATE (asserts old accordion/auto-open) |
| UX-03 | Detail collapsed by default; "Ver detalle (N)" toggles; SSR content present in DOM (`forceMount`) | unit (RTL) | `pnpm vitest run components/detalle-colapsable.test.tsx` | ❌ Wave 0 (mirror `carril-accordion.test.tsx`) |
| UX-03 | Scrollspy marks current section | unit (RTL, mock IntersectionObserver) | `pnpm vitest run lib/use-scrollspy.test.ts` | ❌ Wave 0 |
| UX-01 | Tramitación stepper elevates etapa/estado; urgencia runs grouped (reuse existing) | unit (RTL) | `pnpm vitest run components/timeline-view.test.tsx components/estado-actual-block.test.tsx` | ⚠️ exist — extend for stepper/capa-1 |
| UX-03 | /red centers ego on seed (seed marked; fitViewOptions.nodes) | unit (RTL) | `pnpm vitest run components/red/red-graph.test.tsx app/app/red/page.test.tsx` | ⚠️ exist — extend for seedId |
| UX-03 | Agenda día→comisión grouping + collapsible day | unit (RTL) | `pnpm vitest run app/app/agenda/page.test.tsx` (+ citacion-card) | ⚠️ add |
| anti-insinuación | banned-vocab absent in ALL new copy; caveat 1×/page + 1× cruces; `mt-12` siblings; no montos; plain names (52-03) | content-gate (RTL negative-match) | full suite | ⚠️ extend existing per-component gates |
| security/lockdown | no `.from(PII)` leaks into new islands; no anon re-grant; islands don't import server Supabase | guard | `pnpm vitest run lib/lockdown-guard.test.ts` | ✓ keep green |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <touched files>` + `pnpm tsc -b`.
- **Per wave merge:** full `pnpm test` (594+ green) + `lockdown-guard` + banned-vocab gates.
- **Phase gate:** full suite green + `tsc -b` clean + lockdown-guard 7/7 before `/gsd:verify-work`; then same-origin rewalk-shot demo capture (54-05 technique, ≤12.800px/capture) as operator checkpoint.

### Wave 0 Gaps
- [ ] `components/ficha-rail.test.tsx` — rail nav/counts/gate-order/scrollspy-active (covers UX-03)
- [ ] `components/detalle-colapsable.test.tsx` — default-closed, toggle copy, `forceMount` SSR-in-DOM
- [ ] `lib/use-scrollspy.test.ts` — IntersectionObserver mock → active id
- [ ] `components/capa1/*.test.tsx` — capa-1 figures/mini-visuals match section aggregates
- [ ] UPDATE `app/app/parlamentario/[id]/page.test.tsx` (old auto-open/accordion assertions will fail with the inverted default)
- [ ] EXTEND `timeline-view.test.tsx`, `estado-actual-block.test.tsx`, `red-graph.test.tsx`, `red/page.test.tsx`, `agenda/page.test.tsx`
- [ ] Update Suspense skeletons to match new capa-1 shapes (anti-CLS)

*(No framework install needed — vitest/RTL already configured.)*

## Security Domain

Read-only public citizen surfaces; `security_enforcement` enabled, ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (existing) |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth on public surfaces. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | yes | Gates `crucesPublicEnabled`/`moneyPublicEnabled`/`netPublicEnabled` wrap entire `<section>`/route (OFF ⇒ node absent from HTML). **Unchanged this phase — no flag flip.** Rail entries mirror gates exactly (only present carriles appear). |
| V5 Input Validation | yes | `PARLAMENTARIO_ID_RE`/`BOLETIN_RE` validated before DB; searchParams normalized (string[]→first, trimmed). New disclosure is client-only over already-validated data — introduces no new untrusted input path. |
| V6 Cryptography | no | None hand-rolled. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation (existing, preserve) |
|---------|--------|---------------------|
| service_role leaking to browser bundle (Camino A) | Information Disclosure | F45 children-pattern: islands never import `@/lib/supabase` or a `*Section`; `import "server-only"` on server modules; lockdown-guard Block B scans `app/`. |
| PII exposure (rut/partido/familiar) | Information Disclosure | RPCs are PII-safe (security definer, no partido/rut); capa-1 derives only from PII-safe RPC output; never render montos/partido/rut. |
| Anti-insinuación / causal composition | (project-existential) | banned-vocab negative-match, caveat 1×, neutral counts, mt-12 siblings — content-gate tests. |
| XSS via injected copy | Tampering | React auto-escaping; no `dangerouslySetInnerHTML`; external hrefs via `safeExternalHref`. |

**No new attack surface** (no new route, RPC, input, or dependency). Security posture = preserve existing invariants; block-on-high risk is not triggered.

## Project Constraints (from CLAUDE.md / app AGENTS.md)
- **`app/AGENTS.md`:** read `node_modules/next/dist/docs/` before writing Next.js code (breaking-change repo). Applies to any routing/RSC/searchParams work.
- **CLAUDE.md:** TypeScript-only; Next.js 16 App Router; Server Components by default, all external calls server-only; secrets in `.env`; `mt-12` anti-insinuación frontier LOCKED; no arbitrary color values (54-04); GSD workflow enforcement (no direct edits outside a GSD command).
- **Camino A (memory):** public site reads with `service_role`; PII protected by CI guard scanning `app/` for `.from(PII)` — keep green.

## Sources

### Primary (HIGH confidence — direct codebase read)
- `app/app/parlamentario/[id]/page.tsx`, `app/app/proyecto/[boletin]/page.tsx`, `app/app/agenda/page.tsx`, `app/app/red/page.tsx` — page structure, server/client boundaries, gates, section order.
- `app/components/{carril-accordion,parlamentario-resumen,votos-por-parlamentario,lobby-de-parlamentario,patrimonio-de-parlamentario,cruces-de-parlamentario,timeline-view,estado-actual-block,lobby-en-tramitacion,global-header}.tsx` — reusable assets, data shapes, existing disclosure/grouping.
- `app/lib/parlamentario-resumen-conteos.ts`, `app/lib/types.ts` — conteos, `TramitacionEventoRow` shape (tipo/descripcion/etapa).
- `app/app/globals.css` (tokens + `@theme inline` identity-warn pattern), `app/lib/lockdown-guard.test.ts` — token gotcha, guard scope.
- `node_modules/.pnpm/@xyflow+system@0.0.77/.../types/general.d.ts:150-161` — `FitViewOptionsBase.nodes` API [VERIFIED].
- `app/package.json` — versions (xyflow 12.11.0, next 16.2.9, react 19.2.4, test=`vitest run`).
- `55-CONTEXT.md`, `55-UI-SPEC.md` (APPROVED PASS 6/6), sketch 001 index.html.

### Secondary
- `.planning/STATE.md`, MEMORY.md — F45/F46/F52/F53/F54 lessons, gotchas (54-04 double-hsl, 43-DEBT tsc references, force-dynamic gate), suite baseline 594.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all versions read from package.json + node_modules.
- Architecture/patterns: HIGH — every target file and reusable component read directly; patterns already exist in-repo.
- Pitfalls: HIGH — token gap, sticky-header mismatch, and capa-1/accordion inversion each verified against source.
- /red API: HIGH — `fitViewOptions.nodes` confirmed in the installed type definition.

**Research date:** 2026-07-07
**Valid until:** ~2026-08-07 (stable; codebase-internal, no fast-moving external deps). Re-verify only if package versions bump.
