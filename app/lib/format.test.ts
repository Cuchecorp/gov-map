import { describe, it, expect } from "vitest";

import { relativeTimeEs, fechaCorta, esStale } from "./format";

const NOW = new Date("2026-05-20T12:00:00Z");

describe("relativeTimeEs", () => {
  it("< 1h → 'hace X min'", () => {
    const captured = new Date(NOW.getTime() - 25 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 25 min");
  });

  it("exactamente al borde de 1h sigue en minutos < 60", () => {
    const captured = new Date(NOW.getTime() - 59 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 59 min");
  });

  it("< 24h → 'hace X h'", () => {
    const captured = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 3 h");
  });

  it("< 7d con 1 día → singular 'día'", () => {
    const captured = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 1 día");
  });

  it("< 7d con varios días → plural 'días'", () => {
    const captured = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 3 días");
  });

  it("≥ 7d → fecha absoluta DD MMM YYYY", () => {
    const captured = new Date("2026-05-01T12:00:00Z");
    // 19 días atrás → fecha absoluta
    expect(relativeTimeEs(captured, NOW)).toBe(fechaCorta(captured));
    expect(relativeTimeEs(captured, NOW)).toMatch(/2026/);
  });

  it("captura en el futuro (reloj desfasado) → 'hace 0 min'", () => {
    const captured = new Date(NOW.getTime() + 60 * 1000);
    expect(relativeTimeEs(captured, NOW)).toBe("hace 0 min");
  });
});

describe("fechaCorta", () => {
  it("formatea como 'DD MMM YYYY' es-CL", () => {
    const d = new Date("2026-05-14T12:00:00Z");
    const out = fechaCorta(d);
    expect(out).toMatch(/14/);
    expect(out).toMatch(/2026/);
    // mes abreviado en español (may)
    expect(out.toLowerCase()).toMatch(/may/);
  });
});

describe("esStale", () => {
  it("≤ 48h → false", () => {
    const captured = new Date(NOW.getTime() - 47 * 60 * 60 * 1000);
    expect(esStale(captured, NOW)).toBe(false);
  });

  it("> 48h → true", () => {
    const captured = new Date(NOW.getTime() - 49 * 60 * 60 * 1000);
    expect(esStale(captured, NOW)).toBe(true);
  });
});
