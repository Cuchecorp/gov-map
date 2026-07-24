---
phase: 99
slug: senales-p1b-materializador
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 99 — Validation Strategy

> Backend/migration phase. Validation = pgTAP against live schema (mirror 0039 test) + vitest for lockdown-guard allowlist + read-only spot-checks that the materialized rows honor the LOCKED data-defect guards.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP (supabase/tests) + vitest (app guards) |
| **Config file** | supabase/tests + app/vitest.config.ts |
| **Quick run command** | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -f supabase/tests/00XX_actualidad_senal.test.sql` |
| **Full suite command** | `pnpm test && pnpm -r exec tsc --noEmit` |
| **Estimated runtime** | ~150s |

---

## Sampling Rate

- **After migration apply:** run the pgTAP test; assert no row with `fecha>current_date` feeds a signal, `camara` normalized, suppression-when-stale fires as a row with `supresion_causa`.
- **After allowlist change:** run lockdown-guard vitest.
- **Before close:** full suite + tsc + pnpm audit green; the panel RPC returns bounded rows within statement_timeout.

---

## Per-Task Verification Map

| Task ID | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|-------------|-----------------|-----------|-------------------|--------|
| (planner completes) | SEN-02 | RPC bounded, SECURITY DEFINER, allowlisted, LIMIT+timeout | pgTAP + vitest | psql test + lockdown-guard | ⬜ pending |
| (planner completes) | SEN-03 | señales factuales ancladas a tramitacion_evento.fecha | pgTAP | psql test | ⬜ pending |
| (planner completes) | SEN-04 | supresión = fila con causa, no ausencia; sesgo declarado | pgTAP | psql test | ⬜ pending |
| (planner completes) | SEN-05 | label = materia/mode(), cluster no-LLM, seed fija | unit + pgTAP | CLI determinism test | ⬜ pending |

---

## Wave 0 Requirements

Existing infrastructure covers requirements (pgTAP + vitest present). Add `supabase/tests/00XX_actualidad_senal.test.sql` mirroring `0039_cruce_senal.test.sql`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_cron + GH Actions intraday schedule fires | SEN-02 | requires wall-clock + operator secrets | verify cron registered (cron.job) + YAML present; operator confirms secrets loaded in GH |
| Migration applied to live DB | SEN-02 | psql --single-transaction against prod | operator/orchestrator applies; pgTAP green post-apply |
