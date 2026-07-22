import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ParlamentarioHeader } from "./parlamentario-header";
import type { ParlamentarioPublicoRow } from "@/lib/types";

afterEach(cleanup);

/**
 * Tests de `ParlamentarioHeader` (LEG2 §2.1 + 91-02). Cubren: enriquecimiento con
 * "Período {periodo}" (Mono) cuando el RPC lo trae, omisión honesta cuando es
 * null, y la REVERSIÓN LEGAL-03 (decisión operador 2026-07-21): el partido del
 * cargo electo SÍ se muestra (PartidoChip neutro con fuente+fecha), se OMITE si es
 * null, y el piso de PII dura se conserva — NUNCA rut/email en el DOM.
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

// ── 91-02: reversión LEGAL-03 — partido público, PII dura intacta ─────────────
describe("ParlamentarioHeader — partido (reversión LEGAL-03, 2026-07-21)", () => {
  it("con partido presente renderiza el PartidoChip (nombre + aria-label con fuente+fecha)", () => {
    const { container } = render(
      <ParlamentarioHeader
        parlamentario={make({
          partido: "Partido Socialista",
          partido_fecha_captura: "2026-07-21T00:00:00Z",
          partido_origen: "camara",
        })}
      />,
    );
    expect((container.textContent ?? "")).toContain("Partido Socialista");
    const chip = screen.getByLabelText(/Partido: Partido Socialista/);
    expect(chip.getAttribute("aria-label") ?? "").toContain("según Cámara");
  });

  it("con partido null OMITE el chip (no 'Sin partido' ni placeholder)", () => {
    const { container } = render(
      <ParlamentarioHeader parlamentario={make({ partido: null })} />,
    );
    expect(container.textContent ?? "").not.toMatch(/sin partido/i);
    expect(screen.queryByLabelText(/^Partido:/)).not.toBeInTheDocument();
  });

  it("no renderiza rut ni email (piso de PII dura intacto)", () => {
    const { container } = render(
      <ParlamentarioHeader
        parlamentario={make({ partido: "Partido X", partido_origen: "senado" })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/\brut\b|correo|e-?mail/i);
  });
});
