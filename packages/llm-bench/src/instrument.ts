/**
 * Fetch-wrapper instrumentado (106-01, Task 3).
 *
 * Envuelve el `fetch` base que cada adapter de `@obs/llm` acepta vía
 * `opts.fetchFn` (deepseek.ts:39 / minimax.ts:43). Mide el CAMINO REAL de
 * producción — el repair loop entero corre a través de él — y por eso es
 * host-agnóstico: en 107 un baseURL distinto (Workers AI/OpenRouter) se
 * instrumenta igual sin tocar el harness.
 *
 * Captura por llamada: latencia de pared (`performance.now()`) + `usage`
 * (prompt/completion tokens) del cuerpo de la respuesta. Lee un CLON de la
 * respuesta (no consume el cuerpo original) y devuelve la respuesta ORIGINAL
 * intacta al adapter.
 *
 * Disciplina de privacidad (T-106-02): el sink recibe SOLO latencia + conteos de
 * tokens; jamás el texto del prompt/respuesta (espeja LLMValidationError:
 * issues-only). Los round-trips de reparación se cuentan en el reloj de pared
 * (NO se recortan — un modelo que repara dos veces ES genuinamente más lento;
 * Pitfall 7).
 */

/** Muestra por llamada: latencia + tokens (undefined si el host omite usage). */
export interface CallMetric {
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

interface UsageBody {
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Devuelve un `fetch` que envuelve `base`: cronometra la llamada, clona la
 * respuesta, lee `body.usage`, emite una `CallMetric` al `sink`, y devuelve la
 * respuesta ORIGINAL sin consumir. Un cuerpo sin `usage` o no-JSON produce
 * conteos de tokens `undefined` (el costo posterior resuelve a `null`, no 0).
 */
export function instrumentedFetch(
  base: typeof fetch,
  sink: (m: CallMetric) => void,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const t0 = performance.now();
    const res = await base(input, init);
    const latencyMs = performance.now() - t0;
    // Clonar ANTES de leer: no consumir el cuerpo que el adapter necesita.
    const body = (await res
      .clone()
      .json()
      .catch(() => undefined)) as UsageBody | undefined;
    sink({
      latencyMs,
      promptTokens: body?.usage?.prompt_tokens,
      completionTokens: body?.usage?.completion_tokens,
    });
    return res;
  }) as typeof fetch;
}
