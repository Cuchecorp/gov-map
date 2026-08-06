// taxonomia.test.ts — verifica la taxonomía firmada D-133-A2: 6 clases, precedencia en el
// orden del array, enrutamiento, glosas no vacías, ausencia de agenda_ejecutivo, congelación
// profunda y ausencia de la cláusula eliminada de ley_vigente.
import { describe, expect, it } from "vitest";
import { ETIQUETAS, TAXONOMIA, type Etiqueta } from "./taxonomia.js";

describe("TAXONOMIA", () => {
  it("tiene 6 entradas", () => {
    expect(TAXONOMIA).toHaveLength(6);
  });

  it("el orden de etiquetas es el de precedencia LOCKED", () => {
    const orden: Etiqueta[] = [
      "tramitacion_legislativa",
      "actividad_parlamentaria",
      "ley_vigente",
      "politica_no_legislativa",
      "no_legislativa",
      "ambiguo",
    ];
    expect(TAXONOMIA.map((c) => c.etiqueta)).toEqual(orden);
    expect(ETIQUETAS).toEqual(orden);
  });

  it("agenda_ejecutivo no aparece", () => {
    expect(TAXONOMIA.map((c) => c.etiqueta)).not.toContain("agenda_ejecutivo");
  });

  it("enruta_a mapea las 6 clases", () => {
    const porEtiqueta = Object.fromEntries(TAXONOMIA.map((c) => [c.etiqueta, c.enruta_a]));
    expect(porEtiqueta.tramitacion_legislativa).toBe("proyecto");
    expect(porEtiqueta.ley_vigente).toBe("proyecto");
    expect(porEtiqueta.actividad_parlamentaria).toBe("persona");
    expect(porEtiqueta.politica_no_legislativa).toBe("ninguna");
    expect(porEtiqueta.no_legislativa).toBe("ninguna");
    expect(porEtiqueta.ambiguo).toBe("ninguna");
  });

  it("ninguna glosa vacía", () => {
    for (const clase of TAXONOMIA) {
      expect(clase.definicion.length).toBeGreaterThan(0);
      expect(clase.marca_decisoria.length).toBeGreaterThan(0);
      expect(clase.frontera.length).toBeGreaterThan(0);
    }
  });

  it("mutar TAXONOMIA[0].etiqueta LANZA", () => {
    expect(() => {
      (TAXONOMIA[0] as { etiqueta: string }).etiqueta = "x";
    }).toThrow();
  });

  it("ley_vigente.frontera no contiene 'modificación en trámite'", () => {
    const leyVigente = TAXONOMIA.find((c) => c.etiqueta === "ley_vigente");
    expect(leyVigente).toBeDefined();
    expect(leyVigente?.frontera).not.toContain("modificación en trámite");
  });
});
