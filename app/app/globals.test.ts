/**
 * Source-scan tests for globals.css (Phase 76-01, SC1).
 *
 * Reads globals.css as text and asserts structural presence of:
 *   1. --radius-tile: 16px  (new token, bento tiles)
 *   2. --radius-control: 11px  (new token, bento controls)
 *   3. --radius: 0.5rem  (shadcn — INTACTO, D4 LOCKED)
 *   4. scroll-margin-top  (global anchor rule vs sticky header)
 *
 * Same idiom as global-header.test.ts (process.cwd(), NO import.meta.url — lesson 45-01).
 * stripComments removes CSS block comments — assert TOKEN LINES that survive, not comment text.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd(); // app/
const GLOBALS_CSS = path.join(APP_ROOT, "app", "globals.css");

function stripComments(content: string): string {
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.search(/(?<!:)\/\//);
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

const SRC = stripComments(readFileSync(GLOBALS_CSS, "utf8"));

describe("globals.css — tokens de radio + scroll-mt (76-01 SC1)", () => {
  it("Test 1 (radius-tile): --radius-tile: 16px está definido", () => {
    expect(SRC).toContain("--radius-tile: 16px");
  });

  it("Test 2 (radius-control): --radius-control: 11px está definido", () => {
    expect(SRC).toContain("--radius-control: 11px");
  });

  it("Test 3 (radius-shadcn): --radius: 0.5rem está INTACTO (D4 LOCKED)", () => {
    expect(SRC).toContain("--radius: 0.5rem");
  });

  it("Test 4 (scroll-margin-top): regla global de anchors vs sticky header", () => {
    expect(SRC).toContain("scroll-margin-top");
  });

  it("Test 4b (selector de anchors): cubre TODO [id], no solo headings (gate 81 — fichas anclan en <section id>)", () => {
    expect(SRC).toContain(":where([id])");
    expect(SRC).not.toMatch(/:where\(h1, h2, h3\)\[id\]/);
  });
});

describe("globals.css — tokens accent-foreground + bento-accent-fill (77-01)", () => {
  it("Test 5 (accent-product-foreground value): triple HSL correcto presente", () => {
    expect(SRC).toContain("--accent-product-foreground: 183 30% 96%");
  });

  it("Test 6 (bento-accent-fill value): triple HSL petróleo presente", () => {
    expect(SRC).toContain("--bento-accent-fill: 183 38% 26%");
  });

  it("Test 7 (accent-product-foreground en :root Y .dark): token dark-stable aparece ≥2 veces", () => {
    // Raw source (sin stripComments) para contar ocurrencias en ambos bloques
    const raw = readFileSync(GLOBALS_CSS, "utf8");
    const matches = raw.match(/--accent-product-foreground:/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("Test 8 (bento-accent-fill en :root Y .dark): token dark-stable aparece ≥2 veces", () => {
    const raw = readFileSync(GLOBALS_CSS, "utf8");
    const matches = raw.match(/--bento-accent-fill:/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
