import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

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

// ActualidadModule (SC4) es un Server Component con hijos async que leen Supabase
// (bloques de actualidad bajo el hero). Este test cubre EXCLUSIVAMENTE el héroe
// editorial; el módulo tiene su propia suite (actualidad-module.test.tsx). Se
// stubbea a null para aislar el héroe y evitar el runtime Supabase en jsdom.
vi.mock("@/components/actualidad-module", () => ({
  ActualidadModule: () => null,
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

    const boletin = screen.getByRole("button", { name: "14309-04" });
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

    fireEvent.click(screen.getByRole("button", { name: "14309-04" }));
    expect(pushMock).toHaveBeenCalledWith("/buscar?q=14309-04");
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

// ── Contract 2 (54-UI-SPEC): 3 tarjetas de entrada server-rendered ──────────────
// Verifican por comportamiento: nav semántico, 3 rutas de entrada con copy LOCKED,
// sin heading nuevo en el bloque, y banned-vocab negative-match sobre el copy.

// Vocabulario prohibido (banned-vocab §6): virtud fabricada + causal/afinidad/score.
const BANNED_VOCAB =
  /limpio|transparente|nada que ocultar|a cambio de|influy|cercano|afinidad|correlaci|af[ií]n|score|ranking|puntaje|porque/i;

describe("Landing — Contract 2: tarjetas de entrada", () => {
  it("renderiza un <nav aria-label='Secciones del sitio'> entre hero y actualidad", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Secciones del sitio" });
    expect(nav).toBeInTheDocument();
  });

  it("expone exactamente 3 links de sección con los hrefs y títulos LOCKED", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Secciones del sitio" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(3);

    const proyectos = within(nav).getByRole("link", { name: /Proyectos de ley/ });
    expect(proyectos).toHaveAttribute("href", "/buscar");

    const parlamentarios = within(nav).getByRole("link", {
      name: /Parlamentarios 360/,
    });
    expect(parlamentarios).toHaveAttribute("href", "/parlamentarios");

    const agenda = within(nav).getByRole("link", { name: /Agenda de la semana/ });
    expect(agenda).toHaveAttribute("href", "/agenda");
  });

  it("muestra las 3 líneas de valor prescritas verbatim", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Secciones del sitio" });

    expect(
      within(nav).getByText(
        "En qué etapa está cada proyecto y cómo se ha votado, con cada fuente enlazada.",
      ),
    ).toBeInTheDocument();
    expect(
      within(nav).getByText(
        "Votaciones, lobby y patrimonio de cada parlamentario, según los registros públicos.",
      ),
    ).toBeInTheDocument();
    expect(
      within(nav).getByText(
        "Citaciones de comisiones y tabla de sala, enlazadas a cada proyecto.",
      ),
    ).toBeInTheDocument();
  });

  it("el bloque NO introduce un heading (h2/h3) nuevo", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Secciones del sitio" });
    expect(within(nav).queryByRole("heading")).not.toBeInTheDocument();
  });

  it("el copy de las tarjetas pasa el banned-vocab negative-match", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Secciones del sitio" });
    expect(nav.textContent ?? "").not.toMatch(BANNED_VOCAB);
  });
});
