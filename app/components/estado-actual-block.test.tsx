import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  derivarEstadoActual,
  EstadoActualView,
  type EstadoActual,
} from "./estado-actual-block";
import type { ProyectoRow, TramitacionEventoRow } from "@/lib/types";

afterEach(cleanup);

// ── Fixtures ────────────────────────────────────────────────────────────────
function makeProyecto(overrides: Partial<ProyectoRow> = {}): ProyectoRow {
  return {
    boletin: "16284-07",
    boletin_num: "16284",
    titulo: "Proyecto de prueba",
    iniciativa: "Mensaje",
    camara_origen: "senado",
    autores: null,
    materia: "Salud",
    estado: "En tramitación",
    etapa: "Primer trámite constitucional",
    subetapa: null,
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://senado.cl/16284-07",
    ...overrides,
  };
}

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

// ── derivarEstadoActual — omisión honesta (T-51-14) ─────────────────────────
describe("derivarEstadoActual — deriva 3 líneas, omite lo no derivable", () => {
  it("(a) proyecto con etapa/estado + eventos + urgencia vigente → las 3 líneas presentes", () => {
    const eventos = [
      makeEvento({ fecha: "2026-03-01T00:00:00Z", descripcion: "Ingreso" }),
      makeEvento({
        fecha: "2026-04-10T00:00:00Z",
        descripcion: "hace presente la urgencia Suma",
      }),
      makeEvento({
        fecha: "2026-05-20T00:00:00Z",
        descripcion: "Pasa a comisión",
      }),
    ];
    const est = derivarEstadoActual(makeProyecto(), eventos);
    expect(est.etapaLinea).toBeDefined();
    expect(est.etapaLinea).toContain("Primer trámite constitucional");
    expect(est.etapaLinea).toContain("En tramitación");
    // último hito = evento más reciente por fecha.
    expect(est.ultimoHito).toBeDefined();
    expect(est.ultimoHito!.descripcion).toBe("Pasa a comisión");
    // urgencia vigente = último "hace presente" sin "retira" posterior.
    expect(est.urgenciaVigente).toBeDefined();
    expect(est.urgenciaVigente!.tipo.toLowerCase()).toContain("suma");
  });

  it("(b) sin urgencia derivable → la línea de urgencia se OMITE, las demás presentes", () => {
    const eventos = [
      makeEvento({ fecha: "2026-03-01T00:00:00Z", descripcion: "Ingreso" }),
      makeEvento({ fecha: "2026-05-20T00:00:00Z", descripcion: "Informe de comisión" }),
    ];
    const est = derivarEstadoActual(makeProyecto(), eventos);
    expect(est.urgenciaVigente).toBeUndefined();
    expect(est.etapaLinea).toBeDefined();
    expect(est.ultimoHito).toBeDefined();
  });

  it("(b') urgencia retirada después de presentada → NO hay urgencia vigente (omitida)", () => {
    const eventos = [
      makeEvento({
        fecha: "2026-04-10T00:00:00Z",
        descripcion: "hace presente la urgencia Suma",
      }),
      makeEvento({
        fecha: "2026-05-01T00:00:00Z",
        descripcion: "retira la urgencia",
      }),
    ];
    const est = derivarEstadoActual(makeProyecto(), eventos);
    expect(est.urgenciaVigente).toBeUndefined();
  });

  it("(c) sin eventos → 'último hito' omitido; etapa sigue presente", () => {
    const est = derivarEstadoActual(makeProyecto(), []);
    expect(est.ultimoHito).toBeUndefined();
    expect(est.urgenciaVigente).toBeUndefined();
    expect(est.etapaLinea).toBeDefined();
  });

  it("sin etapa ni estado → etapaLinea omitida (nunca '—')", () => {
    const est = derivarEstadoActual(
      makeProyecto({ etapa: null, estado: null }),
      [],
    );
    expect(est.etapaLinea).toBeUndefined();
  });
});

// ── EstadoActualView — presentación pura (omisión + banned-vocab) ────────────
describe("EstadoActualView — render honesto", () => {
  it("renderiza el heading '¿Dónde está hoy?' y las líneas derivadas", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite · En tramitación",
      ultimoHito: { descripcion: "Pasa a comisión", fecha: new Date("2026-05-20T00:00:00Z") },
      urgenciaVigente: { tipo: "Suma", desde: new Date("2026-05-18T00:00:00Z") },
    };
    render(<EstadoActualView estado={estado} />);
    expect(
      screen.getByRole("heading", { name: /¿Dónde está hoy\?/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Etapa: Primer trámite · En tramitación/)).toBeInTheDocument();
    expect(screen.getByText(/Último hito: Pasa a comisión/)).toBeInTheDocument();
    expect(screen.getByText(/Urgencia Suma vigente desde el/)).toBeInTheDocument();
  });

  it("omite la línea de urgencia cuando no es derivable (assert de ausencia)", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite",
      ultimoHito: { descripcion: "Ingreso", fecha: new Date("2026-05-20T00:00:00Z") },
    };
    render(<EstadoActualView estado={estado} />);
    expect(screen.queryByText(/vigente desde el/)).not.toBeInTheDocument();
    // Nunca un guion como si fuera dato.
    expect(screen.queryByText(/Urgencia — vigente/)).not.toBeInTheDocument();
  });

  it("GATE §9.1: el copy no contiene lenguaje de juicio/causal/afinidad", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite · En tramitación",
      ultimoHito: { descripcion: "Pasa a comisión", fecha: new Date("2026-05-20T00:00:00Z") },
      urgenciaVigente: { tipo: "Suma", desde: new Date("2026-05-18T00:00:00Z") },
    };
    const { container } = render(<EstadoActualView estado={estado} />);
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /porque|a cambio de|afinidad|puntaje|score|ranking|sospechos|pol[eé]mic|traici|conflicto de inter|mejor|peor|urgente de verdad|estancad/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

// ── Source-scan estructural (Pitfall 8: process.cwd + path.join, NO import.meta) ──
describe("estado-actual-block — invariantes de fuente", () => {
  const APP_ROOT = process.cwd(); // app/
  const BLOCK_TSX = path.join(APP_ROOT, "components", "estado-actual-block.tsx");
  const PAGE_TSX = path.join(APP_ROOT, "app", "proyecto", "[boletin]", "page.tsx");
  const BLOCK_SRC = readFileSync(BLOCK_TSX, "utf8");
  const PAGE_SRC = readFileSync(PAGE_TSX, "utf8");

  it("el componente NO es 'use client' (RSC) y LANZA ante error de DB (#34)", () => {
    expect(BLOCK_SRC).not.toMatch(/^\s*["']use client["']/m);
    expect(BLOCK_SRC).toMatch(/throw new Error/);
  });

  it("EstadoActualBlock se cablea en la page ANTES de #idea-matriz", () => {
    expect(PAGE_SRC).toContain("EstadoActualBlock");
    const idxBlock = PAGE_SRC.indexOf("EstadoActualBlock");
    const idxIdea = PAGE_SRC.indexOf('id="idea-matriz"');
    expect(idxBlock).toBeGreaterThan(0);
    expect(idxIdea).toBeGreaterThan(0);
    expect(idxBlock).toBeLessThan(idxIdea);
  });
});
