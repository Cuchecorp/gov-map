---
phase: 4
slug: adjudicacion-identidad-compuerta-humana-golden-set
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Node/TS) con mock LLM (sin red/cuota); pgTAP para migración 0006 |
| **Config file** | reusa workspace; paquete `@obs/adjudication` (dep de @obs/llm + @obs/identity) |
| **Quick run command** | `pnpm --filter @obs/adjudication test --run` |
| **Full suite command** | `pnpm -w test --run && supabase test db` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** quick run
- **After every plan wave:** full suite
- **Before verify:** full suite green + golden set regression PASS (precisión ≥ umbral)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure/Correct Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-------------------------|-----------|-------------------|--------|
| TBD | TBD | 1 | ID-03 | blocking genera candidatos apellido+cámara+periodo+región | unit | `pnpm --filter @obs/adjudication test --run blocking` | ⬜ |
| TBD | TBD | 1 | ID-03 | adjudicación MiniMax tool-call → JSON zod-validado; RUT/PII nunca al LLM | unit (mock) | `pnpm --filter @obs/adjudication test --run adjudic` | ⬜ |
| TBD | TBD | 1 | ID-04 | compuerta fail-closed: confidence<0.90 OR conflicts OR inconsist. → revisión (borde 0.90 testeado) | unit | `pnpm --filter @obs/adjudication test --run compuerta` | ⬜ |
| TBD | TBD | 1 | ID-06 | LLM auto-acepta máximo a `probable`; `confirmado` solo humano/determinista | unit | `pnpm --filter @obs/adjudication test --run estado` | ⬜ |
| TBD | TBD | 2 | ID-05/08 | migración 0006: revision_identidad + audit append-only (trigger+REVOKE+RLS) | pgTAP | `supabase test db` | ⬜ |
| TBD | TBD | 2 | ID-05 | CLI revisor confirma/rechaza/corrige → estado + audit con revisor+timestamp | unit | `pnpm --filter @obs/adjudication test --run review` | ⬜ |
| TBD | TBD | 3 | ID-07 | golden set regression: precisión ≥ umbral o el test FALLA (bloquea deploy); incluye "Walker P., Matías" | unit | `pnpm --filter @obs/adjudication test --run golden` | ⬜ |

*Task IDs los fija el planner.*

---

## Wave 0 Requirements

- [ ] Scaffold `@obs/adjudication` (dep @obs/llm + @obs/identity)
- [ ] Mock LLM determinista (respuestas tool-call fijas por caso) reusando el patrón de @obs/llm
- [ ] Golden set inicial etiquetado (homónimos, nombres de casada, abreviaturas, "Walker P., Matías") como fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Adjudicación LIVE contra MiniMax-M3 sobre el golden set (precisión real) | ID-03/07 | Requiere API key + red + cuota | Correr el golden set en modo LIVE (env `LLM_SMOKE=1` o `GOLDEN_LIVE=1`) y registrar precisión/recall reales de MiniMax-M3 |
| Revisión humana real de la cola | ID-05 | Decisión humana | Operador corre el CLI sobre casos dudosos reales (llegan con conectores de Fase 5+) |
