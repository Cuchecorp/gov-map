/**
 * VEREDICTO POR TAREA (107-02, BENCH-05) — máquina PURA ε-gated candidato-vs-incumbente.
 *
 * Dado un `MetricasModelo` candidato y el `MetricasModelo` incumbente, emite POR TAREA
 * {approved-model | incumbent-stays | pending-evidence}. Sin red, sin I/O — se prueba con
 * fixtures sintéticos. NO decide "el mejor modelo del mundo": decide, tarea por tarea, si un
 * candidato alcanza PARIDAD con el incumbente dentro de una ε EXPLÍCITA — y por defecto se queda
 * el incumbente ("nada aprueba paridad" es un resultado válido, no un error).
 *
 * GATE es-CL DE PRIMERA CLASE (VETO DURO): para extracción, ANTES del gate agregado de ε, la
 * máquina lee la sub-métrica `negacion.accuracy` del scorer (Task 0 — INDEPENDIENTE de
 * `value.precision`). Si el candidato pierde negación es-CL contra el incumbente por CUALQUIER
 * margen, la tarea queda VETADA (incumbent-stays) y NO se evalúa el gate agregado. Un candidato
 * con MEJOR precisión/recall agregado pero PEOR `negacion.accuracy` es VETADO igual: la fidelidad
 * de la negación legal es-CL no se lava en el promedio.
 *
 * Los benchmarks en INGLÉS son irrelevantes y NO aparecen en esta máquina — ninguna señal de
 * inglés influye jamás en el veredicto. El único eje es-CL que vive aquí es `negacion.accuracy`.
 *
 * NOTA barrel: `src/index.ts` (owner 106-01) hace `export *`. Este módulo es NET-NEW (no del set
 * placeholder 106): agrega DOS líneas de re-export sin tocar las líneas existentes.
 */
import type { MetricasModelo, Reporte, TaskId } from "./report";
import type { MetricasRouting } from "./tasks/routing/scorer";
import type { MetricasClasificacion } from "./tasks/clasificacion/scorer";
import type { MetricasJuez } from "./tasks/juez/scorer";
import type { MetricasExtraccion } from "./tasks/extraccion/scorer";

/**
 * ε POR TAREA — tolerancia de calidad (Δ = candidato − incumbente ≥ −ε ⇒ paridad). DECLARADA
 * EXPLÍCITAMENTE, una por métrica, con justificación. La de extracción es la MÁS ESTRICTA porque
 * su modo de fallo es existencial (fabricar/invertir texto legal): un candidato apenas peor en
 * fidelidad literal NO alcanza paridad. Routing/clasificación toleran un poco más (fallo = mal
 * enrutado, recuperable aguas abajo). Juez tolera un margen mediano sobre recall-de-rechazo.
 */
export const EPSILON_POR_TAREA: Record<TaskId, number> = {
  /** Cobertura de routing: fallo recuperable → tolerancia media. */
  routing: 0.03,
  /** Cobertura de clasificación: idem routing. */
  clasificacion: 0.03,
  /** recall-de-rechazo del juez: sello-de-goma es el riesgo → tolerancia acotada. */
  juez: 0.05,
  /** value.precision de extracción: fabricación = fallo existencial → la MÁS ESTRICTA. */
  extraccion: 0.01,
} as const;

/** Estado de un resultado por tarea. */
export type EstadoTarea = "approved-model" | "incumbent-stays" | "pending-evidence";

/** Resultado de una tarea: estado + (si aprueba) modelo + razón trazable. */
export interface ResultadoTarea {
  estado: EstadoTarea;
  /** Id del modelo aprobado (solo cuando estado === "approved-model"). */
  modelo?: string;
  /** Razón legible del veredicto (trazabilidad: qué gate mandó). */
  razon: string;
}

/** Veredicto completo: un ResultadoTarea por tarea del benchmark. */
export type Veredicto = Record<TaskId, ResultadoTarea>;

/** Todas las tareas, en orden estable. */
const TAREAS: readonly TaskId[] = ["routing", "clasificacion", "juez", "extraccion"] as const;

/**
 * Extrae el ESCALAR de calidad comparable de una métrica por tarea (narrowing de `unknown`). Cada
 * tarea aporta su escalar canónico: routing/clasificación cobertura, juez recall-de-rechazo (el
 * eje que expone al sello-de-goma), extracción value.precision (el eje de fabricación). Devuelve
 * `null` cuando la métrica está ausente o el escalar no es un número (sin números vivos).
 * Exportada para prueba directa del fail-safe de TaskId desconocido (WR-03).
 */
export function escalarDeCalidad(task: TaskId, metrica: unknown): number | null {
  if (metrica == null || typeof metrica !== "object") return null;
  switch (task) {
    case "routing": {
      const v = (metrica as MetricasRouting).cobertura;
      return typeof v === "number" ? v : null;
    }
    case "clasificacion": {
      const v = (metrica as MetricasClasificacion).cobertura;
      return typeof v === "number" ? v : null;
    }
    case "juez": {
      const v = (metrica as MetricasJuez).recall_rechazo;
      return typeof v === "number" ? v : null;
    }
    case "extraccion": {
      const v = (metrica as MetricasExtraccion).value?.precision;
      return typeof v === "number" ? v : null;
    }
    // WR-03: FAIL-SAFE ante un TaskId futuro/desconocido. La asignación a `never`
    // rompe la compilación si se agrega una tarea a `TaskId` sin case aquí (aviso
    // LOUD en build). En runtime devuelve `null` → el llamador lo mapea a
    // pending-evidence (NUNCA un pase/aprobación silenciosa vía undefined→NaN).
    default: {
      const _exhaustive: never = task;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * ¿La tasa de fallo del candidato es NO-PEOR que la del incumbente? Es un gate de PRIMERA CLASE
 * (NO se promedia en la calidad): structured_output_fail_rate y ambos zod_fail_rate.repaired/
 * terminal deben ser ≤ los del incumbente (con una tolerancia numérica minúscula para ruido de
 * punto flotante — jamás lo bastante grande para dejar pasar un fallo genuinamente peor).
 */
const TOL_FALLO = 1e-9;
function fallosNoPeor(cand: MetricasModelo, inc: MetricasModelo): boolean {
  return (
    cand.structured_output_fail_rate <= inc.structured_output_fail_rate + TOL_FALLO &&
    cand.zod_fail_rate.repaired <= inc.zod_fail_rate.repaired + TOL_FALLO &&
    cand.zod_fail_rate.terminal <= inc.zod_fail_rate.terminal + TOL_FALLO
  );
}

/**
 * Computa el veredicto POR TAREA de un candidato contra el incumbente. PURO (sin red, sin I/O).
 *
 * Por tarea:
 *   1. métrica de calidad ausente/undefined → pending-evidence (NUNCA aprueba en silencio).
 *   2. (solo extracción) VETO DURO es-CL: lee `negacion.accuracy` de PRIMERA CLASE (NO
 *      value.precision) en candidato e incumbente; si el candidato es menor por CUALQUIER margen,
 *      incumbent-stays con razón de veto — CORTOCIRCUITA antes del gate agregado.
 *   3. gate agregado: Δ escalar ≥ −ε[task] Y fallosNoPeor → approved-model; si no, incumbent-stays.
 */
export function computarVeredicto(candidato: MetricasModelo, incumbente: MetricasModelo): Veredicto {
  const salida = {} as Veredicto;

  for (const task of TAREAS) {
    const metCand = candidato.calidad_por_tarea[task];
    const metInc = incumbente.calidad_por_tarea[task];

    // (1) Sin números vivos del candidato → pending-evidence (jamás aprobación silenciosa).
    if (metCand === undefined) {
      salida[task] = {
        estado: "pending-evidence",
        razon: `sin métrica de ${task} en el candidato (no hay números vivos) → pending-evidence`,
      };
      continue;
    }

    // (2) VETO DURO es-CL (solo extracción) — CORTOCIRCUITO antes del gate agregado.
    if (task === "extraccion") {
      const negCand = (metCand as MetricasExtraccion).negacion?.accuracy;
      const negInc =
        metInc === undefined ? undefined : (metInc as MetricasExtraccion).negacion?.accuracy;
      if (typeof negCand === "number" && typeof negInc === "number" && negCand < negInc) {
        salida[task] = {
          estado: "incumbent-stays",
          razon: `es-CL negation veto: negacion.accuracy ${negCand} < ${negInc} (independiente de value.precision) — VETADO antes del gate agregado`,
        };
        continue;
      }
    }

    // (3) Gate agregado: Δ de calidad dentro de ε Y tasas de fallo no-peor.
    const escCand = escalarDeCalidad(task, metCand);
    const escInc = escalarDeCalidad(task, metInc);
    if (escCand === null || escInc === null) {
      salida[task] = {
        estado: "pending-evidence",
        razon: `escalar de calidad de ${task} no computable (métrica ausente o mal formada) → pending-evidence`,
      };
      continue;
    }

    const epsilon = EPSILON_POR_TAREA[task];
    const delta = escCand - escInc;
    const dentroDeEpsilon = delta >= -epsilon;
    const fallosOk = fallosNoPeor(candidato, incumbente);

    if (dentroDeEpsilon && fallosOk) {
      salida[task] = {
        estado: "approved-model",
        modelo: candidato.modelo,
        razon: `paridad: Δcalidad ${delta.toFixed(4)} ≥ −ε(${epsilon}) Y tasas de fallo no-peor → ${candidato.modelo} aprobado`,
      };
    } else {
      const causa = !dentroDeEpsilon
        ? `Δcalidad ${delta.toFixed(4)} < −ε(${epsilon})`
        : "tasa de fallo (structured/zod) PEOR que el incumbente";
      salida[task] = {
        estado: "incumbent-stays",
        razon: `no alcanza paridad: ${causa} → se queda el incumbente`,
      };
    }
  }

  return salida;
}

/**
 * Conveniencia sobre un `Reporte`: elige la fila del incumbente por id y computa el veredicto de
 * CADA otro modelo del reporte contra él. Devuelve un mapa modelo→Veredicto. Si NINGÚN candidato
 * alcanza ε en ninguna tarea, cada veredicto es incumbent-stays en todas las tareas — la máquina
 * EXPRESA "nada aprueba paridad" sin error. Lanza sólo si el incumbente no está en el reporte.
 */
export function computarVeredictoDeReporte(
  reporte: Reporte,
  incumbenteId: string,
): Record<string, Veredicto> {
  const incumbente = reporte.modelos.find((m) => m.modelo === incumbenteId);
  if (incumbente === undefined) {
    throw new Error(`incumbente "${incumbenteId}" no está en el reporte`);
  }
  const salida: Record<string, Veredicto> = {};
  for (const candidato of reporte.modelos) {
    if (candidato.modelo === incumbenteId) continue;
    salida[candidato.modelo] = computarVeredicto(candidato, incumbente);
  }
  return salida;
}
