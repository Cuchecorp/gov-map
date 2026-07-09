import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import type { CruceProyectoRow, CruceEvidenciaItem } from "@/lib/types";

afterEach(cleanup);

// ── Valla inline anti-insinuación (§9.1) — negative-match del render (regex del
//    <interfaces> del plan 38-02). El componente no comparte un linter de
//    vocabulario; la valla vive como negative-match inline sobre el DOM. ─────────
const PROHIBIDO =
  /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|afinidad|conflicto de inter|influencia|influyente|score|ranking|índice de|sospechos|polémic|porque|presion|gestion/i;
// Patrón de RUT chileno (12.345.678-9 / 12345678-9).
const PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;
// Caveat anti-causal LOCKED (debe aparecer EXACTAMENTE 1× por render).
const CAVEAT =
  "La coincidencia temporal no implica relación entre la reunión y el voto.";

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeItem(
  overrides: Partial<CruceEvidenciaItem> = {},
): CruceEvidenciaItem {
  return {
    tipo: "reunion",
    fecha: "2026-05-14T13:00:00Z",
    contraparte_nombre_crudo: "Inmobiliaria Andes SpA",
    audiencia_id: "AW1442944",
    enlace_fuente:
      "https://www.leylobby.gob.cl/instituciones/AQ001/audiencias/2026/AW1442944",
    ...overrides,
  };
}

function makeRow(overrides: Partial<CruceProyectoRow> = {}): CruceProyectoRow {
  const items = overrides.evidencia?.items ?? [makeItem()];
  return {
    parlamentario_id: "D1133",
    nombre_normalizado: "Ana Pérez González",
    sector_id: "inmobiliario",
    sector_etiqueta: "inmobiliario y construcción",
    tipo_senal: "lobby_sector",
    conteo: items.length,
    evidencia: { conteo: items.length, items },
    // Frescura del cruce (nivel señal): reciente → nunca stale, determinista.
    fecha_captura: new Date().toISOString(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CrucesView (pura)
// ═══════════════════════════════════════════════════════════════════════════════

// ── COMP-01: bloque "Cómo leer esto" siempre visible ────────────────────────────
describe("CrucesView — bloque 'Cómo leer esto' (COMP-01)", () => {
  it("renderiza el bloque 'Cómo leer esto' con filas presentes", () => {
    render(<CrucesView rows={[makeRow()]} />);
    expect(screen.getByLabelText("Cómo leer esto")).toBeInTheDocument();
    expect(screen.getByText("Cómo leer esto")).toBeInTheDocument();
  });

  it("renderiza el bloque 'Cómo leer esto' con cero filas (siempre visible)", () => {
    render(<CrucesView rows={[]} />);
    expect(screen.getByLabelText("Cómo leer esto")).toBeInTheDocument();
  });

  it("el bloque menciona los 3 elementos: qué es la señal, cómo leer el conteo, qué no establece", () => {
    const { container } = render(<CrucesView rows={[makeRow()]} />);
    const bloque = container.querySelector('[aria-label="Cómo leer esto"]');
    const texto = bloque?.textContent ?? "";
    expect(texto).toMatch(/reuniones de lobby registradas/i);
    expect(texto).toMatch(/más registros/i);
    expect(texto).toMatch(/no establece relación/i);
  });

  it("el bloque no contiene vocabulario prohibido (§9.1)", () => {
    const { container } = render(<CrucesView rows={[makeRow()]} />);
    const bloque = container.querySelector('[aria-label="Cómo leer esto"]');
    const texto = bloque?.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

describe("CrucesView — capa-1 + capa-2 (rows>0)", () => {
  it("renderiza h2, caveat 1×, el nombre como LINK a /parlamentario/[id], voto y conteo de reuniones", () => {
    const { container } = render(
      <CrucesView
        rows={[
          makeRow({
            conteo: 2,
            evidencia: {
              conteo: 2,
              items: [makeItem(), makeItem({ audiencia_id: "AW2" })],
            },
          }),
        ]}
      />,
    );

    // Capa-1: h2 petróleo.
    expect(
      screen.getByRole("heading", { name: /Cruces con el sector del proyecto/i }),
    ).toBeInTheDocument();

    // Caveat EXACTAMENTE 1× por render.
    const texto = container.textContent ?? "";
    expect(texto.split(CAVEAT).length - 1).toBe(1);

    // Nombre del parlamentario = ENLACE a su ficha (DEPARTURE LOCKED).
    const link = screen.getByRole("link", { name: /Ana Pérez González/i });
    expect(link.getAttribute("href")).toBe("/parlamentario/D1133");

    // Línea de voto SEPARADA + conteo neutro de reuniones.
    expect(screen.getByText("Votó a favor de este proyecto")).toBeInTheDocument();
    expect(
      screen.getByText(/reuniones con gestores del sector/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/inmobiliario y construcción/i),
    ).toBeInTheDocument();
  });

  it("conteo 3-estado: '{N} parlamentarios' con N>0", () => {
    render(
      <CrucesView
        rows={[
          makeRow(),
          makeRow({ parlamentario_id: "D2200", nombre_normalizado: "Juan Soto" }),
        ]}
      />,
    );
    expect(screen.getByText("2 parlamentarios")).toBeInTheDocument();
  });

  it("conteo singular: '1 parlamentario' con N=1 (no '1 parlamentarios')", () => {
    render(<CrucesView rows={[makeRow()]} />);
    expect(screen.getByText("1 parlamentario")).toBeInTheDocument();
    expect(screen.queryByText("1 parlamentarios")).not.toBeInTheDocument();
  });

  it("singular: 1 reunión (no '1 reuniones')", () => {
    const { container } = render(
      <CrucesView
        rows={[
          makeRow({
            conteo: 1,
            evidencia: { conteo: 1, items: [makeItem()] },
          }),
        ]}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/1 reunión con gestores del sector/i);
    expect(texto).not.toMatch(/1 reuniones/i);
  });
});

describe("CrucesView — empty honesto (rows=0)", () => {
  it("cero filas → h2 + caveat + copy factual; NUNCA se lee como limpio/transparente; sin dígito fabricado", () => {
    const { container } = render(<CrucesView rows={[]} />);
    expect(
      screen.getByText(
        /Aún no se registran parlamentarios con cruces en el sector de este proyecto/i,
      ),
    ).toBeInTheDocument();
    // Conteo honesto "sin registros", no un dígito fabricado.
    expect(screen.getByText("sin registros")).toBeInTheDocument();
    // Nunca copy exculpatorio.
    expect(
      screen.queryByText(/limpio|impecable|transparente|sin compromisos/i),
    ).not.toBeInTheDocument();
    // Caveat sigue presente EXACTAMENTE 1×.
    const texto = container.textContent ?? "";
    expect(texto.split(CAVEAT).length - 1).toBe(1);
    // Cero dígito de conteo de reuniones fabricado.
    expect(screen.queryByText(/\d+ reuniones/i)).not.toBeInTheDocument();
  });
});

describe("CrucesView — tipo_senal desconocido degrada honesto", () => {
  it("tipo_senal futuro → '{n} registros en el sector …' (verbo de reunión NO fabricado)", () => {
    const { container } = render(
      <CrucesView
        rows={[
          makeRow({
            tipo_senal: "futuro_desconocido",
            conteo: 2,
            evidencia: {
              conteo: 2,
              items: [makeItem(), makeItem({ audiencia_id: "AW2" })],
            },
          }),
        ]}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/registros en el sector inmobiliario y construcción/i);
    expect(texto).not.toMatch(/reuniones con gestores/i);
  });
});

describe("CrucesView — negative-match anti-insinuación (§9.1)", () => {
  it("el render completo NO matchea el regex banned-vocab ni un RUT", () => {
    const { container } = render(
      <CrucesView
        rows={[
          makeRow(),
          makeRow({
            parlamentario_id: "S99",
            nombre_normalizado: "María López",
            sector_id: "portuario",
            sector_etiqueta: "portuario",
            evidencia: {
              conteo: 1,
              items: [makeItem({ contraparte_nombre_crudo: "Naviera Sur Ltda." })],
            },
            conteo: 1,
          }),
        ]}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO);
    expect(texto).not.toMatch(PATRON_RUT);
  });

  it("la contraparte va PLANA + IdentityMarker, NUNCA enlazada (52-03)", () => {
    render(<CrucesView rows={[makeRow()]} />);
    expect(screen.getByText("Inmobiliaria Andes SpA")).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("identidad no verificada").length,
    ).toBeGreaterThan(0);
    // Ningún enlace envuelve el nombre crudo de la contraparte.
    for (const l of screen.queryAllByRole("link")) {
      expect(l.textContent).not.toContain("Inmobiliaria Andes SpA");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CrucesSection (Server Component) — degrade honesto de 3 caminos
// ═══════════════════════════════════════════════════════════════════════════════

const rpcMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({ rpc: (...args: unknown[]) => rpcMock(...args) }),
}));

// Importar el componente DESPUÉS del mock de supabase.
import { CrucesView, CrucesSection } from "./cruces-de-proyecto";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
  rpcMock.mockReset();
});

describe("CrucesSection — degrade honesto (mock sb.rpc)", () => {
  it("PGRST202 (función ausente) → resuelve a null (nodo ausente, sin 500)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    const node = await CrucesSection({ boletin: "14309-04" });
    expect(node).toBeNull();
  });

  it("error genérico de schema (42P01) → throw (#34, NUNCA degrada a empty)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "42P01", message: 'relation "cruce_senal" does not exist' },
    });
    await expect(CrucesSection({ boletin: "14309-04" })).rejects.toThrow(
      /cruces_de_proyecto falló para 14309-04/i,
    );
  });

  it("data con filas → renderiza el nombre linkeado a /parlamentario/[id]", async () => {
    rpcMock.mockResolvedValue({ data: [makeRow()], error: null });
    const node = await CrucesSection({ boletin: "14309-04" });
    const html = renderToStaticMarkup(node);
    expect(html).toContain('href="/parlamentario/D1133"');
    expect(html).toContain("Votó a favor de este proyecto");
    expect(rpcMock).toHaveBeenCalledWith("cruces_de_proyecto", {
      p_boletin: "14309-04",
    });
  });

  it("data con 0 filas → empty honesto (NO null, NO throw)", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const node = await CrucesSection({ boletin: "14782-13" });
    const html = renderToStaticMarkup(node);
    expect(html).toContain("Aún no se registran parlamentarios con cruces");
    expect(html).toContain("sin registros");
  });
});
