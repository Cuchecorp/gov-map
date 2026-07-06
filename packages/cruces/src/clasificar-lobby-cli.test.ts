// clasificar-lobby-cli.test (@obs/cruces) — SC1 (52-01): el CLI de lobby gana un modo
// --solo-confirmadas para cargar SOLO contrapartes en audiencias confirmadas y sin sector_id
// (alto-ROI, incremental). Dos frentes:
//   Task 1 — parseArgs reconoce --solo-confirmadas (booleano) sin romper el fail-fast.
//   Task 2 — cargarContrapartes ramifica a la carga filtrada (embed !inner + is null) bajo el flag,
//            preservando el escape hatch de filas inyectadas y la carga plana como fallback.

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseArgs,
  cargarContrapartes,
  CrucesCliArgsError,
  type LobbyCliOptions,
} from "./clasificar-lobby-cli";

// ── Task 1: parser ────────────────────────────────────────────────────────────
describe("parseArgs --solo-confirmadas (Task 1)", () => {
  it("--solo-confirmadas → soloConfirmadas === true", () => {
    expect(parseArgs(["--solo-confirmadas"]).soloConfirmadas).toBe(true);
  });

  it("sin flag → soloConfirmadas ausente (default off)", () => {
    expect(parseArgs([]).soloConfirmadas).toBeUndefined();
  });

  it("--solo-confirmadas junto a --limite conserva ambos", () => {
    expect(parseArgs(["--solo-confirmadas", "--limite", "50"])).toMatchObject({
      soloConfirmadas: true,
      limite: 50,
    });
  });

  it("un flag desconocido sigue lanzando CrucesCliArgsError (fail-fast intacto)", () => {
    expect(() => parseArgs(["--no-existe"])).toThrow(CrucesCliArgsError);
  });
});

// ── Task 2: carga filtrada ──────────────────────────────────────────────────────
/** Registra cada método encadenado del builder de PostgREST + resuelve a { data, error }. */
interface QuerySpy {
  table: string;
  select: string;
  is: [string, unknown][];
  eq: [string, unknown][];
  not: [string, string, unknown][];
  limit?: number;
}

function makeFakeClient(data: unknown[] = [], error: unknown = null) {
  const spy: QuerySpy = { table: "", select: "", is: [], eq: [], not: [], limit: undefined };
  const client = {
    from(table: string) {
      spy.table = table;
      const builder = {
        select(cols: string) {
          spy.select = cols;
          return builder;
        },
        is(col: string, val: unknown) {
          spy.is.push([col, val]);
          return builder;
        },
        eq(col: string, val: unknown) {
          spy.eq.push([col, val]);
          return builder;
        },
        not(col: string, op: string, val: unknown) {
          spy.not.push([col, op, val]);
          return builder;
        },
        limit(n: number) {
          spy.limit = n;
          return builder;
        },
        then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
          return Promise.resolve({ data, error }).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, spy };
}

const noLog = () => {};

describe("cargarContrapartes — escape hatch (Task 2)", () => {
  it("con opts.filas inyectadas las devuelve verbatim sin tocar el client", async () => {
    const filas = [{ identificador: "ID1", nombre: "Acme", rol: "gestor" }];
    const opts: LobbyCliOptions = { filas, soloConfirmadas: true };
    // client null: si tocara el client, explotaría — el escape hatch precede a toda query.
    const out = await cargarContrapartes(null, opts, 50, noLog);
    expect(out).toEqual(filas);
  });
});

describe("cargarContrapartes — modo --solo-confirmadas (Task 2)", () => {
  it("construye la query filtrada: is sector_id null + embed !inner confirmada + parlamentario_id no-null", async () => {
    const { client, spy } = makeFakeClient([]);
    await cargarContrapartes(client, { soloConfirmadas: true }, 25, noLog);

    expect(spy.table).toBe("lobby_contraparte");
    // embed !inner a lobby_audiencia (join que restringe a contrapartes con audiencia)
    expect(spy.select).toMatch(/lobby_audiencia!inner/);
    // (a) sector_id is null → naturalmente incremental (excluye lo ya clasificado)
    expect(spy.is).toContainEqual(["sector_id", null]);
    // (b) audiencia confirmada + con parlamentario enlazado
    expect(spy.eq).toContainEqual(["lobby_audiencia.estado_vinculo", "confirmado"]);
    expect(spy.not).toContainEqual(["lobby_audiencia.parlamentario_id", "is", null]);
    expect(spy.limit).toBe(25);
  });

  it("mapea las filas preservando identificador/nombre/rol (rol omitido si null)", async () => {
    const { client } = makeFakeClient([
      {
        identificador: "ID1",
        nombre: "Acme",
        rol: "gestor",
        lobby_audiencia: [{ estado_vinculo: "confirmado", parlamentario_id: "P1" }],
      },
      {
        identificador: "ID2",
        nombre: "Beta",
        rol: null,
        lobby_audiencia: [{ estado_vinculo: "confirmado", parlamentario_id: "P2" }],
      },
    ]);
    const out = await cargarContrapartes(client, { soloConfirmadas: true }, 50, noLog);
    expect(out).toEqual([
      { identificador: "ID1", nombre: "Acme", rol: "gestor" },
      { identificador: "ID2", nombre: "Beta" },
    ]);
  });
});

describe("cargarContrapartes — carga plana sin flag (no regresión, Task 2)", () => {
  it("sin soloConfirmadas conserva select plano + limit, sin is/eq/not", async () => {
    const { client, spy } = makeFakeClient([
      { identificador: "ID9", nombre: "Gamma", rol: null },
    ]);
    const out = await cargarContrapartes(client, {}, 10, noLog);

    expect(spy.table).toBe("lobby_contraparte");
    expect(spy.select).toBe("identificador, nombre, rol");
    expect(spy.is).toHaveLength(0);
    expect(spy.eq).toHaveLength(0);
    expect(spy.not).toHaveLength(0);
    expect(spy.limit).toBe(10);
    expect(out).toEqual([{ identificador: "ID9", nombre: "Gamma" }]);
  });
});
