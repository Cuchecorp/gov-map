import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks para ejercer `contarCarriles` sin runtime Supabase/Next ────────────────
// `cache()` → identidad (sin contexto de request en el test).
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});
// Gates: cruces ON (ejercemos crucesSectores), money OFF (default de PROD).
vi.mock("@/lib/cruces-gate", () => ({ crucesPublicEnabled: () => true }));
vi.mock("@/lib/money-gate", () => ({ moneyPublicEnabled: () => false }));

// Fake Supabase: `.rpc(name)` → respuesta por nombre; `.from(tabla)` → marcador ingesta.
let rpcResponses: Record<string, { data: unknown; error: unknown }> = {};
let fromResponses: Record<string, { data: unknown; error: unknown }> = {};
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({
    rpc: (name: string) =>
      Promise.resolve(rpcResponses[name] ?? { data: [], error: null }),
    from: (tabla: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(
              fromResponses[tabla] ?? {
                data: { parlamentario_id: "P1" },
                error: null,
              },
            ),
        }),
      }),
    }),
  }),
}));

import {
  derivarEstado,
  conteosDesconocidos,
  resumirVotos,
  rankearMaterias,
  agruparSectores,
  mapearPatrimonio,
  contarCarriles,
  type CarrilEstado,
} from "./parlamentario-resumen-conteos";

beforeEach(() => {
  rpcResponses = {};
  fromResponses = {};
});

/**
 * Test PURO del mapeo conteo→3-estado (sin runtime Supabase). El módulo
 * `parlamentario-resumen-conteos.ts` es `import "server-only"` y envuelve sus
 * lecturas en `React.cache()`; aquí solo se ejerce la función pura `derivarEstado`,
 * la pieza que decide el estado honesto de cada carril. La verificación dura del
 * throw #34 y del uso exclusivo de RPCs allowlisted vive en la integración +
 * `lockdown-guard.test.ts` (Block B escanea el módulo).
 */
describe("derivarEstado — mapeo puro conteo→CarrilEstado (3-estado honesto)", () => {
  it("total>0 → { tipo:'dato', n:total } (muestra el número real)", () => {
    const e: CarrilEstado = derivarEstado({ total: 9, ingestado: true });
    expect(e).toEqual({ tipo: "dato", n: 9 });
  });

  it("total>0 con n=1 sigue siendo dato (nunca colapsa a vacío)", () => {
    expect(derivarEstado({ total: 1, ingestado: true })).toEqual({
      tipo: "dato",
      n: 1,
    });
  });

  it("total===0 && ingestado → { tipo:'vacio' } (ingestado, cero → 'sin registros')", () => {
    expect(derivarEstado({ total: 0, ingestado: true })).toEqual({
      tipo: "vacio",
    });
  });

  it("total===0 && !ingestado → { tipo:'no_ingerido' } ('—', NUNCA un número)", () => {
    expect(derivarEstado({ total: 0, ingestado: false })).toEqual({
      tipo: "no_ingerido",
    });
  });

  it("NUNCA fabrica densidad: un carril vacío jamás devuelve { tipo:'dato' }", () => {
    expect(derivarEstado({ total: 0, ingestado: true }).tipo).not.toBe("dato");
    expect(derivarEstado({ total: 0, ingestado: false }).tipo).not.toBe("dato");
  });

  it("la regla de no-ingerido replica EXACTO la de las secciones (estadoData===null && total===0)", () => {
    // Espejo de lobby-de-parlamentario.tsx:328 / patrimonio-de-parlamentario.tsx:709:
    //   noIngestado = estadoData === null && total === 0
    // `ingestado` es la negación de esa ausencia: ingestado = (estadoData !== null).
    const conFilaIngesta_totalCero = derivarEstado({
      total: 0,
      ingestado: true,
    });
    const sinFilaIngesta_totalCero = derivarEstado({
      total: 0,
      ingestado: false,
    });
    // Misma cardinalidad (0), distinto estado honesto según haya o no marcador.
    expect(conFilaIngesta_totalCero).toEqual({ tipo: "vacio" });
    expect(sinFilaIngesta_totalCero).toEqual({ tipo: "no_ingerido" });
    expect(conFilaIngesta_totalCero).not.toEqual(sinFilaIngesta_totalCero);
  });

  it("total>0 con marcador ausente sigue siendo dato (el dato real manda sobre el marcador)", () => {
    expect(derivarEstado({ total: 3, ingestado: false })).toEqual({
      tipo: "dato",
      n: 3,
    });
  });
});

/**
 * WR-02 — el fallback honesto de `contarCarrilesSeguro`. Cuando un fallo de
 * conteo degrada el índice/headers, NINGÚN carril fabrica densidad (jamás un
 * número) ni afirma "sin registros": todos quedan en "—" (no_ingerido), el
 * estado más honesto para "no podemos mostrar el conteo ahora".
 */
describe("conteosDesconocidos — fallback honesto del shell (WR-02)", () => {
  it("TODOS los carriles quedan en no_ingerido ('—'), nunca dato ni vacío", () => {
    const c = conteosDesconocidos();
    const estados: CarrilEstado[] = [
      c.votos,
      c.lobby,
      c.patrimonio,
      c.cruces,
      c.dineroContratos,
      c.dineroAportes,
    ];
    for (const e of estados) {
      expect(e).toEqual({ tipo: "no_ingerido" });
      // NUNCA fabrica densidad ni afirma vacío en un fallo.
      expect(e.tipo).not.toBe("dato");
      expect(e.tipo).not.toBe("vacio");
    }
  });

  it("incluye los DOS carriles MONEY por separado (WR-01: no hay 'dinero' combinado)", () => {
    const c = conteosDesconocidos();
    expect(c).toHaveProperty("dineroContratos");
    expect(c).toHaveProperty("dineroAportes");
    expect(c).not.toHaveProperty("dinero");
  });

  it("asistencia queda en null (sin conteo confiable NO se fabrica '0 de 0', T-51-22)", () => {
    expect(conteosDesconocidos().asistencia).toBeNull();
  });

  it("incluye los productores capa-1 en su forma vacía honesta (55-02)", () => {
    const c = conteosDesconocidos();
    expect(c.votosBreakdown).toEqual({
      si: 0,
      no: 0,
      abstencion: 0,
      pareo: 0,
      ausente: 0,
    });
    expect(c.lobbyTopMaterias).toEqual([]);
    expect(c.crucesSectores).toEqual([]);
    expect(c.patrimonioPorDeclaracion).toEqual([]);
    expect(c.rangoAnios).toBeNull();
  });
});

/**
 * PRODUCTORES capa-1 (55-02) — funciones PURAS que derivan cada mini-visual de
 * las MISMAS filas que el módulo ya lee (sin RPC nueva, sin montos).
 */
describe("resumirVotos — desglose por selección (fuente única de 'Cómo votó')", () => {
  it("acumula por seleccion las MISMAS cifras que VotosView", () => {
    const rows = [
      { seleccion: "si" },
      { seleccion: "si" },
      { seleccion: "no" },
      { seleccion: "abstencion" },
      { seleccion: "pareo" },
      { seleccion: "ausente" },
      { seleccion: "ausente" },
    ];
    expect(resumirVotos(rows)).toEqual({
      si: 2,
      no: 1,
      abstencion: 1,
      pareo: 1,
      ausente: 2,
    });
  });

  it("sin filas → todo en cero (nunca fabrica)", () => {
    expect(resumirVotos([])).toEqual({
      si: 0,
      no: 0,
      abstencion: 0,
      pareo: 0,
      ausente: 0,
    });
  });

  it("una selección desconocida se ignora (no crea una categoría)", () => {
    expect(resumirVotos([{ seleccion: "otra_cosa" }, { seleccion: "si" }])).toEqual({
      si: 1,
      no: 0,
      abstencion: 0,
      pareo: 0,
      ausente: 0,
    });
  });
});

describe("rankearMaterias — ranking de asuntos de lobby (dedupe por audiencia)", () => {
  it("deduplica por identificador y rankea desc, omitiendo materia null/vacía", () => {
    const filas = [
      // Audiencia A: dos contrapartes (misma materia repetida por el left-join).
      { identificador: "A", materia: "Salud" },
      { identificador: "A", materia: "Salud" },
      // Audiencia B: misma materia → cuenta 1 audiencia más.
      { identificador: "B", materia: "Salud" },
      // Audiencia C: otra materia.
      { identificador: "C", materia: "Educación" },
      // Audiencia D: materia null → EXCLUIDA (no se fabrica categoría).
      { identificador: "D", materia: null },
      // Audiencia E: materia vacía → EXCLUIDA.
      { identificador: "E", materia: "   " },
    ];
    expect(rankearMaterias(filas)).toEqual([
      { materia: "Salud", n: 2 },
      { materia: "Educación", n: 1 },
    ]);
  });

  it("sin materias publicadas → arreglo vacío (degradación honesta)", () => {
    expect(
      rankearMaterias([
        { identificador: "A", materia: null },
        { identificador: "B", materia: "" },
      ]),
    ).toEqual([]);
  });
});

describe("agruparSectores — cruces por sector (nReuniones desc, nVotos 0 hoy)", () => {
  it("agrupa por sector sumando conteo de señales lobby; nVotos 0 con solo lobby_sector", () => {
    const filas = [
      { sector_id: "s1", sector_etiqueta: "Energía", tipo_senal: "lobby_sector", conteo: 3 },
      { sector_id: "s1", sector_etiqueta: "Energía", tipo_senal: "lobby_sector", conteo: 2 },
      { sector_id: "s2", sector_etiqueta: "Salud", tipo_senal: "lobby_sector", conteo: 4 },
    ];
    expect(agruparSectores(filas)).toEqual([
      { sector: "Salud", nReuniones: 4, nVotos: 0 },
      { sector: "Energía", nReuniones: 5, nVotos: 0 },
    ]);
  });

  it("ordena por nReuniones desc", () => {
    const filas = [
      { sector_id: "s1", sector_etiqueta: "A", tipo_senal: "lobby_sector", conteo: 1 },
      { sector_id: "s2", sector_etiqueta: "B", tipo_senal: "lobby_sector", conteo: 9 },
    ];
    expect(agruparSectores(filas).map((s) => s.sector)).toEqual(["B", "A"]);
  });

  it("una señal de voto futura suma nVotos, no nReuniones (rama reservada)", () => {
    const filas = [
      { sector_id: "s1", sector_etiqueta: "Energía", tipo_senal: "lobby_sector", conteo: 2 },
      { sector_id: "s1", sector_etiqueta: "Energía", tipo_senal: "voto_sector", conteo: 5 },
    ];
    expect(agruparSectores(filas)).toEqual([
      { sector: "Energía", nReuniones: 2, nVotos: 5 },
    ]);
  });
});

describe("mapearPatrimonio — declaraciones por año (sin montos) + rango", () => {
  it("mapea año/tipo verbatim excluyendo fecha no-ISO y calcula el rango", () => {
    const filas = [
      { fecha_presentacion: "2019-03-01", tipo: "periódica" },
      { fecha_presentacion: "2022-11-20", tipo: "rectificación" },
      { fecha_presentacion: "2026-01-05", tipo: "cese" },
      { fecha_presentacion: "no-es-fecha", tipo: "periódica" }, // EXCLUIDA
      { fecha_presentacion: "", tipo: "periódica" }, // EXCLUIDA
    ];
    const { porDeclaracion, rangoAnios } = mapearPatrimonio(filas);
    expect(porDeclaracion).toEqual([
      { anio: 2019, tipo: "periódica" },
      { anio: 2022, tipo: "rectificación" },
      { anio: 2026, tipo: "cese" },
    ]);
    expect(rangoAnios).toEqual({ min: 2019, max: 2026 });
  });

  it("sin años parseables → porDeclaracion vacío y rangoAnios null", () => {
    const { porDeclaracion, rangoAnios } = mapearPatrimonio([
      { fecha_presentacion: "basura", tipo: "periódica" },
    ]);
    expect(porDeclaracion).toEqual([]);
    expect(rangoAnios).toBeNull();
  });
});

/**
 * INTEGRACIÓN — `contarCarriles` mockeando `sb.rpc` por nombre. Verifica que los
 * cinco productores salen de las MISMAS filas ya leídas y que un error real hace
 * throw (#34), nunca degrada a vacío.
 */
describe("contarCarriles — productores capa-1 desde las filas ya leídas (sb.rpc mock)", () => {
  it("expone votosBreakdown + lobbyTopMaterias + crucesSectores + patrimonio + rango", async () => {
    rpcResponses = {
      votos_de_parlamentario: {
        data: [
          { seleccion: "si" },
          { seleccion: "si" },
          { seleccion: "no" },
          { seleccion: "ausente" },
        ],
        error: null,
      },
      lobby_de_parlamentario: {
        data: [
          { identificador: "A", materia: "Salud" },
          { identificador: "A", materia: "Salud" },
          { identificador: "B", materia: "Educación" },
        ],
        error: null,
      },
      declaraciones_de_parlamentario: {
        data: [
          { fecha_presentacion: "2020-05-01", tipo: "periódica" },
          { fecha_presentacion: "2024-05-01", tipo: "rectificación" },
        ],
        error: null,
      },
      cruces_de_parlamentario: {
        data: [
          { sector_id: "s1", sector_etiqueta: "Energía", tipo_senal: "lobby_sector", conteo: 2 },
          { sector_id: "s2", sector_etiqueta: "Salud", tipo_senal: "lobby_sector", conteo: 5 },
        ],
        error: null,
      },
    };

    const c = await contarCarriles("P1");

    expect(c.votosBreakdown).toEqual({
      si: 2,
      no: 1,
      abstencion: 0,
      pareo: 0,
      ausente: 1,
    });
    expect(c.lobbyTopMaterias).toEqual([
      { materia: "Salud", n: 1 },
      { materia: "Educación", n: 1 },
    ]);
    expect(c.crucesSectores).toEqual([
      { sector: "Salud", nReuniones: 5, nVotos: 0 },
      { sector: "Energía", nReuniones: 2, nVotos: 0 },
    ]);
    expect(c.patrimonioPorDeclaracion).toEqual([
      { anio: 2020, tipo: "periódica" },
      { anio: 2024, tipo: "rectificación" },
    ]);
    expect(c.rangoAnios).toEqual({ min: 2020, max: 2024 });
    // El breakdown coincide byte-a-byte con los conteos del chip/sección (fuente única).
    expect(
      c.votosBreakdown.si + c.votosBreakdown.no + c.votosBreakdown.ausente,
    ).toBe(4);
    expect(c.asistencia).toEqual({ presentes: 3, total: 4 });
  });

  it("un error real de RPC hace throw (#34) — nunca degrada a vacío", async () => {
    rpcResponses = {
      votos_de_parlamentario: { data: null, error: { message: "boom" } },
    };
    await expect(contarCarriles("P1")).rejects.toThrow(/votos_de_parlamentario/);
  });
});
