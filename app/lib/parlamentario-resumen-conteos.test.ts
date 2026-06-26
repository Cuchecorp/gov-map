import { describe, it, expect } from "vitest";

import {
  derivarEstado,
  conteosDesconocidos,
  type CarrilEstado,
} from "./parlamentario-resumen-conteos";

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
});
