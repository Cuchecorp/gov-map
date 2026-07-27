# @obs/llm-bench — harness de benchmark LLM por tarea

Mide CUALQUIER `LLMProvider` sobre las cuatro golden sets es-CL por tarea (routing,
clasificación de sector, juez/validación, paridad-extracción) y produce UN `Reporte`
con cada métrica SEPARADA de primera clase: calidad por tarea, latencia p50/p95,
costo/1k y las dos tasas de fallo (structured-output vs zod{repaired,terminal}).

Es el deliverable operador-corrible de **BENCH-01/BENCH-03**: el REPORTE, no un veredicto.
El veredicto por tarea (¿aprueba paridad?) es alcance de **107/BENCH-05**.

---

## 1. CI (mock, sin red) — el piso de regresión

```bash
pnpm --filter @obs/llm-bench test
```

- Corre TODO con `MockProvider` determinista: **sin red, sin key, sin cuota** (Pitfall 5).
- Las cuatro golden GATE sets actúan como **piso de regresión mock**: un mock "oro" hace
  pasar `gatePasaRouting`/`gatePasaClasif`/`gatePasaExtraccion` y el juez concuerda con el
  humano. Si un cambio rompe un scorer/gate, este comando falla en CI.
- Incluye los guards-que-muerden por tarea (∩=∅ exemplar/eval, no-RUT, freeze-hash sha256).
- El bloque LIVE (`baseline.live.test.ts`) está **SKIPPEADO por defecto** — CI nunca toca red.

Typecheck:

```bash
pnpm --filter @obs/llm-bench exec tsc -b
```

---

## 2. Baseline LIVE (DeepSeek + MiniMax reales) — env-gated, NUNCA en CI

Corre los incumbentes REALES contra los endpoints EXACTOS de producción y captura el
`Reporte` de baseline (el número contra el que 107 mide a los candidatos).

Requisitos: `DEEPSEEK_API_KEY` y `MINIMAX_API_KEY` en `.env` (ya existentes — **NO se
necesita ninguna key nueva en 106**).

```bash
# Carga las keys de .env SIN imprimirlas, y activa el gate LIVE:
set -a; source .env; set +a
LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench test baseline
```

En PowerShell (Windows):

```powershell
# Cargar .env a variables de entorno de la sesión (no imprimir las keys), luego:
$env:LLM_BENCH_LIVE = "1"
pnpm --filter @obs/llm-bench test baseline
```

- Instancia `DeepSeekProvider` (`https://api.deepseek.com`) y `MiniMaxProvider`
  (`https://api.minimax.io/v1`) con `instrumentedFetch` inyectado como `fetchFn` → mide el
  **camino real de producción** (el repair loop entero corre a través del wrapper).
- Imprime el `Reporte` como **JSON + tabla legible** en la consola. Cópialo/commitea como el
  artefacto de baseline (JSON + tabla) con su `endpoint` + `tarifaFecha` por modelo.
- El gate `it.skipIf(!DEEPSEEK_API_KEY || !MINIMAX_API_KEY)` salta el test si faltan keys —
  no falla ni inventa números.

### Cap de casos: smoke vs baseline completo

Un baseline completo son decenas de llamadas reales × 2 modelos, secuenciales con latencia
real (~1.5–3s c/u) → supera el timeout por defecto de vitest. El cap por tarea lo controla
`LLM_BENCH_LIMIT`:

| `LLM_BENCH_LIMIT` | Qué corre | Uso |
|-------------------|-----------|-----|
| (sin fijar) | 3 casos por tarea (~24 llamadas) | **smoke** rápido: confirma conectividad + provenance |
| `0` | TODAS las golden GATE sets | **baseline completo** (el artefacto que 107 mide); timeout 10 min |
| `N` | N casos por tarea | corrida acotada a medida |

```bash
# Smoke (default, rápido):
LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench test baseline

# Baseline COMPLETO (captura el artefacto):
LLM_BENCH_LIVE=1 LLM_BENCH_LIMIT=0 pnpm --filter @obs/llm-bench test baseline
```

> Un cap menor deja el `p95` aún más indicativo (menos muestras). Léelo junto a `n_muestras`.

### Artefacto de baseline capturado

Un smoke LIVE ya corrido (DeepSeek + MiniMax reales, 3 casos/tarea, 2026-07-27) está commiteado:

- [`baseline.artifact.json`](./baseline.artifact.json) — el `Reporte` completo (JSON).
- [`baseline.artifact.md`](./baseline.artifact.md) — tabla legible + lectura honesta + provenance.

Para capturar el baseline COMPLETO, corre con `LLM_BENCH_LIMIT=0` y sobrescribe el artefacto.

> Privacidad (T-106-14): el sink recibe SOLO latencia + conteos de tokens; jamás el texto del
> prompt/respuesta ni la API key. No imprimas las keys ni las URLs con credenciales.

---

## 3. Cómo leer el `Reporte`

Cada `MetricasModelo` trae, POR MODELO y etiquetado con su `endpoint`:

| Campo | Qué es | Cómo leerlo |
|-------|--------|-------------|
| `calidad_por_tarea` | métricas de las 4 tareas, cada una en su forma nativa | NUNCA colapsadas en un número; routing/clasif = cobertura+errores, extracción = parse-rate + value{precision,recall}, juez = precision_ok + recall_rechazo |
| `latencia_p50_ms` / `latencia_p95_ms` | percentiles nearest-rank de la latencia real | el **p95 es INDICATIVO con N chico** (`p95Indicativo:true`): con ~decenas de muestras es ~1 observación, no un SLA. Léelo junto a `n_muestras` |
| `n_muestras` | # de llamadas medidas | hace legible la incertidumbre del p95 |
| `costo_por_1k` | costo USD por 1000 casos | `null` si el host omite `usage` o no hay tarifa conocida — **nunca 0** (un 0 silencioso sobre-recomienda) |
| `tarifaFecha` | fecha de la tabla de tarifas aplicada | trazabilidad del costo; el costo viaja con su fecha |
| `structured_output_fail_rate` | fracción sin payload usable en el intento 0 | **campo SEPARADO** de zod y de calidad: un modelo que estructura mal el 30% del tiempo lo muestra AQUÍ, no escondido |
| `zod_fail_rate.{repaired,terminal}` | fallo zod reparado (reprompt OK) vs terminal (duro) | separados entre sí y del structured-output-fail |

**"Nada aprueba paridad" es un resultado VÁLIDO.** El `Reporte` no tiene ningún campo
"aprobado": expresa los números de cada modelo, no un veredicto. Que ningún modelo cruce
un umbral de paridad es una lectura legítima del baseline — el veredicto es 107.

---

## 4. Frontera con 107 (lo que NO vive aquí)

106 deja el harness LISTO; 107 solo enchufa candidatos por baseURL. **NO están en 106:**

- Adapters/candidatos nuevos (Granite / Phi / Workers AI / OpenRouter) — el harness es
  host-agnóstico: 107 los enchufa por `baseURL` sin tocar `harness.ts`.
- Cualquier **secret nuevo** (p.ej. `CLOUDFLARE_ACCOUNT_ID`, token de Workers AI/OpenRouter).
  106 corre SOLO con las keys existentes de DeepSeek/MiniMax.
- El **veredicto por tarea** (¿aprueba paridad?) — BENCH-05.
- El **fit de calibración** del juez (isotónica/Platt sobre el split de calibración) y el
  diagrama de confiabilidad — el slot queda vacío en 106 (`slotCurvaConfiabilidadJuez() → []`).
- La medición de los **hooks de sesgo** del juez (self-preference/verbosity/position) — 106
  los deja definidos+congelados; 107 los interpreta.
