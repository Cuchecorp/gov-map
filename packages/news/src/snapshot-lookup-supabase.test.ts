// snapshot-lookup-supabase.test.ts — hit/miss/error contra un cliente doble estructural.
//
// Cero red: el doble implementa solo la cadena `.from().select().eq().eq().eq().limit().maybeSingle()`
// que `SupabaseSnapshotLookup` usa, y registra los `eq` recibidos para poder assertar los TRES
// filtros exactos (T-132-30): un lookup que filtre solo por `source` devolvería `true` para
// cualquier recurso/día y produciría un `[skip]` mentiroso.
import { describe, expect, it } from "vitest";
import { SupabaseSnapshotLookup } from "./snapshot-lookup-supabase";

type MaybeSingleResult = { data: { id: number } | null; error: { message: string } | null };

/** Cliente doble estructural: registra los `eq(col,val)` recibidos y devuelve `result`. */
function makeDoubleClient(result: MaybeSingleResult) {
  const eqCalls: [string, unknown][] = [];
  const client = {
    from(table: string) {
      expect(table).toBe("source_snapshot");
      return {
        select(cols: string) {
          expect(cols).toBe("id");
          return {
            eq(col: string, val: unknown) {
              eqCalls.push([col, val]);
              return this;
            },
            limit(n: number) {
              expect(n).toBe(1);
              return this;
            },
            async maybeSingle() {
              return result;
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as import("@supabase/supabase-js").SupabaseClient, eqCalls };
}

describe("SupabaseSnapshotLookup — hit/miss/error", () => {
  it("hit: el doble devuelve una fila ⇒ true", async () => {
    const { client } = makeDoubleClient({ data: { id: 1 }, error: null });
    const lookup = new SupabaseSnapshotLookup({ url: "http://x", serviceKey: "k", client });
    const r = await lookup.hasSnapshot("news", "rss-latercera", "2026-08-05");
    expect(r).toBe(true);
  });

  it("miss: el doble devuelve data:null ⇒ false", async () => {
    const { client } = makeDoubleClient({ data: null, error: null });
    const lookup = new SupabaseSnapshotLookup({ url: "http://x", serviceKey: "k", client });
    const r = await lookup.hasSnapshot("news", "rss-latercera", "2026-08-05");
    expect(r).toBe(false);
  });

  it("error de PostgREST ⇒ LANZA con error.message, sin degradar a false (T-132-28)", async () => {
    const { client } = makeDoubleClient({ data: null, error: { message: "conexión rechazada" } });
    const lookup = new SupabaseSnapshotLookup({ url: "http://x", serviceKey: "k", client });
    await expect(lookup.hasSnapshot("news", "rss-latercera", "2026-08-05")).rejects.toThrow(
      /conexión rechazada/,
    );
  });

  it("assert los TRES filtros eq(source,resource,date_bucket) con los valores exactos (T-132-30)", async () => {
    const { client, eqCalls } = makeDoubleClient({ data: { id: 1 }, error: null });
    const lookup = new SupabaseSnapshotLookup({ url: "http://x", serviceKey: "k", client });
    await lookup.hasSnapshot("news", "rss-latercera", "2026-08-05");
    expect(eqCalls).toEqual([
      ["source", "news"],
      ["resource", "rss-latercera"],
      ["date_bucket", "2026-08-05"],
    ]);
  });

  it("la service key NUNCA aparece en el mensaje de error", async () => {
    const SECRET = "eyJsecretsupabasekey1234567890";
    const { client } = makeDoubleClient({ data: null, error: { message: "boom" } });
    const lookup = new SupabaseSnapshotLookup({ url: "http://x", serviceKey: SECRET, client });
    let thrown: unknown;
    try {
      await lookup.hasSnapshot("news", "rss-latercera", "2026-08-05");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(SECRET);
  });
});
