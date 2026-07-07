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

describe("CrucesCapa1 — resumen petróleo-framed + CTA (55-02)", () => {
  it("usa petróleo en el marco, el h2 y el CTA primario (único acento de la página)", () => {
    const { container } = render(<CrucesCapa1 sectores={fixture()} total={8} />);
    // Marco petróleo.
    const marco = container.querySelector(".border-accent-product");
    expect(marco).toBeTruthy();
    // h2 en petróleo.
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.className).toContain("text-accent-product");
    // CTA primario petróleo: un ANCLA real al detalle (no un botón inerte sin handler).
    const cta = screen.getByRole("link", { name: /Explorar los 8 cruces/ });
    expect(cta.className).toContain("bg-accent-product");
    expect(cta.getAttribute("href")).toBe("#cruces-detalle");
  });

  it("el CTA respeta un detalleHref explícito (ancla al DetalleColapsable de cruces)", () => {
    render(
      <CrucesCapa1 sectores={fixture()} total={8} detalleHref="#otro-detalle" />,
    );
    const cta = screen.getByRole("link", { name: /Explorar los 8 cruces/ });
    expect(cta.getAttribute("href")).toBe("#otro-detalle");
  });

  it("chips 'sector · N reuniones' neutros; '· M votos' SOLO cuando nVotos>0", () => {
    const { container } = render(<CrucesCapa1 sectores={fixture()} total={8} />);
    const chips = container.querySelectorAll("li");
    expect(chips).toHaveLength(2);
    // Energía: nVotos 0 → sin la dimensión de votos (omisión honesta).
    expect(chips[0].textContent).toContain("Energía");
    expect(chips[0].textContent).toContain("5 reuniones");
    expect(chips[0].textContent).not.toContain("votos");
    // Salud: nVotos 2 → conteos lado a lado, NUNCA en una frase causal.
    expect(chips[1].textContent).toContain("3 reuniones");
    expect(chips[1].textContent).toContain("2 votos");
  });

  it("muestra el caveat de cruces EXACTAMENTE 1×", () => {
    render(<CrucesCapa1 sectores={fixture()} total={8} />);
    expect(screen.getAllByText(CAVEAT)).toHaveLength(1);
  });

  it("CERO vocabulario causal/insinuante (negative-match §9.1)", () => {
    const { container } = render(<CrucesCapa1 sectores={fixture()} total={8} />);
    expect(container.textContent ?? "").not.toMatch(PROHIBIDO);
  });
});
