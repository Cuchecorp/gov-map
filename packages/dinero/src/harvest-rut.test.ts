// harvest-rut.test — writer path de cosecha de RUT (IDENT-10). Reusa runBackfillRut (DV-gate +
// provenance NOT NULL + fail-closed). SIN red, SIN DB: writer espia in-memory.
//
// Invariantes:
//  - cosecha persona-natural confirmada (DV-valido + provenance) -> 1 fila escrita.
//  - RUT DV-invalido (defensivo) -> rechazado "dv-invalido", NUNCA escrito.
//  - provenance faltante -> rechazado "provenance-faltante", NUNCA escrito.
//  - idempotencia: dos corridas con la misma lista -> mismas filas a updateRut.

import { describe, it, expect } from "vitest";
import type { FilaRutEscribir, RutBackfillWriter } from "@obs/identity";
import { construirFilasCosecha, runHarvestRut } from "./harvest-rut";
import type { CandidatoCosechaRut } from "./reconciliar-contrato";

/** Writer espia in-memory: captura las filas escritas; NUNCA toca la DB. */
class SpyRutWriter implements RutBackfillWriter {
  rows: FilaRutEscribir[] = [];
  async updateRut(rows: FilaRutEscribir[]): Promise<{ actualizadas: number }> {
    this.rows.push(...rows);
    return { actualizadas: rows.length };
  }
}

function cosecha(over: Partial<CandidatoCosechaRut> = {}): CandidatoCosechaRut {
  return {
    parlamentarioId: over.parlamentarioId ?? "P00500",
    rutHarvested: over.rutHarvested ?? "761234560",
    provenance: over.provenance ?? {
      origen: "harvest:chilecompra-persona-natural",
      fecha_captura: "2026-06-19T00:00:00Z",
      enlace: "https://api.mercadopublico.cl",
    },
  };
}

describe("construirFilasCosecha — mapeo puro CandidatoCosechaRut -> FilaRutCruda", () => {
  it("mapea id/rut/provenance de cada cosecha", () => {
    const filas = construirFilasCosecha([cosecha({ parlamentarioId: "P9", rutHarvested: "761234560" })]);
    expect(filas.length).toBe(1);
    expect(filas[0]!.id).toBe("P9");
    expect(filas[0]!.rut).toBe("761234560");
    expect(filas[0]!.origen).toBe("harvest:chilecompra-persona-natural");
    expect(filas[0]!.fecha_captura).toBe("2026-06-19T00:00:00Z");
    expect(filas[0]!.enlace).toBe("https://api.mercadopublico.cl");
  });
});

describe("runHarvestRut — cosecha confirmada DV-valida + provenance -> escrita", () => {
  it("1 fila escrita, id/rut correctos, rechazadas vacio", async () => {
    const writer = new SpyRutWriter();
    const r = await runHarvestRut([cosecha({ parlamentarioId: "P00500", rutHarvested: "761234560" })], writer);
    expect(r.escritas).toBe(1);
    expect(r.rechazadas).toEqual([]);
    expect(writer.rows.length).toBe(1);
    expect(writer.rows[0]!.id).toBe("P00500");
    expect(writer.rows[0]!.rut).toBe("761234560");
  });
});

describe("runHarvestRut — RUT DV-invalido (defensivo) -> rechazado, nunca escrito", () => {
  it("0 escritas, 1 rechazada dv-invalido, el writer NO recibio la fila", async () => {
    const writer = new SpyRutWriter();
    const r = await runHarvestRut([cosecha({ parlamentarioId: "PX", rutHarvested: "12345678-9" })], writer);
    expect(r.escritas).toBe(0);
    expect(r.rechazadas.length).toBe(1);
    expect(r.rechazadas[0]!.id).toBe("PX");
    expect(r.rechazadas[0]!.razon).toBe("dv-invalido");
    expect(writer.rows.length).toBe(0);
  });
});

describe("runHarvestRut — provenance faltante -> rechazado, nunca escrito", () => {
  it("origen/enlace/fecha vacios -> rechazada provenance-faltante", async () => {
    const writer = new SpyRutWriter();
    const r = await runHarvestRut(
      [cosecha({ parlamentarioId: "PV", provenance: { origen: "", fecha_captura: "", enlace: "" } })],
      writer,
    );
    expect(r.escritas).toBe(0);
    expect(r.rechazadas.length).toBe(1);
    expect(r.rechazadas[0]!.id).toBe("PV");
    expect(r.rechazadas[0]!.razon).toBe("provenance-faltante");
    expect(writer.rows.length).toBe(0);
  });
});

describe("runHarvestRut — idempotencia", () => {
  it("dos corridas con la misma lista -> mismas filas a updateRut", async () => {
    const lista = [cosecha({ parlamentarioId: "P1", rutHarvested: "761234560" })];
    const w1 = new SpyRutWriter();
    const w2 = new SpyRutWriter();
    const r1 = await runHarvestRut(lista, w1);
    const r2 = await runHarvestRut(lista, w2);
    expect(r1).toEqual(r2);
    expect(w1.rows).toEqual(w2.rows);
  });
});
