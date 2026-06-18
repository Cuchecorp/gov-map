/**
 * Adapter de embeddings Gemini (gemini-embedding-001, truncado MRL a 768-dim).
 *
 * Cada vector se versiona (model/dims/version) — NO existe vector anonimo (FND-07):
 * habilita re-embedding incremental sin corromper el indice (bump de version =>
 * re-embed; nunca mezclar versiones en un mismo indice).
 *
 * CRITICO: a dims != 3072 Gemini NO normaliza el vector -> el provider L2-normaliza
 * manualmente cada vector (condicion necesaria para que la distancia cosine de
 * pgvector funcione en Fase 7).
 *
 * SOLO TEXTO PUBLICO: el free tier de Gemini ENTRENA con sus inputs
 * (`trainsOnInputs = true`); la politica data-routing de 02-02 (gate fail-closed)
 * impide que dato personal llegue aqui.
 *
 * Modela la llamada REST de `batchEmbedContents` directamente con un `fetchFn`
 * inyectable (Web fetch estandar; sin `node:`/`Buffer`, corre en Deno/Edge). El
 * SDK `@google/genai` 2.8.0 (`GoogleGenAI`) NO expone un punto de inyeccion de
 * fetch en su API publica, por lo que se usa la forma REST documentada
 * (ai.google.dev/api/embeddings) para mantener los tests sin red ni key.
 * La API key viaja por header `x-goog-api-key` — NUNCA en la URL, el body ni los logs.
 */
import type { EmbeddingProvider, EmbeddingResult } from "./../types";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMS = 768;
export const EMBEDDING_VERSION = "v1";

const API_BASE = "https://generativelanguage.googleapis.com";
const API_VERSION = "v1beta";

/**
 * Normaliza un vector a norma L2 = 1. Pattern 6 (RESEARCH): a dims != 3072 Gemini
 * NO normaliza, asi que esto es obligatorio para que cosine sea valido.
 * Guard de norma 0: devuelve el vector tal cual (evita dividir por cero -> NaN).
 */
export function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/** Forma de un item de la respuesta REST `batchEmbedContents`. */
interface BatchEmbedResponse {
  embeddings?: { values?: number[] }[];
}

export interface GeminiEmbeddingProviderOptions {
  /** API key Gemini (de env; nunca hardcodear ni loguear). */
  apiKey: string;
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = "gemini";
  /** Gemini free tier entrena con inputs -> solo texto PUBLICO (gate 02-02). */
  readonly trainsOnInputs = true;

  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: GeminiEmbeddingProviderOptions) {
    this.apiKey = opts.apiKey;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async embed(texts: string[]): Promise<EmbeddingResult[]> {
    // WR-04: lote vacio -> no se hace POST (Gemini puede responder 400 a un
    // `requests: []`, y un caller no distingue "nada que embeber" de un bug).
    if (texts.length === 0) return [];

    const url =
      `${API_BASE}/${API_VERSION}/models/${EMBEDDING_MODEL}:batchEmbedContents`;
    const body = {
      requests: texts.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMS,
      })),
    };

    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // La key va por header dedicado, jamas en la URL ni en el body.
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // NUNCA incluir la key en el mensaje (patron fetcher.ts).
      throw new Error(
        `Gemini embeddings request failed: ${res.status} ${res.statusText}`,
      );
    }

    const json = (await res.json()) as BatchEmbedResponse;
    const embeddings = json.embeddings;
    if (!embeddings || embeddings.length !== texts.length) {
      throw new Error(
        `Gemini embeddings response shape invalid: expected ${texts.length} embeddings, got ${embeddings?.length ?? 0}`,
      );
    }

    return embeddings.map((e): EmbeddingResult => {
      const values = e.values;
      if (!values || values.length === 0) {
        throw new Error("Gemini embeddings response missing vector values");
      }
      // WR-03: la dimensionalidad real DEBE coincidir con EMBEDDING_DIMS antes de
      // estampar `dims: 768`. Si Gemini ignora/mal-maneja outputDimensionality
      // (cambio de API, fallback a 3072, truncado parcial), un vector con dims
      // reales != registradas corrompe el indice pgvector(768) en Fase 7 (FND-07).
      if (values.length !== EMBEDDING_DIMS) {
        throw new Error(
          `Gemini embedding dim mismatch: expected ${EMBEDDING_DIMS}, got ${values.length}`,
        );
      }
      // Versionado SIEMPRE: ningun vector sin model/dims/version (FND-07).
      return {
        vector: l2normalize(values),
        model: EMBEDDING_MODEL,
        dims: EMBEDDING_DIMS,
        version: EMBEDDING_VERSION,
      };
    });
  }
}
