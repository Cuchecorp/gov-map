import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { TileSenal, rotuloFecha, type SenalRow } from "./panel-actualidad";

afterEach(cleanup);

// ── Fixtures SenalRow[] — activa / suprimida / (sin materia) ────────────────────
// Los strings de supresión son VERBATIM de 0065_actualidad_senal.sql; los literales
// de cobertura son los reales de la RPC. NO se reescriben.
function makeSenal(overrides: Partial<SenalRow> = {}): SenalRow {
  return {
    tipo_senal: "velocity",
    ventana: "7d",
    conteo: 42,
    cobertura_camara: "C.Diputados",
    materia: null,
    cluster_id: null,
    fecha_max: "2026-07-20T14:30:00Z",
    supresion_causa: null,
    evidencia: {},
    ...overrides,
  };
}

describe("TileSenal — señal ACTIVA (velocity)", () => {
  it("muestra el conteo, el framing factual, la cobertura y la fecha", () => {
    const fila = makeSenal({ conteo: 42, cobertura_camara: "C.Diputados" });
    render(<TileSenal tipo="velocity" filas={[fila]} span={4} />);

    // Conteo en font-mono + framing "trámites en 7 días".
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/trámites en 7 días/)).toBeInTheDocument();
    // Cobertura declarada (chip + footer usan el mismo label).
    expect(screen.getAllByText(/C\.Diputados/).length).toBeGreaterThan(0);
  });

  it("lleva fuente + fecha en el render (regla E de proveniencia)", () => {
    const fila = makeSenal({ fecha_max: "2026-07-20T14:30:00Z" });
    render(<TileSenal tipo="velocity" filas={[fila]} span={4} />);

    // Footer "Fuente: {label} · datos al {fecha}".
    expect(screen.getByText(/Fuente:/)).toBeInTheDocument();
    expect(screen.getByText(/datos al/)).toBeInTheDocument();
    // La fecha es un timestamp real → fechaCorta (es-CL): "20 jul 2026".
    expect(screen.getByText(/jul 2026/)).toBeInTheDocument();
  });

  it("NO muestra vocabulario prohibido de ranking (top / los más)", () => {
    const fila = makeSenal({ conteo: 99, cobertura_camara: "Senado" });
    render(<TileSenal tipo="velocity" filas={[fila]} span={4} />);

    expect(screen.queryByText(/top/i)).toBeNull();
    expect(screen.queryByText(/los más/i)).toBeNull();
    expect(screen.queryByText(/la cámara más activa/i)).toBeNull();
  });
});

describe("TileSenal — WR-01: el chip nunca filtra el token interno de ventana", () => {
  it("con cobertura_camara null NO renderiza el token de ventana ('30d'/'futuras')", () => {
    // urgencias/archivados: la RPC fija cobertura_camara=null (0065). El chip
    // se OMITE — el token interno "30d" jamás debe llegar al ciudadano.
    const fila = makeSenal({
      tipo_senal: "urgencias",
      conteo: 3,
      cobertura_camara: null,
      ventana: "30d",
      fecha_max: "2026-07-20T14:30:00Z",
    });
    render(<TileSenal tipo="urgencias" filas={[fila]} span={2} />);

    // El framing factual del conteo sí acompaña.
    expect(screen.getByText(/urgencias fechadas en 30 días/)).toBeInTheDocument();
    // El token interno NO aparece en ninguna parte del render.
    expect(screen.queryByText("30d")).toBeNull();
    expect(screen.queryByText("futuras")).toBeNull();
  });

  it("con cobertura_camara presente SÍ renderiza la cámara como chip", () => {
    const fila = makeSenal({ cobertura_camara: "Senado", ventana: "7d" });
    render(<TileSenal tipo="velocity" filas={[fila]} span={4} />);

    // La cámara declarada aparece; el token de ventana no.
    expect(screen.getAllByText(/Senado/).length).toBeGreaterThan(0);
    expect(screen.queryByText("7d")).toBeNull();
  });
});

describe("TileSenal — WR-02: agenda_citacion / agenda_sala llevan títulos distintos", () => {
  it("agenda_citacion se titula 'Citaciones próximas'", () => {
    const fila = makeSenal({
      tipo_senal: "agenda_citacion",
      conteo: 4,
      cobertura_camara: "C.Diputados",
      ventana: "futuras",
      fecha_max: "2026-07-28T00:00:00Z",
    });
    render(<TileSenal tipo="agenda_citacion" filas={[fila]} span={4} />);

    expect(
      screen.getByRole("heading", { name: "Citaciones próximas" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/citaciones próximas/)).toBeInTheDocument();
  });

  it("agenda_sala se titula 'Sesiones de sala' (distinto de citaciones)", () => {
    const fila = makeSenal({
      tipo_senal: "agenda_sala",
      conteo: 2,
      cobertura_camara: "Senado",
      ventana: "futuras",
      fecha_max: "2026-07-29T00:00:00Z",
    });
    render(<TileSenal tipo="agenda_sala" filas={[fila]} span={4} />);

    expect(
      screen.getByRole("heading", { name: "Sesiones de sala" }),
    ).toBeInTheDocument();
    // Los dos títulos no colisionan (a11y heading outline).
    expect(screen.queryByRole("heading", { name: "Citaciones próximas" })).toBeNull();
  });
});

describe("TileSenal — señal SUPRIMIDA (agenda_sala)", () => {
  const CAUSA_SALA = "sin sesiones agendadas en las fuentes consultadas";

  it("renderiza la causa de supresión VERBATIM, nunca lista vacía ni '0' mudo", () => {
    const fila = makeSenal({
      tipo_senal: "agenda_sala",
      conteo: 0,
      cobertura_camara: null,
      fecha_max: null,
      supresion_causa: CAUSA_SALA,
    });
    render(<TileSenal tipo="agenda_sala" filas={[fila]} span={4} />);

    // La causa es el cuerpo, verbatim.
    expect(screen.getByText(new RegExp(CAUSA_SALA))).toBeInTheDocument();
    // NUNCA un "0" mudo aislado ni un framing de conteo en el path suprimido.
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText(/sesiones de sala próximas/)).toBeNull();
  });

  it("otras causas verbatim de 0065 también se renderizan tal cual", () => {
    const fila = makeSenal({
      tipo_senal: "velocity",
      conteo: 0,
      supresion_causa: "sin datos frescos de esta fuente",
      fecha_max: "2026-07-18T09:00:00Z",
    });
    render(<TileSenal tipo="velocity" filas={[fila]} span={4} />);

    expect(
      screen.getByText(/sin datos frescos de esta fuente/),
    ).toBeInTheDocument();
    // La fecha de referencia sí acompaña ("en las fuentes consultadas al …").
    expect(screen.getByText(/en las fuentes consultadas al/)).toBeInTheDocument();
  });
});

describe("TileSenal — degradación honesta '(sin materia)'", () => {
  it("renderiza el label '(sin materia)' verbatim sin crashear ni fabricar tema", () => {
    const fila = makeSenal({
      tipo_senal: "agrupacion_materia",
      conteo: 7,
      cobertura_camara: null,
      materia: "(sin materia)",
      cluster_id: 3,
      fecha_max: null,
    });
    render(<TileSenal tipo="agrupacion_materia" filas={[fila]} span={2} />);

    // El label se muestra verbatim como título de la fila.
    expect(screen.getByText("(sin materia)")).toBeInTheDocument();
    // El conteo factual acompaña, sin inventar un nombre de tema.
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText(/proyectos/)).toBeInTheDocument();
  });

  it("una materia real se muestra como título verbatim", () => {
    const fila = makeSenal({
      tipo_senal: "agrupacion_materia",
      conteo: 12,
      materia: "Salud",
      cobertura_camara: null,
    });
    render(<TileSenal tipo="agrupacion_materia" filas={[fila]} span={2} />);

    expect(screen.getByText("Salud")).toBeInTheDocument();
  });
});

// ── F-14 — la fecha del panel se rinde en es-CL, no como ISO crudo ─────────────
describe("F-14 — rotuloFecha: es-CL para público general y prensa", () => {
  it("señal agenda_* a medianoche UTC → '10-ago', jamás el ISO crudo", () => {
    const rot = rotuloFecha("agenda_citacion", "2026-08-10T00:00:00Z");
    expect(rot).toBe("10-ago");
    expect(rot).not.toContain("2026-08-10");
  });

  it("señal agenda_* en el DOM: el tile muestra '10-ago' y no el ISO", () => {
    render(
      <TileSenal
        tipo="agenda_citacion"
        filas={[makeSenal({ tipo_senal: "agenda_citacion", fecha_max: "2026-08-10T00:00:00Z" })]}
        span={4}
      />,
    );
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("10-ago");
    expect(texto).not.toContain("2026-08-10");
  });

  it("señal de otro tipo a medianoche UTC → el día sigue siendo el 10 (no se corre al 9)", () => {
    const rot = rotuloFecha("velocity", "2026-08-10T00:00:00Z");
    expect(rot).toContain("10");
    expect(rot).toContain("ago");
    expect(rot).not.toContain("09");
  });

  it("fecha_max NULL (agrupacion_materia) → null: la ausencia honesta no se rellena", () => {
    expect(rotuloFecha("agrupacion_materia", null)).toBeNull();
  });
});
