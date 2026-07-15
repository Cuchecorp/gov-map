/**
 * RTL tests for BentoGrid (Phase 76-01, SC2).
 *
 * Asserts structural classes and DOM child order.
 * NEVER uses getComputedStyle — jsdom does not compute grid layout (Pitfall 5).
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { BentoGrid } from "./bento-grid";

afterEach(cleanup);

describe("BentoGrid — grid 6-col colapsable (76-01 SC2)", () => {
  it("wrapper tiene clase md:grid-cols-6", () => {
    const { container } = render(<BentoGrid>child</BentoGrid>);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("md:grid-cols-6");
  });

  it("wrapper tiene clase gap-[14px] (arbitrary off-step intencional del mockup)", () => {
    const { container } = render(<BentoGrid>child</BentoGrid>);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("gap-[14px]");
  });

  it("wrapper tiene clase grid-cols-1 (colapso móvil por defecto)", () => {
    const { container } = render(<BentoGrid>child</BentoGrid>);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("grid-cols-1");
  });

  it("children se preservan en orden DOM", () => {
    render(
      <BentoGrid>
        <div data-testid="hijo-1">A</div>
        <div data-testid="hijo-2">B</div>
        <div data-testid="hijo-3">C</div>
      </BentoGrid>
    );
    const hijos = screen.getAllByTestId(/hijo-/);
    expect(hijos).toHaveLength(3);
    expect(hijos[0]).toHaveAttribute("data-testid", "hijo-1");
    expect(hijos[1]).toHaveAttribute("data-testid", "hijo-2");
    expect(hijos[2]).toHaveAttribute("data-testid", "hijo-3");
  });

  it("acepta className extra (merge con cn)", () => {
    const { container } = render(<BentoGrid className="custom-class">child</BentoGrid>);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-class");
    expect(wrapper).toHaveClass("md:grid-cols-6");
  });
});
