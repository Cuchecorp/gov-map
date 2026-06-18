import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MiniMaxProvider } from "./minimax";
import { LLMValidationError } from "./../validate";
import { RutInLlmInputError } from "./../data-routing";
import { SensitiveRoutingError } from "./../router";
import { makeMockFetch } from "../../test/_helpers";

const URL = "https://api.minimax.io/v1/chat/completions";

const schema = z.object({
  decision: z.enum(["match", "no_match"]),
  confidence: z.number(),
});

/** Respuesta chat-completions con tool_calls[0].function.arguments (string JSON). */
function toolResponse(args: string): string {
  return JSON.stringify({
    id: "cmpl-x",
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "<think>...</think>",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "emit_result", arguments: args },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

/**
 * Respuesta con tool_calls cuyo PRIMER call es de OTRA funcion (alucinada) y el
 * `emit_result` correcto viene despues — cubre WR-02 (matchear por nombre, no [0]).
 */
function reorderedToolResponse(args: string, wrongName = "other_tool"): string {
  return JSON.stringify({
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            { id: "call_0", type: "function", function: { name: wrongName, arguments: args } },
            { id: "call_1", type: "function", function: { name: "emit_result", arguments: args } },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

/**
 * Respuesta con UN solo tool_call de nombre equivocado (sin `emit_result`) —
 * cubre WR-02: debe tratarse como ausente (undefined) y entrar al repair.
 */
function wrongNameOnlyResponse(args: string): string {
  return JSON.stringify({
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            { id: "call_0", type: "function", function: { name: "other_tool", arguments: args } },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

/** Respuesta SIN tool_calls (el provider no forzo la funcion) — cubre A1. */
function noToolResponse(): string {
  return JSON.stringify({
    choices: [
      { index: 0, message: { role: "assistant", content: "lo siento" }, finish_reason: "stop" },
    ],
  });
}

const VALID_ARGS = JSON.stringify({ decision: "match", confidence: 0.9 });
const INVALID_ARGS = JSON.stringify({ decision: "match" }); // falta confidence

describe("MiniMaxProvider", () => {
  it("flags: id minimax y trainsOnInputs false", () => {
    const { fn } = makeMockFetch({});
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: fn });
    expect(p.id).toBe("minimax");
    expect(p.trainsOnInputs).toBe(false);
  });

  it("tool_calls.arguments valido -> objeto validado; POST con tool_choice forzado, tools.parameters, model y SIN response_format", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    const data = await p.complete(
      { user: "compara A y B", criticality: "critical", sensitivity: "personal" },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0]!;
    expect(call.url).toBe(URL);
    expect(call.method).toBe("POST");
    const body = JSON.parse(String(call.body));
    expect(body.model).toBe("MiniMax-M3");
    // tool_choice FUERZA la funcion unica.
    expect(body.tool_choice).toEqual({
      type: "function",
      function: { name: "emit_result" },
    });
    // tools[0].function.parameters = JSON schema derivado del zod.
    expect(body.tools[0].type).toBe("function");
    expect(body.tools[0].function.name).toBe("emit_result");
    expect(body.tools[0].function.parameters.type).toBe("object");
    expect(body.tools[0].function.parameters.properties).toHaveProperty("decision");
    expect(body.tools[0].function.parameters.properties).toHaveProperty("confidence");
    // NO usa response_format.
    expect(body.response_format).toBeUndefined();
    // system primero, luego user.
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("compara A y B");
  });

  it("repair: 1a arguments invalido -> 2a valido; fetch llamado 2 veces", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: toolResponse(INVALID_ARGS) },
        { status: 200, body: toolResponse(VALID_ARGS) },
      ],
    });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    const data = await p.complete(
      { user: "compara A y B", criticality: "critical", sensitivity: "personal", maxRepairAttempts: 1 },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(mock.calls).toHaveLength(2);
  });

  it("sin tool_calls (provider no forzo la funcion) -> repair y, si persiste, LLMValidationError (A1)", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: noToolResponse() },
        { status: 200, body: noToolResponse() },
      ],
    });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    await expect(
      p.complete(
        { user: "compara A y B", criticality: "critical", sensitivity: "personal", maxRepairAttempts: 1 },
        schema,
      ),
    ).rejects.toBeInstanceOf(LLMValidationError);
    // 1 inicial + 1 reprompt = 2 llamadas.
    expect(mock.calls).toHaveLength(2);
  });

  // WR-02: matchear el tool_call por function.name === "emit_result", no por [0].
  it("WR-02 emit_result NO es el primer tool_call -> lo selecciona por nombre y valida", async () => {
    const mock = makeMockFetch({
      [URL]: { status: 200, body: reorderedToolResponse(VALID_ARGS) },
    });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    const data = await p.complete(
      { user: "compara A y B", criticality: "critical", sensitivity: "personal" },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(mock.calls).toHaveLength(1);
  });

  it("WR-02 solo un tool_call de nombre equivocado -> ausente, entra al repair y persiste -> LLMValidationError", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: wrongNameOnlyResponse(VALID_ARGS) },
        { status: 200, body: wrongNameOnlyResponse(VALID_ARGS) },
      ],
    });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    await expect(
      p.complete(
        { user: "compara A y B", criticality: "critical", sensitivity: "personal", maxRepairAttempts: 1 },
        schema,
      ),
    ).rejects.toBeInstanceOf(LLMValidationError);
    expect(mock.calls).toHaveLength(2);
  });

  // CR-01: el gate RUT es intrinseco al provider (fail-closed), corre ANTES de
  // cualquier fetch.
  it("CR-01 RUT en req.user -> RutInLlmInputError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    await expect(
      p.complete(
        { user: "el sujeto 12.345.678-9 declara", criticality: "critical", sensitivity: "personal" },
        schema,
      ),
    ).rejects.toBeInstanceOf(RutInLlmInputError);
    expect(mock.calls).toHaveLength(0);
  });

  it("CR-01 RUT en req.system -> RutInLlmInputError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    await expect(
      p.complete(
        { system: "contexto 1.234-5", user: "compara", criticality: "critical", sensitivity: "personal" },
        schema,
      ),
    ).rejects.toBeInstanceOf(RutInLlmInputError);
    expect(mock.calls).toHaveLength(0);
  });

  // CR-02: el gate de sensibilidad es intrinseco al provider.
  it("CR-02 dato personal a un provider que entrena -> SensitiveRoutingError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = new MiniMaxProvider({ apiKey: "k", fetchFn: mock.fn });
    Object.defineProperty(p, "trainsOnInputs", { value: true });
    await expect(
      p.complete(
        { user: "compara A y B", criticality: "critical", sensitivity: "personal" },
        schema,
      ),
    ).rejects.toBeInstanceOf(SensitiveRoutingError);
    expect(mock.calls).toHaveLength(0);
  });
});
