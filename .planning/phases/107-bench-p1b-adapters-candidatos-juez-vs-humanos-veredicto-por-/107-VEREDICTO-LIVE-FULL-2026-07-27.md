# VEREDICTO LIVE DEFINITIVO — full-40 con juez real (2026-07-27)

**Corrida:** `LLM_BENCH_LIVE=1 LLM_BENCH_LIMIT=0` sobre `candidatos.live.test.ts` — **PASSED (996.5s ≈ 16.6 min)**.
**Cobertura:** golden es-CL FROZEN COMPLETOS (no la muestra de 10). Candidato + incumbente + juez en UNA sola
corrida, apples-to-apples (WARNING-1 baseline pinneado).
**Créditos:** OpenRouter con saldo → el juez Phi respondió los 32 casos (0 `sinVeredicto`; en pasada 1 fueron 32 HTTP 402).
**Endpoints REALES:** Granite `@cf/ibm-granite/granite-4.0-h-micro` @ Workers AI (`…/accounts/{ACCOUNT_ID}/ai/v1`, token
con permiso Workers AI ya corregido); DeepSeek `deepseek-v4-flash` @ api.deepseek.com; Phi juez `microsoft/phi-4`
@ OpenRouter (modo prompt-forced + zod). Sin secretos en este artefacto.

## Veredicto por tarea (DEFINITIVO — manda sobre el 10-sample)
| Tarea | Estado | Δcalidad (ε) | Escalares | Lectura |
|-------|--------|--------------|-----------|---------|
| **routing** | 🔒 **incumbent-stays: DeepSeek** | **−0.1000** (< −0.03) | Granite cobertura **0.5** vs DeepSeek **0.6** | **FLIP vs el 10-sample** (que dio +0.10). Sobre el set COMPLETO Granite queda por debajo de paridad. **routing NO se integra.** |
| **clasificación** | ✅ **approved-model: Granite** | **0.0000** (≥ −0.03) | ambos cobertura **1.0** (paridad exacta); fail-rates no-peor | Paridad exacta sostenida sobre los 40. **Única tarea aprobada para Granite → objetivo de integración 109.** |
| **extracción** | 🔒 **incumbent-stays: DeepSeek** | veto es-CL (corto-circuito) | `negacion.accuracy` Granite **0/3 = 0** vs DeepSeek **1/3 = 0.333**; value P/R Granite **0.098/0.182** vs DeepSeek **1.0/1.0** | **Veto es-CL DURO disparó directo** (ya no perdió sólo en el agregado como en el 10-sample). Granite fabrica/invierte valores legales. **DeepSeek se queda. INTOCABLE.** |
| **juez (BENCH-04)** | ✅ **approved-model** (señal = PhiJudge-vs-HUMANO) | **+0.1667** (≥ −0.05) | Phi `recall_rechazo` **0.9167** vs DeepSeek-como-juez incumbente **0.75** | Con saldo, Phi es un juez REAL y FUERTE (ver BENCH-04). Alcanza paridad+ vs el incumbente. **No gatea 109** (la tarea reversible de 109 = clasificación, no necesita juez). |

> Nota WR-01 (display): el JSON rotula `juez.modelo` como el string del candidato (`@cf/…granite…`) porque la
> máquina toma `candidato.modelo`; la MÉTRICA de esa fila es la de **PhiJudge-vs-humano** (se sobreescribe en el
> test, etiqueta `[PhiJudge vs HUMANO]`). No confundir: el juez medido es **Phi**, no Granite.

## BENCH-04 — PhiJudge vs HUMANO (juez real, n=32)
| Métrica | Valor | Lectura |
|---------|-------|---------|
| **precision_ok** | **0.9500** | P(answer correcta \| juez dice OK) = 19/20. Casi no aprueba basura. |
| **recall_rechazo** | **0.9167** | P(rechaza \| answer mala) = 11/12. **NO es sello-de-goma** — atrapa 11 de 12 malas. |
| **sinVeredicto** | **0** | Con saldo, cero fallos de juez (WR-04 no infló nada). En pasada 1 eran 32. |
| conteos ok / malas | 20 / 12 | — |
| **Sesgo self-preference** (`porProductor` OK-rate) | deepseek 6/8, minimax 5/8, granite 5/8, **phi 4/8** | **Phi NO se auto-prefiere**: juzga a su propia familia MÁS duro (OK-rate más bajo). Sin sesgo de auto-preferencia detectable. |
| Sesgo verbosity | todas las answers `corta` (<160 chars); tramo `larga` vacío | Sin señal de verbosity en este set (no hay answers largas para correlacionar). |

**Conclusión BENCH-04:** Phi-4 (14B, prompt-forced+zod) es un juez de calidad medida contra humano —
recall-de-rechazo 0.92 y sin auto-preferencia. Instrumento validado. (No habilita ninguna integración de 109;
el juez-de-identidad sigue DIFERIDO por diseño, y la adjudicación golden-1263 es INTOCABLE.)

## Métricas separadas (headline, full-40)
| Modelo | p50 / p95 (ms) | costo/1k CASOS (USD) | structured_fail | zod repaired/terminal |
|--------|----------------|----------------------|-----------------|-----------------------|
| **Granite @ Workers AI** | 1692 / 7746 | **$0.0107** | 0.0000 | 0.0000 / 0.0000 |
| **DeepSeek** | 476 / 514 | **$0.8944** | 0.0000 | **0.6000 / 0.4000** |

Granite: estructura impecable (0 fallos structured/zod), ~**84× más barato**, pero p50 ~3.5× más lento y p95 alto
(cola larga en Workers AI). DeepSeek: latencia rápida y estable, pero repair/terminal alto en esta corrida
(0.60/0.40) — igual gana calidad donde importa (extracción/routing).

## Qué autoriza esto (BENCH-05 — DEFINITIVO)
- **clasificación: gate VERDE para Granite** — paridad EXACTA (Δ 0.0000) sobre el set completo, reversible y
  no-legal. **Única tarea que 109 integra** (menor riesgo, calidad-neutral, ~84× más barata). Cumple la regla
  LOCKED: optimizar costo SOLO donde hay paridad demostrada.
- **routing: se queda DeepSeek** — el full-40 REVIRTIÓ el resultado direccional del 10-sample. **NO se integra.**
  Evidencia por encima de la muestra chica: exactamente el riesgo que el prompt anticipó ("si el full-40 tumbara
  la paridad… ese es el veredicto REAL y manda").
- **extracción: se queda DeepSeek** — veto es-CL duro. INTOCABLE.
- **juez (BENCH-04): Phi validado** como juez de calidad, pero no gatea 109. Juez-de-identidad DIFERIDO.

## Contraste con el 10-sample (pasada 1)
| Tarea | 10-sample | full-40 (DEFINITIVO) | ¿cambió? |
|-------|-----------|----------------------|----------|
| routing | approved (Granite, +0.10) | **incumbent-stays** (−0.10) | **SÍ — flip. Manda el full-40.** |
| clasificación | approved (Granite, 0.00) | approved (Granite, 0.00) | no |
| extracción | incumbent-stays (agregado) | incumbent-stays (**veto es-CL directo**) | veredicto igual, causa más dura |
| juez | VOID (32×HTTP 402) | **approved** (Phi real, recall 0.917) | **SÍ — de void a evidencia real** |

La muestra de 10 era direccional pero NO suficiente para flipear una integración: routing lo prueba. La regla
"antes de flipear producción, confirmar sobre los 40" queda VINDICADA.

## Estado
- Veredicto responder (routing/clasificación/extracción): **REAL, VÁLIDO, DEFINITIVO** (full-40, same-run).
- BENCH-04 (juez Phi vs humano): **REAL, con créditos, n=32** — recall 0.917, precision 0.95, 0 fallos, sin auto-preferencia.
- Suite verde. Sin secretos. No fabrica aprobación (routing y extracción correctamente rechazadas para Granite).
- **Insumo para 109:** integrar SOLO **clasificación** con Granite@WorkersAI (DeepSeek incumbente = fallback/escalón).
