import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { matchDeterminista, isRutValido, type MaestraRow } from "./deterministic";

/** Helper para fabricar un Parlamentario de prueba con defaults razonables. */
function p(overrides: Partial<MaestraRow>): MaestraRow {
  return {
    id: "P00000",
    nombre_normalizado: "",
    nombres: "",
    apellido_paterno: "",
    apellido_materno: "",
    camara: "diputados",
    periodo: "2026-2030",
    region: null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: "no_confirmado",
    email: null,
    origen: "test",
    fecha_captura: "2026-06-18T00:00:00.000Z",
    enlace: "https://example.test",
    ...overrides,
  };
}

const maestra: Parlamentario[] = [
  p({ id: "P00001", nombre_normalizado: "ana gomez", camara: "diputados", periodo: "2026-2030", rut: "12.345.678-9" }),
  // Homónimos en la MISMA (camara, periodo): mismo nombre_normalizado, ids distintos
  p({ id: "P00002", nombre_normalizado: "juan perez", camara: "diputados", periodo: "2026-2030" }),
  p({ id: "P00003", nombre_normalizado: "juan perez", camara: "diputados", periodo: "2026-2030" }),
  // Mismo nombre que un diputado, pero en el Senado (cross-cámara)
  p({ id: "P00004", nombre_normalizado: "ana gomez", camara: "senado", periodo: "senado-vigente-2026" }),
];

describe("matchDeterminista — rama RUT", () => {
  it("RUT exacto único → confirmado por rut", () => {
    const r = matchDeterminista(
      { rut: "12345678-9", nombreNormalizado: "ana gomez", camara: "diputados", periodo: "2026-2030" },
      maestra,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "rut", id: "P00001" });
  });

  it("normaliza RUT (puntos/guión/DV) antes de comparar", () => {
    const r = matchDeterminista(
      { rut: "12.345.678-9", nombreNormalizado: "ana gomez", camara: "diputados", periodo: "2026-2030" },
      maestra,
    );
    expect(r.estado).toBe("confirmado");
  });

  it("RUT con 2+ coincidencias (teórico) NO confirma por RUT, cae a rama nombre / fail-closed", () => {
    const conflictiva: Parlamentario[] = [
      p({ id: "PA", nombre_normalizado: "x", rut: "11111111-1" }),
      p({ id: "PB", nombre_normalizado: "y", rut: "11.111.111-1" }),
    ];
    const r = matchDeterminista(
      { rut: "11111111-1", nombreNormalizado: "z", camara: "diputados", periodo: "2026-2030" },
      conflictiva,
    );
    expect(r.estado).toBe("no_confirmado");
  });
});

describe("matchDeterminista — rama nombre único en (cámara, periodo)", () => {
  it("nombre_normalizado único en (cámara, periodo) → confirmado por nombre", () => {
    const r = matchDeterminista(
      { nombreNormalizado: "ana gomez", camara: "diputados", periodo: "2026-2030" },
      maestra,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "nombre", id: "P00001" });
  });

  it("match por nombre solo dentro de la MISMA cámara y periodo (cross-cámara no auto-confirma a otra cámara)", () => {
    // 'ana gomez' existe en diputados Y senado; pedir en senado debe resolver al senador
    const r = matchDeterminista(
      { nombreNormalizado: "ana gomez", camara: "senado", periodo: "senado-vigente-2026" },
      maestra,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "nombre", id: "P00004" });
  });
});

describe("matchDeterminista — fail-closed", () => {
  it("homónimo (2+ coincidencias en cámara+periodo) → no_confirmado razon homonimo", () => {
    const r = matchDeterminista(
      { nombreNormalizado: "juan perez", camara: "diputados", periodo: "2026-2030" },
      maestra,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "homonimo" });
  });

  it("sin candidato → no_confirmado razon sin-candidato", () => {
    const r = matchDeterminista(
      { nombreNormalizado: "nadie existe", camara: "diputados", periodo: "2026-2030" },
      maestra,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "sin-candidato" });
  });

  it("nombre de otra cámara no se auto-confirma cross-cámara", () => {
    // 'juan perez' (homónimo en diputados) pedido en senado → sin candidato en senado
    const r = matchDeterminista(
      { nombreNormalizado: "juan perez", camara: "senado", periodo: "senado-vigente-2026" },
      maestra,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "sin-candidato" });
  });

  it("NINGÚN path confirma con length ≠ 1", () => {
    // Doble verificación del invariante existencial #1
    const homonimo = matchDeterminista(
      { nombreNormalizado: "juan perez", camara: "diputados", periodo: "2026-2030" },
      maestra,
    );
    expect(homonimo.estado).not.toBe("confirmado");
  });
});

describe("matchDeterminista — WR-01 desempate por clave estricta (materno)", () => {
  // Dos homónimos por nombre materno-less ("juan perez") pero distinto materno.
  const conMaterno: MaestraRow[] = [
    p({ id: "P1", nombre_normalizado: "juan perez", clave_estricta: "gonzalez juan perez", camara: "diputados", periodo: "2026-2030" }),
    p({ id: "P2", nombre_normalizado: "juan perez", clave_estricta: "juan perez soto", camara: "diputados", periodo: "2026-2030" }),
  ];

  it("homónimo por nombre, pero clave estricta única → confirma por nombre-estricto", () => {
    const r = matchDeterminista(
      {
        nombreNormalizado: "juan perez",
        claveEstricta: "gonzalez juan perez",
        camara: "diputados",
        periodo: "2026-2030",
      },
      conMaterno,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "nombre-estricto", id: "P1" });
  });

  it("sin claveEstricta en la mención → se mantiene fail-closed (homonimo)", () => {
    const r = matchDeterminista(
      { nombreNormalizado: "juan perez", camara: "diputados", periodo: "2026-2030" },
      conMaterno,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "homonimo" });
  });

  it("verdaderos homónimos (misma clave estricta) → fail-closed, NUNCA confirma", () => {
    const dobles: MaestraRow[] = [
      p({ id: "Q1", nombre_normalizado: "juan perez", clave_estricta: "juan perez soto", camara: "diputados", periodo: "2026-2030" }),
      p({ id: "Q2", nombre_normalizado: "juan perez", clave_estricta: "juan perez soto", camara: "diputados", periodo: "2026-2030" }),
    ];
    const r = matchDeterminista(
      { nombreNormalizado: "juan perez", claveEstricta: "juan perez soto", camara: "diputados", periodo: "2026-2030" },
      dobles,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "homonimo" });
  });

  it("un candidato sin clave_estricta → NO se desempata (fail-closed)", () => {
    const parcial: MaestraRow[] = [
      p({ id: "R1", nombre_normalizado: "juan perez", clave_estricta: "gonzalez juan perez", camara: "diputados", periodo: "2026-2030" }),
      p({ id: "R2", nombre_normalizado: "juan perez", camara: "diputados", periodo: "2026-2030" }), // sin clave_estricta
    ];
    const r = matchDeterminista(
      { nombreNormalizado: "juan perez", claveEstricta: "gonzalez juan perez", camara: "diputados", periodo: "2026-2030" },
      parcial,
    );
    expect(r.estado).toBe("no_confirmado");
  });
});

describe("isRutValido (IN-04, utilidad para Fase 4)", () => {
  it("acepta RUTs estructuralmente válidos (DV módulo-11)", () => {
    expect(isRutValido("11.111.111-1")).toBe(true);
    expect(isRutValido("11111111-1")).toBe(true);
  });

  it("rechaza RUTs con DV incorrecto", () => {
    expect(isRutValido("12.345.678-9")).toBe(false); // DV real es 5
    expect(isRutValido("12345678-5")).toBe(true);
  });

  it("rechaza basura que normaliza a vacío o forma inválida", () => {
    expect(isRutValido("---")).toBe(false);
    expect(isRutValido("")).toBe(false);
    expect(isRutValido("abc")).toBe(false);
  });

  it("acepta DV 'k' (mayúscula o minúscula)", () => {
    // 10.000.013-K es un RUT con DV k válido (módulo-11).
    expect(isRutValido("10.000.013-K")).toBe(true);
    expect(isRutValido("10000013-k")).toBe(true);
  });

  // ── IDENT-11: cobertura de persona JURÍDICA (RUT de empresa) y DV inválido ──
  // El validador módulo-11 NO distingue persona natural de jurídica (es solo estructura):
  // un RUT de empresa (cuerpo en rango 70-99 millones) DV-valida igual. La distinción
  // natural/jurídica es semántica del CRUCE (no colapsar un RUT de empresa en una atribución
  // personal) y se cubre en el golden set; aquí se fija que el DV de un RUT de empresa válido
  // se acepta y uno con DV alterado se rechaza (los RUTs son ESTRUCTURALES, no de nadie real).
  it("acepta el DV de un RUT de PERSONA JURÍDICA estructuralmente válido (empresa)", () => {
    expect(isRutValido("76.012.345-5")).toBe(true); // cuerpo 76M → típico empresa, DV válido
    expect(isRutValido("99.500.000-8")).toBe(true);
  });

  it("rechaza un RUT de persona jurídica con DV alterado (nunca se trataría como válido)", () => {
    expect(isRutValido("76.012.345-0")).toBe(false); // DV real es 5
    expect(isRutValido("99.500.000-1")).toBe(false); // DV real es 8
  });

  it("rechaza DV alterado de persona natural (IDENT-11: nunca aceptar un DV inválido)", () => {
    expect(isRutValido("15.784.213-0")).toBe(false); // DV real es 7
    expect(isRutValido("15.784.213-7")).toBe(true);
  });
});
