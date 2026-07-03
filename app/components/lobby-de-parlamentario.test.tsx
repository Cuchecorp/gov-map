import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  LobbyView,
  agruparPorContraparte,
  normalizarVista,
  type LobbyViewData,
} from "./lobby-de-parlamentario";
import type { LobbyAudienciaRow } from "@/lib/types";

afterEach(cleanup);

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeAudiencia(
  overrides: Partial<LobbyAudienciaRow> = {},
): LobbyAudienciaRow {
  return {
    identificador: "AQ001AW1442944",
    fecha: "2026-05-14T13:00:00Z",
    fecha_raw: "2026-05-14 13:00:00-03",
    materia: "Reforma al sistema de salud",
    contrapartes: [
      {
        contraparte_nombre: "Inmobiliaria Andes SpA",
        contraparte_tipo: "gestor de intereses",
        representado: "Andes Holding",
      },
    ],
    origen: "leylobby.gob.cl",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.leylobby.gob.cl/instituciones/AQ001/audiencias/2026/AW1442944",
    ...overrides,
  };
}

function makeViewData(overrides: Partial<LobbyViewData> = {}): LobbyViewData {
  const base = {
    id: "P00001",
    audiencias: [makeAudiencia()],
    totalAudiencias: 1,
    page: 1,
    totalPages: 1,
    noIngestado: false,
    camara: "diputados" as string | null,
    vista: "agrupada" as "agrupada" | "cronologica",
    ...overrides,
  };
  // `grupos` se deriva de las audiencias salvo que el test lo provea explícito.
  return {
    ...base,
    grupos: overrides.grupos ?? agruparPorContraparte(base.audiencias),
  };
}

// Helper de contraparte cruda para fixtures de agrupación.
function cp(nombre: string) {
  return { contraparte_nombre: nombre, contraparte_tipo: null, representado: null };
}

// ── Helper puro agruparPorContraparte (SC6/B11) ─────────────────────────────────
describe("agruparPorContraparte — orden por frecuencia DESC", () => {
  it("{Enel×4, Codelco×2} → [Enel(4), Codelco(2)]", () => {
    const audiencias = [
      makeAudiencia({ identificador: "E1", fecha: "2026-01-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
      makeAudiencia({ identificador: "E2", fecha: "2026-02-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
      makeAudiencia({ identificador: "C1", fecha: "2026-03-01T00:00:00Z", contrapartes: [cp("Codelco")] }),
      makeAudiencia({ identificador: "E3", fecha: "2026-04-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
      makeAudiencia({ identificador: "C2", fecha: "2026-05-01T00:00:00Z", contrapartes: [cp("Codelco")] }),
      makeAudiencia({ identificador: "E4", fecha: "2026-06-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
    ];
    const grupos = agruparPorContraparte(audiencias);
    expect(grupos.map((g) => [g.contraparte, g.n])).toEqual([
      ["Enel Chile S.A.", 4],
      ["Codelco", 2],
    ]);
    // Cada grupo colecta sus fechas (una por reunión).
    expect(grupos[0].fechas).toHaveLength(4);
    expect(grupos[1].fechas).toHaveLength(2);
  });

  it("audiencia sin contraparte → NO fabrica un nombre (se excluye de la agrupación)", () => {
    const audiencias = [
      makeAudiencia({ identificador: "X1", contrapartes: [] }),
      makeAudiencia({ identificador: "X2", contrapartes: [cp("Enel Chile S.A.")] }),
    ];
    const grupos = agruparPorContraparte(audiencias);
    expect(grupos.map((g) => g.contraparte)).toEqual(["Enel Chile S.A."]);
  });

  it("no infla n si la fuente repite el mismo nombre dentro de una audiencia", () => {
    const audiencias = [
      makeAudiencia({ identificador: "D1", contrapartes: [cp("Enel Chile S.A."), cp("Enel Chile S.A.")] }),
    ];
    const grupos = agruparPorContraparte(audiencias);
    expect(grupos).toEqual([
      expect.objectContaining({ contraparte: "Enel Chile S.A.", n: 1 }),
    ]);
  });
});

// ── normalizarVista (fail-safe del searchParam ?vista) ──────────────────────────
describe("normalizarVista — solo 'cronologica' activa la vista cronológica", () => {
  it("undefined → agrupada (default)", () => {
    expect(normalizarVista(undefined)).toBe("agrupada");
  });
  it("'cronologica' → cronologica", () => {
    expect(normalizarVista("cronologica")).toBe("cronologica");
  });
  it("'basura' → agrupada (fail-safe)", () => {
    expect(normalizarVista("basura")).toBe("agrupada");
  });
  it("array ['cronologica'] → cronologica (toma el primero)", () => {
    expect(normalizarVista(["cronologica"])).toBe("cronologica");
  });
});

// ── Vista agrupada por contraparte = DEFAULT (SC6) ──────────────────────────────
describe("LobbyView — vista agrupada por contraparte (DEFAULT, freq DESC)", () => {
  function groupedData() {
    return makeViewData({
      totalAudiencias: 6,
      audiencias: [
        makeAudiencia({ identificador: "E1", fecha: "2026-01-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
        makeAudiencia({ identificador: "E2", fecha: "2026-02-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
        makeAudiencia({ identificador: "C1", fecha: "2026-03-01T00:00:00Z", contrapartes: [cp("Codelco")] }),
        makeAudiencia({ identificador: "E3", fecha: "2026-04-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
        makeAudiencia({ identificador: "C2", fecha: "2026-05-01T00:00:00Z", contrapartes: [cp("Codelco")] }),
        makeAudiencia({ identificador: "E4", fecha: "2026-06-01T00:00:00Z", contrapartes: [cp("Enel Chile S.A.")] }),
      ],
    });
  }

  it("agrupa por contraparte: Enel primero (4 reuniones), Codelco después (2)", () => {
    const { container } = render(<LobbyView data={groupedData()} />);
    const h3s = container.querySelectorAll("h3");
    expect(h3s[0].textContent).toContain("Enel Chile S.A.");
    expect(h3s[1].textContent).toContain("Codelco");
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/4 reuniones/);
    expect(texto).toMatch(/2 reuniones/);
  });

  it("el caveat de identidad aparece EXACTAMENTE 1 vez en la sección (no por fila)", () => {
    render(<LobbyView data={groupedData()} />);
    const caveats = screen.getAllByText(/su identidad no está verificada/i);
    expect(caveats).toHaveLength(1);
  });

  it("NO hay IdentityMarker por fila en la vista agrupada (el caveat de sección lo reemplaza)", () => {
    render(<LobbyView data={groupedData()} />);
    expect(screen.queryByLabelText("identidad no verificada")).toBeNull();
  });

  it("la contraparte NO está dentro de un <a>/Link (nunca enlazada)", () => {
    render(<LobbyView data={groupedData()} />);
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      expect(l.textContent).not.toContain("Enel Chile S.A.");
      expect(l.textContent).not.toContain("Codelco");
    }
  });

  it("el copy nuevo (caveat + grupos) NO introduce vocabulario prohibido §9.1", () => {
    const { container } = render(<LobbyView data={groupedData()} />);
    const PROHIBIDO =
      /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;
    expect(container.textContent ?? "").not.toMatch(PROHIBIDO);
  });
});

// ── Toggle de vista server-driven (SC6) ─────────────────────────────────────────
describe("LobbyView — toggle de vista agrupada ↔ cronológica", () => {
  it("existen los dos enlaces del toggle", () => {
    render(<LobbyView data={makeViewData()} />);
    expect(
      screen.getByRole("link", { name: /Agrupar por contraparte/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver en orden cronológico/i }),
    ).toBeInTheDocument();
  });

  it("default (agrupada) → 'Agrupar por contraparte' lleva el estado activo petróleo", () => {
    render(<LobbyView data={makeViewData({ vista: "agrupada" })} />);
    const activo = screen.getByRole("link", { name: /Agrupar por contraparte/i });
    expect(activo).toHaveAttribute("aria-current", "true");
    expect(activo.className).toContain("accent-product");
    // El inactivo NO lleva aria-current.
    const inactivo = screen.getByRole("link", { name: /Ver en orden cronológico/i });
    expect(inactivo).not.toHaveAttribute("aria-current");
  });

  it("vista=cronologica → 'Ver en orden cronológico' lleva el estado activo petróleo", () => {
    render(
      <LobbyView data={makeViewData({ vista: "cronologica" })} />,
    );
    const activo = screen.getByRole("link", { name: /Ver en orden cronológico/i });
    expect(activo).toHaveAttribute("aria-current", "true");
    expect(activo.className).toContain("accent-product");
  });

  it("vista=cronologica → renderiza la lista paginada con filas individuales (fecha + materia)", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ vista: "cronologica" })} />,
    );
    // Una fila individual con su materia (solo la vista cronológica la muestra).
    expect(screen.getByText(/Reforma al sistema de salud/i)).toBeInTheDocument();
    // La vista cronológica es una <ul> de audiencias con ProvenanceBadge por fila.
    expect(container.querySelector("ul")).not.toBeNull();
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBeGreaterThan(0);
  });
});

// ── Carril propio / estructura (§3.0, §9.1 regla 1) ─────────────────────────────
describe("LobbyView (sección lobby) — carril aislado (anti-insinuación §9.1 regla 1)", () => {
  it("renderiza su propia lista; NINGÚN voto/boletín/proyecto compuesto ni enlace a otro recurso", () => {
    const { container } = render(<LobbyView data={makeViewData({ id: "P00001" })} />);
    expect(container.querySelector("ul")).not.toBeNull();
    // Los únicos enlaces internos permitidos son el toggle de la MISMA ficha;
    // nunca a /proyecto/, a un voto, ni a OTRO parlamentario.
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      const href = l.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^\/proyecto\//);
      if (href.startsWith("/parlamentario/")) {
        // Solo la propia ficha (self-view toggle), nunca otro id.
        expect(href).toMatch(/^\/parlamentario\/P00001(\?|#|$)/);
      }
    }
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/votó|votación|votacion|boletín|boletin|a favor|en contra/i);
  });

  it("la línea de intro honesta (Ley 20.730) aparece bajo el encabezado (§3.1)", () => {
    render(<LobbyView data={makeViewData()} />);
    expect(
      screen.getByText(/Audiencias registradas bajo la Ley del Lobby \(Ley 20\.730\)/i),
    ).toBeInTheDocument();
  });
});

// ── B10 — frame de la fuente parametrizado por cámara (trazabilidad honesta) ────
describe("LobbyView (sección lobby) — frame de fuente por cámara (B10)", () => {
  it("cámara diputados → el intro atribuye a la Cámara (camara.cl/transparencia)", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ camara: "diputados" })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("camara.cl/transparencia");
    expect(texto).toMatch(/registro oficial de la Cámara/i);
  });

  it("cámara senado → el intro NO dice 'camara.cl/transparencia' ni 'la Cámara'; refiere el Senado", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ camara: "senado" })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("camara.cl/transparencia");
    expect(texto).not.toMatch(/registro oficial de la Cámara/i);
    expect(texto).toMatch(/Ley del Lobby del Senado/i);
  });

  it("senado + 0 audiencias → el empty-state (b) no atribuye a la Cámara", () => {
    const { container } = render(
      <LobbyView
        data={makeViewData({
          camara: "senado",
          noIngestado: false,
          audiencias: [],
          totalAudiencias: 0,
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/No se registran reuniones de lobby confirmadas/i);
    expect(texto).not.toContain("camara.cl/transparencia");
    expect(texto).toMatch(/Ley del Lobby del Senado/i);
  });

  it("cámara null → frame genérico honesto, sin nombrar Cámara ni Senado", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ camara: null })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("camara.cl/transparencia");
    expect(texto).toMatch(/registro oficial de la Ley del Lobby/i);
    expect(texto).toContain("Ley del Lobby (Ley 20.730)");
  });

  it("ninguna cámara introduce vocabulario prohibido §9.1 en el frame", () => {
    const PROHIBIDO =
      /cercano a|vinculad[oa] a|aliad[oa] de|afinidad|conflicto de inter|influencia|influyente|score|ranking|índice de|sospechos|polémic|controversial|oscuro/i;
    for (const camara of ["diputados", "senado", null] as const) {
      const { container } = render(<LobbyView data={makeViewData({ camara })} />);
      expect(container.textContent ?? "").not.toMatch(PROHIBIDO);
      cleanup();
    }
  });
});

// ── Contraparte cruda, sin enlace, sin RUT (§3.2) — vista cronológica ────────────
describe("LobbyView (sección lobby) — contraparte como TEXTO CRUDO (§3.2)", () => {
  it("muestra el nombre de la contraparte verbatim, NUNCA un enlace", () => {
    render(<LobbyView data={makeViewData({ vista: "cronologica" })} />);
    expect(screen.getByText("Inmobiliaria Andes SpA")).toBeInTheDocument();
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      expect(l.textContent).not.toContain("Inmobiliaria Andes SpA");
    }
  });

  it("el rol/tipo crudo de la fuente se muestra como metadata, sin editorializar", () => {
    render(<LobbyView data={makeViewData({ vista: "cronologica" })} />);
    expect(screen.getByText(/gestor de intereses/i)).toBeInTheDocument();
  });

  it("NUNCA renderiza un RUT de la contraparte en el DOM", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ vista: "cronologica" })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/);
  });

  it("una audiencia sin contrapartes no inventa ninguna (degrada honestamente)", () => {
    render(
      <LobbyView
        data={makeViewData({
          vista: "cronologica",
          audiencias: [makeAudiencia({ contrapartes: [] })],
        })}
      />,
    );
    expect(screen.getByText(/Reforma al sistema de salud/i)).toBeInTheDocument();
  });
});

// ── Tres estados honestos distintos (§6.1) ──────────────────────────────────────
describe("LobbyView (sección lobby) — tres estados honestos (§6.1)", () => {
  it("(a) NO ingestado → copy 'no ingerido', distinto de los demás", () => {
    render(
      <LobbyView data={makeViewData({ noIngestado: true, audiencias: [], totalAudiencias: 0 })} />,
    );
    expect(
      screen.getByText(/Aún no hemos ingerido las reuniones de lobby/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/limpio|impecable|no se reúne|sin compromisos|transparente/i),
    ).not.toBeInTheDocument();
  });

  it("(b) ingestado + 0 audiencias → copy 'no se registran confirmadas', distinto de (a)", () => {
    render(
      <LobbyView data={makeViewData({ noIngestado: false, audiencias: [], totalAudiencias: 0 })} />,
    );
    expect(
      screen.getByText(/No se registran reuniones de lobby confirmadas/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos ingerido/i)).not.toBeInTheDocument();
  });

  it("(c) con audiencias → renderiza la agrupación por contraparte", () => {
    render(<LobbyView data={makeViewData()} />);
    expect(screen.getByText("Inmobiliaria Andes SpA")).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos ingerido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No se registran reuniones/i)).not.toBeInTheDocument();
  });
});

// ── ProvenanceBadge por fila (obligatorio en la vista cronológica, §3.2) ─────────
describe("LobbyView (sección lobby) — ProvenanceBadge por fila (vista cronológica)", () => {
  it("cada audiencia trae un ProvenanceBadge con enlace a la fuente oficial", () => {
    render(
      <LobbyView
        data={makeViewData({
          vista: "cronologica",
          audiencias: [
            makeAudiencia({ identificador: "A1" }),
            makeAudiencia({ identificador: "A2" }),
          ],
        })}
      />,
    );
    const fuentes = screen.getAllByText(/fuente oficial ↗/i);
    expect(fuentes.length).toBe(2);
  });
});

// ── GATE DE CONTENIDO anti-insinuación (§9.1, release gate de la fase) ──────────
describe("LobbyView (sección lobby) — GATE §9.1 (release gate: sin causal/afinidad/score/flag)", () => {
  it("el render NO contiene ningún término prohibido de §9.1", () => {
    const { container } = render(
      <LobbyView
        data={makeViewData({
          totalAudiencias: 2,
          audiencias: [
            makeAudiencia(),
            makeAudiencia({
              identificador: "AW2",
              materia: "Modernización portuaria",
              contrapartes: [cp("Naviera Sur Ltda.")],
            }),
          ],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|posible conflicto|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;
    expect(texto).not.toMatch(PROHIBIDO);
    expect(texto).toContain("Ley del Lobby");
  });
});
