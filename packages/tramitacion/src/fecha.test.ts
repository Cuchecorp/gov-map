import { describe, it, expect } from "vitest";
import { parseFechaCL, toIso } from "./fecha";

describe("parseFechaCL (Pitfall 3 — dd/mm/yyyy NO via new Date directo)", () => {
  it("parsea dd/mm/yyyy como fecha local correcta", () => {
    const d = parseFechaCL("03/06/2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5); // junio (0-indexed)
    expect(d!.getDate()).toBe(3);
  });

  it("NO confunde día con mes (17/06/2026 = 17 de junio, no día 6)", () => {
    const d = parseFechaCL("17/06/2026")!;
    expect(d.getDate()).toBe(17);
    expect(d.getMonth()).toBe(5);
  });

  it("pasa ISO con hora directo a Date", () => {
    const d = parseFechaCL("2026-05-11T19:21:07");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("devuelve null ante 'Invalid' / formato no reconocido", () => {
    expect(parseFechaCL("Invalid")).toBeNull();
    expect(parseFechaCL("")).toBeNull();
    expect(parseFechaCL(null)).toBeNull();
    expect(parseFechaCL(undefined)).toBeNull();
  });

  it("devuelve null ante overflow de calendario (31/02/2026)", () => {
    expect(parseFechaCL("31/02/2026")).toBeNull();
    expect(parseFechaCL("00/06/2026")).toBeNull();
    expect(parseFechaCL("03/13/2026")).toBeNull();
  });

  it("toIso emite ISO 8601", () => {
    const iso = toIso(parseFechaCL("03/06/2026")!);
    expect(iso).toMatch(/^2026-06-0[23]T/);
  });
});
