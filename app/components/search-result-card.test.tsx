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
    expect(screen.getByText(/según fuente al/)).toBeInTheDocument();
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

describe("SearchResultCard — BENTO-04 radius primer nivel (79-01)", () => {
  it("la tarjeta de primer nivel lleva rounded-[var(--radius-tile)]", () => {
    const { container } = render(<SearchResultCard {...makeProps()} />);
    expect(container.innerHTML).toContain("rounded-[var(--radius-tile)]");
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

// ── F-12 — el chip de año dice DE QUÉ año se trata ────────────────────────────
describe("F-12 — chip de año rotulado", () => {
  it("anio={2021} → 'primer trámite 2021'; el año NUNCA va pelado", () => {
    const { container } = render(<SearchResultCard {...makeProps({ anio: 2021 })} />);
    expect(container.textContent ?? "").toContain("primer trámite 2021");
  });

  it("anio={null} → conserva 'Sin dato' sin inventar año ni componer el rótulo", () => {
    const { container } = render(<SearchResultCard {...makeProps({ anio: null })} />);
    const texto = container.textContent ?? "";
    expect(texto).toContain("Sin dato");
    // El rótulo se compone SOLO en la rama no-nula del ternario: envolver el
    // ternario completo produciría la frase absurda "primer trámite Sin dato".
    expect(texto).not.toMatch(/primer trámite Sin dato/);
  });

  it("sin la prop anio → no se renderiza chip de año (comportamiento previo intacto)", () => {
    const props = makeProps();
    delete (props as { anio?: number | null }).anio;
    const { container } = render(<SearchResultCard {...props} />);
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("primer trámite");
    expect(texto).not.toContain("Sin dato");
  });
});
