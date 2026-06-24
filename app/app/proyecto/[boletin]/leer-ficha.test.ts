import { beforeEach, describe, expect, it, vi } from "vitest";

// Builder Supabase encadenable que termina en maybeSingle({ data, error }).
let maybeSingleResult: { data: unknown; error: unknown } = { data: null, error: null };
const maybeSingle = vi.fn(() => Promise.resolve(maybeSingleResult));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({ from }),
}));

// Importar DESPUÉS del mock.
import { leerFicha } from "./page";

describe("leerFicha (APP-02 — error honesto, no fabricar 'sin ficha')", () => {
  beforeEach(() => {
    from.mockClear();
    maybeSingle.mockClear();
  });

  it("propaga (throw) cuando la consulta a proyecto_ficha falla", async () => {
    maybeSingleResult = { data: null, error: { message: "db down" } };
    await expect(leerFicha("12345-07")).rejects.toThrow(/leerFicha\(12345-07\) falló/);
  });

  it("devuelve la fila cuando hay datos y sin error", async () => {
    const row = { boletin: "22222-02", idea_matriz: "x" };
    maybeSingleResult = { data: row, error: null };
    await expect(leerFicha("22222-02")).resolves.toEqual(row);
  });

  it("devuelve null (estado honesto real) cuando no hay fila ni error", async () => {
    maybeSingleResult = { data: null, error: null };
    await expect(leerFicha("99999-99")).resolves.toBeNull();
  });
});
