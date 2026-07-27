/**
 * Tabla de tarifas VERSIONADA con fecha (106-01, Task 3).
 *
 * Espeja la disciplina de provenance de embeddings (`@obs/llm` types:
 * model/dims/version): todo número de costo del reporte carga su `fecha` de
 * tarifa para ser trazable. Confianza MEDIUM — se re-verifica en 107 (LOCKED).
 * SOLO los incumbentes (DeepSeek/MiniMax); las tarifas de candidatos
 * (Granite/Phi) son alcance de 107 y NO viven aquí.
 */

import type { Tarifa } from "./metrics";

/**
 * Tarifas por 1M de tokens (in/out).
 * [ASSUMED] MEDIUM — re-verify in 107. Valores placeholder de la fecha; el
 * reporte embebe `PRICING.fecha` para que ningún costo quede sin datar.
 */
export const PRICING = {
  fecha: "2026-07-26",
  tarifas: {
    // per 1M tokens, in/out — [ASSUMED] MEDIUM — re-verify in 107
    "deepseek-v4-flash": { in: 0.27, out: 1.1 },
    "MiniMax-M3": { in: 0.3, out: 1.2 },
    // candidates (Granite/Phi) = 107 scope — NOT listed here (no new secret / no candidate rates)
  },
} as const;

/** Ids de modelo con tarifa conocida en `PRICING`. */
export type ModeloConTarifa = keyof typeof PRICING.tarifas;

/**
 * Devuelve la tarifa de `modelo` o `undefined` si no está en la tabla (host sin
 * tarifa conocida → el costo del reporte cae a `null`, nunca a 0).
 */
export function tarifaDe(modelo: string): Tarifa | undefined {
  return (PRICING.tarifas as Record<string, Tarifa>)[modelo];
}
