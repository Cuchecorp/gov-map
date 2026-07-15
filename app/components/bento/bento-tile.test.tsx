/**
 * RTL tests for BentoTile (Phase 76-01, SC2).
 *
 * Asserts cva variant/span classes, asChild polymorphism,
 * focus-visible + min-h-11, and zero hex in source.
 * NEVER uses getComputedStyle — jsdom does not compute layout.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { BentoTile } from "./bento-tile";

afterEach(cleanup);

// Source-scan for hex literals (soft check — formal candado Phase 80)
const APP_ROOT = process.cwd();
const TILE_SRC = readFileSync(
  path.join(APP_ROOT, "components", "bento", "bento-tile.tsx"),
  "utf8"
);

describe("BentoTile — variants default/accent + span (76-01 SC2)", () => {
  it("variant=default → clases bg-card, border-border, rounded-[--radius-tile]", () => {
    const { container } = render(<BentoTile variant="default">content</BentoTile>);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("bg-card");
    expect(tile).toHaveClass("border-border");
    expect(tile).toHaveClass("rounded-[--radius-tile]");
  });

  it("variant=accent → clase bg-accent-product", () => {
    const { container } = render(<BentoTile variant="accent">content</BentoTile>);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("bg-accent-product");
  });

  it("span={4} → clase md:col-span-4", () => {
    const { container } = render(<BentoTile span={4}>content</BentoTile>);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("md:col-span-4");
  });

  it("span={2} → clase md:col-span-2", () => {
    const { container } = render(<BentoTile span={2}>content</BentoTile>);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("md:col-span-2");
  });

  it("span={6} → clase md:col-span-6", () => {
    const { container } = render(<BentoTile span={6}>content</BentoTile>);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("md:col-span-6");
  });

  it("defaultVariants: sin props → aplica variant=default + span=2", () => {
    const { container } = render(<BentoTile>content</BentoTile>);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("bg-card");
    expect(tile).toHaveClass("md:col-span-2");
  });

  it("tile interactivo (asChild + <a>) tiene focus-visible ring + min-h-11", () => {
    render(
      <BentoTile asChild>
        <a href="/test">link tile</a>
      </BentoTile>
    );
    const link = screen.getByRole("link", { name: "link tile" });
    expect(link).toHaveClass("focus-visible:ring-2");
    expect(link).toHaveClass("min-h-11");
  });

  it("(soft) source de bento-tile.tsx NO contiene literal hex #RRGGBB", () => {
    expect(TILE_SRC).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
