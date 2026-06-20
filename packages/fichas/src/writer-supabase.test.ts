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

/**
 * Cliente Supabase fake para leerPendientes: from('proyecto_ficha').select(...).in()/.eq()
 * encadenables, terminando en {data,error} (PostgREST devuelve la promesa al await del query).
 */
function fakeSelectClient(data: unknown[], error: { message: string } | null = null) {
  const builder = {
    select() {
      return builder;
    },
    in() {
      return builder;
    },
    eq() {
      return builder;
    },
    then(resolve: (v: { data: unknown[]; error: unknown }) => unknown) {
      return Promise.resolve({ data, error }).then(resolve);
    },
  };
  const client = {
    from() {
      return builder;
    },
  };
  return { client };
}

describe("writer-supabase: leerPendientes — cablea el link_mensaje_mocion REAL (SC3)", () => {
  const joinRow = (boletin: string) => ({
    boletin,
    estado: "pendiente",
    proyecto: { titulo: "T", materia: "M", origen: "senado", fecha_captura: "2026-06-18" },
  });

  it("emite el link REAL del resolvedor (NO null hardcodeado) cuando el XML lo trae", async () => {
    const { client } = fakeSelectClient([joinRow("18296-05")]);
    const resolverLink = vi.fn(async () => "https://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDocto&iddocto=1&tipodoc=mensaje_mocion");
    const w = new SupabaseFichasWriter({
      url: "http://x",
      serviceKey: SERVICE_KEY,
      client: client as never,
      resolverLink,
    });

    const filas = await w.leerPendientes();

    expect(filas[0]!.link_mensaje_mocion).toBe(
      "https://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDocto&iddocto=1&tipodoc=mensaje_mocion",
    );
    // Reuso de la política @obs/ingest: el resolvedor inyectado se llamó (no fetch global).
    expect(resolverLink).toHaveBeenCalledTimes(1);
  });

  it("consulta el boletín en su forma BASE (sufijo -NN de comisión stripeado)", async () => {
    const { client } = fakeSelectClient([joinRow("18296-05")]);
    const resolverLink = vi.fn(async () => "https://senado.cl/doc");
    const w = new SupabaseFichasWriter({
      url: "http://x",
      serviceKey: SERVICE_KEY,
      client: client as never,
      resolverLink,
    });

    await w.leerPendientes();

    expect(resolverLink).toHaveBeenCalledWith("18296"); // base, sin -05
  });

  it("degradación honesta: resolvedor devuelve null → link queda null (NUNCA fabrica)", async () => {
    const { client } = fakeSelectClient([joinRow("100-07")]);
    const resolverLink = vi.fn(async () => null);
    const w = new SupabaseFichasWriter({
      url: "http://x",
      serviceKey: SERVICE_KEY,
      client: client as never,
      resolverLink,
    });

    const filas = await w.leerPendientes();

    expect(filas[0]!.link_mensaje_mocion).toBeNull();
  });

  it("degradación honesta: el resolvedor LANZA (fetch falla) → link null, no aborta", async () => {
    const { client } = fakeSelectClient([joinRow("200-03")]);
    const resolverLink = vi.fn(async () => {
      throw new Error("503 desde senado.cl");
    });
    const w = new SupabaseFichasWriter({
      url: "http://x",
      serviceKey: SERVICE_KEY,
      client: client as never,
      resolverLink,
    });

    const filas = await w.leerPendientes();

    expect(filas[0]!.link_mensaje_mocion).toBeNull();
  });

  it("sin resolvedor inyectado → link null (degradación honesta, comportamiento previo seguro)", async () => {
    const { client } = fakeSelectClient([joinRow("300-01")]);
    const w = new SupabaseFichasWriter({
      url: "http://x",
      serviceKey: SERVICE_KEY,
      client: client as never,
    });

    const filas = await w.leerPendientes();

    expect(filas[0]!.link_mensaje_mocion).toBeNull();
    // El resto de campos se mantiene intacto.
    expect(filas[0]!.boletin).toBe("300-01");
    expect(filas[0]!.titulo).toBe("T");
    expect(filas[0]!.materia).toBe("M");
  });
});
