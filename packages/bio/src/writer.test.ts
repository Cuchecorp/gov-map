// writer.test — idempotencia del InMemoryBioWriter (Map por clave natural → 2× upsert = 1 fila).

import { describe, it, expect } from "vitest";
import { InMemoryBioWriter } from "./writer";
import type { Militancia, Comision, ComisionMembresia } from "./model";

function mil(parlamentarioId: string, alias: string, desde: string): Militancia {
  return {
    parlamentarioId,
    partido: `Partido ${alias}`,
    partidoAlias: alias,
    desde,
    hasta: null,
    esActual: true,
    origen: "test",
    fechaCaptura: "2026-07-22T00:00:00Z",
    enlace: "https://test",
  };
}

function com(nombre: string): Comision {
  return {
    nombre,
    camara: "diputados",
    tipo: "permanente",
    origen: "test",
    fechaCaptura: "2026-07-22T00:00:00Z",
    enlace: "https://test",
  };
}

describe("InMemoryBioWriter — idempotencia por clave natural", () => {
  it("2× upsertMilitancias con el mismo input = mismos conteos (no duplica)", async () => {
    const w = new InMemoryBioWriter();
    const filas = [mil("P1", "PC", "2024-01-01"), mil("P1", "PRO", "2018-01-01")];
    await w.upsertMilitancias(filas);
    await w.upsertMilitancias(filas);
    expect(w.militancias.size).toBe(2);
  });

  it("upsertComisiones dedupea por (nombre,camara) y devuelve ids estables entre corridas", async () => {
    const w = new InMemoryBioWriter();
    const map1 = await w.upsertComisiones([com("Hacienda"), com("Hacienda")]);
    const map2 = await w.upsertComisiones([com("Hacienda")]);
    expect(w.comisiones.size).toBe(1);
    expect(map1.get("Haciendadiputados")).toBe(map2.get("Haciendadiputados"));
  });

  it("upsertMembresias dedupea por (comision_id, parlamentario_id)", async () => {
    const w = new InMemoryBioWriter();
    const m: ComisionMembresia = {
      comisionId: "C1",
      parlamentarioId: "P1",
      cargo: "Integrante",
      origen: "test",
      fechaCaptura: "2026-07-22T00:00:00Z",
      enlace: "https://test",
    };
    await w.upsertMembresias([m, m]);
    expect(w.membresias.size).toBe(1);
  });

  it("actualizarPartidoParlamentario guarda el último por id (last-write-wins)", async () => {
    const w = new InMemoryBioWriter();
    await w.actualizarPartidoParlamentario([
      { parlamentarioId: "P1", partido: "PC", fechaCaptura: "2026-07-22T00:00:00Z" },
    ]);
    expect(w.partidos.get("P1")?.partido).toBe("PC");
  });
});
