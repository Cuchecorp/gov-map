// extraer-sujeto-camara.test — extracción del honorable real del sujeto pasivo de la Cámara.
// Cuando el sujeto pasivo es un asesor, el diputado/senador real va entre paréntesis (H.D./H.S.).

import { describe, it, expect } from "vitest";
import { extraerNombreSujetoCamara } from "./extraer-sujeto-camara";

describe("extraerNombreSujetoCamara", () => {
  it("asesor con H.D. → devuelve el nombre del diputado (no del asesor)", () => {
    expect(
      extraerNombreSujetoCamara("María José Castañeda Marambio (Asesor(a) H.D. Cristian Mella Andaur)"),
    ).toBe("Cristian Mella Andaur");
  });

  it("asesor con H.S. → devuelve el nombre del senador", () => {
    expect(extraerNombreSujetoCamara("X (Asesor H.S. Juan Pérez)")).toBe("Juan Pérez");
  });

  it("nombre de diputado plano (sin paréntesis) → se devuelve sin cambios (recortado)", () => {
    expect(extraerNombreSujetoCamara("  Sofía González Cortés ")).toBe("Sofía González Cortés");
  });

  it("nombre con paréntesis NO relacionados → devuelve el raw (solo H.D./H.S. dispara extracción)", () => {
    expect(extraerNombreSujetoCamara("Pedro Soto (PS)")).toBe("Pedro Soto (PS)");
  });

  it("tolera variantes de formato H.D (sin punto final, mayúsculas/minúsculas, espacios)", () => {
    expect(extraerNombreSujetoCamara("Ana (Asesora h.d Macarena Santelices Cañas)")).toBe(
      "Macarena Santelices Cañas",
    );
  });

  it("colapsa whitespace interno del nombre capturado", () => {
    expect(extraerNombreSujetoCamara("Z (Asesor(a) H.D.  Juan   Pérez )")).toBe("Juan Pérez");
  });
});
