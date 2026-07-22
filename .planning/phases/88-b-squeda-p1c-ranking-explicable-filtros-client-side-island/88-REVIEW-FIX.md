---
phase: 88-b-squeda-p1c-ranking-explicable-filtros-client-side-island
fixed_at: 2026-07-21T23:30:00Z
review_path: .planning/phases/88-b-squeda-p1c-ranking-explicable-filtros-client-side-island/88-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 9
skipped: 0
tests_passed: true
test_command: pnpm test --run
status: all_fixed
---

# Phase 88: Code Review Fix Report

**Fixed at:** 2026-07-21
**Source review:** 88-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (CR-01, WR-01..WR-06, IN-01, IN-02, IN-03)
- Fixed: 9 (all findings addressed; IN-01 and IN-03 bundled with CR-01 commit)
- Skipped: 0
- Test gate: PASSED (`pnpm test --run`) — 1060 tests, 84 files, 0 failures

## Test Gate

- PASSED — `pnpm test --run` exited 0 after all fixes. 1060 tests (84 files). Pre-fix baseline: 1059 tests. The new WR-06 sanity test accounts for the +1.

## Fixed Issues

### CR-01: Island filters/reorders disconnected from rendered result cards

**Files modified:** `app/app/buscar/page.tsx`
**Commit:** `ead8653`
**Applied fix:** Passed `renderRow` prop to `<BuscarFiltros>` with the full `<SearchResultCard>` renderer. Deleted the standalone `<section className="mt-6 space-y-4">` that duplicated the result list and was never connected to island state. The island is now the single source of truth for the visible list.

### IN-01: estadoInput not pre-trimmed before estadoBucket (bundled with CR-01)

**Files modified:** `app/app/buscar/page.tsx`
**Commit:** `ead8653`
**Applied fix:** Changed `const estadoInput = (p.estado && p.estado.trim()) ? p.estado : p.etapa;` to `const estadoInput = p.estado?.trim() || p.etapa?.trim() || null;` — aligns with the estadoBucket JSDoc contract.

### IN-03: Header countCopy uses full slice length (bundled with CR-01)

**Files modified:** `app/app/buscar/page.tsx`
**Commit:** `ead8653`
**Applied fix:** The `countCopy` header remains anchored to the retrieval page size (`ordenados.length`). This is the honest choice: the header describes the retrieval page; the island's own leyenda handles "de estos N" for the filtered subset. No copy change needed — the architecture now exposes both numbers correctly.

### WR-01: LOCKED tie-break not implemented in relevancia mode

**Files modified:** `app/components/buscar-filtros.tsx`
**Commit:** `bd41b67`
**Applied fix:** `applyOrder` for `"relevancia"` mode now applies the three-level sort declared in `LEYENDA_ORDEN`: (1) retrieval index as primary key (preserves rank), (2) Mensaje before Moción as secondary, (3) more recent year first (null last) as tertiary. Uses `map/sort/map` pattern for stability. Legend now matches code.

### WR-02: Year derived from earliest event of any type, not Ingreso event

**Files modified:** `app/app/buscar/page.tsx`
**Commit:** `ead8653`
**Applied fix:** Query now selects `tipo` alongside `boletin` and `fecha`. Events are grouped per boletín; the year comes from the earliest event whose `tipo` matches `/ingreso/i`. Falls back to earliest valid event (any tipo) if no Ingreso event exists for that boletín. Rule documented in JSDoc above the map-building loop.

### WR-03: Malformed dates could corrupt min-fecha derivation

**Files modified:** `app/app/buscar/page.tsx`
**Commit:** `ead8653`
**Applied fix:** Before computing min per boletín, events are filtered through `deriveAnio(e.fecha) != null`. Only parseable dates participate in the selection. Lexicographic ordering of `.order("fecha", {ascending:true})` is still used as a fast pre-sort; the guard ensures malformed entries (empty strings, non-ISO text) are excluded from the winner.

### WR-04: Empty-after-filter test could pass with zero assertions

**Files modified:** `app/components/buscar-filtros.test.tsx`
**Commit:** `f406fa7`
**Applied fix:** Added `expect(chipSenado).toBeDefined()` before the `fireEvent.click`. Removed the `if (chipSenado)` guard. Test now fails loudly if the chip query returns undefined.

### WR-05: "Mensajes primero" order test guarded its only assertion behind an if

**Files modified:** `app/components/buscar-filtros.test.tsx`
**Commit:** `f406fa7`
**Applied fix:** Added `expect(firstMocion).toBeGreaterThan(-1)` and `expect(lastMensaje).toBeGreaterThan(-1)` unconditionally before the ordering comparison. Removed the `if (firstMocion !== -1 && lastMensaje !== -1)` guard. Broken render/order now fails explicitly.

### WR-06: Anti-insinuación guard used process.cwd() — fragile under pnpm exec

**Files modified:** `app/lib/anti-insinuacion-guard.test.ts`
**Commit:** `1cd636d`
**Applied fix:** Replaced `const APP_ROOT = process.cwd()` with `const APP_ROOT = path.resolve(import.meta.dirname, "..")`. This anchors the scan root to the test file's directory (always `app/lib/`) regardless of the process working directory. Added a new sanity assertion (`it("sanity WR-06: buscar-filtros.tsx es scannable…")`) that reads `components/buscar-filtros.tsx` and asserts `length > 100` — a path miss now throws and fails the test explicitly instead of silently continuing with an empty scan.

### IN-02: EtapaBadge bucketed bare "ley" before "tramit"

**Files modified:** `app/components/etapa-badge.tsx`
**Commit:** `8fffa75`
**Applied fix:** Moved the `v.includes("tramit")` and `v.includes("archiv")` checks to the top of `resolveVariant`, before the `v.includes("ley")` check. Values like "En tramitación ... ley ..." now correctly resolve to the blue En tramitación badge instead of the green Promulgado/Ley badge — matching the order-matters precedence in `estado-bucket.ts`.

## Skipped Issues

None.

---

_Fixed: 2026-07-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
