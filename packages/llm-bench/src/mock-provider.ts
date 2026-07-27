/**
 * MockProvider DETERMINISTA del harness (106-04, Task 1) — CI, sin red.
 *
 * Implementa `LLMProvider` sin tocar red (Pitfall 5: CI SIEMPRE mockeado): dado un
 * `responder(req, schema)` inyectado por el llamador, produce la respuesta canónica de
 * cada caso y la valida contra el `schema` recibido (igual que el adapter real: la salida
 * del modelo es untrusted hasta pasar la compuerta zod). Expone `id="bench-mock"` y
 * `trainsOnInputs=false` para espejar los incumbentes.
 *
 * Además registra `CallMetric` SINTÉTICAS en un sink opcional para que el harness pueda
 * ejercitar el camino de agregación de métricas (latencia p50/p95 + costo/1k + fail-rates)
 * SIN red en CI. El sink recibe SOLO latencia + conteos de tokens — nunca payload (T-106-14),
 * misma disciplina que `instrumentedFetch`.
 *
 * Host-agnóstico: el harness drive este mock igual que driverá DeepSeek/MiniMax/107-candidatos
 * — cambiar de provider NO cambia el harness. Un `responder` distinto reproduce comportamientos
 * distintos (oro, structured-output-fail, valores fabricados) sin subclasear.
 */
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import type { CallMetric } from "./instrument";

/**
 * La función que resuelve la respuesta canónica de un request. Recibe el request y el schema
 * (por si necesita ramificar por forma) y devuelve el valor YA formado (el mock lo valida
 * contra el schema antes de devolverlo — como el adapter real). Puede lanzar para simular un
 * structured-output fail que el llamador convierte en `null`.
 */
export type MockResponder = (
  req: CompletionRequest,
  schema: ZodType<unknown>,
) => unknown;

/** Opciones del mock: métricas sintéticas + sink de emisión (para ejercitar la agregación sin red). */
export interface MockProviderOptions {
  /** Sink de CallMetric sintéticas (mismo contrato que instrumentedFetch). */
  sink?: (m: CallMetric) => void;
  /** Latencia sintética por llamada (ms). Default: 100. Puede ser una función de callCount. */
  latencyMs?: number | ((callCount: number) => number);
  /** Tokens de prompt sintéticos por llamada (undefined → costo null). Default: 500. */
  promptTokens?: number;
  /** Tokens de completion sintéticos por llamada (undefined → costo null). Default: 120. */
  completionTokens?: number;
}

/**
 * `LLMProvider` determinista para CI. `complete<T>` invoca el `responder` inyectado, valida su
 * salida contra el `schema` (compuerta zod externa como el real), emite una `CallMetric`
 * sintética al sink y devuelve el objeto validado. NUNCA toca red (grep: sin fetch/http).
 */
export class MockProvider implements LLMProvider {
  readonly id = "bench-mock";
  readonly trainsOnInputs = false;

  /** Cuántas veces se llamó a `complete` (trazabilidad de test). */
  callCount = 0;

  constructor(
    private readonly responder: MockResponder,
    private readonly opts: MockProviderOptions = {},
  ) {}

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    this.callCount += 1;

    // Emitir la métrica sintética ANTES de resolver la respuesta: el reloj sintético cuenta
    // la llamada aunque el responder lance (structured-output fail sigue siendo una llamada).
    const sink = this.opts.sink;
    if (sink) {
      const lat =
        typeof this.opts.latencyMs === "function"
          ? this.opts.latencyMs(this.callCount)
          : (this.opts.latencyMs ?? 100);
      sink({
        latencyMs: lat,
        promptTokens: this.opts.promptTokens ?? 500,
        completionTokens: this.opts.completionTokens ?? 120,
      });
    }

    const bruto = this.responder(req, schema as ZodType<unknown>);
    // Valida contra el schema (compuerta zod externa, como el adapter real).
    return schema.parse(bruto);
  }
}
