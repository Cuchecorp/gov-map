/**
 * Compuerta zod UNICA de la capa de providers (@obs/llm).
 *
 * `parseAndValidate` es el unico punto donde la salida cruda de CUALQUIER provider
 * (DeepSeek json_object, MiniMax tool-calling) se valida contra el schema esperado.
 * Ningun adapter valida por su cuenta — esto es lo que hace seguro "cambiar de modelo".
 *
 * Flujo (repair loop):
 *   1. JSON.parse de la respuesta (try/catch -> undefined si falla, NO propaga).
 *   2. schema.safeParse. Si success -> devuelve data tipada.
 *   3. Si invalida y quedan intentos -> construye un mensaje con los issues zod
 *      ("path: message") y llama ctx.reprompt(errores) para obtener la siguiente.
 *   4. Agotados los intentos -> lanza LLMValidationError con SOLO los issues
 *      (NUNCA el prompt ni la API key — espeja la regla de fetcher.ts).
 */
import type { ZodIssue, ZodType } from "zod";

/**
 * Error de validacion terminal: la salida del LLM no paso el schema tras agotar
 * los reintentos. El message es GENERICO y el objeto solo lleva los issues zod;
 * jamas incluye el prompt ni credenciales (T-02-03).
 */
export class LLMValidationError extends Error {
  readonly issues: ZodIssue[];
  constructor(issues: ZodIssue[]) {
    super("LLM output failed schema validation");
    this.name = "LLMValidationError";
    // Copia defensiva: solo los issues estructurales, sin datos del prompt.
    this.issues = issues.map((i) => ({
      code: i.code,
      path: i.path,
      message: i.message,
    } as ZodIssue));
  }
}

/** Contexto del repair loop: como repromptear y cuantos reintentos quedan. */
export interface ValidateContext {
  /** Re-llama al provider con los errores zod; devuelve la nueva respuesta cruda. */
  reprompt: (errors: string) => Promise<string | undefined>;
  /** Maximo de reintentos (reprompts) antes de lanzar LLMValidationError. */
  maxAttempts: number;
}

function safeJsonParse(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function formatIssues(issues: ZodIssue[]): string {
  return issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
}

/**
 * Valida `raw` contra `schema`. Si falla, repromptea hasta `maxAttempts` veces;
 * agotados, lanza LLMValidationError (sin secretos). Devuelve el objeto tipado.
 */
export async function parseAndValidate<T>(
  schema: ZodType<T>,
  raw: string | undefined,
  ctx: ValidateContext,
): Promise<T> {
  let current = raw;
  // attempt 0 = respuesta inicial; 1..maxAttempts = reprompts.
  for (let attempt = 0; attempt <= ctx.maxAttempts; attempt++) {
    const parsed = safeJsonParse(current);
    const result = schema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    if (attempt === ctx.maxAttempts) {
      throw new LLMValidationError(result.error.issues);
    }
    const errorMsg = formatIssues(result.error.issues);
    current = await ctx.reprompt(errorMsg);
  }
  // Inalcanzable (el loop siempre retorna o lanza), pero satisface el control de flujo.
  throw new LLMValidationError([]);
}
