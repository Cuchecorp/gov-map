// pipeline.test — orquestación reanudable fetch→extract→embed→write (mockeada/offline).
//
// Espeja la forma de runIngest: colaboradores inyectados + log + error-collection-not-abort.
// Verifica:
//   - boletín pendiente → fetch(mock)→extraer(mock)→embed(mock)→upsertFicha+upsertEmbedding;
//     estado 'embebido'.
//   - un error en un boletín NO aborta el run; se colecta en errores[]; los demás continúan.
//   - --reembed re-procesa TODOS (no solo pendientes).
//   - idea_matriz null (texto no disponible) → ficha escrita con null, embedding sobre
//     título+materia, NO se fabrica.
//   - forma de conveniencia (slice E2E write-half): correrPipeline({boletin,titulo,textoFuente})
//     devuelve una Ficha extraída literal.

import { describe, it, expect, vi } from "vitest";
import type { Ficha } from "./model";
import { correrPipeline, type PipelinePendiente } from "./pipeline";
import { MockDeepSeekProvider } from "./mock-provider";

const TEXTO = "El proyecto tiene por objeto regular el endeudamiento de las personas.";
const FICHA: Ficha = {
  idea_matriz: "regular el endeudamiento de las personas",
  cuerpos_legales: [],
};

function pendiente(over: Partial<PipelinePendiente> = {}): PipelinePendiente {
  return {
    boletin: "18296-05",
    titulo: "Regula el endeudamiento",
    materia: "Economía",
    link_mensaje_mocion: "https://www.senado.cl/x?id=1",
    estado: "pendiente",
    ...over,
  };
}

/** Embedder fake: devuelve un EmbeddingResult versionado fijo. */
function fakeEmbedder() {
  return {
    embed: vi.fn(async () => [
      { vector: [0.1, 0.2], model: "gemini-embedding-001", dims: 768, version: "v1" },
    ]),
  };
}

/** Writer espía en memoria: registra las filas upserteadas. */
function fakeWriter() {
  const fichas: unknown[] = [];
  const embeddings: unknown[] = [];
  return {
    fichas,
    embeddings,
    upsertFicha: vi.fn(async (filas: unknown[]) => {
      fichas.push(...filas);
    }),
    upsertEmbedding: vi.fn(async (filas: unknown[]) => {
      embeddings.push(...filas);
    }),
  };
}

describe("pipeline: correrPipeline — orquestación reanudable", () => {
  it("boletín pendiente → fetch→extraer→embed→upsert; estado 'embebido'", async () => {
    const writer = fakeWriter();
    const gemini = fakeEmbedder();

    const res = await correrPipeline({
      pendientes: [pendiente()],
      obtenerTexto: vi.fn(async () => ({ texto: TEXTO, r2Path: "r2/x.txt" })),
      provider: new MockDeepSeekProvider(FICHA),
      gemini: gemini as never,
      writer: writer as never,
    });

    expect(res.counts.procesados).toBe(1);
    expect(res.counts.embebidos).toBe(1);
    expect(res.errores).toHaveLength(0);
    expect(writer.upsertFicha).toHaveBeenCalledTimes(1);
    expect(writer.upsertEmbedding).toHaveBeenCalledTimes(1);
    const fila = writer.fichas[0] as { boletin: string; estado: string; texto_r2_path: string | null };
    expect(fila.boletin).toBe("18296-05");
    expect(fila.estado).toBe("embebido");
    expect(fila.texto_r2_path).toBe("r2/x.txt");
  });

  it("un error en un boletín NO aborta; se colecta y los demás continúan", async () => {
    const writer = fakeWriter();
    const gemini = fakeEmbedder();
    // El primer boletín falla en el embed; el segundo procede.
    let n = 0;
    const geminiFlaky = {
      embed: vi.fn(async () => {
        n += 1;
        if (n === 1) throw new Error("Gemini 500");
        return [{ vector: [0.1], model: "m", dims: 768, version: "v1" }];
      }),
    };

    const res = await correrPipeline({
      pendientes: [pendiente({ boletin: "1-1" }), pendiente({ boletin: "2-2" })],
      obtenerTexto: vi.fn(async () => ({ texto: TEXTO, r2Path: null })),
      provider: new MockDeepSeekProvider(FICHA),
      gemini: geminiFlaky as never,
      writer: writer as never,
    });

    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]!.boletin).toBe("1-1");
    expect(res.counts.embebidos).toBe(1); // el segundo se escribió
    void gemini;
  });

  it("--reembed re-procesa TODOS (incluye estado 'embebido') con bump de versión", async () => {
    const writer = fakeWriter();
    const gemini = fakeEmbedder();

    const res = await correrPipeline({
      pendientes: [pendiente({ estado: "embebido" })], // ya embebido
      obtenerTexto: vi.fn(async () => ({ texto: TEXTO, r2Path: null })),
      provider: new MockDeepSeekProvider(FICHA),
      gemini: gemini as never,
      writer: writer as never,
      reembed: true,
    });

    // Sin reembed este boletín se saltaría; con reembed se procesa.
    expect(res.counts.procesados).toBe(1);
    expect(writer.upsertEmbedding).toHaveBeenCalledTimes(1);
  });

  it("sin reembed, un boletín ya 'embebido' se SALTA (reanudable)", async () => {
    const writer = fakeWriter();
    const gemini = fakeEmbedder();

    const res = await correrPipeline({
      pendientes: [pendiente({ estado: "embebido" })],
      obtenerTexto: vi.fn(async () => ({ texto: TEXTO, r2Path: null })),
      provider: new MockDeepSeekProvider(FICHA),
      gemini: gemini as never,
      writer: writer as never,
    });

    expect(res.counts.procesados).toBe(0);
    expect(writer.upsertFicha).not.toHaveBeenCalled();
  });

  it("idea_matriz null (texto no disponible) → ficha con null, embebe título+materia, NO fabrica", async () => {
    const writer = fakeWriter();
    const gemini = fakeEmbedder();

    const res = await correrPipeline({
      // texto no disponible → no se llama al provider; ficha degradada.
      pendientes: [pendiente()],
      obtenerTexto: vi.fn(async () => ({ texto: null, r2Path: null })),
      provider: new MockDeepSeekProvider(FICHA),
      gemini: gemini as never,
      writer: writer as never,
    });

    expect(res.counts.procesados).toBe(1);
    expect(res.counts.degradados).toBe(1);
    const fila = writer.fichas[0] as { idea_matriz: string | null };
    expect(fila.idea_matriz).toBeNull();
    // El embed se computó sobre título+materia (no se fabricó idea_matriz).
    const [texts] = gemini.embed.mock.calls[0]!;
    expect((texts as string[])[0]).toContain("Regula el endeudamiento");
    expect((texts as string[])[0]).toContain("Economía");
  });

  it("forma de conveniencia (slice E2E write-half): {boletin,titulo,textoFuente} → Ficha", async () => {
    const ficha = await correrPipeline({
      boletin: "18296-05",
      titulo: "Proyecto de prueba",
      textoFuente: TEXTO,
      provider: new MockDeepSeekProvider(FICHA),
    });
    expect(ficha.idea_matriz).toBeTruthy();
    expect(ficha.cuerpos_legales).toEqual([]);
  });
});
