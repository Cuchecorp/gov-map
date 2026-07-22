import { describe, it, expect, afterEach, vi, beforeAll } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, cleanup, within } from "@testing-library/react";

import type { CitacionRow } from "@/lib/agenda-types";

/**
 * UX-03 (55-05) + CIT-04 (94-02) — `/agenda` vista semanal: el island
 * `AgendaFiltros` es el ÚNICO renderer del listado por día post-hidratación
 * (DECISIÓN del orquestador 94-02). El Server Component `CitacionesSection` arma el
 * SLICE PLANO (dayKey/dayLabel tz Chile ya calculados) y monta el island, que
 * reagrupa por día y renderiza la MISMA `CitacionCard` (cero divergencia SSR/
 * hidratada), conservando los cross-links a boletín y los bloques colapsables por día.
 *
 * `CitacionesSection` es un Server Component async que lee de Supabase. Se mockea
 * con el mismo builder thenable de `citaciones-empty.test.tsx`, pero devolviendo
 * filas: dos citaciones el MISMO día en comisiones distintas (una con boletín).
 * El elemento devuelto se monta con RTL (el `CarrilAccordion` dentro del island es
 * una isla Radix que corre en jsdom, como en `carril-accordion.test.tsx`).
 */

let queryResult: { data: unknown; error: unknown } = { data: [], error: null };
const builder = {
  from: () => builder,
  select: () => builder,
  eq: () => builder,
  order: () => builder,
  then: (resolve: (v: typeof queryResult) => void) => resolve(queryResult),
};
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => builder,
}));
vi.mock("next/navigation", () => ({
  redirect: () => { throw new Error("redirect"); },
}));

import { CitacionesSection } from "./page";
import AgendaPage from "./page";

afterEach(cleanup);

const DIA = "2026-07-06"; // lunes

const FIXTURE: CitacionRow[] = [
  {
    id: "c1",
    camara: "camara",
    comision: "Comisión de Hacienda",
    fecha: `${DIA}T14:00:00Z`,
    horario: "14:00",
    sala: "Sala 1",
    materia: "Estudio del proyecto de presupuesto.",
    estado: null,
    semana_iso: "2026-W28",
    origen: "camara",
    fecha_captura: `${DIA}T09:00:00Z`,
    enlace: "https://www.camara.cl/citacion/1",
    citacion_invitado: [],
    citacion_punto: [
      {
        citacion_id: "c1",
        posicion: 1,
        boletin: "12345-07",
        id_proyecto: null,
        materia: null,
        tipo_tramite: null,
      },
    ],
  },
  {
    id: "c2",
    camara: "senado",
    comision: "Comisión de Salud",
    fecha: `${DIA}T16:00:00Z`,
    horario: "16:00",
    sala: null,
    materia: "Discusión de la ley de fármacos.",
    estado: null,
    semana_iso: "2026-W28",
    origen: "senado",
    fecha_captura: `${DIA}T09:00:00Z`,
    enlace: "https://www.senado.cl/citacion/2",
    citacion_invitado: [],
    citacion_punto: [],
  },
];

describe("CitacionesSection — UX-03 día colapsable + island (55-05 / 94-02)", () => {
  it("el island reagrupa por día: día = h3 (trigger); cada citación = CitacionCard con su comisión", async () => {
    queryResult = { data: FIXTURE, error: null };
    const el = await CitacionesSection({ year: 2026, week: 28 });
    render(el);

    // El día es un encabezado h3 (cuelga de la sección h2 → jerarquía clara).
    // El nombre accesible incluye la fecha del día y el conteo del acordeón.
    const diaHeading = screen.getByRole("heading", { level: 3, name: /lunes/i });
    expect(diaHeading).toBeInTheDocument();

    // El island renderiza la MISMA CitacionCard que el SSR: la comisión es el
    // heading de la card (h3 dentro de la card). Ambas comisiones visibles.
    expect(
      screen.getByRole("heading", { name: "Comisión de Hacienda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Comisión de Salud" }),
    ).toBeInTheDocument();
  });

  it("el bloque de día es colapsable (trigger) y su cuerpo está en el DOM (forceMount)", async () => {
    queryResult = { data: FIXTURE, error: null };
    const el = await CitacionesSection({ year: 2026, week: 28 });
    render(el);

    // El día es el trigger del acordeón: hay un botón con aria-expanded (además de
    // los chips de filtro del island). Se localiza por su rol + nombre de día.
    const trigger = screen.getByRole("button", { name: /lunes/i });
    expect(trigger).toHaveAttribute("aria-expanded");

    // forceMount: el cuerpo (las materias de las citaciones) vive en el DOM.
    expect(
      screen.getByText("Estudio del proyecto de presupuesto."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Discusión de la ley de fármacos."),
    ).toBeInTheDocument();
  });

  it("monta el island de filtros con la leyenda de counts honestos (CIT-04)", async () => {
    queryResult = { data: FIXTURE, error: null };
    const el = await CitacionesSection({ year: 2026, week: 28 });
    render(el);

    expect(
      screen.getByText(
        "Conteos sobre estas 2 citaciones cargadas de esta semana, no sobre toda la agenda.",
      ),
    ).toBeInTheDocument();
  });

  it("conserva el cross-link a la ficha del boletín", async () => {
    queryResult = { data: FIXTURE, error: null };
    const el = await CitacionesSection({ year: 2026, week: 28 });
    const { container } = render(el);

    const link = within(container).getByRole("link", {
      name: /Ver proyecto Boletín N°12345-07/,
    });
    expect(link).toHaveAttribute("href", "/proyecto/12345-07");
  });
});

describe("AgendaPage — container BENTO-04 (79-01)", () => {
  beforeAll(() => {
    queryResult = { data: [], error: null };
  });

  it("el <main> usa max-w-[1120px] (no max-w-3xl)", async () => {
    const el = await AgendaPage({ searchParams: Promise.resolve({}) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(el as any);
    expect(html).toContain("max-w-[1120px]");
    expect(html).not.toContain("max-w-3xl");
  });
});
