// fixtures.test.ts — test real (corre en CI, CERO red): verifica que el número de fixtures
// capturados por probe-feeds.ts coincide con FEEDS.length, y que existe un fixture por slug.
// Sin este test, el N de fixtures (132-VALIDATION.md §N) y FEEDS.length podrían divergir en
// silencio.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FEEDS } from "./feeds";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "__fixtures__");

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
});
