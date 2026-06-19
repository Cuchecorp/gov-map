import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  ContratosPorContraparteView,
  type ContratosPorContraparteViewData,
  type ContratoContraparteRow,
} from "./contratos-por-contraparte";

afterEach(cleanup);

// Vocabulario causal/afinidad PROHIBIDO en toda la página (16-UI-SPEC §Copywriting
// Contract, regla rectora dura): la página describe hechos públicos independientes y
// JAMÁS insinúa una correlación donación/contrato → voto.
const CAUSAL_RE =
  /a cambio de|favoreci|influy|cercano|su voto|correlaci|af[ií]n|financió su elección/i;

// ── Fixtures ───────────────────────────────────────────────────────────────────
// Fiel al output del RPC `agregado_por_contraparte` (faceta contratos): `monto` es
// null hoy (la fuente ChileCompra no trae un monto fijo); `nombre_orden` lleva la
// descripción de la orden (texto libre), NUNCA un monto.
function makeContrato(
  overrides: Partial<ContratoContraparteRow> = {},
): ContratoContraparteRow {
  return {
    codigo_orden: "1509-512-SE26",
    proveedor_nombre: "Constructora Andes SpA",
    tipo_persona: "jurídica",
    organismo: "Ministerio de Obras Públicas",
    nombre_orden: "Construcción de obras viales",
    monto: null,
    fecha_oc: "2026-03-12T00:00:00Z",
    origen: "chilecompra",
    fecha_captura: "2026-06-18T00:00:00Z",
    fecha_corte: "2026-06-15T00:00:00Z",
    enlace:
      "https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idAcquisition=1509-512-SE26",
    ...overrides,
  };
}

function makeViewData(
  overrides: Partial<ContratosPorContraparteViewData> = {},
): ContratosPorContraparteViewData {
  return {
    id: "c:76123456-7",
    estado: "con_contratos",
    contratos: [makeContrato()],
    totalContratos: 1,
    page: 1,
    totalPages: 1,
    fechaCorte: "2026-06-15T00:00:00Z",
    ...overrides,
  };
}

// ── (a) Conteo neutral + filas (estado con_contratos) ───────────────────────────
describe("ContratosPorContraparteView — conteo neutral + filas", () => {
  it("rinde la línea de conteo neutral '{N} contrato(s) registrado(s).' para ≥1 fila", () => {
    render(<ContratosPorContraparteView data={makeViewData()} />);
    expect(screen.getByText(/1 contrato registrado/i)).toBeInTheDocument();
    // La fila foregrounda el lado contraparte (organismo comprador); la empresa es
    // el sujeto de página (h1), NO se repite por fila.
    expect(
      screen.getByText("Ministerio de Obras Públicas"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Construcción de obras viales"),
    ).toBeInTheDocument();
  });

  it("el conteo es plural con ≥2 filas y NUNCA una suma/total/ranking de montos", () => {
    const { container } = render(
      <ContratosPorContraparteView
        data={makeViewData({
          contratos: [
            makeContrato({ codigo_orden: "C1", monto: "$ 100" }),
            makeContrato({ codigo_orden: "C2", monto: "$ 200" }),
          ],
          totalContratos: 2,
        })}
      />,
    );
    expect(screen.getByText(/2 contratos registrados/i)).toBeInTheDocument();
    const texto = container.textContent ?? "";
    // Montos verbatim por fila, jamás sintetizados en un total.
    expect(texto).toContain("$ 100");
    expect(texto).toContain("$ 200");
    expect(texto).not.toMatch(/total|suma|monto total|mayor contrato|ranking|%/i);
  });
});

// ── (b) ProvenanceBadge por fila con fuente "ChileCompra" ────────────────────────
describe("ContratosPorContraparteView — provenance por fila", () => {
  it("cada contrato trae un ProvenanceBadge (ChileCompra) con enlace a la fuente", () => {
    render(
      <ContratosPorContraparteView
        data={makeViewData({
          contratos: [
            makeContrato({ codigo_orden: "C1" }),
            makeContrato({ codigo_orden: "C2" }),
          ],
          totalContratos: 2,
        })}
      />,
    );
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBe(2);
    expect(screen.getAllByText(/ChileCompra/i).length).toBeGreaterThanOrEqual(2);
  });
});

// ── (c) Tres estados honestos textualmente distintos ────────────────────────────
describe("ContratosPorContraparteView — estados honestos distintos", () => {
  it("no_consultado → copy propio; NUNCA 'limpio'/'✓'", () => {
    const { container } = render(
      <ContratosPorContraparteView
        data={makeViewData({
          estado: "no_consultado",
          contratos: [],
          totalContratos: 0,
          fechaCorte: null,
        })}
      />,
    );
    expect(
      screen.getByText(/Aún no hemos consolidado los contratos de ChileCompra/i),
    ).toBeInTheDocument();
    // Los otros dos estados NO se muestran.
    expect(screen.queryByText(/no se registran contratos a esa fecha/i)).toBeNull();
    // La línea de conteo neutral ("{N} contrato(s) registrado(s).") NO se muestra.
    expect(
      screen.queryByText(/\d+ contratos? registrados?\./i),
    ).toBeNull();
    // Un vacío NUNCA se lee como virtud/limpieza.
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/limpio|impecable|sin contratos ✓|✓/i);
  });

  it("consultado_sin_contratos → copy con fecha de corte, distinto de no_consultado", () => {
    render(
      <ContratosPorContraparteView
        data={makeViewData({
          estado: "consultado_sin_contratos",
          contratos: [],
          totalContratos: 0,
          fechaCorte: "2026-06-15T00:00:00Z",
        })}
      />,
    );
    expect(
      screen.getByText(/no se registran contratos a esa fecha/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Aún no hemos consolidado los contratos de ChileCompra/i),
    ).toBeNull();
  });
});

// ── (d) Anti-insinuación: cero vocabulario causal/afinidad ───────────────────────
describe("ContratosPorContraparteView — anti-insinuación", () => {
  it("el DOM NUNCA contiene vocabulario causal/afinidad ni datos de voto", () => {
    const { container } = render(
      <ContratosPorContraparteView data={makeViewData()} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(CAUSAL_RE);
    // Cero referencia a votos en este carril MONEY.
    expect(texto).not.toMatch(/votaci|\bvoto\b|\bvotó\b/i);
  });
});

// ── (e) Atribución ChileCompra "mención de la fuente", NUNCA una licencia CC-BY ──
describe("ContratosPorContraparteView — atribución del dataset", () => {
  it("atribuye 'mención de la fuente' y NUNCA una licencia CC-BY", () => {
    const { container } = render(
      <ContratosPorContraparteView data={makeViewData()} />,
    );
    expect(screen.getByText(/mención de la fuente/i)).toBeInTheDocument();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/CC BY 4\.0/i);
  });
});
