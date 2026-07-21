---
phase: 86
slug: b-squeda-p1a-spike-retrieval-h-brido-golden-set-congelado-ga
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 86 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + packages, workspace pnpm) |
| **Config file** | app/vitest.config.ts + packages/*/vitest.config.ts (live: vitest.live.config.ts pattern) |
| **Quick run command** | `pnpm --filter <paquete-del-harness> test` |
| **Full suite command** | `pnpm test` (app 991 + packages 1103 verdes al inicio) |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command of the touched package
- **After every plan wave:** Run `pnpm test` + `tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (rellenado por el planner) | | | RETR-03, RETR-04 | — | spike read-only: cero DDL/DML | unit + live-skip | `pnpm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (vitest workspace + patrón `.live.test.ts` skip-sin-env ya probado en packages/votos).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scoring live contra PROD (medición de estrategias) | RETR-03 | Requiere `SUPABASE_DB_URL` + `GEMINI_API_KEY` reales; CI sin DB skipea honesto | Correr el harness CLI local con `.env`; verificar reporte estrategia × categoría |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
