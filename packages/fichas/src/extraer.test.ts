import { describe, it, expect } from "vitest";
import { extraer } from "./extraer";
import { FichaSchema, type Ficha } from "./model";
import { MockDeepSeekProvider } from "./mock-provider";

const PROYECTO = { boletin: "18296-05", titulo: "Proyecto de prueba" };

describe("extraer — extracción literal vía provider + compuerta zod (SEM-02)", () => {
  it("devuelve una Ficha validada por FichaSchema (mock, sin red)", async () => {
    const esperada: Ficha = {
      idea_matriz: "El proyecto tiene por objeto proteger los datos personales.",
      cuerpos_legales: [{ norma: "Ley N° 19.628", articulos: ["artículo 4"] }],
    };
    const provider = new MockDeepSeekProvider(esperada);
    const texto =
      "El proyecto tiene por objeto proteger los datos personales conforme a la Ley N° 19.628.";

    const ficha = await extraer(texto, PROYECTO, provider);

    expect(() => FichaSchema.parse(ficha)).not.toThrow();
    expect(ficha.idea_matriz).toBe(esperada.idea_matriz);
    expect(ficha.cuerpos_legales[0]!.norma).toBe("Ley N° 19.628");
    expect(provider.callCount).toBe(1);
  });

  it("pasa el gate de sensibilidad: provider público no aborta (texto sin RUT)", async () => {
    const provider = new MockDeepSeekProvider({
      idea_matriz: null,
      cuerpos_legales: [],
    });
    await expect(
      extraer("Un texto público sin datos personales.", PROYECTO, provider),
    ).resolves.toBeDefined();
  });

  it("la salida untrusted del modelo pasa por FichaSchema dentro del provider (rechaza estructura inválida)", async () => {
    // El mock devuelve una "ficha" inválida (idea_matriz numérico): la compuerta zod del
    // mock (espeja el repair/validate del real) la RECHAZA → extraer propaga el throw.
    const inválida = { idea_matriz: 42, cuerpos_legales: [] } as unknown as Ficha;
    const provider = new MockDeepSeekProvider(inválida);
    await expect(extraer("texto", PROYECTO, provider)).rejects.toThrow();
  });
});
