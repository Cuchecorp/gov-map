/**
 * evaluate.ts — lógica pura de evaluación de frescura.
 * Sin I/O, sin red, sin llamadas a DB. Testeable en aislamiento.
 */

import type { FuenteConfig } from "./catalog.js";
import type { QueryRow } from "./query-runner.js";

export interface FuenteResult {
  fuente: string;
  tabla: string;
  ultimoUpsert: string | null;
  diasDesdeUpsert: number | null;
  umbralDias: number;
  stale: boolean;
  ghRun: string;
  r2Snapshot: string;
}

/**
 * Evalúa la frescura de cada fuente del catálogo contra los datos de la query.
 *
 * @param rows        - Resultados de queryFreshness (uno por fuente del catálogo)
 * @param catalog     - Catálogo de fuentes configuradas
 * @param now         - Fecha de referencia para calcular días transcurridos
 * @param envOverrides - Variables de entorno para override de umbral (FRESHNESS_UMBRAL_*)
 * @returns Array de resultados con flag stale por fuente
 */
export function evaluate(
  rows: QueryRow[],
  catalog: FuenteConfig[],
  now: Date,
  envOverrides: Record<string, string> = {},
): FuenteResult[] {
  return catalog.map((cfg) => {
    const row = rows.find((r) => r.fuente === cfg.fuente);

    // Override de umbral por env var (FRESHNESS_UMBRAL_<FUENTE>)
    let umbralDias = cfg.umbralDias;
    const overrideRaw = envOverrides[cfg.overrideEnv];
    if (overrideRaw !== undefined) {
      const parsed = Number.parseInt(overrideRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        umbralDias = parsed;
      }
    }

    const ultimoUpsert = row?.ultimoUpsert ?? null;
    let diasDesdeUpsert: number | null = null;

    if (ultimoUpsert !== null) {
      const ms = now.getTime() - new Date(ultimoUpsert).getTime();
      diasDesdeUpsert = Math.floor(ms / (1000 * 60 * 60 * 24));
    }

    // Staleness: null (desconocido) o días > umbral → stale
    const stale = diasDesdeUpsert === null || diasDesdeUpsert > umbralDias;

    return {
      fuente: cfg.fuente,
      tabla: cfg.tabla,
      ultimoUpsert,
      diasDesdeUpsert,
      umbralDias,
      stale,
      ghRun: row?.ghRun ?? "n/d",
      r2Snapshot: row?.r2Snapshot ?? "n/d (sin snapshots)",
    };
  });
}
