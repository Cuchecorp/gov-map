import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import type { CitacionRow } from "@/lib/agenda-types";

/**
 * UX-03 (55-05) — `/agenda` rediseño cognitivo: la vista semanal agrupa
 * día → comisión con jerarquía tipográfica clara y bloques COLAPSABLES por día,
 * conservando los cross-links a boletín.
 *
 * `CitacionesSection` es un Server Component async que lee de Supabase. Se mockea
 * con el mismo builder thenable de `citaciones-empty.test.tsx`, pero devolviendo
 * filas: dos citaciones el MISMO día en comisiones distintas (una con boletín).
 * El elemento devuelto se monta con RTL (el `CarrilAccordion` es una isla Radix
 * que corre en jsdom, como en `carril-accordion.test.tsx`).
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

import { CitacionesSection } from "./page";

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

describe("CitacionesSection — UX-03 día→comisión colapsable (55-05)", () => {
  it("agrupa día → comisión: sub-encabezado de comisión (h4) dentro del día", async () => {
    queryResult = { data: FIXTURE, error: null };
    const el = await CitacionesSection({ year: 2026, week: 28 });
    render(el);

    // El día es un encabezado h3 (cuelga de la sección h2 → jerarquía clara).
    // El nombre accesible incluye la fecha del día y el conteo del acordeón.
    const diaHeading = screen.getByRole("heading", { level: 3, name: /lunes/i });
    expect(diaHeading).toBeInTheDocument();

    // Dentro del día, cada comisión es un sub-encabezado h4 (segundo nivel).
    expect(
      screen.getByRole("heading", { level: 4, name: "Comisión de Hacienda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 4, name: "Comisión de Salud" }),
    ).toBeInTheDocument();
  });

  it("el bloque de día es colapsable (trigger) y su cuerpo está en el DOM (forceMount)", async () => {
    queryResult = { data: FIXTURE, error: null };
    const el = await CitacionesSection({ year: 2026, week: 28 });
    render(el);

    // El encabezado del día es el trigger del acordeón (botón con aria-expanded).
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-expanded");

    // forceMount: el cuerpo (las materias de las citaciones) vive en el DOM.
    expect(
      screen.getByText("Estudio del proyecto de presupuesto."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Discusión de la ley de fármacos."),
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
