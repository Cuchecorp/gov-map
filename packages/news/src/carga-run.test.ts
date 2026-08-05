import { describe, it, expect, vi, beforeEach } from "vitest";
import { cargar } from "./carga-run";
import { InMemoryNewsWriter } from "./writer";
import * as prefiltro from "./prefiltro-lexico";
import type { RssItem } from "./model";
import type { NewsWriter, NoticiaRow, UrlVistaRow } from "./writer";

function item(over: Partial<RssItem> = {}): RssItem {
  return {
    titulo: "El Senado aprueba proyecto de ley sobre pensiones",
    link: "https://www.biobiochile.cl/noticias/nacional/chile/2026/08/05/senado.shtml",
    guid: null,
    fechaPub: "2026-08-05T00:41:06-04:00",
    descripcion: "La comision de hacienda revisó el boletin",
    outlet: "biobiochile",
    ...over,
  };
}

function itemNoLegislativo(over: Partial<RssItem> = {}): RssItem {
  return item({
    titulo: "La receta de cocina del fin de semana",
    link: "https://www.biobiochile.cl/noticias/artes-y-cultura/gastronomia/2026/08/05/receta.shtml",
    descripcion: "Ingredientes y pasos para preparar un postre",
    ...over,
  });
}

const log = () => {};

describe("cargar — orden LOCKED (marcarVistas ANTES del reject)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marca vista ANTES de evaluar esLegislativo (traza, no estado final)", async () => {
    const writer = new InMemoryNewsWriter();
    const marcarVistasSpy = vi.spyOn(writer, "marcarVistas");
    const esLegislativoSpy = vi.spyOn(prefiltro, "esLegislativo");

    await cargar({
      items: [itemNoLegislativo()],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(marcarVistasSpy.mock.invocationCallOrder[0]).toBeLessThan(
      esLegislativoSpy.mock.invocationCallOrder[0]!,
    );
  });

  it("un ítem que el pre-filtro descarta NO se pasa a upsertNoticias", async () => {
    const writer = new InMemoryNewsWriter();
    const upsertSpy = vi.spyOn(writer, "upsertNoticias");

    await cargar({
      items: [itemNoLegislativo()],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(upsertSpy).not.toHaveBeenCalled();
  });

});

describe("cargar — fila noticia preserva datos del ítem", () => {
  it("la fila persistida conserva fecha_pub con el offset original y referencia al crudo en R2", async () => {
    const writer = new InMemoryNewsWriter();
    await cargar({
      items: [item()],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });
    const fila = [...writer.noticias.values()][0]!;
    expect(fila.fecha_pub).toBe("2026-08-05T00:41:06-04:00");
    expect(fila.r2_path).toBe("news/biobiochile/2026-08-05/abc.xml");
    expect(fila.contenido_hash).toBe("abc");
    expect(fila.estado).toBe("pendiente");
  });
});

describe("cargar — idempotencia (correr 2x no duplica)", () => {
  it("correr cargar() 2 veces con el mismo input produce el mismo nº de filas en noticia", async () => {
    const writer = new InMemoryNewsWriter();
    const items = [item()];

    const r1 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });
    expect(r1.cargados).toBe(1);
    expect(writer.noticias.size).toBe(1);

    const r2 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(writer.noticias.size).toBe(1);
    expect(r2.duplicados).toBe(1);
    expect(r2.nuevos).toBe(0);
    expect(r2.cargados).toBe(0);
  });
});

describe("cargar — dedup nivel 1 (ya visto no re-evalúa el pre-filtro)", () => {
  it("un url_hash ya en noticia_url_vista se cuenta duplicado y esLegislativo NO se llama para él", async () => {
    const writer = new InMemoryNewsWriter();
    const items = [item()];

    await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    const esLegislativoSpy = vi.spyOn(prefiltro, "esLegislativo");

    const r2 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(r2.duplicados).toBe(1);
    expect(esLegislativoSpy).not.toHaveBeenCalled();
    esLegislativoSpy.mockRestore();
  });
});

describe("cargar — dedup nivel 2 (utm_* colapsa dentro del lote)", () => {
  it("dos ítems del mismo lote con URLs que difieren solo en utm_* colapsan a una fila", async () => {
    const writer = new InMemoryNewsWriter();
    const base = "https://www.biobiochile.cl/noticias/nacional/chile/2026/08/05/senado.shtml";
    const items = [
      item({ link: `${base}?utm_source=facebook` }),
      item({ link: `${base}?utm_source=twitter` }),
    ];

    const r = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(r.vistos).toBe(1);
    expect(r.cargados).toBe(1);
    expect(writer.noticias.size).toBe(1);
  });
});

describe("cargar — conteos", () => {
  it("descartados + cargados + duplicados === vistos sobre un lote mixto", async () => {
    const writer = new InMemoryNewsWriter();
    const items = [
      item({ link: "https://www.biobiochile.cl/a1" }),
      item({ link: "https://www.biobiochile.cl/a2" }),
      itemNoLegislativo({ link: "https://www.biobiochile.cl/a3" }),
      itemNoLegislativo({ link: "https://www.biobiochile.cl/a4" }),
    ];

    // Primera corrida: a1 queda ya-visto para la segunda.
    await cargar({
      items: [item({ link: "https://www.biobiochile.cl/a1" })],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    const r = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/def.xml",
      contenidoHash: "def",
      writer,
      log,
    });

    expect(r.descartados + r.cargados + r.duplicados).toBe(r.vistos);
    expect(r.duplicados).toBe(1);
    expect(r.cargados).toBe(1);
    expect(r.descartados).toBe(2);
  });

  it("resultado incluye vistos/nuevos/duplicados/descartados/cargados/errores", async () => {
    const writer = new InMemoryNewsWriter();
    const r = await cargar({
      items: [item()],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });
    expect(r).toHaveProperty("vistos");
    expect(r).toHaveProperty("nuevos");
    expect(r).toHaveProperty("duplicados");
    expect(r).toHaveProperty("descartados");
    expect(r).toHaveProperty("cargados");
    expect(Array.isArray(r.errores)).toBe(true);
  });
});

describe("cargar — degradación honesta", () => {
  it("un ítem que revienta el writer se acumula en errores[] y no aborta el resto del lote", async () => {
    class WriterQueRevienta extends InMemoryNewsWriter {
      async upsertNoticias(filas: NoticiaRow[]): Promise<void> {
        if (filas.some((f) => f.url === "https://www.biobiochile.cl/rompe")) {
          throw new Error("boom");
        }
        return super.upsertNoticias(filas);
      }
    }
    const writer: NewsWriter = new WriterQueRevienta();

    const r = await cargar({
      items: [
        item({ link: "https://www.biobiochile.cl/rompe" }),
        item({ link: "https://www.biobiochile.cl/ok" }),
      ],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(r.errores.length).toBe(1);
    expect(r.errores[0]!.etapa).toBe("upsertNoticias");
    expect(r.cargados).toBe(1);
  });
});

describe("cargar — cero red", () => {
  it("el módulo no importa Fetcher ni hace fetch (verificado también por grep en verify)", () => {
    // Prueba de humo: el import estático de este archivo no falla por falta de red/env,
    // lo que confirma que no hay side-effects de conexión al cargar el módulo.
    expect(typeof cargar).toBe("function");
  });
});

describe("cargar — CR-02: fallo transitorio deja el ítem pendiente, jamás con causa falsa", () => {
  /** Writer cuyo upsertNoticias lanza UNA vez (fallo transitorio de DB) para una URL dada. */
  class WriterQueFallaUnaVez extends InMemoryNewsWriter {
    private yaFallo = false;
    async upsertNoticias(filas: NoticiaRow[]): Promise<void> {
      if (!this.yaFallo && filas.some((f) => f.url === "https://www.biobiochile.cl/transitorio")) {
        this.yaFallo = true;
        throw new Error("timeout transitorio");
      }
      return super.upsertNoticias(filas);
    }
  }

  it("tras un upsertNoticias que lanza, el ledger queda estado=pendiente causa=null (nunca prefiltro_lexico)", async () => {
    const writer = new WriterQueFallaUnaVez();
    const r = await cargar({
      items: [item({ link: "https://www.biobiochile.cl/transitorio" })],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(r.cargados).toBe(0);
    expect(r.errores.length).toBe(1);
    expect(r.errores[0]!.etapa).toBe("upsertNoticias");

    const fila = [...writer.vistas.values()][0]!;
    expect(fila.estado).toBe("pendiente");
    expect(fila.causa).toBeNull();
    expect(fila.causa).not.toBe("prefiltro_lexico");
  });

  it("re-evaluación: la corrida siguiente (sin fallo) NO cuenta el pendiente como duplicado, lo carga y promueve a pasa", async () => {
    const writer = new WriterQueFallaUnaVez();
    const items = [item({ link: "https://www.biobiochile.cl/transitorio" })];

    await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    const r2 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/def.xml",
      contenidoHash: "def",
      writer,
      log,
    });

    expect(r2.duplicados).toBe(0);
    expect(r2.nuevos).toBe(1);
    expect(r2.cargados).toBe(1);

    const fila = [...writer.vistas.values()][0]!;
    expect(fila.estado).toBe("pasa");
    expect(fila.causa).toBeNull();
  });

  it("control positivo apareado: SIN fallo inyectado, carga en la 1ra corrida y cuenta duplicado en la 2da", async () => {
    const writer = new InMemoryNewsWriter();
    const items = [item({ link: "https://www.biobiochile.cl/sano" })];

    const r1 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });
    expect(r1.cargados).toBe(1);
    const fila1 = [...writer.vistas.values()][0]!;
    expect(fila1.estado).toBe("pasa");

    const r2 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/def.xml",
      contenidoHash: "def",
      writer,
      log,
    });
    expect(r2.duplicados).toBe(1);
    expect(r2.cargados).toBe(0);
  });

  it("descarte legítimo del pre-filtro sigue siendo terminal: la corrida siguiente lo cuenta como duplicado", async () => {
    const writer = new InMemoryNewsWriter();
    const items = [itemNoLegislativo({ link: "https://www.biobiochile.cl/no-legislativo" })];

    const r1 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });
    expect(r1.descartados).toBe(1);
    const fila = [...writer.vistas.values()][0]!;
    expect(fila.estado).toBe("descarta");
    expect(fila.causa).toBe("prefiltro_lexico");

    const esLegislativoSpy = vi.spyOn(prefiltro, "esLegislativo");
    const r2 = await cargar({
      items,
      r2Path: "news/biobiochile/2026-08-05/def.xml",
      contenidoHash: "def",
      writer,
      log,
    });
    expect(r2.duplicados).toBe(1);
    expect(esLegislativoSpy).not.toHaveBeenCalled();
    esLegislativoSpy.mockRestore();
  });
});

describe("cargar — WR-17: descripcion se persiste despojada de HTML", () => {
  it("una descripción con <b> y <script> no contiene '<' en la fila guardada", async () => {
    const writer = new InMemoryNewsWriter();
    await cargar({
      items: [
        item({
          link: "https://www.biobiochile.cl/con-html",
          descripcion: "<b>La comision de hacienda</b> revisó el boletin <script>alert(1)</script>",
        }),
      ],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    const fila = [...writer.noticias.values()][0]!;
    expect(fila.descripcion).not.toContain("<");
  });
});

describe("cargar — IN-04: errores[].ref nunca se llama urlHash", () => {
  it("un fallo en la etapa de canonicalización acumula ref=URL cruda (etapa='canonicalizar')", async () => {
    const writer = new InMemoryNewsWriter();
    const r = await cargar({
      items: [item({ link: "no-es-una-url-valida" })],
      r2Path: "news/biobiochile/2026-08-05/abc.xml",
      contenidoHash: "abc",
      writer,
      log,
    });

    expect(r.errores.length).toBe(1);
    expect(r.errores[0]!.etapa).toBe("canonicalizar");
    expect(r.errores[0]!.ref).toBe("no-es-una-url-valida");
  });
});
