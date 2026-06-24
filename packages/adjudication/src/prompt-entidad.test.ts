/**
 * Tests de prompt-entidad (ENT-02, Task 1):
 *  - Test 1: AdjudicacionEntidadSchema acepta chosen_id 'E00042' y rechaza 'P00042' (regex /^E\d{5}$/).
 *  - Test 2: el schema conserva decision/confidence/evidence/conflicts idénticos al analog
 *            (para que aplicarCompuerta sirva sin cambios — refine cruzado match→chosen_id).
 *  - Test 3: construirPromptEntidad sobre una mención con candidatos NO contiene ningún RUT
 *            en su salida (sin RUT por construcción; minimización ENT-02).
 */
import { describe, it, expect } from "vitest";
import type { EntidadTerceroRow } from "@obs/identity";
import {
  AdjudicacionEntidadSchema,
  construirPromptEntidad,
  SYSTEM_ADJUDICACION_ENTIDAD,
} from "./prompt-entidad";
import { assertNoRutInLlmInput } from "@obs/llm";
import type { MencionEntidadForanea } from "./tipos-entidad";

const baseSalida = {
  decision: "match" as const,
  confidence: 0.95,
  evidence: ["nombre coincide"],
  conflicts: [],
};

describe("AdjudicacionEntidadSchema — chosen_id regex /^E\\d{5}$/ (Δ1)", () => {
  it("acepta chosen_id 'E00042'", () => {
    const r = AdjudicacionEntidadSchema.safeParse({ ...baseSalida, chosen_id: "E00042" });
    expect(r.success).toBe(true);
  });

  it("rechaza el formato de parlamentario 'P00042'", () => {
    const r = AdjudicacionEntidadSchema.safeParse({ ...baseSalida, chosen_id: "P00042" });
    expect(r.success).toBe(false);
  });

  it("acepta chosen_id null cuando decision no es match", () => {
    const r = AdjudicacionEntidadSchema.safeParse({
      ...baseSalida,
      decision: "uncertain",
      chosen_id: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("AdjudicacionEntidadSchema — forma idéntica al analog (compatibilidad con compuerta)", () => {
  it("conserva el refine cruzado: decision='match' con chosen_id=null es inválido", () => {
    const r = AdjudicacionEntidadSchema.safeParse({
      ...baseSalida,
      decision: "match",
      chosen_id: null,
    });
    expect(r.success).toBe(false);
  });

  it("valida una salida completa con todos los campos del analog", () => {
    const r = AdjudicacionEntidadSchema.safeParse({
      decision: "no_match",
      chosen_id: null,
      confidence: 0,
      evidence: [],
      conflicts: ["dos candidatos plausibles"],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza confidence fuera de [0,1]", () => {
    const r = AdjudicacionEntidadSchema.safeParse({ ...baseSalida, chosen_id: "E00001", confidence: 1.5 });
    expect(r.success).toBe(false);
  });
});

describe("construirPromptEntidad — sin RUT por construcción (ENT-02)", () => {
  const mencion: MencionEntidadForanea = {
    nombreOriginal: "Juan Pérez González",
    nombreNormalizado: "juan perez gonzalez",
    tipoEntidad: "natural",
  };
  const candidatos: EntidadTerceroRow[] = [
    { id: "E00042", nombre_normalizado: "juan perez gonzalez", tipo_entidad: "natural", rut: "12345678-9" },
    { id: "E00099", nombre_normalizado: "juan perez gonzalez", tipo_entidad: "natural", rut: "9876543-2" },
  ];

  it("no emite ningún RUT en la salida (el gate pasa sobre system+user EXACTO)", () => {
    const userPrompt = construirPromptEntidad(mencion, candidatos);
    // Aunque la maestra trae RUT, el prompt NO lo incluye: el gate debe pasar limpio.
    expect(() =>
      assertNoRutInLlmInput(`${SYSTEM_ADJUDICACION_ENTIDAD}\n${userPrompt}`),
    ).not.toThrow();
    // Sanity directo: ningún RUT chileno literal en el texto.
    expect(userPrompt).not.toMatch(/12\.?345\.?678/);
    expect(userPrompt).not.toMatch(/9\.?876\.?543/);
  });

  it("incluye el nombre de la mención y los ids de los candidatos", () => {
    const userPrompt = construirPromptEntidad(mencion, candidatos);
    expect(userPrompt).toContain("Juan Pérez González");
    expect(userPrompt).toContain("E00042");
    expect(userPrompt).toContain("E00099");
  });
});
