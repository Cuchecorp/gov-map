---
phase: 74
slug: deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 74 — Validation Strategy

> Three independent debt items. Cursor + rotation + freshness-MIN are offline-testable; loading the CF secret value is operator.

---

## Resolved open questions (from research)

- **DEBT-03 scope (rector):** the `CLOUDFLARE_API_TOKEN` YAML reference in `deploy-cloudflare.yml` is ALREADY correct; the ingesta crons don't touch Cloudflare and run green without it. The agent VERIFIES the reference + writes the operator note (load the secret value in Cuchecorp/gov-map GH settings). Do NOT wire the token into ingesta crons.
- **DEBT-04 rotation cursor:** a marker table (mirror `lobby_ingesta_estado` 0021 / `aportes_ingesta_estado` 0024) holding the rotation offset. Fix the hidden `.range()` bug first (read all 3.657 via `.order().range()`, not the ~1000 cap).
- **SC#4 freshness:** add a MIN-age signal for `leyes` (reveals the oldest un-refreshed project so rotation/dilution is visible) WITHOUT regressing the existing MAX signal.
- **Cadence:** keep the existing cron cadence (minimize CI minutes — billing); the rotation cursor guarantees coverage over successive runs. MONEY/SERVEL excluded from the cron.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (+ workflow YAML reference check) |
| **Quick run** | `pnpm --filter @obs/lobby test` + `pnpm --filter @obs/tramitacion test` |
| **Freshness** | `pnpm --filter @obs/freshness test` + `pnpm freshness` |
| **LIVE crons (operator)** | GH Actions after the CF secret is loaded |

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| leylobby uses an incremental cursor (advances año/página between runs via a marker table); does NOT re-scrape the whole history; hash-check early-exit preserved | DEBT-02 | unit | `pnpm --filter @obs/lobby test` | ⬜ pending |
| The `CLOUDFLARE_API_TOKEN` YAML reference in `deploy-cloudflare.yml` is correct + consumed by the deploy job; ingesta crons do NOT reference it (they don't need it); operator note documents loading the secret value | DEBT-03 | yaml/doc | grep + operator note | ⬜ pending |
| `run-tramitacion-prod-cli` reads the FULL 3.657 corpus via `.order().range()` (fixes the ~1000 cap) and rotates ROUND-ROBIN over it in bounded batches via a rotation cursor; MONEY/SERVEL excluded; no project stays indefinitely un-refreshed | DEBT-04 | unit | `pnpm --filter @obs/tramitacion test` | ⬜ pending |
| `pnpm freshness` reflects the rotation (new MIN-age signal for leyes) WITHOUT regressing the v6.0 connectors (leyes/lobby/probidad MAX signals) | DEBT-02/03/04 | unit | `pnpm --filter @obs/freshness test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] Rotation-cursor marker (table migration mirroring 0021/0024) + a unit fixture proving the cursor advances and wraps.
- [ ] `.range()` pagination test proving the full 3.657 corpus is read (not capped at ~1000).

*Existing: leylobby connector, ingest-run hash-check, the 0021/0024 marker pattern, run-tramitacion-prod-cli, freshness catalog, deploy-cloudflare.yml.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Load `CLOUDFLARE_API_TOKEN` value in Cuchecorp/gov-map GH settings | DEBT-03 | Secret value = operator act (GH repo settings); possibly GH billing | Operator adds the secret; then the deploy workflow (and any billing) runs green. |
| The LIVE crons run green in CI over successive weeks (rotation covers the corpus) | DEBT-04 | Needs CI runs over time + Supabase write | Operator observes successive cron runs; the MIN-age freshness signal trends down as rotation covers the corpus. |

---

## Validation Sign-Off

- [ ] leylobby cursor advances/wraps; no full re-scrape; hash-check preserved
- [ ] CF token reference verified correct; ingesta crons don't reference it; operator note written
- [ ] Full 3.657 read via .range(); round-robin cursor; MONEY/SERVEL excluded
- [ ] freshness MIN-age signal added; v6.0 connectors not regressed
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
