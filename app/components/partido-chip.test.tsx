import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { PartidoChip } from "./partido-chip";

afterEach(cleanup);

/**
 * Tests de `PartidoChip` (91-UI-SPEC §Component 2 + §Color). Cubren el contrato:
 * (1) con dato → chip visible con aria-label "Partido: …, según … al …";
 * (2) sin dato (null/"") → NO renderiza nada (espejo CamaraChip desconocida);
 * (3) neutralidad de color — dos partidos distintos comparten el MISMO className de
 *     fondo (el color NUNCA codifica identidad política).
 */

describe("PartidoChip — con dato", () => {
  it("renderiza el nombre del partido y expone fuente+fecha en el aria-label", () => {
    render(
      <PartidoChip
        partido="Partido Socialista"
        fechaCaptura="2026-07-21T00:00:00Z"
        origen="camara"
      />,
    );
    // Nombre visible en el chip.
    expect(screen.getByText("Partido Socialista")).toBeInTheDocument();
    // aria-label con partido + fuente + fecha (fechaCorta → "21 jul 2026").
    const labelled = screen.getByLabelText(/Partido: Partido Socialista/);
    expect(labelled).toBeInTheDocument();
    const aria = labelled.getAttribute("aria-label") ?? "";
    expect(aria).toContain("según Cámara");
    expect(aria).toMatch(/al .*2026/);
  });
});

describe("PartidoChip — sin dato (omisión honesta)", () => {
  it("con partido null retorna null (no renderiza placeholder)", () => {
    const { container } = render(
      <PartidoChip partido={null} fechaCaptura={null} origen={null} />,
    );
    expect(container.textContent ?? "").toBe("");
    expect(container.querySelector("*")).toBeNull();
  });

  it("con partido cadena vacía retorna null", () => {
    const { container } = render(
      <PartidoChip partido="   " fechaCaptura={null} origen={null} />,
    );
    expect(container.textContent ?? "").toBe("");
  });

  it("NUNCA muestra 'Sin partido' ni placeholder", () => {
    const { container } = render(
      <PartidoChip partido={null} fechaCaptura={null} origen={null} />,
    );
    expect(container.textContent ?? "").not.toMatch(/sin partido/i);
  });
});

describe("PartidoChip — neutralidad de color (§Color LOCKED)", () => {
  it("dos partidos distintos producen el MISMO className de fondo neutro", () => {
    const { container: a } = render(
      <PartidoChip partido="Partido A" fechaCaptura={null} origen="senado" />,
    );
    const chipA = a.querySelector("[data-slot='partido-chip']");
    cleanup();
    const { container: b } = render(
      <PartidoChip partido="Partido B" fechaCaptura={null} origen="senado" />,
    );
    const chipB = b.querySelector("[data-slot='partido-chip']");
    expect(chipA).not.toBeNull();
    expect(chipB).not.toBeNull();
    expect(chipA?.className).toBe(chipB?.className);
    // El fondo es neutro (bg-muted) — jamás una paleta por partido.
    expect(chipA?.className).toContain("bg-muted");
  });
});
