// STUB — rellenado por 02-03 (implementa EmbeddingProvider); no agregar tests aqui.
/**
 * Adapter de embeddings Gemini (gemini-embedding-001, truncado MRL a 768-dim).
 * Cada vector se versiona (model/dims/version) — no existe vector anonimo (FND-07).
 * Solo texto publico (Gemini free tier entrena con inputs).
 */
import type { EmbeddingProvider, EmbeddingResult } from "./../types";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMS = 768;
export const EMBEDDING_VERSION = "v1";

export function l2normalize(_v: number[]): number[] {
  throw new Error("not implemented (02-03)");
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = "gemini";
  readonly trainsOnInputs = true;

  embed(_texts: string[]): Promise<EmbeddingResult[]> {
    throw new Error("not implemented (02-03)");
  }
}
