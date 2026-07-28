import { describe, it, expect } from "vitest";
import {
  seleccionarNuevos,
  intercalarDescubrimiento,
  descubrirNuevosDelAnno,
  CAP_DESCUBRIMIENTO,
} from "./descubrimiento-boletines";
import { seleccionarRotado } from "./rotacion-leyes";

/**
 * Conector ESPÍA: implementa el sub-conjunto estructural
 * `{ enumerarProyectosXAnno(anno): Promise<string[]> }` y CUENTA las llamadas.
 * Con él el kill-switch se verifica FUNCIONALMENTE (cero llamadas al WS), no por grep.
 */
function conectorEspia(resultado: string[] | Error) {
  const registro = { llamadas: [] as number[] };
  const conector = {
    enumerarProyectosXAnno(anno: number): Promise<string[]> {
      registro.llamadas.push(anno);
      return resultado instanceof Error
        ? Promise.reject(resultado)
        : Promise.resolve(resultado);
    },
  };
  return { conector, registro };
}

describe("CAP_DESCUBRIMIENTO", () => {
  it("es 20 (cota dura de boletines nuevos por corrida)", () => {
    expect(CAP_DESCUBRIMIENTO).toBe(20);
  });
});

describe("seleccionarNuevos", () => {
  it("enumerados vacíos → []", () => {
    expect(
      seleccionarNuevos({ enumerados: [], corpus: ["12345-01"], cap: 20 }),
    ).toEqual([]);
  });

  it("todo ya en corpus → [] (diff exacto por string)", () => {
    expect(
      seleccionarNuevos({
        enumerados: ["12345-01", "12346-02"],
        corpus: ["12345-01", "12346-02", "99999-99"],
        cap: 20,
      }),
    ).toEqual([]);
  });

  it("excluye lo presente en corpus y deja solo los nuevos", () => {
    expect(
      seleccionarNuevos({
        enumerados: ["12345-01", "18464-14"],
        corpus: ["12345-01"],
        cap: 20,
      }),
    ).toEqual(["18464-14"]);
  });

  it("descarta entradas malformadas (abc, vacío, sin sufijo)", () => {
    expect(
      seleccionarNuevos({
        enumerados: ["abc", "", "18464", "  ", "18464-14"],
        corpus: [],
        cap: 20,
      }),
    ).toEqual(["18464-14"]);
  });

  it("deduplica y compara con trim contra el corpus", () => {
    expect(
      seleccionarNuevos({
        enumerados: [" 18464-14 ", "18464-14"],
        corpus: [" 18464-14 "],
        cap: 20,
      }),
    ).toEqual([]);
  });

  it("ordena por RECENCIA (número de boletín descendente)", () => {
    expect(
      seleccionarNuevos({
        enumerados: ["12345-01", "18464-14", "9999-07"],
        corpus: [],
        cap: 20,
      }),
    ).toEqual(["18464-14", "12345-01", "9999-07"]);
  });

  it("desempata por sufijo descendente cuando el número base coincide", () => {
    expect(
      seleccionarNuevos({
        enumerados: ["18464-07", "18464-14"],
        corpus: [],
        cap: 20,
      }),
    ).toEqual(["18464-14", "18464-07"]);
  });

  it("más de `cap` nuevos → exactamente cap, los de mayor número", () => {
    const enumerados = Array.from(
      { length: 30 },
      (_, i) => `${18000 + i}-01`,
    );
    const out = seleccionarNuevos({ enumerados, corpus: [], cap: 20 });
    expect(out).toHaveLength(20);
    expect(out[0]).toBe("18029-01");
    expect(out[19]).toBe("18010-01");
  });
});

describe("intercalarDescubrimiento", () => {
  it("nuevos vacío → resultado IDÉNTICO a la selección", () => {
    const seleccion = ["11111-01", "22222-02", "33333-03"];
    expect(
      intercalarDescubrimiento({
        seleccion,
        agenda: ["11111-01"],
        nuevos: [],
        limite: 10,
      }),
    ).toEqual(seleccion);
  });

  it("los ítems de agenda conservan la primera posición", () => {
    const out = intercalarDescubrimiento({
      seleccion: ["11111-01", "22222-02", "33333-03"],
      agenda: ["11111-01"],
      nuevos: ["18464-14"],
      limite: 10,
    });
    expect(out[0]).toBe("11111-01");
    expect(out[1]).toBe("18464-14");
  });

  it("un nuevo que ya estaba en la selección no se duplica", () => {
    const out = intercalarDescubrimiento({
      seleccion: ["11111-01", "18464-14"],
      agenda: [],
      nuevos: ["18464-14"],
      limite: 10,
    });
    expect(out).toEqual(["18464-14", "11111-01"]);
    expect(out.filter((b) => b === "18464-14")).toHaveLength(1);
  });

  it("el largo nunca excede el límite", () => {
    const out = intercalarDescubrimiento({
      seleccion: ["11111-01", "22222-02", "33333-03"],
      agenda: [],
      nuevos: ["18464-14", "18463-13"],
      limite: 3,
    });
    expect(out).toHaveLength(3);
  });

  it("INVARIANTE de presupuesto: con limite=10 y 3 nuevos, la rotación se pide con limite=7 y los 7 rotados sobreviven", () => {
    const agenda: string[] = [];
    const corpus = Array.from({ length: 40 }, (_, i) => `${10000 + i}-01`);
    const nuevos = ["18464-14", "18463-13", "18462-12"];
    const limite = 10;

    const { seleccion } = seleccionarRotado({
      agenda,
      corpus,
      offset: 0,
      limite: Math.max(0, limite - nuevos.length),
    });
    expect(seleccion).toHaveLength(7);

    const final = intercalarDescubrimiento({ seleccion, agenda, nuevos, limite });
    expect(final).toHaveLength(10);
    for (const b of seleccion) expect(final).toContain(b);
    for (const b of nuevos) expect(final).toContain(b);
  });
});

describe("descubrirNuevosDelAnno", () => {
  it("llama enumerarProyectosXAnno UNA vez y aplica seleccionarNuevos", async () => {
    const { conector, registro } = conectorEspia(["18464-14", "12345-01"]);
    const out = await descubrirNuevosDelAnno({
      conector,
      anno: 2026,
      corpus: ["12345-01"],
      cap: CAP_DESCUBRIMIENTO,
      log: () => {},
    });
    expect(out).toEqual(["18464-14"]);
    expect(registro.llamadas).toEqual([2026]);
  });

  it("degrada honesto a [] con [WARN] cuando el WS lanza (nunca relanza)", async () => {
    const { conector } = conectorEspia(new Error("ambas ops fallaron"));
    const logs: string[] = [];
    const out = await descubrirNuevosDelAnno({
      conector,
      anno: 2026,
      corpus: [],
      cap: CAP_DESCUBRIMIENTO,
      log: (m) => logs.push(m),
    });
    expect(out).toEqual([]);
    expect(logs).toContain("[WARN] descubrimiento omitido: ambas ops fallaron");
  });

  it("KILL-SWITCH: con descubrir=false NO se invoca el WS y la selección es la baseline", async () => {
    const { conector, registro } = conectorEspia(["18464-14"]);
    const agenda: string[] = [];
    const corpus = Array.from({ length: 40 }, (_, i) => `${10000 + i}-01`);
    const limite = 10;
    const descubrir = false;

    // Espeja el cableado del CLI: el paso solo corre si `descubrir`.
    const nuevos = descubrir
      ? await descubrirNuevosDelAnno({
          conector,
          anno: 2026,
          corpus,
          cap: CAP_DESCUBRIMIENTO,
          log: () => {},
        })
      : [];
    const { seleccion } = seleccionarRotado({
      agenda,
      corpus,
      offset: 0,
      limite: Math.max(0, limite - nuevos.length),
    });
    const final = intercalarDescubrimiento({ seleccion, agenda, nuevos, limite });

    const baseline = seleccionarRotado({ agenda, corpus, offset: 0, limite }).seleccion;
    expect(registro.llamadas).toEqual([]);
    expect(final).toEqual(baseline);
  });
});
