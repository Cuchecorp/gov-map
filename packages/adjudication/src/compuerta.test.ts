/**
 * Tests de la compuerta fail-closed (ID-04). El BORDE 0.90 es MANDATORIO (T-04-01):
 * el umbral usa `<` ESTRICTO, así confidence===0.90 PASA y 0.8999 enruta a revisión.
 * Un operador invertido (`>`) o no-estricto (`<=`) aquí es el bug existencial #1.
 */
import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { aplicarCompuerta } from "./compuerta";
import type { MencionForanea } from "./tipos";
import type { Adjudicacion } from "./prompt";

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
    rut: null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: "confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

const mencion: MencionForanea = {
  nombreOriginal: "Walker P., Matías",
  nombreNormalizado: "walker matias",
  tokens: ["walker", "matias"],
  camara: "senado",
  periodo: "senado-vigente-2026",
  region: "Valparaíso",
};

const candidatos = [
  maestro({ id: "P00042", camara: "senado", periodo: "senado-vigente-2026" }),
];

/** Adjudicación válida base (todas las reglas pasan). */
function adj(over: Partial<Adjudicacion> = {}): Adjudicacion {
  return {
    decision: "match",
    chosen_id: "P00042",
    confidence: 0.95,
    evidence: [],
    conflicts: [],
    ...over,
  } as Adjudicacion;
}

describe("aplicarCompuerta — borde 0.90 (MANDATORIO, T-04-01)", () => {
  it("confidence === 0.90 (todo lo demás OK) → auto-aceptar (borde estricto <)", () => {
    const out = aplicarCompuerta(adj({ confidence: 0.9 }), mencion, candidatos);
    expect(out.ruta).toBe("auto-aceptar");
    if (out.ruta === "auto-aceptar") expect(out.chosenId).toBe("P00042");
  });

  it("confidence === 0.8999 (todo lo demás OK) → revisión con razón de umbral", () => {
    const out = aplicarCompuerta(adj({ confidence: 0.8999 }), mencion, candidatos);
    expect(out.ruta).toBe("revision");
    if (out.ruta === "revision") {
      expect(out.razones.length).toBeGreaterThan(0);
      expect(out.razones.join(" ").toLowerCase()).toContain("confianza");
    }
  });
});

describe("aplicarCompuerta — reglas duras → revisión", () => {
  it("decision='no_match' → revisión aunque confidence alta", () => {
    expect(aplicarCompuerta(adj({ decision: "no_match", confidence: 0.99 }), mencion, candidatos).ruta).toBe("revision");
  });

  it("decision='uncertain' → revisión", () => {
    expect(aplicarCompuerta(adj({ decision: "uncertain", chosen_id: null, confidence: 0.99 }), mencion, candidatos).ruta).toBe("revision");
  });

  it("conflicts no vacío → revisión aunque confidence=1.0", () => {
    expect(aplicarCompuerta(adj({ confidence: 1.0, conflicts: ["cámara distinta"] }), mencion, candidatos).ruta).toBe("revision");
  });

  it("chosen_id no está entre los candidatos → revisión", () => {
    expect(aplicarCompuerta(adj({ chosen_id: "P09999" }), mencion, candidatos).ruta).toBe("revision");
  });

  it("chosen_id=null → revisión", () => {
    // decision=uncertain para no violar el refine del schema; null sigue fallando la compuerta.
    expect(aplicarCompuerta(adj({ decision: "uncertain", chosen_id: null }), mencion, candidatos).ruta).toBe("revision");
  });

  it("chosen del candidato con cámara distinta a la mención → revisión (inconsistencia cámara)", () => {
    const cands = [maestro({ id: "P00042", camara: "diputados", periodo: "senado-vigente-2026" })];
    expect(aplicarCompuerta(adj(), mencion, cands).ruta).toBe("revision");
  });

  it("chosen del candidato con periodo distinto → revisión (inconsistencia periodo)", () => {
    const cands = [maestro({ id: "P00042", camara: "senado", periodo: "senado-vigente-2022" })];
    expect(aplicarCompuerta(adj(), mencion, cands).ruta).toBe("revision");
  });
});

describe("aplicarCompuerta — happy path y acumulación", () => {
  it("TODAS las reglas pasan → auto-aceptar con chosenId correcto", () => {
    const out = aplicarCompuerta(adj(), mencion, candidatos);
    expect(out.ruta).toBe("auto-aceptar");
    if (out.ruta === "auto-aceptar") expect(out.chosenId).toBe("P00042");
  });

  it("múltiples fallas producen múltiples razones (lista, sin corto-circuito)", () => {
    const out = aplicarCompuerta(
      adj({ decision: "no_match", confidence: 0.2, conflicts: ["x"] }),
      mencion,
      candidatos,
    );
    expect(out.ruta).toBe("revision");
    if (out.ruta === "revision") expect(out.razones.length).toBeGreaterThanOrEqual(3);
  });
});
