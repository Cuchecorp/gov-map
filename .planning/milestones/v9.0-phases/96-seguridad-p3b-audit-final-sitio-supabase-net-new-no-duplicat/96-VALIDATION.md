---
phase: 96
slug: seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 96 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app/ + packages); psql read-only para DB viva; gitleaks 8.30.1; BrowserOS para verificación empírica en deploy |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter ./app test` |
| **Full suite command** | `pnpm test` + `tsc --noEmit` |
| **Estimated runtime** | ~60s app; packages ~90s; psql queries <10s |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter ./app test` (guards + suite app)
- **After every plan wave:** `pnpm test` (packages golden gates + app) + `tsc --noEmit`
- **Before `/gsd:verify-work`:** `pnpm test` verde + `pnpm audit --prod` limpio + deploy CSP verificado por BrowserOS
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 96-01-* | 01 | 1 | SEC-02 | Pitfall 12 | `.env.example` solo placeholders | unit (guard) | `pnpm --filter ./app test env-example-guard` | ❌ W0 | ⬜ pending |
| 96-01-* | 01 | 1 | SEC-02 | secreto en historial | gitleaks historial completo, FP triaged, cero valor impreso | script | `gitleaks git --redact` + triage doc | ✅ tool | ⬜ pending |
| 96-01-* | 01 | 1 | SEC-03 | supply chain | `pnpm audit --prod` 0 advisories (Next ≥16.2.11 + overrides) | script | `pnpm audit --prod` | ✅ tool | ⬜ pending |
| 96-02-* | 02 | 1 | SEC-03 | RLS/grants vivos | 0 offenders de app (filtro pg_depend pgTAP) | script (psql) | queries verbatim de 96-RESEARCH.md | ✅ validadas | ⬜ pending |
| 96-02-* | 02 | 1 | SEC-03 | allowlist drift vivo | 26 repo vs 25 secdef vivos, 2 inertes documentadas | script (psql) | query secdef vs allowlist | ✅ validada | ⬜ pending |
| 96-02-* | 02 | 1 | SEC-03 | CVE-2026-3172 | pgvector 0.8.0 vivo; ≥0.8.2 NO disponible → handoff operador | doc | `select extversion` + handoff | ✅ query | ⬜ pending |
| 96-02-* | 02 | 1 | identidad | golden gate re-verificado | golden sets verdes | unit | `pnpm -r --filter "./packages/*" test` | ✅ | ⬜ pending |
| 96-03-* | 03 | 2 | SEC-02 | CSP Report-Only forever | CSP ENFORCED sin romper hidratación | empírico | BrowserOS console 0 CSP errors + `curl -sI` headers | manual-only | ⬜ pending |
| 96-03-* | 03 | 2 | SEC-04 | B26 | handoff operador consolidado (NO rotar) | doc | 96-OPERATOR-HANDOFF.md cita runbook 75 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/lib/env-example-guard.test.ts` — detector puro + mutation self-check (espejo money-antiflip)
- [ ] `96-OPERATOR-HANDOFF.md` — B26 + pgvector-gap + rotaciones (cero) + sign-offs pendientes
- [ ] (opcional) `.gitleaks.toml` — allowlist de los 4 FP

*Framework install: none.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSP enforced sin romper hidratación | SEC-02 | cascada/hidratación solo observable en deploy real | deploy → BrowserOS: consola sin errores CSP, islands de filtros interactivos vivos, `curl -sI` muestra `Content-Security-Policy` (no Report-Only) |
| Errores genéricos al cliente | SEC-02 | Next prod strippea message; solo verificable en prod | provocar error (ruta inválida/RPC caída) en deploy y confirmar ausencia de texto Postgres |
| Fixes latentes 94 bundleados | cierre | solo visibles en deploy | DOM ficha (dedup counts) + a11y links en deploy nuevo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
