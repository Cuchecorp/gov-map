/**
 * DRIVER del harness (106-04, Task 1) — Wave 3.
 *
 * Cierra @obs/llm-bench: toma CUALQUIER `LLMProvider` (mock en CI; DeepSeek/MiniMax real en el
 * baseline LIVE; Granite/Phi por baseURL en 107) y lo drive por las CUATRO golden sets por tarea,
 * ensamblando UN `MetricasModelo` con cada métrica SEPARADA de primera clase:
 *   - calidad_por_tarea (routing/clasificación/juez/extracción, cada una en su forma nativa),
 *   - latencia p50/p95 (percentile nearest-rank) + n_muestras + p95Indicativo,
 *   - costo_por_1k (costoUsd × tarifaDe, null si el host omite usage — nunca 0),
 *   - structured_output_fail_rate y zod_fail_rate.{repaired,terminal} SEPARADOS (Pitfall B).
 *
 * Regla rectora: el harness SOLO reporta — NO hornea aprobación. `construirReporte` junta los
 * modelos tal cual; "nada aprueba paridad" es plenamente construible (el veredicto por tarea es
 * 107/BENCH-05). Y es HOST-AGNÓSTICO: cambiar de provider NO cambia el driver (107 enchufa por
 * baseURL sin tocar este archivo).
 *
 * Cómo drive: cada scorer recibe una `ejecutar` de su forma nativa. El harness construye esos
 * puentes desde un `LLMProvider` genérico llamando `provider.complete(req, schema)` con el schema
 * zod de cada tarea, y clasifica el outcome (clean/structured-output-fail/zod-*) por si la llamada
 * lanza. Un fallo de completion → outcome contabilizado + resultado neutro para el scorer (null /
 * abstención) que NO inventa calidad.
 */
import { z } from "zod";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import { LLMValidationError } from "@obs/llm";

import type { CallMetric } from "./instrument";
import {
  percentile,
  costoUsd,
  agregarFallos,
  clasificarOutcome,
  type CallOutcome,
} from "./metrics";
import { PRICING, tarifaDe } from "./pricing";
import type { MetricasModelo, Reporte, TaskId } from "./report";

import {
  GOLDEN_SET_GATE_ROUTING,
  ROUTING_LABELS,
  evaluarRouting,
  type MetricasRouting,
  type RoutingEtiqueta,
} from "./tasks/routing/scorer";
import {
  GOLDEN_SET_GATE_CLASIF,
  SECTOR_CODIGOS,
  evaluarClasificacion,
  type MetricasClasificacion,
  type SectorEtiqueta,
} from "./tasks/clasificacion/scorer";
import {
  GOLDEN_SET_GATE_EXTRACCION,
  evaluarExtraccion,
  type MetricasExtraccion,
  type RespuestaExtraccion,
} from "./tasks/extraccion/scorer";
import {
  GOLDEN_SET_SCORING_JUEZ,
  evaluarJuez,
  slotCurvaConfiabilidadJuez,
  type MetricasJuez,
} from "./tasks/juez/scorer";

/** Umbral bajo el cual el p95 se marca INDICATIVO (small-N: el p95 es ~1 observación). */
const N_INDICATIVO_P95 = 60;

/** La calidad de las cuatro tareas, cada una en su forma nativa (NUNCA colapsada en un número). */
export interface CalidadPorTarea {
  routing: MetricasRouting;
  clasificacion: MetricasClasificacion;
  extraccion: MetricasExtraccion;
  juez: MetricasJuez;
}

/** Identidad del modelo bajo medición (provenance del endpoint — BENCH-03). */
export interface IdentidadModelo {
  /** Id concreto (p.ej. "deepseek-v4-flash") — clave de la tarifa en PRICING. */
  modelo: string;
  /** baseURL medido — el endpoint EXACTO al que se llamó (nunca un host distinto). */
  endpoint: string;
}

// ── Schemas zod de la salida esperada por tarea (compuerta de la completion del provider) ──

/** Salida de routing: la etiqueta de tarea o null (abstención). */
const RoutingOutSchema = z.object({
  label: z.enum(ROUTING_LABELS).nullable(),
});
/** Salida de clasificación: el sector o null (abstención). */
const ClasifOutSchema = z.object({
  sector_codigo: z.enum(SECTOR_CODIGOS).nullable(),
});
/** Salida de extracción: idea_matriz + cuerpos citados. */
const ExtraccionOutSchema = z.object({
  idea_matriz: z.string().nullable(),
  cuerpos_legales: z.array(
    z.object({ norma: z.string(), articulos: z.array(z.string()) }),
  ),
});
/** Salida del juez: OK (true) o rechazo (false). */
const JuezOutSchema = z.object({ ok: z.boolean() });

/** Construye un CompletionRequest de dato público (el golden es RUT-free por construcción). */
function reqPublico(user: string): CompletionRequest {
  return { user, criticality: "bulk", sensitivity: "public" };
}

/**
 * Ejecuta una completion clasificando su OUTCOME para las fail-rates. Devuelve el valor validado
 * o `null` si la completion falló estructuralmente/terminó en error zod. NUNCA inventa calidad:
 * un fallo se contabiliza como outcome y devuelve null para que el scorer lo trate como el modo
 * de fallo nativo de su tarea (abstención/parse-fail), no como un acierto.
 */
async function completarClasificando<T>(
  provider: LLMProvider,
  req: CompletionRequest,
  schema: z.ZodType<T>,
  outcomes: CallOutcome[],
): Promise<T | null> {
  try {
    const out = await provider.complete<T>(req, schema);
    outcomes.push("clean");
    return out;
  } catch (err) {
    // Un LLMValidationError = se agotaron los intentos del repair loop (zod-terminal).
    // Cualquier otro throw (incl. el mock que simula ausencia de payload) = structured-output-fail.
    const rec = {
      payloadUsableAttempt0: false,
      repaired: false,
      terminal: err instanceof LLMValidationError,
    };
    outcomes.push(clasificarOutcome(rec));
    return null;
  }
}

/** Opciones de corrida del harness. */
export interface OpcionesCorrida {
  /**
   * Cap de casos POR TAREA. `undefined` = todas (default, la corrida completa del gate). Un
   * cap acota el costo/tiempo de una corrida LIVE (smoke) sin cambiar el driver; el `Reporte`
   * simplemente mide menos casos (n_muestras lo refleja, y el p95 queda más indicativo aún).
   */
  limitePorTarea?: number;
}

/** Recorta un set al cap por-tarea (o lo devuelve entero si no hay cap). */
function acotar<C>(set: C[], limite: number | undefined): C[] {
  return limite === undefined ? set : set.slice(0, Math.max(0, limite));
}

/**
 * Drive las CUATRO golden GATE sets con `provider`, recolectando los `CallOutcome` de cada
 * completion. Devuelve la calidad por tarea + los outcomes agregables. Las `CallMetric`
 * (latencia+tokens) las captura el sink que el llamador ya cableó AL provider: en el mock es un
 * sink sintético; con el provider real (baseline LIVE) es el `instrumentedFetch` inyectado en el
 * adapter. `correrHarness` drena ese sink tras esta corrida.
 */
export async function correrTareas(
  provider: LLMProvider,
  opciones: OpcionesCorrida = {},
): Promise<{ calidad: CalidadPorTarea; outcomes: CallOutcome[] }> {
  const outcomes: CallOutcome[] = [];
  const lim = opciones.limitePorTarea;

  // ── routing ──
  const routing = await evaluarRouting(acotar(GOLDEN_SET_GATE_ROUTING, lim), async (caso) => {
    const out = await completarClasificando(
      provider,
      reqPublico(caso.input),
      RoutingOutSchema,
      outcomes,
    );
    return (out?.label ?? null) as RoutingEtiqueta;
  });

  // ── clasificación ──
  const clasificacion = await evaluarClasificacion(
    acotar(GOLDEN_SET_GATE_CLASIF, lim),
    async (caso) => {
      const out = await completarClasificando(
        provider,
        reqPublico(caso.input),
        ClasifOutSchema,
        outcomes,
      );
      return (out?.sector_codigo ?? null) as SectorEtiqueta;
    },
  );

  // ── extracción ──
  const extraccion = await evaluarExtraccion(
    acotar(GOLDEN_SET_GATE_EXTRACCION, lim),
    async (caso) => {
      const out = await completarClasificando(
        provider,
        reqPublico(caso.textoFuente),
        ExtraccionOutSchema,
        outcomes,
      );
      // null → structured-output fail (baja parse-rate; NO contamina value-accuracy).
      return out === null ? null : (out as RespuestaExtraccion);
    },
  );

  // ── juez ──
  const juez = await evaluarJuez(acotar(GOLDEN_SET_SCORING_JUEZ, lim), async (caso) => {
    const out = await completarClasificando(
      provider,
      reqPublico(`¿Es correcta esta respuesta?\n${caso.answer}`),
      JuezOutSchema,
      outcomes,
    );
    // Un fallo estructural → rechazo conservador (el juez es escalate-only por diseño).
    return out?.ok ?? false;
  });

  return {
    calidad: { routing, clasificacion, extraccion, juez },
    outcomes,
  };
}

/**
 * Corre el harness completo sobre `provider` y ensambla UN `MetricasModelo`:
 *  - drena el sink de CallMetrics → latencia p50/p95 (percentile) + n_muestras + p95Indicativo,
 *  - costo_por_1k = Σ costoUsd(muestra) / n × 1000 (null si el host omite usage o no hay tarifa),
 *  - agregarFallos(outcomes) → structured_output_fail_rate + zod_fail_rate.{repaired,terminal},
 *  - estampa endpoint + tarifaFecha (PRICING.fecha) — provenance BENCH-03.
 *
 * NO hornea ninguna aprobación: sólo reporta los números etiquetados por su endpoint.
 */
export async function correrHarness(
  provider: LLMProvider,
  id: IdentidadModelo,
  opts: { drenarMetricas: () => CallMetric[]; limitePorTarea?: number },
): Promise<MetricasModelo> {
  const { calidad, outcomes } = await correrTareas(provider, {
    limitePorTarea: opts.limitePorTarea,
  });

  const muestras = opts.drenarMetricas();
  const latencias = muestras.map((m) => m.latencyMs);
  const n = latencias.length;

  const tarifa = tarifaDe(id.modelo);
  // Costo por 1000 casos: promedio de costo por muestra × 1000. null si CUALQUIER muestra
  // carece de usage o no hay tarifa (nunca 0 silencioso — Pitfall A).
  let costo_por_1k: number | null = null;
  if (tarifa !== undefined && n > 0) {
    let suma = 0;
    let todasConCosto = true;
    for (const m of muestras) {
      const c = costoUsd(
        { prompt_tokens: m.promptTokens, completion_tokens: m.completionTokens },
        tarifa,
      );
      if (c === null) {
        todasConCosto = false;
        break;
      }
      suma += c;
    }
    costo_por_1k = todasConCosto ? (suma / n) * 1000 : null;
  }

  const fallos = agregarFallos(outcomes);

  const calidad_por_tarea: Partial<Record<TaskId, unknown>> = {
    routing: calidad.routing,
    clasificacion: calidad.clasificacion,
    extraccion: calidad.extraccion,
    juez: calidad.juez,
  };

  return {
    modelo: id.modelo,
    endpoint: id.endpoint,
    tarifaFecha: PRICING.fecha,
    calidad_por_tarea,
    latencia_p50_ms: percentile(latencias, 50),
    latencia_p95_ms: percentile(latencias, 95),
    p95Indicativo: n < N_INDICATIVO_P95,
    n_muestras: n,
    costo_por_1k,
    zod_fail_rate: fallos.zod_fail_rate,
    structured_output_fail_rate: fallos.structured_output_fail_rate,
  };
}

/**
 * Junta los `MetricasModelo` en un `Reporte`. Sólo reporta — ningún campo fuerza aprobación:
 * un Reporte con cero modelos aprobados ("nada aprueba paridad") es plenamente construible (el
 * veredicto por tarea es 107/BENCH-05). Estampa la fecha de corrida + PRICING.fecha.
 */
export function construirReporte(modelos: MetricasModelo[]): Reporte {
  return {
    fecha: new Date().toISOString(),
    pricingFecha: PRICING.fecha,
    modelos,
  };
}

/**
 * El slot de la curva de confiabilidad del juez (vacío en 106; 107 la fitea sobre el split de
 * calibración). Se re-exporta desde el harness para que el Reporte tenga un único punto de acceso.
 */
export { slotCurvaConfiabilidadJuez };
