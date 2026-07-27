/**
 * HARNESS DRIVER (106-04, Task 1) — CI, sin red.
 *
 * Prueba que `correrHarness` drive un `LLMProvider` (mock determinista) por las CUATRO golden
 * GATE sets y produce UN `MetricasModelo` con cada métrica SEPARADA de primera clase; que las
 * cuatro golden gates PASAN bajo un mock perfecto (piso de regresión mock); que un `Reporte`
 * "nada aprueba paridad" es construible; y que el MISMO harness corre sin cambios con DOS
 * providers distintos (host-agnóstico). NUNCA toca red.
 */
import { describe, it, expect } from "vitest";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import { parseAndValidate } from "@obs/llm";
import type { ZodType } from "zod";

import { MockProvider } from "./mock-provider";
import type { CallMetric } from "./instrument";
import { correrHarness, construirReporte } from "./harness";
import { gatePasaRouting } from "./tasks/routing/scorer";
import { gatePasaClasif } from "./tasks/clasificacion/scorer";
import { gatePasaExtraccion } from "./tasks/extraccion/scorer";
import {
  GOLDEN_SET_GATE_ROUTING,
} from "./tasks/routing/scorer";
import { GOLDEN_SET_GATE_CLASIF } from "./tasks/clasificacion/scorer";
import { GOLDEN_SET_GATE_EXTRACCION } from "./tasks/extraccion/scorer";
import { GOLDEN_SET_SCORING_JUEZ } from "./tasks/juez/scorer";
import type { MetricasRouting } from "./tasks/routing/scorer";
import type { MetricasClasificacion } from "./tasks/clasificacion/scorer";
import type { MetricasExtraccion } from "./tasks/extraccion/scorer";
import type { MetricasJuez } from "./tasks/juez/scorer";

/**
 * Un responder ORO: mira el schema pedido y el prompt para devolver la respuesta CORRECTA de
 * cada caso, buscando el caso en el golden por contención del input en el prompt. Un mock
 * "perfecto" que hace pasar las cuatro gates (piso de regresión).
 */
function responderOro(req: CompletionRequest, schema: ZodType<unknown>): unknown {
  const shape = Object.keys((schema as unknown as { shape?: object }).shape ?? {});

  // routing: { label }
  if (shape.includes("label")) {
    const caso = GOLDEN_SET_GATE_ROUTING.find((c) => req.user.includes(c.input));
    return { label: caso?.label ?? null };
  }
  // clasificación: { sector_codigo }
  if (shape.includes("sector_codigo")) {
    const caso = GOLDEN_SET_GATE_CLASIF.find((c) => req.user.includes(c.input));
    return { sector_codigo: caso?.sector_codigo ?? null };
  }
  // extracción: { idea_matriz, cuerpos_legales }
  if (shape.includes("idea_matriz")) {
    const caso = GOLDEN_SET_GATE_EXTRACCION.find((c) =>
      req.user.includes(c.textoFuente),
    );
    return {
      idea_matriz: caso?.expected.idea_matriz_substring ?? null,
      cuerpos_legales: caso?.expected.cuerpos ?? [],
    };
  }
  // juez: { ok } — devuelve el human_label del caso (juez "perfecto" que concuerda con humano).
  if (shape.includes("ok")) {
    const caso = GOLDEN_SET_SCORING_JUEZ.find((c) => req.user.includes(c.answer));
    return { ok: caso?.human_label ?? false };
  }
  throw new Error(`responderOro: schema no reconocido (${shape.join(",")})`);
}

/** Crea un mock + su sink drenable, cableado como lo cablearía el harness. */
function mockConSink(
  responder: (req: CompletionRequest, schema: ZodType<unknown>) => unknown,
  opts: Partial<{ promptTokens: number; completionTokens: number; latencyMs: number }> = {},
) {
  const muestras: CallMetric[] = [];
  const provider = new MockProvider(responder, {
    sink: (m) => muestras.push(m),
    latencyMs: opts.latencyMs ?? 100,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
  });
  const drenarMetricas = (): CallMetric[] => muestras.slice();
  return { provider, drenarMetricas };
}

describe("harness — mock-provider (CI, sin red)", () => {
  it("MockProvider valida contra el schema y cuenta llamadas — nunca toca red", async () => {
    const { provider, drenarMetricas } = mockConSink(responderOro);
    await correrHarness(
      provider,
      { modelo: "bench-mock", endpoint: "mock://local" },
      { drenarMetricas },
    );
    expect(provider.callCount).toBeGreaterThan(0);
  });
});

describe("harness — correrHarness produce un MetricasModelo con métricas SEPARADAS", () => {
  it("todas las tareas en calidad_por_tarea + los campos separados presentes", async () => {
    const { provider, drenarMetricas } = mockConSink(responderOro);
    const m = await correrHarness(
      provider,
      { modelo: "deepseek-v4-flash", endpoint: "https://api.deepseek.com" },
      { drenarMetricas },
    );

    // Las cuatro tareas presentes, cada una en su forma nativa.
    expect(Object.keys(m.calidad_por_tarea).sort()).toEqual([
      "clasificacion",
      "extraccion",
      "juez",
      "routing",
    ]);

    // Las DOS fail-rates son campos SEPARADOS (Pitfall B): structured_output_fail_rate NO vive
    // dentro de zod_fail_rate.
    expect(m).toHaveProperty("structured_output_fail_rate");
    expect(m).toHaveProperty("zod_fail_rate.repaired");
    expect(m).toHaveProperty("zod_fail_rate.terminal");
    expect(
      (m.zod_fail_rate as unknown as { structured_output_fail_rate?: number })
        .structured_output_fail_rate,
    ).toBeUndefined();

    // Provenance estampada.
    expect(m.modelo).toBe("deepseek-v4-flash");
    expect(m.endpoint).toBe("https://api.deepseek.com");
    expect(m.tarifaFecha).toBe("2026-07-26");

    // Latencia p50/p95 + n_muestras.
    expect(m.n_muestras).toBeGreaterThan(0);
    expect(m.latencia_p50_ms).toBeGreaterThan(0);
    expect(m.latencia_p95_ms).toBeGreaterThanOrEqual(m.latencia_p50_ms);
    // p95Indicativo refleja el N real (true si < umbral small-N); es un booleano derivado, no fijo.
    expect(typeof m.p95Indicativo).toBe("boolean");
    expect(m.p95Indicativo).toBe(m.n_muestras < 60);

    // Costo con tarifa conocida + usage sintético presente → número (no null).
    expect(m.costo_por_1k).not.toBeNull();
    expect(m.costo_por_1k).toBeGreaterThan(0);
  });

  it("costo_por_1k es null cuando el host omite usage (nunca 0)", async () => {
    // Sin promptTokens/completionTokens → el mock emite usage undefined → costoUsd → null.
    const muestras: CallMetric[] = [];
    const provider = new MockProvider(responderOro, {
      sink: (m) => muestras.push({ latencyMs: m.latencyMs }), // usage omitido
      latencyMs: 100,
    });
    const m = await correrHarness(
      provider,
      { modelo: "deepseek-v4-flash", endpoint: "https://api.deepseek.com" },
      { drenarMetricas: () => muestras.slice() },
    );
    expect(m.costo_por_1k).toBeNull();
  });

  it("costo_por_1k es null cuando el modelo no tiene tarifa conocida (host sin tarifa)", async () => {
    const { provider, drenarMetricas } = mockConSink(responderOro);
    const m = await correrHarness(
      provider,
      { modelo: "modelo-sin-tarifa-107", endpoint: "https://candidato.example" },
      { drenarMetricas },
    );
    expect(m.costo_por_1k).toBeNull();
  });
});

describe("harness — las 4 golden GATE sets pasan bajo un mock perfecto (piso mock)", () => {
  it("cada gate (routing/clasif/extracción) PASA con el mock oro", async () => {
    const { provider, drenarMetricas } = mockConSink(responderOro);
    const m = await correrHarness(
      provider,
      { modelo: "bench-mock", endpoint: "mock://local" },
      { drenarMetricas },
    );
    const routing = m.calidad_por_tarea.routing as MetricasRouting;
    const clasif = m.calidad_por_tarea.clasificacion as MetricasClasificacion;
    const extraccion = m.calidad_por_tarea.extraccion as MetricasExtraccion;
    const juez = m.calidad_por_tarea.juez as MetricasJuez;

    expect(gatePasaRouting(routing)).toBe(true);
    expect(gatePasaClasif(clasif)).toBe(true);
    expect(gatePasaExtraccion(extraccion)).toBe(true);

    // Juez: no tiene gate booleano en 106, pero un juez-oro concuerda con el humano →
    // recall-de-rechazo alto (detecta las respuestas malas del split de scoring).
    expect(juez.recall_rechazo).not.toBeNull();
    expect(juez.recall_rechazo!).toBeGreaterThan(0);
  });
});

describe("harness — 'nada aprueba paridad' es construible + host-agnóstico", () => {
  it("un Reporte con cero modelos aprobados es un valor válido (no se fuerza aprobación)", async () => {
    // Un mock que SIEMPRE abstiene/rechaza → ningún gate pasa; el Reporte se construye igual.
    const responderMalo = (_req: CompletionRequest, schema: ZodType<unknown>): unknown => {
      const shape = Object.keys((schema as unknown as { shape?: object }).shape ?? {});
      if (shape.includes("label")) return { label: null };
      if (shape.includes("sector_codigo")) return { sector_codigo: null };
      if (shape.includes("idea_matriz")) return { idea_matriz: null, cuerpos_legales: [] };
      return { ok: false };
    };
    const { provider, drenarMetricas } = mockConSink(responderMalo);
    const m = await correrHarness(
      provider,
      { modelo: "bench-mock", endpoint: "mock://local" },
      { drenarMetricas },
    );
    const routing = m.calidad_por_tarea.routing as MetricasRouting;
    expect(gatePasaRouting(routing)).toBe(false);

    const reporte = construirReporte([m]);
    expect(reporte.modelos).toHaveLength(1);
    expect(reporte.pricingFecha).toBe("2026-07-26");
    expect(typeof reporte.fecha).toBe("string");
    // El Reporte no tiene ningún campo "aprobado": expresa los números, no un veredicto.
    expect(reporte.modelos[0]).not.toHaveProperty("aprobado");
  });

  it("el MISMO harness corre sin cambios con DOS providers distintos (host-agnóstico)", async () => {
    const a = mockConSink(responderOro);
    const ma = await correrHarness(
      a.provider,
      { modelo: "deepseek-v4-flash", endpoint: "https://api.deepseek.com" },
      { drenarMetricas: a.drenarMetricas },
    );
    const b = mockConSink(responderOro);
    const mb = await correrHarness(
      b.provider,
      { modelo: "MiniMax-M3", endpoint: "https://api.minimax.io/v1" },
      { drenarMetricas: b.drenarMetricas },
    );
    // Mismo driver, dos endpoints distintos correctamente estampados.
    expect(ma.endpoint).toBe("https://api.deepseek.com");
    expect(mb.endpoint).toBe("https://api.minimax.io/v1");
    // Ambos ejercitaron las cuatro tareas.
    expect(Object.keys(ma.calidad_por_tarea)).toHaveLength(4);
    expect(Object.keys(mb.calidad_por_tarea)).toHaveLength(4);
  });

  it("un mock que falla estructura reporta structured_output_fail_rate alto (no lo esconde)", async () => {
    // El responder LANZA para las llamadas de routing → structured-output-fail contabilizado.
    const responderFalla = (_req: CompletionRequest, schema: ZodType<unknown>): unknown => {
      const shape = Object.keys((schema as unknown as { shape?: object }).shape ?? {});
      if (shape.includes("label")) throw new Error("sin payload usable (structured-output fail)");
      if (shape.includes("sector_codigo")) return { sector_codigo: null };
      if (shape.includes("idea_matriz")) return { idea_matriz: null, cuerpos_legales: [] };
      return { ok: false };
    };
    const { provider, drenarMetricas } = mockConSink(responderFalla);
    const m = await correrHarness(
      provider,
      { modelo: "bench-mock", endpoint: "mock://local" },
      { drenarMetricas },
    );
    // Todas las llamadas de routing fallaron estructura → tasa > 0, VISIBLE en su campo separado.
    expect(m.structured_output_fail_rate).toBeGreaterThan(0);
  });
});

// ── CR-01: el driver RECUPERA el outcome real del repair loop (no lo sintetiza) ──
//
// Estos tests MUERDEN el bug corregido: el driver colapsaba todo éxito a "clean" (nunca
// zod-repaired) y todo LLMValidationError a "zod-terminal" (nunca structured-output-fail en el
// camino terminal). Para ejercitar el camino REAL, el provider de abajo corre el MISMO
// `parseAndValidate` de @obs/llm que corren DeepSeek/MiniMax — así emite `onValidationOutcome`
// exactamente como producción; el harness lo OBSERVA en vez de adivinar.

/** Tokens sintéticos por llamada (para que exista `n_muestras` sin red). */
function sinkSintetico(muestras: CallMetric[]) {
  return (_req?: unknown) => muestras.push({ latencyMs: 100, promptTokens: 10, completionTokens: 5 });
}

/**
 * Provider de test que drive el REPAIR LOOP real de @obs/llm. Para la tarea de routing (schema
 * `{ label }`) devuelve un GUION de respuestas crudas por intento (undefined = sin payload,
 * string = JSON crudo); para las otras tres tareas responde oro para que el harness complete.
 * Emite `onValidationOutcome` porque delega en `parseAndValidate` — igual que el adapter real.
 */
class ProviderRepairLoop implements LLMProvider {
  readonly id = "repair-loop-test";
  readonly trainsOnInputs = false;
  private idx = 0;
  constructor(
    /** Respuestas crudas por intento para la tarea de routing (undefined = sin payload). */
    private readonly guionRouting: (string | undefined)[],
    private readonly sink: () => void,
  ) {}

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    const shape = Object.keys((schema as unknown as { shape?: object }).shape ?? {});
    // Rama routing: corre el repair loop real sobre el guión.
    if (shape.includes("label")) {
      let attempt = 0;
      const next = (): string | undefined => {
        this.sink();
        const v = this.guionRouting[Math.min(attempt, this.guionRouting.length - 1)];
        attempt++;
        return v;
      };
      const first = next();
      return parseAndValidate(schema, first, {
        maxAttempts: 2,
        onOutcome: req.onValidationOutcome,
        reprompt: async () => next(),
      });
    }
    // Ramas oro (clasif/extracción/juez): validan limpio, sin repair.
    this.sink();
    const oro =
      shape.includes("sector_codigo")
        ? { sector_codigo: null }
        : shape.includes("idea_matriz")
          ? { idea_matriz: null, cuerpos_legales: [] }
          : { ok: false };
    const out = schema.parse(oro);
    req.onValidationOutcome?.({ kind: "clean" });
    return out;
  }
}

describe("harness — CR-01: outcome recuperado del repair loop real", () => {
  it("routing que FALLA schema en el intento 0 y valida tras reprompt → zod-repaired (> 0)", async () => {
    // Intento 0: JSON parseable pero inválido (label no está en el enum). Intento 1: válido.
    const muestras: CallMetric[] = [];
    const provider = new ProviderRepairLoop(
      [JSON.stringify({ label: "NO_ES_UNA_ETIQUETA" }), JSON.stringify({ label: null })],
      sinkSintetico(muestras),
    );
    const m = await correrHarness(
      provider,
      { modelo: "bench-mock", endpoint: "mock://local" },
      { drenarMetricas: () => muestras.slice(), limitePorTarea: 1 },
    );
    // El bug hard-codeaba "clean" → repaired quedaba en 0. Ahora la reparación es VISIBLE.
    expect(m.zod_fail_rate.repaired).toBeGreaterThan(0);
    // Y NO se contabiliza como terminal ni como structured-output-fail.
    expect(m.zod_fail_rate.terminal).toBe(0);
  });

  it("routing que NUNCA emite payload usable → structured-output-fail (NO zod-terminal)", async () => {
    // Todos los intentos devuelven undefined (el modelo no logra estructurar nada).
    const muestras: CallMetric[] = [];
    const provider = new ProviderRepairLoop([undefined], sinkSintetico(muestras));
    const m = await correrHarness(
      provider,
      { modelo: "bench-mock", endpoint: "mock://local" },
      { drenarMetricas: () => muestras.slice(), limitePorTarea: 1 },
    );
    // El bug clasificaba esto como zod-terminal (instanceof LLMValidationError). Ahora es
    // structured-output-fail, su campo SEPARADO — la señal que 107 usa para descartar un modelo
    // que no sabe emitir estructura.
    expect(m.structured_output_fail_rate).toBeGreaterThan(0);
    expect(m.zod_fail_rate.terminal).toBe(0);
  });

  it("routing con payload parseable que NUNCA pasa el schema → zod-terminal (NO structured-output-fail)", async () => {
    // Payload siempre parseable pero inválido en todos los intentos → terminal zod real.
    const muestras: CallMetric[] = [];
    const provider = new ProviderRepairLoop(
      [JSON.stringify({ label: "INVALIDO" })],
      sinkSintetico(muestras),
    );
    const m = await correrHarness(
      provider,
      { modelo: "bench-mock", endpoint: "mock://local" },
      { drenarMetricas: () => muestras.slice(), limitePorTarea: 1 },
    );
    expect(m.zod_fail_rate.terminal).toBeGreaterThan(0);
    expect(m.structured_output_fail_rate).toBe(0);
  });
});
