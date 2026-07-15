---
phase: 79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores
reviewed: 2026-07-15T14:10:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/app/buscar/page.tsx
  - app/app/parlamentarios/page.tsx
  - app/app/agenda/page.tsx
  - app/app/sobre/page.tsx
  - app/app/metodologia/page.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/app/contraparte/[id]/page.tsx
  - app/components/search-result-card.tsx
  - app/components/parlamentario-directory-row.tsx
  - app/lib/bento-coherencia-guard.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: fixed
---

# Phase 79: Code Review Report

**Reviewed:** 2026-07-15T14:10:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 79 (BENTO-COHERENCIA) is a mechanical class-swap phase: propagate
`max-w-[1120px]` (container) and `rounded-[var(--radius-tile)]` (tile radius)
to 8 interior routes + 2 card components, without touching interiors or the
`card.tsx` primitive (firewall D3). I verified the swaps against the git diffs
of commits `1f0731b`, `9e37b49`, and `dc94ded`.

**What holds up under adversarial review:**

- **Swaps are genuinely mechanical.** The only non-token line changed across all
  production files is `<Card>` → `<Card className="rounded-[var(--radius-tile)]">`.
  No interior logic, no data flow, no error handling was touched (`git show 1f0731b`
  diff confirms). The `Card` primitive uses `cn`/tailwind-merge, so the call-site
  override correctly wins over the primitive's default `rounded-lg` — firewall D3
  respected, `card.tsx` byte-identical.
- **Correct Tailwind v4 syntax throughout.** Every swap uses
  `rounded-[var(--radius-tile)]` / `max-w-[1120px]` — zero bare `[--token]` shorthand
  (the CR-01 Phase-76 / bento-tile guard failure mode) in any reviewed file, and zero
  hex literals.
- **Container swap consistent** across all 8 routes (5 first-level + 3 fichas), all
  landing on `max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16`.

**Concerns found:** the guard test under-enforces its own stated `/red` invariant
(substring-presence check cannot detect a partial regression of one of two `<main>`);
a skeleton/tile radius mismatch (16px vs 8px) on `/buscar` and `/parlamentarios`;
and several stale docstrings + unpropagated error/not-found boundaries left behind by
the mechanical swap. No blockers — this is presentational-only, zero new inputs,
zero new endpoints.

## Structural Findings (fallow)

No structural pre-pass (`<structural_findings>` block) was provided for this review.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Guard cannot detect a partial /red width regression (weak mutation coverage on the EXCLUSION-RED axis)

**File:** `app/lib/bento-coherencia-guard.test.ts:76-83, 174-183`
**Issue:** The guard's docstring (lines 12-13) claims the invariant is *"red/page.tsx
tiene DOS `<main className="max-w-3xl ...">` ... AMBOS deben seguir en max-w-3xl."*
But the detector only checks substring **presence**: `!contenidoRed.includes("max-w-3xl")`.
`red/page.tsx` really has two `<main>` on lines 82 and 163. If someone regresses **one**
of the two to a *non-1120* width — e.g. `max-w-5xl` or `max-w-2xl` — the guard stays
green: the *other* `<main>` still contains `max-w-3xl` (so the presence check passes)
and `max-w-[1120px]` is absent (so the 1120 check does not fire). The detector can only
catch the specific mutation to `max-w-[1120px]` or the removal of *all* `max-w-3xl`.
The in-memory mutation self-check (line 174) uses a `redLimpio` fixture with a **single**
`max-w-3xl`, so it never exercises the two-main case and gives false confidence that
"both mains are frozen." This is a test-reliability defect: the guard advertises stronger
protection than it delivers.
**Fix:** Count occurrences instead of testing presence, and add a two-main fixture to the
self-check:
```ts
// detector: require BOTH mains to keep max-w-3xl (count === expected)
const N_RED_MAINS = 2; // red/page.tsx L82 + L163
const count = (contenidoRed.match(/max-w-3xl/g) ?? []).length;
if (count < N_RED_MAINS) {
  offenders.push({
    eje: "EXCLUSION-RED",
    descripcion: `red/page.tsx tiene ${count}/${N_RED_MAINS} <main> en max-w-3xl — ambos deben conservarlo (invariante 4).`,
  });
}
// self-check: fixture con DOS mains, mutar solo UNO a max-w-5xl y exigir 1 offender
```

### WR-02: Skeleton radius (8px) mismatches resolved tile radius (16px) on /buscar and /parlamentarios — visual corner pop

**File:** `app/app/buscar/page.tsx:211` and `app/app/parlamentarios/page.tsx:162`
**Issue:** The phase swapped the *resolved* tiles to `rounded-[var(--radius-tile)]`
(`--radius-tile: 16px`, `globals.css:34`) but left their loading skeletons at
`rounded-lg` (0.5rem = 8px). On `/buscar`, `ResultadosSkeleton` renders bare `<Card>`
(L211) → default `rounded-lg` 8px, while the real `SearchResultCard` renders
`rounded-[var(--radius-tile)]` 16px. On `/parlamentarios`, `DirectorySkeleton` (L162)
uses `rounded-lg` while `ParlamentarioDirectoryRow` uses `rounded-[var(--radius-tile)]`.
When the Suspense boundary resolves, the tile corners visibly pop from 8px to 16px.
This contradicts the "shape-matched skeleton / anti-CLS" intent documented elsewhere in
these same files (e.g. `parlamentario/[id]/page.tsx` RailSkeleton anti-CLS notes). It is
not a layout reflow (radius does not change the box size) but it is an inconsistent-radius
defect the phase's own coherence goal should have caught.
**Fix:** Give the skeletons the tile radius so they shape-match the resolved tiles:
```tsx
// buscar/page.tsx ResultadosSkeleton
<Card key={i} className="rounded-[var(--radius-tile)]">
// parlamentarios/page.tsx DirectorySkeleton
className="rounded-[var(--radius-tile)] border border-border bg-card px-4 py-3"
```

## Info

### IN-01: Stale docstring in parlamentario ficha still cites the old width

**File:** `app/app/parlamentario/[id]/page.tsx:38`
**Issue:** The header docstring still reads *"Variante B 'Informe con rail' (UXCOG):
grid `max-w-5xl` de dos columnas"* but the `<main>` was swapped to `max-w-[1120px]`
(L141, commit `9e37b49`). The mechanical swap updated the className but not the prose
that describes it, so the comment now lies about the container width.
**Fix:** Update the docstring to `grid max-w-[1120px] de dos columnas`.

### IN-02: Stale test docstring references max-w-5xl

**File:** `app/app/proyecto/[boletin]/page.test.tsx:12`
**Issue:** Comment says *"el shell monta el grid de 2 columnas (max-w-5xl)"* while the
assertion below it (L169) correctly asserts `not.toContain("max-w-5xl")` and the page is
now `max-w-[1120px]`. The comment contradicts the very assertion it precedes. (Comment
only — no test failure, since the string is not rendered.)
**Fix:** Change the comment to `(max-w-[1120px])`.

### IN-03: Error/not-found route boundaries were not propagated — width discontinuity vs the happy path

**File:** `app/app/parlamentario/[id]/error.tsx:24`, `app/app/parlamentario/[id]/not-found.tsx:10`, `app/app/proyecto/[boletin]/error.tsx:24`, `app/app/proyecto/[boletin]/not-found.tsx:10`, `app/app/contraparte/[id]/error.tsx:25`, `app/app/contraparte/[id]/not-found.tsx:13`
**Issue:** The three interior fichas now render at `max-w-[1120px]`, but their sibling
route-segment boundaries (`error.tsx` / `not-found.tsx`) still render `<main>` at
`max-w-3xl`. These boundaries replace the page's content in the same route, so on an
error or 404 the container width jumps from 1120px to `max-w-3xl` (~768px). The phase
objective ("swaps completos y consistentes") is only partially met: these files were
outside the enumerated swap scope, leaving a happy-path/error-path width discontinuity
within each route. They are not in the reviewed change set, so this is informational —
but the coherence goal is incomplete without them (or an explicit decision to keep error
pages narrower for readability).
**Fix:** Either propagate `max-w-[1120px]` to the 6 boundary files, or document the
narrower error/404 width as an intentional exclusion (as `/red` was documented).

### IN-04: Guard test does not assert the positive swaps it protects

**File:** `app/lib/bento-coherencia-guard.test.ts` (whole file)
**Issue:** The BENTO-04 guard only freezes two *negative* invariants (card.tsx must NOT
contain the tile token; red/page.tsx must NOT contain 1120px). It never asserts the
*positive* outcome of this phase — that the 8 interior `<main>` actually carry
`max-w-[1120px]` and that the two card components carry `rounded-[var(--radius-tile)]`.
Those positive assertions live scattered in the per-page test files (79-01 Task 3), so a
future refactor that silently reverts a route's container to `max-w-3xl` would only be
caught if that route's individual test still exists. Consolidating a positive source-scan
in the same guard would make the coherence contract self-documenting and regression-proof
in one place.
**Fix (optional):** Add a positive source-scan to the guard, e.g. iterate the 8 route
files and assert each `<main>` includes `max-w-[1120px]`, mirroring the existing
mutation self-check pattern.

---

_Reviewed: 2026-07-15T14:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Fixes Applied

Fixed 2026-07-15 by gsd-code-fixer (iteration 1). 885/885 tests green.

| Finding | Commit | Result |
|---------|--------|--------|
| WR-01 | `9d1a3e4` | Count-based detector + two-main fixture |
| WR-02 | `aa4909c` | Skeleton radius aligned to `rounded-[var(--radius-tile)]` |
| IN-01 | `5b5a745` | Docstring max-w-5xl → max-w-[1120px] |
| IN-02 | `5b5a745` | Test comment max-w-5xl → max-w-[1120px] |
| IN-03 | `018fa7b` | 6 boundary files max-w-3xl → max-w-[1120px] |
| IN-04 | — | Skipped (optional; out of fix scope) |
