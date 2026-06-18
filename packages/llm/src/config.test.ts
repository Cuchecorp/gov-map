import { describe, expect, it } from "vitest";
import { loadRouterConfigFromEnv } from "./config";

describe("loadRouterConfigFromEnv (WR-05)", () => {
  it("env vacio -> usa los defaults verificados (CONTEXT.md)", () => {
    const cfg = loadRouterConfigFromEnv({});
    expect(cfg.byCriticality).toEqual({ critical: "minimax", bulk: "deepseek" });
    expect(cfg.providers.deepseek.model).toBe("deepseek-v4-flash");
    expect(cfg.providers.deepseek.baseURL).toBe("https://api.deepseek.com");
    expect(cfg.providers.minimax.model).toBe("MiniMax-M3");
    expect(cfg.providers.minimax.baseURL).toBe("https://api.minimax.io/v1");
  });

  it("WR-05 lee model/baseURL desde env (swappable sin tocar codigo)", () => {
    const cfg = loadRouterConfigFromEnv({
      DEEPSEEK_MODEL: "deepseek-v5",
      DEEPSEEK_BASE_URL: "https://alt.deepseek.example",
      MINIMAX_MODEL: "MiniMax-M4",
      MINIMAX_BASE_URL: "https://alt.minimax.example/v1",
    });
    expect(cfg.providers.deepseek.model).toBe("deepseek-v5");
    expect(cfg.providers.deepseek.baseURL).toBe("https://alt.deepseek.example");
    expect(cfg.providers.minimax.model).toBe("MiniMax-M4");
    expect(cfg.providers.minimax.baseURL).toBe("https://alt.minimax.example/v1");
  });

  it("WR-05 lee el mapeo criticidad->provider desde env", () => {
    const cfg = loadRouterConfigFromEnv({
      LLM_CRITICAL_PROVIDER: "deepseek",
      LLM_BULK_PROVIDER: "minimax",
    });
    expect(cfg.byCriticality).toEqual({ critical: "deepseek", bulk: "minimax" });
  });

  it("trainsOnInputs NO es configurable por env (sigue siendo false)", () => {
    const cfg = loadRouterConfigFromEnv({
      // Aunque alguien intente inyectar esto, no debe relajar el gate.
      DEEPSEEK_TRAINS_ON_INPUTS: "true",
    } as Record<string, string | undefined>);
    expect(cfg.providers.deepseek.trainsOnInputs).toBe(false);
    expect(cfg.providers.minimax.trainsOnInputs).toBe(false);
  });
});
