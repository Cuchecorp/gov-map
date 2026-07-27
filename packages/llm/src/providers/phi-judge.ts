/**
 * Adapter PhiJudge (candidato TIER-01 — JUEZ de la capa escalonada).
 *
 * Implementa `JudgeProvider` (interfaz SEPARADA de `LLMProvider`: el juez emite un
 * VEREDICTO, no completa un prompt arbitrario). Clona los internals de tool-calling
 * de `MiniMaxProvider`: openai@5 + baseURL (CERO SDK nuevo), `fetchFn` inyectable,
 * una function unica (`emit_verdict`) cuyos `parameters` derivan de `VerdictSchema`
 * via `zodToToolSchema`, y `tool_choice` la FUERZA. La validacion es EXTERNA
 * (`parseAndValidate` contra `VerdictSchema`); el repair loop re-llama agregando los
 * issues zod. Si nunca valida -> LLMValidationError (nunca un verdict no estructurado).
 *
 * MATCH POR NOMBRE es LOAD-BEARING: Phi esta documentado para ALUCINAR nombres de
 * function → jamas se confia en la posicion del tool_call ni en `response_format`.
 *
 * DETERMINISMO: la temperature se fuerza a 0 (`req.temperature ?? 0`) — el veredicto
 * debe ser reproducible.
 *
 * Guards fail-closed IDENTICOS al responder: ningun RUT cruza al prompt (se guarda
 * TODO campo interpolado — `req.answer`, `req.system` Y `req.context`), y el gate de
 * sensibilidad corre ANTES de cualquier red (`req.sensitivity ?? "public"`, el golden
 * de juez es NO-PII por construccion).
 *
 * Host: OpenRouter por default (`https://openrouter.ai/api/v1`, modelo
 * `microsoft/phi-4-mini-instruct`); el constructor acepta model/baseURL/apiKey/fetchFn
 * para la corrida LIVE (Plan 03). Solo Web APIs / fetch inyectable (Deno/edge). NUNCA
 * loguea el prompt ni la API key. CI lo prueba con fetch fake: sin red, sin key.
 */
import OpenAI from "openai";
import type { JudgeProvider, JudgeRequest, Verdict } from "./../judge";
import { VerdictSchema } from "./../judge";
import { clampRepairAttempts, parseAndValidate } from "./../validate";
import { zodToToolSchema } from "./../json-schema";
import {
  assertNoRutInLlmInput,
  assertSensitivityAllowed,
} from "./../data-routing";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "microsoft/phi-4-mini-instruct";
const TOOL_NAME = "emit_verdict";

const DEFAULT_SYSTEM =
  "You are a strict evaluation judge. Call the function emit_verdict with your structured verdict about whether the answer meets the rubric.";

/** Cota del repair loop (el request del juez no expone maxRepairAttempts). */
const DEFAULT_REPAIR_ATTEMPTS = 1;

export interface PhiJudgeOptions {
  /** API key (de env; nunca hardcodear ni loguear). */
  apiKey: string;
  /** Base URL OpenAI-compatible. Default: OpenRouter. */
  baseURL?: string;
  /** Model id. Default: microsoft/phi-4-mini-instruct */
  model?: string;
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
}

export class PhiJudge implements JudgeProvider {
  readonly id = "phi-judge";
  /**
   * Boolean FIJO (no env-configurable): postura no-train/DPA del host. GATE LEGAL,
   * no conveniencia — conservador (`false`) para el modo publico NO-PII del
   * benchmark; la confirmacion de la DPA es un dato de provision (handoff Plan 03).
   */
  readonly trainsOnInputs = false;

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: PhiJudgeOptions) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? DEFAULT_BASE_URL,
      fetch: opts.fetchFn,
    });
  }

  async judge(req: JudgeRequest): Promise<Verdict> {
    // FAIL-CLOSED por construccion (IDENTICO al responder): los gates corren ANTES
    // de cualquier red. Se guarda TODO campo que se interpola al prompt de red:
    // answer, system Y context (CR-01). `req.context` es un campo LOCKED de
    // JudgeRequest que se concatena en `userParts` mas abajo — un RUT ahi cruzaria
    // a la red sin este guard. La invariante es "ningun RUT cruza al prompt".
    assertNoRutInLlmInput(req.answer);
    if (req.system) assertNoRutInLlmInput(req.system);
    if (req.context) assertNoRutInLlmInput(req.context);
    // Gate de sensibilidad; el golden de juez es NO-PII (default "public").
    assertSensitivityAllowed({ sensitivity: req.sensitivity ?? "public" }, this);

    const parameters = zodToToolSchema(VerdictSchema);
    const system = req.system ?? DEFAULT_SYSTEM;
    const userParts = [
      req.context ? `Context:\n${req.context}` : undefined,
      `Answer to judge:\n${req.answer}`,
    ].filter((p): p is string => p !== undefined);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n\n") },
    ];

    const callModel = async (): Promise<string | undefined> => {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        // DETERMINISMO: temperature forzada a 0 salvo override explicito del caller.
        temperature: req.temperature ?? 0,
        tools: [
          {
            type: "function",
            function: {
              name: TOOL_NAME,
              description: "Emit the structured verdict",
              parameters,
            },
          },
        ],
        // FUERZA la function unica (structured output sin response_format).
        tool_choice: { type: "function", function: { name: TOOL_NAME } },
      });
      // Match POR NOMBRE (LOAD-BEARING: Phi alucina nombres de function). Ausente
      // -> undefined -> el repair loop lo maneja (nunca verdict no estructurado).
      const calls = res.choices[0]?.message?.tool_calls ?? [];
      const toolCall = calls.find(
        (c) => c.type === "function" && c.function.name === TOOL_NAME,
      );
      return toolCall?.type === "function" ? toolCall.function.arguments : undefined;
    };

    const first = await callModel();

    // Validacion EXTERNA contra VerdictSchema (compuerta unica).
    return parseAndValidate(VerdictSchema, first, {
      maxAttempts: clampRepairAttempts(DEFAULT_REPAIR_ATTEMPTS),
      reprompt: async (errors) => {
        messages.push({
          role: "user",
          content: `The previous emit_verdict arguments were invalid. Fix these issues and call emit_verdict again: ${errors}`,
        });
        return callModel();
      },
    });
  }
}
