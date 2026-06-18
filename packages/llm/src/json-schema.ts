/**
 * Deriva un JSON schema (tool function schema) desde un schema zod, para el
 * tool-calling forzado de MiniMax. Usa `z.toJSONSchema` (zod v4 nativo) — una
 * sola fuente de verdad: el schema zod. NO se usa `zod-to-json-schema`.
 *
 * El JSON schema resultante es el `parameters` de la function del tool. Se elimina
 * la meta-clave `$schema` (irrelevante para function-calling) para mantener el
 * objeto de parametros plano.
 */
import { z } from "zod";
import type { ZodType } from "zod";

export function zodToToolSchema(schema: ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  // `$schema` es metadata del documento, no parte de los parametros de la function.
  const { $schema: _drop, ...rest } = json as { $schema?: unknown } & Record<string, unknown>;
  return rest;
}
