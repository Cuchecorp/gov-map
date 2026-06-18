import { describe, expect, it } from "vitest";
import { DailyCache } from "./cache";

const SPEC = {
  url: "https://camara.cl/doGet.asmx?op=proyectos",
  host: "camara.cl",
  resource: "proyectos",
  key: "proyectos",
  params: { year: 2026, page: 1 },
};

/** Lookup mock: registra (source,resource,dateBucket) "ya vistos". */
function fakeLookup(present: Set<string>) {
  return {
    hasSnapshot: async (source: string, resource: string, dateBucket: string) =>
      present.has(`${source}|${resource}|${dateBucket}`),
  };
}

describe("DailyCache", () => {
  it("Test 2a: dailyKey es estable para los mismos (source, endpoint, params, date)", async () => {
    const cache = new DailyCache(fakeLookup(new Set()));
    const k1 = await cache.dailyKey("camara", SPEC, new Date("2026-06-17T10:00:00Z"));
    const k2 = await cache.dailyKey("camara", SPEC, new Date("2026-06-17T23:59:00Z"));
    expect(k1).toBe(k2);
    expect(k1).toHaveLength(64);
  });

  it("dailyKey difiere si cambian los params", async () => {
    const cache = new DailyCache(fakeLookup(new Set()));
    const base = await cache.dailyKey("camara", SPEC, new Date("2026-06-17T10:00:00Z"));
    const other = await cache.dailyKey(
      "camara",
      { ...SPEC, params: { year: 2025, page: 1 } },
      new Date("2026-06-17T10:00:00Z"),
    );
    expect(base).not.toBe(other);
  });

  it("Test 2b: hasToday true si ya hay fila para (source,resource,hoy) => NO re-pedir", async () => {
    const today = new Date("2026-06-17T10:00:00Z");
    const present = new Set(["camara|proyectos|2026-06-17"]);
    const cache = new DailyCache(fakeLookup(present));
    expect(await cache.hasToday("camara", SPEC, today)).toBe(true);
  });

  it("hasToday false si no hay fila para hoy => se pide", async () => {
    const today = new Date("2026-06-17T10:00:00Z");
    const cache = new DailyCache(fakeLookup(new Set()));
    expect(await cache.hasToday("camara", SPEC, today)).toBe(false);
  });
});
