---
phase: 19
slug: producto-diseno-brief-y-cierre-de-diseno-del-frontend
artifact: SCREENS.md
status: closed
derived_from: 19-UI-SPEC.md §11 (approved)
companions: [DESIGN-SYSTEM.md, BRIEF.md]
created: 2026-06-20
---

# Phase 19 — SCREENS.md · Per-Screen Contracts (CLOSED)

> The **CLOSED per-screen contract set** for the Observatorio del Congreso 360 frontend.
> Derived from the approved `19-UI-SPEC.md` §11; companion to `DESIGN-SYSTEM.md` (tokens,
> component catalogue, honest states, anti-insinuación invariants) and `BRIEF.md` (value
> per surface, IA, landing/hero). Every screen below is **implementation-ready**: an
> implementation phase can build it directly from this file + `DESIGN-SYSTEM.md`, with no
> interpretation and nothing left "abierto" or "por decidir".
>
> **How to read each contract.** Each screen uses the same template:
> **Route · Layout · Components · Structure · States · Anti-insinuación + traceability ·
> Copy.** Layouts are expressed as Tailwind class strings inline; structure is prose/lists.
> No fenced code blocks of applied source — this is a spec, not an implementation.

> **Banned-vocabulary fence convention (DS §6).** Where this document must *name* a banned
> anti-feature in order to forbid it, the term lives inside a
> `<!-- BANNED-VOCAB-START --> … <!-- BANNED-VOCAB-END -->` fence so the document's own prose
> passes the negative-match. Outside the fence, the anti-insinuación voice is observed
> throughout: no causal / affinity / score / ranking-as-verdict language.

---

## Invariants that bind EVERY screen below (DS §10, restated for executors)

These are not optional and are repeated per screen only where they bite hardest:

1. **ProvenanceBadge per datum.** Every datum shown carries `ProvenanceBadge` (source · date ·
   link). Never omitted; stale >48h → amber; null source → "fuente desconocida" without link.
2. **Carril propio (anti-insinuación).** Every data domain is a sibling
   `<section class="mt-12">` with its own `<h2>`, `Suspense`, skeleton, and honest empty.
   Carriles are NEVER nested; the `mt-12` gap is the carril frontier and is **never collapsed**.
3. **Never composite.** A meeting / declaration / contract / contribution and a vote NEVER
   share an `<article>` / `<Card>` / `<li>` / `<tr>`.
4. **Identity guard.** An entity links to a ficha ONLY if `estado_vinculo = confirmado`;
   otherwise raw name + `IdentityMarker` ("identidad no verificada"), never a link.
5. **No foto, no partido.** Parlamentario surfaces never render a photo or partido chip
   (LEGAL-03); the RPC never emits partido / rut / email.
6. **MONEY gated.** OFF (default) = the node is **absent** from the HTML (not CSS-hidden).
   Design reads coherently in BOTH the OFF state (section/route simply absent) and the
   future ON state. Stays OFF until LEGAL-01.
7. **No invented data.** Specs exploit only shipped data + the NEW spec-only components in
   the DS catalogue. "Nice but no data" → deferred, marked, never designed as real.
8. **Civic colours are data, not brand.** `--camara` / `--senado` identify the institutional
   chamber of a datum only — never the product accent, link, or general UI colour.

The three **honest states** (DS §9) are textually and visually distinct on every data section:
**No consultado** ("Esta fuente aún no ha sido consultada…") ≠ **Consultado sin resultados**
("No hay {X} registradas… en las fuentes consultadas.") ≠ **Error** ("No pudimos cargar este
dato. Intenta recargar…"). An empty section must NEVER read as "clean/complete." Loading is a
**shape-matched skeleton**, never a spinner that hides structure.

---

## 1. GlobalHeader (NEW — `layout.tsx`)

- **Route / scope:** persistent across all routes; rendered in the root `layout.tsx` above
  `{children}`. Component: `GlobalHeader` (NEW spec-only, DS §7.2).
- **Layout:** full-width bar, cream background (`bg-background`), subtle bottom border
  (`border-b border-border`); inner row `max-w-5xl mx-auto px-4 md:px-8`; height ~56px
  (`h-14`); `flex items-center justify-between`. Sticky is **optional** (`sticky top-0 z-40`
  if adopted) — not required, not load-bearing.
- **Components used:** wordmark link (Geist Sans semibold), nav links (`<Link>`), a compact
  mobile menu (Radix-free disclosure or `<details>`); no new icon dependency (Unicode glyph
  for the menu toggle if needed). No `Button` chrome on nav links — they are plain links with
  a petrol active underline.
- **Structure (left → right):**
  - **Left:** wordmark **"Observatorio del Congreso 360"** → `/` (home). Geist Sans semibold,
    `text-base`. This is the only brand mark; no logo image.
  - **Right (desktop, `hidden md:flex gap-6`):** four nav entries —
    **`Buscar`** (`/buscar`) · **`Parlamentarios`** (`/parlamentario`) · **`Agenda`**
    (`/agenda`) · **`Sobre / Metodología`** (`/sobre`). The active item carries a **petrol
    underline** (`--accent-product`); inactive items are foreground text with a petrol hover.
  - **Mobile (`md:hidden`):** wordmark + a compact menu control; the four links collapse into
    a disclosure panel. Touch targets **≥44px** (`min-h-11`, `py-` padding) on every link and
    the toggle, even when visually shorter.
- **States:** static chrome — no empty / loading / error states. Active-link state is derived
  from the current pathname (petrol underline). No skeleton.
- **Anti-insinuación + traceability:** carries no data → no `ProvenanceBadge`. The active
  underline uses the **product petrol** accent, never a civic colour (no political reading).
  No auth / login (the product has no accounts). No required theme toggle — system dark mode
  is honoured; an explicit toggle is optional, NOT required.
- **Copy (exact):** wordmark "Observatorio del Congreso 360"; nav labels exactly
  `Buscar`, `Parlamentarios`, `Agenda`, `Sobre / Metodología`.

---

## 2. Landing `/` (search-as-hero)

- **Route:** `/` — the landing. Server Component shell; `SearchBox` is the one client island.
- **Layout:** `max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24` on cream (`bg-background`).
  Single centred reading column; the search is the protagonist, vertically generous.
- **Components used:** Display headline (DS Typography display role); `SearchBox` (shipped
  client island) as hero; `ExamplePills` (NEW spec-only) — the 4 LOCKED pills; `TrustLine`
  (NEW spec-only); `OnboardingHints` (NEW spec-only) inline "¿Cómo leer esto?".
- **Structure (top → bottom):**
  1. **Hero headline** — Display (36→48px, `text-4xl md:text-5xl font-semibold leading-tight`),
     sober and confident, containing **exactly ONE italic petrol accent phrase** (the "Sin
     alucinaciones." pattern, rendered in `--accent-product`). Never more than one italic
     phrase; no fabricated stats in the headline.
  2. **SearchBox (the single hero)** — `autofocus`, petrol **focus ring**
     (`--ring` retuned to petrol), with the petrol **"Buscar proyectos"** submit button. This
     is the protagonist of the page; nothing competes with it above the fold.
  3. **Example pills** — the **4 LOCKED pills** below the box (3 ideas-matriz + 1 boletín):
     "protección de datos personales" · "delitos económicos y medio ambiente" ·
     "40 horas / jornada laboral" · boletín nº `15234-07` (rendered in **Mono**). Clicking a
     pill **fills the box and submits** (pills ARE the query — verb-free). Pills 1–3 exercise
     semantic search; pill 4 exercises the boletín-number lookup path.
  4. **Trust line** — under the pills, muted (`text-sm text-muted-foreground`),
     bullet-separated: the LOCKED line (see Copy).
  5. **Onboarding inline** — a single **"¿Cómo leer esto?"** micro-affordance link
     (`OnboardingHints`). **No modal, no tour** — inline only.
  - **Background:** typographic / paper texture only. **Graph motif DEFERRED** — no ambient
    node graph (that is Phase 18; a decorative people-graph would risk insinuación).
- **States:** **empty (not yet queried)** is the default landing state — heading
  **"Aún no has buscado"** semantics + the example pills as the discovery affordance. The
  shell is **static** → **no loading, no error** state on the landing itself (DS §9 matrix:
  `n/a` for loading/error). The act of searching navigates to `/buscar`, which owns those
  states.
- **Anti-insinuación + traceability:** no data is rendered on the landing → no
  `ProvenanceBadge` here (the trust line *promises* provenance, it does not assert a datum).
  **No** marketing sections, testimonials, or fabricated counts; any count shown anywhere is a
  real `count(*)` or nothing. The single italic phrase is the only accent flourish.
- **Copy (exact):**
  - Hero submit CTA: **"Buscar proyectos"**.
  - Empty heading: **"Aún no has buscado"** · body: "Escribe una idea (p. ej. *protección de
    datos personales*) o un número de boletín para empezar."
  - Trust line (LOCKED): **"Fuente, fecha y enlace en cada dato · Sin afirmar intención ni
    causalidad."**
  - Onboarding link: **"¿Cómo leer esto?"**

---

## 3. Resultados de búsqueda `/buscar` (results)

- **Route:** `/buscar?q=…` — results for a query. Server Component reads results server-side
  (relevance order = raw HNSW distance ASC); `SearchBox` persists as a client island.
- **Layout:** `max-w-5xl mx-auto px-4 md:px-8`, **two-column on `lg`**
  (`lg:grid-cols-[1fr_320px] lg:gap-8`): main results column + `MapaDeFuentes` sidebar. The
  sidebar **stacks below** the results on mobile/tablet (single column).
- **Components used:** persistent `SearchBox`; `OnboardingHints` (dismissible hint bar);
  `AiSummaryCallout` banner (optional); `SourceTypeTabs` (NEW spec-only); `SearchResultCard`
  (shipped) with `EtapaBadge` + `CamaraChip` + `ProvenanceBadge`; `MapaDeFuentes` sidebar
  (NEW spec-only); `HonestEmptyState`; shape-matched skeleton cards.
- **Structure (top → bottom, main column):**
  1. **Persistent search bar** — `SearchBox` at top, **pre-filled** with the active query,
     petrol focus ring; submit label **"Buscar"**.
  2. **Onboarding hint bar** — inline, **dismissible** ("Entendido"); adapted from the
     "¿Cómo leer el mapa?" pattern. Not a modal.
  3. **AI affordance (when applicable)** — an `AiSummaryCallout`-style banner:
     "Analizar resultados · síntesis sobre estas fuentes · la fuente original queda íntegra."
     Labelled, **optional**, and it **never replaces the sources** — the source list always
     stands intact below.
  4. **Result header** — **"N fuentes · ordenadas por relevancia"** using **REAL counts only**
     (real `count(*)` or nothing). There is **NO per-result score and no relevance bar / no
     percentage** anywhere on this surface; ordering is by implicit relevance only.
  5. **SourceTypeTabs** — `Todo` / `Proyectos` / (other **real** source types) — per-tab
     counts are real or absent (never faked). The active tab carries the petrol underline.
  6. **Result cards** — `SearchResultCard` per hit: boletín in **Mono**, `EtapaBadge`,
     `CamaraChip`, title, `ProvenanceBadge`. **No relevance bar, no score.**
- **Structure (sidebar, desktop):**
  - **`MapaDeFuentes`** — a mini summary of result **composition by source type**, count-coded
    and shape-coded. It is **NEVER a people graph** (deferred) and **NEVER a score**; it
    summarizes which sources the results came from, nothing more.
- **States (DS §9 matrix for `/buscar`):**
  - **Empty (no query):** treated as the landing empty — redirect/return to the "Aún no has
    buscado" + pills posture (the landing owns the no-query state).
  - **Zero results:** heading **"Sin resultados para esta búsqueda"** + the example pills as
    recovery affordance; body "No encontramos proyectos que coincidan. Prueba con otra idea o
    revisa el número de boletín."
  - **Loading:** **shape-matched skeleton cards** (mirror `SearchResultCard` shape), never a
    spinner.
  - **Error:** heading **"No pudimos completar la búsqueda…"** with a recovery step; never
    silently degrades to "zero results."
- **Anti-insinuación + traceability:** every result card carries `ProvenanceBadge`. The
  invariant in force here is **no relevance % / no score** (DS §10.4): neither the header, the
  tabs, nor the `MapaDeFuentes` ever expose a per-result score —
  <!-- BANNED-VOCAB-START --> no "puntaje", no "% de coincidencia", no affinity bar
  <!-- BANNED-VOCAB-END -->. The `MapaDeFuentes` shows composition/counts, never people. The
  AI banner is labelled and additive (source intact). Civic chips on cards identify the
  chamber of the datum only.
- **Copy (exact):**
  - Persistent CTA: **"Buscar"**.
  - Result header pattern: **"N fuentes · ordenadas por relevancia"** (N = real count).
  - Hint dismiss: **"Entendido"**.
  - AI banner: "Analizar resultados · síntesis sobre estas fuentes · la fuente original queda
    íntegra."
  - Zero results: **"Sin resultados para esta búsqueda"** · "No encontramos proyectos que
    coincidan. Prueba con otra idea o revisa el número de boletín."
  - Error: **"No pudimos completar la búsqueda…"**
