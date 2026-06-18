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

/**
 * Techo de reintentos del repair loop. Acota el costo: aun con una config/metadata
 * de tarea no confiable, no se pueden encadenar round-trips de red pagados sin
 * limite (WR-01).
 */
export const MAX_REPAIR_ATTEMPTS_CEILING = 3;

/**
 * Sanea `maxRepairAttempts` al rango [0, MAX_REPAIR_ATTEMPTS_CEILING] (WR-01).
 * Negativos/NaN -> 0 (corre solo la validacion inicial, sin reprompt). Valores
 * grandes -> el techo (no se permite inflar el costo via config).
 */
export function clampRepairAttempts(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return value === undefined ? 1 : 0;
  return Math.max(0, Math.min(Math.trunc(value), MAX_REPAIR_ATTEMPTS_CEILING));
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
  // WR-01: sanea el limite. Un valor negativo (o NaN) haria que el `for` no
  // ejecute el cuerpo y lance LLMValidationError([]) (error sin issues, sin que
  // corra validacion alguna). Se clampa a >= 0 para que SIEMPRE corra al menos
  // el intento 0 (validacion de la respuesta inicial).
  const maxAttempts = Number.isFinite(ctx.maxAttempts)
    ? Math.max(0, Math.trunc(ctx.maxAttempts))
    : 0;
  // attempt 0 = respuesta inicial; 1..maxAttempts = reprompts.
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    const parsed = safeJsonParse(current);
    const result = schema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    if (attempt === maxAttempts) {
      throw new LLMValidationError(result.error.issues);
    }
    const errorMsg = formatIssues(result.error.issues);
    current = await ctx.reprompt(errorMsg);
  }
  // Inalcanzable: `maxAttempts` esta clampado a >= 0, asi que el loop SIEMPRE
  // corre el intento 0 y retorna o lanza dentro de el (IN-02). Se conserva solo
  // para satisfacer el control de flujo del compilador.
  throw new LLMValidationError([]);
}
