/**
 * plural.test.ts — helper general de concordancia de número (es-CL).
 *
 * Phase 129 / D-06: los moldes del panel emitían `1 citaciones del Senado`,
 * `1 proyectos con Suma`, `1 abstenciones`, `1 pareos`. La regla es una sola y
 * no admite heurística morfológica: `citación → citaciones` lleva tilde y
 * ningún sufijo genérico la acierta, así que AMBAS formas van explícitas.
 */
import { describe, it, expect } from "vitest";

import { plural } from "./plural";

describe("plural(n, singular, pluralForma)", () => {
  it("n=1 → singular", () => {
    expect(plural(1, "citación", "citaciones")).toBe("citación");
    expect(plural(1, "proyecto", "proyectos")).toBe("proyecto");
    expect(plural(1, "abstención", "abstenciones")).toBe("abstención");
    expect(plural(1, "pareo", "pareos")).toBe("pareo");
  });

  it("n=0 → plural (el cero es plural en es-CL)", () => {
    expect(plural(0, "citación", "citaciones")).toBe("citaciones");
    expect(plural(0, "proyecto", "proyectos")).toBe("proyectos");
  });

  it("n=2 → plural", () => {
    expect(plural(2, "citación", "citaciones")).toBe("citaciones");
    expect(plural(23, "citación", "citaciones")).toBe("citaciones");
    expect(plural(42, "proyecto", "proyectos")).toBe("proyectos");
  });

  it("la tilde NO se pierde: el singular se devuelve verbatim", () => {
    // Control anti-heurística: una regla de sufijo (`-es`/`-s`) produciría
    // `citacion` o `citaciónes`. Aquí el literal viaja tal cual lo pasa el molde.
    expect(plural(1, "citación", "citaciones")).toContain("ó");
    expect(plural(1, "abstención", "abstenciones")).toContain("ó");
  });

  it("n negativo o fraccionario NO es 1 ⇒ plural (sin caso especial oculto)", () => {
    expect(plural(-1, "proyecto", "proyectos")).toBe("proyectos");
    expect(plural(1.5, "proyecto", "proyectos")).toBe("proyectos");
  });
});
