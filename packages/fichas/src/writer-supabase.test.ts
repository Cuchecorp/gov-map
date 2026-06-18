// writer-supabase.test — upsert idempotente por boletín (cliente Supabase fake, sin DB).
//
// Verifica:
//   - upsertFicha → from('proyecto_ficha').upsert(filas, { onConflict: 'boletin' }).
//   - upsertEmbedding → from('proyecto_embedding').upsert(filas, { onConflict: 'boletin' }).
//   - dedupePorClave antes del lote (dos filas mismo boletín → una sola).
//   - el error propaga solo error.message de PostgREST; NUNCA interpola la service key.

import { describe, it, expect, vi } from "vitest";
import { SupabaseFichasWriter } from "./writer-supabase";

const SERVICE_KEY = "sb_secret_SUPER_SENSITIVE_KEY_1234567890";

/** Cliente Supabase fake: captura las llamadas a from().upsert(). */
function fakeClient(error: { message: string } | null = null) {
  const calls: { table: string; rows: unknown[]; opts: unknown }[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: unknown[], opts: unknown) {
          calls.push({ table, rows, opts });
          return Promise.resolve({ error });
        },
      };
    },
  };
  return { client, calls };
}

describe("writer-supabase: SupabaseFichasWriter — upsert idempotente", () => {
  it("upsertFicha → proyecto_ficha onConflict 'boletin'", async () => {
    const { client, calls } = fakeClient();
    const w = new SupabaseFichasWriter({ url: "http://x", serviceKey: SERVICE_KEY, client: client as never });

    await w.upsertFicha([
      { boletin: "1-1", idea_matriz: "x", cuerpos_legales: [], texto_r2_path: null, estado: "embebido", origen: "senado", fecha_captura: "2026-06-18" },
    ]);

    expect(calls[0]!.table).toBe("proyecto_ficha");
    expect((calls[0]!.opts as { onConflict: string }).onConflict).toBe("boletin");
  });

  it("upsertEmbedding → proyecto_embedding onConflict 'boletin'", async () => {
    const { client, calls } = fakeClient();
    const w = new SupabaseFichasWriter({ url: "http://x", serviceKey: SERVICE_KEY, client: client as never });

    await w.upsertEmbedding([
      { boletin: "1-1", embedding: [0.1], embedding_model: "m", embedding_dims: 768, embedding_version: "v1" },
    ]);

    expect(calls[0]!.table).toBe("proyecto_embedding");
    expect((calls[0]!.opts as { onConflict: string }).onConflict).toBe("boletin");
  });

  it("dedupePorClave antes del lote: dos filas mismo boletín → una", async () => {
    const { client, calls } = fakeClient();
    const w = new SupabaseFichasWriter({ url: "http://x", serviceKey: SERVICE_KEY, client: client as never });

    await w.upsertFicha([
      { boletin: "1-1", idea_matriz: "viejo", cuerpos_legales: [], texto_r2_path: null, estado: "embebido", origen: "s", fecha_captura: "t" },
      { boletin: "1-1", idea_matriz: "nuevo", cuerpos_legales: [], texto_r2_path: null, estado: "embebido", origen: "s", fecha_captura: "t" },
    ]);

    const rows = calls[0]!.rows as { idea_matriz: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.idea_matriz).toBe("nuevo"); // last-write-wins
  });

  it("error de PostgREST: el mensaje NO contiene la service key", async () => {
    const { client } = fakeClient({ message: "duplicate key value violates unique constraint" });
    const w = new SupabaseFichasWriter({ url: "http://x", serviceKey: SERVICE_KEY, client: client as never });

    await expect(
      w.upsertFicha([
        { boletin: "1-1", idea_matriz: "x", cuerpos_legales: [], texto_r2_path: null, estado: "embebido", origen: "s", fecha_captura: "t" },
      ]),
    ).rejects.toThrow(/upsert proyecto_ficha falló/);

    try {
      await w.upsertFicha([
        { boletin: "1-1", idea_matriz: "x", cuerpos_legales: [], texto_r2_path: null, estado: "embebido", origen: "s", fecha_captura: "t" },
      ]);
    } catch (err) {
      expect((err as Error).message).not.toContain(SERVICE_KEY);
      expect((err as Error).message).not.toContain("sb_secret");
    }
  });

  it("lote vacío → no llama a upsert (no-op)", async () => {
    const { client, calls } = fakeClient();
    const w = new SupabaseFichasWriter({ url: "http://x", serviceKey: SERVICE_KEY, client: client as never });
    await w.upsertFicha([]);
    await w.upsertEmbedding([]);
    expect(calls).toHaveLength(0);
  });
});
