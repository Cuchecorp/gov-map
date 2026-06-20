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

---

## 4. Ficha de proyecto `/proyecto/[boletin]`

- **Route:** `/proyecto/[boletin]` — the project ficha. Server Component; `[boletin]` is
  validated before any DB call (404 on invalid). Carriles use `Suspense` + shape-matched
  skeleton, mirroring the shipped stacked-carriles shell.
- **Layout:** `max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16` single column. An **optional**
  `MapaDeFuentes` / "proyectos relacionados" sidebar may appear on `lg` (`max-w-5xl` +
  `lg:grid-cols-[1fr_320px]`); it is additive and never required for the column to read.
- **Components used:** `FichaHeader`; `IdeaMatrizBlock` wrapped in `AiSummaryCallout`;
  `CuerposLegalesList`; `TimelineView` / `TimelineEvent`; `VotacionCard` / `VotoRow`;
  `ProyectosSimilares`; `EtapaBadge`, `CamaraChip`, `ProvenanceBadge`; `HonestEmptyState`;
  per-section skeletons.
- **Structure (top → bottom):**
  1. **FichaHeader** — title, boletín in **Mono**, `EtapaBadge`, `CamaraChip`(s),
     `ProvenanceBadge`.
  2. **Stacked carriles**, each a `mt-12` sibling `<section>` with its own `<h2>` + `Suspense`
     + shape-matched skeleton + honest empty:
     - **Idea matriz** (`IdeaMatrizBlock`) — when present, AI-extracted content is wrapped in
       **`AiSummaryCallout`** carrying `MODELO / SCOPE / FUENTES` chips, and the **source is
       shown intact** below the synthesis. Labelled, never standing in for the source.
     - **Cuerpos legales** (`CuerposLegalesList`).
     - **Timeline de tramitación** (`TimelineView`) — cross-chamber, chamber colour-coded by
       civic token (`--camara` / `--senado`); chronological facts only.
     - **Votaciones** (`VotacionCard` / `VotoRow`) — vote-outcome literal palette
       (A favor / En contra / Abstención / Pareo / Ausente); **identity guard** on names
       (link only if `confirmado`, else raw name + `IdentityMarker`).
     - **Proyectos similares** (`ProyectosSimilares`) — by embedding similarity, framed
       **"proyectos relacionados"**, with **NO score** shown (no similarity %, no bar).
  3. **Every datum carries `ProvenanceBadge`.**
- **States (DS §9):** **404** if the boletín is invalid/absent. Per-section honest empty
  (the 3 distinct states), per-section shape-matched skeleton, per-section error
  ("No pudimos cargar este dato…") — sections never collapse into one another and an empty
  carril never reads as "clean."
- **Anti-insinuación + traceability:** carriles are `mt-12` siblings, never nested; votes
  never share a `Card`/`li`/`tr` with any other domain. Proyectos similares is framed as
  related, never as a
  <!-- BANNED-VOCAB-START --> "% de coincidencia" or affinity score <!-- BANNED-VOCAB-END -->.
  AI synthesis is labelled (modelo/scope/fuentes) with the source intact. Timeline colours are
  civic data identity, never brand.
- **Copy (exact):** carril headings literal ("Idea matriz", "Cuerpos legales",
  "Tramitación", "Votaciones", "Proyectos relacionados"); error per section
  **"No pudimos cargar este dato. Intenta recargar…"**; honest empties per DS §6 patterns.

---

## 5. Ficha de parlamentario `/parlamentario/[id]` (ficha 360)

- **Route:** `/parlamentario/[id]` — the 360 ficha, built ON the shipped stacked-carriles
  shell (`page.tsx`). `[id]` validated before DB; header via the `parlamentario_publico` RPC
  (deny-by-default → 404 honesto on absent).
- **Layout:** `max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16` single column (shipped shell).
- **Components used:** `ParlamentarioHeader`; `VotosSection`; `LobbySection`;
  `PatrimonioSection`; `ContratosSection` (gated); `FinanciamientoSection` (gated);
  `IdentityMarker`, `CamaraChip`, `ProvenanceBadge`, `StaleNote` / `HistoricalCaveat`;
  per-carril skeletons (shipped).
- **Structure (top → bottom):**
  1. **ParlamentarioHeader** — name, chamber (`CamaraChip`), period in **Mono**.
     **NO foto. NO partido chip.** (LEGAL-03 — the RPC never emits partido/rut/email.)
  2. **Stacked carriles — LOCKED order**, each a `mt-12` sibling `<section>` with `<h2>` +
     `Suspense` + skeleton + 3-state honest empty:
     1. **`#votos`** — Votaciones (`VotosSection`): list of votes
        (A favor / En contra / Abstención / Pareo / Ausente), asistencia, **rebeldías as
        neutral data** (VOTE-05, no judgement), by-tema view (VOTE-04, reuses embeddings).
        Identity guard applied to names.
     2. **`#lobby`** — Reuniones de lobby (`LobbySection`): contraparte rendered as **raw
        text + `IdentityMarker`**, never linked; `ProvenanceBadge` per row.
     3. **`#patrimonio`** — Declaraciones de patrimonio e intereses (`PatrimonioSection`):
        version history, **side-by-side comparison SOLO-datos** (no verdict, no delta),
        **"Presentada el {fecha}"** prominent in Mono + amber **`HistoricalCaveat`**;
        **CC BY 4.0** visible in the intro AND the caption (InfoProbidad licenses it).
     4. **`#dinero`** — Contratos del Estado asociados al RUT (`ContratosSection`) —
        **GATED**: `moneyPublicEnabled(process.env)` wraps the **whole section incl. its
        `<h2>`**. **OFF (default) → the entire node is absent from the HTML** (not
        CSS-hidden); no reliance on the section returning null to hide the heading. Heading
        exact, no possessive. Attribution: **"mención de la fuente"** (ChileCompra) — **NOT
        CC BY 4.0**. Future ON behaviour: the carril appears with contracts, each row traced.
     5. **`#financiamiento`** — Aportes de campaña registrados en SERVEL
        (`FinanciamientoSection`) — **GATED** (same wrap, OFF → absent). Grouped by election
        with an **amber caveat for prior candidacies**; the donor is its own subject
        (**"Aporta:"**), **donor RUT NEVER rendered**; the candidate link is **"asociado por
        nombre confirmado al candidato"** — **never "por RUT"** (SERVEL carries no RUT).
        Future ON behaviour: grouped aportes appear, donor as subject, source traced.
  3. **Anti-insinuación invariant:** no carril ever composes with `#votos`; the `mt-12`
     gap between carriles is **never collapsed**, even when a section is empty.
- **States (DS §9):** **404** if `[id]` invalid/absent. Per-carril 3-state honest empty
  (no consultado ≠ consultado sin resultados ≠ error), per-carril shipped skeleton,
  per-carril error throws → honest error UI (#34, never degrades to "sin datos").
  In the OFF state, `#dinero` and `#financiamiento` are simply **absent** — the ficha reads
  coherently as votos / lobby / patrimonio only.
- **Anti-insinuación + traceability:** every datum carries `ProvenanceBadge`. PII never
  rendered (RUT/partido/email/family never reach the DOM or the LLM, LEGAL-03). Money
  sections render the proveedor/donante as their own subject, never the parlamentario's RUT.
  No causal/affinity language; rebeldías and asistencia are neutral observable counts.
- **Copy (exact):** header period in Mono; carril headings exact —
  "Votaciones", "Reuniones de lobby", "Declaraciones de patrimonio e intereses",
  **"Contratos del Estado asociados al RUT"** (no possessive),
  **"Aportes de campaña registrados en SERVEL"**; patrimonio "Presentada el {fecha}";
  financiamiento "Aporta:"; honest empties per DS §6; **MONEY-OFF shows no copy** — absence
  is the contract (never "esta sección está deshabilitada").

---

## 6. Contraparte `/contraparte/[id]` (gated)

- **Route:** `/contraparte/[id]` — a money-side subject (empresa = persona jurídica). The
  whole route is MONEY-gated at the page level.
- **Page-level gate (FIRST statement):** `if (!moneyPublicEnabled(process.env)) notFound();`
  as the **first statement** of the page. **OFF (default) → the whole route 404s**, serving
  `not-found.tsx`; the route node does not exist for anon users. Stays OFF until LEGAL-01.
  An invalid `[id]` while ON also `notFound()`.
- **Layout:** `max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16` single column (consistent with
  the ficha shell).
- **Components used (when ON):** a header for the empresa (persona jurídica);
  `ContratosPorContraparte`; `AportesPorContraparte`; `ProvenanceBadge`; `HonestEmptyState`;
  per-carril skeletons.
- **Structure (when ON, top → bottom):**
  1. **Header** — empresa name (persona jurídica), with `ProvenanceBadge`.
  2. **TWO sibling `mt-12` carriles**, never nested:
     - **Contratos** (ChileCompra) — each row `ProvenanceBadge`; amounts **verbatim** in Mono.
     - **Aportes** (SERVEL) — each row `ProvenanceBadge`; amounts verbatim in Mono.
- **States (DS §9):** OFF or invalid id → **404** (page-level gate). When ON: per-carril
  honest empty (3-state), per-carril skeleton, per-carril error throw (#34, never degrades).
- **Anti-insinuación + traceability (HARD):** **zero vote data** on this route; **zero causal
  language**; **neutral counting** —
  <!-- BANNED-VOCAB-START --> no SUM-as-verdict, no ranking, no "el peor/mejor"
  <!-- BANNED-VOCAB-END -->; amounts **verbatim**; **donor RUT never rendered**; contrapartes
  are raw subjects, never reconciled to a parlamentario. The two carriles are siblings and
  never compose with each other or with any vote.
- **Attribution per dataset:** ChileCompra **"mención de la fuente"**; SERVEL **"términos de
  uso por verificar"**. **Never blanket CC BY 4.0** on this route.
- **Copy (exact):** carril headings literal ("Contratos", "Aportes"); attribution lines
  exact as above; honest empties per DS §6; **MONEY-OFF shows no copy** — the route is simply
  `notFound()`.

---

## 7. Directorio `/parlamentario` (NEW — directory / index)

- **Route:** `/parlamentario` (index, NEW). Distinct from the `/parlamentario/[id]` ficha.
- **Backed by REAL data:** the maestra **~186 rows** (31 senadores + 155 diputados) via a
  **public-read RPC** that mirrors `parlamentario_publico` (header-only fields). No invented
  rows.
- **Layout:** `max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-16`; a list/grid of
  `ParlamentarioDirectoryRow` / `ParlamentarioDirectoryCard`.
- **Components used:** `ParlamentarioDirectoryRow` / `ParlamentarioDirectoryCard` (NEW
  spec-only); `CamaraChip`; filter controls (chamber select + name text input);
  `MethodologyCaveat`; `HonestEmptyState`; skeleton rows.
- **Structure (top → bottom):**
  1. **Filters** — by chamber (Cámara / Senado) and a name **text search** (`SearchBox`-style
     input, petrol focus). Touch targets ≥44px.
  2. **List/grid** — one entry per parlamentario: **name + chamber (`CamaraChip`) + period in
     Mono**. **NO foto. NO partido.** Each entry links to `/parlamentario/[id]`.
  3. **Ordering** — **NEUTRAL, default alphabetical**. Any metric-based ordering must be by a
     **neutral observable fact** (e.g. an observable count like rebeldías presented as data)
     and **always paired with a `MethodologyCaveat`**. It is **NEVER framed as a verdict
     table** —
     <!-- BANNED-VOCAB-START --> never a "ranking de los peores" / "ranking de los más…"
     <!-- BANNED-VOCAB-END --> (deferred per CONTEXT; metric ranking is out of this phase).
- **States (DS §9):** **empty (no registry)** "No hay parlamentarios en el registro."
  (won't happen — 186 real rows); **filter → zero** "Sin parlamentarios para este filtro.";
  **loading** skeleton rows; **error** "No pudimos cargar el directorio…".
- **Anti-insinuación + traceability:** each entry's header fields carry traceability via the
  ficha they link to; no foto / no partido (LEGAL-03); ordering is neutral fact +
  `MethodologyCaveat`, never a judgement. Identity guard governs any link.
- **Copy (exact):** entry = name · chamber chip · period (Mono); empty
  **"Sin parlamentarios para este filtro."**; error **"No pudimos cargar el directorio…"**;
  default ordering **alphabetical**.

---

## 8. Sobre / Metodología `/sobre` & `/metodologia` (light spec)

- **Route:** `/sobre` (and `/metodologia`) — an informational surface referenced by the
  header and by every `MethodologyCaveat` ("Fuente · Metodología"). Static content; not a
  data carril.
- **Layout:** `max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16` single reading column.
- **Components used:** prose blocks (no data components); links out to source registries.
- **Structure (top → bottom):**
  1. **Data posture** — minimization + traceability; "qué pasó, cuándo y según qué fuente."
  2. **Anti-insinuación principles** — the product never asserts intención ni causalidad;
     no scores, no rankings-as-verdict, money never composed with votes.
  3. **Source list + per-dataset attribution** — InfoProbidad **CC BY 4.0**; ChileCompra
     **"mención de la fuente"**; SERVEL **"términos de uso por verificar"**.
     **Never blanket CC BY 4.0.**
  4. **"Beta abierta" honesty** — the product is an open beta; coverage is partial and dated;
     "no consultado" ≠ "sin resultados" ≠ "error" is explained.
  5. **Legal / licensing notes** — CC BY 4.0 attribution where licensed; the MONEY gate and
     LEGAL gates noted at a high level.
- **States:** static informational page — no empty / loading / error data states.
- **Anti-insinuación + traceability:** this surface *explains* the invariants; it carries no
  per-datum `ProvenanceBadge` because it renders no data, but it documents the attribution
  rules the data surfaces obey.
- **Copy (exact):** "Beta abierta"; per-dataset attribution lines exact as above; copy is
  fixed in `BRIEF.md` — this surface is informational, not a data carril.

---

## Closure

**All five key screens (landing, resultados de búsqueda, ficha de proyecto, ficha de
parlamentario, contraparte) + the GlobalHeader + the NEW `/parlamentario` directory +
Sobre/Metodología are CLOSED — nothing is left "abierto" ni "por decidir."** Each contract
names its route, layout (container width + padding), components (from the DS catalogue),
top-to-bottom structure, the honest states (empty / loading / error as applicable), the
anti-insinuación + traceability invariants in force, MONEY gating (OFF = node/route absent;
documented ON behaviour), and exact copy. An implementation phase can build each screen
directly from this file + `DESIGN-SYSTEM.md` with no interpretation.
