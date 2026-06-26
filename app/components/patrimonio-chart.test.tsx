import { describe, it, expect } from "vitest";

import {
  seriePatrimonio,
  type SeriePunto,
} from "./patrimonio-de-parlamentario";
import type { DeclaracionVersionRow, BienRpcRow } from "@/lib/types";

// ── Fixtures (espejo de patrimonio-de-parlamentario.test.tsx :33-70) ─────────────
function makeBien(overrides: Partial<BienRpcRow> = {}): BienRpcRow {
  return {
    fuente_id: "http://datos.cplt.cl/recurso/declaracion/V1",
    fecha_presentacion: "2024-05-14",
    tipo_bien: "inmueble",
    contenido: { ubicadoEn: "Santiago" },
    origen: "InfoProbidad",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.infoprobidad.cl/declaracion/V1",
    licencia: "CC BY 4.0",
    ...overrides,
  };
}

function makeVersion(
  overrides: Partial<DeclaracionVersionRow> = {},
): DeclaracionVersionRow {
  return {
    declaracion_id: "http://datos.cplt.cl/recurso/declaracion/V1",
    version_id: "http://datos.cplt.cl/recurso/declaracion/V1",
    tipo: "Declaración de patrimonio",
    fecha_presentacion: "2024-05-14",
    parlamentario_id: "P00001",
    parlamentario_estado_vinculo: "confirmado",
    parlamentario_mencion: "",
    campos: [],
    origen: "InfoProbidad",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://www.infoprobidad.cl/declaracion/V1",
    licencia: "CC BY 4.0",
    es_historica: false,
    bienes: [],
    ...overrides,
  };
}

// ── VIZ-01: transform puro seriePatrimonio() ─────────────────────────────────────
describe("seriePatrimonio — transform puro (VIZ-01)", () => {
  it("cuenta los bienes por tipo_bien dentro de UNA versión", () => {
    const v = makeVersion({
      fecha_presentacion: "2024-05-14",
      bienes: [
        makeBien({ tipo_bien: "inmueble" }),
        makeBien({ tipo_bien: "inmueble" }),
        makeBien({ tipo_bien: "pasivo" }),
      ],
    });
    const serie = seriePatrimonio([v]);
    expect(serie).toHaveLength(1);
    expect(serie[0]).toEqual<SeriePunto>({
      anio: 2024,
      tipo_declaracion: "Declaración de patrimonio",
      inmueble: 2,
      mueble: 0,
      actividad: 0,
      pasivo: 1,
      accion_derecho: 0,
      valor: 0,
    });
  });

  it("deriva el año del string ISO fecha_presentacion (sin new Date)", () => {
    const v = makeVersion({ fecha_presentacion: "2016-11-03", bienes: [] });
    const [punto] = seriePatrimonio([v]);
    expect(punto.anio).toBe(2016);
    expect(typeof punto.anio).toBe("number");
  });

  it("dos versiones del MISMO año pero distinto tipo NO se fusionan (peras con manzanas)", () => {
    const periodica = makeVersion({
      version_id: "A",
      tipo: "Declaración periódica",
      fecha_presentacion: "2020-03-01",
      bienes: [makeBien({ tipo_bien: "inmueble" })],
    });
    const rectificacion = makeVersion({
      version_id: "B",
      tipo: "Rectificación",
      fecha_presentacion: "2020-09-01",
      bienes: [makeBien({ tipo_bien: "pasivo" })],
    });
    const serie = seriePatrimonio([periodica, rectificacion]);
    // DOS puntos distintos — el transform jamás colapsa los tipos en uno solo.
    expect(serie).toHaveLength(2);
    expect(serie[0].anio).toBe(2020);
    expect(serie[1].anio).toBe(2020);
    expect(serie[0].tipo_declaracion).toBe("Declaración periódica");
    expect(serie[1].tipo_declaracion).toBe("Rectificación");
    expect(serie[0].tipo_declaracion).not.toBe(serie[1].tipo_declaracion);
  });

  it("seriePatrimonio([]) → [] y una versión → array de length 1", () => {
    expect(seriePatrimonio([])).toEqual([]);
    expect(seriePatrimonio([makeVersion()])).toHaveLength(1);
  });

  it("la salida es JSON plano: solo numbers y strings (cruza la frontera al cliente)", () => {
    const [punto] = seriePatrimonio([
      makeVersion({ bienes: [makeBien({ tipo_bien: "valor" })] }),
    ]);
    for (const [clave, valor] of Object.entries(punto)) {
      const tipo = typeof valor;
      expect(
        tipo === "number" || tipo === "string",
        `campo ${clave} debe ser number|string, es ${tipo}`,
      ).toBe(true);
    }
  });
});
