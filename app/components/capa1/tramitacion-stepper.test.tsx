import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { TramitacionStepper } from "./tramitacion-stepper";
import type { EstadoActual } from "@/components/estado-actual-block";
import type { TramitacionEventoRow } from "@/lib/types";

afterEach(cleanup);

// ── Fixtures ────────────────────────────────────────────────────────────────
function makeEvento(
  overrides: Partial<TramitacionEventoRow> = {},
): TramitacionEventoRow {
  return {
    boletin: "16284-07",
    fecha: "2026-05-14T00:00:00Z",
    camara: "senado",
    tipo: "tramite",
    descripcion: "Cuenta de proyecto",
    enlace: "https://senado.cl/evento/1",
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00Z",
    ...overrides,
  };
}

/**
 * Fixture con hitos CLAVE estructurales (votación + informe) + una corrida de
 * urgencia repetitiva del mismo tipo ≥2 (que DEBE agruparse en una línea) + un
 * trámite con fecha inválida (que debe renderizar su descripción SIN fabricar
 * fecha).
 */
function fixture(): TramitacionEventoRow[] {
  return [
    makeEvento({
      fecha: "2026-01-10T00:00:00Z",
      tipo: "votacion",
      descripcion: "Votación en general",
    }),
    makeEvento({
      fecha: "2026-02-10T00:00:00Z",
      tipo: "informe",
      descripcion: "Informe de comisión de Hacienda",
    }),
    makeEvento({
      fecha: "2026-03-10T00:00:00Z",
      tipo: "tramite",
      descripcion: "hace presente la urgencia Suma",
    }),
    makeEvento({
      fecha: "2026-04-11T00:00:00Z",
      tipo: "urgencia",
      descripcion: "Suma",
    }),
    makeEvento({
      fecha: "no-es-fecha",
      tipo: "tramite",
      descripcion: "Trámite sin fecha válida",
    }),
  ];
}

const ESTADO: EstadoActual = {
  etapaLinea: "Etapa: Primer trámite constitucional · En tramitación",
  urgenciaVigente: { tipo: "Suma", desde: new Date("2026-04-11T00:00:00Z") },
};

describe("TramitacionStepper — stepper capa-1 (hitos clave + urgencia agrupada)", () => {
  it("(a) los hitos CLAVE (informe, votación) están SIEMPRE visibles", () => {
    render(<TramitacionStepper eventos={fixture()} estado={ESTADO} />);
    expect(
      screen.getByText("Informe de comisión de Hacienda"),
    ).toBeInTheDocument();
    expect(screen.getByText("Votación en general")).toBeInTheDocument();
  });

  it("(b) las corridas de urgencia ≥2 se agrupan en 1 línea con el copy LOCKED neutro", () => {
    const { container } = render(
      <TramitacionStepper eventos={fixture()} estado={ESTADO} />,
    );
    // Copy LOCKED (UI-SPEC §Copywriting), conteo neutro, sin verbo causal.
    expect(container.textContent).toMatch(
      /2 trámites de urgencia · ver todos/,
    );
    const ver = screen.getByRole("link", { name: /ver todos/ });
    expect(ver.getAttribute("href")).toBe("#timeline");
    // Los eventos individuales de urgencia NO se listan uno por uno en capa-1.
    expect(
      screen.queryByText("hace presente la urgencia Suma"),
    ).not.toBeInTheDocument();
  });

  it("(c) omisión honesta: un trámite con fecha inválida muestra su descripción SIN fabricar fecha (nunca 1970)", () => {
    const { container } = render(
      <TramitacionStepper eventos={fixture()} estado={ESTADO} />,
    );
    expect(screen.getByText("Trámite sin fecha válida")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/1970/);
  });

  it("(d) ELEVA el '¿Dónde está hoy?': etapa actual + urgencia vigente derivadas del estado", () => {
    render(<TramitacionStepper eventos={fixture()} estado={ESTADO} />);
    expect(
      screen.getByText(/Etapa: Primer trámite constitucional/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Urgencia Suma vigente/)).toBeInTheDocument();
  });

  it("(e) estado vacío + sin eventos → mensaje honesto, sin fabricar etapas", () => {
    render(<TramitacionStepper eventos={[]} estado={{}} />);
    expect(
      screen.getByText(/Aún no hay etapas de tramitación registradas/),
    ).toBeInTheDocument();
  });

  it("(f) GATE §9.1: el copy no contiene banned-vocab causal/de juicio", () => {
    const { container } = render(
      <TramitacionStepper eventos={fixture()} estado={ESTADO} />,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /porque|a cambio de|afinidad|puntaje|score|ranking|sospechos|pol[eé]mic|traici|abusiv|excesiv|mejor|peor/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

// ── Source-scan no-leak (Pattern A, LOCKED): vista PURA, cero supabase ──────────
describe("tramitacion-stepper — vista pura (no importa supabase ni una Section)", () => {
  const APP_ROOT = process.cwd(); // app/
  const SRC = readFileSync(
    path.join(APP_ROOT, "components", "capa1", "tramitacion-stepper.tsx"),
    "utf8",
  );

  it("NO importa el cliente Supabase server-only ni una *Section de dominio", () => {
    expect(SRC).not.toMatch(/@\/lib\/supabase/);
    expect(SRC).not.toMatch(/createServerSupabase/);
    expect(SRC).not.toMatch(/import[^;]*Section[^;]*from/);
  });
});
