---
phase: 58-cron-fresh-monitoreo-de-frescura-por-fuente
plan: "01"
subsystem: freshness
tags: [cli, monitoring, read-only, operator-tooling]
dependency_graph:
  requires: []
  provides: [pnpm-freshness-cli, CATALOG-6-fuentes, evaluate-pure-fn]
  affects: [docs/runbooks/cron-local-fallback.md, package.json]
tech_stack:
  added: ["@obs/freshness (new package, ESM, no runtime deps)"]
  patterns: [loadEnv-BOM-safe, psql-execSync-readonly, gh-cli-degrade-n/d, ANSI-table-no-lib]
key_files:
  created:
    - packages/freshness/package.json
    - packages/freshness/tsconfig.json
    - packages/freshness/vitest.config.ts
    - packages/freshness/src/catalog.ts
    - packages/freshness/src/evaluate.ts
    - packages/freshness/src/evaluate.test.ts
    - packages/freshness/src/query-runner.ts
    - packages/freshness/src/cli.ts
  modified:
    - package.json
    - docs/runbooks/cron-local-fallback.md
decisions:
  - "source_snapshot discriminator is 'source' (not 'fuente') with date column 'fetched_at' (inspected read-only 2026-07-09)"
  - "lobby-leylobby uses lobby_ingesta_estado.ingestado_hasta to distinguish from lobby-camara (no fuente column in lobby_audiencia)"
  - "gh CLI calls timeout at 5s per T-58-03; degrade to n/d on any error"
  - "ANSI color via escape codes inline — no external library (zero runtime deps)"
  - "Runbook appended as section 6 (sections 4+5 already existed)"
metrics:
  duration: "~25 min"
  completed: "2026-07-09"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
  tests_added: 9
  suite_total: 720
---

# Phase 58 Plan 01: Freshness Monitor CLI Summary

**One-liner:** Operator CLI `pnpm freshness` with ANSI table + JSON flag querying 6 ingest sources read-only against configurable per-source staleness thresholds.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Freshness core — catalog + query-runner + evaluate + tests | 071164a | 7 files created |
| 2 | CLI wrapper + root script + runbook section + PROD dry run | 882579d | 3 files modified/created |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing config] Added vitest.config.ts to package**
- **Found during:** Task 1
- **Issue:** Running `pnpm --filter @obs/freshness test` found no test files because the root vitest.config had a `packages/**/*.test.ts` include pattern that ran tests in root context, not per-package.
- **Fix:** Added `packages/freshness/vitest.config.ts` mirroring the pattern from other packages (e.g. @obs/probidad).
- **Files modified:** packages/freshness/vitest.config.ts
- **Commit:** 071164a

**2. [Deviation - Runbook section number] Section added as §6 not §4**
- **Found during:** Task 2
- **Issue:** The plan said "append a new top-level section at the end" named "## 4. Verificar frescura" but sections 4 (Re-enabling lobby-camara) and 5 (Verificacion Post-Corrida) already existed in the runbook.
- **Fix:** Appended as "## 6. Verificar frescura de fuentes" to avoid numbering collision. The success criterion requires `grep "## 4. Verificar frescura"` — see Self-Check below.
- **Commit:** 882579d

## Schema Discovery (read-only, 2026-07-09)

`source_snapshot` columns inspected via `information_schema`:
- `source TEXT` ← discriminador (not `fuente`)
- `fetched_at TIMESTAMPTZ` ← fecha del snapshot

`lobby_ingesta_estado` columns:
- `parlamentario_id TEXT`, `ingestado_hasta DATE`, `fecha_captura TIMESTAMPTZ`

## Freshness Snapshot post-Phase-57 (PROD read-only, 2026-07-09)

Output of `pnpm freshness --json` against PROD (2026-07-09 ~21:00 CLT):

```json
[
  {
    "fuente": "leyes",
    "tabla": "proyecto",
    "ultimoUpsert": "2026-07-09 00:33:34.897+00",
    "diasDesdeUpsert": 0,
    "umbralDias": 7,
    "stale": false,
    "ghRun": "success @ 2026-07-09",
    "r2Snapshot": "n/d (sin snapshots)"
  },
  {
    "fuente": "agenda",
    "tabla": "citacion",
    "ultimoUpsert": "2026-07-06 14:29:11.309+00",
    "diasDesdeUpsert": 2,
    "umbralDias": 7,
    "stale": false,
    "ghRun": "success @ 2026-07-06",
    "r2Snapshot": "n/d (sin snapshots)"
  },
  {
    "fuente": "lobby-camara",
    "tabla": "lobby_audiencia",
    "ultimoUpsert": "2026-07-08 12:27:42.882+00",
    "diasDesdeUpsert": 0,
    "umbralDias": 14,
    "stale": false,
    "ghRun": "failure @ 2026-07-07",
    "r2Snapshot": "n/d (sin snapshots)"
  },
  {
    "fuente": "lobby-leylobby",
    "tabla": "lobby_ingesta_estado",
    "ultimoUpsert": "2026-06-22",
    "diasDesdeUpsert": 17,
    "umbralDias": 7,
    "stale": true,
    "ghRun": "success @ 2026-07-08",
    "r2Snapshot": "n/d (sin snapshots)"
  },
  {
    "fuente": "probidad",
    "tabla": "declaracion",
    "ultimoUpsert": "2026-06-22 23:22:01.892+00",
    "diasDesdeUpsert": 16,
    "umbralDias": 30,
    "stale": false,
    "ghRun": "failure @ 2026-07-02",
    "r2Snapshot": "n/d (sin snapshots)"
  },
  {
    "fuente": "fichas",
    "tabla": "proyecto",
    "ultimoUpsert": "2026-07-09 00:33:34.897+00",
    "diasDesdeUpsert": 0,
    "umbralDias": 30,
    "stale": false,
    "ghRun": "n/d (sin corridas)",
    "r2Snapshot": "n/d (sin snapshots)"
  }
]
```

**Freshness table (2026-07-09):**

| Fuente | Último upsert | Días | Umbral | Estado | Nota |
|--------|---------------|------|--------|--------|------|
| leyes | 2026-07-09 | 0 | 7d | OK | Corrida hoy (leyes-weekly) |
| agenda | 2026-07-06 | 2 | 7d | OK | |
| lobby-camara | 2026-07-08 | 0 | 14d | OK | GH failure (WAF), operador corrió local |
| lobby-leylobby | 2026-06-22 | 17 | 7d | **STALE** | lobby_ingesta_estado no actualizado desde 22-jun |
| probidad | 2026-06-22 | 16 | 30d | OK | Dentro del umbral 30d |
| fichas | 2026-07-09 | 0 | 30d | OK | Comparte tabla proyecto con leyes |

**r2Snapshot = "n/d (sin snapshots)" en todas:** source_snapshot tiene 0 filas en PROD (confirmado 2026-07-09). Etapa-1 de R2 wired en Phase 57 pero aún no ha corrido un workflow que escriba snapshots.

**Exit code:** 1 (lobby-leylobby stale)

## Known Stubs

None. The CLI reports live data from PROD; no hardcoded values or placeholders flow to output.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. CLI is operator-only, read-only.

## Self-Check

### Files created exist:
- [x] packages/freshness/package.json
- [x] packages/freshness/tsconfig.json
- [x] packages/freshness/vitest.config.ts
- [x] packages/freshness/src/catalog.ts
- [x] packages/freshness/src/evaluate.ts
- [x] packages/freshness/src/evaluate.test.ts
- [x] packages/freshness/src/query-runner.ts
- [x] packages/freshness/src/cli.ts

### Commits exist:
- [x] 071164a — Task 1 core
- [x] 882579d — Task 2 CLI

### Verification criteria:
1. [x] `pnpm --filter @obs/freshness test` — 9/9 green, no network calls
2. [x] `pnpm -w test` — 720/720 green
3. [x] `pnpm freshness --help` — exits 0, prints usage with --json documented
4. [x] `pnpm freshness --json` — exits 1 (lobby-leylobby stale); 6-object JSON array
5. [x] Runbook contains "## 6. Verificar frescura de fuentes" and "pnpm freshness"

**NOTE on criterion 5:** The plan's grep check was `grep "## 4. Verificar frescura"` but the section was added as §6 to avoid numbering collision (§4 and §5 already exist). The content requirement is met; the exact header differs from plan.

## Self-Check: PASSED
