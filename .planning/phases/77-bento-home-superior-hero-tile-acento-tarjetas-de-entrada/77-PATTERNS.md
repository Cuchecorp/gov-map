# Phase 77: BENTO-HOME-SUPERIOR — Hero + tile acento + tarjetas de entrada - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 8 (5 source + 3 test)
**Analogs found:** 8 / 8 (every file is an in-repo edit/migrate; all analogs are the target files themselves at HEAD or their sibling primitives)

> **Key insight (from RESEARCH):** This phase is ~90% composition of already-tested Phase-76 primitives + 3 surgical token/class edits. There is NO net-new architecture. Every "analog" is either (a) the current file being rewritten (its LOCKED strings/constants must survive byte-identical), or (b) a sibling that establishes the exact idiom to mirror (token registration, cva variant string, isHero branch). All excerpts below are verbatim from HEAD `536e36c`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/app/page.tsx` | route (RSC) | request-response (rewrite) | `app/app/page.tsx` (self, current) + `bento-tile.tsx` API | exact (self) |
| `app/app/page.test.tsx` | test | — | `app/app/page.test.tsx` (self) + `bento-tile.test.tsx` (class-scan) | exact (self) |
| `app/components/search-box.tsx` | component (island) | request-response | `app/components/search-box.tsx` (self — `isHero` branch) | exact (self) |
| `app/components/search-box.test.tsx` | test | — | `app/components/search-box.test.tsx` (self) | exact (self) |
| `app/components/bento/bento-tile.tsx` | component (primitive) | — | `app/components/bento/bento-tile.tsx` (self — accent cva string) | exact (self) |
| `app/components/bento/bento-tile.test.tsx` | test | — | `app/components/bento/bento-tile.test.tsx` (self) | exact (self) |
| `app/app/globals.css` | config (tokens) | — | `--color-accent-product-soft` idiom (`@theme inline`) + `--radius-*` triples | role-match |
| `app/tailwind.config.ts` | config (tokens) | — | `"accent-product": "hsl(var(--accent-product))"` (colors map, line 46) | role-match |
| `app/app/globals.test.ts` | test | — | `app/app/globals.test.ts` (self — `toContain` source-scan) | exact (self) |

**Registration-idiom warning (RESEARCH Pitfall 2 — highest risk):** `--accent-product-foreground` must be registered in **`tailwind.config.ts` `colors`**, NOT (only) in `@theme inline`. The sibling `accent-product` lives in the config `colors` map (line 46); mirror it there. The `@theme inline` block is reserved for civic tokens whose sources are already full `hsl()` (`--accent-product-soft`, `--identity-warn-*`). Our new token is a bare HSL triple consumed via `hsl(var(...))` in the config — so it follows the `accent-product` idiom, not the `accent-product-soft` idiom.

---

## Pattern Assignments

### `app/app/page.tsx` (route, RSC — REWRITE to bento)

**Analog:** self (current home) + `bento-tile.tsx` primitive API.

**Preserve verbatim — LOCKED constants (current lines 31–64):**
```tsx
const EXAMPLE_CHIPS: readonly ExampleChip[] = [
  { query: "protección de datos personales" },
  { query: "delitos económicos y medio ambiente" },
  { query: "40 horas / jornada laboral" },
  { query: "14309-04", mono: true },
];

const ENTRY_CARDS: readonly {
  title: string;
  href: string;
  value: string;
}[] = [
  {
    title: "Proyectos de ley",
    href: "/buscar",
    value:
      "En qué etapa está cada proyecto y cómo se ha votado, con cada fuente enlazada.",
  },
  {
    title: "Parlamentarios 360",
    href: "/parlamentarios",
    value:
      "Votaciones, lobby y patrimonio de cada parlamentario, según los registros públicos.",
  },
  {
    title: "Agenda de la semana",
    href: "/agenda",
    value:
      "Citaciones de comisiones y tabla de sala, enlazadas a cada proyecto.",
  },
];
```

**Preserve verbatim — force-dynamic export (current line 6–11):**
```tsx
// FORCE-DYNAMIC (load-bearing, gotcha F50 …): sin esto Next hornea `/` estática.
export const dynamic = "force-dynamic";
```
Never delete. RESEARCH Pitfall 5: dropping this or the `<ActualidadModule />` mount silently freezes actualidad data.

**Preserve verbatim — LOCKED hero h1 + cursiva (current lines 71–76):**
```tsx
<h1 className="text-4xl font-semibold leading-tight md:text-5xl">
  Qué pasó con cada proyecto de ley y cada parlamentario.
  <em className="mt-2 block italic text-accent-product">
    Con la fuente a la vista.
  </em>
</h1>
```
Do NOT shrink to the mockup's placeholder h1. Keep `text-4xl md:text-5xl`.

**Preserve verbatim — LOCKED subtitle + trust line + SearchBox invocation (current lines 78–92):**
```tsx
<p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
  Busca por una idea o por un número de boletín. Cada dato que verás
  lleva su fuente, su fecha y el enlace al documento oficial.
</p>
…
<SearchBox autoFocus variant="hero" exampleChips={EXAMPLE_CHIPS} />
…
<p className="mt-8 text-sm text-muted-foreground">
  Fuente, fecha y enlace en cada dato · Sin afirmar intención ni
  causalidad.
</p>
```

**`→` glyph idiom — PRESERVE (current lines 122–127, lesson F53, never a whitespace text node):**
```tsx
<span aria-hidden="true" className="pl-1">
  →
</span>
```

**Retained-module mount — PRESERVE (current line 139):**
```tsx
<ActualidadModule />
```
Stays mounted BELOW `</BentoGrid>` (migrates in Phase 78).

**BentoTile asChild composition pattern (from `bento-tile.tsx` verified API — Slot single-child):**
```tsx
<BentoTile variant="default" span={4} asChild>
  <section className="p-8 flex flex-col justify-center">…hero…</section>
</BentoTile>

<BentoTile variant="accent" span={2} asChild>
  <Link href="/sobre" className="p-6 flex flex-col justify-between">
    <BrandIcon color="currentColor" size={30} />
    …
  </Link>
</BentoTile>
```
Gotcha: `@radix-ui/react-slot` requires EXACTLY ONE child element under `asChild`; nest all content inside that one `<section>`/`<Link>`.

**NEW page container (RESEARCH Pitfall 1 — the UI-SPEC is WRONG that `main` carries this).** No `max-w-[1120px]` wrapper exists in `layout.tsx`; add it inside `page.tsx`, mirroring the footer idiom (`layout.tsx:50`) — note `px-4 md:px-8`, NOT `px-6`:
```tsx
<div className="max-w-[1120px] mx-auto px-4 md:px-8">
  <BentoGrid>…</BentoGrid>
</div>
```

**Accent-tile body copy (adopt `/sobre` "El principio" formula — `app/app/sobre/page.tsx:32-38`, linter-clean, firmado). CONTEXT copy:**
```
Cada dato lleva su fuente, su fecha y el enlace al documento oficial. Cuando un dato no está disponible, se dice de forma explícita; nunca se inventa.
```
BAN the mockup's "Las correlaciones no son indicativas de irregularidades…" string (anti-insinuación invariant 2).

---

### `app/components/bento/bento-tile.tsx` (primitive — EDIT accent cva string only)

**Analog:** self (current `bentoTileVariants`, lines 23–42).

**Current accent variant (line 29 — the ONLY line that changes):**
```ts
default: "bg-card border border-border hover:border-accent-product",
accent: "bg-accent-product text-primary-foreground",
```

**Target (RESEARCH §Code Examples + UI-SPEC §Accent Foreground Fix / Hover):**
```ts
accent:
  "bg-accent-product text-accent-product-foreground hover:bg-accent-product/90",
```
- `text-primary-foreground` → `text-accent-product-foreground` (resolves 76-UI-REVIEW warning #1: `text-primary-foreground` inverts near-black in dark).
- add `hover:bg-accent-product/90` (resolves 76-UI-REVIEW warning #2: accent tile is a link, needs hover; derived opacity, no new hex).
- **Dark-stable fill (Pattern 3, RESEARCH recommends option (a)):** the accent fill must NOT lighten to `.dark`'s mid-teal (`--accent-product: 183 34% 46%` → white drops to 3.30:1 FAIL). Introduce a dark-stable fill token (`--bento-accent-fill: 183 38% 26%` in `:root` AND `.dark`, registered in tailwind.config `colors`) and reference it in the accent variant, OR document the dark caveat. `default` variant + `min-h-11` + `rounded-[var(--radius-tile)]` + focus-visible ring stay UNCHANGED.

**Zero-hex + no bare-var guard (the source-scan tests at lines 80–88 already enforce this on this file):** the accent edit must contain no `#` hex and no `[--var]` shorthand — use registered utilities (`text-accent-product-foreground`) or `[var(--token)]`.

---

### `app/components/search-box.tsx` (island — EDIT `isHero` branch ONLY)

**Analog:** self. Touch ONLY the truthy side of each `isHero ? … : …` ternary. Editing the shared/default strings breaks `/buscar` (uses default variant) and `search-box.test.tsx` (RESEARCH Pitfall 3).

**Current hero input class (line 115 — shared, both variants):**
```tsx
className="h-12 pl-9 text-base"
```
Target: hero gets `h-[52px]` + `rounded-[var(--radius-control)]`. Because this className is currently shared, the executor must split it into an `isHero ? … : …` ternary so the default `/buscar` input keeps `h-12`.

**Current hero button class (lines 119–128 — already an isHero ternary):**
```tsx
<Button
  type="submit"
  className={
    isHero
      ? "h-12 whitespace-nowrap bg-accent-product px-6 font-semibold text-background hover:bg-accent-product/90"
      : "h-12 bg-accent-product text-background hover:bg-accent-product/90"
  }
>
  {isHero ? "Buscar proyectos" : "Buscar"}
</Button>
```
Target hero button: `h-12` → `h-[52px]`, add `rounded-[var(--radius-control)]`. KEEP `bg-accent-product`, `font-semibold`, `text-background`, `hover:bg-accent-product/90`, label `Buscar proyectos` — `search-box.test.tsx:40-47` asserts all four on the hero button.

**Pills — ALREADY compliant, DO NOT change (lines 138–144):**
```tsx
"inline-flex min-h-11 items-center rounded-full border border-border bg-muted px-4 py-2 text-sm",
"transition-colors hover:border-accent-product/50",
```
Already `min-h-11` (44px) + `rounded-full` + `hover:border-accent-product/50`. UI-SPEC says pills unchanged.

**Empty-submit guard + form GET fallback — PRESERVE VERBATIM (lines 62–78, 88–92):** `navigate()` trims + early-returns on empty; `<form role="search" action="/buscar" method="get" onSubmit={handleSubmit}>`. Single `"use client"` island invariant preserved (line 1).

---

### Token registration: `app/app/globals.css` + `app/tailwind.config.ts`

**Analog A (existing HSL triples, `:root` + `.dark`, globals.css:24-35):**
```css
:root {
  --accent-product: 183 38% 26%;
  …
  --radius-tile: 16px;
  --radius-control: 11px;
}
.dark {
  --accent-product: 183 34% 46%;
}
```

**Analog B (config colors map — THE registration site, tailwind.config.ts:46):**
```ts
"accent-product": "hsl(var(--accent-product))",
```

**Add (Pattern 2 — BOTH files):**
```css
/* globals.css — :root AND .dark, identical value (dark-stable, ≥7:1 on petróleo) */
--accent-product-foreground: 183 30% 96%;   /* ≈ #EAF2F1 */
```
```ts
// tailwind.config.ts — mirror the accent-product line
"accent-product-foreground": "hsl(var(--accent-product-foreground))",
```

**Do NOT use the `@theme inline` idiom for THIS token.** That block (globals.css:70-78) is for civic tokens whose source is already a full `hsl()`:
```css
@theme inline {
  --color-identity-warn-bg: var(--identity-warn-bg);
  --color-accent-product-soft: var(--accent-product-soft);
}
```
Our token is a bare triple → `hsl(var(...))` wrapper lives in the config (double-`hsl()` = invalid color, gotcha 54-04).

---

## Shared Patterns

### cva + cn + asChild/Slot (all bento components)
**Source:** `app/components/bento/bento-tile.tsx:1-64` (declares it is verbatim of `app/components/ui/button.tsx`).
**Apply to:** any tile edit; the accent-string edit stays inside `cva(...)` — do not add ad-hoc classes to the JSX.
```tsx
const Comp = asChild ? Slot : "div";
return <Comp className={cn(bentoTileVariants({ variant, span, className }))} ref={ref} {...props} />;
```

### Tailwind 4 arbitrary syntax — ALWAYS `[var(--token)]`, NEVER `[--token]` (CR-01)
**Source:** `bento-tile.tsx:24` (`rounded-[var(--radius-tile)]`) + negative guard `bento-tile.test.tsx:33-35,84-88`.
**Apply to:** `rounded-[var(--radius-control)]`, any arbitrary-var util this phase. `[--token]` compiles to invalid CSS in Tailwind 4.

### `→` glyph is never a whitespace text node (lesson F53)
**Source:** `app/app/page.tsx:124`.
**Apply to:** entry-card arrow + accent CTA arrow.
```tsx
<span aria-hidden="true" className="pl-1">→</span>
```

### BrandIcon on inverted surface — pass `color="currentColor"`
**Source:** `app/components/brand-icon.tsx:21-26` (default `color="#2A5859"` — petróleo). Do NOT edit the file.
**Apply to:** accent tile — pass `color="currentColor"` so the icon inherits `text-accent-product-foreground` (petróleo-on-petróleo default would be invisible).

### Page container mirrors footer/header (NOT the UI-SPEC's false claim)
**Source:** `app/app/layout.tsx:50` — `max-w-[1120px] mx-auto px-4 md:px-8`.
**Apply to:** the new wrapper around `<BentoGrid>` in `page.tsx`. Use `px-4 md:px-8`, NOT `px-6`.

### Source-scan token test idiom (`process.cwd()`, `toContain`, no `import.meta.url`)
**Source:** `app/app/globals.test.ts:14-51` (lesson 45-01: jsdom breaks `new URL(import.meta.url)`).
**Apply to:** extend `globals.test.ts` with `expect(SRC).toContain("--accent-product-foreground")` (optional, Wave 0).

### Class-presence assertion for tokens (structural, not computed — jsdom can't compute color)
**Source:** `bento-tile.test.tsx:38-42` + `search-box.test.tsx:26-47` (assert `.className.toContain("bg-accent-product")`).
**Apply to:** accent-tile test (`text-accent-product-foreground`, `hover:bg-accent-product/90`) + hero SearchBox test (`h-[52px]`, `rounded-[var(--radius-control)]`). NEVER `getComputedStyle`.

---

## Test Migration Notes (Wave 0 — breaking)

`app/app/page.test.tsx` **Contract 2** (lines 142–207) asserts `<nav aria-label="Secciones del sitio">` (line 151-155), "exactly 3 links" inside that nav, and "NO heading" (line 196-200). These BREAK when entry cards become `BentoTile` links inside `BentoGrid` (no `<nav>`). Migrate:
- Replace nav-scoped queries with grid/link-scoped queries (3 links, hrefs `{/buscar, /parlamentarios, /agenda}`, verbatim titles + bodies).
- Keep `BANNED_VOCAB` negative-match (line 147-148, 202-206).
- Keep every hero assertion (h1/cursiva/pills/trust line, lines 54–139) — LOCKED strings byte-identical.
- ADD: kicker `OBSERVATORIO DEL CONGRESO`, accent tile (`href="/sobre"`, `¿Cómo leer esto?`, CTA `Ver metodología →`, `text-accent-product-foreground`, `hover:bg-accent-product/90`), 5 `BentoTile` spans (4/2/2/2/2), `ActualidadModule` mounted, `dynamic="force-dynamic"` exported.
- The current `next/link` + `actualidad-module` mocks (lines 26–44) stay reusable.

`app/components/search-box.test.tsx`: existing hero-button assertions (lines 40–47) must still pass after the `h-[52px]`/radius edit (they assert label/semibold/petróleo, not height). EXTEND with hero input `h-[52px]` + `rounded-[var(--radius-control)]` assertions.

---

## No Analog Found

None. Every file is an in-repo edit/migrate; all patterns are established by the target file itself or a verified sibling primitive. Zero new packages, zero new architecture (RESEARCH: "presentation-only phase").

---

## Metadata

**Analog search scope:** `app/app/` (page, layout, globals, sobre), `app/components/` (search-box, brand-icon), `app/components/bento/` (grid, tile + tests), `app/tailwind.config.ts`.
**Files scanned:** 13 (all read verbatim at HEAD `536e36c`).
**Pattern extraction date:** 2026-07-15
