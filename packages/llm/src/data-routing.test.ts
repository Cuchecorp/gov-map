import { describe, expect, it } from "vitest";
import {
  assertNoRutInLlmInput,
  assertPiiDocumentSafeForLlm,
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

  // CR-03: cuerpos cortos (1-6 digitos) que la regex anterior dejaba pasar.
  it.each([
    ["RUT cuerpo corto con puntos (123.456-7)", "el rut 123.456-7 figura"],
    ["RUT cuerpo corto sin puntos (12345-6)", "rut 12345-6 asociado"],
    ["RUT muy corto con punto (1.234-5)", "registro 1.234-5 en acta"],
    ["RUT cuerpo corto DV K (123.456-K)", "rut 123.456-K"],
  ])("CR-03 %s -> lanza RutInLlmInputError", (_label, text) => {
    expect(() => assertNoRutInLlmInput(text)).toThrow(RutInLlmInputError);
  });

  // CR-03: espacios alrededor del guion (forma comun OCR de documentos).
  it.each([
    ["espacios alrededor del guion (12.345.678 - 9)", "sujeto 12.345.678 - 9 declara"],
    ["espacio antes del guion (7.654.321 -K)", "rut 7.654.321 -K"],
    ["espacio despues del guion (7654321- K)", "rut 7654321- K"],
  ])("CR-03 %s -> lanza RutInLlmInputError", (_label, text) => {
    expect(() => assertNoRutInLlmInput(text)).toThrow(RutInLlmInputError);
  });

  it("CR-03 el mensaje NO expone el RUT de cuerpo corto", () => {
    try {
      assertNoRutInLlmInput("el rut 123.456-7 figura");
      throw new Error("debio lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(RutInLlmInputError);
      expect((e as Error).message).not.toContain("123.456-7");
      expect((e as Error).message).not.toContain("123456");
    }
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

// LEGAL-03: la compuerta extendida a un DOCUMENTO PII nuevo (texto de declaracion
// de patrimonio/intereses/lobby/donacion/contrato). REUSA ambos asserts existentes
// (assertNoRutInLlmInput + assertSensitivityAllowed); NO reimplementa regex ni gate.
describe("assertPiiDocumentSafeForLlm (LEGAL-03, PII nueva)", () => {
  it("documento PII con un RUT (texto de declaracion) -> lanza RutInLlmInputError", () => {
    expect(() =>
      assertPiiDocumentSafeForLlm(
        "Declaracion de patrimonio del titular 12.345.678-9 ante notario",
        safeProvider,
      ),
    ).toThrow(RutInLlmInputError);
  });

  it("documento PII con RUT de cuerpo corto -> lanza RutInLlmInputError", () => {
    expect(() =>
      assertPiiDocumentSafeForLlm("interes declarado de la contraparte 123.456-7", safeProvider),
    ).toThrow(RutInLlmInputError);
  });

  it("documento PII personal hacia un provider que entrena -> SensitiveRoutingError", () => {
    expect(() =>
      assertPiiDocumentSafeForLlm("declaracion de intereses sin identificadores", trainingProvider),
    ).toThrow(SensitiveRoutingError);
  });

  it("documento PII personal (sin RUT) hacia un provider que NO entrena -> OK", () => {
    expect(() =>
      assertPiiDocumentSafeForLlm("declaracion de intereses sin identificadores", safeProvider),
    ).not.toThrow();
  });

  it("el RUT se chequea ANTES del gate de provider (fail-closed mas estricto primero)", () => {
    // RUT presente + provider que entrena: debe lanzar por el RUT (mas duro), no por sensibilidad.
    expect(() =>
      assertPiiDocumentSafeForLlm("titular 12.345.678-9", trainingProvider),
    ).toThrow(RutInLlmInputError);
  });

  it("el mensaje de error NO expone el RUT del documento PII", () => {
    try {
      assertPiiDocumentSafeForLlm("titular 12.345.678-9 declara", safeProvider);
      throw new Error("debio lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(RutInLlmInputError);
      expect((e as Error).message).not.toContain("12.345.678-9");
    }
  });
});
