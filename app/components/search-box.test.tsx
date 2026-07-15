import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Tests RTL de <SearchBox> (54-04 Contract 5a, Wave 0 gap de 54-RESEARCH
 * §Validation Architecture).
 *
 * Contrato: el botón submit de la rama NO-hero (`variant="default"`, la barra
 * persistente de /buscar) usa el token petróleo del design system
 * (`bg-accent-product`) como acción primaria; la rama hero queda byte-identical
 * (CTA petróleo "Buscar proyectos" con font-semibold, intacto).
 *
 * `useRouter` se mockea (misma técnica que el repo usa para next/navigation).
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { SearchBox } from "./search-box";

afterEach(cleanup);

describe("SearchBox — Contract 5a: botón no-hero al token petróleo", () => {
  it("la rama default (no-hero) usa bg-accent-product y label 'Buscar'", () => {
    render(<SearchBox />);
    const boton = screen.getByRole("button", { name: "Buscar" });
    expect(boton.className).toContain("bg-accent-product");
    expect(boton.className).toContain("text-background");
    expect(boton.className).toContain("hover:bg-accent-product/90");
  });

  it("la rama no-hero NO propaga el font-semibold del hero", () => {
    render(<SearchBox />);
    const boton = screen.getByRole("button", { name: "Buscar" });
    expect(boton.className).not.toContain("font-semibold");
  });

  // Phase 82: hero CTA es "Buscar" (decisión operador 2026-07-15; aria-label del form intacto).
  it("la rama hero usa petróleo + font-semibold + label 'Buscar' (Phase 82)", () => {
    render(<SearchBox variant="hero" />);
    const boton = screen.getByRole("button", { name: "Buscar" });
    expect(boton.className).toContain("bg-accent-product");
    expect(boton.className).toContain("font-semibold");
    expect(boton.className).toContain("text-background");
    expect(boton.className).toContain("hover:bg-accent-product/90");
  });
});

describe("SearchBox — 77-01: hero 52px + radius-control; /buscar aislado", () => {
  it("hero input → h-[52px] y rounded-[var(--radius-control)]", () => {
    render(<SearchBox variant="hero" />);
    const input = screen.getByRole("searchbox");
    expect(input.className).toContain("h-[52px]");
    expect(input.className).toContain("rounded-[var(--radius-control)]");
  });

  it("hero button → h-[52px] y rounded-[var(--radius-control)] además de petróleo+semibold", () => {
    render(<SearchBox variant="hero" />);
    const boton = screen.getByRole("button", { name: "Buscar" });
    expect(boton.className).toContain("h-[52px]");
    expect(boton.className).toContain("rounded-[var(--radius-control)]");
    expect(boton.className).toContain("bg-accent-product");
    expect(boton.className).toContain("font-semibold");
    expect(boton.className).toContain("text-background");
    expect(boton.className).toContain("hover:bg-accent-product/90");
  });

  it("default input → h-12, sin h-[52px] ni rounded-[var(--radius-control)] (aislado)", () => {
    render(<SearchBox />);
    const input = screen.getByRole("searchbox");
    expect(input.className).toContain("h-12");
    expect(input.className).not.toContain("h-[52px]");
    expect(input.className).not.toContain("rounded-[var(--radius-control)]");
  });

  it("default button → h-12 sin font-semibold (aislado)", () => {
    render(<SearchBox />);
    const boton = screen.getByRole("button", { name: "Buscar" });
    expect(boton.className).toContain("h-12");
    expect(boton.className).not.toContain("font-semibold");
  });
});
