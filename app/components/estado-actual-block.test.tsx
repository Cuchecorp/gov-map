import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  derivarEstadoActual,
  citacionVigente,
  EstadoActualView,
  type EstadoActual,
  type CitacionCruda,
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

// ── citacionVigente — SC3, futura más próxima, omit-when-not-derivable ───────
describe("citacionVigente — deriva la citación vigente/futura más próxima", () => {
  const HOY = new Date("2026-07-06T12:00:00Z");

  function makeCitacion(overrides: Partial<CitacionCruda> = {}): CitacionCruda {
    return { comision: "Comisión de Salud", fecha: "2026-07-10T00:00:00Z", ...overrides };
  }

  it("(a) citación con fecha >= hoy → { comision, fecha }", () => {
    const c = citacionVigente([makeCitacion()], HOY);
    expect(c).not.toBeNull();
    expect(c!.comision).toBe("Comisión de Salud");
    expect(c!.fecha.toISOString()).toBe("2026-07-10T00:00:00.000Z");
  });

  it("(b) todas las citaciones en el pasado → null (línea omitida, nunca '—')", () => {
    const c = citacionVigente(
      [
        makeCitacion({ fecha: "2026-05-01T00:00:00Z" }),
        makeCitacion({ fecha: "2026-06-20T00:00:00Z" }),
      ],
      HOY,
    );
    expect(c).toBeNull();
  });

  it("(b') sin citaciones → null", () => {
    expect(citacionVigente([], HOY)).toBeNull();
  });

  it("(c) varias futuras → la MÁS próxima (menor fecha >= hoy)", () => {
    const c = citacionVigente(
      [
        makeCitacion({ comision: "Lejana", fecha: "2026-08-30T00:00:00Z" }),
        makeCitacion({ comision: "Próxima", fecha: "2026-07-08T00:00:00Z" }),
        makeCitacion({ comision: "Pasada", fecha: "2026-06-01T00:00:00Z" }),
      ],
      HOY,
    );
    expect(c!.comision).toBe("Próxima");
  });

  it("WR-04: una citación de HOY sigue vigente en la tarde-noche de Chile (server en UTC ya está en el día siguiente)", () => {
    // 2026-07-07T01:00Z = 2026-07-06 21:00 en Chile (-04, invierno). La citación
    // de HOY (2026-07-06, convención del conector: fecha impresa a medianoche
    // UTC) NO debe expirar por la medianoche UTC del server: "hoy" se ancla al
    // día calendario de America/Santiago.
    const nocheChile = new Date("2026-07-07T01:00:00Z");
    const c = citacionVigente(
      [makeCitacion({ fecha: "2026-07-06T00:00:00Z" })],
      nocheChile,
    );
    expect(c).not.toBeNull();
    expect(c!.fecha.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    // La de AYER (día calendario chileno anterior) sí queda fuera.
    expect(
      citacionVigente([makeCitacion({ fecha: "2026-07-05T00:00:00Z" })], nocheChile),
    ).toBeNull();
  });

  it("(d) citación sin comisión o sin fecha válida → se ignora (no fabrica)", () => {
    const c = citacionVigente(
      [
        makeCitacion({ comision: null, fecha: "2026-07-08T00:00:00Z" }),
        makeCitacion({ comision: "Válida", fecha: "no-es-fecha" }),
        makeCitacion({ comision: "Buena", fecha: "2026-07-20T00:00:00Z" }),
      ],
      HOY,
    );
    expect(c!.comision).toBe("Buena");
  });
});

// ── derivarEstadoActual — integra citacionVigente sin romper firma previa ──────
describe("derivarEstadoActual — línea de citación SC3", () => {
  const HOY = new Date("2026-07-06T12:00:00Z");

  it("con citación futura → est.citacionVigente presente", () => {
    const est = derivarEstadoActual(
      makeProyecto(),
      [],
      [{ comision: "Comisión de Hacienda", fecha: "2026-07-15T00:00:00Z" }],
      HOY,
    );
    expect(est.citacionVigente).toBeDefined();
    expect(est.citacionVigente!.comision).toBe("Comisión de Hacienda");
  });

  it("sin citación futura → est.citacionVigente ausente (omitida)", () => {
    const est = derivarEstadoActual(
      makeProyecto(),
      [],
      [{ comision: "Comisión de Hacienda", fecha: "2026-05-15T00:00:00Z" }],
      HOY,
    );
    expect(est.citacionVigente).toBeUndefined();
  });

  it("firma previa (2 args) sigue compilando y no fabrica citación", () => {
    const est = derivarEstadoActual(makeProyecto(), []);
    expect(est.citacionVigente).toBeUndefined();
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

  it("SC3: con citacionVigente presente renderiza 'Citado en {comisión} el {fecha}.' con fecha Mono", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite",
      citacionVigente: {
        comision: "Comisión de Salud",
        fecha: new Date("2026-07-10T00:00:00Z"),
      },
    };
    const { container } = render(<EstadoActualView estado={estado} />);
    expect(
      screen.getByText(/Citado en Comisión de Salud el/),
    ).toBeInTheDocument();
    // La fecha vive en un span font-mono.
    const monos = container.querySelectorAll("span.font-mono");
    expect(monos.length).toBeGreaterThan(0);
  });

  it("SC3: sin citacionVigente → la línea de citación se OMITE por completo", () => {
    const estado: EstadoActual = { etapaLinea: "Etapa: Primer trámite" };
    render(<EstadoActualView estado={estado} />);
    expect(screen.queryByText(/Citado en/)).not.toBeInTheDocument();
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
