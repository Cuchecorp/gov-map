---
phase: 132
slug: news-rss-conector-rss-dos-etapas-locked
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 132 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace pnpm existente) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm --filter @obs/news test` (package nuevo) |
| **Full suite command** | `pnpm test` + `pnpm guards` |
| **Estimated runtime** | ~120 s suite completa |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @obs/news test`
- **After every plan wave:** Run `pnpm test` + `pnpm guards`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> El planner completa esta tabla con los task IDs reales. Regla del milestone:
> para cada test nuevo, MUTAR el código y comprobar que el test cae (anti-vacuo).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner) | — | — | NEWS-01/NEWS-02 | — | — | unit/integration | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/news/` scaffold con vitest wired al workspace (sin config propio — gotcha
      Phase 43: paquete CI-DARK con `vitest.config` propio = 0 tests corren)
- [ ] Verificar que `pnpm test` desde root RECORRE el package nuevo (correr con un test
      trivial que falla a propósito y ver que la suite cae)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Corrida real contra los 5 feeds vivos (una sola vez, rate-limited) | NEWS-01/NEWS-02 | Toca red real; régimen permite máx 1 corrida de verificación | CLI local; registrar conteos y re-corrida `[skip]` |
| Verificación WAF: `Fetcher` Node vs curl (riesgo A4 del research) | NEWS-01 | Depende del comportamiento del CDN de cada medio | Primera tarea del plan; si un host bloquea Node fetch, documentar y escalar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
