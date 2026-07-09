---
phase: 56
slug: cron-audit-auditor-a-e2e-de-los-9-workflows-de-ingesta
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace pnpm) — pero esta fase es DOC-ONLY: la validación primaria son comandos read-only reproducibles |
| **Config file** | vitest configs existentes por paquete (sin cambios en esta fase) |
| **Quick run command** | `pnpm -w typecheck` (no debe romperse — la fase no toca código) |
| **Full suite command** | `pnpm -w test` (regresión: debe seguir verde, cero cambios de código) |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** verificar que el doc referencia comandos reproducibles (grep de la sección "Cómo re-verificar" por workflow)
- **After every plan wave:** re-ejecutar los probes read-only citados en el audit (gh run list / gh secret list) y confirmar que el doc coincide
- **Before `/gsd:verify-work`:** los 9 workflows tienen veredicto + los 23 gaps tienen archivo:línea
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-01-01 | 01 | 1 | CRON-01 | T-56-01 | ningún valor de secret impreso en el doc | grep | `grep -iE "(sk-|AKIA|secret.*=|Bearer )" 56-CRON-AUDIT.md → sin matches` | ✅ | ⬜ pending |
| 56-01-02 | 01 | 1 | CRON-01 | — | 9/9 workflows con veredicto cerrado | grep | `grep -cE "Veredicto: (VERDE\|CORRE-CON-GAPS\|NO-CORRE\|NO-APLICA-CRON)" 56-CRON-AUDIT.md → 9` | ✅ | ⬜ pending |
| 56-01-03 | 01 | 1 | CRON-01 | — | gap-list con archivo:línea | grep | `grep -cE "G[0-9]+.*[a-zA-Z0-9_/.-]+\.(ts\|yml\|sql):[0-9]+" 56-CRON-AUDIT.md ≥ 20` | ✅ | ⬜ pending |
| 56-01-04 | 01 | 1 | CRON-01 | — | re-verificación reproducible por workflow | manual+grep | sección "Cómo re-verificar" presente para los 9 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None — "Existing infrastructure covers all phase requirements." La fase produce un documento; no requiere stubs de test nuevos.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirmar veredicto con corrida real (workflow_dispatch) | CRON-01 | Disparar ingestas está PROHIBIDO en esta fase (checkpoint operador) | Operador: `gh workflow run <wf> --repo Cuchecorp/gov-map` y comparar logs vs veredicto del audit |
| Estado de billing GH observado en dashboard | CRON-01 | El API expone señales indirectas; el dashboard es autoritativo | Operador: Settings → Billing en GitHub |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
