---
phase: 109
slug: integ-p3-integrar-clasificacion-tras-golden-gate-verde
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 109 — Validation Strategy

> Contrato de validación de la integración. La mayoría OFFLINE con MockProvider (wiring/guards/golden). La parte LIVE (shadow-eval real Granite@WorkersAI vs DeepSeek + drift canary) es LIVE-gated (nunca CI), skip-limpio sin keys.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `packages/cruces/vitest.config.ts` + `packages/llm/vitest.config.ts` (existentes) |
| **Quick run command** | `pnpm --filter @obs/cruces exec vitest run` |
| **Full suite command** | `pnpm -r exec tsc -b && pnpm --filter @obs/cruces exec vitest run && pnpm --filter @obs/llm exec vitest run && pnpm --filter @obs/llm-bench exec vitest run` |
| **CI gate command (NET-NEW en ci.yml)** | steps offline que corren el golden de clasificación + los guards (hoy ci.yml solo corre `app`) |
| **Estimated runtime** | ~15 s offline; shadow-eval LIVE variable (decenas de llamadas reales) |

---

## Sampling Rate

- **After every task commit:** `pnpm -r exec tsc -b` + el vitest del paquete tocado
- **After every plan wave:** full suite offline
- **Before verify:** full suite verde (tsc -b 0) + el golden gate corre en CI (verificable en `.github/workflows/ci.yml`)
- **Max feedback latency:** ~20 s (offline)

---

## Per-Task Verification Map

| Task ID | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|-------------|-----------------|-----------|-------------------|--------|
| 109-01-* | 1 | INTEG-02 | **provider-guard (PRIMER COMMIT)**: enumera TODOS los providers, FALLA si alguno carece del wrapper zod+PII; RUT jamás cruza a un LLM | unit + source-scan | `vitest run -t "provider-guard"` | ⬜ pending |
| 109-01-* | 1 | INTEG-02 | **guard estático que MUERDE**: la escalera NO puede cablearse en `adjudicacion.*` ni en la extracción strict-schema (`pipeline-cli.ts`) ni en `clasificar-lobby-cli.ts` (MiniMax) | source-scan | `vitest run -t "scope-guard"` | ⬜ pending |
| 109-02-* | 2 | INTEG-01 | swap `clasificar-fichas-cli.ts:200` → `TieredProvider` con default=incumbente (env `CLASIFICACION_ESCALERA`!=1 ⇒ DeepSeek byte-idéntico) | unit (mock) | `vitest run -t "clasificar.*escalera\|default incumbent"` | ⬜ pending |
| 109-02-* | 2 | INTEG-01 | **golden de clasificación = regresión CI PERMANENTE** (ci.yml ampliado con step offline que MUERDE) | ci + golden | golden-set.test.ts verde + ci.yml step presente | ⬜ pending |
| 109-03-* | 3 | INTEG-01 | **shadow-eval ON**: candidato Granite en sombra vs incumbente, sin afectar salida productiva | LIVE-gated | `CLASIFICACION_SHADOW_LIVE=1 vitest run` (skip limpio sin keys) | ⬜ pending |
| 109-03-* | 3 | INTEG-03 | **rollback por config** (env `CLASIFICACION_ESCALERA`) = incumbente, sin migración/deploy + **canario de drift** del endpoint (provenance endpoint/tarifaFecha) | unit + LIVE-gated | `vitest run -t "rollback\|drift"` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Infra vitest existente (`@obs/cruces`, `@obs/llm`, `@obs/llm-bench`) cubre todo. MockProvider ya existe (108 `test-mock.ts`). El único NET-NEW de infra es AMPLIAR `.github/workflows/ci.yml` con steps offline (golden + guards) — parte del entregable INTEG-01, no un install de framework.

*Existing infrastructure covers all phase requirements — CI extension is a deliverable, not Wave 0 setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Promover" la escalera a routing-vivo Granite en producción | INTEG-01 | Es un config-flip posterior gated por shadow-eval verde; el AGENTE NO promueve (deja default=incumbente). Acto de operador, documentado. | Tras shadow-eval verde sostenido: setear `CLASIFICACION_ESCALERA=1` en el entorno de ingesta. Reversible: quitar la var. |

*Toda otra conducta de 109 tiene verificación automatizada (mock offline o LIVE-gated shadow).*

---

## Validation Sign-Off

- [ ] provider-guard es el PRIMER COMMIT (lockdown-guard-first)
- [ ] Guard estático MUERDE sobre adjudicacion.*/pipeline-cli.ts/lobby-cli
- [ ] Golden de clasificación corre en CI (ci.yml ampliado) como gate permanente
- [ ] Default de ruteo = incumbente (byte-idéntico sin la env var)
- [ ] Shadow-eval + drift LIVE-gated, skip-limpio sin keys
- [ ] Sin watch-mode; feedback latency < 20s offline
- [ ] `nyquist_compliant: true` al aprobar

**Approval:** pending
