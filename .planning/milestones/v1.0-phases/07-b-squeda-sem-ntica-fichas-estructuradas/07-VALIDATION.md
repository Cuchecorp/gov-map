---
phase: 7
slug: b-squeda-sem-ntica-fichas-estructuradas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace standard) + pgTAP for SQL migrations |
| **Config file** | vitest.config.ts (root) / app/vitest.config.ts (frontend) |
| **Quick run command** | `pnpm vitest run <changed package>` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <package>`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-XX-XX | TBD | TBD | SEM-01..06 | T-7-XX / — | RUT/dato personal nunca al LLM (data-routing gate) | unit/pgtap | `pnpm vitest run` | ❌ W0 | ⬜ pending |

*Populated by the planner per task. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Golden set de extracción** (~15-20 casos anotados a mano sobre texto legal real) + métrica (F1 sobre cuerpos legales citados + substring literal sobre idea matriz, con caso adversarial) — **gate de CI** que bloquea si la precisión baja del umbral (espejo de `packages/adjudication/golden`). Este es el artefacto central de validación de la fase (STATE flag P7).
- [ ] Fixtures reales: XML de tramitación del Senado con `<link_mensaje_mocion>` + texto íntegro descargado para los casos del golden set.
- [ ] pgTAP para la migración 0011 (tablas `proyecto_ficha`/`proyecto_embedding`, índice HNSW, RPC `match_proyectos`, RLS public-read + grant execute a anon).
- [ ] Smoke test gated (LIVE) del `taskType` de Gemini antes del embed masivo (resuelve open question A1).

*Existing vitest/pgTAP infrastructure covers the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calidad de idea matriz extraída sobre texto legal en español | SEM-02 | Fidelidad literal no es totalmente medible por exact-match; requiere juicio humano sobre el golden set | Revisar las extracciones del golden set: la idea matriz debe ser cita/derivación literal, NUNCA interpretar ni conectar hechos (guardrail #2) |
| Relevancia subjetiva de "proyectos similares" | SEM-05 | kNN coseno es objetivo, pero la utilidad ciudadana es cualitativa | Inspeccionar vecinos kNN de 3-5 boletines conocidos; confirmar coherencia temática sin lenguaje de afinidad/causalidad |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (golden set es bloqueante)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
