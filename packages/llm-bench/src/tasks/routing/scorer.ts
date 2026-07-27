/**
 * SCORER DE ROUTING (106-02) — ¿a qué TAREA/tier pertenece este input?
 *
 * Generaliza VERBATIM el scoring single-label top-1 + abstención de
 * `packages/cruces/src/golden/golden-set.ts` (evaluarGolden/gatePasa/MetricasGolden).
 * El modo de fallo del routing NO es fabricar texto: es ENRUTAR A LA TAREA EQUIVOCADA.
 * Por eso el scoring distingue tres resultados por caso:
 *   - `actual === expected`               → CORRECTO (cubierto).
 *   - `actual === null` (abstención)      → NO-CUBIERTO (baja cobertura; NUNCA error, D-08).
 *   - `actual !== null && ≠ expected`     → MISCLASIFICACIÓN (error real).
 *
 * `cobertura = correctos/total`; `errores = misclasificaciones`.
 * `gatePasa = cobertura >= UMBRAL && errores === 0` (la abstención baja cobertura pero
 * NUNCA falla por la vía de errores). Puro, sin red — el CI corre un mock; 107 enchufa
 * el modelo real.
 *
 * El barrel `src/index.ts` (owner 106-01) ya re-exporta este módulo; 106-02 solo llena
 * el cuerpo, nunca el barrel.
 */
import { z } from "zod";
import casosRaw from "./casos.json" with { type: "json" };

/** Umbral de cobertura del gate de routing (espeja cruces COBERTURA_MIN). */
export const COBERTURA_MIN = 0.7;

/**
 * Espacio de etiquetas del routing: a qué TAREA pertenece el input, o `null` cuando la
 * abstención es la respuesta correcta (no hay tarea aplicable). Deliberadamente NO
 * incluye juez/extracción-como-abstención: el routing decide clasificación vs extracción
 * como tareas de contenido, y abstiene ante lo no-legislativo (homenajes, feriados).
 */
export const ROUTING_LABELS = ["clasificacion", "extraccion"] as const;

/** Una etiqueta de routing válida. */
export type RoutingLabel = (typeof ROUTING_LABELS)[number];

/** La etiqueta esperada u observada: una tarea, o `null` (abstención). */
export type RoutingEtiqueta = RoutingLabel | null;

const EtiquetaSchema = z.enum(ROUTING_LABELS).nullable();

/** Esquema de un caso del golden de routing (compuerta zod: el JSON es untrusted en disco). */
const CasoRoutingSchema = z.object({
  id: z.string().min(1),
  /** Texto real de tramitación/citación/norma a enrutar (sin PII). */
  input: z.string().min(1),
  /** Tarea de oro, o `null` cuando la abstención es la respuesta correcta. */
  label: EtiquetaSchema,
  /** Estrato (ejes: doc-format|register|length|chamber|negacion|abstencion). */
  estrato: z.string().min(1),
  /** Marca los casos de la MUESTRA curada del gate (los no-null con tarea asignable). */
  muestra: z.boolean().optional(),
});

/** Un caso etiquetado del golden de routing. */
export type CasoRouting = z.infer<typeof CasoRoutingSchema>;

/**
 * El golden completo, validado al cargar desde `casos.json` (~40 casos). El parse zod es
 * la compuerta: un `label` fuera del espacio o un caso mal formado rompe el build/test.
 */
export const GOLDEN_SET: CasoRouting[] = z.array(CasoRoutingSchema).parse(casosRaw);

/**
 * La MUESTRA del gate: casos `muestra:true` (todos con tarea no-null). El gate se mide
 * sobre esta muestra curada, no sobre los ~40 (que incluyen abstenciones esperadas).
 */
export const GOLDEN_SET_GATE: CasoRouting[] = GOLDEN_SET.filter((c) => c.muestra === true);

/**
 * IDs de los casos ADVERSARIOS aislados (meta-test "el gate PUEDE fallar"). Espeja el
 * patrón `IDS_CASOS_ADVERSARIOS`/`GOLDEN_SET_ADVERSARIO` de fichas: casos donde el
 * mock enruta a la tarea equivocada A PROPÓSITO, forzando la rama de misclasificación
 * a ser alcanzable → prueba que la métrica está VIVA, no es una tautología.
 */
export const IDS_CASOS_ADVERSARIOS = ["r01-clasif-xml-modern-camara"] as const;

/** El sub-set adversario: los casos de la muestra marcados como adversarios aislados. */
export const GOLDEN_SET_ADVERSARIO: CasoRouting[] = GOLDEN_SET_GATE.filter((c) =>
  (IDS_CASOS_ADVERSARIOS as readonly string[]).includes(c.id),
);

/** Resultado del scoring por caso (para reporting). */
export type ResultadoCaso = "correcto" | "no-cubierto" | "misclasificacion";

/** Métricas de la corrida del golden de routing (single-label top-1 + abstención). */
export interface MetricasRouting {
  total: number;
  /** #casos con `actual === expected`. */
  correctos: number;
  /** #casos con `actual === null` (abstención): bajan cobertura, NUNCA son error. */
  noCubiertos: number;
  /** #casos con `actual !== null && actual !== expected`: el modo de fallo real. */
  misclasificaciones: number;
  /** correctos / total. */
  cobertura: number;
  /** = misclasificaciones (alias semántico para el gate). */
  errores: number;
  detalle: { id: string; resultado: ResultadoCaso; nota: string }[];
}

/**
 * Evalúa el golden corriendo `ejecutar` por caso (mock en CI, modelo real en 107) y
 * puntúa SINGLE-LABEL TOP-1 + ABSTENCIÓN, idéntico a cruces:
 *   - actual === expected        → correcto.
 *   - actual === null            → no-cubierto (baja cobertura; NUNCA error, D-08).
 *   - actual !== null ≠ expected → misclasificación (error).
 */
export async function evaluarRouting(
  set: CasoRouting[],
  ejecutar: (caso: CasoRouting) => Promise<RoutingEtiqueta>,
): Promise<MetricasRouting> {
  let correctos = 0;
  let noCubiertos = 0;
  let misclasificaciones = 0;
  const detalle: { id: string; resultado: ResultadoCaso; nota: string }[] = [];

  for (const caso of set) {
    const actual = await ejecutar(caso);
    const expected = caso.label;

    let resultado: ResultadoCaso;
    let nota: string;
    if (actual === null) {
      resultado = "no-cubierto";
      noCubiertos++;
      nota = "abstención (null) → no-cubierto (no es error)";
    } else if (actual === expected) {
      resultado = "correcto";
      correctos++;
      nota = `match exacto (${actual})`;
    } else {
      resultado = "misclasificacion";
      misclasificaciones++;
      nota = `MISCLASIFICACIÓN — esperaba ${expected ?? "null"}, obtuvo ${actual}`;
    }
    detalle.push({ id: caso.id, resultado, nota });
  }

  const total = set.length;
  return {
    total,
    correctos,
    noCubiertos,
    misclasificaciones,
    cobertura: total === 0 ? 1 : correctos / total,
    errores: misclasificaciones,
    detalle,
  };
}

/**
 * Decide si el gate PASA: cobertura ≥ COBERTURA_MIN Y cero misclasificaciones. Pura,
 * testeable sin red. La abstención baja cobertura pero jamás falla por la vía de errores.
 */
export function gatePasa(m: MetricasRouting): boolean {
  return m.cobertura >= COBERTURA_MIN && m.errores === 0;
}
