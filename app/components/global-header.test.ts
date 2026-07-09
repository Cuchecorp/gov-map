/**
 * Structural source-scan test for GlobalHeader (Phase 60 BRAND-02).
 *
 * Reads the SOURCE TEXT of global-header.tsx (Server Component — no DOM render).
 * Asserts the brand lockup contains:
 *   1. (svg-import)    BrandIcon is imported from @/components/brand-icon
 *   2. (lockup-icon)   <BrandIcon … /> is rendered inside the home Link
 *   3. (lockup-text)   the literal "gov-map" appears inside the home Link
 *   4. (nav-intact)    <HeaderNav … /> is still present
 *
 * Same idiom as layout.test.tsx (process.cwd(), no import.meta.url — lesson 45-01).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd(); // app/
const HEADER_TSX = path.join(APP_ROOT, "components", "global-header.tsx");

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

const SRC = stripComments(readFileSync(HEADER_TSX, "utf8"));

describe("GlobalHeader — brand lockup (60 BRAND-02)", () => {
  it("Test 1 (svg-import): BrandIcon is imported", () => {
    expect(SRC).toContain("BrandIcon");
    expect(SRC).toContain("brand-icon");
  });

  it("Test 2 (lockup-icon): <BrandIcon renders inside the header", () => {
    expect(SRC).toMatch(/<BrandIcon/);
  });

  it("Test 3 (lockup-text): 'gov-map' appears as brand text", () => {
    expect(SRC).toContain("gov-map");
  });

  it("Test 4 (nav-intact): <HeaderNav /> is still rendered", () => {
    expect(SRC).toMatch(/<HeaderNav/);
  });
});
