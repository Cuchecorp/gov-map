---
phase: 63
slug: busq-b-squeda-de-proyectos-completa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (raíz `vitest.config.ts`; cada paquete `test: "vitest run"`) |
| **Config file** | `vitest.config.ts` (raíz) + por paquete |
| **Quick run command** | `pnpm --filter @obs/fichas test` (o el paquete tocado) |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~90 seconds (full) / ~15s (quick) |

---

## Sampling Rate

- **After every task commit:** Run quick command del paquete tocado
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | BUSQ-01/02/03 | — | RUT nunca a LLM (assertNoRutInLlmInput) | unit | per-package vitest | mixed | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/fichas/src/seed-fichas.test.ts` — seed idempotente de fichas pendientes (BUSQ-01)
- [ ] `scripts/verify-cobertura.sql` — igualdad de counts o diferencia explicada (BUSQ-01)
- [ ] `packages/tramitacion/src/parse-camara-legislativo.test.ts` — parseo `ProyectoLey[]`/`NumeroBoletin` (BUSQ-02)
- [ ] `app/app/buscar/coverage.test.tsx` — declaración "Busca sobre N proyectos" (BUSQ-03)
- Ampliar existentes: `pipeline.test.ts`, `connector-camara.test.ts`, `evaluate.test.ts` (freshness)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backfill LOCAL completo (R2→Supabase, rate-limit 2-3s, reanudable) | BUSQ-01/02 | Corrida larga contra fuentes vivas + PROD | CLI con checkpoints de progreso; verificar counts con verify-cobertura.sql al final |
| Cron leyes-weekly sigue verde con corpus ampliado | BUSQ-02 | GH Actions run real | Revisar próximo run del workflow o dispatch manual acotado |
| /buscar declara cobertura en deploy real | BUSQ-03 | Render final en Cloudflare | Runbook 61-02 + captura |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
