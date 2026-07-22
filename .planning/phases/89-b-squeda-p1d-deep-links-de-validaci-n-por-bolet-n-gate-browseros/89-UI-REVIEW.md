# Phase 89 — UI Review

**Audited:** 2026-07-22
**Baseline:** 89-UI-SPEC.md (approved 2026-07-21)
**Screenshots:** Partial — desktop capture of the ficha section is present and usable as visual evidence (`03-ficha-16572-06-valida-en-fuente-desktop.png`). Mobile captures (`04-buscar-mobile-390px.png`, `-constrained.png`) are broken/render-error files and show the /buscar page, NOT the ficha at 390px — the mobile ≥44px / no-overflow contract is UNVERIFIED visually. No live dev server; code-only for the remaining audit.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every contract string matches verbatim; fail-honest matrix implemented per-datum |
| 2. Visuals | 3/4 | Clear hierarchy and external `↗` indicator; icon/affordance fine, but link color likely not landing (see Color) weakens the primary affordance |
| 3. Color | 2/4 | **WARNING** — `text-[color:var(--accent-product)]` emits invalid CSS (`color:183 38% 26%`, no `hsl()`); deep-links likely render as inherited foreground, not petróleo — the one accent the contract LOCKS |
| 4. Typography | 4/4 | Exactly the declared ramp (`text-xl/sm/xs`, `font-mono text-xs`) and two weights (normal + semibold) |
| 5. Spacing | 3/4 | `mt-12`, `p-6`, `space-y-4/3`, `min-h-11` all on-scale; `gap-0.5` (2px) and `space-y-3` (12px) are minor off-token additions vs the declared 4/8/16/24 set |
| 6. Experience Design | 4/4 | Suspense skeleton shape-matched; honest-error throws (#34); fail-honest omission of Cámara/BCN/respaldo; R2 allowlist guard; `safeExternalHref` + `noopener` on every href |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Accent color token applied via invalid arbitrary CSS** (`validacion-fuente.tsx:122,140`) — The LOCKED accent (petróleo, the deep-link's whole affordance) probably falls back to `currentColor`/foreground because `--accent-product` is a *bare* HSL triplet (`183 38% 26%`) and `text-[color:var(--accent-product)]` produces `color: 183 38% 26%` (invalid). Same defect on `outline-[color:var(--accent-product)]` for focus-visible. Fix: wrap at use site — `text-[color:hsl(var(--accent-product))]` and `outline-[color:hsl(var(--accent-product))]` — or register a `--color-accent-product` theme utility in `globals.css @theme inline` (mirror the `--color-accent-product-soft` pattern already there at line 87) and use `text-accent-product`. Verify with `getComputedStyle` on deployed render (project gotcha: this class of bug is invisible in code review, only caught on real deploy).

2. **Mobile 390px contract is unverified** — The Responsive clause (every link ≥44px touch height, label + `↗` on one legible row, no horizontal overflow, mono boletín may wrap) has NO valid visual evidence: the two `04-*` mobile PNGs are broken files showing /buscar, not the ficha. `min-h-11` is present in code, but the anti-overflow and single-row legibility claims are untested. Fix: re-capture the ficha at 390px and confirm no horizontal scroll and ≥44px hit areas.

3. **Focus-visible outline width lacks explicit style/offset** (`validacion-fuente.tsx:122,140`) — Classes set `focus-visible:outline-[2px]` + color but no `outline-style: solid` nor `outline-offset`; the contract specifies `outline: 2px solid hsl(var(--accent-product))` matching `.net-b-row:focus-visible`. Without an explicit style the outline may not paint, and it inherits the same broken-color issue as #1. Fix: add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` and wrap the color in `hsl()`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Verbatim contract compliance:
- Heading "Valida este dato en la fuente" (`validacion-fuente.tsx:104`) — exact.
- "Ver en el Senado ↗" / "Ver en la Cámara ↗" with secondary "Ficha de tramitación oficial" (`:124-127`, `:142-146`) — exact, `↗` glyph present.
- "según fuente al {fecha}" inline provenance (`:107-110`); "Respaldo del {fetched_at} · hash {slice(0,12)}…" + "Esto decía la fuente ese día." (`:157-167`) — exact, no download link.
- BCN omitted from DOM (comment `:150-151`); Cámara row conditional on `prm_id_camara !== null` (`:133`) — fail-honest matrix honored per-datum.
- No banned insinuación/evaluative terms (`score`/`ranking`/`nivel`) anywhere in the component.
No generic labels. Nothing to fix.

### Pillar 2: Visuals (3/4)
Screenshot `03` confirms a single bordered card, one clear h2 focal point, stacked link rows with primary label + muted secondary caption, hairline divider before the respaldo block — good hierarchy through size/weight/muted color. External `↗` indicator visible on both links; `aria-label … (abre en nueva pestaña)` present (`:121,139`). Downgraded to 3 because the primary affordance's color signal is compromised (see Pillar 3) — in the capture the links read closer to foreground-dark than a distinct link color, weakening "this is clickable / official source."

### Pillar 3: Color (2/4)
**WARNING.** Contract LOCKS petróleo (`--accent-product`) as the *only* accent, reserved for deep-link text + underline + focus outline; everything else is `--muted-foreground` on `--card`/`--background`.
- `globals.css:24` defines `--accent-product: 183 38% 26%` as a **bare** HSL triplet (needs `hsl()` wrapping). Only `--accent-product-soft` (civic-tokens.css:32) is a full `hsl()`.
- Component uses `text-[color:var(--accent-product)]` (`:122,140`) and `outline-[color:var(--accent-product)]` — these compile to `color: 183 38% 26%` / `outline-color: 183 38% 26%`, both **invalid CSS**, so the accent silently falls back to inherited `currentColor`. This is the documented project gotcha (Tailwind v4 `[var(--t)]` needs baked `hsl()`; "cascada CSS solo cazable con getComputedStyle en deploy real").
- Everything else is correct: `bg-card`, `border-border`, `text-muted-foreground` on captions/respaldo, zero hex in code, no petróleo fill, no color used to signal Senado-vs-Cámara identity (text labels only — anti-insinuación honored).
Score 2, not 1: the palette *choices* are contract-perfect; the single accent is present but likely non-rendering due to the token-wrapping defect. Fix per Priority #1.

### Pillar 4: Typography (4/4)
Only the declared ramp appears: `text-xl font-semibold` heading (`:104`), `text-sm font-normal` link label (`:124,142`), `text-xs text-muted-foreground` captions/secondary (`:107,125,143,157,166`), `font-mono` on fecha/hash mono runs (`:109,159,163`). Exactly two weights (normal 400, semibold 600). No off-ramp sizes, no third weight. Contract met.

### Pillar 5: Spacing (3/4)
On-scale: `mt-12` (48px sibling rail, LOCKED frontier) at `page.tsx:220`; `p-6` (24px) block padding, `space-y-4` (16px) block rhythm, `min-h-11` (44px touch target) on both links, `pt-2 border-t` on respaldo (`validacion-fuente.tsx:103,122,140,156`). Minor deductions: `gap-0.5` (2px) at `:122,140` and `space-y-3` (12px) at `:113,183` are not in the declared 4/8/16/24/48 set (the spec lists xs=4/sm=8/md=16). They're reasonable micro-values but technically off-token — tighten to `gap-1`/`space-y-2` or `space-y-4` if strict adherence is wanted. No arbitrary px/rem spacing values.

### Pillar 6: Experience Design (4/4)
- Loading: `ValidacionFuenteSkeleton` shape-matched (heading bar + caption + two 44px link rows), wired via `<Suspense>` at `page.tsx:221`.
- Error: `leerSourceSnapshot` **throws** on real DB/net error (`page.tsx:615-618`) instead of degrading to empty — pattern #34 honored; honest error page handles it.
- Empty: Senado always renders (never empty); if boletín missing the whole section returns `null` (`page.tsx:626`) — no orphan heading.
- Security/interaction: `safeExternalHref` guard on every href (`:92-93`), `target="_blank" rel="noopener noreferrer"` (`:119-120,137-138`), R2 `esR2PathPermitido` allowlist prevents exposing PII-domain keys (`:46-52,100`), `r2_path` never rendered as href.
- No destructive actions (contract N/A) — correctly none present.
Full state coverage. Nothing to fix.

---

## Registry Safety
Registry audit: 0 third-party blocks. `components.json` present (shadcn initialized) but UI-SPEC declares no third-party registries and no new blocks/packages (reuses existing `Skeleton`). No flags. Section informational only.

---

## Files Audited
- `app/components/validacion-fuente.tsx` (component + URL builders + allowlist guard + skeleton)
- `app/app/proyecto/[boletin]/page.tsx` (Suspense wiring `:220-224`, server section `:623-638`, honest-error `leerSourceSnapshot` `:602-621`)
- `app/app/globals.css` (`--accent-product`, `--card`, `--border`, `--muted-foreground` tokens; `@theme inline` block `:80-88`)
- `app/app/styles/civic-tokens.css` (`--accent-product-soft`)
- `.planning/.../screenshots/03-ficha-16572-06-valida-en-fuente-desktop.png` (visual evidence — desktop)
- `.planning/.../screenshots/04-buscar-mobile-390px*.png` (broken/wrong-page — mobile UNVERIFIED)
