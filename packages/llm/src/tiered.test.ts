/**
 * Suite de tests de TieredProvider — offline, sin red, sin keys.
 *
 * Todos los tests usan MockProvider/MockJudgeProvider locales (packages/llm/src/test-mock.ts).
 * PROHIBIDO importar de @obs/llm-bench o @obs/adjudication (Pitfall 5 — circular).
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { TieredProvider, EscalationExhaustedError } from "./tiered";
import { MockProvider, MockJudgeProvider } from "./test-mock";
import { LLMValidationError } from "./validate";
import type { TelemetryEvent } from "./telemetry";
import type { CompletionRequest } from "./types";

// Schema simple para tests
const SimpleSchema = z.object({ value: z.string() });
type Simple = z.infer<typeof SimpleSchema>;

// Request base de test (SIN task por defecto — byte-identical passthrough)
const baseReq: CompletionRequest = {
  user: "¿Cuál es el proyecto?",
  criticality: "bulk",
  sensitivity: "public",
};

// ─── A: byte-identical passthrough ────────────────────────────────────────────

describe("TieredProvider — byte-identical passthrough (LOAD-BEARING, TIER-02)", () => {
  it("sin task, 1 tier: devuelve EXACTAMENTE el mismo valor que el provider base, callCount==1, escalated===false", async () => {
    const expected: Simple = { value: "hola" };
    const mock = new MockProvider(() => expected, { id: "mock-a" });

    // Provider directo
    const directResult = await mock.complete(baseReq, SimpleSchema);

    // Reiniciar callCount para aislar TieredProvider
    mock.callCount = 0;

    const events: TelemetryEvent[] = [];
    const tiered = new TieredProvider({
      tiers: [mock],
      telemetrySink: (e) => events.push(e),
    });

    const tieredResult = await tiered.complete(baseReq, SimpleSchema);

    // Byte-identical: deep-equal
    expect(tieredResult).toEqual(directResult);
    // callCount == 1 (solo llamó al tier primario)
    expect(mock.callCount).toBe(1);
    // Exactamente 1 evento de telemetría
    expect(events).toHaveLength(1);
    // escalated === false
    expect(events[0]!.escalated).toBe(false);
    // task === undefined (no estaba en el request)
    expect(events[0]!.task).toBeUndefined();
  });

  it("drop-in: TieredProvider se puede asignar a variable LLMProvider (tipado)", () => {
    const mock = new MockProvider(() => ({ value: "x" }));
    // Asignación a LLMProvider compila — verificado por tsc
    const _provider: import("./types").LLMProvider = new TieredProvider({ tiers: [mock] });
    expect(_provider).toBeDefined();
  });
});

// ─── B: escalación zod (FLAG-2: lanza precisamente LLMValidationError) ────────

describe("TieredProvider — escalación zod (FLAG-2)", () => {
  it("tier-0 lanza LLMValidationError → escala a tier-1, retorna valor de tier-1", async () => {
    const tier0 = new MockProvider(
      (_req) => {
        // FLAG-2: lanzar PRECISAMENTE LLMValidationError (no Error genérico, no ZodError crudo)
        throw new LLMValidationError([{ code: "custom", path: ["value"], message: "fallo zod" } as import("zod").ZodIssue]);
      },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "de tier-1" }), { id: "tier-1" });

    const events: TelemetryEvent[] = [];
    const tiered = new TieredProvider({
      tiers: [tier0, tier1],
      telemetrySink: (e) => events.push(e),
    });

    const result = await tiered.complete(baseReq, SimpleSchema);

    expect(result).toEqual({ value: "de tier-1" });
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.escalated).toBe(true);
    expect(events[0]!.providerId).toBe("tier-1");
  });

  it("un error NO-LLMValidationError en tier-0 se re-lanza sin escalar (FLAG-2)", async () => {
    const netError = new Error("Network timeout");
    const tier0 = new MockProvider(
      () => { throw netError; },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "no debería llegar" }), { id: "tier-1" });

    const tiered = new TieredProvider({ tiers: [tier0, tier1] });

    await expect(tiered.complete(baseReq, SimpleSchema)).rejects.toBe(netError);
    // tier-1 NO fue llamado (no hubo escalación)
    expect(tier1.callCount).toBe(0);
  });
});

// ─── C: bounded/terminal (T-108-04) ──────────────────────────────────────────

describe("TieredProvider — bounded/terminal (T-108-04)", () => {
  it("tier-0 y tier-1 ambos fallan → EscalationExhaustedError, exactamente 2 llamadas totales, sin loop", async () => {
    const makeZodFail = () =>
      new MockProvider(
        () => { throw new LLMValidationError([]); },
        { id: `tier-${Math.random()}` },
      );
    const tier0 = makeZodFail();
    const tier1 = makeZodFail();

    const tiered = new TieredProvider({ tiers: [tier0, tier1] });

    await expect(tiered.complete(baseReq, SimpleSchema)).rejects.toBeInstanceOf(EscalationExhaustedError);
    // Exactamente 1 llamada por tier = 2 totales (sin loop)
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(1);
  });

  it("sin tier-1: fallo en tier-0 → EscalationExhaustedError(no-escalation-tier), 1 llamada total", async () => {
    const tier0 = new MockProvider(
      () => { throw new LLMValidationError([]); },
      { id: "tier-0" },
    );

    const tiered = new TieredProvider({ tiers: [tier0] });

    const err = await tiered.complete(baseReq, SimpleSchema).catch((e) => e);
    expect(err).toBeInstanceOf(EscalationExhaustedError);
    expect(err.message).toContain("no-escalation-tier");
    expect(tier0.callCount).toBe(1);
  });
});

// ─── D: juez ESCALATE-ONLY (T-108-05) ────────────────────────────────────────

describe("TieredProvider — juez ESCALATE-ONLY (T-108-05)", () => {
  it("(a) juez ok:false → escala a tier-1", async () => {
    const tier0 = new MockProvider(() => ({ value: "tier-0" }), { id: "tier-0" });
    const tier1 = new MockProvider(() => ({ value: "tier-1" }), { id: "tier-1" });
    const judge = new MockJudgeProvider({ verdict: { ok: false, confidence: 0.2 } });

    const events: TelemetryEvent[] = [];
    const tiered = new TieredProvider({
      tiers: [tier0, tier1],
      judge,
      telemetrySink: (e) => events.push(e),
    });

    const result = await tiered.complete(baseReq, SimpleSchema);

    expect(result).toEqual({ value: "tier-1" });
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(1);
    expect(judge.callCount).toBe(1);
    expect(events[0]!.escalated).toBe(true);
  });

  it("(b) juez ok:true sobre tier-0 exitoso → NO escala, retorna valor de tier-0", async () => {
    const tier0 = new MockProvider(() => ({ value: "tier-0" }), { id: "tier-0" });
    const tier1 = new MockProvider(() => ({ value: "tier-1" }), { id: "tier-1" });
    const judge = new MockJudgeProvider({ verdict: { ok: true, confidence: 0.9 } });

    const events: TelemetryEvent[] = [];
    const tiered = new TieredProvider({
      tiers: [tier0, tier1],
      judge,
      telemetrySink: (e) => events.push(e),
    });

    const result = await tiered.complete(baseReq, SimpleSchema);

    // ok:true NO relajó compuerta — retorna tier-0
    expect(result).toEqual({ value: "tier-0" });
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(0); // no escaló
    expect(events[0]!.escalated).toBe(false);
    expect(events[0]!.judgeVerdict?.ok).toBe(true);
  });

  it("juez ok:true sobre tier-0 que lanzó LLMValidationError → igual escala (ok:true no swallowea zod)", async () => {
    // El juez correría solo en éxito de tier-0 (diseño actual: juez corre si !tier0Failed).
    // Cuando tier-0 falla con LLMValidationError, hay escalación independientemente del juez.
    const tier0 = new MockProvider(
      () => { throw new LLMValidationError([]); },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "tier-1" }), { id: "tier-1" });
    // Juez con ok:true (aunque no corra tras zod-fail, el fallo zod igual escala)
    const judge = new MockJudgeProvider({ verdict: { ok: true, confidence: 1.0 } });

    const tiered = new TieredProvider({ tiers: [tier0, tier1], judge });

    const result = await tiered.complete(baseReq, SimpleSchema);

    // Escaló a tier-1 porque zod falló, independientemente del juez
    expect(result).toEqual({ value: "tier-1" });
    expect(tier1.callCount).toBe(1);
    // El juez NO fue invocado (tier-0 falló; el juez corre solo tras éxito del primario)
    expect(judge.callCount).toBe(0);
  });
});

// ─── E: budget cap ────────────────────────────────────────────────────────────

describe("TieredProvider — budget cap", () => {
  it("maxBudgetUsd:0 + tier-0 falla → EscalationExhaustedError(budget-exceeded) con 1 llamada total", async () => {
    const tier0 = new MockProvider(
      () => { throw new LLMValidationError([]); },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "no debería" }), { id: "tier-1" });

    const tiered = new TieredProvider({
      tiers: [tier0, tier1],
      maxBudgetUsd: 0,
    });

    const err = await tiered.complete(baseReq, SimpleSchema).catch((e) => e);
    expect(err).toBeInstanceOf(EscalationExhaustedError);
    expect(err.message).toContain("budget-exceeded");
    // tier-0 llamado 1 vez; tier-1 NO fue llamado
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(0);
  });
});

// ─── F: RUT-guard entrada (T-108-03) ──────────────────────────────────────────

describe("TieredProvider — RUT-guard entrada (T-108-03)", () => {
  it("user con patrón RUT chileno → lanza ANTES de llamar a ningún tier (tier-0.callCount==0)", async () => {
    const tier0 = new MockProvider(() => ({ value: "ok" }), { id: "tier-0" });
    const tiered = new TieredProvider({ tiers: [tier0] });

    const rutReq: CompletionRequest = {
      ...baseReq,
      user: "El RUT del diputado es 12.345.678-9",
    };

    await expect(tiered.complete(rutReq, SimpleSchema)).rejects.toThrow();
    // tier-0 NO fue invocado (guard mordió antes)
    expect(tier0.callCount).toBe(0);
  });
});

// ─── G: telemetría payload-free ───────────────────────────────────────────────

describe("TieredProvider — telemetría payload-free (TIER-04, T-108-06)", () => {
  it("Object.keys del evento no incluye user/system/answer/prompt/reason", async () => {
    const mock = new MockProvider(() => ({ value: "ok" }));
    let captured: TelemetryEvent | undefined;
    const tiered = new TieredProvider({
      tiers: [mock],
      telemetrySink: (e) => { captured = e; },
    });

    await tiered.complete(baseReq, SimpleSchema);

    expect(captured).toBeDefined();
    const keys = Object.keys(captured!);
    const forbidden = ["user", "system", "answer", "prompt", "reason"];
    for (const k of forbidden) {
      expect(keys).not.toContain(k);
    }
  });

  it("emite exactamente 1 TelemetryEvent por invocación de complete()", async () => {
    const mock = new MockProvider(() => ({ value: "ok" }));
    const events: TelemetryEvent[] = [];
    const tiered = new TieredProvider({
      tiers: [mock],
      telemetrySink: (e) => events.push(e),
    });

    await tiered.complete(baseReq, SimpleSchema);
    await tiered.complete(baseReq, SimpleSchema);

    expect(events).toHaveLength(2);
  });
});

// ─── H: between-pipelines — escalera inmutable mid-sesión (FLAG-1, TIER-05) ──

describe("TieredProvider — between-pipelines: escalera inmutable, nunca mid-sesión (FLAG-1)", () => {
  it("between-pipelines: dos complete() con task DISTINTOS recorren la MISMA escalera de tiers", async () => {
    // Ambos tiers son mocks que registran haber sido invocados
    const tier0 = new MockProvider(() => ({ value: "tier-0" }), { id: "tier-0" });
    const tier1 = new MockProvider(() => ({ value: "tier-1" }), { id: "tier-1" });

    // Una SOLA instancia de TieredProvider
    const tiered = new TieredProvider({ tiers: [tier0, tier1] });

    const reqClasificacion: CompletionRequest = { ...baseReq, task: "clasificacion" };
    const reqExtraccion: CompletionRequest = { ...baseReq, task: "extraccion" };

    // Primera invocación con task "clasificacion"
    const r1 = await tiered.complete(reqClasificacion, SimpleSchema);
    // Segunda invocación con task "extraccion" (DISTINTO)
    const r2 = await tiered.complete(reqExtraccion, SimpleSchema);

    // AMBAS llamadas recorrieron la MISMA escalera: tier-0 fue invocado en ambas
    expect(tier0.callCount).toBe(2);
    // tier-1 NO fue invocado (tier-0 no falló) — la escalera es la misma en ambas
    expect(tier1.callCount).toBe(0);

    // Los resultados provienen del mismo tier-0 (escalera inmutable)
    expect(r1).toEqual({ value: "tier-0" });
    expect(r2).toEqual({ value: "tier-0" });
  });
});
