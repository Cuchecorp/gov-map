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
 * Desenlace ESTRUCTURAL del repair loop, expuesto ADITIVAMENTE para observadores
 * externos (p.ej. el harness de benchmark). Espeja el flujo de `parseAndValidate`
 * SIN alterarlo: es un observador puro, jamas cambia el control de flujo.
 *
 * Misma disciplina de privacidad que `LLMValidationError`: solo lleva informacion
 * ESTRUCTURAL (kind, conteo de intentos, issues zod) — NUNCA el prompt, la respuesta
 * cruda ni credenciales.
 *
 * - `clean`: valido en el intento 0, sin reparacion.
 * - `zod-repaired`: valido solo tras >= 1 reprompt (`attempts` = # de intentos que
 *   corrieron, es decir el indice del intento que validó, > 0).
 * - `structured-output-fail`: se agotaron los intentos y el ULTIMO payload no era
 *   parseable (JSON.parse -> undefined): el modelo no logro emitir estructura alguna.
 * - `zod-terminal`: se agotaron los intentos con un payload parseable que fallo el
 *   schema (issues zod reales).
 */
export type ValidationOutcome =
  | { kind: "clean" }
  | { kind: "zod-repaired"; attempts: number }
  | { kind: "structured-output-fail" }
  | { kind: "zod-terminal"; issues: ZodIssue[] };

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
  /**
   * Observador OPCIONAL del desenlace estructural del repair loop. Se invoca EXACTAMENTE
   * una vez, en el punto terminal (exito o antes de lanzar). ADITIVO: `undefined` en
   * todos los callers de produccion → CERO cambio de comportamiento. Observador puro:
   * NO altera el control de flujo. Solo lleva info estructural (nunca prompt/secreto).
   */
  onOutcome?: (o: ValidationOutcome) => void;
}

function safeJsonParse(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // Observabilidad PAYLOAD-FREE (IN-01): una respuesta no-JSON del LLM (p.ej. un
    // rechazo en prosa que puede citar de vuelta el prompt/PII) se trata igual que
    // `undefined` y el repair loop reintenta. Se registra SOLO un hecho estructural
    // (la longitud del payload), NUNCA una porción del contenido crudo — la misma
    // disciplina payload-free que la capa de telemetría. NO se altera el control de
    // flujo (sigue undefined).
    console.warn(
      `[validate] JSON.parse falló; se trata como undefined. raw.length=${raw.length}`,
    );
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
      // Observador ADITIVO (CR-01): distingue clean (intento 0) de zod-repaired
      // (validó tras >= 1 reprompt). No altera el control de flujo.
      ctx.onOutcome?.(
        attempt === 0 ? { kind: "clean" } : { kind: "zod-repaired", attempts: attempt },
      );
      return result.data;
    }
    if (attempt === maxAttempts) {
      // Terminal. El observador distingue el fallo de STRUCTURED-OUTPUT (el ultimo
      // payload no era parseable: JSON.parse/tool-call -> undefined, el modelo no
      // logro estructurar nada) del fallo ZOD (payload parseable que no paso el
      // schema, con issues reales). Espeja el mismo criterio que 106/metrics.ts.
      ctx.onOutcome?.(
        parsed === undefined
          ? { kind: "structured-output-fail" }
          : { kind: "zod-terminal", issues: result.error.issues },
      );
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
