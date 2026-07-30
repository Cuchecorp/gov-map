import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  TimelineView,
  construirItems,
  esEventoUrgencia,
  fechaValida,
  paresDeUrgencia,
  type PeriodoUrgencia,
} from "./timeline-view";
import { TimelineEvent } from "./timeline-event";
import { TramitacionStepper } from "./capa1/tramitacion-stepper";
import { LEYENDA_RECURSO_NO_HUMANO } from "@/lib/recurso-no-humano";
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
    expect(container.textContent).not.toMatch(/según fuente al/);
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

// ---------------------------------------------------------------------------
// LINK-EXT (115-03, A-2) — el enlace de cada evento llega al recurso HUMANO y
// pasa por el guard `safeExternalHref`.
//
// Los tests renderizan desde `TimelineView` —NUNCA desde `TimelineEvent` aislado—
// porque el componente tiene DOS call-sites (`:243` evento suelto y `:252` evento
// dentro de un período de urgencia expandido) y un fix aplicado a medias pasaría
// un test sobre el hijo suelto. Ambas ramas se ejercitan explícitamente.
//
// Evidencia de PROD (115-VEREDICTO §3): las 982 filas de `tramitacion_evento` en
// `tramitacion.senado.cl` son TODAS de path `/wspublico/` (XML vacío para un
// humano), y `TramitacionEventoRow.boletin` es `string` no-nulable con 0 nulos
// (`lib/types.ts:32-33`) → el boletín viaja DENTRO de la fila y NO se threadea.
// ---------------------------------------------------------------------------
const WSPUBLICO =
  "https://tramitacion.senado.cl/wspublico/votaciones.php?boletin=16284-07";
const FICHA_HUMANA =
  "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=16284-07";

function hrefsDeFuente(): (string | null)[] {
  return screen
    .queryAllByRole("link", { name: /Ver fuente oficial/ })
    .map((a) => a.getAttribute("href"));
}

describe("TimelineView — enlace externo del evento (LINK-EXT A-2)", () => {
  it("rama :243 (evento suelto): un enlace /wspublico/ se reescribe a la ficha humana del boletín del evento", () => {
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[
          makeEvento({
            tipo: "informe",
            descripcion: "Informe de comisión",
            enlace: WSPUBLICO,
          }),
        ]}
      />,
    );
    expect(hrefsDeFuente()).toEqual([FICHA_HUMANA]);
  });

  it("rama :252 (evento dentro de un período de urgencia expandido): el mismo rewrite aplica", () => {
    const eventos = [
      makeEvento({
        fecha: "2026-03-10T00:00:00Z",
        tipo: "tramite",
        descripcion: "hace presente la urgencia Suma",
        enlace: WSPUBLICO,
      }),
      makeEvento({
        fecha: "2026-04-11T00:00:00Z",
        tipo: "urgencia",
        descripcion: "Suma",
        enlace: WSPUBLICO,
      }),
    ];
    // `urgenciaExpandida="u1"` fuerza la rama expandida (el run contiguo ≥2 del
    // mismo tipo se colapsa en el período "u1"); sin ella el fix de :252 quedaría
    // sin ejercitar y un fix a medias pasaría verde.
    render(
      <TimelineView boletin="16284-07" eventos={eventos} urgenciaExpandida="u1" />,
    );
    const hrefs = hrefsDeFuente();
    expect(hrefs).toHaveLength(2);
    expect(hrefs).toEqual([FICHA_HUMANA, FICHA_HUMANA]);
  });

  it("rama verbatim: un enlace de otro host (www.senado.cl / opendata.camara.cl) pasa SIN cambios", () => {
    const otroSenado = "https://www.senado.cl/appsenado/index.php?iddocto=11240";
    const camara =
      "https://opendata.camara.cl/wscamaradiputados.asmx/getProyecto?prmBoletin=16284-07";
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[
          makeEvento({ fecha: "2026-01-10T00:00:00Z", tipo: "oficio", enlace: otroSenado }),
          makeEvento({ fecha: "2026-02-10T00:00:00Z", tipo: "informe", enlace: camara }),
        ]}
      />,
    );
    expect(hrefsDeFuente()).toEqual([otroSenado, camara]);
  });

  it("seguridad (T-115-10): un enlace con esquema no-web (`javascript:`) NO emite `<a>`", () => {
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[
          makeEvento({
            tipo: "informe",
            descripcion: "Informe de comisión",
            enlace: "javascript:alert(1)",
          }),
        ]}
      />,
    );
    expect(hrefsDeFuente()).toEqual([]);
    // El evento SIGUE visible: se pierde el link, jamás el hecho.
    expect(screen.getByText("Informe de comisión")).toBeTruthy();
  });

  it("enlace null: no se emite `<a>` y el evento sigue visible", () => {
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[makeEvento({ tipo: "informe", enlace: null })]}
      />,
    );
    expect(hrefsDeFuente()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// LINK-EXT (115-03, A-3) — CR-01: la declaración de recurso NO-HUMANO llega a la
// superficie con la MAYOR población afectada (3.797 filas de `tramitacion_evento`
// con host `opendata.camara.cl`, respuesta live HTTP 500 "Falta el parámetro:
// prmBoletin"). Antes del fix, esa superficie rotulaba "Ver fuente oficial ↗" sin
// declarar nada.
//
// WR-04 (patrón SC7): la leyenda se declara UNA vez por contenedor — jamás una copia
// de 90 caracteres por fila, que es el defecto que motivó retirar el badge por evento.
// ---------------------------------------------------------------------------
const OPENDATA =
  "https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin";

describe("TimelineView — declaración de recurso no-humano (LINK-EXT A-3)", () => {
  it("un evento con destino de servicio de datos → la leyenda aparece (y el enlace se conserva)", () => {
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[makeEvento({ tipo: "votacion", enlace: OPENDATA })]}
      />,
    );
    expect(
      screen.getByText(LEYENDA_RECURSO_NO_HUMANO),
    ).toBeInTheDocument();
    // La limitación se declara SIN quitar el enlace: el ciudadano igual puede ir.
    expect(hrefsDeFuente()).toEqual([OPENDATA]);
  });

  it("WR-04: con N filas de servicio de datos la leyenda se renderiza UNA sola vez", () => {
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[
          makeEvento({ fecha: "2026-01-10T00:00:00Z", tipo: "votacion", enlace: OPENDATA }),
          makeEvento({ fecha: "2026-02-10T00:00:00Z", tipo: "informe", enlace: OPENDATA }),
          makeEvento({ fecha: "2026-03-10T00:00:00Z", tipo: "oficio", enlace: OPENDATA }),
        ]}
      />,
    );
    expect(screen.getAllByText(LEYENDA_RECURSO_NO_HUMANO)).toHaveLength(1);
    expect(hrefsDeFuente()).toHaveLength(3);
  });

  it("por fila la limitación viaja en el nombre accesible y el `title` (sin ocupar caja)", () => {
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[makeEvento({ tipo: "votacion", enlace: OPENDATA })]}
      />,
    );
    const a = screen.getByRole("link", { name: /Ver fuente oficial/ });
    expect(a.getAttribute("aria-label")).toContain(LEYENDA_RECURSO_NO_HUMANO);
    expect(a).toHaveAttribute("title", LEYENDA_RECURSO_NO_HUMANO);
  });

  it("tras el rewrite A-2 un `/wspublico/` del Senado YA es página humana → NINGUNA leyenda", () => {
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[makeEvento({ tipo: "informe", enlace: WSPUBLICO })]}
      />,
    );
    expect(hrefsDeFuente()).toEqual([FICHA_HUMANA]);
    expect(
      screen.queryByText(LEYENDA_RECURSO_NO_HUMANO),
    ).not.toBeInTheDocument();
    const a = screen.getByRole("link", { name: /Ver fuente oficial/ });
    expect(a).not.toHaveAttribute("title");
  });

  it("un evento de servicio de datos DENTRO de un período colapsado también declara", () => {
    // El período se colapsa por defecto: sus filas no se renderizan. La declaración se
    // calcula sobre TODOS los eventos, para que no aparezca y desaparezca con el plegado.
    render(
      <TimelineView
        boletin="16284-07"
        eventos={[
          makeEvento({
            fecha: "2026-03-10T00:00:00Z",
            tipo: "tramite",
            descripcion: "hace presente la urgencia Suma",
            enlace: OPENDATA,
          }),
          makeEvento({
            fecha: "2026-04-11T00:00:00Z",
            tipo: "urgencia",
            descripcion: "Suma",
            enlace: OPENDATA,
          }),
        ]}
      />,
    );
    expect(hrefsDeFuente()).toEqual([]); // colapsado: cero filas visibles
    expect(screen.getAllByText(LEYENDA_RECURSO_NO_HUMANO)).toHaveLength(1);
  });

  it("sin ningún destino de servicio de datos → CERO leyenda (no se declara de más)", () => {
    render(<TimelineView eventos={fixtureMixto()} boletin="16284-07" />);
    expect(
      screen.queryByText(LEYENDA_RECURSO_NO_HUMANO),
    ).not.toBeInTheDocument();
  });
});

// ── F-04 / F-05 / F-07 (117-02, Task 1) ─────────────────────────────────────
describe("F-04: fechaValida rechaza fechas implausibles", () => {
  it("el typo de siglo real de PROD (boletín 18232-25, 2626-05-25) ⇒ null", () => {
    expect(fechaValida("2626-05-25T00:00:00+00:00")).toBeNull();
  });

  it("una fecha anterior al piso de plausibilidad (1989) ⇒ null", () => {
    expect(fechaValida("1989-06-01T00:00:00Z")).toBeNull();
  });

  it("una fecha plausible ⇒ Date válida (comportamiento previo intacto)", () => {
    const d = fechaValida("2026-07-07T00:00:00Z");
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });

  it("null / basura ⇒ null (comportamiento previo intacto)", () => {
    expect(fechaValida(null)).toBeNull();
    expect(fechaValida("basura")).toBeNull();
  });
});

/**
 * WR-02 (117-REVIEW): el evento sin fecha plausible sigue VISIBLE (no se filtra) pero
 * NO puede ocupar una posición cronológica fabricada. Con el `?? 0` previo valía epoch
 * 0 y encabezaba el timeline como "el evento más antiguo de la tramitación".
 */
describe("construirItems — orden: las fechas implausibles van al FINAL, no al tope", () => {
  const corrupto = makeEvento({
    fecha: "2626-05-25T00:00:00+00:00", // typo real de PROD (boletín 18232-25)
    descripcion: "Evento con fecha imposible",
  });
  const antiguo = makeEvento({
    fecha: "2020-01-15T00:00:00Z",
    descripcion: "Ingreso de proyecto",
  });
  const reciente = makeEvento({
    fecha: "2026-05-14T00:00:00Z",
    descripcion: "Informe de comisión",
  });

  function descripciones(items: ReturnType<typeof construirItems>): string[] {
    return items.map((it) =>
      it.kind === "evento" ? (it.evento.descripcion ?? "") : `periodo:${it.periodo.tipo}`,
    );
  }

  it("el corrupto NO encabeza: queda después de todos los de fecha plausible", () => {
    const orden = descripciones(construirItems([corrupto, reciente, antiguo]));
    expect(orden).toEqual([
      "Ingreso de proyecto",
      "Informe de comisión",
      "Evento con fecha imposible",
    ]);
  });

  it("el hecho sigue presente (omisión de la FECHA, nunca del evento)", () => {
    const items = construirItems([corrupto, antiguo]);
    expect(items).toHaveLength(2);
    expect(descripciones(items)).toContain("Evento con fecha imposible");
  });

  it("varios implausibles conservan el orden de entrada (sort estable)", () => {
    const a = makeEvento({ fecha: "2626-01-01T00:00:00Z", descripcion: "corrupto A" });
    // Bajo el piso de `fechaPlausible` (1990) → también implausible.
    const b = makeEvento({ fecha: "1899-01-01T00:00:00Z", descripcion: "corrupto B" });
    const orden = descripciones(construirItems([a, b, reciente]));
    expect(orden).toEqual(["Informe de comisión", "corrupto A", "corrupto B"]);
  });

  it("un run de urgencia contiguo no se parte por la fila corrupta", () => {
    const u1 = makeEvento({
      fecha: "2026-02-01T00:00:00Z",
      descripcion: "hace presente la urgencia Suma",
    });
    const u2 = makeEvento({
      fecha: "2026-03-01T00:00:00Z",
      descripcion: "hace presente la urgencia Suma",
    });
    const items = construirItems([u1, corrupto, u2]);
    expect(items.filter((it) => it.kind === "periodo")).toHaveLength(1);
  });
});

describe("F-04/F-05/F-07 en TimelineEvent", () => {
  it("un evento del año 2626 NO filtra la fecha implausible al DOM", () => {
    const { container } = render(
      <TimelineEvent
        evento={makeEvento({ fecha: "2626-05-25T00:00:00+00:00" })}
      />,
    );
    expect(container.textContent).not.toContain("2626");
  });

  it("un hito de las 00:14 UTC se rinde con el día chileno real y rotulado", () => {
    const { container } = render(
      <TimelineEvent evento={makeEvento({ fecha: "2023-11-17T00:14:41Z" })} />,
    );
    expect(container.textContent).toContain("Hito del 16 nov 2023");
  });
});

describe("F-07 en TramitacionStepper", () => {
  it("rinde `{descripcion} — {fecha}` con guion largo entre ambos", () => {
    const { container } = render(
      <TramitacionStepper
        eventos={[
          makeEvento({
            fecha: "2026-05-14T00:00:00Z",
            descripcion: "Ingreso de proyecto",
          }),
        ]}
        estado={{}}
        boletin="16284-07"
      />,
    );
    expect(container.textContent).toContain(
      "Ingreso de proyecto \u2014 14 may 2026",
    );
  });
});

// ---------------------------------------------------------------------------
// (H-06/D-03) orden total determinista en la lectura de tramitacion_evento.
//
// El detector es un helper PURO, ejercitado tanto contra el archivo real
// (readFileSync de page.tsx) como contra fixtures en memoria para el control
// positivo apareado \u2014 un solo detector, cero copia del regex que pueda derivar
// de la fuente que en verdad protege.
// ---------------------------------------------------------------------------
function ordenTotalDeclarado(src: string): boolean {
  const bloque = src.split('.from("tramitacion_evento")')[1] ?? "";
  return /\.order\("fecha"[\s\S]{0,120}\.order\("id"/.test(bloque);
}

describe("(H-06/D-03) orden total determinista en la lectura de tramitacion_evento", () => {
  const APP_ROOT = process.cwd(); // app/
  const PAGE_TSX = path.join(APP_ROOT, "app", "proyecto", "[boletin]", "page.tsx");
  const PAGE_SRC = readFileSync(PAGE_TSX, "utf8");

  it("la lectura real de tramitacion_evento en page.tsx encadena .order(fecha).order(id)", () => {
    expect(ordenTotalDeclarado(PAGE_SRC)).toBe(true);
  });

  it("control positivo apareado: el MISMO detector falla si s\u00f3lo hay .order(fecha) (cero vacuo)", () => {
    const soloFecha = `
      sb.from("tramitacion_evento").select("*").eq("boletin", boletin)
        .order("fecha", { ascending: true }),
    `;
    expect(ordenTotalDeclarado(soloFecha)).toBe(false);
  });

  it("no se satisface con un .order(id) que viva en OTRA query del archivo (match acotado al bloque tras .from)", () => {
    const otraQueryConId = `
      sb.from("otra_tabla").select("*").order("id", { ascending: true }),
      sb.from("tramitacion_evento").select("*").eq("boletin", boletin)
        .order("fecha", { ascending: true }),
    `;
    expect(ordenTotalDeclarado(otraQueryConId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (H-06/D-02) paridad regla escrita ↔ construirItems sobre el testigo 14309-04.
//
// Ata el builder TS a la regla escrita medida contra PROD (supabase/queries/
// timeline-regla-de-seleccion.sql): si construirItems deriva de la regla, este
// test se pone rojo. NO prueba paridad DOM contra un deploy real — esa
// verificación (grep -o 'Hito del' … | wc -l sobre el HTML del Worker, jamás
// grep -c: el HTML es de una línea) queda delegada a Phase 138 con el número
// YA congelado aquí en *.esperado.json.
//
// QUÉ CUENTA `hitos_del` — PRECONDICIONES (WR-02, 131-REVIEW; ver el campo
// `precondiciones` de *.esperado.json y la cabecera de la query). `hitos_del` = ítems
// `kind:"evento"` de `construirItems`. Iguala el conteo DOM de "Hito del" SÓLO si:
//   (1) la ficha se pide SIN `?urgencias=uN` — ese parámetro EXPANDE un período
//       colapsado y renderiza sus eventos como `TimelineEvent` (timeline-view.tsx:
//       305-310), llevando el DOM a `hitos_del + n(uN)`; el default es colapsado;
//   (2) TODOS los eventos tienen fecha PLAUSIBLE — `TimelineEvent` sólo emite el
//       `<span>Hito del …</span>` si `fecha && fechaPlausible(fecha)`
//       (timeline-event.tsx:101), así que un ítem `kind:"evento"` con fecha nula o
//       implausible cuenta AQUÍ pero NO aparece en el HTML.
// Ambas verificadas para 14309-04. Phase 138 no debe leer un mismatch bajo otras
// precondiciones como regresión.
// ---------------------------------------------------------------------------
import fixtureEventos from "./__fixtures__/timeline-14309-04.json";
import esperado from "./__fixtures__/timeline-14309-04.esperado.json";

describe("(H-06/D-02) paridad regla escrita ↔ construirItems sobre el testigo 14309-04", () => {
  // El fixture viene TAL CUAL en orden (fecha asc, id asc) — no se re-ordena
  // aquí, o se estaría probando otra cosa que lo que la producción entrega
  // tras Task 2.
  const items = construirItems(fixtureEventos as unknown as TramitacionEventoRow[]);

  it("produce exactamente esperado.periodos ítems de kind === 'periodo'", () => {
    const periodos = items.filter((it) => it.kind === "periodo");
    expect(periodos.length).toBe(esperado.periodos);
  });

  it("la suma de eventos absorbidos en los períodos es exactamente esperado.eventos_absorbidos", () => {
    const periodos = items.filter(
      (it): it is { kind: "periodo"; periodo: PeriodoUrgencia } => it.kind === "periodo",
    );
    const absorbidos = periodos.reduce((n, it) => n + it.periodo.eventos.length, 0);
    expect(absorbidos).toBe(esperado.eventos_absorbidos);
  });

  it("el número de ítems kind === 'evento' es exactamente esperado.hitos_del", () => {
    const hitos = items.filter((it) => it.kind === "evento");
    expect(hitos.length).toBe(esperado.hitos_del);
  });

  // WR-06 (131-REVIEW): el assert anterior comparaba TRES literales del MISMO JSON
  // entre sí (`hitos_del + eventos_absorbidos === eventos_totales`). Como la query
  // DEFINE `hitos_del` = `eventos_totales - eventos_absorbidos`, la igualdad no podía
  // fallar salvo edición manual del JSON: forma de guard, valor cero, y no tocaba una
  // sola línea de `construirItems`. Ahora el cierre se ejerce sobre los ÍTEMS REALES
  // del builder: que cubran los 99 eventos del fixture SIN duplicar ni perder ninguno.
  it("cierra sin residuo: los ítems del builder cubren los eventos del fixture sin duplicar ni perder", () => {
    const cubiertos = items.flatMap((it) =>
      it.kind === "evento" ? [it.evento.id] : it.periodo.eventos.map((e) => e.id),
    );
    const idsFixture = (fixtureEventos as unknown as TramitacionEventoRow[]).map((e) => e.id);
    // Sin duplicados: cada evento aparece EXACTAMENTE una vez (o suelto, o absorbido).
    expect(new Set(cubiertos).size).toBe(cubiertos.length);
    // Sin pérdidas: el conjunto cubierto es el conjunto del fixture, elemento a elemento.
    expect([...cubiertos].sort()).toEqual([...idsFixture].sort());
    // Y recién ahora el número congelado: el conteo REAL de ítems del builder cuadra
    // con `hitos_del` + los eventos absorbidos, contra el fixture crudo.
    expect(cubiertos.length).toBe(fixtureEventos.length);
    expect(esperado.eventos_totales).toBe(fixtureEventos.length);
  });
});
