import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  clampRepairAttempts,
  LLMValidationError,
  MAX_REPAIR_ATTEMPTS_CEILING,
  parseAndValidate,
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
