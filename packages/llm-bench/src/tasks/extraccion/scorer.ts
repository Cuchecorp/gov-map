/**
 * SCORER DE PARIDAD-EXTRACCIÓN (106-03) — extracción LITERAL es-CL sobre texto legal.
 *
 * Generaliza `packages/fichas/src/golden/golden-set.ts` (evaluarGolden / normalizarLiteral /
 * MetricasGolden / IDS_CASOS_ADVERSARIOS) al harness de benchmark. El modo de fallo de la
 * extracción NO es enrutar mal: es FABRICAR TEXTO — una idea matriz fluida que el proyecto
 * nunca dijo, una norma citada que no aparece, o (crítico es-CL) DEJAR CAER UNA NEGACIÓN
 * ("deróganse", "no será aplicable") que invierte el sentido legal.
 *
 * REGLA RECTORA (Cleanlab / Pitfall B): el `schema_parse_rate` (¿el payload parseó+validó?)
 * se mantiene SEPARADO de la `value` accuracy (precision/recall de fidelidad literal). Un
 * modelo que parsea el 100% pero con valores fabricados DEBE mostrar parse-rate alto Y
 * value-precision baja — jamás un solo número mezclado.
 *
 * NOTA barrel: `src/index.ts` (owner 106-01) hace `export *` de los cuatro scorers en un
 * namespace PLANO → los símbolos compartidos entre tareas COLISIONAN (TS2308). Por eso los
 * símbolos compartidos llevan SUFIJO `_EXTRACCION` (convención de 106-02: `_ROUTING`/`_CLASIF`).
 * 106-03 solo llena este cuerpo, NUNCA el barrel.
 */
import { z } from "zod";
import casosRaw from "./casos.json" with { type: "json" };

/**
 * Umbral del gate de extracción. Espeja fichas golden (precisión ≥ 0.95, recall ≥ 0.80):
 * la precisión pondera el modo de fallo existencial (fabricación) por sobre el recall.
 */
export const PRECISION_MIN_EXTRACCION = 0.95;
export const RECALL_MIN_EXTRACCION = 0.8;

/**
 * Normaliza para la comparación de substring literal (COPIA de fichas normalizarLiteral):
 * NFD + strip de diacríticos + colapso de whitespace + minúsculas. Permite que
 * mayúsculas/acentos/espacios no rompan el match SIN tolerar paráfrasis (el texto debe estar
 * contenido palabra por palabra). Se inlinea aquí para no arrastrar una dep runtime a @obs/fichas.
 */
export function normalizarLiteral(s: string): string {
  return s
    .normalize("NFD")
    // Rango de marcas diacríticas combinantes por escape \u (no literales crudos: frágiles
    // ante re-encoding del archivo) — mismo idiom que fichas normalizarLiteral (#29).
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Un cuerpo legal citado: norma + artículos. */
const CuerpoLegalSchema = z.object({
  norma: z.string().min(1),
  articulos: z.array(z.string()),
});

/** Un cuerpo legal citado (norma + artículos textuales). */
export type CuerpoLegalExtraccion = z.infer<typeof CuerpoLegalSchema>;

/** La etiqueta de oro esperada de un caso de extracción. */
const EsperadoExtraccionSchema = z.object({
  /** La idea matriz esperada como SUBSTRING literal del texto fuente, o null si no la enuncia. */
  idea_matriz_substring: z.string().nullable(),
  /** Las normas citadas textualmente que el texto SÍ contiene (ground truth). */
  cuerpos: z.array(CuerpoLegalSchema),
});

/** La salida que el mock/modelo produce para un caso (lo que se puntúa contra el expected). */
const RespuestaExtraccionSchema = z.object({
  idea_matriz: z.string().nullable(),
  cuerpos_legales: z.array(CuerpoLegalSchema),
});

/** Salida de extracción (idea_matriz + cuerpos citados). */
export type RespuestaExtraccion = z.infer<typeof RespuestaExtraccionSchema>;

/** Esquema de un caso del golden de extracción (compuerta zod: JSON untrusted en disco). */
const CasoExtraccionSchema = z.object({
  id: z.string().min(1),
  /** Texto legal real/realista sobre el que se extrae (sin PII/RUT). */
  textoFuente: z.string().min(1),
  /** Contexto mínimo del proyecto. */
  proyecto: z.object({ boletin: z.string().min(1), titulo: z.string().min(1) }),
  /** Etiqueta de oro (idea substring + cuerpos ground-truth). */
  expected: EsperadoExtraccionSchema,
  /** Estrato (ejes: doc-format|register|length|chamber|negacion). */
  estrato: z.string().min(1),
  /** Marca los casos de la MUESTRA curada del gate (excluye los adversarios inyectados). */
  muestra: z.boolean().optional(),
});

/** Un caso etiquetado del golden de extracción. */
export type CasoExtraccion = z.infer<typeof CasoExtraccionSchema>;

/**
 * El golden completo, validado al cargar desde `casos.json` (~40 casos). Un caso mal formado
 * o un expected inconsistente rompe el parse → no se cuela en silencio.
 */
export const GOLDEN_SET_EXTRACCION: CasoExtraccion[] = z
  .array(CasoExtraccionSchema)
  .parse(casosRaw);

/**
 * IDs de los casos ADVERSARIOS aislados (meta-test "el gate PUEDE fallar"). Espeja el patrón
 * fichas `IDS_CASOS_ADVERSARIOS`: casos donde el mock FABRICA salida a propósito (idea/norma no
 * contenidas en el texto, o negación caída) → la rama `fp` es alcanzable, la métrica está VIVA.
 */
export const IDS_CASOS_ADVERSARIOS_EXTRACCION = [
  "adv01-idea-fabricada-extraccion",
  "adv02-negacion-caida-extraccion",
] as const;

/** El set del gate: el golden SIN los casos adversarios inyectados. */
export const GOLDEN_SET_GATE_EXTRACCION: CasoExtraccion[] = GOLDEN_SET_EXTRACCION.filter(
  (c) => !(IDS_CASOS_ADVERSARIOS_EXTRACCION as readonly string[]).includes(c.id),
);

/** Solo los casos adversarios: alimentan la meta-prueba de que el gate puede fallar. */
export const GOLDEN_SET_ADVERSARIO_EXTRACCION: CasoExtraccion[] = GOLDEN_SET_EXTRACCION.filter((c) =>
  (IDS_CASOS_ADVERSARIOS_EXTRACCION as readonly string[]).includes(c.id),
);

/** Clave canónica de un cuerpo legal (norma + artículos normalizados) para comparar conjuntos. */
function claveCuerpo(c: CuerpoLegalExtraccion): string {
  const arts = [...c.articulos].map((a) => normalizarLiteral(a)).sort();
  return `${normalizarLiteral(c.norma)}::${arts.join("|")}`;
}

/** Métricas de VALOR (fidelidad literal): precision/recall por ítem, SEPARADAS del parse-rate. */
export interface MetricasValorExtraccion {
  tp: number;
  fp: number;
  fn: number;
  /** tp/(tp+fp). Una idea/norma fabricada o una negación caída = fp → baja la precisión. */
  precision: number;
  /** tp/(tp+fn). */
  recall: number;
}

/**
 * Sub-métrica es-CL de PRIMERA CLASE (Task 0, 107-02) — señal de negación INDEPENDIENTE de
 * `value.precision`. El VETO DURO es-CL del veredicto (107-02) lee ESTE campo, NO `value.precision`,
 * de modo que una negación caída es medible por sí sola sin plegarse en el agregado de fidelidad.
 * ADITIVA: `casos.json` + su sha256 quedan INTACTOS — solo el tipo de salida gana un campo.
 */
export interface MetricasNegacionExtraccion {
  /** #casos de la muestra cuyo `estrato` contiene el token `negacion` (split por `|`). */
  total: number;
  /** #casos de negación manejados correctamente (idea substring que PRESERVA la negación). */
  correctas: number;
  /** correctas/total; 1 cuando total===0 (no hay casos de negación en el set). */
  accuracy: number;
}

/**
 * Resultado de la corrida del golden de extracción. `schema_parse_rate` (¿parseó+validó el
 * payload?) es un campo SEPARADO de `value` (fidelidad literal) — NUNCA se colapsan (Cleanlab).
 */
export interface MetricasExtraccion {
  /** Fracción de casos cuyo payload parseó+validó contra el schema (independiente del valor). */
  schema_parse_rate: number;
  /** Precisión/recall de fidelidad literal (solo sobre los casos que parsearon). */
  value: MetricasValorExtraccion;
  /**
   * es-CL FIRST-CLASS negation signal — INDEPENDIENTE de `value.precision`; el VETO DURO es-CL
   * del veredicto 107 lee ESTE campo, así una negación caída es medible sin plegarse en el
   * agregado. ADITIVA: casos.json + sha256 INTACTOS.
   */
  negacion: MetricasNegacionExtraccion;
  detalle: { id: string; parseOk: boolean; ok: boolean; nota: string }[];
}

/**
 * Ejecuta una extracción por caso. Devuelve `null` cuando el payload NO parseó/validó
 * (structured-output fail) — eso baja el `schema_parse_rate` SIN tocar la value-accuracy.
 */
export type EjecutarExtraccion = (caso: CasoExtraccion) => Promise<RespuestaExtraccion | null>;

/**
 * Evalúa el golden corriendo `ejecutar` por caso (mock en CI, modelo real en 107). Mantiene DOS
 * ejes SEPARADOS (Cleanlab):
 *   1. schema_parse_rate = #(payload parseó+validó) / total.
 *   2. value.{precision,recall} = fidelidad literal, contada SOLO sobre los casos que parsearon:
 *      - idea_matriz: afirmada∧substring→tp; afirmada∧NO-substring (paráfrasis/alucinación)→fp;
 *        expected-no-null∧null→fn; expected-null∧afirmada→fp (degradación deshonesta).
 *      - cuerpos_legales: F1 por conjunto de claves (norma+artículos). Una NEGACIÓN caída
 *        (idea afirmada que omite el "no"/"deróganse" load-bearing) NO es substring → fp.
 * Un caso que no parsea NO suma tp/fp/fn (no contamina la value-accuracy con ceros).
 */
export async function evaluarExtraccion(
  set: CasoExtraccion[],
  ejecutar: EjecutarExtraccion,
): Promise<MetricasExtraccion> {
  let parseados = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  // ── es-CL FIRST-CLASS negation signal (Task 0) — contadores separados del agregado `value` ──
  let negacionTotal = 0;
  let negacionCorrectas = 0;
  const detalle: { id: string; parseOk: boolean; ok: boolean; nota: string }[] = [];

  for (const caso of set) {
    // ¿Es un caso de negación es-CL? (estrato con el token `negacion`). Cuenta en la sub-métrica.
    const esCasoNegacion = caso.estrato.split("|").includes("negacion");
    if (esCasoNegacion) negacionTotal++;

    const respuesta = await ejecutar(caso);

    if (respuesta === null) {
      // Un caso de negación que NO parsea NO cuenta como correcta (suma a total, no a correctas).
      detalle.push({
        id: caso.id,
        parseOk: false,
        ok: false,
        nota: "payload NO parseó/validó (structured-output fail) → baja parse-rate, NO cuenta en value",
      });
      continue;
    }
    parseados++;

    const textoNorm = normalizarLiteral(caso.textoFuente);
    let casoOk = true;
    // Reutiliza EL MISMO chequeo de substring literal de la rama idea_matriz para la sub-métrica de
    // negación: la negación es `correcta` sólo cuando la idea afirmada es substring literal (una
    // negación caída/invertida deja de ser substring → idea NO ok → negación NO correcta).
    let ideaOk = true;
    const notas: string[] = [];

    // ── idea_matriz: fidelidad literal por substring (negación caída = NO substring = fp) ──
    const afirmada = respuesta.idea_matriz;
    const esperadaIdea = caso.expected.idea_matriz_substring;
    if (esperadaIdea !== null) {
      if (afirmada == null) {
        fn++; casoOk = false; ideaOk = false; notas.push("idea: esperaba literal, modelo devolvió null (fn)");
      } else if (textoNorm.includes(normalizarLiteral(afirmada))) {
        tp++; notas.push("idea: substring literal correcto (tp)");
      } else {
        fp++; casoOk = false; ideaOk = false;
        notas.push("idea: FALSO POSITIVO — NO es substring del texto (paráfrasis/alucinación/negación caída)");
      }
    } else {
      if (afirmada != null) {
        fp++; casoOk = false; ideaOk = false;
        notas.push("idea: FALSO POSITIVO — afirmó idea cuando el texto no la enuncia (degradación deshonesta)");
      } else {
        notas.push("idea: degradación honesta (null) correcta");
      }
    }

    // ── es-CL negation sub-metric: una negación es `correcta` si parseó Y la idea es substring
    //    literal (misma regla que la rama idea_matriz; una negación caída/invertida la rompe). ──
    if (esCasoNegacion && ideaOk) negacionCorrectas++;

    // ── cuerpos_legales: F1 por conjunto de claves norma+artículos ──
    const esperadosCuerpos = new Set(caso.expected.cuerpos.map(claveCuerpo));
    const afirmadosSet = new Set(respuesta.cuerpos_legales.map(claveCuerpo));
    for (const k of afirmadosSet) {
      if (esperadosCuerpos.has(k)) {
        tp++;
      } else {
        fp++; casoOk = false;
        notas.push(`cuerpo: FALSO POSITIVO — norma fabricada no en el texto (${k})`);
      }
    }
    for (const k of esperadosCuerpos) {
      if (!afirmadosSet.has(k)) {
        fn++; casoOk = false;
        notas.push(`cuerpo: no recuperó norma esperada (${k})`);
      }
    }

    detalle.push({ id: caso.id, parseOk: true, ok: casoOk, nota: notas.join("; ") });
  }

  const total = set.length;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return {
    schema_parse_rate: total === 0 ? 1 : parseados / total,
    value: { tp, fp, fn, precision, recall },
    negacion: {
      total: negacionTotal,
      correctas: negacionCorrectas,
      accuracy: negacionTotal === 0 ? 1 : negacionCorrectas / negacionTotal,
    },
    detalle,
  };
}

/**
 * Decide si el gate PASA: precisión ≥ umbral Y recall ≥ umbral (espeja fichas 0.95/0.80). El
 * `schema_parse_rate` NO entra en este gate — es una métrica separada que 107 reporta por su
 * cuenta (un modelo puede pasar el gate de valor y aún tener parse-rate bajo: se lee aparte).
 */
export function gatePasaExtraccion(m: MetricasExtraccion): boolean {
  return m.value.precision >= PRECISION_MIN_EXTRACCION && m.value.recall >= RECALL_MIN_EXTRACCION;
}
