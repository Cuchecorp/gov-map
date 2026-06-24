import { describe, it, expect } from "vitest";
import {
  exportMaestraEntidad,
  serializeMaestraEntidad,
  SEED_PATH,
  type EntidadTercero,
  type SeedFileWriter,
} from "./backup-entidad";

function e(overrides: Partial<EntidadTercero>): EntidadTercero {
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

/** Writer fake: captura path + contenido escrito. */
function fakeWriter(): SeedFileWriter & { written: { path: string; content: string }[] } {
  const written: { path: string; content: string }[] = [];
  return {
    written,
    async write(path: string, content: string) {
      written.push({ path, content });
    },
  };
}

const MAESTRA: EntidadTercero[] = [
  e({ id: "E00002", nombre_normalizado: "zeta", tipo_entidad: "juridica", rut: "76.111.222-3" }),
  e({ id: "E00001", nombre_normalizado: "ana gomez", tipo_entidad: "natural" }),
  e({ id: "E00003", nombre_normalizado: "beta", tipo_entidad: "natural" }),
];

describe("exportMaestraEntidad (determinismo byte-a-byte, ENT-05)", () => {
  it("Test 1: dos exports de la misma maestra son byte-idénticos", async () => {
    const w1 = fakeWriter();
    const w2 = fakeWriter();
    await exportMaestraEntidad(MAESTRA, { writer: w1 });
    await exportMaestraEntidad(MAESTRA, { writer: w2 });
    expect(w1.written[0]!.content).toBe(w2.written[0]!.content);
  });

  it("Test 2: filas en orden distinto producen el MISMO JSON (orden estable por id)", async () => {
    const w1 = fakeWriter();
    const w2 = fakeWriter();
    await exportMaestraEntidad(MAESTRA, { writer: w1 });
    await exportMaestraEntidad([...MAESTRA].reverse(), { writer: w2 });
    expect(w1.written[0]!.content).toBe(w2.written[0]!.content);
  });

  it("escribe al destino autoritativo supabase/seeds/entidad_tercero.seed.json", async () => {
    const w = fakeWriter();
    await exportMaestraEntidad(MAESTRA, { writer: w });
    expect(w.written[0]!.path).toBe(SEED_PATH);
    expect(SEED_PATH).toBe("supabase/seeds/entidad_tercero.seed.json");
  });

  it("claves de cada objeto ordenadas alfabéticamente (determinista)", () => {
    const json = serializeMaestraEntidad([e({ id: "E00001" })]);
    const parsed = JSON.parse(json) as Record<string, unknown>[];
    const keys = Object.keys(parsed[0]!);
    expect(keys).toEqual([...keys].sort());
  });

  it("round-trip: export→parse preserva las filas (orden por id)", () => {
    const json = serializeMaestraEntidad(MAESTRA);
    const parsed = JSON.parse(json) as EntidadTercero[];
    expect(parsed.map((r) => r.id)).toEqual(["E00001", "E00002", "E00003"]);
  });

  it("R2 deshabilitado por defecto: r2Ok=false aunque la maestra se exporte a git", async () => {
    const w = fakeWriter();
    const res = await exportMaestraEntidad(MAESTRA, { writer: w });
    expect(res.r2Ok).toBe(false);
    expect(w.written).toHaveLength(1);
  });
});
