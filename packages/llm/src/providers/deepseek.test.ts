import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DeepSeekProvider } from "./deepseek";
import { makeMockFetch } from "../../test/_helpers";

const URL = "https://api.deepseek.com/chat/completions";

const schema = z.object({
  decision: z.enum(["match", "no_match"]),
  confidence: z.number(),
});

/** Construye una respuesta chat-completions OpenAI-compatible con `content`. */
function chatResponse(content: string): string {
  return JSON.stringify({
    id: "cmpl-x",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

const VALID_CONTENT = JSON.stringify({ decision: "match", confidence: 0.9 });
const INVALID_CONTENT = JSON.stringify({ decision: "match" }); // falta confidence

describe("DeepSeekProvider", () => {
  it("flags: id deepseek y trainsOnInputs false", () => {
    const { fn } = makeMockFetch({});
    const p = new DeepSeekProvider({ apiKey: "k", fetchFn: fn });
    expect(p.id).toBe("deepseek");
    expect(p.trainsOnInputs).toBe(false);
  });

  it("content JSON valido -> objeto validado; POST con json_object, model y system primero", async () => {
    const mock = makeMockFetch({ [URL]: { status: 200, body: chatResponse(VALID_CONTENT) } });
    const p = new DeepSeekProvider({ apiKey: "k", fetchFn: mock.fn });
    const data = await p.complete(
      { user: "compara A y B", criticality: "bulk", sensitivity: "public" },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0]!;
    expect(call.url).toBe(URL);
    expect(call.method).toBe("POST");
    const body = JSON.parse(String(call.body));
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
    // system (prefijo estable) va PRIMERO en messages (prompt-cache).
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("compara A y B");
  });

  it("repair via provider: 1a invalida -> 2a valida; fetch llamado 2 veces", async () => {
    const mock = makeMockFetch({
      [URL]: [
        { status: 200, body: chatResponse(INVALID_CONTENT) },
        { status: 200, body: chatResponse(VALID_CONTENT) },
      ],
    });
    const p = new DeepSeekProvider({ apiKey: "k", fetchFn: mock.fn });
    const data = await p.complete(
      { user: "compara A y B", criticality: "bulk", sensitivity: "public", maxRepairAttempts: 1 },
      schema,
    );
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(mock.calls).toHaveLength(2);
  });
});
