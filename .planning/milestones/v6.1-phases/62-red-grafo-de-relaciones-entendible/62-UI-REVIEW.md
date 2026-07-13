# Phase 62 — UI Review

**Audited:** 2026-07-10
**Baseline:** `62-UI-SPEC.md` (approved design contract) + Phase 19 tokens
**Screenshots:** not captured by this audit (no dev server on 3000/5173/8080). Phase 62-03 BrowserOS cold-read evidence exists in `red-evidence/` (13 captures + VEREDICTO.md, deploy `820ecba4`). Audit ran on current code on disk.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every declared string matches the contract verbatim; banned-vocab clean (all hits are LOCKED negations). |
| 2. Visuals | 4/4 | Clear ego focal point (seed at center, 2px ink border); icon-only info button carries `aria-label`; honest empty/filter/overflow states all present. |
| 3. Color | 4/4 | 60/30/10 respected; petróleo restricted to edges + provenance links + control accent-color only; no petróleo on nodes; no hardcoded hex/rgb in components. |
| 4. Typography | 2/4 | Contract mandates exactly 4 sizes (20/16/14/12). Code ships 6 (adds 15px node name + 13px band) — the "fold to 14px / collapse to 12px" the spec promised was never applied to the `.net-*` CSS. |
| 5. Spacing | 3/4 | 44px touch targets enforced on every interactive control; media queries correctly rem-based (48rem). One deviation: radial geometry uses `perRing=12` while the spec's ring-1 rationale claims capacity for ~10–12 nodes — borderline at 772px (documented P2). |
| 6. Experience Design | 4/4 | Loading via SSR; DB failure throws to error boundary (never fake-empty); empty, filter-excludes-all, seed-without-visible-neighbors, and >24 overflow states all handled honestly. Registry audit: no new blocks. |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Node name is 15px and a 13px micro-band survives — typography ramp has 6 sizes, contract allows 4 (WARNING).** `.net-nodo__nombre` is `0.9375rem` (15px) and `.net-nodo__camara` / `.net-arista__etiqueta` / `.net-vecinos__hecho` are `0.8125rem` (13px). UI-SPEC §Typography (L69, L80) explicitly folds the 15px node name into the 14px label step and collapses the 12–13px micro band to a single 12px step. **Fix:** set `.net-nodo__nombre` to `0.875rem` (14px), and change the three `0.8125rem` declarations to `0.75rem` (12px). This is the exact "exactly 4 sizes" acceptance bar in the contract, and the RED-02 legibility floor (14px name / 12px cámara) is what the spec named as non-negotiable.

2. **Móvil vecinos-list drops cámara border cue and radial legend — the mobile fallback is a different information surface (WARNING).** On `<768px` the canvas is `hidden` and the DOM shows `.net-vecinos` rows (name + cámara text + facts). The institutional cámara *border* cue (RED-02 wayfinding) and the "orden alfabético, no cercanía" legend live only in the desktop canvas region and the always-rendered legend block — verify the legend `<div>` is not visually starved on mobile. **Fix:** confirm the legend block renders above the mobile list (it does in DOM order — L396 before canvas), and consider echoing the cámara institutional color as a left-border on `.net-vecinos__item` so the mobile surface preserves the same Cámara/Senado wayfinding the desktop ring gives.

3. **Ring density at narrow-desktop (768–~900px) is a known but unresolved legibility risk (WARNING, deferred P2).** `perRing=12` at `RING1_R=260` packs 12 × 160px nodes on a 520px-diameter circle; the cold-read at 772px flagged nodes "ajustados hacia el centro." The spec's own ring-1 rationale (L120) claims 260px keeps 160px nodes from overlapping "up to ~10–12 neighbors" — that is the exact ceiling, with no margin. **Fix:** either raise `RING1_R` to ~300px or lower `perRing` to 10 so the first ring has slack; currently deferred as P2 in VEREDICTO.md but it is a real spacing finding, not a capture artifact alone.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Page heading `Relaciones entre parlamentarios` (page.tsx:83, 164), no-seed intro (L84-88), seed intro (L165-168), seed subline with `{nombre}` + honest fallback (L169-173) all match the Copywriting Contract verbatim.
- Legend copy (red-graph.tsx:397-419) matches the REWRITTEN radial legend including the LOCKED negations "orden alfabético, no cercanía" and "no indican afinidad ni relación."
- Overflow control "Se muestran los primeros 24 vecinos en orden alfabético" + "Ver {N} vecinos más" (L586-591) — truthful count `overflow.length` (total − 24).
- Empty state (L228-233), filters-exclude-all (L465-468), seed-without-visible-neighbors (same honest copy, CR-01), mobile heading "Vecinos de {nombre}" (L515) all present and contract-accurate.
- Banned-vocab scan green: every hit of `afinidad`/`cercanía`/`ranking`/`score` is inside a LOCKED negation, a code comment, or a test assertion — zero affirmative affinity/valuation language. No `Submit`/`OK`/generic-label patterns.

### Pillar 2: Visuals (4/4)
- Clear focal point: seed at canvas center `(0,0)` with a reinforced 2px `--foreground` border (`.net-nodo--seed`), neighbors radiating on the ring — the ego is unambiguous.
- Icon-only info button carries `aria-label="Procedencia de este hecho"` and the `Info` icon is `aria-hidden` (arista-hecho.tsx:146-150). Node `aria-label` includes "(punto de partida)" for the seed (nodo-parlamentario.tsx:75).
- Visual hierarchy via border weight (2px seed vs 1px + 3px institutional left-border), weight 600 name vs muted cámara.
- All honest states render real content, never a spinner-as-empty or error-as-empty.

### Pillar 3: Color (4/4)
- 60/30/10 inherited from Phase 19: crema `--background` page, `--card`/`--muted` for canvas/panels, petróleo `--accent-product` as accent.
- Petróleo restricted to the three declared uses: edge stroke (`.net-arista__path` L284), provenance links (`.net-prov__enlace` L348, `.net-vecinos__enlace` L444, overflow/empty Links `text-accent-product`), and checkbox `accent-color` (L176) + focus ring. Never on a node fill or border.
- Cámara distinction via institutional civic tokens as a 3px left border (`.net-nodo--camara`/`--senado`, L244-252) using the `-muted-foreground` variant — the code-review fix (WR-01) that makes the 3px border pass WCAG 1.4.11 (≥3:1) instead of the near-invisible `-muted` fills. Seed neutral border wins the left-side cascade (`.net-nodo--seed.net-nodo--camara`, L261-265, WR-02 fix).
- No hardcoded hex/rgb in any `app/components/red/*` file (grep clean); the only literal is the `hsl(0 0% 0% / 0.06)` box-shadow in CSS — an alpha shadow, not a brand color.

### Pillar 4: Typography (2/4)
- **Contract violation (the score driver):** UI-SPEC §Typography (L69) says "**Exactly 4 sizes, exactly 2 weights**" — 20/16/14/12 — and explicitly states the 15px node name folds into 14px and the 12–13px micro band collapses to 12px. The shipped `.net-*` CSS still ships **6 sizes**:
  - `0.9375rem` = **15px** — `.net-nodo__nombre` (globals.css:269) — should be 14px (`0.875rem`).
  - `0.8125rem` = **13px** — `.net-nodo__camara` (L274), `.net-arista__etiqueta` (L294), `.net-vecinos__hecho` (L433) — should be 12px (`0.75rem`).
  - Compliant steps present: `0.875rem` (14px, L155/170/391/412), `0.75rem` (12px, L303/416/439).
- Page-level Tailwind classes are compliant: `text-xl` (20px h1), `text-base` (16px intro), `text-sm` (14px), `text-xs` (12px). The violation is entirely inside the `.net-*` island CSS, which the spec governs by name.
- Weights are compliant: only 400 and 600 (`font-weight: 600` on name/heading; `font-medium` in Tailwind maps to 500 in a couple of legend `<strong>` — verify: `font-medium` = 500 at globals.css legend L400/589 is a **third weight** the "exactly 2 weights" rule bans. This compounds the finding.) `font-medium` on the legend labels and overflow heading should be `font-semibold` (600) to stay within the 2-weight ramp.
- **Why 2/4 not 3:** two distinct contract clauses (4 sizes, 2 weights) are both breached in the exact surface the phase rebuilt, and the spec named the 14px/12px floors as the RED-02 acceptance bar — this is a "notable gap, contract partially met."

### Pillar 5: Spacing (3/4)
- 44px (`2.75rem` / `min-h-11`) touch targets enforced on filter checkboxes (L171), date inputs (L185), mobile vecino rows (L404), overflow Links (L597), empty-state Link (L238) — matches the spec's touch-target exception.
- Spacing classes use the 4px scale (`mt-4`, `mt-6`, `mt-8`, `mb-4`, `p-3`, `gap-3`); CSS rem values (`0.75rem`, `1rem`, `1.5rem`, `0.5rem`, `0.125rem`) all land on the 4px grid. No arbitrary `[Npx]` spacing in the components.
- Radial geometry (`RING1_R=260`, `RING2_R=460`, `perRing=12`) is SVG-canvas pixel geometry, correctly exempt from the 4px scale per spec L63.
- **Deviation (−1):** `perRing=12` sits exactly at the spec's stated overlap ceiling ("~10–12 neighbors" at 260px) with zero margin; the cold-read observed density at 772px. It is legible but tight — the spec left ring radius to discretion, but shipping at the exact overlap boundary is a spacing risk, documented as deferred P2 rather than resolved.

### Pillar 6: Experience Design (4/4)
- Loading: SSR page (`force-dynamic`), no client loading state needed.
- Error handling: both `parlamentarios_publico` (page.tsx:74) and `subgrafo_red` (L149) throw on error → Next error boundary. Explicitly NEVER degrade to "sin relaciones" — the spec's DB/RPC-failure requirement is met.
- Empty states: 0-aristas honest copy + directorio link (L225-247); filters-exclude-all (L461-468); seed-without-visible-neighbors reuses the honest message (CR-01) so the seed is never painted alone floating and mobile is never mute; fallback-branch mobile notice (`avisoMovilFallback`, L474-479).
- Truncation: >24 neighbors → honest "N vecinos más" list of Links, never silent drop; DOM node count ≤ rendered + 1 (RED-01 invariant enforced by construction).
- XSS surface: every source link passes `safeExternalHref` (edge + mobile rows) — `javascript:` schemes emit no `<a>`.
- Registry audit: `components.json` present; UI-SPEC declares no third-party registries and no new blocks this phase (reuses `ui/tooltip`). No `npx shadcn view` needed. **Registry audit: 0 third-party blocks checked, no flags.**

---

## Files Audited
- `app/components/red/red-graph.tsx`
- `app/components/red/nodo-parlamentario.tsx`
- `app/components/red/arista-hecho.tsx`
- `app/app/red/page.tsx`
- `app/app/globals.css` (`.net-*` block, L130-448)
- `app/app/styles/civic-tokens.css` (`--camara`/`--senado` tokens)
- `.planning/phases/62-red-grafo-de-relaciones-entendible/62-UI-SPEC.md` (baseline)
- `.planning/phases/62-red-grafo-de-relaciones-entendible/red-evidence/VEREDICTO.md` (cold-read evidence)
