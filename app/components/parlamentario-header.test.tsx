import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ParlamentarioHeader } from "./parlamentario-header";
import type { ParlamentarioPublicoRow } from "@/lib/types";

afterEach(cleanup);

/**
 * Tests de `ParlamentarioHeader` (LEG2 §2.1). Cubren: enriquecimiento con
 * "Período {periodo}" (Mono) cuando el RPC lo trae, omisión honesta cuando es
 * null, y la invariante LEGAL-03 dura — NUNCA partido/afiliación en el DOM.
 * Sólo se usan campos de `ParlamentarioPublicoRow` (el RPC no emite otros).
 */

// ── Fixture ──────────────────────────────────────────────────────────────────
const BASE: ParlamentarioPublicoRow = {
  id: "P0001",
  nombre: "María Ejemplo",
  camara: "diputados",
  region: "Región de Valparaíso",
  distrito: "7",
  circunscripcion: null,
  periodo: "2022-2026",
  origen: "camara",
  fecha_captura: "2026-01-15T00:00:00Z",
  enlace: "https://www.camara.cl/diputado/1",
  // Phase 91 (0060): la fila v2 trae partido; el fixture usa null (sin militancia
  // vigente) para no alterar las aserciones de este test — el MONTAJE del chip de
  // partido (decisión operador 2026-07-21) vive en los planes de UI 02/03.
  partido: null,
  partido_fecha_captura: null,
  partido_origen: null,
};

function make(overrides: Partial<ParlamentarioPublicoRow> = {}): ParlamentarioPublicoRow {
  return { ...BASE, ...overrides };
}

// ── Período presente ─────────────────────────────────────────────────────────
describe("ParlamentarioHeader — período (LEG2 §2.1)", () => {
  it("con periodo presente muestra 'Período {periodo}' con el valor en Mono", () => {
    const { container } = render(<ParlamentarioHeader parlamentario={make()} />);
    expect(container.textContent ?? "").toContain("Período 2022-2026");
    const valor = screen.getByText("2022-2026");
    expect(valor.className).toContain("font-mono");
  });

  it("con periodo null NO aparece la etiqueta de período (ni 'Período ' suelto)", () => {
    const { container } = render(
      <ParlamentarioHeader parlamentario={make({ periodo: null })} />,
    );
    expect(screen.queryByText(/Período/)).not.toBeInTheDocument();
    expect(container.textContent ?? "").not.toContain("Período");
  });

  it("sigue mostrando distrito y región (campos públicos) junto al período", () => {
    const { container } = render(<ParlamentarioHeader parlamentario={make()} />);
    const texto = container.textContent ?? "";
    expect(texto).toContain("Distrito 7");
    expect(texto).toContain("Región de Valparaíso");
  });
});

// ── LEGAL-03: ningún campo PII/afiliación llega al DOM ────────────────────────
describe("ParlamentarioHeader — LEGAL-03 (sin PII/afiliación)", () => {
  it("el DOM NO contiene referencia a partido/afiliación", () => {
    const { container } = render(<ParlamentarioHeader parlamentario={make()} />);
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/partido|afiliaci|bancada|militancia/i);
  });

  it("no renderiza rut ni email aunque el nombre/valores sean legibles", () => {
    const { container } = render(<ParlamentarioHeader parlamentario={make()} />);
    const texto = container.textContent ?? "";
    // El fixture ni siquiera trae rut/email (el RPC no los emite); el header
    // jamás debe introducir esas etiquetas.
    expect(texto).not.toMatch(/\brut\b|correo|e-?mail/i);
  });
});
