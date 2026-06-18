// PLACEHOLDER — implementacion real en Task 3 (02-01). Exports estables.
/**
 * Adapter DeepSeek V4 Flash (tier bulk). response_format json_object + prompt
 * prefix estable (prompt-cache). (Implementacion real en Task 3.)
 */
import type { CompletionRequest, LLMProvider } from "./../types";
import type { ZodType } from "zod";

export interface DeepSeekProviderOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export class DeepSeekProvider implements LLMProvider {
  readonly id = "deepseek";
  readonly trainsOnInputs = false;

  constructor(_opts: DeepSeekProviderOptions) {
    throw new Error("not implemented (02-01 Task 3)");
  }

  complete<T>(_req: CompletionRequest, _schema: ZodType<T>): Promise<T> {
    throw new Error("not implemented (02-01 Task 3)");
  }
}
