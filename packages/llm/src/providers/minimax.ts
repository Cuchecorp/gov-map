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
import { clampRepairAttempts, parseAndValidate } from "./../validate";
import { zodToToolSchema } from "./../json-schema";
import {
  assertNoRutInLlmInput,
  assertSensitivityAllowed,
} from "./../data-routing";

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
    // FAIL-CLOSED por construccion (CR-01/CR-02): los gates de cumplimiento
    // corren ANTES de cualquier llamada de red, dentro del unico punto de
    // entrada del provider. Asi es imposible enviar un RUT o dato personal a un
    // tier prohibido aunque el caller no pase por el router.
    // 1. El RUT NUNCA cruza a un prompt (se matchea aparte).
    assertNoRutInLlmInput(req.user);
    if (req.system) assertNoRutInLlmInput(req.system);
    // 2. Dato personal NUNCA a un provider que entrena con inputs.
    assertSensitivityAllowed({ sensitivity: req.sensitivity }, this);

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
      // Salida estructurada = arguments del tool_call cuya function.name ===
      // TOOL_NAME (WR-02). Se MATCHEA POR NOMBRE, no por posicion: si el modelo
      // devuelve multiples tool_calls, o uno con un nombre de funcion
      // alucinado, no se debe reenviar el call equivocado a la compuerta zod.
      // Si el `emit_result` esperado no esta presente -> undefined -> el repair
      // loop lo maneja (nunca se acepta salida no estructurada).
      const calls = res.choices[0]?.message?.tool_calls ?? [];
      // El union del SDK v6 incluye un custom tool-call sin `.function`; se acota
      // a la function tool con el nombre forzado (la unica que pedimos).
      const toolCall = calls.find(
        (c) => c.type === "function" && c.function.name === TOOL_NAME,
      );
      return toolCall?.type === "function" ? toolCall.function.arguments : undefined;
    };

    const first = await callModel();

    // Validacion EXTERNA (compuerta unica). El reprompt re-llama al provider
    // agregando un mensaje de usuario con los errores zod y devuelve los nuevos
    // arguments del tool_call.
    return parseAndValidate(schema, first, {
      // WR-01: clamp al rango [0, ceiling] para acotar costo de round-trips.
      maxAttempts: clampRepairAttempts(req.maxRepairAttempts),
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
