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

// Los 3 fetchers tile de actualidad son Server Components con hijos async que leen Supabase.
// Se stubbea a null para aislar el héroe y evitar el runtime Supabase en jsdom.
// ActualidadModule (wrapper lineal retirado en Phase 78) ya no se exporta.
vi.mock("@/components/actualidad-module", () => ({
  VotadoEstaSemana: () => null,
  UrgenciasVigentes: () => null,
  UltimaActualizacion: () => null,
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

// ── BENTO-05: colapso ≤md / orden DOM / landmarks / form a11y (estructural, jsdom-safe) ──

/**
 * Asserts estructurales de la home (BENTO-05 — Phase 80-01).
 *
 * RESTRICCIÓN JSDOM: getComputedStyle/getBoundingClientRect devuelven 0 en jsdom.
 * Todos los asserts fijan CLASES (toHaveClass/className) o estructura DOM,
 * NUNCA píxeles. La verificación visual de layout y contraste dark es Phase 81.
 *
 * RESTRICCIÓN MOCKS: VotadoEstaSemana/UrgenciasVigentes/UltimaActualizacion están
 * mockeados a () => null en este archivo (líneas ~34-38). Los headings
 * "Votado esta semana"/"Urgencias vigentes" viven DENTRO de esos componentes y NO
 * se renderizan en jsdom bajo estos mocks. Por eso (b) y (e) NO pueden asertar
 * por texto de esos componentes — se anclan a la estructura estable de page.tsx
 * (BentoGrid container, nav, hrefs LOCKED) que sí está en el DOM.
 * Los wrappers <Suspense> de page.tsx no generan elementos DOM propios; sus hijos
 * mockeados a null no renderizan nada, por lo que el orden de los tiles de
 * actualidad se documenta en comentario y se ancla a los wrappers contenedores
 * del BentoGrid que sí existen.
 */
describe("BENTO-05 — colapso/orden/landmarks (estructural, jsdom-safe)", () => {
  // (a) COLAPSO: ningún tile del grid tiene col-span-N sin prefijo md:
  // Cada col-span en el DOM debe ser md:col-span-N (colapso a 1 columna en móvil).
  it("(a) ningún elemento tiene col-span-N sin prefijo md: (colapso ≤md garantizado)", () => {
    const { container } = render(<Home />);
    // El BentoGrid tiene grid-cols-1 y md:grid-cols-6.
    const grid = container.querySelector(".grid-cols-1.md\\:grid-cols-6, .grid-cols-1");
    // Verificar que el grid tiene el clase de colapso.
    const gridWrapper = container.querySelector(".grid-cols-1");
    expect(gridWrapper).not.toBeNull();
    expect(gridWrapper).toHaveClass("md:grid-cols-6");

    // Ningún elemento debe tener col-span-N sin el prefijo md: (rompería el colapso).
    const colSpanEls = container.querySelectorAll("[class*='col-span']");
    colSpanEls.forEach((el) => {
      const cls = el.className ?? "";
      // Buscar ocurrencias de col-span-N NO precedidas de md:
      // Patrón: col-span seguido de - y dígito(s) que NO esté precedido de md:
      const bareColSpan = cls.match(/(?<![a-z-])col-span-\d+/g);
      if (bareColSpan) {
        // Filtrar: descartar matches que forman parte de 'md:col-span-N'
        const problematicos = bareColSpan.filter(
          (m) => !cls.includes(`md:${m}`),
        );
        expect(
          problematicos,
          `Elemento con clase "${cls}" tiene col-span sin prefijo md:`,
        ).toHaveLength(0);
      }
    });
  });

  // (b) ORDEN DOM = orden visual — ancla a hrefs LOCKED de page.tsx.
  // Los tiles de actualidad están mockeados a null: su orden DOM se ancla
  // a la estructura del BentoGrid (ver restricción de mocks arriba).
  // Se asertan: hero (h1 presente) → /sobre → 3 entry tiles LOCKED en orden.
  it("(b) orden DOM: hero → /sobre → entry tiles /buscar → /parlamentarios → /agenda", () => {
    const { container } = render(<Home />);
    const links = Array.from(container.querySelectorAll("a[href]"));
    const hrefs = links.map((l) => l.getAttribute("href"));

    // /sobre debe aparecer antes que las 3 entradas.
    const iSobre = hrefs.indexOf("/sobre");
    const iBuscar = hrefs.indexOf("/buscar");
    const iParlamentarios = hrefs.indexOf("/parlamentarios");
    const iAgenda = hrefs.indexOf("/agenda");

    expect(iSobre).toBeGreaterThanOrEqual(0);
    expect(iBuscar).toBeGreaterThanOrEqual(0);
    expect(iParlamentarios).toBeGreaterThanOrEqual(0);
    expect(iAgenda).toBeGreaterThanOrEqual(0);

    // Orden DOM: /sobre antes de /buscar, /buscar < /parlamentarios < /agenda.
    expect(iSobre).toBeLessThan(iBuscar);
    expect(iBuscar).toBeLessThan(iParlamentarios);
    expect(iParlamentarios).toBeLessThan(iAgenda);

    // El hero (h1) aparece antes de /sobre en el DOM.
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    const sobreLink = links[iSobre];
    // h1 debe preceder al link /sobre en el DOM.
    const pos =
      // eslint-disable-next-line no-bitwise
      sobreLink.compareDocumentPosition(h1!) & Node.DOCUMENT_POSITION_PRECEDING;
    expect(pos, "h1 debe preceder al link /sobre").toBeTruthy();
  });

  // (c) LANDMARK único: un solo <main> (el de page.tsx); <nav> con aria-label.
  it("(c) landmark único: exactamente un <main> y <nav> con aria-label", () => {
    const { container } = render(<Home />);
    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);

    // El <nav> tiene aria-label (WR-01 — ya existe, confirmado por Contract 2).
    const nav = screen.getByRole("navigation", { name: "Secciones del sitio" });
    expect(nav).toBeInTheDocument();
  });

  // (d) FORM a11y: getByRole("search", { name: /buscar/i }) encuentra el form
  // con el aria-label añadido en Task 1 (search-box.tsx).
  it("(d) form a11y: role=search tiene nombre accesible /buscar/i", () => {
    render(<Home />);
    const searchForm = screen.getByRole("search", { name: /buscar/i });
    expect(searchForm).toBeInTheDocument();
  });

  // (e) SECCIONES: los tiles del BentoGrid tienen estructura de secciones.
  // VotadoEstaSemana/UrgenciasVigentes están mockeados a null — sus <h2> internos
  // NO renderizan bajo estos mocks (ver restricción arriba). Se asertan los
  // wrappers de sección que SÍ existen en el DOM de page.tsx:
  //   - La sección hero (BentoTile asChild = <section>) con heading h1.
  //   - La sección /sobre con heading h2 "¿Cómo leer esto?".
  // Los boundaries <Suspense> de actualidad no generan elementos DOM — el orden
  // DOM de los tiles de actualidad está garantizado por la posición en el JSX
  // de page.tsx (no hay reordenamiento CSS) y se documenta aquí sin poder
  // asertar el contenido de los componentes mockeados.
  it("(e) secciones: section hero con h1 y tile /sobre con h2 presentes en DOM", () => {
    const { container } = render(<Home />);

    // La sección hero: BentoTile asChild renderiza como <section> con un <h1>.
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBeGreaterThanOrEqual(1);
    const heroSection = sections[0];
    const h1 = heroSection.querySelector("h1");
    expect(h1, "La sección hero debe contener un h1").not.toBeNull();

    // El tile /sobre tiene el h2 "¿Cómo leer esto?" (está en page.tsx, no mockeado).
    const sobreH2 = screen.getByRole("heading", { name: "¿Cómo leer esto?" });
    expect(sobreH2.tagName).toBe("H2");
  });
});

// ── Contract 3: force-dynamic + retiro de ActualidadModule lineal + montaje de tiles ─

describe("Landing — Contract 3: force-dynamic + retiro del módulo lineal + tiles en BentoGrid", () => {
  it("exporta dynamic = 'force-dynamic'", () => {
    expect(HomeModule.dynamic).toBe("force-dynamic");
  });

  it("renderiza sin lanzar aunque los fetchers estén mockeados a null", () => {
    expect(() => render(<Home />)).not.toThrow();
  });

  it("NO renderiza el wrapper lineal ActualidadModule (aria-label='Actualidad' / max-w-5xl retirados)", () => {
    const { container } = render(<Home />);
    // El wrapper lineal tenía aria-label="Actualidad"
    expect(
      container.querySelector('[aria-label="Actualidad"]'),
    ).toBeNull();
    // Y max-w-5xl era su clase de contenedor
    expect(container.querySelector(".max-w-5xl")).toBeNull();
  });
});
