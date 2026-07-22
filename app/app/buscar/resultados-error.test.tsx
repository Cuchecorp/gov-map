import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// buscarProyectos devuelve vecinos (boletines) para forzar la rama de hidratación.
const buscarProyectosMock = vi.fn();
vi.mock("@/lib/buscar", async () => {
  const real = await vi.importActual<typeof import("@/lib/buscar")>("@/lib/buscar");
  return { ...real, buscarProyectos: (...a: unknown[]) => buscarProyectosMock(...a) };
});

// Builder Supabase: from().select().in().order() → { data, error }.
// La primera llamada from("proyecto") retorna proyectos; la segunda from("tramitacion_evento")
// retorna una lista vacía (sin eventos → año null honesto).
let proyectosResult: { data: unknown; error: unknown } = { data: [], error: null };
let eventosResult: { data: unknown; error: unknown } = { data: [], error: null };
const orderFn = vi.fn(() => Promise.resolve(eventosResult));
const inFn = vi.fn(() => ({ order: orderFn, then: undefined }));
// Para el call de proyecto (from("proyecto").select().in()) retornar proyectosResult directamente
const inFnProyecto = vi.fn(() => Promise.resolve(proyectosResult));
const selectFnEventos = vi.fn(() => ({ in: inFn }));
const selectFnProyecto = vi.fn(() => ({ in: inFnProyecto }));
const fromFn = vi.fn((table: string) => ({
  select: table === "tramitacion_evento" ? selectFnEventos : selectFnProyecto,
}));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({ from: fromFn }),
}));

import { Resultados } from "./page";

async function render(q: string) {
  const el = await Resultados({ q, page: 1 });
  return renderToStaticMarkup(el);
}

describe("Resultados — hidratación honesta (APP-03a)", () => {
  beforeEach(() => {
    buscarProyectosMock.mockReset();
    fromFn.mockClear();
    inFnProyecto.mockClear();
    inFn.mockClear();
    orderFn.mockClear();
    // Estado por defecto: eventos vacíos (año null honesto).
    eventosResult = { data: [], error: null };
    // Un vecino → entra a la rama de hidratación de proyecto.
    buscarProyectosMock.mockResolvedValue([{ boletin: "12345-07" }]);
  });

  it("error de hidratación → muestra error honesto, NO lista vacía", async () => {
    proyectosResult = { data: null, error: { message: "db down" } };
    const html = await render("agua");
    expect(html).toContain("Ocurrió un error al realizar la búsqueda");
    expect(html).not.toContain("Resultados 1");
    proyectosResult = { data: [], error: null }; // reset
  });

  it("hidratación OK → no muestra el error", async () => {
    proyectosResult = {
      data: [{ boletin: "12345-07", materia: "Test", titulo: "Proyecto X", estado: "En tramitación", camara_origen: "C.Diputados", iniciativa: "Moción", fecha_captura: null, origen: null, enlace: null, etapa: null }],
      error: null,
    };
    const html = await render("agua");
    expect(html).not.toContain("Ocurrió un error al realizar la búsqueda");
    proyectosResult = { data: [], error: null }; // reset
  });

  // ── F-03 (53-04): línea de continuación en el empty-state "sin resultados" ──────
  it("F-03: sin resultados → shipped honesto byte-idéntico + UNA línea de continuación a /agenda", async () => {
    buscarProyectosMock.mockResolvedValue([]); // cero vecinos → rama "Sin resultados".
    const html = await render("xyzzy sin coincidencias");
    // (a) el copy honesto shipped sigue presente byte-idéntico.
    expect(html).toContain("Sin resultados");
    expect(html).toContain("Prueba con otras");
    expect(html).toContain("o ingresa un número de boletín.");
    // (b) exactamente UN link de continuación con el href y texto prescritos.
    expect(html).toContain('href="/agenda"');
    expect(html).toContain("la agenda legislativa de la semana");
    expect((html.match(/href="/g) ?? []).length).toBe(1);
    // No fabrica virtud.
    expect(html).not.toMatch(/limpio|transparente|nada que ocultar/i);
  });
});
