---
phase: 78-bento-home-actualidad-votado-urgencias-frescura-como-tiles
fixed_at: 2026-07-15T12:27:46Z
review_path: .planning/phases/78-bento-home-actualidad-votado-urgencias-frescura-como-tiles/78-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 4
skipped: 0
tests_passed: true
test_command: pnpm test (app/)
status: all_fixed
---

# Phase 78: Code Review Fix Report

**Fixed at:** 2026-07-15T12:27:46Z
**Source review:** `.planning/phases/78-bento-home-actualidad-votado-urgencias-frescura-como-tiles/78-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03) + IN-03 applied as trivially safe
- Fixed: 4 (WR-01, WR-02, WR-03, IN-03)
- Skipped: 0
- Test gate: PASSED (`pnpm test` — 870 tests, 77 suites, 0 failed)

## Test Gate

- PASSED — `pnpm test` (app/) exited 0 after all fixes. 870 tests passed (up from 869 before fix — 1 new test added for WR-03 tally guard).

## Fixed Issues

### WR-01: `inicioSemanaIso` computes the week boundary in server-local time, not Chile time

**Files modified:** `app/components/actualidad-module.tsx`, `app/components/actualidad-module.test.tsx`
**Commit:** 56a8e57
**Applied fix:** Replaced `setHours(0,0,0,0)` / `getDay()` (server-local TZ) with `Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", weekday: "short" })` + `Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" })` to derive the Chilean day-of-week and calendar date. Built the UTC instant for "lunes 00:00 CLST" using the `sv-SE` formatter + hour extraction technique (same pattern as `DIA_CALENDARIO_CHILE` in `estado-actual-block.tsx`). Added two module-level formatter constants `FECHA_CHILE` and `DOW_CHILE`. Tests: replaced the 2 original tests (which operated in server-local TZ and checked `getDay()`/`getDate()` — local-TZ outputs) with 4 new tests pinning exact UTC ISO strings and verifying the resulting instant is midnight in `America/Santiago`.

### WR-02: `UrgenciasVigentes` truncates `tramitacion_evento` to 120 rows before grouping

**Files modified:** `app/components/actualidad-module.tsx`
**Commit:** 56a8e57 (same commit — all `.tsx` changes staged together)
**Applied fix:** Two-step fetch replacing the single `limit(120)` global query. Step 1: select `boletin` only from rows matching `%urgencia%`, order by `fecha` desc, with a generous limit (`MAX_URGENCIAS_BOLETIN * 10 = 300`) to allow deduplication — then deduplicate to `MAX_URGENCIAS_BOLETIN = 30` distinct boletines in JS. Step 2: fetch ALL `tramitacion_evento` rows for those boletines (`.in("boletin", boletinesCandidatos)`) without any row-level limit, ordered ascending for chronological correctness. `urgenciaVigente()` now receives the complete per-boletín event history. The second `.from()` call to the same non-PII table is documented in a comment as a presentation-safe trade-off (no new RPC).

### WR-03: `total_si`/`total_no` rendered as `0–0` tally when tallies were never populated

**Files modified:** `app/components/actualidad-module.tsx`, `app/components/actualidad-module.test.tsx`
**Commit:** 56a8e57
**Applied fix:** Wrapped `conteoVotacion(it.totalSi, it.totalNo)` in `{it.totalSi + it.totalNo > 0 && (...)}`. When both totals are 0, only `El proyecto fue {resultado}.` is rendered — no fabricated tally. The comment was updated to explain the guard. New test: fixture `{ totalSi: 0, totalNo: 0, resultado: "aprobado" }` asserts that the string `0–0` (both en-dash and ASCII hyphen variants) does not appear anywhere in the rendered output, while `El proyecto fue aprobado` is present.

### IN-03: Duplicated `6` magic number and per-block boilerplate (applied as trivially safe)

**Files modified:** `app/components/actualidad-module.tsx`
**Commit:** 56a8e57
**Applied fix:** Extracted `const MAX_ITEMS_ACTUALIDAD = 6` at module level, replacing `.limit(6)` in `VotadoEstaSemana` and `.slice(0, 6)` in `UrgenciasVigentes`.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-15T12:27:46Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
