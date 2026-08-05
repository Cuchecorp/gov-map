// fixtures.test.ts — test real (corre en CI, CERO red): verifica que el número de fixtures
// capturados por probe-feeds.ts coincide con FEEDS.length, y que existe un fixture por slug.
// Sin este test, el N de fixtures (132-VALIDATION.md §N) y FEEDS.length podrían divergir en
// silencio.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FEEDS } from "./feeds";
import { parseRss } from "./parse-rss";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "__fixtures__");

/** IN-06 (132-11): fixtures recortados a mano (F-9) — deben llevar la marca visible en
 * el propio archivo, no solo constar en un comentario de test. */
const RECORTADOS = new Set(["latercera", "lacuarta"]);

describe("fixtures __fixtures__/*.xml", () => {
  it("FEEDS.length === nº de archivos .xml en __fixtures__", () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".xml"));
    expect(files.length).toBe(FEEDS.length);
  });

  for (const f of FEEDS) {
    it(`existe __fixtures__/${f.slug}.xml`, () => {
      const files = readdirSync(FIXTURES_DIR);
      expect(files).toContain(`${f.slug}.xml`);
    });
  }

  // IN-06: cada fixture se parsea DE VERDAD (no solo se cuenta/nombra) — un fixture
  // recortado a mano que quedó sin `</channel>` cae acá, no en la próxima corrida real.
  for (const f of FEEDS) {
    it(`${f.slug}.xml parsea como RSS válido: items > 0 y errores == []`, () => {
      const xml = readFileSync(join(FIXTURES_DIR, `${f.slug}.xml`), "utf8");
      const { items, errores } = parseRss(xml, f.slug);
      expect(errores).toEqual([]);
      expect(items.length).toBeGreaterThan(0);
    });
  }

  for (const slug of RECORTADOS) {
    it(`__fixtures__/${slug}.xml lleva la marca visible de recorte (F-9)`, () => {
      const xml = readFileSync(join(FIXTURES_DIR, `${slug}.xml`), "utf8");
      expect(xml).toContain("recortado a 20 ítems, F-9");
    });
  }
});
