import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRss } from "./parse-rss";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

// Conteos congelados: grep -o "<item" <fixture> | wc -l (los fixtures de latercera/
// lacuarta vienen minificados en 1 sola línea → `grep -c` cuenta 1 línea, no ítems;
// `grep -o | wc -l` es el conteo real y correcto para los 5 casos).
const CONTEO_ESPERADO: Record<string, number> = {
  biobiochile: 20,
  cooperativa: 15,
  latercera: 20, // fixture recortada a 20 (F-9, 132-01), no los 100 originales del feed vivo
  lacuarta: 20, // ídem
  exante: 10,
};

describe("parseRss — 5 fixtures reales", () => {
  for (const [slug, n] of Object.entries(CONTEO_ESPERADO)) {
    it(`${slug}: parsea ${n} ítems sin lanzar`, () => {
      const xml = leer(`${slug}.xml`);
      const { items, errores } = parseRss(xml, slug);
      expect(errores).toEqual([]);
      expect(items).toHaveLength(n);
    });

    it(`${slug}: cada ítem tiene titulo no vacío y link https`, () => {
      const xml = leer(`${slug}.xml`);
      const { items } = parseRss(xml, slug);
      for (const it of items) {
        expect(it.titulo.length).toBeGreaterThan(0);
        expect(it.link.startsWith("https://")).toBe(true);
      }
    });
  }

  it("biobiochile: guid difiere del link y el ítem conserva el link como identidad (NO guid)", () => {
    const xml = leer("biobiochile.xml");
    const { items } = parseRss(xml, "biobiochile");
    const primero = items[0];
    expect(primero.link).toBe(
      "https://www.biobiochile.cl/noticias/nacional/region-metropolitana/2026/08/05/gigantesco-incendio-en-quilicura-bomberos-acusa-que-prevencionista-de-panimex-aun-no-llega-al-lugar.shtml",
    );
    expect(primero.guid).toBe("https://www.biobiochile.cl/?p=6913066");
    expect(primero.guid).not.toBe(primero.link);
  });

  it("cooperativa: pubDate -0400 preserva el offset original (no normaliza a UTC/tz global)", () => {
    const xml = leer("cooperativa.xml");
    const { items } = parseRss(xml, "cooperativa");
    const primero = items[0];
    expect(primero.fechaPub).toBe("2026-08-05T00:41:06-04:00");
    // El instante real (verificable vía Date, sin que el string almacenado cambie)
    // es 4 horas mayor en UTC que el reloj local del feed.
    expect(new Date(primero.fechaPub as string).toISOString()).toBe(
      "2026-08-05T04:41:06.000Z",
    );
  });

  it("latercera: pubDate +0000 se conserva tal cual", () => {
    const xml = leer("latercera.xml");
    const { items } = parseRss(xml, "latercera");
    const primero = items[0];
    expect(primero.fechaPub).toBe("2026-08-05T12:26:26+00:00");
  });

  it("cooperativa: CDATA en <title> se desenvuelve al texto real", () => {
    const xml = leer("cooperativa.xml");
    const { items } = parseRss(xml, "cooperativa");
    expect(items[0].titulo).toBe(
      "Decretan suspensión de clases en Quilicura por megaincendio en zona industrial",
    );
  });

  it("biobiochile: entidades escapadas (&quot;) quedan como el carácter real", () => {
    const xml = leer("biobiochile.xml");
    const { items } = parseRss(xml, "biobiochile");
    const conComillas = items.find((i) => i.titulo.includes("Biministro Alvarado"));
    expect(conComillas).toBeDefined();
    expect(conComillas?.titulo).toContain('"');
    expect(conComillas?.titulo).not.toContain("&quot;");
  });

  it("un feed con un solo <item> (fixture sintético) devuelve 1 ítem, no revienta", () => {
    const xmlUnico = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>Único ítem legislativo de prueba</title>
  <link>https://example.cl/nota-unica</link>
  <guid>https://example.cl/nota-unica</guid>
  <pubDate>Wed, 05 Aug 2026 10:00:00 +0000</pubDate>
  <description>Descripción de prueba</description>
</item>
</channel></rss>`;
    const { items, errores } = parseRss(xmlUnico, "sintetico");
    expect(errores).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].titulo).toBe("Único ítem legislativo de prueba");
  });

  it("un XML sin <item> produce [] (no lanza)", () => {
    const xmlVacio = `<?xml version="1.0"?><rss version="2.0"><channel><title>Vacío</title></channel></rss>`;
    const { items, errores } = parseRss(xmlVacio, "vacio");
    expect(items).toEqual([]);
    expect(errores).toEqual([]);
  });

  it("un XML mal formado lanza un error tipado", () => {
    // fast-xml-parser tolera etiquetas sin cerrar (las colapsa), pero un atributo
    // con la comilla sin cerrar SÍ lo hace lanzar (verificado contra la librería real).
    const xmlRoto = `<rss version="2.0"`;
    expect(() => parseRss(xmlRoto, "roto")).toThrow();
  });

  // ── Mutaciones obligatorias (ejecutadas manualmente y revertidas — ver SUMMARY) ──
  // (1) quitar [].concat que fuerza array ⇒ cae "un solo <item> devuelve 1 ítem"
  // (2) normalizar pubDate a una tz fija ⇒ cae "cooperativa -0400 preserva el offset"
  // (3) usar guid como identidad en vez de link ⇒ cae "biobiochile: guid difiere del link"
});

function itemUnico(pubDate: string): string {
  return `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>Ítem de prueba pubDate</title>
  <link>https://example.cl/nota-pubdate</link>
  <guid>https://example.cl/nota-pubdate</guid>
  <pubDate>${pubDate}</pubDate>
  <description>Descripción de prueba</description>
</item>
</channel></rss>`;
}

describe("parseRss — pubDate: variantes RFC 822 (WR-12)", () => {
  it("hora de 1 dígito sin segundos preserva el offset original", () => {
    const { items, errores } = parseRss(itemUnico("Wed, 5 Aug 2026 7:41 -0400"), "t");
    expect(errores).toEqual([]);
    expect(items[0]!.fechaPub).toBe("2026-08-05T07:41:00-04:00");
  });

  it("sin día de la semana, con segundos, offset +0000", () => {
    const { items, errores } = parseRss(itemUnico("05 Aug 2026 00:41:06 +0000"), "t");
    expect(errores).toEqual([]);
    expect(items[0]!.fechaPub).toBe("2026-08-05T00:41:06+00:00");
  });

  it("no-regresión: con día de semana + GMT sigue parseando (ya soportado)", () => {
    const { items, errores } = parseRss(itemUnico("Wed, 05 Aug 2026 00:41:06 GMT"), "t");
    expect(errores).toEqual([]);
    expect(items[0]!.fechaPub).toBe("2026-08-05T00:41:06+00:00");
  });

  it.each([
    ["EST", "-05:00"],
    ["EDT", "-04:00"],
    ["CST", "-06:00"],
    ["CDT", "-05:00"],
    ["MST", "-07:00"],
    ["MDT", "-06:00"],
    ["PST", "-08:00"],
    ["PDT", "-07:00"],
  ])("zona nombrada %s se mapea a su offset fijo %s", (zona, offsetEsperado) => {
    const { items, errores } = parseRss(itemUnico(`Wed, 05 Aug 2026 00:41:06 ${zona}`), "t");
    expect(errores).toEqual([]);
    expect(items[0]!.fechaPub).toBe(`2026-08-05T00:41:06${offsetEsperado}`);
  });

  it("ANTI-NORMALIZACIÓN (gotcha rector v9.0/v12.0): el offset -0400 nunca se convierte a Z", () => {
    const { items } = parseRss(itemUnico("Wed, 5 Aug 2026 7:41 -0400"), "t");
    expect(items[0]!.fechaPub).not.toMatch(/Z$/);
    expect(items[0]!.fechaPub).toBe("2026-08-05T07:41:00-04:00");
  });

  it("pubDate presente pero NO parseable ⇒ fechaPub null Y queda registrado en errores[] con el crudo", () => {
    const { items, errores } = parseRss(itemUnico("no es una fecha RFC 822"), "t");
    expect(items[0]!.fechaPub).toBeNull();
    expect(errores.length).toBeGreaterThanOrEqual(1);
    expect(errores.some((e) => e.includes("no es una fecha RFC 822"))).toBe(true);
  });

  it("control apareado: pubDate AUSENTE ⇒ fechaPub null y CERO entradas en errores[] (no es un error)", () => {
    const xmlSinPubDate = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>Ítem sin pubDate</title>
  <link>https://example.cl/nota-sin-pubdate</link>
  <guid>https://example.cl/nota-sin-pubdate</guid>
  <description>Descripción de prueba</description>
</item>
</channel></rss>`;
    const { items, errores } = parseRss(xmlSinPubDate, "t");
    expect(items[0]!.fechaPub).toBeNull();
    expect(errores).toEqual([]);
  });
});
