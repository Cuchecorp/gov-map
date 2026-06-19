/**
 * Tests runtime de la factory `confirmar` (IDENT-12). La prueba de COMPILACIÓN
 * (un string crudo NO es un EnlaceConfirmado) vive en `enlace-confirmado.test-d.ts`.
 */
import { describe, it, expect } from "vitest";
import { confirmar, type EnlaceConfirmado } from "./enlace-confirmado";

describe("confirmar — factory única del EnlaceConfirmado branded", () => {
  it("mintea con metodo='determinista' por defecto", () => {
    const enlace = confirmar("P00042");
    expect(enlace.parlamentarioId).toBe("P00042");
    expect(enlace.metodo).toBe("determinista");
  });

  it("acepta metodo='humano' (promoción humana vía revisor-cli)", () => {
    const enlace = confirmar("P00042", "humano");
    expect(enlace.parlamentarioId).toBe("P00042");
    expect(enlace.metodo).toBe("humano");
  });

  it("el valor minteado es asignable a EnlaceConfirmado (uso de writer)", () => {
    const enlace: EnlaceConfirmado | null = confirmar("P00500", "determinista");
    expect(enlace?.parlamentarioId).toBe("P00500");
  });
});
