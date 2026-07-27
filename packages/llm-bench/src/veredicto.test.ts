/**
 * VEREDICTO por tarea (107-02, BENCH-05) — máquina PURA, fixtures sintéticos, sin red.
 *
 * Cubre las conductas load-bearing: approves-on-parity, incumbent-stays, "nada aprueba paridad",
 * VETO DURO es-CL (via negacion.accuracy INDEPENDIENTE de value.precision), pending-evidence, y
 * el gate de tasa-de-fallo (parity de calidad + peor structured_output_fail_rate → incumbente).
 */
import { describe, it, expect } from "vitest";
import {
  computarVeredicto,
  computarVeredictoDeReporte,
  escalarDeCalidad,
  EPSILON_POR_TAREA,
  type Veredicto,
} from "./veredicto";
import type { MetricasModelo, Reporte, TaskId } from "./report";
import type { MetricasExtraccion } from "./tasks/extraccion/scorer";

// ── Fábricas de métricas sintéticas (no red, no scorer real) ──

function metricaExtraccion(precision: number, recall: number, negAcc: number): MetricasExtraccion {
  return {
    schema_parse_rate: 1,
    value: { tp: 10, fp: 0, fn: 0, precision, recall },
    negacion: { total: 4, correctas: Math.round(negAcc * 4), accuracy: negAcc },
    detalle: [],
  };
}

interface OverridesModelo {
  modelo?: string;
  routingCobertura?: number;
  clasifCobertura?: number;
  juezRecall?: number;
  extraccion?: MetricasExtraccion | undefined;
  omitirRouting?: boolean;
  structured_output_fail_rate?: number;
  zod_repaired?: number;
  zod_terminal?: number;
}

function modelo(o: OverridesModelo = {}): MetricasModelo {
  const calidad: Partial<Record<TaskId, unknown>> = {
    clasificacion: { total: 10, correctos: 9, noCubiertos: 1, misclasificaciones: 0, cobertura: o.clasifCobertura ?? 0.9, errores: 0, detalle: [] },
    juez: { n: 10, precision_ok: 0.9, recall_rechazo: o.juezRecall ?? 0.8, conteos: { okYCorrecta: 5, ok: 5, rechazoYMala: 4, malas: 5, sinVeredicto: 0 }, hooks: { porProductor: {}, porLongitud: { corta: { ok: 0, total: 0 }, larga: { ok: 0, total: 0 } } }, detalle: [] },
    extraccion: "extraccion" in o ? o.extraccion : metricaExtraccion(0.97, 0.85, 1),
  };
  if (!o.omitirRouting) {
    calidad.routing = { total: 10, correctos: 8, noCubiertos: 2, misclasificaciones: 0, cobertura: o.routingCobertura ?? 0.8, errores: 0, detalle: [] };
  }
  return {
    modelo: o.modelo ?? "candidato-x",
    endpoint: "https://example.test",
    tarifaFecha: "2026-07-26",
    calidad_por_tarea: calidad,
    latencia_p50_ms: 100,
    latencia_p95_ms: 200,
    p95Indicativo: true,
    n_muestras: 40,
    n_casos: 40,
    costo_por_1k: 1,
    costo_por_1k_llamadas: 1,
    zod_fail_rate: { repaired: o.zod_repaired ?? 0.05, terminal: o.zod_terminal ?? 0.0 },
    structured_output_fail_rate: o.structured_output_fail_rate ?? 0.02,
  };
}

const incumbente = modelo({ modelo: "incumbente" });

describe("veredicto — ε explícita y justificada por métrica", () => {
  it("EPSILON_POR_TAREA tiene una ε por tarea y la de extracción es la más estricta", () => {
    expect(EPSILON_POR_TAREA.routing).toBeGreaterThan(0);
    expect(EPSILON_POR_TAREA.clasificacion).toBeGreaterThan(0);
    expect(EPSILON_POR_TAREA.juez).toBeGreaterThan(0);
    expect(EPSILON_POR_TAREA.extraccion).toBeGreaterThan(0);
    // La fidelidad literal legal es-CL es lo más caro de perder → ε más estricta.
    expect(EPSILON_POR_TAREA.extraccion).toBeLessThanOrEqual(EPSILON_POR_TAREA.routing);
    expect(EPSILON_POR_TAREA.extraccion).toBeLessThanOrEqual(EPSILON_POR_TAREA.juez);
  });
});

describe("veredicto — approves-on-parity", () => {
  it("un candidato dentro de ε en todas las tareas (empatado con el incumbente) → approved-model", () => {
    const cand = modelo({ modelo: "candidato-paridad" }); // idéntico al incumbente
    const v = computarVeredicto(cand, incumbente);
    for (const task of ["routing", "clasificacion", "juez", "extraccion"] as TaskId[]) {
      expect(v[task].estado).toBe("approved-model");
      expect(v[task].modelo).toBe("candidato-paridad");
    }
  });
});

describe("veredicto — incumbent-stays (calidad peor que ε)", () => {
  it("un candidato peor por más de ε en routing → incumbent-stays en esa tarea", () => {
    const cand = modelo({ modelo: "peor", routingCobertura: 0.8 - EPSILON_POR_TAREA.routing - 0.05 });
    const v = computarVeredicto(cand, incumbente);
    expect(v.routing.estado).toBe("incumbent-stays");
  });
});

describe("veredicto — nada aprueba paridad", () => {
  it("un reporte donde NINGÚN candidato alcanza ε en NINGUNA tarea → todo incumbent-stays", () => {
    // Candidato uniformemente peor por mucho más que ε en cada eje.
    const flojo = modelo({
      modelo: "flojo",
      routingCobertura: 0.4,
      clasifCobertura: 0.4,
      juezRecall: 0.1,
      extraccion: metricaExtraccion(0.5, 0.4, 1), // negación OK, pero agregado hundido
    });
    const reporte: Reporte = { fecha: "2026-07-27", pricingFecha: "2026-07-26", modelos: [incumbente, flojo] };
    const porModelo = computarVeredictoDeReporte(reporte, "incumbente");
    const v: Veredicto = porModelo["flojo"]!;
    // "nada aprueba paridad" es un resultado válido, no un error: todo el candidato se queda fuera.
    for (const task of ["routing", "clasificacion", "juez", "extraccion"] as TaskId[]) {
      expect(v[task].estado).toBe("incumbent-stays");
    }
  });
});

describe("veredicto — VETO DURO es-CL (via negacion.accuracy, INDEPENDIENTE de value.precision)", () => {
  it("candidato con MEJOR precisión/recall agregado pero PEOR negacion.accuracy → VETADO en extracción", () => {
    // El incumbente: precisión/recall modestos, negación PERFECTA.
    const inc = modelo({ modelo: "inc-neg-alta", extraccion: metricaExtraccion(0.90, 0.80, 1.0) });
    // El candidato: precisión/recall ESTRICTAMENTE MEJORES, pero negación es-CL PEOR.
    const cand = modelo({ modelo: "cand-neg-baja", extraccion: metricaExtraccion(0.99, 0.95, 0.5) });
    // Sanidad: el agregado del candidato es genuinamente mejor (probaría que el veto NO viene de ahí).
    const eCand = cand.calidad_por_tarea.extraccion as MetricasExtraccion;
    const eInc = inc.calidad_por_tarea.extraccion as MetricasExtraccion;
    expect(eCand.value.precision).toBeGreaterThan(eInc.value.precision);
    expect(eCand.value.recall).toBeGreaterThan(eInc.value.recall);
    expect(eCand.negacion.accuracy).toBeLessThan(eInc.negacion.accuracy);

    const v = computarVeredicto(cand, inc);
    expect(v.extraccion.estado).toBe("incumbent-stays");
    // La razón cita el veto de negación es-CL, NO el gate agregado (cortocircuito).
    expect(v.extraccion.razon).toContain("es-CL negation veto");
    expect(v.extraccion.razon).toContain("negacion.accuracy");
  });

  it("candidato con negacion.accuracy IGUAL o MEJOR NO es vetado (el veto solo dispara por déficit)", () => {
    const inc = modelo({ modelo: "inc", extraccion: metricaExtraccion(0.90, 0.80, 0.9) });
    const cand = modelo({ modelo: "cand", extraccion: metricaExtraccion(0.91, 0.81, 0.95) });
    const v = computarVeredicto(cand, inc);
    expect(v.extraccion.razon).not.toContain("es-CL negation veto");
  });
});

describe("veredicto — pending-evidence (sin números vivos)", () => {
  it("una métrica por tarea ausente → pending-evidence, NUNCA approved", () => {
    const cand = modelo({ modelo: "sin-routing", omitirRouting: true });
    const v = computarVeredicto(cand, incumbente);
    expect(v.routing.estado).toBe("pending-evidence");
    expect(v.routing.modelo).toBeUndefined();
    // Las demás tareas (con números) resuelven normalmente.
    expect(v.extraccion.estado).not.toBe("pending-evidence");
  });
});

describe("veredicto — tasa de fallo es gate de primera clase", () => {
  it("paridad de calidad pero PEOR structured_output_fail_rate → incumbent-stays", () => {
    const cand = modelo({ modelo: "fallo-peor", structured_output_fail_rate: incumbente.structured_output_fail_rate + 0.1 });
    const v = computarVeredicto(cand, incumbente);
    // La calidad empata (mismos escalares), pero la peor tasa de fallo bloquea la aprobación.
    expect(v.routing.estado).toBe("incumbent-stays");
    expect(v.clasificacion.estado).toBe("incumbent-stays");
    expect(v.routing.razon).toContain("tasa de fallo");
  });

  it("paridad de calidad pero PEOR zod_fail_rate.terminal → incumbent-stays", () => {
    const cand = modelo({ modelo: "zod-peor", zod_terminal: incumbente.zod_fail_rate.terminal + 0.2 });
    const v = computarVeredicto(cand, incumbente);
    expect(v.juez.estado).toBe("incumbent-stays");
  });
});

describe("veredicto — escalarDeCalidad fail-safe ante TaskId desconocido (WR-03)", () => {
  it("un TaskId futuro/desconocido → null (NO undefined) → el llamador lo trata como pending-evidence", () => {
    // Simula que se agregó una quinta tarea a `TaskId` sin actualizar el switch: el
    // default DEBE devolver `null`, jamás `undefined` (undefined → NaN → wrong incumbent-stays).
    const desconocida = "tarea-futura" as unknown as TaskId;
    const escalar = escalarDeCalidad(desconocida, { cobertura: 0.99 });
    expect(escalar).toBeNull();
    expect(escalar).not.toBeUndefined();
  });
});
