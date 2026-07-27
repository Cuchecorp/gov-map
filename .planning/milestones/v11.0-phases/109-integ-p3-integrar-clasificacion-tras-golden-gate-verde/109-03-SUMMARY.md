---
phase: 109-integ-p3-integrar-clasificacion-tras-golden-gate-verde
plan: "03"
subsystem: cruces/llm
tags: [shadow-eval, drift-canary, live-gate, integ-01, integ-03, observabilidad]
dependency_graph:
  requires: [109-02]
  provides: [INTEG-01, INTEG-03]
  affects: [packages/cruces, .env.example]
tech_stack:
  added: []
  patterns:
    - LIVE-gate via CLASIFICACION_SHADOW_LIVE / CLASIFICACION_DRIFT_CHECK (describe.skip + it.skipIf)
    - Rate-limit 2-3s secuencial entre llamadas al mismo host (WAF/Workers AI, LOCKED)
    - Probe HTTP cruda para capturar campo model del body Workers AI (drift detection)
    - resolverProvider reutilizado offline para re-confirmar rollback por config (INTEG-03)
key_files:
  created:
    - packages/cruces/src/shadow-eval.test.ts
    - packages/cruces/src/drift-canary.test.ts
  modified:
    - .env.example
decisions:
  - "shadow-eval corre SECUENCIAL (no paralelo) con delay 2500ms entre llamadas — rate-limit LOCKED vs Workers AI y WAF gubernamental"
  - "drift canary via probe HTTP cruda (fetch directo) para capturar campo model del body; GraniteProvider no expone el raw body post-SDK — probe directa es la vía correcta"
  - "describe OFFLINE de shadow-eval reutiliza resolverProvider (pura, ya exportada) para re-confirmar INTEG-03 sin dependencia de red ni de GraniteProvider real"
  - "El agente NO setea CLASIFICACION_ESCALERA=1 en ningún lugar; la promoción es config-flip exclusivo del operador tras shadow-eval verde sostenido"
metrics:
  duration: "~5 min"
  completed: "2026-07-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 109 Plan 03: Shadow-eval + drift canary Summary

**One-liner:** Shadow-eval Granite vs DeepSeek LIVE-gated (10 casos, delay 2.5s, skip limpio sin keys) + rollback-by-config assert OFFLINE + drift canary del modelo servido Workers AI con invalidación del veredicto full-40 en mismatch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | shadow-eval Granite vs DeepSeek (LIVE-gated) + rollback assert | c559eb5 | packages/cruces/src/shadow-eval.test.ts |
| 2 | drift canary del endpoint (LIVE-gated) + .env.example | f59ab43 | packages/cruces/src/drift-canary.test.ts, .env.example |

## What Was Built

### Task 1: shadow-eval.test.ts

**Bloque OFFLINE (4 tests, siempre verdes):** Re-confirma el rollback por config (INTEG-03) via `resolverProvider` (función pura de 109-02). Prueba los 4 invariantes: sin `CLASIFICACION_ESCALERA` → `DeepSeekProvider`; con `CLASIFICACION_ESCALERA=1` + keys dummy → `TieredProvider`; Pitfall 2 (token vacío → DeepSeek); Pitfall 2 (account vacío → DeepSeek).

**Bloque LIVE-gated (`CLASIFICACION_SHADOW_LIVE=1`):** Itera `GOLDEN_SET_GATE` (10 casos) secuencial con `delay(2500ms)` entre llamadas al mismo host (rate-limit LOCKED). Construye `DeepSeekProvider` (incumbente) y `GraniteProvider` con `baseURL` interpolado (Pitfall 1: nunca hardcodeado). Compara `sector_codigo` salida-a-salida. Acumula acuerdos/desacuerdos. `console.log` del resumen. **NO persiste en DB. NO altera el provider productivo.** Skip limpio con `it.skipIf(!WORKERS_AI_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID)`.

### Task 2: drift-canary.test.ts + .env.example

**`drift-canary.test.ts` LIVE-gated (`CLASIFICACION_DRIFT_CHECK=1`):** Constante `MODELO_PINNEADO = "@cf/ibm-granite/granite-4.0-h-micro"` y `FECHA_PINNEADA = "2026-07-27"`. Hace una probe HTTP cruda (fetch directo al endpoint `chat/completions`) con el primer caso ficha de `GOLDEN_SET_GATE` como payload mínimo. Captura `body.model` del JSON de respuesta de Workers AI. Si `modeloServido !== MODELO_PINNEADO`: falla con mensaje `[DRIFT DETECTADO] ... veredicto full-40 INVALIDADO`. Si coincide: `console.log` de provenance (modelo + endpoint + fecha) + `expect(modeloServido).toBe(MODELO_PINNEADO)`. Skip limpio sin `WORKERS_AI_API_TOKEN` o `CLOUDFLARE_ACCOUNT_ID`.

**`.env.example`:** `CLASIFICACION_SHADOW_LIVE=` y `CLASIFICACION_DRIFT_CHECK=` con comentario completo (vacío = skip; nunca en CI; requieren keys Workers AI).

## Deviations from Plan

None — plan ejecutado exactamente como especificado.

La probe del drift canary se implementó via `fetch` directo (no via `GraniteProvider`) porque el SDK de OpenAI no expone el campo `model` del raw body de la response — el SDK lo consume internamente y solo expone `choices`. La probe cruda es la vía correcta para comparar el modelo servido real vs el pinneado. Se documenta en el comentario del test cuál vía se usó y por qué.

## Verification

- `pnpm --filter @obs/cruces exec vitest run` → 42 passed, 3 skipped (LIVE-gated: 2 de shadow-eval, 1 de drift-canary)
- `pnpm --filter @obs/cruces exec tsc -b` → exit 0
- `.env.example` tiene `CLASIFICACION_SHADOW_LIVE` y `CLASIFICACION_DRIFT_CHECK` vacíos documentados
- El describe OFFLINE de shadow-eval re-confirma rollback por config (4 tests, INTEG-03)
- Ningún test nuevo corre en CI (CI no setea los flags LIVE)
- El agente NO setea `CLASIFICACION_ESCALERA=1` en ningún lugar

## Known Stubs

None — todos los mecanismos están completamente implementados. El bloque LIVE requiere keys del operador para ejecutar, que es el comportamiento esperado y correcto.

## Threat Flags

None — ninguna nueva superficie de red fuera del threat model del plan. Las pruebas LIVE-gated acceden a Workers AI (ya en el threat model T-109-08/T-109-09/T-109-10/T-109-11). No hay nuevos endpoints, auth paths, ni schema changes.

## Self-Check: PASSED

- packages/cruces/src/shadow-eval.test.ts: FOUND
- packages/cruces/src/drift-canary.test.ts: FOUND
- .env.example (CLASIFICACION_SHADOW_LIVE + CLASIFICACION_DRIFT_CHECK): FOUND
- Commits c559eb5, f59ab43: FOUND (git log)
