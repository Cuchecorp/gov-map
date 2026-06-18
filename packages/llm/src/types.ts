/**
 * Contratos de la capa de providers (@obs/llm).
 *
 * Define las interfaces enchufables que aislan TODO computo LLM y de embeddings
 * tras un contrato estable: el dominio nunca conoce que modelo concreto corre
 * (FND-06, FND-07). Los adapters concretos (DeepSeek, MiniMax, Gemini) implementan
 * estas interfaces; el router selecciona por (criticidad, sensibilidad).
 */
import type { ZodType } from "zod";

/**
 * Criticidad de la tarea. Decide el TIER de provider, no el volumen per se:
 * - `critical`: adjudicacion de identidad -> MiniMax (alta calidad).
 * - `bulk`: extraccion de fichas de alto volumen -> DeepSeek V4 Flash (prompt-cache).
 */
export type Criticality = "critical" | "bulk";

/**
 * Sensibilidad del dato que viaja en el prompt. Frontera de cumplimiento:
 * dato `personal` NUNCA puede ir a un provider que entrena con sus inputs.
 */
export type Sensitivity = "public" | "personal";

/** Request de completion estructurada que el dominio entrega a la capa. */
export interface CompletionRequest {
  /** Prefijo de sistema estable (prompt-cache). Opcional; el adapter usa un default. */
  system?: string;
  /** Contenido del usuario (el prompt real). */
  user: string;
  /** Criticidad -> tier de provider. */
  criticality: Criticality;
  /** Sensibilidad -> gate fail-closed del router. */
  sensitivity: Sensitivity;
  /** Maximo de reintentos del repair loop ante salida invalida. Default: 1. */
  maxRepairAttempts?: number;
}

/**
 * Interfaz unica de provider LLM. Un adapter (DeepSeek/MiniMax) la implementa;
 * `complete` devuelve un objeto YA validado contra el schema zod — la compuerta
 * de validacion es externa al adapter (parseAndValidate), nunca el adapter valida
 * por su cuenta.
 */
export interface LLMProvider {
  /** Identificador estable del provider (p.ej. "deepseek", "minimax"). */
  readonly id: string;
  /**
   * `true` si el provider entrena con los inputs que recibe. El router usa este
   * flag como gate del fail-closed: dato personal + trainsOnInputs => aborta.
   */
  readonly trainsOnInputs: boolean;
  /** Completa el request y devuelve el objeto validado contra `schema`. */
  complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T>;
}

/**
 * Resultado de embedding versionado. NO existe vector anonimo: cada vector
 * persiste su modelo/dims/version para re-embedding incremental sin corromper
 * el indice (FND-07). Lo implementa la rebanada 02-03 (Gemini).
 */
export interface EmbeddingResult {
  /** El vector (truncado MRL a `dims`). */
  vector: number[];
  /** Modelo que produjo el vector (p.ej. "gemini-embedding-001"). */
  model: string;
  /** Dimensiones del vector (p.ej. 768). */
  dims: number;
  /** Version del esquema de embeddings (re-embedding incremental). */
  version: string;
}

/**
 * Interfaz de provider de embeddings, separada de LLMProvider (Gemini va por su
 * SDK propio). Contrato que implementa la rebanada 02-03 (FND-07).
 */
export interface EmbeddingProvider {
  /** Identificador estable del provider de embeddings. */
  readonly id: string;
  /** `true` si entrena con inputs (Gemini free tier) -> solo texto publico. */
  readonly trainsOnInputs: boolean;
  /** Embebe un lote de textos, devolviendo un resultado versionado por texto. */
  embed(texts: string[]): Promise<EmbeddingResult[]>;
}
