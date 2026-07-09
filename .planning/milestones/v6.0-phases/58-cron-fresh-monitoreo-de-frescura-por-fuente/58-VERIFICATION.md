---
phase: 58-cron-fresh-monitoreo-de-frescura-por-fuente
verified: 2026-07-08T21:04:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 58: CRON-FRESH — Freshness Monitor Verification Report

**Phase Goal:** El operador puede consultar en un solo lugar la frescura por fuente (ultima corrida exitosa, ultimo snapshot R2, ultimo upsert a Supabase) y detectar staleness sin bucear logs — reporte CLI o superficie admin, con umbral de alerta configurable por fuente.
**Verified:** 2026-07-08T21:04:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from PLAN frontmatter must_haves + ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pnpm freshness` prints a table (one row per fuente) with days-since-last-upsert and stale flag, no writes to DB | VERIFIED | `pnpm freshness --help` exits 0; CLI confirmed live; zero INSERT/UPDATE/DELETE/CREATE/DROP in query-runner.ts (grep returned empty) |
| 2 | Rows exceeding threshold are printed in ANSI red; exit code 1 if any stale, 0 if all fresh | VERIFIED | cli.ts lines 104 + 180: `RED` escape applied when `r.stale`; `process.exit(anyStale ? 1 : 0)` |
| 3 | `--json` flag prints machine-readable JSON with same rows; human table goes to stderr | VERIFIED | cli.ts lines 173-177: `jsonMode` branch writes JSON to stdout, table to stderr; SUMMARY shows 6-object JSON from PROD run |
| 4 | Unit tests pass without network — evaluate module tested with mocked query results | VERIFIED | `pnpm --filter @obs/freshness test` exits 0; 9/9 tests pass; evaluate.test.ts imports only from `./evaluate` and `./catalog`, no I/O or network |
| 5 | Runbook gains a section "Verificar frescura" with one-paragraph description and `pnpm freshness` command | VERIFIED | `docs/runbooks/cron-local-fallback.md` line 178: `## 6. Verificar frescura de fuentes`; lines 185-186 contain `pnpm freshness` commands (section added as §6 — §4 and §5 pre-existed; content requirement satisfied) |

**Score:** 5/5 truths verified

### ROADMAP Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| SC-1 | Tool exists listing per-source: last successful run, last R2 snapshot, last Supabase upsert, days since each | VERIFIED | `pnpm freshness` / `pnpm freshness --json` — all four signals in every row (ghRun, r2Snapshot, ultimoUpsert, diasDesdeUpsert) |
| SC-2 | Each source has configurable alert threshold; report marks stale in red; operator detects staleness at a glance | VERIFIED | CATALOG defines per-source umbralDias; `FRESHNESS_UMBRAL_<FUENTE>` env override wired in evaluate.ts + cli.ts; ANSI red applied to stale rows; unit test #5 covers override correctness |
| SC-3 | Report is idempotent, can be run at any time with no side effects; does not trigger ingests or write to DB | VERIFIED | query-runner.ts contains only SELECT statements via psql execSync; grep for INSERT/UPDATE/DELETE/CREATE/DROP returned zero matches |

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/freshness/src/catalog.ts` | VERIFIED | Exports `CATALOG` (6 entries) and `FuenteConfig` interface; substantive (85 lines with full documentation) |
| `packages/freshness/src/query-runner.ts` | VERIFIED | Exports `queryFreshness` and `QueryRow`; uses psql execSync read-only SELECTs; gh CLI signal with 5s timeout; r2Snapshot from source_snapshot table |
| `packages/freshness/src/evaluate.ts` | VERIFIED | Pure function `evaluate(rows, catalog, now, envOverrides)`; no I/O; staleness rule and env override logic correct |
| `packages/freshness/src/evaluate.test.ts` | VERIFIED | 9 unit tests covering all behavior cases; no network; runs in isolation |
| `packages/freshness/src/cli.ts` | VERIFIED | loadEnv (BOM-safe), SUPABASE_DB_URL guard (exit 2), --json / --help flags, ANSI table, exit code logic |
| `docs/runbooks/cron-local-fallback.md` | VERIFIED | Section 6 "Verificar frescura de fuentes" with paragraph + commands + threshold table |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `cli.ts` | `query-runner.ts` | `queryFreshness(env.SUPABASE_DB_URL)` | WIRED | cli.ts line 167 |
| `query-runner.ts` | Supabase Postgres | `execSync` psql read-only SELECT | WIRED | query-runner.ts lines 41-50; 85-86 |
| `package.json` | `packages/freshness/src/cli.ts` | `scripts.freshness = tsx packages/freshness/src/cli.ts` | WIRED | Confirmed via node -e check |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pnpm freshness --help` exits 0 | `pnpm freshness --help; echo EXIT:$?` | Printed full usage; EXIT:0 | PASS |
| `pnpm --filter @obs/freshness test` green | `pnpm --filter @obs/freshness test` | 9/9 tests; exit 0 | PASS |
| Full suite 720/720 green | `pnpm -w test` | 720 passed, 68 files; exit 0 | PASS |
| Zero writes in query-runner.ts | grep INSERT/UPDATE/DELETE/CREATE/DROP | No output (zero matches) | PASS |
| Runbook section exists | grep "Verificar frescura" cron-local-fallback.md | Line 178: `## 6. Verificar frescura de fuentes` | PASS |
| env override logic (FRESHNESS_UMBRAL_LEYES=3, 5 days) | unit test #5 in evaluate.test.ts | umbralDias=3, stale=true | PASS (via unit test) |

### Data-Flow Trace (Level 4)

The CLI renders live data from PROD query results. The SUMMARY documents a real PROD run producing a 6-element JSON array with non-null `ultimoUpsert` values for 5 of 6 sources (lobby-leylobby shows stale=true at 17 days, which is a data anomaly surfaced correctly by the tool — not a phase gap). Data flows from Supabase via psql → QueryRow[] → FuenteResult[] → stdout.

**Note on lobby-leylobby STALE finding:** The tool correctly detects that `lobby_ingesta_estado.ingestado_hasta` was last updated 2026-06-22 (17 days, exceeding 7-day threshold). This is the tool working as intended — surfacing a real data anomaly — not a defect in Phase 58.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

No TBD/FIXME/XXX markers. No placeholder returns. No empty handlers. No hardcoded static data flowing to output.

### Deviation from Plan: Runbook Section Number

The PLAN specified `## 4. Verificar frescura` but sections 4 ("Re-enabling lobby-camara") and 5 ("Verificacion Post-Corrida") already existed. The section was added as `## 6. Verificar frescura de fuentes`. Content requirement is fully satisfied; only the heading number differs from the plan's grep check. This is a documentation-only deviation with no functional impact.

### Human Verification Required

None. All must-haves are verifiable from code and CLI spot-checks.

---

## Gaps Summary

No gaps. All 5 must-have truths verified. All 3 ROADMAP success criteria satisfied. Full suite green (720/720). Zero writes confirmed.

---

_Verified: 2026-07-08T21:04:00Z_
_Verifier: Claude (gsd-verifier)_
