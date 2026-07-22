// parse-bcn-senadores.test — mapeo del sparql-results (fixture, sin red) a militancias + enlace
// fail-closed por nombre. Vocabulario BCN descubierto por el spike EN VIVO 2026-07-22:
// hasPoliticalParty / hasBeginning·originalDate / hasEnd·originalDate (documentado en el SUMMARY).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseBcnSenadores,
  enlazarSenadores,
  buildSparqlUrl,
  BCN_MILITANCY_QUERY,
  type SparqlResults,
} from "./parse-bcn-senadores";
import type { MaestraRow } from "@obs/identity";
import { normalizarNombre } from "@obs/core";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "__fixtures__", "bcn-militancy.json");

function cargar(): SparqlResults {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as SparqlResults;
}

function maestraRow(id: string, libre: string): MaestraRow {
  const { nombre_normalizado } = normalizarNombre({ libre });
  const [nombres = "", ap = "", am = ""] = libre.split(" ");
  return {
    id,
    nombre_normalizado,
    nombres,
    apellido_paterno: ap,
    apellido_materno: am,
    camara: "senado",
    periodo: "2026-2034",
    region: null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: id,
    id_diputado_camara: null,
    estado: "no_confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-07-22T00:00:00Z",
    enlace: "https://www.senado.cl",
  };
}

describe("parse-bcn-senadores — mapeo sparql-results (allowlist)", () => {
  it("construye la URL con URLSearchParams (query codificada, format=json)", () => {
    const url = buildSparqlUrl(BCN_MILITANCY_QUERY);
    expect(url).toContain("query=");
    expect(url).toContain("format=json");
    // sin espacios crudos ni saltos → codificado
    expect(url).not.toContain("\n");
    expect(url).not.toMatch(/query=PREFIX bio/);
  });

  it("mapea cada binding a { partido, desde, hasta } sin PII", () => {
    const mil = parseBcnSenadores(cargar());
    expect(mil.length).toBe(3);
    const nunez = mil.filter((m) => m.personaNombre.startsWith("Ricardo"));
    expect(nunez).toHaveLength(2);
    const ppd = nunez.find((m) => m.partido === "Partido Por la Democracia")!;
    expect(ppd.desde).toBe("1988-01-01");
    expect(ppd.hasta).toBe("2006-03-10");
    const ps = nunez.find((m) => m.partido === "Partido Socialista de Chile")!;
    expect(ps.hasta).toBeNull(); // sin endDate → vigente
  });

  it("no emite PII: el JSON del mapeo no contiene URIs de persona como identidad ni fechas de nacimiento", () => {
    const mil = parseBcnSenadores(cargar());
    // personaUri es trazabilidad, no identidad persistida; el partido/fechas sí. Ninguna PII.
    const json = JSON.stringify(mil);
    expect(json).not.toContain("nacimiento");
    expect(json).not.toContain("rut");
  });
});

describe("parse-bcn-senadores — enlace fail-closed por nombre (A3: BCN sin parlid)", () => {
  it("confirma militancia SOLO con nombre único; homónimo/sin-candidato → sinMatch", () => {
    const maestra: MaestraRow[] = [
      maestraRow("S1", "Ricardo Núñez Muñoz"),
      // Ximena Rincón NO está en la maestra → sin-candidato → sinMatch.
    ];
    const mil = parseBcnSenadores(cargar());
    const res = enlazarSenadores(mil, maestra, {
      periodo: "2026-2034",
      origen: "bcn-senadores",
      fechaCaptura: "2026-07-22T00:00:00Z",
      enlace: "https://datos.bcn.cl/sparql",
    });
    // 2 militancias de Núñez enlazadas a S1; Rincón queda sin match (no fabrica FK).
    expect(res.militancias.every((m) => m.parlamentarioId === "S1")).toBe(true);
    expect(res.militancias).toHaveLength(2);
    expect(res.sinMatch).toContain("Ximena Rincón González");
    expect(res.militancias.find((m) => m.partido.includes("Demócrata"))).toBeUndefined();
  });

  it("NO fabrica FK ante homónimo (2 candidatos con el mismo nombre) → fail-closed", () => {
    const maestra: MaestraRow[] = [
      maestraRow("S1", "Ricardo Núñez Muñoz"),
      maestraRow("S2", "Ricardo Núñez Muñoz"), // homónimo
    ];
    const mil = parseBcnSenadores(cargar()).filter((m) => m.personaNombre.startsWith("Ricardo"));
    const res = enlazarSenadores(mil, maestra, {
      periodo: "2026-2034",
      origen: "bcn-senadores",
      fechaCaptura: "2026-07-22T00:00:00Z",
      enlace: "https://datos.bcn.cl/sparql",
    });
    expect(res.militancias).toHaveLength(0); // homónimo → skip
    expect(res.sinMatch).toContain("Ricardo Núñez Muñoz");
  });
});
