// parse-leylobby.test — golden del parser contra el fixture real de audiencias de leylobby.
//
// Verifica (INT-01): (a) keying por `Identificador` (NO por el número de URL del listado);
// (b) el sujeto pasivo se identifica por `rol === "Sujeto Pasivo"`; (c) cada no-sujeto-pasivo
// produce una contraparte; (d) una audiencia malformada (sin Identificador) se descarta sin
// fabricar; (e) la fecha parsea + se preserva `fechaRaw`.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLobbyAudiencias, institucionDeIdentificador } from "./parse-leylobby";
import { ROL_SUJETO_PASIVO } from "./model";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "test", "fixtures", "audiencias-congreso.html");

function cargarFixture() {
  const html = readFileSync(FIXTURE, "utf8");
  return parseLobbyAudiencias(html, {
    enlace: "https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024/663021",
    fechaCaptura: "2026-06-19T00:00:00Z",
  });
}

describe("parse-leylobby — golden del fixture real", () => {
  it("mapea el fixture a 2 audiencias válidas (la 3.ª, sin Identificador, se descarta)", () => {
    const aud = cargarFixture();
    expect(aud.length).toBe(2);
  });

  it("keya por el cell Identificador (NO por el número de URL del listado)", () => {
    const aud = cargarFixture();
    const ids = aud.map((a) => a.identificador).sort();
    expect(ids).toEqual(["AA001AW1639516", "AA001AW1677223"]);
    // El número de URL del listado (663021) NUNCA es la clave.
    expect(aud.some((a) => a.identificador.includes("663021"))).toBe(false);
    // El enlace de detalle SÍ puede contener el número de URL (es raw), pero no la clave.
    const a1 = aud.find((a) => a.identificador === "AA001AW1639516")!;
    expect(a1.enlaceDetalle).toContain("663021");
  });

  it("deriva la institución del Identificador (AA001)", () => {
    const aud = cargarFixture();
    expect(aud.every((a) => a.institucionCodigo === "AA001")).toBe(true);
    expect(institucionDeIdentificador("AA001AW1639516")).toBe("AA001");
  });

  it("parsea la fecha a ISO y preserva fechaRaw (nunca fabrica)", () => {
    const aud = cargarFixture();
    const a1 = aud.find((a) => a.identificador === "AA001AW1639516")!;
    expect(a1.fechaRaw).toBe("2024-06-24 12:30:00-04");
    expect(a1.fecha).not.toBeNull();
    expect(a1.fecha!.startsWith("2024-06-24")).toBe(true);
  });

  it("identifica el sujeto pasivo por rol === 'Sujeto Pasivo'", () => {
    const aud = cargarFixture();
    const a1 = aud.find((a) => a.identificador === "AA001AW1639516")!;
    const sujetos = a1.asistentes.filter((x) => x.rol === ROL_SUJETO_PASIVO);
    expect(sujetos.length).toBe(1);
    expect(sujetos[0]!.nombre).toBe("Víctor Gutiérrez");
  });

  it("cada asistente no-sujeto-pasivo es una contraparte cruda (con representado raw)", () => {
    const aud = cargarFixture();
    const a1 = aud.find((a) => a.identificador === "AA001AW1639516")!;
    const contrapartes = a1.asistentes.filter((x) => x.rol !== ROL_SUJETO_PASIVO);
    expect(contrapartes.length).toBe(2);
    expect(contrapartes.map((c) => c.nombre).sort()).toEqual([
      "CONSTANZA Baasch",
      "María José Valenzuela",
    ]);
    // El rol crudo se preserva (column-agnostic, Assumption A2).
    expect(contrapartes.every((c) => c.rol === "Gestor de intereses")).toBe(true);
    // El representado raw del grupo se propaga.
    expect(contrapartes.every((c) => c.representado === "Fundación Momart")).toBe(true);
  });

  it("una audiencia sin contraparte (todos sujetos pasivos) no fabrica contrapartes", () => {
    const aud = cargarFixture();
    const a2 = aud.find((a) => a.identificador === "AA001AW1677223")!;
    expect(a2.asistentes.length).toBe(2);
    expect(a2.asistentes.every((x) => x.rol === ROL_SUJETO_PASIVO)).toBe(true);
  });

  it("una fuente vacía produce 0 audiencias (nunca inventa)", () => {
    expect(parseLobbyAudiencias("<html><body></body></html>")).toEqual([]);
  });
});
