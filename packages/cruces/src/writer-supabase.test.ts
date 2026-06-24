// writer-supabase.test (@obs/cruces) — TEST-04: el writer de etiquetado de sector
// (etapa-2 pura: solo UPDATE sector_id) no tenía test. Mock del SupabaseClient.

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseCrucesWriter } from "./writer-supabase";

interface Call {
  table: string;
  update: Record<string, unknown>;
  eqs: [string, unknown][];
}

/** Cliente Supabase falso que registra cada cadena from().update().eq()… y su resultado. */
function makeFakeClient(error: unknown = null) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, update: {}, eqs: [] };
      const builder = {
        update(obj: Record<string, unknown>) {
          call.update = obj;
          return builder;
        },
        eq(col: string, val: unknown) {
          call.eqs.push([col, val]);
          return builder;
        },
        // Awaitable: resuelve a { error } como PostgREST.
        then(resolve: (v: { error: unknown }) => unknown) {
          calls.push(call);
          return Promise.resolve({ error }).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("SupabaseCrucesWriter (TEST-04)", () => {
  it("actualizarSectorFicha → UPDATE proyecto_ficha.sector_id eq boletin", async () => {
    const { client, calls } = makeFakeClient();
    await new SupabaseCrucesWriter({ url: "", serviceKey: "", client }).actualizarSectorFicha(
      "12345-07",
      "salud",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: "proyecto_ficha",
      update: { sector_id: "salud" },
      eqs: [["boletin", "12345-07"]],
    });
  });

  it("actualizarSectorContraparte con rol → eq extra sobre lobby_contraparte", async () => {
    const { client, calls } = makeFakeClient();
    await new SupabaseCrucesWriter({ url: "", serviceKey: "", client }).actualizarSectorContraparte(
      "ID1",
      "Acme",
      "tecnologia",
      "gestor",
    );
    expect(calls[0]).toMatchObject({
      table: "lobby_contraparte",
      update: { sector_id: "tecnologia" },
      eqs: [
        ["identificador", "ID1"],
        ["nombre", "Acme"],
        ["rol", "gestor"],
      ],
    });
  });

  it("null escribe NULL explícito (honest no-match, D-05)", async () => {
    const { client, calls } = makeFakeClient();
    await new SupabaseCrucesWriter({ url: "", serviceKey: "", client }).actualizarSectorFicha(
      "9-9",
      null,
    );
    expect(calls[0]?.update).toEqual({ sector_id: null });
  });

  it("propaga el error de PostgREST (sin filtrar la service key)", async () => {
    const { client } = makeFakeClient({ message: "rls denied" });
    await expect(
      new SupabaseCrucesWriter({ url: "", serviceKey: "", client }).actualizarSectorFicha(
        "1-1",
        "salud",
      ),
    ).rejects.toThrow(/actualizarSectorFicha falló: rls denied/);
  });

  it("lote de fichas: de-dup por boletín (last-write-wins) → un solo UPDATE por clave", async () => {
    const { client, calls } = makeFakeClient();
    await new SupabaseCrucesWriter({ url: "", serviceKey: "", client }).actualizarSectoresFicha([
      { boletin: "1-1", sector_id: "salud" },
      { boletin: "1-1", sector_id: "educacion" },
      { boletin: "2-2", sector_id: "transporte" },
    ]);
    expect(calls).toHaveLength(2);
    const byBoletin = Object.fromEntries(
      calls.map((c) => [c.eqs[0]?.[1], c.update.sector_id]),
    );
    expect(byBoletin).toEqual({ "1-1": "educacion", "2-2": "transporte" });
  });
});
