/**
 * MockProvider LOCAL de @obs/llm — helper de test OFFLINE, sin importar de @obs/llm-bench.
 *
 * Esta es una copia MÍNIMA del MockProvider de llm-bench adaptada para vivir dentro de
 * @obs/llm (cero dependencia circular: llm-bench depende de llm, no al revés). Los tests
 * de la escalera (`TieredProvider`, `buildTieredProvider`) usan este mock para correr en
 * CI sin red y sin romper el grafo de dependencias del monorepo.
 *
 * Clon MÍNIMO: no incluye `CallMetric` ni el sink de métricas de llm-bench (esa plomería
 * vive en @obs/llm-bench). Solo incluye lo necesario para ejercitar la lógica de cascada:
 * - `MockProvider implements LLMProvider`: `complete<T>` invoca un responder inyectado,
 *   valida con el schema zod (compuerta externa, igual que el adapter real) y lleva conteo
 *   de llamadas. Puede recibir latencia sintética y emitir eventos básicos a `TelemetrySink`.
 * - `MockJudgeProvider implements JudgeProvider`: veredicto fijo inyectado + callCount.
 *
 * PROHIBIDO importar de @obs/llm-bench ni @obs/adjudication (Pitfall 5 + circular).
 */
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "./types";
import type { JudgeProvider, JudgeRequest, Verdict } from "./judge";
import type { TelemetrySink, TelemetryEvent } from "./telemetry";

// ─── MockProvider ─────────────────────────────────────────────────────────────

/**
 * Función que resuelve la respuesta canónica para un request de test. Recibe el request
 * y el schema; devuelve el valor YA formado (el mock lo valida con `schema.parse` antes
 * de devolver — igual que el adapter real). Puede lanzar para simular structured-output fail.
 */
export type MockResponder = (
  req: CompletionRequest,
  schema: ZodType<unknown>,
) => unknown;

/** Opciones del mock local. Subconjunto de las de llm-bench (sin CallMetric). */
export interface MockProviderOptions {
  /** id del provider simulado (default: "mock"). */
  id?: string;
  /** trainsOnInputs del provider simulado (default: false). */
  trainsOnInputs?: boolean;
  /** Latencia sintética por llamada en ms (default: 0). */
  latencyMs?: number | ((callCount: number) => number);
  /** Sink de telemetría al que emitir un TelemetryEvent por llamada (opcional). */
  telemetrySink?: TelemetrySink;
  /** Costo por token de output en USD (para costUsd sintético, undefined → null). */
  costPerToken?: number;
  /** Tokens de output sintéticos por llamada (default: 120). */
  completionTokens?: number;
}

/**
 * `LLMProvider` determinista para tests offline. `complete<T>` invoca el `responder`
 * inyectado, valida contra el schema (compuerta zod externa como el real), emite un
 * `TelemetryEvent` sintético al sink si se inyectó uno, y devuelve el objeto validado.
 * NUNCA toca red.
 */
export class MockProvider implements LLMProvider {
  readonly id: string;
  readonly trainsOnInputs: boolean;

  /** Cuántas veces se llamó a `complete` (trazabilidad de test). */
  callCount = 0;

  private readonly responder: MockResponder;
  private readonly opts: MockProviderOptions;

  constructor(responder: MockResponder, opts: MockProviderOptions = {}) {
    this.responder = responder;
    this.opts = opts;
    this.id = opts.id ?? "mock";
    this.trainsOnInputs = opts.trainsOnInputs ?? false;
  }

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    this.callCount += 1;
    const callN = this.callCount;

    const latMs =
      typeof this.opts.latencyMs === "function"
        ? this.opts.latencyMs(callN)
        : (this.opts.latencyMs ?? 0);

    const bruto = this.responder(req, schema as ZodType<unknown>);
    const result = schema.parse(bruto);

    if (this.opts.telemetrySink) {
      const completionTokens = this.opts.completionTokens ?? 120;
      const costUsd =
        this.opts.costPerToken != null
          ? completionTokens * this.opts.costPerToken
          : null;

      const event: TelemetryEvent = {
        providerId: this.id,
        task: req.task,
        latencyMs: latMs,
        costUsd,
        validationOutcome: { kind: "clean" },
        escalated: false,
        ts: new Date().toISOString(),
      };
      this.opts.telemetrySink(event);
    }

    return result;
  }
}

// ─── MockJudgeProvider ────────────────────────────────────────────────────────

/** Veredicto fijo inyectado en el constructor del MockJudgeProvider. */
export interface MockJudgeOptions {
  /** id del juez simulado (default: "mock-judge"). */
  id?: string;
  /** trainsOnInputs del juez simulado (default: false). */
  trainsOnInputs?: boolean;
  /** Veredicto fijo que devuelve en cada llamada. */
  verdict: Verdict;
}

/**
 * `JudgeProvider` determinista para tests offline. `judge()` devuelve siempre el
 * veredicto fijo inyectado en el constructor. NUNCA toca red.
 */
export class MockJudgeProvider implements JudgeProvider {
  readonly id: string;
  readonly trainsOnInputs: boolean;

  /** Cuántas veces se llamó a `judge` (trazabilidad de test). */
  callCount = 0;

  private readonly fixedVerdict: Verdict;

  constructor(opts: MockJudgeOptions) {
    this.id = opts.id ?? "mock-judge";
    this.trainsOnInputs = opts.trainsOnInputs ?? false;
    this.fixedVerdict = opts.verdict;
  }

  async judge(_req: JudgeRequest): Promise<Verdict> {
    this.callCount += 1;
    return { ...this.fixedVerdict };
  }
}
