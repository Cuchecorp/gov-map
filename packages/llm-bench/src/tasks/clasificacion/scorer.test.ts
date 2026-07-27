/**
 * GATE DE CALIDAD de la clasificación de sector (BENCH-02) — mock, sin red.
 *
 * Espeja el contrato de cruces golden-set.test.ts: 3 casos de behavior + meta-test
 * adversario aislado ("el gate PUEDE fallar"). Scoring single-label top-1 + abstención
 * (idéntico a cruces sector: correcto/no-cubierto/misclasificación).
 */
import { describe, it, expect } from "vitest";
import {
  GOLDEN_SET_CLASIF,
  GOLDEN_SET_GATE_CLASIF,
  GOLDEN_SET_ADVERSARIO_CLASIF,
  SECTOR_CODIGOS,
  COBERTURA_MIN_CLASIF,
  evaluarClasificacion,
  gatePasaClasif,
  type CasoClasificacion,
  type SectorEtiqueta,
} from "./scorer";

/** Mock "oro": cada caso devuelve su propio sector esperado (clasificador perfecto). */
const ejecutarOro = (caso: CasoClasificacion): Promise<SectorEtiqueta> =>
  Promise.resolve(caso.sector_codigo);

/** Mock que abstiene siempre (todo → null). */
const ejecutarAbstiene = (): Promise<SectorEtiqueta> => Promise.resolve(null);

/** Un sector distinto al esperado (para forzar misclasificación). */
const otroSector = (s: SectorEtiqueta): SectorEtiqueta =>
  s === "salud" ? "educacion" : "salud";

describe("clasificación — estructura del set", () => {
  it("tiene ≥35 casos y al menos una abstención esperada (sector null)", () => {
    expect(GOLDEN_SET_CLASIF.length).toBeGreaterThanOrEqual(35);
    expect(GOLDEN_SET_CLASIF.some((c) => c.sector_codigo === null)).toBe(true);
  });

  it("la muestra del gate tiene casos, todos con sector no-null", () => {
    expect(GOLDEN_SET_GATE_CLASIF.length).toBeGreaterThanOrEqual(1);
    expect(GOLDEN_SET_GATE_CLASIF.every((c) => c.sector_codigo !== null)).toBe(true);
  });

  it("todo sector de oro pertenece a la taxonomía LOCKED (13 códigos, sin 'otros')", () => {
    expect(SECTOR_CODIGOS).toHaveLength(13);
    expect(SECTOR_CODIGOS).not.toContain("otros");
    for (const c of GOLDEN_SET_CLASIF) {
      if (c.sector_codigo !== null) {
        expect(SECTOR_CODIGOS).toContain(c.sector_codigo);
      }
    }
  });

  it("cubre ≥4 estratos y los ejes clave (scanned-pdf, archaic, long, negacion)", () => {
    const estratos = new Set(GOLDEN_SET_CLASIF.map((c) => c.estrato));
    expect(estratos.size).toBeGreaterThanOrEqual(4);
    const todos = GOLDEN_SET_CLASIF.map((c) => c.estrato).join("|");
    for (const eje of ["scanned-pdf", "archaic", "long", "negacion"]) {
      expect(todos).toContain(eje);
    }
  });
});

// ── BEHAVIOR (contrato del scoring): los 3 casos ──
describe("clasificación — scoring single-label top-1 + abstención (behavior)", () => {
  const muestra = GOLDEN_SET_GATE_CLASIF;

  it("todos correctos → cobertura 1, 0 errores → gate PASA", async () => {
    const m = await evaluarClasificacion(muestra, ejecutarOro);
    expect(m.correctos).toBe(muestra.length);
    expect(m.noCubiertos).toBe(0);
    expect(m.misclasificaciones).toBe(0);
    expect(m.cobertura).toBe(1);
    expect(gatePasaClasif(m)).toBe(true);
  });

  it("todas abstenciones (null) → 0 cobertura pero 0 errores (abstención NO es error)", async () => {
    const m = await evaluarClasificacion(muestra, ejecutarAbstiene);
    expect(m.correctos).toBe(0);
    expect(m.noCubiertos).toBe(muestra.length);
    expect(m.misclasificaciones).toBe(0);
    expect(m.cobertura).toBe(0);
    expect(m.cobertura).toBeLessThan(COBERTURA_MIN_CLASIF);
    expect(gatePasaClasif(m)).toBe(false); // por baja cobertura, NO por errores
  });

  it("un caso con sector distinto → error que FALLA el gate aunque la cobertura sea alta", async () => {
    const objetivo = muestra[0]!;
    const ejecutar = (caso: CasoClasificacion): Promise<SectorEtiqueta> =>
      Promise.resolve(caso.id === objetivo.id ? otroSector(caso.sector_codigo) : caso.sector_codigo);
    const m = await evaluarClasificacion(muestra, ejecutar);
    expect(m.misclasificaciones).toBe(1);
    expect(m.errores).toBe(1);
    expect(m.cobertura).toBeGreaterThanOrEqual(COBERTURA_MIN_CLASIF);
    expect(gatePasaClasif(m)).toBe(false);
  });
});

// ── META-TEST: el gate PUEDE fallar (adversario aislado) ──
describe("clasificación — meta-test: el gate PUEDE fallar (adversario aislado)", () => {
  it("existe al menos un caso adversario aislado", () => {
    expect(GOLDEN_SET_ADVERSARIO_CLASIF.length).toBeGreaterThanOrEqual(1);
  });

  it("un mock que clasifica mal el adversario hace gatePasaClasif === false", async () => {
    const adversario = GOLDEN_SET_ADVERSARIO_CLASIF[0]!;
    const ejecutar = (caso: CasoClasificacion): Promise<SectorEtiqueta> =>
      Promise.resolve(
        caso.id === adversario.id ? otroSector(caso.sector_codigo) : caso.sector_codigo,
      );
    const m = await evaluarClasificacion(GOLDEN_SET_GATE_CLASIF, ejecutar);
    expect(m.errores).toBeGreaterThanOrEqual(1);
    expect(gatePasaClasif(m)).toBe(false);
  });
});
