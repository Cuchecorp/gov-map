import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  LobbyMencionesView,
  LEYENDA_MENCIONES_LOBBY,
  EMPTY_MENCIONES_LOBBY,
  type LobbyMencionRow,
} from "./lobby-menciones-de-boletin";

afterEach(cleanup);

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeMencion(overrides: Partial<LobbyMencionRow> = {}): LobbyMencionRow {
  return {
    identificador: "AQ001AW1442944",
    fecha: "2026-05-14T13:00:00Z",
    materia: "Discutir el boletín 14309-04 sobre reforma al sistema de salud.",
    parlamentario_id: "P00001",
    parlamentario_nombre: "juana rosa pérez",
    contraparte_nombre: "Inmobiliaria Andes SpA",
    contraparte_rol: "gestor de intereses",
    representado: "Andes Holding",
    enlace_detalle:
      "https://www.leylobby.gob.cl/instituciones/AQ001/audiencias/2026/AW1442944",
    origen: "leylobby.gob.cl",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: null,
    total_n: 1,
    ...overrides,
  };
}

describe("LobbyMencionesView — sección de menciones explícitas", () => {
  it("muestra heading LOCKED + leyenda anti-causal LOCKED", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    expect(
      screen.getByRole("heading", {
        name: "Audiencias de lobby que mencionan este boletín",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(LEYENDA_MENCIONES_LOBBY)).toBeInTheDocument();
  });

  it("enlaza el parlamentario a /parlamentario/{id} (navegación bidireccional LOB-03)", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    const link = screen.getByRole("link", { name: /juana/i });
    expect(link).toHaveAttribute("href", "/parlamentario/P00001");
    // acento petróleo (color de enlace navegable) — no color semántico de alerta.
    expect(link.className).toContain("text-accent-product");
  });

  it("renderiza la materia COMPLETA en bloque whitespace-pre-line (sin clamp)", () => {
    const materia = "Línea 1 del asunto.\nLínea 2 con más detalle verbatim.";
    render(<LobbyMencionesView rows={[makeMencion({ materia })]} />);
    const asunto = screen.getByText(/Línea 2 con más detalle/);
    // el contenedor de la materia es whitespace-pre-line leading-relaxed, jamás clamp.
    const bloque = asunto.closest("div")!;
    expect(bloque.className).toContain("whitespace-pre-line");
    expect(bloque.className).toContain("leading-relaxed");
    expect(bloque.className).not.toContain("line-clamp");
    expect(bloque.className).not.toContain("truncate");
    expect(bloque.className).not.toContain("max-h");
  });

  it("muestra la contraparte como texto plano SIN enlace (nunca RUT, nunca link)", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    const contraparte = screen.getByText(/Inmobiliaria Andes SpA/);
    // No es un <a> ni un <Link> (texto crudo verbatim).
    expect(contraparte.closest("a")).toBeNull();
    expect(screen.getByText(/gestor de intereses/)).toBeInTheDocument();
  });

  it("conteo honesto singular", () => {
    render(<LobbyMencionesView rows={[makeMencion({ total_n: 1 })]} />);
    expect(
      screen.getByText(/audiencia registrada menciona/),
    ).toBeInTheDocument();
  });

  it("conteo honesto plural", () => {
    const rows = [
      makeMencion({ identificador: "A1", total_n: 2 }),
      makeMencion({ identificador: "A2", total_n: 2 }),
    ];
    render(<LobbyMencionesView rows={rows} />);
    expect(
      screen.getByText(/audiencias registradas mencionan/),
    ).toBeInTheDocument();
  });

  it("conteo truncado usa la variante total_n cuando las filas < total", () => {
    // 2 filas mostradas pero total_n=50 (LIMIT bounded alcanzado).
    const rows = [
      makeMencion({ identificador: "A1", total_n: 50 }),
      makeMencion({ identificador: "A2", total_n: 50 }),
    ];
    render(<LobbyMencionesView rows={rows} />);
    expect(
      screen.getByText(/Se muestran las/),
    ).toBeInTheDocument();
    expect(screen.getByText(/audiencias más/)).toBeInTheDocument();
  });

  it("empty honesto verbatim (0 menciones) — NUNCA 'sin lobby'; mantiene heading + leyenda", () => {
    render(<LobbyMencionesView rows={[]} />);
    expect(
      screen.getByRole("heading", {
        name: "Audiencias de lobby que mencionan este boletín",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(LEYENDA_MENCIONES_LOBBY)).toBeInTheDocument();
    expect(screen.getByText(EMPTY_MENCIONES_LOBBY)).toBeInTheDocument();
  });

  it("provenance: 'Ver fuente oficial ↗' presente cuando hay enlace_detalle", () => {
    render(<LobbyMencionesView rows={[makeMencion()]} />);
    expect(
      screen.getByRole("link", { name: /Ver fuente oficial/ }),
    ).toHaveAttribute("target", "_blank");
  });

  it("provenance: 'Ver fuente oficial ↗' omitido cuando enlace_detalle es null (nunca fabricado)", () => {
    render(<LobbyMencionesView rows={[makeMencion({ enlace_detalle: null })]} />);
    expect(
      screen.queryByRole("link", { name: /Ver fuente oficial/ }),
    ).toBeNull();
  });

  it("la leyenda LOCKED contiene 'influencia' y 'relación causal' en contexto que las NIEGA", () => {
    // Guard de single-source: si el copy cambia y deja de negar, el linter fallará.
    expect(LEYENDA_MENCIONES_LOBBY).toMatch(/no implica influencia/);
    expect(LEYENDA_MENCIONES_LOBBY).toMatch(/ni relación causal/);
    expect(EMPTY_MENCIONES_LOBBY).toMatch(/no describe la actividad de lobby/);
  });
});
