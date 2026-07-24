---
phase: 98
slug: senales-p1a-spike-de-datos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 98 — Validation Strategy

> Data-audit SPIKE. The deliverable is an evidence document; "validation" here = each classification is backed by a reproducible read-only query against the live DB.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | psql read-only queries (evidence) + vitest for any guard added |
| **Config file** | .env (SUPABASE_DB_URL) — never printed |
| **Quick run command** | `set -a; source .env; set +a; PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"` |
| **Full suite command** | `pnpm test` (only if a guard/test is added) |
| **Estimated runtime** | ~30s per query |

---

## Sampling Rate

- **Per claim:** every classification (honesta/sesgada/imposible) carries its query + real result.
- **Before close:** the 4 success criteria each have documented evidence in the findings doc.

---

## Per-Task Verification Map

| Task ID | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|-------------|-----------------|-----------|-------------------|--------|
| (planner completes) | SEN-01 | señal stale → suprimible, ausencia≠hecho | query-evidence | psql freshness/coverage | ⬜ pending |
| (planner completes) | SEN-06 | leyes-publicadas verdict binario | curl-probe + doc | — | ⬜ pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (read-only audit; no new framework).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Leyes-publicadas source viability | SEN-06 | requires live curl probe of gov source | one rate-limited request to Cámara leyes_promulgadas.aspx; inspect shape |
