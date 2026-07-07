import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { PatrimonioCapa1 } from "./patrimonio-capa1";
import type { PatrimonioDeclaracion } from "@/lib/parlamentario-resumen-conteos";

afterEach(cleanup);

// Símbolo de moneda o cifra con $ (F46: capa-1 patrimonio NUNCA renderiza montos).
const MONTO = /\$|\bCLP\b|\bUF\b|pesos/i;

function fixture(): PatrimonioDeclaracion[] {
  return [
    { anio: 2019, tipo: "periódica" },
    { anio: 2019, tipo: "rectificación" },
    { anio: 2022, tipo: "periódica" },
    { anio: 2026, tipo: "cese" },
  ];
}

describe("PatrimonioCapa1 — tira de declaraciones por año (55-02, F46 sin montos)", () => {
  it("muestra una mini-columna por año (altura = conteo de declaraciones) + resumen rango", () => {
    const { container } = render(
      <PatrimonioCapa1
        porDeclaracion={fixture()}
        rangoAnios={{ min: 2019, max: 2026 }}
      />,
    );
    // 3 años distintos (2019 con 2 declaraciones, 2022, 2026).
    const columnas = container.querySelectorAll("[data-anio]");
    expect(columnas).toHaveLength(3);
    // 2019 acumula 2 declaraciones.
    const col2019 = container.querySelector('[data-anio="2019"]');
    expect(col2019?.getAttribute("data-conteo")).toBe("2");
    // Resumen "4 declaraciones · 2019–2026" (las cifras Mono viven en spans → se
    // asevera sobre el textContent normalizado, no por nodo).
    const texto = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(texto).toMatch(/4 declaraciones/);
    expect(texto).toMatch(/2019.*2026/);
  });

  it("NUNCA renderiza un monto (F46) ni un conteo de ítems", () => {
    const { container } = render(
      <PatrimonioCapa1
        porDeclaracion={fixture()}
        rangoAnios={{ min: 2019, max: 2026 }}
      />,
    );
    expect(container.textContent ?? "").not.toMatch(MONTO);
  });

  it("degradación honesta con <2 declaraciones (no insinúa tendencia)", () => {
    const { container } = render(
      <PatrimonioCapa1
        porDeclaracion={[{ anio: 2021, tipo: "periódica" }]}
        rangoAnios={{ min: 2021, max: 2021 }}
      />,
    );
    expect(container.querySelectorAll("[data-anio]")).toHaveLength(0);
    expect(screen.getByText(/insuficientes/i)).toBeInTheDocument();
  });

  it("sin declaraciones (rangoAnios null) degrada honesto", () => {
    const { container } = render(
      <PatrimonioCapa1 porDeclaracion={[]} rangoAnios={null} />,
    );
    expect(container.querySelectorAll("[data-anio]")).toHaveLength(0);
  });
});
