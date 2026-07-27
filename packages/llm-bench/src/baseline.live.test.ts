/**
 * BASELINE LIVE (106-04, Task 2) — DeepSeek/MiniMax REALES, env-gated, NUNCA en CI.
 *
 * Espeja EXACTAMENTE el split CI-mock / LIVE-gated de cruces/fichas golden-set.test.ts:
 *   const LIVE = process.env.LLM_BENCH_LIVE === "1";
 *   (LIVE ? describe : describe.skip)(...)  +  it.skipIf(!KEY)
 * Por defecto (sin LLM_BENCH_LIVE=1) el bloque está SKIPPEADO → la corrida de CI NUNCA toca red
 * ni quema cuota del proveedor (T-106-11).
 *
 * Cuando el operador lo activa, instancia los adapters REALES de @obs/llm (DeepSeek en
 * https://api.deepseek.com, MiniMax en https://api.minimax.io/v1) con `instrumentedFetch`
 * inyectado como `fetchFn` — mide el CAMINO REAL de producción (el repair loop entero corre a
 * través del wrapper) y estampa el endpoint EXACTO al que se llamó (BENCH-03: nunca un host
 * distinto). Corre `correrHarness` por cada modelo, imprime el `Reporte` (JSON + tabla legible)
 * como artefacto de baseline, y ASERTA que cada `MetricasModelo` carga `endpoint` + `tarifaFecha`.
 *
 * NO asierta paridad de candidatos (eso es 107/BENCH-05) — este es el REPORTE, no un veredicto.
 * NO referencia ningún Workers AI / Cloudflare / OpenRouter provider ni secret nuevo: si esta
 * tarea pareciera necesitar uno, habría absorbido alcance de 107 → se detiene y se marca (LOCKED
 * 106-CONTEXT). Solo las keys EXISTENTES (DEEPSEEK_API_KEY / MINIMAX_API_KEY de .env).
 *
 * La disciplina de privacidad la garantiza `instrumentedFetch` (T-106-14): el sink recibe SOLO
 * latencia + conteos de tokens, jamás el texto del prompt/respuesta ni la key.
 */
import { describe, it, expect } from "vitest";
import { DeepSeekProvider, MiniMaxProvider } from "@obs/llm";

import { instrumentedFetch, type CallMetric } from "./instrument";
import { correrHarness, construirReporte, type IdentidadModelo } from "./harness";
import type { MetricasModelo } from "./report";

/** Endpoints REALES de producción — provenance del baseline (deben coincidir con los adapters). */
const ENDPOINT_DEEPSEEK = "https://api.deepseek.com";
const ENDPOINT_MINIMAX = "https://api.minimax.io/v1";

/** Ids de modelo (claves de tarifa en PRICING) que corren en el baseline. */
const MODELO_DEEPSEEK = "deepseek-v4-flash";
const MODELO_MINIMAX = "MiniMax-M3";

/** Imprime una tabla legible de un MetricasModelo (artefacto de baseline para el operador). */
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

const LIVE = process.env.LLM_BENCH_LIVE === "1";

/**
 * Cap de casos por tarea para la corrida LIVE. Default: 3 (smoke rápido, ~24 llamadas reales).
 * `LLM_BENCH_LIMIT=0` corre el BASELINE COMPLETO (todas las golden GATE sets — más lento, decenas
 * de llamadas × 2 modelos; el operador lo corre una vez y captura el artefacto). Un cap acota el
 * costo/tiempo SIN cambiar el driver (host-agnóstico).
 */
const LIMITE_RAW = process.env.LLM_BENCH_LIMIT;
const LIMITE_POR_TAREA =
  LIMITE_RAW === undefined ? 3 : LIMITE_RAW === "0" ? undefined : Number(LIMITE_RAW);

// Presupuesto generoso: un baseline real de 2 modelos × 4 tareas × ~1.5–3s/llamada supera los
// 2 min por defecto de vitest cuando LLM_BENCH_LIMIT=0. 10 min cubre el baseline completo.
const TIMEOUT_MS = 600_000;

(LIVE ? describe : describe.skip)(
  "baseline LIVE — DeepSeek/MiniMax reales (LLM_BENCH_LIVE=1)",
  () => {
    it.skipIf(!process.env.DEEPSEEK_API_KEY || !process.env.MINIMAX_API_KEY)(
      "corre el harness contra los endpoints REALES y estampa endpoint + tarifaFecha por modelo",
      async () => {
        const modelos: MetricasModelo[] = [];

        // ── DeepSeek real ──
        {
          const muestras: CallMetric[] = [];
          const fetchFn = instrumentedFetch(fetch, (m) => muestras.push(m));
          const deepseek = new DeepSeekProvider({
            apiKey: process.env.DEEPSEEK_API_KEY!,
            fetchFn,
          });
          const id: IdentidadModelo = {
            modelo: MODELO_DEEPSEEK,
            endpoint: ENDPOINT_DEEPSEEK,
          };
          const m = await correrHarness(deepseek, id, {
            drenarMetricas: () => muestras.slice(),
            limitePorTarea: LIMITE_POR_TAREA,
          });
          modelos.push(m);
        }

        // ── MiniMax real ──
        {
          const muestras: CallMetric[] = [];
          const fetchFn = instrumentedFetch(fetch, (m) => muestras.push(m));
          const minimax = new MiniMaxProvider({
            apiKey: process.env.MINIMAX_API_KEY!,
            fetchFn,
          });
          const id: IdentidadModelo = {
            modelo: MODELO_MINIMAX,
            endpoint: ENDPOINT_MINIMAX,
          };
          const m = await correrHarness(minimax, id, {
            drenarMetricas: () => muestras.slice(),
            limitePorTarea: LIMITE_POR_TAREA,
          });
          modelos.push(m);
        }

        const reporte = construirReporte(modelos);

        // Artefacto de baseline: JSON + tabla legible (el operador lo captura/commitea).
        console.log("\n=== BASELINE LIVE (JSON) ===");
        console.log(JSON.stringify(reporte, null, 2));
        console.log("\n=== BASELINE LIVE (tabla legible) ===");
        for (const m of reporte.modelos) console.log(tablaLegible(m));

        // Provenance del endpoint + costo datado (BENCH-03) — NUNCA se asierta paridad (eso es 107).
        for (const m of reporte.modelos) {
          expect(m.endpoint).toMatch(/^https:\/\//);
          expect(m.tarifaFecha).toBe("2026-07-26");
          expect(Object.keys(m.calidad_por_tarea)).toHaveLength(4);
        }
        const ds = reporte.modelos.find((m) => m.modelo === MODELO_DEEPSEEK)!;
        const mm = reporte.modelos.find((m) => m.modelo === MODELO_MINIMAX)!;
        expect(ds.endpoint).toBe(ENDPOINT_DEEPSEEK);
        expect(mm.endpoint).toBe(ENDPOINT_MINIMAX);
      },
      TIMEOUT_MS,
    );
  },
);
