import { readFileSync } from "node:fs";

import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VotosChart } from "./votos-chart";
import type { VotoPeriodo } from "./votos-por-parlamentario";

// ── Mock de Recharts en jsdom (espejo patrimonio-chart.test.tsx :22-55) ─────────
// Recharts mide el DOM (ResizeObserver → 0 en jsdom): no probamos el lienzo SVG,
// sino "isla montada" (data-testid) + accesibilidad del contenedor.
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

vi.mock("recharts", async () => {
  const React = await import("react");
  const passthrough =
    (testid?: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        "div",
        testid ? { "data-testid": testid } : {},
        children,
      );
  return {
    ResponsiveContainer: passthrough("rc-responsive"),
    BarChart: passthrough("rc-barchart"),
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

afterEach(cleanup);

function makePeriodo(overrides: Partial<VotoPeriodo> = {}): VotoPeriodo {
  return {
    periodo: "2024 · T2",
    si: 0,
    no: 0,
    abstencion: 0,
    pareo: 0,
    ausente: 0,
    ...overrides,
  };
}

// ── VIZ-02: la isla es client-only y nunca filtra el cliente Supabase ───────────
describe('votos-chart.tsx — isla "use client" sin fuga (VIZ-02, T-47-01)', () => {
  const fuente = readFileSync(
    `${import.meta.dirname}/votos-chart.tsx`,
    "utf8",
  );

  it('empieza con "use client", importa recharts y VotoPeriodo SOLO como type', () => {
    expect(fuente).toMatch(/^"use client"/);
    expect(fuente).toMatch(/from "recharts"/);
    // El tipo cruza la frontera como `import type` (erased), nunca runtime.
    expect(fuente).toMatch(/import type \{[^}]*VotoPeriodo[^}]*\}/);
  });

  it("NUNCA importa el cliente server-only de Supabase", () => {
    expect(fuente).not.toMatch(/createServerSupabase/);
    expect(fuente).not.toMatch(/@\/lib\/supabase/);
  });

  it("NUNCA usa LineChart/AreaChart/<Line/<Area (no fabrica trayectoria) — T-47-02", () => {
    expect(fuente).not.toMatch(/LineChart|AreaChart|<Line|<Area/);
  });

  it("NUNCA runtime edge ni petróleo/--accent-product en fills", () => {
    expect(fuente).not.toMatch(/runtime\s*=\s*["']edge["']/);
    expect(fuente).not.toMatch(/--accent-product/);
  });

  it("clava el eje X en `periodo` y apila con stackId=\"votos\"", () => {
    expect(fuente).toMatch(/dataKey="periodo"/);
    expect(fuente).toMatch(/stackId="votos"/);
  });
});

// ── VIZ-02: RTL con recharts mockeado — monta la isla + a11y ────────────────────
describe("VotosChart — monta la isla y es accesible (VIZ-02)", () => {
  it("con ≥1 periodo monta rc-barchart", () => {
    render(<VotosChart periodos={[makePeriodo({ si: 2, no: 1 })]} />);
    expect(screen.getByTestId("rc-barchart")).toBeInTheDocument();
  });

  it('el contenedor tiene role="img" + aria-label prescrito', () => {
    render(<VotosChart periodos={[makePeriodo({ si: 1 })]} />);
    const img = screen.getByRole("img", {
      name: "Número de votos por trimestre y sentido del voto",
    });
    expect(img).toBeInTheDocument();
  });
});
