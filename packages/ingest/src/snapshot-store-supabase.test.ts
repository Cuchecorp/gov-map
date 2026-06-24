import { describe, expect, it } from "vitest";
import { SupabaseSnapshotStore } from "./snapshot-store-supabase";

/**
 * Fila válida de source_snapshot (las 8 columnas NOT NULL de la migración 0002 +
 * provenance inline). El SnapshotWriter produce exactamente esta forma.
 */
function filaValida(): Record<string, unknown> {
  return {
    ingest_run_id: null,
    source: "leylobby",
    resource: "probidad-AA001",
    cache_key: "abc123",
    r2_path: "leylobby/probidad-AA001/2026-06-23/deadbeef.json",
    content_hash: "deadbeef",
    fingerprint: "fp-xyz",
    date_bucket: "2026-06-23",
    source_url: "https://www.leylobby.gob.cl/...",
    fetched_at: "2026-06-23T00:00:00.000Z",
  };
}

/**
 * Mock supabase-js mínimo. Solo modela el subconjunto que toca insertSnapshot:
 *   .from(table).insert(row).select("id").single()          (insert path)
 *   .from(table).select("id").eq().eq().eq().maybeSingle()  (recovery path)
 * Sin red, sin DB.
 */
type Resultado = { data: unknown; error: unknown };

function mockClient(opts: {
  insert: Resultado;
  /** Resultado del SELECT de recuperación (solo se consulta en el path 23505). */
  recovery?: Resultado;
}) {
  const calls = { inserts: 0, recoveries: 0 };
  const client = {
    from(_table: string) {
      return {
        // ----- camino de INSERT -----
        insert(_row: Record<string, unknown>) {
          calls.inserts++;
          return {
            select(_cols: string) {
              return {
                async single(): Promise<Resultado> {
                  return opts.insert;
                },
              };
            },
          };
        },
        // ----- camino de RECUPERACIÓN (SELECT por la clave única) -----
        select(_cols: string) {
          const builder = {
            eq(_col: string, _val: unknown) {
              return builder;
            },
            async maybeSingle(): Promise<Resultado> {
              calls.recoveries++;
              return opts.recovery ?? { data: null, error: null };
            },
          };
          return builder;
        },
      };
    },
  };
  return { client, calls };
}

describe("SupabaseSnapshotStore.insertSnapshot", () => {
  it("Test 1: insert OK devuelve { id } leído de .select('id').single()", async () => {
    const { client } = mockClient({ insert: { data: { id: 7 }, error: null } });
    const store = new SupabaseSnapshotStore({ url: "http://x", serviceKey: "k", client });

    const out = await store.insertSnapshot(filaValida());

    expect(out).toEqual({ id: 7 });
  });

  it("Test 2: 23505 recupera la fila existente y devuelve su id (idempotencia caché-diaria)", async () => {
    const { client, calls } = mockClient({
      insert: { data: null, error: { code: "23505", message: "duplicate key value" } },
      recovery: { data: { id: 42 }, error: null },
    });
    const store = new SupabaseSnapshotStore({ url: "http://x", serviceKey: "k", client });

    const out = await store.insertSnapshot(filaValida());

    expect(out).toEqual({ id: 42 });
    expect(calls.recoveries).toBe(1);
  });

  it("Test 3: 23505 sin fila recuperable lanza Error RETRYABLE nombrando source/resource/date_bucket", async () => {
    const { client } = mockClient({
      insert: { data: null, error: { code: "23505", message: "duplicate key value" } },
      recovery: { data: null, error: null },
    });
    const store = new SupabaseSnapshotStore({ url: "http://x", serviceKey: "k", client });

    await expect(store.insertSnapshot(filaValida())).rejects.toThrow(
      /leylobby.*probidad-AA001.*2026-06-23/,
    );
  });

  it("Test 4: error real (code !== 23505) lanza Error sin exponer la service key", async () => {
    const { client } = mockClient({
      insert: { data: null, error: { code: "42501", message: "permission denied for table source_snapshot" } },
    });
    const SECRET = "super-secret-service-key";
    const store = new SupabaseSnapshotStore({ url: "http://x", serviceKey: SECRET, client });

    let caught: unknown;
    try {
      await store.insertSnapshot(filaValida());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("insert source_snapshot fallo");
    expect((caught as Error).message).toContain("permission denied");
    // T-34-01: la service key NUNCA aparece en el mensaje de error.
    expect((caught as Error).message).not.toContain(SECRET);
  });
});
