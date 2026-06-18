// PLACEHOLDER — implementacion real en Task 2 (02-01). Exports estables.
/**
 * Compuerta zod UNICA: parseAndValidate con repair loop. Ningun adapter valida
 * por su cuenta. (Implementacion real en Task 2.)
 */
import type { ZodType } from "zod";

export class LLMValidationError extends Error {}

export function parseAndValidate<T>(
  _schema: ZodType<T>,
  _raw: string | undefined,
  _ctx: { reprompt: (errors: string) => Promise<string | undefined>; maxAttempts: number },
): Promise<T> {
  throw new Error("not implemented (02-01 Task 2)");
}
