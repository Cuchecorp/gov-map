// STUB — rellenado por 02-02 (implementa LLMProvider via tool-calling); no agregar tests aqui.
/**
 * Adapter MiniMax-M3 (tier critico). Structured output = tool-calling forzado
 * (MiniMax NO soporta response_format universal): parsea tool_calls[].arguments
 * y delega a la compuerta zod externa. baseURL https://api.minimax.io/v1.
 */
import type { CompletionRequest, LLMProvider } from "./../types";
import type { ZodType } from "zod";

export class MiniMaxProvider implements LLMProvider {
  readonly id = "minimax";
  readonly trainsOnInputs = false;

  complete<T>(_req: CompletionRequest, _schema: ZodType<T>): Promise<T> {
    throw new Error("not implemented (02-02)");
  }
}
