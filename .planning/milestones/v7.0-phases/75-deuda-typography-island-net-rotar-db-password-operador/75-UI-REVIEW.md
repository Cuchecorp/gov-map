# Phase 75 — UI Review

**Audited:** 2026-07-15
**Baseline:** Design-system type scale (Tailwind v4 default `--text-*` steps, no `fontSize` override in `tailwind.config.ts`) + `red-graph.tsx` honest-state block as the alignment contract. No UI-SPEC.md checkpoint for this cosmetic-debt phase → audited against 6-pillar standards + the stated typography-alignment contract.
**Screenshots:** not captured (no dev server on :3000/:5173/:8080). Static code audit only — as scoped: jsdom returns `getBoundingClientRect()=0`, so the true `/red` pixel/connector non-regression is deferred to the operator's real-deploy check.
**Scope:** ADVISORY / non-blocking. Retroactive audit of a pixel-preserving `.net-*` `font-size` token swap (DEBT-05).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Out of scope — no strings touched; honest-state copy already sober and source-anchored. |
| 2. Visuals | 4/4 | Zero rendered delta; `.net-*` island visual hierarchy preserved (seed 16px / row 14px / meta 12px). |
| 3. Color | 4/4 | Out of scope — swap is font-size-only; no color/token-layer value changed. Petróleo-only-on-connectors rule intact. |
| 4. Typography | 4/4 | Island now consumes `--text-base/sm/xs`, the same steps the app + honest-state block use. `.net-chip` 11px is a documented, guarded, intentional off-step. |
| 5. Spacing | 4/4 | No spacing/line-height/letter-spacing altered by the swap; padding/gap literals untouched. |
| 6. Experience Design | 4/4 | Source-scan guard test added (820 pass); geometry `drawConn()` reads live rects, unaffected by pixel-identical swap. |

**Overall: 24/24**

---

## Top 3 Priority Fixes

None are blocking. Ranked minor observations for future consideration:

1. **`.net-chip` remains off the type scale (11px / 0.6875rem)** — *Impact:* the one class in the island that does not consume a `--text-*` token; a strict "everything on the scale" reading would flag it. *Fix (optional, NOT recommended now):* leave as-is. The off-step is deliberate (rounding up to 12px would enlarge every cámara chip and reflow the row wrap), is documented in-CSS (globals.css:268–271), and is explicitly whitelisted by the DEBT-05 guard test. This is correct system hygiene, not debt.
2. **`--text-*` tokens are inherited Tailwind defaults, not project-declared** — *Impact:* the island's alignment depends on Tailwind v4 keeping `--text-base/sm/xs` at 16/14/12px; there is no local `fontSize` override pinning them. *Fix (optional):* if a future Tailwind upgrade changes default step values, both the island and the honest-state block move together (they share the source), so alignment is preserved by construction — no action needed, noted only for traceability.
3. **`/red` visual non-regression is unproven in this audit** — *Impact:* static reasoning shows geometry is font-size-agnostic, but no pixels were rendered. *Fix:* operator real-deploy `getComputedStyle`/visual check on `/red` (already the Plan 02 checkpoint). Deferred by design.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Out of scope for a font-size swap — no string literals were modified. Incidentally confirmed the honest-state copy (`red-graph.tsx:428–433`) is on-brand: "Aún no hay relaciones… cada uno con su fuente y su fecha" — sober, source-anchored, no insinuation of intent. No generic labels in the audited surface.

### Pillar 2: Visuals (4/4)
The swap is pixel-identical, so the island's visual hierarchy is byte-for-byte preserved: seed name `--text-base`/600 (globals.css:339–342), neighbor row name `--text-sm`/600 (409–413), hecho label `--text-sm` (450–454), meta/ventana/microcopy `--text-xs` (456–470). The size-and-weight ladder that separates identity → fact → provenance is intact. Focus/selection still uses petróleo only on outline (381–389), never row fill — anti-insinuation rule visually preserved.

### Pillar 3: Color (4/4)
Out of scope — no color declaration touched. Verified `civic-tokens.css` unmodified and the `.net-*` block's color rules (`--camara-muted-foreground`, `--senado-muted-foreground`, `--accent-product`) are unchanged. The petróleo-only-on-connectors/links/focus contract (globals.css:136) holds.

### Pillar 4: Typography (4/4)
This is the pillar the phase targets, and the alignment is genuine. Confirmed 15 `font-size` declarations in the `.net-*` region (globals.css:129–560):
- **14 now consume design-system tokens:** `1rem → var(--text-base)` ×1 (line 341), `0.875rem → var(--text-sm)` ×7 (157, 172, 217, 411, 452, 487, 506), `0.75rem → var(--text-xs)` ×6 (257, 294, 350, 418, 458, 465).
- **1 intentional exception:** `.net-chip` at `0.6875rem`/11px (272), documented as an off-step sub-caption and guarded by the DEBT-05 source-scan test.

These are the **same `--text-*` steps** the honest-state block consumes as Tailwind utilities (`text-base` line 428, `text-sm` line 434, plus line 548) — no `fontSize` override in `tailwind.config.ts`, so utility and CSS-var resolve to identical values. The island now reads as one system with the surrounding ficha/graph typography.

*On the non-font-size properties (the audit's Q2):* `font-weight` (600 on seed/row names, 500 on chip, 600 on nhechos/leyenda-strong) and line-height were **not** part of the swap and remain as-authored — but they were already coherent and are not "off-contract"; the honest-state block likewise uses `font-weight` implicitly via utilities. No `letter-spacing` is declared in the island (neither before nor after), consistent with the rest of the app. Nothing drifted; nothing new introduced. The `.net-chip` 11px is the only value off the scale and is an acceptable, well-documented, test-enforced exception — not a flag.

### Pillar 5: Spacing (4/4)
No spacing property was in scope. Spot-checked that `padding`, `gap`, `margin`, `min-height` (44px touch targets at 173/187/488), and line-height literals surrounding the swapped `font-size` lines are unchanged. The pixel-identical size swap cannot shift row-box heights, so wrap behavior and vertical rhythm are preserved. Arbitrary rem values present (e.g., `0.6875rem`, `0.0625rem`) are intentional micro-tuning, pre-existing, and out of scope.

### Pillar 6: Experience Design (4/4)
- **State coverage unaffected and already strong:** honest-state (0 aristas) branch (red-graph.tsx:425), disabled pager (`.net-b-pager__btn:disabled` 499), focus-visible outline (381), selection dimming of non-selected connectors (`op … 0.13` line 388).
- **`/red` regression surface (static reasoning):** `drawConn()` (345–399) computes all geometry from live `getBoundingClientRect()` on the seed and each `.net-b-row` at raf time — it contains **no static font-size arithmetic** and never reads a font metric. Because the swap is pixel-identical (rem values equal the old px), measured node/label heights cannot change, so fan-out endpoints (`sy`, `ey`, `mx`) are invariant. No non-font-size property drifted in the swapped block. Confirmed `git diff` on `red-graph.tsx` and `tailwind.config.ts` was empty per the summary — F18 LOCKED geometry untouched.
- **Regression guard:** a source-scan test (red-graph.test.tsx, commit `cc52c7f`) now fails if any raw-rem `font-size` re-enters the `.net-*` region (whitelisting the 11px chip), preventing silent reintroduction of the debt. Suite 820 pass / 74 files.

**Registry audit:** `app/components.json` exists (shadcn), but this phase installs no registry blocks and the context lists no third-party registries — a pure CSS token swap. No registry surface to audit; no flags.

---

## Files Audited
- `.planning/phases/75-.../75-01-SUMMARY.md` (phase contract)
- `app/app/globals.css` — `.net-*` island block, lines 129–560 (the swap)
- `app/components/red/red-graph.tsx` — honest-state block (428/434/548) + `drawConn()` geometry (345–399)
- `app/app/styles/civic-tokens.css` — confirmed unmodified
- `app/tailwind.config.ts` — confirmed no `fontSize` override (tokens are Tailwind v4 defaults)
