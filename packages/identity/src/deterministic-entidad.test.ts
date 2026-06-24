import { describe, it, expect } from "vitest";
import {
  matchDeterministaEntidad,
  type EntidadTerceroRow,
} from "./deterministic-entidad";

/** Helper para fabricar una fila de entidad_tercero de prueba con defaults razonables. */
function e(overrides: Partial<EntidadTerceroRow>): EntidadTerceroRow {
  return {
    id: "E00000",
    nombre_normalizado: "",
    tipo_entidad: "natural",
    rut: null,
    ...overrides,
  };
}

const maestra: EntidadTerceroRow[] = [
  // Natural con RUT único.
  e({ id: "E00001", nombre_normalizado: "ana gomez", tipo_entidad: "natural", rut: "12.345.678-9" }),
  // Homónimos naturales (mismo nombre_normalizado, mismo tipo).
  e({ id: "E00002", nombre_normalizado: "juan perez", tipo_entidad: "natural" }),
  e({ id: "E00003", nombre_normalizado: "juan perez", tipo_entidad: "natural" }),
  // Jurídica con RUT único.
  e({ id: "E00010", nombre_normalizado: "fundacion luz", tipo_entidad: "juridica", rut: "76.111.222-3" }),
  // Jurídica con nombre único pero SIN rut.
  e({ id: "E00011", nombre_normalizado: "constructora andes", tipo_entidad: "juridica", rut: null }),
  // Mismo nombre que un natural pero como jurídica (unicidad-por-tipo).
  e({ id: "E00020", nombre_normalizado: "carlos soto", tipo_entidad: "juridica", rut: "77.999.888-7" }),
  e({ id: "E00021", nombre_normalizado: "carlos soto", tipo_entidad: "natural" }),
];

describe("matchDeterministaEntidad — rama RUT (natural)", () => {
  it("Test 1: RUT exacto único → confirmado por rut", () => {
    const r = matchDeterministaEntidad(
      { rut: "12345678-9", nombreNormalizado: "ana gomez", tipoEntidad: "natural" },
      maestra,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "rut", id: "E00001" });
  });

  it("normaliza el RUT (puntos/guión/DV) antes de comparar", () => {
    const r = matchDeterministaEntidad(
      { rut: "12.345.678-9", nombreNormalizado: "ana gomez", tipoEntidad: "natural" },
      maestra,
    );
    expect(r.estado).toBe("confirmado");
  });

  it("Test 2: RUT presente en 2+ filas → no_confirmado (no inventa)", () => {
    const conflictiva: EntidadTerceroRow[] = [
      e({ id: "EA", nombre_normalizado: "x", tipo_entidad: "natural", rut: "11111111-1" }),
      e({ id: "EB", nombre_normalizado: "y", tipo_entidad: "natural", rut: "11.111.111-1" }),
    ];
    const r = matchDeterministaEntidad(
      { rut: "11111111-1", nombreNormalizado: "z", tipoEntidad: "natural" },
      conflictiva,
    );
    expect(r.estado).toBe("no_confirmado");
  });

  it("Test 3: RUT en 0 filas (natural) → cae a la rama nombre", () => {
    const r = matchDeterministaEntidad(
      { rut: "99999999-9", nombreNormalizado: "ana gomez", tipoEntidad: "natural" },
      maestra,
    );
    // 'ana gomez' es único por tipo natural → confirma por nombre.
    expect(r).toEqual({ estado: "confirmado", metodo: "nombre", id: "E00001" });
  });
});

describe("matchDeterministaEntidad — rama nombre-único-por-tipo (natural)", () => {
  it("Test 4: natural, nombre único por tipo → confirmado por nombre", () => {
    const r = matchDeterministaEntidad(
      { nombreNormalizado: "ana gomez", tipoEntidad: "natural" },
      maestra,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "nombre", id: "E00001" });
  });

  it("Test 10: la unicidad del nombre se calcula POR tipo_entidad (natural NO colisiona con jurídica homónima)", () => {
    // 'carlos soto' existe como jurídica (E00020) Y como natural (E00021). Pedir natural debe
    // resolver al natural sin que la jurídica cuente como homónimo.
    const r = matchDeterministaEntidad(
      { nombreNormalizado: "carlos soto", tipoEntidad: "natural" },
      maestra,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "nombre", id: "E00021" });
  });
});

describe("matchDeterministaEntidad — fail-closed (natural)", () => {
  it("Test 5: natural, nombre presente en 2+ del mismo tipo (homónimo) → no_confirmado razon homonimo", () => {
    const r = matchDeterministaEntidad(
      { nombreNormalizado: "juan perez", tipoEntidad: "natural" },
      maestra,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "homonimo" });
  });

  it("Test 6: natural sin candidato → no_confirmado razon sin-candidato", () => {
    const r = matchDeterministaEntidad(
      { nombreNormalizado: "nadie existe", tipoEntidad: "natural" },
      maestra,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "sin-candidato" });
  });
});

describe("matchDeterministaEntidad — Δ2 rama jurídica (SOLO RUT, nunca LLM)", () => {
  it("Test 7: jurídica con RUT único → confirmado por rut", () => {
    const r = matchDeterministaEntidad(
      { rut: "76.111.222-3", nombreNormalizado: "fundacion luz", tipoEntidad: "juridica" },
      maestra,
    );
    expect(r).toEqual({ estado: "confirmado", metodo: "rut", id: "E00010" });
  });

  it("Test 8 (CRÍTICO): jurídica SIN rut, nombre único → no_confirmado razon juridica-sin-rut (NUNCA confirma por nombre)", () => {
    const r = matchDeterministaEntidad(
      { nombreNormalizado: "constructora andes", tipoEntidad: "juridica" },
      maestra,
    );
    // Aunque 'constructora andes' es único por tipo jurídica, una jurídica SIN RUT
    // NUNCA confirma por nombre (Δ2 LOCKED) y nunca habilita el LLM aguas arriba.
    expect(r).toEqual({ estado: "no_confirmado", razon: "juridica-sin-rut" });
  });

  it("Test 8b: jurídica con rut vacío/espacios → tratada como sin-rut → juridica-sin-rut", () => {
    const r = matchDeterministaEntidad(
      { rut: "   ", nombreNormalizado: "constructora andes", tipoEntidad: "juridica" },
      maestra,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "juridica-sin-rut" });
  });

  it("Test 9: jurídica con RUT presente en 2+ → no_confirmado juridica-sin-rut (no cae a nombre)", () => {
    const conflictiva: EntidadTerceroRow[] = [
      e({ id: "EJ1", nombre_normalizado: "constructora andes", tipo_entidad: "juridica", rut: "76.000.111-2" }),
      e({ id: "EJ2", nombre_normalizado: "otra", tipo_entidad: "juridica", rut: "76.000.111-2" }),
    ];
    const r = matchDeterministaEntidad(
      { rut: "76.000.111-2", nombreNormalizado: "constructora andes", tipoEntidad: "juridica" },
      conflictiva,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "juridica-sin-rut" });
  });

  it("una jurídica con nombre homónimo y RUT que no matchea NO degrada a 'homonimo' — siempre juridica-sin-rut", () => {
    const r = matchDeterministaEntidad(
      { rut: "76.555.444-3", nombreNormalizado: "constructora andes", tipoEntidad: "juridica" },
      maestra,
    );
    expect(r).toEqual({ estado: "no_confirmado", razon: "juridica-sin-rut" });
  });
});
