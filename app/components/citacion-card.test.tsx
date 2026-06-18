import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { CitacionCard, type CitacionCardProps } from "./citacion-card";

afterEach(cleanup);

function makeProps(overrides: Partial<CitacionCardProps> = {}): CitacionCardProps {
  return {
    comision: "Comisión de Hacienda",
    fecha: new Date("2026-06-16T13:00:00Z"),
    horario: "10:00 a 12:00",
    sala: "Sala 2",
    materia: "Estudio del proyecto de presupuesto",
    camara: "camara",
    invitados: [],
    boletin: null,
    provenance: {
      capturedAt: new Date("2026-06-16T12:00:00Z"),
      sourceName: "Cámara",
      sourceUrl: "https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2026-25",
    },
    ...overrides,
  };
}

describe("CitacionCard — cruce de boletín a la ficha de Fase 5", () => {
  it("con boletín presente renderiza un enlace interno a /proyecto/{boletin}", () => {
    render(<CitacionCard {...makeProps({ boletin: "16482-07" })} />);
    const link = screen.getByRole("link", { name: /16482-07/ });
    expect(link).toHaveAttribute("href", "/proyecto/16482-07");
    // Enlace interno: NUNCA abre en pestaña nueva.
    expect(link).not.toHaveAttribute("target", "_blank");
  });

  it("sin boletín no renderiza ningún enlace a /proyecto/", () => {
    const { container } = render(<CitacionCard {...makeProps({ boletin: null })} />);
    const proyectoLinks = container.querySelectorAll('a[href^="/proyecto/"]');
    expect(proyectoLinks.length).toBe(0);
  });
});

describe("CitacionCard — invitados como gestores de interés (T-06-02)", () => {
  const invitados = [
    { nombre: "Juan Pérez", calidad: "representante" },
    { nombre: "María Soto", calidad: null },
  ];

  it("renderiza nombre + (calidad) como texto plano", () => {
    render(<CitacionCard {...makeProps({ invitados })} />);
    expect(screen.getByText(/Juan Pérez/)).toBeInTheDocument();
    expect(screen.getByText(/\(representante\)/)).toBeInTheDocument();
    expect(screen.getByText(/María Soto/)).toBeInTheDocument();
  });

  it("NO renderiza ningún enlace /parlamentario/ desde un invitado", () => {
    const { container } = render(<CitacionCard {...makeProps({ invitados })} />);
    const parlamentarioLinks = container.querySelectorAll('a[href*="/parlamentario/"]');
    expect(parlamentarioLinks.length).toBe(0);
  });

  it("NO renderiza un IdentityMarker ('identidad no verificada') para invitados", () => {
    render(<CitacionCard {...makeProps({ invitados })} />);
    expect(
      screen.queryByLabelText("identidad no verificada")
    ).not.toBeInTheDocument();
  });

  it("sin invitados no muestra el bloque 'Invitados:'", () => {
    render(<CitacionCard {...makeProps({ invitados: [] })} />);
    expect(screen.queryByText(/Invitados:/)).not.toBeInTheDocument();
  });
});

describe("CitacionCard — datos + procedencia", () => {
  it("renderiza comisión, horario, sala y materia", () => {
    render(<CitacionCard {...makeProps()} />);
    expect(screen.getByText("Comisión de Hacienda")).toBeInTheDocument();
    expect(screen.getByText(/10:00 a 12:00/)).toBeInTheDocument();
    expect(screen.getByText(/Sala 2/)).toBeInTheDocument();
    expect(
      screen.getByText(/Estudio del proyecto de presupuesto/)
    ).toBeInTheDocument();
  });

  it("renderiza el ProvenanceBadge (frescura + fuente)", () => {
    render(<CitacionCard {...makeProps()} />);
    // ProvenanceBadge muestra "Actualizado ..." y el nombre de la fuente.
    expect(screen.getByText(/Actualizado/)).toBeInTheDocument();
    expect(screen.getAllByText(/Cámara/).length).toBeGreaterThan(0);
  });

  it("renderiza el chip de cámara correcto (Senado)", () => {
    render(<CitacionCard {...makeProps({ camara: "senado" })} />);
    expect(screen.getByText("Senado")).toBeInTheDocument();
  });
});
