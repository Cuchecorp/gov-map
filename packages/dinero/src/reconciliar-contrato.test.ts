// reconciliar-contrato.test — cruce RUT-EXACTO del proveedor. SIN red, SIN DB, SIN LLM.
//
// Invariantes LOCKED (MONEY-02):
//  - RUT invalido (DV malo) -> cuarentena, enlace null, NUNCA fila confirmada.
//  - sin RUT interno en la maestra (IDENT-10) -> enlace null, estadoVinculo "no_confirmado".
//  - RUT-exacto unico -> confirmar(id,"determinista") -> EnlaceConfirmado, estadoVinculo "confirmado".
//  - RUT con 2+ matches -> fail-closed, enlace null.
//  - el enlace SOLO sale de la rama RUT; NUNCA por nombre.

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { reconciliarContrato } from "./reconciliar-contrato";
import type { Contrato } from "./model";

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
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: p.rut ?? null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: p.estado ?? "confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
  } as Parlamentario;
}

function contrato(over: Partial<Contrato> & { rutProveedor: string }): Contrato {
  return {
    fuenteId: over.fuenteId ?? "OC-1",
    fechaCorte: over.fechaCorte ?? "2026-06-19",
    codigoOrden: over.codigoOrden ?? over.fuenteId ?? "OC-1",
    rutProveedor: over.rutProveedor,
    proveedorNombre: over.proveedorNombre ?? "Proveedor X",
    tipoPersona: over.tipoPersona ?? "natural",
    organismo: over.organismo ?? "ORG",
    monto: over.monto ?? "100",
    fechaOc: over.fechaOc ?? "2024-02-02",
    origen: "chilecompra",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://api.mercadopublico.cl",
    licencia: "mencion de la fuente",
  };
}

describe("reconciliarContrato — RUT invalido -> cuarentena", () => {
  it("DV malo -> estadoVinculo cuarentena, enlace null, sin fila confirmada", () => {
    const r = reconciliarContrato([contrato({ rutProveedor: "12.345.678-9" })], [], {});
    expect(r.contratos[0]!.estadoVinculo).toBe("cuarentena");
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.parlamentariosConfirmados).toEqual([]);
    expect(r.cuarentenados).toEqual(["OC-1"]);
  });
});

describe("reconciliarContrato — sin RUT interno en la maestra (IDENT-10)", () => {
  it("maestra sin rut poblado -> enlace null, no_confirmado, mencion cruda preservada", () => {
    const maestra = [maestro({ id: "P1", rut: null })];
    const r = reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.contratos[0]!.estadoVinculo).toBe("no_confirmado");
    expect(r.contratos[0]!.mencionProveedor).toBe("Proveedor X");
    expect(r.parlamentariosConfirmados).toEqual([]);
  });
});

describe("reconciliarContrato — RUT-exacto unico -> confirmado", () => {
  it("un parlamentario con ese RUT -> confirmar() -> EnlaceConfirmado, confirmado", () => {
    const maestra = [maestro({ id: "P500", rut: "76.123.456-0" })];
    const r = reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    expect(r.contratos[0]!.enlace).not.toBeNull();
    expect(r.contratos[0]!.enlace!.parlamentarioId).toBe("P500");
    expect(r.contratos[0]!.enlace!.metodo).toBe("determinista");
    expect(r.parlamentariosConfirmados).toEqual(["P500"]);
  });

  it("normaliza ambos lados (puntos/guion) antes de comparar", () => {
    const maestra = [maestro({ id: "P500", rut: "761234560" })];
    const r = reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    expect(r.contratos[0]!.enlace!.parlamentarioId).toBe("P500");
  });
});

describe("reconciliarContrato — RUT con 2+ matches -> fail-closed", () => {
  it("dos parlamentarios con el mismo RUT -> enlace null, no_confirmado", () => {
    const maestra = [
      maestro({ id: "P1", rut: "76.123.456-0" }),
      maestro({ id: "P2", rut: "76.123.456-0" }),
    ];
    const r = reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.contratos[0]!.estadoVinculo).toBe("no_confirmado");
    expect(r.parlamentariosConfirmados).toEqual([]);
  });
});

describe("reconciliarContrato — NUNCA enlaza por nombre", () => {
  it("RUT valido sin match pero nombre coincidente -> NO confirma (enlace solo por RUT)", () => {
    // El proveedor no esta por RUT; un parlamentario comparte nombre_normalizado. Como el matcher
    // recibe nombreNormalizado="" no puede caer a la rama nombre -> sigue null.
    const maestra = [maestro({ id: "P9", rut: "12.345.678-5", nombre_normalizado: "proveedor x" })];
    const r = reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.contratos[0]!.estadoVinculo).toBe("no_confirmado");
  });
});
