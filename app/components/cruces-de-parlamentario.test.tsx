import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { CrucesView, type CrucesViewData } from "./cruces-de-parlamentario";
import type { CruceSenalRpcRow, CruceEvidenciaItem } from "@/lib/types";

afterEach(cleanup);

// ── Vallas inline anti-insinuación (§9.1) — convención del repo: el componente
//    no comparte un linter de vocabulario, así que la valla vive como negative-match
//    inline (mirror verbatim de lobby-de-parlamentario.test.tsx). ─────────────────
const PROHIBIDO =
  /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|posible conflicto|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;
// Patrón de RUT chileno (12.345.678-9 / 12345678-9).
const PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;

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

function makeSenal(overrides: Partial<CruceSenalRpcRow> = {}): CruceSenalRpcRow {
  const items = overrides.evidencia?.items ?? [makeItem()];
  return {
    sector_id: "inmobiliario",
    sector_etiqueta: "inmobiliario y construcción",
    tipo_senal: "lobby_sector",
    conteo: items.length,
    evidencia: { conteo: items.length, items },
    // Frescura del cruce (nivel señal): reciente → nunca stale, determinista en la corrida.
    fecha_captura: new Date().toISOString(),
    ...overrides,
  };
}

function makeViewData(overrides: Partial<CrucesViewData> = {}): CrucesViewData {
  return {
    id: "P00001",
    cruces: [makeSenal()],
    ...overrides,
  };
}

// ── Carril aislado (§9.1 regla 1): nunca compone un voto/boletín/proyecto ────────
describe("CrucesView — carril aislado (anti-insinuación §9.1 regla 1)", () => {
  it("ningún enlace a /proyecto/ ni /parlamentario/; sin copy de voto/boletín", () => {
    const { container } = render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal(),
            makeSenal({
              sector_id: "portuario",
              sector_etiqueta: "portuario",
              evidencia: {
                conteo: 1,
                items: [makeItem({ contraparte_nombre_crudo: "Naviera Sur Ltda." })],
              },
              conteo: 1,
            }),
          ],
        })}
      />,
    );
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      const href = l.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^\/proyecto\//);
      expect(href).not.toMatch(/^\/parlamentario\//);
    }
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(
      /voto|votación|votacion|boletín|boletin|a favor|en contra/i,
    );
  });

  it("el render NO contiene ningún término prohibido de §9.1 ni un RUT", () => {
    const { container } = render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal(),
            makeSenal({
              sector_id: "portuario",
              sector_etiqueta: "portuario",
              evidencia: {
                conteo: 1,
                items: [makeItem({ contraparte_nombre_crudo: "Naviera Sur Ltda." })],
              },
              conteo: 1,
            }),
          ],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO);
    expect(texto).not.toMatch(PATRON_RUT);
  });
});

// ── Contraparte cruda + IdentityMarker, sin enlace, sin RUT (D-10) ──────────────
describe("CrucesView — contraparte como TEXTO CRUDO", () => {
  it("muestra el nombre crudo verbatim + IdentityMarker, NUNCA un enlace", () => {
    render(<CrucesView data={makeViewData()} />);
    expect(screen.getByText("Inmobiliaria Andes SpA")).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("identidad no verificada").length,
    ).toBeGreaterThan(0);
    const links = screen.queryAllByRole("link");
    for (const l of links) {
      expect(l.textContent).not.toContain("Inmobiliaria Andes SpA");
    }
  });

  it("NUNCA renderiza un RUT de la contraparte en el DOM", () => {
    const { container } = render(<CrucesView data={makeViewData()} />);
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(PATRON_RUT);
  });
});

// ── COMP-01: bloque "Cómo leer esto" siempre visible ────────────────────────────
describe("CrucesView — bloque 'Cómo leer esto' (COMP-01)", () => {
  it("renderiza el bloque 'Cómo leer esto' con cruces presentes", () => {
    render(<CrucesView data={makeViewData()} />);
    expect(screen.getByLabelText("Cómo leer esto")).toBeInTheDocument();
    expect(screen.getByText("Cómo leer esto")).toBeInTheDocument();
  });

  it("renderiza el bloque 'Cómo leer esto' incluso con cero cruces (siempre visible)", () => {
    render(<CrucesView data={makeViewData({ cruces: [] })} />);
    expect(screen.getByLabelText("Cómo leer esto")).toBeInTheDocument();
  });

  it("el bloque menciona los 3 elementos: qué es la señal, cómo leer el conteo, qué no establece", () => {
    const { container } = render(<CrucesView data={makeViewData()} />);
    const bloque = container.querySelector('[aria-label="Cómo leer esto"]');
    const texto = bloque?.textContent ?? "";
    expect(texto).toMatch(/reuniones de lobby registradas/i);
    expect(texto).toMatch(/más registros/i);
    expect(texto).toMatch(/no establece relación/i);
  });

  it("el bloque no contiene vocabulario prohibido (§9.1)", () => {
    const { container } = render(<CrucesView data={makeViewData()} />);
    const bloque = container.querySelector('[aria-label="Cómo leer esto"]');
    const texto = bloque?.textContent ?? "";
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

// ── Empty honesto: cero cruces (§9.1 regla 9) ───────────────────────────────────
describe("CrucesView — empty honesto", () => {
  it("cero cruces → copy factual; NUNCA se lee como limpio/transparente", () => {
    render(<CrucesView data={makeViewData({ cruces: [] })} />);
    expect(
      screen.getByText(/No se registran cruces de sector para este parlamentario/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /limpio|impecable|sin compromisos|transparente|no se reúne/i,
      ),
    ).not.toBeInTheDocument();
  });
});

// ── Conteo neutro factual por señal ────────────────────────────────────────────
describe("CrucesView — encabezado factual con conteo neutro", () => {
  it("lobby_sector → 'N reuniones con gestores del sector {etiqueta}'", () => {
    render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal({
              conteo: 3,
              evidencia: {
                conteo: 3,
                items: [makeItem(), makeItem({ audiencia_id: "B" }), makeItem({ audiencia_id: "C" })],
              },
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText(/\d+ reuniones con gestores del sector/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/inmobiliario y construcción/i)).toBeInTheDocument();
  });

  it("tipo_senal desconocido → degrada honesto (conteo + etiqueta, sin lanzar)", () => {
    const { container } = render(
      <CrucesView
        data={makeViewData({
          cruces: [makeSenal({ tipo_senal: "futuro_desconocido" })],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/inmobiliario y construcción/i);
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

// ── ProvenanceBadge por item (obligatorio, FND-08) ──────────────────────────────
describe("CrucesView — ProvenanceBadge por item de evidencia", () => {
  it("un ProvenanceBadge con enlace a la fuente oficial por cada item", () => {
    render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal({
              conteo: 2,
              evidencia: {
                conteo: 2,
                items: [
                  makeItem({ audiencia_id: "A1" }),
                  makeItem({ audiencia_id: "A2", contraparte_nombre_crudo: "Naviera Sur Ltda." }),
                ],
              },
            }),
          ],
        })}
      />,
    );
    const fuentes = screen.getAllByText(/fuente oficial ↗/i);
    expect(fuentes.length).toBe(2);
  });

  it("item sin fecha ni enlace no rompe el render (Pitfall 2)", () => {
    render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal({
              evidencia: {
                conteo: 1,
                items: [makeItem({ fecha: null, enlace_fuente: null })],
              },
              conteo: 1,
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Inmobiliaria Andes SpA")).toBeInTheDocument();
  });

  // ── WR-01: dos contrapartes de la MISMA audiencia (mismo audiencia_id) en el
  //    mismo sector. El materializador (0039) emite un item por (audiencia ×
  //    contraparte), así que ambos items comparten audiencia_id. Si la clave de
  //    React no fuera única, una fila colapsaría y SOLTARÍA una contraparte de la
  //    evidencia (violación FND-08). Ambas DEBEN renderizarse, con 2 provenance.
  it("dos contrapartes con el MISMO audiencia_id rinden AMBAS (FND-08, sin drop)", () => {
    render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal({
              conteo: 2,
              evidencia: {
                conteo: 2,
                items: [
                  makeItem({
                    audiencia_id: "AW9999",
                    contraparte_nombre_crudo: "Inmobiliaria Andes SpA",
                  }),
                  makeItem({
                    audiencia_id: "AW9999",
                    contraparte_nombre_crudo: "Constructora Beta Ltda.",
                  }),
                ],
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Inmobiliaria Andes SpA")).toBeInTheDocument();
    expect(screen.getByText("Constructora Beta Ltda.")).toBeInTheDocument();
    // Provenance por evidencia: una por cada contraparte, ninguna soltada (anchor-WR01).
    expect(screen.getAllByText(/fuente oficial ↗/i).length).toBe(2);
  });
});

// ── Frescura honesta: el badge usa s.fecha_captura (nivel señal), no item.fecha ──
//    Mata el stale-amber falso del WR-02: la fecha de la REUNIÓN (item.fecha) es
//    antigua → marcaba amber sobre una fecha de evento; la frescura real es la de
//    materialización del cruce (CRUCEN-01 / 0041).
describe("CrucesView — frescura honesta (CRUCEN-01 / WR-02)", () => {
  it("fecha_captura reciente → badge SIN text-amber-700 (no stale falso)", () => {
    const ahora = new Date().toISOString();
    const { container } = render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal({
              fecha_captura: ahora,
              evidencia: {
                conteo: 1,
                items: [makeItem({ fecha: "2020-03-10T10:00:00Z" })],
              },
              conteo: 1,
            }),
          ],
        })}
      />,
    );
    const badges = container.querySelectorAll('span[class*="rounded-md"]');
    expect(badges.length).toBeGreaterThan(0);
    for (const b of badges) expect(b.className).not.toContain("text-amber-700");
  });

  it("muestra 'Actualizado' y NO 'Sin fecha de actualización'", () => {
    render(
      <CrucesView
        data={makeViewData({
          cruces: [makeSenal({ fecha_captura: new Date().toISOString() })],
        })}
      />,
    );
    expect(
      screen.queryByText(/Sin fecha de actualización/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Actualizado/i)).toBeInTheDocument();
  });

  it("texto factual de reunión: presente cuando item.fecha set, ausente cuando null", () => {
    render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal({
              evidencia: {
                conteo: 1,
                items: [makeItem({ fecha: "2026-05-14T13:00:00Z" })],
              },
              conteo: 1,
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText(/Reunión registrada el/i)).toBeInTheDocument();

    cleanup();
    render(
      <CrucesView
        data={makeViewData({
          cruces: [
            makeSenal({
              evidencia: {
                conteo: 1,
                items: [makeItem({ fecha: null })],
              },
              conteo: 1,
            }),
          ],
        })}
      />,
    );
    expect(screen.queryByText(/Reunión registrada el/i)).not.toBeInTheDocument();
  });
});
