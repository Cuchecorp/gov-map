/**
 * GOLDEN SET de la CLASIFICACIÓN DE SECTOR (CRUCE-02) — el contrato de calidad del clasificador
 * ANTES de la corrida LIVE de Plan 04. Espeja la ESTRUCTURA del golden de @obs/fichas
 * (`CasoGolden[]`, `MetricasGolden`, `evaluarGolden`, `GOLDEN_SET_GATE`) pero REEMPLAZA el
 * scoring de substring/F1 por SINGLE-LABEL TOP-1 + ABSTENCIÓN (D-07/D-08).
 *
 * El modo de fallo aquí NO es "fabricar texto" (ese es el de extracción literal de fichas): es
 * ASIGNAR UN SECTOR EQUIVOCADO. Por eso el scoring distingue tres resultados por caso:
 *   - `actual === expected` (match exacto del código)            → CORRECTO (cubierto).
 *   - `actual === null` (abstención del modelo)                  → NO-CUBIERTO (baja cobertura;
 *     NUNCA cuenta como error — la abstención es first-class, D-08 / RESEARCH Pitfall 3).
 *   - `actual !== null && actual !== expected` (sector distinto) → MISCLASIFICACIÓN (error).
 *
 * Métricas: `cobertura = #correctos / #total`; `errores = #misclasificaciones`.
 * `GOLDEN_SET_GATE` corre sobre la MUESTRA de 10 casos no-null del set y exige
 * `cobertura ≥ 0.7` (≥7/10 correctos) Y `errores === 0` (cero misclasificaciones). NO se copian
 * los umbrales precision≥0.95/recall≥0.80 ni el F1 por substring (son de extracción literal).
 *
 * Los casos viven en `casos.json` (D-06: el set LLM-propone + humano-valida es el golden). Cada
 * caso fija el `sector_codigo` de oro (o `null` para abstención esperada). En CI el `ejecutar`
 * se alimenta del mock-provider (sin red); el bloque LIVE (golden-set.test.ts) cambia el mock
 * por DeepSeek/MiniMax reales — NO corre en CI (espejo de fichas golden-set.ts:13-15).
 */

import { z } from "zod";
import { SECTOR_CODIGOS } from "../sector";
import type { ClasificacionSector } from "../model";
import type {
  ClasificarFichaInput,
  ClasificarContraparteInput,
} from "../clasificar";
import casosRaw from "./casos.json" with { type: "json" };

/** Umbral del gate (CRUCE-02): cobertura mínima sobre la muestra y cero misclasificaciones. */
export const COBERTURA_MIN = 0.7;

/** Esquema de un caso del golden (validación del JSON al cargar — el set es untrusted en disco). */
const SectorEsperadoSchema = z.enum(SECTOR_CODIGOS).nullable();

const CasoGoldenSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(["ficha", "contraparte"]),
  /** Marca los casos de la MUESTRA del gate (los 10 no-null que el ≥7/10 evalúa). */
  muestra: z.boolean().optional(),
  /** Contexto a clasificar. Para `ficha`: idea_matriz/titulo/materia. Para `contraparte`: nombre/materia. */
  input: z.object({
    idea_matriz: z.string().nullable().optional(),
    titulo: z.string().nullable().optional(),
    materia: z.string().nullable().optional(),
    nombre: z.string().optional(),
  }),
  /** Código de oro, o `null` cuando la abstención es la respuesta correcta. */
  sector_codigo: SectorEsperadoSchema,
});

/** Un caso etiquetado del golden de sector. */
export type CasoGolden = z.infer<typeof CasoGoldenSchema>;

/**
 * El golden completo, validado al cargar desde `casos.json` (~40 casos, D-06). El parse zod es
 * la compuerta: un caso con un `sector_codigo` fuera de la taxonomía o un `tipo` inválido
 * rompe el build/test, no se cuela en silencio.
 */
export const GOLDEN_SET: CasoGolden[] = z.array(CasoGoldenSchema).parse(casosRaw);

/**
 * La MUESTRA del gate: los casos marcados `muestra:true` (los 10 no-null que el ≥7/10 evalúa).
 * El gate NO se mide sobre los ~40 (que incluyen abstenciones esperadas): se mide sobre la
 * muestra curada de casos con sector asignable.
 */
export const GOLDEN_SET_GATE: CasoGolden[] = GOLDEN_SET.filter((c) => c.muestra === true);

/** Resultado del scoring por caso (para reporting). */
export type ResultadoCaso = "correcto" | "no-cubierto" | "misclasificacion";

/** Métricas de la corrida del golden de sector (single-label top-1 + abstención). */
export interface MetricasGolden {
  total: number;
  /** #casos con `actual === expected` (match exacto). */
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
 * Convierte el `input` de un caso al input tipado del clasificador según `tipo`. Para
 * `contraparte`, `nombre` es obligatorio (lo garantiza el set; si faltara, string vacío).
 */
export function inputDeCaso(
  caso: CasoGolden,
):
  | { tipo: "ficha"; input: ClasificarFichaInput }
  | { tipo: "contraparte"; input: ClasificarContraparteInput } {
  if (caso.tipo === "contraparte") {
    return {
      tipo: "contraparte",
      input: {
        nombre: caso.input.nombre ?? "",
        ...(caso.input.materia != null ? { materia: caso.input.materia } : {}),
      },
    };
  }
  return {
    tipo: "ficha",
    input: {
      ...(caso.input.idea_matriz != null ? { idea_matriz: caso.input.idea_matriz } : {}),
      ...(caso.input.titulo != null ? { titulo: caso.input.titulo } : {}),
      ...(caso.input.materia != null ? { materia: caso.input.materia } : {}),
    },
  };
}

/**
 * Evalúa el golden corriendo `ejecutar` por caso (mock en CI, DeepSeek/MiniMax en LIVE) y
 * puntúa SINGLE-LABEL TOP-1 + ABSTENCIÓN:
 *   - actual === expected            → correcto (cubierto).
 *   - actual === null                → no-cubierto (baja cobertura; NUNCA error, D-08).
 *   - actual !== null ≠ expected     → misclasificación (error).
 * cobertura = correctos/total; errores = misclasificaciones.
 */
export async function evaluarGolden(
  set: CasoGolden[],
  ejecutar: (caso: CasoGolden) => Promise<ClasificacionSector>,
): Promise<MetricasGolden> {
  let correctos = 0;
  let noCubiertos = 0;
  let misclasificaciones = 0;
  const detalle: { id: string; resultado: ResultadoCaso; nota: string }[] = [];

  for (const caso of set) {
    const out = await ejecutar(caso);
    const actual = out.sector_codigo;
    const expected = caso.sector_codigo;

    let resultado: ResultadoCaso;
    let nota: string;
    if (actual === null) {
      // Abstención: el modelo no asignó sector. Baja cobertura, NUNCA es error (D-08).
      resultado = "no-cubierto";
      noCubiertos++;
      nota = "abstención (null) → no-cubierto (no es error)";
    } else if (actual === expected) {
      resultado = "correcto";
      correctos++;
      nota = `match exacto (${actual})`;
    } else {
      // Asignó un sector DISTINTO al de oro: el modo de fallo real del clasificador.
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
 * Decide si el gate PASA: cobertura sobre la muestra ≥ COBERTURA_MIN (≥7/10 no-null correctos)
 * Y cero misclasificaciones entre los no-null. Pura (testeable sin red).
 */
export function gatePasa(m: MetricasGolden): boolean {
  return m.cobertura >= COBERTURA_MIN && m.errores === 0;
}
