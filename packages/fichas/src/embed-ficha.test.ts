// embed-ficha.test — composición defensiva del texto a embeber + embed RETRIEVAL_DOCUMENT.
//
// Todo offline: provider Gemini fake (no red, no GEMINI_API_KEY). Verifica:
//   - compose filtra partes null/empty (título+materia cuando idea_matriz null), nunca "".
//   - compose trunca texto compuesto largo antes de embed (Assumption A5).
//   - embedFicha llama embed([text], "RETRIEVAL_DOCUMENT") y devuelve el EmbeddingResult.

import { describe, it, expect, vi } from "vitest";
import type { Proyecto } from "@obs/tramitacion";
import type { Ficha } from "./model";
import {
  componerTextoEmbed,
  embedFicha,
  MAX_EMBED_CHARS,
} from "./embed-ficha";

function proyecto(over: Partial<Proyecto> = {}): Proyecto {
  return {
    boletin: "18296-05",
    boletin_num: "18296",
    titulo: "Regula el endeudamiento de las personas",
    iniciativa: "Moción",
    camara_origen: "senado",
    autores: [],
    materia: "Economía y finanzas",
    estado: null,
    etapa: null,
    subetapa: null,
    origen: "senado-wspublico",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.senado.cl/x",
    ...over,
  };
}

describe("embed-ficha: componerTextoEmbed — composición defensiva", () => {
  it("incluye idea_matriz + cuerpos cuando están presentes", () => {
    const ficha: Ficha = {
      idea_matriz: "regular el endeudamiento de las personas",
      cuerpos_legales: [{ norma: "Ley N° 19.628", articulos: ["artículo 4"] }],
    };
    const t = componerTextoEmbed(proyecto(), ficha);
    expect(t).toContain("Regula el endeudamiento");
    expect(t).toContain("Economía y finanzas");
    expect(t).toContain("regular el endeudamiento de las personas");
    expect(t).toContain("Ley N° 19.628");
  });

  it("idea_matriz null → embebe sobre título+materia, nunca string vacío (Pitfall 5)", () => {
    const ficha: Ficha = { idea_matriz: null, cuerpos_legales: [] };
    const t = componerTextoEmbed(proyecto(), ficha);
    expect(t.length).toBeGreaterThan(0);
    expect(t).toContain("Regula el endeudamiento");
    expect(t).toContain("Economía y finanzas");
    expect(t).not.toContain("null");
  });

  it("filtra partes null/empty (materia null) sin dejar separadores vacíos", () => {
    const ficha: Ficha = { idea_matriz: null, cuerpos_legales: [] };
    const t = componerTextoEmbed(proyecto({ materia: null }), ficha);
    expect(t).toBe("Regula el endeudamiento de las personas");
  });

  it("trunca texto compuesto largo antes de embed (A5)", () => {
    const ficha: Ficha = {
      idea_matriz: "x".repeat(MAX_EMBED_CHARS * 2),
      cuerpos_legales: [],
    };
    const t = componerTextoEmbed(proyecto(), ficha);
    expect(t.length).toBeLessThanOrEqual(MAX_EMBED_CHARS);
  });
});

describe("embed-ficha: embedFicha — RETRIEVAL_DOCUMENT", () => {
  it("llama embed([texto], 'RETRIEVAL_DOCUMENT') y devuelve el EmbeddingResult", async () => {
    const result = {
      vector: [0.1, 0.2],
      model: "gemini-embedding-001",
      dims: 768,
      version: "v1",
    };
    const gemini = { embed: vi.fn(async () => [result]) };
    const ficha: Ficha = {
      idea_matriz: "regular el endeudamiento",
      cuerpos_legales: [],
    };

    const out = await embedFicha(proyecto(), ficha, gemini as never);

    expect(gemini.embed).toHaveBeenCalledTimes(1);
    const [texts, taskType] = gemini.embed.mock.calls[0]!;
    expect(Array.isArray(texts)).toBe(true);
    expect((texts as string[]).length).toBe(1);
    expect(taskType).toBe("RETRIEVAL_DOCUMENT");
    expect(out).toEqual(result);
  });
});
