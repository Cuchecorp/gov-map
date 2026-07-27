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
 * Ejecuta una completion clasificando su OUTCOME real para las fail-rates. Devuelve el valor
 * validado o `null` si la completion falló estructuralmente/terminó en error zod. NUNCA inventa
 * calidad: un fallo se contabiliza como outcome y devuelve null para que el scorer lo trate como
 * el modo de fallo nativo de su tarea (abstención/parse-fail), no como un acierto.
 *
 * CR-01: el outcome se RECUPERA del camino real del provider vía el observador aditivo
 * `onValidationOutcome` — NO se sintetiza. Solo así se distingue `clean` de `zod-repaired`
 * (una reparación es invisible desde fuera del provider) y `structured-output-fail` (el modelo no
 * logró emitir payload) de `zod-terminal` (payload parseable que falló el schema): ambas colapsan
 * a `LLMValidationError` en el throw, por lo que `instanceof` NO puede separarlas. Espejar el
 * repair loop exige observarlo, no reimplementarlo.
 */
async function completarClasificando<T>(
  provider: LLMProvider,
  req: CompletionRequest,
  schema: z.ZodType<T>,
  outcomes: CallOutcome[],
): Promise<T | null> {
  // El provider emite el desenlace estructural exactamente una vez (éxito o antes de lanzar).
  // El `kind` de ValidationOutcome coincide 1:1 con CallOutcome.
  let observed: CallOutcome | undefined;
  const reqObservado: CompletionRequest = {
    ...req,
    onValidationOutcome: (o) => {
      observed = o.kind;
    },
  };
  try {
    const out = await provider.complete<T>(reqObservado, schema);
    // Si el provider observó (clean|zod-repaired) lo usamos; si no emitió (provider legado que no
    // soporta el observador pero devolvió con éxito) caemos a "clean" conservador.
    outcomes.push(observed ?? "clean");
    return out;
  } catch (err) {
    if (observed !== undefined) {
      // El provider ya clasificó el fallo (structured-output-fail vs zod-terminal) — fuente de verdad.
      outcomes.push(observed);
    } else {
      // Fallback para providers/mocks que lanzan SIN emitir outcome. Un LLMValidationError sin
      // observación = terminal zod; cualquier otro throw (o mock que simula ausencia de payload) =
      // structured-output-fail.
      const rec = {
        payloadUsableAttempt0: false,
        repaired: false,
        terminal: err instanceof LLMValidationError,
      };
      outcomes.push(clasificarOutcome(rec));
    }
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
): Promise<{ calidad: CalidadPorTarea; outcomes: CallOutcome[]; nCasos: number }> {
  const outcomes: CallOutcome[] = [];
  const lim = opciones.limitePorTarea;

  // WR-02: el número de CASOS lógicos driven (una completion lógica por caso), INDEPENDIENTE
  // de cuántos round-trips de red gastó el repair loop. Es el denominador correcto del costo
  // "por caso" (dos modelos con distinta tasa de reparación se comparan manzana-con-manzana).
  const setsAcotados = [
    acotar(GOLDEN_SET_GATE_ROUTING, lim),
    acotar(GOLDEN_SET_GATE_CLASIF, lim),
    acotar(GOLDEN_SET_GATE_EXTRACCION, lim),
    acotar(GOLDEN_SET_SCORING_JUEZ, lim),
  ] as const;
  const nCasos = setsAcotados.reduce((s, set) => s + set.length, 0);
  const [setRouting, setClasif, setExtraccion, setJuez] = setsAcotados;

  // ── routing ──
  const routing = await evaluarRouting(setRouting, async (caso) => {
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
    setClasif,
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
    setExtraccion,
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
  const juez = await evaluarJuez(setJuez, async (caso) => {
    const out = await completarClasificando(
      provider,
      reqPublico(`¿Es correcta esta respuesta?\n${caso.answer}`),
      JuezOutSchema,
      outcomes,
    );
    // WR-04: un fallo de completion (out === null) es NO-VEREDICTO → devolvemos null, NUNCA
    // false. Tratarlo como "rechazo" premiaría a un juez roto con recall-de-rechazo = 1.0
    // (parecería un rechazador perfecto por fallar). El fallo se surface SEPARADO vía las
    // fail-rates (structured_output_fail_rate / zod_fail_rate) — no contamina la calidad del juez.
    return out === null ? null : out.ok;
  });

  return {
    calidad: { routing, clasificacion, extraccion, juez },
    outcomes,
    nCasos,
  };
}

/**
 * Corre el harness completo sobre `provider` y ensambla UN `MetricasModelo`:
 *  - drena el sink de CallMetrics → latencia p50/p95 (percentile) + n_muestras + p95Indicativo,
 *  - costo_por_1k = Σ costoUsd(muestra) / n_casos × 1000 (HEADLINE per-caso; WR-02),
 *  - costo_por_1k_llamadas = Σ costoUsd(muestra) / n_muestras × 1000 (per-round-trip, companion),
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
  const { calidad, outcomes, nCasos } = await correrTareas(provider, {
    limitePorTarea: opts.limitePorTarea,
  });

  const muestras = opts.drenarMetricas();
  const latencias = muestras.map((m) => m.latencyMs);
  const n = latencias.length;

  const tarifa = tarifaDe(id.modelo);
  // WR-02: el costo se normaliza por CASOS (headline), NO por round-trips de red. Un modelo
  // que repara a menudo hace más fetches por caso; dividir por muestras daría un costo
  // "por round-trip" NO comparable entre candidatos. El costo por-llamada se conserva como
  // companion explícito (costo_por_1k_llamadas). Ambos son null si CUALQUIER muestra carece de
  // usage o no hay tarifa (nunca 0 silencioso — Pitfall A).
  let costo_por_1k: number | null = null;
  let costo_por_1k_llamadas: number | null = null;
  if (tarifa !== undefined && n > 0 && nCasos > 0) {
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
    if (todasConCosto) {
      // Denominador = CASOS lógicos (headline, comparable); companion = round-trips medidos.
      costo_por_1k = (suma / nCasos) * 1000;
      costo_por_1k_llamadas = (suma / n) * 1000;
    }
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
    n_casos: nCasos,
    costo_por_1k,
    costo_por_1k_llamadas,
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
