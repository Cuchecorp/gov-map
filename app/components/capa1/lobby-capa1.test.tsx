import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { LobbyCapa1 } from "./lobby-capa1";
import type { LobbyMateria } from "@/lib/parlamentario-resumen-conteos";

afterEach(cleanup);

// Valla anti-insinuación (§9.1, mirror verbatim de cruces/lobby-de-parlamentario.test).
const PROHIBIDO =
  /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|posible conflicto|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;

function fixture(): LobbyMateria[] {
  return [
    { materia: "Salud", n: 5 },
    { materia: "Educación", n: 3 },
    { materia: "Vivienda", n: 2 },
  ];
}

describe("LobbyCapa1 — resumen preatentivo de lobby (55-02)", () => {
  it("muestra barras top-N por materia (asunto verbatim) + conteo total", () => {
    const { container } = render(<LobbyCapa1 topMaterias={fixture()} total={10} />);
    const barras = container.querySelectorAll("li");
    expect(barras).toHaveLength(3);
    // orden preservado (ya viene rankeado desc del productor).
    expect(barras[0].textContent).toContain("Salud");
    expect(barras[1].textContent).toContain("Educación");
    // conteo total neutro.
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText(/reuniones/)).toBeInTheDocument();
  });

  it("usa color NEUTRO en las barras, NUNCA petróleo", () => {
    const { container } = render(<LobbyCapa1 topMaterias={fixture()} total={10} />);
    const html = container.innerHTML;
    expect(html).toMatch(/bg-muted-foreground/);
    expect(html).not.toMatch(/accent-product/);
  });

  it("degradación honesta: sin materias publicadas muestra solo el conteo total", () => {
    const { container } = render(<LobbyCapa1 topMaterias={[]} total={4} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/reuniones/)).toBeInTheDocument();
  });

  it("CERO vocabulario causal/insinuante (negative-match §9.1)", () => {
    const { container } = render(<LobbyCapa1 topMaterias={fixture()} total={10} />);
    expect(container.textContent ?? "").not.toMatch(PROHIBIDO);
  });
});
