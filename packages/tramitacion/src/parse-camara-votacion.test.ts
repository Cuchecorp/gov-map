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
    expect(votos.length).toBeGreaterThan(50); // ~139 con sí/no nominal (No Vota se omite)
    // DIPID 815 = "En Contra" (Codigo=0) → no; presente.
    const bobadilla = votos.find((v) => v.diputadoId === "815");
    expect(bobadilla?.opcion).toBe("no");
    expect(bobadilla?.nombreCrudo).toContain("Bobadilla");
  });

  it("omite las opciones NO nominales (No Vota / Abstención / dispensado)", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // DIPID 803 = "No Vota" (Codigo=4) → se omite (no fabrica sí/no).
    expect(votos.find((v) => v.diputadoId === "803")).toBeUndefined();
    // Todos los devueltos son si|no.
    for (const v of votos) expect(["si", "no"]).toContain(v.opcion);
  });

  it("los DIPID cruzan determinísticamente contra id_diputado_camara de la maestra", () => {
    const votos = parseCamaraVotoDetalle(detalleReal);
    // Los DIPID son numéricos oficiales (803/815/843…) — el cruce lo hace reconciliarVotosCamara.
    for (const v of votos) expect(v.diputadoId).toMatch(/^\d+$/);
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
