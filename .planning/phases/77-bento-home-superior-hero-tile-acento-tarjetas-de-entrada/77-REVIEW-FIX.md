---
phase: 77-bento-home-superior-hero-tile-acento-tarjetas-de-entrada
fixed_at: 2026-07-15T11:44:00Z
review_path: .planning/phases/77-bento-home-superior-hero-tile-acento-tarjetas-de-entrada/77-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
tests_passed: true
test_command: pnpm test -- --run
status: all_fixed
---

# Phase 77: Code Review Fix Report

**Fixed at:** 2026-07-15T11:44:00Z
**Source review:** `.planning/phases/77-bento-home-superior-hero-tile-acento-tarjetas-de-entrada/77-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, IN-03)
- Fixed: 3
- Skipped: 0
- Test gate: PASSED (`pnpm test -- --run` — 863 tests, 77 files, all green)

## Test Gate

- PASSED — `pnpm test -- --run` exited 0 after all fixes. 863 tests / 77 files green. `npx tsc --noEmit` clean (no output).

## Fixed Issues

### WR-01: Entry-tile navigation landmark silently removed (a11y regression)

**Files modified:** `app/app/page.tsx`, `app/app/page.test.tsx`
**Commit:** 21f5142
**Applied fix:** Wrapped the `{ENTRY_CARDS.map(...)}` block in `<nav aria-label="Secciones del sitio" className="contents">`. The `className="contents"` (CSS `display: contents`) makes the `<nav>` transparent to the BentoGrid CSS grid so the three BentoTile children remain direct grid items — no layout change. Added a new test assertion in `page.test.tsx` (inside the Contract 2 describe block) verifying the landmark is present via `getByRole("navigation", { name: "Secciones del sitio" })` and that the `/buscar` link is contained within it.

### WR-02: `autoFocus` on the hero search input disorients AT / keyboard users

**Files modified:** `app/app/page.tsx`
**Commit:** 21f5142 (same atomic commit as WR-01)
**Applied fix:** Removed the `autoFocus` prop from `<SearchBox variant="hero" exampleChips={EXAMPLE_CHIPS} />` in `page.tsx:94`. The `autoFocus` prop remains in `SearchBoxProps` (search-box.tsx) and the component's destructure/pass-through so `/buscar` can use it if needed in the future. The `/buscar` page does not pass `autoFocus` — no other callsite affected.

### IN-03: SearchBox JSDoc references a stale "Fase 21" variant contract

**Files modified:** `app/components/search-box.tsx`
**Commit:** bae24a5
**Applied fix:** Updated the JSDoc variant description to note explicitly that the hero branch carries `h-[52px] + rounded-[var(--radius-control)]` sizing introduced in Phase 77-01, replacing the vague "Fase 21 SC1 — paridad con el mockup de la landing" framing. No runtime effect; provenance now accurate for the next reviewer.

## Skipped Issues

None — all findings in scope were fixed.

---

_Fixed: 2026-07-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
