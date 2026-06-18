/**
 * Adapter MiniMax-M3 (tier critico / sensible).
 *
 * Structured output = TOOL-CALLING FORZADO (MiniMax NO soporta `response_format`
 * universal, verificado en 02-CONTEXT.md). Se declara una function unica
 * (`emit_result`) cuyos `parameters` derivan del schema zod (una sola fuente de
 * verdad via `zodToToolSchema`), y `tool_choice` la FUERZA. La respuesta trae
 * `choices[0].message.tool_calls[0].function.arguments` como string JSON.
 *
 * La validacion es EXTERNA: el adapter NUNCA hace su propio safeParse — delega en
 * `parseAndValidate` (compuerta unica, identica a DeepSeek). El repair loop re-llama
 * al provider agregando los issues zod. Si el provider no fuerza la function (sin
 * tool_calls), `arguments` es undefined -> entra al repair y, si persiste, lanza
 * LLMValidationError (nunca se acepta salida no estructurada).
 *
 * Solo Web APIs / fetch inyectable (corre en Deno/edge). NUNCA loguea el prompt
 * ni la API key.
 */
import OpenAI from "openai";
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "./../types";
import { parseAndValidate } from "./../validate";
import { zodToToolSchema } from "./../json-schema";

const DEFAULT_BASE_URL = "https://api.minimax.io/v1";
const DEFAULT_MODEL = "MiniMax-M3";
const TOOL_NAME = "emit_result";

const DEFAULT_SYSTEM =
  "You are a structured extraction engine. Call the function emit_result with the structured result that satisfies its parameter schema.";

export interface MiniMaxProviderOptions {
  /** API key (de env; nunca hardcodear ni loguear). */
  apiKey: string;
  /** Base URL OpenAI-compatible. Default: https://api.minimax.io/v1 */
  baseURL?: string;
  /** Model id. Default: MiniMax-M3 */
  model?: string;
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
}

export class MiniMaxProvider implements LLMProvider {
  readonly id = "minimax";
  readonly trainsOnInputs = false;

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: MiniMaxProviderOptions) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? DEFAULT_BASE_URL,
      fetch: opts.fetchFn,
    });
  }

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    const parameters = zodToToolSchema(schema);
    const system = req.system ?? DEFAULT_SYSTEM;
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      { role: "user", content: req.user },
    ];

    const callModel = async (): Promise<string | undefined> => {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: TOOL_NAME,
              description: "Emit the structured result",
              parameters,
            },
          },
        ],
        // FUERZA la function unica (MiniMax structured output).
        tool_choice: { type: "function", function: { name: TOOL_NAME } },
      });
      // Salida estructurada = tool_calls[0].function.arguments (string JSON).
      // undefined si el provider no forzo la function -> repair loop lo maneja.
      const toolCall = res.choices[0]?.message?.tool_calls?.[0];
      // El union del SDK v6 incluye un custom tool-call sin `.function`; se acota
      // a la function tool (la unica que forzamos).
      return toolCall?.type === "function" ? toolCall.function.arguments : undefined;
    };

    const first = await callModel();

    // Validacion EXTERNA (compuerta unica). El reprompt re-llama al provider
    // agregando un mensaje de usuario con los errores zod y devuelve los nuevos
    // arguments del tool_call.
    return parseAndValidate(schema, first, {
      maxAttempts: req.maxRepairAttempts ?? 1,
      reprompt: async (errors) => {
        messages.push({
          role: "user",
          content: `The previous emit_result arguments were invalid. Fix these issues and call emit_result again: ${errors}`,
        });
        return callModel();
      },
    });
  }
}
