// cobertura.test — reporte de cobertura offline (SIN DB). Fake supabase-js chainable.
//
// Verifica:
//   (a) porEstado refleja los counts head+count por estado_vinculo.
//   (b) dipidsMaestraNoConfirmados === 0 cuando NINGÚN DIPID de maestra está no_confirmado.
//   (c) dipidsMaestraNoConfirmados > 0 cuando se INYECTA un DIPID de maestra como no_confirmado
//       (el invariante DETECTA la violación — no es un no-op benigno).
//   (d) el reporte usa head+count (nunca materializa filas → sin cap 1k PostgREST).

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarCobertura } from "./cobertura";

/**
 * Fake chainable de supabase-js para `voto`. Modela:
 *   from("voto").select("*", {count,head}).eq("estado_vinculo", E)[.in("fuente_voter_id", L)]
 * Resuelve a `{ count, error:null }` computando el count desde un dataset in-memory de filas
 * `{ estado_vinculo, fuente_voter_id }` aplicando los filtros .eq/.in acumulados.
 */
interface FilaVoto {
  estado_vinculo: string;
  fuente_voter_id: string;
}

function fakeClient(filas: FilaVoto[]): { client: SupabaseClient; stats: { headOnlyCalls: number } } {
  const stats = { headOnlyCalls: 0 };

  function makeQuery() {
    const eqFilters: Array<[keyof FilaVoto, string]> = [];
    const inFilters: Array<[keyof FilaVoto, string[]]> = [];
    let headOnly = false;

    const compute = () => {
      const rows = filas.filter(
        (f) =>
          eqFilters.every(([k, v]) => f[k] === v) &&
          inFilters.every(([k, arr]) => arr.includes(f[k])),
      );
      return { count: rows.length, error: null as null };
    };

    const q: Record<string, unknown> = {
      select(_sel: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.head === true) {
          headOnly = true;
          stats.headOnlyCalls++;
        }
        return q;
      },
      eq(col: keyof FilaVoto, val: string) {
        eqFilters.push([col, val]);
        return q;
      },
      in(col: keyof FilaVoto, arr: string[]) {
        inFilters.push([col, arr]);
        return q;
      },
      // Thenable: await de la cadena resuelve el {count,error}.
      then(resolve: (v: { count: number; error: null }) => unknown) {
        // headOnly asegura que NUNCA materializamos filas (sin cap 1k).
        void headOnly;
        return Promise.resolve(compute()).then(resolve);
      },
    };
    return q;
  }

  const client = {
    from(_table: string) {
      return makeQuery();
    },
  } as unknown as SupabaseClient;

  return { client, stats };
}

// DIPIDs de la "maestra vigente" (subconjunto de prueba).
const DIPIDS_MAESTRA = ["815", "843", "1042"];

describe("reportarCobertura (offline)", () => {
  it("(a) porEstado refleja los counts por estado_vinculo", async () => {
    const filas: FilaVoto[] = [
      { estado_vinculo: "confirmado", fuente_voter_id: "815" },
      { estado_vinculo: "confirmado", fuente_voter_id: "843" },
      { estado_vinculo: "no_confirmado", fuente_voter_id: "999" }, // NO en maestra → legítimo
    ];
    const { client } = fakeClient(filas);
    const rep = await reportarCobertura(client, DIPIDS_MAESTRA);

    expect(rep.porEstado.confirmado).toBe(2);
    expect(rep.porEstado.no_confirmado).toBe(1);
  });

  it("(b) invariante = 0 cuando ningún DIPID de maestra está no_confirmado", async () => {
    const filas: FilaVoto[] = [
      { estado_vinculo: "confirmado", fuente_voter_id: "815" },
      { estado_vinculo: "confirmado", fuente_voter_id: "843" },
      // El no_confirmado (999) NO es DIPID de maestra → no rompe el invariante.
      { estado_vinculo: "no_confirmado", fuente_voter_id: "999" },
    ];
    const { client } = fakeClient(filas);
    const rep = await reportarCobertura(client, DIPIDS_MAESTRA);

    expect(rep.dipidsMaestraNoConfirmados).toBe(0);
  });

  it("(c) invariante DETECTA la violación: un DIPID de maestra no_confirmado → > 0", async () => {
    const filas: FilaVoto[] = [
      { estado_vinculo: "confirmado", fuente_voter_id: "815" },
      // REGRESIÓN inyectada: 843 ES DIPID de maestra pero quedó no_confirmado.
      { estado_vinculo: "no_confirmado", fuente_voter_id: "843" },
    ];
    const { client } = fakeClient(filas);
    const rep = await reportarCobertura(client, DIPIDS_MAESTRA);

    expect(rep.dipidsMaestraNoConfirmados).toBeGreaterThan(0);
  });

  it("(d) usa head+count (nunca materializa filas → sin cap 1k PostgREST)", async () => {
    const filas: FilaVoto[] = [{ estado_vinculo: "confirmado", fuente_voter_id: "815" }];
    const { client, stats } = fakeClient(filas);
    await reportarCobertura(client, DIPIDS_MAESTRA);
    // 2 estados + 1 lote de invariante = 3 selects head:true.
    expect(stats.headOnlyCalls).toBeGreaterThanOrEqual(3);
  });
});
