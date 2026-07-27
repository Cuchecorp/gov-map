// parse-bcn-senadores.test — mapeo del sparql-results (fixture, sin red) a militancias + enlace
// fail-closed por nombre. Vocabulario BCN descubierto por el spike EN VIVO 2026-07-22:
// hasPoliticalParty / hasBeginning·originalDate / hasEnd·originalDate (documentado en el SUMMARY).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseBcnSenadores,
  parseBcnSenadoresConReporte,
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
const FIXTURE_URI = join(here, "__fixtures__", "bcn-militancy-uri.json");

function cargar(): SparqlResults {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as SparqlResults;
}

function cargarUri(): SparqlResults {
  return JSON.parse(readFileSync(FIXTURE_URI, "utf8")) as SparqlResults;
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

describe("parse-bcn-senadores — resolución URI→label fail-closed (BCN-01, Phase 105)", () => {
  // Evidencia (Task 1): 27 URIs de partido DISTINCT en el crudo R2 (envelope
  // bio/envelope/2026-07-22/1fab3cb0…json), corroboradas 1:1 por SPARQL en vivo. 7 SIN rdfs:label
  // (BCN no expone literal alguno para su recurso) — esas disparaban el bug URI-como-partido. El
  // caso testigo S1344 (Matías Walker) = partido-democratas-chile, SIN_LABEL.

  it("Test A — label presente → verbatim (happy path intacto, 3 bindings originales)", () => {
    const mil = parseBcnSenadores(cargar());
    expect(mil).toHaveLength(3);
    expect(mil.map((m) => m.partido)).toEqual([
      "Partido Por la Democracia",
      "Partido Socialista de Chile",
      "Partido Demócrata Cristiano",
    ]);
    // Ningún partido es un URI.
    expect(mil.every((m) => !/^https?:\/\//.test(m.partido))).toBe(true);
  });

  it("Test B — URI conocida sin label → label del mapa determinista (NO el URI)", () => {
    const mil = parseBcnSenadores(cargarUri());
    // Caso testigo S1344: partido-democratas-chile (SIN_LABEL en BCN) → label legible del mapa.
    const walker = mil.find((m) => m.parlidSenado === "1344")!;
    expect(walker).toBeDefined();
    expect(walker.partido).not.toMatch(/^https?:\/\//);
    expect(walker.partido).toBe("Partido Demócratas de Chile");
  });

  it("Test C — URI desconocida sin label → fail-closed (omite + reporta la URI)", () => {
    const { militancias, partidosDesconocidos } = parseBcnSenadoresConReporte(cargarUri());
    // La persona con URI fuera del mapa (parlid 9999) NO produce militancia.
    expect(militancias.find((m) => m.parlidSenado === "9999")).toBeUndefined();
    // La URI desconocida queda REPORTADA con su causa (jamás emitida como partido).
    expect(partidosDesconocidos).toContain(
      "http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-inexistente-no-en-el-mapa",
    );
    // JAMÁS se deriva del slug: ninguna militancia trae "Inexistente" como partido.
    expect(militancias.every((m) => !m.partido.toLowerCase().includes("inexistente"))).toBe(true);
  });

  it("Test D — regresión anti-URI: ningún `partido` de salida empieza con http/https", () => {
    for (const cargador of [cargar, cargarUri]) {
      const mil = parseBcnSenadores(cargador());
      for (const m of mil) {
        expect(m.partido).not.toMatch(/^https?:\/\//);
      }
    }
    // También sobre el reporte completo.
    const { militancias } = parseBcnSenadoresConReporte(cargarUri());
    expect(militancias.every((m) => !/^https?:\/\//.test(m.partido))).toBe(true);
  });

  it("parseBcnSenadores (forma array) delega en el mismo resolver que la forma con reporte", () => {
    const arr = parseBcnSenadores(cargarUri());
    const { militancias } = parseBcnSenadoresConReporte(cargarUri());
    expect(arr).toEqual(militancias);
    // El fixture-uri tiene 3 bindings; 1 fail-closed (9999) → 2 militancias mapeadas.
    expect(arr).toHaveLength(2);
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
