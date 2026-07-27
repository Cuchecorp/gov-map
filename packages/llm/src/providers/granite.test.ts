import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GraniteProvider } from "./granite";
import { LLMValidationError } from "./../validate";
import { RutInLlmInputError } from "./../data-routing";
import { SensitiveRoutingError } from "./../router";
import { makeMockFetch } from "../../test/_helpers";

// baseURL default de Granite (Workers AI OpenAI-compat, con un ACCOUNT_ID de test).
const BASE = "https://api.cloudflare.com/client/v4/accounts/acct_test/ai/v1";
const URL = `${BASE}/chat/completions`;

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
          content: "",
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "emit_result", arguments: args } },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

/**
 * PRIMER call de OTRA funcion (alucinada) y el `emit_result` correcto DESPUES —
 * prueba match POR NOMBRE, no por posicion [0].
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

/** UN solo tool_call de nombre equivocado (sin `emit_result`) -> ausente -> repair. */
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

const VALID_ARGS = JSON.stringify({ decision: "match", confidence: 0.9 });
const INVALID_ARGS = JSON.stringify({ decision: "match" }); // falta confidence

function makeProvider(fetchFn: typeof fetch, model?: string) {
  return new GraniteProvider({ apiKey: "k", baseURL: BASE, model, fetchFn });
}

describe("GraniteProvider", () => {
  it("flags: id granite y trainsOnInputs es un boolean fijo (postura DPA conservadora)", () => {
    const { fn } = makeMockFetch({});
    const p = makeProvider(fn);
    expect(p.id).toBe("granite");
    expect(typeof p.trainsOnInputs).toBe("boolean");
  });

  it("tool_calls.arguments valido -> objeto validado; POST con tool_choice forzado, tools.parameters, max_tokens explicito y SIN response_format", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = makeProvider(mock.fn);
    const data = await p.complete(
      { user: "compara A y B", criticality: "critical", sensitivity: "public" },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0]!;
    expect(call.url).toBe(URL);
    expect(call.method).toBe("POST");
    const body = JSON.parse(String(call.body));
    // tool_choice FUERZA la funcion unica.
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "emit_result" } });
    expect(body.tools[0].function.name).toBe("emit_result");
    expect(body.tools[0].function.parameters.type).toBe("object");
    expect(body.tools[0].function.parameters.properties).toHaveProperty("decision");
    // NO usa response_format.
    expect(body.response_format).toBeUndefined();
    // max_tokens EXPLICITO y numerico (Workers AI default 256 truncaria).
    expect(typeof body.max_tokens).toBe("number");
    expect(body.max_tokens).toBeGreaterThan(256);
    // system primero, luego user.
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("compara A y B");
  });

  it("usa el model del constructor (para la corrida LIVE en Workers AI)", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = makeProvider(mock.fn, "@cf/ibm-granite/granite-4.0-h-micro");
    await p.complete({ user: "x", criticality: "critical", sensitivity: "public" }, schema);
    const body = JSON.parse(String(mock.calls[0]!.body));
    expect(body.model).toBe("@cf/ibm-granite/granite-4.0-h-micro");
  });

  it("repair: 1a arguments invalido -> 2a valido; fetch llamado 2 veces", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: toolResponse(INVALID_ARGS) },
        { status: 200, body: toolResponse(VALID_ARGS) },
      ],
    });
    const p = makeProvider(mock.fn);
    const data = await p.complete(
      { user: "compara A y B", criticality: "critical", sensitivity: "public", maxRepairAttempts: 1 },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(mock.calls).toHaveLength(2);
  });

  it("match-by-name: emit_result NO es el primer tool_call -> lo selecciona por nombre y valida", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: reorderedToolResponse(VALID_ARGS) } });
    const p = makeProvider(mock.fn);
    const data = await p.complete(
      { user: "compara A y B", criticality: "critical", sensitivity: "public" },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(mock.calls).toHaveLength(1);
  });

  it("all-wrong-name: ningun emit_result -> ausente -> repair -> persiste -> LLMValidationError", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: wrongNameOnlyResponse(VALID_ARGS) },
        { status: 200, body: wrongNameOnlyResponse(VALID_ARGS) },
      ],
    });
    const p = makeProvider(mock.fn);
    await expect(
      p.complete(
        { user: "compara A y B", criticality: "critical", sensitivity: "public", maxRepairAttempts: 1 },
        schema,
      ),
    ).rejects.toBeInstanceOf(LLMValidationError);
    expect(mock.calls).toHaveLength(2);
  });

  it("RUT en req.user -> RutInLlmInputError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = makeProvider(mock.fn);
    await expect(
      p.complete(
        { user: "el sujeto 12.345.678-9 declara", criticality: "critical", sensitivity: "public" },
        schema,
      ),
    ).rejects.toBeInstanceOf(RutInLlmInputError);
    expect(mock.calls).toHaveLength(0);
  });

  it("RUT en req.system -> RutInLlmInputError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = makeProvider(mock.fn);
    await expect(
      p.complete(
        { system: "contexto 1.234-5", user: "compara", criticality: "critical", sensitivity: "public" },
        schema,
      ),
    ).rejects.toBeInstanceOf(RutInLlmInputError);
    expect(mock.calls).toHaveLength(0);
  });

  it("dato personal a un provider que entrena -> SensitiveRoutingError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_ARGS) } });
    const p = makeProvider(mock.fn);
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
