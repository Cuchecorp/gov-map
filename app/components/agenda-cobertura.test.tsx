import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  AgendaCobertura,
  type CoberturaCamaraMetrica,
} from "./agenda-cobertura";

afterEach(cleanup);

function makeMetrica(
  overrides: Partial<CoberturaCamaraMetrica> = {},
): CoberturaCamaraMetrica {
  return {
    camaraN: 164,
    camaraSemanas: 9,
    camaraMin: "2026-05-11",
    camaraMax: "2026-07-22",
    ...overrides,
  };
}

describe("AgendaCobertura — banner de cobertura DECLARADA (CIT-05)", () => {
  it("intro LOCKED siempre visible (no es calendario completo)", () => {
    render(<AgendaCobertura metrica={makeMetrica()} />);
    expect(
      screen.getByText(/no es un calendario completo del Congreso/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/lo que se ha ingerido de las fuentes oficiales/i),
    ).toBeInTheDocument();
  });

  it("heading sobrio 'Cobertura de la agenda'", () => {
    render(<AgendaCobertura metrica={makeMetrica()} />);
    expect(
      screen.getByRole("heading", { name: /Cobertura de la agenda/i }),
    ).toBeInTheDocument();
  });

  it("celda Cámara comisiones interpola N/S/rango DERIVADOS de la métrica en font-mono", () => {
    render(
      <AgendaCobertura
        metrica={makeMetrica({
          camaraN: 164,
          camaraSemanas: 9,
          camaraMin: "2026-05-11",
          camaraMax: "2026-07-22",
        })}
      />,
    );
    // N citaciones y S semanas verbatim de la métrica.
    const celda = screen.getByText(/Comisiones de la Cámara/i);
    expect(celda.textContent).toContain("164");
    expect(celda.textContent).toContain("9 semanas");
    // Los números y el rango viven en un nodo font-mono.
    const mono = celda.querySelectorAll(".font-mono");
    expect(mono.length).toBeGreaterThan(0);
    const monoText = Array.from(mono)
      .map((n) => n.textContent)
      .join(" ");
    expect(monoText).toContain("164");
    expect(monoText).toContain("2026-05-11");
    expect(monoText).toContain("2026-07-22");
  });

  it("las tres celdas estructurales usan texto fijo LOCKED verbatim (Senado forward-only, sala Cámara vigente, sala Senado forward-only)", () => {
    render(<AgendaCobertura metrica={makeMetrica()} />);
    expect(
      screen.getByText(/Comisiones del Senado:.*forward-only/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tabla de sala de la Cámara:.*solo la sesión vigente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tabla de sala del Senado:.*forward-only/i),
    ).toBeInTheDocument();
  });

  it("leyenda de estado LOCKED presente (ausencia de marca ≠ vigencia confirmada)", () => {
    render(<AgendaCobertura metrica={makeMetrica()} />);
    expect(
      screen.getByText(
        /no confirma que la sesión se realizará/i,
      ),
    ).toBeInTheDocument();
  });

  it("tono sobrio: NO usa clases de alarma (destructive) ni ámbar/rojo", () => {
    const { container } = render(<AgendaCobertura metrica={makeMetrica()} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/destructive/);
    expect(html).not.toMatch(/\bbg-red\b|\btext-red\b|\bamber\b/);
  });
});
