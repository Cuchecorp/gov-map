---
phase: 120-escalera-on-flip-clasificacion-escalera
verified: 2026-07-28T20:40:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 120: ESCALERA-ON flip `CLASIFICACION_ESCALERA` Verification Report

**Phase Goal:** La escalera LLM queda encendida en la única tarea donde el benchmark la aprobó (clasificación), con red de seguridad para apagarla por config.
**Verified:** 2026-07-28T20:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP §120 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Shadow-eval Granite vs DeepSeek LIVE verde ANTES del flip | ✓ VERIFIED | Gate 3 en `120-FLIP-RECORD.md:75-122`: exit 0, `5 passed`/0 skipped, `acuerdo=8/8 (100%)`, 66.09s de llamadas reales (2026-07-28T20:27:47Z) — **anterior** al flip del Gate 5 (T20:32:07Z). Cobertura 8/10 documentada honestamente (2 casos contraparte usan MiniMax, fuera de `clasificarFicha`). Harness gate real: `packages/cruces/src/shadow-eval.test.ts:87` `CLASIFICACION_SHADOW_LIVE === "1"`. |
| 2 | Drift canary confirma modelo servido == veredicto full-40 | ✓ VERIFIED | Gate 2 (`:36-71`): exit 0, `1 passed`/0 skipped, provenance `servido == pinneado == @cf/ibm-granite/granite-4.0-h-micro`, probe HTTP real 3.587s. Pin verificado en producto: `packages/cruces/src/drift-canary.test.ts:33` `MODELO_PINNEADO = "@cf/ibm-granite/granite-4.0-h-micro"`, anclado al veredicto 2026-07-27. |
| 3 | Rollback-by-config probado: quitar la var devuelve DeepSeek incumbente byte-idéntico, sin migración/deploy | ✓ VERIFIED | Doble evidencia. Pre-flip (Gate 4): tres ramas de `resolverProvider` aseveradas offline. En vivo (Gate 5b): ciclo ON→OFF→ON, corrida OFF emite `provider=deepseek (default incumbente)` y la línea `tiered` desaparece; los 3 exit 0. Código confirmado en `packages/cruces/src/clasificar-fichas-cli.ts:213-216` — `env.CLASIFICACION_ESCALERA !== "1"` retorna `new DeepSeekProvider(...)`, misma construcción que el incumbente. Resolución en runtime desde env ⇒ sin migración/deploy. |
| 4 | `CLASIFICACION_ESCALERA=1` activo solo DESPUÉS del checkpoint de keys con el operador | ✓ VERIFIED | Gate 1 CERRADO (`:21-32`) con cita verbatim "Sí — proceder con gates y flip" (2026-07-28) precediendo todo gate. Orden DURO respetado en el archivo y en el historial de commits: 3f66ac9 (G2) → 408dfc6 (G3) → 5476dfe (G4+veredicto) → 8107500 (G5 flip) → 827ac8f (G5b) → 700b68d (G6). Estado actual: `grep -c "^CLASIFICACION_ESCALERA=1" .env` == **1**. |
| 5 | Adjudicación de identidad y extracción strict-schema intocadas (guards verdes) | ✓ VERIFIED | **Re-ejecutado por el verificador**: `pnpm --filter @obs/llm exec vitest run src/integ-scope-guard.test.ts src/provider-guard.test.ts src/tiered-scope-guard.test.ts` → `3 passed (3)` archivos, `7 passed (7)` tests, exit 0 — idéntico a lo registrado en Gate 6. Además `git diff ff5c678..HEAD -- . ':(exclude).planning'` == vacío: cero cambio de código de producto. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `120-FLIP-RECORD.md` | Gates 1-6 + veredicto + estado final | ✓ VERIFIED | 363 líneas, 9 secciones en orden DURO; comandos, horas UTC, exit codes y salidas transcritas por gate. |
| `.env` (local, no commiteado) | `CLASIFICACION_ESCALERA=1` × 1 | ✓ VERIFIED | `grep -c` == 1. `git ls-files .env` → untracked (sin fuga). Ningún otro contenido leído/impreso. |
| `clasificar-fichas-cli.ts` | `resolverProvider` con 3 ramas | ✓ VERIFIED | Líneas 202-244: rama inyección, rama incumbente (`!== "1"`), rama escalera con guardia Pitfall 2 (token/account vacío → fallback DeepSeek, no fallo). Sin modificación en esta fase. |
| `.env.example` | placeholder presente, sin diff | ✓ VERIFIED | `:193 CLASIFICACION_ESCALERA=` (desde 109); `git diff ff5c678..HEAD -- .env.example` sin diff. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.env` `CLASIFICACION_ESCALERA=1` | `TieredProvider` granite→deepseek | `resolverProvider` rama 3 | ✓ WIRED | Humo en vivo Gate 5: `provider=tiered:granite→deepseek`, `procesados=3` (N>0 ⇒ el provider se **ejerció**, no solo se resolvió), sin `fallback… (Pitfall 2)`. |
| Ausencia de la var | `DeepSeekProvider` incumbente | `resolverProvider` rama 2 | ✓ WIRED | Gate 5b corrida 2 en vivo + aserción offline. |
| Escalera encendida | adjudicación / extracción | (debe NO existir) | ✓ CORRECTAMENTE AUSENTE | 3 scope-guards verdes re-ejecutados POST-flip. |

### Behavioral Spot-Checks (re-ejecutados por el verificador)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Scope guards congelan tareas intocables | `pnpm --filter @obs/llm exec vitest run src/{integ-scope,provider,tiered-scope}-guard.test.ts` | `7 passed (7)`, exit 0 | ✓ PASS |
| Shadow-eval offline + skip limpio del bloque LIVE | `pnpm --filter @obs/cruces exec vitest run src/shadow-eval.test.ts` | `4 passed \| 1 skipped (5)`, exit 0 | ✓ PASS (skip LIVE esperado) |
| Flag activo exactamente una vez | `grep -c "^CLASIFICACION_ESCALERA=1" .env` | `1` | ✓ PASS |
| Cero cambio de código de producto | `git diff --stat ff5c678..HEAD -- . ':(exclude).planning'` | vacío | ✓ PASS |
| Anti-secret sobre el registro | regex `sk-…\|sb_secret_…\|eyJ…` | `0` | ✓ PASS |

**Nota sobre gates LIVE (2 y 3):** no re-ejecutables por el verificador sin consumir llamadas reales a Workers AI/DeepSeek. La evidencia registrada es internamente consistente y difícil de fabricar (latencias 3.587s / 66.091s coherentes con el delay 2.5s LOCKED × 8 casos × 2 llamadas, log de provenance, exit codes, timestamps UTC monótonos alineados con los commits). Los harness-gates LIVE existen en el código con skip limpio verificado.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CRON-03 | 120-01, 120-02 | Escalera LLM encendida en clasificación tras shadow-eval + drift canary + rollback-by-config | ✓ SATISFIED | 5/5 SC verificadas; `REQUIREMENTS.md:24` marcada `[x]`, `:68` Phase 120 → Complete. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno | — | Cero marcadores TBD/FIXME/XXX introducidos; cero cambio de código de producto. |

Hallazgo menor no bloqueante: `GATES 2-4 VERDES` aparece 2× en el registro — una es el veredicto (`:174`), la otra la cita de precondición del Gate 5 (`:188`). Es referencia, no un segundo veredicto; el veredicto es único y no hay rama de cierre honesto contradictoria (0 matches de "FLIP NO PROCEDE").

### Human Verification Required

Ninguna. El único checkpoint humano de la fase (provisión de keys Workers AI) fue cerrado por el operador en sesión con cita verbatim, previo a todo gate.

### Gaps Summary

Sin gaps. El objetivo de fase se cumple de forma observable: la escalera está encendida exclusivamente en clasificación (única tarea APPROVED por el veredicto full-40), la red de seguridad por config está probada en vivo en ambos sentidos, y el alcance quedó congelado por tres guards verdes re-ejecutados independientemente. La honestidad del registro es notable en dos puntos donde inflar habría sido fácil: la cobertura del shadow (8/8 declarado como 8 de 10 casos gate, no "10/10") y la divergencia de reparto 2/1 vs 1/2 sobre una muestra de 3, declarada explícitamente como no-hallazgo.

---

_Verified: 2026-07-28T20:40:00Z_
_Verifier: Claude (gsd-verifier)_
