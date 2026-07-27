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
 * DOS MODOS de salida estructurada (`structuredMode`), la alternativa sancionada por
 * CLAUDE.md ("`response_format: json_schema` JAMAS asumido universal → tool_choice O
 * prompt-forzado + zod"):
 *   - `"tool"` (DEFAULT — comportamiento existente, hosts con tool-calling): declara
 *     `emit_verdict` y `tool_choice` la FUERZA; se lee el `arguments` del tool_call
 *     matcheado POR NOMBRE.
 *   - `"prompt"` (OPT-IN — hosts SIN forced tool_choice, p.ej. OpenRouter `microsoft/phi-4`
 *     devuelve HTTP 404 "no endpoints support tool use"): NO envia `tools`/`tool_choice`;
 *     instruye por prompt a responder SOLO un objeto JSON con la forma de Verdict, y se
 *     parsea el CONTENT del mensaje (no un tool_call). Se extrae el primer objeto JSON
 *     balanceado del content (tolera fences/prosa) antes de la compuerta zod. Se puede
 *     pedir `response_format: {type:"json_object"}` (como DeepSeek) pero NUNCA se asume
 *     `json_schema`: la compuerta zod es la autoridad en ambos modos.
 * En AMBOS modos la validacion es EXTERNA (`parseAndValidate` contra `VerdictSchema`) y
 * el repair loop re-llama agregando los issues zod.
 *
 * DETERMINISMO: la temperature se fuerza a 0 (`req.temperature ?? 0`) — el veredicto
 * debe ser reproducible.
 *
 * Guards fail-closed IDENTICOS al responder Y en AMBOS modos: ningun RUT cruza al prompt
 * (se guarda TODO campo interpolado — `req.answer`, `req.system` Y `req.context` — CR-01),
 * y el gate de sensibilidad corre ANTES de cualquier red (`req.sensitivity ?? "public"`,
 * el golden de juez es NO-PII por construccion).
 *
 * Host: OpenRouter por default (`https://openrouter.ai/api/v1`, modelo
 * `microsoft/phi-4-mini-instruct`); el constructor acepta model/baseURL/apiKey/fetchFn/
 * structuredMode para la corrida LIVE (Plan 03). Solo Web APIs / fetch inyectable
 * (Deno/edge). NUNCA loguea el prompt ni la API key. CI lo prueba con fetch fake: sin
 * red, sin key.
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

/**
 * Sistema del modo PROMPT-FORZADO (hosts sin forced tool_choice). Instruye a
 * responder SOLO un objeto JSON con la forma de Verdict — sin prosa, sin fences.
 * Incluye la palabra "JSON" por si el host aplica su json_mode. La compuerta zod
 * (`parseAndValidate` contra `VerdictSchema`) es la autoridad final igual.
 */
const DEFAULT_SYSTEM_PROMPT_MODE =
  'You are a strict evaluation judge. Reply with ONLY a single JSON object matching this exact shape: {"ok": boolean, "reason"?: string, "confidence"?: number between 0 and 1}. Output ONLY the JSON object — no prose, no explanation, no markdown code fences.';

/** Cota del repair loop (el request del juez no expone maxRepairAttempts). */
const DEFAULT_REPAIR_ATTEMPTS = 1;

/** Modo de salida estructurada del juez. */
export type StructuredMode = "tool" | "prompt";

/**
 * Extrae el PRIMER objeto JSON balanceado de un texto, tolerando prosa, fences
 * ```json ... ``` o texto envolvente que un host prompt-forzado pueda emitir.
 * Cuenta llaves respetando strings (y sus escapes) para no cortar en una `}`
 * dentro de un string. Si no hay objeto balanceado, devuelve el texto crudo
 * (dejando que `safeJsonParse`/repair loop lo manejen). NUNCA lanza.
 */
export function extractFirstJsonObject(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const start = text.indexOf("{");
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  // Sin cierre balanceado: devuelve crudo (el repair loop reintenta).
  return text;
}

export interface PhiJudgeOptions {
  /** API key (de env; nunca hardcodear ni loguear). */
  apiKey: string;
  /** Base URL OpenAI-compatible. Default: OpenRouter. */
  baseURL?: string;
  /** Model id. Default: microsoft/phi-4-mini-instruct */
  model?: string;
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
  /**
   * Modo de salida estructurada. Default `"tool"` (comportamiento existente, hosts
   * con tool-calling forzado). `"prompt"` = OPT-IN para hosts SIN forced tool_choice
   * (p.ej. OpenRouter `microsoft/phi-4`): prompt-forzado + compuerta zod, sin
   * `tools`/`tool_choice`.
   */
  structuredMode?: StructuredMode;
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
  private readonly structuredMode: StructuredMode;

  constructor(opts: PhiJudgeOptions) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.structuredMode = opts.structuredMode ?? "tool";
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? DEFAULT_BASE_URL,
      fetch: opts.fetchFn,
    });
  }

  async judge(req: JudgeRequest): Promise<Verdict> {
    // FAIL-CLOSED por construccion (IDENTICO al responder, en AMBOS modos): los gates
    // corren ANTES de cualquier red. Se guarda TODO campo que se interpola al prompt de
    // red: answer, system Y context (CR-01). `req.context` es un campo LOCKED de
    // JudgeRequest que se concatena en `userParts` mas abajo — un RUT ahi cruzaria a la
    // red sin este guard. La invariante es "ningun RUT cruza al prompt".
    assertNoRutInLlmInput(req.answer);
    if (req.system) assertNoRutInLlmInput(req.system);
    if (req.context) assertNoRutInLlmInput(req.context);
    // Gate de sensibilidad; el golden de juez es NO-PII (default "public").
    assertSensitivityAllowed({ sensitivity: req.sensitivity ?? "public" }, this);

    return this.structuredMode === "prompt"
      ? this.judgePromptMode(req)
      : this.judgeToolMode(req);
  }

  /** Modo TOOL (default): tool_choice fuerza `emit_verdict`; match POR NOMBRE. */
  private async judgeToolMode(req: JudgeRequest): Promise<Verdict> {
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

  /**
   * Modo PROMPT-FORZADO (opt-in): NO envia tools/tool_choice — el host puede no
   * soportar forced tool_choice (OpenRouter `microsoft/phi-4` -> HTTP 404 "no
   * endpoints support tool use"). Se instruye por prompt a responder SOLO un objeto
   * JSON con la forma de Verdict; se parsea el CONTENT del mensaje (no un tool_call),
   * extrayendo el primer objeto JSON balanceado para tolerar fences/prosa. La
   * compuerta zod (`parseAndValidate` contra `VerdictSchema`) es la autoridad final.
   */
  private async judgePromptMode(req: JudgeRequest): Promise<Verdict> {
    const system = req.system ?? DEFAULT_SYSTEM_PROMPT_MODE;
    const userParts = [
      req.context ? `Context:\n${req.context}` : undefined,
      `Answer to judge:\n${req.answer}`,
      "Respond with ONLY the JSON verdict object.",
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
        // Se pide json_object (como DeepSeek) si el host lo soporta — pero NUNCA se
        // asume json_schema. La compuerta zod es la autoridad regardless.
        response_format: { type: "json_object" },
      });
      // Se lee el CONTENT del mensaje (NO un tool_call). Se extrae el primer objeto
      // JSON balanceado por si el host devuelve fences/prosa; si no hay objeto, el
      // repair loop reintenta (nunca verdict no estructurado).
      const content = res.choices[0]?.message?.content ?? undefined;
      return extractFirstJsonObject(content ?? undefined);
    };

    const first = await callModel();

    // Validacion EXTERNA contra VerdictSchema (compuerta unica, identica al modo tool).
    return parseAndValidate(VerdictSchema, first, {
      maxAttempts: clampRepairAttempts(DEFAULT_REPAIR_ATTEMPTS),
      reprompt: async (errors) => {
        messages.push({
          role: "user",
          content: `The previous JSON verdict was invalid. Fix these issues and reply with ONLY the corrected JSON verdict object: ${errors}`,
        });
        return callModel();
      },
    });
  }
}
