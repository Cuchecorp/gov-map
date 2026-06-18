---
phase: 2
slug: capa-de-providers-llm-embeddings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Node/TS) con `fetch` inyectable + `makeMockFetch` (patrón de Fase 1) |
| **Config file** | reusa vitest config del workspace; nuevo paquete `@obs/llm` |
| **Quick run command** | `pnpm --filter @obs/llm test --run` |
| **Full suite command** | `pnpm -w test --run && pnpm -w typecheck` |
| **Estimated runtime** | ~20–40 seconds |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @obs/llm test --run`
- **After every plan wave:** full suite
- **Before verify:** full suite green
- **Max feedback latency:** 40 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| TBD | TBD | 1 | FND-06 | zod safeParse es la compuerta única; salida inválida → retry/repair, no se acepta | unit (mock fetch) | `pnpm --filter @obs/llm test --run validation` | ⬜ |
| TBD | TBD | 1 | FND-06 | MiniMax adapter usa tool calling forzado; parsea `tool_calls[].function.arguments` | unit (mock fetch) | `pnpm --filter @obs/llm test --run minimax` | ⬜ |
| TBD | TBD | 1 | FND-06 | DeepSeek adapter usa `json_object`; prefijo estable para prompt-cache | unit (mock fetch) | `pnpm --filter @obs/llm test --run deepseek` | ⬜ |
| TBD | TBD | 1 | FND-06 | Router fail-closed: tarea sensible→tier que entrena lanza error, nunca degrada | unit | `pnpm --filter @obs/llm test --run router` | ⬜ |
| TBD | TBD | 1 | FND-07 | EmbeddingProvider Gemini 768-dim L2-normalizado; cada vector con model/dims/version | unit (mock fetch) | `pnpm --filter @obs/llm test --run embedding` | ⬜ |

*Task IDs los fija el planner.*

---

## Wave 0 Requirements

- [ ] Scaffold `@obs/llm` (package.json, tsconfig, vitest) + import map para Deno
- [ ] Helper `makeMockFetch` para respuestas de chat/tool-call/embedding sin red
- [ ] Fixtures: respuesta tool_call de MiniMax, respuesta json_object de DeepSeek, embedding de Gemini

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smoke test live de 1 llamada por proveedor (MiniMax-M3, DeepSeek V4, Gemini embeddings) | FND-06/07 | Requiere API keys reales y red; gasta cuota | Correr el smoke test gated por env var (`LLM_SMOKE=1`) una vez; confirmar shape de respuesta y dims=768 |
| Confirmar tier sin entrenamiento para dato personal en MiniMax/DeepSeek | Política de datos | Requiere revisar términos/cuenta del proveedor | Verificar plan/tier de la cuenta antes de enrutar dato personal |
