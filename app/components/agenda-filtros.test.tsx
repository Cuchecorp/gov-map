import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { AgendaFiltros } from "./agenda-filtros";
import type { CitacionSliceRow } from "@/lib/agenda-types";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fixture EN MEMORIA — slice serializado por el server (dayKey/dayLabel ya en
// tz Chile). Variedad de cámaras, comisiones (incluye "" → Sin dato), boletines,
// fechas (para acotar el rango) y estados.
// ---------------------------------------------------------------------------
function fila(over: Partial<CitacionSliceRow>): CitacionSliceRow {
  return {
    id: "x",
    camara: "camara",
    comision: "Hacienda",
    fecha: "2026-06-22T14:00:00Z",
    dayKey: "2026-06-22",
    dayLabel: "Lunes 22 de junio",
    horario: "10:00",
    sala: null,
    materia: "Materia de prueba",
    estado: null,
    boletines: [],
    boletin: null,
    invitados: [],
    provenance: { capturedAt: null, sourceName: "Cámara", sourceUrl: null },
    ...over,
  };
}

const FIXTURE: CitacionSliceRow[] = [
  fila({
    id: "1",
    camara: "camara",
    comision: "Hacienda",
    dayKey: "2026-06-22",
    dayLabel: "Lunes 22 de junio",
    fecha: "2026-06-22T14:00:00Z",
    boletines: ["14309-04"],
    boletin: "14309-04",
  }),
  fila({
    id: "2",
    camara: "camara",
    comision: "Hacienda",
    dayKey: "2026-06-23",
    dayLabel: "Martes 23 de junio",
    fecha: "2026-06-23T14:00:00Z",
    estado: "Suspendida",
  }),
  fila({
    id: "3",
    camara: "senado",
    comision: "Salud",
    dayKey: "2026-06-23",
    dayLabel: "Martes 23 de junio",
    fecha: "2026-06-23T15:00:00Z",
    boletines: ["12345"],
    boletin: "12345",
  }),
  fila({
    id: "4",
    camara: "senado",
    comision: "Salud",
    dayKey: "2026-06-24",
    dayLabel: "Miércoles 24 de junio",
    fecha: "2026-06-24T16:00:00Z",
  }),
  fila({
    id: "5",
    camara: "senado",
    comision: "", // sin comisión → bucket "Sin dato"
    dayKey: "2026-06-25",
    dayLabel: "Jueves 25 de junio",
    fecha: "2026-06-25T16:00:00Z",
  }),
];

// ---------------------------------------------------------------------------
// 1. Renderiza el listado por día (CitacionCard) — el island ES el renderer
// ---------------------------------------------------------------------------
describe("AgendaFiltros — renderiza el listado por día", () => {
  it("muestra los días del slice con sus citaciones (CitacionCard)", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    // Cada CitacionCard renderiza la comisión como heading; hay 5 citaciones.
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(5);
    // Día-headers presentes (dayLabel del server)
    expect(screen.getByText("Lunes 22 de junio")).toBeInTheDocument();
    expect(screen.getByText("Jueves 25 de junio")).toBeInTheDocument();
  });

  it("el estado de cancelación (Suspendida) es visible en la card", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    expect(screen.getByText(/Suspendida/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Faceta cámara — chips con counts de estas N; toggle filtra en memoria
// ---------------------------------------------------------------------------
describe("AgendaFiltros — faceta cámara", () => {
  it("muestra chips Cámara/Senado con counts sobre el slice completo", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const camara = screen
      .getAllByRole("button", { name: /Cámara/ })
      .find((b) => b.getAttribute("aria-pressed") !== null);
    expect(camara!.textContent).toMatch(/2/); // 2 filas cámara
    const senado = screen
      .getAllByRole("button", { name: /Senado/ })
      .find((b) => b.getAttribute("aria-pressed") !== null);
    expect(senado!.textContent).toMatch(/3/); // 3 filas senado
  });

  it("al activar Senado solo muestra las 3 citaciones del Senado", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const senado = screen
      .getAllByRole("button", { name: /Senado/ })
      .find((b) => b.getAttribute("aria-pressed") === "false");
    fireEvent.click(senado!);
    expect(senado!.getAttribute("aria-pressed")).toBe("true");
    // Solo quedan 3 citaciones (senado)
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 3. Faceta comisión — orden freq desc→alfa, "Sin dato" al final
// ---------------------------------------------------------------------------
describe("AgendaFiltros — faceta comisión", () => {
  it("muestra chip 'Sin dato' para la citación sin comisión", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const sinDato = screen
      .getAllByRole("button", { name: /Sin dato/ })
      .find((b) => b.getAttribute("aria-pressed") !== null);
    expect(sinDato).toBeDefined();
    expect(sinDato!.textContent).toMatch(/1/);
  });

  it("al activar 'Hacienda' filtra a las 2 citaciones de Hacienda", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const hacienda = screen
      .getAllByRole("button", { name: /Hacienda/ })
      .find((b) => b.getAttribute("aria-pressed") === "false");
    fireEvent.click(hacienda!);
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Rango de fechas — inputs date acotados a min/max del slice
// ---------------------------------------------------------------------------
describe("AgendaFiltros — rango de fechas", () => {
  it("los inputs date tienen min/max = extremos del slice", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const desde = screen.getByLabelText(/Desde/) as HTMLInputElement;
    const hasta = screen.getByLabelText(/Hasta/) as HTMLInputElement;
    expect(desde.min).toBe("2026-06-22");
    expect(desde.max).toBe("2026-06-25");
    expect(hasta.min).toBe("2026-06-22");
    expect(hasta.max).toBe("2026-06-25");
  });

  it("acotar 'desde' a 2026-06-24 oculta los días anteriores", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const desde = screen.getByLabelText(/Desde/) as HTMLInputElement;
    fireEvent.change(desde, { target: { value: "2026-06-24" } });
    // Quedan solo los días 24 y 25 → 2 citaciones
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(2);
    expect(screen.queryByText("Lunes 22 de junio")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Filtro por boletín — detectarBoletin, filtra por base
// ---------------------------------------------------------------------------
describe("AgendaFiltros — filtro por boletín", () => {
  it("'14309' filtra por base a la citación con ese boletín", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const input = screen.getByLabelText(/Número de boletín/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "14309" } });
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(1);
  });

  it("texto libre no-boletín NO filtra a cero (detectarBoletin null)", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const input = screen.getByLabelText(/Número de boletín/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hola mundo" } });
    // detectarBoletin devuelve null → no aplica filtro → siguen las 5
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// 6. Counts honestos — sobre el slice completo, no sobre el filtrado
// ---------------------------------------------------------------------------
describe("AgendaFiltros — counts honestos sobre el slice completo", () => {
  it("leyenda de counts LOCKED con N del slice", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    expect(
      screen.getByText(
        "Conteos sobre estas 5 citaciones cargadas de esta semana, no sobre toda la agenda.",
      ),
    ).toBeInTheDocument();
  });

  it("tras filtrar por Hacienda, el count de Senado SIGUE siendo 3 (slice completo)", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const hacienda = screen
      .getAllByRole("button", { name: /Hacienda/ })
      .find((b) => b.getAttribute("aria-pressed") === "false");
    fireEvent.click(hacienda!);
    const senado = screen
      .getAllByRole("button", { name: /Senado/ })
      .find((b) => b.getAttribute("aria-pressed") !== null);
    expect(senado!.textContent).toMatch(/3/);
  });
});

// ---------------------------------------------------------------------------
// 7. "Esta semana" resetea todos los filtros
// ---------------------------------------------------------------------------
describe("AgendaFiltros — reset 'Esta semana'", () => {
  it("resetea cámara/comisión/rango/boletín al slice completo", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    const senado = screen
      .getAllByRole("button", { name: /Senado/ })
      .find((b) => b.getAttribute("aria-pressed") === "false");
    fireEvent.click(senado!);
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(3);

    const reset = screen.getByRole("button", { name: "Esta semana" });
    fireEvent.click(reset);
    expect(screen.getAllByText("Materia de prueba")).toHaveLength(5);
    expect(senado!.getAttribute("aria-pressed")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// 8. Empty tras filtro — copy LOCKED (≠ empty de datos)
// ---------------------------------------------------------------------------
describe("AgendaFiltros — empty tras filtro", () => {
  it("muestra el copy LOCKED cuando la intersección de filtros vacía la lista", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    // Activar Cámara (2 filas, ambas Hacienda) + comisión Salud (Senado) → vacío
    const camara = screen
      .getAllByRole("button", { name: /Cámara/ })
      .find((b) => b.getAttribute("aria-pressed") === "false");
    fireEvent.click(camara!);
    const salud = screen
      .getAllByRole("button", { name: /Salud/ })
      .find((b) => b.getAttribute("aria-pressed") === "false");
    fireEvent.click(salud!);
    expect(
      screen.getByText("Sin citaciones para este filtro"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ajusta o quita filtros para ver más."),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 9. Accesibilidad + contrato FichaRail
// ---------------------------------------------------------------------------
describe("AgendaFiltros — accesibilidad", () => {
  it("los chips de faceta son buttons type='button' con aria-pressed", () => {
    const { container } = render(<AgendaFiltros slice={FIXTURE} />);
    const chips = container.querySelectorAll("button[aria-pressed]");
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((c) => expect(c.getAttribute("type")).toBe("button"));
  });

  it("los inputs date y boletín tienen label asociado", () => {
    render(<AgendaFiltros slice={FIXTURE} />);
    expect(screen.getByLabelText(/Desde/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hasta/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número de boletín/)).toBeInTheDocument();
  });
});
