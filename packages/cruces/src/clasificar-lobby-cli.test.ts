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

  // ── WR-05/WR-06: cursor --desde (valor = id PK surrogate de lobby_contraparte) ─
  it("--desde ID → desde === ID", () => {
    expect(parseArgs(["--desde", "1042"]).desde).toBe("1042");
  });

  it("--desde sin valor o tragándose otro flag lanza CrucesCliArgsError (fail-fast)", () => {
    expect(() => parseArgs(["--desde"])).toThrow(CrucesCliArgsError);
    expect(() => parseArgs(["--desde", "--dry-run"])).toThrow(CrucesCliArgsError);
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
  gt: [string, unknown][];
  order: [string, unknown][];
  limit?: number;
}

function makeFakeClient(data: unknown[] = [], error: unknown = null) {
  const spy: QuerySpy = {
    table: "",
    select: "",
    is: [],
    eq: [],
    not: [],
    gt: [],
    order: [],
    limit: undefined,
  };
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
        gt(col: string, val: unknown) {
          spy.gt.push([col, val]);
          return builder;
        },
        order(col: string, opts: unknown) {
          spy.order.push([col, opts]);
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
    // WR-06: la carga trae el `id` PK surrogate — la ÚNICA clave total-order (el
    // identificador es el FK de la audiencia, compartido por contrapartes hermanas).
    expect(spy.select).toMatch(/^id,/);
    // (a) sector_id is null → incremental para lo clasificado (excluye lo ya etiquetado)
    expect(spy.is).toContainEqual(["sector_id", null]);
    // (b) audiencia confirmada + con parlamentario enlazado
    expect(spy.eq).toContainEqual(["lobby_audiencia.estado_vinculo", "confirmado"]);
    expect(spy.not).toContainEqual(["lobby_audiencia.parlamentario_id", "is", null]);
    expect(spy.limit).toBe(25);
    // WR-05/WR-06: orden DETERMINISTA por `id` PK (con order-by identificador, filas
    // que lo comparten quedaban en orden relativo arbitrario → página inestable).
    // Sin --desde, sin .gt.
    expect(spy.order).toContainEqual(["id", { ascending: true }]);
    expect(spy.gt).toHaveLength(0);
  });

  it("WR-06: con opts.desde agrega gt(id, desde) — cursor sobre la PK única, NUNCA el identificador", async () => {
    // Cursor por identificador (FK de audiencia): un corte de página DENTRO de una
    // audiencia multi-contraparte dejaba a las hermanas sin clasificar inalcanzables
    // para siempre (gt estricto sobre una clave compartida). El cursor va por `id`.
    const { client, spy } = makeFakeClient([]);
    await cargarContrapartes(
      client,
      { soloConfirmadas: true, desde: "1042" },
      25,
      noLog,
    );
    expect(spy.gt).toContainEqual(["id", "1042"]);
    expect(spy.gt).not.toContainEqual(["identificador", "1042"]);
    expect(spy.order).toContainEqual(["id", { ascending: true }]);
  });

  it("mapea las filas preservando id/identificador/nombre/rol (rol omitido si null)", async () => {
    const { client } = makeFakeClient([
      {
        id: 7,
        identificador: "ID1",
        nombre: "Acme",
        rol: "gestor",
        lobby_audiencia: [{ estado_vinculo: "confirmado", parlamentario_id: "P1" }],
      },
      {
        id: 9,
        identificador: "ID2",
        nombre: "Beta",
        rol: null,
        lobby_audiencia: [{ estado_vinculo: "confirmado", parlamentario_id: "P2" }],
      },
    ]);
    const out = await cargarContrapartes(client, { soloConfirmadas: true }, 50, noLog);
    expect(out).toEqual([
      { id: 7, identificador: "ID1", nombre: "Acme", rol: "gestor" },
      { id: 9, identificador: "ID2", nombre: "Beta" },
    ]);
  });

  it("WR-06: dos contrapartes HERMANAS (mismo identificador, ids distintos) conservan cada una su id — cursor reanudable dentro de la audiencia", async () => {
    // Escenario del bug: la página corta DENTRO de una audiencia multi-contraparte.
    // Con el cursor por id, la corrida siguiente (--desde <id de la primera>) alcanza
    // a la hermana; con el cursor por identificador quedaba varada para siempre.
    const { client } = makeFakeClient([
      {
        id: 100,
        identificador: "AUD-X",
        nombre: "Lobbista Uno",
        rol: "lobbista",
        lobby_audiencia: [{ estado_vinculo: "confirmado", parlamentario_id: "P1" }],
      },
      {
        id: 101,
        identificador: "AUD-X",
        nombre: "Lobbista Dos",
        rol: "gestor",
        lobby_audiencia: [{ estado_vinculo: "confirmado", parlamentario_id: "P1" }],
      },
    ]);
    const out = await cargarContrapartes(client, { soloConfirmadas: true }, 2, noLog);
    expect(out).toEqual([
      { id: 100, identificador: "AUD-X", nombre: "Lobbista Uno", rol: "lobbista" },
      { id: 101, identificador: "AUD-X", nombre: "Lobbista Dos", rol: "gestor" },
    ]);
    // Los ids son distintos aunque el identificador se comparta: hay cursor válido.
    expect(out[0]!.id).not.toBe(out[1]!.id);
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
