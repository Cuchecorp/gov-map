import { describe, it, expect } from "vitest";
import { evaluate } from "./evaluate.js";
import { CATALOG } from "./catalog.js";
import type { QueryRow } from "./query-runner.js";

const NOW = new Date("2026-07-09T12:00:00Z");

function makeRow(fuente: string, diasAtras: number | null): QueryRow {
  let ultimoUpsert: string | null = null;
  if (diasAtras !== null) {
    const d = new Date(NOW.getTime() - diasAtras * 24 * 60 * 60 * 1000);
    ultimoUpsert = d.toISOString();
  }
  return { fuente, ultimoUpsert, ghRun: "n/d", r2Snapshot: "n/d (sin snapshots)" };
}

describe("evaluate", () => {
  it("returns empty array when rows is empty and catalog is empty", () => {
    const results = evaluate([], [], NOW);
    expect(results).toEqual([]);
  });

  it("returns stale: false when diasDesdeUpsert < umbral", () => {
    // leyes umbral = 7; 5 días transcurridos → fresco
    const rows: QueryRow[] = [makeRow("leyes", 5)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.stale).toBe(false);
    expect(results[0]!.diasDesdeUpsert).toBe(5);
  });

  it("returns stale: true when diasDesdeUpsert > umbral", () => {
    // leyes umbral = 7; 8 días transcurridos → stale
    const rows: QueryRow[] = [makeRow("leyes", 8)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.stale).toBe(true);
    expect(results[0]!.diasDesdeUpsert).toBe(8);
  });

  it("returns stale: true when ultimoUpsert is null (unknown = stale)", () => {
    const rows: QueryRow[] = [makeRow("leyes", null)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.stale).toBe(true);
    expect(results[0]!.diasDesdeUpsert).toBeNull();
    expect(results[0]!.ultimoUpsert).toBeNull();
  });

  it("returns stale: true when no row matches (fuente not in rows)", () => {
    // No rows for leyes → unknown → stale
    const rows: QueryRow[] = [];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.stale).toBe(true);
    expect(results[0]!.diasDesdeUpsert).toBeNull();
  });

  it("env override FRESHNESS_UMBRAL_LEYES=3 changes umbral for leyes", () => {
    // With override umbral=3; 5 days → stale (5 > 3)
    const rows: QueryRow[] = [makeRow("leyes", 5)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW, { FRESHNESS_UMBRAL_LEYES: "3" });
    expect(results[0]!.umbralDias).toBe(3);
    expect(results[0]!.stale).toBe(true);
  });

  it("env override with invalid value uses catalog default", () => {
    const rows: QueryRow[] = [makeRow("leyes", 5)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW, { FRESHNESS_UMBRAL_LEYES: "abc" });
    expect(results[0]!.umbralDias).toBe(7); // catalog default
    expect(results[0]!.stale).toBe(false);
  });

  it("evaluates all 6 catalog entries", () => {
    const rows: QueryRow[] = CATALOG.map((c) => makeRow(c.fuente, 1)); // 1 day → all fresh
    const results = evaluate(rows, CATALOG, NOW);
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(r.stale).toBe(false);
    }
  });

  it("passes through ghRun and r2Snapshot from QueryRow", () => {
    const rows: QueryRow[] = [
      {
        fuente: "leyes",
        ultimoUpsert: new Date(NOW.getTime() - 2 * 86400000).toISOString(),
        ghRun: "success @ 2026-07-07",
        r2Snapshot: "2026-07-07T10:00:00Z",
      },
    ];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.ghRun).toBe("success @ 2026-07-07");
    expect(results[0]!.r2Snapshot).toBe("2026-07-07T10:00:00Z");
  });
});
