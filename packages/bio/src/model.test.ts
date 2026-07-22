// Test-que-muerde del allowlist por construcción (research Pattern 2, T-90-PII):
//   1. cada schema PARSEA un objeto válido (sanidad del contrato),
//   2. cada schema RECHAZA un objeto con un campo PII extra (`rut`/`fechaNacimiento`/`sexo`)
//      gracias a `.strict()`. Si alguien relaja el `.strict()` o declara PII, este test rompe.

import { describe, expect, it } from "vitest";
import {
  BioParlamentarioSchema,
  MilitanciaSchema,
  ComisionSchema,
  ComisionMembresiaSchema,
} from "./model";

const prov = {
  origen: "camara-bio-diputados",
  fechaCaptura: "2026-07-22T00:00:00.000Z",
  enlace: "https://opendata.camara.cl/...",
};

describe("BioParlamentarioSchema", () => {
  it("parsea un objeto válido", () => {
    const ok = BioParlamentarioSchema.parse({
      parlamentarioId: "P00001",
      profesion: "Abogado",
      ...prov,
    });
    expect(ok.parlamentarioId).toBe("P00001");
    expect(ok.profesion).toBe("Abogado");
  });

  it("acepta profesion null (no fabricar)", () => {
    const ok = BioParlamentarioSchema.parse({
      parlamentarioId: "P00001",
      profesion: null,
      ...prov,
    });
    expect(ok.profesion).toBeNull();
  });

  it("RECHAZA un campo PII extra (rut) — allowlist por construcción", () => {
    expect(() =>
      BioParlamentarioSchema.parse({
        parlamentarioId: "P00001",
        profesion: "Abogado",
        rut: "12345678-9",
        ...prov,
      }),
    ).toThrow();
  });

  it("RECHAZA fechaNacimiento y sexo (PII)", () => {
    expect(() =>
      BioParlamentarioSchema.parse({
        parlamentarioId: "P00001",
        profesion: null,
        fechaNacimiento: "1975-01-01",
        sexo: "M",
        ...prov,
      }),
    ).toThrow();
  });
});

describe("MilitanciaSchema", () => {
  it("parsea un objeto válido con hasta null (vigente)", () => {
    const ok = MilitanciaSchema.parse({
      parlamentarioId: "P00001",
      partido: "Partido X",
      partidoAlias: "px",
      desde: "2022-03-11",
      hasta: null,
      esActual: true,
      ...prov,
    });
    expect(ok.esActual).toBe(true);
    expect(ok.hasta).toBeNull();
  });

  it("RECHAZA un campo PII extra (rut)", () => {
    expect(() =>
      MilitanciaSchema.parse({
        parlamentarioId: "P00001",
        partido: "Partido X",
        partidoAlias: "px",
        desde: "2022-03-11",
        hasta: null,
        esActual: true,
        rut: "12345678-9",
        ...prov,
      }),
    ).toThrow();
  });
});

describe("ComisionSchema", () => {
  it("parsea un objeto válido", () => {
    const ok = ComisionSchema.parse({
      nombre: "Constitución, Legislación y Justicia",
      camara: "diputados",
      tipo: "permanente",
      ...prov,
    });
    expect(ok.camara).toBe("diputados");
  });

  it("RECHAZA camara fuera del enum", () => {
    expect(() =>
      ComisionSchema.parse({
        nombre: "X",
        camara: "ambos",
        tipo: "",
        ...prov,
      }),
    ).toThrow();
  });

  it("RECHAZA un campo extra", () => {
    expect(() =>
      ComisionSchema.parse({
        nombre: "X",
        camara: "senadores",
        tipo: "",
        extra: "no",
        ...prov,
      }),
    ).toThrow();
  });
});

describe("ComisionMembresiaSchema", () => {
  it("parsea un objeto válido con cargo null", () => {
    const ok = ComisionMembresiaSchema.parse({
      comisionId: "C0001",
      parlamentarioId: "P00001",
      cargo: null,
      ...prov,
    });
    expect(ok.cargo).toBeNull();
  });

  it("RECHAZA un campo PII extra (sexo)", () => {
    expect(() =>
      ComisionMembresiaSchema.parse({
        comisionId: "C0001",
        parlamentarioId: "P00001",
        cargo: "integrante",
        sexo: "F",
        ...prov,
      }),
    ).toThrow();
  });
});
