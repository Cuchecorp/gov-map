/**
 * Tests de buildTieredProvider (task-ladder.ts).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildTieredProvider } from "./task-ladder";
import { MockProvider, MockJudgeProvider } from "./test-mock";
import { TieredProvider, EscalationExhaustedError } from "./tiered";
import { LLMValidationError } from "./validate";
import type { TelemetryEvent } from "./telemetry";
import type { CompletionRequest } from "./types";

const SimpleSchema = z.object({ v: z.number() });
const baseReq: CompletionRequest = {
  user: "test",
  criticality: "bulk",
  sensitivity: "public",
};

describe("buildTieredProvider", () => {
  it("produce un TieredProvider (instanceof)", () => {
    const mock = new MockProvider(() => ({ v: 1 }));
    const p = buildTieredProvider({ primary: { provider: mock } });
    expect(p).toBeInstanceOf(TieredProvider);
  });

  it("config sin escalation → provider de 1 tier, falla → EscalationExhaustedError (no-escalation-tier)", async () => {
    const mock = new MockProvider(
      () => { throw new LLMValidationError([]); },
    );
    const p = buildTieredProvider({ primary: { provider: mock } });

    const err = await p.complete(baseReq, SimpleSchema).catch((e) => e);
    expect(err).toBeInstanceOf(EscalationExhaustedError);
    expect(err.message).toContain("no-escalation-tier");
  });

  it("config con escalation → provider de 2 tiers; tier-0 falla, tier-1 responde", async () => {
    const tier0 = new MockProvider(() => { throw new LLMValidationError([]); });
    const tier1 = new MockProvider(() => ({ v: 42 }));

    const p = buildTieredProvider({
      primary: { provider: tier0 },
      escalation: { provider: tier1 },
    });

    const result = await p.complete(baseReq, SimpleSchema);
    expect(result).toEqual({ v: 42 });
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(1);
  });

  it("judge de LadderConfig es pasado al TieredProvider (judge.callCount > 0)", async () => {
    const tier0 = new MockProvider(() => ({ v: 7 }));
    const tier1 = new MockProvider(() => ({ v: 99 }));
    const judge = new MockJudgeProvider({ verdict: { ok: false } });

    const p = buildTieredProvider({
      primary: { provider: tier0 },
      escalation: { provider: tier1 },
      judge,
    });

    await p.complete(baseReq, SimpleSchema);
    // Juez fue invocado (tier-0 tuvo éxito, juez corrió y dijo ok:false → escaló)
    expect(judge.callCount).toBe(1);
    expect(tier1.callCount).toBe(1);
  });

  it("maxBudgetUsd:0 → no escala (budget-exceeded)", async () => {
    const tier0 = new MockProvider(() => { throw new LLMValidationError([]); });
    const tier1 = new MockProvider(() => ({ v: 1 }));

    const p = buildTieredProvider({
      primary: { provider: tier0 },
      escalation: { provider: tier1 },
      maxBudgetUsd: 0,
    });

    const err = await p.complete(baseReq, SimpleSchema).catch((e) => e);
    expect(err).toBeInstanceOf(EscalationExhaustedError);
    expect(err.message).toContain("budget-exceeded");
    expect(tier1.callCount).toBe(0);
  });

  it("telemetrySink inyectado recibe eventos", async () => {
    const mock = new MockProvider(() => ({ v: 5 }));
    const events: TelemetryEvent[] = [];

    const p = buildTieredProvider(
      { primary: { provider: mock } },
      (e) => events.push(e),
    );

    await p.complete(baseReq, SimpleSchema);
    expect(events).toHaveLength(1);
    expect(events[0]!.escalated).toBe(false);
  });
});
