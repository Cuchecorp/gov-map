import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Tests de la landing `/` (Fase 21 SC1 — paridad con el mockup CERRADO de Fase
 * 19, `mockup/landing.html`). Verifican por comportamiento (no por convención):
 *   - titular display con la cláusula cursiva petróleo LOCKED ("Con la fuente a la vista.").
 *   - CTA petróleo "Buscar proyectos" (no el genérico "Buscar").
 *   - las 4 pills LOCKED presentes; la de boletín en Mono.
 *   - clic en una pill → prefija + NAVEGA a /buscar?q=<pill> (mismo camino que el submit).
 *   - trust line LOCKED y link "¿Cómo leer esto?".
 *   - SIN stats fabricadas (no "indexados"/"miles").
 *
 * `next/navigation` se mockea para capturar el push sin runtime de Next.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// next/link → <a> simple en jsdom.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Importar DESPUÉS de los mocks.
import Home from "./page";

afterEach(() => {
  cleanup();
  pushMock.mockReset();
});

describe("Landing — paridad con el mockup CERRADO (héroe editorial)", () => {
  it("renderiza el titular display con la cláusula cursiva petróleo LOCKED", () => {
    render(<Home />);

    // Línea 1 del titular (foreground).
    expect(
      screen.getByText(/Qué pasó con cada proyecto de ley y cada parlamentario\./),
    ).toBeInTheDocument();

    // Línea 2: cursiva petróleo (--accent-product) — el <em> acento del héroe.
    const acento = screen.getByText("Con la fuente a la vista.");
    expect(acento.tagName).toBe("EM");
    expect(acento).toHaveClass("italic");
    expect(acento).toHaveClass("text-accent-product");
  });

  it("usa el CTA petróleo 'Buscar proyectos' (no el genérico 'Buscar')", () => {
    render(<Home />);

    const cta = screen.getByRole("button", { name: "Buscar proyectos" });
    expect(cta).toHaveClass("bg-accent-product");
    // El CTA genérico de la barra persistente NO aparece en la landing.
    expect(
      screen.queryByRole("button", { name: /^Buscar$/ }),
    ).not.toBeInTheDocument();
  });

  it("muestra las 4 pills LOCKED; la de boletín en Mono", () => {
    render(<Home />);

    expect(
      screen.getByRole("button", { name: "protección de datos personales" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "delitos económicos y medio ambiente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "40 horas / jornada laboral" }),
    ).toBeInTheDocument();

    const boletin = screen.getByRole("button", { name: "15234-07" });
    expect(boletin).toHaveClass("font-mono");
  });

  it("clic en una pill prefija + navega a /buscar?q=<pill> (mismo camino que el submit)", () => {
    render(<Home />);

    fireEvent.click(
      screen.getByRole("button", { name: "protección de datos personales" }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/buscar?q=protecci%C3%B3n%20de%20datos%20personales",
    );

    // La caja queda prefijada con la query de la pill.
    const input = screen.getByRole("searchbox", {
      name: /buscar proyectos de ley/i,
    });
    expect(input).toHaveValue("protección de datos personales");
  });

  it("la pill de boletín navega con el número de boletín", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "15234-07" }));
    expect(pushMock).toHaveBeenCalledWith("/buscar?q=15234-07");
  });

  it("renderiza la trust line LOCKED y el link '¿Cómo leer esto?'", () => {
    render(<Home />);

    expect(
      screen.getByText(
        /Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad\./,
      ),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "¿Cómo leer esto?" });
    expect(link).toHaveAttribute("href", "/sobre");
  });

  it("no muestra stats fabricadas (sin 'indexados' ni 'miles')", () => {
    const { container } = render(<Home />);
    expect(container.textContent ?? "").not.toMatch(/indexad|miles de|\bel más completo\b/i);
  });
});
