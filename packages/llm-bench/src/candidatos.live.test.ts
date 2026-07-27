/**
 * VEREDICTO LIVE de CANDIDATOS (107-03, BENCH-04 + BENCH-05) — env-gated, NUNCA en CI.
 *
 * Espeja EXACTAMENTE el split CI-mock / LIVE-gated de `baseline.live.test.ts`:
 *   const LIVE = process.env.LLM_BENCH_LIVE === "1";
 *   (LIVE ? describe : describe.skip)(...)  +  it.skipIf(!TODAS_LAS_KEYS)
 * Por defecto (sin LLM_BENCH_LIVE=1 y/o sin las keys) el bloque está SKIPPEADO → la corrida de
 * CI NUNCA toca red, NUNCA quema cuota (T-107-09).
 *
 * Cuando el operador provisiona las tres keys de CANDIDATO (WORKERS_AI_API_TOKEN +
 * CLOUDFLARE_ACCOUNT_ID para Granite en Workers AI, O bien OPENROUTER_API_KEY para el fallback de
 * Granite y para Phi) y activa LLM_BENCH_LIVE=1, este ÚNICO test:
 *   (a) instancia el `GraniteProvider` REAL — Workers AI OpenAI-compat primario
 *       (`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1`, modelo
 *       `@cf/ibm-granite/granite-4.0-h-micro`) o el fallback OpenRouter
 *       (`https://openrouter.ai/api/v1`, modelo `ibm-granite/granite-4.0-h-micro`) según qué key
 *       exista — con `instrumentedFetch` inyectado, y corre `correrHarness` → MetricasModelo del
 *       CANDIDATO;
 *   (b) RE-CORRE EL INCUMBENTE EN EL MISMO BLOQUE (WARNING-1: baseline PINNEADO, no artefacto
 *       suelto): instancia el `DeepSeekProvider` REAL (`https://api.deepseek.com`,
 *       `DEEPSEEK_API_KEY`) con `instrumentedFetch` y el MISMO `limitePorTarea` → candidato e
 *       incumbente se miden contra los MISMOS sets congelados en UNA sola corrida, manzana-con-
 *       manzana;
 *   (c) instancia el `PhiJudge` REAL (OpenRouter, `microsoft/phi-4`, `structuredMode: "prompt"`,
 *       `OPENROUTER_API_KEY`) con `instrumentedFetch` y llama `medirJuezVsHumano(phiJudge)` →
 *       MetricasJuez del juez Phi contra las etiquetas HUMANAS (BENCH-04). Se usa el modo
 *       PROMPT-FORZADO + zod porque OpenRouter `microsoft/phi-4` NO soporta forced tool_choice
 *       (devuelve HTTP 404 "no endpoints support tool use"); la compuerta zod es la autoridad;
 *   (d) computa el VEREDICTO DEFINITIVO por tarea con `computarVeredicto(candidato, incumbente)`
 *       contra el incumbente DE LA MISMA CORRIDA e imprime {tarea → approved-model |
 *       incumbent-stays | pending-evidence} (JSON + tabla legible).
 *
 * ASERCIONES (LOCKED): SOLO provenance (endpoint https + tarifaFecha) y que el VEREDICTO fue
 * COMPUTADO (cada TaskId presente con un estado válido). JAMÁS se asierta que algo APRUEBE — un
 * "nada aprueba / pending-evidence" es un resultado VÁLIDO y NO-fallido (107-CONTEXT §decisions).
 *
 * VETO es-CL (recordatorio, lo aplica la máquina de veredicto): cualquier déficit de
 * `negacion.accuracy` del candidato vs el incumbente veta extracción sin importar el agregado; los
 * benchmarks en inglés son IRRELEVANTES.
 *
 * PROVENANCE (Pitfall 9): el veredicto SOLO vale contra el endpoint SERVIDO (Workers AI /
 * OpenRouter). Números Ollama-local NO transfieren.
 *
 * PRIVACIDAD (T-107-08): `instrumentedFetch` entrega al sink SOLO latencia + conteos de tokens;
 * jamás el texto del prompt/respuesta ni la API key. Este archivo NUNCA imprime keys ni las URLs
 * con credenciales.
 */
import { describe, it, expect } from "vitest";
import { DeepSeekProvider, GraniteProvider, PhiJudge } from "@obs/llm";

import { instrumentedFetch, type CallMetric } from "./instrument";
import { correrHarness, type IdentidadModelo } from "./harness";
import type { MetricasModelo, TaskId } from "./report";
import { computarVeredicto, type EstadoTarea } from "./veredicto";
import { medirJuezVsHumano } from "./tasks/juez/juez-vs-humano";
import type { MetricasJuez } from "./tasks/juez/scorer";

// ── Endpoints REALES (provenance; deben coincidir con los adapters instanciados) ──
const ENDPOINT_WORKERS_AI = (accountId: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
const ENDPOINT_OPENROUTER = "https://openrouter.ai/api/v1";
const ENDPOINT_DEEPSEEK = "https://api.deepseek.com";

// ── Ids de modelo (claves de tarifa en PRICING) ──
const MODELO_GRANITE_WORKERS_AI = "@cf/ibm-granite/granite-4.0-h-micro";
const MODELO_GRANITE_OPENROUTER = "ibm-granite/granite-4.0-h-micro";
const MODELO_DEEPSEEK = "deepseek-v4-flash";
// Juez Phi en OpenRouter. `microsoft/phi-4` NO soporta forced tool_choice (HTTP 404
// "no endpoints support tool use") → se instancia con structuredMode "prompt".
const MODELO_PHI_JUEZ = "microsoft/phi-4";

/** Estados válidos del veredicto (para aserción de que fue COMPUTADO, no de que aprobó). */
const ESTADOS_VALIDOS: readonly EstadoTarea[] = [
  "approved-model",
  "incumbent-stays",
  "pending-evidence",
] as const;

/** Todas las tareas que el veredicto DEBE cubrir. */
const TAREAS: readonly TaskId[] = ["routing", "clasificacion", "juez", "extraccion"] as const;

/** Tabla legible de un MetricasModelo (artefacto para el operador). */
function tablaLegible(m: MetricasModelo): string {
  const fmt = (x: number | null): string => (x === null ? "n/a" : x.toFixed(4));
  return [
    `── ${m.modelo} @ ${m.endpoint} (tarifa ${m.tarifaFecha}) ──`,
    `  n_casos / n_muestras:         ${m.n_casos} / ${m.n_muestras}`,
    `  latencia p50 / p95 (ms):      ${fmt(m.latencia_p50_ms)} / ${fmt(m.latencia_p95_ms)}${m.p95Indicativo ? " (p95 INDICATIVO, N chico)" : ""}`,
    `  costo por 1k CASOS (USD):     ${fmt(m.costo_por_1k)} (headline, comparable)`,
    `  costo por 1k llamadas (USD):  ${fmt(m.costo_por_1k_llamadas)} (round-trips; no comparable)`,
    `  structured_output_fail_rate:  ${fmt(m.structured_output_fail_rate)}`,
    `  zod_fail_rate repaired/term.: ${fmt(m.zod_fail_rate.repaired)} / ${fmt(m.zod_fail_rate.terminal)}`,
    `  tareas medidas:               ${Object.keys(m.calidad_por_tarea).join(", ")}`,
  ].join("\n");
}

/** Tabla legible de las métricas del juez Phi vs humano (BENCH-04). */
function tablaJuez(j: MetricasJuez): string {
  const fmt = (x: number | null): string => (x === null ? "n/a" : x.toFixed(4));
  return [
    `── PhiJudge vs HUMANO (n=${j.n}) ──`,
    `  precision_ok:                 ${fmt(j.precision_ok)}`,
    `  recall_rechazo:               ${fmt(j.recall_rechazo)}  (el eje que expone el sello-de-goma)`,
    `  sinVeredicto (fallos juez):   ${j.conteos.sinVeredicto}  (WR-04: no infla recall)`,
    `  conteos ok / malas:           ${j.conteos.ok} / ${j.conteos.malas}`,
  ].join("\n");
}

const LIVE = process.env.LLM_BENCH_LIVE === "1";

/**
 * Cap de casos por tarea. Default: 3 (smoke). `LLM_BENCH_LIMIT=0` corre las golden GATE sets
 * COMPLETAS (más lento, decenas de llamadas reales). El MISMO cap se aplica al candidato Y al
 * incumbente para que la comparación quede apples-to-apples (WARNING-1).
 */
const LIMITE_RAW = process.env.LLM_BENCH_LIMIT;
const LIMITE_POR_TAREA =
  LIMITE_RAW === undefined ? 3 : LIMITE_RAW === "0" ? undefined : Number(LIMITE_RAW);

// Presupuesto generoso: candidato + incumbente + juez, todos secuenciales con latencia real,
// superan los 2 min por defecto de vitest cuando LLM_BENCH_LIMIT=0.
const TIMEOUT_MS = 600_000;

// El incumbente DEBE estar disponible cuando el candidato corre (WARNING-1: baseline pinneado en
// la MISMA corrida). Y debe existir AL MENOS una vía de candidato: Workers AI (token + account id)
// O bien OpenRouter (para el fallback de Granite y para Phi).
const TIENE_INCUMBENTE = !!process.env.DEEPSEEK_API_KEY;
const TIENE_WORKERS_AI =
  !!process.env.WORKERS_AI_API_TOKEN && !!process.env.CLOUDFLARE_ACCOUNT_ID;
const TIENE_OPENROUTER = !!process.env.OPENROUTER_API_KEY;
const TIENE_CANDIDATO = TIENE_WORKERS_AI || TIENE_OPENROUTER;
// El juez Phi vive SOLO en OpenRouter → su medición requiere OPENROUTER_API_KEY.
const TIENE_JUEZ = TIENE_OPENROUTER;

// Skip salvo que TODO lo necesario para candidato + incumbente esté presente (el incumbente
// SIEMPRE disponible cuando el candidato dispara: no hay camino de incumbente sin especificar).
const DEBE_SALTAR = !TIENE_INCUMBENTE || !TIENE_CANDIDATO;

(LIVE ? describe : describe.skip)(
  "veredicto LIVE de candidatos — Granite + Phi vs DeepSeek incumbente (LLM_BENCH_LIVE=1)",
  () => {
    it.skipIf(DEBE_SALTAR)(
      "corre candidato + incumbente same-run + juez-vs-humano y COMPUTA el veredicto por tarea",
      async () => {
        // ── (a) CANDIDATO Granite: Workers AI primario, OpenRouter fallback (baseURL-swap) ──
        let candidato: MetricasModelo;
        {
          const muestras: CallMetric[] = [];
          const fetchFn = instrumentedFetch(fetch, (m) => muestras.push(m));

          let granite: GraniteProvider;
          let identidadCand: IdentidadModelo;
          if (TIENE_WORKERS_AI) {
            const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
            const baseURL = ENDPOINT_WORKERS_AI(accountId);
            granite = new GraniteProvider({
              apiKey: process.env.WORKERS_AI_API_TOKEN!,
              baseURL,
              model: MODELO_GRANITE_WORKERS_AI,
              fetchFn,
            });
            identidadCand = { modelo: MODELO_GRANITE_WORKERS_AI, endpoint: baseURL };
          } else {
            // Fallback OpenRouter (baseURL-swap) cuando Workers AI no está provisto.
            granite = new GraniteProvider({
              apiKey: process.env.OPENROUTER_API_KEY!,
              baseURL: ENDPOINT_OPENROUTER,
              model: MODELO_GRANITE_OPENROUTER,
              fetchFn,
            });
            identidadCand = { modelo: MODELO_GRANITE_OPENROUTER, endpoint: ENDPOINT_OPENROUTER };
          }

          candidato = await correrHarness(granite, identidadCand, {
            drenarMetricas: () => muestras.slice(),
            limitePorTarea: LIMITE_POR_TAREA,
          });
        }

        // ── (b) INCUMBENTE DeepSeek RE-CORRIDO EN EL MISMO BLOQUE (baseline pinneado) ──
        let incumbente: MetricasModelo;
        {
          const muestras: CallMetric[] = [];
          const fetchFn = instrumentedFetch(fetch, (m) => muestras.push(m));
          const deepseek = new DeepSeekProvider({
            apiKey: process.env.DEEPSEEK_API_KEY!,
            fetchFn,
          });
          const identidadInc: IdentidadModelo = {
            modelo: MODELO_DEEPSEEK,
            endpoint: ENDPOINT_DEEPSEEK,
          };
          incumbente = await correrHarness(deepseek, identidadInc, {
            drenarMetricas: () => muestras.slice(),
            // MISMO cap → mismos sets congelados → comparación apples-to-apples (WARNING-1).
            limitePorTarea: LIMITE_POR_TAREA,
          });
        }

        // ── (c) JUEZ Phi vs HUMANO (BENCH-04) — solo si hay OpenRouter (Phi vive ahí) ──
        let metricasJuez: MetricasJuez | undefined;
        if (TIENE_JUEZ) {
          const muestras: CallMetric[] = [];
          const fetchFn = instrumentedFetch(fetch, (m) => muestras.push(m));
          const phiJudge = new PhiJudge({
            apiKey: process.env.OPENROUTER_API_KEY!,
            baseURL: ENDPOINT_OPENROUTER,
            model: MODELO_PHI_JUEZ,
            // PROMPT-FORZADO + zod: `microsoft/phi-4` no soporta forced tool_choice en
            // OpenRouter (HTTP 404 "no endpoints support tool use").
            structuredMode: "prompt",
            fetchFn,
          });
          metricasJuez = await medirJuezVsHumano(phiJudge);
        }

        // ── (d) VEREDICTO DEFINITIVO por tarea contra el incumbente DE LA MISMA CORRIDA ──
        // WR-01: la señal AUTORITATIVA del juez es la medición PhiJudge-vs-HUMANO (BENCH-04),
        // NO el `juez` que el harness computa corriendo al RESPONDER (Granite) como juez-por-
        // completion. Antes, el veredicto leía ese `juez` del responder → un operador
        // atribuiría (mal) el estado `juez` a Phi. Aquí se SOBREESCRIBE la tarea `juez` del
        // candidato con `metricasJuez` (Phi real). Si Phi NO se midió (sin OPENROUTER_API_KEY),
        // se ELIMINA la entrada `juez` del responder → la máquina emite pending-evidence para
        // el juez (nunca un número mal atribuido).
        const candidatoParaVeredicto: MetricasModelo = {
          ...candidato,
          calidad_por_tarea: { ...candidato.calidad_por_tarea },
        };
        if (metricasJuez !== undefined) {
          candidatoParaVeredicto.calidad_por_tarea.juez = metricasJuez;
        } else {
          delete candidatoParaVeredicto.calidad_por_tarea.juez;
        }
        const veredicto = computarVeredicto(candidatoParaVeredicto, incumbente);

        // Artefacto: JSON + tablas legibles (el operador lo captura/commitea).
        console.log("\n=== VEREDICTO LIVE — CANDIDATO (JSON) ===");
        console.log(JSON.stringify(candidato, null, 2));
        console.log("\n=== VEREDICTO LIVE — INCUMBENTE same-run (JSON) ===");
        console.log(JSON.stringify(incumbente, null, 2));
        console.log("\n=== MetricasModelo (tabla legible) ===");
        console.log(tablaLegible(candidato));
        console.log(tablaLegible(incumbente));
        if (metricasJuez !== undefined) {
          console.log("\n=== PhiJudge vs HUMANO (BENCH-04) ===");
          console.log(JSON.stringify(metricasJuez, null, 2));
          console.log(tablaJuez(metricasJuez));
        } else {
          console.log(
            "\n=== PhiJudge vs HUMANO: NO MEDIDO (sin OPENROUTER_API_KEY) — juez pending-evidence ===",
          );
        }
        console.log("\n=== VEREDICTO POR TAREA (definitivo, same-run incumbente) ===");
        console.log(
          "  NOTA (WR-01): la tarea `juez` refleja PhiJudge-vs-HUMANO (BENCH-04), la señal",
        );
        console.log(
          "  AUTORITATIVA del juez — NO el responder-como-juez del harness. routing/clasificacion/",
        );
        console.log("  extraccion reflejan el RESPONDER candidato (Granite).");
        console.log(JSON.stringify(veredicto, null, 2));
        for (const task of TAREAS) {
          const r = veredicto[task];
          const etiqueta =
            task === "juez"
              ? " [PhiJudge vs HUMANO — señal autoritativa del juez]"
              : " [responder Granite]";
          console.log(
            `  ${task}: ${r.estado}${r.modelo ? ` (${r.modelo})` : ""}${etiqueta} — ${r.razon}`,
          );
        }

        // ── ASERCIONES: SOLO provenance + que el veredicto fue COMPUTADO (NUNCA que aprobó) ──
        // Provenance del candidato + incumbente (endpoint https + tarifa datada).
        for (const m of [candidato, incumbente]) {
          expect(m.endpoint).toMatch(/^https:\/\//);
          expect(m.tarifaFecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        expect(incumbente.endpoint).toBe(ENDPOINT_DEEPSEEK);
        expect(incumbente.modelo).toBe(MODELO_DEEPSEEK);

        // El veredicto cubre TODAS las tareas, cada una con un estado VÁLIDO. Un
        // "pending-evidence" o "incumbent-stays" es un PASS legítimo — no se exige aprobación.
        for (const task of TAREAS) {
          const r = veredicto[task];
          expect(r, `veredicto debe cubrir la tarea ${task}`).toBeDefined();
          expect(ESTADOS_VALIDOS).toContain(r.estado);
          expect(typeof r.razon).toBe("string");
          expect(r.razon.length).toBeGreaterThan(0);
        }
      },
      TIMEOUT_MS,
    );
  },
);
