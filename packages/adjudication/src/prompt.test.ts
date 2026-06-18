/**
 * Tests del schema zod del adjudicador (ID-03) + construcción del prompt.
 * El prompt final NUNCA debe contener un RUT (T-04-02): assertNoRutInLlmInput
 * corre sobre el string EXACTO ensamblado.
 */
import { describe, it, expect } from "vitest";
import { assertNoRutInLlmInput } from "@obs/llm";
import type { Parlamentario } from "@obs/core";
import { AdjudicacionSchema, construirPromptAdjudicacion } from "./prompt";
import type { MencionForanea } from "./tipos";

function maestro(p: Partial<Parlamentario> & { id: string }): Parlamentario {
  return {
    id: p.id,
    nombre_normalizado: p.nombre_normalizado ?? "",
    nombres: p.nombres ?? "",
    apellido_paterno: p.apellido_paterno ?? "",
    apellido_materno: p.apellido_materno ?? "",
    camara: p.camara ?? "senado",
    periodo: p.periodo ?? "senado-vigente-2026",
    region: p.region ?? null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: p.rut ?? null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: "confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

const mencionWalker: MencionForanea = {
  nombreOriginal: "Walker P., Matías",
  nombreNormalizado: "walker matias",
  tokens: ["walker", "matias"],
  camara: "senado",
  periodo: "senado-vigente-2026",
  region: "Valparaíso",
};

describe("AdjudicacionSchema", () => {
  it("parsea una respuesta válida", () => {
    const ok = AdjudicacionSchema.parse({
      decision: "match",
      chosen_id: "P00123",
      confidence: 0.95,
      evidence: [],
      conflicts: [],
    });
    expect(ok.chosen_id).toBe("P00123");
  });

  it("rechaza confidence fuera de [0,1]", () => {
    expect(() =>
      AdjudicacionSchema.parse({ decision: "uncertain", chosen_id: null, confidence: 1.5, evidence: [], conflicts: [] }),
    ).toThrow();
    expect(() =>
      AdjudicacionSchema.parse({ decision: "uncertain", chosen_id: null, confidence: -0.1, evidence: [], conflicts: [] }),
    ).toThrow();
  });

  it("rechaza chosen_id con formato distinto de /^P\\d{5}$/ (cuando no es null)", () => {
    expect(() =>
      AdjudicacionSchema.parse({ decision: "match", chosen_id: "X123", confidence: 0.95, evidence: [], conflicts: [] }),
    ).toThrow();
    expect(() =>
      AdjudicacionSchema.parse({ decision: "match", chosen_id: "P123", confidence: 0.95, evidence: [], conflicts: [] }),
    ).toThrow();
  });

  it("rechaza decision='match' con chosen_id=null (refine cruzado)", () => {
    expect(() =>
      AdjudicacionSchema.parse({ decision: "match", chosen_id: null, confidence: 0.95, evidence: [], conflicts: [] }),
    ).toThrow();
  });

  it("acepta decision='uncertain' con chosen_id=null", () => {
    const ok = AdjudicacionSchema.parse({
      decision: "uncertain",
      chosen_id: null,
      confidence: 0.4,
      evidence: [],
      conflicts: [],
    });
    expect(ok.decision).toBe("uncertain");
    expect(ok.chosen_id).toBeNull();
  });
});

describe("construirPromptAdjudicacion", () => {
  const candidatos = [
    maestro({ id: "P00042", nombres: "Matías", apellido_paterno: "Walker", apellido_materno: "Prieto", camara: "senado", periodo: "senado-vigente-2026", region: "Valparaíso" }),
    maestro({ id: "P00099", nombres: "Carla", apellido_paterno: "Núñez", apellido_materno: "Pérez", camara: "senado", periodo: "senado-vigente-2026", region: "Biobío" }),
  ];

  it("contiene el nombreOriginal y los nombres/cámara/periodo/región de los candidatos", () => {
    const prompt = construirPromptAdjudicacion(mencionWalker, candidatos);
    expect(prompt).toContain("Walker P., Matías");
    expect(prompt).toContain("Walker");
    expect(prompt).toContain("Núñez");
    expect(prompt).toContain("senado");
    expect(prompt).toContain("senado-vigente-2026");
    expect(prompt).toContain("Valparaíso");
    expect(prompt).toContain("Biobío");
  });

  it("enumera los candidatos por su id (P00xxx) para que el modelo elija de la lista", () => {
    const prompt = construirPromptAdjudicacion(mencionWalker, candidatos);
    expect(prompt).toContain("P00042");
    expect(prompt).toContain("P00099");
  });

  it("está en español (instrucciones de candidatos/región)", () => {
    const prompt = construirPromptAdjudicacion(mencionWalker, candidatos);
    expect(prompt.toLowerCase()).toContain("candidato");
    expect(prompt.toLowerCase()).toContain("región");
  });

  it("el prompt NO contiene ningún RUT (assertNoRutInLlmInput no lanza para mención sin RUT)", () => {
    const prompt = construirPromptAdjudicacion(mencionWalker, candidatos);
    expect(() => assertNoRutInLlmInput(prompt)).not.toThrow();
  });
});
