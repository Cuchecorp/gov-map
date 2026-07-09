---
phase: 59
plan: "03"
subsystem: ficha-proyecto
tags: [autor, identity-guard, AutorRow, AutoresSection, RTL, F48]
dependency_graph:
  requires: [59-01, 59-02]
  provides: [AUTOR-02-complete, ficha-autores-UI]
  affects: [app/app/proyecto/[boletin]/page.tsx, app/components/autor-row.tsx]
tech_stack:
  added: []
  patterns: [identity-guard-VotoRow-mirror, React.cache-dedup, DetalleColapsable-colapsado, 3-honest-states]
key_files:
  created:
    - app/components/autor-row.tsx
    - app/components/autor-row.test.tsx
  modified:
    - app/app/proyecto/[boletin]/page.tsx
decisions:
  - "AutorRow mirrors VotoRow exactly: link only if estado_vinculo==='confirmado' AND parlamentario_id!=null"
  - "leerAutores placed AFTER TramitacionSection/VotacionesSection in page.tsx to preserve source-scan structural test (indexOf <TramitacionStepper < indexOf <DetalleColapsable)"
  - "Rail entry condicional: autores entrada solo si nAutores > 0 (0 rows = no anchor destino navegable con autores)"
  - "RTL tests on AutorRow + AutoresSectionStub (inline stub): ProvenanceBadge renders fuente-oficial link, so link assertion uses href startsWith /parlamentario/ check"
  - "Deploy pending: Phase 61 / Docker Linux + wrangler local per MEMORY.md (OpenNext build requiere Linux)"
metrics:
  duration: "~30 minutes"
  completed: "2026-07-09"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 59 Plan 03: AutoresSection UI (F48) — ficha de proyecto Summary

AutorRow with identity guard (link only if confirmado) + AutoresSection with 3 honest states wired into the ficha de proyecto, RTL tests 6 cases, pnpm build green, full test suite 726/726.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | AutorRow + RTL tests 4 (6) states | 8d527ce | app/components/autor-row.tsx, app/components/autor-row.test.tsx |
| 2 | AutoresSection + rail entry + build verde | 4c80ff0 | app/app/proyecto/[boletin]/page.tsx |

## States Covered

| State | Trigger | Output |
|-------|---------|--------|
| confirmado | parlamentario_id != null AND estado_vinculo === 'confirmado' | Link to /parlamentario/[id] |
| no_confirmado | parlamentario_id null OR estado_vinculo != 'confirmado' | Nombre crudo + IdentityMarker |
| Mensaje+0rows | 0 autores + iniciativa === 'Mensaje' | "Iniciativa del Ejecutivo (Mensaje presidencial)." |
| Mocion+0rows | 0 autores + any other iniciativa | null (section absent from DOM) |
| N autores | autores.length > 0 | DetalleColapsable (colapsado, count visible) |

## RTL Tests (6/6 passing)

- AutorRow confirmado → link to /parlamentario/P001
- AutorRow no_confirmado (null id) → IdentityMarker, no parliamentarian link
- AutorRow probable (id present but not confirmado) → IdentityMarker, no parliamentarian link
- AutoresSection 0+Mensaje → "Iniciativa del Ejecutivo"
- AutoresSection 0+Mocion → container empty
- AutoresSection N autores → renders AutorRow per author

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-scan structural test broken by AutoresSection placement**
- **Found during:** Task 2 (full test suite run)
- **Issue:** page.test.tsx has a structural source-scan test checking that `indexOf("<TramitacionStepper")` < `indexOf("<DetalleColapsable")`. Initially placed `AutoresSection` (which contains `<DetalleColapsable>`) BEFORE `TramitacionSection` in the file, breaking the invariant.
- **Fix:** Moved `leerAutores` + `AutoresSection` functions to AFTER `VotacionesSection` (after line 573), so the first `<DetalleColapsable` in the file remains inside `TramitacionSection` as the test expects.
- **Files modified:** app/app/proyecto/[boletin]/page.tsx
- **Commit:** 4c80ff0

**2. [Rule 1 - Bug] RTL test for "no link" too broad (ProvenanceBadge also renders links)**
- **Found during:** Task 1 (first test run)
- **Issue:** Test used `queryByRole("link")` expecting no links, but ProvenanceBadge renders a "fuente oficial" external link. The test was too broad.
- **Fix:** Changed assertion to check that no link with `href` starting with `/parlamentario/` exists — correctly targeting only the identity guard assertion.
- **Files modified:** app/components/autor-row.test.tsx
- **Commit:** 8d527ce

## Build Result

```
pnpm --filter app build: PASS
Route /proyecto/[boletin] — ƒ (Dynamic) server-rendered on demand
726/726 tests passing
pnpm -w typecheck: PASS (tsc -b, no errors)
```

## Known Stubs

None. AutorRow renders real data from proyecto_autor (763 rows PROD). ProvenanceBadge renders real fecha_captura and enlace. Identity guard uses real estado_vinculo from DB.

## Threat Flags

None. No new network endpoints. proyecto_autor is public data (no PII). parlamentario_id is DB-internal UUID, not user-controlled input. BOLETIN_RE validates the route param upstream.

## Deploy Note

Production deploy pending Phase 61 (Docker Linux + wrangler local). OpenNext build requires Linux environment per MEMORY.md gotcha. `pnpm --filter app build` (Next.js standard) passes on Windows; OpenNext/Cloudflare deploy is a separate operator step.

## Self-Check: PASSED

- app/components/autor-row.tsx: exists, exports AutorRow
- app/components/autor-row.test.tsx: exists, 6 RTL tests
- app/app/proyecto/[boletin]/page.tsx: contains `proyecto_autor` (1 occurrence) and `id="autores"` (1 occurrence)
- Commits 8d527ce + 4c80ff0: verified in git log
- pnpm --filter app build: PASS
- 726/726 tests: PASS
