---
phase: 80-bento-guards-responsive-a11y-dark-candados-de-r-gimen
fixed_at: 2026-07-15T19:00:00Z
review_path: .planning/phases/80-bento-guards-responsive-a11y-dark-candados-de-r-gimen/80-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
tests_passed: true
test_command: pnpm exec vitest run lib/bento-guards.test.ts
status: all_fixed
---

# Phase 80: Code Review Fix Report

**Fixed at:** 2026-07-15T19:00:00Z
**Source review:** `.planning/phases/80-bento-guards-responsive-a11y-dark-candados-de-r-gimen/80-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0
- Test gate: PASSED (`pnpm exec vitest run lib/bento-guards.test.ts` — 27/27)

## Test Gate

- PASSED — `pnpm exec vitest run lib/bento-guards.test.ts` exited 0 after all fixes.
  27 tests passed (19 original + 8 new mutation fixtures).
  All 5 real-surface scan tests remain green with the broader regex.

Note: the pre-existing `money-antiflip-guard.test.ts` timeout failure (1 test, unrelated to
these changes) was present before this fix session and is not caused by the bento-guards changes.

## Fixed Issues

### WR-01 + WR-02: Detector tipográfico endurecido con regex genérico y anchoring

**Files modified:** `app/lib/bento-guards.test.ts`
**Commit:** 35d0730
**Applied fix:**

Replaced the narrow enum regex `/(text|gap-x|gap-y|gap|px|py|max-w|tracking|rounded|w|h)-\[[^\]]+\]/g`
with a generic arbitrary-value detector:

```ts
const regex = /(?<![\w-])[a-z][\w-]*-\[[^\]]+\]/g;
```

The negative lookbehind `(?<![\w-])` anchors the match at class-word boundaries, solving both
WR-01 (missed families) and WR-02 (substring capture) simultaneously:

- WR-01: now captures `pt-`, `pb-`, `pl-`, `pr-`, `mt-`, `mb-`, `ml-`, `mr-`, `m-`, `p-`,
  `leading-`, `min-w-`, `min-h-`, `size-`, `top-`, `bottom-`, `left-`, `right-`, `inset-`,
  and any future Tailwind arbitrary utility — without enumerating a list.
- WR-02: `min-w-[200px]` is now captured whole (not as `w-[200px]`), and the whitelist
  comparison is exact, so `w-[1120px]` in the whitelist cannot suppress `min-w-[1120px]`.

Docstring of `WHITELIST_ARBITRARIOS` updated with IN-01 note explaining why `h-[52px]` and
`w-[1120px]` are retained as documented off-steps even though their current uses are outside
`SUPERFICIES_TIPOGRAFIA`.

New mutation fixtures proving the bite:
- `pl-[9px]` detected (WR-01)
- `leading-[1.2]` detected (WR-01)
- `mt-[7px]` detected (WR-01)
- `min-w-[200px]` captured complete, not as `w-[200px]` (WR-02)
- `min-w-[1120px]` not suppressed by `w-[1120px]` whitelist entry (WR-02)

Verification: all 4 scanned surfaces produce 0 offenders with the new regex — no new
entries needed in `WHITELIST_ARBITRARIOS`.

### WR-03: cero-hex guard — excluir fragmentos anchor/SVG

**Files modified:** `app/lib/bento-guards.test.ts`
**Commit:** 35d0730
**Applied fix:**

Replaced the original `/#[0-9a-fA-F]{3,8}\b/g` pattern with a pre-strip approach in
`detectarHexHardcodeado`:

```ts
const cleaned = contenido
  .replace(/\bhref="(#[^"]*)"/g, 'href=""')
  .replace(/\bhref='(#[^']*)'/g, "href=''")
  .replace(/url\(#[^)]*\)/g, "url()");
return cleaned.match(/(?<![\w#])#[0-9a-fA-F]{3,8}\b/g) ?? [];
```

The lookbehind-only approach (`(?<![\w#(=])`) was insufficient because the character
immediately before `#` in `href="#abc"` is `"` (a quote), not `=`. Pre-stripping
`href="..."` and `url(#...)` patterns before the hex search cleanly eliminates the
false-positive vector while keeping real color literals (`"#FF0000"`, `"#2A5859"`,
`"#fff"`) fully detected.

New mutation fixtures:
- `href="#abc"` (3-digit hex anchor) → 0 offenders (WR-03)
- `url(#abcdef)` (6-digit SVG fragment) → 0 offenders (WR-03)
- Mixed fixture: `href="#a1b2c3"` inocuo + `"#FF0000"` real → only `#FF0000` reported (WR-03)

## Fixes Applied

All three warnings were fixed in a single atomic commit (`35d0730`) since WR-01 and WR-02
share the same detector function and WR-03 is in the same file.

---

_Fixed: 2026-07-15T19:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
