import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ParlamentarioSeedSchema } from "@obs/core";
import { parseCamara, partidoVigente } from "./parse-camara";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../test/fixtures/camara-real.xml", import.meta.url)),
  "utf8",
);

describe("parseCamara (fixture real)", () => {
  it("parsea exactamente 155 diputados con camara='diputados'", () => {
    const rows = parseCamara(FIXTURE);
    expect(rows.length).toBe(155);
    for (const r of rows) {
      expect(r.camara).toBe("diputados");
    }
  });

  it("mapea Id->id_diputado_camara; rut y distrito null (Pitfall 4)", () => {
    const rows = parseCamara(FIXTURE);
    // Primer diputado del fixture: Santibáñez Novoa, Marisela (Id 1074).
    const sant = rows.find((r) => r.id_diputado_camara === "1074");
    expect(sant).toBeDefined();
    expect(sant!.apellido_paterno).toBe("Santibáñez");
    expect(sant!.apellido_materno).toBe("Novoa");
    expect(sant!.nombres).toBe("Marisela");
    expect(sant!.rut).toBeNull();
    expect(sant!.distrito).toBeNull();
    expect(sant!.parlid_senado).toBeNull();
    expect(sant!.periodo).toBe("2026-2030");
  });

  it("partido = militancia vigente (cubre el corte), NO el nodo periodo", () => {
    const rows = parseCamara(FIXTURE);
    // Santibáñez (1074): su ultima militancia (2026-03-11..2030-03-10) = Independientes (IND).
    const sant = rows.find((r) => r.id_diputado_camara === "1074")!;
    expect(sant.partido).toBe("IND");
    // Urcullú (1254): militancia unica 2026-03-11.. = Partido Republicano (PREP).
    const urcullu = rows.find((r) => r.id_diputado_camara === "1254")!;
    expect(urcullu.partido).toBe("PREP");
  });

  it("cada fila valida ParlamentarioSeedSchema (zod)", () => {
    const rows = parseCamara(FIXTURE);
    for (const r of rows) {
      expect(() => ParlamentarioSeedSchema.parse(r)).not.toThrow();
    }
  });

  it("estado inicial NO es 'confirmado' (compuerta humana)", () => {
    const rows = parseCamara(FIXTURE);
    for (const r of rows) {
      expect(r.estado).not.toBe("confirmado");
    }
  });
});

describe("partidoVigente", () => {
  const corte = new Date("2026-03-11T12:00:00");

  it("elige la militancia cuyo rango cubre el corte", () => {
    const mil = [
      {
        FechaInicio: "2018-03-11T00:00:00",
        FechaTermino: "2026-03-10T23:59:59",
        Partido: { Id: "PC", Nombre: "Partido Comunista", Alias: "PC" },
      },
      {
        FechaInicio: "2026-03-11T00:00:00",
        FechaTermino: "2030-03-10T23:59:59",
        Partido: { Id: "IND", Nombre: "Independientes", Alias: "IND" },
      },
    ];
    expect(partidoVigente(mil, corte)).toBe("IND");
  });

  it("trata FechaTermino nil como vigente", () => {
    const mil = [
      {
        FechaInicio: "2026-03-11T00:00:00",
        FechaTermino: null,
        Partido: { Id: "PREP", Nombre: "Partido Republicano", Alias: "PREP" },
      },
    ];
    expect(partidoVigente(mil, corte)).toBe("PREP");
  });

  it("devuelve null si ninguna militancia cubre el corte", () => {
    const mil = [
      {
        FechaInicio: "2018-03-11T00:00:00",
        FechaTermino: "2022-03-10T23:59:59",
        Partido: { Id: "PC", Nombre: "Partido Comunista", Alias: "PC" },
      },
    ];
    expect(partidoVigente(mil, corte)).toBeNull();
  });

  it("devuelve null si no hay militancias", () => {
    expect(partidoVigente([], corte)).toBeNull();
  });
});
