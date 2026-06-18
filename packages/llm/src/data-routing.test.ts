import { describe, expect, it } from "vitest";
import {
  assertNoRutInLlmInput,
  assertSensitivityAllowed,
  RutInLlmInputError,
} from "./data-routing";
import { SensitiveRoutingError } from "./router";

const trainingProvider = { id: "gemini", trainsOnInputs: true };
const safeProvider = { id: "minimax", trainsOnInputs: false };

describe("assertNoRutInLlmInput", () => {
  it("texto con RUT con puntos (12.345.678-9) -> lanza RutInLlmInputError", () => {
    expect(() => assertNoRutInLlmInput("el sujeto 12.345.678-9 declara")).toThrow(
      RutInLlmInputError,
    );
  });

  it("texto con RUT sin puntos (12345678-9) -> lanza RutInLlmInputError", () => {
    expect(() => assertNoRutInLlmInput("rut 12345678-9 asociado")).toThrow(
      RutInLlmInputError,
    );
  });

  it("RUT con DV K -> lanza", () => {
    expect(() => assertNoRutInLlmInput("9.876.543-K")).toThrow(RutInLlmInputError);
  });

  it("el mensaje de error NO incluye el RUT ni el texto completo", () => {
    try {
      assertNoRutInLlmInput("el sujeto 12.345.678-9 declara");
      throw new Error("debio lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(RutInLlmInputError);
      const msg = (e as Error).message;
      expect(msg).not.toContain("12.345.678-9");
      expect(msg).not.toContain("12345678");
      expect(msg).not.toContain("declara");
    }
  });

  it("texto sin RUT -> no lanza", () => {
    expect(() => assertNoRutInLlmInput("proyecto de ley sobre transporte publico")).not.toThrow();
  });
});

describe("assertSensitivityAllowed", () => {
  it("personal + provider que entrena -> SensitiveRoutingError", () => {
    expect(() =>
      assertSensitivityAllowed({ sensitivity: "personal" }, trainingProvider),
    ).toThrow(SensitiveRoutingError);
  });

  it("personal + provider que NO entrena -> OK", () => {
    expect(() =>
      assertSensitivityAllowed({ sensitivity: "personal" }, safeProvider),
    ).not.toThrow();
  });

  it("public + cualquier provider (incluso uno que entrena) -> OK", () => {
    expect(() =>
      assertSensitivityAllowed({ sensitivity: "public" }, trainingProvider),
    ).not.toThrow();
  });
});
