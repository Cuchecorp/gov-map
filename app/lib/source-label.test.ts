import { describe, expect, it } from "vitest";

import { sourceLabel } from "./types";

describe("sourceLabel (PROV-01)", () => {
  it('origen canónico "diputados" → "Cámara" (no "fuente desconocida")', () => {
    expect(sourceLabel("diputados")).toBe("Cámara");
  });

  it('origen "senado" → "Senado"', () => {
    expect(sourceLabel("senado")).toBe("Senado");
  });

  it('origen "camara" → "Cámara"', () => {
    expect(sourceLabel("camara")).toBe("Cámara");
  });

  it('origen de lobby "camara-transparencia-lobby" → "Ley del Lobby" (no "InfoProbidad")', () => {
    // Contiene "transparencia" pero el chequeo de lobby gana primero (orden importa).
    expect(sourceLabel("camara-transparencia-lobby")).toBe("Ley del Lobby");
  });

  it('origen de probidad "infoprobidad-sparql" → "InfoProbidad"', () => {
    expect(sourceLabel("infoprobidad-sparql")).toBe("InfoProbidad");
  });

  it("origen desconocido / null → honest fallback", () => {
    expect(sourceLabel("foobar")).toBe("fuente desconocida");
    expect(sourceLabel(null)).toBe("fuente desconocida");
  });
});
