/**
 * Contrato del JUEZ LLM (@obs/llm) — SEPARADO de `LLMProvider`.
 *
 * El juez NO es un responder: no completa un prompt arbitrario contra un schema,
 * sino que EMITE UN VEREDICTO sobre una respuesta ya producida. Por eso vive en su
 * propia interfaz `JudgeProvider` (NO se pliega dentro de `LLMProvider`).
 *
 * Conceptualmente el juez es ESCALATE-ONLY: en la composicion escalonada solo se
 * invoca para dirimir casos dudosos. Esa PLOMERIA (cuando escalar) la cablea la
 * Phase 108; la Phase 107 SOLO MIDE la capacidad del juez contra etiquetas humanas
 * (golden de 106) — aqui vive nada mas el contrato + los adapters.
 *
 * Los guards fail-closed del responder aplican IGUAL al juez: ningun RUT cruza al
 * prompt (se guarda `answer` Y `system`), y el gate de sensibilidad corre antes de
 * cualquier red. El golden de juez es NO-PII por construccion (`sensitivity`
 * defaultea a "public"), pero el guard MUERDE igual si un RUT se colara.
 */
import { z } from "zod";
import type { Sensitivity } from "./types";

/**
 * Request del juez. Forma LOCKED (Plan 107-02/03 compilan contra ella; NO renombrar
 * campos en Wave 2):
 * - `answer`: el texto de la RESPUESTA a juzgar — guardado por assertNoRutInLlmInput.
 * - `system`: rubrica/sistema opcional — TAMBIEN guardado por assertNoRutInLlmInput.
 * - `sensitivity`: default "public" (el golden de juez es NO-PII por construccion).
 * - `temperature`: default 0 (determinismo del veredicto).
 * - `context`: contexto extra opcional para el prompt del juez.
 */
export interface JudgeRequest {
  /** Texto de la respuesta a juzgar — guardado por assertNoRutInLlmInput. */
  answer: string;
  /** Sistema/rubrica opcional — TAMBIEN guardado por assertNoRutInLlmInput. */
  system?: string;
  /** Sensibilidad del dato; default "public". */
  sensitivity?: Sensitivity;
  /** Temperatura; default 0 (determinismo). */
  temperature?: number;
  /** Contexto extra opcional para el prompt del juez. */
  context?: string;
}

/**
 * Veredicto validado por zod. `ok` = pasa/no-pasa; `reason`/`confidence` son
 * opcionales (el modelo puede omitirlos). La forma es LOCKED (Wave 2 la consume).
 */
export const VerdictSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * Interfaz del provider de juez. Un adapter (p.ej. `PhiJudge`) la implementa;
 * `judge` devuelve un `Verdict` YA validado contra `VerdictSchema` — la compuerta
 * de validacion es externa al adapter (`parseAndValidate`), nunca el adapter valida
 * por su cuenta (misma disciplina que `LLMProvider`).
 */
export interface JudgeProvider {
  /** Identificador estable del juez (p.ej. "phi-judge"). */
  readonly id: string;
  /**
   * `true` si el juez entrena con sus inputs. Gate del fail-closed de sensibilidad
   * (dato personal + trainsOnInputs => aborta). Es un GATE LEGAL, no conveniencia.
   */
  readonly trainsOnInputs: boolean;
  /** Emite un veredicto validado sobre `req.answer`. */
  judge(req: JudgeRequest): Promise<Verdict>;
}
