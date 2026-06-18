import { describe, expect, it } from "vitest";
import {
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  GeminiEmbeddingProvider,
  l2normalize,
} from "./gemini-embeddings";
import { makeMockFetch } from "../../test/_helpers";

// Endpoint REST documentado del batch de embeddings de Gemini (mldev / no-Vertex).
// El provider modela la llamada HTTP directa con fetch inyectable: el SDK
// @google/genai 2.8.0 (GoogleGenAI) NO expone punto de inyeccion de fetch.
const URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";

/** Norma L2 de un vector (helper de test, independiente del provider). */
function norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/** Construye un vector de `n` dims deliberadamente NO normalizado (norma != 1). */
function unnormalizedVector(n: number, seed = 1): number[] {
  return Array.from({ length: n }, (_, i) => (i % 7) + seed);
}

/** Respuesta batchEmbedContents: `{ embeddings: [{ values: number[] }, ...] }`. */
function embedResponse(vectors: number[][]): string {
  return JSON.stringify({ embeddings: vectors.map((values) => ({ values })) });
}

describe("l2normalize", () => {
  it("[3,4] -> [0.6, 0.8] (norma 5)", () => {
    expect(l2normalize([3, 4])).toEqual([0.6, 0.8]);
  });

  it("guard de norma 0: [0,0] -> [0,0] sin dividir por cero", () => {
    expect(l2normalize([0, 0])).toEqual([0, 0]);
  });

  it("el resultado tiene norma ~= 1.0", () => {
    const out = l2normalize([2, 5, 9, 1]);
    expect(norm(out)).toBeCloseTo(1.0, 6);
  });
});

describe("GeminiEmbeddingProvider", () => {
  it("flags: id 'gemini' y trainsOnInputs true (free tier entrena con inputs)", () => {
    const { fn } = makeMockFetch({});
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: fn });
    expect(p.id).toBe("gemini");
    expect(p.trainsOnInputs).toBe(true);
  });

  it("embed() devuelve EmbeddingResult versionado por texto (FND-07: ningun vector anonimo)", async () => {
    const raw = unnormalizedVector(EMBEDDING_DIMS);
    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse([raw]) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: mock.fn });

    const out = await p.embed(["texto publico"]);

    expect(out).toHaveLength(1);
    const r = out[0]!;
    expect(r.vector).toHaveLength(EMBEDDING_DIMS);
    expect(r.model).toBe(EMBEDDING_MODEL);
    expect(r.model).toBe("gemini-embedding-001");
    expect(r.dims).toBe(EMBEDDING_DIMS);
    expect(r.dims).toBe(768);
    expect(r.version).toBe(EMBEDDING_VERSION);
    expect(r.version).toBe("v1");
  });

  it("el vector devuelto esta L2-normalizado (norma ~= 1.0), normaliza el PROVIDER no el mock", async () => {
    // El mock devuelve un vector deliberadamente NO normalizado (norma != 1).
    const raw = unnormalizedVector(EMBEDDING_DIMS);
    expect(norm(raw)).not.toBeCloseTo(1.0, 3);

    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse([raw]) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: mock.fn });

    const out = await p.embed(["texto publico"]);
    expect(norm(out[0]!.vector)).toBeCloseTo(1.0, 6);
  });

  it("batch de N textos -> N resultados, cada uno con su vector versionado", async () => {
    const raws = [
      unnormalizedVector(EMBEDDING_DIMS, 1),
      unnormalizedVector(EMBEDDING_DIMS, 3),
      unnormalizedVector(EMBEDDING_DIMS, 5),
    ];
    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse(raws) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: mock.fn });

    const out = await p.embed(["a publico", "b publico", "c publico"]);

    expect(out).toHaveLength(3);
    for (const r of out) {
      expect(r.vector).toHaveLength(EMBEDDING_DIMS);
      expect(r.model).toBe(EMBEDDING_MODEL);
      expect(r.dims).toBe(EMBEDDING_DIMS);
      expect(r.version).toBe(EMBEDDING_VERSION);
      expect(norm(r.vector)).toBeCloseTo(1.0, 6);
    }
  });

  it("la request lleva outputDimensionality:768 y los textos en requests[].content.parts[].text", async () => {
    const raw = unnormalizedVector(EMBEDDING_DIMS);
    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse([raw, raw]) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: mock.fn });

    await p.embed(["uno publico", "dos publico"]);

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0]!;
    expect(call.url).toBe(URL);
    expect(call.method).toBe("POST");

    const body = JSON.parse(String(call.body));
    expect(Array.isArray(body.requests)).toBe(true);
    expect(body.requests).toHaveLength(2);
    for (const reqItem of body.requests) {
      expect(reqItem.model).toBe(`models/${EMBEDDING_MODEL}`);
      expect(reqItem.outputDimensionality).toBe(768);
    }
    expect(body.requests[0].content.parts[0].text).toBe("uno publico");
    expect(body.requests[1].content.parts[0].text).toBe("dos publico");
  });

  it("la API key viaja por header x-goog-api-key, nunca en la URL ni en el body", async () => {
    const raw = unnormalizedVector(EMBEDDING_DIMS);
    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse([raw]) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "super-secret-key", fetchFn: mock.fn });

    await p.embed(["texto publico"]);

    const call = mock.calls[0]!;
    expect(call.headers["x-goog-api-key"]).toBe("super-secret-key");
    expect(call.url).not.toContain("super-secret-key");
    expect(String(call.body)).not.toContain("super-secret-key");
  });

  // WR-03: dimensionalidad real != EMBEDDING_DIMS -> lanza (protege el indice).
  it("WR-03 vector con dims != 768 (p.ej. 3072) -> lanza dim mismatch, no persiste mal", async () => {
    const wrong = unnormalizedVector(3072); // Gemini default si ignora outputDimensionality
    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse([wrong]) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: mock.fn });
    await expect(p.embed(["texto publico"])).rejects.toThrow(/dim mismatch|expected 768/i);
  });

  it("WR-03 vector truncado (dims < 768) -> lanza dim mismatch", async () => {
    const wrong = unnormalizedVector(512);
    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse([wrong]) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: mock.fn });
    await expect(p.embed(["texto publico"])).rejects.toThrow(/dim mismatch|expected 768/i);
  });

  // WR-04: lote vacio -> [] sin POST.
  it("WR-04 embed([]) -> [] sin llamar a la API (cero fetches)", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: embedResponse([]) } });
    const p = new GeminiEmbeddingProvider({ apiKey: "k", fetchFn: mock.fn });
    const out = await p.embed([]);
    expect(out).toEqual([]);
    expect(mock.calls).toHaveLength(0);
  });

  it("error HTTP no expone la API key en el mensaje", async () => {
    const mock = makeMockFetch({
      [URL]: { status: 403, body: JSON.stringify({ error: { message: "forbidden" } }) },
    });
    const p = new GeminiEmbeddingProvider({ apiKey: "super-secret-key", fetchFn: mock.fn });

    await expect(p.embed(["texto publico"])).rejects.toThrow();
    await expect(p.embed(["texto publico"])).rejects.not.toThrow(/super-secret-key/);
  });
});
