/**
 * Compuerta fail-closed de TERCEROS (ENT-04). REUSA el `UMBRAL` 0.90 y el operador ESTRICTO `<`
 * de `compuerta.ts` (un único punto de verdad del umbral) — no redefine ni relaja la regla. Es
 * el espejo de `aplicarCompuerta` SIN la regla 5 (consistencia cámara/periodo), inaplicable a
 * terceros (la maestra de entidades no tiene cámara/periodo, sólo `tipo_entidad`).
 *
 * ⚠️ BUG EXISTENCIAL: el operador del umbral DEBE ser `<` ESTRICTO (confidence===0.90 → auto-aceptar;
 * 0.8999 → revisión). Se reusa `UMBRAL` de compuerta.ts para que un cambio jamás divergiera entre
 * parlamentario y entidad. FAIL-CLOSED: acumula TODAS las razones; sólo `auto-aceptar` si la lista
 * queda VACÍA. Función PURA.
 */

import type { EntidadTerceroRow } from "@obs/identity";
import { UMBRAL } from "./compuerta";
import type { AdjudicacionEntidad } from "./prompt-entidad";
import type { DecisionCompuertaEntidad, MencionEntidadForanea } from "./tipos-entidad";

/**
 * Aplica las reglas duras de la compuerta sobre la salida (ya validada por zod) del adjudicador
 * de terceros. Devuelve `auto-aceptar` SOLO si todas pasan; cualquier fallo → `revision` con la
 * lista acumulada de razones.
 */
export function aplicarCompuertaEntidad(
  llm: AdjudicacionEntidad,
  mencion: MencionEntidadForanea,
  candidatos: EntidadTerceroRow[],
): DecisionCompuertaEntidad {
  const razones: string[] = [];

  // 1. La decisión del modelo debe ser un match afirmativo.
  if (llm.decision !== "match") {
    razones.push(`decision del modelo no es match (es "${llm.decision}")`);
  }

  // 2. Confianza bajo el umbral (ESTRICTO <: el borde 0.90 PASA). Mismo UMBRAL que parlamentario.
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

  // 5. Consistencia de tipo_entidad entre el candidato elegido y la mención (espejo de la regla
  //    cámara/periodo de parlamentario, adaptada al discriminador de terceros).
  if (elegido !== undefined && elegido.tipo_entidad !== mencion.tipoEntidad) {
    razones.push(
      `inconsistencia de tipo: candidato=${elegido.tipo_entidad}, mención=${mencion.tipoEntidad}`,
    );
  }

  // FAIL-CLOSED: cualquier razón → revisión humana.
  if (razones.length > 0) {
    return { ruta: "revision", razones };
  }
  return { ruta: "auto-aceptar", chosenId: llm.chosen_id! };
}
