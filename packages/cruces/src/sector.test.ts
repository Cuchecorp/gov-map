// sector.test (@obs/cruces) — PKG-11: SECTOR_CODIGOS se mantiene a mano (z.enum exige
// tupla de literales, no se puede derivar con .map sin perder el tipo). Este test
// GARANTIZA que coincida 1:1 con SECTOR_CATALOGO para que nunca diverjan.

import { describe, it, expect } from "vitest";
import { SECTOR_CATALOGO, SECTOR_CODIGOS } from "./sector";

describe("SECTOR_CODIGOS vs SECTOR_CATALOGO (drift guard)", () => {
  it("coincide 1:1 en orden y contenido con los códigos del catálogo", () => {
    expect([...SECTOR_CODIGOS]).toEqual(SECTOR_CATALOGO.map((s) => s.codigo));
  });

  it("no tiene duplicados ni catch-all 'otros' (D-05)", () => {
    expect(new Set(SECTOR_CODIGOS).size).toBe(SECTOR_CODIGOS.length);
    expect(SECTOR_CODIGOS).not.toContain("otros");
  });
});
