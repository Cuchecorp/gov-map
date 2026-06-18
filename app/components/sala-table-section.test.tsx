import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  SalaTableSection,
  type SalaTableSectionProps,
} from "./sala-table-section";

afterEach(cleanup);

const availableProps: SalaTableSectionProps = {
  mode: "available",
  items: [
    {
      posicion: 1,
      parteSesion: "ORDEN DEL DÍA",
      materia: "Reforma al sistema de pensiones",
      boletin: "15480-13",
      etapa: "Segundo trámite",
    },
    {
      posicion: 2,
      parteSesion: "ORDEN DEL DÍA",
      materia: "Proyecto sin boletín asociado",
      boletin: null,
      etapa: null,
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

  it("no muestra el copy de degradación cuando hay datos", () => {
    render(<SalaTableSection {...availableProps} />);
    expect(
      screen.queryByText(/Tabla de sala no disponible/)
    ).not.toBeInTheDocument();
  });
});

describe("SalaTableSection — modo degraded (degradación honesta de Cámara)", () => {
  it("muestra el copy honesto 'Tabla de sala no disponible'", () => {
    render(<SalaTableSection mode="degraded" />);
    expect(
      screen.getByText("Tabla de sala no disponible")
    ).toBeInTheDocument();
  });

  it("incluye un enlace al PDF / fuente oficial de Cámara", () => {
    const { container } = render(<SalaTableSection mode="degraded" />);
    const camaraLink = Array.from(container.querySelectorAll("a")).find((a) =>
      /camara\.cl/.test(a.getAttribute("href") ?? "")
    );
    expect(camaraLink).toBeDefined();
    expect(camaraLink).toHaveAttribute("target", "_blank");
  });

  it("NO dice 'próximamente' (no implica compromiso)", () => {
    const { container } = render(<SalaTableSection mode="degraded" />);
    expect(container.textContent).not.toMatch(/próximamente/i);
  });

  it("NO usa estilo destructive para la degradación (no es un error)", () => {
    const { container } = render(<SalaTableSection mode="degraded" />);
    expect(container.innerHTML).not.toMatch(/destructive/);
    // Usa el contenedor neutro border-border bg-muted/40.
    expect(container.innerHTML).toMatch(/bg-muted/);
  });

  it("no renderiza una tabla en modo degraded (no fabrica filas)", () => {
    render(<SalaTableSection mode="degraded" />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
