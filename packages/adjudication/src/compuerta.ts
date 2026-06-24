/**
 * Etapa 3 del pipeline (ID-04): la COMPUERTA fail-closed. El corazón crítico que
 * sella el riesgo existencial #1 (un match equivocado = afirmación falsa creíble).
 *
 * ⚠️ BUG EXISTENCIAL #1 (Pitfall 1): el operador del umbral DEBE ser `<` ESTRICTO.
 * Invertirlo (`>`) o relajarlo (`<=`) auto-aceptaría matches que deberían ir a
 * revisión. Por eso el test del BORDE EXACTO (confidence===0.90 → auto-aceptar;
 * 0.8999 → revisión) es MANDATORIO (T-04-01) y vive en compuerta.test.ts.
 *
 * FAIL-CLOSED: la función acumula TODAS las razones de fallo (no corto-circuita) y
 * solo devuelve `auto-aceptar` si la lista queda VACÍA. Cualquier razón → `revision`.
 * Es función PURA: no toca red, no escribe estado; el mapeo a `probable` (NUNCA
 * `confirmado`, A4) lo hace el orquestador del pipeline aguas arriba.
 */

import type { Parlamentario } from "@obs/core";
import type { MencionForanea, DecisionCompuerta } from "./tipos";
import type { Adjudicacion } from "./prompt";

/**
 * Umbral de confianza asimétrico (preferir falso negativo). Comparación ESTRICTA
 * `<`: confidence===UMBRAL PASA la regla. NO cambiar a `<=` ni invertir a `>`.
 *
 * Exportado para que la compuerta de TERCEROS (pipeline-entidad) REUSE el MISMO umbral y
 * el MISMO operador estricto — un único punto de verdad del umbral 0.90 (sin duplicarlo ni
 * arriesgar drift entre parlamentario y entidad).
 */
export const UMBRAL = 0.9;

/**
 * Aplica las reglas duras de la compuerta sobre la salida (ya validada por zod) del
 * adjudicador. Devuelve `auto-aceptar` SOLO si todas pasan; cualquier fallo → `revision`
 * con la lista acumulada de razones.
 */
export function aplicarCompuerta(
  llm: Adjudicacion,
  mencion: MencionForanea,
  candidatos: Parlamentario[],
): DecisionCompuerta {
  const razones: string[] = [];

  // 1. La decisión del modelo debe ser un match afirmativo.
  if (llm.decision !== "match") {
    razones.push(`decision del modelo no es match (es "${llm.decision}")`);
  }

  // 2. Confianza bajo el umbral (estricto <: el borde 0.90 PASA).
  if (llm.confidence < UMBRAL) {
    razones.push(`confianza ${llm.confidence} bajo el umbral ${UMBRAL}`);
  }

  // 3. El modelo reportó inconsistencias.
  if (llm.conflicts.length > 0) {
    razones.push(`el modelo reportó conflicts: ${llm.conflicts.join("; ")}`);
  }

  // 4. chosen_id debe ser un candidato de la lista provista (no fabricado).
  const elegido =
    llm.chosen_id != null
      ? candidatos.find((c) => c.id === llm.chosen_id)
      : undefined;
  if (llm.chosen_id == null) {
    razones.push("chosen_id es null");
  } else if (elegido === undefined) {
    razones.push(`chosen_id "${llm.chosen_id}" no está entre los candidatos`);
  }

  // 5. Consistencia cámara/periodo entre el candidato elegido y la mención.
  if (elegido !== undefined) {
    if (elegido.camara !== mencion.camara) {
      razones.push(
        `inconsistencia de cámara: candidato=${elegido.camara}, mención=${mencion.camara}`,
      );
    }
    if (elegido.periodo !== mencion.periodo) {
      razones.push(
        `inconsistencia de periodo: candidato=${elegido.periodo}, mención=${mencion.periodo}`,
      );
    }
  }

  // FAIL-CLOSED: cualquier razón → revisión humana.
  if (razones.length > 0) {
    return { ruta: "revision", razones };
  }
  // Lista vacía: todas las reglas pasaron. chosen_id es no-nulo y existe (reglas 4-5).
  return { ruta: "auto-aceptar", chosenId: llm.chosen_id! };
}
