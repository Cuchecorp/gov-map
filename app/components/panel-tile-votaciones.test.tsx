import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  PanelTileVotacionesView,
  grafiaCamaraCiudadana,
  type VotacionPanelItem,
} from "./panel-tile-votaciones";

afterEach(cleanup);

function makeItem(overrides: Partial<VotacionPanelItem> = {}): VotacionPanelItem {
  return {
    id: "1",
    boletin: "18216-05",
    titulo: "Reforma pensiones",
    fecha: new Date("2026-07-22T00:00:00Z"),
    camara: "Cámara de Diputados",
    resultado: "Aprobado",
    si: 80,
    no: 48,
    abstencion: 2,
    pareo: 0,
    ...overrides,
  };
}

describe("PanelTileVotacionesView", () => {
  it("renderiza el título del tile", () => {
    render(<PanelTileVotacionesView items={[]} fechaFuente={null} />);
    expect(screen.getByText("Votaciones recientes")).toBeInTheDocument();
  });

  it("dos votaciones del MISMO boletín producen DOS <li>, jamás una agregada", () => {
    const items = [
      makeItem({ id: "18384-08-a", boletin: "18384-08", si: 40, no: 0, abstencion: 0, resultado: null, camara: "Senado" }),
      makeItem({ id: "18384-08-b", boletin: "18384-08", si: 22, no: 3, abstencion: 1, resultado: null, camara: "Senado" }),
    ];
    render(<PanelTileVotacionesView items={items} fechaFuente={items[0].fecha} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // El DOM no agrega ni suma los votos de las dos filas.
    expect(screen.queryByText(/62/)).not.toBeInTheDocument();
  });

  it("resultado:'Aprobado' (diputados) renderiza el detalle esperado verbatim", () => {
    const item = makeItem();
    render(<PanelTileVotacionesView items={[item]} fechaFuente={item.fecha} />);
    expect(
      screen.getByText(
        // WR-14 (128-REVIEW): `total_pareo` existe en la tabla y se omitía —
        // el detalle presentaba un conteo PARCIAL como el conteo de la votación.
        "Votación en Cámara de Diputados el 22 jul 2026: Aprobado — 80 a favor, 48 en contra, 2 abstenciones, 0 pareos",
      ),
    ).toBeInTheDocument();
  });

  it("resultado:null (senado) dice 'resultado no informado por la fuente', con los números presentes, y jamás Aprobado/Rechazado", () => {
    const item = makeItem({
      id: "17012-14",
      boletin: "17012-14",
      camara: "Senado",
      resultado: null,
      si: 8,
      no: 26,
      abstencion: 0,
    });
    render(<PanelTileVotacionesView items={[item]} fechaFuente={item.fecha} />);
    const li = screen.getByRole("listitem");
    expect(li.textContent).toContain("resultado no informado por la fuente");
    expect(li.textContent).toContain("8 a favor, 26 en contra, 0 abstenciones");
    expect(li.textContent).not.toMatch(/Aprobado|Rechazado/);
  });

  it("camara ya normalizada ('Cámara de Diputados'/'Senado') — el DOM no contiene 'diputados' en minúscula suelta", () => {
    const item = makeItem({ camara: "Cámara de Diputados" });
    render(<PanelTileVotacionesView items={[item]} fechaFuente={item.fecha} />);
    const li = screen.getByRole("listitem");
    expect(li.textContent).toContain("Cámara de Diputados");
    expect(li.textContent).not.toMatch(/\bdiputados\b/);
  });

  it("cada item enlaza a /proyecto/{boletin}#votaciones", () => {
    const item = makeItem({ boletin: "18216-05" });
    render(<PanelTileVotacionesView items={[item]} fechaFuente={item.fecha} />);
    const link = screen.getByRole("link", { name: /18216-05/ });
    expect(link).toHaveAttribute("href", "/proyecto/18216-05#votaciones");
  });

  it("titulo:null → boletín solo, sin fabricar título", () => {
    const item = makeItem({ titulo: null, boletin: "18259-08" });
    render(<PanelTileVotacionesView items={[item]} fechaFuente={item.fecha} />);
    const link = screen.getByRole("link", { name: "18259-08" });
    expect(link).toBeInTheDocument();
  });

  it("items:[] → vacío honesto con causa, jamás un '0' mudo ni el tile en blanco", () => {
    const fechaFuente = new Date("2026-07-22T00:00:00Z");
    render(<PanelTileVotacionesView items={[]} fechaFuente={fechaFuente} />);
    expect(
      screen.getByText(
        "Sin votaciones fechadas en las fuentes consultadas al 22 jul 2026.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("footer: 'Fuente: Votaciones · según fuente al {d}', cero 'datos al', fecha_captura nunca en el DOM", () => {
    const item = makeItem();
    render(<PanelTileVotacionesView items={[item]} fechaFuente={item.fecha} />);
    expect(
      screen.getByText("Fuente: Votaciones · según fuente al 22 jul 2026"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/datos al/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/fecha_captura/);
  });

  it("cero vocabulario prohibido del carril voto (salvo la leyenda registrada, que los NIEGA)", () => {
    const item = makeItem();
    render(<PanelTileVotacionesView items={[item]} fechaFuente={item.fecha} />);
    // La leyenda LOCKED contiene "disciplina" pero lo NIEGA — se resta antes
    // de matchear (mismo patrón que `anti-insinuacion-guard.test.ts`).
    const texto = (document.body.textContent ?? "").split(
      "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.",
    ).join(" ");
    for (const prohibido of [
      "votan juntos",
      "votan igual",
      "aliados",
      "tasa de coincidencia",
      "disciplina",
    ]) {
      expect(texto).not.toContain(prohibido);
    }
    // La leyenda anti-insinuación registrada SÍ debe estar presente (verbatim).
    expect(document.body.textContent ?? "").toContain(
      "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.",
    );
  });
});

describe("grafiaCamaraCiudadana", () => {
  it("'diputados' → 'Cámara de Diputados'", () => {
    expect(grafiaCamaraCiudadana("diputados")).toBe("Cámara de Diputados");
  });

  it("'senado' → 'Senado'", () => {
    expect(grafiaCamaraCiudadana("senado")).toBe("Senado");
  });

  it("literal desconocido → fallback verbatim (jamás inventar cámara)", () => {
    expect(grafiaCamaraCiudadana("congreso-pleno")).toBe("congreso-pleno");
  });
});
