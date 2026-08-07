import { describe, it, expect } from "vitest";
import { construirPool, PoolCasoSchema, type PoblacionRow, type SnapshotCrudo } from "./pool-r2";
import { urlHash } from "../canonicalizar-url";

/** RSS mínimo pero válido para `parseRss` — un `<item>` por entrada. */
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

describe("construirPool", () => {
  it("(a) une por url_hash y devuelve un caso por hash", async () => {
    const link = "https://www.latercera.com/noticia-a";
    const hash = await urlHash(link);
    const snapshots: SnapshotCrudo[] = [
      {
        r2Path: "news/rss-latercera/2026-08-05/x.xml",
        dateBucket: "2026-08-05",
        outlet: "latercera",
        xml: rss([{ titulo: "Titular A", link, descripcion: "Bajada A" }]),
      },
    ];
    const poblacion: PoblacionRow[] = [
      { url_hash: hash, url_canonica: link, outlet: "latercera", estado: "pasa", causa: null },
    ];
    const r = await construirPool({ snapshots, poblacion });
    expect(r.casos).toHaveLength(1);
    expect(r.faltantes).toHaveLength(0);
    expect(r.sobrantes).toHaveLength(0);
    expect(r.tasaReconstruccion).toBe(1);
    expect(r.casos[0].url_hash).toBe(hash);
    expect(r.casos[0].titulo).toBe("Titular A");
  });

  it("(b) hash en DB sin contraparte en R2 ⇒ entra en faltantes, NO se omite", async () => {
    const snapshots: SnapshotCrudo[] = [];
    const poblacion: PoblacionRow[] = [
      {
        url_hash: "hash-sin-crudo",
        url_canonica: "https://www.latercera.com/no-existe-en-r2",
        outlet: "latercera",
        estado: "pasa",
        causa: null,
      },
    ];
    const r = await construirPool({ snapshots, poblacion });
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0].url_hash).toBe("hash-sin-crudo");
    expect(r.casos).toHaveLength(0);
  });

  it("(c) hash en R2 sin contraparte en DB ⇒ entra en sobrantes", async () => {
    const link = "https://www.latercera.com/sobrante";
    const hash = await urlHash(link);
    const snapshots: SnapshotCrudo[] = [
      {
        r2Path: "news/rss-latercera/2026-08-05/x.xml",
        dateBucket: "2026-08-05",
        outlet: "latercera",
        xml: rss([{ titulo: "Sobrante", link }]),
      },
    ];
    // Población con OTRO hash — el de arriba no tiene contraparte.
    const poblacion: PoblacionRow[] = [
      {
        url_hash: "otro-hash-cualquiera",
        url_canonica: "https://www.latercera.com/otra",
        outlet: "latercera",
        estado: "pasa",
        causa: null,
      },
    ];
    const r = await construirPool({ snapshots, poblacion });
    expect(r.sobrantes).toHaveLength(1);
    expect(r.sobrantes[0].url_hash).toBe(hash);
    expect(r.faltantes).toHaveLength(1);
  });

  it("(d) población vacía ⇒ LANZA", async () => {
    await expect(construirPool({ snapshots: [], poblacion: [] })).rejects.toThrow();
  });

  it("(e) el mismo url_hash en dos date_bucket colapsa a UN caso y conserva el date_bucket más antiguo", async () => {
    const link = "https://www.latercera.com/repetida";
    const hash = await urlHash(link);
    const snapshots: SnapshotCrudo[] = [
      {
        r2Path: "news/rss-latercera/2026-08-06/x.xml",
        dateBucket: "2026-08-06",
        outlet: "latercera",
        xml: rss([{ titulo: "Repetida día 2", link }]),
      },
      {
        r2Path: "news/rss-latercera/2026-08-05/y.xml",
        dateBucket: "2026-08-05",
        outlet: "latercera",
        xml: rss([{ titulo: "Repetida día 1", link }]),
      },
    ];
    const poblacion: PoblacionRow[] = [
      { url_hash: hash, url_canonica: link, outlet: "latercera", estado: "pasa", causa: null },
    ];
    const r = await construirPool({ snapshots, poblacion });
    expect(r.casos).toHaveLength(1);
    expect(r.casos[0].date_bucket).toBe("2026-08-05");
    expect(r.casos[0].titulo).toBe("Repetida día 1");
  });

  it("(f) el hash se recalcula con urlHash real: dos links que difieren solo en utm_* colapsan", async () => {
    const linkA = "https://www.latercera.com/con-utm?utm_source=twitter";
    const linkB = "https://www.latercera.com/con-utm";
    const hashCanonico = await urlHash(linkA);
    expect(hashCanonico).toBe(await urlHash(linkB));

    const snapshots: SnapshotCrudo[] = [
      {
        r2Path: "news/rss-latercera/2026-08-05/x.xml",
        dateBucket: "2026-08-05",
        outlet: "latercera",
        xml: rss([{ titulo: "Con utm", link: linkA }]),
      },
    ];
    const poblacion: PoblacionRow[] = [
      { url_hash: hashCanonico, url_canonica: linkB, outlet: "latercera", estado: "pasa", causa: null },
    ];
    const r = await construirPool({ snapshots, poblacion });
    expect(r.casos).toHaveLength(1);
    expect(r.faltantes).toHaveLength(0);
    expect(r.sobrantes).toHaveLength(0);
  });

  it("(g) PoolCasoSchema es .strict(): campo extra ⇒ falla", () => {
    const base = {
      caso_id: "latercera:abc123",
      url_hash: "a".repeat(64),
      url_canonica: "https://www.latercera.com/x",
      outlet: "latercera",
      estado: "pasa",
      causa: null,
      titulo: "T",
      descripcion: "D",
      fecha_pub: null,
      r2_path: "news/rss-latercera/2026-08-05/x.xml",
      date_bucket: "2026-08-05",
    };
    expect(PoolCasoSchema.safeParse(base).success).toBe(true);
    expect(PoolCasoSchema.safeParse({ ...base, campoExtra: "no debería existir" }).success).toBe(
      false,
    );
  });
});
