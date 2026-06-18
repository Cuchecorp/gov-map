import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseCamaraSesion } from "./parse-camara-sesion";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const sesionesXml = readFileSync(join(FIXTURES, "camara-sesiones-58.xml"), "utf8");

describe("parseCamaraSesion (ns v1, Leg 58)", () => {
  it("produce ≥1 sesión con Id/Numero/FechaInicio", () => {
    const sesiones = parseCamaraSesion(sesionesXml);
    expect(sesiones.length).toBeGreaterThanOrEqual(1);
    const primera = sesiones[0];
    expect(primera.id).toBe("4755");
    expect(primera.numero).toBe("0");
    expect(primera.fechaInicio).toMatch(/^2026-03-11T/);
  });

  it("mapea tipo y estado desde el texto del nodo", () => {
    const s = parseCamaraSesion(sesionesXml).find((x) => x.id === "4757");
    expect(s?.tipo).toBe("Ordinaria");
    expect(s?.estado).toBe("Celebrada");
  });
});
