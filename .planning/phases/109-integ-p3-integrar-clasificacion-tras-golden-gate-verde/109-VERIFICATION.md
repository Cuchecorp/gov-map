---
phase: 109-integ-p3-integrar-clasificacion-tras-golden-gate-verde
verified: 2026-07-27T12:00:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
manual_follow_ups:
  - test: "Promover la escalera a routing-vivo Granite en producción (setear CLASIFICACION_ESCALERA=1)"
    requirement: INTEG-01
    why_manual: "Config-flip de operador gated por shadow-eval verde sostenido; el agente NO promueve por diseño (deja default=incumbente). Reversible: quitar la var. NO es un gap."
---

# Phase 109: INTEG P3 — Integrar CLASIFICACIÓN Verification Report

**Phase Goal:** Probar el patrón completo de la escalera (108) en producción de pipeline sobre CLASIFICACIÓN (reversible, no-legal), con la red de seguridad (provider-guard + golden CI gate + rollback + shadow-eval + drift canary) como primer commit — sin promover a routing-vivo (default incumbente).
**Verified:** 2026-07-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| INTEG-01 | UNA tarea reversible (clasificación) corre con la escalera integrada, gated por golden verde en CI como regresión PERMANENTE; shadow-eval ON antes de promover; default=incumbente | ✓ VERIFIED | Swap real en `clasificar-fichas-cli.ts:202-245` (`resolverProvider`): rama default (`CLASIFICACION_ESCALERA !== "1"`, línea 213) → `DeepSeekProvider`; rama escalera (línea 235) → `buildTieredProvider(Granite→DeepSeek)`. `ci.yml:59-65` corre `@obs/llm` + `@obs/cruces` vitest OFFLINE sin secrets, steps `app` existentes intactos (líneas 44-52). Shadow-eval LIVE-gated observa sin promover (`shadow-eval.test.ts:87,93,163-165` — solo `console.log`, `expect(total).toBeGreaterThan(0)`, sin assert de gate, sin persistencia). Golden gate offline verde (`golden-set.test.ts` 8 tests, 1 LIVE skip). |
| INTEG-02 | Extracción sigue en DeepSeek, adjudicación sigue en MiniMax, sin cambio de comportamiento; guard estático/CI que MUERDE impide que la escalera toque `adjudicacion.*`/extracción; provider-guard enumera TODOS los providers y falla si alguno carece del wrapper zod+PII | ✓ VERIFIED | `integ-scope-guard.test.ts:34-62` asevera `clasificar-lobby-cli.ts` y `pipeline-cli.ts` NO contienen `TieredProvider` + mutation self-check (Test 3, línea 64). Grep del árbol: 0 `TieredProvider` en lobby-cli/pipeline-cli. `provider-guard.test.ts` enumera 4 providers (deepseek/minimax/granite/phi-judge), floor ≥4 (Test 3), y **WR-04 cerrado**: `esProviderSinGuard` usa `stripComentarios` + sintaxis de llamada `assertNoRutInLlmInput(`/`assertSensitivityAllowed(` (líneas 23-45); mutation self-checks incluyen comment-only línea Y bloque (líneas 102-127) — el false-green por comentario está cerrado. |
| INTEG-03 | Rollback trivial: `CLASIFICACION_ESCALERA` unset → incumbente por config, sin migración/deploy; drift canary del endpoint activo | ✓ VERIFIED | Test LOAD-BEARING `clasificar-fichas-cli.test.ts:19-25`: sin env var → `toBeInstanceOf(DeepSeekProvider)` AND `not.toBeInstanceOf(TieredProvider)` — muerde en ambas direcciones (una regresión que construyera la escalera flipearía ambos asserts). Re-confirmado en `shadow-eval.test.ts:41-82` (4 tests OFFLINE). Drift canary `drift-canary.test.ts:101-126`: probe cruda captura `body.model`, invalida el veredicto full-40 en mismatch (`throw` con `[DRIFT DETECTADO]`), `expect(modeloServido).toBe(MODELO_PINNEADO)` load-bearing. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/llm/src/provider-guard.test.ts` | Source-scan enumera providers + wrapper zod+PII | ✓ VERIFIED | 3 tests green; WR-04 fix presente (call-syntax + strip comments) |
| `packages/llm/src/integ-scope-guard.test.ts` | Guard estático anti-adjudicación/extracción | ✓ VERIFIED | 3 tests green; mutation self-check bites |
| `packages/cruces/src/clasificar-fichas-cli.ts` | Construction point con env-gate default-incumbente | ✓ VERIFIED | `resolverProvider` puro exportado; WR-01/WR-02 fixes presentes (línea 172 `.order()`, líneas 281-300 URL guards) |
| `packages/cruces/src/clasificar-fichas-cli.test.ts` | Test wiring default/escalera/fail-safe/inyección | ✓ VERIFIED | 5 tests green, load-bearing Test 1 bites bidireccional |
| `packages/cruces/src/shadow-eval.test.ts` | Shadow Granite vs DeepSeek LIVE-gated + rollback OFFLINE | ✓ VERIFIED | 4 OFFLINE green + 1 LIVE skip limpio; observación pura |
| `packages/cruces/src/drift-canary.test.ts` | Probe modelo servido vs pinneado, LIVE-gated | ✓ VERIFIED | 1 LIVE skip limpio; WR-03 redacción account-id (línea 116) |
| `.github/workflows/ci.yml` | Steps @obs/llm + @obs/cruces offline | ✓ VERIFIED | Líneas 59-65; steps `app` existentes intactos; sin secrets |
| `.env.example` | CLASIFICACION_ESCALERA/SHADOW_LIVE/DRIFT_CHECK vacíos documentados | ✓ VERIFIED | Líneas 180/186/193 vacías + "el agente NUNCA setea" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `clasificar-fichas-cli.ts` | `buildTieredProvider` (@obs/llm) | import + construcción condicional | ✓ WIRED | línea 20 import; línea 235 construcción gated por env |
| `ci.yml` | `@obs/cruces` + `@obs/llm` vitest | pnpm --filter exec vitest run | ✓ WIRED | líneas 60,65 |
| `provider-guard.test.ts` | `providers/*.ts` | readdirSync + readFileSync | ✓ WIRED | líneas 47-57,65 |
| `integ-scope-guard.test.ts` | `clasificar-lobby-cli.ts` | readFileSync + not.toContain | ✓ WIRED | líneas 34-47 |
| `drift-canary.test.ts` | Workers AI endpoint | fetch + body.model vs pinneado | ✓ WIRED | líneas 82-109 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Monorepo type gate | `pnpm -r exec tsc -b` | exit 0 | ✓ PASS |
| @obs/cruces suite | `pnpm --filter @obs/cruces exec vitest run` | 42 passed / 3 skipped (LIVE) | ✓ PASS |
| @obs/llm suite | `pnpm --filter @obs/llm exec vitest run` | 158 passed / 3 skipped (LIVE) | ✓ PASS |
| Agent NO promoted | grep `CLASIFICACION_ESCALERA=1` (as set env) | only comments/docs/tests; `.env.example` empty | ✓ PASS |
| Scope fence | grep `TieredProvider` in lobby-cli/pipeline-cli | No matches | ✓ PASS |
| No selectProvider revival | git log router.ts | last touched phase 02 (v1.0), not 109 | ✓ PASS |
| No credentialed URL/key print | grep console.log Bearer/apiKey/accountId | No matches (WR-03 redaction confirmed) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INTEG-01 | 109-02, 109-03 | Tarea reversible con escalera + golden CI + shadow-eval | ✓ SATISFIED | resolverProvider + ci.yml + shadow-eval |
| INTEG-02 | 109-01 | Extracción/adjudicación intactas + guard que muerde | ✓ SATISFIED | provider-guard + integ-scope-guard |
| INTEG-03 | 109-02, 109-03 | Rollback por config + drift canary | ✓ SATISFIED | load-bearing default test + drift-canary |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None (no TBD/FIXME/XXX in modified files; no key/URL leaks) | — | — |

Code-review Warnings WR-01..WR-04 all RESOLVED (109-REVIEW-FIX.md, commits 337acd5/f1d34b6/59dca9e), verified in code:
- **WR-01** (empty-URL crash): `clasificar-fichas-cli.ts:281-300` — dry-run degrades clean, LIVE fail-fasts.
- **WR-02** (non-deterministic gate sample): `clasificar-fichas-cli.ts:172` — `.order("boletin")` before `.limit()`.
- **WR-03** (credentialed URL print): `drift-canary.test.ts:116` — `baseURL.replace(accountId, "***")`.
- **WR-04** (substring false-green): `provider-guard.test.ts:23-45,102-127` — strip comments + call-syntax + comment-only mutation checks.

IN-01/IN-02/IN-03 accepted as debt (info-only, non-load-bearing) per 109-REVIEW-FIX.md.

### Manual Follow-Up (by design — NOT a gap)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Promover la escalera a routing-vivo Granite en producción | INTEG-01 | Config-flip posterior gated por shadow-eval verde; el AGENTE NO promueve (deja default=incumbente). Documentado en 109-VALIDATION.md "Manual-Only Verifications". | Tras shadow-eval verde sostenido: setear `CLASIFICACION_ESCALERA=1` en el entorno de ingesta. Reversible: quitar la var. |

Per the phase contract: the LIVE shadow-eval promotion is an OPERATOR act deferred by design. The wiring + safety net + default-incumbent + guards are all TRUE and the suite is green → the phase PASSES with the operator promotion documented as a manual follow-up, not a blocker.

### Gaps Summary

No gaps. All three success criteria (INTEG-01/02/03) are observably TRUE in the codebase:
- The swap exists with default=incumbente and bites bidirectionally in a load-bearing test.
- CI genuinely runs the golden + guards offline on push/PR with existing steps intact and no secrets.
- Both guards bite non-vacuously (mutation self-checks incl. the WR-04 comment-only path).
- Shadow-eval is LIVE-gated and observes without promoting; drift canary invalidates on model mismatch.
- Scope fence held (lobby-cli/pipeline-cli/adjudicación untouched, no selectProvider revival).
- The agent did NOT set `CLASIFICACION_ESCALERA=1` anywhere; the only occurrence in real config is empty in `.env.example`.
- tsc -b exit 0; @obs/cruces 42 pass / 3 clean LIVE skips; @obs/llm 158 pass / 3 clean LIVE skips.

---

_Verified: 2026-07-27_
_Verifier: Claude (gsd-verifier)_
