// writer.test — el DineroWriter es IDEMPOTENTE Y VERSIONADO por (fuente_id, fecha_corte), tanto el
// fake in-memory como el SupabaseDineroWriter (mock del cliente PostgREST que verifica el onConflict
// de version + la guarda: la service key nunca aparece en mensajes de error).

import { describe, it, expect } from "vitest";
import { confirmar } from "@obs/identity";
import { InMemoryDineroWriter, versionKey } from "./writer";
import { SupabaseDineroWriter } from "./writer-supabase";
import type { ContratoParaEscribir } from "./reconciliar-contrato";
import type { Contratista } from "./model";

function fila(
  over: Partial<ContratoParaEscribir> & { fuenteId: string; fechaCorte: string },
): ContratoParaEscribir {
  return {
    fuenteId: over.fuenteId,
    fechaCorte: over.fechaCorte,
    codigoOrden: over.codigoOrden ?? over.fuenteId,
    enlace: over.enlace ?? null,
    rutProveedor: over.rutProveedor ?? "76123456-0",
    mencionProveedor: over.mencionProveedor ?? "Proveedora Ejemplo SpA",
    estadoVinculo: over.estadoVinculo ?? "no_confirmado",
    tipoPersona: over.tipoPersona ?? "juridica",
    organismo: over.organismo ?? "MUNICIPALIDAD X",
    monto: over.monto ?? "Compra de insumos",
    fechaOc: over.fechaOc ?? "2024-02-02",
    origen: "chilecompra",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace_url: "https://api.mercadopublico.cl",
    licencia: "mencion de la fuente",
  };
}

function contratista(over: Partial<Contratista> & { rutProveedor: string }): Contratista {
  return {
    rutProveedor: over.rutProveedor,
    nombre: over.nombre ?? "Proveedora Ejemplo SpA",
    codigoEmpresa: over.codigoEmpresa ?? "17793",
    tipoPersona: over.tipoPersona ?? "juridica",
    origen: "chilecompra",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://api.mercadopublico.cl",
    licencia: "mencion de la fuente",
  };
}

describe("InMemoryDineroWriter — idempotente + VERSIONADO por (fuente_id, fecha_corte)", () => {
  it("(a) upsert 2x con el mismo input NO duplica (mismos conteos)", async () => {
    const w = new InMemoryDineroWriter();
    await w.upsertContratos([fila({ fuenteId: "OC-1", fechaCorte: "2026-06-19" })]);
    await w.upsertContratos([fila({ fuenteId: "OC-1", fechaCorte: "2026-06-19" })]);
    expect(w.contratos.size).toBe(1);
  });

  it("(b) versioning: dos cortes del MISMO contrato -> DOS filas; re-run NO sobreescribe", async () => {
    const w = new InMemoryDineroWriter();
    await w.upsertContratos([
      fila({ fuenteId: "OC-1", fechaCorte: "2026-05-01", organismo: "ORG-A" }),
      fila({ fuenteId: "OC-1", fechaCorte: "2026-06-19", organismo: "ORG-B" }),
    ]);
    expect(w.contratos.size).toBe(2);
    await w.upsertContratos([fila({ fuenteId: "OC-1", fechaCorte: "2026-05-01", organismo: "ORG-A" })]);
    expect(w.contratos.size).toBe(2);
    expect(w.contratos.get(versionKey("OC-1", "2026-05-01"))!.organismo).toBe("ORG-A");
    expect(w.contratos.get(versionKey("OC-1", "2026-06-19"))!.organismo).toBe("ORG-B");
  });

  it("storage plano: el FK branded se aplana a parlamentario_id", async () => {
    const w = new InMemoryDineroWriter();
    await w.upsertContratos([
      fila({
        fuenteId: "OC-9",
        fechaCorte: "2026-06-19",
        enlace: confirmar("P500", "determinista"),
        estadoVinculo: "confirmado",
      }),
    ]);
    expect(w.contratos.get(versionKey("OC-9", "2026-06-19"))!.parlamentario_id).toBe("P500");
  });

  it("contratista sub-maestra: upsert keyed por rutProveedor (last-write-wins)", async () => {
    const w = new InMemoryDineroWriter();
    await w.upsertContratistas([contratista({ rutProveedor: "76123456-0", nombre: "Vieja" })]);
    await w.upsertContratistas([contratista({ rutProveedor: "76123456-0", nombre: "Nueva" })]);
    expect(w.contratistas.size).toBe(1);
    expect(w.contratistas.get("76123456-0")!.nombre).toBe("Nueva");
  });

  it("marcarIngestado upserta un row por parlamentario (idempotente)", async () => {
    const w = new InMemoryDineroWriter();
    await w.marcarIngestado(["P1", "P2"], "2026-06-19");
    await w.marcarIngestado(["P1", "P2"], "2026-06-19");
    expect(w.ingestaEstado.size).toBe(2);
    expect(w.ingestaEstado.get("P1")!.ingestado_hasta).toBe("2026-06-19");
  });
});

/** Mock minimo del cliente Supabase: registra los upsert por tabla. */
function makeFakeClient(failOn?: string) {
  const upserts: Array<{ tabla: string; rows: unknown[]; onConflict?: string }> = [];
  const client = {
    from(tabla: string) {
      return {
        upsert(rows: unknown[], opts?: { onConflict?: string }) {
          upserts.push({ tabla, rows: Array.isArray(rows) ? rows : [rows], onConflict: opts?.onConflict });
          if (failOn === tabla) {
            return Promise.resolve({ error: { message: "fallo simulado de PostgREST" } });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, upserts };
}

describe("SupabaseDineroWriter — upsert VERSIONADO por onConflict (clave de version)", () => {
  it("la raiz upserta contrato con onConflict que INCLUYE fecha_corte", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseDineroWriter({ url: "x", serviceKey: "secret-key", client: client as never });
    await w.upsertContratos([fila({ fuenteId: "OC-1", fechaCorte: "2026-06-19" })]);
    const oc = upserts.find((u) => u.tabla === "contrato")!;
    expect(oc.onConflict).toBe("fuente_id,fecha_corte");
    const raiz = oc.rows[0] as Record<string, unknown>;
    expect(raiz).toHaveProperty("parlamentario_id");
    expect(raiz).toHaveProperty("licencia", "mencion de la fuente");
    expect(raiz).not.toHaveProperty("CC BY 4.0");
  });

  it("contratista upserta con onConflict rut_proveedor", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseDineroWriter({ url: "x", serviceKey: "secret-key", client: client as never });
    await w.upsertContratistas([contratista({ rutProveedor: "76123456-0" })]);
    const c = upserts.find((u) => u.tabla === "contratista")!;
    expect(c.onConflict).toBe("rut_proveedor");
  });

  it("marcarIngestado upserta contratos_ingesta_estado con onConflict parlamentario_id", async () => {
    const { client, upserts } = makeFakeClient();
    const w = new SupabaseDineroWriter({ url: "x", serviceKey: "secret-key", client: client as never });
    await w.marcarIngestado(["P1"], "2026-06-19");
    const m = upserts.find((u) => u.tabla === "contratos_ingesta_estado")!;
    expect(m.onConflict).toBe("parlamentario_id");
  });

  it("la service key NUNCA aparece en el mensaje de error", async () => {
    const { client } = makeFakeClient("contrato");
    const secret = "super-secret-service-key";
    const w = new SupabaseDineroWriter({ url: "x", serviceKey: secret, client: client as never });
    await expect(w.upsertContratos([fila({ fuenteId: "OC-1", fechaCorte: "2026-06-19" })])).rejects.toThrow(
      /upsert contrato fallo/,
    );
    try {
      await w.upsertContratos([fila({ fuenteId: "OC-1", fechaCorte: "2026-06-19" })]);
    } catch (err) {
      expect((err as Error).message).not.toContain(secret);
    }
  });
});
