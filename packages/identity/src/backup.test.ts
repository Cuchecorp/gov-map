import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import {
  exportMaestra,
  SEED_PATH,
  type SeedFileWriter,
  type R2BackupTarget,
} from "./backup";

function p(overrides: Partial<Parlamentario>): Parlamentario {
  return {
    id: "P00000",
    nombre_normalizado: "x",
    nombres: "X",
    apellido_paterno: "X",
    apellido_materno: "X",
    camara: "diputados",
    periodo: "2026-2030",
    region: null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: "no_confirmado",
    email: null,
    origen: "test",
    fecha_captura: "2026-06-18T00:00:00.000Z",
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

const MAESTRA: Parlamentario[] = [
  p({ id: "D2", id_diputado_camara: "2", nombres: "Zoe" }),
  p({ id: "D1", id_diputado_camara: "1", nombres: "Ana" }),
  p({ id: "S3", camara: "senado", parlid_senado: "3", nombres: "Bea" }),
];

describe("exportMaestra (determinismo)", () => {
  it("dos exports de la misma maestra son byte-idénticos", async () => {
    const w1 = fakeWriter();
    const w2 = fakeWriter();
    await exportMaestra(MAESTRA, { writer: w1 });
    await exportMaestra(MAESTRA, { writer: w2 });
    expect(w1.written[0]!.content).toBe(w2.written[0]!.content);
  });

  it("el orden de filas es estable (ordenado por id) sin importar el input", async () => {
    const w1 = fakeWriter();
    const w2 = fakeWriter();
    await exportMaestra(MAESTRA, { writer: w1 });
    await exportMaestra([...MAESTRA].reverse(), { writer: w2 });
    expect(w1.written[0]!.content).toBe(w2.written[0]!.content);
  });

  it("escribe al destino autoritativo supabase/seeds/parlamentario.seed.json", async () => {
    const w = fakeWriter();
    await exportMaestra(MAESTRA, { writer: w });
    expect(w.written[0]!.path).toBe(SEED_PATH);
    expect(SEED_PATH).toBe("supabase/seeds/parlamentario.seed.json");
  });
});

describe("exportMaestra (round-trip)", () => {
  it("export→parse→import preserva la maestra (mismo conjunto de filas)", async () => {
    const w = fakeWriter();
    await exportMaestra(MAESTRA, { writer: w });
    const reimported = JSON.parse(w.written[0]!.content) as Parlamentario[];
    expect(reimported.length).toBe(MAESTRA.length);
    const idsIn = [...MAESTRA].map((r) => r.id).sort();
    const idsOut = reimported.map((r) => r.id).sort();
    expect(idsOut).toEqual(idsIn);
    // Cada fila preserva todos los campos.
    for (const original of MAESTRA) {
      const match = reimported.find((r) => r.id === original.id);
      expect(match).toEqual(original);
    }
  });
});

describe("exportMaestra (R2 gateado)", () => {
  it("con R2 ausente, el export a git ocurre igual (ID-09 cumplido por git)", async () => {
    const w = fakeWriter();
    // Sin r2 en opts: el export git debe completar.
    await expect(exportMaestra(MAESTRA, { writer: w })).resolves.toBeDefined();
    expect(w.written.length).toBe(1);
  });

  it("con R2 que falla (401), el export git NO se rompe", async () => {
    const w = fakeWriter();
    const failingR2: R2BackupTarget = {
      async put() {
        throw new Error("R2 PUT 401");
      },
    };
    const result = await exportMaestra(MAESTRA, {
      writer: w,
      r2: failingR2,
      r2Enabled: true,
    });
    // Git escrito; R2 reportado como fallido pero no propaga.
    expect(w.written.length).toBe(1);
    expect(result.r2Ok).toBe(false);
  });

  it("r2Enabled=false (default) NO intenta R2 aunque se pase un target", async () => {
    const w = fakeWriter();
    let called = false;
    const r2: R2BackupTarget = {
      async put() {
        called = true;
        return "key";
      },
    };
    const result = await exportMaestra(MAESTRA, { writer: w, r2 });
    expect(called).toBe(false);
    expect(result.r2Ok).toBe(false);
  });
});
