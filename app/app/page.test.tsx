import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Tests de la landing `/` — Bento composition (Phase 77-02).
 *
 * Contract 1 (héroe editorial):
 *   - kicker OBSERVATORIO DEL CONGRESO presente.
 *   - titular display con la cláusula cursiva petróleo LOCKED ("Con la fuente a la vista.").
 *   - CTA petróleo "Buscar proyectos" (bg-accent-product).
 *   - 4 pills LOCKED presentes; la de boletín en Mono.
 *   - clic en una pill → prefija + NAVEGA a /buscar?q=<pill>.
 *   - trust line LOCKED.
 *   - SIN stats fabricadas.
 *
 * Contract 2 (accent tile + 3 entry tiles — bento grid):
 *   - Accent tile: href="/sobre", heading ¿Cómo leer esto?, /sobre formula body,
 *     CTA "Ver metodología →"; NO correlaciones/irregularidades (T-77-03).
 *   - 3 entry tiles: hrefs {/buscar, /parlamentarios, /agenda}, títulos LOCKED,
 *     → glyph aria-hidden con pl-1.
 *   - force-dynamic export.
 *
 * `next/navigation` se mockea para capturar el push sin runtime de Next.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// ActualidadModule (SC4) es un Server Component con hijos async que leen Supabase.
// Se stubbea a null para aislar el héroe y evitar el runtime Supabase en jsdom.
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
import * as HomeModule from "./page";

afterEach(() => {
  cleanup();
  pushMock.mockReset();
});

// ── Contract 1: héroe editorial ───────────────────────────────────────────────

describe("Landing — paridad con el mockup CERRADO (héroe editorial)", () => {
  it("renderiza el kicker OBSERVATORIO DEL CONGRESO", () => {
    render(<Home />);
    expect(screen.getByText("OBSERVATORIO DEL CONGRESO")).toBeInTheDocument();
  });

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

  it("renderiza la trust line LOCKED", () => {
    render(<Home />);

    expect(
      screen.getByText(
        /Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad\./,
      ),
    ).toBeInTheDocument();
  });

  it("no muestra stats fabricadas (sin 'indexados' ni 'miles')", () => {
    const { container } = render(<Home />);
    expect(container.textContent ?? "").not.toMatch(/indexad|miles de|\bel más completo\b/i);
  });
});

// ── Contract 2 (77-02): accent tile + 3 entry tiles (bento grid) ─────────────

// Vocabulario prohibido (banned-vocab §6 + T-77-03 anti-insinuación):
// virtud fabricada + causal/afinidad/score + mockup correlaciones strings (BANNED).
const BANNED_VOCAB =
  /limpio|transparente|nada que ocultar|a cambio de|influy|cercano|afinidad|correlaci|irregularidad|af[ií]n|score|ranking|puntaje|porque/i;

describe("Landing — Contract 2: accent tile (/sobre) y 3 entry tiles (bento)", () => {
  it("renderiza un link al accent tile con href='/sobre'", () => {
    render(<Home />);
    const sobreLink = screen.getByRole("link", { name: /¿Cómo leer esto\?/i });
    expect(sobreLink).toHaveAttribute("href", "/sobre");
  });

  it("accent tile: heading '¿Cómo leer esto?'", () => {
    render(<Home />);
    const heading = screen.getByRole("heading", { name: "¿Cómo leer esto?" });
    expect(heading.tagName).toBe("H2");
  });

  it("accent tile: cuerpo contiene la fórmula /sobre ('nunca se inventa')", () => {
    render(<Home />);
    expect(screen.getByText(/nunca se inventa/i)).toBeInTheDocument();
  });

  it("accent tile: CTA 'Ver metodología →' presente", () => {
    render(<Home />);
    expect(screen.getByText(/Ver metodología/)).toBeInTheDocument();
  });

  it("accent tile: NO contiene strings del mockup baneados (correlaciones/irregularidades)", () => {
    const { container } = render(<Home />);
    expect(container.textContent ?? "").not.toMatch(BANNED_VOCAB);
  });

  it("expone exactamente 3 links de entry tiles con hrefs LOCKED", () => {
    render(<Home />);

    const buscar = screen.getByRole("link", { name: /Proyectos de ley/ });
    expect(buscar).toHaveAttribute("href", "/buscar");

    const parlamentarios = screen.getByRole("link", { name: /Parlamentarios 360/ });
    expect(parlamentarios).toHaveAttribute("href", "/parlamentarios");

    const agenda = screen.getByRole("link", { name: /Agenda de la semana/ });
    expect(agenda).toHaveAttribute("href", "/agenda");
  });

  it("entry tiles: muestra las 3 líneas de valor prescritas verbatim", () => {
    render(<Home />);

    expect(
      screen.getByText(
        "En qué etapa está cada proyecto y cómo se ha votado, con cada fuente enlazada.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Votaciones, lobby y patrimonio de cada parlamentario, según los registros públicos.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Citaciones de comisiones y tabla de sala, enlazadas a cada proyecto.",
      ),
    ).toBeInTheDocument();
  });

  it("entry tiles: envueltas en <nav aria-label='Secciones del sitio'> (landmark WR-01)", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Secciones del sitio" });
    expect(nav).toBeInTheDocument();
    // Los 3 links de entrada deben estar dentro del landmark.
    const buscar = screen.getByRole("link", { name: /Proyectos de ley/ });
    expect(nav).toContainElement(buscar);
  });

  it("el glyph → de las entry tiles es aria-hidden con pl-1 (no whitespace text node)", () => {
    render(<Home />);
    // Find aria-hidden → glyphs: they must exist as elements, not bare text nodes
    const arrowSpans = document
      .querySelectorAll('[aria-hidden="true"]');
    // At least some arrows present (entry tiles + accent CTA)
    expect(arrowSpans.length).toBeGreaterThan(0);
    // All text-node arrows should be wrapped in aria-hidden spans
    arrowSpans.forEach((el) => {
      if (el.textContent?.trim() === "→") {
        expect(el).toHaveClass("pl-1");
      }
    });
  });
});

// ── Contract 3: retained force-dynamic + ActualidadModule ────────────────────

describe("Landing — Contract 3: force-dynamic + ActualidadModule retained", () => {
  it("exporta dynamic = 'force-dynamic'", () => {
    expect(HomeModule.dynamic).toBe("force-dynamic");
  });

  it("renderiza sin lanzar aunque ActualidadModule esté mockeado a null", () => {
    expect(() => render(<Home />)).not.toThrow();
  });
});
