import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { matchDeterminista } from "./deterministic";

/** Helper para fabricar un Parlamentario de prueba con defaults razonables. */
function p(overrides: Partial<Parlamentario>): Parlamentario {
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
