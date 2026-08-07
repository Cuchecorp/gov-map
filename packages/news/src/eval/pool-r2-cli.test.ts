import { describe, it, expect } from "vitest";
import { R2Store } from "@obs/ingest";
import { urlHash } from "../canonicalizar-url";
import { reconstruirPool, type SupabaseLike } from "./pool-r2-cli";

function rss(items: { titulo: string; link: string; descripcion?: string }[]): string {
  const cuerpo = items
    .map(
      (it) =>
        `<item><title>${it.titulo}</title><link>${it.link}</link>` +
        (it.descripcion != null ? `<description>${it.descripcion}</description>` : "") +
        `</item>`,
    )
    .join("");
  return `<?xml version="1.0"?><rss version="2.0"><channel>${cuerpo}</channel></rss>`;
}

/** Doble estructural de supabase-js: `source_snapshot` usa `.eq().order().range()`,
 * `noticia_url_vista` usa `.order().range()` directo (sin `.eq()`, espejo del CLI real). */
function supabaseDouble(snapshotRows: unknown[], poblacionRows: unknown[]): SupabaseLike {
  return {
    from(tabla: string) {
      if (tabla === "source_snapshot") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      range: async () => ({ data: snapshotRows, error: null }),
                    };
                  },
                };
              },
              order() {
                throw new Error("source_snapshot: no debería llamarse sin .eq() primero");
              },
            };
          },
        };
      }
      if (tabla === "noticia_url_vista") {
        return {
          select() {
            return {
              order() {
                return {
                  range: async () => ({ data: poblacionRows, error: null }),
                };
              },
              eq() {
                throw new Error("noticia_url_vista: no debería llamarse con .eq()");
              },
            };
          },
        };
      }
      throw new Error(`tabla no esperada: ${tabla}`);
    },
  } as unknown as SupabaseLike;
}

/** R2Store real con `fetchFn` inyectado (SIN red real, T-133-35) — sirve el XML pedido según
 * el `r2Path` codificado en la URL firmada. */
function r2StoreDoble(porPath: Record<string, string>): R2Store {
  const fetchFn: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const path = Object.keys(porPath).find((p) => url.includes(p));
    if (!path) return new Response("not found", { status: 404 });
    return new Response(porPath[path], { status: 200 });
  };
  return new R2Store(
    { accessKeyId: "x", secretAccessKey: "y", endpoint: "https://r2.example.com", bucket: "bucket-test" },
    { fetchFn },
  );
}

describe("reconstruirPool (pool-r2-cli)", () => {
  it("(a) el CLI rechaza un r2Path que no matchea R2_PATH_RE", async () => {
    const supabase = supabaseDouble(
      [{ r2_path: "otra-fuente/rss-latercera/2026-08-05/x.xml", resource: "rss-latercera", date_bucket: "2026-08-05" }],
      [],
    );
    const r2Store = r2StoreDoble({});
    await expect(
      reconstruirPool({ r2Store, supabase, log: () => {} }),
    ).rejects.toThrow(/R2_PATH_RE/);
  });

  it("(b) con R2Store inyectado (fetch doble) produce el pool sin red real", async () => {
    const link = "https://www.latercera.com/noticia-cli";
    const hash = await urlHash(link);
    const path = "news/rss-latercera/2026-08-05/" + "a".repeat(64) + ".xml";
    const supabase = supabaseDouble(
      [{ r2_path: path, resource: "rss-latercera", date_bucket: "2026-08-05" }],
      [{ url_hash: hash, url_canonica: link, outlet: "latercera", estado: "pasa", causa: null }],
    );
    const r2Store = r2StoreDoble({ [path]: rss([{ titulo: "Titular CLI", link }]) });

    const r = await reconstruirPool({ r2Store, supabase, log: () => {} });
    expect(r.casos).toHaveLength(1);
    expect(r.tasaReconstruccion).toBe(1);
    expect(r.faltantes).toHaveLength(0);
    expect(r.sobrantes).toHaveLength(0);
  });

  it("(c) el CLI FALLA si la tasa de reconstrucción < 1,0 (fail-closed)", async () => {
    const path = "news/rss-latercera/2026-08-05/" + "b".repeat(64) + ".xml";
    const supabase = supabaseDouble(
      [{ r2_path: path, resource: "rss-latercera", date_bucket: "2026-08-05" }],
      [
        {
          url_hash: "hash-que-no-esta-en-el-crudo",
          url_canonica: "https://www.latercera.com/no-esta",
          outlet: "latercera",
          estado: "pasa",
          causa: null,
        },
      ],
    );
    const r2Store = r2StoreDoble({
      [path]: rss([{ titulo: "Otra noticia", link: "https://www.latercera.com/otra-distinta" }]),
    });

    await expect(reconstruirPool({ r2Store, supabase, log: () => {} })).rejects.toThrow(
      /reconstrucción parcial/,
    );
  });
});
