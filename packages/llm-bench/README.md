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

## 2b. VEREDICTO LIVE de candidatos (Granite + Phi vs DeepSeek) — env-gated, NUNCA en CI

Este es el deliverable de **BENCH-04 + BENCH-05**: la ÚNICA corrida que produce el VEREDICTO
por tarea definitivo. Corre en `src/candidatos.live.test.ts` y está **DIFERIDA** — requiere
credenciales de CANDIDATO ausentes de `.env` (ver "Estado" abajo). Espeja el split LIVE/CI de la
sección 2 (`describe.skip` sin `LLM_BENCH_LIVE=1`; `it.skipIf` sobre TODAS las keys).

### Estado: PENDING-EVIDENCE (checkpoint de operador SURFACEADO, sin provisión)

El VEREDICTO LIVE está **pending-evidence**: las tres keys de candidato NO están en `.env`
(verificado 2026-07-27: `WORKERS_AI_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `OPENROUTER_API_KEY`
ausentes; `DEEPSEEK_API_KEY` del incumbente SÍ presente). Un veredicto "pending-evidence" es un
resultado de milestone **VÁLIDO** (107-CONTEXT §credentials, LOCKED, patrón v7/v9/v10): la máquina
de veredicto + los adapters + los tests están verdes con mock; sólo faltan los NÚMEROS LIVE, que
requieren provisión del operador. El handoff documentado está en
`.planning/phases/107-*/107-OPERATOR-HANDOFF.md`.

### Provisión (operador): las tres keys de CANDIDATO en `.env` (NUNCA en `.env.example`)

Agregar a `.env` (LOCAL). `.env.example` mantiene los placeholders VACÍOS. `DEEPSEEK_API_KEY` YA
existe (el incumbente se re-corre en el MISMO bloque, WARNING-1 baseline pinneado):

| Key | Dónde se obtiene | Para qué |
|-----|------------------|----------|
| `WORKERS_AI_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens → Create Token (permiso Workers AI) | Candidato PRIMARIO Granite en Workers AI |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → cuenta | baseURL Workers AI `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1` |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys → Create Key (`sk-or-…`) | Phi-4-mini juez (`microsoft/phi-4-mini-instruct`) + fallback baseURL-swap de Granite |

- **Vía Workers AI (primario):** requiere `WORKERS_AI_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`;
  Granite corre como `@cf/ibm-granite/granite-4.0-h-micro`.
- **Vía OpenRouter (fallback):** con `OPENROUTER_API_KEY` Granite corre como
  `ibm-granite/granite-4.0-h-micro` (baseURL-swap).
- **El juez Phi vive SOLO en OpenRouter** → su medición (BENCH-04) requiere `OPENROUTER_API_KEY`.
  Sin él, el bloque corre candidato+incumbente+veredicto pero el juez queda pending-evidence.
- El test SALTA (no falla, no inventa números) salvo que estén `DEEPSEEK_API_KEY` (incumbente)
  Y al menos una vía de candidato (Workers AI o OpenRouter).

### Comando (operador, LIVE, fuera de CI)

```bash
# Carga .env SIN imprimir las keys, activa el gate LIVE, corre SOLO el test del veredicto:
set -a; source .env; set +a
LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench exec vitest run src/candidatos.live.test.ts
```

En PowerShell (Windows) — cargar `.env` a variables de entorno de la sesión (sin imprimir), luego:

```powershell
$env:LLM_BENCH_LIVE = "1"
pnpm --filter @obs/llm-bench exec vitest run src/candidatos.live.test.ts
```

- Smoke por defecto (3 casos/tarea). `LLM_BENCH_LIMIT=0` corre las golden GATE sets COMPLETAS
  (más lento, decenas de llamadas reales). **El MISMO cap se aplica al candidato Y al incumbente**
  → comparación apples-to-apples (WARNING-1).
- Imprime, como artefacto: el `MetricasModelo` del candidato Y del incumbente same-run, las
  `MetricasJuez` de PhiJudge-vs-humano, y el `Veredicto` por tarea
  `{tarea → approved-model | incumbent-stays | pending-evidence}`. Cópialo/commitea con su
  `endpoint` + `tarifaFecha`.

### Interpretación (LOCKED)

- **"nada aprueba paridad" / "pending-evidence" es un resultado VÁLIDO** — NO fuerces una
  integración ni fabriques números. El test asierta que el veredicto fue COMPUTADO (todas las
  tareas presentes con estado válido), NUNCA que algo aprobó.
- **VETO DURO es-CL:** cualquier déficit de `negacion.accuracy` del candidato bajo el incumbente
  veta esa tarea, sin importar métricas agregadas. Los benchmarks en INGLÉS son IRRELEVANTES.
- **Provenance (Pitfall 9):** el veredicto SOLO vale contra el endpoint SERVIDO
  (Workers AI / OpenRouter). Los números Ollama-local NO transfieren.
- **`trainsOnInputs` (gate legal):** registrar la postura no-train/DPA del host servido
  (Workers AI DPA / OpenRouter) como dato de provisión — hoy fijo conservador (`false`).

> Privacidad (T-107-08): el sink recibe SOLO latencia + conteos de tokens; jamás el prompt/
> respuesta ni la API key. El test NUNCA imprime keys ni URLs con credenciales.

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
