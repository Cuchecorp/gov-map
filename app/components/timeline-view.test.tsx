import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  TimelineView,
  esEventoUrgencia,
  paresDeUrgencia,
} from "./timeline-view";
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
 * Fixture MIXTO (Pitfall 3): un informe + una votación (hitos estructurales) + un par
 * de urgencia contiguo del mismo tipo ("hace presente la urgencia Suma" seguido de un
 * evento urgencia "Suma"). Los hitos NUNCA se colapsan; el par de urgencia SÍ.
 */
function fixtureMixto(): TramitacionEventoRow[] {
  return [
    makeEvento({
      fecha: "2026-01-10T00:00:00Z",
      tipo: "votacion",
      descripcion: "Votación en general",
      enlace: "https://senado.cl/votacion/1",
    }),
    makeEvento({
      fecha: "2026-02-10T00:00:00Z",
      tipo: "informe",
      descripcion: "Informe de comisión de Hacienda",
      enlace: "https://senado.cl/informe/1",
    }),
    makeEvento({
      fecha: "2026-03-10T00:00:00Z",
      tipo: "tramite",
      descripcion: "hace presente la urgencia Suma",
      enlace: "https://senado.cl/urg/1",
    }),
    makeEvento({
      fecha: "2026-04-11T00:00:00Z",
      tipo: "urgencia",
      descripcion: "Suma",
      enlace: "https://senado.cl/urg/2",
    }),
  ];
}

// ── Helpers puros ────────────────────────────────────────────────────────────
describe("esEventoUrgencia — heurística conservadora (Pitfall 3)", () => {
  it("marca tipo='urgencia' y tramite con 'urgencia' en la descripción", () => {
    expect(esEventoUrgencia(makeEvento({ tipo: "urgencia", descripcion: "Suma" }))).toBe(true);
    expect(
      esEventoUrgencia(makeEvento({ tipo: "tramite", descripcion: "hace presente la urgencia Suma" })),
    ).toBe(true);
  });

  it("NO marca hitos estructurales (informe/votación/oficio)", () => {
    expect(esEventoUrgencia(makeEvento({ tipo: "informe", descripcion: "Informe de comisión" }))).toBe(false);
    expect(esEventoUrgencia(makeEvento({ tipo: "votacion", descripcion: "Votación en general" }))).toBe(false);
    expect(esEventoUrgencia(makeEvento({ tipo: "tramite", descripcion: "Pasa a comisión" }))).toBe(false);
  });
});

describe("paresDeUrgencia — sólo runs contiguos del mismo tipo, ≥ 2", () => {
  it("colapsa el par de urgencia del fixture mixto en UN período", () => {
    const periodos = paresDeUrgencia(fixtureMixto());
    expect(periodos.length).toBe(1);
    expect(periodos[0].eventos.length).toBe(2);
    expect(periodos[0].tipo.toLowerCase()).toContain("suma");
  });

  it("un evento-urgencia aislado NO forma período (no es un par repetitivo)", () => {
    const eventos = [
      makeEvento({ fecha: "2026-02-10T00:00:00Z", tipo: "informe", descripcion: "Informe" }),
      makeEvento({ fecha: "2026-03-10T00:00:00Z", tipo: "urgencia", descripcion: "Suma" }),
      makeEvento({ fecha: "2026-04-10T00:00:00Z", tipo: "informe", descripcion: "Segundo informe" }),
    ];
    expect(paresDeUrgencia(eventos).length).toBe(0);
  });

  it("un 'retira la urgencia' NO se colapsa ni cuenta: corta el run y queda visible como hito (WR-03)", () => {
    const eventos = [
      makeEvento({
        fecha: "2026-02-01T00:00:00Z",
        tipo: "tramite",
        descripcion: "hace presente la urgencia Suma",
        enlace: "https://senado.cl/urg/1",
      }),
      makeEvento({
        fecha: "2026-03-01T00:00:00Z",
        tipo: "urgencia",
        descripcion: "Suma",
        enlace: "https://senado.cl/urg/2",
      }),
      makeEvento({
        fecha: "2026-04-01T00:00:00Z",
        tipo: "tramite",
        descripcion: "retira la urgencia Suma",
        enlace: "https://senado.cl/urg/3",
      }),
    ];
    // El retiro queda FUERA del período (2 eventos, no 3).
    const periodos = paresDeUrgencia(eventos);
    expect(periodos.length).toBe(1);
    expect(periodos[0].eventos.length).toBe(2);
    // Y se renderiza como hito normal, SIEMPRE visible (nunca "renovación").
    render(<TimelineView eventos={eventos} boletin="16284-07" />);
    expect(screen.getByText("retira la urgencia Suma")).toBeInTheDocument();
    expect(screen.getByText(/Urgencia Suma: 2 eventos/)).toBeInTheDocument();
  });

  it("fechas inválidas en el run NUNCA fabrican 'ene 1970': el rango se deriva de fechas válidas u se omite (WR-04)", () => {
    // (a) run SIN ninguna fecha válida → línea sin rango (nunca epoch).
    const sinFechas = [
      makeEvento({ fecha: "no-es-fecha", tipo: "urgencia", descripcion: "Suma" }),
      makeEvento({ fecha: "tampoco", tipo: "urgencia", descripcion: "Suma" }),
    ];
    const { container } = render(
      <TimelineView eventos={sinFechas} boletin="16284-07" />,
    );
    expect(screen.getByText(/Urgencia Suma: 2 eventos/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/1970/);
    cleanup();

    // (b) run con UNA fecha inválida → el rango usa solo las válidas (sin epoch).
    const mixtas = [
      makeEvento({ fecha: "no-es-fecha", tipo: "urgencia", descripcion: "Suma" }),
      makeEvento({ fecha: "2026-03-10T00:00:00Z", tipo: "urgencia", descripcion: "Suma" }),
      makeEvento({ fecha: "2026-04-11T00:00:00Z", tipo: "urgencia", descripcion: "Suma" }),
    ];
    const periodos = paresDeUrgencia(mixtas);
    expect(periodos.length).toBe(1);
    expect(periodos[0].desde?.getUTCFullYear()).toBe(2026);
    const r2 = render(<TimelineView eventos={mixtas} boletin="16284-07" />);
    expect(r2.container.textContent).not.toMatch(/1970/);
  });

  it("un par [hace presente, retira] contiguo NO forma período (el retiro no es renovación)", () => {
    const eventos = [
      makeEvento({
        fecha: "2026-02-01T00:00:00Z",
        tipo: "tramite",
        descripcion: "hace presente la urgencia Suma",
      }),
      makeEvento({
        fecha: "2026-03-01T00:00:00Z",
        tipo: "tramite",
        descripcion: "retira la urgencia Suma",
      }),
    ];
    expect(paresDeUrgencia(eventos).length).toBe(0);
  });
});

// ── TimelineView — dos niveles ───────────────────────────────────────────────
describe("TimelineView — hitos visibles + colapso de urgencias (SC2)", () => {
  it("(a) el informe y la votación SIEMPRE aparecen (NO se colapsan)", () => {
    render(<TimelineView eventos={fixtureMixto()} boletin="16284-07" />);
    expect(screen.getByText("Informe de comisión de Hacienda")).toBeInTheDocument();
    expect(screen.getByText("Votación en general")).toBeInTheDocument();
  });

  it("(b) el par de urgencia se colapsa en conteo NEUTRO 'N eventos' (colapsado por defecto)", () => {
    render(<TimelineView eventos={fixtureMixto()} boletin="16284-07" />);
    // Copy neutra (WR-03): NUNCA "renovada N veces" — contaría la presentación
    // inicial (y antes, incluso un retiro) como renovación: afirmación fabricada.
    expect(screen.getByText(/Urgencia Suma: 2 eventos/)).toBeInTheDocument();
    expect(screen.queryByText(/renovada/)).not.toBeInTheDocument();
    // Los eventos individuales de urgencia NO aparecen colapsado.
    expect(screen.queryByText("hace presente la urgencia Suma")).not.toBeInTheDocument();
    // Afford server-driven presente.
    const ver = screen.getByRole("link", { name: /ver todas/ });
    expect(ver.getAttribute("href")).toContain("urgencias=u1");
    expect(ver.getAttribute("href")).toContain("#timeline");
  });

  it("(c) con ?urgencias=u1 los eventos de urgencia de ESE período aparecen", () => {
    render(
      <TimelineView eventos={fixtureMixto()} boletin="16284-07" urgenciaExpandida="u1" />,
    );
    expect(screen.getByText("hace presente la urgencia Suma")).toBeInTheDocument();
    // El afford cambia a "Ocultar urgencias" (quita el param).
    const ocultar = screen.getByRole("link", { name: /Ocultar urgencias/ });
    expect(ocultar.getAttribute("href")).not.toContain("urgencias=");
    // Los hitos estructurales siguen visibles.
    expect(screen.getByText("Informe de comisión de Hacienda")).toBeInTheDocument();
  });

  it("(d) CERO ProvenanceBadge por evento; N links 'Ver fuente oficial ↗' conservados", () => {
    const { container } = render(
      <TimelineView eventos={fixtureMixto()} boletin="16284-07" />,
    );
    // El badge por evento se retiró → no hay texto de ProvenanceBadge en la vista.
    expect(container.textContent).not.toMatch(/Actualizado/);
    // Colapsado: 2 hitos estructurales con enlace → 2 links "Ver fuente oficial ↗".
    expect(screen.getAllByText(/Ver fuente oficial/).length).toBe(2);
  });

  it("(c') expandido → los 4 eventos conservan su link de fuente (trazabilidad por dato)", () => {
    render(
      <TimelineView eventos={fixtureMixto()} boletin="16284-07" urgenciaExpandida="u1" />,
    );
    expect(screen.getAllByText(/Ver fuente oficial/).length).toBe(4);
  });

  it("(e) GATE §9.1: el copy nuevo del colapso no contiene banned-vocab", () => {
    const { container } = render(
      <TimelineView eventos={fixtureMixto()} boletin="16284-07" />,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /porque|a cambio de|afinidad|puntaje|score|ranking|sospechos|pol[eé]mic|traici|abusiv|excesiv|mejor|peor/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });

  it("empty state honesto cuando no hay eventos", () => {
    render(<TimelineView eventos={[]} boletin="16284-07" />);
    expect(
      screen.getByText(/Aún no hay eventos de tramitación registrados/),
    ).toBeInTheDocument();
  });
});

// ── SC7 source-scan: 1 badge en el heading de sección, 0 por evento ──────────
describe("SC7 — provenance por sección (source-scan, Pitfall 8)", () => {
  const APP_ROOT = process.cwd(); // app/
  const EVENT_TSX = path.join(APP_ROOT, "components", "timeline-event.tsx");
  const PAGE_TSX = path.join(APP_ROOT, "app", "proyecto", "[boletin]", "page.tsx");
  const EVENT_SRC = readFileSync(EVENT_TSX, "utf8");
  const PAGE_SRC = readFileSync(PAGE_TSX, "utf8");

  it("timeline-event.tsx NO renderiza ningún ProvenanceBadge (0 por evento)", () => {
    expect(EVENT_SRC).not.toMatch(/<ProvenanceBadge/);
    expect(EVENT_SRC).not.toMatch(/from ["']@\/components\/provenance-badge["']/);
  });

  it("page.tsx renderiza EXACTAMENTE UN <ProvenanceBadge> en la sección timeline", () => {
    const usos = PAGE_SRC.match(/<ProvenanceBadge/g) ?? [];
    expect(usos.length).toBe(1);
  });
});
