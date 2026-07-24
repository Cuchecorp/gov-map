import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { TileSenal, type SenalRow } from "./panel-actualidad";

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
