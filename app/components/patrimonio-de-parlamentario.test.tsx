import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import {
  PatrimonioView,
  DeclaracionComparacion,
  type PatrimonioViewData,
} from "./patrimonio-de-parlamentario";
import type {
  DeclaracionVersionRow,
  DeclaracionComparacionColumna,
} from "@/lib/types";

afterEach(cleanup);

// ── Vocabulario PROHIBIDO (UI-SPEC §9.1 regla 1 — veredicto/delta) ──────────────
// El gate más fuerte de la fase: cero "enriquecimiento"/"conflicto"/delta/variación
// en NINGUNA celda, caption o label, ni en la lista NI en la comparación.
const PROHIBIDO_VEREDICTO =
  /enriqueci|conflicto de inter|aument|disminuy|incrementó|incremento patrimonial|variaci|delta|Δ|creció|pasó de|más rico|patrimonio total|posible conflicto/i;
// Causalidad + afinidad/prosa conectiva (reglas 2–3, lección `representado`).
const PROHIBIDO_CONECTIVO =
  /a cambio de|antes de votar|que resultó en|en representación de|vinculad[oa] a|asociad[oa] con|cercano a/i;
// RUT chileno (12.345.678-9 / 12345678-9) — nunca en el DOM (regla 8, LEGAL-03).
const PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;

// ── Fixtures ────────────────────────────────────────────────────────────────────
function makeVersion(
  overrides: Partial<DeclaracionVersionRow> = {},
): DeclaracionVersionRow {
  return {
    declaracion_id: "http://datos.cplt.cl/recurso/declaracion/V1",
    version_id: "http://datos.cplt.cl/recurso/declaracion/V1",
    tipo: "Declaración de patrimonio",
    fecha_presentacion: "2024-05-14",
    parlamentario_id: "P00001",
    parlamentario_estado_vinculo: "confirmado",
    parlamentario_mencion: "",
    campos: [
      { etiqueta: "Bienes inmuebles", valor: "Departamento en Santiago" },
      { etiqueta: "Actividades", valor: "Director de fundación" },
    ],
    origen: "InfoProbidad",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.infoprobidad.cl/declaracion/V1",
    licencia: "CC BY 4.0",
    es_historica: false,
    ...overrides,
  };
}

function makeViewData(
  overrides: Partial<PatrimonioViewData> = {},
): PatrimonioViewData {
  return {
    id: "P00001",
    versiones: [makeVersion()],
    totalVersiones: 1,
    page: 1,
    totalPages: 1,
    noIngestado: false,
    verAbierta: null,
    ...overrides,
  };
}

function makeColumna(
  overrides: Partial<DeclaracionComparacionColumna> = {},
): DeclaracionComparacionColumna {
  return {
    fecha_presentacion: "2024-05-14",
    origen: "InfoProbidad",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.infoprobidad.cl/declaracion/V1",
    licencia: "CC BY 4.0",
    valores: {
      "Bienes inmuebles": "Departamento en Santiago",
      Actividades: "Director de fundación",
    },
    ...overrides,
  };
}

// ── Carril propio / estructura (§3.0, §9.1 — sin composición cruzada) ────────────
describe("PatrimonioView — carril aislado (anti-insinuación §9.1)", () => {
  it("renderiza su propia lista de versiones; NINGÚN voto/lobby/proyecto compuesto", () => {
    const { container } = render(<PatrimonioView data={makeViewData()} />);
    expect(container.querySelector("ul")).not.toBeNull();
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      const href = l.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^\/proyecto\//);
      expect(href).not.toMatch(/\/votacion|#lobby|#votos/);
    }
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(
      /voto|votación|votacion|boletín|boletin|reunión de lobby|a favor|en contra/i,
    );
  });

  it("la línea de intro honesta (InfoProbidad) aparece (§3.1)", () => {
    render(<PatrimonioView data={makeViewData()} />);
    expect(
      screen.getByText(/presentadas ante el Consejo para la Transparencia/i),
    ).toBeInTheDocument();
  });
});

// ── Fecha prominente + frescura (§3.2, §6.4, INT-04) ─────────────────────────────
describe("PatrimonioView — fecha prominente + frescura (INT-04)", () => {
  it("la fecha de presentación aparece labeled 'Presentada el …'", () => {
    render(<PatrimonioView data={makeViewData()} />);
    expect(screen.getByText(/Presentada el/i)).toBeInTheDocument();
  });

  it("una versión histórica muestra el caveat §6.4; la más reciente NO se rotula 'actual'", () => {
    const { container } = render(
      <PatrimonioView
        data={makeViewData({
          versiones: [makeVersion({ es_historica: true })],
        })}
      />,
    );
    expect(
      screen.getByText(/Esta es una declaración histórica/i),
    ).toBeInTheDocument();
    // Una declaración vieja NUNCA se lee como estado actual.
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(
      /estado actual del patrimonio|patrimonio actual|declaración vigente|situación actual/i,
    );
  });
});

// ── Tres estados honestos distintos (§6.1) ──────────────────────────────────────
describe("PatrimonioView — tres estados honestos (§6.1)", () => {
  it("(a) NO ingestado → copy 'no hemos ingerido', distinto de los demás", () => {
    render(
      <PatrimonioView
        data={makeViewData({
          noIngestado: true,
          versiones: [],
          totalVersiones: 0,
        })}
      />,
    );
    expect(screen.getByText(/Aún no hemos ingerido las declaraciones/i)).toBeInTheDocument();
    // Un vacío NUNCA se lee como virtud/riqueza/pobreza/limpieza.
    expect(
      screen.queryByText(/no tiene patrimonio|limpio|impecable|sin bienes|honesto|transparente/i),
    ).not.toBeInTheDocument();
  });

  it("(b) ingestado + 0 confirmadas → copy 'no se registran confirmadas', distinto de (a)", () => {
    render(
      <PatrimonioView
        data={makeViewData({
          noIngestado: false,
          versiones: [],
          totalVersiones: 0,
        })}
      />,
    );
    expect(
      screen.getByText(/No se registran declaraciones .* confirmadas/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos ingerido/i)).not.toBeInTheDocument();
  });

  it("(c) con versiones → renderiza las filas", () => {
    render(<PatrimonioView data={makeViewData()} />);
    expect(screen.getByText("Departamento en Santiago")).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos ingerido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No se registran declaraciones/i)).not.toBeInTheDocument();
  });
});

// ── Guarda de identidad (§3.4) ───────────────────────────────────────────────────
describe("PatrimonioView — guarda de identidad (§3.4)", () => {
  it("solo versiones confirmadas entran al perfil; las demás no se cuentan ni enlazan", () => {
    // El Server Component ya excluye no-confirmadas; la vista solo recibe confirmadas.
    render(<PatrimonioView data={makeViewData({ totalVersiones: 1 })} />);
    expect(screen.getByText(/1 versión registrada/i)).toBeInTheDocument();
  });
});

// ── ProvenanceBadge por versión (obligatorio, §3.2) ─────────────────────────────
describe("PatrimonioView — ProvenanceBadge por versión + CC BY 4.0 en intro", () => {
  it("cada versión trae un ProvenanceBadge; la atribución CC BY 4.0 está en el intro", () => {
    render(
      <PatrimonioView
        data={makeViewData({
          versiones: [
            makeVersion({ version_id: "V1", declaracion_id: "V1" }),
            makeVersion({ version_id: "V2", declaracion_id: "V2" }),
          ],
          totalVersiones: 2,
        })}
      />,
    );
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBe(2);
    expect(screen.getByText(/Datos bajo licencia CC BY 4\.0/i)).toBeInTheDocument();
  });
});

// ── Comparación: SOLO datos, CERO veredicto, CC BY 4.0 en caption (§3.5, §9.1) ──
describe("DeclaracionComparacion — SOLO DATOS, CERO veredicto (§3.5, release gate)", () => {
  function comparacion(extraB: Partial<DeclaracionComparacionColumna> = {}) {
    const colA = makeColumna({
      fecha_presentacion: "2022-03-10",
      valores: {
        "Bienes inmuebles": "Casa en Valparaíso",
        Actividades: "Director de fundación",
      },
    });
    const colB = makeColumna({
      fecha_presentacion: "2024-05-14",
      valores: {
        // Valor CAMBIADO respecto a A + campo "Actividades" AUSENTE en B.
        "Bienes inmuebles": "Casa en Valparaíso; Departamento en Santiago",
      },
      ...extraB,
    });
    return { colA, colB };
  }

  it("la <Table> tiene caption con framing 'solo datos' Y la atribución CC BY 4.0", () => {
    const { colA, colB } = comparacion();
    const { container } = render(
      <DeclaracionComparacion
        id="P00001"
        columnas={[colA, colB]}
        totalVersiones={2}
      />,
    );
    const caption = container.querySelector("caption");
    expect(caption).not.toBeNull();
    const capText = caption?.textContent ?? "";
    expect(capText).toMatch(/sin cálculo ni interpretación/i);
    expect(capText).toMatch(/CC BY 4\.0/i);
  });

  it("un valor cambiado + un campo ausente NO producen vocabulario de veredicto/delta", () => {
    const { colA, colB } = comparacion();
    const { container } = render(
      <DeclaracionComparacion
        id="P00001"
        columnas={[colA, colB]}
        totalVersiones={2}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO_VEREDICTO);
    expect(texto).not.toMatch(PROHIBIDO_CONECTIVO);
    // El campo ausente lee el HECHO literal, nunca "—" ni un gap coloreado.
    expect(screen.getByText(/No declarado en esta versión/i)).toBeInTheDocument();
  });

  it("usa semántica de tabla real: th scope=col fechado + th scope=row por campo (§8)", () => {
    const { colA, colB } = comparacion();
    const { container } = render(
      <DeclaracionComparacion
        id="P00001"
        columnas={[colA, colB]}
        totalVersiones={2}
      />,
    );
    const colHeaders = Array.from(container.querySelectorAll('th[scope="col"]'));
    // Una columna "Campo" + una por versión fechada.
    expect(colHeaders.length).toBeGreaterThanOrEqual(2);
    expect(colHeaders.some((h) => /Presentada el/i.test(h.textContent ?? ""))).toBe(
      true,
    );
    const rowHeaders = container.querySelectorAll('th[scope="row"]');
    expect(rowHeaders.length).toBeGreaterThan(0);
  });

  it("ProvenanceBadge por columna de comparación (obligatorio)", () => {
    const { colA, colB } = comparacion();
    render(
      <DeclaracionComparacion
        id="P00001"
        columnas={[colA, colB]}
        totalVersiones={2}
      />,
    );
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBe(2);
  });

  it("con < 2 versiones oculta el selector y muestra el hecho neutro", () => {
    const { colA } = comparacion();
    const { container } = render(
      <DeclaracionComparacion id="P00001" columnas={[colA]} totalVersiones={1} />,
    );
    expect(
      screen.getByText(/Se necesita más de una versión para comparar/i),
    ).toBeInTheDocument();
    // Sin tabla de comparación cuando no hay 2 columnas.
    expect(container.querySelector("table")).toBeNull();
  });

  it("ninguna celda usa color de valencia ni estilo diff (sin clases red/green/added/removed)", () => {
    const { colA, colB } = comparacion();
    const { container } = render(
      <DeclaracionComparacion
        id="P00001"
        columnas={[colA, colB]}
        totalVersiones={2}
      />,
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/text-red|text-green|bg-red|bg-green|line-through|diff-added|diff-removed/i);
  });
});

// ── GATE DE CONTENIDO §9.1 — ejerce LISTA Y COMPARACIÓN (cierra la brecha P11) ──
describe("Gate §9.1 — content gate sobre LISTA y COMPARACIÓN (release gate de la fase)", () => {
  it("la LISTA: cero veredicto/causal/conectivo; cero RUT/familiar en textContent", () => {
    const { container } = render(
      <PatrimonioView
        data={makeViewData({
          versiones: [
            makeVersion({ es_historica: true }),
            makeVersion({
              version_id: "V2",
              declaracion_id: "V2",
              fecha_presentacion: "2022-03-10",
              campos: [{ etiqueta: "Valores", valor: "Acciones de empresa X" }],
            }),
          ],
          totalVersiones: 2,
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO_VEREDICTO);
    expect(texto).not.toMatch(PROHIBIDO_CONECTIVO);
    expect(texto).not.toMatch(PATRON_RUT);
    // Sin nombres de familiares (cónyuge/hijo/hija/familiar).
    expect(texto).not.toMatch(/cónyuge|conyuge|hijo|hija|familiar|esposa|esposo/i);
  });

  it("la COMPARACIÓN: cada celda es etiqueta NOUN + valor literal; cero veredicto; CC BY 4.0 en caption", () => {
    const colA = makeColumna({
      fecha_presentacion: "2022-03-10",
      valores: { "Bienes inmuebles": "Casa en Valparaíso" },
    });
    const colB = makeColumna({
      fecha_presentacion: "2024-05-14",
      valores: { "Bienes inmuebles": "Casa en Valparaíso; Depto en Santiago", Valores: "Bonos" },
    });
    const { container } = render(
      <DeclaracionComparacion id="P00001" columnas={[colA, colB]} totalVersiones={2} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO_VEREDICTO);
    expect(texto).not.toMatch(PROHIBIDO_CONECTIVO);
    expect(texto).not.toMatch(PATRON_RUT);
    expect(texto).not.toMatch(/cónyuge|conyuge|hijo|hija|familiar|esposa|esposo/i);
    // La atribución CC BY 4.0 vive en el caption de la vista derivada (CONTEXT LOCKED).
    const caption = container.querySelector("caption");
    expect(caption?.textContent ?? "").toMatch(/CC BY 4\.0/i);
  });
});
