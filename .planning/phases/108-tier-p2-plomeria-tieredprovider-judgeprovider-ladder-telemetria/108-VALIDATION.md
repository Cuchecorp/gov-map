---
phase: 108
slug: tier-p2-plomeria-tieredprovider-judgeprovider-ladder-telemetria
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 108 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Todo el testeo es OFFLINE con `MockProvider` — sin red, sin keys (criterio de aceptación LOCKED).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `packages/llm/vitest.config.ts` (existente) |
| **Quick run command** | `pnpm --filter @obs/llm exec vitest run src/tiered.test.ts` |
| **Full suite command** | `pnpm --filter @obs/llm exec vitest run && pnpm --filter @obs/llm-bench exec vitest run` |
| **Estimated runtime** | ~10 segundos (offline, mock) |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @obs/llm exec tsc -b && pnpm --filter @obs/llm exec vitest run src/tiered.test.ts`
- **After every plan wave:** full suite (`@obs/llm` + `@obs/llm-bench`)
- **Before verify:** full suite verde (tsc -b 0)
- **Max feedback latency:** ~15 s

---

## Per-Task Verification Map

| Task ID | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|-------------|-----------------|-----------|-------------------|--------|
| 108-01-* | 1 | TIER-02 | `CompletionRequest.task` aditivo; ausencia de `task` = passthrough BYTE-IDÉNTICO al provider base | unit (mock) | `vitest run src/tiered.test.ts -t "byte-identical"` | ⬜ pending |
| 108-01-* | 1 | TIER-02 | `TieredProvider implements LLMProvider`, drop-in en construcción, NO usa `selectProvider` | unit + tsc | `vitest run src/tiered.test.ts -t "drop-in"` | ⬜ pending |
| 108-02-* | 2 | TIER-03 | `JudgeProvider` ESCALATE-ONLY: un juez que "aprueba" NO relaja la compuerta; escala/rechaza registrado estructurado | unit (mock) | `vitest run src/tiered.test.ts -t "escalate-only"` | ⬜ pending |
| 108-03-* | 2 | TIER-04 | telemetría emite modelo/tarea/latencia/costo/veredicto/escalación SIN payload/PII; escalación ACOTADA 1-hop + presupuesto/ítem + terminal humano (sin loops) | unit (mock) | `vitest run src/tiered.test.ts -t "telemetry\|bounded"` | ⬜ pending |
| 108-04-* | 2 | TIER-05 | ruteo ENTRE pipelines, jamás mid-sesión; construction point de fichas SIN cambio ⇒ prompt-cache intacto (argumento estructural) | unit + grep | `vitest run src/tiered.test.ts -t "between-pipelines"` + guard | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Infraestructura vitest existente (`@obs/llm`) cubre todo. `MockProvider` ya existe (`llm-bench` + `adjudication`) — reutilizable o clonar mínimo en `@obs/llm` si el import cruza límites de paquete.

*Existing infrastructure covers all phase requirements — no Wave 0 framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | Ninguno: toda conducta de 108 es testeable con MockProvider offline. La verificación LIVE de la integración (prompt-cache real, drift) es de 109, no de 108. |

*All phase-108 behaviors have automated (mock) verification.*

---

## Validation Sign-Off

- [ ] Todas las tareas tienen verify `<automated>` (mock, offline)
- [ ] Continuidad de muestreo: sin 3 tareas seguidas sin verify automatizado
- [ ] Wave 0 innecesario (infra existente)
- [ ] Sin watch-mode
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` al aprobar

**Approval:** pending
