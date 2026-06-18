/**
 * Etapa 2 del pipeline de adjudicación (ID-03): schema zod de la salida del LLM +
 * construcción del prompt del adjudicador.
 *
 * `AdjudicacionSchema` es la compuerta de contrato de la salida untrusted del
 * modelo (T-04-03): enum de decisión, `chosen_id` con formato `P\d{5}` o null,
 * confidence en [0,1], y un refine cruzado que prohíbe `decision="match"` con
 * `chosen_id=null`. `parseAndValidate` de @obs/llm la aplica (compuerta única + repair).
 *
 * `construirPromptAdjudicacion` arma el `user` del request con SOLO el nombre tal
 * como aparece + nombres/cámara/periodo/región de los candidatos. NUNCA incluye RUT
 * (la mención no lo transporta por diseño; T-04-02). El prompt es restrictivo: el
 * modelo elige SOLO de la lista o null, responde "uncertain" ante ambigüedad, y
 * NUNCA infiere intención/parentesco ni usa conocimiento externo (riesgo existencial #2).
 */

import { z } from "zod";
import type { Parlamentario } from "@obs/core";
import type { MencionForanea } from "./tipos";

/**
 * Compuerta de contrato de la salida del adjudicador LLM (untrusted hasta validarse).
 * Refine cruzado: `decision="match"` exige `chosen_id` no nulo — la compuerta dura
 * (`aplicarCompuerta`) lo vuelve a verificar (defensa en profundidad).
 */
export const AdjudicacionSchema = z
  .object({
    decision: z.enum(["match", "no_match", "uncertain"]),
    chosen_id: z
      .string()
      .regex(/^P\d{5}$/)
      .nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string().max(500)).max(10),
    conflicts: z.array(z.string().max(500)).max(10),
  })
  .refine((o) => o.decision !== "match" || o.chosen_id != null, {
    message: "decision=match requiere chosen_id no nulo",
  });

/** Salida validada del adjudicador. */
export type Adjudicacion = z.infer<typeof AdjudicacionSchema>;

/**
 * SYSTEM prompt en español, restrictivo y sin causalidad (riesgo existencial #2).
 * Estable (prompt-cache friendly): no depende de la mención. Va en `req.system`.
 */
export const SYSTEM_ADJUDICACION = `Eres un asistente de reconciliación de identidad de parlamentarios chilenos.
Tu única tarea es decidir si un REGISTRO (un nombre como aparece en una fuente) corresponde
a UNO de los CANDIDATOS de la tabla maestra, basándote SOLO en nombre, cámara, periodo y región.
Reglas estrictas:
- Solo puedes elegir un chosen_id de la lista de candidatos provista, o null.
- Si hay cualquier ambigüedad (homónimo, nombre de casada, abreviatura que no resuelve
  unívocamente), responde decision="uncertain".
- Lista en "conflicts" cualquier inconsistencia (cámara/periodo distintos, dos candidatos igual de plausibles).
- En "evidence" cita SOLO coincidencias de nombre/cámara/periodo/región. NUNCA infieras
  intención, parentesco político, ni nada fuera de los datos provistos.
- NO inventes candidatos. NO uses conocimiento externo sobre estas personas.`;

/**
 * Construye el `user` del request del adjudicador para una mención + sus candidatos.
 * Incluye SOLO datos no sensibles (nombre-como-aparece, cámara, periodo, región).
 * Enumera cada candidato por su `id` (P00xxx) + nombres + cámara + periodo + región
 * para que el modelo elija de la lista cerrada (o null).
 */
export function construirPromptAdjudicacion(
  mencion: MencionForanea,
  candidatos: Parlamentario[],
): string {
  const lineasCandidatos = candidatos
    .map((c) => {
      const nombre = `${c.nombres} ${c.apellido_paterno} ${c.apellido_materno}`.trim();
      const region = c.region ?? "(sin región)";
      return `- ${c.id}: ${nombre} | cámara=${c.camara} | periodo=${c.periodo} | región=${region}`;
    })
    .join("\n");

  return `REGISTRO a reconciliar (tal como aparece en la fuente):
- nombre: ${mencion.nombreOriginal}
- cámara: ${mencion.camara}
- periodo: ${mencion.periodo}
- región: ${mencion.region ?? "(sin región)"}

CANDIDATOS de la tabla maestra (elige SOLO un id de esta lista, o null):
${lineasCandidatos}

Decide si el REGISTRO corresponde a uno de los candidatos. Responde con decision,
chosen_id (un id de la lista o null), confidence entre 0 y 1, evidence y conflicts.
Ante cualquier ambigüedad responde decision="uncertain". NUNCA inventes un id ni uses
conocimiento externo: usa SOLO nombre, cámara, periodo y región.`;
}
