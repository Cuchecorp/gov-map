---
phase: 75-deuda-typography-island-net-rotar-db-password-operador
plan: 01
subsystem: frontend
tags: [typography, design-system, red-graph, debt, DEBT-05, css-tokens, guard-test]
requires:
  - "Tailwind v4 default type scale exposed as --text-* theme vars (globals.css:1 @import tailwindcss)"
  - "No fontSize override in tailwind.config.ts (steps ARE Tailwind defaults)"
provides:
  - ".net-* font-size declarations consume design-system --text-* tokens (pixel-identical)"
  - "Source-level guard test blocking silent reintroduction of raw-rem font-size in .net-*"
affects:
  - "app/app/globals.css (.net-* island block)"
  - "app/components/red/red-graph.test.tsx"
tech-stack:
  added: []
  patterns:
    - "Pixel-preserving CSS token swap (raw rem -> var(--text-*), zero px delta)"
    - "Source-scan guard test (readFileSync + region isolation + regex over font-size)"
key-files:
  created: []
  modified:
    - "app/app/globals.css"
    - "app/components/red/red-graph.test.tsx"
decisions:
  - "Used process.cwd()+path.join (repo source-scan idiom, carril-accordion.test.tsx) instead of import.meta.dirname — vitest runs from app/, matches proven convention"
  - "Preserved .net-chip 0.6875rem (11px) off-step by design; added comment; guard whitelists it"
  - "red-graph.tsx and tailwind.config.ts left untouched (drawConn geometry / F18 LOCKED)"
metrics:
  duration: "~10 min"
  completed: "2026-07-15"
  tasks: 2
  files_modified: 2
---

# Phase 75 Plan 01: Typography island `.net-*` design-system token swap Summary

Pixel-preserving swap of all 14 raw-rem `.net-*` `font-size` literals to Tailwind v4 `var(--text-base|--text-sm|--text-xs)` design-system tokens (`.net-chip` 11px preserved), plus a source-scan guard test that fails if ad-hoc rem sizes silently return — zero rendered px delta, so `/red` (F18 LOCKED) connector geometry is untouched. (DEBT-05)

## What Was Built

- **Task 1 (`refactor`, commit `300958c`):** In `app/app/globals.css` `.net-*` block (`@layer components`), mapped every raw-rem `font-size` to its identical design-system token — `1rem → var(--text-base)` (16px, 1 decl), `0.875rem → var(--text-sm)` (14px, 7 decls), `0.75rem → var(--text-xs)` (12px, 6 decls). Total 14 swaps, pixel-identical. `.net-chip` `0.6875rem` (11px) left unchanged with an explanatory comment marking it intentionally off-step (rounding to `--text-xs` would enlarge every cámara chip and shift row wrap). No `font-weight`/color/spacing/token-layer value changed.
- **Task 2 (`test`, commit `cc52c7f`):** Appended a `describe("DEBT-05: …")` block to `app/components/red/red-graph.test.tsx`. It reads `globals.css` via `process.cwd()`+`path.join` (repo source-scan idiom), isolates the `.net-*` region between stable comment markers (`/* ── NET — isla del diagrama…` → `} /* ── fin @layer components…`), extracts every `font-size` value, and asserts each is `var(--text-*)` or exactly `0.6875rem`. Any other raw rem fails the test naming the offending value. A comment documents that the `/red` layout non-regression is jsdom-blind and deferred to ui-review + operator.

## Verification

- `pnpm --filter ./app test -- red-graph` → **820 passed / 74 files** (was 819; guard adds 1). Green.
- `pnpm --filter ./app typecheck` (`tsc --noEmit`) → clean.
- `grep font-size: globals.css` → 15 declarations: 14 `var(--text-*)` + 1 `.net-chip` `0.6875rem`. No stray raw rem in `.net-*`.
- **Mutation self-check:** temporarily reverting `--text-base` → `1rem` made the guard fail with `Infractores: ["1rem"]`, then restored. Guard bites as intended.
- `git diff` on `app/components/red/red-graph.tsx` and `app/tailwind.config.ts` → **empty** (untouched, per critical constraint).

## Deviations from Plan

**One idiom substitution (not a behavior deviation):** The plan suggested `import.meta.dirname` for path resolution (per a memory gotcha about `new URL(import.meta.url)`+`readFileSync` breaking under jsdom). I used the repo's own proven source-scan idiom — `path.join(process.cwd(), "app", "globals.css")` — used across `carril-accordion.test.tsx`, `detalle-colapsable.test.tsx`, and others. Vitest runs from `app/` (config lives there), so `process.cwd()` resolves correctly, and this matches the established, green convention rather than introducing a less-tested path. The gotcha the plan warned about (`new URL(import.meta.url)`) was avoided either way. Not tracked as a deviation rule — same outcome, codebase-native form.

Otherwise: plan executed exactly as written. No auto-fixes, no auth gates, no architectural changes.

## Out of Scope / Deferred

- **`/red` visual non-regression (F18 LOCKED):** jsdom returns `getBoundingClientRect()=0`, so the true pixel/connector-geometry non-regression is NOT provable in the unit suite. Deferred to ui-review + operator real-deploy `getComputedStyle`/visual check (Plan 02 checkpoint), per the plan's threat register (T-75-01 residual). The guard test only prevents the *source-level* ad-hoc-size debt from returning (T-75-02).
- **DEBT-06 (DB password rotation runbook + operator checkpoint):** Plan 02, not this plan.

## Known Stubs

None.

## Threat Flags

None — change is font-size-only within an existing CSS island; no new network/auth/file/schema surface introduced.

## Self-Check: PASSED

- FOUND: `.planning/phases/75-.../75-01-SUMMARY.md`
- FOUND commit `300958c` (Task 1 CSS token swap)
- FOUND commit `cc52c7f` (Task 2 source guard test)
