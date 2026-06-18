/**
 * Adapter DeepSeek V4 Flash (tier `bulk` / alto volumen).
 *
 * Salida estructurada via `response_format: {type:"json_object"}` (DeepSeek NO
 * da json_schema estricto) + un prefijo de sistema estable (PRIMERO en messages)
 * para aprovechar el prompt-cache del proveedor. La validacion es EXTERNA: el
 * adapter NUNCA hace su propio safeParse — delega en `parseAndValidate` (compuerta
 * unica). El repair loop re-llama al provider agregando los issues zod.
 *
 * Solo Web APIs / fetch inyectable (corre en Deno/edge). NUNCA loguea el prompt
 * ni la API key.
 */
import OpenAI from "openai";
import type { ZodType } from "zod";
import type { CompletionRequest, LLMProvider } from "./../types";
import { parseAndValidate } from "./../validate";
import {
  assertNoRutInLlmInput,
  assertSensitivityAllowed,
} from "./../data-routing";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

/**
 * Instruccion de sistema estable (prefijo para prompt-cache). Incluye la palabra
 * "json" por requisito del json_mode de DeepSeek.
 */
const DEFAULT_SYSTEM =
  "You are a structured extraction engine. Respond with a single valid JSON object that satisfies the requested schema. Output only JSON, no prose.";

export interface DeepSeekProviderOptions {
  /** API key (de env; nunca hardcodear ni loguear). */
  apiKey: string;
  /** Base URL OpenAI-compatible. Default: https://api.deepseek.com */
  baseURL?: string;
  /** Model id. Default: deepseek-v4-flash */
  model?: string;
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
}

export class DeepSeekProvider implements LLMProvider {
  readonly id = "deepseek";
  readonly trainsOnInputs = false;

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: DeepSeekProviderOptions) {
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

    const system = req.system ?? DEFAULT_SYSTEM;
    // system PRIMERO = prefijo estable para prompt-cache.
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      { role: "user", content: req.user },
    ];

    const callModel = async (): Promise<string | undefined> => {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        response_format: { type: "json_object" },
      });
      return res.choices[0]?.message?.content ?? undefined;
    };

    const first = await callModel();

    // La validacion es EXTERNA (compuerta unica). El reprompt re-llama al provider
    // agregando un mensaje de usuario con los errores zod y devuelve el nuevo content.
    return parseAndValidate(schema, first, {
      maxAttempts: req.maxRepairAttempts ?? 1,
      reprompt: async (errors) => {
        messages.push({
          role: "user",
          content: `The previous JSON was invalid. Fix these issues and return only valid JSON: ${errors}`,
        });
        return callModel();
      },
    });
  }
}
