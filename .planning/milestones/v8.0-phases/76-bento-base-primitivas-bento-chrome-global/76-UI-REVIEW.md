# Phase 76 — UI Review

**Audited:** 2026-07-15
**Baseline:** 76-UI-SPEC.md (BENTO-BASE — primitivas bento + chrome global)
**Screenshots:** not captured (no dev server on 3000/5173/8080; jsdom-only phase — real visual gate is Phase 79/81 BrowserOS)
**Mode:** Advisory / non-blocking (autonomous). Code-level audit: classes, tokens, structure.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Footer strings byte-identical to LOCKED contract; no new copy shipped, per scope. |
| 2. Visuals | 3/4 | Primitives structurally sound; accent tile lacks the spec's hover-darken derivation. |
| 3. Color | 3/4 | Zero hex in bento; but `accent` variant uses `text-primary-foreground`, which inverts in dark. |
| 4. Typography | 4/4 | Wordmark 16/600/tracking-tight matches; two weights only; scroll-mt global present. |
| 5. Spacing | 4/4 | `gap-[14px]` sanctioned off-step honored; header `px-6 py-3` = mockup 12/24; 1120px containers correct. |
| 6. Experience Design | 3/4 | focus-visible + min-h-11 + sticky present; no empty/loading states (correctly deferred), gated nav clean. |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **`accent` variant foreground is `text-primary-foreground`, not an accent-tile token** (`bento-tile.tsx:29`) — In dark mode `--primary-foreground` is `222.2 47.4% 11.2%` (near-black) rendered on `--accent-product` dark `183 34% 46%` (mid teal) → contrast collapses and the intended white-on-teal inverts. Light mode passes (~7:1). — Fix: introduce/consume a derived `--accent-product-foreground` (or `text-accent-product-soft` at full alpha) so both themes stay ≥4.5:1; do not rely on `--primary-foreground`. Formalize before Phase 80 dark verification.

2. **`accent` variant has no hover state** (`bento-tile.tsx:29`) — Spec §Component Inventory requires "hover darkens via derived token" for the accent tile; only the `default` variant carries `hover:border-accent-product`. Interactive accent tiles (arriving 77/78) will have no hover affordance. — Fix: add a derived hover (e.g. `hover:bg-accent-product/90` or a `--accent-product-hover` token matching mockup `#234A4B`) to the `accent` variant.

3. **Grid collapse contract lives on the child, not the grid** (`bento-grid.tsx:25` + `bento-tile.tsx:31-35`) — `BentoGrid` is `grid-cols-1 md:grid-cols-6`; collapse to full-width at ≤md depends entirely on each child being a `BentoTile` whose `span` maps to `md:col-span-N` (no base `col-span`). A raw section/`<a>` child (spec allows non-tile children) will NOT span or collapse predictably. — Fix: document the invariant in the primitive JSDoc that non-tile children must self-declare `col-span-full md:col-span-N`, or have BentoGrid enforce it. Low impact this phase (nothing mounted yet), real once 77/78 place sections.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Footer body, license, nav, and trust line in `layout.tsx:51-91` match the LOCKED strings in the Copywriting Contract byte-for-byte (verified: "Datos de fuentes públicas…", CC BY 4.0 scope caveat, "Metodología · Sobre el proyecto · Contacto", "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad.").
- Wordmark `gov-map` (`global-header.tsx:40`) and nav `Buscar · Parlamentarios · Agenda · Red · Sobre` (`header-nav.tsx:36-42`) unchanged and LOCKED-compliant.
- No new user-facing copy shipped — matches "primitives only" scope. Anti-insinuación surface untouched. No generic labels (Submit/OK/Cancel) present. Full pass.

### Pillar 2: Visuals (3/4)
- Clear hierarchy in chrome: wordmark (16/600) vs nav (14/500) vs footer (13-14/400) is a legible three-step scale.
- BrandIcon paired with `aria-hidden="true"` and adjacent text label (`global-header.tsx:39-40`) — not an unlabeled icon-only control. Good.
- WARNING: the `accent` tile is the strongest visual object the primitive ships, yet it has no interactive hover treatment (see Fix #2). For a tile-as-link it will read as static. Costs one point.
- Tiles are empty primitives (by design) — focal-point judgement defers to 77/78 when content lands.

### Pillar 3: Color (3/4)
- Cardinal rule honored: **zero hex literals** in `components/bento/*.tsx` (grep clean). All color via tokens: `bg-card`, `border-border`, `bg-accent-product`, `hover:border-accent-product`, `text-primary-foreground`.
- New tokens present and correctly scoped in `globals.css:34-35` (`--radius-tile: 16px`, `--radius-control: 11px`); shadcn `--radius` untouched → zero interior shape regression. Token comment documents the mockup→token map (`globals.css:33`).
- Accent usage disciplined: BrandIcon stroke (`global-header.tsx:39` via `hsl(var(--accent-product))`), accent tile fill, focus rings (`ring-ring`), active-nav underline, hover border — all on the spec's reserved-for list. Accent is never a `default` tile fill. 60/30/10 respected.
- WARNING (see Fix #1): `accent` variant foreground `text-primary-foreground` (`bento-tile.tsx:29`) is a token, so it satisfies "no hex", but it is the *wrong* token — it inverts in dark and is not derived from the accent pair. Light mode contrast ~7:1 (pass); dark mode fails. Costs one point.

### Pillar 4: Typography (4/4)
- Wordmark: `text-base font-semibold leading-tight tracking-tight` (`global-header.tsx:37`) = 16px/600/1.1/-tracking → matches contract exactly.
- Nav: `text-sm font-medium` (`header-nav.tsx:77`) = 14px/500 → matches "Nav item" role.
- Weights in bento/chrome are exactly the contracted set: 400 (implicit), 500 (nav/mono), 600 (wordmark) — no stray `font-bold`/`font-light`.
- Risk-mitigation #2 satisfied: `scroll-margin-top: 5rem` (80px) set globally (`globals.css:96`) = the spec's `scroll-mt-20`, so the sticky header won't occlude in-page anchors.

### Pillar 5: Spacing (4/4)
- Sanctioned off-step `gap-[14px]` implemented verbatim (`bento-grid.tsx:25`), not rounded to gap-3/gap-4 — the primitive's defining constant preserved.
- `--radius-control: 11px` off-step present as token (`globals.css:35`); no consumer yet (correctly deferred to Phase 77 SearchBox).
- Header inner padding `px-6 py-3` (`global-header.tsx:34`) = 24/12px = mockup `padding:12px 24px`. Container `max-w-[1120px] mx-auto` correct.
- Footer: width swapped to `max-w-[1120px]` (`layout.tsx:50`), `bg-muted/40` removed, `border-t` kept, `mt-16` retained (spec allowed mt-10/mt-16 at discretion). Footer padding stays `px-4 md:px-8` (pre-existing, LOCKED content). No arbitrary spacing violations.

### Pillar 6: Experience Design (3/4)
- Interactive affordances correct on the primitive: `focus-visible:ring-2 ring-ring ring-offset-2` + `min-h-11` (44px touch target) on BentoTile (`bento-tile.tsx:24`), header link (`global-header.tsx:37`), and nav links (`header-nav.tsx:77`).
- Polymorphism via `asChild`/Slot (`bento-tile.tsx:52`) lets a full-card `<Link>` inherit focus/min-h without duplication — good for 77/78 tile-as-link.
- Gated nav handled server-side: `showRed` filters `/red` entirely from DOM when gate OFF (`global-header.tsx:30`, `header-nav.tsx:61-63`) — never a link to a 404. Sticky `z-40` above content.
- Loading/error/empty states absent — correctly deferred (Copywriting Contract marks them Phase 78). No destructive actions this phase.
- WARNING: no hover on accent variant (Fix #2) and grid-collapse relies on child self-declaration (Fix #3) — both degrade interaction predictability once content mounts. Costs one point.

---

## Registry Safety

`components.json` present (shadcn initialized), but UI-SPEC §Registry Safety declares **shadcn official only, no third-party registries, no `shadcn add`/`view` this phase** (primitives hand-authored). No third-party blocks to audit.

**Registry audit: 0 third-party blocks checked, no flags.**

---

## Files Audited
- `app/components/bento/bento-grid.tsx`
- `app/components/bento/bento-tile.tsx`
- `app/components/global-header.tsx`
- `app/components/header-nav.tsx` (pulled for nav/token verification)
- `app/app/layout.tsx`
- `app/app/globals.css` (tokens, scroll-margin, accent pair — lines 24, 34-35, 46, 53, 96)
