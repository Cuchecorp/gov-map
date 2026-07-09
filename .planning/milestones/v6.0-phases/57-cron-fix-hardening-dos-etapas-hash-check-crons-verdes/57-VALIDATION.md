---
phase: 57
slug: cron-fix-hardening-dos-etapas-hash-check-crons-verdes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace pnpm) |
| **Config file** | vitest configs por paquete (existentes) |
| **Quick run command** | `pnpm --filter @obs/ingest test && pnpm --filter @obs/tramitacion test` |
| **Full suite command** | `pnpm -w test && pnpm -w typecheck` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** quick run del paquete tocado (`pnpm --filter <pkg> test`)
- **After every plan wave:** full suite + typecheck
- **Before `/gsd:verify-work`:** full suite verde + los greps de logs de dry-run
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| G4 dedupe | TBD | 1 | CRON-04 | — | batch con duplicados no revienta upsert | unit | `pnpm --filter @obs/tramitacion test -- -t dedupe` | ✅ | ⬜ pending |
| R2 getObject | TBD | 1 | CRON-02 | T-57-01 firma AWS correcta, sin creds logueadas | unit (mock fetch) | `pnpm --filter @obs/ingest test -- -t getObject` | ✅ | ⬜ pending |
| putImmutable {existed} | TBD | 1 | CRON-03 | — | 412 → existed=true sin re-escritura | unit | `pnpm --filter @obs/ingest test -- -t existed` | ✅ | ⬜ pending |
| --from-r2 mode | TBD | 2 | CRON-02 | T-57-02 nunca fetch a fuente en modo from-r2 | unit (spy fetch) | test asierta 0 llamadas a hosts gubernamentales | ✅ | ⬜ pending |
| early-exit log | TBD | 2 | CRON-03 | — | corrida sin novedades emite log exacto | unit/integration | grep `[skip] sin novedades` en salida dry-run | ✅ | ⬜ pending |
| probidad assert | TBD | 2 | CRON-04 | — | semana sin novedades NO falla; drift sistemático falla loud | unit + YAML review | vitest probidad + grep YAML assert nuevo | ✅ | ⬜ pending |
| secrets cargados | TBD | 3 | CRON-04 | T-57-03 valores jamás impresos | CLI | `gh secret list --repo Cuchecorp/gov-map` contiene los 5 nombres | ✅ | ⬜ pending |
| cron verde E2E | TBD | 3 | CRON-04 | — | 1 corrida workflow_dispatch verde | CLI | `gh run list --workflow <wf> --limit 1` → success | ✅ | ⬜ pending |
| runbook fallback | TBD | 3 | CRON-04 | — | doc existe con comandos reproducibles | file | `test -f docs/runbooks/cron-local-fallback.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — vitest ya configurado en cada paquete; fixtures XML/JSON reales disponibles.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Corrida programada (schedule, no dispatch) verde el próximo L–V | CRON-04 | el schedule real solo dispara en su cron window | Operador: revisar Actions el lunes; comparar con runbook |
| Valores de secrets correctos (no solo presentes) | CRON-04 | un valor mal pegado solo se detecta corriendo | La corrida dispatch E2E lo cubre; si falla por auth → re-cargar secret |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
