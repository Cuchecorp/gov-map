---
phase: 90
slug: personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-comisiones-gate-de-91
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 90 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (monorepo pnpm — packages/* + app/) |
| **Config file** | per-package vitest config (packages/bio hereda patrón de packages/lobby) |
| **Quick run command** | `pnpm --filter @obs/bio test` |
| **Full suite command** | `pnpm test` (app 991 + packages 1103+) |
| **Estimated runtime** | ~60s quick / ~5 min full |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @obs/bio test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green + `tsc --noEmit` limpio
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | BIO-01, BIO-05 | T-90-PII | allowlist parser excluye RUT/FechaNacimiento/Sexo | unit | `pnpm --filter @obs/bio test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/bio/src/*.test.ts` — fixtures XML sintéticos con campos PII (RUT, FechaNacimiento, Sexo) → asserts de exclusión (test que MUERDE)
- [ ] pgTAP `supabase/tests/00NN_bio.test.sql` — tablas nuevas deny-by-default (RLS on, cero policies, cero grant anon)

*Existing infrastructure (vitest workspace + pgTAP runner psql) covers the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Corrida LIVE acotada contra fuentes (rate-limit 2-3s) | BIO-01 | toca red externa/WAF | correr run-bio-cli con --dry-run primero; verificar R2 y counts |
| Apply migración a PROD | BIO-01/05 | psql --single-transaction contra PROD | runbook espejo 72-APPLY-RUNBOOK |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
