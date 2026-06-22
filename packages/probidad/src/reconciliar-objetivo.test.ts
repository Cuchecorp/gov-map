// reconciliar-objetivo.test — cruce DIRIGIDO por test de superconjunto de tokens. SIN red, SIN DB:
// fixture de Declaracion[] construido en-código (hermanos que comparten paterno+materno + un
// declarante con segundo nombre).
//
// Invariantes verificadas (Phase 26):
//  - hermanos (mismo paterno+materno) se separan por el PRIMER nombre: el objetivo Jorge confirma
//    sólo "JORGE ALESSANDRI VERGARA", NUNCA "FELIPE ALESSANDRI VERGARA".
//  - el declarante con SEGUNDO nombre ("BORIS ANTHONY BARRERA MORENO") es superconjunto del objetivo
//    Boris → se confirma (el segundo nombre se tolera).
//  - cada fila confirmada lleva el FK del objetivo + estado "confirmado".
//  - un objetivo sin tokens de nombre → [] (fail-closed, no fabrica).

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import type { Declaracion, Bienes } from "./model";
import { reconciliarDeclaracionesObjetivo } from "./reconciliar-objetivo";

/** Contenedor de bienes vacío (cada sub-clase es una lista; vacía = la fuente no declara ese tipo). */
const BIENES_VACIO: Bienes = {
  inmuebles: [],
  muebles: [],
  actividades: [],
  pasivos: [],
  accionesDerechos: [],
  valores: [],
};

/** Construye una Declaracion mínima a partir del nombre crudo del declarante + un id de versión. */
function decl(fuenteId: string, declaranteNombre: string): Declaracion {
  return {
    fuenteId,
    fechaPresentacion: "2026-03-30",
    tipo: "Patrimonio",
    cargo: "Diputado",
    organismo: "Cámara de Diputados",
    declaranteNombre,
    bienes: BIENES_VACIO,
    familiares: [],
    origen: "infoprobidad-sparql",
    fecha_captura: "2026-06-22T00:00:00Z",
    enlace: `https://datos.cplt.cl/${fuenteId}`,
    licencia: "CC BY 4.0",
  };
}

/** Construye un Parlamentario con defaults razonables (espeja el maestro() de otros tests). */
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
    distrito: p.distrito ?? null,
    circunscripcion: p.circunscripcion ?? null,
    partido: p.partido ?? null,
    rut: p.rut ?? null,
    parlid_senado: p.parlid_senado ?? null,
    id_diputado_camara: p.id_diputado_camara ?? null,
    estado: p.estado ?? "confirmado",
    email: p.email ?? null,
    origen: p.origen ?? "camara",
    fecha_captura: p.fecha_captura ?? "2026-01-01T00:00:00Z",
    enlace: p.enlace ?? "https://example.cl",
  };
}

// Fixture: dos hermanos (mismo paterno+materno) + un declarante con segundo nombre.
const DECLARACIONES: Declaracion[] = [
  decl("D1009", "JORGE ALESSANDRI VERGARA"),
  decl("D1010", "FELIPE ALESSANDRI VERGARA"),
  decl("D1012", "BORIS ANTHONY BARRERA MORENO"),
];

describe("reconciliarDeclaracionesObjetivo — cruce dirigido por superconjunto de tokens", () => {
  it("separa hermanos por el primer nombre: Jorge confirma sólo su declaración (excluye Felipe)", () => {
    const jorge = maestro({
      id: "PDIP-JORGE",
      nombres: "Jorge",
      apellido_paterno: "Alessandri",
      apellido_materno: "Vergara",
    });

    const filas = reconciliarDeclaracionesObjetivo(DECLARACIONES, jorge);

    expect(filas).toHaveLength(1);
    expect(filas[0]!.fuenteId).toBe("D1009");
    expect(filas[0]!.mencionDeclarante).toBe("JORGE ALESSANDRI VERGARA");
    expect(filas[0]!.estadoVinculo).toBe("confirmado");
    expect(filas[0]!.enlace?.parlamentarioId).toBe("PDIP-JORGE");
    expect(filas[0]!.enlace?.metodo).toBe("determinista");
    // Felipe (D1010) NUNCA se confirma a Jorge.
    expect(filas.some((f) => f.fuenteId === "D1010")).toBe(false);
  });

  it("tolera un segundo nombre del declarante: Boris confirma 'BORIS ANTHONY BARRERA MORENO'", () => {
    const boris = maestro({
      id: "PDIP-BORIS",
      nombres: "Boris",
      apellido_paterno: "Barrera",
      apellido_materno: "Moreno",
    });

    const filas = reconciliarDeclaracionesObjetivo(DECLARACIONES, boris);

    expect(filas).toHaveLength(1);
    expect(filas[0]!.fuenteId).toBe("D1012");
    expect(filas[0]!.mencionDeclarante).toBe("BORIS ANTHONY BARRERA MORENO");
    expect(filas[0]!.estadoVinculo).toBe("confirmado");
    expect(filas[0]!.enlace?.parlamentarioId).toBe("PDIP-BORIS");
  });

  it("Felipe confirma sólo su propia declaración (la query dirigida lo separa de Jorge)", () => {
    const felipe = maestro({
      id: "PDIP-FELIPE",
      nombres: "Felipe",
      apellido_paterno: "Alessandri",
      apellido_materno: "Vergara",
    });

    const filas = reconciliarDeclaracionesObjetivo(DECLARACIONES, felipe);

    expect(filas).toHaveLength(1);
    expect(filas[0]!.fuenteId).toBe("D1010");
    expect(filas[0]!.enlace?.parlamentarioId).toBe("PDIP-FELIPE");
  });

  it("un objetivo sin tokens de nombre → [] (fail-closed, nunca fabrica)", () => {
    const vacio = maestro({ id: "PDIP-VACIO" });
    expect(reconciliarDeclaracionesObjetivo(DECLARACIONES, vacio)).toEqual([]);
  });
});
