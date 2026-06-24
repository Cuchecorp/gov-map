import { describe, it, expect } from "vitest";
import {
  upsertEntidades,
  prepararSeed,
  type EntidadTerceroWriter,
  type EntidadTerceroSeed,
} from "./seeder-entidad";

/** Helper para fabricar una fila de seed con defaults razonables. */
function e(overrides: Partial<EntidadTerceroSeed>): EntidadTerceroSeed {
  return {
    id: "E00000",
    nombre_normalizado: "x",
    tipo_entidad: "natural",
    rut: null,
    estado: "no_confirmado",
    origen: "test",
    fecha_captura: "2026-06-23T00:00:00.000Z",
    enlace: "https://example.test",
    ...overrides,
  };
}

/** Writer fake in-memory: upsert por clave natural (tipo_entidad|nombre_normalizado). */
function fakeWriter(): EntidadTerceroWriter & { rows: Map<string, EntidadTerceroSeed> } {
  const rows = new Map<string, EntidadTerceroSeed>();
  const keyOf = (r: EntidadTerceroSeed) =>
    r.rut != null && r.rut !== "" ? `RUT:${r.rut}` : `${r.tipo_entidad}|${r.nombre_normalizado}`;
  return {
    rows,
    async upsert(batch: EntidadTerceroSeed[]) {
      for (const r of batch) rows.set(keyOf(r), r);
    },
  };
}

describe("seeder-entidad — siembra idempotente (ENT-05)", () => {
  it("Test 1: upsert de una entidad nueva → 1 fila", async () => {
    const w = fakeWriter();
    await upsertEntidades(
      [e({ id: "E00001", nombre_normalizado: "fundacion luz", tipo_entidad: "juridica", rut: "76.111.222-3" })],
      w,
    );
    expect(w.rows.size).toBe(1);
  });

  it("Test 2 (ENT-05): 2ª corrida con la misma maestra → 0 entidades nuevas (idempotente por clave natural)", async () => {
    const w = fakeWriter();
    const maestra = [
      e({ id: "E00001", nombre_normalizado: "fundacion luz", tipo_entidad: "juridica", rut: "76.111.222-3" }),
      e({ id: "E00002", nombre_normalizado: "ana gomez", tipo_entidad: "natural" }),
    ];

    await upsertEntidades(maestra, w);
    const trasPrimera = w.rows.size;
    expect(trasPrimera).toBe(2);

    // 2ª corrida IDÉNTICA: el upsert por clave natural NO duplica.
    await upsertEntidades(maestra, w);
    expect(w.rows.size).toBe(trasPrimera); // 0 nuevas
  });

  it("Test 3: el seeder NUNCA auto-confirma — toda fila se persiste 'no_confirmado' aunque entre 'confirmado'", async () => {
    const w = fakeWriter();
    await upsertEntidades(
      [e({ id: "E00009", nombre_normalizado: "constructora andes", tipo_entidad: "juridica", estado: "confirmado" })],
      w,
    );
    const fila = [...w.rows.values()][0]!;
    expect(fila.estado).toBe("no_confirmado");
  });

  it("prepararSeed es puro: no muta el input y fuerza estado no_confirmado", () => {
    const input = [e({ estado: "confirmado" })];
    const out = prepararSeed(input);
    expect(input[0]!.estado).toBe("confirmado"); // input intacto
    expect(out[0]!.estado).toBe("no_confirmado");
  });
});
