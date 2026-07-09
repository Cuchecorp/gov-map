/**
 * Tests de reconciliarAutores — cruce determinista de autores de proyecto por nombre.
 * SIN red, SIN DB: maestra sintética + guarda de identidad LOCKED.
 *
 * Invariantes LOCKED:
 *  - nombre único en maestra (confirmado) → enlace_confirmado poblado, estado 'confirmado'.
 *  - nombre desconocido → enlace_confirmado null, estado 'no_confirmado'.
 *  - lista vacía (Mensaje) → retorna [].
 */
import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { reconciliarAutores } from "./reconciliar-autor";
import { aplanarAutor } from "./model";

function maestro(p: Partial<Parlamentario> & { id: string }): Parlamentario {
  return {
    id: p.id,
    nombre_normalizado: p.nombre_normalizado ?? "",
    nombres: p.nombres ?? "",
    apellido_paterno: p.apellido_paterno ?? "",
    apellido_materno: p.apellido_materno ?? "",
    camara: p.camara ?? "diputados",
    periodo: p.periodo ?? "2026-2030",
    region: p.region ?? null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: p.estado ?? "confirmado",
    email: null,
    origen: "camara",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

const PROVENANCE = {
  origen: "senado-wspublico",
  fecha_captura: "2026-07-08T00:00:00Z",
  enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
};

describe("reconciliarAutores — guarda de identidad LOCKED (AUTOR-01)", () => {
  it("nombre único en maestra → enlace_confirmado poblado, estado_vinculo 'confirmado'", () => {
    // El nombre viene del XML como "Karim Bianchi Retamales" (sin coma).
    // normalizarNombre({ libre: "Karim Bianchi Retamales" }) produce "bianchi karim retamales"
    // (sin coma = sin materno separado → todos los tokens van a blocking).
    // La maestra debe tener ese mismo nombre_normalizado para que matchDeterminista confirme.
    const maestra = [
      maestro({
        id: "P00100",
        nombre_normalizado: "bianchi karim retamales",
        nombres: "Karim",
        apellido_paterno: "Bianchi",
        apellido_materno: "Retamales",
        camara: "diputados",
        periodo: "2026-2030",
      }),
    ];
    const result = reconciliarAutores(
      ["Karim Bianchi Retamales"],
      maestra,
      "16588-07",
      PROVENANCE,
    );
    expect(result).toHaveLength(1);
    const r = result[0]!;
    expect(r.estado_vinculo).toBe("confirmado");
    expect(r.metodo).toBe("determinista");
    expect(r.enlace_confirmado).not.toBeNull();
    expect(r.enlace_confirmado?.parlamentarioId).toBe("P00100");
    expect(r.enlace_confirmado?.metodo).toBe("determinista");
    // El FK plano (para la DB) se materializa en aplanarAutor
    const plano = aplanarAutor(r);
    expect(plano.parlamentario_id).toBe("P00100");
    expect(plano.estado_vinculo).toBe("confirmado");
  });

  it("nombre desconocido → enlace_confirmado null, estado_vinculo 'no_confirmado'", () => {
    const result = reconciliarAutores(
      ["Nombre Completamente Desconocido"],
      [],  // maestra vacía
      "16588-07",
      PROVENANCE,
    );
    expect(result).toHaveLength(1);
    const r = result[0]!;
    expect(r.estado_vinculo).toBe("no_confirmado");
    expect(r.metodo).toBeNull();
    expect(r.enlace_confirmado).toBeNull();
    // FK plano debe ser null
    const plano = aplanarAutor(r);
    expect(plano.parlamentario_id).toBeNull();
  });

  it("lista vacía (Mensaje) → retorna []", () => {
    const result = reconciliarAutores([], [], "14309-04", PROVENANCE);
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it("senado camara también resuelve nombres de senadores", () => {
    // "Cristina Girardi Lavín" sin coma → normalizarNombre produce "cristina girardi lavin"
    // (fold de ñ/acentos + todos los tokens a blocking sin separación de materno)
    const maestra = [
      maestro({
        id: "P00200",
        nombre_normalizado: "cristina girardi lavin",
        nombres: "Cristina",
        apellido_paterno: "Girardi",
        apellido_materno: "Lavín",
        camara: "senado",
        periodo: "senado-vigente-2026",
      }),
    ];
    const result = reconciliarAutores(
      ["Cristina Girardi Lavín"],
      maestra,
      "16588-07",
      PROVENANCE,
    );
    expect(result[0]!.estado_vinculo).toBe("confirmado");
    expect(result[0]!.enlace_confirmado?.parlamentarioId).toBe("P00200");
  });

  it("autor_crudo conservado literalmente", () => {
    const result = reconciliarAutores(
      ["Pamela Jiles Moreno"],
      [],
      "16588-07",
      PROVENANCE,
    );
    expect(result[0]!.autor_crudo).toBe("Pamela Jiles Moreno");
  });

  it("autor_crudo_norm es lowercase+trim+colapso de espacios", () => {
    const result = reconciliarAutores(
      ["  Juan  ANTONIO  Pérez  "],
      [],
      "16588-07",
      PROVENANCE,
    );
    // \s+ collapsa a espacio único; trim elimina bordes; lowercase
    expect(result[0]!.autor_crudo_norm).toBe("juan antonio pérez");
    expect(result[0]!.autor_crudo_norm).not.toContain("ANTONIO");
  });

  it("provenance inline correcta en el output", () => {
    const result = reconciliarAutores(["Nombre"], [], "16588-07", PROVENANCE);
    expect(result[0]!.origen).toBe("senado-wspublico");
    expect(result[0]!.boletin).toBe("16588-07");
    expect(result[0]!.enlace_provenance).toContain("senado.cl");
  });
});
