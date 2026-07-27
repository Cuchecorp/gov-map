/**
 * Tipo Reporte del harness (106-01, Task 3).
 *
 * Mantiene CADA métrica como campo SEPARADO de primera clase (Pitfall B,
 * LOCKED): calidad por tarea + latencia p50/p95 + costo/1k + las DOS tasas de
 * fallo (structured-output vs zod{repaired,terminal}). Versiona
 * modelo+endpoint+tarifaFecha (provenance, BENCH-03). Ningún campo FUERZA una
 * aprobación — un veredicto "nada aprueba paridad" es plenamente expresable
 * (cada modelo simplemente muestra sus números).
 */

import type { TasasDeFallo } from "./metrics";

/** Las cuatro tareas del benchmark POR TAREA. */
export type TaskId = "routing" | "clasificacion" | "juez" | "extraccion";

/**
 * Puntaje de calidad por tarea. Placeholder de unión: cada plan de tarea
 * (106-02/106-03) refina su propia forma concreta (top-1+abstención,
 * parse-rate vs value-accuracy, conditional-accuracy, etc.). `unknown` mantiene
 * el Reporte agnóstico a la forma sin forzar un contrato prematuro.
 */
export type QualityScore = unknown;

/**
 * Métricas de un modelo en una corrida. Las dos tasas de fallo son campos
 * SEPARADOS (`structured_output_fail_rate` fuera de `zod_fail_rate`).
 * `costo_por_1k` es `number | null` (null si el host omite usage — nunca 0).
 */
export interface MetricasModelo {
  /** Id concreto del modelo (p.ej. "deepseek-v4-flash"). */
  modelo: string;
  /** baseURL medido — provenance del endpoint (BENCH-03). */
  endpoint: string;
  /** Fecha de la tarifa aplicada (de PRICING.fecha) — trazabilidad del costo. */
  tarifaFecha: string;
  /** Calidad por tarea (forma refinada por cada plan de tarea). */
  calidad_por_tarea: Partial<Record<TaskId, QualityScore>>;
  latencia_p50_ms: number;
  /**
   * Latencia p95. INDICATIVA con N chico: con ~40 muestras el p95 es una sola
   * observación (estimación puntual de alta incertidumbre, NO un SLA estable).
   * Leer siempre junto a `n_muestras`.
   */
  latencia_p95_ms: number;
  /** Marca de incertidumbre small-N sobre p95 (true si N es chico). */
  p95Indicativo: boolean;
  /** Número de muestras — hace legible la incertidumbre del p95. */
  n_muestras: number;
  /** Costo por 1000 casos de esta tarea; null si el host omite usage. */
  costo_por_1k: number | null;
  /** Fallo zod separado en reparado (no terminal) vs terminal (duro). */
  zod_fail_rate: TasasDeFallo["zod_fail_rate"];
  /** Fallo de structured-output en el intento 0 — SEPARADO de zod y de calidad. */
  structured_output_fail_rate: TasasDeFallo["structured_output_fail_rate"];
}

/**
 * Reporte de una corrida del harness (JSON + tabla legible). Ningún campo fuerza
 * una aprobación: "nada aprueba paridad" es un valor construible (cada modelo
 * muestra sus números; el veredicto por tarea es alcance de 107/BENCH-05).
 */
export interface Reporte {
  /** Fecha de la corrida. */
  fecha: string;
  /** Fecha de la tabla de tarifas usada (de PRICING.fecha). */
  pricingFecha: string;
  /** Métricas por modelo evaluado. */
  modelos: MetricasModelo[];
}
