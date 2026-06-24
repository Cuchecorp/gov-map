import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseEntidadWriter } from "./writer-entidad-supabase";
import type { EntidadTerceroSeed } from "./seeder-entidad";

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

interface UpsertCall {
  rows: EntidadTerceroSeed[];
  onConflict: string;
}
interface UpdateCall {
  patch: Record<string, unknown>;
  column: string;
  values: string[];
}

/** Cliente fake que captura las llamadas de upsert/update. */
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
        upsert(rows: EntidadTerceroSeed[], opts: { onConflict: string }) {
          upserts.push({ rows, onConflict: opts.onConflict });
          return Promise.resolve({ error: null });
        },
        update(patch: Record<string, unknown>) {
          const call: UpdateCall = { patch, column: "", values: [] };
          updates.push(call);
          return {
            in(col: string, values: string[]) {
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
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, upserts, updates };
}

describe("SupabaseEntidadWriter.upsert", () => {
  it("upsert por la clave natural (tipo_entidad,nombre_normalizado)", async () => {
    const { client, upserts } = fakeClient();
    const w = new SupabaseEntidadWriter({ url: "x", serviceKey: "x", client });
    await w.upsert([e({ id: "E1", nombre_normalizado: "ana gomez" })]);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.onConflict).toBe("tipo_entidad,nombre_normalizado");
  });

  it("Test 3: el writer NUNCA auto-confirma — la fila viaja con estado 'no_confirmado'", async () => {
    const { client, upserts } = fakeClient();
    const w = new SupabaseEntidadWriter({ url: "x", serviceKey: "x", client });
    await w.upsert([e({ id: "E1", estado: "no_confirmado" })]);

    // El writer no inyecta estado='confirmado' en ninguna fila; persiste lo que recibe.
    expect(upserts[0]!.rows.every((r) => r.estado === "no_confirmado")).toBe(true);
  });

  it("no emite upsert con lote vacío", async () => {
    const { client, upserts } = fakeClient();
    const w = new SupabaseEntidadWriter({ url: "x", serviceKey: "x", client });
    await w.upsert([]);
    expect(upserts).toHaveLength(0);
  });
});

describe("SupabaseEntidadWriter.promoteToConfirmado (allow-list principiada)", () => {
  it("promueve EXACTAMENTE los ids del allow-list por la PK `id`", async () => {
    const { client, updates } = fakeClient();
    const w = new SupabaseEntidadWriter({ url: "x", serviceKey: "x", client });
    const res = await w.promoteToConfirmado(["E1", "E2"]);

    expect(res).toEqual({ promovidos: 2 });
    expect(updates.every((u) => u.patch.estado === "confirmado")).toBe(true);
    expect(updates.every((u) => u.column === "id")).toBe(true);
    expect(updates.flatMap((u) => u.values).sort()).toEqual(["E1", "E2"]);
  });

  it("allow-list vacío es un no-op (0 promovidos, sin update) — NUNCA promueve todo", async () => {
    const { client, updates } = fakeClient();
    const w = new SupabaseEntidadWriter({ url: "x", serviceKey: "x", client });
    const res = await w.promoteToConfirmado([]);

    expect(res).toEqual({ promovidos: 0 });
    expect(updates).toHaveLength(0);
  });
});
