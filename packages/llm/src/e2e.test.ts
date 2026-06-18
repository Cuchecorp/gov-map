import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DeepSeekProvider } from "./providers/deepseek";
import { selectProvider, SensitiveRoutingError } from "./router";
import { loadRouterConfigFromEnv } from "./config";
import type { CompletionRequest, LLMProvider } from "./types";
import type { ZodType } from "zod";
import { makeMockFetch } from "../test/_helpers";

const URL = "https://api.deepseek.com/chat/completions";

const schema = z.object({
  decision: z.enum(["match", "no_match"]),
  confidence: z.number(),
});

function chatResponse(content: string): string {
  return JSON.stringify({
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

const config = loadRouterConfigFromEnv({});

describe("e2e rebanada LLM (router -> provider -> zod gate)", () => {
  it("caller bulk/public recibe el objeto validado sin red", async () => {
    const mock = makeMockFetch({
      [URL]: { status: 200, body: chatResponse(JSON.stringify({ decision: "no_match", confidence: 0.1 })) },
    });
    const registry: Record<string, LLMProvider> = {
      deepseek: new DeepSeekProvider({ apiKey: "k", fetchFn: mock.fn }),
    };
    const task = { criticality: "bulk" as const, sensitivity: "public" as const };
    const provider = selectProvider(task, registry, config);
    const data = await provider.complete(
      { user: "extrae la ficha", ...task },
      schema,
    );
    expect(data).toEqual({ decision: "no_match", confidence: 0.1 });
    expect(mock.calls).toHaveLength(1);
  });

  it("fail-closed: personal a un tier que entrena -> SensitiveRoutingError antes de cualquier fetch", () => {
    const mock = makeMockFetch({
      [URL]: { status: 200, body: chatResponse(JSON.stringify({ decision: "match", confidence: 0.9 })) },
    });
    // Provider de la criticidad bulk con trainsOnInputs:true (simula tier que entrena).
    const trainingProvider: LLMProvider = {
      id: "deepseek",
      trainsOnInputs: true,
      complete<T>(_req: CompletionRequest, _schema: ZodType<T>): Promise<T> {
        throw new Error("no debe llamarse");
      },
    };
    const registry = { deepseek: trainingProvider };
    expect(() =>
      selectProvider({ criticality: "bulk", sensitivity: "personal" }, registry, config),
    ).toThrow(SensitiveRoutingError);
    // Nunca se emitio un fetch.
    expect(mock.calls).toHaveLength(0);
  });
});
