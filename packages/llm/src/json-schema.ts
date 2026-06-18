// STUB — rellenado por 02-02 (MiniMax tool-calling); no agregar tests aqui.
/**
 * Deriva un JSON schema (tool function schema) desde un schema zod, para el
 * tool-calling forzado de MiniMax. Usa `z.toJSONSchema` (zod v4 nativo).
 */
import type { ZodType } from "zod";

export function zodToToolSchema(_schema: ZodType): Record<string, unknown> {
  throw new Error("not implemented (02-02)");
}
