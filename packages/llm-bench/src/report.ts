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
  /** Número de muestras (round-trips de red medidos) — hace legible la incertidumbre del p95. */
  n_muestras: number;
  /**
   * Número de CASOS lógicos driven (una completion lógica por caso del golden), INDEPENDIENTE
   * de los round-trips que gastó el repair loop. Es el denominador de `costo_por_1k` (WR-02).
   */
  n_casos: number;
  /**
   * HEADLINE de costo (WR-02): costo por 1000 CASOS = Σcosto / n_casos × 1000. Normalizado por
   * casos (NO por round-trips) para que dos modelos con distinta tasa de reparación se comparen
   * manzana-con-manzana en 107. null si el host omite usage o no hay tarifa (nunca 0).
   */
  costo_por_1k: number | null;
  /**
   * Companion de costo: costo por 1000 LLAMADAS (round-trips de red) = Σcosto / n_muestras ×
   * 1000. Útil para leer el sobrecosto de red del repair loop; NO es comparable entre modelos
   * con distinta tasa de reparación. null bajo las mismas condiciones que `costo_por_1k`.
   */
  costo_por_1k_llamadas: number | null;
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
