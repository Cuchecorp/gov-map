// SLICE E2E — RED hasta las olas 2-4; los parsers las vuelven verde.
//
// Este test describe el CONTRATO OBSERVABLE CIUDADANO de la fase como contrato fallido a
// propósito: importa los parsers que las olas siguientes implementarán
// (parseCamaraCitaciones / parseSenadoCitaciones / parseSenadoTabla). Hoy esos símbolos
// NO existen en el barrel → el test FALLA en RED por símbolos ausentes (no por fixtures
// rotos, no por it.todo).
//
// La diana: "la ciudadanía ve la agenda legislativa — todas las citaciones de comisiones
// de Cámara y Senado, y la tabla semanal de sala del Senado (orden del día), cada ítem con
// su fuente y, cuando menciona un boletín, enlazado a la ficha del proyecto (Fase 5)".

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// @ts-expect-error — RED: estos parsers aún no existen en el barrel (olas siguientes los añaden).
import {
  parseCamaraCitaciones,
  parseSenadoCitaciones,
  parseSenadoTabla,
} from "./index";

import type { Citacion, SesionSala } from "./model";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

const camaraHtml = leer("camara-citaciones-semana.html");
const senadoCitacionesJson = leer("senado-commissions-citations.json");
const senadoTablaJson = leer("senado-weekly-table.json");

describe("SLICE E2E — agenda ciudadana (RED hasta las olas de parsers)", () => {
  it("TRAM-07 Cámara: parseCamaraCitaciones produce ≥1 Citacion con comision/horario/materia", () => {
    const citaciones: Citacion[] = parseCamaraCitaciones(camaraHtml, "2026-W25");
    expect(citaciones.length).toBeGreaterThanOrEqual(1);
    const c = citaciones[0];
    expect(c.camara).toBe("camara");
    expect(c.comision).toBeTruthy();
    expect(c.horario).toBeTruthy();
    expect(c.materia).toBeTruthy();
  });

  it("TRAM-07 Senado: parseSenadoCitaciones produce Citacion[] con al menos un punto con boletín", () => {
    const citaciones: Citacion[] = parseSenadoCitaciones(senadoCitacionesJson);
    expect(citaciones.length).toBeGreaterThanOrEqual(1);
    const conBoletin = citaciones
      .flatMap((c) => c.puntos)
      .find((p) => p.boletin !== null);
    expect(conBoletin?.boletin).toMatch(/^\d+-\d+$/); // "NNNNN-NN" → cruce con proyecto.boletin
  });

  it("TRAM-08 Senado: parseSenadoTabla produce un SesionSala con items[]", () => {
    const sesiones: SesionSala[] = parseSenadoTabla(senadoTablaJson);
    expect(sesiones.length).toBeGreaterThanOrEqual(1);
    const s = sesiones[0];
    expect(s.camara).toBe("senado");
    expect(s.items.length).toBeGreaterThanOrEqual(1);
    expect(typeof s.items[0]?.posicion).toBe("number");
  });
});
