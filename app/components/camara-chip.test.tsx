import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { CamaraChip } from "./camara-chip";

afterEach(cleanup);

// ── B8: CamaraChip — omitir el chip-alarma cuando la cámara no aplica ──────────
describe("CamaraChip — cámara real o nada (B8, §9.1)", () => {
  it("senado → renderiza el label 'Senado'", () => {
    render(<CamaraChip camara="senado" />);
    expect(screen.getByText("Senado")).toBeInTheDocument();
  });

  it("diputados → renderiza el label 'Cámara'", () => {
    render(<CamaraChip camara="diputados" />);
    expect(screen.getByText("Cámara")).toBeInTheDocument();
  });

  it("cámara no reconocida → el componente NO renderiza (omite el chip)", () => {
    const { container } = render(<CamaraChip camara="algo raro" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("cámara null → el componente NO renderiza (omite el chip)", () => {
    const { container } = render(<CamaraChip camara={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("NUNCA renderiza el literal 'Cámara origen desconocida' (negative-match)", () => {
    const { container: c1 } = render(<CamaraChip camara={null} />);
    expect(c1.textContent).not.toContain("desconocida");
    cleanup();
    const { container: c2 } = render(<CamaraChip camara="senado" />);
    expect(c2.textContent).not.toContain("desconocida");
    cleanup();
    const { container: c3 } = render(<CamaraChip camara="diputados" />);
    expect(c3.textContent).not.toContain("desconocida");
  });
});
