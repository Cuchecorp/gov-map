---
phase: 54
slug: uxdemo-pulido-presentacional
status: draft
shadcn_initialized: true
preset: "Slate baseline (app/components.json) + Geist + cream/petróleo tokens"
created: 2026-07-07
extends: phases/53-uxnav-auditoria-ux-navegada/53-UI-SPEC.md
design_system: phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/DESIGN-SYSTEM.md
---

# Phase 54 — UI Design Contract · UXDEMO Pulido presentacional para demo (centro de estudios)

> Visual and interaction contract for Phase 54. **Extends** the F53 UI-SPEC (→ F52 → F51/F44) and obeys `DESIGN-SYSTEM.md` (CLOSED). Audience of the deliverable: a demo for a **centro de estudios** — the home and the two fichas (proyecto / parlamentario) are the surfaces that weigh most (54-CONTEXT §specifics).
>
> **Scope (6 contracts):** (1) `formatNombre()` display-only name formatter + surface inventory; (2) 3 tarjetas de entrada on the home; (3) microcopy "cómo leer esto" in 4 complex sections; (4) F-04 bounded mobile-graph fix; (5) `/buscar` submit button token fix + inherited minors; (6) demo screenshot set `docs/demo/`.
>
> **Hard bounds (54-CONTEXT, LOCKED):** CERO DDL, CERO flag flips, CERO new dependencies, hero content LOCKED intacto, `mt-12` carril frontiers untouched, `nombre_normalizado` data/keys/matching untouched (formatter is render-time only). One final redeploy (docker-cf-build.sh + wrangler) that also carries the F53 post-deploy fixes (WR-01 gate-aware nav, `px-2` mobile nav, `pl-1` arrow).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `app/components.json`, Slate baseline) |
| Preset | Slate baseline extended by cream/petróleo tokens (DESIGN-SYSTEM §1, LOCKED) |
| Component library | Radix UI (already shipped). **No new primitive this phase.** |
| Icon library | Inline Unicode glyphs only (`→` inside card/continuation links, `aria-hidden`, with `pl-1` — never a whitespace text node inside flex, F53 lesson). No lucide addition. |
| Font | Geist Sans (prose/UI) + Geist Mono (boletín, dates, counts) |
| New dependencies | **none** (F-04 fix uses only what `@xyflow/react` already shipped supports) |

Token rule (inherited, LOCKED): Tailwind v4 utility classes — `text-accent-product`, NEVER `text-[--accent-product]`. This phase **fixes** the one shipped violation of this rule (identity-warn, §5b below).

---

## Spacing Scale

Inherited verbatim from DESIGN-SYSTEM §3 (8-point, multiples of 4). No new token.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1` / `pl-1` | Arrow padding inside links (shipped pattern) |
| sm | 8px | `mt-2` / `pb-8` | Microcopy line ← gap under its heading/intro; hero bottom-padding floor (mobile) |
| md | 16px | `p-4` / `gap-4` / `mb-4` | **Tarjeta padding + grid gap** (compact — deliberately tighter than the `p-6` Panel to hold the fold) |
| lg | 24px | `p-6` | (inherited card padding elsewhere — untouched) |
| xl | 32px | `md:px-8` / `pb-8` | Page horizontal padding (unchanged); reduced hero bottom padding |
| **2xl** | **48px** | **`mt-12`** | **Carril boundary — LOCKED. This phase NEVER moves, collapses, or nests a carril.** |
| 3xl | 64px | `py-16` | (inherited page rhythm — untouched except the hero seam, §2 below) |

**Exceptions:** touch-target minimum **44px** (`min-h-11`) on every interactive element added this phase (each tarjeta is a full-card `<Link>` far exceeding 44px; the `/buscar` button is `h-12` = 48px). Graph canvas heights use Tailwind v4 dynamic spacing utilities on the 4px grid: `h-96` (384px) / `md:h-120` (480px) — no arbitrary `[Npx]` values.

---

## Typography

Inherited verbatim from DESIGN-SYSTEM §2. Exactly 2 weights (400 / 600). No new size.

| Role | Size | Weight | Line Height | Tailwind | Usage in this phase |
|------|------|--------|-------------|----------|---------------------|
| Body | 16px | 400 | 1.5 | `text-base leading-relaxed` | (inherited — untouched) |
| Label / meta | 14px | 400 | 1.4 | `text-sm` | Tarjeta value line, microcopy "cómo leer esto", mobile graph note |
| Card title | 16px | 600 | 1.375 | `text-base font-semibold leading-snug` | Tarjeta title (matches shipped actualidad item-title pattern; NOT a heading element — see hierarchy rule) |
| Section (h2) | 20px | 600 | 1.3 | `text-xl font-semibold` | (inherited — untouched) |
| Mono (metadata) | 14px | 400 | 1.4 | `font-mono text-sm` | (inherited — untouched) |

**Heading hierarchy untouched:** the tarjetas block is a `<nav aria-label="Secciones del sitio">` with `<Link>` children whose titles are `<span>`, **never `h2`/`h3`** — it sits between the hero `h1` and the actualidad `h2`s without inserting a heading level. Names formatted by `formatNombre()` keep their shipped element/size/weight verbatim (only the string changes).

---

## Color

Inherited verbatim from DESIGN-SYSTEM §1 (60/30/10 cream · warm surface · petróleo). No new color. No destructive action (read-only product).

| Role | Value (light) | Usage |
|------|---------------|-------|
| Dominant (60%) | `hsl(40 33% 97%)` `--background` | Page canvas (unchanged) |
| Secondary (30%) | `hsl(40 30% 99%)` `--card` / `hsl(40 20% 93%)` `--muted` | Tarjeta surface (`bg-card` + `border-border`, shipped Panel tokens) |
| Accent (10%) | `hsl(183 38% 26%)` `--accent-product` | See reserved-for list |
| Destructive | `hsl(0 72% 42%)` `--destructive` | **Unused** |

**Accent (petróleo) reserved-for in this phase (EXPLICIT):**
1. `/buscar` **submit button background** — `bg-accent-product text-background hover:bg-accent-product/90` (aligns the non-hero search CTA with the shipped hero CTA; fixes the 53-UI-REVIEW blue-default drift).
2. Tarjeta **hover border**: `hover:border-accent-product/50` (shipped chip pattern) — never a filled accent card.
3. Keyboard focus ring (`--ring`, petróleo) on tarjetas and the buscar button.
4. All shipped accent uses (nav active underline, continuation links, breadcrumb hover) — inherited, untouched.

**Accent is NOT used for:** tarjeta titles, tarjeta value lines, the `→` glyph inside tarjetas (it inherits the title color), microcopy lines, the mobile graph note, any name rendered by `formatNombre()`, any heading, any count.

**Identity-warn token (§5b):** `--identity-warn-bg/fg/border` stay defined in `civic-tokens.css` with their current HSL values (light + dark). The FIX is syntax-only: register them as theme colors (`--color-identity-warn-bg: var(--identity-warn-bg);` etc. in the `@theme` block) and replace `bg-[--identity-warn-bg]`-style arbitrary-var classes with plain utilities `bg-identity-warn-bg text-identity-warn-fg border-identity-warn-border` in `identity-marker.tsx:16-17` and `lobby-de-parlamentario.tsx:262-263`. Zero visual change — a screenshot before/after must be pixel-identical for the marker.

---

## Contract 1 — `formatNombre()` (display-only, `app/lib/format.ts`)

Pure helper next to `fechaCorta`. **Frontend render-time only** — `nombre_normalizado` stays the matching key and the PII-safe projection everywhere; RPC params, React keys, hrefs and comparisons ALWAYS use the raw string.

### Signature and rules (prescriptive)

```ts
export function formatNombre(raw: string | null | undefined): string
```

1. `null` / `undefined` / whitespace-only → `""` (callers keep their existing null-fallback logic untouched).
2. **Passthrough guard (load-bearing):** if the string contains **any uppercase letter**, return it **verbatim** — it is already display-cased by the source (e.g. `"Boris Barrera Moreno"`, `"AFP HABITAT"`). Re-casing it would fabricate display (e.g. `"AFP"` → `"Afp"`). Only fully-lowercase strings are transformed.
3. For fully-lowercase input: collapse whitespace runs to single spaces, split into tokens.
4. **Partículas** — exact list, lowercase, LOCKED (54-CONTEXT): `de, del, la, las, los, van, von, y`. A particle token stays lowercase **except when it is the first token** (first token is always capitalized: `"de la maza carlos"` → `"De la Maza Carlos"`).
5. Non-particle tokens: capitalize the first letter of each **sub-token** split on `-` and `'` (delimiters preserved): `"o'higgins"` → `"O'Higgins"`, `"perez-mackenna"` → `"Perez-Mackenna"`.
6. **NEVER** add accents (`"gonzalez"` → `"Gonzalez"`, never `"González"` — the source has no tilde; adding one fabricates data). **NEVER** reorder tokens (token order in `nombre_normalizado` is inconsistent — inferring surname would fabricate identity). **NEVER** strip or normalize interior punctuation.

### Required test cases (RTL/vitest, co-located)

| Input | Output |
|-------|--------|
| `"gonzalez sofia"` | `"Gonzalez Sofia"` |
| `"maria de los angeles"` | `"Maria de los Angeles"` |
| `"de la maza carlos"` | `"De la Maza Carlos"` |
| `"o'higgins"` | `"O'Higgins"` |
| `"perez-mackenna"` | `"Perez-Mackenna"` |
| `"irarrazaval  juan"` (double space) | `"Irarrazaval Juan"` |
| `"Boris Barrera Moreno"` (mixed case) | unchanged (passthrough) |
| `"AFP HABITAT"` (all caps) | unchanged (passthrough) |
| `null` / `""` / `"   "` | `""` |
| idempotence: `formatNombre(formatNombre(x)) === formatNombre(x)` | holds for every case above |

### Surface inventory (apply at ALL of these render points — and ONLY at render points)

| # | File : line (as of 2026-07-07) | What | Note |
|---|-------------------------------|------|------|
| 1 | `app/components/parlamentario-header.tsx:69` + breadcrumb current segment (`:57-63`) | Ficha h1 + breadcrumb | Same formatted string in both |
| 2 | `app/components/parlamentario-directory-row.tsx:37` | Directorio `/parlamentarios` | |
| 3 | `app/components/voto-row.tsx:45,49` | Roll-call en ficha proyecto (linked + unlinked branches) | Link guard (`estado_vinculo==="confirmado"`) untouched |
| 4 | `app/components/voto-ficha-row.tsx:213` | `mencion_nombre` en lista de votos | |
| 5 | `app/components/lobby-de-parlamentario.tsx:236` | `contraparte_nombre` | Passthrough guard governs raw-case company names |
| 6 | `app/components/lobby-en-tramitacion.tsx:130` | `parlamentario_nombre` en carril lobby×tramitación | **TEXT STAYS PLAIN / NOT LINKED (LOCKED 52-03)** — only the case changes. React key at `:237` keeps the RAW name |
| 7 | `app/components/cruces-de-parlamentario.tsx:56` | `ContraparteCruda` | `IdentityMarker` untouched |
| 8 | `app/components/red/nodo-parlamentario.tsx:43,51` | Node label + `aria-label` | |
| 9 | `app/app/red/page.tsx:108,115` | Seed `<select>` option labels | `option value={r.id}` untouched |
| 10 | `app/app/contraparte/[id]/page.tsx:149` + its breadcrumb | Gated ficha (invisible in PROD, future-proof) | |
| 11 | `app/components/citacion-card.tsx:97` | Invitados en `/agenda` | |

**NOT applied:** admin surfaces (`/admin/*` — not citizen-facing); `/buscar` results and actualidad module (render project titles, not personal names); any key/param/href/comparison.

**Documentation:** 1 line in `/metodologia` (or the data section of `/sobre` if that is where the data notes live): missing tildes in names are a known limitation of the source data; the site never adds accents the source does not carry.

---

## Contract 2 — 3 tarjetas de entrada (home)

**Placement:** `app/app/page.tsx`, a new server-rendered block **between** the hero `<section>` and `<ActualidadModule />`. Zero client JS. Semantics: `<nav aria-label="Secciones del sitio">` containing three full-card `<Link>`s — **no heading element** inside the block.

**Layout:**
- Container: `mx-auto max-w-5xl px-4 md:px-8` (matches ActualidadModule width) with `pb-12 md:pb-16` below.
- Grid: `grid gap-4 sm:grid-cols-3` — **stacks to 1 column on mobile** (<640px), 3 across from `sm` up.
- Card: `rounded-lg border border-border bg-card p-4` (compact Panel variant) + `transition-colors hover:border-accent-product/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`. The whole card is the link target (`block`), trivially ≥44px.
- Card content: title `<span class="text-base font-semibold leading-snug">` with the `→` glyph appended `<span aria-hidden="true" class="pl-1">→</span>` (padding, never whitespace, F53 lesson) + value line `<p class="mt-1 text-sm text-muted-foreground">`.

**Above-the-fold contract (1280×800 desktop):** hero + the three tarjetas fully visible without scroll, verified by the harness screenshot. Hero **content** (h1, subtitle, SearchBox+chips, trust line, "¿Cómo leer esto?") stays **byte-identical** (LOCKED F19); the only lever is the hero `<section>` **bottom padding** — the seam where the new block is inserted: change `py-16 md:py-24` → `pt-16 pb-8 md:pt-24 md:pb-10`. If the fold check still fails at 1280×800, the floor is `pb-8 md:pb-8`; hero top padding and content are NEVER touched. Acceptance evidence: `docs/demo/demo-01-home-1280.jpg` shows all three cards complete.

**Copy (exact, es-CL, factual — titles LOCKED by CONTEXT, value lines prescribed here):**

| Tarjeta (title, LOCKED) | Href | Value line (1 línea) |
|--------------------------|------|----------------------|
| `Proyectos de ley` | `/buscar` | `En qué etapa está cada proyecto y cómo se ha votado, con cada fuente enlazada.` |
| `Parlamentarios 360` | `/parlamentarios` | `Votaciones, lobby y patrimonio de cada parlamentario, según los registros públicos.` |
| `Agenda de la semana` | `/agenda` | `Citaciones de comisiones y tabla de sala, enlazadas a cada proyecto.` |

Every string passes the banned-vocab negative-match (no "limpio/transparente", no causal/affinity/score language, no promises, no fabricated stats).

---

## Contract 3 — Microcopy "cómo leer esto" (integrate-or-omit per section)

Pattern: **1 línea factual al pie del heading** — `<p class="text-sm text-muted-foreground mt-2">` (or appended to an existing intro paragraph). Rule (LOCKED): **NEVER duplicate an existing caveat** — where an anti-causal caveat already exists, the line integrates into it or the section is omitted. Every string passes banned-vocab (per-component regexes include `correlaci|af[ií]n|influy|cercano|rebeld|score|porque` — the copy below is vetted against them).

| Section | Decision | Exact contract |
|---------|----------|----------------|
| **Cruces** (`cruces-de-parlamentario.tsx:89-93` intro) | **INTEGRATE** | Append ONE sentence to the existing intro paragraph (same `<p>`, after "…apunta al registro original."): `Un cruce solo agrupa reuniones registradas por sector; no afirma intención ni causa.` The empty-state string below it stays byte-identical. |
| **Rebeldías / "Votó distinto a su bancada"** (`votos-por-parlamentario.tsx:677-734`) | **INTEGRATE (relocate)** | The shipped method footnote `Se compara el voto del parlamentario con la opción mayoritaria de su bancada en esa misma votación.` moves from below the list (`:728-731`) to directly under the `h3` (before the conteo), **string byte-identical** (RTL `getByText` asserts keep passing). No new string. Empty branch (`:681-683`) untouched — no line there. Never renders twice. |
| **Patrimonio** (`patrimonio-de-parlamentario.tsx:514-525` intro) | **ADD (no existing how-to-read line)** | Append ONE sentence to the first intro paragraph (after "…con su fecha de presentación."): `Un mismo parlamentario puede registrar varias versiones; cada una es una presentación distinta ante la fuente.` CC BY line and the chart's montos caveat untouched. |
| **Red** (`app/app/red/page.tsx:83-87` and `:157-160`) | **OMIT** | Both branches already carry the anti-causal reading line ("…no afirma intención ni causa." / "Cada relación se muestra con su fuente y su fecha."). Adding another would duplicate. **No change** to /red page copy. (The mobile note of Contract 4 lives inside the graph island and is a legibility note, not a reading caveat — it does not violate this OMIT.) |

---

## Contract 4 — F-04: grafo `/red` en móvil (bounded fix, NO redesign)

File: `app/components/red/red-graph.tsx`. Constraint (LOCKED): only what `@xyflow/react` already supports without significant new JS; deterministic per-cámara grid layout NEVER becomes a physics simulation (anti-insinuación).

1. **Adaptive canvas height:** replace `style={{ height: 480 }}` on `.net-lienzo` with token classes `h-96 md:h-120` (384px mobile / 480px ≥768px). No inline style, no arbitrary `[Npx]`.
2. **Compact legend/filters on mobile:** the `.net-filtros` block (type checkboxes + date window) stacks vertically and tightens on <768px — CSS-only change in the existing `net-*` stylesheet (e.g. column flex, reduced gaps on the 4/8px scale). No filter is removed, no control hidden; the date inputs keep `font-mono` and their labels.
3. **Honest legibility note (mobile only):** ONE line rendered above the canvas, visible only below `md`: `<p class="mt-4 text-sm text-muted-foreground md:hidden">El grafo se lee mejor en pantalla ancha; en pantallas angostas puede verse comprimido.</p>` — visible, non-blocking, factual; never an overlay, never hides the graph.
4. **Allowed xyflow knobs (discretion):** `fitViewOptions` padding / `minZoom` adjustments to reduce initial label overlap at 390px. NOT allowed: new layout algorithm, node clustering, physics, label truncation that hides names.
5. **Untouched:** empty-state branch (honest copy + continuation line), filter semantics (`tiposOcultos` set), edge/node types, provenance tooltips.

**Acceptance:** 390×844 screenshot of `/red?seed=D1012` — canvas visible, note visible, filters usable; desktop 1280 pixel-equivalent to today (h-120 = 480px).

---

## Contract 5 — `/buscar` submit button + inherited minors (F53 → F54)

**5a. Submit button (color drift, 53-UI-REVIEW Pillar 3):** `app/components/search-box.tsx:119-126` — the non-hero branch class changes from `"h-12"` to `"h-12 bg-accent-product text-background hover:bg-accent-product/90"`. Label stays `Buscar` (verb, shipped). Weight stays as-shipped for the non-hero branch (do NOT propagate the hero's `font-semibold` unless it is already there). Hero branch byte-identical.

**5b. Identity-warn token syntax:** per §Color above — `@theme` registration + plain utilities in `identity-marker.tsx` and `lobby-de-parlamentario.tsx`. Zero visual delta.

**5c. IN-03 skeleton CLS:** `FichaHeaderSkeleton` / `ParlamentarioHeaderSkeleton` gain a breadcrumb placeholder row ABOVE the title shimmer, matching the real breadcrumb box: a `min-h-11 mb-4` row containing one `h-4 w-48 rounded bg-muted` bar (`animate-pulse` if the shipped skeletons use it). Eliminates the layout shift when Breadcrumbs stream in.

**5d. Code-only minors (no visual contract, listed for completeness):** IN-01 unused `within` import; IN-02 stale test title; IN-04 stale nav docstring.

**5e. F-05 woff2 preload warnings:** if the remedy is a 1-line `next/font` config change (e.g. `preload: false` on unused weights of the Geist import), apply it; otherwise document the finding in the phase summary and defer. Never a layout/FOUT regression — if disabling preload visibly flashes fonts, defer.

**5f. Final redeploy (operational, carried by this phase):** one deploy (docker-cf-build.sh → docker cp → `npx wrangler deploy`) that includes the F53 post-deploy commits (WR-01 gate-aware `showRed`, nav `px-2` mobile fit, `pl-1` arrows) plus everything above. Post-deploy smoke: NET gate ON verified live in PROD, OFF verified by test only (NEVER flipping PROD); key surfaces (`/`, `/buscar`, `/proyecto/*`, `/parlamentario/*`, `/agenda`, `/red`) return 200.

---

## Contract 6 — Demo screenshot set (`docs/demo/`)

Captured with `scripts/rewalk-shot.mjs` (iframe harness) **AFTER the final deploy**, against PROD, desktop **1280**. Named by surface. **≥6 captures**, canonical set:

| # | File | Subject | Must show |
|---|------|---------|-----------|
| 1 | `docs/demo/demo-01-home-1280.jpg` | `/` | Hero + 3 tarjetas fully above the fold (doubles as Contract 2 acceptance) |
| 2 | `docs/demo/demo-02-buscar-1280.jpg` | `/buscar?q=protección de datos personales` | Semantic results + petróleo submit button (5a) |
| 3 | `docs/demo/demo-03-proyecto-1280.jpg` | Ficha proyecto | The lobby×tramitación carril RENDERED (pick a boletín whose carril has rows; if 14309-04 lacks it, choose one that has it) |
| 4 | `docs/demo/demo-04-parlamentario-1280.jpg` | Ficha parlamentario (e.g. D1012) | Rich sections (votos + lobby + patrimonio + cruces) with formatted names |
| 5 | `docs/demo/demo-05-agenda-1280.jpg` | `/agenda` | Citaciones + tabla de sala with boletín cross-links |
| 6 | `docs/demo/demo-06-red-1280.jpg` | `/red?seed=D1012` | Populated graph + filters |

**Quality gate (F53 lesson):** the 1280 captures must be **full-width** (image width ≥1260px, no right-crop from the harness' 772px parent viewport — widen the harness page/viewport before capturing). JPEG is fine (q≈70). Additional mobile 390 shots are welcome but do not replace the 6 desktop canonicals. These images ship in the repo as the presentation evidence set.

---

## Copywriting Contract (template summary)

Chilean Spanish, neutral-factual, sober. Every new string passes the DESIGN-SYSTEM §6 banned-vocabulary negative-match. **PROHIBIDO fabricar virtud** ("limpio", "transparente", "nada que ocultar" never appear).

| Element | Copy |
|---------|------|
| Primary CTA | `Buscar` (shipped, `/buscar` submit — Contract 5a restyles color only). Tarjetas are plain `<Link>`s, not CTAs. |
| Empty state heading | Not applicable — empty states stay single honest paragraphs (shipped pattern, byte-identical this phase). |
| Empty state body | ALL shipped honest strings + F53 continuation lines stay **VERBATIM** (test-asserted, LOCKED). This phase adds none. |
| Error state | Inherited unchanged (throw → "No pudimos cargar este dato. Intenta recargar la página."). No new error surface. |
| Destructive confirmation | Not applicable — no destructive action exists (read-only product). |
| New copy this phase | 3 tarjeta value lines (Contract 2), 2 microcopy sentences + 1 relocation (Contract 3), 1 mobile graph note (Contract 4), 1 metodología limitation line (Contract 1). Total: 7 new strings, all prescribed verbatim above. |

---

## Component Inventory

| Component / file | Action | Contract |
|------------------|--------|----------|
| `app/lib/format.ts` | **Extend** | Add `formatNombre()` per Contract 1 + tests. Existing helpers byte-identical. |
| 11 name-render surfaces (Contract 1 table) | **Extend (display call only)** | Wrap the rendered string in `formatNombre(...)`. Keys/params/hrefs/guards untouched. |
| `app/app/page.tsx` | **Extend** | Insert tarjetas `<nav>` between hero and `<ActualidadModule />`; hero content byte-identical; hero section bottom padding per Contract 2. |
| `cruces-de-parlamentario.tsx`, `votos-por-parlamentario.tsx`, `patrimonio-de-parlamentario.tsx` | **Extend** | Microcopy per Contract 3 (integrate/relocate/add — exact strings prescribed). |
| `app/app/red/page.tsx` | **DO NOT TOUCH (copy)** | Contract 3 OMIT — existing anti-causal lines suffice. |
| `app/components/red/red-graph.tsx` (+ `net-*` CSS) | **Extend** | F-04 bounded fix per Contract 4. |
| `app/components/search-box.tsx` | **Extend** | Non-hero submit → petróleo (Contract 5a). Hero branch byte-identical. |
| `identity-marker.tsx`, `lobby-de-parlamentario.tsx:262-263`, globals/`civic-tokens.css` | **Fix (syntax)** | Identity-warn token utilities (Contract 5b). Zero visual delta. |
| Ficha skeletons | **Extend** | Breadcrumb placeholder row (Contract 5c). |
| `lobby-en-tramitacion.tsx` | **Case-only** | `formatNombre` at `:130`; plain text / no link (LOCKED 52-03); anti-causal caveat byte-identical. |
| `docs/demo/` (new) | **Add** | ≥6 post-deploy screenshots per Contract 6. |
| `/sobre` or `/metodologia` data notes | **Extend (1 line)** | Tildes limitation note (Contract 1). |

---

## Interaction Contracts

Server-driven. **Zero new client island** — the only client code touched is inside the existing `RedGraph` island (Contract 4) and `SearchBox` (class string only).

| Control | Mechanism | Behavior |
|---------|-----------|----------|
| Tarjeta | static `<Link>` (full card) | Hover border accent/50; focus ring; works without JS |
| Buscar submit | shipped `<form>` submit | Color change only; behavior untouched |
| Graph filters (mobile) | shipped client island | Same semantics, compact CSS layout |

**Mobile contracts (390×844, first-class):**
- Tarjetas stack 1-column, full-width, `gap-4`; whole card tappable (≥44px).
- Graph: `h-96` canvas + compact filters + visible legibility note (Contract 4).
- Header nav: the F53 `px-2` mobile fix ships in the final deploy — nav items fit 1 wrapped row at 390 (verify in post-deploy evidence).

---

## Anti-insinuación Invariants (HARD — inherited, load-bearing)

1. **Carril frontier LOCKED.** No `mt-12` carril moves, merges, nests, or collapses.
2. **formatNombre is display, never identity.** It never reorders, never accents, never merges tokens — and NEVER touches matching keys, RPC params, React keys, or hrefs. Case change ≠ identity assertion; link guards (`estado_vinculo === "confirmado"`) untouched.
3. **Lobby×tramitación names stay plain text** (LOCKED 52-03) — only the case changes.
4. **Microcopy states facts, never verdicts.** No causal/affinity/score language; existing caveats never duplicated; honest empty states byte-identical.
5. **Empty ≠ virtue.** No "limpio/transparente/nada que ocultar" anywhere, including tarjeta copy and demo doc filenames/captions.
6. **Zero flag flips, zero DDL, zero RPC change, zero new deps.** NET gate OFF is verified by test, never by flipping PROD.
7. **Provenance untouched.** No fix removes or relocates a `ProvenanceBadge` or per-row source link; graph edge tooltips keep origen/enlace/licencia.
8. **Graph stays a deterministic grid** — no physics, no proximity-as-relation, no aggregate measures (Contract 4 bounds).

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
