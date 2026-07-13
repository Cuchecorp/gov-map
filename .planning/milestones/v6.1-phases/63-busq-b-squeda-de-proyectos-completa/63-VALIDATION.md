---
phase: 63
slug: busq-b-squeda-de-proyectos-completa
status: planned
nyquist_compliant: true
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
| 63-01 T1 | 01 | 1 | BUSQ-01 | T-63-02 | seed no re-abre estado terminal | unit | pnpm --filter @obs/fichas exec vitest run src/seed-fichas.test.ts | ❌ Wave 0 | ⬜ pending |
| 63-01 T2 | 01 | 1 | BUSQ-01 | T-63-01/02 | seedFichasPendientes idempotente | unit | pnpm --filter @obs/fichas exec vitest run src/seed-fichas.test.ts | ✅ (Task 2) | ⬜ pending |
| 63-01 T3 | 01 | 1 | BUSQ-01 | T-63-03 | CLI dry-run gateado por service key | unit | pnpm --filter @obs/fichas test | ❌ Wave 0 | ⬜ pending |
| 63-02 T1 | 02 | 1 | BUSQ-02 | T-63-07 | shape live + fixture parser | unit | pnpm --filter @obs/tramitacion exec vitest run src/parse-camara-legislativo.test.ts | ❌ Wave 0 | ⬜ pending |
| 63-02 T2 | 02 | 1 | BUSQ-02 | T-63-07 | parser valida con zod | unit | pnpm --filter @obs/tramitacion exec vitest run src/parse-camara-legislativo.test.ts | ✅ (Task 2) | ⬜ pending |
| 63-02 T3 | 02 | 1 | BUSQ-02 | T-63-04/05/06 | enumeración reusa política @obs/ingest | unit | pnpm --filter @obs/tramitacion test | ✅ (ampliar) | ⬜ pending |
| 63-03 T2 | 03 | 2 | BUSQ-01/02 | T-63-09/10 | ingesta R2 primero + seed cierra gap | integration(DB) | psql verify count(proyecto)==count(ficha) | ❌ manual | ⬜ pending |
| 63-03 T4 | 03 | 2 | BUSQ-01 | T-63-08/11 | pipeline degrada honesto; RUT nunca al LLM | integration(DB) | psql embedding_version group | ❌ manual | ⬜ pending |
| 63-03 T5 | 03 | 2 | BUSQ-02 | — | cron acotado sin re-backfill | static | grep YAML entrypoints | ✅ | ⬜ pending |
| 63-04 T1 | 04 | 3 | BUSQ-03 | T-63-12/13/14 | coverage server-only, N no hardcodeado | unit(RTL) | pnpm --filter ./app exec vitest run app/buscar/coverage.test.tsx | ❌ Wave 0 | ⬜ pending |
| 63-04 T2 | 04 | 3 | BUSQ-03 | — | banner N real + señal freshness N/M | unit | pnpm --filter @obs/freshness exec vitest run | ✅ (ampliar) | ⬜ pending |

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
