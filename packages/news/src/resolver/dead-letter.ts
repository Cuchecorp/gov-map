// dead-letter.ts — writer del descarte con causa (Phase 134, SC3; tabla 0086).
//
// `null` en cualquier eslabón ⇒ una fila aquí con su `rejection_stage`. El payload es
// TÉCNICO y ACOTADO (zod strict + el CHECK de 4000 bytes de la 0086): JAMÁS texto completo
// del artículo, jamás PII — mismo régimen que el golden (D-133-F2). Nada se fabrica: si el
// insert del dead-letter falla, se LANZA (un rechazo que se pierde en silencio es un dato
// fabricado por omisión).

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Espejo 1:1 del CHECK de `rejection_stage` en 0086 — si divergen, el insert falla LOUD. */
export const REJECTION_STAGES = [
  "parse_fallido",
  "confianza_bajo_umbral",
  "emision_fuera_de_lista",
  "boletin_no_resuelto",
  "parlamentario_no_resuelto",
  "lote_invalido",
] as const;

export const RejectionStageSchema = z.enum(REJECTION_STAGES);
export type RejectionStage = z.infer<typeof RejectionStageSchema>;

/** Payload técnico permitido — `.strict()`: un campo extra (p.ej. `texto`) NO compila ni
 * valida. `emision` (≤200 chars) es LA EMISIÓN DEL LLM (un boletín o un nombre), JAMÁS el
 * titular ni la descripción de la noticia — pasar texto del artículo aquí es un mal uso que
 * el schema no puede distinguir (hallazgo MEDIUM de la verificación 134): la regla es del
 * llamador y se re-verifica en el code-review de 135. */
export const DeadLetterPayloadSchema = z
  .object({
    emision: z.string().max(200).optional(),
    etiqueta: z.string().max(60).optional(),
    confianza: z.number().min(0).max(1).optional(),
    umbral: z.number().min(0).max(1).optional(),
    candidatos: z.number().int().min(0).optional(),
    lote_n: z.number().int().min(0).optional(),
    validation_outcome: z.string().max(60).optional(),
  })
  .strict();

export type DeadLetterPayload = z.infer<typeof DeadLetterPayloadSchema>;

export const DeadLetterRowSchema = z
  .object({
    url_hash: z.string().min(1),
    rejection_stage: RejectionStageSchema,
    detalle: z.string().max(500).nullable(),
    payload: DeadLetterPayloadSchema,
    run_id: z.string().nullable(),
  })
  .strict();

export type DeadLetterRow = z.infer<typeof DeadLetterRowSchema>;

export interface DeadLetterWriter {
  escribir(filas: readonly DeadLetterRow[]): Promise<number>;
}

/** Writer real (service key, server-only). Valida CADA fila con zod ANTES de tocar la red. */
export class SupabaseDeadLetterWriter implements DeadLetterWriter {
  constructor(private readonly client: SupabaseClient) {}

  async escribir(filas: readonly DeadLetterRow[]): Promise<number> {
    if (filas.length === 0) return 0;
    const validadas = filas.map((f) => DeadLetterRowSchema.parse(f));
    const { error } = await this.client.from("noticia_dead_letter").insert(validadas);
    if (error) {
      throw new Error(`dead-letter: insert falló (${validadas.length} filas): ${error.message}`);
    }
    return validadas.length;
  }
}
