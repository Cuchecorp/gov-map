import { describe, it, expect } from "vitest";
import { cohenKappa, ic95Proporcion, reglaInterpretabilidad, nPorClase } from "./kappa";

describe("kappa — cómputo determinista (133-b-06)", () => {
  it("(a) valor conocido: po=0.7, pe=0.5 ⇒ κ=0.4", () => {
    // A: 10 x + 10 y; B coincide en 7 de cada bloque y discrepa en 3.
    const pares = [
      ...Array.from({ length: 7 }, () => ({ a: "x", b: "x" })),
      ...Array.from({ length: 3 }, () => ({ a: "x", b: "y" })),
      ...Array.from({ length: 7 }, () => ({ a: "y", b: "y" })),
      ...Array.from({ length: 3 }, () => ({ a: "y", b: "x" })),
    ];
    const r = cohenKappa(pares);
    expect(r.n).toBe(20);
    expect(r.acuerdoBruto).toBeCloseTo(0.7, 10);
    expect(r.kappa).toBeCloseTo(0.4, 10);
  });

  it("(b) acuerdo perfecto multi-clase ⇒ κ=1, IC degenerado en 1 no requerido pero κ exacto", () => {
    const pares = [
      { a: "x", b: "x" },
      { a: "y", b: "y" },
      { a: "z", b: "z" },
      { a: "x", b: "x" },
    ];
    const r = cohenKappa(pares);
    expect(r.kappa).toBe(1);
    expect(r.acuerdoBruto).toBe(1);
  });

  it("(c) lista vacía LANZA (cero vacuo)", () => {
    expect(() => cohenKappa([])).toThrow(/cero vacuo/);
  });

  it("(d) degenerado: una sola etiqueta en ambos ⇒ pe=1, acuerdo total ⇒ κ=1", () => {
    const pares = Array.from({ length: 5 }, () => ({ a: "x", b: "x" }));
    expect(cohenKappa(pares).kappa).toBe(1);
  });

  it("(e) el IC95 se estrecha con n: mismo patrón ×10 da intervalo más angosto", () => {
    const patron = [
      ...Array.from({ length: 7 }, () => ({ a: "x", b: "x" })),
      ...Array.from({ length: 3 }, () => ({ a: "x", b: "y" })),
      ...Array.from({ length: 7 }, () => ({ a: "y", b: "y" })),
      ...Array.from({ length: 3 }, () => ({ a: "y", b: "x" })),
    ];
    const chico = cohenKappa(patron);
    const grande = cohenKappa(Array.from({ length: 10 }, () => patron).flat());
    expect(grande.kappa).toBeCloseTo(chico.kappa, 10);
    const anchoChico = chico.ic95.sup - chico.ic95.inf;
    const anchoGrande = grande.ic95.sup - grande.ic95.inf;
    expect(anchoGrande).toBeLessThan(anchoChico);
  });

  it("(f) Wilson conocido: 8/10 ⇒ [≈0.490, ≈0.943]", () => {
    const ic = ic95Proporcion(8, 10);
    expect(ic.inf).toBeCloseTo(0.4901, 3);
    expect(ic.sup).toBeCloseTo(0.9433, 3);
  });

  it("(g) regla C2.1.3: se gatilla estrictamente sobre Δ > 0.15, no en el borde", () => {
    const enBorde = reglaInterpretabilidad(0.8, 0.65, 0.65);
    expect(enBorde.delta).toBeCloseTo(0.15, 10);
    expect(enBorde.gatillada).toBe(false);
    const pasada = reglaInterpretabilidad(0.8, 0.64, 0.64);
    expect(pasada.gatillada).toBe(true);
    // La media de κ(fable↔A) y κ(fable↔B) es la comparación, documentada.
    expect(reglaInterpretabilidad(0.8, 0.6, 0.7).kappaFable).toBeCloseTo(0.65, 10);
    // La limitación intra-familia viaja SIEMPRE en el veredicto.
    expect(enBorde.limitacion).toContain("NO k(humano-maquina)");
  });

  it("(h) nPorClase cuenta y lanza sobre vacío", () => {
    expect(nPorClase(["x", "y", "x"])).toEqual({ x: 2, y: 1 });
    expect(() => nPorClase([])).toThrow(/cero vacuo/);
  });
});
