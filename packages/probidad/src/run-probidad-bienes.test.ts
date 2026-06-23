// run-probidad-bienes.test — runner BATCHEADO con conector mock + InMemoryProbidadWriter.
//
// El conector mock decide la respuesta según qué predicado `tiene*` contiene el string de la query
// (inmueble→tieneBien+BienInmueble, mueble→tieneBien+BienMueble, actividad→tieneActividad,
// pasivo→tienePasivo, accion→tieneAccionDerecho, valor→tieneValor). Verifica conteos sumados y que
// el writer capturó los biens por declaración. También cubre la tolerancia (una query que lanza).

import { describe, it, expect } from "vitest";
import { runProbidadBienes } from "./run-probidad-bienes";
import { InMemoryProbidadWriter } from "./writer";
import type { InfoProbidadConnector } from "./connector-infoprobidad";

const D1 = "http://datos.cplt.cl/recurso/declaracion_1";
const D2 = "http://datos.cplt.cl/recurso/declaracion_2";

function sparqlJson(filas: Array<Record<string, string>>): unknown {
  return {
    head: { vars: filas.length ? Object.keys(filas[0]) : [] },
    results: {
      bindings: filas.map((f) => {
        const b: Record<string, { type: string; value: string }> = {};
        for (const [k, v] of Object.entries(f)) b[k] = { type: "literal", value: v };
        return b;
      }),
    },
  };
}

/** Conector mock: enruta por el predicado `tiene*`/tipo presente en la query string. */
function mockConector(respuesta?: (clase: string, q: string) => unknown): InfoProbidadConnector {
  return {
    urlSparql: (q: string) => `https://datos.cplt.cl/sparql?query=${encodeURIComponent(q)}`,
    fetchSparql: async (q: string) => {
      // BienMueble debe chequearse antes que el genérico tieneBien (ambos usan ip:tieneBien).
      const clase = q.includes("ip:BienMueble")
        ? "mueble"
        : q.includes("ip:BienInmueble")
          ? "inmueble"
          : q.includes("ip:tieneActividad")
            ? "actividad"
            : q.includes("ip:tienePasivo")
              ? "pasivo"
              : q.includes("ip:tieneAccionDerecho")
                ? "accion"
                : q.includes("ip:tieneValor")
                  ? "valor"
                  : "desconocido";
      if (respuesta) return respuesta(clase, q);
      return sparqlJson([]);
    },
  } as unknown as InfoProbidadConnector;
}

describe("runProbidadBienes", () => {
  const declaraciones = [
    { fuenteId: D1, fechaPresentacion: "2026-03-30" },
    { fuenteId: D2, fechaPresentacion: "2021-08-19" },
  ];

  it("suma conteos y captura biens por declaración en el InMemory writer", async () => {
    const writer = new InMemoryProbidadWriter();
    const conector = mockConector((clase) => {
      switch (clase) {
        case "inmueble":
          return sparqlJson([
            { d: D1, x: `${D1}/inm`, ubicadoEn: "Santiago", rolAvaluo: "1-1", numInscripcion: "10" },
            { d: D2, x: `${D2}/inm`, ubicadoEn: "Valpo", rolAvaluo: "2-2", numInscripcion: "20" },
          ]);
        case "mueble":
          return sparqlJson([{ d: D1, x: `${D1}/mue`, nombreMueble: "Auto", modelo: "Corolla", matricula: "AB12", numeroInscripcion: "n1" }]);
        case "pasivo":
          return sparqlJson([{ d: D2, x: `${D2}/pas`, tipoObligacion: "Hipotecario", acreedor: "Banco", montoDeuda: "100" }]);
        default:
          return sparqlJson([]);
      }
    });

    const res = await runProbidadBienes({ conector, writer, declaraciones, chunkSize: 50 });

    expect(res.chunks).toBe(1);
    expect(res.inmuebles).toBe(2);
    expect(res.muebles).toBe(1);
    expect(res.pasivos).toBe(1);
    expect(res.actividades).toBe(0);
    expect(res.accionesDerechos).toBe(0);
    expect(res.valores).toBe(0);

    // El writer capturó los biens: 2 inmuebles (uno por decl), 1 mueble (D1), 1 pasivo (D2).
    expect(writer.bienesInmuebles.size).toBe(2);
    expect(writer.bienesMuebles.size).toBe(1);
    expect(writer.pasivos.size).toBe(1);

    const inmuebleD1 = [...writer.bienesInmuebles.values()].find((r) => r.fuente_id === D1)!;
    expect(inmuebleD1.fecha_presentacion).toBe("2026-03-30");
    expect(inmuebleD1.ubicadoEn).toBe("Santiago");
    expect(inmuebleD1.licencia).toBe("CC BY 4.0");

    const muebleD1 = [...writer.bienesMuebles.values()][0];
    expect(muebleD1.fuente_id).toBe(D1);
    expect(muebleD1.nombre).toBe("Auto");
  });

  it("es tolerante: una query que lanza NO aborta; los demás biens se escriben", async () => {
    const writer = new InMemoryProbidadWriter();
    const conector = mockConector((clase) => {
      if (clase === "inmueble") throw new Error("boom inmueble");
      if (clase === "pasivo") return sparqlJson([{ d: D1, x: `${D1}/pas`, tipoObligacion: "Consumo", acreedor: "X", montoDeuda: "5" }]);
      return sparqlJson([]);
    });

    const res = await runProbidadBienes({ conector, writer, declaraciones });

    expect(res.inmuebles).toBe(0); // la query falló → 0
    expect(res.pasivos).toBe(1); // los demás siguieron
    expect(writer.pasivos.size).toBe(1);
  });

  it("chunkea por chunkSize", async () => {
    const writer = new InMemoryProbidadWriter();
    const conector = mockConector();
    const res = await runProbidadBienes({ conector, writer, declaraciones, chunkSize: 1 });
    expect(res.chunks).toBe(2);
  });
});
