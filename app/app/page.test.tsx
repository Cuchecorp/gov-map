import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Tests de la landing `/` — Bento composition (Phase 77-02 / Phase 82 copy).
 *
 * Contract 1 (héroe editorial):
 *   - kicker OBSERVATORIO DEL CONGRESO presente.
 *   - h1 LOCKED (decisión operador 2026-07-15 anula h1 anterior de Phase 77-02):
 *     "Busca cualquier proyecto de ley por tema o número de boletín"
 *   - CTA petróleo "Buscar" en variante hero (Phase 82; aria-label del form intacto).
 *   - 4 pills LOCKED presentes; la de boletín en Mono.
 *   - clic en una pill → prefija + NAVEGA a /buscar?q=<pill>.
 *   - SIN stats fabricadas.
 *
 * Contract 2 (accent tile + 3 entry tiles — bento grid):
 *   - Accent tile: href="/sobre", heading ¿Cómo leer esto?, copy mockup linter-safe,
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

// PanelActualidad (Phase 100) es un Server Component async que lee Supabase vía la
// RPC bounded actualidad_senales_panel. Se mockea a () => null — espejo del germ mock
// que reemplaza — para aislar el héroe y evitar el runtime Supabase en jsdom.
// El germen actualidad-module.tsx quedó DESMONTADO en Phase 100-03 (page.tsx ya no lo
// importa): su mock se retira acorde.
vi.mock("@/components/panel-actualidad", () => ({
  PanelActualidad: () => null,
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

  // h1 LOCKED — decisión operador 2026-07-15 anula h1 anterior ("Qué pasó con…").
  it("renderiza el h1 del mockup LOCKED (Phase 82)", () => {
    render(<Home />);

    expect(
      screen.getByText(/Busca cualquier proyecto de ley por tema o número de boletín/),
    ).toBeInTheDocument();

    // La cursiva anterior y el subtítulo fueron retirados (no existen en el mockup).
    expect(screen.queryByText("Con la fuente a la vista.")).not.toBeInTheDocument();
  });

  it("usa el CTA petróleo 'Buscar' en variante hero (Phase 82; aria-label del form intacto)", () => {
    render(<Home />);

    const cta = screen.getByRole("button", { name: /^Buscar$/ });
    expect(cta).toHaveClass("bg-accent-product");
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

  // La trust line fue retirada del hero en Phase 82 (el mockup no la tiene; vive en footer).
  it("la trust line ya NO aparece en el hero (retirada en Phase 82)", () => {
    render(<Home />);
    // La trust line puede aparecer en el footer (fuera de este render mockeado),
    // pero el hero ya no la renderiza. El footer real vive en layout.tsx (no en Home).
    // Este assert verifica que page.tsx no la incluye.
    expect(
      screen.queryByText(
        /Sin afirmar intención ni causalidad/,
      ),
    ).not.toBeInTheDocument();
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

  // Copy del mockup adoptado en Phase 82 (decisión operador 2026-07-15).
  it("accent tile: cuerpo contiene copy del mockup linter-safe (Phase 82)", () => {
    render(<Home />);
    expect(screen.getByText(/La coincidencia temporal no implica relación/i)).toBeInTheDocument();
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
 * RESTRICCIÓN MOCKS: PanelActualidad (Phase 100) está mockeado a () => null en este
 * archivo (líneas ~31-38). Sus tiles de señal (con sus títulos "Movimiento reciente"/
 * "Urgencias del Ejecutivo"/…) viven DENTRO del componente y NO se renderizan en jsdom
 * bajo el mock. Por eso (b) y (e) NO pueden asertar por texto del panel — se anclan a la
 * estructura estable de page.tsx (BentoGrid container, nav, hrefs LOCKED) que sí está en
 * el DOM. El wrapper <Suspense> de page.tsx no genera un elemento DOM propio; su hijo
 * mockeado a null no renderiza nada, así que el panel no aporta links y el orden DOM
 * hero → /sobre → 3 entry tiles LOCKED se preserva.
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
      // IN-02 fix: tokenizar por whitespace antes de filtrar — evita que
      // "md:col-span-4 col-span-4" suprima el bare col-span-4 vía substring.
      const tokens = cls.split(/\s+/);
      const bareColSpan = tokens.filter((t) => /^col-span-\d+$/.test(t));
      if (bareColSpan.length > 0) {
        const responsiveTokens = new Set(
          tokens.filter((t) => /^md:col-span-\d+$/.test(t)).map((t) => t.slice(3))
        );
        const problematicos = bareColSpan.filter((m) => !responsiveTokens.has(m));
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
  // PanelActualidad está mockeado a null — sus <section>/<h2> internos NO renderizan
  // bajo el mock (ver restricción arriba). Se asertan los wrappers de sección que SÍ
  // existen en el DOM de page.tsx:
  //   - La sección hero (BentoTile asChild = <section>) con heading h1.
  //   - La sección /sobre con heading h2 "¿Cómo leer esto?".
  // El boundary <Suspense> del panel no genera un elemento DOM — el orden DOM de los
  // tiles del panel está garantizado por su posición en el JSX de page.tsx (no hay
  // reordenamiento CSS) y se documenta aquí sin poder asertar el contenido del
  // componente mockeado.
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

// ── Contract 3: force-dynamic + montaje del PanelActualidad (Phase 100-03) ─────────

/**
 * Contract 3 (reescrito en Phase 100-03): la home montó `<PanelActualidad/>` bajo
 * Suspense EN LUGAR del cuerpo producto-céntrico (los 3 germ tiles de
 * actualidad-module.tsx Votado/Urgencias/Frescura, retirados). Los asserts:
 *   - `HomeModule.dynamic === "force-dynamic"` — build-marker LOAD-BEARING (T-100-09):
 *     sin él Next hornea `/` estática (○) → stale/500. Falla el test si se borra.
 *   - render sin throw con el panel mockeado a `() => null`.
 *   - AUSENCIA de la superficie producto-céntrica retirada: ni el wrapper lineal
 *     ActualidadModule (`[aria-label="Actualidad"]`/`.max-w-5xl`) ni los germ tiles
 *     (headings "Votado esta semana"/"Urgencias vigentes"/"Última actualización")
 *     se montan. El panel (mockeado a null) NO aporta esos nodos.
 */
describe("Landing — Contract 3: force-dynamic + montaje del PanelActualidad (Phase 100-03)", () => {
  it("exporta dynamic = 'force-dynamic' (build-marker LOAD-BEARING, T-100-09)", () => {
    expect(HomeModule.dynamic).toBe("force-dynamic");
  });

  it("renderiza sin lanzar con PanelActualidad mockeado a null", () => {
    expect(() => render(<Home />)).not.toThrow();
  });

  it("NO monta el cuerpo producto-céntrico retirado (germ tiles + wrapper lineal ausentes)", () => {
    const { container } = render(<Home />);
    // El wrapper lineal ActualidadModule (retirado en Phase 78) sigue ausente.
    expect(container.querySelector('[aria-label="Actualidad"]')).toBeNull();
    expect(container.querySelector(".max-w-5xl")).toBeNull();
    // Los 3 germ tiles producto-céntricos (reemplazados por el panel en 100-03) no se montan.
    expect(screen.queryByText("Votado esta semana")).not.toBeInTheDocument();
    expect(screen.queryByText("Urgencias vigentes")).not.toBeInTheDocument();
    expect(screen.queryByText("Última actualización")).not.toBeInTheDocument();
  });
});
