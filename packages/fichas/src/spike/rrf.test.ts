import { describe, it, expect } from "vitest";
import { rrf } from "./rrf";

describe("rrf", () => {
  it("boletín presente en ambas listas rankea sobre el que sale en una sola", () => {
    const fts = ["A", "B", "C"];
    const sem = ["B", "D", "E"];
    const result = rrf(fts, sem);
    // B está en ambas → debe tener mayor score que A (solo en fts) y D (solo en sem)
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("A"));
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("D"));
  });

  it("rrfK más chico separa más los tops (verificar orden, no suma cruda)", () => {
    const fts = ["A", "B"];
    const sem = ["A", "C"];
    // Con rrfK pequeño, la diferencia entre posición 1 y 2 es mayor
    const resultSmallK = rrf(fts, sem, 1);
    // A está en ambas listas en posición 0 — debe ser primero
    expect(resultSmallK[0]).toBe("A");
  });

  it("pesos wFts=0 → resultado equivale al orden de sem solo", () => {
    const fts = ["X", "Y", "Z"];
    const sem = ["A", "B", "C"];
    // Con wFts=0, los items de fts no contribuyen al score (aunque B y C en fts no están en sem)
    const result = rrf(fts, sem, 50, 0, 1);
    // Los primeros elementos deben ser los de sem (A, B, C)
    expect(result[0]).toBe("A");
    expect(result[1]).toBe("B");
    expect(result[2]).toBe("C");
  });
});
