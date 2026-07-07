---
phase: 53-uxnav-auditoria-ux-navegada
plan: 04
subsystem: ui
tags: [empty-state, navigation, dead-end, orientation, next-link, rtl, vitest]

# Dependency graph
requires:
  - phase: 53-01
    provides: header-nav Red item + orientation contract (breadcrumbs, continuation lines)
  - phase: 53-audit
    provides: 53-UX-AUDIT.md F-03 flagged dead-end surfaces
provides:
  - Continuation line (one internal Link) on every audit-flagged empty state (buscar, votos, lobby ×2, agenda, red)
  - RTL asserts pinning shipped honest copy byte-identical + exactly one continuation link per surface
  - CitacionesSection exported (named) for empty-state testing
affects: [53-verify, 53-ui-review, Wave-3 redeploy, Phase-54]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Continuation line: sibling <p class='text-sm mt-2'> with ONE Link (inline-flex min-h-11 items-center text-accent-product underline underline-offset-2), → glyph inside link as aria-hidden span"
    - "Async Server Component empty-state testing via thenable Supabase builder mock + renderToStaticMarkup (mirrors buscar Resultados)"

key-files:
  created:
    - app/app/agenda/citaciones-empty.test.tsx
  modified:
    - app/app/buscar/page.tsx
    - app/components/votos-por-parlamentario.tsx
    - app/components/lobby-de-parlamentario.tsx
    - app/app/agenda/page.tsx
    - app/components/red/red-graph.tsx
    - app/components/votos-por-parlamentario.test.tsx
    - app/components/lobby-de-parlamentario.test.tsx
    - app/components/red/red-graph.test.tsx
    - app/app/buscar/resultados-error.test.tsx

key-decisions:
  - "/buscar uses the non-duplicated alternative 'También puedes revisar la agenda legislativa de la semana →' (RESEARCH OQ1, Claude's Discretion) instead of the SPEC table's 'Prueba con otras palabras…' which echoes the shipped string"
  - "votos empty state: line added ONLY to the noIngestado state (audit cited 462-466); the totalVotos===0 state (471-477) was NOT flagged → stays byte-identical per LOCKED unmarked rule"
  - "lobby: BOTH empty states flagged (no ingestado + cero confirmadas) → both got the line, per audit citing :296-300 and :310-314"
  - "Extended coverage to red/buscar/agenda test files (beyond plan's Task 2 <files>) to satisfy plan-checker W3 'EVERY flagged surface gets an href+text assert'"

patterns-established:
  - "Empty-state dead-end remedy = additive sibling line, never a rewrite of the honest string (test-asserted byte-identical)"

requirements-completed: [UX-01]

# Metrics
duration: ~20min
completed: 2026-07-07
---

# Phase 53 Plan 04: Continuation lines on flagged empty states Summary

**Every audit-flagged dead-end empty state (buscar, votos, lobby ×2, agenda, red) now offers exactly one honest continuation Link to a data-bearing nav surface, with the shipped honest copy pinned byte-identical by RTL.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-07T02:52Z (approx)
- **Completed:** 2026-07-07T03:11Z
- **Tasks:** 2
- **Files modified:** 9 (+1 created)

## Accomplishments
- Added a single petróleo continuation Link (`inline-flex min-h-11 items-center text-accent-product underline underline-offset-2`, with `→` as an `aria-hidden` span inside the link) to each flagged empty state, as a NEW sibling `<p class="text-sm mt-2">` below the byte-identical shipped honest paragraph.
- Six surfaces wired: `/buscar` sin resultados → `/agenda`; votos no-ingestado → `/parlamentarios`; lobby no-ingestado + cero-confirmadas → `/buscar` (×2); `/agenda` sin citaciones → `/buscar`; `/red` grafo vacío → `/parlamentarios`.
- Added href+text RTL asserts for EVERY flagged surface (plan-checker W3), each verifying (a) shipped honest string byte-identical, (b) exactly ONE continuation link with the prescribed href+text, plus banned-vocab negative-match over the new strings.
- Full touched-suite green: 106 tests across 5 files; `tsc -b` clean; `actualidad-module.tsx` untouched.

## Task Commits

1. **Task 1: Continuation lines on flagged empty states** - `7144f17` (feat)
2. **Task 2: RTL asserts (byte-identical shipped + one link per surface)** - `0e87f38` (test)

## Files Created/Modified
- `app/app/buscar/page.tsx` - continuation `<p>` → `/agenda` in "Sin resultados" block
- `app/components/votos-por-parlamentario.tsx` - continuation `<p>` → `/parlamentarios` in noIngestado state (wrapped in fragment)
- `app/components/lobby-de-parlamentario.tsx` - continuation `<p>` → `/buscar` in BOTH empty states (a) noIngestado and (b) cero-confirmadas
- `app/app/agenda/page.tsx` - continuation `<p>` → `/buscar` in "sin citaciones" state; `CitacionesSection` exported (named) for testability
- `app/components/red/red-graph.tsx` - continuation `<p>` → `/parlamentarios` in empty-graph island; added `import Link from "next/link"`
- `app/components/votos-por-parlamentario.test.tsx` - F-03 asserts (byte-identical + 1 link to /parlamentarios + banned-vocab)
- `app/components/lobby-de-parlamentario.test.tsx` - F-03 asserts for both empty states (byte-identical + 1 link to /buscar + banned-vocab)
- `app/components/red/red-graph.test.tsx` - F-03 assert on empty graph (byte-identical + 1 link to /parlamentarios)
- `app/app/buscar/resultados-error.test.tsx` - F-03 assert on "Sin resultados" (byte-identical + 1 link to /agenda)
- `app/app/agenda/citaciones-empty.test.tsx` - NEW: CitacionesSection empty-state test (thenable Supabase mock + renderToStaticMarkup)

## Surfaces that received a line vs. left unmarked

**Received a continuation line (audit-flagged F-03):**
| Surface | File | Target |
|---------|------|--------|
| `/buscar` sin resultados | buscar/page.tsx | `/agenda` |
| ficha parl. votos no ingestado | votos-por-parlamentario.tsx | `/parlamentarios` |
| ficha parl. lobby no ingestado | lobby-de-parlamentario.tsx | `/buscar` |
| ficha parl. lobby cero confirmadas | lobby-de-parlamentario.tsx | `/buscar` |
| `/agenda` sin citaciones (semana) | agenda/page.tsx | `/buscar` |
| `/red` grafo vacío | red/red-graph.tsx | `/parlamentarios` |

**Left byte-identical (NOT flagged by the audit — LOCKED "unmarked = byte-identical"):**
- votos `totalVotos === 0` state (471-477) — audit cited only 462-466 (noIngestado); the cero-confirmadas state was not flagged.
- `/agenda` search "sin resultados" (199-202) and Senado tabla-sala empty states (486-489) — audit cited only the weekly `sin citaciones` (294-297); these are "según corresponda" and were not marked.
- Home `actualidad-module.tsx` — explicitly NOT a dead end (SPEC/audit), untouched (git diff empty).
- Sections that degrade by rendering `null` (gated MONEY/cruces, RPC-pre-apply) — no empty band, no line.

## Decisions Made
- **`/buscar` copy = non-duplicated alternative.** The SPEC §(c) table lists "Prueba con otras palabras, o revisa la agenda legislativa de la semana →", but the shipped honest string already ends "Prueba con otras palabras, o ingresa un número de boletín." Per RESEARCH Open Question 1 (Claude's Discretion), the continuation line uses "También puedes revisar la agenda legislativa de la semana →" to avoid echoing the shipped copy. All other surfaces use the SPEC copy verbatim.
- **votos: one state, not two.** The audit flagged votos at `462-466` (noIngestado) only; the LOCKED rule forbids touching unmarked surfaces, so `totalVotos===0` stays byte-identical. (Contrast lobby, where the audit explicitly cited both ranges.)
- **Touch target.** Continuation links use `inline-flex min-h-11 items-center` so the 44px touch-target minimum (SPEC §Spacing exception) is met while staying inline in the text flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Coverage] Extended asserts to red/buscar/agenda beyond Task 2's `<files>`**
- **Found during:** Task 2 (RTL asserts)
- **Issue:** Plan Task 2 `<files>` listed only the votos + lobby test files, but plan-checker W3 (and the plan action, "sin excepción") mandates an href+text assert for EVERY flagged surface. `/red`, `/buscar`, `/agenda` were flagged in Task 1 but had no continuation assert.
- **Fix:** Added the F-03 assert to the existing `red-graph.test.tsx` and `resultados-error.test.tsx`; created a minimal `citaciones-empty.test.tsx` for `/agenda`; exported `CitacionesSection` (named export, same pattern as `Resultados` in /buscar) to make the async Server Component testable.
- **Files modified:** app/components/red/red-graph.test.tsx, app/app/buscar/resultados-error.test.tsx, app/app/agenda/citaciones-empty.test.tsx (new), app/app/agenda/page.tsx
- **Verification:** All 106 touched-suite tests green; `tsc -b` clean.
- **Committed in:** 0e87f38 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — mandated test coverage).
**Impact on plan:** No scope creep — additive coverage required by the plan's own W3 rule. Source-code changes match the plan's `files_modified` exactly. The one source-side change (exporting `CitacionesSection`) is a zero-behavior named export mirroring the shipped `Resultados` pattern.

## Issues Encountered
None. The async Server Component empty states (`/buscar` `Resultados`, `/agenda` `CitacionesSection`) were tested with a thenable Supabase builder mock + `renderToStaticMarkup`, following the existing `resultados-error.test.tsx` precedent.

## User Setup Required
None - no external service configuration required. No redeploy in this plan (Wave 3 handles the re-walkthrough).

## Next Phase Readiness
- All F-03 dead-ends now have a continuation exit → ROADMAP Phase 53 Success Criterion 3 ("ningún callejón sin salida") satisfied at code level.
- Ready for 53 verifier / ui-review and the Wave 3 redeploy + before/after screenshots (`fix-F03-before/after.jpg`).
- Semantic guard held: the three honest states stay distinct; no fabricated virtue; no link points to a gated/404 surface.

---
*Phase: 53-uxnav-auditoria-ux-navegada*
*Completed: 2026-07-07*

## Self-Check: PASSED
- FOUND: app/app/agenda/citaciones-empty.test.tsx
- FOUND: .planning/phases/53-uxnav-auditoria-ux-navegada/53-04-SUMMARY.md
- FOUND commit: 7144f17 (Task 1)
- FOUND commit: 0e87f38 (Task 2)
