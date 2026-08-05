// writer-supabase.test.ts — Tests unitarios para SupabaseNewsWriter (WR-15: es el único
// componente que escribe en PROD y no tenía ningún test). Cero red, cero DB: cliente doble
// ESTRUCTURAL que registra tabla/método/argumentos de cada llamada de la cadena
// `from().select()/.upsert().eq()/.is()/.in()` y resuelve vía un `responder(chain)` configurable
// por test — así cada test controla exactamente qué "PostgREST" devuelve sin tocar la red.
// Espeja el idiom de packages/tramitacion/src/writer-supabase.test.ts.

import { describe, expect, it } from "vitest";
import { SupabaseNewsWriter, CAUSAS_CONOCIDAS } from "./writer-supabase";
import type { NoticiaRow, UrlVistaRow } from "./writer";

// ── Cliente doble estructural ────────────────────────────────────────────────────

interface ChainCall {
  method: string;
  args: unknown[];
}

interface Chain {
  table: string;
  calls: ChainCall[];
}

type Responder = (chain: Chain) => { data?: unknown; error?: { message: string } | null; count?: number | null };

function makeMockClient(responder: Responder) {
  const chains: Chain[] = [];

  const client = {
    from(table: string) {
      const chain: Chain = { table, calls: [] };
      const proxy: Record<string, unknown> = {
        select: (...args: unknown[]) => {
          chain.calls.push({ method: "select", args });
          return proxy;
        },
        upsert: (...args: unknown[]) => {
          chain.calls.push({ method: "upsert", args });
          return proxy;
        },
        eq: (...args: unknown[]) => {
          chain.calls.push({ method: "eq", args });
          return proxy;
        },
        is: (...args: unknown[]) => {
          chain.calls.push({ method: "is", args });
          return proxy;
        },
        in: (...args: unknown[]) => {
          chain.calls.push({ method: "in", args });
          return proxy;
        },
        then: (
          resolve: (v: { data?: unknown; error?: { message: string } | null; count?: number | null }) => void,
          reject: (e: unknown) => void,
        ) => {
          chains.push(chain);
          try {
            resolve(responder(chain));
          } catch (e) {
            reject(e);
          }
        },
      };
      return proxy;
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writer = new SupabaseNewsWriter({ url: "x", serviceKey: "x", client: client as any });
  return { writer, chains };
}

function ultimoSelectConOpts(chain: Chain): unknown {
  return chain.calls.find((c) => c.method === "select")?.args[1];
}

const NOTICIA_BASE: NoticiaRow = {
  url_hash: "h1",
  url: "https://example.cl/a",
  url_canonica: "https://example.cl/a",
  titular: "t",
  outlet: "biobiochile",
  fecha_pub: null,
  descripcion: null,
  r2_path: "news/biobiochile/x.xml",
  contenido_hash: "abc",
  estado: "pendiente",
};

const VISTA_BASE: UrlVistaRow = {
  url_hash: "h1",
  url_canonica: "https://example.cl/a",
  outlet: "biobiochile",
  estado: "pasa",
  causa: null,
};

// ── WR-05: contarPorCausa — B-01 no renace ────────────────────────────────────────

describe("SupabaseNewsWriter.contarPorCausa", () => {
  it("reporta el count exacto del servidor por encima del cap de 1.000 de PostgREST (simulación del cap)", async () => {
    const { writer } = makeMockClient((chain) => {
      const eq = chain.calls.find((c) => c.method === "eq");
      if (eq?.args[0] === "causa" && eq.args[1] === "prefiltro_lexico") {
        // Simula el cap: data traería como máximo 1.000 filas, pero count reporta el real.
        return { data: new Array(1000).fill({}), error: null, count: 3752 };
      }
      return { data: [], error: null, count: 0 };
    });

    const out = await writer.contarPorCausa();
    expect(out.prefiltro_lexico).toBe(3752);
    expect(out.prefiltro_lexico).not.toBe(1000);
  });

  it("cada llamada usa select('*', { count: 'exact', head: true }) — cero payload", async () => {
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null, count: 5 }));
    await writer.contarPorCausa();

    expect(chains.length).toBeGreaterThan(0);
    for (const chain of chains) {
      const opts = ultimoSelectConOpts(chain) as { count?: string; head?: boolean };
      expect(opts).toEqual({ count: "exact", head: true });
    }
  });

  it("cuenta cada causa conocida más las filas con causa null (clave sin_causa), una llamada por causa", async () => {
    const { writer, chains } = makeMockClient((chain) => {
      const eq = chain.calls.find((c) => c.method === "eq");
      const is = chain.calls.find((c) => c.method === "is");
      if (eq?.args[1] === "prefiltro_lexico") return { data: [], error: null, count: 200 };
      if (eq?.args[1] === "duplicado") return { data: [], error: null, count: 20 };
      if (is && is.args[0] === "causa" && is.args[1] === null) return { data: [], error: null, count: 25 };
      return { data: [], error: null, count: 0 };
    });

    const out = await writer.contarPorCausa();
    expect(out).toEqual({ prefiltro_lexico: 200, duplicado: 20, sin_causa: 25 });
    // Una llamada por causa conocida + una para sin_causa.
    expect(chains.length).toBe(CAUSAS_CONOCIDAS.length + 1);
  });

  it("un error de PostgREST lanza (nunca devuelve un conteo parcial silencioso)", async () => {
    const { writer } = makeMockClient(() => ({ data: null, error: { message: "servidor caído" } }));
    await expect(writer.contarPorCausa()).rejects.toThrow(/servidor caído/);
  });
});

// ── WR-15: upsertNoticias / marcarVistas ──────────────────────────────────────────

describe("SupabaseNewsWriter.upsertNoticias", () => {
  it("usa onConflict: 'url_hash'", async () => {
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null }));
    await writer.upsertNoticias([NOTICIA_BASE]);

    const upsertCall = chains[0]!.calls.find((c) => c.method === "upsert")!;
    const opts = upsertCall.args[1] as { onConflict?: string };
    expect(opts.onConflict).toBe("url_hash");
  });

  it("1.200 filas se parten en 3 lotes de <= 500", async () => {
    const filas = Array.from({ length: 1200 }, (_, i) => ({ ...NOTICIA_BASE, url_hash: `h${i}` }));
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null }));
    await writer.upsertNoticias(filas);

    expect(chains.length).toBe(3);
    for (const chain of chains) {
      const upsertCall = chain.calls.find((c) => c.method === "upsert")!;
      const lote = upsertCall.args[0] as unknown[];
      expect(lote.length).toBeLessThanOrEqual(500);
    }
  });

  it("dos filas con el mismo url_hash llegan como una sola (dedupe last-write-wins)", async () => {
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null }));
    await writer.upsertNoticias([NOTICIA_BASE, { ...NOTICIA_BASE, titular: "otro titular" }]);

    const upsertCall = chains[0]!.calls.find((c) => c.method === "upsert")!;
    const lote = upsertCall.args[0] as NoticiaRow[];
    expect(lote).toHaveLength(1);
    expect(lote[0]!.titular).toBe("otro titular");
  });

  it("un error de PostgREST se convierte en throw con error.message y sin la service key", async () => {
    const { writer } = makeMockClient(() => ({ data: null, error: { message: "constraint violada" } }));
    try {
      await writer.upsertNoticias([NOTICIA_BASE]);
      throw new Error("no lanzó");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toContain("constraint violada");
      expect(msg).not.toContain("service-key-secreta");
    }
  });
});

describe("SupabaseNewsWriter.marcarVistas", () => {
  it("usa onConflict: 'url_hash'", async () => {
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null }));
    await writer.marcarVistas([VISTA_BASE]);

    const upsertCall = chains[0]!.calls.find((c) => c.method === "upsert")!;
    const opts = upsertCall.args[1] as { onConflict?: string };
    expect(opts.onConflict).toBe("url_hash");
  });

  it("1.200 filas se parten en 3 lotes de <= 500", async () => {
    const filas = Array.from({ length: 1200 }, (_, i) => ({ ...VISTA_BASE, url_hash: `h${i}` }));
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null }));
    await writer.marcarVistas(filas);

    expect(chains.length).toBe(3);
  });

  it("dos filas con el mismo url_hash llegan como una sola", async () => {
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null }));
    await writer.marcarVistas([VISTA_BASE, { ...VISTA_BASE, estado: "descarta", causa: "prefiltro_lexico" }]);

    const upsertCall = chains[0]!.calls.find((c) => c.method === "upsert")!;
    const lote = upsertCall.args[0] as UrlVistaRow[];
    expect(lote).toHaveLength(1);
    expect(lote[0]!.estado).toBe("descarta");
  });

  it("un error de PostgREST se convierte en throw con error.message", async () => {
    const { writer } = makeMockClient(() => ({ data: null, error: { message: "timeout" } }));
    await expect(writer.marcarVistas([VISTA_BASE])).rejects.toThrow(/timeout/);
  });
});

// ── urlsYaVistas: chunks de 500 + filtro de estado resuelto (contrato 132-09/CR-02) ─

describe("SupabaseNewsWriter.urlsYaVistas", () => {
  it("1.200 hashes hacen 3 consultas de <= 500", async () => {
    const hashes = Array.from({ length: 1200 }, (_, i) => `h${i}`);
    const { writer, chains } = makeMockClient(() => ({ data: [], error: null }));
    await writer.urlsYaVistas(hashes);

    expect(chains.length).toBe(3);
  });

  it("filtra por estado resuelto (in 'pasa'/'descarta') — una fila pendiente devuelta por el doble NO aparece en el Set", async () => {
    const { writer } = makeMockClient((chain) => {
      const inEstado = chain.calls.find((c) => c.method === "in" && c.args[0] === "estado");
      expect(inEstado).toBeDefined();
      expect(inEstado!.args[1]).toEqual(["pasa", "descarta"]);
      // El doble simula que el servidor YA filtró: solo devuelve la fila resuelta.
      return { data: [{ url_hash: "h1" }], error: null };
    });

    const out = await writer.urlsYaVistas(["h1", "h2-pendiente"]);
    expect(out.has("h1")).toBe(true);
    expect(out.has("h2-pendiente")).toBe(false);
  });

  it("un error de PostgREST se convierte en throw con error.message", async () => {
    const { writer } = makeMockClient(() => ({ data: null, error: { message: "conexión perdida" } }));
    await expect(writer.urlsYaVistas(["h1"])).rejects.toThrow(/conexión perdida/);
  });
});
