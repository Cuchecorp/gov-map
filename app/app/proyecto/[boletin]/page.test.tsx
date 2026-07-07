import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Tests de la recomposición UXCOG 55-04 de la ficha /proyecto/[boletin]:
 * rail sticky (6 secciones) + capa-1 de Tramitación = TramitacionStepper SIEMPRE
 * visible + tramitación completa colapsada en DetalleColapsable. Verifican por
 * COMPORTAMIENTO (HTML renderizado), espejo del scaffold de la ficha
 * /parlamentario/[id]:
 *
 *   - el shell monta el grid de 2 columnas (max-w-5xl) con las 6 secciones hermanas
 *     (mt-12 scroll-mt-6);
 *   - ProyectoRail arma las 6 entradas de nav + caveat 1× + conteo honesto;
 *   - TramitacionSection eleva el stepper (capa-1) FUERA del disclosure y mete el
 *     TimelineView completo DENTRO de DetalleColapsable.
 *
 * El test NO toca PROD/DB: `@/lib/supabase` y `next/navigation` se mockean.
 */

// notFound() — no debe dispararse con un boletín válido; sentinel detectable.
class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundSignal";
  }
}
const notFoundMock = vi.fn(() => {
  throw new NotFoundSignal();
});
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

const proyectoRow = {
  boletin: "16284-07",
  boletin_num: "16284",
  titulo: "Proyecto de prueba de ley",
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
};

// Hitos clave estructurales + una corrida de urgencia repetitiva ≥2 (agrupable).
const eventos = [
  {
    boletin: "16284-07",
    fecha: "2026-01-10T00:00:00Z",
    camara: "senado",
    tipo: "votacion",
    descripcion: "Votación en general",
    enlace: "https://senado.cl/v/1",
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00Z",
  },
  {
    boletin: "16284-07",
    fecha: "2026-02-10T00:00:00Z",
    camara: "senado",
    tipo: "informe",
    descripcion: "Informe de comisión de Hacienda",
    enlace: "https://senado.cl/i/1",
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00Z",
  },
  {
    boletin: "16284-07",
    fecha: "2026-03-10T00:00:00Z",
    camara: "senado",
    tipo: "tramite",
    descripcion: "hace presente la urgencia Suma",
    enlace: "https://senado.cl/u/1",
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00Z",
  },
  {
    boletin: "16284-07",
    fecha: "2026-04-11T00:00:00Z",
    camara: "senado",
    tipo: "urgencia",
    descripcion: "Suma",
    enlace: "https://senado.cl/u/2",
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00Z",
  },
];

// `.from()` mock por tabla. proyecto → maybeSingle; tramitacion_evento → order;
// votacion (conteo del rail) → thenable con count; resto → vacío honesto.
const fromMock = vi.fn((tabla: string) => {
  if (tabla === "proyecto") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: proyectoRow, error: null }),
        }),
      }),
    };
  }
  if (tabla === "tramitacion_evento") {
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: eventos, error: null }),
        }),
      }),
    };
  }
  if (tabla === "votacion") {
    // Conteo del rail: `.select("id",{count,head}).eq()` → thenable {count}.
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: null, count: 3, error: null }),
      }),
    };
  }
  // Resto de secciones (no montadas explícitamente): vacío honesto.
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  };
});
const createServerSupabaseMock = vi.fn(() => ({ from: fromMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Importar DESPUÉS de los mocks.
import ProyectoPage, { ProyectoRail, TramitacionSection } from "./page";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
  notFoundMock.mockClear();
  fromMock.mockClear();
  createServerSupabaseMock.mockClear();
});

function makeProps(boletin = "16284-07") {
  return {
    params: Promise.resolve({ boletin }),
    searchParams: Promise.resolve(
      {} as Record<string, string | string[] | undefined>,
    ),
  };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("/proyecto/[boletin] — shell rail + grid (UXCOG 55-04)", () => {
  it("monta el grid de 2 columnas (max-w-5xl) con las 6 secciones hermanas mt-12 scroll-mt-6", async () => {
    const html = renderToStaticMarkup(await ProyectoPage(makeProps()));

    expect(html).toContain("max-w-5xl");
    expect(html).toContain("md:grid-cols-[13rem_1fr]");

    for (const id of [
      "estado",
      "timeline",
      "votaciones",
      "lobby-tramitacion",
      "idea-matriz",
      "similares",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    // Frontera anti-insinuación LOCKED + ancla scrollspy en cada sección hermana.
    expect(countOccurrences(html, "scroll-mt-6")).toBeGreaterThanOrEqual(6);
    expect(html).toContain("mt-12");
    // Breadcrumb F53 preservado.
    expect(html).toContain('aria-label="Ruta de navegación"');
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe("/proyecto/[boletin] — ProyectoRail (6 entradas + caveat 1× + conteo honesto)", () => {
  it("arma las 6 entradas de nav del rail con sus anclas", async () => {
    const html = renderToStaticMarkup(await ProyectoRail({ boletin: "16284-07" }));
    for (const anchor of [
      "#estado",
      "#timeline",
      "#votaciones",
      "#lobby-tramitacion",
      "#idea-matriz",
      "#similares",
    ]) {
      expect(html).toContain(`href="${anchor}"`);
    }
  });

  it("el caveat anti-causal aparece EXACTAMENTE 1× en el rail", async () => {
    const html = renderToStaticMarkup(await ProyectoRail({ boletin: "16284-07" }));
    expect(
      countOccurrences(
        html,
        "La coincidencia temporal no implica relación.",
      ),
    ).toBe(1);
  });

  it("muestra el conteo honesto de votaciones (3) y la cabecera del proyecto", async () => {
    const html = renderToStaticMarkup(await ProyectoRail({ boletin: "16284-07" }));
    expect(html).toContain("Proyecto de prueba de ley");
    expect(html).toContain("Boletín N°16284-07");
    expect(html).toContain("3"); // conteo de votaciones
  });
});

describe("/proyecto/[boletin] — TramitacionSection (stepper capa-1 + timeline colapsado)", () => {
  it("el stepper (capa-1) muestra los hitos clave y la urgencia agrupada FUERA del disclosure", async () => {
    const html = renderToStaticMarkup(
      await TramitacionSection({ boletin: "16284-07", urgenciaExpandida: null }),
    );
    expect(html).toContain("Tramitación");
    expect(html).toContain("Informe de comisión de Hacienda");
    // Urgencia repetitiva agrupada con el copy LOCKED neutro ("ver todos" = link).
    expect(html).toContain("2 trámites de urgencia");
    expect(html).toContain(">ver todos</a>");
  });

  it("la tramitación COMPLETA vive en DetalleColapsable (default cerrado) con el TimelineView dentro", async () => {
    const html = renderToStaticMarkup(
      await TramitacionSection({ boletin: "16284-07", urgenciaExpandida: null }),
    );
    // Trigger del disclosure con el conteo total de eventos (4).
    expect(html).toContain("Ver detalle (4)");
    // TimelineView forceMount → cada hito conserva su enlace de fuente (trazabilidad).
    expect(html).toContain("Ver fuente oficial");
  });

  it("GATE §9.1: el HTML de la sección no contiene banned-vocab causal/de juicio", async () => {
    const html = renderToStaticMarkup(
      await TramitacionSection({ boletin: "16284-07", urgenciaExpandida: null }),
    );
    const PROHIBIDO =
      /porque|a cambio de|afinidad|puntaje|score|ranking|sospechos|pol[eé]mic|traici|abusiv|excesiv/i;
    expect(html).not.toMatch(PROHIBIDO);
  });
});

// ── Source-scan estructural (invariantes LOCKED que no se ven en un render) ────
describe("/proyecto/[boletin] — invariantes de fuente", () => {
  const PAGE_SRC = readFileSync(
    path.join(process.cwd(), "app", "proyecto", "[boletin]", "page.tsx"),
    "utf8",
  );

  it("el nombre en lobby×tramitación sigue en LobbyEnTramitacionSection (texto plano 52-03)", () => {
    // El componente conserva el nombre PLANO no-enlazado (LOCKED 52-03); la page no
    // re-enlaza el nombre — sólo monta la sección.
    expect(PAGE_SRC).toContain("LobbyEnTramitacionSection");
    expect(PAGE_SRC).toContain('id="lobby-tramitacion"');
  });

  it("el orden load-bearing BOLETIN_RE → searchParams se preserva", () => {
    const idxRe = PAGE_SRC.indexOf("BOLETIN_RE.test");
    const idxSp = PAGE_SRC.indexOf("sp.urgencias");
    expect(idxRe).toBeGreaterThan(0);
    expect(idxSp).toBeGreaterThan(idxRe);
  });

  it("el TramitacionStepper se monta FUERA del DetalleColapsable (capa-1 siempre visible)", () => {
    const idxStepper = PAGE_SRC.indexOf("<TramitacionStepper");
    const idxDetalle = PAGE_SRC.indexOf("<DetalleColapsable");
    const idxTimeline = PAGE_SRC.indexOf("<TimelineView");
    expect(idxStepper).toBeGreaterThan(0);
    expect(idxDetalle).toBeGreaterThan(idxStepper);
    // El TimelineView vive DESPUÉS del DetalleColapsable (dentro del disclosure).
    expect(idxTimeline).toBeGreaterThan(idxDetalle);
  });
});
