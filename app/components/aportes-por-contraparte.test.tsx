import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  AportesPorContraparteView,
  type AportesPorContraparteViewData,
  type AporteContraparteRow,
} from "./aportes-por-contraparte";

afterEach(cleanup);

// Vocabulario causal/afinidad PROHIBIDO en toda la página (16-UI-SPEC §Copywriting
// Contract, regla rectora dura): hechos públicos independientes, NUNCA insinuación
// donación → voto.
const CAUSAL_RE =
  /a cambio de|favoreci|influy|cercano|su voto|correlaci|af[ií]n|financió su elección/i;

// RUT que NUNCA debe aparecer (el donante AQUÍ es la empresa = sujeto de página; su
// RUT no se proyecta — disciplina Ley 21.719).
const DONANTE_RUT = "77999888-1";

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeAporte(
  overrides: Partial<AporteContraparteRow> = {},
): AporteContraparteRow {
  return {
    fila_id: "a-1",
    eleccion: "Elección 2021",
    donante_nombre: "Inmobiliaria del Sur SpA",
    tipo_persona: "jurídica",
    monto: "$ 5.000.000",
    fecha_aporte: "2021-09-10T00:00:00Z",
    tipo_aporte: "Aporte con publicidad",
    candidato_nombre_verbatim: "Juana Candidata",
    origen: "servel",
    fecha_captura: "2026-06-18T00:00:00Z",
    fecha_corte: "2026-06-15T00:00:00Z",
    enlace: "https://www.servel.cl/aporte/123",
    ...overrides,
  };
}

function makeViewData(
  overrides: Partial<AportesPorContraparteViewData> = {},
): AportesPorContraparteViewData {
  return {
    id: "d:Inmobiliaria del Sur SpA",
    estado: "con_aportes",
    aportes: [makeAporte()],
    totalAportes: 1,
    page: 1,
    totalPages: 1,
    fechaCorte: "2026-06-15T00:00:00Z",
    ...overrides,
  };
}

// ── (a) Conteo neutral + filas + agrupación por elección ─────────────────────────
describe("AportesPorContraparteView — conteo neutral + agrupación", () => {
  it("rinde la línea de conteo neutral '{N} aporte(s) registrado(s).' para ≥1 fila", () => {
    render(<AportesPorContraparteView data={makeViewData()} />);
    expect(screen.getByText(/1 aporte registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Inmobiliaria del Sur SpA/)).toBeInTheDocument();
  });

  it("agrupa por elección y NUNCA suma/rankea montos (verbatim por fila)", () => {
    const { container } = render(
      <AportesPorContraparteView
        data={makeViewData({
          aportes: [
            makeAporte({ fila_id: "a1", eleccion: "Elección 2021", monto: "$ 100" }),
            makeAporte({ fila_id: "a2", eleccion: "Elección 2017", monto: "$ 200" }),
          ],
          totalAportes: 2,
        })}
      />,
    );
    expect(screen.getByText(/2 aportes registrados/i)).toBeInTheDocument();
    // Encabezados de grupo por elección.
    expect(screen.getByText(/Elección 2021/)).toBeInTheDocument();
    expect(screen.getByText(/Elección 2017/)).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).toContain("$ 100");
    expect(texto).toContain("$ 200");
    expect(texto).not.toMatch(/total|suma|monto total|mayor aporte|ranking|%/i);
  });
});

// ── (b) ProvenanceBadge por fila con fuente "SERVEL" ─────────────────────────────
describe("AportesPorContraparteView — provenance por fila", () => {
  it("cada aporte trae un ProvenanceBadge (SERVEL) con enlace a la fuente", () => {
    render(
      <AportesPorContraparteView
        data={makeViewData({
          aportes: [
            makeAporte({ fila_id: "a1" }),
            makeAporte({ fila_id: "a2" }),
          ],
          totalAportes: 2,
        })}
      />,
    );
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBe(2);
    expect(screen.getAllByText(/SERVEL/i).length).toBeGreaterThanOrEqual(2);
  });
});

// ── (c) RUT del donante NUNCA renderizado ────────────────────────────────────────
describe("AportesPorContraparteView — el RUT del donante NUNCA aparece", () => {
  it("no renderiza el RUT del donante (Ley 21.719)", () => {
    const { container } = render(<AportesPorContraparteView data={makeViewData()} />);
    const texto = container.textContent ?? "";
    expect(texto).not.toContain(DONANTE_RUT);
    expect(texto).not.toMatch(/RUT/i);
  });
});

// ── (d) Tres estados honestos textualmente distintos ────────────────────────────
describe("AportesPorContraparteView — estados honestos distintos", () => {
  it("no_consultado → copy propio; NUNCA 'limpio'/'✓'", () => {
    const { container } = render(
      <AportesPorContraparteView
        data={makeViewData({
          estado: "no_consultado",
          aportes: [],
          totalAportes: 0,
          fechaCorte: null,
        })}
      />,
    );
    expect(
      screen.getByText(/Aún no hemos consolidado los aportes de SERVEL/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no se registran aportes a esa fecha/i)).toBeNull();
    expect(
      screen.queryByText(/aporte registrado|aportes registrados/i),
    ).toBeNull();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/limpio|impecable|sin aportes ✓|✓/i);
  });

  it("consultado_sin_aportes → copy con fecha de corte, distinto de no_consultado", () => {
    render(
      <AportesPorContraparteView
        data={makeViewData({
          estado: "consultado_sin_aportes",
          aportes: [],
          totalAportes: 0,
          fechaCorte: "2026-06-15T00:00:00Z",
        })}
      />,
    );
    expect(
      screen.getByText(/no se registran aportes a esa fecha/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Aún no hemos consolidado los aportes de SERVEL/i),
    ).toBeNull();
  });
});

// ── (e) Anti-insinuación: cero vocabulario causal/afinidad ni voto ───────────────
describe("AportesPorContraparteView — anti-insinuación", () => {
  it("el DOM NUNCA contiene vocabulario causal/afinidad ni datos de voto", () => {
    const { container } = render(<AportesPorContraparteView data={makeViewData()} />);
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(CAUSAL_RE);
    expect(texto).not.toMatch(/votaci|\bvoto\b|\bvotó\b/i);
  });
});

// ── (f) Atribución SERVEL "términos por verificar", NUNCA una licencia CC-BY ──────
describe("AportesPorContraparteView — atribución del dataset", () => {
  it("atribuye 'términos por verificar' y NUNCA una licencia CC-BY", () => {
    const { container } = render(<AportesPorContraparteView data={makeViewData()} />);
    expect(screen.getByText(/términos de uso por verificar/i)).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/CC BY 4\.0/i);
  });
});
