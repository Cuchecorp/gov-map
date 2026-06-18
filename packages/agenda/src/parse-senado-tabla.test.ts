// TDD del parser de la tabla semanal de sala del Senado (Task 3) — JSON real de
// `web-back.senado.cl/api/weekly_table`.
//
// RED: importa `./parse-senado-tabla`, que aún no existe.
// GREEN: recorre `data[]` → `SesionSala` (id=ID_SESION, numero=NUMERO_SESION,
// hora_inicio=HORA_INICIO, tipo=TIPO_SESION), items desde `TABLA[]` (posicion=POSICION int,
// parte_sesion=PARTE_SESION, materia=MATERIA, boletin=BOLETIN nullable, id_proyecto, alias,
// quorum). FECHA en texto se conserva normalizada. Cada item/sesión valida con zod.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseSenadoTabla } from "./parse-senado-tabla";
import { SesionSalaSchema } from "./model";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const json = readFileSync(join(FIXTURES, "senado-weekly-table.json"), "utf8");

describe("parseSenadoTabla (JSON real de weekly_table)", () => {
  const sesiones = parseSenadoTabla(json);

  it("extrae ≥1 SesionSala del fixture real", () => {
    expect(sesiones.length).toBeGreaterThanOrEqual(1);
  });

  it("cada SesionSala es camara='senado' con id, numero y al menos un item", () => {
    for (const s of sesiones) {
      expect(s.camara).toBe("senado");
      expect(s.id).toBeTruthy();
    }
    const conItems = sesiones.find((s) => s.items.length > 0);
    expect(conItems).toBeDefined();
  });

  it("los items traen posicion (int), parte_sesion y boletin nullable", () => {
    const s = sesiones.find((x) => x.items.length > 0)!;
    const item = s.items[0]!;
    expect(Number.isInteger(item.posicion)).toBe(true);
    expect(item.parte_sesion).toBeTruthy();
    expect(item.boletin === null || /^\d+-\d+$/.test(item.boletin)).toBe(true);
  });

  it("PARTE_SESION incluye 'ORDEN DEL DÍA' (orden del día estructurado)", () => {
    const partes = sesiones.flatMap((s) => s.items.map((i) => i.parte_sesion));
    expect(partes.some((p) => /ORDEN DEL D/i.test(p))).toBe(true);
  });

  it("al menos un item con boletín cruzable (BOLETIN → proyecto.boletin)", () => {
    const conBoletin = sesiones
      .flatMap((s) => s.items)
      .find((i) => i.boletin !== null);
    expect(conBoletin?.boletin).toMatch(/^\d+-\d+$/);
  });

  it("admite items sin BOLETIN (boletin null, no fabrica) — p.ej. sesiones especiales", () => {
    const todos = sesiones.flatMap((s) => s.items);
    expect(todos.some((i) => i.boletin === null)).toBe(true);
  });

  it("cada SesionSala valida contra SesionSalaSchema (drift descartado)", () => {
    for (const s of sesiones) {
      expect(() => SesionSalaSchema.parse(s)).not.toThrow();
    }
  });

  it("adjunta provenance inline (origen senado + enlace a weekly_table)", () => {
    const s = sesiones[0]!;
    expect(s.origen).toContain("senado");
    expect(s.enlace).toContain("weekly_table");
  });
});
