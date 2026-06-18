/**
 * Tests de blocking (ID-03). generarCandidatos es fail-OPEN por diseño (Pitfall 2):
 * cámara/periodo son filtros DUROS; la región es BLANDA (si la mención no trae
 * región, no filtra). Perder al candidato real sería un falso negativo silencioso.
 */
import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { generarCandidatos } from "./candidatos";
import type { MencionForanea } from "./tipos";

/** Construye un Parlamentario de la maestra con defaults razonables. */
function maestro(p: Partial<Parlamentario> & { id: string }): Parlamentario {
  return {
    id: p.id,
    nombre_normalizado: p.nombre_normalizado ?? "",
    nombres: p.nombres ?? "",
    apellido_paterno: p.apellido_paterno ?? "",
    apellido_materno: p.apellido_materno ?? "",
    camara: p.camara ?? "senado",
    periodo: p.periodo ?? "senado-vigente-2026",
    region: p.region ?? null,
    distrito: p.distrito ?? null,
    circunscripcion: p.circunscripcion ?? null,
    partido: p.partido ?? null,
    rut: p.rut ?? null,
    parlid_senado: p.parlid_senado ?? null,
    id_diputado_camara: p.id_diputado_camara ?? null,
    estado: p.estado ?? "confirmado",
    email: p.email ?? null,
    origen: p.origen ?? "senado",
    fecha_captura: p.fecha_captura ?? "2026-01-01T00:00:00Z",
    enlace: p.enlace ?? "https://example.cl",
  };
}

/** Construye una mención foránea con defaults. */
function mencion(m: Partial<MencionForanea> & { tokens: string[] }): MencionForanea {
  return {
    nombreOriginal: m.nombreOriginal ?? "",
    nombreNormalizado: m.nombreNormalizado ?? m.tokens.join(" "),
    tokens: m.tokens,
    camara: m.camara ?? "senado",
    periodo: m.periodo ?? "senado-vigente-2026",
    region: m.region ?? null,
  };
}

describe("generarCandidatos — blocking apellido + cámara + periodo (duros)", () => {
  it("incluye un candidato cuyo apellido paterno (token) coincide y comparte cámara+periodo", () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "walker prieto matias", camara: "senado", periodo: "senado-vigente-2026" }),
    ];
    const m = mencion({ tokens: ["walker", "matias"], camara: "senado", periodo: "senado-vigente-2026" });
    const out = generarCandidatos(m, maestra);
    expect(out.map((c) => c.id)).toEqual(["P00001"]);
  });

  it("excluye candidatos de OTRA cámara aunque el apellido coincida", () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "walker prieto matias", camara: "diputados", periodo: "senado-vigente-2026" }),
    ];
    const m = mencion({ tokens: ["walker"], camara: "senado", periodo: "senado-vigente-2026" });
    expect(generarCandidatos(m, maestra)).toEqual([]);
  });

  it("excluye candidatos de OTRO periodo", () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "walker prieto matias", camara: "senado", periodo: "senado-vigente-2022" }),
    ];
    const m = mencion({ tokens: ["walker"], camara: "senado", periodo: "senado-vigente-2026" });
    expect(generarCandidatos(m, maestra)).toEqual([]);
  });
});

describe("generarCandidatos — región fail-open (blanda)", () => {
  it("si la mención NO trae región (null), no filtra por región — incluye de cualquier región", () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "soto vega ana", region: "Valparaíso" }),
      maestro({ id: "P00002", nombre_normalizado: "soto rios juan", region: "Biobío" }),
    ];
    const m = mencion({ tokens: ["soto"], region: null });
    expect(generarCandidatos(m, maestra).map((c) => c.id)).toEqual(["P00001", "P00002"]);
  });

  it("si mención y candidato traen región distinta, lo excluye", () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "soto vega ana", region: "Biobío" }),
    ];
    const m = mencion({ tokens: ["soto"], region: "Valparaíso" });
    expect(generarCandidatos(m, maestra)).toEqual([]);
  });

  it("si mención y candidato traen la MISMA región, lo incluye", () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "soto vega ana", region: "Valparaíso" }),
    ];
    const m = mencion({ tokens: ["soto"], region: "Valparaíso" });
    expect(generarCandidatos(m, maestra).map((c) => c.id)).toEqual(["P00001"]);
  });

  it("si el candidato NO trae región pero la mención sí, lo incluye (fail-open: candidato sin región no se descarta)", () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "soto vega ana", region: null }),
    ];
    const m = mencion({ tokens: ["soto"], region: "Valparaíso" });
    expect(generarCandidatos(m, maestra).map((c) => c.id)).toEqual(["P00001"]);
  });
});

describe("generarCandidatos — caso canónico Walker P., Matías", () => {
  it('"Walker P., Matías" (apellido "walker", senado) recupera al candidato cuyo normalizado es "walker prieto matias"', () => {
    const maestra = [
      maestro({ id: "P00042", nombre_normalizado: "walker prieto matias", camara: "senado", periodo: "senado-vigente-2026" }),
      maestro({ id: "P00099", nombre_normalizado: "nunez perez carla", camara: "senado", periodo: "senado-vigente-2026" }),
    ];
    const m = mencion({
      nombreOriginal: "Walker P., Matías",
      tokens: ["walker", "matias"],
      camara: "senado",
      periodo: "senado-vigente-2026",
    });
    expect(generarCandidatos(m, maestra).map((c) => c.id)).toEqual(["P00042"]);
  });
});
