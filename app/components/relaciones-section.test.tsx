import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { RelacionesSection, RELACIONES_VACIO } from "./relaciones-section";
import { LEYENDA_CROSS_LINK } from "./cross-links-parlamentario";

afterEach(cleanup);

/**
 * RelacionesSection (REL-02, 101-02) — wrapper de composición pura que des-entierra el
 * bloque de relaciones above-the-fold. Las pruebas verifican el CONTRATO del wrapper por
 * comportamiento (no snapshot): sección presente + heading exacto + leyenda de grupo 1× +
 * los bloques hijos montados + frontera mt-12 preservada. Los hijos se MOCKEAN con
 * marcadores simples (el wrapper es agnóstico a su contenido; CrossLinkBloque se testea
 * aparte y queda byte-intacto).
 */

// Marcadores de los 4 bloques hijos (stand-in de los CrossLinkBloque reales).
const bloques = [
  <section key="a" data-testid="bloque-copartidarios" className="mt-12">
    <h2>Del mismo partido</h2>
  </section>,
  <section key="b" data-testid="bloque-misma-zona" className="mt-12">
    <h2>De la misma zona</h2>
  </section>,
  <section key="c" data-testid="bloque-co-comision" className="mt-12">
    <h2>En la misma comisión</h2>
  </section>,
  <section key="d" data-testid="bloque-co-autoria" className="mt-12">
    <h2>Han co-firmado proyectos</h2>
  </section>,
];

describe("RelacionesSection — wrapper above-the-fold (REL-02)", () => {
  it("monta una <section id=\"relaciones\">", () => {
    const { container } = render(<RelacionesSection>{bloques}</RelacionesSection>);
    const section = container.querySelector("section#relaciones");
    expect(section).not.toBeNull();
  });

  it("renderiza el heading exacto \"Relaciones con otros parlamentarios\"", () => {
    render(<RelacionesSection>{bloques}</RelacionesSection>);
    expect(
      screen.getByRole("heading", {
        name: "Relaciones con otros parlamentarios",
      }),
    ).toBeTruthy();
  });

  it("renderiza la leyenda de grupo LEYENDA_CROSS_LINK exactamente 1×", () => {
    render(<RelacionesSection>{bloques}</RelacionesSection>);
    const apariciones = screen.getAllByText(LEYENDA_CROSS_LINK);
    expect(apariciones).toHaveLength(1);
  });

  it("monta los 4 bloques hijos (composición pura)", () => {
    render(<RelacionesSection>{bloques}</RelacionesSection>);
    expect(screen.getByTestId("bloque-copartidarios")).toBeTruthy();
    expect(screen.getByTestId("bloque-misma-zona")).toBeTruthy();
    expect(screen.getByTestId("bloque-co-comision")).toBeTruthy();
    expect(screen.getByTestId("bloque-co-autoria")).toBeTruthy();
  });

  it("conserva la frontera mt-12 en la <section id=\"relaciones\"> (anti-insinuación)", () => {
    const { container } = render(<RelacionesSection>{bloques}</RelacionesSection>);
    const section = container.querySelector("section#relaciones");
    expect(section?.className).toContain("mt-12");
  });

  it("vacio → ausencia DECLARADA en lugar del grid (WR-04, vacío honesto)", () => {
    const { container } = render(<RelacionesSection vacio />);
    // La línea de ausencia declarada reemplaza al grid — jamás heading+leyenda
    // sobre un grid mudo.
    expect(screen.getByText(RELACIONES_VACIO)).toBeTruthy();
    expect(container.querySelector("section#relaciones > div")).toBeNull();
    // Heading + leyenda se conservan (la sección sigue declarándose a sí misma).
    expect(
      screen.getByRole("heading", {
        name: "Relaciones con otros parlamentarios",
      }),
    ).toBeTruthy();
    expect(screen.getAllByText(LEYENDA_CROSS_LINK)).toHaveLength(1);
  });

  it("sin vacio → el grid se monta (default retro-compatible)", () => {
    const { container } = render(
      <RelacionesSection>{bloques}</RelacionesSection>,
    );
    expect(container.querySelector("section#relaciones > div")).not.toBeNull();
    expect(screen.queryByText(RELACIONES_VACIO)).toBeNull();
  });

  it("neutraliza el mt-12 interno de los bloques en la celda del grid ([&>section]:mt-0) sin tocarlos", () => {
    // El grid lleva la utilidad [&>section]:mt-0 (Pitfall A4): el mt-12 inter-dominio
    // vive en la sección misma, no se duplica dentro del grid. Los bloques hijos
    // CONSERVAN su propio mt-12 en el markup (byte-intactos) — la neutralización es
    // puramente CSS a nivel del contenedor, no una reescritura del hijo.
    const { container } = render(<RelacionesSection>{bloques}</RelacionesSection>);
    const grid = container.querySelector("section#relaciones > div");
    expect(grid?.className).toContain("[&>section]:mt-0");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("md:grid-cols-2");
    // Los bloques hijos NO fueron despojados de su mt-12 (composición, no reescritura).
    expect(
      screen.getByTestId("bloque-copartidarios").className,
    ).toContain("mt-12");
  });
});
