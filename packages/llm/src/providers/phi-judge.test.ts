import { describe, expect, it } from "vitest";
import { PhiJudge } from "./phi-judge";
import { VerdictSchema, type Verdict } from "./../judge";
import { LLMValidationError } from "./../validate";
import { RutInLlmInputError } from "./../data-routing";
import { SensitiveRoutingError } from "./../router";
import { makeMockFetch } from "../../test/_helpers";

// baseURL default de PhiJudge (OpenRouter).
const BASE = "https://openrouter.ai/api/v1";
const URL = `${BASE}/chat/completions`;
const TOOL = "emit_verdict";

/** Respuesta chat-completions con un tool_call verdict (string JSON en arguments). */
function toolResponse(args: string, name = TOOL): string {
  return JSON.stringify({
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "call_1", type: "function", function: { name, arguments: args } }],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

/** PRIMER call de nombre alucinado, el verdict correcto DESPUES (match-by-name). */
function reorderedToolResponse(args: string, wrongName = "hallucinated_fn"): string {
  return JSON.stringify({
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            { id: "call_0", type: "function", function: { name: wrongName, arguments: args } },
            { id: "call_1", type: "function", function: { name: TOOL, arguments: args } },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

/** UN solo tool_call con nombre alucinado (Phi alucina nombres) -> ausente -> repair. */
function wrongNameOnlyResponse(args: string): string {
  return JSON.stringify({
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            { id: "call_0", type: "function", function: { name: "hallucinated_fn", arguments: args } },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

const VALID_VERDICT = JSON.stringify({ ok: true, reason: "cumple", confidence: 0.8 });
const INVALID_VERDICT = JSON.stringify({ reason: "falta ok" }); // sin `ok` boolean

function makeJudge(fetchFn: typeof fetch) {
  return new PhiJudge({ apiKey: "k", baseURL: BASE, fetchFn });
}

describe("PhiJudge", () => {
  it("flags: id phi-judge y trainsOnInputs boolean fijo", () => {
    const { fn } = makeMockFetch({});
    const p = makeJudge(fn);
    expect(p.id).toBe("phi-judge");
    expect(typeof p.trainsOnInputs).toBe("boolean");
  });

  it("verdict valido -> Verdict validado por zod; POST con temperature 0 forzada, tool_choice forzado, SIN response_format", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_VERDICT) } });
    const p = makeJudge(mock.fn);
    const v: Verdict = await p.judge({ answer: "la respuesta a evaluar" });
    expect(VerdictSchema.safeParse(v).success).toBe(true);
    expect(v).toEqual({ ok: true, reason: "cumple", confidence: 0.8 });

    expect(mock.calls).toHaveLength(1);
    const body = JSON.parse(String(mock.calls[0]!.body));
    // Determinismo: temperature 0.
    expect(body.temperature).toBe(0);
    // tool_choice fuerza la funcion unica.
    expect(body.tool_choice).toEqual({ type: "function", function: { name: TOOL } });
    expect(body.tools[0].function.name).toBe(TOOL);
    expect(body.response_format).toBeUndefined();
  });

  it("respeta req.temperature si el caller la pasa explicita", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_VERDICT) } });
    const p = makeJudge(mock.fn);
    await p.judge({ answer: "x", temperature: 0.3 });
    const body = JSON.parse(String(mock.calls[0]!.body));
    expect(body.temperature).toBe(0.3);
  });

  it("match-by-name: verdict NO es el primer tool_call -> lo selecciona por nombre y valida", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: reorderedToolResponse(VALID_VERDICT) } });
    const p = makeJudge(mock.fn);
    const v = await p.judge({ answer: "x" });
    expect(v.ok).toBe(true);
    expect(mock.calls).toHaveLength(1);
  });

  it("all-wrong-name: ningun verdict -> ausente -> repair -> persiste -> LLMValidationError", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: wrongNameOnlyResponse(VALID_VERDICT) },
        { status: 200, body: wrongNameOnlyResponse(VALID_VERDICT) },
      ],
    });
    const p = makeJudge(mock.fn);
    await expect(p.judge({ answer: "x", temperature: 0 })).rejects.toBeInstanceOf(LLMValidationError);
    expect(mock.calls).toHaveLength(2);
  });

  it("verdict malformado -> repair y, si persiste, LLMValidationError (nunca verdict no estructurado)", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: toolResponse(INVALID_VERDICT) },
        { status: 200, body: toolResponse(INVALID_VERDICT) },
      ],
    });
    const p = makeJudge(mock.fn);
    await expect(p.judge({ answer: "x" })).rejects.toBeInstanceOf(LLMValidationError);
  });

  it("RUT en req.answer -> RutInLlmInputError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_VERDICT) } });
    const p = makeJudge(mock.fn);
    await expect(
      p.judge({ answer: "el sujeto 12.345.678-9 declara" }),
    ).rejects.toBeInstanceOf(RutInLlmInputError);
    expect(mock.calls).toHaveLength(0);
  });

  it("RUT en req.system -> RutInLlmInputError y CERO fetches (guard-on-system)", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_VERDICT) } });
    const p = makeJudge(mock.fn);
    await expect(
      p.judge({ answer: "ok", system: "rubrica 1.234-5" }),
    ).rejects.toBeInstanceOf(RutInLlmInputError);
    expect(mock.calls).toHaveLength(0);
  });

  it("RUT en req.context -> RutInLlmInputError y CERO fetches (guard-on-context, CR-01)", async () => {
    // `context` se interpola al prompt de red (userParts) igual que answer/system:
    // un RUT ahi DEBE ser vetado ANTES de cualquier fetch, misma invariante fail-closed.
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_VERDICT) } });
    const p = makeJudge(mock.fn);
    await expect(
      p.judge({ answer: "ok", context: "el lobista 12.345.678-9 se reunio" }),
    ).rejects.toBeInstanceOf(RutInLlmInputError);
    expect(mock.calls).toHaveLength(0);
  });

  it("dato personal a un juez que entrena -> SensitiveRoutingError y CERO fetches", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: toolResponse(VALID_VERDICT) } });
    const p = makeJudge(mock.fn);
    Object.defineProperty(p, "trainsOnInputs", { value: true });
    await expect(
      p.judge({ answer: "x", sensitivity: "personal" }),
    ).rejects.toBeInstanceOf(SensitiveRoutingError);
    expect(mock.calls).toHaveLength(0);
  });
});
