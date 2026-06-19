// parse-chilecompra.test — parser PURO del JSON de ChileCompra. SIN red, SIN DB.
//
// Invariantes:
//  - JSON valido -> Contrato[] VERBATIM (monto/organismo crudos como string).
//  - forma inesperada (sin Listado/Cantidad) -> THROW (cuarentena aguas arriba), NUNCA 0 filas.
//  - tipoPersona: cuerpo de RUT < 50M -> natural; >= 50M -> juridica (ambos lados del umbral).

import { describe, it, expect } from "vitest";
import { parseContratos, tipoPersona } from "./parse-chilecompra";

const OPTS = {
  rutProveedor: "76.123.456-0",
  proveedorNombre: "Proveedora Ejemplo SpA",
  fechaCorte: "2026-06-19",
  enlace: "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json",
  fechaCaptura: "2026-06-19T00:00:00Z",
};

const respuestaOk = {
  Cantidad: 2,
  Listado: [
    { Codigo: "1509-58-SE24", Nombre: "Compra de insumos", FechaEnvio: "2024-02-02", Comprador: { NombreOrganismo: "MUNICIPALIDAD X" } },
    { Codigo: "1509-59-SE24", Nombre: "Servicio de aseo", FechaEnvio: "2024-02-03", Comprador: { NombreOrganismo: "SERVICIO Y" } },
  ],
};

describe("parseContratos — JSON valido -> Contrato[] VERBATIM", () => {
  it("mapea cada orden a un Contrato con campos crudos", () => {
    const out = parseContratos(respuestaOk, OPTS);
    expect(out).toHaveLength(2);
    const a = out[0]!;
    expect(a.codigoOrden).toBe("1509-58-SE24");
    expect(a.fuenteId).toBe("1509-58-SE24");
    expect(a.organismo).toBe("MUNICIPALIDAD X");
    // CR-02: `orden.Nombre` es el NOMBRE/DESCRIPCION de la orden -> `nombreOrden`, NUNCA `monto`.
    expect(a.nombreOrden).toBe("Compra de insumos"); // VERBATIM (texto libre de la orden)
    // CR-02: la fuente no trae un monto fijo -> `monto` es null (nunca un no-monto bajo "Monto").
    expect(a.monto).toBeNull();
    expect(a.fechaOc).toBe("2024-02-02");
    expect(a.rutProveedor).toBe("76.123.456-0");
    expect(a.proveedorNombre).toBe("Proveedora Ejemplo SpA");
    expect(a.licencia).toBe("mencion de la fuente");
    expect(a.origen).toBe("chilecompra");
    expect(a.fechaCorte).toBe("2026-06-19");
  });

  it("orden estable por codigo de orden (idempotencia)", () => {
    const out = parseContratos(respuestaOk, OPTS);
    expect(out.map((c) => c.codigoOrden)).toEqual(["1509-58-SE24", "1509-59-SE24"]);
  });

  it("Listado vacio -> 0 filas (consultado sin contratos, NO fabrica)", () => {
    const out = parseContratos({ Cantidad: 0, Listado: [] }, OPTS);
    expect(out).toEqual([]);
  });
});

describe("parseContratos — drift estructural -> THROW (cuarentena, nunca 0 filas silenciosas)", () => {
  it("respuesta sin Listado LANZA", () => {
    expect(() => parseContratos({ Cantidad: 5 }, OPTS)).toThrow(/drift estructural/i);
  });

  it("respuesta sin Cantidad LANZA", () => {
    expect(() => parseContratos({ Listado: [] }, OPTS)).toThrow(/drift estructural/i);
  });

  it("respuesta nula/forma totalmente distinta LANZA", () => {
    expect(() => parseContratos({ result: true, data: [] }, OPTS)).toThrow(/drift estructural/i);
  });
});

describe("tipoPersona — umbral 50M (ambos lados)", () => {
  it("cuerpo < 50.000.000 -> natural", () => {
    expect(tipoPersona("12.345.678-5")).toBe("natural");
    expect(tipoPersona("49.999.999-0")).toBe("natural");
  });

  it("cuerpo >= 50.000.000 -> juridica", () => {
    expect(tipoPersona("50.000.000-7")).toBe("juridica");
    expect(tipoPersona("76.123.456-0")).toBe("juridica");
  });

  it("el Contrato hereda el tipoPersona del RUT consultado", () => {
    const natural = parseContratos(respuestaOk, { ...OPTS, rutProveedor: "12.345.678-5" });
    expect(natural[0]!.tipoPersona).toBe("natural");
    const juridica = parseContratos(respuestaOk, { ...OPTS, rutProveedor: "76.123.456-0" });
    expect(juridica[0]!.tipoPersona).toBe("juridica");
  });
});
