/**
 * GATE DE CALIDAD del routing (BENCH-02) — mock, sin red.
 *
 * Espeja el contrato de comportamiento de cruces golden-set.test.ts: 3 casos de behavior
 * (todos-correctos→pasa, todos-abstención→0 cobertura/0 errores, uno-equivocado→error que
 * falla el gate) + el meta-test adversario aislado que prueba que `gatePasa` PUEDE devolver
 * false (el gate no es teatro). El scoring es single-label top-1 + abstención.
 */
import { describe, it, expect } from "vitest";
import {
  GOLDEN_SET,
  GOLDEN_SET_GATE,
  GOLDEN_SET_ADVERSARIO,
  ROUTING_LABELS,
  COBERTURA_MIN,
  evaluarRouting,
  gatePasa,
  type CasoRouting,
  type RoutingEtiqueta,
} from "./scorer";

/** Mock "oro": cada caso devuelve su propia etiqueta esperada (routing perfecto). */
const ejecutarOro = (caso: CasoRouting): Promise<RoutingEtiqueta> =>
  Promise.resolve(caso.label);

/** Mock que abstiene siempre (todo → null). */
const ejecutarAbstiene = (): Promise<RoutingEtiqueta> => Promise.resolve(null);

describe("routing — estructura del set", () => {
  it("tiene ≥35 casos y al menos una abstención esperada (label null)", () => {
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(35);
    expect(GOLDEN_SET.some((c) => c.label === null)).toBe(true);
  });

  it("la muestra del gate tiene casos, todos con tarea no-null", () => {
    expect(GOLDEN_SET_GATE.length).toBeGreaterThanOrEqual(1);
    expect(GOLDEN_SET_GATE.every((c) => c.label !== null)).toBe(true);
  });

  it("cubre ≥4 estratos y ambas tareas de routing", () => {
    const estratos = new Set(GOLDEN_SET.map((c) => c.estrato));
    expect(estratos.size).toBeGreaterThanOrEqual(4);
    const labels = new Set(GOLDEN_SET.map((c) => c.label));
    for (const l of ROUTING_LABELS) expect(labels.has(l)).toBe(true);
  });

  it("cubre los ejes de estratificación (doc-format, register, length, chamber, negacion)", () => {
    const todos = GOLDEN_SET.map((c) => c.estrato).join("|");
    for (const eje of ["scanned-pdf", "archaic", "long", "bcn", "negacion"]) {
      expect(todos).toContain(eje);
    }
  });
});

// ── BEHAVIOR (contrato del scoring): los 3 casos ──
describe("routing — scoring single-label top-1 + abstención (behavior)", () => {
  const muestra = GOLDEN_SET_GATE;

  it("todos correctos → cobertura 1, 0 errores → gate PASA", async () => {
    const m = await evaluarRouting(muestra, ejecutarOro);
    expect(m.correctos).toBe(muestra.length);
    expect(m.noCubiertos).toBe(0);
    expect(m.misclasificaciones).toBe(0);
    expect(m.cobertura).toBe(1);
    expect(gatePasa(m)).toBe(true);
  });

  it("todas abstenciones (null) → 0 cobertura pero 0 errores (abstención NO es error)", async () => {
    const m = await evaluarRouting(muestra, ejecutarAbstiene);
    expect(m.correctos).toBe(0);
    expect(m.noCubiertos).toBe(muestra.length);
    expect(m.misclasificaciones).toBe(0); // abstención NUNCA cuenta como error
    expect(m.cobertura).toBe(0);
    expect(m.cobertura).toBeLessThan(COBERTURA_MIN);
    expect(gatePasa(m)).toBe(false); // por baja cobertura, NO por errores
  });

  it("un caso enrutado a otra tarea → error que FALLA el gate aunque la cobertura sea alta", async () => {
    const objetivo = muestra[0]!;
    const tareaDistinta = objetivo.label === "clasificacion" ? "extraccion" : "clasificacion";
    const ejecutar = (caso: CasoRouting): Promise<RoutingEtiqueta> =>
      Promise.resolve(caso.id === objetivo.id ? tareaDistinta : caso.label);
    const m = await evaluarRouting(muestra, ejecutar);
    expect(m.misclasificaciones).toBe(1);
    expect(m.errores).toBe(1);
    expect(m.cobertura).toBeGreaterThanOrEqual(COBERTURA_MIN); // resto correcto = alta cobertura
    expect(gatePasa(m)).toBe(false); // …pero el error la hace FALLAR
  });
});

// ── META-TEST: el gate PUEDE fallar (adversario aislado, no teatro) ──
describe("routing — meta-test: el gate PUEDE fallar (adversario aislado)", () => {
  it("existe al menos un caso adversario aislado", () => {
    expect(GOLDEN_SET_ADVERSARIO.length).toBeGreaterThanOrEqual(1);
  });

  it("un mock que enruta el adversario a la tarea equivocada hace gatePasa === false", async () => {
    const adversario = GOLDEN_SET_ADVERSARIO[0]!;
    const tareaMala = adversario.label === "clasificacion" ? "extraccion" : "clasificacion";
    const ejecutar = (caso: CasoRouting): Promise<RoutingEtiqueta> =>
      Promise.resolve(caso.id === adversario.id ? tareaMala : caso.label);
    const m = await evaluarRouting(GOLDEN_SET_GATE, ejecutar);
    expect(m.errores).toBeGreaterThanOrEqual(1);
    expect(gatePasa(m)).toBe(false); // la rama de fallo ES alcanzable → métrica viva
  });
});
