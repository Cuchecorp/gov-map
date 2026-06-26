import { describe, it, expect } from "vitest";

import { derivarEstado, type CarrilEstado } from "./parlamentario-resumen-conteos";

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
