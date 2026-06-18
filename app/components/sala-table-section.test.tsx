import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  SalaTableSection,
  type SalaTableSectionProps,
} from "./sala-table-section";

afterEach(cleanup);

const CAMARA_PDF =
  "https://www.camara.cl/verDoc.aspx?prmTipo=TABLASEMANAL";

const availableProps: SalaTableSectionProps = {
  mode: "available",
  items: [
    {
      key: "s1:1",
      posicion: 1,
      parteSesion: "ORDEN DEL DÍA",
      materia: "Reforma al sistema de pensiones",
      boletin: "15480-13",
    },
    {
      key: "s1:2",
      posicion: 2,
      parteSesion: "ORDEN DEL DÍA",
      materia: "Proyecto sin boletín asociado",
      boletin: null,
    },
  ],
  provenance: {
    capturedAt: new Date("2026-06-16T12:00:00Z"),
    sourceName: "Senado",
    sourceUrl: "https://www.senado.cl/actividad-legislativa/sala",
  },
};

describe("SalaTableSection — modo available (tabla del Senado)", () => {
  it("renderiza una tabla con las filas de la tabla de sala", () => {
    render(<SalaTableSection {...availableProps} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByText("Reforma al sistema de pensiones")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Proyecto sin boletín asociado")
    ).toBeInTheDocument();
  });

  it("el boletín enlaza internamente a /proyecto/{boletin}", () => {
    render(<SalaTableSection {...availableProps} />);
    const link = screen.getByRole("link", { name: /15480-13/ });
    expect(link).toHaveAttribute("href", "/proyecto/15480-13");
    expect(link).not.toHaveAttribute("target", "_blank");
  });

  it("renderiza el ProvenanceBadge en modo available", () => {
    render(<SalaTableSection {...availableProps} />);
    expect(screen.getByText(/Actualizado/)).toBeInTheDocument();
  });

  it("no muestra el copy de degradación de Cámara cuando hay datos del Senado", () => {
    render(<SalaTableSection {...availableProps} />);
    expect(
      screen.queryByText(/tabla no disponible como dato estructurado/i)
    ).not.toBeInTheDocument();
  });
});

describe("SalaTableSection — modo degraded (degradación honesta, acotada a Cámara)", () => {
  it("muestra el copy honesto acotado a la Cámara (no afirma que el Senado falló)", () => {
    render(<SalaTableSection mode="degraded" camaraPdfUrl={CAMARA_PDF} />);
    expect(
      screen.getByText("Cámara: tabla no disponible como dato estructurado")
    ).toBeInTheDocument();
  });

  it("enlaza al PDF oficial canónico que la ingesta registró (CR-01)", () => {
    render(<SalaTableSection mode="degraded" camaraPdfUrl={CAMARA_PDF} />);
    const link = Array.from(document.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === CAMARA_PDF
    );
    expect(link).toBeDefined();
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("NO dice 'próximamente' (no implica compromiso)", () => {
    const { container } = render(
      <SalaTableSection mode="degraded" camaraPdfUrl={CAMARA_PDF} />
    );
    expect(container.textContent).not.toMatch(/próximamente/i);
  });

  it("NO usa estilo destructive para la degradación (no es un error)", () => {
    const { container } = render(
      <SalaTableSection mode="degraded" camaraPdfUrl={CAMARA_PDF} />
    );
    expect(container.innerHTML).not.toMatch(/destructive/);
    expect(container.innerHTML).toMatch(/bg-muted/);
  });

  it("no renderiza una tabla en modo degraded (no fabrica filas)", () => {
    render(<SalaTableSection mode="degraded" camaraPdfUrl={CAMARA_PDF} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
