import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// buscarProyectos devuelve vecinos (boletines) para forzar la rama de hidratación.
const buscarProyectosMock = vi.fn();
vi.mock("@/lib/buscar", async () => {
  const real = await vi.importActual<typeof import("@/lib/buscar")>("@/lib/buscar");
  return { ...real, buscarProyectos: (...a: unknown[]) => buscarProyectosMock(...a) };
});

// Builder Supabase: from().select().in() → { data, error }.
let inResult: { data: unknown; error: unknown } = { data: [], error: null };
const inFn = vi.fn(() => Promise.resolve(inResult));
const selectFn = vi.fn(() => ({ in: inFn }));
const fromFn = vi.fn(() => ({ select: selectFn }));
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
    // Un vecino → entra a la rama de hidratación de proyecto.
    buscarProyectosMock.mockResolvedValue([{ boletin: "12345-07" }]);
  });

  it("error de hidratación → muestra error honesto, NO lista vacía", async () => {
    inResult = { data: null, error: { message: "db down" } };
    const html = await render("agua");
    expect(html).toContain("Ocurrió un error al realizar la búsqueda");
    expect(html).not.toContain("Resultados 1");
  });

  it("hidratación OK → no muestra el error", async () => {
    inResult = {
      data: [{ boletin: "12345-07", materia: "Test", titulo: "Proyecto X" }],
      error: null,
    };
    const html = await render("agua");
    expect(html).not.toContain("Ocurrió un error al realizar la búsqueda");
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
