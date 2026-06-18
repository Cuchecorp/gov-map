import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ParlamentarioSeedSchema } from "@obs/core";
import { parseCamara, partidoVigente, FechaInvalidaError } from "./parse-camara";

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

  it("CR-02: una FechaInicio malformada LANZA (no cae a un partido anterior en silencio)", () => {
    const mil = [
      {
        FechaInicio: "no-es-fecha",
        FechaTermino: null,
        Partido: { Id: "X", Nombre: "X", Alias: "X" },
      },
    ];
    expect(() => partidoVigente(mil, corte)).toThrow(FechaInvalidaError);
  });

  it("CR-02: una FechaTermino malformada LANZA", () => {
    const mil = [
      {
        FechaInicio: "2026-03-11T00:00:00",
        FechaTermino: "basura",
        Partido: { Id: "X", Nombre: "X", Alias: "X" },
      },
    ];
    expect(() => partidoVigente(mil, corte)).toThrow(FechaInvalidaError);
  });

  it("WR-04: con militancias solapadas elige la de FechaInicio más reciente, no la primera", () => {
    // Orden del XML deliberadamente al revés (la obsoleta primero).
    const mil = [
      {
        FechaInicio: "2010-03-11T00:00:00",
        FechaTermino: null, // open-ended pero antigua
        Partido: { Id: "VIEJO", Nombre: "Viejo", Alias: "VIEJO" },
      },
      {
        FechaInicio: "2026-03-11T00:00:00",
        FechaTermino: null, // open-ended y reciente -> debe ganar
        Partido: { Id: "NUEVO", Nombre: "Nuevo", Alias: "NUEVO" },
      },
    ];
    expect(partidoVigente(mil, corte)).toBe("NUEVO");
  });
});

describe("parseCamara — robustez (CR-02, CR-03, WR-05)", () => {
  function xmlDiputado(inner: string): string {
    return `<?xml version="1.0"?><DiputadosPeriodoColeccion>${inner}</DiputadosPeriodoColeccion>`;
  }
  function diputado(opts: { id?: string; militancia?: string }): string {
    const id = opts.id != null ? `<Id>${opts.id}</Id>` : "";
    const mil =
      opts.militancia ??
      `<Militancias><Militancia><FechaInicio>2026-03-11T00:00:00</FechaInicio><FechaTermino xsi:nil="true"/><Partido><Alias>IND</Alias></Partido></Militancia></Militancias>`;
    return `<DiputadoPeriodo><Diputado>${id}<Nombre>Test</Nombre><ApellidoPaterno>Apellido</ApellidoPaterno><ApellidoMaterno>Materno</ApellidoMaterno>${mil}</Diputado></DiputadoPeriodo>`;
  }
  // 12 diputados válidos para superar el piso MIN_DIPUTADOS (10).
  function relleno(n: number): string {
    return Array.from({ length: n }, (_, i) => diputado({ id: String(2000 + i) })).join("");
  }

  it("CR-03: un <Diputado> sin Id LANZA (no fabrica id colisionable 'D?')", () => {
    const xml = xmlDiputado(relleno(12) + diputado({})); // uno sin Id
    expect(() => parseCamara(xml)).toThrow(/sin Id/);
  });

  it("WR-05: conteo implausiblemente bajo (< 10) LANZA en vez de devolver snapshot recortado", () => {
    const xml = xmlDiputado(relleno(3));
    expect(() => parseCamara(xml)).toThrow(/XML inesperado/);
  });

  it("CR-02: una fecha malformada NO mata el run; deja partido=null y lo registra", () => {
    const malo = diputado({
      id: "9999",
      militancia: `<Militancias><Militancia><FechaInicio>basura</FechaInicio><Partido><Alias>X</Alias></Partido></Militancia></Militancias>`,
    });
    const xml = xmlDiputado(relleno(12) + malo);
    const logs: string[] = [];
    const rows = parseCamara(xml, { log: (m) => logs.push(m) });
    const fila = rows.find((r) => r.id_diputado_camara === "9999")!;
    expect(fila.partido).toBeNull();
    expect(logs.some((l) => l.includes("9999") && l.includes("CR-02"))).toBe(true);
  });
});
