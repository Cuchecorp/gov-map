// TDD del helper de semana ISO-8601 (Task 1).
//
// RED: importa `./semana-iso`, que aún no existe → falla por símbolo ausente.
// GREEN: el helper implementa la convención del jueves (la semana ISO 1 contiene el
// primer jueves del año / el 4 de enero), enumera semanas cruzando el borde de año
// sin saltar ni duplicar, y respeta los años de 53 semanas.
//
// Los bordes de año ISO son sutiles (Pitfall 4 del RESEARCH): la semana ISO 1 puede
// caer en diciembre y 2026 tiene 53 semanas → estos tests son el contrato.

import { describe, it, expect } from "vitest";
import {
  isoWeekOf,
  semanaIsoKey,
  enumerarSemanas,
  prmSemanaParam,
} from "./semana-iso";

describe("isoWeekOf", () => {
  it("2026-01-01 (jueves) pertenece a 2026-W01", () => {
    // 1 de enero de 2026 es jueves → la semana ISO 1 contiene el primer jueves.
    expect(isoWeekOf(new Date(Date.UTC(2026, 0, 1)))).toEqual({ year: 2026, week: 1 });
  });

  it("2021-01-01 (viernes) pertenece a 2020-W53", () => {
    // 1 de enero de 2021 es viernes → pertenece a la última semana ISO de 2020 (53 semanas).
    expect(isoWeekOf(new Date(Date.UTC(2021, 0, 1)))).toEqual({ year: 2020, week: 53 });
  });

  it("2020-12-31 (jueves) pertenece a 2020-W53", () => {
    expect(isoWeekOf(new Date(Date.UTC(2020, 11, 31)))).toEqual({ year: 2020, week: 53 });
  });

  it("2023-01-01 (domingo) pertenece a 2022-W52", () => {
    expect(isoWeekOf(new Date(Date.UTC(2023, 0, 1)))).toEqual({ year: 2022, week: 52 });
  });

  it("2026-06-15 (lunes) pertenece a 2026-W25 (la semana del fixture)", () => {
    expect(isoWeekOf(new Date(Date.UTC(2026, 5, 15)))).toEqual({ year: 2026, week: 25 });
  });

  it("2026-12-31 (jueves) pertenece a 2026-W53 (2026 tiene 53 semanas)", () => {
    expect(isoWeekOf(new Date(Date.UTC(2026, 11, 31)))).toEqual({ year: 2026, week: 53 });
  });
});

describe("semanaIsoKey", () => {
  it("formatea con padding de 2 dígitos", () => {
    expect(semanaIsoKey(2026, 5)).toBe("2026-W05");
    expect(semanaIsoKey(2026, 25)).toBe("2026-W25");
    expect(semanaIsoKey(2020, 53)).toBe("2020-W53");
  });
});

describe("prmSemanaParam", () => {
  it("devuelve '{year}-{week}' sin padding (formato del parámetro de Cámara)", () => {
    expect(prmSemanaParam(2026, 25)).toBe("2026-25");
    expect(prmSemanaParam(2015, 20)).toBe("2015-20");
    expect(prmSemanaParam(2026, 5)).toBe("2026-5");
  });
});

describe("enumerarSemanas", () => {
  it("enumera un rango simple inclusive dentro del mismo año", () => {
    const r = enumerarSemanas({ year: 2026, week: 23 }, { year: 2026, week: 26 });
    expect(r).toEqual([
      { year: 2026, week: 23 },
      { year: 2026, week: 24 },
      { year: 2026, week: 25 },
      { year: 2026, week: 26 },
    ]);
  });

  it("devuelve una sola semana cuando desde === hasta", () => {
    expect(enumerarSemanas({ year: 2026, week: 25 }, { year: 2026, week: 25 })).toEqual([
      { year: 2026, week: 25 },
    ]);
  });

  it("cruza el borde de año respetando un año de 53 semanas (2020 → 2021)", () => {
    const r = enumerarSemanas({ year: 2020, week: 52 }, { year: 2021, week: 2 });
    expect(r).toEqual([
      { year: 2020, week: 52 },
      { year: 2020, week: 53 },
      { year: 2021, week: 1 },
      { year: 2021, week: 2 },
    ]);
  });

  it("cruza el borde de un año de 52 semanas (2025 → 2026) sin huecos ni duplicados", () => {
    const r = enumerarSemanas({ year: 2025, week: 51 }, { year: 2026, week: 2 });
    expect(r).toEqual([
      { year: 2025, week: 51 },
      { year: 2025, week: 52 },
      { year: 2026, week: 1 },
      { year: 2026, week: 2 },
    ]);
  });

  it("produce una secuencia contigua sin huecos sobre un rango plurianual largo", () => {
    const r = enumerarSemanas({ year: 2024, week: 50 }, { year: 2027, week: 3 });
    // Cada semana enumerada debe coincidir con isoWeekOf de su propio lunes (consistencia interna).
    for (const s of r) {
      // semanaIsoKey unívoca y reconstruible
      expect(semanaIsoKey(s.year, s.week)).toMatch(/^\d{4}-W\d{2}$/);
    }
    // Primer y último elemento correctos, sin duplicados.
    expect(r[0]).toEqual({ year: 2024, week: 50 });
    expect(r[r.length - 1]).toEqual({ year: 2027, week: 3 });
    const keys = r.map((s) => semanaIsoKey(s.year, s.week));
    expect(new Set(keys).size).toBe(keys.length);
    // 2024 y 2026 son años de 53 semanas → deben aparecer sus W53.
    expect(keys).toContain("2024-W53");
    expect(keys).toContain("2026-W53");
    // 2025 es de 52 semanas → NO debe existir 2025-W53.
    expect(keys).not.toContain("2025-W53");
  });

  it("lanza si `hasta` es anterior a `desde`", () => {
    expect(() =>
      enumerarSemanas({ year: 2026, week: 26 }, { year: 2026, week: 23 }),
    ).toThrow();
  });
});
