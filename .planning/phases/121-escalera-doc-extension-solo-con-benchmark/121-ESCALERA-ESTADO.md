# 121 — ESCALERA-ESTADO: extensión solo con benchmark

**Fecha:** 2026-07-28
**Requisito:** CRON-04
**Fase:** 121-escalera-doc-extension-solo-con-benchmark

> **Regla LOCKED: ante la duda, siempre calidad.**

Este documento registra, tarea LLM por tarea LLM, el estado de extensión de la escalera
(`tiered:granite→deepseek`) y la evidencia de benchmark que lo respalda. Su propósito es que
nadie extienda la escalera por intuición ni por memoria: cada estado lleva cita a un archivo
de evidencia, y cada estado pendiente declara qué evidencia concreta lo cambiaría.

**Regla de fidelidad de este documento:** toda cifra que aparece aquí existe literalmente en el
archivo de origen citado. No hay números de memoria, ni redondeos nuevos, ni métricas derivadas.
Lo que el veredicto no midió se declara como no medido, no se estima.

---

## Fuentes de evidencia

| Fuente (ruta desde la raíz del repo) | Qué aporta | Fecha / commit |
|---|---|---|
| `.planning/milestones/v11.0-phases/107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-/107-VEREDICTO-LIVE-FULL-2026-07-27.md` | Veredicto full-40 por tarea (routing, clasificación, extracción, juez) con Δcalidad, escalares y métricas separadas | 2026-07-27, commit `be0b1b9` |
| `.planning/phases/120-escalera-on-flip-clasificacion-escalera/120-FLIP-RECORD.md` | Justificante del encendido de la escalera en clasificación: drift canary, shadow-eval LIVE, rollback probado, guards post-flip | 2026-07-28 |
| `packages/llm/src/integ-scope-guard.test.ts`, `packages/llm/src/provider-guard.test.ts`, `packages/llm/src/tiered-scope-guard.test.ts` | Congelan en tests el alcance de la escalera (qué NO alcanza) | verdes al cierre de la Phase 120 |

**Cobertura del veredicto (citada de `107-VEREDICTO-LIVE-FULL-2026-07-27.md`):** corrida
`LLM_BENCH_LIVE=1 LLM_BENCH_LIMIT=0` sobre `candidatos.live.test.ts` — **PASSED (996.5s ≈ 16.6 min)**.
Cobertura: **golden es-CL FROZEN COMPLETOS (no la muestra de 10)**. Candidato + incumbente + juez en
UNA sola corrida, apples-to-apples. El juez Phi respondió los 32 casos (0 `sinVeredicto`).

---

## Tabla maestra

| Tarea | Estado | Evidencia (cita) | Qué haría falta |
|---|---|---|---|
| routing | NO EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`): `incumbent-stays: DeepSeek`, Δcalidad **−0.1000** (< −0.03); Granite cobertura **0.5** vs DeepSeek **0.6**; FLIP vs el 10-sample (que dio **+0.10**) | Un full-40 (o mayor) con el candidato ganando en TODAS las métricas separadas y sin flip entre muestra y full |
| clasificación | EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`): `approved-model: Granite`, Δcalidad **0.0000** (≥ −0.03), ambos cobertura **1.0** (paridad exacta), fail-rates no-peor. Encendido registrado en `120-FLIP-RECORD.md` (canary PASS, `acuerdo=8/8 (100%)`, rollback probado) | Nada — ya extendida; sostener el estado exige que el drift canary siga en PASS (ver §Condición de vigencia) |
| juez | NO EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`) BENCH-04, n=32: Phi `recall_rechazo` **0.9167** vs DeepSeek-como-juez incumbente **0.75**; Δcalidad **+0.1667**; `precision_ok` **0.9500** | Benchmark de paridad juez-vs-juez con recall ≥ el actual y falsos ESCALATE no peores; mientras tanto ESCALATE-ONLY |
| extracción | NO EXTENDIDA | `107-VEREDICTO-LIVE-FULL-2026-07-27.md` (`be0b1b9`): veto es-CL por corto-circuito; `negacion.accuracy` Granite **0/3 = 0** vs DeepSeek **1/3 = 0.333**; value P/R Granite **0.098/0.182** vs DeepSeek **1.0/1.0** | Benchmark es-CL con `negacion.accuracy` ≥ el incumbente sobre set congelado + strict-schema validado por zod, manteniendo el veto es-CL como gate |
| adjudicación | INTOCABLE | No es una métrica: decisión de diseño explícita de v11.0 (SEED-001). El RUT jamás cruza a un LLM ajeno al pipeline aprobado; lo crítico/sensible se queda en MiniMax. Congelado además por `integ-scope-guard` / `provider-guard` / `tiered-scope-guard` | N/A por diseño: ninguna cantidad de benchmark la extiende; sólo una decisión de operador con dossier |

---

## Cómo leer los estados

El vocabulario es cerrado. Sólo existen tres valores:

- **EXTENDIDA** — la escalera está encendida para esa tarea, con benchmark de paridad demostrado
  sobre el set congelado completo. Hoy sólo la clasificación.
- **NO EXTENDIDA** — el incumbente se queda. Puede haber evidencia parcial o incluso favorable en
  algún eje, pero no basta para promover. **No significa "sin evaluar":** las cuatro tareas no
  extendidas fueron medidas en el full-40, y tres de ellas perdieron o quedaron cortas con
  evidencia explícita (routing por Δ negativo, extracción por veto es-CL, juez por falta de un
  benchmark de paridad para el rol de decisor).
- **INTOCABLE** — no es candidata a benchmark de extensión en absoluto. No se mide, no se compara,
  no se promueve. Sólo cambia por decisión de operador con dossier. Hoy sólo la adjudicación de
  identidad.

**Nota de vocabulario:** el veredicto full-40 usa la palabra "INTOCABLE" con otro sentido
(«el incumbente no se mueve»). En ESTE documento `INTOCABLE` está reservado a lo que no es
candidato a benchmark. La reconciliación explícita está en la sección de extracción.
