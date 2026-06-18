import { describe, it, expect } from "vitest";
import { FichaSchema, CuerpoLegalSchema } from "./model";

describe("FichaSchema — contrato de la extracción literal (SEM-02)", () => {
  it("acepta idea_matriz textual + cuerpos_legales con norma y artículos", () => {
    const ficha = FichaSchema.parse({
      idea_matriz: "El proyecto tiene por objeto proteger los datos personales.",
      cuerpos_legales: [{ norma: "Ley N° 19.628", articulos: ["artículo 4"] }],
    });
    expect(ficha.idea_matriz).toBe(
      "El proyecto tiene por objeto proteger los datos personales.",
    );
    expect(ficha.cuerpos_legales).toHaveLength(1);
    expect(ficha.cuerpos_legales[0]!.norma).toBe("Ley N° 19.628");
    expect(ficha.cuerpos_legales[0]!.articulos).toEqual(["artículo 4"]);
  });

  it("acepta idea_matriz: null (degradación honesta es first-class)", () => {
    const ficha = FichaSchema.parse({ idea_matriz: null, cuerpos_legales: [] });
    expect(ficha.idea_matriz).toBeNull();
    expect(ficha.cuerpos_legales).toEqual([]);
  });

  it("cuerpos_legales por defecto [] cuando está ausente", () => {
    const ficha = FichaSchema.parse({ idea_matriz: "objeto literal" });
    expect(ficha.cuerpos_legales).toEqual([]);
  });

  it("articulos por defecto [] cuando está ausente en un cuerpo legal", () => {
    const cl = CuerpoLegalSchema.parse({ norma: "Código del Trabajo" });
    expect(cl.articulos).toEqual([]);
  });

  it("rechaza idea_matriz > 4000 chars (acota la salida del modelo)", () => {
    const larga = "a".repeat(4001);
    expect(() => FichaSchema.parse({ idea_matriz: larga })).toThrow();
  });

  it("rechaza cuerpos_legales > 100 items", () => {
    const muchos = Array.from({ length: 101 }, () => ({
      norma: "Ley N° 1",
      articulos: [],
    }));
    expect(() =>
      FichaSchema.parse({ idea_matriz: null, cuerpos_legales: muchos }),
    ).toThrow();
  });

  it("rechaza estructura inválida (idea_matriz numérico)", () => {
    expect(() =>
      FichaSchema.parse({ idea_matriz: 42, cuerpos_legales: [] }),
    ).toThrow();
  });
});
