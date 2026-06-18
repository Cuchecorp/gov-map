import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VotoRow } from "./voto-row";
import type { VotoRow as VotoRowData } from "@/lib/types";

afterEach(cleanup);

function makeVoto(overrides: Partial<VotoRowData> = {}): VotoRowData {
  return {
    votacion_id: "senado:1",
    mencion_nombre: "Coloma C., Juan Antonio",
    parlamentario_id: null,
    seleccion: "si",
    metodo: null,
    estado_vinculo: null,
    ...overrides,
  };
}

describe("VotoRow — guarda de identidad (TRAM-06, riesgo existencial #1)", () => {
  it("identidad confirmada + parlamentario_id → renderiza un <Link> a la ficha", () => {
    render(
      <VotoRow
        voto={makeVoto({
          parlamentario_id: "P00500",
          estado_vinculo: "confirmado",
          metodo: "determinista",
        })}
      />
    );
    const link = screen.getByRole("link", { name: /Coloma C\., Juan Antonio/ });
    expect(link).toHaveAttribute("href", "/parlamentario/P00500");
    // NO debe haber marca de identidad no verificada.
    expect(
      screen.queryByLabelText("identidad no verificada")
    ).not.toBeInTheDocument();
  });

  it("parlamentario_id null → muestra nombre crudo + IdentityMarker, NUNCA link", () => {
    render(<VotoRow voto={makeVoto({ parlamentario_id: null })} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Coloma C., Juan Antonio")).toBeInTheDocument();
    expect(screen.getByLabelText("identidad no verificada")).toBeInTheDocument();
  });

  it("estado_vinculo 'probable' (aunque traiga id) → NO link, muestra marca", () => {
    render(
      <VotoRow
        voto={makeVoto({
          parlamentario_id: "P00999",
          estado_vinculo: "probable",
          metodo: "llm",
        })}
      />
    );
    // La guarda exige estado_vinculo === 'confirmado'; 'probable' nunca vincula.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByLabelText("identidad no verificada")).toBeInTheDocument();
  });

  it("'no_confirmado' → NO link, muestra marca", () => {
    render(
      <VotoRow
        voto={makeVoto({
          parlamentario_id: null,
          estado_vinculo: "no_confirmado",
        })}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByLabelText("identidad no verificada")).toBeInTheDocument();
  });

  it("la marca usa exactamente 'identidad no verificada' (sin hedges)", () => {
    render(<VotoRow voto={makeVoto()} />);
    const marker = screen.getByLabelText("identidad no verificada");
    expect(marker.textContent).toContain("identidad no verificada");
    expect(marker.textContent).not.toMatch(/posible|probable|dudos/i);
  });

  it("renderiza el chip de selección con la etiqueta correcta", () => {
    render(<VotoRow voto={makeVoto({ seleccion: "abstencion" })} />);
    expect(screen.getByText("Abstención")).toBeInTheDocument();
  });
});
