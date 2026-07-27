/**
 * Test offline del wiring de resolverProvider (clasificar-fichas-cli).
 *
 * INTEG-03 (rollback por config): el test load-bearing prueba que SIN la env var
 * CLASIFICACION_ESCALERA el provider construido es DeepSeekProvider (byte-idéntico
 * al comportamiento actual). Con la env var y keys dummy, el provider es TieredProvider.
 *
 * Cero red: resolverProvider recibe un objeto `env` dummy — NO depende de process.env
 * global (la función es pura y testeable sin arrancar el CLI completo).
 */
import { describe, it, expect } from "vitest";
import { DeepSeekProvider, TieredProvider } from "@obs/llm";
import { MockClasificadorProvider } from "./mock-provider";
import { resolverProvider } from "./clasificar-fichas-cli";

const noop = () => {};

describe("resolverProvider — wiring de provider (INTEG-03)", () => {
  it("Test 1 (LOAD-BEARING): sin env var → DeepSeekProvider (default incumbente, byte-idéntico)", () => {
    // apiKey dummy: necesario porque DeepSeekProvider (vía openai SDK) rechaza apiKey="".
    // La función resolverProvider es pura — no toca la red.
    const provider = resolverProvider({}, { DEEPSEEK_API_KEY: "dummy-deepseek" }, noop);
    expect(provider).toBeInstanceOf(DeepSeekProvider);
    expect(provider).not.toBeInstanceOf(TieredProvider);
  });

  it("Test 2: CLASIFICACION_ESCALERA=1 + keys dummy → TieredProvider (escalera Granite→DeepSeek)", () => {
    const env = {
      CLASIFICACION_ESCALERA: "1",
      WORKERS_AI_API_TOKEN: "dummy-token",
      CLOUDFLARE_ACCOUNT_ID: "dummy-account",
      DEEPSEEK_API_KEY: "dummy-deepseek",
    };
    const provider = resolverProvider({}, env, noop);
    expect(provider).toBeInstanceOf(TieredProvider);
  });

  it("Test 3 (fail-safe keys ausentes): CLASIFICACION_ESCALERA=1 pero WORKERS_AI_API_TOKEN vacío → DeepSeekProvider", () => {
    const env = {
      CLASIFICACION_ESCALERA: "1",
      WORKERS_AI_API_TOKEN: "",
      CLOUDFLARE_ACCOUNT_ID: "dummy-account",
      DEEPSEEK_API_KEY: "dummy-deepseek",
    };
    const provider = resolverProvider({}, env, noop);
    expect(provider).toBeInstanceOf(DeepSeekProvider);
    expect(provider).not.toBeInstanceOf(TieredProvider);
  });

  it("Test 3b (fail-safe keys ausentes): CLASIFICACION_ESCALERA=1 pero CLOUDFLARE_ACCOUNT_ID vacío → DeepSeekProvider", () => {
    const env = {
      CLASIFICACION_ESCALERA: "1",
      WORKERS_AI_API_TOKEN: "dummy-token",
      CLOUDFLARE_ACCOUNT_ID: "",
      DEEPSEEK_API_KEY: "dummy-deepseek",
    };
    const provider = resolverProvider({}, env, noop);
    expect(provider).toBeInstanceOf(DeepSeekProvider);
    expect(provider).not.toBeInstanceOf(TieredProvider);
  });

  it("Test 4 (inyección respetada): opts.provider = MockProvider → se usa ese, ninguna env lo sobrescribe", () => {
    const mock = new MockClasificadorProvider({ sector_codigo: "salud" });
    const env = {
      CLASIFICACION_ESCALERA: "1",
      WORKERS_AI_API_TOKEN: "dummy-token",
      CLOUDFLARE_ACCOUNT_ID: "dummy-account",
    };
    const provider = resolverProvider({ provider: mock }, env, noop);
    expect(provider).toBe(mock);
  });
});
