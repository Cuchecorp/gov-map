import { describe, it, expect } from "vitest";

import {
  parseISOWeek,
  getWeekBounds,
  semanasEnAnioIso,
  currentISOWeek,
  formatWeekLabel,
  semanaIsoKey,
  prevISOWeek,
  nextISOWeek,
  isoWeekOf,
} from "./week-utils";

describe("week-utils — bordes ISO-8601 (espejo del helper de @obs/agenda)", () => {
  it("isoWeekOf ancla la semana al jueves (2026-01-01 jueves → 2026-W01)", () => {
    expect(isoWeekOf(new Date(Date.UTC(2026, 0, 1)))).toEqual({
      year: 2026,
      week: 1,
    });
  });

  it("borde de año: 2021-01-01 (viernes) pertenece a 2020-W53", () => {
    expect(isoWeekOf(new Date(Date.UTC(2021, 0, 1)))).toEqual({
      year: 2020,
      week: 53,
    });
  });

  it("años de 53 semanas: 2020 y 2026 tienen 53; 2025 tiene 52", () => {
    expect(semanasEnAnioIso(2020)).toBe(53);
    expect(semanasEnAnioIso(2026)).toBe(53);
    expect(semanasEnAnioIso(2025)).toBe(52);
  });

  it("getWeekBounds devuelve lunes–domingo (2026-W25 → 15–21 jun 2026)", () => {
    const { start, end } = getWeekBounds(2026, 25);
    // ISO 2026-W25: lunes 15 jun, domingo 21 jun.
    expect(start.toISOString().slice(0, 10)).toBe("2026-06-15");
    expect(end.toISOString().slice(0, 10)).toBe("2026-06-21");
    // El lunes es DOW=1, el domingo DOW=0.
    expect(start.getUTCDay()).toBe(1);
    expect(end.getUTCDay()).toBe(0);
  });

  it("getWeekBounds en el borde W1 que cae en diciembre", () => {
    // 2026-W01 contiene el 1 de enero de 2026 (jueves); lunes = 29 dic 2025.
    const { start } = getWeekBounds(2026, 1);
    expect(start.toISOString().slice(0, 10)).toBe("2025-12-29");
  });
});

describe("week-utils — parseISOWeek (tolerante a malformado, sin redirect)", () => {
  const NOW = new Date(Date.UTC(2026, 5, 18)); // 18 jun 2026 → 2026-W25

  it("parsea 'YYYY-Www' bien formado", () => {
    expect(parseISOWeek("2026-W25", NOW)).toEqual({ year: 2026, week: 25 });
  });

  it("ausente (undefined/null) → semana ISO actual", () => {
    expect(parseISOWeek(undefined, NOW)).toEqual(currentISOWeek(NOW));
    expect(parseISOWeek(null, NOW)).toEqual(currentISOWeek(NOW));
  });

  it("malformado → semana ISO actual (no lanza, no redirect)", () => {
    for (const bad of [
      "",
      "2026",
      "2026-25",
      "26-W25",
      "2026-W",
      "abc",
      "2026-W99'; drop table citacion;--",
      "../../etc",
    ]) {
      expect(parseISOWeek(bad, NOW)).toEqual(currentISOWeek(NOW));
    }
  });

  it("semana fuera de rango (W00 / W54 en año de 53) → semana actual", () => {
    expect(parseISOWeek("2026-W00", NOW)).toEqual(currentISOWeek(NOW));
    expect(parseISOWeek("2026-W54", NOW)).toEqual(currentISOWeek(NOW)); // 2026 tiene 53
    // 2025 tiene 52 → W53 inválida.
    expect(parseISOWeek("2025-W53", NOW)).toEqual(currentISOWeek(NOW));
  });

  it("W53 válida en un año de 53 semanas (2026-W53)", () => {
    expect(parseISOWeek("2026-W53", NOW)).toEqual({ year: 2026, week: 53 });
  });
});

describe("week-utils — navegación prev/next (cruza el borde de año)", () => {
  it("prev de W01 → última semana del año anterior", () => {
    expect(prevISOWeek({ year: 2026, week: 1 })).toEqual({
      year: 2025,
      week: 52,
    });
  });

  it("next de la última semana → W01 del año siguiente", () => {
    // 2026 tiene 53 semanas.
    expect(nextISOWeek({ year: 2026, week: 53 })).toEqual({
      year: 2027,
      week: 1,
    });
  });

  it("next/prev en el medio del año son ±1", () => {
    expect(nextISOWeek({ year: 2026, week: 25 })).toEqual({
      year: 2026,
      week: 26,
    });
    expect(prevISOWeek({ year: 2026, week: 25 })).toEqual({
      year: 2026,
      week: 24,
    });
  });
});

describe("week-utils — formato", () => {
  it("semanaIsoKey paddea la semana a 2 dígitos", () => {
    expect(semanaIsoKey(2026, 5)).toBe("2026-W05");
    expect(semanaIsoKey(2026, 25)).toBe("2026-W25");
  });

  it("formatWeekLabel incluye número de semana, rango y año", () => {
    const label = formatWeekLabel(2026, 25);
    expect(label).toContain("Semana 25");
    expect(label).toMatch(/15/); // lunes
    expect(label).toMatch(/21/); // domingo
    expect(label).toContain("2026");
  });
});
