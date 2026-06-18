import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  SearchResultCard,
  type SearchResultCardProps,
} from "./search-result-card";

afterEach(cleanup);

function makeProps(
  overrides: Partial<SearchResultCardProps> = {},
): SearchResultCardProps {
  return {
    boletin: "15234-07",
    titulo: "Proyecto que regula la protección de datos personales",
    materia: "Protección de datos personales y agencia de control",
    estado: "En tramitación",
    camaraOrigen: "senado",
    provenance: {
      capturedAt: new Date("2026-06-16T12:00:00Z"),
      sourceName: "Senado",
      sourceUrl: "https://www.senado.cl/proyecto/15234-07",
    },
    ...overrides,
  };
}

describe("SearchResultCard — trazabilidad y enlace a la ficha", () => {
  it("renderiza el boletín, el título como Link a /proyecto/{boletin} y los badges", () => {
    render(<SearchResultCard {...makeProps()} />);

    expect(screen.getByText(/Boletín N°15234-07/)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /protección de datos personales/i });
    expect(link).toHaveAttribute("href", "/proyecto/15234-07");
    // Enlace interno: nunca abre en pestaña nueva.
    expect(link).not.toHaveAttribute("target", "_blank");

    // CamaraChip (Senado) + ProvenanceBadge presentes. "Senado" aparece dos
    // veces (chip de cámara + nombre de fuente) — getAllByText como en CitacionCard.
    expect(screen.getAllByText("Senado").length).toBeGreaterThan(0);
    expect(screen.getByText(/Actualizado/)).toBeInTheDocument();
  });

  it("renderiza la materia (line-clamp) y no rompe sin materia", () => {
    render(<SearchResultCard {...makeProps()} />);
    expect(
      screen.getByText(/Protección de datos personales y agencia de control/),
    ).toBeInTheDocument();

    cleanup();
    render(<SearchResultCard {...makeProps({ materia: null })} />);
    // Sin materia el título sigue presente; no se rompe.
    expect(
      screen.getByRole("link", { name: /protección de datos personales/i }),
    ).toBeInTheDocument();
  });
});

describe("SearchResultCard — sin score (UI-SPEC §5)", () => {
  it("NO renderiza ningún número de similitud / distancia / % match", () => {
    const { container } = render(<SearchResultCard {...makeProps()} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/similarity/i);
    expect(text).not.toMatch(/distance/i);
    expect(text).not.toMatch(/%\s*match/i);
    // No hay un score numérico tipo "0.87" o "87%" en el card.
    expect(text).not.toMatch(/\b0\.\d{2,}\b/);
    expect(text).not.toMatch(/\b\d{1,3}%/);
  });
});
