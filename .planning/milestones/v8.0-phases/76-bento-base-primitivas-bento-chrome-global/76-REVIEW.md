---
phase: 76-bento-base-primitivas-bento-chrome-global
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/app/globals.css
  - app/app/globals.test.ts
  - app/components/bento/bento-grid.tsx
  - app/components/bento/bento-grid.test.tsx
  - app/components/bento/bento-tile.tsx
  - app/components/bento/bento-tile.test.tsx
  - app/components/global-header.tsx
  - app/components/global-header.test.ts
  - app/app/layout.tsx
  - app/app/layout.test.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: fixed
---

# Phase 76: Code Review Report

**Reviewed:** 2026-07-15
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 76 adds the bento primitives (`BentoGrid`, `BentoTile`), two radius tokens
(`--radius-tile: 16px`, `--radius-control: 11px`), a global `scroll-margin-top`
rule, and surgical chrome changes (sticky header, footer restyle, 1120px
containers). The chrome changes and CSS tokens are correct; the `netPublicEnabled`
fail-closed gate, the CC BY LOCKED copy, and the shadcn `--radius` invariant are
all preserved as claimed.

However, the phase's central deliverable — the tile corner radius — is **broken**.
`BentoTile` consumes the new `--radius-tile` token via the Tailwind v3
arbitrary-var *shorthand* `rounded-[--radius-tile]`, which does **not** compile to
valid CSS under Tailwind v4.3.1 (this repo's version). I compiled the class with
the repo's own `@tailwindcss/postcss` plugin and confirmed it emits
`border-radius: --radius-tile;` (a bare custom-property name, not a `var()` call) —
an invalid value the browser drops, leaving the tile with `border-radius: 0`. This
is the identical defect class the repo already fixed once for
`bg-[--identity-warn-bg]` (see `identity-marker.test.tsx`, and the warning comment
in `globals.css:64-69`). The bento test suite passes only because it asserts the
class *string* is present, never that it produces valid CSS — a false green.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `rounded-[--radius-tile]` compiles to invalid CSS in Tailwind v4 — tiles render with no corner radius

**File:** `app/components/bento/bento-tile.tsx:24`
**Issue:**
The repo runs `tailwindcss@4.3.1` (verified: `require('tailwindcss/package.json').version` → `4.3.1`). In Tailwind v4 the v3 arbitrary-**shorthand** for CSS variables (`utility-[--var]`) was removed; v4 requires either `var()` inside brackets (`rounded-[var(--radius-tile)]`) or the new parenthesis shorthand (`rounded-(--radius-tile)`).

I compiled all three forms with the repo's own `@tailwindcss/postcss` plugin. Ground truth:

```
.rounded-\[--radius-tile\]      { border-radius: --radius-tile; }        ← INVALID (dropped by browser → 0)
.rounded-\[var\(--radius-tile\)\]{ border-radius: var(--radius-tile); }  ← valid
.rounded-\(--radius-tile\)       { border-radius: var(--radius-tile); }  ← valid
```

`border-radius: --radius-tile;` is not a valid declaration (bare `--radius-tile` is not a value), so the browser discards it and the tile falls back to `border-radius: 0`. The entire point of the D4 `--radius-tile: 16px` token — the 16px bento corner — never applies. This is the same failure documented in `globals.css:64-69` and fixed in `identity-marker.test.tsx` for `bg-[--identity-warn-bg]`.

Note the reviewer-context concern was correct: `rounded-[--radius-tile]` is *not* valid in Tailwind 4.x. The `--radius-control` token has no consumer yet (dead until Phase 77-78), but when consumed the same shorthand must not be used.

**Fix:**
Use the `var()` form (or the v4 parenthesis shorthand):

```tsx
const bentoTileVariants = cva(
  "rounded-[var(--radius-tile)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-11",
  // ...
);
```

Preferred long-term: register the token in `tailwind.config.ts` `theme.extend.borderRadius` (e.g. `tile: "var(--radius-tile)"`, `control: "var(--radius-control)"`) and use the flat utility `rounded-tile` — mirroring how `--radius` is exposed as `rounded-lg`. Also update the assertion in `bento-tile.test.tsx:31` to match the new class.

## Warnings

### WR-01: Bento test asserts class string presence, not CSS validity — masks CR-01 (false green)

**File:** `app/components/bento/bento-tile.test.tsx:31`
**Issue:**
`expect(tile).toHaveClass("rounded-[--radius-tile]")` passes whenever the literal class is on the element, regardless of whether Tailwind emits valid CSS for it. That is exactly why CR-01 shipped green. The repo's convention for this failure mode (see `identity-marker.test.tsx:28-34`) is to add a **negative** assertion that the invalid v3 shorthand is *not* used. This bento suite lacks that guard, so the broken class is actively asserted as correct.
**Fix:**
After applying CR-01, change the positive assertion to the valid class and add a negative guard against the shorthand:

```tsx
expect(tile).toHaveClass("rounded-[var(--radius-tile)]"); // or "rounded-tile"
expect(tile.className).not.toContain("rounded-[--radius-tile]");
```

Consider hoisting this into the source-scan style already used at line 76-78 so any future bento file using the v3 shorthand fails CI.

### WR-02: Hardcoded hex `#2A5859` in GlobalHeader duplicates the `--accent-product` token value

**File:** `app/components/global-header.tsx:39`
**Issue:**
`<BrandIcon size={26} color="#2A5859" />` hardcodes a hex that per the mockup mapping (`globals.css:31-33`, `bento-tile.tsx:14`) equals `--accent-product`. This line was not modified by Phase 76 (the sticky/container changes are on lines 33-34), so it is pre-existing and outside the bento cero-hex invariant (D4 scopes cero-hex to `components/bento/`). It is flagged because the value is a silently-drifting literal duplicate of a token: if `--accent-product` changes, the brand icon will not follow, and it will silently ignore dark mode (`--accent-product` shifts to `183 34% 46%` in `.dark`). Not a Phase 76 regression, but worth resolving when `BrandIcon` accepts a token-driven color.
**Fix:**
Drive the icon color from the token rather than a literal — e.g. have `BrandIcon` default to `currentColor` and set `text-accent-product` on the wrapping `<Link>`, or pass `color="hsl(var(--accent-product))"`. Verify `BrandIcon`'s `color` prop plumbing before changing.

## Info

### IN-01: Header and footer use inconsistent horizontal padding within identical 1120px containers

**File:** `app/app/layout.tsx:50` (footer) vs `app/components/global-header.tsx:34` (header)
**Issue:**
Header container uses `px-6 py-3`; footer container uses `px-4 md:px-8 py-8`. Both are now `max-w-[1120px] mx-auto`, so their content edges align at wide viewports but diverge below `md` (header 24px, footer 16px). The Phase 76-02 summary intentionally left footer padding untouched, so this is not a defect — just a chrome inconsistency worth reconciling in Phase 79/81's visual pass.
**Fix:** In the interior-coherence phase, align footer container padding to the header's `px-6` (or a shared container class) so left gutters match across chrome.

### IN-02: Pre-existing `[--var]` shorthand landmine is widespread outside this phase's scope

**File:** `app/components/camara-chip.tsx:28-54`, `app/components/provenance-badge.tsx:43-48`, `app/components/contratos-de-parlamentario.tsx:101`, `app/components/aportes-por-contraparte.tsx:123`, and others (`border-[--primary]`, `bg-[--camara]`, `bg-[--provenance-bg]`)
**Issue:**
The same Tailwind-v4 invalid-shorthand pattern as CR-01 exists in numerous pre-Phase-76 components; e.g. `bg-[--camara]` compiles to `background-color: --camara;` (verified). These are out of scope for this review (not in the Phase 76 diff) but confirm the pattern is a recurring, unguarded landmine. A repo-wide source-scan guard (grep for `-\[--` in `components/**`) would catch all of them and prevent recurrence — recommend scheduling under the Phase 80 "candado cero-hex / guard extendido" work.
**Fix:** Add a CI source-scan test that fails on the `-[--` arbitrary-var shorthand across `app/components/**` and migrate existing occurrences to `-[var(--…)]` or registered theme tokens.

## Fixes Applied

Fixed 2026-07-15. All 3 in-scope findings resolved. Full suite green (846/846, 77 files). `tsc --noEmit` clean.

| Finding | Commit | Description |
|---------|--------|-------------|
| CR-01 | `e3a6fe0` | `rounded-[--radius-tile]` → `rounded-[var(--radius-tile)]` in `bento-tile.tsx` (and comment) |
| WR-01 | `1dacc69` | Updated positive assertion + added runtime negative guard + source-scan guard in `bento-tile.test.tsx` |
| WR-02 | `7879c7d` | `color="#2A5859"` → `color="hsl(var(--accent-product))"` in `global-header.tsx` |

IN-01 and IN-02 not fixed (Info tier, out of scope per fix_requirements).

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
