/**
 * Etapa 2 del pipeline de adjudicación de TERCEROS (ENT-02): schema zod de la salida
 * del LLM + construcción del prompt del adjudicador de entidades.
 *
 * ESPEJO de `prompt.ts` (parlamentario) con DOS deltas:
 *
 *   Δ1 — `AdjudicacionEntidadSchema` copia `AdjudicacionSchema` cambiando SOLO el regex de
 *        `chosen_id` de `/^P\d{5}$/` a `/^E\d{5}$/` (formato id de entidad_tercero, A1).
 *        `decision`/`confidence`/`evidence`/`conflicts` quedan IDÉNTICOS → `aplicarCompuerta`
 *        (compuerta.ts) sirve sin cambios sobre esta salida.
 *
 *   Δ (dominio) — `SYSTEM_ADJUDICACION_ENTIDAD` reescribe el system para terceros (donantes,
 *        proveedores, gestores/contrapartes de lobby personas-NATURALES-homónimas — NO
 *        parlamentarios y NUNCA personas jurídicas: una jurídica jamás llega aquí, salta el LLM
 *        completo en pipeline-entidad). Mantiene las reglas anti-causalidad/anti-invención.
 *
 * `construirPromptEntidad` arma el `user` con SOLO el nombre tal como aparece + nombres de los
 * candidatos. NUNCA incluye RUT (la mención no lo transporta por diseño; el gate
 * `assertNoRutInLlmInput` lo enforce aguas arriba, pero el prompt no debe contenerlo por
 * construcción — minimización Ley 21.719).
 */

import { z } from "zod";
import type { EntidadTerceroRow } from "@obs/identity";
import type { MencionEntidadForanea } from "./tipos-entidad";

/**
 * Compuerta de contrato de la salida del adjudicador LLM de terceros (untrusted hasta
 * validarse). Δ1: idéntica a `AdjudicacionSchema` salvo el regex de `chosen_id` (`/^E\d{5}$/`).
 * Refine cruzado: `decision="match"` exige `chosen_id` no nulo — la compuerta dura
 * (`aplicarCompuerta`) lo vuelve a verificar (defensa en profundidad).
 */
export const AdjudicacionEntidadSchema = z
  .object({
    decision: z.enum(["match", "no_match", "uncertain"]),
    chosen_id: z
      .string()
      .regex(/^E\d{5}$/)
      .nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string().max(500)).max(10),
    conflicts: z.array(z.string().max(500)).max(10),
  })
  .refine((o) => o.decision !== "match" || o.chosen_id != null, {
    message: "decision=match requiere chosen_id no nulo",
  });

/** Salida validada del adjudicador de terceros. */
export type AdjudicacionEntidad = z.infer<typeof AdjudicacionEntidadSchema>;

/**
 * SYSTEM prompt en español, restrictivo y sin causalidad. Reescrito para TERCEROS personas
 * naturales homónimas (donantes/proveedores/gestores de lobby), no parlamentarios. Estable
 * (prompt-cache friendly): no depende de la mención. Va en `req.system`.
 */
export const SYSTEM_ADJUDICACION_ENTIDAD = `Eres un asistente de reconciliación de identidad de TERCEROS chilenos
(donantes, proveedores del Estado, gestores y contrapartes de lobby) que son PERSONAS NATURALES.
Tu única tarea es decidir si un REGISTRO (un nombre como aparece en una fuente) corresponde
a UNO de los CANDIDATOS de la tabla maestra de entidades, basándote SOLO en el nombre.
Reglas estrictas:
- Solo puedes elegir un chosen_id de la lista de candidatos provista, o null.
- Si hay cualquier ambigüedad (homónimo, abreviatura o iniciales que no resuelven
  unívocamente), responde decision="uncertain".
- Lista en "conflicts" cualquier inconsistencia (dos candidatos igual de plausibles).
- En "evidence" cita SOLO coincidencias de nombre. NUNCA infieras intención, parentesco,
  afiliación política, ni nada fuera de los datos provistos.
- NO inventes candidatos. NO uses conocimiento externo sobre estas personas.`;

/**
 * Construye el `user` del request del adjudicador para una mención de tercero + sus candidatos.
 * Incluye SOLO el nombre-como-aparece de la mención y el nombre normalizado de cada candidato
 * enumerado por su `id` (E00xxx). NUNCA incluye RUT (minimización; el gate lo reverifica).
 */
export function construirPromptEntidad(
  mencion: MencionEntidadForanea,
  candidatos: EntidadTerceroRow[],
): string {
  const lineasCandidatos = candidatos
    .map((c) => `- ${c.id}: ${c.nombre_normalizado} | tipo=${c.tipo_entidad}`)
    .join("\n");

  return `REGISTRO a reconciliar (tal como aparece en la fuente):
- nombre: ${mencion.nombreOriginal}
- tipo: ${mencion.tipoEntidad}

CANDIDATOS de la tabla maestra de entidades (elige SOLO un id de esta lista, o null):
${lineasCandidatos}

Decide si el REGISTRO corresponde a uno de los candidatos. Responde con decision,
chosen_id (un id de la lista o null), confidence entre 0 y 1, evidence y conflicts.
Ante cualquier ambigüedad responde decision="uncertain". NUNCA inventes un id ni uses
conocimiento externo: usa SOLO el nombre.`;
}
