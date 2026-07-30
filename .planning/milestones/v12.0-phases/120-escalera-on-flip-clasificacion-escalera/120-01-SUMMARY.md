---
phase: 120-escalera-on-flip-clasificacion-escalera
plan: 01
subsystem: llm-escalera
tags: [gates, workers-ai, granite, deepseek, shadow-eval, drift-canary, rollback]
requires:
  - packages/cruces/src/drift-canary.test.ts
  - packages/cruces/src/shadow-eval.test.ts
  - packages/cruces/src/clasificar-fichas-cli.ts
provides:
  - "120-FLIP-RECORD.md con Gates 1-4 resueltos y '## Veredicto de gates' legible por grep"
  - "Precondición del Plan 02 (flip): GATES 2-4 VERDES — EL FLIP PROCEDE"
affects:
  - Phase 121 (ESCALERA-DOC)
  - Phase 125 (E2E flags)
tech-stack:
  added: []
  patterns: ["gates LIVE env-gated", "cierre honesto documentado", "redacción de ACCOUNT_ID"]
key-files:
  created:
    - .planning/phases/120-escalera-on-flip-clasificacion-escalera/120-FLIP-RECORD.md
    - .planning/phases/120-escalera-on-flip-clasificacion-escalera/120-01-SUMMARY.md
  modified: []
decisions:
  - "Gate 3 se re-invocó con --testTimeout=600000 (límite del harness vitest, no del resultado); delay 2.5s LOCKED intacto, sin paralelizar"
  - "El acuerdo del shadow-eval es 8/8 sobre los casos ficha del GOLDEN_SET_GATE; los casos contraparte se saltan por diseño del test (usan MiniMax, fuera de la ruta clasificarFicha)"
metrics:
  duration: "~10 min"
  completed: 2026-07-28
requirements: [CRON-03]
---

# Phase 120 Plan 01: Gates 2-4 pre-flip de `CLASIFICACION_ESCALERA` Summary

Los tres gates del orden DURO corrieron LIVE en secuencia y dieron verde: el modelo servido por
Workers AI sigue siendo `@cf/ibm-granite/granite-4.0-h-micro` (veredicto full-40 vigente), Granite
acuerda 8/8 con DeepSeek sobre los casos ficha del `GOLDEN_SET_GATE`, y el rollback-by-config está
probado antes de necesitarlo — el flip del Plan 02 procede.

## Qué se hizo

| Gate | Resultado | Evidencia |
|------|-----------|-----------|
| 1 — Checkpoint operador (keys Workers AI) | CERRADO | autorización verbatim citada desde `120-CONTEXT.md`; no se re-preguntó en sesión |
| 2 — Drift canary LIVE | **PASS** | `1 passed`, 0 skipped; modelo servido == pinneado; probe HTTP real 3.59s |
| 3 — Shadow-eval LIVE Granite vs DeepSeek | **PASS** | `5 passed`, 0 skipped; `acuerdo=8/8 (100%)`, cero desacuerdos; 66s de llamadas reales |
| 4 — Rollback-by-config pre-flip (offline) | **PASS** | `9 passed | 1 skipped` (el skipped es el bloque LIVE, correcto offline); tres ramas de `resolverProvider` aseveradas |

`## Veredicto de gates` → **GATES 2-4 VERDES — EL FLIP PROCEDE (Plan 02)**.

## Decisiones y hallazgos

- **Falso verde evitado en Gate 2:** el test usa `describe`-gate + `it.skipIf`, así que sin env
  vars vitest reporta exit 0 con `1 skipped`. Se verificó `1 passed` y `skipped=0` explícitamente,
  más el log de provenance y los 3.59s de latencia real como prueba de que la probe HTTP ocurrió.
- **Rollback (SC#3):** revertir es quitar una línea de `.env`. Sin migración, sin deploy, sin
  redeploy de Cloudflare — la clasificación es CLI local y el provider se resuelve en runtime.
  Además la rama Pitfall 2 degrada al incumbente si las keys están vacías, en vez de fallar.
- **Cobertura real del shadow:** 8 de los 10 casos gate son comparables (los 2 de contraparte usan
  MiniMax y el test los salta por diseño). Se documentó explícitamente para no inflar la cifra.

## Deviations from Plan

**1. [Rule 3 - Blocking] Gate 3 requería timeout explícito de vitest**

- **Found during:** Task 2
- **Issue:** el comando verbatim del plan falló con `Test timed out in 5000ms` — el default de
  vitest es 5s y el bloque LIVE necesita ~66s (8 casos × 2 llamadas × delay 2.5s LOCKED).
- **Fix:** re-invocación del mismo comando con `--testTimeout=600000`. No se tocó código, no se
  redujo el delay, no se paralelizó, no hubo reintentos en ráfaga. El plan lo anticipa
  ("dar timeout holgado a la invocación").
- **Files modified:** ninguno (solo la invocación); documentado en la sección Gate 3 del registro.
- **Commit:** 408dfc6

## Secretos

Cero valores de secreto en el registro. Los comandos LIVE consumieron `.env` vía
`set -a; source .env; set +a`; el `CLOUDFLARE_ACCOUNT_ID` viene ya redactado (`***`) por el propio
test. Gate anti-secreto por regex == 0 tras cada task.

## Known Stubs

Ninguno.

## Self-Check: PASSED

- `.planning/phases/120-escalera-on-flip-clasificacion-escalera/120-FLIP-RECORD.md` — FOUND
- Commits 3f66ac9, 408dfc6, 5476dfe — FOUND
