import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  clampRepairAttempts,
  LLMValidationError,
  MAX_REPAIR_ATTEMPTS_CEILING,
  parseAndValidate,
  type ValidationOutcome,
} from "./validate";

const schema = z.object({
  decision: z.enum(["match", "no_match"]),
  confidence: z.number(),
});

const VALID = JSON.stringify({ decision: "match", confidence: 0.9 });
const MISSING_FIELD = JSON.stringify({ decision: "match" }); // falta confidence

describe("parseAndValidate", () => {
  it("JSON valido que pasa el schema -> devuelve data tipada sin reprompt", async () => {
    const reprompt = vi.fn(async () => undefined);
    const data = await parseAndValidate(schema, VALID, { reprompt, maxAttempts: 1 });
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(reprompt).not.toHaveBeenCalled();
  });

  it("1a respuesta invalida -> reprompt una vez con los issues; 2a valida -> data", async () => {
    const reprompt = vi.fn(async (_errors: string) => VALID);
    const data = await parseAndValidate(schema, MISSING_FIELD, { reprompt, maxAttempts: 1 });
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(reprompt).toHaveBeenCalledTimes(1);
    // El mensaje de reprompt lleva los issues zod (path: message), p.ej. "confidence: ...".
    const msg = reprompt.mock.calls[0]![0];
    expect(msg).toContain("confidence");
  });

  it("sigue invalida tras maxAttempts -> LLMValidationError sin prompt ni keys", async () => {
    const SECRET = "sk-deadbeef-API-KEY";
    const PROMPT = "RUT 12.345.678-9 del ciudadano sensible";
    const reprompt = vi.fn(async () => MISSING_FIELD); // nunca se corrige
    let caught: unknown;
    try {
      await parseAndValidate(schema, MISSING_FIELD, { reprompt, maxAttempts: 2 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LLMValidationError);
    const err = caught as LLMValidationError;
    const serialized = `${err.message} ${JSON.stringify(err)}`;
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain(PROMPT);
    // El error expone los issues zod, no secretos.
    expect((err as LLMValidationError & { issues?: unknown }).issues).toBeDefined();
  });

  it("raw undefined o JSON no parseable -> tratado como invalido, entra al repair loop", async () => {
    const reprompt = vi.fn(async () => VALID);
    const data = await parseAndValidate(schema, undefined, { reprompt, maxAttempts: 1 });
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(reprompt).toHaveBeenCalledTimes(1);

    const reprompt2 = vi.fn(async () => VALID);
    const data2 = await parseAndValidate(schema, "{not json", { reprompt: reprompt2, maxAttempts: 1 });
    expect(data2).toEqual({ decision: "match", confidence: 0.9 });
    expect(reprompt2).toHaveBeenCalledTimes(1);
  });

  // WR-01: maxAttempts negativo NO debe lanzar LLMValidationError([]) (error sin
  // issues): se clampa a 0 -> corre la validacion inicial y produce un error con
  // issues reales si la salida es invalida.
  it("WR-01 maxAttempts negativo -> corre validacion inicial; error con issues, no vacio", async () => {
    const reprompt = vi.fn(async () => VALID);
    let caught: unknown;
    try {
      await parseAndValidate(schema, MISSING_FIELD, { reprompt, maxAttempts: -5 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LLMValidationError);
    expect((caught as LLMValidationError).issues.length).toBeGreaterThan(0);
    // Sin reprompt: maxAttempts<0 -> 0 reprompts.
    expect(reprompt).not.toHaveBeenCalled();
  });

  it("WR-01 maxAttempts negativo con salida valida inicial -> devuelve data, sin reprompt", async () => {
    const reprompt = vi.fn(async () => VALID);
    const data = await parseAndValidate(schema, VALID, { reprompt, maxAttempts: -1 });
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
    expect(reprompt).not.toHaveBeenCalled();
  });
});

// CR-01: el observador ADITIVO `onOutcome` recupera el desenlace ESTRUCTURAL real
// del repair loop (clean / zod-repaired / structured-output-fail / zod-terminal) sin
// alterar el control de flujo. Es la senal que el harness de benchmark usa para no
// sintetizar el outcome.
describe("parseAndValidate — onOutcome (ValidationOutcome, CR-01)", () => {
  const NO_PAYLOAD = "{no es json"; // JSON.parse -> undefined

  it("valido en el intento 0 -> emite { kind: 'clean' } exactamente una vez", async () => {
    const outcomes: ValidationOutcome[] = [];
    await parseAndValidate(schema, VALID, {
      reprompt: async () => undefined,
      maxAttempts: 1,
      onOutcome: (o) => outcomes.push(o),
    });
    expect(outcomes).toEqual([{ kind: "clean" }]);
  });

  it("valido solo tras un reprompt -> { kind: 'zod-repaired', attempts: 1 }", async () => {
    const outcomes: ValidationOutcome[] = [];
    await parseAndValidate(schema, MISSING_FIELD, {
      reprompt: async () => VALID,
      maxAttempts: 1,
      onOutcome: (o) => outcomes.push(o),
    });
    expect(outcomes).toEqual([{ kind: "zod-repaired", attempts: 1 }]);
  });

  it("payload parseable que nunca pasa el schema -> { kind: 'zod-terminal', issues }", async () => {
    const outcomes: ValidationOutcome[] = [];
    let caught: unknown;
    try {
      await parseAndValidate(schema, MISSING_FIELD, {
        reprompt: async () => MISSING_FIELD, // parseable, pero siempre invalido
        maxAttempts: 1,
        onOutcome: (o) => outcomes.push(o),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LLMValidationError);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.kind).toBe("zod-terminal");
    const o = outcomes[0] as Extract<ValidationOutcome, { kind: "zod-terminal" }>;
    expect(o.issues.length).toBeGreaterThan(0);
  });

  it("nunca hay payload parseable -> { kind: 'structured-output-fail' } (NO zod-terminal)", async () => {
    const outcomes: ValidationOutcome[] = [];
    let caught: unknown;
    try {
      await parseAndValidate(schema, NO_PAYLOAD, {
        reprompt: async () => NO_PAYLOAD, // el modelo nunca estructura nada
        maxAttempts: 1,
        onOutcome: (o) => outcomes.push(o),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LLMValidationError);
    expect(outcomes).toEqual([{ kind: "structured-output-fail" }]);
  });

  it("sin onOutcome (produccion) -> comportamiento identico, no lanza", async () => {
    const data = await parseAndValidate(schema, VALID, {
      reprompt: async () => undefined,
      maxAttempts: 1,
    });
    expect(data).toEqual({ decision: "match", confidence: 0.9 });
  });
});

describe("clampRepairAttempts (WR-01)", () => {
  it("undefined -> default 1", () => {
    expect(clampRepairAttempts(undefined)).toBe(1);
  });

  it("negativo -> 0", () => {
    expect(clampRepairAttempts(-3)).toBe(0);
  });

  it("dentro de rango -> sin cambio", () => {
    expect(clampRepairAttempts(2)).toBe(2);
  });

  it("sobre el techo -> clampa al ceiling", () => {
    expect(clampRepairAttempts(9999)).toBe(MAX_REPAIR_ATTEMPTS_CEILING);
  });

  it("NaN -> 0", () => {
    expect(clampRepairAttempts(Number.NaN)).toBe(0);
  });

  it("fraccional -> truncado", () => {
    expect(clampRepairAttempts(2.9)).toBe(2);
  });
});
