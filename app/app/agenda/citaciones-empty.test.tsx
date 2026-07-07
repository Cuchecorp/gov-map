import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * F-03 (53-04) — empty-state de `/agenda` (sin citaciones en la semana).
 *
 * `CitacionesSection` es un Server Component async que lee de Supabase. Se testea
 * con el mismo patrón que `Resultados` en /buscar: builder thenable que resuelve
 * `{ data, error }`, y `renderToStaticMarkup` del elemento devuelto. Con `data: []`
 * cae en la rama honesta "No hay citaciones…", que ahora lleva la línea de
 * continuación a /buscar.
 */

let queryResult: { data: unknown; error: unknown } = { data: [], error: null };
// Builder thenable: from/select/eq/order encadenan; `await` resuelve queryResult.
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

describe("CitacionesSection — F-03 empty state (53-04)", () => {
  it("sin citaciones → shipped honesto byte-idéntico + UNA línea de continuación a /buscar", async () => {
    queryResult = { data: [], error: null };
    const el = await CitacionesSection({ year: 2026, week: 27 });
    const html = renderToStaticMarkup(el);
    // (a) el copy honesto shipped sigue presente byte-idéntico.
    expect(html).toContain(
      "No hay citaciones de comisiones registradas para esta semana.",
    );
    // (b) exactamente UN link de continuación con el href y texto prescritos.
    expect(html).toContain('href="/buscar"');
    expect(html).toContain("buscar un proyecto de ley por su idea");
    expect((html.match(/href="/g) ?? []).length).toBe(1);
    // No fabrica virtud.
    expect(html).not.toMatch(/limpio|transparente|nada que ocultar/i);
  });
});
