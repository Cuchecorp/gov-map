// name-match-rut-guard.behavior.test — COMPORTAMIENTO fail-closed del corte CR-01
// "un name-match NUNCA escribe el `rut` de la maestra" (RUT-01, riesgo #1 =
// atribución financiera falsa por difamación).
//
// COMPANION de comportamiento del guard ESTÁTICO
// `app/lib/name-match-rut-guard.test.ts`. El frontend `app/` NO depende de
// @obs/dinero (CLAUDE.md: el frontend lee de Supabase; la ingesta vive en
// packages/Edge), así que el test que EJERCITA `reconciliarContrato` vive AQUÍ,
// donde el paquete resuelve nativamente. Ambos archivos congelan el MISMO corte:
//
//   name-only (maestra sin rut coincidente)     → 0 cosechas, 1 revisión (cola humana)
//   corroboración (maestra ya tiene el rut)      → 1 cosecha (única vía al writer)
//
// SIN red, SIN DB: MockMiniMaxProvider. No modifica reconciliar-contrato.ts (lo PROTEGE).

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { MockMiniMaxProvider } from "@obs/adjudication";
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
    nombreOrden: over.nombreOrden ?? "Compra de prueba",
    monto: over.monto ?? null,
    fechaOc: over.fechaOc ?? "2024-02-02",
    origen: "chilecompra",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://api.mercadopublico.cl",
    licencia: "mencion de la fuente",
  };
}

const matchMock = (id: string) =>
  new MockMiniMaxProvider({
    decision: "match",
    chosen_id: id,
    confidence: 0.99,
    evidence: [],
    conflicts: [],
  });

// ---------------------------------------------------------------------------
// Fail-closed real: name-only → 0 cosechas, 1 revisión (cola humana)
// ---------------------------------------------------------------------------

describe("CR-01 comportamiento — name-only NUNCA escribe (0 cosechas, 1 revisión)", () => {
  it("persona-natural nombre-único, maestra SIN rut coincidente → cosechas.length===0, revisionesRut.length===1", async () => {
    // La maestra NO tiene un rut que coincida → el RUT derivado del nombre es un
    // CANDIDATO que va a la cola humana, JAMÁS a cosecha (canal de escritura).
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
        rut: null, // sin rut → no se puede corroborar
      }),
    ];
    const r = await reconciliarContrato(
      [
        contrato({
          rutProveedor: "76.123.456-0", // DV-válido (no gatilla cuarentena)
          tipoPersona: "natural",
          proveedorNombre: "Coloma C., Juan Antonio",
        }),
      ],
      maestra,
      { provider: matchMock("P00500") },
    );

    // El enlace-por-nombre se mantiene (fiscalización), PERO el RUT no se escribe.
    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    // FAIL-CLOSED REAL: 0 writes, 1 candidato a cola humana.
    expect(r.cosechas.length).toBe(0);
    expect(r.revisionesRut.length).toBe(1);
    expect(r.revisionesRut[0]!.parlamentarioId).toBe("P00500");
    expect(r.revisionesRut[0]!.rutCandidato).toBe("761234560");
    expect(r.revisionesRut[0]!.provenance.origen).toContain("name-only");
  });

  it("namesake-collision (RUT del proveedor difiere del rut real del senador) → 0 cosechas, 1 revisión, el rut real NO se sobreescribe", async () => {
    // EL caso que CR-01 previene: un contratista privado homónimo cuyo RUT NO es el
    // del senador. La maestra ya trae OTRO rut → el RUT del proveedor va a revisión.
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
        rut: "9.876.543-3", // rut REAL del senador (DV-válido), distinto al del contratista
      }),
    ];
    const r = await reconciliarContrato(
      [
        contrato({
          rutProveedor: "76.123.456-0", // RUT del contratista privado, NO el del senador
          tipoPersona: "natural",
          proveedorNombre: "Coloma C., Juan Antonio",
        }),
      ],
      maestra,
      { provider: matchMock("P00500") },
    );
    expect(r.cosechas.length).toBe(0); // NINGUNA mutación del rut de la maestra
    expect(r.revisionesRut.length).toBe(1);
    // El rut real del senador NUNCA se sobreescribe: 761234560 no aparece en cosechas.
    expect(r.cosechas.find((c) => c.rutHarvested === "761234560")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Corroboración: la ÚNICA vía al writer → 1 cosecha (maestra ya tiene el rut)
// ---------------------------------------------------------------------------

describe("CR-01 comportamiento — corroboración (maestra YA tiene el rut coincidente) → 1 cosecha", () => {
  it("RUT-exacto fail-closed (2+ filas con el RUT) + nombre resuelve a UNA que ya tiene ese rut → cosechas.length===1", async () => {
    // Borde donde el canal CORROBORACIÓN se activa: el paso 2 (RUT-exacto) NO
    // confirma porque 2 filas comparten el RUT (fail-closed), pero el nombre
    // resuelve a UNA sola cuyo `rut` == normRut(rutProveedor). Es corroboración de
    // un RUT ya presente (no-op de confirmación), la ÚNICA vía que alimenta el writer.
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
        rut: "76.123.456-0", // la maestra YA tiene EXACTAMENTE este rut
      }),
      // Segunda fila con el MISMO rut (distinto nombre) → el paso 2 RUT-exacto
      // falla fail-closed (2 matches), forzando la rama name-match.
      maestro({
        id: "P00999",
        nombre_normalizado: "otro nombre distinto",
        nombres: "Otro",
        apellido_paterno: "Nombre",
        rut: "76.123.456-0",
      }),
    ];
    const r = await reconciliarContrato(
      [
        contrato({
          rutProveedor: "76.123.456-0",
          tipoPersona: "natural",
          proveedorNombre: "Coloma C., Juan Antonio",
        }),
      ],
      maestra,
      { provider: matchMock("P00500") },
    );

    // Corroboración: el nombre resolvió a P00500, cuyo rut YA coincide → 1 cosecha.
    expect(r.cosechas.length).toBe(1);
    expect(r.cosechas[0]!.parlamentarioId).toBe("P00500");
    expect(r.cosechas[0]!.rutHarvested).toBe("761234560");
    // Y NO se generó una revisión (no es name-only: es corroboración de un rut presente).
    expect(r.revisionesRut.length).toBe(0);
    // La cosecha lleva provenance completa (lo que el writer exige NOT NULL) — CORROBORADO.
    expect(r.cosechas[0]!.provenance.origen).toContain("corroborado");
  });
});
