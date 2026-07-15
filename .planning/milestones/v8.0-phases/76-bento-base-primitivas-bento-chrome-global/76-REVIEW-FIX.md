---
phase: 76-bento-base-primitivas-bento-chrome-global
fixed_at: 2026-07-15T11:00:00Z
review_path: .planning/phases/76-bento-base-primitivas-bento-chrome-global/76-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
tests_passed: true
test_command: "pnpm --filter ./app test -- --run"
status: all_fixed
---

# Phase 76: Code Review Fix Report

**Fixed at:** 2026-07-15
**Source review:** `.planning/phases/76-bento-base-primitivas-bento-chrome-global/76-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02 — Info findings IN-01/IN-02 excluded)
- Fixed: 3
- Skipped: 0
- Test gate: PASSED (`pnpm --filter ./app test -- --run` — 846/846, 77 files)

## Test Gate

- PASSED — `pnpm --filter ./app test -- --run` exited 0 after all fixes. 846 tests, 77 files. `tsc --noEmit` also clean.

## Fixed Issues

### CR-01: `rounded-[--radius-tile]` compiles to invalid CSS in Tailwind v4

**Files modified:** `app/components/bento/bento-tile.tsx`
**Commit:** `e3a6fe0`
**Applied fix:** Replaced `rounded-[--radius-tile]` with `rounded-[var(--radius-tile)]` in the `cva` base string (line 24) and updated the comment at line 14. The bare `[--var]` shorthand was a Tailwind v3 pattern removed in v4; the `var()` form emits valid `border-radius: var(--radius-tile)` CSS.

### WR-01: Bento test asserts class string presence, not CSS validity

**Files modified:** `app/components/bento/bento-tile.test.tsx`
**Commit:** `1dacc69`
**Applied fix:**
- Updated the positive assertion in the `variant=default` test from `"rounded-[--radius-tile]"` to `"rounded-[var(--radius-tile)]"`.
- Added a runtime negative guard: `expect(tile.className).not.toMatch(/rounded-\[\s*--[a-z-]+\s*\]/)` — catches any bare-shorthand class on the rendered element.
- Added a source-scan guard test: `expect(TILE_SRC).not.toMatch(/\[\s*--[a-z-]+\s*\]/)` — catches any bare `[--var]` pattern in the bento-tile source file, mirroring the identity-marker.test.tsx convention.

### WR-02: Hardcoded hex `#2A5859` in GlobalHeader duplicates `--accent-product` token

**Files modified:** `app/components/global-header.tsx`
**Commit:** `7879c7d`
**Applied fix:** Replaced `color="#2A5859"` with `color="hsl(var(--accent-product))"` on the `<BrandIcon>` call (line 39). BrandIcon accepts any CSS color string for its SVG `stroke`/`fill` props. The fix is trivially safe — no visual change in light mode (same computed color), and the icon now correctly follows `--accent-product` in dark mode.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
