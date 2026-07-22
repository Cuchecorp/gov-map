import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  derivarEstadoActual,
  citacionVigente,
  citacionesPasadas,
  enTablaSala,
  EstadoActualView,
  type EstadoActual,
  type CitacionCruda,
  type TablaSalaCruda,
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
    prm_id_camara: null,
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

// ── Token de urgencia SIEMPRE visible (3 estados honestos) ───────────────────
describe("derivarEstadoActual — urgenciaEstado de 3 valores (deep-links quick 260722-eia)", () => {
  it("(a) eventos con urgencia vigente → urgenciaEstado kind 'vigente' (+ urgenciaVigente conservado)", () => {
    const eventos = [
      makeEvento({
        fecha: "2026-04-10T00:00:00Z",
        descripcion: "hace presente la urgencia Suma",
      }),
    ];
    const est = derivarEstadoActual(makeProyecto(), eventos);
    expect(est.urgenciaEstado).toBeDefined();
    expect(est.urgenciaEstado!.kind).toBe("vigente");
    if (est.urgenciaEstado!.kind === "vigente") {
      expect(est.urgenciaEstado!.tipo.toLowerCase()).toContain("suma");
      expect(est.urgenciaEstado!.desde).toBeInstanceOf(Date);
    }
    // El campo legacy se conserva para el stepper que lo consume.
    expect(est.urgenciaVigente).toBeDefined();
  });

  it("(b) tramitación presente pero sin urgencia vigente → kind 'sin-vigente'", () => {
    const eventos = [
      makeEvento({ fecha: "2026-03-01T00:00:00Z", descripcion: "Ingreso" }),
      makeEvento({ fecha: "2026-05-20T00:00:00Z", descripcion: "Informe de comisión" }),
    ];
    const est = derivarEstadoActual(makeProyecto(), eventos);
    expect(est.urgenciaEstado).toBeDefined();
    expect(est.urgenciaEstado!.kind).toBe("sin-vigente");
    expect(est.urgenciaVigente).toBeUndefined();
  });

  it("(b') urgencia retirada → kind 'sin-vigente' (hay tramitación, sin vigencia)", () => {
    const eventos = [
      makeEvento({ fecha: "2026-04-10T00:00:00Z", descripcion: "hace presente la urgencia Suma" }),
      makeEvento({ fecha: "2026-05-01T00:00:00Z", descripcion: "retira la urgencia" }),
    ];
    const est = derivarEstadoActual(makeProyecto(), eventos);
    expect(est.urgenciaEstado!.kind).toBe("sin-vigente");
  });

  it("(c) sin eventos → urgenciaEstado AUSENTE (omitido, no se fabrica)", () => {
    const est = derivarEstadoActual(makeProyecto(), []);
    expect(est.urgenciaEstado).toBeUndefined();
  });

  it("la fuente del token (origen + fecha_captura más reciente) se deriva de los eventos", () => {
    const eventos = [
      makeEvento({
        fecha: "2026-03-01T00:00:00Z",
        descripcion: "Ingreso",
        origen: "senado",
        fecha_captura: "2026-06-01T00:00:00Z",
      }),
      makeEvento({
        fecha: "2026-05-20T00:00:00Z",
        descripcion: "Informe de comisión",
        origen: "senado",
        fecha_captura: "2026-07-15T00:00:00Z",
      }),
    ];
    const est = derivarEstadoActual(makeProyecto(), eventos);
    expect(est.urgenciaFuente).toBeDefined();
    expect(est.urgenciaFuente!.origen).toBe("senado");
    // fecha_captura más reciente = 2026-07-15.
    expect(est.urgenciaFuente!.fechaCaptura.toISOString().slice(0, 10)).toBe("2026-07-15");
  });
});

describe("EstadoActualView — token de urgencia 3 estados", () => {
  it("(a) urgenciaEstado 'vigente' → renderiza 'Urgencia {tipo} vigente desde el'", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite",
      urgenciaEstado: { kind: "vigente", tipo: "Suma", desde: new Date("2026-05-18T00:00:00Z") },
    };
    render(<EstadoActualView estado={estado} />);
    expect(screen.getByText(/Urgencia Suma vigente desde el/)).toBeInTheDocument();
  });

  it("(b) urgenciaEstado 'sin-vigente' → renderiza 'Sin urgencia vigente' (hecho negativo honesto, no '—')", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite",
      urgenciaEstado: { kind: "sin-vigente" },
    };
    render(<EstadoActualView estado={estado} />);
    expect(screen.getByText(/Sin urgencia vigente/)).toBeInTheDocument();
    expect(screen.queryByText(/Urgencia — vigente/)).not.toBeInTheDocument();
  });

  it("(c) sin urgenciaEstado → no hay token de urgencia (omitido)", () => {
    const estado: EstadoActual = { etapaLinea: "Etapa: Primer trámite" };
    render(<EstadoActualView estado={estado} />);
    expect(screen.queryByText(/Sin urgencia vigente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/vigente desde el/)).not.toBeInTheDocument();
  });

  it("la coletilla de fuente se renderiza cuando urgenciaFuente está presente", () => {
    const estado: EstadoActual = {
      urgenciaEstado: { kind: "sin-vigente" },
      urgenciaFuente: { origen: "senado", fechaCaptura: new Date("2026-07-15T00:00:00Z") },
    };
    render(<EstadoActualView estado={estado} />);
    expect(screen.getByText(/según Senado al/)).toBeInTheDocument();
  });

  it("anti-insinuación: el token de urgencia no contiene adjetivos de juicio", () => {
    const estado: EstadoActual = {
      urgenciaEstado: { kind: "sin-vigente" },
      urgenciaFuente: { origen: "senado", fechaCaptura: new Date("2026-07-15T00:00:00Z") },
    };
    const { container } = render(<EstadoActualView estado={estado} />);
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(
      /importante|clave|prioridad|urgente de verdad|estancad|polémic|sospechos/i,
    );
  });
});

// ── EstadoActualView — presentación pura (omisión + banned-vocab) ────────────
describe("EstadoActualView — render honesto", () => {
  it("renderiza el heading '¿Dónde está hoy?' y las líneas derivadas", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite · En tramitación",
      ultimoHito: { descripcion: "Pasa a comisión", fecha: new Date("2026-05-20T00:00:00Z") },
      // El token de urgencia ahora se dirige por urgenciaEstado (quick 260722-eia).
      urgenciaEstado: { kind: "vigente", tipo: "Suma", desde: new Date("2026-05-18T00:00:00Z") },
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

  it("Gap #1: citacionesPasadas → 'Citado el {fecha} en {comisión}' con marca sobria '(sesión pasada)'", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite",
      citacionesPasadas: [
        { comision: "de Economía", fecha: new Date("2026-07-21T00:00:00Z") },
      ],
    };
    const { container } = render(<EstadoActualView estado={estado} />);
    expect(screen.getByText(/Citado el/)).toBeInTheDocument();
    expect(screen.getByText(/de Economía/)).toBeInTheDocument();
    // marca sobria en text-muted-foreground (NUNCA destructive/alarma).
    const marca = screen.getByText(/\(sesión pasada\)/);
    expect(marca).toBeInTheDocument();
    expect(marca.className).toContain("text-muted-foreground");
    expect(marca.className).not.toContain("destructive");
    // la fecha vive en un span font-mono.
    expect(container.querySelectorAll("span.font-mono").length).toBeGreaterThan(0);
  });

  it("Gap #1: sin citacionesPasadas → sub-bloque omitido", () => {
    const estado: EstadoActual = { etapaLinea: "Etapa: Primer trámite" };
    render(<EstadoActualView estado={estado} />);
    expect(screen.queryByText(/\(sesión pasada\)/)).not.toBeInTheDocument();
  });

  it("Gap #2: una aparición en tabla de sala → línea con link petróleo a /agenda?semana=", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite",
      enTablaSala: [
        {
          camara: "senado",
          fecha: new Date("2026-07-14T00:00:00Z"),
          semanaIso: "2026-W29",
        },
      ],
    };
    render(<EstadoActualView estado={estado} />);
    expect(screen.getByText(/En tabla de sala de la Senado del/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /ver en la agenda/ });
    expect(link).toHaveAttribute("href", "/agenda?semana=2026-W29");
    expect(link.className).toContain("text-accent-product");
  });

  it("Gap #2: varias apariciones → conteo honesto 'En tabla de sala N veces' con link por semana", () => {
    const estado: EstadoActual = {
      etapaLinea: "Etapa: Primer trámite",
      enTablaSala: [
        {
          camara: "senado",
          fecha: new Date("2026-07-14T00:00:00Z"),
          semanaIso: "2026-W29",
        },
        {
          camara: "senado",
          fecha: new Date("2026-07-07T00:00:00Z"),
          semanaIso: "2026-W28",
        },
      ],
    };
    render(<EstadoActualView estado={estado} />);
    expect(screen.getByText(/En tabla de sala 2 veces/)).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    const semanas = links.map((l) => l.getAttribute("href"));
    expect(semanas).toContain("/agenda?semana=2026-W29");
    expect(semanas).toContain("/agenda?semana=2026-W28");
  });

  it("Gap #2: sin enTablaSala → línea omitida (nunca 'no está en tabla')", () => {
    const estado: EstadoActual = { etapaLinea: "Etapa: Primer trámite" };
    const { container } = render(<EstadoActualView estado={estado} />);
    expect(screen.queryByText(/tabla de sala/)).not.toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/no está en tabla/i);
  });

  it("bloque se renderiza aunque SOLO haya pasadas o tabla de sala (guard actualizado)", () => {
    const soloPasadas: EstadoActual = {
      citacionesPasadas: [
        { comision: "de Economía", fecha: new Date("2026-07-21T00:00:00Z") },
      ],
    };
    render(<EstadoActualView estado={soloPasadas} />);
    expect(
      screen.getByRole("heading", { name: /¿Dónde está hoy\?/ }),
    ).toBeInTheDocument();
    cleanup();
    const soloSala: EstadoActual = {
      enTablaSala: [
        {
          camara: "camara",
          fecha: new Date("2026-07-14T00:00:00Z"),
          semanaIso: "2026-W29",
        },
      ],
    };
    render(<EstadoActualView estado={soloSala} />);
    expect(
      screen.getByRole("heading", { name: /¿Dónde está hoy\?/ }),
    ).toBeInTheDocument();
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
      urgenciaEstado: { kind: "vigente", tipo: "Suma", desde: new Date("2026-05-18T00:00:00Z") },
    };
    const { container } = render(<EstadoActualView estado={estado} />);
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /porque|a cambio de|afinidad|puntaje|score|ranking|sospechos|pol[eé]mic|traici|conflicto de inter|mejor|peor|urgente de verdad|estancad/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

// ── citacionesPasadas — Gap #1 (CIT-05), pasadas visibles omit-when-empty ────
describe("citacionesPasadas — deriva las citaciones con fecha < hoy-Chile", () => {
  const HOY = new Date("2026-07-22T12:00:00Z");

  it("18193-06-like: 1 citación 2026-07-21 (ayer) → 1 pasada; citacionVigente null", () => {
    const cits: CitacionCruda[] = [
      { comision: "de Economía", fecha: "2026-07-21T00:00:00Z" },
    ];
    const pasadas = citacionesPasadas(cits, HOY);
    expect(pasadas).toHaveLength(1);
    expect(pasadas[0].comision).toBe("de Economía");
    expect(pasadas[0].fecha.toISOString().slice(0, 10)).toBe("2026-07-21");
    // el mismo insumo NO produce vigente (la fecha ya pasó).
    expect(citacionVigente(cits, HOY)).toBeNull();
  });

  it("orden DESC (más reciente primero) y máx 5", () => {
    const cits: CitacionCruda[] = [
      { comision: "A", fecha: "2026-01-10T00:00:00Z" },
      { comision: "B", fecha: "2026-06-10T00:00:00Z" },
      { comision: "C", fecha: "2026-03-10T00:00:00Z" },
      { comision: "D", fecha: "2026-05-10T00:00:00Z" },
      { comision: "E", fecha: "2026-02-10T00:00:00Z" },
      { comision: "F", fecha: "2026-04-10T00:00:00Z" },
    ];
    const pasadas = citacionesPasadas(cits, HOY);
    expect(pasadas).toHaveLength(5); // acotado
    // la más reciente (2026-06-10, "B") primero.
    expect(pasadas[0].comision).toBe("B");
    // orden estrictamente descendente.
    for (let i = 1; i < pasadas.length; i++) {
      expect(pasadas[i - 1].fecha.getTime()).toBeGreaterThanOrEqual(
        pasadas[i].fecha.getTime(),
      );
    }
  });

  it("una citación de HOY NO cuenta como pasada (la lleva citacionVigente)", () => {
    const cits: CitacionCruda[] = [
      { comision: "Hoy", fecha: "2026-07-22T00:00:00Z" },
    ];
    expect(citacionesPasadas(cits, HOY)).toHaveLength(0);
    expect(citacionVigente(cits, HOY)).not.toBeNull();
  });

  it("descarta sin comisión o sin fecha válida; sin pasadas → [] (omitida)", () => {
    const cits: CitacionCruda[] = [
      { comision: null, fecha: "2026-05-01T00:00:00Z" },
      { comision: "Mala fecha", fecha: "no-es-fecha" },
    ];
    expect(citacionesPasadas(cits, HOY)).toEqual([]);
    expect(citacionesPasadas([], HOY)).toEqual([]);
  });

  it("WR-01: un boletín en ≥2 puntos de la MISMA citación (mismo id) → UNA sola pasada", () => {
    // El embed citacion_punto × citacion emite una fila por PUNTO: la misma
    // citación (id="c1") listada dos veces por dos puntos NO debe duplicar la
    // línea. Se conserva una sola aparición por identidad del padre.
    const cits: CitacionCruda[] = [
      { id: "c1", comision: "de Economía", fecha: "2026-07-21T00:00:00Z" },
      { id: "c1", comision: "de Economía", fecha: "2026-07-21T00:00:00Z" },
    ];
    const pasadas = citacionesPasadas(cits, HOY);
    expect(pasadas).toHaveLength(1);
    expect(pasadas[0].comision).toBe("de Economía");
  });

  it("WR-01: citaciones DISTINTAS (ids distintos) NO se colapsan; sin id tampoco se colapsan", () => {
    // Dos ids distintos = dos citaciones reales → 2 líneas.
    const distintas: CitacionCruda[] = [
      { id: "c1", comision: "A", fecha: "2026-07-21T00:00:00Z" },
      { id: "c2", comision: "B", fecha: "2026-07-20T00:00:00Z" },
    ];
    expect(citacionesPasadas(distintas, HOY)).toHaveLength(2);
    // Sin id (legacy/tests) no hay identidad → no se colapsa aunque coincidan.
    const sinId: CitacionCruda[] = [
      { comision: "A", fecha: "2026-07-21T00:00:00Z" },
      { comision: "A", fecha: "2026-07-21T00:00:00Z" },
    ];
    expect(citacionesPasadas(sinId, HOY)).toHaveLength(2);
  });
});

// ── enTablaSala — Gap #2 (CIT-04), lectura sesion_tabla_item omit-when-empty ──
describe("enTablaSala — deriva las apariciones en la tabla de sala", () => {
  it("13665-07-like: 2 filas de sala W28/W29 (Senado) → 2 entradas, DESC, con semana ISO", () => {
    const filas: TablaSalaCruda[] = [
      { camara: "senado", fecha: "2026-07-07T00:00:00Z" }, // W28
      { camara: "senado", fecha: "2026-07-14T00:00:00Z" }, // W29
    ];
    const sala = enTablaSala(filas);
    expect(sala).toHaveLength(2);
    // DESC: la más reciente (W29 = 2026-07-14) primero.
    expect(sala[0].fecha.toISOString().slice(0, 10)).toBe("2026-07-14");
    expect(sala[0].semanaIso).toBe("2026-W29");
    expect(sala[1].semanaIso).toBe("2026-W28");
    expect(sala[0].camara).toBe("senado");
  });

  it("descarta cámara inválida / fecha inválida; sin filas → [] (omitida)", () => {
    const filas: TablaSalaCruda[] = [
      { camara: null, fecha: "2026-07-07T00:00:00Z" },
      { camara: "senado", fecha: "no-es-fecha" },
    ];
    expect(enTablaSala(filas)).toEqual([]);
    expect(enTablaSala([])).toEqual([]);
  });

  it("WR-02: un boletín en ≥2 ítems de la MISMA sesión (misma cámara+día) → UNA aparición", () => {
    // El embed sesion_tabla_item × sesion_sala emite una fila por ÍTEM: la misma
    // sesión (senado, 2026-07-14) listada dos veces NO debe inflar el conteo ni
    // duplicar el link a la misma semana.
    const filas: TablaSalaCruda[] = [
      { camara: "senado", fecha: "2026-07-14T00:00:00Z" },
      { camara: "senado", fecha: "2026-07-14T00:00:00Z" },
    ];
    const sala = enTablaSala(filas);
    expect(sala).toHaveLength(1);
    expect(sala[0].semanaIso).toBe("2026-W29");
  });

  it("WR-02: días distintos o cámaras distintas del mismo día NO se colapsan", () => {
    // Dos días distintos = dos apariciones legítimas.
    const dosDias: TablaSalaCruda[] = [
      { camara: "senado", fecha: "2026-07-07T00:00:00Z" },
      { camara: "senado", fecha: "2026-07-14T00:00:00Z" },
    ];
    expect(enTablaSala(dosDias)).toHaveLength(2);
    // Mismo día, distinta cámara = dos apariciones legítimas.
    const dosCamaras: TablaSalaCruda[] = [
      { camara: "senado", fecha: "2026-07-14T00:00:00Z" },
      { camara: "camara", fecha: "2026-07-14T00:00:00Z" },
    ];
    expect(enTablaSala(dosCamaras)).toHaveLength(2);
  });
});

// ── derivarEstadoActual — integra los nuevos campos sin romper 88/89 ──────────
describe("derivarEstadoActual — Gap #1/#2 sin regresión de firma", () => {
  const HOY = new Date("2026-07-22T12:00:00Z");

  it("18193-06-like: pasada presente, vigente ausente (3 args)", () => {
    const est = derivarEstadoActual(
      makeProyecto(),
      [],
      [{ comision: "de Economía", fecha: "2026-07-21T00:00:00Z" }],
      HOY,
    );
    expect(est.citacionesPasadas).toBeDefined();
    expect(est.citacionesPasadas).toHaveLength(1);
    expect(est.citacionVigente).toBeUndefined();
    expect(est.enTablaSala).toBeUndefined();
  });

  it("13665-07-like: enTablaSala presente vía 5º arg; pasadas/vigente ausentes", () => {
    const est = derivarEstadoActual(
      makeProyecto(),
      [],
      [],
      HOY,
      [
        { camara: "senado", fecha: "2026-07-07T00:00:00Z" },
        { camara: "senado", fecha: "2026-07-14T00:00:00Z" },
      ],
    );
    expect(est.enTablaSala).toBeDefined();
    expect(est.enTablaSala).toHaveLength(2);
    expect(est.enTablaSala![0].semanaIso).toBe("2026-W29");
    expect(est.citacionesPasadas).toBeUndefined();
    expect(est.citacionVigente).toBeUndefined();
  });

  it("firma vieja (2 args) sigue compilando y NO fabrica pasadas/sala", () => {
    const est = derivarEstadoActual(makeProyecto(), []);
    expect(est.citacionesPasadas).toBeUndefined();
    expect(est.enTablaSala).toBeUndefined();
  });

  it("firma de 3 args (con citaciones, sin sala) sigue funcionando", () => {
    const est = derivarEstadoActual(makeProyecto(), [], [
      { comision: "de Economía", fecha: "2026-07-21T00:00:00Z" },
    ]);
    // sin `hoy` fijo el default es new Date() — no aseveramos vigente/pasada,
    // solo que la firma de 3 args compila y enTablaSala queda ausente.
    expect(est.enTablaSala).toBeUndefined();
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
