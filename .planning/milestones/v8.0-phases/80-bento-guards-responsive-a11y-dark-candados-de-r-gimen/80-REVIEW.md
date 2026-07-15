---
phase: 80-bento-guards-responsive-a11y-dark-candados-de-r-gimen
reviewed: 2026-07-15T18:37:23Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/lib/bento-guards.test.ts
  - app/lib/anti-insinuacion-guard.test.ts
  - app/components/search-box.tsx
  - app/components/brand-icon.tsx
  - app/app/styles/civic-tokens.css
  - app/app/page.test.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 80: Code Review Report

**Reviewed:** 2026-07-15T18:37:23Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 80 (BENTO-GUARDS) adds two source-scan guards (cero-hex + tipografía whitelisted),
extends the anti-insinuación linter to the home surfaces, and applies three product fixes
(SearchBox `aria-label`, BrandIcon `currentColor`, civic-token dark pair). The a11y fix,
the dark pair (correctly class-based, matching the app's `.dark` strategy — verified against
`globals.css`), and the anti-insinuación extension (home copy is clean, all matched terms
live in stripped comments) are sound.

The core concern flagged by the objective — **false negatives in the typography guard** — is
real and material. The scanning regex omits entire families of Tailwind arbitrary utilities
(`pt-`, `pl-`, `mt-`, `mb-`, `leading-`, `min-w-`, `min-h-`, positional utilities), so a future
ad-hoc `pl-[9px]` or `leading-[1.2]` off-step slips through the candado silently. The guard
advertises protection it does not deliver for spacing/positioning. The cero-hex guard is
solid but has one narrow false-positive vector (anchor fragments `href="#a1b2c3"`). Remaining
items are whitelist hygiene and a minor collapse-regex edge case.

No BLOCKER-tier defects: the guards are net-positive tripwires and the fixes are correct;
the WARNINGs are gaps in guard coverage that let regressions escape, not incorrect runtime behavior.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Typography guard misses whole families of arbitrary utilities (false negatives)

**File:** `app/lib/bento-guards.test.ts:229-231`
**Issue:** The detector regex enumerates only `(text|gap-x|gap-y|gap|px|py|max-w|tracking|rounded|w|h)`.
Any other Tailwind arbitrary-value utility passes the guard undetected. Verified false negatives
(regex returns `null` / no offender):

- `pt-[7px]`, `pb-[7px]`, `pl-[9px]`, `pr-[9px]` (directional padding — the whitelist even documents
  `px-[9px]` as a padding off-step, yet `pl-[9px]` would NOT be caught)
- `mt-[7px]`, `mb-[7px]`, `ml-`, `mr-`, `m-` (margins)
- `leading-[1.2]`, `min-w-[200px]`, `min-h-[40px]`, `top-[7px]`, `left-[7px]`, `size-[...]`

The guard's docstring and SUMMARY claim it locks the bento's arbitrary values, but a developer
adding `<div className="pt-[7px] leading-[1.3]">` produces zero offenders — the candado is a no-op
for those categories. This is the exact "falso negativo del regex / superficie olvidada" the
review objective targets.
**Fix:** Broaden the category list and anchor on a class boundary. Prefer a generic arbitrary-value
detector that captures any `utility-[value]` and then excludes `[var(--…)]` and the whitelist:
```ts
// Catch ANY arbitrary utility (word-boundary prefix), not a fixed prefix list:
const regex = /(?<![\w-])[a-z-]+-\[[^\]]+\]/g;
// ...then keep the existing var(--) / WHITELIST_ARBITRARIOS filtering.
```
Add mutation cases for `pl-[9px]`, `leading-[1.2]`, `mt-[7px]` to prove the bite.

### WR-02: Partial-substring matches misreport the offending class

**File:** `app/lib/bento-guards.test.ts:229-241`
**Issue:** The regex is unanchored, so it matches on substrings. `min-w-[200px]` yields offender
`"w-[200px]"` (not `"min-w-[200px]"`); a hypothetical `min-h-[40px]` reports `"h-[40px]"`. While the
offender IS reported (so it bites), the message names a class that does not exist in the source,
which will mislead whoever has to fix or whitelist it. Combined with WR-01 this also means the
guard's own whitelist (`h-[52px]`, `w-[1120px]`) could unintentionally suppress a legitimately
different `min-h-[52px]` / `min-w-[1120px]` offender via the substring collision.
**Fix:** Anchor the prefix with `(?<![\w-])` (as in WR-01 fix) so `min-w-[200px]` is captured whole
and whitelist comparisons are exact.

### WR-03: cero-hex guard false-positive on anchor/id fragments

**File:** `app/lib/bento-guards.test.ts:107-109`
**Issue:** `detectarHexHardcodeado` matches `/#[0-9a-fA-F]{3,8}\b/`. Any string fragment that looks
like hex — e.g. `href="#a1b2c3"`, `id="fade"`, a URL fragment `#dead00`, or an SVG `url(#abc123)` —
is flagged as a hardcoded hex color and fails the build, even though it is not a color literal.
The scanned surfaces (`page.tsx`, `actualidad-module.tsx`) legitimately can contain anchor `href="#…"`
fragments and SVG `url(#id)` references. `href="#seccion"` is safe today only because `seccion` is
not hex; `href="#faded"` or `href="#abc"` would false-positive.
**Fix:** Constrain to color contexts. Either require the hex to sit inside a quote/bracket color
position, or exclude anchor/url fragments:
```ts
// Only flag hex NOT immediately preceded by an anchor/url context:
const matches = contenido.match(/(?<![\w#(=])#[0-9a-fA-F]{3,8}\b/g) ?? [];
// or explicitly drop href="#..." and url(#...) before matching.
```
At minimum, add a mutation test asserting `href="#abc"` / `url(#abcdef)` are NOT reported.

## Info

### IN-01: Dead whitelist entries not exercised by any scanned surface

**File:** `app/lib/bento-guards.test.ts:211-212`
**Issue:** `h-[52px]` and `w-[1120px]` are whitelisted but, as the SUMMARY itself admits, live only
in `search-box.tsx` and `layout.tsx` — neither of which is in `SUPERFICIES_TIPOGRAFIA`. Additionally
the scanned surfaces use `max-w-[1120px]` (page.tsx:87), never a bare `w-[1120px]`. These entries are
inert documentation that the guard never verifies. If the value drifts, nothing catches it.
**Fix:** Either add `search-box.tsx`/`layout.tsx` to the typography scope so the entries are real, or
move the unexercised entries to a clearly-labeled "future scope" comment so they are not mistaken for
active protection.

### IN-02: Collapse regex can mask a bare col-span when an equal md:col-span exists

**File:** `app/app/page.test.tsx:288-298`
**Issue:** The filter `!cls.includes(\`md:${m}\`)` treats a bare `col-span-4` as non-problematic when
the same element ALSO carries `md:col-span-4` (string `md:col-span-4 col-span-4` → the bare one is
suppressed). A real base-level `col-span-4` (which breaks mobile collapse) would then be missed. In
practice bento tiles use only `md:col-span-N`, so exposure is low, but the assertion is weaker than
it reads.
**Fix:** Tokenize the className on whitespace and check each token independently for a `col-span-N`
lacking a responsive prefix, instead of substring-including the whole class string.

### IN-03: Anti-insinuación negation subtraction is exact-string and brittle

**File:** `app/lib/anti-insinuacion-guard.test.ts:267-270`
**Issue:** `NEGACIONES_LOCKED` are subtracted via `texto.split(neg).join(" ")`, an exact literal match.
If the rendered leyenda in any surface differs by a single character (JSX line-wrapping, a changed
space, curly-quote), the subtraction silently fails and the guard would flag the very leyenda that
enforces the rule. This is pre-existing (VOTO-04), but Phase 80 broadens the scan to the home
surfaces, so it is worth noting the coupling remains fragile.
**Fix:** Normalize whitespace on both the content and the negation before subtracting, or match the
leyenda by a stable regex rather than exact string.

### IN-04: `size` and 4-8 digit hex boundary — minor detector gaps

**File:** `app/lib/bento-guards.test.ts:108, 231`
**Issue:** (a) The cero-hex `{3,8}\b` means a 9–10 hex-digit token (e.g. an accidental `#1234567890`)
matches no boundary at char 8 and is skipped — unlikely for colors but a blind spot. (b) The Tailwind
`size-[...]` shorthand (equivalent to `w-`/`h-`) is not in the typography category list, so
`size-[52px]` slips through (related to WR-01). Low impact; documented for completeness.
**Fix:** Covered by the WR-01 generic-prefix rewrite (which captures `size-[…]`); the hex upper bound
is acceptable to leave as-is for color literals.

---

_Reviewed: 2026-07-15T18:37:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
