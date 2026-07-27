# VEREDICTO LIVE por tarea — Granite (Workers AI) vs DeepSeek + Phi juez (2026-07-27)

**Corrida:** `LLM_BENCH_LIVE=1 LLM_BENCH_LIMIT=10` sobre `candidatos.live.test.ts` — PASSED (500s).
**Muestra:** 10 casos/tarea de los golden es-CL FROZEN (mismos sets, candidato + incumbente same-run, apples-to-apples).
**Endpoints REALES:** Granite `@cf/ibm-granite/granite-4.0-h-micro` @ Workers AI (`…/accounts/{ACCOUNT_ID}/ai/v1`);
DeepSeek `deepseek-v4-flash` @ api.deepseek.com; Phi juez `microsoft/phi-4` @ OpenRouter (prompt-forced mode).

## Veredicto por tarea
| Tarea | Estado | Δcalidad (ε) | Lectura |
|-------|--------|--------------|---------|
| **routing** | ✅ **approved-model: Granite** | +0.1000 (≥ −0.03) | Granite cobertura 0.6 vs DeepSeek 0.5; fail-rates no-peor. Granite APRUEBA. |
| **clasificación** | ✅ **approved-model: Granite** | 0.0000 (≥ −0.03) | ambos cobertura 1.0 (paridad exacta); fail-rates no-peor. Granite APRUEBA. |
| **extracción** | 🔒 **incumbent-stays: DeepSeek** | −0.8000 (< −0.01) | Granite value-precision 0.2 / recall 0.36 vs DeepSeek 1.0/1.0. **DeepSeek se queda** (exactamente lo que predijo el research: 3B falla extracción strict-schema en VALORES, aunque su estructura sea válida). `negacion.accuracy`=1.0 en ambos → el es-CL veto NO se gatilló (perdió antes, en el agregado). Quality-first se sostiene. |
| **juez** | ⚠ **VOID — no es un veredicto real** | −1.0000 | Los 32 llamados a Phi fallaron con **HTTP 402 "Insufficient credits"** (OpenRouter sin saldo) → `sinVeredicto: 32`, `precision_ok: n/a`. La máquina lo computó como `incumbent-stays` (escalar de un juez que no respondió = 0), pero la lectura HONESTA es **pending-evidence, bloqueado por créditos** — NO que Phi juzgó mal. Se re-corre al cargar créditos OpenRouter. |

## Métricas separadas (headline)
| Modelo | p50 / p95 (ms) | costo/1k CASOS (USD) | structured_output_fail | zod repaired/terminal |
|--------|----------------|----------------------|------------------------|-----------------------|
| **Granite @ Workers AI** | 916 / 5410 (p95 indicativo) | **$0.0099** | 0.0000 | 0.0000 / 0.0000 |
| **DeepSeek** | 479 / 539 | **$1.0082** | 0.0000 | 0.7500 / 0.2500 |

Granite: estructura LIMPIA (0 fallos structured/zod), ~**100× más barato**, p50 ~2× más lento que DeepSeek pero p95 alto (cola). DeepSeek: rápido y estable en latencia, pero repair-rate alto en esta muestra.

## Qué autoriza esto (BENCH-05)
- **routing y clasificación: gate VERDE para Granite** — ambas son tareas reversibles, no-legales → **candidatas legítimas para la integración de MENOR RIESGO de la Fase 109.** El escalonamiento aquí es calidad-neutral (paridad demostrada) con costo ~100× menor: cumple la regla LOCKED (optimiza costo SOLO donde hay paridad).
- **extracción: se queda DeepSeek** — decisión basada en evidencia, no en fe. NO se toca.
- **juez (BENCH-04): pendiente de créditos OpenRouter** — no gatea 109 (la tarea reversible de 109 = clasificación/routing NO necesita el juez).

## Caveats HONESTOS (leer antes de flipear una integración de producción)
1. **Muestra = 10/tarea, NO los 40 congelados.** El full-40 **TIMED OUT** contra el límite hardcodeado de 600s de vitest (Granite p95 ~5s × 160 + repairs DeepSeek + juez). El 10-sample es evidencia direccional FUERTE (cruces gateaba con ~10), pero **antes de flipear una integración productiva conviene confirmar routing/clasificación sobre los 40** (subir `TIMEOUT_MS` en el test o correr por tarea/chunked). extracción ya está vetada → segura sin más.
2. **Juez VOID por créditos**, no por calidad. El BENCH-04 real requiere saldo OpenRouter (centavos) y una re-corrida.
3. **Reporte del juez degenerado:** cuando el juez no devuelve NINGÚN veredicto (todos sinVeredicto), la máquina lo marca `incumbent-stays` (escalar 0) en vez de `pending-evidence`. FOLLOW-UP pasada 2: `computarVeredicto` debe tratar un juez con 0 mediciones válidas como `pending-evidence` (no como "perdió").
4. **Sustitución de modelo juez:** se usó `microsoft/phi-4` (14B, único Phi con salida usable en OpenRouter) en modo prompt-forced+zod, NO el `phi-4-mini` (3.84B) originalmente specificado (no servido con tools en ningún host verificado). Juez más grande/capaz — aceptable para el spike; el instrumento mide su calidad real vs humano una vez con créditos.

## Estado
- Veredicto responder (routing/clasificación/extracción): **REAL y VÁLIDO** (10-sample). juez: pending-evidence (créditos).
- Artefacto de evidencia; sin secretos. Suite verde. No fabrica aprobación (extracción correctamente rechazada).
