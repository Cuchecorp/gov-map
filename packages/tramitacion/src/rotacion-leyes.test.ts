import { describe, it, expect, vi } from "vitest";
import {
  leerCorpusPaginado,
  seleccionarRotado,
  avanzarOffset,
} from "./rotacion-leyes";

/**
 * Cliente Supabase FAKE que implementa el sub-conjunto `.from().select().order().range()`
 * usado por `leerCorpusPaginado`. Devuelve páginas parametrizables para simular >1000 filas
 * (el cap real de PostgREST) y registra la secuencia de llamadas (order antes de range).
 */
function fakeCliente(opts: {
  filas: string[];
  /** Si se define, se devuelve como `error` en vez de datos (para probar fail-loud). */
  error?: { message: string };
}) {
  const registro = {
    ordenPedido: [] as Array<{ columna: string; ascending: boolean }>,
    rangosPedidos: [] as Array<{ from: number; to: number }>,
    tablas: [] as string[],
  };
  const client = {
    from(tabla: string) {
      registro.tablas.push(tabla);
      return {
        select(_cols: string) {
          return {
            order(columna: string, o: { ascending: boolean }) {
              registro.ordenPedido.push({ columna, ascending: o.ascending });
              return {
                range(from: number, to: number) {
                  registro.rangosPedidos.push({ from, to });
                  if (opts.error) {
                    return Promise.resolve({ data: null, error: opts.error });
                  }
                  const slice = opts.filas
                    .slice(from, to + 1)
                    .map((boletin) => ({ boletin }));
                  return Promise.resolve({ data: slice, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, registro };
}

describe("leerCorpusPaginado", () => {
  it("devuelve las 2500 filas en 3 páginas (1000/1000/500) — cap 1k resuelto", async () => {
    const filas = Array.from({ length: 2500 }, (_, i) =>
      `${String(1000 + i).padStart(5, "0")}-01`,
    );
    const { client } = fakeCliente({ filas });
    const out = await leerCorpusPaginado(client as never, "proyecto");
    expect(out).toHaveLength(2500);
    expect(out[0]).toBe(filas[0]);
    expect(out[2499]).toBe(filas[2499]);
  });

  it("pide .order('boletin', ascending) ANTES de .range() en cada página", async () => {
    const filas = Array.from({ length: 1500 }, (_, i) =>
      `${String(2000 + i).padStart(5, "0")}-02`,
    );
    const { client, registro } = fakeCliente({ filas });
    await leerCorpusPaginado(client as never, "proyecto");
    // 1500 filas → 2 páginas (1000 + 500)
    expect(registro.rangosPedidos).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(registro.ordenPedido).toEqual([
      { columna: "boletin", ascending: true },
      { columna: "boletin", ascending: true },
    ]);
  });

  it("una página EXACTA de PAGE hace una lectura extra vacía y termina", async () => {
    const filas = Array.from({ length: 1000 }, (_, i) =>
      `${String(3000 + i).padStart(5, "0")}-03`,
    );
    const { client, registro } = fakeCliente({ filas });
    const out = await leerCorpusPaginado(client as never, "proyecto");
    expect(out).toHaveLength(1000);
    // 1000 (=PAGE) → NO corta, pide la siguiente (vacía) → corta
    expect(registro.rangosPedidos).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });

  it("LANZA (fail-loud) ante un error de lectura, con solo error.message", async () => {
    const { client } = fakeCliente({ filas: [], error: { message: "RLS denied" } });
    await expect(leerCorpusPaginado(client as never, "proyecto")).rejects.toThrow(
      /RLS denied/,
    );
  });
});

describe("seleccionarRotado", () => {
  const corpus = Array.from({ length: 10 }, (_, i) => `${1000 + i}-01`);
  // ["1000-01" .. "1009-01"]

  it("agenda primero, luego la ventana desde offset 0", () => {
    const agenda = ["1000-01", "1001-01"]; // ambos también están en el corpus
    const { seleccion } = seleccionarRotado({ agenda, corpus, offset: 0, limite: 5 });
    // agenda (2) + 3 de la cola (corpus SIN agenda), empezando en offset 0
    expect(seleccion).toEqual(["1000-01", "1001-01", "1002-01", "1003-01", "1004-01"]);
  });

  it("la ventana rotada EXCLUYE los boletines ya cubiertos por agenda (sin doble presupuesto)", () => {
    const agenda = ["1005-01"];
    const { seleccion } = seleccionarRotado({ agenda, corpus, offset: 0, limite: 4 });
    // cola = corpus sin 1005-01. 1 de agenda + 3 de cola desde offset 0.
    expect(seleccion).toEqual(["1005-01", "1000-01", "1001-01", "1002-01"]);
    // 1005-01 aparece UNA sola vez (vino por agenda, no se repite en la cola)
    expect(seleccion.filter((b) => b === "1005-01")).toHaveLength(1);
  });

  it("wrap-around: offset cerca del final incluye boletines del INICIO (round-robin circular)", () => {
    const agenda: string[] = [];
    // cola = corpus completo (10). offset=8, limite=4 → toma 8,9,0,1 (wrap)
    const { seleccion } = seleccionarRotado({ agenda, corpus, offset: 8, limite: 4 });
    expect(seleccion).toEqual(["1008-01", "1009-01", "1000-01", "1001-01"]);
  });

  it("nuevoOffset avanza por los tomados de la cola y envuelve (mod)", () => {
    const agenda: string[] = [];
    const { nuevoOffset } = seleccionarRotado({ agenda, corpus, offset: 8, limite: 4 });
    // tomó 4 desde offset 8 sobre cola de 10 → (8+4) mod 10 = 2
    expect(nuevoOffset).toBe(2);
  });

  it("respeta BOLETIN_RE: descarta agenda mal formada", () => {
    const agenda = ["basura", "1000-01"];
    const { seleccion } = seleccionarRotado({ agenda, corpus, offset: 0, limite: 3 });
    expect(seleccion).not.toContain("basura");
    expect(seleccion[0]).toBe("1000-01");
  });

  it("cola vacía (todo el corpus está en agenda) no divide por cero y no lanza", () => {
    const agenda = [...corpus];
    const { seleccion, nuevoOffset } = seleccionarRotado({
      agenda,
      corpus,
      offset: 3,
      limite: 20,
    });
    expect(seleccion).toEqual(corpus);
    expect(nuevoOffset).toBe(0);
  });
});

describe("avanzarOffset", () => {
  it("nuevo offset = (offset + n) mod tamañoCola", () => {
    expect(avanzarOffset(8, 4, 10)).toBe(2);
    expect(avanzarOffset(0, 3, 10)).toBe(3);
  });

  it("nunca devuelve un valor >= tamaño de la cola", () => {
    for (let off = 0; off < 10; off++) {
      for (let n = 0; n < 15; n++) {
        expect(avanzarOffset(off, n, 10)).toBeLessThan(10);
      }
    }
  });

  it("cola de tamaño 0 devuelve 0 (sin división por cero)", () => {
    expect(avanzarOffset(5, 3, 0)).toBe(0);
  });
});

describe("cobertura round-robin sobre N corridas", () => {
  it("recorre TODA la cola en ceil(cola/porRonda) corridas sucesivas", () => {
    const corpus = Array.from({ length: 25 }, (_, i) => `${2000 + i}-01`);
    const agenda: string[] = [];
    const limite = 5; // 5 por corrida, cola de 25 → 5 corridas cubren todo
    const cubiertos = new Set<string>();
    let offset = 0;
    for (let corrida = 0; corrida < 5; corrida++) {
      const { seleccion, nuevoOffset } = seleccionarRotado({
        agenda,
        corpus,
        offset,
        limite,
      });
      for (const b of seleccion) cubiertos.add(b);
      offset = nuevoOffset;
    }
    expect(cubiertos.size).toBe(25);
    for (const b of corpus) expect(cubiertos.has(b)).toBe(true);
  });
});

// MONEY/SERVEL excluidos por construcción: este módulo NO lee tablas de dinero/padrón.
// Grep de referencias de TABLA reales (`.from("<tabla>")`), no de la prosa de comentarios
// (que sí menciona "MONEY/SERVEL" para documentar la exclusión).
it("el módulo no referencia tablas MONEY/SERVEL como código (excluidas por construcción)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./rotacion-leyes.ts", import.meta.url), "utf8");
  for (const t of ["contrato", "aporte", "servel", "chilecompra"]) {
    // `.from("contrato")` / `from('aporte')` — cualquier lectura de tabla MONEY/SERVEL.
    const patronTabla = new RegExp(`from\\(['"\`]${t}`, "i");
    expect(patronTabla.test(src)).toBe(false);
  }
});

// Silencia el ruido de vi si algún helper lo usa en el futuro.
vi.restoreAllMocks();
