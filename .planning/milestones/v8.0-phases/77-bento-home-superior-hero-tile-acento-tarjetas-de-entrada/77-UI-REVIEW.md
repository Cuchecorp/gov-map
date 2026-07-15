# Phase 77 — UI Review

**Audited:** 2026-07-15
**Baseline:** 77-UI-SPEC.md (approved design contract, BENTO-HOME-SUPERIOR)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — code-only audit, jsdom-level)
**Mode:** AUTONOMOUS / advisory (non-blocking). Real visual gate = Phase 79/81.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All LOCKED strings verbatim; anti-insinuación honored (mockup "correlaciones" BANNED string absent) |
| 2. Visuals | 4/4 | Clear focal hierarchy (hero span-4 → accent → entry grid); all icons `aria-hidden`, glyphs non-text-node |
| 3. Color | 4/4 | Zero hex in composition; accent fill dark-stable via `--bento-accent-fill`; AA foreground token wired |
| 4. Typography | 3/4 | Two weight families held (400/600) + mono kicker; hero h1 scale diverges from spec table (see finding) |
| 5. Spacing | 3/4 | Spec-declared radius tokens consumed correctly; hero/accent tile padding uses round steps not mockup-exact (sanctioned discretion) |
| 6. Experience Design | 4/4 | Empty-submit guard, progressive-enhancement form, focus rings, hover affordances, 44px targets all present |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Hero h1 renders at `text-4xl md:text-5xl` (36→48px), spec Typography table declares `text-3xl md:text-4xl` (30→36px)** — no user-facing harm (LOCKED copy renders legibly, focal weight is intended), but it is a documented internal contradiction inside the spec itself (row 85 explicitly says "preserve the current LOCKED h1 rendering ... the current home uses `text-4xl md:text-5xl`"). The implementation followed the prose instruction over the table cell. Fix: reconcile the spec table to `text-4xl md:text-5xl` so the contract is self-consistent; no code change needed. WARNING (spec drift, not code defect).

2. **`brand-icon.tsx` retains hardcoded default `color="#2A5859"` (lines 22, 51)** — not a defect on this surface (accent tile passes `color="currentColor"`, so petróleo-on-petróleo invisibility is avoided and no hex enters the accent path), but the hex default remains a latent trap for any future consumer that forgets the override. Fix: default `color="currentColor"` in `brand-icon.tsx` and let callers set petróleo via `text-accent-product`; eliminates the hex-literal footgun before the Phase 80 zero-hex candado. WARNING.

3. **Tile-internal padding uses round Tailwind steps (`p-8` hero, `p-6` accent/entry) vs mockup 34px/26px/24px** — spec §Spacing explicitly sanctions this as Claude's discretion, so not a violation; entry `p-6`=24px is mockup-exact, hero/accent are ~2px off. Fix: only if the Phase 79/81 human visual gate flags the hero as visually cramped, bump to `p-[34px]`/`p-[26px]`. Deferred, low priority. WARNING.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Kicker `OBSERVATORIO DEL CONGRESO` present (page.tsx:76), Geist Mono uppercase — matches contract row (the only net-new hero string).
- Hero h1 `Qué pasó con cada proyecto de ley y cada parlamentario.` + cursiva `Con la fuente a la vista.` byte-identical to LOCKED (page.tsx:81-84).
- Subtitle, trust line, all 4 pills (`14309-04` mono), 3 entry-card titles/bodies, accent CTA `Ver metodología →` — all verbatim vs Copywriting Contract table.
- **Anti-insinuación (invariant 2):** accent-tile body adopts the `/sobre` "El principio" formula (page.tsx:115-119); the BANNED mockup string "Las correlaciones no son indicativas de irregularidades…" is absent. Grep for `correlacion`/`irregularidad`/`afinidad` in page.tsx: no matches. Green by construction.
- Placeholder mockup h1 (`Busca cualquier proyecto…`) correctly kept out of production.

### Pillar 2: Visuals (4/4)
- Clear focal point: hero `span-4` dominates row 1; search box is the protagonist (`mt-10`, page.tsx:93). Accent tile + 3 entry cards form the secondary tier.
- Icon discipline: entry-card diamond SVG `aria-hidden` (page.tsx:142); `→` glyphs `aria-hidden` and wrapped in `<span className="pl-1">` — NOT a whitespace text node (lesson F53 honored, page.tsx:123, 157).
- `BrandIcon` on accent tile receives `color="currentColor"` (page.tsx:110) → inherits `text-accent-product-foreground`, avoiding the petróleo-on-petróleo invisibility the spec warns about (§BrandIcon caveat). Verified against brand-icon.tsx default.
- Visual hierarchy via size (span 4/2/2/2/2), weight (600 titles vs 400 body), and reserved accent — three differentiators present.

### Pillar 3: Color (4/4)
- **Zero hex in composition:** grep for `#`/`rgb(`/`rgba(` in page.tsx → no matches. Cardinal rule (§30) satisfied.
- Accent-foreground AA fix landed: `--accent-product-foreground: 183 30% 96%` in both `:root` and `.dark` (globals.css:39, 67); registered as Tailwind util in tailwind.config.ts:48. Resolves 76-UI-REVIEW warning #1.
- Dark-stable accent fill: `bento-tile.tsx:30` uses `bg-bento-accent-fill` (pinned `183 38% 26%` in both themes, globals.css:40/68, registered tailwind.config.ts:50) — the mid-teal 3.30:1 FAIL pairing is structurally prevented. Contract §Accent Foreground Fix met.
- Accent hover: `hover:bg-bento-accent-fill/90` (bento-tile.tsx:30) — resolves 76-UI-REVIEW warning #2.
- Accent usage stays within the reserved list: fill (accent tile), button (`bg-accent-product`, search-box.tsx:128), cursiva (page.tsx:82), diamond marker (page.tsx:143), focus rings, hover borders (`hover:border-accent-product`, bento-tile.tsx:28). No accent on `default` tile fills, no data-bearing accent.

### Pillar 4: Typography (3/4)
- Weight families held to two: `font-medium` (kicker/mono-500 role only) + `font-semibold` (600) + implicit 400 body. No `font-bold`/`font-light`/stray weights in page.tsx.
- Kicker `text-[11px] font-medium ... tracking-[0.08em]` (page.tsx:75) matches contract row exactly.
- **Deduction:** Hero h1 is `text-4xl md:text-5xl` (page.tsx:80) = 36→48px. Typography table (spec row 85, col "Size") declares `text-3xl md:text-4xl` (30→36px). The spec's own prose in the same row contradicts its table and instructs preserving `text-4xl md:text-5xl` — so the code is defensible, but the contract is internally inconsistent. Flagged as spec drift; -1.
- Entry title `text-lg font-semibold` (page.tsx:161), body `text-sm text-muted-foreground` (page.tsx:162), accent h2 `text-xl font-semibold` (page.tsx:112) — all match their table rows.

### Pillar 5: Spacing (3/4)
- Sanctioned off-step tokens consumed correctly: `rounded-[var(--radius-control)]` (11px) on input + button (search-box.tsx:118, 128) — first consumer this phase, as contracted; `rounded-[var(--radius-tile)]` baked into BentoTile (bento-tile.tsx:24). CR-01 `[var(--token)]` syntax used, never `[--token]`. Verified.
- BentoGrid `gap-[14px]` consumed as-is from Phase 76 (not re-declared here).
- Container `max-w-[1120px] mx-auto px-4 md:px-8 pt-10 md:pt-14` (page.tsx:69) — RESEARCH override acknowledged (px-4 md:px-8 per note); not marked a deviation.
- Vertical rhythm uses the 4px scale: `mt-3`, `mt-6`, `mt-10`, `mt-8`, `mt-2`, `mt-1` — all on-step.
- **Deduction:** hero `p-8` (32px vs mockup 34px) and accent `p-6` (24px vs mockup 26px) are ~2px off the mockup. Spec §Spacing sanctions this as discretion (not a violation), but it is a measurable divergence from the drawn mockup that only the Phase 79/81 pixel gate can adjudicate; -1 pending that gate. Entry `p-6`=24px is exact.

### Pillar 6: Experience Design (4/4)
- Empty-submit guard intact: `navigate()` trims + returns on empty (search-box.tsx:63-69); `handleSubmit` preventDefaults on empty (search-box.tsx:71-79) — never routes to `/buscar?q=`.
- Progressive enhancement: `<form role="search" action="/buscar" method="get">` (search-box.tsx:89-92) works without JS; `router.push` is the enhancement only. Single `"use client"` island preserved (SearchBox); page + tiles are server components.
- `force-dynamic` preserved (page.tsx:14) — the ActualidadModule live-data invariant (F50) holds.
- Focus rings: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` on every BentoTile (bento-tile.tsx:24) and pills (search-box.tsx:147).
- Hover affordances: accent tile `/90` darken, default tiles `hover:border-accent-product`, pills `hover:border-accent-product/50`.
- Touch targets: `min-h-11` (44px) on BentoTile and pills; input/button `h-[52px]`.
- Responsive collapse (resolves 76 warning #3): every child mounted as `BentoTile` with `md:col-span-N` and no base col-span (bento-tile.tsx:32-36) → collapses to full width ≤md. DOM order = documented collapse order (hero → accent → 3 entry cards).
- `nav` landmark uses `className="contents"` (page.tsx:132) so it is transparent to the CSS grid while preserving the `aria-label="Secciones del sitio"` landmark (post-review fix acknowledged).
- No loading/error/empty states required this phase (100% presentation, no new RPCs) — correctly absent per contract. ActualidadModule retained below grid (page.tsx:175).

---

## Registry Safety

Per 77-UI-SPEC §Registry Safety: shadcn official only, **no third-party registries**, no `npx shadcn add`/`view` this phase (all pieces hand-authored or already vendored). Registry audit: **0 third-party blocks checked, no flags.** Gate not applicable.

---

## Files Audited
- `app/app/page.tsx` (bento composition — hero, accent tile, 3 entry cards)
- `app/components/bento/bento-tile.tsx` (accent variant edits: `bg-bento-accent-fill`, hover, foreground)
- `app/components/search-box.tsx` (hero variant restyle — 52px control, radius token, pills)
- `app/components/brand-icon.tsx` (hex-default check on accent surface)
- `app/app/globals.css` (accent tokens `--accent-product-foreground` / `--bento-accent-fill`, radius tokens)
- `app/tailwind.config.ts` (token registration for the two new accent utils)
