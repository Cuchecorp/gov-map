/**
 * Métricas puras del harness @obs/llm-bench (106-01, Task 2).
 *
 * Funciones sin red ni estado: percentiles (nearest-rank, small-N safe),
 * costo/1k desde `usage`, y la clasificación de outcome que ESPEJA el repair
 * loop de `@obs/llm/validate.ts`. Regla rectora (Pitfall B, LOCKED): la tasa de
 * fallo de structured-output y la tasa de fallo de zod son DOS métricas
 * separadas de primera clase — jamás se pliegan una en otra ni en "calidad".
 */

/**
 * Percentil por rango-más-cercano (nearest-rank), SIN interpolación. Correcto
 * para N chico (Pitfall E): no inventa precisión entre observaciones.
 *   idx = ceil(p/100 * n) - 1, clampado a [0, n-1].
 * Empty → NaN (nunca 0: la ausencia de muestras no es "latencia cero").
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

/** Tarifa por 1M de tokens (in/out). Espeja la forma de `PRICING.tarifas`. */
export interface Tarifa {
  in: number;
  out: number;
}

/** Uso de tokens de la respuesta openai@5 (campos opcionales: el host puede omitirlos). */
export interface UsoTokens {
  prompt_tokens?: number;
  completion_tokens?: number;
}

/**
 * Costo en USD de una llamada: `prompt/1e6*in + completion/1e6*out`.
 * Devuelve `null` (NUNCA 0) si falta el usage o cualquiera de los dos conteos
 * de tokens — un costo cero silencioso sobre-recomienda modelos (Pitfall A).
 */
export function costoUsd(
  usage: UsoTokens | undefined,
  rate: Tarifa,
): number | null {
  if (usage === undefined) return null;
  const { prompt_tokens, completion_tokens } = usage;
  if (prompt_tokens === undefined || completion_tokens === undefined) {
    return null;
  }
  return (prompt_tokens / 1e6) * rate.in + (completion_tokens / 1e6) * rate.out;
}

/**
 * Los cuatro desenlaces posibles de una llamada instrumentada, en correspondencia
 * exacta con el repair loop de `validate.ts`:
 * - "clean": parseó + validó en el intento 0, sin reparación.
 * - "structured-output-fail": no hubo payload usable en el intento 0 (sin tool_call
 *   forzado / json_object que JSON.parse rechaza → undefined).
 * - "zod-repaired": parseó pero safeParse falló, y un reprompt produjo un objeto válido.
 * - "zod-terminal": intentos agotados → LLMValidationError (fallo duro).
 */
export type CallOutcome =
  | "clean"
  | "structured-output-fail"
  | "zod-repaired"
  | "zod-terminal";

/** Registro por-llamada del que se deriva el outcome (señales del repair loop). */
export interface CallOutcomeRecord {
  /** ¿Hubo un payload usable (JSON.parse OK) en el intento 0? */
  payloadUsableAttempt0: boolean;
  /** ¿Se necesitó y logró una reparación zod (reprompt) no terminal? */
  repaired: boolean;
  /** ¿Se agotaron los intentos (LLMValidationError)? */
  terminal: boolean;
}

/**
 * Mapea un registro por-llamada a exactamente UN `CallOutcome`, espejando
 * `parseAndValidate`. Orden de precedencia: sin payload usable en el intento 0 =
 * structured-output-fail (aun si luego se reintenta); si agotó intentos =
 * zod-terminal; si reparó = zod-repaired; si no = clean.
 */
export function clasificarOutcome(rec: CallOutcomeRecord): CallOutcome {
  if (!rec.payloadUsableAttempt0) return "structured-output-fail";
  if (rec.terminal) return "zod-terminal";
  if (rec.repaired) return "zod-repaired";
  return "clean";
}

/** Tasas de fallo agregadas — SEPARADAS de primera clase (Pitfall B, LOCKED). */
export interface TasasDeFallo {
  /** Fracción de llamadas sin payload usable en el intento 0. */
  structured_output_fail_rate: number;
  /** Fallo zod, con reparación exitosa vs terminal — nunca fusionados. */
  zod_fail_rate: { repaired: number; terminal: number };
}

/**
 * Agrega una lista de outcomes en tres tasas SEPARADAS (count/total). Un modelo
 * que "luce limpio en lo que logró estructurar" pero falla estructura el 30% del
 * tiempo DEBE reportar un `structured_output_fail_rate` alto: ese fallo jamás se
 * esconde dentro de las métricas zod ni de calidad. Lista vacía → todo 0.
 */
export function agregarFallos(outcomes: CallOutcome[]): TasasDeFallo {
  const total = outcomes.length;
  if (total === 0) {
    return {
      structured_output_fail_rate: 0,
      zod_fail_rate: { repaired: 0, terminal: 0 },
    };
  }
  let so = 0;
  let repaired = 0;
  let terminal = 0;
  for (const o of outcomes) {
    if (o === "structured-output-fail") so++;
    else if (o === "zod-repaired") repaired++;
    else if (o === "zod-terminal") terminal++;
  }
  return {
    structured_output_fail_rate: so / total,
    zod_fail_rate: { repaired: repaired / total, terminal: terminal / total },
  };
}
