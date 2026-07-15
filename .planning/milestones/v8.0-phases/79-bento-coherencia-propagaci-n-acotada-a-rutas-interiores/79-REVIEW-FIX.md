---
phase: 79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores
fixed_at: 2026-07-15T13:55:00Z
review_path: .planning/phases/79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores/79-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
tests_passed: true
test_command: pnpm test --run
status: all_fixed
---

# Phase 79: Code Review Fix Report

**Fixed at:** 2026-07-15T13:55:00Z
**Source review:** `.planning/phases/79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores/79-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01, WR-02, IN-01, IN-02, IN-03, IN-04 skoped to WR+IN)
- Fixed: 5 (WR-01, WR-02, IN-01, IN-02, IN-03)
- Skipped: 1 (IN-04 — out of objective scope, optional)
- Test gate: PASSED (`pnpm test --run`) — 885/885 tests, 78 files

## Test Gate

- PASSED — `pnpm test --run` exited 0 after all fixes. 885 tests, 78 test files, 0 failures.
  `lib/bento-coherencia-guard.test.ts` passes 8/8 (the upgraded count-based detector
  and the two-main fixture both exercise correctly).

## Fixed Issues

### WR-01: Guard cannot detect a partial /red width regression

**Files modified:** `app/lib/bento-coherencia-guard.test.ts`
**Commit:** `9d1a3e4`
**Applied fix:** Replaced the presence-based check `!contenidoRed.includes("max-w-3xl")`
with a count-based check: `(contenidoRed.match(/max-w-3xl/g) ?? []).length < N_RED_MAINS`
where `N_RED_MAINS = 2`. Also updated the `redLimpio` fixture in the mutation self-check
from a single-main template to a two-main template (picker branch + grafo branch), so the
`count >= 2` invariant is actually exercised by the self-check. All 5 mutation tests remain
green.

### WR-02: Skeleton radius mismatch on /buscar and /parlamentarios

**Files modified:** `app/app/buscar/page.tsx`, `app/app/parlamentarios/page.tsx`
**Commit:** `aa4909c`
**Applied fix:**
- `buscar/page.tsx` `ResultadosSkeleton`: added `className="rounded-[var(--radius-tile)]"`
  to the `<Card key={i}>` element (line 211).
- `parlamentarios/page.tsx` `DirectorySkeleton`: changed `rounded-lg` to
  `rounded-[var(--radius-tile)]` on the skeleton div (line 162).

### IN-01: Stale docstring in parlamentario ficha still cites max-w-5xl

**Files modified:** `app/app/parlamentario/[id]/page.tsx`
**Commit:** `5b5a745`
**Applied fix:** Updated line 38 docstring from `grid \`max-w-5xl\` de dos columnas` to
`grid \`max-w-[1120px]\` de dos columnas`.

### IN-02: Stale test docstring references max-w-5xl

**Files modified:** `app/app/proyecto/[boletin]/page.test.tsx`
**Commit:** `5b5a745`
**Applied fix:** Updated line 12 comment from `(max-w-5xl)` to `(max-w-[1120px])`.

### IN-03: Error/not-found boundaries not propagated

**Files modified:** `app/app/parlamentario/[id]/error.tsx`,
`app/app/parlamentario/[id]/not-found.tsx`,
`app/app/proyecto/[boletin]/error.tsx`,
`app/app/proyecto/[boletin]/not-found.tsx`,
`app/app/contraparte/[id]/error.tsx`,
`app/app/contraparte/[id]/not-found.tsx`
**Commit:** `018fa7b`
**Applied fix:** Mechanical token swap `max-w-3xl` → `max-w-[1120px]` on the `<main>`
element of all 6 boundary files. Each file had exactly one `<main className="max-w-3xl
mx-auto px-4 md:px-8 py-16 text-center">` — only the width token changed, no layout,
copy, or logic was touched. The swap is safe: error/not-found pages are narrow-centered
text with no columns; 1120px container with `text-center` reads identically to narrower
widths at the copy lengths involved.

## Skipped Issues

### IN-04: Guard test does not assert positive swaps

**File:** `app/lib/bento-coherencia-guard.test.ts` (whole file)
**Reason:** Out of objective scope. IN-04 is marked optional ("Fix (optional)") in the
review and was not listed in the fix requirements (`fix_scope` targeted WR-01+WR-02+IN
trivials+IN-03). Adding a positive source-scan iterating 8 route files would be a new
feature to the guard rather than a defect fix. Left for a future guard expansion if
desired.
**Original issue:** Guard only freezes two negative invariants; does not assert the
positive outcome (8 interior `<main>` carry `max-w-[1120px]`).

---

_Fixed: 2026-07-15T13:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
