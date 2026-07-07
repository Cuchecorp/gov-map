import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { Breadcrumbs } from "./breadcrumbs";

afterEach(cleanup);

/**
 * Tests de `Breadcrumbs` (53-UI-SPEC §(b) / §Component Inventory). Server Component
 * presentacional puro: verifica por COMPORTAMIENTO que
 *   - es un <nav aria-label="Ruta de navegación"> con un <ol> (nunca un heading),
 *   - los ítems con href son links navegables y el ítem final (sin href) es texto
 *     plano con aria-current="page",
 *   - N ítems dibujan N-1 separadores "/" (aria-hidden),
 *   - mono:true aplica font-mono al segmento (p.ej. "Boletín 14309-04"),
 *   - todos los links llevan min-h-11 (touch target 44px).
 * Props literales (no user input); cero JS, cero usePathname.
 */

const CRUMBS_PROYECTO = [
  { label: "Inicio", href: "/" },
  { label: "Proyectos", href: "/buscar" },
  { label: "Boletín 14309-04", mono: true },
] as const;

describe("Breadcrumbs — estructura de navegación (53-UI-SPEC §(b))", () => {
  it("renderiza un <nav aria-label='Ruta de navegación'> con un <ol>, no un heading", () => {
    const { container } = render(<Breadcrumbs items={CRUMBS_PROYECTO} />);
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav).toHaveAttribute("aria-label", "Ruta de navegación");
    expect(nav?.querySelector("ol")).not.toBeNull();
    // Nunca un heading: el breadcrumb es chrome sobre el h1, no un título.
    expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
  });

  it("los ítems con href son links navegables; el ítem final (sin href) es texto plano con aria-current", () => {
    const { container } = render(<Breadcrumbs items={CRUMBS_PROYECTO} />);

    const inicio = screen.getByRole("link", { name: "Inicio" });
    expect(inicio).toHaveAttribute("href", "/");
    const proyectos = screen.getByRole("link", { name: "Proyectos" });
    expect(proyectos).toHaveAttribute("href", "/buscar");

    // El segmento actual NO es link: no aparece como role=link.
    expect(screen.queryByRole("link", { name: "Boletín 14309-04" })).toBeNull();
    const actual = screen.getByText("Boletín 14309-04");
    expect(actual).toHaveAttribute("aria-current", "page");
    expect(actual.tagName.toLowerCase()).not.toBe("a");

    // Solo hay 2 links (los 2 primeros crumbs).
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });

  it("N ítems dibujan N-1 separadores '/' con aria-hidden", () => {
    const { container } = render(<Breadcrumbs items={CRUMBS_PROYECTO} />);
    const seps = Array.from(container.querySelectorAll("span[aria-hidden='true']")).filter(
      (el) => el.textContent === "/",
    );
    expect(seps).toHaveLength(CRUMBS_PROYECTO.length - 1);
  });

  it("mono:true aplica font-mono al segmento actual (boletín en Mono)", () => {
    render(<Breadcrumbs items={CRUMBS_PROYECTO} />);
    const boletin = screen.getByText("Boletín 14309-04");
    expect(boletin.className).toContain("font-mono");
  });

  it("todos los links llevan min-h-11 (touch target 44px)", () => {
    const { container } = render(<Breadcrumbs items={CRUMBS_PROYECTO} />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => expect(a.className).toContain("min-h-11"));
  });

  it("un solo ítem (contraparte: [Inicio, nombre]) dibuja 0 separadores y 1 link", () => {
    const { container } = render(
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Empresa X" }]} />,
    );
    const seps = Array.from(container.querySelectorAll("span[aria-hidden='true']")).filter(
      (el) => el.textContent === "/",
    );
    expect(seps).toHaveLength(1);
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(screen.getByText("Empresa X")).toHaveAttribute("aria-current", "page");
  });
});
