---
phase: 62
slug: red-grafo-de-relaciones-entendible
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom para componentes React, `vi.mock("@xyflow/react")` pattern existente) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `pnpm --dir app test -- red` |
| **Full suite command** | `pnpm test` (root, corre toda la suite) |
| **Estimated runtime** | ~60 seconds (full) / ~10s (quick) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app test -- red`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 62-01-T1 | 01 | 1 | RED-01/02 | T-62-02 | banned-vocab leyenda | unit | `pnpm --dir app test -- red-graph` | ✅ | ⬜ pending |
| 62-01-T2 | 01 | 1 | RED-01/02 | T-62-01 | cap ≤25 + radial determinista | unit | `pnpm --dir app test -- red-graph` | ✅ | ⬜ pending |
| 62-02-T1 | 02 | 2 | RED-02 | T-62-04 | borde cámara sin partido/petróleo | unit | `pnpm --dir app test -- red-graph` | ✅ | ⬜ pending |
| 62-02-T2 | 02 | 2 | RED-02 | T-62-03 | lista móvil safeExternalHref | unit | `pnpm --dir app test -- red-graph` | ✅ | ⬜ pending |
| 62-03-T1 | 03 | 3 | RED-03 | T-62-05 | deploy sin flipear flag | manual+build | `pnpm --dir app test` + deploy 61-02 | ✅ | ⬜ pending |
| 62-03-T2 | 03 | 3 | RED-03 | — | cold-read veredicto comprensible | manual (BrowserOS) | `node scripts/bros-cli.mjs …` → red-evidence/ | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (vitest + jsdom + xyflow mock pattern ya presentes en app/).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lectura fría BrowserOS desktop+390px, con y sin seed | RED-03 | Veredicto de comprensibilidad es humano/visual | Loop BrowserOS de fase 61 (`scripts/bros-cli.mjs`), evidencia before/after en el phase dir |
| Legibilidad de etiquetas sin zoom en deploy real | RED-02 | Render final depende de Cloudflare deploy | Capturas post-deploy con runbook 61-02 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
