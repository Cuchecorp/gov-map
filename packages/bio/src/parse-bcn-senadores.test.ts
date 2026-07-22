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
  enlazarSenadoresPorParlid,
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

  it("la query filtra por bio:idSenado y lo selecciona (corrección LIVE 90-03)", () => {
    expect(BCN_MILITANCY_QUERY).toContain("bio:idSenado");
    expect(BCN_MILITANCY_QUERY).not.toContain("a bio:Senador"); // clase inexistente, devolvía 0
    expect(BCN_MILITANCY_QUERY).toContain("?idSenado");
  });

  it("mapea parlidSenado desde idSenado del binding", () => {
    const mil = parseBcnSenadores(cargar());
    const nunez = mil.find((m) => m.personaNombre.startsWith("Ricardo"))!;
    expect(nunez.parlidSenado).toBe("701");
    const rincon = mil.find((m) => m.personaNombre.startsWith("Ximena"))!;
    expect(rincon.parlidSenado).toBe("1009");
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

describe("parse-bcn-senadores — enlace DETERMINISTA por parlid_senado (corrección LIVE 90-03)", () => {
  it("confirma militancia por parlid_senado exacto; parlid ausente en maestra → sinMatch", () => {
    const maestra: MaestraRow[] = [maestraRow("701", "Ricardo Núñez Muñoz")]; // parlid_senado = id
    const mil = parseBcnSenadores(cargar());
    const res = enlazarSenadoresPorParlid(mil, maestra, {
      origen: "bcn-senadores",
      fechaCaptura: "2026-07-22T00:00:00Z",
      enlace: "https://datos.bcn.cl/sparql",
    });
    // Núñez (701) enlazado; Rincón (1009) no está en la maestra → sinMatch.
    expect(res.militancias.every((m) => m.parlamentarioId === "701")).toBe(true);
    expect(res.militancias).toHaveLength(2);
    expect(res.sinMatch).toContain("SEN:1009");
    expect(res.confirmados).toHaveLength(1);
  });

  it("NO fabrica FK ante parlid_senado ambiguo (dos filas comparten parlid) → fail-closed", () => {
    const maestra: MaestraRow[] = [
      maestraRow("A", "Ricardo Núñez Muñoz"),
      maestraRow("B", "Otro Nombre Cualquiera"),
    ];
    // Forzar ambigüedad: ambas filas con parlid_senado "701".
    maestra[0]!.parlid_senado = "701";
    maestra[1]!.parlid_senado = "701";
    const mil = parseBcnSenadores(cargar()).filter((m) => m.parlidSenado === "701");
    const res = enlazarSenadoresPorParlid(mil, maestra, {
      origen: "bcn-senadores",
      fechaCaptura: "2026-07-22T00:00:00Z",
      enlace: "https://datos.bcn.cl/sparql",
    });
    expect(res.militancias).toHaveLength(0); // ambiguo → skip, cero FK
    expect(res.sinMatch).toContain("SEN:701");
  });

  it("militancia sin parlidSenado (BCN no lo trajo) → sinMatch declarado, no defaulteado", () => {
    const mil = parseBcnSenadores(cargar()).map((m) => ({ ...m, parlidSenado: null }));
    const res = enlazarSenadoresPorParlid(mil, [maestraRow("701", "Ricardo Núñez Muñoz")], {
      origen: "bcn-senadores",
      fechaCaptura: "2026-07-22T00:00:00Z",
      enlace: "https://datos.bcn.cl/sparql",
    });
    expect(res.militancias).toHaveLength(0);
    expect(res.sinMatch.length).toBeGreaterThan(0);
  });
});
