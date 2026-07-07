---
phase: 53
slug: uxnav-auditoria-ux-navegada
status: draft
shadcn_initialized: true
preset: "Slate baseline (app/components.json) + Geist + cream/petróleo tokens"
created: 2026-07-07
extends: phases/52-cruce2-cruces-nuevos/52-UI-SPEC.md
design_system: phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/DESIGN-SYSTEM.md
---

# Phase 53 — UI Design Contract · UXNAV Auditoría UX navegada + fixes de orientación

> Visual and interaction contract for the **P0 orientation fixes** of Phase 53. This phase **extends** the F52 UI-SPEC (which extends F51/F44) and obeys `DESIGN-SYSTEM.md` (CLOSED). It re-opens exactly ONE locked decision — the GlobalHeader nav item list (§11.0) — with explicit CONTEXT authorization ("considerar orden por journey … evaluar añadir /red"). Everything else is inherited verbatim.
>
> **Scope split (load-bearing):** the audit mechanics (BrowserOS journeys, screenshots, `53-UX-AUDIT.md`, console logs) are NOT UI contracts and are NOT specified here. This document contracts only the UI surfaces the P0 fixes touch: (a) header nav (+ `/red`, active state, order); (b) light breadcrumbs on fichas; (c) legal cross-links; (d) empty-state orientation lines. **Any P0 fix the audit produces MUST conform to this contract**; a finding whose remedy requires visual redesign/jerarquía beyond these patterns is by definition P1 → Phase 54.
>
> **Zero new dependency, zero new client JS beyond the existing `HeaderNav` island, zero DDL, zero flags, zero RPC change.** All fixes are Server Components / static `<Link>`s / copy additions.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `app/components.json`, Slate baseline) |
| Preset | Slate baseline extended by cream/petróleo tokens (DESIGN-SYSTEM §1, LOCKED) |
| Component library | Radix UI (already shipped). **No new Radix primitive this phase.** |
| Icon library | Inline Unicode glyphs only (`→` continuation arrow, `↗` source link, `/` breadcrumb separator). No lucide addition. |
| Font | Geist Sans (prose/UI) + Geist Mono (boletín, dates, counts) |
| New dependencies | **none** |

Token rule (inherited, LOCKED): Tailwind v4 utility classes — `text-accent-product`, NEVER `text-[--accent-product]`.

---

## Spacing Scale

Inherited verbatim from DESIGN-SYSTEM §3 (8-point, multiples of 4). No new token.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1` | Breadcrumb separator gaps |
| sm | 8px | `gap-2` / `mt-2` | Empty-state continuation line ← gap to the honest line above it |
| md | 16px | `mb-4` | Breadcrumb block → page `h1` gap |
| lg | 24px | `p-6` | (inherited card padding — untouched) |
| xl | 32px | `md:px-8` | Header/page horizontal padding (unchanged) |
| **2xl** | **48px** | **`mt-12`** | **Carril boundary — LOCKED anti-insinuación frontier. This phase NEVER moves, collapses, or nests a carril.** |
| 3xl | 64px | `py-16` | (inherited page rhythm — untouched) |

**Exceptions:** touch-target minimum **44px** (`min-h-11`) on every interactive element added this phase — nav items (already `min-h-11`), breadcrumb links, empty-state continuation links. DESIGN-SYSTEM §3 exception, not a new value.

---

## Typography

Inherited verbatim from DESIGN-SYSTEM §2. Exactly 2 weights (400 / 600); nav labels keep their shipped `font-medium` verbatim (shipped F21 code, not re-decided, not propagated to new elements).

| Role | Size | Weight | Line Height | Tailwind | Usage in this phase |
|------|------|--------|-------------|----------|---------------------|
| Body | 16px | 400 | 1.5 | `text-base leading-relaxed` | (inherited — untouched) |
| Label / meta | 14px | 400 | 1.4 | `text-sm` | Breadcrumb text, empty-state continuation line, nav labels |
| Section (h2) | 20px | 600 | 1.3 | `text-xl font-semibold` | (inherited — untouched) |
| Mono (metadata) | 14px | 400 | 1.4 | `font-mono text-sm` | Boletín inside the breadcrumb current-segment (`Boletín 14309-04`) |

**Heading hierarchy untouched:** the breadcrumb is a `<nav>` above the `h1`, never a heading itself. No fix in this phase may add, remove, or re-level an `h1`–`h3`.

---

## Color

Inherited verbatim from DESIGN-SYSTEM §1 (60/30/10 cream · warm surface · petróleo). No new color. No destructive action (read-only product).

| Role | Value (light) | Usage |
|------|---------------|-------|
| Dominant (60%) | `hsl(40 33% 97%)` `--background` | Page canvas, header canvas (unchanged) |
| Secondary (30%) | `hsl(40 30% 99%)` `--card` / `hsl(40 20% 93%)` `--muted` | (inherited — untouched) |
| Accent (10%) | `hsl(183 38% 26%)` `--accent-product` | See reserved-for list |
| Destructive | `hsl(0 72% 42%)` `--destructive` | **Unused** |

**Accent (petróleo) reserved-for in this phase (EXPLICIT):**
1. Header nav **active item**: petróleo text + `underline decoration-2 decoration-accent-product underline-offset-8` (shipped pattern in `header-nav.tsx`, extended to the new Red item unchanged).
2. Breadcrumb **link hover**: `hover:text-accent-product hover:underline` (rest state stays muted — see component contract).
3. Empty-state **continuation link**: petróleo underline link (`text-accent-product underline underline-offset-2`).
4. Keyboard focus ring (`--ring`, petróleo) on all of the above.

**Accent is NOT used for:** the breadcrumb current segment, the `/` separators, the `→` arrow when outside the link text, any heading, any count, any badge. Existing shipped link styles (e.g. `VotoRow` `text-primary`) are **not restyled** this phase — style drift is a P1 finding for F54, never a P0 fix here.

---

## Copywriting Contract

Chilean Spanish, neutral-factual, sober. Every new string passes the DESIGN-SYSTEM §6 fenced banned-vocabulary negative-match. Exact wording below is prescribed; the executor may vary placeholders, never register or meaning. **PROHIBIDO fabricar virtud**: "limpio", "transparente", "nada que ocultar" never appear in an empty state.

### Global (template fields)

| Element | Copy |
|---------|------|
| Primary CTA | **None.** No form/submit added. Every affordance is a plain `<Link>`. |
| Empty state heading | Not applicable — empty states are single honest paragraphs (shipped pattern), never given a heading this phase. |
| Empty state body | Shipped honest string stays **VERBATIM** (test-asserted, LOCKED) + ONE new continuation line appended (table below). |
| Error state | Inherited unchanged: real DB/network error → throw (#34) → honest error UI "No pudimos cargar este dato. Intenta recargar la página." This phase adds no error surface. |
| Destructive confirmation | Not applicable — no destructive action exists. |

### (a) Header nav — labels and order (re-opens §11.0 with CONTEXT authorization)

| Position | Label | Href | Note |
|----------|-------|------|------|
| wordmark | `Observatorio del Congreso 360` | `/` | unchanged |
| 1 | `Buscar` | `/buscar` | unchanged |
| 2 | `Parlamentarios` | `/parlamentarios` | unchanged |
| 3 | `Agenda` | `/agenda` | unchanged |
| 4 | **`Red`** | **`/red`** | **NEW** — route LIVE since 2026-07-02 (`force-dynamic`). Label is the route name, factual; NEVER "Red de influencia" / "Conexiones" (banned framing). |
| 5 | `Sobre` | `/sobre` | Label **shortened** from "Sobre / Metodología" so 5 items fit one row on 390px (Metodología stays reachable from `/sobre` and the global footer). Same re-open as the Red addition. |

### (b) Breadcrumbs — labels per ficha

Format: `Inicio / {sección} / {actual}`. Segment 1 and 2 are links; the current segment is plain text.

| Ficha | Crumb 1 | Crumb 2 | Current segment (plain text, `aria-current="page"`) |
|-------|---------|---------|------------------------------------------------------|
| `/proyecto/[boletin]` | `Inicio` → `/` | `Proyectos` → `/buscar` | `Boletín {boletin}` (boletín in Mono) |
| `/parlamentario/[id]` | `Inicio` → `/` | `Parlamentarios` → `/parlamentarios` | `{nombre}` (as-shipped `nombre_normalizado`; Title Case formatter is F54, NOT this phase) |
| `/contraparte/[id]` | `Inicio` → `/` | *(omitted — no listing route exists)* | `{nombre}` | 

Rationale for `Proyectos → /buscar`: no `/proyectos` listing route exists; `/buscar` is the project-finding surface. If F54 ships a listing, only the href changes. `/contraparte` breadcrumb ships inside the gated page (renders only when MONEY gate is ON — invisible in this phase's PROD, harmless, future-proof).

### (c) Empty-state continuation lines (prescribed copy per surface)

Pattern: shipped honest paragraph stays verbatim; ONE new line follows (`mt-2`), containing exactly one internal link. The `→` glyph sits inside the link text, `aria-hidden="true"`. Continuation targets are **route-level nav surfaces with data only** (`/buscar`, `/parlamentarios`, `/agenda`) — never an in-page anchor of a possibly-empty section, never an external URL.

| Surface (empty state) | Continuation line |
|-----------------------|-------------------|
| `/buscar` — sin resultados | `Prueba con otras palabras, o revisa [la agenda legislativa de la semana →](/agenda).` |
| Ficha parlamentario — votos sin registros | `Puedes explorar [otros parlamentarios en el directorio →](/parlamentarios).` |
| Ficha parlamentario — lobby no ingestado / cero confirmadas | `Mientras tanto, puedes [buscar un proyecto de ley por su idea →](/buscar).` |
| `/agenda` — sin citaciones en la semana | `Puedes [buscar un proyecto de ley por su idea →](/buscar).` |
| `/red` — grafo vacío para la seed | `Vuelve al [directorio de parlamentarios →](/parlamentarios).` |
| Home actualidad blocks | **No continuation line** — the home is not a dead end (hero + nav present). Shipped strings untouched. |

Application rule: the executor adds the line ONLY to surfaces the audit flags as dead ends (P0 "callejón sin salida"), drawing copy from this table. A surface the audit does not flag keeps its shipped copy byte-identical. Sections that degrade by rendering `null` (gated MONEY/cruces, RPC-pre-apply) have **no** empty state and get **no** line — the node stays absent.

**Semantic guard (LOCKED):** the continuation line NEVER blurs the three honest states. "No ingestado" copy still says the data is being incorporated; "sin resultados" still says consulted-with-zero. The new line only adds a route, never re-frames the fact.

---

## Component Inventory

| Component / file | Action | Contract |
|------------------|--------|----------|
| `header-nav.tsx` (`NAV_ITEMS`) | **Extend** | Add `{ href: "/red", label: "Red" }` in position 4; shorten label 5 to `"Sobre"`. Everything else byte-identical: `esActivo` prefix matching, `aria-current="page"`, `min-h-11`, petróleo active underline, `flex-wrap` no-JS collapse, no hamburger, island receives no props. **Zero new client JS.** |
| `global-header.tsx` | **Reuse unchanged** | Server Component wrapper untouched. |
| NEW `Breadcrumbs` (server component, `app/components/breadcrumbs.tsx`) | **Add** | Pure presentational, props `items: { label: string; href?: string }[]` (last item without `href` = current). Markup: `<nav aria-label="Ruta de navegación"><ol class="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground mb-4">` — each link `inline-flex min-h-11 items-center underline-offset-4 hover:underline hover:text-accent-product focus-visible:ring-2 focus-visible:ring-ring rounded-md`; separator `<span aria-hidden="true">/</span>`; current segment `<span aria-current="page" class="text-foreground">`. Boletín segment wraps in `font-mono`. No JS, no `usePathname` — each page passes its literal crumbs. |
| `app/app/proyecto/[boletin]/page.tsx`, `app/app/parlamentario/[id]/page.tsx`, `app/app/contraparte/[id]/page.tsx` | **Extend** | Render `<Breadcrumbs>` immediately above the page `h1` / header section, inside the existing content container (same `max-w`/`px` — never full-bleed). No layout reflow of carriles; `mt-12` frontiers untouched. |
| Empty-state components flagged by the audit (`lobby-de-parlamentario.tsx` states a/b, votos empty, agenda empty, `red` empty, `/buscar` empty) | **Extend (conditional)** | Append the prescribed continuation `<p class="text-sm mt-2">` with its single petróleo link. Shipped honest string byte-identical above it (RTL asserts must keep passing; new line gets its own assertion). |
| `VotoRow`, `voto-ficha-row.tsx`, agenda boletín links | **Reuse unchanged** | Cross-links ALREADY shipped (see matrix below). Not restyled. |
| `lobby-en-tramitacion.tsx` (project ficha carril) | **DO NOT TOUCH** | Parlamentario name stays **plain text** — LOCKED 52-03 (juxtaposition, not attribution). Adding a link here is a contract violation, not a fix. |
| `ContraparteCruda` (in `lobby-de-parlamentario.tsx`) | **DO NOT TOUCH** | See cross-link matrix — link not shippable this phase. |

---

## Cross-link legality matrix (LOAD-BEARING)

The audit will propose cross-links; the executor implements ONLY per this matrix. A link that can render as 404 in PROD is itself a P0 (dead end) and is forbidden.

| Cross-link | Status | Contract |
|------------|--------|----------|
| Parlamentario name in vote roll-call (project ficha `VotoRow`) → `/parlamentario/[id]` | **Already shipped** | Link ONLY when `estado_vinculo === "confirmado"` && `parlamentario_id != null`; otherwise raw name + `IdentityMarker` (TRAM-06 guard, LOCKED). Any NEW name-link the audit adds elsewhere follows this exact guard. |
| Proyecto title/boletín in parlamentario vote list (`voto-ficha-row`) → `/proyecto/[boletin]` | **Already shipped** | Unchanged. |
| Boletín in agenda (`/agenda`) → `/proyecto/[boletin]` | **Already shipped** | Unchanged. |
| Header → `/red` | **Add this phase** | Per nav contract above. |
| Fichas → Inicio / sección (breadcrumbs) | **Add this phase** | Per breadcrumb contract above. |
| Contraparte name in parlamentario lobby section → `/contraparte/[id]` | **NOT SHIPPABLE this phase** | Three shipped LOCKED constraints: (1) RPC `lobby_de_parlamentario` emits no `contraparte_id` (privacy §3.7); (2) doctrine B11/§3.2 "contraparte texto crudo, NUNCA enlazada" (identity unverified); (3) `/contraparte/[id]` is MONEY-gated → `notFound()` with gate OFF (PROD default) and this phase is CERO flags → the link would be a guaranteed 404 dead end. Record as a **gated finding** in `53-UX-AUDIT.md` (unblocks with: confirmed `contraparte_id` in the RPC + MONEY gate sign-off), not as a fix. |
| Parlamentario name in lobby×tramitación carril (project ficha) → ficha | **PROHIBITED (LOCKED)** | 52-03 / F52 UI-SPEC: plain text in juxtaposition context. Never re-opened by an audit finding. |

---

## Interaction Contracts

Server-driven only. **Zero new client island** (the only client code touched is the static `NAV_ITEMS` array inside the existing `HeaderNav` island).

| Control | Mechanism | Behavior |
|---------|-----------|----------|
| Nav item (incl. new Red) | static `<Link>` | Active = petróleo underline via `usePathname` prefix match (shipped); works linkwise without JS. |
| Breadcrumb link | static `<Link>` | No JS; current segment inert. |
| Continuation link | static `<Link>` | No JS; single link per empty state. |

**Mobile contracts (390×844, first-class):**
- Header: 5 nav items + wordmark must fit ≤2 rows total (wordmark row + nav row acceptable — shipped `flex-wrap justify-between` behavior); nav itself must not exceed 1 wrapped row of items. The "Sobre" label shortening exists for this. No hamburger, no JS collapse.
- Breadcrumbs: `flex-wrap`, no truncation (segments are short by construction: "Boletín {n}", apellido-first name). If a name still overflows, wrap — never `overflow-hidden` that hides the current location.
- All touch targets `min-h-11` (44px).

---

## Anti-insinuación Invariants (HARD — inherited, load-bearing for this phase)

1. **Carril frontier LOCKED.** No P0 fix moves, merges, nests, or collapses an `mt-12` carril. Orientation fixes are additive chrome (nav, crumbs, one copy line), never composition.
2. **Cross-link ≠ attribution.** A link only asserts "this entity has a ficha", and only where identity is `confirmado`. The lobby×tramitación juxtaposition rail keeps plain-text names (matrix above).
3. **Empty ≠ virtue.** Continuation lines add a route, never a verdict; banned-vocab negative-match applies to every new string (no "limpio/transparente/nada que ocultar", no causal/affinity/score language).
4. **Honest states stay distinct.** no-consultado / sin-resultados / error copy untouched byte-for-byte; gated/degraded sections keep rendering `null` (node absent), never a fabricated empty band with a cheerful link.
5. **No PII, no partido, no foto** in any new chrome (nav, breadcrumbs render only route labels + shipped public names).
6. **Zero flag flips, zero DDL, zero RPC change.** `/red` is already LIVE; adding its nav link exposes nothing new.
7. **Provenance untouched.** No fix removes or relocates a `ProvenanceBadge` or per-row source link.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (Slate) | none new this phase (all primitives already installed) | not required |
| Third-party registries | **none declared** | not applicable |

Zero new dependency of any kind. Vetting gate not triggered.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
