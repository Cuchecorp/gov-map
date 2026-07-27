# 107 — Operator Handoff: VEREDICTO LIVE de candidatos (PENDING-EVIDENCE)

**Fase:** 107 BENCH P1b — Adapters candidatos + juez vs humanos + VEREDICTO por tarea
**Plan:** 107-03 (autonomous:false — checkpoint de credenciales)
**Estado:** **PENDING-EVIDENCE** (resultado de milestone VÁLIDO, LOCKED — patrón v7/v9/v10)
**Fecha:** 2026-07-27

---

## TL;DR

Todo lo NO bloqueado está construido y VERDE en CI con mock. El VEREDICTO por tarea definitivo
—los NÚMEROS reales de Granite/Phi contra el incumbente DeepSeek— queda **pending-evidence**
porque las tres credenciales de CANDIDATO NO están en `.env`. El agente JAMÁS carga un valor de
secreto ni corre la red. La fase CIERRA honestamente sobre este handoff.

---

## Qué está LISTO (verde en CI, sin red)

- **Adapters candidatos (Plan 01):** `GraniteProvider` (clon MiniMax, `max_tokens` explícito,
  baseURL host-agnóstico Workers AI/OpenRouter) + `PhiJudge` (JudgeProvider separado, temp 0,
  match-por-nombre), ambos con guards fail-closed idénticos (RUT + sensibilidad). Testeados con
  fetch fake.
- **Máquina de VEREDICTO (Plan 02):** `computarVeredicto` PURA ε-gated + sub-métrica es-CL
  `negacion.accuracy` de primera clase con VETO DURO que cortocircuita el gate agregado + puente
  `medirJuezVsHumano` (PhiJudge → JuzgarFn, WR-04). Fixtures sintéticos verdes.
- **Runner LIVE (Plan 03, este):** `packages/llm-bench/src/candidatos.live.test.ts` — env-gated,
  `describe.skip` sin `LLM_BENCH_LIVE=1`, `it.skipIf` sobre TODAS las keys. **Skippea limpio sin
  keys; CI nunca lo corre, nunca toca red.** Verificado: `@obs/llm-bench` 124 passed / 3 skipped;
  `tsc -b` exit 0.

## Qué está BLOQUEADO (necesita provisión del operador)

- **Los NÚMEROS LIVE del veredicto** (candidato Granite + juez Phi + incumbente DeepSeek same-run).
  Sin las tres keys de candidato, el veredicto es `pending-evidence` — NO se fabrica ningún número.

## Verificado ausente de `.env` (2026-07-27)

| Key | Estado |
|-----|--------|
| `WORKERS_AI_API_TOKEN` | **ausente** |
| `CLOUDFLARE_ACCOUNT_ID` | **ausente** |
| `OPENROUTER_API_KEY` | **ausente** (no hay token `sk-or-…`) |
| `DEEPSEEK_API_KEY` (incumbente) | **presente** (se re-corre en el mismo bloque) |

Checkpoint de credenciales: SURFACEADO al operador el 2026-07-26 (asked once). Sin provisión.

---

## Para PROVISIONAR y CORRER el veredicto definitivo (operador)

### 1. Agregar TRES keys de candidato a `.env` (LOCAL) — NUNCA a `.env.example`

`.env.example` mantiene los placeholders VACÍOS (guard env-example verde). `DEEPSEEK_API_KEY` YA
existe: el incumbente se re-corre en el MISMO bloque (baseline PINNEADO, no artefacto suelto).

| Key | Dónde se obtiene | Uso |
|-----|------------------|-----|
| `WORKERS_AI_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens → Create Token (permiso **Workers AI**) | Candidato PRIMARIO Granite (`@cf/ibm-granite/granite-4.0-h-micro`) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → cuenta | baseURL `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1` |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys → Create Key (`sk-or-…`) | Phi-4-mini juez (`microsoft/phi-4-mini-instruct`) + fallback baseURL-swap de Granite (`ibm-granite/granite-4.0-h-micro`) |

- **Vía Workers AI (primario):** `WORKERS_AI_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
- **Vía OpenRouter (fallback de Granite + único host de Phi):** `OPENROUTER_API_KEY`.
- El juez Phi (BENCH-04) requiere `OPENROUTER_API_KEY`; sin él el bloque corre
  candidato+incumbente+veredicto y deja el juez pending-evidence.

### 2. Correr el veredicto LIVE (desde la raíz del repo)

```bash
# Carga .env SIN imprimir las keys, activa el gate LIVE:
set -a; source .env; set +a
LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench exec vitest run src/candidatos.live.test.ts
```

PowerShell (Windows) — cargar `.env` a la sesión sin imprimir, luego:

```powershell
$env:LLM_BENCH_LIVE = "1"
pnpm --filter @obs/llm-bench exec vitest run src/candidatos.live.test.ts
```

- Smoke por defecto (3 casos/tarea). Full: anteponer `LLM_BENCH_LIMIT=0` (decenas de llamadas
  reales; timeout 10 min). El MISMO cap aplica a candidato E incumbente (apples-to-apples).

### 3. Leer el artefacto impreso

- `MetricasModelo` del **candidato** Granite y del **incumbente** DeepSeek (same-run).
- `MetricasJuez` de **PhiJudge vs HUMANO** (precision_ok / recall_rechazo + hooks de sesgo).
- El **`Veredicto` por tarea**: `{routing, clasificacion, juez, extraccion} →
  approved-model | incumbent-stays | pending-evidence}`.

### 4. Interpretación (LOCKED)

- **"nada aprueba paridad" / "pending-evidence" es VÁLIDO** — no fuerces integración ni fabriques
  números. Se espera que extracción (strict-schema) NO apruebe a un 3B → se queda DeepSeek; el
  veredicto lo DEMUESTRA, no lo asume.
- **VETO DURO es-CL:** déficit de `negacion.accuracy` del candidato bajo el incumbente veta esa
  tarea sin importar el agregado. Benchmarks en inglés IRRELEVANTES.
- **Provenance (Pitfall 9):** el veredicto SOLO vale contra el endpoint SERVIDO. Ollama-local NO
  transfiere.
- **`trainsOnInputs` (gate legal):** registrar la postura no-train/DPA del host (Workers AI DPA /
  OpenRouter) como dato de provisión. Hoy fijo conservador (`false`), no env-configurable.

---

## Señal de reanudación

Escribir **"corrido"** con el veredicto impreso adjunto (o el blocker de endpoint/cuota), **o
"diferido"** para cerrar la fase sobre este handoff documentado (pending-evidence).

La adjudicación de identidad (MiniMax, golden-1263) NI SE TOCA NI SE OBSERVA (LOCKED) — ningún
veredicto de esta fase la contempla.
