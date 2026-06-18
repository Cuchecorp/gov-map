// TDD del parser de citaciones del Senado (Task 3) — JSON real de
// `web-back.senado.cl/api/commissions_citations`.
//
// RED: importa `./parse-senado-citaciones`, que aún no existe.
// GREEN: recorre `data[].CITACIONES[]` → `Citacion` (camara='senado', comision=COMINOMBRE,
// sala=LUGAR, materia=MATERIA, estado=SIN_EFECTO?'Sin efecto':null), puntos desde
// `PUNTOS_PROPUESTOS[]` (boletin=NUMERO_BOLETIN nullable → cruce Fase 5). El `FECHA`
// "DD/MM/YYYY" se parsea a ISO. Cada fila valida con `CitacionSchema`.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseSenadoCitaciones } from "./parse-senado-citaciones";
import { CitacionSchema } from "./model";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const json = readFileSync(join(FIXTURES, "senado-commissions-citations.json"), "utf8");

describe("parseSenadoCitaciones (JSON real de commissions_citations)", () => {
  const citaciones = parseSenadoCitaciones(json);

  it("extrae ≥1 Citacion del fixture real", () => {
    expect(citaciones.length).toBeGreaterThanOrEqual(1);
  });

  it("cada Citacion es camara='senado' con comision (COMINOMBRE) y horario", () => {
    for (const c of citaciones) {
      expect(c.camara).toBe("senado");
      expect(c.comision).toBeTruthy();
      expect(c.horario).toBeTruthy();
    }
  });

  it("parsea FECHA 'DD/MM/YYYY' a ISO 'YYYY-MM-DD'", () => {
    const fechas = citaciones.map((c) => c.fecha);
    expect(fechas.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))).toBe(true);
    // 18/06/2026 está en el fixture (primer día).
    expect(fechas).toContain("2026-06-18");
  });

  it("al menos un punto con boletín poblado desde NUMERO_BOLETIN (cruce Fase 5)", () => {
    const conBoletin = citaciones
      .flatMap((c) => c.puntos)
      .find((p) => p.boletin !== null);
    expect(conBoletin?.boletin).toMatch(/^\d+-\d+$/);
    expect(conBoletin?.id_proyecto === null || typeof conBoletin?.id_proyecto === "number").toBe(true);
  });

  it("admite puntos sin NUMERO_BOLETIN (boletin null, no fabrica)", () => {
    const todos = citaciones.flatMap((c) => c.puntos);
    expect(todos.some((p) => p.boletin === null)).toBe(true);
  });

  it("invitados vacío (la API de citaciones del Senado no los expone)", () => {
    for (const c of citaciones) {
      expect(Array.isArray(c.invitados)).toBe(true);
      expect(c.invitados.length).toBe(0);
    }
  });

  it("estado refleja SIN_EFECTO ('Sin efecto' o null)", () => {
    for (const c of citaciones) {
      expect(c.estado === null || c.estado === "Sin efecto").toBe(true);
    }
  });

  it("cada Citacion valida contra CitacionSchema (drift descartado)", () => {
    for (const c of citaciones) {
      expect(() => CitacionSchema.parse(c)).not.toThrow();
    }
  });

  it("adjunta provenance inline (origen senado + enlace a web-back)", () => {
    const c = citaciones[0]!;
    expect(c.origen).toContain("senado");
    expect(c.enlace).toContain("commissions_citations");
  });
});

// WR-02: sin ID_CITACION, dos citaciones distintas del mismo slot NO deben colapsar.
describe("parseSenadoCitaciones — clave de fallback sin ID_CITACION (WR-02)", () => {
  function dia(...cits: Record<string, unknown>[]) {
    return JSON.stringify({ data: [{ FECHA: "18/06/2026", CITACIONES: cits }] });
  }
  const base = {
    COMINOMBRE: "Comisión de Hacienda",
    HORARIO: "10:00",
    // ID_CITACION ausente a propósito
  };

  it("dos citaciones mismo comisión+fecha+horario con materias distintas → 2 ids distintos", () => {
    const res = parseSenadoCitaciones(
      dia(
        { ...base, LUGAR: "Sala A", MATERIA: "Estudio del proyecto AAA" },
        { ...base, LUGAR: "Sala A", MATERIA: "Estudio del proyecto BBB" },
      ),
    );
    expect(res.length).toBe(2);
    expect(new Set(res.map((c) => c.id)).size).toBe(2);
  });

  it("id de fallback es estable bajo reordenamiento (no swap)", () => {
    const cA = { ...base, LUGAR: "Sala A", MATERIA: "AAA" };
    const cB = { ...base, LUGAR: "Sala A", MATERIA: "BBB" };
    const r1 = parseSenadoCitaciones(dia(cA, cB));
    const r2 = parseSenadoCitaciones(dia(cB, cA));
    const idDe = (r: typeof r1, m: string) => r.find((c) => c.materia === m)!.id;
    expect(idDe(r1, "AAA")).toBe(idDe(r2, "AAA"));
    expect(idDe(r1, "BBB")).toBe(idDe(r2, "BBB"));
  });

  it("con ID_CITACION presente la clave sigue siendo el id de la fuente", () => {
    const res = parseSenadoCitaciones(
      dia({ ...base, ID_CITACION: "9999", LUGAR: "Sala A", MATERIA: "X" }),
    );
    expect(res[0]!.id).toBe("senado:citacion:9999");
  });
});
