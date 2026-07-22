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

describe("CitacionCard — badge de fecha por contrato date-only-midnight-UTC (regresión 94)", () => {
  it("una citación a 00:00Z rotula SU día publicado (parte fecha UTC = 22), NO el anterior", () => {
    // CONTRATO (ver `@/lib/dia-calendario`): `citacion.fecha` es date-only
    // almacenada a medianoche UTC — su parte fecha (2026-07-22) ES el día
    // publicado por la fuente. Interpretar 00:00Z en tz Chile fabricaría el 21
    // (regresión live detectada en Phase 94). El badge debe decir 22-jul.
    render(
      <CitacionCard
        {...makeProps({ fecha: new Date("2026-07-22T00:00:00Z") })}
      />,
    );
    expect(screen.getByText(/22-jul/i)).toBeInTheDocument();
    expect(screen.queryByText(/21-jul/i)).not.toBeInTheDocument();
  });

  it("fecha 2026-07-20T00:00Z (lunes 20 publicado) → badge '20-jul', nunca '19-jul'", () => {
    // Caso exacto de la regresión: la tz America/Santiago retrocedía a domingo 19.
    render(
      <CitacionCard
        {...makeProps({ fecha: new Date("2026-07-20T00:00:00Z") })}
      />,
    );
    expect(screen.getByText(/20-jul/i)).toBeInTheDocument();
    expect(screen.queryByText(/19-jul/i)).not.toBeInTheDocument();
  });
});

describe("CitacionCard — estado de cancelación honesto (CIT-05)", () => {
  it("estado='Suspendida' → marca sobria visible", () => {
    render(<CitacionCard {...makeProps({ estado: "Suspendida" })} />);
    expect(screen.getByText(/Suspendida/)).toBeInTheDocument();
  });

  it("estado='Sin efecto' → marca sobria visible", () => {
    render(<CitacionCard {...makeProps({ estado: "Sin efecto" })} />);
    expect(screen.getByText(/Sin efecto/)).toBeInTheDocument();
  });

  it("marca de estado NO usa color de alarma (destructive/rojo)", () => {
    const { container } = render(
      <CitacionCard {...makeProps({ estado: "Suspendida" })} />,
    );
    expect(container.innerHTML).not.toMatch(/destructive/);
    expect(container.innerHTML).not.toMatch(/\bbg-red\b|\btext-red\b/);
  });

  it("estado=null → NO renderiza marca y NUNCA añade 'Vigente'/'Confirmada'", () => {
    render(<CitacionCard {...makeProps({ estado: null })} />);
    expect(screen.queryByText(/Vigente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirmada/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Suspendida|Sin efecto/i),
    ).not.toBeInTheDocument();
  });

  it("estado ausente (prop omitida) → backward-compatible, sin marca", () => {
    render(<CitacionCard {...makeProps()} />);
    expect(
      screen.queryByText(/Vigente|Confirmada/i),
    ).not.toBeInTheDocument();
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
