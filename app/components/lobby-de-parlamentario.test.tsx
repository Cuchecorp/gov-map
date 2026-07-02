import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { LobbyView, type LobbyViewData } from "./lobby-de-parlamentario";
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
  return {
    id: "P00001",
    audiencias: [makeAudiencia()],
    totalAudiencias: 1,
    page: 1,
    totalPages: 1,
    noIngestado: false,
    camara: "diputados",
    ...overrides,
  };
}

// ── Carril propio / estructura (§3.0, §9.1 regla 1) ─────────────────────────────
describe("LobbyView (sección lobby) — carril aislado (anti-insinuación §9.1 regla 1)", () => {
  it("renderiza su propia lista de audiencias; NINGÚN voto/boletín/proyecto compuesto", () => {
    const { container } = render(<LobbyView data={makeViewData()} />);
    // La sección es su propia <ul> de audiencias.
    expect(container.querySelector("ul")).not.toBeNull();
    // Sin enlaces a /proyecto/ ni /parlamentario/ ni a un voto (carril aislado).
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      const href = l.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^\/proyecto\//);
      expect(href).not.toMatch(/^\/parlamentario\//);
    }
    // El texto NO compone un voto con la reunión.
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/voto|votación|votacion|boletín|boletin|a favor|en contra/i);
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
  // El frame de un DIPUTADO sí puede atribuir a la Cámara (fuente que corresponde).
  it("cámara diputados → el intro atribuye a la Cámara (camara.cl/transparencia)", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ camara: "diputados" })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toContain("camara.cl/transparencia");
    expect(texto).toMatch(/registro oficial de la Cámara/i);
  });

  // El frame de un SENADOR NUNCA se atribuye a la Cámara (fabricaría la fuente).
  it("cámara senado → el intro NO dice 'camara.cl/transparencia' ni 'la Cámara'; refiere el Senado", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ camara: "senado" })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("camara.cl/transparencia");
    expect(texto).not.toMatch(/registro oficial de la Cámara/i);
    expect(texto).toMatch(/Ley del Lobby del Senado/i);
  });

  // El empty-state (b) de un senador tampoco atribuye a la Cámara.
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

  // Cámara desconocida (null) → frame genérico, sin atribuir una cámara concreta.
  it("cámara null → frame genérico honesto, sin nombrar Cámara ni Senado", () => {
    const { container } = render(
      <LobbyView data={makeViewData({ camara: null })} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("camara.cl/transparencia");
    expect(texto).toMatch(/registro oficial de la Ley del Lobby/i);
    // El prefijo neutro (Ley 20.730) siempre está.
    expect(texto).toContain("Ley del Lobby (Ley 20.730)");
  });

  // Negative-match: el copy nuevo por cámara no introduce vocabulario prohibido §9.1.
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

// ── Contraparte cruda + IdentityMarker, sin enlace, sin RUT (§3.2) ──────────────
describe("LobbyView (sección lobby) — contraparte como TEXTO CRUDO (§3.2)", () => {
  it("muestra el nombre de la contraparte verbatim + IdentityMarker, NUNCA un enlace", () => {
    render(<LobbyView data={makeViewData()} />);
    expect(screen.getByText("Inmobiliaria Andes SpA")).toBeInTheDocument();
    // No confirmada (P11 nunca confirma) → marca de identidad presente.
    expect(screen.getAllByLabelText("identidad no verificada").length).toBeGreaterThan(0);
    // La contraparte nunca se enlaza.
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      expect(l.textContent).not.toContain("Inmobiliaria Andes SpA");
    }
  });

  it("el rol/tipo crudo de la fuente se muestra como metadata, sin editorializar", () => {
    render(<LobbyView data={makeViewData()} />);
    expect(screen.getByText(/gestor de intereses/i)).toBeInTheDocument();
  });

  it("NUNCA renderiza un RUT de la contraparte en el DOM", () => {
    const { container } = render(<LobbyView data={makeViewData()} />);
    const texto = container.textContent ?? "";
    // Patrón de RUT chileno (12.345.678-9 / 12345678-9).
    expect(texto).not.toMatch(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/);
  });

  it("una audiencia sin contrapartes no inventa ninguna (degrada honestamente)", () => {
    render(<LobbyView data={makeViewData({ audiencias: [makeAudiencia({ contrapartes: [] })] })} />);
    // La fila existe (la reunión es real) aunque la fuente no liste contraparte.
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
    // Un vacío NUNCA se lee como virtud/limpieza/"no se reúne con nadie".
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

  it("(c) con audiencias → renderiza las filas", () => {
    render(<LobbyView data={makeViewData()} />);
    expect(screen.getByText(/Reforma al sistema de salud/i)).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos ingerido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No se registran reuniones/i)).not.toBeInTheDocument();
  });
});

// ── ProvenanceBadge por fila (obligatorio, §3.2) ────────────────────────────────
describe("LobbyView (sección lobby) — ProvenanceBadge por fila (obligatorio)", () => {
  it("cada audiencia trae un ProvenanceBadge con enlace a la fuente oficial", () => {
    render(
      <LobbyView
        data={makeViewData({
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
          audiencias: [
            makeAudiencia(),
            makeAudiencia({
              identificador: "AW2",
              materia: "Modernización portuaria",
              contrapartes: [
                { contraparte_nombre: "Naviera Sur Ltda.", contraparte_tipo: null, representado: null },
              ],
            }),
          ],
          totalAudiencias: 2,
        })}
      />,
    );
    const texto = container.textContent ?? "";
    // Causalidad / afinidad / score / flag / juicio (§9.1 reglas 2–5).
    const PROHIBIDO =
      /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|posible conflicto|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;
    expect(texto).not.toMatch(PROHIBIDO);
    // El encabezado/intro neutro EXACTO sí está presente.
    expect(texto).toContain("Ley del Lobby");
  });
});
