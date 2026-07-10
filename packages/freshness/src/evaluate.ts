/**
 * evaluate.ts — lógica pura de evaluación de frescura.
 * Sin I/O, sin red, sin llamadas a DB. Testeable en aislamiento.
 */

import type { CoberturaSenalConfig, FuenteConfig } from "./catalog.js";
import type { CoberturaCount, QueryRow } from "./query-runner.js";

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

export interface CoberturaResult {
  senal: string;
  etiqueta: string;
  /** numerador N (count de la señal); null si el count no se pudo leer. */
  n: number | null;
  /** denominador M (universo total = count(proyecto)); null si no se pudo leer. */
  m: number | null;
  /** porcentaje N/M redondeado a entero; null si N o M desconocidos, o M=0. */
  pct: number | null;
  esDenominador: boolean;
}

/**
 * Evalúa la cobertura N/M por señal a partir de los counts leídos (pura, sin I/O).
 *
 * M (denominador) = el count de la señal marcada `esDenominador` (proyecto). Cada
 * señal reporta su N y el porcentaje N/M. Degrada honestamente: un count faltante
 * (null) NO se reporta como 0% — se marca null (desconocido). M=0 → pct null (no
 * dividir por cero; corpus vacío no es "0% cubierto" sino "sin universo").
 */
export function evaluateCobertura(
  counts: CoberturaCount[],
  senales: CoberturaSenalConfig[],
): CoberturaResult[] {
  const denomCfg = senales.find((s) => s.esDenominador);
  const mRaw = denomCfg
    ? counts.find((c) => c.senal === denomCfg.senal)?.count ?? null
    : null;

  return senales.map((cfg) => {
    const n = counts.find((c) => c.senal === cfg.senal)?.count ?? null;
    const m = mRaw;
    let pct: number | null = null;
    if (n !== null && m !== null && m > 0) {
      pct = Math.round((n / m) * 100);
    }
    return { senal: cfg.senal, etiqueta: cfg.etiqueta, n, m, pct, esDenominador: cfg.esDenominador };
  });
}
