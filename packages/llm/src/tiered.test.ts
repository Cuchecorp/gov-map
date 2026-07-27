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
import type { ValidationOutcome } from "./validate";
import type { TelemetryEvent } from "./telemetry";
import type { CompletionRequest } from "./types";
import { RutInLlmInputError } from "./data-routing";

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

// ─── I: onValidationOutcome EXACTAMENTE una vez a través de escalación (WR-02) ─

describe("TieredProvider — onValidationOutcome exactly-once (WR-02, LOAD-BEARING)", () => {
  // Los providers reales reenvían el observador a `parseAndValidate`, que dispara
  // `onValidationOutcome` ANTES del throw terminal. Simulamos ese comportamiento haciendo
  // que el responder del mock invoque `req.onValidationOutcome`. SIN el fix, tier-0 (fallo
  // terminal) + tier-1 (clean) disparan el callback del caller DOS veces; con el fix, el
  // decorador lo dispara EXACTAMENTE una vez, con el outcome del tier que produjo el valor
  // retornado.
  it("una escalación (tier-0 zod-terminal → tier-1) dispara el callback del caller UNA sola vez", async () => {
    const tier0 = new MockProvider(
      (req) => {
        // Emula parseAndValidate: dispara el outcome terminal ANTES de lanzar.
        req.onValidationOutcome?.({ kind: "zod-terminal", issues: [] });
        throw new LLMValidationError([]);
      },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(
      (req) => {
        // tier-1 valida limpio y dispara su propio outcome.
        req.onValidationOutcome?.({ kind: "clean" });
        return { value: "de tier-1" };
      },
      { id: "tier-1" },
    );

    const outcomes: ValidationOutcome[] = [];
    const tiered = new TieredProvider({ tiers: [tier0, tier1] });

    const callerReq: CompletionRequest = {
      ...baseReq,
      onValidationOutcome: (o) => outcomes.push(o),
    };

    const result = await tiered.complete(callerReq, SimpleSchema);

    expect(result).toEqual({ value: "de tier-1" });
    // EXACTAMENTE una invocación del callback del caller (rompe con double-fire).
    expect(outcomes).toHaveLength(1);
    // El outcome es el del tier que produjo el valor retornado (tier-1, clean).
    expect(outcomes[0]).toEqual({ kind: "clean" });
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(1);
  });

  it("sin escalación (tier-0 clean) dispara el callback del caller UNA sola vez", async () => {
    const tier0 = new MockProvider(
      (req) => {
        req.onValidationOutcome?.({ kind: "clean" });
        return { value: "tier-0" };
      },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "tier-1" }), { id: "tier-1" });

    const outcomes: ValidationOutcome[] = [];
    const tiered = new TieredProvider({ tiers: [tier0, tier1] });
    const callerReq: CompletionRequest = {
      ...baseReq,
      onValidationOutcome: (o) => outcomes.push(o),
    };

    await tiered.complete(callerReq, SimpleSchema);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toEqual({ kind: "clean" });
    expect(tier1.callCount).toBe(0);
  });

  it("escalación por juez ok:false dispara el callback del caller UNA sola vez (con outcome de tier-1)", async () => {
    const tier0 = new MockProvider(
      (req) => {
        req.onValidationOutcome?.({ kind: "clean" });
        return { value: "tier-0" };
      },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(
      (req) => {
        req.onValidationOutcome?.({ kind: "zod-repaired", attempts: 1 });
        return { value: "tier-1" };
      },
      { id: "tier-1" },
    );
    const judge = new MockJudgeProvider({ verdict: { ok: false } });

    const outcomes: ValidationOutcome[] = [];
    const tiered = new TieredProvider({ tiers: [tier0, tier1], judge });
    const callerReq: CompletionRequest = {
      ...baseReq,
      onValidationOutcome: (o) => outcomes.push(o),
    };

    const result = await tiered.complete(callerReq, SimpleSchema);

    expect(result).toEqual({ value: "tier-1" });
    expect(outcomes).toHaveLength(1);
    // El valor retornado es de tier-1 → su outcome es el autoritativo.
    expect(outcomes[0]).toEqual({ kind: "zod-repaired", attempts: 1 });
  });
});

// ─── J: RUT-guard en el hop AL JUEZ (WR-01) ───────────────────────────────────

describe("TieredProvider — RUT-guard hop al juez (WR-01, defensa en profundidad)", () => {
  it("un RUT en la salida de tier-0 NO cruza al juez: lanza RutInLlmInputError, judge.callCount==0", async () => {
    // tier-0 produce una salida schema-válida que CONTIENE un RUT (p.ej. una extracción
    // que hizo eco de un identificador). El decorador debe morder ANTES de llamar al juez.
    const tier0 = new MockProvider(
      () => ({ value: "el RUT es 12.345.678-9" }),
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "tier-1" }), { id: "tier-1" });
    const judge = new MockJudgeProvider({ verdict: { ok: true } });

    const tiered = new TieredProvider({ tiers: [tier0, tier1], judge });

    const err = await tiered.complete(baseReq, SimpleSchema).catch((e) => e);
    expect(err).toBeInstanceOf(RutInLlmInputError);
    // El juez NUNCA recibió la salida con RUT (guard mordió en el hop al juez).
    expect(judge.callCount).toBe(0);
    // No hubo escalación (falló por guard, no por veredicto).
    expect(tier1.callCount).toBe(0);
  });

  it("salida de tier-0 SIN RUT sí llega al juez (el guard no sobre-bloquea)", async () => {
    const tier0 = new MockProvider(() => ({ value: "texto limpio sin identificadores" }), { id: "tier-0" });
    const judge = new MockJudgeProvider({ verdict: { ok: true } });
    const tiered = new TieredProvider({ tiers: [tier0], judge });

    const result = await tiered.complete(baseReq, SimpleSchema);

    expect(result).toEqual({ value: "texto limpio sin identificadores" });
    expect(judge.callCount).toBe(1);
  });
});

// ─── K: budget POSITIVO enforced (WR-05) ──────────────────────────────────────

describe("TieredProvider — budget positivo enforced (WR-05)", () => {
  it("maxBudgetUsd positivo excedido por el costo de tier-0 → NO escala (budget-exceeded)", async () => {
    const tier0 = new MockProvider(
      () => { throw new LLMValidationError([]); },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "no debería" }), { id: "tier-1" });

    // costPerToken 0.001 * 120 tokens = 0.12 USD por el tier-0, > maxBudgetUsd 0.05.
    const tiered = new TieredProvider({
      tiers: [tier0, tier1],
      maxBudgetUsd: 0.05,
      costPerToken: 0.001,
      escalationCostPerToken: 0.001,
    });

    const err = await tiered.complete(baseReq, SimpleSchema).catch((e) => e);
    expect(err).toBeInstanceOf(EscalationExhaustedError);
    expect(err.message).toContain("budget-exceeded");
    // tier-1 NUNCA fue llamado: el budget positivo abortó la escalación.
    expect(tier0.callCount).toBe(1);
    expect(tier1.callCount).toBe(0);
  });

  it("maxBudgetUsd positivo suficiente → SÍ escala (budget no bloquea)", async () => {
    const tier0 = new MockProvider(
      () => { throw new LLMValidationError([]); },
      { id: "tier-0" },
    );
    const tier1 = new MockProvider(() => ({ value: "de tier-1" }), { id: "tier-1" });

    // 0.0000001 * 120 = 0.000012 por tier; total 0.000024 << 1.0 budget.
    const tiered = new TieredProvider({
      tiers: [tier0, tier1],
      maxBudgetUsd: 1.0,
      costPerToken: 0.0000001,
      escalationCostPerToken: 0.0000001,
    });

    const result = await tiered.complete(baseReq, SimpleSchema);
    expect(result).toEqual({ value: "de tier-1" });
    expect(tier1.callCount).toBe(1);
  });
});

// ─── L: escalación retorna salida NO juzgada (WR-03, bound deliberado) ─────────

describe("TieredProvider — escalación retorna salida NO juzgada (WR-03)", () => {
  it("juez ok:false escala; el juez NO re-evalúa tier-1 (judge.callCount==1, sin loop)", async () => {
    const tier0 = new MockProvider(() => ({ value: "tier-0" }), { id: "tier-0" });
    const tier1 = new MockProvider(() => ({ value: "tier-1" }), { id: "tier-1" });
    const judge = new MockJudgeProvider({ verdict: { ok: false } });

    const events: TelemetryEvent[] = [];
    const tiered = new TieredProvider({
      tiers: [tier0, tier1],
      judge,
      telemetrySink: (e) => events.push(e),
    });

    const result = await tiered.complete(baseReq, SimpleSchema);

    expect(result).toEqual({ value: "tier-1" });
    // El juez corrió UNA sola vez (sobre tier-0). tier-1 se retorna SIN re-juzgar (bound).
    expect(judge.callCount).toBe(1);
    expect(events).toHaveLength(1);
    // El evento apunta a tier-1 pero conserva el judgeVerdict de tier-0 (señal causal).
    expect(events[0]!.providerId).toBe("tier-1");
    expect(events[0]!.escalated).toBe(true);
    expect(events[0]!.judgeVerdict?.ok).toBe(false);
  });
});
