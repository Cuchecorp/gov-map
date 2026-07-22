// writer.test — idempotencia del InMemoryBioWriter (Map por clave natural → 2× upsert = 1 fila).

import { describe, it, expect } from "vitest";
import { InMemoryBioWriter, comisionKey, membresiaKey, militanciaKey } from "./writer";
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
    const clave = comisionKey("Hacienda", "diputados");
    expect(map1.get(clave)).toBeDefined();
    expect(map1.get(clave)).toBe(map2.get(clave));
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

  // CR-02: sin separador en la clave natural, ids adyacentes colisionan y una fila se pierde
  // silenciosamente. El separador explícito los mantiene distintos.
  it("membresiaKey NO colisiona con ids adyacentes (1|12 != 11|2)", () => {
    expect(membresiaKey("1", "12")).not.toBe(membresiaKey("11", "2"));
    expect(membresiaKey("1", "23")).not.toBe(membresiaKey("12", "3"));
  });

  it("militanciaKey NO colisiona cuando el alias termina en dígito", () => {
    expect(militanciaKey("P1", "PC2", "024")).not.toBe(militanciaKey("P1", "PC", "2024"));
  });

  it("membresías con comisionId adyacentes NO se pisan (2 filas, no 1)", async () => {
    const base = (comisionId: string, parlamentarioId: string): ComisionMembresia => ({
      comisionId,
      parlamentarioId,
      cargo: "Integrante",
      origen: "test",
      fechaCaptura: "2026-07-22T00:00:00Z",
      enlace: "https://test",
    });
    const w = new InMemoryBioWriter();
    // Sin separador ambas caían a la clave "112" → una se perdía. Deben coexistir.
    await w.upsertMembresias([base("1", "12"), base("11", "2")]);
    expect(w.membresias.size).toBe(2);
  });

  it("actualizarPartidoParlamentario guarda el último por id (last-write-wins)", async () => {
    const w = new InMemoryBioWriter();
    await w.actualizarPartidoParlamentario([
      { parlamentarioId: "P1", partido: "PC", fechaCaptura: "2026-07-22T00:00:00Z" },
    ]);
    expect(w.partidos.get("P1")?.partido).toBe("PC");
  });
});
