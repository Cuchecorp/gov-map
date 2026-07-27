/**
 * Adapter Granite (candidato TIER-01 — responder de la capa escalonada).
 *
 * CLON EXACTO de `MiniMaxProvider`: openai@5 + baseURL (CERO SDK nuevo),
 * `fetchFn` inyectable (instrumentedFetch de 106), una function unica
 * (`emit_result`) cuyos `parameters` derivan del schema zod via `zodToToolSchema`,
 * y `tool_choice` la FUERZA. El tool_call se matchea POR NOMBRE (jamas por
 * posicion). La validacion es EXTERNA (`parseAndValidate`, compuerta unica); el
 * repair loop re-llama al provider agregando los issues zod. Si el modelo no
 * fuerza la function, `arguments` es undefined -> repair y, si persiste,
 * LLMValidationError (nunca salida no estructurada).
 *
 * UNICA diferencia con MiniMax: un `max_tokens` EXPLICITO.
 *   Pitfall (107-CONTEXT §specifics): Workers AI defaultea max_tokens = 256, que
 *   TRUNCA la salida estructurada. Se fija alto explicito para que el tool_call
 *   completo sobreviva.
 *
 * Host-agnostico por baseURL:
 *   - PRIMARIO: Workers AI OpenAI-compat
 *     `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`
 *     (el operador provee CLOUDFLARE_ACCOUNT_ID en `.env` — el DEFAULT_BASE_URL
 *     de este modulo lleva el ACCOUNT_ID como template, se sobreescribe por
 *     constructor en la corrida LIVE).
 *   - FALLBACK: OpenRouter `https://openrouter.ai/api/v1` (baseURL-swap).
 * Modelo default: `@cf/ibm-granite/granite-4.0-h-micro`.
 *
 * Solo Web APIs / fetch inyectable (corre en Deno/edge). NUNCA loguea el prompt
 * ni la API key. CI lo prueba con un fetch fake (makeMockFetch): sin red, sin key.
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

/**
 * baseURL default (Workers AI OpenAI-compat). El `{ACCOUNT_ID}` es un template:
 * la corrida LIVE lo reemplaza construyendo el baseURL con CLOUDFLARE_ACCOUNT_ID
 * de `.env` y pasandolo por constructor. OpenRouter (`https://openrouter.ai/api/v1`)
 * es el fallback por baseURL-swap.
 */
const DEFAULT_BASE_URL =
  "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1";
const DEFAULT_MODEL = "@cf/ibm-granite/granite-4.0-h-micro";
const TOOL_NAME = "emit_result";

/**
 * max_tokens EXPLICITO. Workers AI defaultea a 256 -> TRUNCA la salida
 * estructurada (Pitfall 107-CONTEXT §specifics). Se fija alto para que el
 * tool_call completo sobreviva.
 */
const DEFAULT_MAX_TOKENS = 2048;

const DEFAULT_SYSTEM =
  "You are a structured extraction engine. Call the function emit_result with the structured result that satisfies its parameter schema.";

export interface GraniteProviderOptions {
  /** API key (de env; nunca hardcodear ni loguear). */
  apiKey: string;
  /** Base URL OpenAI-compatible. Default: Workers AI (template ACCOUNT_ID). */
  baseURL?: string;
  /** Model id. Default: @cf/ibm-granite/granite-4.0-h-micro */
  model?: string;
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
}

export class GraniteProvider implements LLMProvider {
  readonly id = "granite";
  /**
   * Boolean FIJO (no env-configurable): refleja la postura no-train/DPA del host.
   * Es un GATE LEGAL, no una bandera de conveniencia — hasta confirmar la DPA de
   * Workers AI se deja en `false` de forma CONSERVADORA para el modo publico del
   * benchmark (dato NO-PII por construccion). La confirmacion de la DPA es un dato
   * de provision (handoff Plan 03), no un cambio de codigo.
   */
  readonly trainsOnInputs = false;

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: GraniteProviderOptions) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? DEFAULT_BASE_URL,
      fetch: opts.fetchFn,
    });
  }

  async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
    // FAIL-CLOSED por construccion (IDENTICO a MiniMax): los gates de cumplimiento
    // corren ANTES de cualquier llamada de red, dentro del unico punto de entrada.
    // 1. El RUT NUNCA cruza a un prompt (se matchea aparte) — user Y system.
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
        // max_tokens EXPLICITO (Workers AI default 256 truncaria la estructura).
        max_tokens: DEFAULT_MAX_TOKENS,
        // spread CONDICIONAL de temperature (espeja MiniMax: no altera el default
        // del proveedor cuando el caller no la pasa).
        ...(req.temperature !== undefined
          ? { temperature: req.temperature }
          : {}),
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
        // FUERZA la function unica (structured output sin response_format).
        tool_choice: { type: "function", function: { name: TOOL_NAME } },
      });
      // Match POR NOMBRE (jamas por posicion): si el modelo devuelve un tool_call
      // con nombre alucinado o multiples calls, no se reenvia el equivocado a la
      // compuerta zod. Ausente -> undefined -> el repair loop lo maneja.
      const calls = res.choices[0]?.message?.tool_calls ?? [];
      const toolCall = calls.find(
        (c) => c.type === "function" && c.function.name === TOOL_NAME,
      );
      return toolCall?.type === "function" ? toolCall.function.arguments : undefined;
    };

    const first = await callModel();

    // Validacion EXTERNA (compuerta unica). Se threadea `onValidationOutcome` del
    // request para que el harness de benchmark mida el desenlace estructural REAL.
    return parseAndValidate(schema, first, {
      maxAttempts: clampRepairAttempts(req.maxRepairAttempts),
      onOutcome: req.onValidationOutcome,
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
