# Phase 77: BENTO-HOME-SUPERIOR — Hero + tile acento + tarjetas de entrada - Research

**Researched:** 2026-07-15
**Domain:** Next.js 16 App Router / React 19.2 server-component composition + Tailwind 4 token restyle (100% presentation, zero data)
**Confidence:** HIGH (codebase-verified against the actual repo at HEAD 536e36c)

## Summary

Phase 77 mounts the Phase 76 bento primitives (`BentoGrid`/`BentoTile`) for the first time by rewriting the home `app/app/page.tsx` into the upper half of the mockup bento (filas 1-2): a hero tile (span-4), an accent tile "¿Cómo leer esto?" (span-2), and 3 entry cards (span-2). All hero copy is LOCKED verbatim; the `ActualidadModule` stays mounted linearly below the grid (migrates in Phase 78). No RPCs, no data changes, `force-dynamic` preserved, `SearchBox` remains the single client island. The 76-UI-REVIEW accent-variant debts (dark AA foreground + hover) are resolved here as a precondition of consuming `variant="accent"`.

The work is almost entirely deterministic against a tightly-scoped, checker-APPROVED UI-SPEC. The research surfaced **three codebase realities that contradict or refine the UI-SPEC** and are load-bearing for the planner:

1. **There is NO `<main>` wrapper carrying `max-w-[1120px]` in `layout.tsx`.** The UI-SPEC (§Spacing "Container") states "the grid lives inside `main` which already carries `max-w-[1120px] px-6 mx-auto` from Phase 76" — this is **false**. `layout.tsx` renders `<GlobalHeader/>{children}<footer>` with no page container; the home provides its own `<main className="flex-1">` with inner `max-w-3xl`/`max-w-5xl` sections. The planner MUST add the `max-w-[1120px] mx-auto px-4 md:px-8` container inside `page.tsx` around the grid (matching the header/footer idiom exactly — note it is `px-4 md:px-8`, NOT `px-6`).
2. **`bg-accent-product`/`text-accent-product` are generated in `tailwind.config.ts` (`colors` map), NOT in the `@theme inline` block of globals.css.** The UI-SPEC's Accent-Foreground-Fix pseudo-code points at the `@theme inline` / `--color-accent-product-soft` idiom, but that idiom is for civic-tokens. For an `accent-product-foreground` utility that mirrors how `accent-product` works today, the token must be added to BOTH globals.css (the HSL triple) AND `tailwind.config.ts` `colors` (as `"accent-product-foreground": "hsl(var(--accent-product-foreground))"`). This is the single highest-risk step — get the registration idiom right or the utility silently no-ops.
3. **The anti-insinuación linter does NOT currently scan `app/app/page.tsx`.** Its scope is `SUPERFICIES_VOTO` + `SUPERFICIES_MONEY` (a hard list); the home is not in it. So the linter passes trivially regardless of the new copy. The UI-SPEC's requirement to adopt the `/sobre` formula (and ban the mockup's "correlaciones… irregularidades" string) is a **self-imposed correctness contract**, not something the existing linter enforces. The planner should still honor it (Phase 80 may add the home to scope) but must not expect a red→green signal from the linter.

**Primary recommendation:** Rewrite `page.tsx` to compose `BentoGrid` + 5 `BentoTile`s (asChild) inside a new `max-w-[1120px]` container; make two surgical edits to `bento-tile.tsx` (accent foreground + hover); add `--accent-product-foreground` to globals.css AND tailwind.config.ts; restyle only the `isHero` branch of `search-box.tsx` (52px + `--radius-control`); migrate `page.test.tsx` structurally while keeping every LOCKED string byte-identical.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Home layout composition (bento grid) | Frontend Server (RSC) | — | `page.tsx` is a Server Component; grid + tiles render server-side, zero JS |
| Search input + pill navigation | Browser / Client | Frontend Server (form GET fallback) | `SearchBox` is the ONLY `"use client"` island; `router.push` + progressive `<form method="get">` |
| Accent tile / entry cards (links) | Frontend Server (RSC) | Browser (native `<a>` nav) | Full-card `<Link>`, zero JS; hover/focus are pure CSS |
| Design tokens (`--accent-product-foreground`, radii) | CDN / Static (CSS) | — | Compiled CSS custom props + Tailwind utilities; no runtime |
| Actualidad (retained) | Frontend Server (RSC, async) | Database (Supabase reads) | Unchanged this phase; stays below grid, keeps `force-dynamic` |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Copy del hero (D1 — RESUELTA)**
- h1 LOCKED intacto: "Qué pasó con cada proyecto de ley y cada parlamentario."
- Cursiva LOCKED: "Con la fuente a la vista."
- Trust line LOCKED: "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad."
- 4 pills LOCKED verbatim (strings actuales de la home, sin cambio).
- Se AÑADE kicker Geist Mono uppercase: "OBSERVATORIO DEL CONGRESO". El h1 del mockup NO entra.
- CERO strings/datos del mockup en producción (copy del mockup = placeholder de diseño).

**Marcador de tarjetas de entrada (D2 — RESUELTA)**
- Diamante (default del mockup) + flecha →. Títulos/descripciones/destinos ACTUALES sin cambio de copy (Buscar/Parlamentarios/Agenda).

**Hero tile**
- Span-4, variante default. SearchBox variante `hero` existente reestilada: input 52px de alto, radio `--radius-control` (11px), botón petróleo (`--accent-product` por token). Pills con touch target 44px (`min-h-11` — el mockup usa 38px, se SUBE), radio 999px (rounded-full), hover borde petróleo.
- Hero sigue server component; `SearchBox` único island; `force-dynamic` de la home se conserva.

**Tile acento "¿Cómo leer esto?"**
- Span-2, variante `accent` de BentoTile. BrandIcon en claro. Copy alineado con la fórmula existente de /sobre (invariante 2 — el texto del mockup "correlaciones no indicativas de irregularidades…" NO se copia; pasa el linter anti-insinuación).
- CTA "Ver metodología →" — destino consistente con el link actual del hero (verificado en research: hoy va a `/sobre` — page.tsx:96-97 actual; mantener ese destino).

**Deuda UI-review 76 a resolver aquí**
- Variante `accent`: dark mode — foreground correcto (hoy `text-primary-foreground` invierte mal en dark; derivar foreground legible AA de tokens existentes).
- Variante `accent`: definir hover derivado.

### Claude's Discretion
- Estructura interna de los tiles (composición server components), nombres de archivos, cómo migrar los tests de home existentes.
- Sintaxis Tailwind: SIEMPRE `[var(--token)]` — NUNCA shorthand `[--token]` (CR-01 de 76: genera CSS inválido en Tailwind 4).

### Deferred Ideas (OUT OF SCOPE)
- Tiles de actualidad (votado/urgencias/frescura) → Phase 78 (ActualidadModule se conserva lineal bajo el grid en 77).
- Candados formales (cero-hex mutation self-check, guard tipográfico extendido) → Phase 80.
- Verificación visual real → Phase 79/81 (BrowserOS).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BENTO-02 | Home superior como bento: hero span-4 + tile acento "¿Cómo leer esto?" span-2 + 3 tarjetas de entrada span-2, consumiendo primitivas 76, copy LOCKED intacto, `force-dynamic`/island preservados. | UI-SPEC §Component Inventory (contracts per tile); mockup filas 1-2 (`home-bento.dc.html:47-106`); Phase 76 primitives (`bento-grid.tsx`/`bento-tile.tsx`) verified present; token map verified against `globals.css`; SearchBox `isHero` branch isolated (verified `/buscar` uses default variant). |

## Standard Stack

No new packages. Everything is already vendored and version-locked by the repo.

### Core (all in-repo, verified present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x (App Router) | `page.tsx` RSC rewrite | Repo standard; `AGENTS.md` warns: read `node_modules/next/dist/docs/` before writing Next code |
| React | 19.2 | Server/Client components | Bundled with Next 16 |
| `class-variance-authority` (cva) | in-repo | `bentoTileVariants` accent edit | Existing pattern (`bento-tile.tsx`, `button.tsx`) |
| `@radix-ui/react-slot` (`Slot`) | in-repo | `BentoTile asChild` → wraps `<section>`/`<Link>` | Existing pattern |
| Tailwind CSS | 4.x | Token utilities, arbitrary `[var(--token)]` | Repo standard; **CR-01: never `[--token]`** |
| `lucide-react` (`Search`) | in-repo | SearchBox icon (unchanged) | Existing |
| `next/link` (`Link`) | 16.x | Accent tile + entry card full-card links | Existing |

### Supporting (in-repo components consumed/edited)
| File | Action | Notes |
|------|--------|-------|
| `app/components/bento/bento-tile.tsx` | EDIT (accent variant: foreground + hover) | Only the `accent` string in `bentoTileVariants` changes |
| `app/components/bento/bento-grid.tsx` | CONSUME unchanged | `gap-[14px]`, `grid-cols-1 md:grid-cols-6` already correct |
| `app/components/search-box.tsx` | EDIT (`isHero` branch only) | Input `h-[52px]`, `rounded-[var(--radius-control)]`; button `h-[52px]` + same radius; pills unchanged (already `min-h-11 rounded-full`) |
| `app/components/brand-icon.tsx` | CONSUME (pass `color="currentColor"`) | Do NOT edit the file; pass the prop from the accent tile so it inherits `text-accent-product-foreground` |
| `app/app/globals.css` | EDIT (add `--accent-product-foreground` triple in `:root` and `.dark`) | HSL triple `183 30% 96%` per UI-SPEC |
| `app/tailwind.config.ts` | EDIT (add `accent-product-foreground` color) | **REQUIRED** — this is where `accent-product` lives, not `@theme inline` |
| `app/app/page.tsx` | REWRITE (bento composition) | Keep `ENTRY_CARDS`, `EXAMPLE_CHIPS`, `force-dynamic`, `ActualidadModule` mount |
| `app/app/page.test.tsx` | MIGRATE (structural, strings byte-identical) | See Testing Contract |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Editing `bento-tile.tsx` accent string | New `variant="accent-dark-stable"` | Rejected: adds a variant; UI-SPEC contract is to FIX the existing accent variant (resolves 76 debt in place) |
| `--accent-product-foreground` in tailwind.config.ts | `@theme inline` in globals.css | Rejected: `accent-product` (the sibling) lives in tailwind.config.ts `colors`; mirror it there for consistency + guaranteed utility generation |
| Small server sub-components per tile | Inline JSX in `page.tsx` | Discretion (CONTEXT). Inline is simpler; sub-components aid testability. Planner picks one and fixes it. |

**Installation:** none — zero new dependencies. This is a presentation-only phase.

**Version verification:** Not applicable — no packages installed. `node -v` = v22.21.1; repo HEAD = 536e36c (verified via git log).

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. No `npm install`, no `shadcn add`, no third-party registries (UI-SPEC §Registry Safety confirms). slopcheck gate skipped by construction.

## Architecture Patterns

### System Data Flow (this phase)

```
                    layout.tsx (RootLayout)
                    ├── <GlobalHeader/>            (sticky, max-w-[1120px] — existing)
                    ├── {children} ─────────────► page.tsx (Home, RSC, force-dynamic)
                    │                              │
                    │                              ├── <main className="flex-1">
                    │                              │   └── [NEW container: max-w-[1120px] mx-auto px-4 md:px-8]
                    │                              │       └── <BentoGrid>                 (RSC, grid 6-col)
                    │                              │            ├── Hero tile span-4       (RSC)
                    │                              │            │    ├── kicker (mono)
                    │                              │            │    ├── h1 + <em> cursiva (LOCKED)
                    │                              │            │    ├── <SearchBox hero/> ◄── ONLY "use client" island
                    │                              │            │    │      └── router.push OR <form GET> fallback ──► /buscar?q=
                    │                              │            │    └── trust line (LOCKED)
                    │                              │            ├── Accent tile span-2     (RSC, <Link href="/sobre">)
                    │                              │            │    └── BrandIcon color="currentColor" + /sobre formula + "Ver metodología →"
                    │                              │            └── 3× Entry tile span-2   (RSC, <Link>) → /buscar /parlamentarios /agenda
                    │                              │
                    │                              └── <ActualidadModule/>  (RSC async, RETAINED linear, reads Supabase)
                    └── <footer>                   (max-w-[1120px] — existing)
```

Collapse ≤md (DOM order = visual order, no reorder utilities): hero → accent tile → entry 1 → entry 2 → entry 3 → (ActualidadModule).

### Recommended Project Structure (no new dirs)
```
app/
├── app/
│   ├── page.tsx          # REWRITE → bento composition (keeps constants + retained module)
│   ├── page.test.tsx     # MIGRATE → structural (BentoTile spans) + LOCKED strings
│   └── globals.css       # EDIT → +--accent-product-foreground (:root + .dark)
├── tailwind.config.ts    # EDIT → +accent-product-foreground color
└── components/
    ├── bento/bento-tile.tsx   # EDIT → accent variant foreground + hover
    ├── search-box.tsx         # EDIT → isHero branch (52px + radius-control)
    └── brand-icon.tsx         # CONSUME (pass color="currentColor"; do not edit)
```

### Pattern 1: BentoTile asChild wrapping a Link/section
**What:** Each grid child is a `BentoTile` (via `asChild`) wrapping the semantic element, so span + focus/hover come from the primitive and the child self-declares `md:col-span-N` (correct collapse).
**When to use:** Every one of the 5 children this phase.
**Example (verified against `bento-tile.tsx` current API):**
```tsx
// Source: app/components/bento/bento-tile.tsx (verified — asChild → Slot)
<BentoTile variant="default" span={4} asChild>
  <section className="p-8 flex flex-col justify-center">…hero…</section>
</BentoTile>

<BentoTile variant="accent" span={2} asChild>
  <Link href="/sobre" className="p-6 flex flex-col justify-between">
    <BrandIcon color="currentColor" size={30} />
    <div>
      <h2 className="text-xl font-semibold text-accent-product-foreground">¿Cómo leer esto?</h2>
      <p className="mt-2 text-sm text-accent-product-foreground">…/sobre formula…</p>
    </div>
    <span className="mt-6 text-sm font-semibold text-accent-product-foreground">Ver metodología →</span>
  </Link>
</BentoTile>
```
**Gotcha (Slot single-child):** `@radix-ui/react-slot` requires exactly ONE child element passed to the slotted component. `<BentoTile asChild>` must wrap a single `<section>`/`<Link>`; all tile content nests INSIDE that one element (as shown). Two siblings inside `asChild` throws at render.

### Pattern 2: accent-product-foreground token registration (highest-risk step)
**What:** Add a theme-stable AA foreground for the inverted accent tile.
**Where — BOTH files:**
```css
/* app/app/globals.css — :root AND .dark (identical value, dark-stable) */
:root {
  /* … existing … */
  --accent-product-foreground: 183 30% 96%;   /* ≈ #EAF2F1, full alpha, ≥7:1 on petróleo */
}
.dark {
  /* … existing … */
  --accent-product-foreground: 183 30% 96%;
}
```
```ts
// app/tailwind.config.ts — colors map (MIRROR the existing accent-product line)
"accent-product": "hsl(var(--accent-product))",
"accent-product-foreground": "hsl(var(--accent-product-foreground))",  // NEW
```
**Why both:** `bg-accent-product`/`text-accent-product` utilities are generated by the tailwind.config `colors` map (verified `tailwind.config.ts:46`), NOT by `@theme inline`. Adding only the CSS var yields no `text-accent-product-foreground` utility. The `@theme inline` block in globals.css is reserved for civic-tokens whose sources are already full `hsl()` — that idiom does NOT apply here (our var is a bare HSL triple, consumed via `hsl(var(...))` in the config, matching `accent-product`).

### Pattern 3: accent variant fill must stay dark-stable
**What:** The `accent` variant fill (`bg-accent-product`) lightens to mid-teal (`183 34% 46%`) in `.dark`, dropping white text to ~3.3:1 (FAIL). The accent tile must keep the petróleo fill in BOTH themes.
**How (UI-SPEC contract):** In `bento-tile.tsx`, the `accent` variant references a dark-stable fill. Two options (planner picks one):
- (a) Add `--bento-accent-fill: 183 38% 26%;` in `:root` AND `.dark` (identical), register in tailwind.config, and set the accent variant to `bg-[var(--bento-accent-fill-hsl)]`-style util. Cleanest but adds a token.
- (b) Since full dark verification is Phase 80 and this phase ships light-primary, keep `bg-accent-product` for the fill BUT the plan must NOT claim dark AA passes; the foreground token above is the shippable part. UI-SPEC §Color is explicit: "this phase must not ship the failing pairing" — so option (a) is the safer literal reading. **Recommendation: option (a)** — small, resolves 76 debt cleanly, no dark regression.

### Anti-Patterns to Avoid
- **Shorthand arbitrary var `[--radius-control]`** → invalid CSS in Tailwind 4 (CR-01). Always `rounded-[var(--radius-control)]`.
- **Any `#` hex literal** in `page.tsx` or the `bento-tile.tsx` edit → violates the cardinal rule; every color by token (soft check this phase, formal candado Phase 80).
- **Whitespace text node for the `→` glyph** → lesson F53; use `<span aria-hidden className="pl-1">→</span>` (current `page.tsx:124` already does this — preserve the idiom).
- **Editing the non-hero SearchBox branch** → would break `/buscar` (uses default variant) and `search-box.test.tsx`. Touch ONLY `isHero ? …`.
- **Relying on the anti-insinuación linter to catch the accent copy** → the home is NOT in its scope; the copy contract is self-imposed.
- **Assuming a `<main>` container with `max-w-[1120px]` exists** → it does not; add it in `page.tsx`.
- **Two children under `<BentoTile asChild>`** → Slot throws; nest all content in one wrapped element.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grid + span + collapse | Custom CSS grid in `page.tsx` | `BentoGrid` + `BentoTile span` | Primitives already handle `gap-[14px]`, 6-col, `md:col-span-N` collapse (Phase 76, 13 tests green) |
| Polymorphic tile-as-link | `<a>` with duplicated focus/radius classes | `BentoTile asChild` (Slot) | Focus-visible ring, `min-h-11`, radius baked into primitive |
| Foreground contrast token | Inline `rgba()` / `.85` alpha | `--accent-product-foreground` full-alpha token | Full alpha = ≥7:1 margin + token-purity; `.85` only 5.59:1 |
| Search input + progressive nav | New client component | Restyle existing `SearchBox` `isHero` branch | Preserves single-island invariant + empty-submit guard + form GET fallback |
| Brand diamond icon | New SVG | `BrandIcon` (pass `color="currentColor"`) | Existing component; passing the prop avoids a hardcoded-hex path on the inverted surface |

**Key insight:** This phase is 90% *composition of existing, tested primitives* + 3 surgical token/class edits. The temptation to hand-roll layout in `page.tsx` (as the current home does with `max-w-3xl`/`max-w-5xl` flex sections) must be resisted — the whole point of Phase 76 was to provide the grid.

## Runtime State Inventory

Not applicable — greenfield UI composition, not a rename/refactor/migration. No stored data, service config, OS-registered state, secrets, or build artifacts carry any renamed string. **None — verified: the phase edits presentation files only (page.tsx, bento-tile.tsx, search-box.tsx, globals.css, tailwind.config.ts) with no identifier renames, no data keys, no env vars.**

## Common Pitfalls

### Pitfall 1: Missing page container (max-w-[1120px])
**What goes wrong:** Following the UI-SPEC literally ("grid lives inside `main` which already carries `max-w-[1120px]`") yields a full-bleed grid — no such container exists.
**Why it happens:** `layout.tsx` has no page `<main>` wrapper; only header + footer carry `max-w-[1120px]`. The home supplies its own `<main className="flex-1">`.
**How to avoid:** Add `<div className="max-w-[1120px] mx-auto px-4 md:px-8">` (matching header/footer idiom — note `px-4 md:px-8`, NOT the UI-SPEC's `px-6`) around `<BentoGrid>` inside the home's `<main>`.
**Warning signs:** Grid spans viewport width; misaligned with header/footer at ≥1120px.

### Pitfall 2: accent-product-foreground utility silently absent
**What goes wrong:** `text-accent-product-foreground` renders as no color (utility never generated) → invisible or default text on the accent tile.
**Why it happens:** Adding the CSS var but forgetting the `tailwind.config.ts` `colors` entry (the utilities come from the config, not `@theme inline`).
**How to avoid:** Edit BOTH files (Pattern 2). Verify by grepping the built CSS or asserting the class is present in the jsdom test (structural assertion — class presence, not computed color).
**Warning signs:** Test asserts `text-accent-product-foreground` present but visual review shows default-colored text.

### Pitfall 3: SearchBox restyle leaking to /buscar
**What goes wrong:** Editing the shared button/input classes breaks the persistent `/buscar` bar and `search-box.test.tsx` (asserts `h-12`, no `font-semibold` on default).
**Why it happens:** SearchBox has a single component with `isHero` branches; a careless edit touches both.
**How to avoid:** Change ONLY the `isHero ? "…" : "…"` truthy strings. Verified `/buscar` calls `<SearchBox initialQuery={q} />` (default). `search-box.test.tsx` only asserts the default + hero-button branches — the hero `h-[52px]`/radius change does not touch button label/semibold assertions, but **double-check the hero button still contains `bg-accent-product` + `font-semibold` + `text-background`** (test line 40-47 asserts these).
**Warning signs:** `search-box.test.tsx` reds; `/buscar` bar height changes.

### Pitfall 4: jsdom `import.meta.url` breakage
**What goes wrong:** `new URL(import.meta.url)` + `readFileSync` throws in jsdom.
**Why it happens:** Known repo gotcha (F50/UI-SPEC §Testing).
**How to avoid:** If a test needs the file path (source-scan style), use `import.meta.dirname`. The existing `page.test.tsx` uses RTL render (no fs), so this only bites if a zero-hex source-scan is added.
**Warning signs:** `TypeError` in test setup.

### Pitfall 5: Losing force-dynamic or the ActualidadModule mount
**What goes wrong:** Rewriting `page.tsx` drops `export const dynamic = "force-dynamic"` → Next prerenders `/` static → frozen/500 actualidad data (gotcha F50).
**Why it happens:** Aggressive rewrite deletes the export or the module mount.
**How to avoid:** Preserve `export const dynamic = "force-dynamic";` and `<ActualidadModule />` below `</BentoGrid>`. Add a test assertion for both (UI-SPEC §Testing "Retained").
**Warning signs:** Build shows `/` as `○` (static) instead of `ƒ` (dynamic).

## Code Examples

### Kicker (mono, new — the only net-new hero string)
```tsx
// Geist Mono 500 uppercase, muted, tracking (UI-SPEC §Typography)
<p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
  OBSERVATORIO DEL CONGRESO
</p>
```

### Hero h1 (LOCKED — preserve current rendering, do NOT shrink to mockup placeholder)
```tsx
// Source: current app/app/page.tsx:71-76 (LOCKED — keep text-4xl md:text-5xl scale)
<h1 className="text-4xl font-semibold leading-tight md:text-5xl">
  Qué pasó con cada proyecto de ley y cada parlamentario.
  <em className="mt-2 block italic text-accent-product">
    Con la fuente a la vista.
  </em>
</h1>
```

### Entry card marker (diamond + arrow — D2)
```tsx
// diamond via BrandIcon-independent inline SVG (mockup lines 96-99) OR small inline diamond;
// keep distinct from the two-diamond BrandIcon (that is the accent tile).
// → glyph: NEVER a whitespace text node (lesson F53)
<div className="flex items-center justify-between">
  {/* single-diamond marker, petróleo via text-accent-product currentColor */}
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
       className="text-accent-product">
    <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 8 L16 12 L12 16 L8 12 Z" fill="currentColor" />
  </svg>
  <span aria-hidden="true" className="pl-1 text-muted-foreground">→</span>
</div>
```

### accent variant edit (bento-tile.tsx)
```ts
// Source: app/components/bento/bento-tile.tsx (current accent line 29)
// BEFORE: accent: "bg-accent-product text-primary-foreground",
// AFTER  (foreground token + hover; fill dark-stable per Pattern 3):
accent:
  "bg-accent-product text-accent-product-foreground hover:bg-accent-product/90",
// (if Pattern-3 option (a): swap bg-accent-product for the dark-stable fill util)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Home as centered `max-w-3xl` flex hero + `max-w-5xl` nav grid | Bento `max-w-[1120px]` 6-col grid | Phase 77 (this) | Full structural rewrite of `page.tsx`; strings unchanged |
| accent variant `text-primary-foreground` (inverts wrong in dark) | `text-accent-product-foreground` full-alpha + dark-stable fill | Phase 77 | Resolves 76-UI-REVIEW warnings #1/#2 |
| Entry cards in `<nav aria-label="Secciones del sitio">` with `sm:grid-cols-3` | Entry cards as `BentoTile span-2` inside `BentoGrid` | Phase 77 | `page.test.tsx` nav-based assertions must migrate to grid/link assertions |

**Deprecated/outdated (in the UI-SPEC, corrected here):**
- UI-SPEC §Spacing "Container" claim that `main` already carries `max-w-[1120px] px-6` — **false**; no such wrapper; use `px-4 md:px-8` per header/footer.
- UI-SPEC §Accent Foreground Fix pointing at `@theme inline` registration — **incomplete**; the utility must also be registered in `tailwind.config.ts` `colors`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `--accent-product-foreground: 183 30% 96%` computes to ≈ #EAF2F1 at ≥7:1 on petróleo `#2A5859` | Pattern 2 / UI-SPEC contrast table | LOW — UI-SPEC provides verified ratios (7.00:1); if the HSL triple is slightly off, contrast still comfortably ≥ AA. Visual gate Phase 81 confirms. |
| A2 | Pattern-3 option (a) (dark-stable `--bento-accent-fill`) is the intended reading of "must not ship the failing pairing" | Pattern 3 | LOW — either option ships light-correct; dark is formally verified Phase 80. Planner may choose (b) if it documents the dark caveat. |
| A3 | No test outside `page.test.tsx`/`search-box.test.tsx` asserts home structure | Testing Contract | LOW — grep found home-`page.tsx` referenced only by its own test; `bento-*` tests are self-contained. |

## Open Questions

1. **Sub-component granularity for the tiles (Claude's discretion)**
   - What we know: CONTEXT grants discretion on internal composition + filenames.
   - What's unclear: whether to extract `hero-tile.tsx`/`accent-tile.tsx`/`entry-card.tsx` or inline in `page.tsx`.
   - Recommendation: inline the accent tile + entry-card map in `page.tsx` (matches current file's self-contained style, fewer files); the SearchBox stays the only extracted island. Planner fixes the choice in the plan.

2. **CTA label vs route parity ("Ver metodología →" → `/sobre`)**
   - What we know: LOCKED decision = destination `/sobre` (current hero onboarding target, `page.tsx:96-97`). Both `/sobre` and `/metodologia` routes exist (verified).
   - What's unclear: label says "metodología" but points to `/sobre` — intentional per CONTEXT.
   - Recommendation: honor the LOCKED decision (`href="/sobre"`, label "Ver metodología →"). Do not "fix" to `/metodologia`.

## Environment Availability

Not applicable — pure code/config change, no external tools/services/runtimes beyond the existing repo toolchain (Node v22.21.1 verified, vitest/tsc already configured). **Step 2.6: SKIPPED (no external dependencies identified).**

## Validation Architecture

nyquist_validation is enabled (no `workflow.nyquist_validation: false` in config). Test framework verified present: **vitest + jsdom**, config `app/vitest.config.ts`, run from `app/`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + @testing-library/react (jsdom) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter ./app test -- --run page` (home) / `… search-box` / `… components/bento` |
| Full suite command | `pnpm --filter ./app test -- --run` |
| Type gate | `pnpm --filter ./app exec tsc --noEmit` |

### Success Criteria → Test Map
| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| Hero copy LOCKED | kicker `OBSERVATORIO DEL CONGRESO`; h1 + `<em>` cursiva byte-identical; trust line present | unit | `pnpm --filter ./app test -- --run page` | ✅ (migrate `page.test.tsx`) |
| SearchBox hero restyle | hero input `h-[52px]` + `rounded-[var(--radius-control)]`; button petróleo + `Buscar proyectos`; empty-submit guarded; single island | unit | `pnpm --filter ./app test -- --run search-box page` | ✅ (`search-box.test.tsx` + `page.test.tsx`) |
| Accent tile | `<Link href="/sobre">`; `¿Cómo leer esto?`; body = /sobre formula (NOT mockup string); CTA `Ver metodología →`; classes `hover:bg-accent-product/90` + `text-accent-product-foreground`; `BrandIcon color="currentColor"` | unit | `pnpm --filter ./app test -- --run page` | ✅ (add to `page.test.tsx`) |
| Entry tiles | exactly 3 links, hrefs `{/buscar,/parlamentarios,/agenda}`; titles + bodies verbatim; diamond + `→` (`aria-hidden`, `pl-1`); `hover:border-accent-product` | unit | `pnpm --filter ./app test -- --run page` | ✅ (migrate Contract-2 tests) |
| Grid/collapse | 5 children as `BentoTile` spans (4/2/2/2/2); DOM order = collapse order | unit | `pnpm --filter ./app test -- --run page` | ✅ (add) |
| Retained | `ActualidadModule` mounted below grid; `dynamic="force-dynamic"` exported | unit | `pnpm --filter ./app test -- --run page` | ✅ (add assertion) |
| accent token wiring | `--accent-product-foreground` in globals.css (:root + .dark); `accent-product-foreground` in tailwind.config colors | source-scan (optional) | `pnpm --filter ./app test -- --run globals` | ⚠️ Wave 0 (extend `globals.test.ts` if desired) |
| Anti-insinuación | suite green (home not in scope → passes trivially; keep /sobre formula regardless) | unit | `pnpm --filter ./app test -- --run anti-insinuacion` | ✅ (`anti-insinuacion-guard.test.ts`, unchanged) |
| No regressions | full suite green (~846 base + adjustments); `tsc` clean | suite | `pnpm --filter ./app test -- --run` + `tsc --noEmit` | ✅ |

### Sampling Rate
- **Per task commit:** targeted `--run page` / `--run search-box` / `--run components/bento`.
- **Per wave merge:** full `pnpm --filter ./app test -- --run` + `tsc --noEmit`.
- **Phase gate:** full suite green + anti-insinuación green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Migrate `app/app/page.test.tsx`: the current Contract-2 tests assert a `<nav aria-label="Secciones del sitio">` and "no heading" — these break when entry cards become `BentoTile` links in a grid. Rewrite to assert the 3 links (hrefs + verbatim copy) inside the grid, plus new assertions (spans, kicker, accent tile, retained module, force-dynamic). Keep every LOCKED string byte-identical.
- [ ] (Optional) Extend `app/app/globals.test.ts` to assert `--accent-product-foreground` present in `:root` and `.dark` (mirrors the existing `--radius-tile`/`--radius-control` source-scan idiom).
- [ ] No framework install needed (vitest/jsdom already configured; 837/837 green at Phase 76 close).

## Security Domain

`security_enforcement` default (enabled), but this phase is **100% presentation** — no new data flows, no auth, no input handling beyond the existing (unchanged) SearchBox query param path (already validated server-side in `/buscar`: trim + `slice(0, MAX_QUERY_CHARS)`, boletín redirect, key server-only).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (public read-only home) |
| V5 Input Validation | no (unchanged) | SearchBox query already trimmed + capped server-side in `/buscar` (verified `buscar/page.tsx:43-44`); this phase does not touch that path |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected content via query param | Tampering/Info-disclosure | Not introduced — SearchBox nav path unchanged; React auto-escapes; no `dangerouslySetInnerHTML` added |
| Client-side secret leak | Info-disclosure | Preserved: `SearchBox` never calls Gemini/pgvector; embed + kNN stay server-only (`/buscar`) |
| Editorial insinuation (project risk #1) | Repudiation/defamation | Adopt /sobre formula; ban mockup "correlaciones… irregularidades" string (self-imposed — home not in linter scope) |

## Sources

### Primary (HIGH confidence — codebase, verified this session)
- `app/app/page.tsx` — current home structure, LOCKED strings, `ENTRY_CARDS`, `EXAMPLE_CHIPS`, `force-dynamic`, ActualidadModule mount, `/sobre` onboarding link (line 96-97)
- `app/components/search-box.tsx` — `isHero` branch, `h-12`, pills `min-h-11 rounded-full`, empty-submit guard, form GET fallback
- `app/components/brand-icon.tsx` — `color` prop, default `#2A5859`, `currentColor` support
- `app/components/bento/bento-tile.tsx` — `bentoTileVariants` accent line 29 (`text-primary-foreground`), asChild/Slot, span map
- `app/components/bento/bento-grid.tsx` — `gap-[14px]`, `grid-cols-1 md:grid-cols-6`
- `app/app/globals.css` — token definitions, `@theme inline` civic idiom, `--accent-product` triple, radii
- `app/tailwind.config.ts` — `colors` map (accent-product registration site — line 46)
- `app/app/layout.tsx` — NO page `<main>` container; footer/header carry `max-w-[1120px] px-4 md:px-8`
- `app/app/page.test.tsx` + `app/components/search-box.test.tsx` — existing assertions to migrate/preserve
- `app/lib/anti-insinuacion-guard.test.ts` — `SUPERFICIES_VOTO`/`SUPERFICIES_MONEY` scope (home NOT included)
- `app/app/sobre/page.tsx` — "El principio" formula (linter-clean, LOCKED)
- `app/app/buscar/page.tsx` — confirms default SearchBox variant + server-side query validation
- `.planning/design/bento/home-bento.dc.html:47-106` — mockup filas 1-2 (grid inside `main max-w-1120px`, spans, diamond marker, banned accent string)
- `77-UI-SPEC.md` (APPROVED) — the design contract this research validates and corrects

### Secondary (MEDIUM)
- `76-01-SUMMARY.md` — Phase 76 primitives provided, 837/837 green baseline, D4 token decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all files read and verified at HEAD
- Architecture: HIGH — composition of already-tested primitives; data flow traced end-to-end
- Pitfalls: HIGH — three UI-SPEC/reality discrepancies found by direct file reads (container, token registration, linter scope)

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (30 days — stable; presentation-only, no fast-moving external deps)
