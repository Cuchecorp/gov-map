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

  it("la rama hero queda byte-identical (petróleo + font-semibold + label 'Buscar proyectos')", () => {
    render(<SearchBox variant="hero" />);
    const boton = screen.getByRole("button", { name: "Buscar proyectos" });
    expect(boton.className).toContain("bg-accent-product");
    expect(boton.className).toContain("font-semibold");
    expect(boton.className).toContain("text-background");
    expect(boton.className).toContain("hover:bg-accent-product/90");
  });
});
