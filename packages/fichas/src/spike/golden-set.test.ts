import { describe, it, expect } from "vitest";
import { GOLDEN_SET, normalizarLiteral, type CategoriaRetrieval } from "./golden-set";

const CATEGORIAS: CategoriaRetrieval[] = [
  "titulo-literal",
  "parafrasis-nl",
  "normas",
  "boletin",
  "acentos-toponimos",
  "similares",
];

describe("GOLDEN_SET", () => {
  it("tiene al menos 30 casos", () => {
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(30);
  });

  it("cubre las 6 categorías mandatadas", () => {
    const categorias = new Set(GOLDEN_SET.map((c) => c.category));
    for (const cat of CATEGORIAS) {
      expect(categorias.has(cat), `falta categoría: ${cat}`).toBe(true);
    }
  });

  it("categoría boletin incluye los 3 formatos como casos separados", () => {
    const boletinCases = GOLDEN_SET.filter((c) => c.category === "boletin");
    const queries = boletinCases.map((c) => c.query);
    expect(queries).toContain("14309-04");
    expect(queries).toContain("14309");
    expect(queries).toContain("14.309-04");
  });

  it("categoría acentos-toponimos incluye Ñuñoa, Aysén, medio ambiente", () => {
    const acentoCases = GOLDEN_SET.filter((c) => c.category === "acentos-toponimos");
    const queries = acentoCases.map((c) => c.query);
    expect(queries).toContain("Ñuñoa");
    expect(queries).toContain("Aysén");
    expect(queries).toContain("medio ambiente");
  });

  it("todo expected[] es no vacío y en formato canónico (dígitos + guion)", () => {
    for (const caso of GOLDEN_SET) {
      expect(caso.expected.length, `caso ${caso.id} tiene expected vacío`).toBeGreaterThan(0);
      for (const exp of caso.expected) {
        expect(exp, `expected "${exp}" en caso ${caso.id} no tiene formato canónico`).toMatch(
          /^\d{3,6}(-\d{1,2})?$/,
        );
      }
    }
  });

  it("todos los ids son únicos", () => {
    const ids = GOLDEN_SET.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("normalizarLiteral", () => {
  it("es accent-insensitive: normalizarLiteral('Ñuñoa') === normalizarLiteral('nunoa')", () => {
    expect(normalizarLiteral("Ñuñoa")).toBe(normalizarLiteral("nunoa"));
  });

  it("colapsa whitespace y lowercase", () => {
    expect(normalizarLiteral("  Medio  Ambiente  ")).toBe("medio ambiente");
  });

  it("elimina diacríticos: Aysén → aysen", () => {
    expect(normalizarLiteral("Aysén")).toBe("aysen");
  });
});
