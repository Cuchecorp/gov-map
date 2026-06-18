import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VotacionBar } from "./votacion-bar";

afterEach(cleanup);

describe("VotacionBar — barra CSS accesible (UI-SPEC §3.3 / §8)", () => {
  it("total 0 → barra muted con 'Sin datos de votación'", () => {
    render(<VotacionBar si={0} no={0} abstencion={0} pareo={0} />);
    expect(screen.getByText("Sin datos de votación")).toBeInTheDocument();
  });

  it("con votos → cada segmento lleva aria-label con su conteo (no solo color)", () => {
    render(<VotacionBar si={80} no={40} abstencion={5} pareo={1} />);
    expect(screen.getByLabelText("Sí: 80")).toBeInTheDocument();
    expect(screen.getByLabelText("No: 40")).toBeInTheDocument();
    expect(screen.getByLabelText("Abstención: 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Pareo: 1")).toBeInTheDocument();
  });

  it("segmentos con conteo 0 no se renderizan", () => {
    render(<VotacionBar si={10} no={0} abstencion={0} pareo={0} />);
    expect(screen.getByLabelText("Sí: 10")).toBeInTheDocument();
    expect(screen.queryByLabelText("No: 0")).not.toBeInTheDocument();
  });
});
