/**
 * embed-query.ts — Embedder Gemini para queries de búsqueda (spike).
 *
 * Copia VERBATIM de app/lib/buscar.ts (líneas 70-156) — NO importar buscar.ts
 * (es server-only + next/navigation-coupled, incompatible fuera de Next.js).
 *
 * Contrato obligatorio (SEM-03 — asimetría query-side):
 *   taskType = "RETRIEVAL_QUERY" (SIEMPRE para queries; buscar.ts lo usa en embed())
 *   outputDimensionality = 768 (MRL truncado, espeja DEFAULT_MATCH_THRESHOLD)
 *   L2-normalize el vector antes de devolver
 *   Key SOLO por header "x-goog-api-key" — NUNCA en URL/body/logs/errores (V7/V12)
 */

// Constantes copiadas VERBATIM de app/lib/buscar.ts líneas 70-73
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = "v1beta";

/** Normaliza un vector a norma L2 = 1.
 *  Copiado verbatim de buscar.ts líneas 92-96.
 */
function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/**
 * Embebe un array de textos usando Gemini batchEmbedContents.
 *
 * Siempre usa taskType = "RETRIEVAL_QUERY" (obligatorio para la asimetría
 * documento/query de Gemini — SEM-03). Devuelve vectores L2-normalizados de 768 dims.
 *
 * La key Gemini viaja SOLO por el header "x-goog-api-key" — nunca en la URL,
 * body, logs ni mensajes de error.
 *
 * @param texts - textos a embeber (puede ser [])
 * @returns vectores number[][] (uno por texto), vacío si texts es vacío
 */
export async function embedQuery(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY en el entorno para embedQuery (spike).",
    );
  }

  const url = `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${EMBEDDING_MODEL}:batchEmbedContents`;

  const body = {
    requests: texts.map((text) => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMS,
      taskType: "RETRIEVAL_QUERY" as const,
    })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // NUNCA incluir la key en el mensaje de error (V7/V12 — espejo buscar.ts:135-138)
    throw new Error(
      `Gemini embeddings request failed: ${res.status} ${res.statusText}`,
    );
  }

  const json = (await res.json()) as {
    embeddings?: { values?: number[] }[];
  };

  const embeddings = json.embeddings ?? [];
  return embeddings.map((e) => {
    const values = e.values ?? [];
    if (values.length !== EMBEDDING_DIMS) {
      throw new Error(
        `Gemini embedding dim mismatch: expected ${EMBEDDING_DIMS}, got ${values.length}`,
      );
    }
    return l2normalize(values);
  });
}
