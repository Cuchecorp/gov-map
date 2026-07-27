# Baseline LIVE — artefacto (106-04)

Corrida LIVE REAL de los incumbentes DeepSeek + MiniMax contra sus endpoints EXACTOS de
producción, vía el harness `@obs/llm-bench` con `instrumentedFetch` (mide el camino real).

- **Tipo:** SMOKE (`LLM_BENCH_LIMIT` default = 3 casos por tarea, 4 tareas por modelo).
- **Fecha de corrida:** 2026-07-27 (UTC).
- **Tarifa aplicada:** `2026-07-26` (`PRICING.fecha`, `[ASSUMED]` MEDIUM — re-verify en 107).
- **JSON completo:** [`baseline.artifact.json`](./baseline.artifact.json).
- **Reproducir el baseline COMPLETO:** `LLM_BENCH_LIVE=1 LLM_BENCH_LIMIT=0 pnpm --filter @obs/llm-bench test baseline`.

> Este artefacto es el smoke que confirma que el harness corre contra los endpoints reales con
> provenance correcta. Es el número contra el que 107 mide a los candidatos (Granite/Phi). El
> `p95` es INDICATIVO (N chico: 3 casos/tarea) — NO un SLA. Léelo junto a `n_muestras`.

## Métricas por modelo (SEPARADAS — nada colapsado en un número)

| Modelo | Endpoint | n | p50 (ms) | p95 (ms) | costo/1k (USD) | structured_output_fail | zod repaired/term | tareas |
|--------|----------|---|----------|----------|----------------|------------------------|-------------------|--------|
| deepseek-v4-flash | https://api.deepseek.com | 24 | ~478 | ~543 (indicativo) | ~0.453 | 0.25 | 0 / 0 | routing, clasificacion, extraccion, juez |
| MiniMax-M3 | https://api.minimax.io/v1 | 12 | ~5739 | ~22556 (indicativo) | ~0.501 | 0.00 | 0 / 0 | routing, clasificacion, extraccion, juez |

Lectura honesta (NO es un veredicto — eso es 107/BENCH-05):

- **DeepSeek** es mucho más rápido (p50 ~0.5s) y algo más barato en este smoke, pero muestra un
  `structured_output_fail_rate` de 0.25 sobre estas 24 llamadas (json_object sin schema estricto
  → algunos payloads no parsearon en el intento 0). Ese fallo se muestra en SU campo separado,
  no escondido en calidad.
- **MiniMax** (tool-calling forzado) no falló estructura (0.00) pero es ~10× más lento (p50 ~5.7s,
  p95 ~22.5s) en este smoke.
- Ambos con `zod_fail_rate` 0/0 en la muestra. La calidad por tarea (cobertura/parse-rate/
  precision-recall/precision_ok-recall_rechazo) está en el JSON, tarea por tarea.

"Nada aprueba paridad" seguiría siendo un resultado válido: el baseline REPORTA, no dictamina.
