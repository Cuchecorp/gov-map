---
phase: 118
slug: cron-audit-veredicto-por-cron-con-evidencia
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 118 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (suite existente app+packages) |
| **Config file** | existente por package |
| **Quick run command** | `pnpm test` (paquete tocado) |
| **Full suite command** | `pnpm test` + `pnpm tsc` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command del paquete tocado (fase doc-only: verificación = evidencia reproducible en el documento)
- **After every plan wave:** Documento de veredictos consistente con probes capturados
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 118-01-01 | 01 | 1 | CRON-01 | — | probes read-only, sin secretos impresos | CLI | `gh run list` / psql read-only / `pnpm freshness` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — fase de auditoría documental; la evidencia son salidas de comandos capturadas en el documento.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Veredicto por cron respaldado por evidencia | CRON-01 | El juicio verde/stale/roto cruza 3 patas de evidencia observada | Revisar 118-CRON-VERDICTS.md: cada fila cita comando reproducible + salida |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
