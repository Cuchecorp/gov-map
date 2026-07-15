# Phase 78 — UI Review

**Audited:** 2026-07-15
**Baseline:** 78-UI-SPEC.md (design contract, approved-pending)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — code-only audit)
**Mode:** retroactive / advisory (real visual gate deferred to Phases 79/81)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string verbatim from contract; `Ver todo →` correctly omitted (no honest route); honest empty-states + meta degradation |
| 2. Visuals | 4/4 | Clear hierarchy; civic bar `aria-hidden` paired with text label (colorblind-safe); dots `aria-hidden` |
| 3. Color | 4/4 | Zero hex; all tokens; `bg-[var(--camara/senado)]` avoids double-hsl; accent confined to reserved list |
| 4. Typography | 3/4 | Weights clean (semibold/medium + mono); but 6 distinct font sizes across 3 tiles — dense scale, though each is spec-declared |
| 5. Spacing | 4/4 | All off-step arbitrary values trace to sanctioned mockup exceptions; one trivial `mt-0.5` vs implied `mt-1` |
| 6. Experience Design | 4/4 | Per-tile `<Suspense>` skeletons, `#34` throw discipline, `min-h-11` targets, guarded external links, frescura tile omitted at 0 items |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Typography scale density (WARNING)** — 6 distinct sizes (`text-lg/sm/xs/[15px]/[13px]/[11px]`) live inside the lower-half module — increases the number of visual "voices" a reader parses on the home. Impact: mild scanning friction, not a break. Fix: at the Phase 80/81 visual gate, confirm `text-[15px]` (votado title) and `text-sm` (urgencia title) reading as two clearly different tiers is intentional; consider collapsing `text-[13px]` desenlace + link to a single documented body size if they read as the same tier on-screen. Contract-compliant as-is; flag is about aggregate density, not any single deviation.
2. **`desde {fecha}` gap off by one step (WARNING → trivial)** — `actualidad-module.tsx:317` uses `mt-0.5` (2px) for the urgencia `desde` line; spec typography table implies the `xs/sm` rhythm (`mt-1`, 4px) used everywhere else in the tile. Impact: 2px inconsistency, invisible without pixel inspection. Fix: change `mt-0.5` → `mt-1` for rhythm consistency, or leave and note as intentional tightening under the chip.
3. **Visual gate still owes the grid/collapse proof (WARNING — structural, deferred)** — jsdom cannot see the `span-4 / span-2 / span-6` bento layout or the ≤md collapse order (votado→urgencias→frescura). Code declares spans correctly and DOM order matches, but the actual grid render + collapse is unverified. Impact: layout regressions (tile overflow, span mismatch, frescura strip wrapping) would not be caught here. Fix: run the Phase 79/81 human/Playwright visual gate at 1440/768/375 before shipping.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Votado heading `Votado esta semana` (`:152`), Urgencias `Urgencias vigentes` (`:296`), frescura label `Última actualización de datos` (`:440`) — all verbatim per contract.
- Empty states verbatim: `Sin votaciones registradas esta semana en las fuentes consultadas.` (`:154-155`), `No hay urgencias vigentes registradas esta semana.` (`:298-299`).
- Source link resolves to the sanctioned default `Ver fuente oficial ↗` (`:212`), with internal fallback `Ver proyecto →` (`:219`) when `safeExternalHref` returns null — matches the "default = keep fuller label" discretion resolution.
- `Ver todo →` was **omitted** (no header link) — the correct outcome per the sanctioned decision ("no honest all-votaciones destination → OMIT rather than 404"). No 404 risk introduced.
- Meta line honest-degrades: `{fecha} · Cámara|Senado` when camara known, `Votación del {fecha}` otherwise (`:200-204`) — never fabricates a chamber.
- Urgencia chip renders `{it.tipo}` verbatim (`:309-311`) with no force-casing. No generic labels ("Submit"/"OK"/"Save") anywhere. Anti-insinuación posture intact (factual reporting, en-dash tally via `conteoVotacion`).

### Pillar 2: Visuals (4/4)
- Hierarchy present: h2 (18px semibold) → item h3 (15px/14px semibold) → body 13px → mono meta 12px. Distinct tiers by size + weight + color.
- Civic 3px bar (`:167-176`) is `aria-hidden="true"` AND paired with a text chamber label in the meta line — color is never the sole information channel (colorblind-safe by construction, per contract §Contrast).
- Frescura dot (`:445-448`) and camara bar both `aria-hidden` — decorative-only, correctly hidden from AT.
- No icon-only buttons; `↗`/`→` are text glyphs inside labelled links, not standalone icon controls.

### Pillar 3: Color (4/4)
- Zero `#` hex literals in the component (grep clean). Every color is a token.
- Civic bars use `bg-[var(--camara)]` / `bg-[var(--senado)]` (`:171-173`). Verified in `civic-tokens.css:10,16` that `--camara`/`--senado` are complete `hsl(...)` strings → no `hsl()` wrapper needed, double-hsl gotcha (54-04) avoided. Correct.
- Urgencia chip fill `bg-accent-product-soft` (`:309`) resolves via `--color-accent-product-soft` registered in `globals.css:87`. Correct wiring, no new theme edits.
- Accent (`--accent-product`) confined to the reserved list: links (`:210,217,322`), chip text (`:309`), frescura dot (`:446`). Never a tile fill, never a border on these `default` tiles, never signals affinity. Civic bar is provenance (chamber), not affinity.

### Pillar 4: Typography (3/4)
- Weights: `font-semibold` + `font-medium` only, plus `font-mono` role (`:152,178,296,309,312,440`). No stray `font-bold`/`font-light`. Clean per contract.
- Sizes in use: `text-lg` (18), `text-[15px]`, `text-sm` (14), `text-[13px]`, `text-xs` (12), `text-[11px]` = **6 distinct sizes** across three tiles. Each is explicitly declared in the spec's Typography table (mockup-exact), so contract-compliant — but 6 tiers is a dense scale for a lower-half content module. WARNING on aggregate density, not on any single value. The 11px chip mirrors the sanctioned `.net-chip` precedent (DEBT-05).

### Pillar 5: Spacing (4/4)
- Arbitrary values all trace to sanctioned mockup off-step exceptions: bar `w-[3px] rounded-[2px]` (`:170`), grid-inherited item gap `gap-[14px]` (`:164`), strip `py-[18px] ... gap-x-[22px]` (`:439`), chip `px-[9px]` (`:309`). All documented in spec §Spacing Scale "sanctioned off-step exceptions" — not violations.
- Tile padding `p-6` (votado/urgencias) and `py-[18px] px-6` (strip) match the fixed-in-plan decisions.
- Only nit: `desde` line `mt-0.5` (`:317`) vs the `mt-1` rhythm used elsewhere in the same tile — 2px, cosmetic.

### Pillar 6: Experience Design (4/4)
- Loading: three per-tile `<Suspense fallback={<BloqueSkeleton span={N} />}>` in `page.tsx:188-196`; skeleton is honest (`aria-hidden`, asserts no data).
- Error: `#34` throw discipline preserved on every read (`actualidad-module.tsx:245,352,383,485,513`) — a real read error throws, never `?? []` fabricating "sin datos". The `?? []` only guards the legitimate zero-row path.
- Empty: honest per-block empty states; frescura tile returns `null` at 0 items (`:435`) per sanctioned decision (no bare strip label).
- Touch targets: all links `min-h-11` (`:210,217,322`). External links carry `target="_blank" rel="noopener noreferrer"` (`:208-209`).
- Tally guard: `0–0` suppressed when both totals are 0 (`:189`) — avoids showing a fake recount (WR-03). Timezone anchored to America/Santiago (`inicioSemanaIso`, `:67-112`). Urgencias 2-step fetch avoids intra-boletín truncation (WR-02, `:338-407`). No destructive actions → no confirmation needed.
- Registry Safety: shadcn initialized but spec declares **no third-party registries** and no `shadcn add`/`view` this phase (all pieces hand-authored/pre-existing). Registry audit: 0 third-party blocks, no flags.

---

## Files Audited
- `app/components/actualidad-module.tsx` (implementation — 3 tiles + fetchers)
- `app/app/page.tsx` (BentoGrid mount, Suspense wiring, force-dynamic)
- `app/components/actualidad-module.test.tsx` (migration coverage — camara bar, empty states, civic contract confirmed)
- `app/app/styles/civic-tokens.css` (verified `--camara`/`--senado` are full hsl strings)
- `app/app/globals.css` (verified `--color-accent-product-soft` wiring)
- `.planning/phases/78-.../78-UI-SPEC.md` (design contract baseline)
