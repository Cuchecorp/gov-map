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
});
