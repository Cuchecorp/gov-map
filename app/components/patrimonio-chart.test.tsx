import { readFileSync } from "node:fs";

import {
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  vi,
} from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  seriePatrimonio,
  PatrimonioView,
  type SeriePunto,
  type PatrimonioViewData,
} from "./patrimonio-de-parlamentario";
import { categoria } from "./patrimonio-chart";
import type { DeclaracionVersionRow, BienRpcRow } from "@/lib/types";

// ── Mock de Recharts en jsdom (espejo red-graph.test.tsx :24-79) ────────────────
// Recharts mide el DOM (ResizeObserver → 0 en jsdom): no probamos el lienzo SVG,
// sino el shell server (caveat/degrade/footer/banned-vocab). El doble ligero
// renderiza un contenedor con data-testid para aseverar "isla montada" vs degrade.
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

// ── Regexes de vocabulario PROHIBIDO (espejo patrimonio-de-parlamentario.test.tsx
// :24-30) — corren sobre el textContent del shell del chart. ─────────────────────
const PROHIBIDO_VEREDICTO =
  /enriqueci|conflicto de inter|aument|disminuy|incrementó|incremento patrimonial|variaci|delta|Δ|creció|pasó de|más rico|patrimonio total|posible conflicto/i;
const PROHIBIDO_CONECTIVO =
  /a cambio de|antes de votar|que resultó en|en representación de|vinculad[oa] a|asociad[oa] con|cercano a/i;
const PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;

// ── Fixtures (espejo de patrimonio-de-parlamentario.test.tsx :33-70) ─────────────
function makeBien(overrides: Partial<BienRpcRow> = {}): BienRpcRow {
  return {
    fuente_id: "http://datos.cplt.cl/recurso/declaracion/V1",
    fecha_presentacion: "2024-05-14",
    tipo_bien: "inmueble",
    contenido: { ubicadoEn: "Santiago" },
    origen: "InfoProbidad",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.infoprobidad.cl/declaracion/V1",
    licencia: "CC BY 4.0",
    ...overrides,
  };
}

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
    campos: [],
    origen: "InfoProbidad",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.infoprobidad.cl/declaracion/V1",
    licencia: "CC BY 4.0",
    es_historica: false,
    bienes: [],
    ...overrides,
  };
}

function makePunto(overrides: Partial<SeriePunto> = {}): SeriePunto {
  return {
    anio: 2024,
    tipo_declaracion: "Declaración de patrimonio",
    version_id: "http://datos.cplt.cl/recurso/declaracion/V1",
    inmueble: 0,
    mueble: 0,
    actividad: 0,
    pasivo: 0,
    accion_derecho: 0,
    valor: 0,
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
    serie: [],
    ...overrides,
  };
}

// ── VIZ-01: transform puro seriePatrimonio() ─────────────────────────────────────
describe("seriePatrimonio — transform puro (VIZ-01)", () => {
  it("cuenta los bienes por tipo_bien dentro de UNA versión", () => {
    const v = makeVersion({
      fecha_presentacion: "2024-05-14",
      bienes: [
        makeBien({ tipo_bien: "inmueble" }),
        makeBien({ tipo_bien: "inmueble" }),
        makeBien({ tipo_bien: "pasivo" }),
      ],
    });
    const serie = seriePatrimonio([v]);
    expect(serie).toHaveLength(1);
    expect(serie[0]).toEqual<SeriePunto>({
      anio: 2024,
      tipo_declaracion: "Declaración de patrimonio",
      version_id: "http://datos.cplt.cl/recurso/declaracion/V1",
      inmueble: 2,
      mueble: 0,
      actividad: 0,
      pasivo: 1,
      accion_derecho: 0,
      valor: 0,
    });
  });

  it("deriva el año del string ISO fecha_presentacion (sin new Date)", () => {
    const v = makeVersion({ fecha_presentacion: "2016-11-03", bienes: [] });
    const [punto] = seriePatrimonio([v]);
    expect(punto.anio).toBe(2016);
    expect(typeof punto.anio).toBe("number");
  });

  it("dos versiones del MISMO año pero distinto tipo NO se fusionan (peras con manzanas)", () => {
    const periodica = makeVersion({
      version_id: "A",
      tipo: "Declaración periódica",
      fecha_presentacion: "2020-03-01",
      bienes: [makeBien({ tipo_bien: "inmueble" })],
    });
    const rectificacion = makeVersion({
      version_id: "B",
      tipo: "Rectificación",
      fecha_presentacion: "2020-09-01",
      bienes: [makeBien({ tipo_bien: "pasivo" })],
    });
    const serie = seriePatrimonio([periodica, rectificacion]);
    // DOS puntos distintos — el transform jamás colapsa los tipos en uno solo.
    expect(serie).toHaveLength(2);
    expect(serie[0].anio).toBe(2020);
    expect(serie[1].anio).toBe(2020);
    expect(serie[0].tipo_declaracion).toBe("Declaración periódica");
    expect(serie[1].tipo_declaracion).toBe("Rectificación");
    expect(serie[0].tipo_declaracion).not.toBe(serie[1].tipo_declaracion);
  });

  it("seriePatrimonio([]) → [] y una versión → array de length 1", () => {
    expect(seriePatrimonio([])).toEqual([]);
    expect(seriePatrimonio([makeVersion()])).toHaveLength(1);
  });

  it("una fecha_presentacion null/vacía se EXCLUYE sin reventar (WR-03, guarda 500)", () => {
    const valida = makeVersion({
      version_id: "OK",
      fecha_presentacion: "2024-05-14",
      bienes: [makeBien({ tipo_bien: "inmueble" })],
    });
    const nula = makeVersion({
      version_id: "NULA",
      // El RPC puede emitir null; el transform NO debe lanzar (sin 500).
      fecha_presentacion: null as unknown as string,
    });
    const vacia = makeVersion({ version_id: "VACIA", fecha_presentacion: "" });

    let serie: SeriePunto[] = [];
    expect(() => {
      serie = seriePatrimonio([valida, nula, vacia]);
    }).not.toThrow();
    // Solo el punto con año parseable sobrevive: ninguna barra NaN/0 se grafica.
    expect(serie).toHaveLength(1);
    expect(serie[0].anio).toBe(2024);
    expect(serie[0].version_id).toBe("OK");
  });

  it("la salida es JSON plano: solo numbers y strings (cruza la frontera al cliente)", () => {
    const [punto] = seriePatrimonio([
      makeVersion({ bienes: [makeBien({ tipo_bien: "valor" })] }),
    ]);
    for (const [clave, valor] of Object.entries(punto)) {
      const tipo = typeof valor;
      expect(
        tipo === "number" || tipo === "string",
        `campo ${clave} debe ser number|string, es ${tipo}`,
      ).toBe(true);
    }
  });
});

// ── VIZ-03: shell server (caveat / degrade / footer / banned-vocab) ──────────────
describe("PatrimonioChartShell (vía PatrimonioView) — copy honesto (VIZ-03)", () => {
  const dosPuntos: SeriePunto[] = [
    makePunto({ anio: 2022, inmueble: 2 }),
    makePunto({ anio: 2024, inmueble: 3, pasivo: 1 }),
  ];

  it("con ≥2 puntos monta la isla Recharts y muestra el caveat de montos", () => {
    render(<PatrimonioView data={makeViewData({ serie: dosPuntos })} />);
    expect(screen.getByTestId("rc-barchart")).toBeInTheDocument();
    expect(
      screen.getByText(/Montos no disponibles como cifra en la fuente/i),
    ).toBeInTheDocument();
  });

  it("con <2 declaraciones muestra el degrade y NO monta la isla", () => {
    render(
      <PatrimonioView data={makeViewData({ serie: [makePunto()] })} />,
    );
    expect(
      screen.getByText(
        /Datos insuficientes para mostrar el conteo de ítems por año/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("rc-barchart")).not.toBeInTheDocument();
    // El caveat de montos se renderiza SIEMPRE, también en el degrade.
    expect(
      screen.getByText(/Montos no disponibles como cifra en la fuente/i),
    ).toBeInTheDocument();
  });

  it("el footer del chart trae la atribución CC BY 4.0 (CPLT)", () => {
    const { container } = render(
      <PatrimonioView data={makeViewData({ serie: dosPuntos })} />,
    );
    const seccion = container.querySelector(
      'section[aria-label="Bienes declarados por año"]',
    );
    expect(seccion).not.toBeNull();
    expect(seccion?.textContent ?? "").toMatch(/Datos bajo licencia CC BY 4\.0/i);
  });

  it("el copy del shell pasa el negative-match de vocabulario prohibido + sin RUT", () => {
    const { container } = render(
      <PatrimonioView
        data={makeViewData({
          serie: [
            makePunto({ anio: 2020, tipo_declaracion: "Declaración periódica", inmueble: 1 }),
            makePunto({ anio: 2020, tipo_declaracion: "Rectificación", pasivo: 2 }),
          ],
        })}
      />,
    );
    const seccion = container.querySelector(
      'section[aria-label="Bienes declarados por año"]',
    );
    const texto = seccion?.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO_VEREDICTO);
    expect(texto).not.toMatch(PROHIBIDO_CONECTIVO);
    expect(texto).not.toMatch(PATRON_RUT);
  });
});

// ── VIZ-01: la categoría del eje X discrimina cada declaración (anti-fusión) ─────
describe("categoria() — banda única por declaración (VIZ-01)", () => {
  it("dos declaraciones MISMO año + MISMO tipo → categorías DISTINTAS (no fusión)", () => {
    const a = makePunto({
      anio: 2020,
      tipo_declaracion: "Rectificación",
      version_id: "A",
    });
    const b = makePunto({
      anio: 2020,
      tipo_declaracion: "Rectificación",
      version_id: "B",
    });
    // Mismo año + mismo tipo: sin el discriminador colapsarían en UNA sola banda.
    expect(categoria(a)).not.toBe(categoria(b));
    // La etiqueta sigue siendo significativa (año + tipo presentes en la clave).
    expect(categoria(a)).toContain("2020");
    expect(categoria(a)).toContain("Rectificación");
  });
});

// ── VIZ-02: la isla es client-only y nunca filtra el cliente Supabase ───────────
describe("patrimonio-chart.tsx — isla \"use client\" sin fuga (VIZ-02)", () => {
  it("empieza con \"use client\", importa recharts y NUNCA @/lib/supabase", () => {
    // Anclado al directorio de ESTE archivo de test (IN-01): robusto ante drift de
    // cwd del runner. `import.meta.dirname` es la ruta nativa del módulo (no la URL
    // jsdom reescrita a http://, que rompe `readFileSync`).
    const fuente = readFileSync(
      `${import.meta.dirname}/patrimonio-chart.tsx`,
      "utf8",
    );
    expect(fuente).toMatch(/^"use client"/);
    expect(fuente).toMatch(/from "recharts"/);
    expect(fuente).not.toMatch(/createServerSupabase/);
    expect(fuente).not.toMatch(/@\/lib\/supabase/);
    // El eje X SE clavija en la categoría compuesta, NUNCA en el `anio` desnudo
    // (WR-02): regresar a `dataKey="anio"` fundiría declaraciones del mismo año en
    // una sola banda comparable (rompe la propiedad anti-insinuación).
    expect(fuente).toMatch(/dataKey="categoria"/);
    expect(fuente).not.toMatch(/dataKey="anio"/);
    // Nunca línea/área conectada (insinuaría una "tendencia" de riqueza).
    expect(fuente).not.toMatch(/LineChart|AreaChart|<Line|<Area/);
    // Nunca runtime edge (OpenNext no lo soporta) ni tokens de identidad política.
    expect(fuente).not.toMatch(/runtime\s*=\s*["']edge["']/);
    expect(fuente).not.toMatch(/--camara|--senado/);
  });
});
