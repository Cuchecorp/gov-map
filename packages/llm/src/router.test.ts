import { describe, expect, it } from "vitest";
import { RouterError, selectProvider, SensitiveRoutingError } from "./router";
import { loadRouterConfigFromEnv } from "./config";
import type { CompletionRequest, LLMProvider } from "./types";
import type { ZodType } from "zod";

function fakeProvider(id: string, trainsOnInputs: boolean): LLMProvider {
  return {
    id,
    trainsOnInputs,
    complete<T>(_req: CompletionRequest, _schema: ZodType<T>): Promise<T> {
      throw new Error("not called in router tests");
    },
  };
}

const config = loadRouterConfigFromEnv({});

describe("selectProvider", () => {
  it("criticality bulk -> provider deepseek desde el registry", () => {
    const registry = { deepseek: fakeProvider("deepseek", false) };
    const p = selectProvider({ criticality: "bulk", sensitivity: "public" }, registry, config);
    expect(p.id).toBe("deepseek");
  });

  it("criticality sin provider en registry -> RouterError", () => {
    const registry = {}; // vacio
    expect(() =>
      selectProvider({ criticality: "bulk", sensitivity: "public" }, registry, config),
    ).toThrow(RouterError);
  });

  it("FAIL-CLOSED: sensitivity personal + provider trainsOnInputs -> SensitiveRoutingError", () => {
    // Registry donde deepseek (atiende bulk) entrena con inputs.
    const registry = { deepseek: fakeProvider("deepseek", true) };
    expect(() =>
      selectProvider({ criticality: "bulk", sensitivity: "personal" }, registry, config),
    ).toThrow(SensitiveRoutingError);
  });

  it("sensitivity personal + provider trainsOnInputs false -> devuelve el provider OK", () => {
    const registry = { deepseek: fakeProvider("deepseek", false) };
    const p = selectProvider({ criticality: "bulk", sensitivity: "personal" }, registry, config);
    expect(p.id).toBe("deepseek");
    expect(p.trainsOnInputs).toBe(false);
  });
});
