import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { CrucesCapa1 } from "./cruces-capa1";
import type { CruceSector } from "@/lib/parlamentario-resumen-conteos";

afterEach(cleanup);

const CAVEAT =
  "La coincidencia temporal no implica relación entre la reunión y el voto.";

// Valla anti-insinuación (§9.1) — conteos lado a lado nunca componen una relación.
const PROHIBIDO =
  /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|posible conflicto|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;

function fixture(): CruceSector[] {
  return [
    { sector: "Energía", nReuniones: 5, nVotos: 0 },
    { sector: "Salud", nReuniones: 3, nVotos: 2 },
  ];
}

describe("CrucesCapa1 — resumen petróleo-framed (55-02)", () => {
  it("usa petróleo en el marco y el h2 (único acento de la página); NO renderiza un CTA anchor propio", () => {
    const { container } = render(<CrucesCapa1 sectores={fixture()} />);
    // Marco petróleo.
    const marco = container.querySelector(".border-accent-product");
    expect(marco).toBeTruthy();
    // h2 en petróleo.
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.className).toContain("text-accent-product");
    // El CTA "Explorar los N cruces" ya NO vive aquí: es el trigger del
    // DetalleColapsable (variante primary) en la página → sin doble control.
    expect(
      screen.queryByRole("link", { name: /Explorar los .* cruces/ }),
    ).toBeNull();
    expect(container.querySelector('a[href="#cruces-detalle"]')).toBeNull();
  });

  it("chips 'sector · N reuniones' neutros; '· M votos' SOLO cuando nVotos>0", () => {
    const { container } = render(<CrucesCapa1 sectores={fixture()} />);
    const chips = container.querySelectorAll("li");
    expect(chips).toHaveLength(2);
    // El chip usa layout inline-block (NO inline-flex): así el separador " · " conserva
    // sus espacios y no se colapsa a "sector·Nreuniones".
    expect(chips[0].className).toContain("inline-block");
    expect(chips[0].className).not.toContain("inline-flex");
    // Energía: nVotos 0 → sin la dimensión de votos (omisión honesta).
    expect(chips[0].textContent).toContain("Energía");
    expect(chips[0].textContent).toContain("5 reuniones");
    // El " · N reuniones" conserva los espacios alrededor del separador.
    expect(chips[0].textContent ?? "").toMatch(/·\s+5\s+reuniones/);
    expect(chips[0].textContent).not.toContain("votos");
    // Salud: nVotos 2 → conteos lado a lado, NUNCA en una frase causal.
    expect(chips[1].textContent).toContain("3 reuniones");
    expect(chips[1].textContent).toContain("2 votos");
  });

  it("muestra el conteo 3-estado honesto junto al h2 cuando el server lo pasa (IN-01)", () => {
    render(<CrucesCapa1 sectores={fixture()} conteo="sin registros" />);
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.textContent).toContain("Cruces con sectores");
    expect(h2.textContent).toContain("sin registros");
  });

  it("muestra el caveat de cruces EXACTAMENTE 1×", () => {
    render(<CrucesCapa1 sectores={fixture()} />);
    expect(screen.getAllByText(CAVEAT)).toHaveLength(1);
  });

  it("CERO vocabulario causal/insinuante (negative-match §9.1)", () => {
    const { container } = render(<CrucesCapa1 sectores={fixture()} />);
    expect(container.textContent ?? "").not.toMatch(PROHIBIDO);
  });
});
