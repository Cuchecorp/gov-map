import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { AutoresList } from "./autores-list";

afterEach(cleanup);

// ── B15: AutoresList — distinguir Mensaje sin fabricar ausencias ───────────────
describe("AutoresList — Mensaje vs Moción vs autores (B15, §9.1)", () => {
  it("Mensaje sin autores → 'Iniciativa del Ejecutivo (Mensaje).'", () => {
    render(<AutoresList autores={[]} iniciativa="Mensaje" />);
    expect(
      screen.getByText("Iniciativa del Ejecutivo (Mensaje)."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Autores no informados.")).not.toBeInTheDocument();
  });

  it("Moción sin autores → 'Autores no informados.' (honesto, no se fabrica)", () => {
    render(<AutoresList autores={[]} iniciativa="Moción" />);
    expect(screen.getByText("Autores no informados.")).toBeInTheDocument();
  });

  it("iniciativa null sin autores → 'Autores no informados.' (ruta Cámara, honesto)", () => {
    render(<AutoresList autores={[]} iniciativa={null} />);
    expect(screen.getByText("Autores no informados.")).toBeInTheDocument();
  });

  it("con autores → lista los nombres (ignora iniciativa)", () => {
    render(
      <AutoresList
        autores={["Diputada X", "Senador Y"]}
        iniciativa="Mensaje"
      />,
    );
    expect(screen.getByText(/Diputada X, Senador Y/)).toBeInTheDocument();
    expect(
      screen.queryByText("Iniciativa del Ejecutivo (Mensaje)."),
    ).not.toBeInTheDocument();
  });
});
