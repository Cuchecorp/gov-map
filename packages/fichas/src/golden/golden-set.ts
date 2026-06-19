/**
 * GOLDEN SET (flag P7) — conjunto anotado a mano de casos de EXTRACCIÓN LITERAL sobre
 * texto legal real. Es el GATE DE CALIDAD del riesgo existencial #2 (extracción literal,
 * nunca interpretativa): corre como test de regresión (golden-set.test.ts) y si la
 * fidelidad literal cae bajo el umbral, FALLA → bloquea CI.
 *
 * Una extracción fabricada NO produce un error: produce una afirmación falsa creíble (una
 * "idea matriz" fluida que el texto nunca dijo, o una norma citada que no aparece). Por eso:
 *   - una `idea_matriz` que NO es substring literal del texto (normalizado) = FALSO POSITIVO.
 *   - un cuerpo legal afirmado que NO está en el `expected` (fabricado) = FALSO POSITIVO.
 * La PRECISIÓN pondera el modo de fallo existencial; el umbral de deploy es ≥ 0.95.
 *
 * Cada caso fija `llmEsperado`: la `Ficha` que el mock-provider devuelve para ese texto en
 * MODO CI (sin red). El bloque LIVE reemplaza el mock por DeepSeek real y mide la fidelidad
 * real contra el mismo umbral (gated por env, no quema cuota en CI).
 *
 * Cobertura: extracción positiva (idea matriz + cuerpos), degradación honesta (idea matriz
 * ausente → null), múltiples normas, y ≥1 caso ADVERSARIAL (texto SIN idea matriz explícita
 * donde un modelo ingenuo alucinaría → expected null). Los casos adversarios del mock que
 * fabrican salida (para la meta-prueba) viven aislados en IDS_CASOS_ADVERSARIOS.
 */

import type { Ficha, CuerpoLegal } from "../model";

/** Etiqueta de oro de un caso del golden set. */
export interface Esperado {
  /** La idea matriz esperada como SUBSTRING literal del texto fuente, o null si no la enuncia. */
  idea_matriz_substring: string | null;
  /** Las normas citadas textualmente que el texto SÍ contiene (ground truth). */
  cuerpos: CuerpoLegal[];
}

/** Categoría de dificultad del caso (para reporting/cobertura). */
export type CategoriaFicha =
  | "idea-y-cuerpos"
  | "solo-idea"
  | "solo-cuerpos"
  | "multiples-normas"
  | "sin-idea-matriz"
  | "adversario";

/** Un caso etiquetado del golden set. */
export interface CasoGolden {
  id: string;
  categoria: CategoriaFicha;
  /** Texto legal real (o realista) sobre el que se extrae. */
  textoFuente: string;
  /** Contexto mínimo del proyecto. */
  proyecto: { boletin: string; titulo: string };
  /** Salida FIJA del mock en MODO CI (lo que el "modelo" devuelve). */
  llmEsperado: Ficha;
  /** Etiqueta de oro. */
  expected: Esperado;
}

/**
 * Normaliza para la comparación de substring literal: minúsculas, acentos/diacríticos
 * plegados (NFD + strip de marcas), whitespace colapsado. Permite que diferencias de
 * mayúsculas/acentos/espacios no rompan el match, SIN tolerar paráfrasis (el texto debe
 * estar contenido palabra por palabra).
 */
export function normalizarLiteral(s: string): string {
  return s
    .normalize("NFD")
    // #29: rango de marcas diacríticas combinantes por escape \u (antes literales crudos,
    // frágiles ante re-encoding del archivo).
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave canónica de un cuerpo legal (norma + artículos ordenados) para comparar conjuntos. */
function claveCuerpo(c: CuerpoLegal): string {
  const arts = [...c.articulos].map((a) => normalizarLiteral(a)).sort();
  return `${normalizarLiteral(c.norma)}::${arts.join("|")}`;
}

// ── Casos del golden set (texto legal realista, anotado a mano) ──────────────
export const GOLDEN_SET: CasoGolden[] = [
  {
    id: "f01-datos-personales",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "El presente proyecto de ley tiene por objeto fortalecer la protección de los datos personales de las personas, modificando la Ley N° 19.628 sobre protección de la vida privada en su artículo 4.",
    proyecto: { boletin: "11144-07", titulo: "Protección de datos personales" },
    llmEsperado: {
      idea_matriz:
        "tiene por objeto fortalecer la protección de los datos personales de las personas",
      cuerpos_legales: [{ norma: "Ley N° 19.628", articulos: ["artículo 4"] }],
    },
    expected: {
      idea_matriz_substring:
        "tiene por objeto fortalecer la protección de los datos personales de las personas",
      cuerpos: [{ norma: "Ley N° 19.628", articulos: ["artículo 4"] }],
    },
  },
  {
    id: "f02-jornada-laboral",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "La idea matriz del proyecto consiste en reducir la jornada laboral a cuarenta horas semanales, modificando el Código del Trabajo en sus artículos 22 y 28.",
    proyecto: { boletin: "11179-13", titulo: "Reducción de jornada laboral" },
    llmEsperado: {
      idea_matriz:
        "reducir la jornada laboral a cuarenta horas semanales",
      cuerpos_legales: [
        { norma: "Código del Trabajo", articulos: ["artículo 22", "artículo 28"] },
      ],
    },
    expected: {
      idea_matriz_substring:
        "reducir la jornada laboral a cuarenta horas semanales",
      cuerpos: [
        { norma: "Código del Trabajo", articulos: ["artículo 22", "artículo 28"] },
      ],
    },
  },
  {
    id: "f03-solo-idea",
    categoria: "solo-idea",
    textoFuente:
      "Este proyecto tiene por objeto establecer el feriado legal del día 16 de septiembre con carácter de irrenunciable para los trabajadores del comercio.",
    proyecto: { boletin: "12345-13", titulo: "Feriado 16 de septiembre" },
    llmEsperado: {
      idea_matriz:
        "establecer el feriado legal del día 16 de septiembre con carácter de irrenunciable para los trabajadores del comercio",
      cuerpos_legales: [],
    },
    expected: {
      idea_matriz_substring:
        "establecer el feriado legal del día 16 de septiembre con carácter de irrenunciable para los trabajadores del comercio",
      cuerpos: [],
    },
  },
  {
    id: "f04-solo-cuerpos",
    categoria: "solo-cuerpos",
    textoFuente:
      "El proyecto introduce modificaciones de orden técnico al Decreto Ley N° 3.500 y a la Ley N° 20.255, sin que el mensaje enuncie una idea matriz explícita.",
    proyecto: { boletin: "13001-13", titulo: "Modificaciones previsionales" },
    llmEsperado: {
      idea_matriz: null,
      cuerpos_legales: [
        { norma: "Decreto Ley N° 3.500", articulos: [] },
        { norma: "Ley N° 20.255", articulos: [] },
      ],
    },
    expected: {
      idea_matriz_substring: null,
      cuerpos: [
        { norma: "Decreto Ley N° 3.500", articulos: [] },
        { norma: "Ley N° 20.255", articulos: [] },
      ],
    },
  },
  {
    id: "f05-multiples-normas",
    categoria: "multiples-normas",
    textoFuente:
      "El proyecto tiene por objeto modernizar la institucionalidad ambiental, modificando la Ley N° 19.300 sobre Bases Generales del Medio Ambiente en sus artículos 8 y 10, la Ley N° 20.417 y el Código de Aguas en su artículo 129 bis.",
    proyecto: { boletin: "14001-12", titulo: "Modernización ambiental" },
    llmEsperado: {
      idea_matriz: "modernizar la institucionalidad ambiental",
      cuerpos_legales: [
        { norma: "Ley N° 19.300", articulos: ["artículo 8", "artículo 10"] },
        { norma: "Ley N° 20.417", articulos: [] },
        { norma: "Código de Aguas", articulos: ["artículo 129 bis"] },
      ],
    },
    expected: {
      idea_matriz_substring: "modernizar la institucionalidad ambiental",
      cuerpos: [
        { norma: "Ley N° 19.300", articulos: ["artículo 8", "artículo 10"] },
        { norma: "Ley N° 20.417", articulos: [] },
        { norma: "Código de Aguas", articulos: ["artículo 129 bis"] },
      ],
    },
  },
  {
    id: "f06-acentos-grafia",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "El proyecto tiene por objeto garantizar el derecho a la educación pública, gratuita y de calidad, modificando la Ley N° 20.370 General de Educación.",
    proyecto: { boletin: "15001-04", titulo: "Educación pública" },
    // El modelo devuelve la cita con grafía ligeramente distinta (mayúsculas/acentos) que el
    // normalizador literal converge: sigue siendo substring tras normalizar (no paráfrasis).
    llmEsperado: {
      idea_matriz:
        "Garantizar el derecho a la educación pública, gratuita y de calidad",
      cuerpos_legales: [{ norma: "Ley N° 20.370", articulos: [] }],
    },
    expected: {
      idea_matriz_substring:
        "garantizar el derecho a la educación pública, gratuita y de calidad",
      cuerpos: [{ norma: "Ley N° 20.370", articulos: [] }],
    },
  },
  {
    id: "f07-dfl",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "Tiene por objeto regular el ejercicio de la profesión, modificando el DFL N° 1 de 2006 del Ministerio de Salud en su artículo 173.",
    proyecto: { boletin: "16001-11", titulo: "Ejercicio profesional salud" },
    llmEsperado: {
      idea_matriz: "regular el ejercicio de la profesión",
      cuerpos_legales: [{ norma: "DFL N° 1", articulos: ["artículo 173"] }],
    },
    expected: {
      idea_matriz_substring: "regular el ejercicio de la profesión",
      cuerpos: [{ norma: "DFL N° 1", articulos: ["artículo 173"] }],
    },
  },
  {
    id: "f08-codigo-penal",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "El proyecto tiene por objeto sancionar el maltrato animal, incorporando un nuevo artículo 291 ter al Código Penal.",
    proyecto: { boletin: "17001-07", titulo: "Sanción maltrato animal" },
    llmEsperado: {
      idea_matriz: "sancionar el maltrato animal",
      cuerpos_legales: [{ norma: "Código Penal", articulos: ["artículo 291 ter"] }],
    },
    expected: {
      idea_matriz_substring: "sancionar el maltrato animal",
      cuerpos: [{ norma: "Código Penal", articulos: ["artículo 291 ter"] }],
    },
  },
  {
    id: "f09-objeto-frase",
    categoria: "solo-idea",
    textoFuente:
      "El presente proyecto tiene por objeto crear un subsidio de arriendo para la clase media emergente afectada por la crisis habitacional.",
    proyecto: { boletin: "18001-14", titulo: "Subsidio de arriendo" },
    llmEsperado: {
      idea_matriz:
        "crear un subsidio de arriendo para la clase media emergente afectada por la crisis habitacional",
      cuerpos_legales: [],
    },
    expected: {
      idea_matriz_substring:
        "crear un subsidio de arriendo para la clase media emergente afectada por la crisis habitacional",
      cuerpos: [],
    },
  },
  {
    id: "f10-constitucion",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "El proyecto de reforma tiene por objeto consagrar el derecho al agua, modificando la Constitución Política de la República en su artículo 19.",
    proyecto: { boletin: "19001-07", titulo: "Derecho al agua" },
    llmEsperado: {
      idea_matriz: "consagrar el derecho al agua",
      cuerpos_legales: [
        { norma: "Constitución Política de la República", articulos: ["artículo 19"] },
      ],
    },
    expected: {
      idea_matriz_substring: "consagrar el derecho al agua",
      cuerpos: [
        { norma: "Constitución Política de la República", articulos: ["artículo 19"] },
      ],
    },
  },
  {
    id: "f11-tributario",
    categoria: "multiples-normas",
    textoFuente:
      "Tiene por objeto perfeccionar el sistema tributario, modificando el Decreto Ley N° 824 sobre Impuesto a la Renta en su artículo 14 y el Decreto Ley N° 825 sobre Impuesto a las Ventas y Servicios.",
    proyecto: { boletin: "20001-05", titulo: "Reforma tributaria" },
    llmEsperado: {
      idea_matriz: "perfeccionar el sistema tributario",
      cuerpos_legales: [
        { norma: "Decreto Ley N° 824", articulos: ["artículo 14"] },
        { norma: "Decreto Ley N° 825", articulos: [] },
      ],
    },
    expected: {
      idea_matriz_substring: "perfeccionar el sistema tributario",
      cuerpos: [
        { norma: "Decreto Ley N° 824", articulos: ["artículo 14"] },
        { norma: "Decreto Ley N° 825", articulos: [] },
      ],
    },
  },
  {
    id: "f12-salud",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "El proyecto tiene por objeto fortalecer la atención primaria de salud, modificando la Ley N° 18.469 que regula el ejercicio del derecho constitucional a la protección de la salud.",
    proyecto: { boletin: "21001-11", titulo: "Atención primaria" },
    llmEsperado: {
      idea_matriz: "fortalecer la atención primaria de salud",
      cuerpos_legales: [{ norma: "Ley N° 18.469", articulos: [] }],
    },
    expected: {
      idea_matriz_substring: "fortalecer la atención primaria de salud",
      cuerpos: [{ norma: "Ley N° 18.469", articulos: [] }],
    },
  },
  {
    id: "f13-seguridad",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "Tiene por objeto reforzar la seguridad pública, modificando la Ley N° 17.798 sobre Control de Armas en sus artículos 9 y 14.",
    proyecto: { boletin: "22001-25", titulo: "Control de armas" },
    llmEsperado: {
      idea_matriz: "reforzar la seguridad pública",
      cuerpos_legales: [
        { norma: "Ley N° 17.798", articulos: ["artículo 9", "artículo 14"] },
      ],
    },
    expected: {
      idea_matriz_substring: "reforzar la seguridad pública",
      cuerpos: [
        { norma: "Ley N° 17.798", articulos: ["artículo 9", "artículo 14"] },
      ],
    },
  },
  {
    id: "f14-transparencia",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "El proyecto tiene por objeto aumentar la transparencia de los órganos del Estado, modificando la Ley N° 20.285 sobre Acceso a la Información Pública.",
    proyecto: { boletin: "23001-07", titulo: "Transparencia" },
    llmEsperado: {
      idea_matriz: "aumentar la transparencia de los órganos del Estado",
      cuerpos_legales: [{ norma: "Ley N° 20.285", articulos: [] }],
    },
    expected: {
      idea_matriz_substring: "aumentar la transparencia de los órganos del Estado",
      cuerpos: [{ norma: "Ley N° 20.285", articulos: [] }],
    },
  },
  {
    id: "f15-municipal",
    categoria: "idea-y-cuerpos",
    textoFuente:
      "Tiene por objeto fortalecer la gestión municipal, modificando la Ley N° 18.695 Orgánica Constitucional de Municipalidades en su artículo 5.",
    proyecto: { boletin: "24001-06", titulo: "Gestión municipal" },
    llmEsperado: {
      idea_matriz: "fortalecer la gestión municipal",
      cuerpos_legales: [{ norma: "Ley N° 18.695", articulos: ["artículo 5"] }],
    },
    expected: {
      idea_matriz_substring: "fortalecer la gestión municipal",
      cuerpos: [{ norma: "Ley N° 18.695", articulos: ["artículo 5"] }],
    },
  },

  // ── ADVERSARIAL (degradación honesta): texto SIN idea matriz explícita ──
  // Un modelo ingenuo "rellenaría" una idea matriz fluida a partir del articulado. La
  // respuesta correcta es null: el texto NO enuncia el objeto. El mock devuelve null y el
  // expected es null → este caso PRUEBA que la degradación honesta puntúa como acierto.
  {
    id: "f16-sin-idea-matriz",
    categoria: "sin-idea-matriz",
    textoFuente:
      "Artículo 1°.- Reemplázase, en el inciso primero del artículo 12, la expresión 'treinta días' por 'sesenta días'. Artículo 2°.- Deróganse los incisos segundo y tercero del artículo 15.",
    proyecto: { boletin: "25001-07", titulo: "Modificación de plazos" },
    llmEsperado: { idea_matriz: null, cuerpos_legales: [] },
    expected: { idea_matriz_substring: null, cuerpos: [] },
  },
  {
    id: "f17-sin-idea-articulado",
    categoria: "sin-idea-matriz",
    textoFuente:
      "Artículo único.- Agrégase, en el artículo 47 del decreto con fuerza de ley vigente, un nuevo inciso final del siguiente tenor: 'El reglamento determinará las condiciones de aplicación'.",
    proyecto: { boletin: "26001-13", titulo: "Modificación reglamentaria" },
    llmEsperado: { idea_matriz: null, cuerpos_legales: [] },
    expected: { idea_matriz_substring: null, cuerpos: [] },
  },

  // ── ADVERSARIOS de la META-PRUEBA (excluidos del gate; ver IDS_CASOS_ADVERSARIOS) ──
  // El mock FABRICA salida (no contenida en el texto): así la rama `fp` es alcanzable y se
  // demuestra que el gate puede FALLAR de verdad (no es teatro).
  {
    id: "adv01-idea-fabricada",
    categoria: "adversario",
    // El texto SOLO trae articulado; el "modelo" inventa una idea matriz fluida que el texto
    // NUNCA enuncia → NO es substring → falso positivo.
    textoFuente:
      "Artículo 1°.- Sustitúyese, en el artículo 3, la palabra 'podrá' por 'deberá'.",
    proyecto: { boletin: "90001-07", titulo: "Caso adversario idea" },
    llmEsperado: {
      idea_matriz:
        "el proyecto busca proteger a los consumidores frente a los abusos del mercado",
      cuerpos_legales: [],
    },
    expected: { idea_matriz_substring: null, cuerpos: [] },
  },
  {
    id: "adv02-cuerpo-fabricado",
    categoria: "adversario",
    // El "modelo" afirma una norma que el texto NO cita → cuerpo legal fabricado → falso positivo.
    textoFuente:
      "El proyecto tiene por objeto promover el reciclaje domiciliario en las comunas del país.",
    proyecto: { boletin: "90002-12", titulo: "Caso adversario cuerpo" },
    llmEsperado: {
      idea_matriz: "promover el reciclaje domiciliario en las comunas del país",
      cuerpos_legales: [{ norma: "Ley N° 21.999", articulos: ["artículo 7"] }],
    },
    expected: {
      idea_matriz_substring:
        "promover el reciclaje domiciliario en las comunas del país",
      cuerpos: [],
    },
  },
];

/**
 * Los casos ADVERSARIOS donde el mock fabrica salida. Se EXCLUYEN del set que mide el umbral
 * de deploy (`GOLDEN_SET_GATE`) y se usan AISLADOS en la meta-prueba `el gate puede fallar`,
 * para demostrar que la rama `fp` es real (la métrica está VIVA, no es tautología).
 */
export const IDS_CASOS_ADVERSARIOS: readonly string[] = [
  "adv01-idea-fabricada",
  "adv02-cuerpo-fabricado",
];

/** Compat: el id del primer caso adversario. */
export const ID_CASO_ADVERSARIO = IDS_CASOS_ADVERSARIOS[0]!;

/** El set que mide el umbral de deploy: el golden SIN los casos adversarios inyectados. */
export const GOLDEN_SET_GATE: CasoGolden[] = GOLDEN_SET.filter(
  (c) => !IDS_CASOS_ADVERSARIOS.includes(c.id),
);

/** Solo los casos adversarios: alimentan la meta-prueba de que el gate puede fallar. */
export const GOLDEN_SET_ADVERSARIO: CasoGolden[] = GOLDEN_SET.filter((c) =>
  IDS_CASOS_ADVERSARIOS.includes(c.id),
);

/** Métricas de la corrida del golden set (precision/recall + detalle por caso). */
export interface MetricasGolden {
  tp: number;
  fp: number;
  fn: number;
  /** tp/(tp+fp). Una idea fabricada o un cuerpo fabricado = fp → baja la precisión. */
  precision: number;
  /** tp/(tp+fn). */
  recall: number;
  detalle: { id: string; ok: boolean; nota: string }[];
}

/**
 * Evalúa la FIDELIDAD LITERAL del golden set corriendo `extraer` por caso con el `provider`
 * dado (mock en CI, DeepSeek real en LIVE). La unidad de conteo es el ÍTEM literal:
 *   - idea_matriz: si el expected es no-null, cuenta como 1 ítem esperado. El modelo "afirma"
 *     una idea si devuelve no-null. afirma ∧ es-substring-del-texto → tp; afirma ∧ NO-substring
 *     (paráfrasis/alucinación) → fp; expected no-null ∧ modelo devuelve null → fn.
 *     Si expected es null: el modelo afirmando algo (no-null) → fp (degradación deshonesta);
 *     el modelo devolviendo null → acierto silencioso (no suma ítem).
 *   - cuerpos_legales: F1 por conjunto de claves (norma+artículos normalizados). Cada cuerpo
 *     afirmado que está en el expected → tp; afirmado y NO en expected (fabricado) → fp; en
 *     expected y NO afirmado → fn.
 * precision = tp/(tp+fp); recall = tp/(tp+fn). El gate exige precision ≥ 0.95, recall ≥ 0.80.
 */
export async function evaluarGolden(
  set: CasoGolden[],
  // `extraer`-compatible: (textoFuente, proyecto, provider) → Promise<Ficha>. Se inyecta el
  // provider por caso vía el mock keyed; en LIVE, un DeepSeek real único.
  ejecutar: (caso: CasoGolden) => Promise<Ficha>,
): Promise<MetricasGolden> {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const detalle: { id: string; ok: boolean; nota: string }[] = [];

  for (const caso of set) {
    const ficha = await ejecutar(caso);
    const textoNorm = normalizarLiteral(caso.textoFuente);
    let casoOk = true;
    const notas: string[] = [];

    // ── idea_matriz: fidelidad literal por substring ──
    const afirmada = ficha.idea_matriz;
    const esperadaIdea = caso.expected.idea_matriz_substring;
    if (esperadaIdea !== null) {
      if (afirmada == null) {
        fn++; casoOk = false; notas.push("idea: esperaba literal, modelo devolvió null (fn)");
      } else if (textoNorm.includes(normalizarLiteral(afirmada))) {
        tp++; notas.push("idea: substring literal correcto (tp)");
      } else {
        fp++; casoOk = false;
        notas.push("idea: FALSO POSITIVO — idea_matriz NO es substring del texto (paráfrasis/alucinación)");
      }
    } else {
      // expected null: el modelo NO debe afirmar (degradación honesta).
      if (afirmada != null) {
        fp++; casoOk = false;
        notas.push("idea: FALSO POSITIVO — afirmó idea matriz cuando el texto no la enuncia");
      } else {
        notas.push("idea: degradación honesta (null) correcta");
      }
    }

    // ── cuerpos_legales: F1 por conjunto de claves norma+artículos ──
    const esperadosCuerpos = new Set(caso.expected.cuerpos.map(claveCuerpo));
    const afirmadosCuerpos = ficha.cuerpos_legales.map(claveCuerpo);
    const afirmadosSet = new Set(afirmadosCuerpos);
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

    detalle.push({ id: caso.id, ok: casoOk, nota: notas.join("; ") });
  }

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return { tp, fp, fn, precision, recall, detalle };
}
