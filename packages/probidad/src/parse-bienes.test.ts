// parse-bienes.test — parsers BATCH de bienes contra fixtures SPARQL-JSON inline.
//
// Verifica: (a) agrupación por fuenteId (?d); (b) mapeo de var de predicado → campo de modelo
// (nombreMueble→nombre, fojasInmueble→fojas, anioInmueble→anio); (c) dos declaraciones separan sus
// biens correctamente; (d) filas sin ?d/?x se descartan; (e) un mismo nodo ?x en varias filas
// ensambla UN bien (primer valor no-vacío gana).

import { describe, it, expect } from "vitest";
import { parseBienInmueble, parseBienMueble, parsePasivo, parseValor } from "./parse-bienes";

/** Helper: arma un documento SPARQL-JSON `{results:{bindings:[...]}}` desde filas planas. */
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

const D1 = "http://datos.cplt.cl/recurso/declaracion_1";
const D2 = "http://datos.cplt.cl/recurso/declaracion_2";

describe("parseBienInmueble", () => {
  it("agrupa por fuenteId y mapea fojasInmueble→fojas, anioInmueble→anio", () => {
    const json = sparqlJson([
      { d: D1, x: `${D1}/inm_a`, ubicadoEn: "Santiago", rolAvaluo: "123-4", numInscripcion: "999", fojasInmueble: "45", anioInmueble: "2010", esSuDomicilio: "true" },
      { d: D2, x: `${D2}/inm_b`, ubicadoEn: "Valparaíso", numInscripcion: "111" },
    ]);
    const map = parseBienInmueble(json);
    expect([...map.keys()].sort()).toEqual([D1, D2].sort());
    const a = map.get(D1)![0];
    expect(a.fojas).toBe("45");
    expect(a.anio).toBe("2010");
    expect(a.ubicadoEn).toBe("Santiago");
    expect(a.esSuDomicilio).toBe("true");
    const b = map.get(D2)![0];
    expect(b.ubicadoEn).toBe("Valparaíso");
    expect(b.numInscripcion).toBe("111");
    expect(b.rolAvaluo).toBeNull();
  });

  it("ensambla UN bien cuando el mismo nodo ?x aparece en varias filas (primer valor gana)", () => {
    const json = sparqlJson([
      { d: D1, x: `${D1}/inm_a`, ubicadoEn: "Santiago" },
      { d: D1, x: `${D1}/inm_a`, rolAvaluo: "123-4" },
    ]);
    const map = parseBienInmueble(json);
    expect(map.get(D1)!.length).toBe(1);
    expect(map.get(D1)![0].ubicadoEn).toBe("Santiago");
    expect(map.get(D1)![0].rolAvaluo).toBe("123-4");
  });

  it("descarta filas sin ?d o sin ?x", () => {
    const json = sparqlJson([
      { x: `${D1}/inm_a`, ubicadoEn: "Santiago" }, // sin d
      { d: D1, ubicadoEn: "Maipú" }, // sin x
    ]);
    const map = parseBienInmueble(json);
    expect(map.size).toBe(0);
  });
});

describe("parseBienMueble", () => {
  it("mapea nombreMueble→nombre y separa dos declaraciones", () => {
    const json = sparqlJson([
      { d: D1, x: `${D1}/mue_a`, nombreMueble: "Auto", modelo: "Corolla", matricula: "ABCD12", anioFabricacion: "2018" },
      { d: D2, x: `${D2}/mue_b`, nombreMueble: "Lancha", tonelaje: "5" },
    ]);
    const map = parseBienMueble(json);
    expect(map.get(D1)![0].nombre).toBe("Auto");
    expect(map.get(D1)![0].modelo).toBe("Corolla");
    expect(map.get(D1)![0].anioFabricacion).toBe("2018");
    expect(map.get(D2)![0].nombre).toBe("Lancha");
    expect(map.get(D2)![0].tonelaje).toBe("5");
  });
});

describe("parsePasivo", () => {
  it("mapea predicados a tipo_obligacion/acreedor/monto_deuda (verbatim) y agrupa", () => {
    const json = sparqlJson([
      { d: D1, x: `${D1}/pas_a`, tipoObligacion: "Hipotecario", acreedor: "Banco X", montoDeuda: "50000000" },
      { d: D1, x: `${D1}/pas_b`, tipoObligacion: "Consumo", acreedor: "Banco Y", montoDeuda: "1000000" },
    ]);
    const map = parsePasivo(json);
    expect(map.get(D1)!.length).toBe(2);
    expect(map.get(D1)![0].montoDeuda).toBe("50000000");
    expect(map.get(D1)![1].acreedor).toBe("Banco Y");
  });
});

describe("parseValor", () => {
  it("mapea entidadEmisora/valorPlaza/paisQueEmite y agrupa por declaración", () => {
    const json = sparqlJson([
      { d: D2, x: `${D2}/val_a`, entidadEmisora: "Empresa SA", tipoAccionDerecho: "Acción", cantidadRepresenta: "100", valorPlaza: "200000", paisQueEmite: "Chile", fechaAdquisicion: "2015-01-01", tipoGravamen: "Ninguno" },
    ]);
    const map = parseValor(json);
    expect(map.size).toBe(1);
    const v = map.get(D2)![0];
    expect(v.entidadEmisora).toBe("Empresa SA");
    expect(v.valorPlaza).toBe("200000");
    expect(v.paisQueEmite).toBe("Chile");
    expect(v.fechaAdquisicion).toBe("2015-01-01");
  });
});
