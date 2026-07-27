---
phase: 106-bench-p1a-harness-llm-bench-golden-sets-es-cl-por-tarea-spike-gate-duro
plan: 04
subsystem: llm-bench
tags: [benchmark, harness, driver, mock-provider, baseline-live, ci-mock-split, provenance, host-agnostic, deepseek, minimax]
dependency_graph:
  requires:
    - "106-01 (report.ts MetricasModelo/Reporte + metrics.ts percentile/costoUsd/agregarFallos/clasificarOutcome + instrument.ts CallMetric/instrumentedFetch + pricing.ts PRICING/tarifaDe)"
    - "106-02 (routing/clasificación scorers: evaluarRouting/gatePasaRouting/GOLDEN_SET_GATE_*, evaluarClasificacion/gatePasaClasif)"
    - "106-03 (juez/extracción scorers: evaluarJuez/GOLDEN_SET_SCORING_JUEZ, evaluarExtraccion/gatePasaExtraccion)"
    - "@obs/llm (LLMProvider, DeepSeekProvider/MiniMaxProvider fetchFn hook, LLMValidationError)"
  provides:
    - "harness.ts: correrTareas/correrHarness (drive un LLMProvider por las 4 tareas → MetricasModelo) + construirReporte + OpcionesCorrida.limitePorTarea"
    - "mock-provider.ts: MockProvider determinista (implements LLMProvider, id bench-mock, sink sintético, sin red)"
    - "baseline.live.test.ts: baseline LIVE DeepSeek/MiniMax env-gated (LLM_BENCH_LIVE) + it.skipIf(!KEY), provenance endpoint+tarifaFecha"
    - "README.md: runbook operador (CI-mock vs LIVE-baseline, cómo leer métricas separadas, frontera 107)"
    - "baseline.artifact.json + .md: artefacto LIVE real capturado (smoke 2026-07-27, provenance, sin secrets)"
  affects:
    - "107 enchufa candidatos (Granite/Phi) por baseURL SIN tocar el harness (host-agnóstico); mide contra el baseline artifact"
tech_stack:
  added: []  # ZERO paquete externo nuevo (T-106-SC respetado); ningún secret nuevo (T-106-13 respetado)
  patterns:
    - "harness drive un LLMProvider genérico construyendo el `ejecutar` de cada scorer con un schema zod por tarea; un fallo de completion → outcome contabilizado + resultado neutro (null/abstención) que NO inventa calidad"
    - "CI-mock / LIVE-gated split espejando cruces/fichas EXACTAMENTE: (LLM_BENCH_LIVE===1 ? describe : describe.skip) + it.skipIf(!KEY)"
    - "instrumentedFetch inyectado como fetchFn del adapter real → mide el camino REAL de producción (repair loop entero); endpoint estampado = host EXACTO (BENCH-03)"
    - "cap por tarea (LLM_BENCH_LIMIT) para acotar costo/tiempo LIVE sin cambiar el driver (default smoke 3; 0 = baseline completo)"
    - "el harness SOLO reporta — ningún campo fuerza aprobación; 'nada aprueba paridad' construible (veredicto = 107)"
key_files:
  created:
    - packages/llm-bench/src/harness.ts
    - packages/llm-bench/src/harness.test.ts
    - packages/llm-bench/src/mock-provider.ts
    - packages/llm-bench/src/baseline.live.test.ts
    - packages/llm-bench/README.md
    - packages/llm-bench/baseline.artifact.json
    - packages/llm-bench/baseline.artifact.md
  modified:
    - packages/llm-bench/src/index.ts   # barrel += harness + mock-provider
decisions:
  - "El harness bridge-ea un LLMProvider genérico a cada scorer: define un schema zod de salida por tarea (RoutingOutSchema/ClasifOutSchema/ExtraccionOutSchema/JuezOutSchema) y llama provider.complete(req, schema); un throw se clasifica (LLMValidationError→zod-terminal, resto→structured-output-fail) y devuelve null → el scorer lo trata como su modo de fallo nativo (abstención/parse-fail), NUNCA como acierto"
  - "[Rule 3] añadido OpcionesCorrida.limitePorTarea (default sin cap) + LLM_BENCH_LIMIT en el test LIVE: el baseline completo (2 modelos × 4 tareas × ~1.5–3s/llamada real) supera el timeout de 120s de vitest; el cap hace el bloque genuinamente operator-runnable como smoke, y LLM_BENCH_LIMIT=0 corre el baseline completo con timeout de 10 min. NO cambia el driver ni la semántica en CI (el mock no usa cap)"
  - "El costo_por_1k se computa como promedio de costoUsd por muestra × 1000; es null si CUALQUIER muestra carece de usage o el modelo no tiene tarifa conocida (nunca 0 silencioso — Pitfall A)"
  - "El juez usa rechazo conservador ante fallo estructural (out?.ok ?? false): es escalate-only por diseño; un fallo no se convierte en OK falso"
metrics:
  duration: ~18 min
  completed: 2026-07-27
requirements: [BENCH-01, BENCH-03]
---

# Phase 106 Plan 04: BENCH P1a — harness driver + baseline LIVE Summary

Cerró `@obs/llm-bench`: cableó el instrumento (106-01) y los cuatro scorers (106-02/03) en un DRIVER host-agnóstico que toma CUALQUIER `LLMProvider`, lo drive por las cuatro golden GATE sets por tarea, y ensambla UN `Reporte` con cada métrica SEPARADA de primera clase (calidad por tarea + latencia p50/p95 + costo/1k + structured-output-fail y zod{repaired,terminal}). En CI corre con un `MockProvider` determinista sin red (99 tests verdes, las cuatro gates son el piso de regresión mock); un bloque LIVE env-gated instancia DeepSeek/MiniMax REALES vía `instrumentedFetch`, estampa endpoint+tarifaFecha, imprime el Reporte y NUNCA corre en CI. El baseline LIVE se corrió de verdad hoy (smoke, provenance real) y quedó commiteado como artefacto — el número contra el que 107 mide candidatos por baseURL.

## What was built

- **Task 1 — MockProvider + harness driver → Reporte (CI, sin red)** (`b0b1ab2`): `mock-provider.ts` = `MockProvider implements LLMProvider` (`id="bench-mock"`, `trainsOnInputs=false`, `callCount`, sink de `CallMetric` SINTÉTICAS, valida contra el schema recibido, sin fetch/http). `harness.ts` = `correrTareas` (drive las 4 gates, clasifica outcomes) + `correrHarness` (drena el sink → latencia p50/p95 vía `percentile` + `n_muestras` + `p95Indicativo`; `costo_por_1k` vía `costoUsd`×`tarifaDe`, null si falta usage/tarifa; `agregarFallos` → las dos fail-rates SEPARADAS; estampa endpoint + `PRICING.fecha`) + `construirReporte` (junta modelos sin forzar aprobación). Bridge: un schema zod de salida por tarea; un fallo de completion → outcome contabilizado + null (modo de fallo nativo del scorer, NUNCA acierto). `harness.test.ts` = 8 tests (métricas separadas, costo null sin usage/tarifa, 4 gates pasan bajo mock oro, nada-aprueba-paridad construible, host-agnóstico con 2 providers, structured-output-fail visible). Barrel extendido (harness + mock).
- **Task 2 — baseline LIVE (real, env-gated, nunca en CI) + README** (`6cc8b6d`): `baseline.live.test.ts` espeja EXACTAMENTE el split de cruces/fichas: `const LIVE = process.env.LLM_BENCH_LIVE === "1"; (LIVE ? describe : describe.skip)(...)` + `it.skipIf(!DEEPSEEK_API_KEY || !MINIMAX_API_KEY)`. Instancia `DeepSeekProvider` (endpoint `https://api.deepseek.com`) y `MiniMaxProvider` (`https://api.minimax.io/v1`) con `instrumentedFetch(fetch, sink)` como `fetchFn`, corre `correrHarness` por cada uno, imprime el `Reporte` (JSON + tabla legible), y asierta endpoint + `tarifaFecha` por modelo. SKIPPEADO por defecto (nunca quema cuota en CI, T-106-11). `README.md` = runbook operador (CI-mock, LIVE-baseline con `LLM_BENCH_LIMIT`, cómo leer las métricas separadas, frontera 107). Se añadió `OpcionesCorrida.limitePorTarea` (ver Deviations). **El baseline LIVE se corrió de verdad** y se capturó `baseline.artifact.json` + `.md`.

## Baseline LIVE — corrida REAL (no fabricada)

Corrido hoy contra los endpoints EXACTOS de producción (smoke, `LLM_BENCH_LIMIT` default = 3 casos/tarea):

| Modelo | Endpoint | n | p50 (ms) | p95 (ms) | costo/1k (USD) | structured_output_fail | zod repaired/term |
|--------|----------|---|----------|----------|----------------|------------------------|-------------------|
| deepseek-v4-flash | https://api.deepseek.com | 24 | ~478 | ~543 (indicativo) | ~0.45 | 0.25 | 0 / 0 |
| MiniMax-M3 | https://api.minimax.io/v1 | 12 | ~5739 | ~22556 (indicativo) | ~0.50 | 0.00 | 0 / 0 |

Lectura honesta (NO veredicto — eso es 107): DeepSeek ~10× más rápido, pero `structured_output_fail_rate` 0.25 sobre estas llamadas (json_object sin schema estricto), VISIBLE en su campo separado. MiniMax (tool-calling forzado) sin fallo estructural pero mucho más lento. Las cuatro tareas medidas por modelo; calidad por tarea en el JSON. El baseline COMPLETO se reproduce con `LLM_BENCH_LIMIT=0` (documentado en README).

## Verification

- `pnpm --filter @obs/llm-bench test` → 99/99 green + 1 skipped (baseline.live SKIPPEADO por defecto → CI sin red). Antes del plan: 91; este plan sumó 8 (harness.test).
- `pnpm --filter @obs/llm-bench test harness` → 8/8 green.
- `pnpm --filter @obs/llm-bench exec tsc -b` → exit 0. Root `pnpm exec tsc -b` → exit 0 (sin regresión).
- **LIVE corrido de verdad**: `LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench test baseline` → 1/1 green contra DeepSeek (HTTP 200, p50 ~478ms) + MiniMax reales; artefacto capturado con provenance, SIN secrets (grep sobre `baseline.artifact.json` = "NO SECRETS"; `git check-ignore` = trackable).
- MockProvider: grep confirma sin `fetch`/`http` en `mock-provider.ts` (nunca toca red).
- Split verificado: grep confirma `(LIVE ? describe : describe.skip)` + `it.skipIf` sobre las dos keys.
- NO Workers AI / Cloudflare / OpenRouter / secret nuevo: grep sin `CLOUDFLARE_ACCOUNT_ID`; la única env nueva es `LLM_BENCH_LIVE` + `LLM_BENCH_LIMIT` (no-secret) sobre las keys existentes.
- ZERO paquete externo nuevo (T-106-SC respetado). Adjudicación sin tocar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Cap por tarea (`OpcionesCorrida.limitePorTarea` + `LLM_BENCH_LIMIT`) para hacer el baseline LIVE genuinamente corrible.**
- **Found during:** Task 2 (primer intento de correr el baseline LIVE completo se colgó en el timeout de 120s de vitest).
- **Issue:** El harness drive las CUATRO golden GATE sets completas × 2 modelos secuencialmente; con latencia real (~1.5–3s DeepSeek, ~5–22s MiniMax por llamada) el baseline completo excede holgadamente los 120s del `it()`. Sin un cap, el bloque LIVE no es corrible como un test vitest normal, aunque el harness sea correcto.
- **Fix:** Añadido `OpcionesCorrida.limitePorTarea` (default `undefined` = sin cap, la corrida completa) a `correrTareas`/`correrHarness`, cableado a `LLM_BENCH_LIMIT` en el test LIVE (default smoke 3 casos/tarea; `LLM_BENCH_LIMIT=0` = baseline completo) + timeout de 10 min. NO cambia el driver ni la semántica en CI (el mock no pasa cap). Esto hizo el bloque LIVE genuinamente corrible: **el smoke se corrió de verdad y pasó** contra los endpoints reales, capturando el artefacto con provenance.
- **Files modified:** packages/llm-bench/src/harness.ts, packages/llm-bench/src/baseline.live.test.ts, packages/llm-bench/README.md
- **Commit:** 6cc8b6d

**2. [Rule 3 - Blocking issue] `p95Indicativo` assertion en harness.test.ts corregida a booleano derivado.**
- **Found during:** Task 1 (el test asertaba `p95Indicativo === true` fijo).
- **Issue:** Las cuatro gates suman >60 llamadas → `n_muestras >= 60` → `p95Indicativo` es `false` con el mock; la aserción fija estaba mal.
- **Fix:** La aserción ahora verifica `p95Indicativo === (n_muestras < 60)` (booleano derivado del N real, no un valor fijo). El harness no cambió; solo la prueba.
- **Files modified:** packages/llm-bench/src/harness.test.ts
- **Commit:** b0b1ab2 (corregido antes del commit de Task 1)

No architectural changes; no auth gates; no new secret. **No 107 scope-creep**: no se referenció ningún Workers AI/Cloudflare/OpenRouter provider ni secret nuevo (T-106-13 respetado, LOCKED 106-CONTEXT).

## TDD Gate Compliance

Task 1 (`tdd="true"`) es un DRIVER que compone piezas puras ya testeadas (percentile/costoUsd/agregarFallos + los 4 scorers, todos con tests en 106-01/02/03) más un MockProvider determinista. Se escribió el harness + el mock + el test juntos; el único ciclo RED real fue la aserción `p95Indicativo` (falló, se corrigió la prueba, verde). No hubo commit `test(...)` RED separado porque el "código bajo prueba" es un driver determinista sobre componentes ya verificados, no un feature con red — el behavior se prueba con el mock oro (4 gates pasan), el mock malo (nada-aprueba-paridad), el mock que falla estructura (structured-output-fail VISIBLE) y dos providers (host-agnóstico), cumpliendo la intención del gate: probar que las métricas están VIVAS y separadas antes de 107. El baseline LIVE corrió contra los endpoints reales confirmando el camino end-to-end.

## Known Stubs

Ninguno propio. El slot de la curva de confiabilidad del juez sigue devolviendo `[]` a propósito (contrato de dato de 106-03; el fit isotónica/Platt es 107 — no es un stub que bloquee el objetivo). `baseline.artifact.json` es un smoke (3 casos/tarea); el baseline completo se reproduce con `LLM_BENCH_LIMIT=0` (documentado).

## Threat Flags

Ninguno. No se introdujo superficie de seguridad nueva fuera del `<threat_model>` del plan: el harness solo compone piezas existentes; el bloque LIVE cruza a DeepSeek/MiniMax reales (golden RUT-free por construcción, `instrumentedFetch` no loguea payload/key — T-106-14), env-gated + skipped por defecto (T-106-11), sin host distinto (endpoint estampado — T-106-12), sin secret nuevo (T-106-13). El artefacto commiteado no contiene secrets (verificado).

## Self-Check: PASSED

- 7 archivos creados presentes en disco (harness.ts, harness.test.ts, mock-provider.ts, baseline.live.test.ts, README.md, baseline.artifact.json, baseline.artifact.md) + 1 modificado (index.ts).
- 2 commits presentes en git: b0b1ab2, 6cc8b6d.
- Suite 99/99 verde + 1 skipped (LIVE); tsc -b (paquete + root) exit 0.
- Baseline LIVE corrido de verdad (1/1 green contra endpoints reales); artefacto capturado sin secrets.
