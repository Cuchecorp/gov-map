---
phase: 59
plan: "01"
subsystem: tramitacion
tags: [autor, ingest, parser-fix, migration, identity]
dependency_graph:
  requires: []
  provides: [proyecto_autor DDL, reconciliarAutores, upsertAutores, parser-fix]
  affects: [ingest-run, writer, model]
tech_stack:
  added: []
  patterns: [AutorParaEscribir branded FK, aplanarAutor, reconciliarAutores determinista]
key_files:
  created:
    - packages/tramitacion/src/__fixtures__/mocion-16588-autores.xml
    - packages/tramitacion/src/reconciliar-autor.ts
    - packages/tramitacion/src/reconciliar-autor.test.ts
    - supabase/migrations/0051_proyecto_autor.sql
    - supabase/tests/0051_proyecto_autor.test.sql
  modified:
    - packages/tramitacion/src/parse-senado-tramitacion.ts
    - packages/tramitacion/src/parse-senado-tramitacion.test.ts
    - packages/tramitacion/src/model.ts
    - packages/tramitacion/src/writer.ts
    - packages/tramitacion/src/writer-supabase.ts
    - packages/tramitacion/src/writer-supabase.test.ts
    - packages/tramitacion/src/ingest-run.ts
    - packages/tramitacion/src/index.ts
decisions:
  - "txtAutor() reads .PARLAMENTARIO key first (fast-xml-parser 5.x nested tag behavior)"
  - "normalizarNombre({ libre: nombre }) used for matching (same as reconciliar-senado)"
  - "Migration 0051 strips anon grant+policy (LOCKDOWN-04 CI guard — Camino A service_role reads)"
  - "reconciliarAutores tries diputados(2026-2030) then senado(senado-vigente-2026)"
  - "autor_crudo_norm uses simple lower+trim+collapse (NOT normalizarNombre — separate concern)"
metrics:
  duration: "~25 minutes"
  completed: "2026-07-08"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 16
  tests_total_package: 127
---

# Phase 59 Plan 01: Parser Fix + Author Ingestion Pipeline Summary

Parser bug fixed, ProyectoAutor model + migration 0051 created, reconciliarAutores implemented deterministically, writer extended with upsertAutores, ingest-run hooked — AUTOR-01 code-complete.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Parser fix + fixture + model + migration | 7b59e64 | parse-senado-tramitacion.ts, model.ts, __fixtures__/mocion-16588-autores.xml, 0051_*.sql |
| 2 | reconciliar-autor + writer extension + ingest-run hook | 25fd827 | reconciliar-autor.ts, writer.ts, writer-supabase.ts, ingest-run.ts, index.ts |
| fix | LOCKDOWN-04 deviation fix on migration | 91a7b53 | 0051_proyecto_autor.sql, 0051_proyecto_autor.test.sql |

## Verification

- `pnpm --filter @obs/tramitacion test --run` → 127/127 passed (was 111, added 16 new tests)
- `pnpm -w test` → 720+ tests pass across all packages (no regressions)
- `pnpm -w typecheck` → clean
- `grep -c "upsertAutores" packages/tramitacion/src/ingest-run.ts` → 1
- `grep -c "AutorParaEscribir" packages/tramitacion/src/writer.ts` → 4
- `grep -c "create table proyecto_autor" supabase/migrations/0051_proyecto_autor.sql` → 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed normalizarNombre call signature**
- **Found during:** Task 2 (reconciliar-autor tests)
- **Issue:** RESEARCH.md Pattern 3 used `normalizarNombre({ paterno: nombre, nombres: "" })` but the actual API uses `apellidoPaterno`, not `paterno`. The `libre` field is the correct form for full name strings without structured fields.
- **Fix:** Changed to `normalizarNombre({ libre: nombre })` — same form used by reconciliar-senado.ts for vote name strings.
- **Files modified:** packages/tramitacion/src/reconciliar-autor.ts
- **Commit:** 25fd827

**2. [Rule 1 - Bug] Fixed test maestra nombre_normalizado expectations**
- **Found during:** Task 2 (reconciliar-autor tests failing)
- **Issue:** Test maestra used `nombre_normalizado: "bianchi karim"` (structured normalization) but `normalizarNombre({ libre: "Karim Bianchi Retamales" })` without a comma puts ALL tokens into blocking → `"bianchi karim retamales"`. Test expectation was wrong.
- **Fix:** Updated test maestra to use the name_normalized value that `libre:` produces for comma-free full names.
- **Files modified:** packages/tramitacion/src/reconciliar-autor.test.ts
- **Commit:** 25fd827

**3. [Rule 1 - Bug / CLAUDE.md hard constraint] Removed anon grants from migration 0051**
- **Found during:** `pnpm -w test` (CI lockdown guard LOCKDOWN-04 in app/lib/lockdown-guard.test.ts)
- **Issue:** Plan specified `grant select on proyecto_autor to anon` + `create policy ... to anon using (true)` mirroring migration 0008. But the LOCKDOWN-04 CI guard enforces that ALL migrations > 0044 have ZERO grants to anon (Camino A: site reads with service_role which bypasses RLS). This is a CLAUDE.md-driven constraint (lockdown guard = CI gate).
- **Fix:** Removed `grant select ... to anon` and `create policy ... to anon` from 0051. Kept `enable row level security` (deny-by-default for anon = correct). Updated pgTAP from 6 to 5 checks (no anon policy assertion). The table is still accessible to the app via service_role.
- **Files modified:** supabase/migrations/0051_proyecto_autor.sql, supabase/tests/0051_proyecto_autor.test.sql
- **Commit:** 91a7b53

## Known Stubs

None. No data-flow stubs. reconciliarAutores is fully wired but requires a live maestra to produce `confirmado` matches — in a cold environment with no maestra rows, all authors degrade to `no_confirmado` (correct fail-closed behavior, not a stub).

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` documented:
- T-59-01 (RLS): Mitigated — RLS enabled; no anon policy needed under Camino A service_role reads.
- T-59-02 (EnlaceConfirmado branded): Implemented — aplanarAutor is the unique materialization point.
- T-59-SC: No new packages installed.

## Self-Check: PASSED
