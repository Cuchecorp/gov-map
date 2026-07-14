import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseCamaraVotacion,
  parseCamaraVotoDetalle,
} from "./parse-camara-votacion";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

const boletinXml = leer("camara-votacion-boletin.xml");
const detalleXml = leer("camara-votacion-detalle.xml");

describe("parseCamaraVotacion (ns tempuri.org, boletín estructurado)", () => {
  it("produce ≥1 Votacion con boletín 14309-04 estructurado (no regex)", () => {
    const vs = parseCamaraVotacion(boletinXml);
    expect(vs.length).toBeGreaterThanOrEqual(1);
    expect(vs[0].boletin).toBe("14309-04");
  });

  it("mapea cámara=diputados, id sintético camara:<ID> y fecha ISO", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.camara).toBe("diputados");
    expect(v.id).toBe("camara:88813");
    expect(v.fecha).toMatch(/^2026-05-11T/);
  });

  it("toma totales del boletín (TotalAfirmativos/Negativos/Abstenciones)", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.total_si).toBe(58);
    expect(v.total_no).toBe(81);
    expect(v.total_abstencion).toBe(0);
  });

  it("mapea resultado y quorum desde el texto del nodo", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.resultado).toBe("Rechazado");
    expect(v.quorum).toBe("Quorum Simple");
  });

  it("provenance inline presente (origen/fecha_captura/enlace)", () => {
    const v = parseCamaraVotacion(boletinXml)[0];
    expect(v.origen).toBe("camara-opendata");
    expect(v.fecha_captura).toMatch(/T/);
    expect(v.enlace).toContain("opendata.camara.cl");
  });
});

describe("parseCamaraVotoDetalle (ns v1, voto-a-voto por Diputado/Id)", () => {
  it("produce votos con diputadoId y opcion mapeada (1→si, 0→no)", () => {
    const votos = parseCamaraVotoDetalle(detalleXml);
    expect(votos.length).toBeGreaterThanOrEqual(3);
    const alinco = votos.find((v) => v.diputadoId === "803");
    expect(alinco?.opcion).toBe("no"); // En Contra (Valor=0)
    const bobadilla = votos.find((v) => v.diputadoId === "815");
    expect(bobadilla?.opcion).toBe("si"); // Afirmativo (Valor=1)
  });

  it("arma nombreCrudo desde Nombre + apellidos", () => {
    const votos = parseCamaraVotoDetalle(detalleXml);
    const alinco = votos.find((v) => v.diputadoId === "803");
    expect(alinco?.nombreCrudo).toContain("Alinco");
  });
});

describe("parseCamaraVotoDetalle (ns tempuri REAL: getVotacion_Detalle, DIPID + Opcion Codigo)", () => {
  const detalleReal = leer("camara-votacion-detalle-real.xml");

  it("lee DIPID + <Opcion Codigo> de la forma REAL del WS (LIVE 2026-06-18)", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // Ahora emite el roster COMPLETO (5 opciones), no solo sí/no nominal: ~160 filas.
    expect(votos.length).toBeGreaterThan(100);
    // DIPID 815 = "En Contra" (Codigo=0) → no; presente.
    const bobadilla = votos.find((v) => v.diputadoId === "815");
    expect(bobadilla?.opcion).toBe("no");
    expect(bobadilla?.nombreCrudo).toContain("Bobadilla");
  });

  it("emite 'ausente' para No Vota (Codigo=4) — NUNCA lo descarta ni lo colapsa a sí/no", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // DIPID 803 = "No Vota" (Codigo=4) → ausente (asistencia honesta, no fabricada).
    const alinco = votos.find((v) => v.diputadoId === "803");
    expect(alinco?.opcion).toBe("ausente");
    expect(alinco?.nombreCrudo).toContain("Alinco");
    // Solo aparecen las opciones del catálogo (5 valores), nunca null/descartado.
    for (const v of votos)
      expect(["si", "no", "abstencion", "pareo", "ausente"]).toContain(v.opcion);
  });

  it("los DIPID cruzan determinísticamente contra id_diputado_camara de la maestra", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // Los DIPID son numéricos oficiales (803/815/843…) — el cruce lo hace reconciliarVotosCamara.
    for (const v of votos) expect(v.diputadoId).toMatch(/^\d+$/);
  });

  // --- Task 1 (Plan 64-01): abstención por CÓDIGO 2 (CONFIRMADO LIVE 2026-07-13) ---
  // El fixture real 88813 no trae una abstención (TotalAbstenciones=0), así que se ejercita
  // el mapeo por código con un XML mínimo tempuri con un <Opcion Codigo="2">.
  const votacionConCodigo = (codigo: string, texto: string) =>
    `<?xml version="1.0" encoding="utf-8"?>
     <Votacion xmlns="http://tempuri.org/">
       <Votos>
         <Voto>
           <Diputado><DIPID>999</DIPID><Nombre>Test</Nombre><Apellido_Paterno>Diputado</Apellido_Paterno></Diputado>
           <Opcion Codigo="${codigo}">${texto}</Opcion>
         </Voto>
       </Votos>
     </Votacion>`;

  it("mapea <Opcion Codigo=\"2\"> → 'abstencion' por CÓDIGO, con o sin texto reconocible (LIVE 2026-07-13)", () => {
    // Con texto "Abstencion" (caso live).
    const conTexto = parseCamaraVotoDetalle(votacionConCodigo("2", "Abstencion"));
    expect(conTexto.find((v) => v.diputadoId === "999")?.opcion).toBe("abstencion");
    // Código 2 SIN texto reconocible (o vacío): sigue siendo abstención POR CÓDIGO, no null.
    const sinTexto = parseCamaraVotoDetalle(votacionConCodigo("2", ""));
    expect(sinTexto.find((v) => v.diputadoId === "999")?.opcion).toBe("abstencion");
    const textoRaro = parseCamaraVotoDetalle(votacionConCodigo("2", "xyz"));
    expect(textoRaro.find((v) => v.diputadoId === "999")?.opcion).toBe("abstencion");
  });

  it("no regresa las otras ramas: code-1→si, code-0→no, code-4→ausente (contra el fixture real)", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // 986 Hernando = Afirmativo (Codigo=1) → si
    expect(votos.find((v) => v.diputadoId === "986")?.opcion).toBe("si");
    // 815 Bobadilla = En Contra (Codigo=0) → no
    expect(votos.find((v) => v.diputadoId === "815")?.opcion).toBe("no");
    // 1009 Alessandri = No Vota (Codigo=4), NO pareado → ausente
    expect(votos.find((v) => v.diputadoId === "1009")?.opcion).toBe("ausente");
  });

  it("fail-closed: una opción con código desconocido y texto ilegible → fila omitida (nunca fabrica sí/no)", () => {
    const raro = parseCamaraVotoDetalle(votacionConCodigo("9", "???"));
    expect(raro.find((v) => v.diputadoId === "999")).toBeUndefined();
  });
});

describe("parseCamaraVotoDetalle (roster completo: las 5 opciones por diputado, VOTE-03)", () => {
  const roster = leer("camara-votacion-detalle-roster.xml");

  it("emite una fila por diputado con su opción real (si/no/abstencion/pareo/ausente)", () => {
    const votos = parseCamaraVotoDetalle(roster);
    expect(votos.length).toBe(5); // ningún diputado se descarta
    const op = (id: string) => votos.find((v) => v.diputadoId === id)?.opcion;
    expect(op("815")).toBe("si"); // Afirmativo (Codigo=1)
    expect(op("843")).toBe("no"); // En Contra (Codigo=0)
    expect(op("872")).toBe("abstencion"); // texto "Abstención" (código no confirmado LIVE — A1)
    expect(op("915")).toBe("pareo"); // texto "Pareo" (código no confirmado LIVE — A1)
    expect(op("803")).toBe("ausente"); // No Vota (Codigo=4)
  });

  it("NUNCA colapsa una opción no-nominal a sí/no (fidelidad del roll-call)", () => {
    const votos = parseCamaraVotoDetalle(roster);
    // 1 sí, 1 no, 1 abstención, 1 pareo, 1 ausente — la suma cuadra con el roster.
    const cuenta = (op: string) => votos.filter((v) => v.opcion === op).length;
    expect(cuenta("si")).toBe(1);
    expect(cuenta("no")).toBe(1);
    expect(cuenta("abstencion")).toBe(1);
    expect(cuenta("pareo")).toBe(1);
    expect(cuenta("ausente")).toBe(1);
  });
});

describe("parseCamaraVotacion con detalleXml (totales del detalle pisan boletín)", () => {
  it("usa los totales del detalle para la votación coincidente (id 89178 no está en boletín → solo boletín)", () => {
    // El detalle es de la votación 89178 (boletín 18296), no presente en el fixture de boletín
    // (14309). Por eso los totales del boletín se conservan; el test verifica que pasar detalle
    // no rompe el parseo del boletín.
    const vs = parseCamaraVotacion(boletinXml, { detalleXml });
    expect(vs[0].boletin).toBe("14309-04");
    expect(vs[0].total_si).toBe(58);
  });
});
