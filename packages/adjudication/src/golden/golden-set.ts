/**
 * GOLDEN SET (ID-07) — conjunto etiquetado de casos difíciles de reconciliación de
 * identidad. Es el GATE DE DEPLOY del riesgo existencial #1: corre como test de
 * regresión (golden-set.test.ts) y si la precisión cae bajo el umbral, FALLA → bloquea CI.
 *
 * Un match equivocado NO produce un error: produce una afirmación falsa creíble. Por eso
 * un `auto-aceptar` de un id equivocado cuenta como FALSO POSITIVO (pesa al máximo en la
 * precisión). El set cubre OBLIGATORIAMENTE 5 categorías de dificultad:
 *   1. Abreviatura canónica: "Walker P., Matías" (apellido materno abreviado, Senado).
 *   2. Homónimos (dos candidatos igual de plausibles → revisión).
 *   3. Nombres de casada (apellido distinto del catálogo → blocking laxo recupera).
 *   4. Abreviaturas/iniciales (nombre con inicial).
 *   5. Cambios de grafía (acentos/ñ, tildes faltantes → normalizarNombre converge).
 * Más un `no_match` (mención que NO está en la maestra → no_confirmado, NUNCA auto-aceptar)
 * y un caso de REGIÓN distinta entre fuentes (verifica el blocking fail-open de 04-01).
 *
 * Cada caso fija `llmEsperado`: la `Adjudicacion` que el mock-provider devuelve para esa
 * mención en MODO CI (sin red). El bloque LIVE de la suite reemplaza el mock por el MiniMax
 * real y mide la precisión real de MiniMax-M3 contra el mismo umbral (gated por env).
 */

import type { Parlamentario } from "@obs/core";
import type { LLMProvider } from "@obs/llm";
import type { MencionForanea } from "../tipos";
import type { Adjudicacion } from "../prompt";
import { correrPipeline } from "../pipeline";
import type { PipelineWriter } from "../pipeline";
import type { CasoRevision, FilaAudit, FilaVinculo } from "../writer-revision";

/** Etiqueta esperada de un caso del golden set. */
export type Esperado =
  | { tipo: "match"; chosenId: string }
  | { tipo: "no_match" }
  | { tipo: "revision" };

/** Un caso etiquetado del golden set. */
export interface CasoGolden {
  id: string;
  /** Categoría de dificultad (para reporting/cobertura). */
  categoria:
    | "abreviatura-canonica"
    | "homonimo"
    | "nombre-casada"
    | "inicial"
    | "grafia"
    | "no-match"
    | "region-distinta";
  mencion: MencionForanea;
  /** Subconjunto de la maestra relevante para el caso (los candidatos plausibles). */
  maestraRelevante: Parlamentario[];
  /** Salida fija del adjudicador para el MODO CI (mock determinista). */
  llmEsperado: Adjudicacion;
  /** Etiqueta de oro del caso. */
  expected: Esperado;
}

const PERIODO_SENADO = "senado-vigente-2026";
const PERIODO_DIPUTADOS = "2026-2030";

/** Helper de construcción de un parlamentario de la maestra (campos por defecto). */
function p(over: Partial<Parlamentario> & { id: string }): Parlamentario {
  return {
    id: over.id,
    nombre_normalizado: over.nombre_normalizado ?? "",
    nombres: over.nombres ?? "",
    apellido_paterno: over.apellido_paterno ?? "",
    apellido_materno: over.apellido_materno ?? "",
    camara: over.camara ?? "senado",
    periodo: over.periodo ?? PERIODO_SENADO,
    region: over.region ?? null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: over.estado ?? "confirmado",
    email: null,
    origen: over.camara === "diputados" ? "diputados" : "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

function men(over: Partial<MencionForanea> & { nombreOriginal: string; tokens: string[] }): MencionForanea {
  return {
    nombreOriginal: over.nombreOriginal,
    nombreNormalizado: over.nombreNormalizado ?? over.tokens.join(" "),
    tokens: over.tokens,
    camara: over.camara ?? "senado",
    periodo: over.periodo ?? PERIODO_SENADO,
    region: over.region ?? null,
  };
}

function match(chosenId: string, confidence: number, evidence: string[] = ["coinciden nombre/cámara/periodo"]): Adjudicacion {
  return { decision: "match", chosen_id: chosenId, confidence, evidence, conflicts: [] };
}
function uncertain(conflicts: string[]): Adjudicacion {
  return { decision: "uncertain", chosen_id: null, confidence: 0.4, evidence: [], conflicts };
}
function noMatch(): Adjudicacion {
  return { decision: "no_match", chosen_id: null, confidence: 0.2, evidence: [], conflicts: [] };
}

// ── Maestra base reutilizable por varios casos ──
const WALKER_MATIAS = p({
  id: "P00042",
  nombre_normalizado: "walker prieto matias",
  nombres: "Matías",
  apellido_paterno: "Walker",
  apellido_materno: "Prieto",
  camara: "senado",
  region: "Coquimbo",
});

export const GOLDEN_SET: CasoGolden[] = [
  // ───── 1. Abreviatura canónica: "Walker P., Matías" (Senado) ─────
  {
    id: "g01-walker-canonico",
    categoria: "abreviatura-canonica",
    mencion: men({
      nombreOriginal: "Walker P., Matías",
      nombreNormalizado: "walker matias",
      tokens: ["walker", "matias"],
      camara: "senado",
      region: "Coquimbo",
    }),
    maestraRelevante: [WALKER_MATIAS],
    llmEsperado: match("P00042", 0.96, ["apellido paterno Walker + nombre Matías + Senado coinciden"]),
    expected: { tipo: "match", chosenId: "P00042" },
  },
  {
    id: "g02-walker-sin-region-failopen",
    categoria: "region-distinta",
    // La mención NO trae región (la fuente foránea no siempre la trae): el blocking
    // fail-open NO debe descartar al candidato real por ausencia de región (perder al
    // real = falso negativo silencioso). Verifica el fail-open de 04-01.
    mencion: men({
      nombreOriginal: "Walker Prieto, Matías", // único: evita colisión con los no_match de Walker
      nombreNormalizado: "walker matias",
      tokens: ["walker", "matias"],
      camara: "senado",
      region: null, // sin región → fail-open: el candidato con región NO se descarta
    }),
    maestraRelevante: [WALKER_MATIAS],
    llmEsperado: match("P00042", 0.93, ["apellido + nombre coinciden; mención sin región (fail-open)"]),
    expected: { tipo: "match", chosenId: "P00042" },
  },

  // ───── 2. Homónimos (dos candidatos igual de plausibles → revisión) ─────
  {
    id: "g03-homonimo-perez",
    categoria: "homonimo",
    mencion: men({
      nombreOriginal: "Pérez, Juan",
      nombreNormalizado: "perez juan",
      tokens: ["perez", "juan"],
      camara: "diputados",
      periodo: PERIODO_DIPUTADOS,
    }),
    maestraRelevante: [
      p({ id: "P00101", nombre_normalizado: "perez gonzalez juan", nombres: "Juan", apellido_paterno: "Pérez", apellido_materno: "González", camara: "diputados", periodo: PERIODO_DIPUTADOS, region: "Biobío" }),
      p({ id: "P00102", nombre_normalizado: "perez soto juan", nombres: "Juan", apellido_paterno: "Pérez", apellido_materno: "Soto", camara: "diputados", periodo: PERIODO_DIPUTADOS, region: "Maule" }),
    ],
    llmEsperado: uncertain(["dos candidatos Pérez Juan igual de plausibles (González vs Soto)"]),
    expected: { tipo: "revision" },
  },
  {
    id: "g04-homonimo-gonzalez",
    categoria: "homonimo",
    mencion: men({
      nombreOriginal: "González, María",
      nombreNormalizado: "gonzalez maria",
      tokens: ["gonzalez", "maria"],
      camara: "diputados",
      periodo: PERIODO_DIPUTADOS,
    }),
    maestraRelevante: [
      p({ id: "P00111", nombre_normalizado: "gonzalez rojas maria", nombres: "María", apellido_paterno: "González", apellido_materno: "Rojas", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
      p({ id: "P00112", nombre_normalizado: "gonzalez lobos maria", nombres: "María", apellido_paterno: "González", apellido_materno: "Lobos", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    ],
    llmEsperado: uncertain(["dos González María sin desempate posible por la mención"]),
    expected: { tipo: "revision" },
  },

  // ───── 3. Nombres de casada (apellido distinto del catálogo) ─────
  {
    id: "g05-casada-recupera",
    categoria: "nombre-casada",
    // La mención usa el apellido de soltera; el catálogo registra ambos. Blocking por
    // apellido paterno (soltera) recupera al candidato.
    mencion: men({
      nombreOriginal: "Vodanovic, Paulina",
      nombreNormalizado: "vodanovic paulina",
      tokens: ["vodanovic", "paulina"],
      camara: "senado",
    }),
    maestraRelevante: [
      p({ id: "P00121", nombre_normalizado: "vodanovic rojo paulina", nombres: "Paulina", apellido_paterno: "Vodanovic", apellido_materno: "Rojo", camara: "senado", region: "Maule" }),
    ],
    llmEsperado: match("P00121", 0.95, ["apellido paterno y nombre coinciden"]),
    expected: { tipo: "match", chosenId: "P00121" },
  },
  {
    id: "g06-casada-ambigua",
    categoria: "nombre-casada",
    // Apellido de casada en la mención, dos candidatas comparten el patrón → revisión.
    mencion: men({
      nombreOriginal: "Rivas de Soto, Carmen",
      nombreNormalizado: "rivas carmen",
      tokens: ["rivas", "carmen"],
      camara: "diputados",
      periodo: PERIODO_DIPUTADOS,
    }),
    maestraRelevante: [
      p({ id: "P00131", nombre_normalizado: "rivas munoz carmen", nombres: "Carmen", apellido_paterno: "Rivas", apellido_materno: "Muñoz", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
      p({ id: "P00132", nombre_normalizado: "rivas pena carmen", nombres: "Carmen", apellido_paterno: "Rivas", apellido_materno: "Peña", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    ],
    llmEsperado: uncertain(["nombre de casada ambiguo; dos Rivas Carmen"]),
    expected: { tipo: "revision" },
  },

  // ───── 4. Abreviaturas / iniciales (nombre con inicial) ─────
  {
    id: "g07-inicial-j-araya",
    categoria: "inicial",
    mencion: men({
      nombreOriginal: "Araya, J.",
      nombreNormalizado: "araya j",
      tokens: ["araya", "j"],
      camara: "diputados",
      periodo: PERIODO_DIPUTADOS,
    }),
    maestraRelevante: [
      p({ id: "P00141", nombre_normalizado: "araya guerrero jaime", nombres: "Jaime", apellido_paterno: "Araya", apellido_materno: "Guerrero", camara: "diputados", periodo: PERIODO_DIPUTADOS, region: "Antofagasta" }),
    ],
    llmEsperado: match("P00141", 0.91, ["único Araya con inicial J en la cámara/periodo"]),
    expected: { tipo: "match", chosenId: "P00141" },
  },
  {
    id: "g08-inicial-ambigua",
    categoria: "inicial",
    // Inicial que NO resuelve unívocamente (dos candidatos con la misma inicial) → revisión.
    mencion: men({
      nombreOriginal: "Castro, M.",
      nombreNormalizado: "castro m",
      tokens: ["castro", "m"],
      camara: "diputados",
      periodo: PERIODO_DIPUTADOS,
    }),
    maestraRelevante: [
      p({ id: "P00151", nombre_normalizado: "castro bravo manuel", nombres: "Manuel", apellido_paterno: "Castro", apellido_materno: "Bravo", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
      p({ id: "P00152", nombre_normalizado: "castro diaz marcela", nombres: "Marcela", apellido_paterno: "Castro", apellido_materno: "Díaz", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    ],
    llmEsperado: uncertain(["inicial M ambigua: Manuel vs Marcela Castro"]),
    expected: { tipo: "revision" },
  },

  // ───── 5. Cambios de grafía (acentos / ñ / tildes faltantes) ─────
  {
    id: "g09-grafia-nunez",
    categoria: "grafia",
    // Mención sin tilde / sin ñ; el normalizado converge al del catálogo.
    mencion: men({
      nombreOriginal: "Nunez, Ramon",
      nombreNormalizado: "nunez ramon",
      tokens: ["nunez", "ramon"],
      camara: "senado",
    }),
    maestraRelevante: [
      p({ id: "P00161", nombre_normalizado: "nunez vega ramon", nombres: "Ramón", apellido_paterno: "Núñez", apellido_materno: "Vega", camara: "senado", region: "O'Higgins" }),
    ],
    llmEsperado: match("P00161", 0.94, ["Núñez/Nunez y Ramón/Ramon convergen tras normalizar"]),
    expected: { tipo: "match", chosenId: "P00161" },
  },
  {
    id: "g10-grafia-saa",
    categoria: "grafia",
    mencion: men({
      nombreOriginal: "Sáa, María Antonieta",
      nombreNormalizado: "saa antonieta maria",
      tokens: ["saa", "antonieta", "maria"],
      camara: "diputados",
      periodo: PERIODO_DIPUTADOS,
    }),
    maestraRelevante: [
      p({ id: "P00171", nombre_normalizado: "saa diaz antonieta maria", nombres: "María Antonieta", apellido_paterno: "Sáa", apellido_materno: "Díaz", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    ],
    llmEsperado: match("P00171", 0.92, ["Sáa con tilde converge; nombre compuesto coincide"]),
    expected: { tipo: "match", chosenId: "P00171" },
  },

  // ───── no_match: mención que NO está en la maestra ─────
  {
    id: "g11-no-match-inexistente",
    categoria: "no-match",
    mencion: men({
      nombreOriginal: "Inexistente, Fulano",
      nombreNormalizado: "inexistente fulano",
      tokens: ["inexistente", "fulano"],
      camara: "senado",
    }),
    maestraRelevante: [WALKER_MATIAS], // ningún candidato comparte apellido
    llmEsperado: noMatch(),
    expected: { tipo: "no_match" },
  },
  {
    id: "g12-no-match-cross-camara",
    categoria: "no-match",
    // El apellido existe pero en la OTRA cámara: el blocking duro de cámara lo excluye.
    mencion: men({
      nombreOriginal: "Walker, Matías",
      nombreNormalizado: "walker matias",
      tokens: ["walker", "matias"],
      camara: "diputados", // Walker está en senado
      periodo: PERIODO_DIPUTADOS,
    }),
    maestraRelevante: [WALKER_MATIAS],
    llmEsperado: noMatch(),
    expected: { tipo: "no_match" },
  },

  // ───── Casos adicionales para robustez (≥20 total) ─────
  {
    id: "g13-match-directo-senado",
    categoria: "abreviatura-canonica",
    mencion: men({ nombreOriginal: "Provoste, Yasna", nombreNormalizado: "provoste yasna", tokens: ["provoste", "yasna"], camara: "senado", region: "Atacama" }),
    maestraRelevante: [p({ id: "P00181", nombre_normalizado: "provoste campillay yasna", nombres: "Yasna", apellido_paterno: "Provoste", apellido_materno: "Campillay", camara: "senado", region: "Atacama" })],
    llmEsperado: match("P00181", 0.98),
    expected: { tipo: "match", chosenId: "P00181" },
  },
  {
    id: "g14-match-directo-diputado",
    categoria: "abreviatura-canonica",
    mencion: men({ nombreOriginal: "Mirosevic, Vlado", nombreNormalizado: "mirosevic vlado", tokens: ["mirosevic", "vlado"], camara: "diputados", periodo: PERIODO_DIPUTADOS, region: "Arica y Parinacota" }),
    maestraRelevante: [p({ id: "P00191", nombre_normalizado: "mirosevic verdugo vlado", nombres: "Vlado", apellido_paterno: "Mirosevic", apellido_materno: "Verdugo", camara: "diputados", periodo: PERIODO_DIPUTADOS, region: "Arica y Parinacota" })],
    llmEsperado: match("P00191", 0.97),
    expected: { tipo: "match", chosenId: "P00191" },
  },
  {
    id: "g15-grafia-ohiggins",
    categoria: "grafia",
    mencion: men({ nombreOriginal: "Bórquez, José", nombreNormalizado: "borquez jose", tokens: ["borquez", "jose"], camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    maestraRelevante: [p({ id: "P00201", nombre_normalizado: "borquez montecinos jose", nombres: "José", apellido_paterno: "Bórquez", apellido_materno: "Montecinos", camara: "diputados", periodo: PERIODO_DIPUTADOS })],
    llmEsperado: match("P00201", 0.93),
    expected: { tipo: "match", chosenId: "P00201" },
  },
  {
    id: "g16-inicial-resuelve",
    categoria: "inicial",
    mencion: men({ nombreOriginal: "Sepúlveda, A.", nombreNormalizado: "sepulveda a", tokens: ["sepulveda", "a"], camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    maestraRelevante: [p({ id: "P00211", nombre_normalizado: "sepulveda orbenes alejandra", nombres: "Alejandra", apellido_paterno: "Sepúlveda", apellido_materno: "Órbenes", camara: "diputados", periodo: PERIODO_DIPUTADOS })],
    llmEsperado: match("P00211", 0.9),
    expected: { tipo: "match", chosenId: "P00211" },
  },
  {
    id: "g17-homonimo-tres",
    categoria: "homonimo",
    mencion: men({ nombreOriginal: "Soto, Raúl", nombreNormalizado: "soto raul", tokens: ["soto", "raul"], camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    maestraRelevante: [
      p({ id: "P00221", nombre_normalizado: "soto mardones raul", nombres: "Raúl", apellido_paterno: "Soto", apellido_materno: "Mardones", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
      p({ id: "P00222", nombre_normalizado: "soto ferrada raul", nombres: "Raúl", apellido_paterno: "Soto", apellido_materno: "Ferrada", camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    ],
    llmEsperado: uncertain(["dos Soto Raúl igual de plausibles"]),
    expected: { tipo: "revision" },
  },
  {
    id: "g18-casada-clara",
    categoria: "nombre-casada",
    mencion: men({ nombreOriginal: "Carvajal, Loreto", nombreNormalizado: "carvajal loreto", tokens: ["carvajal", "loreto"], camara: "senado" }),
    maestraRelevante: [p({ id: "P00231", nombre_normalizado: "carvajal ambiado loreto", nombres: "Loreto", apellido_paterno: "Carvajal", apellido_materno: "Ambiado", camara: "senado", region: "Ñuble" })],
    llmEsperado: match("P00231", 0.95),
    expected: { tipo: "match", chosenId: "P00231" },
  },
  {
    id: "g19-region-distinta-failopen-2",
    categoria: "region-distinta",
    mencion: men({ nombreOriginal: "Castro González, Juan Luis", nombreNormalizado: "castro gonzalez juan luis", tokens: ["castro", "gonzalez", "juan", "luis"], camara: "senado", region: "Metropolitana" }),
    maestraRelevante: [p({ id: "P00241", nombre_normalizado: "castro gonzalez juan luis", nombres: "Juan Luis", apellido_paterno: "Castro", apellido_materno: "González", camara: "senado", region: "O'Higgins" })],
    llmEsperado: match("P00241", 0.92, ["nombre completo coincide; región difiere (fail-open)"]),
    expected: { tipo: "match", chosenId: "P00241" },
  },
  {
    id: "g20-no-match-otro-periodo",
    categoria: "no-match",
    mencion: men({ nombreOriginal: "Walker, Matías", nombreNormalizado: "walker matias", tokens: ["walker", "matias"], camara: "senado", periodo: "senado-vigente-2018" }),
    maestraRelevante: [WALKER_MATIAS],
    llmEsperado: noMatch(),
    expected: { tipo: "no_match" },
  },
  {
    id: "g21-grafia-ñ-explicita",
    categoria: "grafia",
    mencion: men({ nombreOriginal: "Yáñez, Gael", nombreNormalizado: "yanez gael", tokens: ["yanez", "gael"], camara: "diputados", periodo: PERIODO_DIPUTADOS }),
    maestraRelevante: [p({ id: "P00251", nombre_normalizado: "yanez soto gael", nombres: "Gael", apellido_paterno: "Yáñez", apellido_materno: "Soto", camara: "diputados", periodo: PERIODO_DIPUTADOS })],
    llmEsperado: match("P00251", 0.94),
    expected: { tipo: "match", chosenId: "P00251" },
  },
  {
    id: "g22-inicial-y-grafia",
    categoria: "inicial",
    mencion: men({ nombreOriginal: "Ñúñez, P.", nombreNormalizado: "nunez p", tokens: ["nunez", "p"], camara: "senado" }),
    maestraRelevante: [p({ id: "P00261", nombre_normalizado: "nunez urrutia paulina", nombres: "Paulina", apellido_paterno: "Núñez", apellido_materno: "Urrutia", camara: "senado", region: "Antofagasta" })],
    llmEsperado: match("P00261", 0.91),
    expected: { tipo: "match", chosenId: "P00261" },
  },
];

/** Métricas de la corrida del golden set (precision/recall + detalle por caso). */
export interface MetricasGolden {
  tp: number;
  fp: number;
  fn: number;
  /** tp/(tp+fp). Un auto-aceptar de id equivocado = fp → baja la precisión (gate de deploy). */
  precision: number;
  /** tp/(tp+fn). */
  recall: number;
  detalle: { id: string; ok: boolean; nota: string }[];
}

/** Writer no-op in-memory: el golden set evalúa el pipeline sin tocar la DB. */
class NoopWriter implements PipelineWriter {
  async upsertVinculo(_v: FilaVinculo): Promise<void> {}
  async appendAudit(_row: FilaAudit): Promise<void> {}
  async enqueueRevision(_caso: CasoRevision): Promise<void> {}
}

/**
 * Evalúa el golden set corriendo el pipeline real por caso con el `provider` dado
 * (mock en CI, MiniMax real en LIVE). Conteo (precision = tp/(tp+fp), recall = tp/(tp+fn)):
 *  - expected match: el pipeline confirma (determinista) o auto-acepta (probable) el id
 *    correcto → tp; un id EQUIVOCADO → fp (afirmación falsa creíble, pesa al máximo); no
 *    afirmar (revisión/no_confirmado) → fn.
 *  - expected revision: enruta a revisión → tp; auto-acepta → fp; no_confirmado → fn.
 *  - expected no_match: NO afirma identidad → tp; afirma → fp.
 */
export async function evaluarGolden(
  set: CasoGolden[],
  provider: LLMProvider,
): Promise<MetricasGolden> {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const detalle: { id: string; ok: boolean; nota: string }[] = [];

  for (const caso of set) {
    const res = await correrPipeline(
      caso.mencion,
      caso.maestraRelevante,
      provider,
      new NoopWriter(),
    );

    const afirmoId =
      res.tipo === "determinista" || res.tipo === "probable"
        ? res.parlamentarioId
        : null;
    const fueRevision = res.tipo === "revision";

    let ok = false;
    let nota = "";
    if (caso.expected.tipo === "match") {
      if (afirmoId === caso.expected.chosenId) {
        tp++; ok = true; nota = `match correcto ${afirmoId}`;
      } else if (afirmoId != null) {
        fp++; nota = `FALSO POSITIVO: afirmó ${afirmoId}, esperaba ${caso.expected.chosenId}`;
      } else {
        fn++; nota = `no recuperó el match (res=${res.tipo})`;
      }
    } else if (caso.expected.tipo === "revision") {
      if (fueRevision) {
        tp++; ok = true; nota = "enrutó a revisión como se esperaba";
      } else if (afirmoId != null) {
        fp++; nota = `FALSO POSITIVO: auto-aceptó ${afirmoId} en un caso de revisión`;
      } else {
        fn++; nota = `no enrutó a revisión (res=${res.tipo})`;
      }
    } else {
      if (afirmoId == null) {
        tp++; ok = true; nota = `no afirmó identidad (res=${res.tipo}) como se esperaba`;
      } else {
        fp++; nota = `FALSO POSITIVO: afirmó ${afirmoId} en un no_match`;
      }
    }
    detalle.push({ id: caso.id, ok, nota });
  }

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return { tp, fp, fn, precision, recall, detalle };
}
