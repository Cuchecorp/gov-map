import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { AusenciasContexto } from "./ausencias-contexto";
import type { AusenciaContextoRow } from "@/lib/types";

afterEach(cleanup);

// RUT de persona natural — NUNCA en esta superficie pública (LEGAL-03).
const PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;

// Fixture base con números que producen "0,7%" (1/141) y "3,2%" (0,032) — espejo
// de los valores PROD de D1012 documentados en 49-01-SUMMARY.
function makeRow(
  overrides: Partial<AusenciaContextoRow> = {},
): AusenciaContextoRow {
  return {
    n_ausencias: 1,
    m_votaciones: 141,
    tasa_propia: 1 / 141,
    mediana_camara: 0.032,
    k_parlamentarios: 155,
    camara: "diputados",
    ...overrides,
  };
}

describe("AusenciasContexto — sub-bloque factual del comparativo (VIZ-03)", () => {
  it("Test 1: data null → NO renderiza nada (degrade honesto, container vacío)", () => {
    const { container } = render(<AusenciasContexto data={null} />);
    expect(container.textContent).toBe("");
  });

  it("Test 2: shape completo → 3 líneas del copy contract verbatim", () => {
    const { container } = render(<AusenciasContexto data={makeRow()} />);
    const texto = container.textContent ?? "";
    expect(texto).toContain("Ausente en 1 de 141 votaciones (0,7%).");
    expect(texto).toContain("Mediana de su cámara: 3,2% (155 parlamentarios).");
    expect(texto).toContain(
      "Sobre las votaciones ingestadas por este observatorio, no la historia completa.",
    );
  });

  it("Test 3: mediana_camara null → OMITE la línea de mediana; tasa propia + caveat siguen", () => {
    const { container } = render(
      <AusenciasContexto data={makeRow({ mediana_camara: null })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("Ausente en 1 de 141 votaciones (0,7%).");
    expect(texto).not.toContain("Mediana de su cámara");
    expect(texto).toContain(
      "Sobre las votaciones ingestadas por este observatorio, no la historia completa.",
    );
  });

  it("Test 4: K=1 → singular 'parlamentario'; cifras en font-mono tabular-nums, sin font-bold", () => {
    const { container } = render(
      <AusenciasContexto
        data={makeRow({ mediana_camara: 0.05, k_parlamentarios: 1 })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("(1 parlamentario).");
    expect(texto).not.toContain("(1 parlamentarios).");

    // Todas las cifras en Mono tabular; ninguna en bold (un % en negrita/color = veredicto).
    const monos = container.querySelectorAll("span.font-mono");
    expect(monos.length).toBeGreaterThanOrEqual(5); // N, M, X%, Y%, K
    for (const s of monos) {
      expect(s.className).toContain("tabular-nums");
    }
    expect(container.querySelector(".font-bold")).toBeNull();
    expect(container.innerHTML).not.toMatch(/font-bold|font-weight:\s*(?:700|bold)/i);
    expect(texto).not.toMatch(PATRON_RUT);
  });
});

// ── Task 2: anti-insinuación (LOCKED 49-UI-SPEC §Anti-Insinuación) ──────────────
// El % es un HECHO entre hechos, jamás un veredicto: cero superlativo, cero ranking,
// cero comparativo-entre-parlamentarios, cero causalidad. El negative-match se
// EXTIENDE (NEW LOCKED) más allá del vocabulario causal heredado.
describe("AusenciasContexto — negative-match extendido + causal (anti-insinuación)", () => {
  // NEW LOCKED (49): superlativo/ranking nominal/comparativo-entre-parlamentarios.
  const PROHIBIDO_EXTENDIDO =
    /top|más ausente|mas ausente|peor|mejor asistencia|récord|record/i;
  // Heredado F55/F47/SIGNOFF: causalidad, score/ranking, tendencia afirmada.
  const PROHIBIDO_CAUSAL =
    /afinidad|influencia|conexión|presión|a cambio de|gracias a|porque|score|ranking|índice de|tendencia/i;

  it("render completo con mediana → sin negative-match extendido ni causal ni RUT", () => {
    const { container } = render(<AusenciasContexto data={makeRow()} />);
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO_EXTENDIDO);
    expect(texto).not.toMatch(PROHIBIDO_CAUSAL);
    expect(texto).not.toMatch(PATRON_RUT);
  });

  it("render sin mediana → tampoco introduce vocabulario prohibido", () => {
    const { container } = render(
      <AusenciasContexto data={makeRow({ mediana_camara: null })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO_EXTENDIDO);
    expect(texto).not.toMatch(PROHIBIDO_CAUSAL);
  });

  it("el heading es neutro, NO superlativo (pregunta factual, COMP-03)", () => {
    const { container } = render(<AusenciasContexto data={makeRow()} />);
    const h3 = container.querySelector("h3");
    expect(h3?.textContent).toMatch(/falta más o menos/i);
    expect(h3?.textContent ?? "").not.toMatch(PROHIBIDO_EXTENDIDO);
    expect(h3?.textContent ?? "").not.toMatch(PROHIBIDO_CAUSAL);
  });
});
