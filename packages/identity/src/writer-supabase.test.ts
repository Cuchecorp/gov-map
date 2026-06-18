import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parlamentario } from "@obs/core";
import { SupabaseMaestraWriter } from "./writer-supabase";

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

interface UpsertCall {
  rows: Parlamentario[];
  onConflict: string;
}
interface UpdateCall {
  patch: Record<string, unknown>;
  column: string;
  values: string[];
}

/** Cliente fake que captura las llamadas de upsert/update por tabla. */
function fakeClient(): {
  client: SupabaseClient;
  upserts: UpsertCall[];
  updates: UpdateCall[];
} {
  const upserts: UpsertCall[] = [];
  const updates: UpdateCall[] = [];
  const client = {
    from() {
      return {
        upsert(rows: Parlamentario[], opts: { onConflict: string }) {
          upserts.push({ rows, onConflict: opts.onConflict });
          return Promise.resolve({ error: null });
        },
        update(patch: Record<string, unknown>) {
          let column = "";
          const call: UpdateCall = { patch, column: "", values: [] };
          updates.push(call);
          const builder = {
            in(col: string, values: string[]) {
              column = col;
              call.column = col;
              call.values = values;
              return {
                select() {
                  return Promise.resolve({
                    data: values.map((v) => ({ id: v })),
                    error: null,
                  });
                },
              };
            },
          };
          void column;
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, upserts, updates };
}

const LOTE: Parlamentario[] = [
  p({ id: "S1", camara: "senado", parlid_senado: "100" }),
  p({ id: "S2", camara: "senado", parlid_senado: "101" }),
  p({ id: "D1", camara: "diputados", id_diputado_camara: "900" }),
];

describe("SupabaseMaestraWriter.upsert", () => {
  it("upsert único por la PK `id` (índice total que ON CONFLICT puede targetear)", async () => {
    const { client, upserts } = fakeClient();
    const w = new SupabaseMaestraWriter({ url: "x", serviceKey: "x", client });
    await w.upsert(LOTE);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.onConflict).toBe("id");
    // Todas las filas (ambas cámaras) van en el mismo upsert.
    expect(upserts[0]!.rows.map((r) => r.id)).toEqual(["S1", "S2", "D1"]);
  });

  it("no emite upsert con lote vacío", async () => {
    const { client, upserts } = fakeClient();
    const w = new SupabaseMaestraWriter({ url: "x", serviceKey: "x", client });
    await w.upsert([]);
    expect(upserts).toHaveLength(0);
  });
});

describe("SupabaseMaestraWriter.promoteToConfirmado", () => {
  it("promueve por clave natural y cuenta filas por cámara", async () => {
    const { client, updates } = fakeClient();
    const w = new SupabaseMaestraWriter({ url: "x", serviceKey: "x", client });
    const res = await w.promoteToConfirmado(LOTE);

    expect(res).toEqual({ senado: 2, camara: 1 });
    // Ambas updates ponen estado=confirmado.
    expect(updates.every((u) => u.patch.estado === "confirmado")).toBe(true);
    const senadoUpd = updates.find((u) => u.column === "parlid_senado");
    expect(senadoUpd?.values).toEqual(["100", "101"]);
  });
});
