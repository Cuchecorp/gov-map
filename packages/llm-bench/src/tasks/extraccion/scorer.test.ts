/**
 * GATE DE CALIDAD de paridad-extracción (BENCH-02) — mock, sin red.
 *
 * Prueba el contrato que separa DOS ejes (Cleanlab):
 *   1. schema_parse_rate (¿parseó+validó el payload?) SEPARADO de value-accuracy.
 *   2. value.{precision,recall} = fidelidad literal por substring.
 * Más: una NEGACIÓN caída puntúa como fp, y el meta-test adversario aislado prueba que
 * `gatePasaExtraccion` PUEDE devolver false (fabricación real → precisión baja).
 */
import { describe, it, expect } from "vitest";
import {
  GOLDEN_SET_EXTRACCION,
  GOLDEN_SET_GATE_EXTRACCION,
  GOLDEN_SET_ADVERSARIO_EXTRACCION,
  evaluarExtraccion,
  gatePasaExtraccion,
  normalizarLiteral,
  type CasoExtraccion,
  type RespuestaExtraccion,
} from "./scorer";

/** Mock "oro": devuelve, por caso, exactamente su etiqueta esperada (extracción perfecta). */
const ejecutarOro = (caso: CasoExtraccion): Promise<RespuestaExtraccion> =>
  Promise.resolve({
    idea_matriz: caso.expected.idea_matriz_substring,
    cuerpos_legales: caso.expected.cuerpos,
  });

describe("extracción — estructura del set", () => {
  it("tiene ≥35 casos", () => {
    expect(GOLDEN_SET_EXTRACCION.length).toBeGreaterThanOrEqual(35);
  });

  it("la muestra del gate excluye los adversarios inyectados", () => {
    const adv = new Set(GOLDEN_SET_ADVERSARIO_EXTRACCION.map((c) => c.id));
    expect(GOLDEN_SET_GATE_EXTRACCION.every((c) => !adv.has(c.id))).toBe(true);
    expect(GOLDEN_SET_ADVERSARIO_EXTRACCION.length).toBeGreaterThanOrEqual(2);
  });

  it("cubre los ejes de estratificación (scanned-pdf, archaic, long, bcn, negacion)", () => {
    const todos = GOLDEN_SET_EXTRACCION.map((c) => c.estrato).join("|");
    for (const eje of ["scanned-pdf", "archaic", "long", "bcn", "negacion"]) {
      expect(todos).toContain(eje);
    }
  });

  it("tiene ≥2 casos con negación load-bearing", () => {
    const conNegacion = GOLDEN_SET_EXTRACCION.filter((c) => c.estrato.includes("negacion"));
    expect(conNegacion.length).toBeGreaterThanOrEqual(2);
  });
});

// ── BEHAVIOR: schema-parse-rate SEPARADO de value-accuracy (Cleanlab) ──
describe("extracción — parse-rate SEPARADO de value-accuracy", () => {
  const muestra = GOLDEN_SET_GATE_EXTRACCION;

  it("mock oro → parse-rate 1 y precisión/recall 1 → gate PASA", async () => {
    const m = await evaluarExtraccion(muestra, ejecutarOro);
    expect(m.schema_parse_rate).toBe(1);
    expect(m.value.precision).toBe(1);
    expect(m.value.recall).toBe(1);
    expect(gatePasaExtraccion(m)).toBe(true);
  });

  it("100%-parse / valores FABRICADOS → parse-rate ALTO Y value-precision BAJA (nunca un solo número)", async () => {
    // El modelo SIEMPRE devuelve un payload válido (parsea), pero inventa una idea que el texto
    // no dice. Prueba la separación: parse-rate se mantiene alto mientras la precisión cae.
    const ejecutarFabrica = (caso: CasoExtraccion): Promise<RespuestaExtraccion> =>
      Promise.resolve({
        idea_matriz: "una idea matriz fluida y totalmente inventada que el texto jamas enuncio",
        cuerpos_legales: [],
      });
    const m = await evaluarExtraccion(muestra, ejecutarFabrica);
    expect(m.schema_parse_rate).toBe(1); // parseó el 100%
    expect(m.value.precision).toBeLessThan(0.5); // …pero fabricó → precisión hundida
    expect(gatePasaExtraccion(m)).toBe(false);
  });

  it("payload que NO parsea (null) baja parse-rate SIN contaminar value con ceros", async () => {
    // Un caso devuelve null (structured-output fail); el resto es oro.
    const objetivo = muestra[0]!;
    const ejecutar = (caso: CasoExtraccion): Promise<RespuestaExtraccion | null> =>
      caso.id === objetivo.id
        ? Promise.resolve(null)
        : ejecutarOro(caso);
    const m = await evaluarExtraccion(muestra, ejecutar);
    expect(m.schema_parse_rate).toBeLessThan(1); // el null bajó parse-rate
    expect(m.value.precision).toBe(1); // …y la value-accuracy del resto sigue perfecta
  });
});

// ── BEHAVIOR: negación es-CL load-bearing ──
describe("extracción — negación caída puntúa como fp", () => {
  it("una respuesta que DEJA CAER el 'no' de una idea negativa cuenta como falso positivo", async () => {
    const negativo = GOLDEN_SET_GATE_EXTRACCION.find(
      (c) => c.estrato.includes("negacion") && c.expected.idea_matriz_substring !== null,
    )!;
    expect(negativo).toBeDefined();
    // El modelo INVIERTE el sentido: reemplaza la negación por su afirmación ("no será
    // aplicable" → "sí será aplicable"). El texto fuente NO contiene esa forma → NO substring → fp.
    const sinNegacion = negativo.expected.idea_matriz_substring!.replace(/\bno\b/, "sí");
    expect(sinNegacion).not.toEqual(negativo.expected.idea_matriz_substring);
    // Sanity: la variante con la negación invertida YA NO es substring del texto fuente.
    expect(normalizarLiteral(negativo.textoFuente).includes(normalizarLiteral(sinNegacion))).toBe(false);
    const ejecutar = (caso: CasoExtraccion): Promise<RespuestaExtraccion> =>
      Promise.resolve(
        caso.id === negativo.id
          ? { idea_matriz: sinNegacion, cuerpos_legales: caso.expected.cuerpos }
          : { idea_matriz: caso.expected.idea_matriz_substring, cuerpos_legales: caso.expected.cuerpos },
      );
    const m = await evaluarExtraccion([negativo], ejecutar);
    expect(m.value.fp).toBeGreaterThanOrEqual(1);
    expect(m.detalle[0]!.ok).toBe(false);
  });
});

// ── BEHAVIOR (Task 0): sub-métrica es-CL `negacion` PRIMERA CLASE, INDEPENDIENTE de value.precision ──
describe("extracción — sub-métrica es-CL `negacion` (aditiva, separada de value.precision)", () => {
  const casosNegacion = (set: CasoExtraccion[]) =>
    set.filter((c) => c.estrato.split("|").includes("negacion"));

  it("negacion.total == #casos cuyo estrato contiene 'negacion'; accuracy en [0,1] (mock oro)", async () => {
    const m = await evaluarExtraccion(GOLDEN_SET_GATE_EXTRACCION, ejecutarOro);
    expect(m.negacion.total).toBe(casosNegacion(GOLDEN_SET_GATE_EXTRACCION).length);
    expect(m.negacion.total).toBeGreaterThanOrEqual(1); // hay casos de negación en la muestra del gate
    expect(m.negacion.accuracy).toBeGreaterThanOrEqual(0);
    expect(m.negacion.accuracy).toBeLessThanOrEqual(1);
  });

  it("mock oro → negacion.accuracy === 1 (todas las negaciones preservadas literalmente)", async () => {
    const m = await evaluarExtraccion(GOLDEN_SET_GATE_EXTRACCION, ejecutarOro);
    expect(m.negacion.accuracy).toBe(1);
    expect(m.negacion.correctas).toBe(m.negacion.total);
  });

  it("un mock que DEJA CAER la negación baja negacion.accuracy < 1, LEÍBLE sin tocar value.precision", async () => {
    // Solo la muestra del gate. El mock invierte el "no" en TODOS los casos de negación (idea
    // afirmada deja de ser substring literal), pero es ORO en el resto (no-negación perfecto).
    const negacionIds = new Set(casosNegacion(GOLDEN_SET_GATE_EXTRACCION).map((c) => c.id));
    const ejecutarDejaCaerNegacion = (caso: CasoExtraccion): Promise<RespuestaExtraccion> => {
      if (negacionIds.has(caso.id) && caso.expected.idea_matriz_substring !== null) {
        // Invierte la negación: "no" → "sí" → ya NO es substring del texto fuente → idea incorrecta.
        return Promise.resolve({
          idea_matriz: caso.expected.idea_matriz_substring.replace(/\bno\b/, "sí"),
          cuerpos_legales: caso.expected.cuerpos,
        });
      }
      return ejecutarOro(caso);
    };
    const m = await evaluarExtraccion(GOLDEN_SET_GATE_EXTRACCION, ejecutarDejaCaerNegacion);
    // La sub-métrica de negación cae, LEÍDA como campo separado (sin consultar value.precision).
    expect(m.negacion.accuracy).toBeLessThan(1);
    expect(m.negacion.correctas).toBeLessThan(m.negacion.total);
    expect(m.negacion).toHaveProperty("total");
    expect(m.negacion).toHaveProperty("correctas");
    expect(m.negacion).toHaveProperty("accuracy");
  });

  it("negacion es un campo SEPARADO: value/schema_parse_rate/detalle intactos bajo mock oro", async () => {
    const m = await evaluarExtraccion(GOLDEN_SET_GATE_EXTRACCION, ejecutarOro);
    // Los tres campos 106 siguen exactamente como antes (extracción perfecta).
    expect(m.schema_parse_rate).toBe(1);
    expect(m.value.precision).toBe(1);
    expect(m.value.recall).toBe(1);
    expect(Array.isArray(m.detalle)).toBe(true);
    // …y `negacion` existe adicionalmente, sin colisionar con `value`.
    expect(m.negacion).not.toBe(m.value);
  });

  it("set sin casos de negación → negacion.total === 0 y accuracy === 1 (convención vacío)", async () => {
    const sinNegacion = GOLDEN_SET_GATE_EXTRACCION.filter(
      (c) => !c.estrato.split("|").includes("negacion"),
    );
    const m = await evaluarExtraccion(sinNegacion, ejecutarOro);
    expect(m.negacion.total).toBe(0);
    expect(m.negacion.accuracy).toBe(1);
  });
});

// ── META-TEST: el gate PUEDE fallar (adversario aislado, no teatro) ──
describe("extracción — meta-test: el gate PUEDE fallar (adversario aislado)", () => {
  it("existen ≥2 casos adversarios aislados", () => {
    expect(GOLDEN_SET_ADVERSARIO_EXTRACCION.length).toBeGreaterThanOrEqual(2);
  });

  it("el mock que FABRICA la salida adversaria hace gatePasaExtraccion === false", async () => {
    // Sobre el adversario e01 (texto solo-articulado, expected null) el modelo inventa una idea.
    const ejecutarAdversario = (caso: CasoExtraccion): Promise<RespuestaExtraccion> => {
      if (caso.id === "adv01-idea-fabricada-extraccion") {
        return Promise.resolve({
          idea_matriz: "el proyecto busca proteger a los consumidores frente a los abusos del mercado",
          cuerpos_legales: [],
        });
      }
      if (caso.id === "adv02-negacion-caida-extraccion") {
        // Deja caer la negación → invierte el sentido → fp.
        return Promise.resolve({
          idea_matriz: "será aplicable la prescripción a los delitos de lesa humanidad",
          cuerpos_legales: [],
        });
      }
      return ejecutarOro(caso);
    };
    const m = await evaluarExtraccion(GOLDEN_SET_ADVERSARIO_EXTRACCION, ejecutarAdversario);
    expect(m.value.fp).toBeGreaterThanOrEqual(1);
    expect(gatePasaExtraccion(m)).toBe(false); // la rama de fallo ES alcanzable → métrica viva
  });
});
