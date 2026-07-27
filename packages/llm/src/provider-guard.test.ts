/**
 * Guard prospectivo: enumera TODOS los providers LLM en packages/llm/src/providers/
 * y asevera que cada uno contiene el wrapper zod+PII obligatorio.
 *
 * EXCLUSIÓN documentada: gemini-embeddings.ts es EmbeddingProvider (no LLMProvider)
 * y no maneja datos de usuario con el mismo patrón — se excluye explícitamente.
 *
 * Valor de este guard: HOY no hay violaciones (deepseek/minimax/granite/phi-judge
 * tienen los guards por construcción en 107/108). El guard es PROSPECTIVO: un
 * provider futuro añadido sin los wrappers ROMPE CI antes de mergear.
 *
 * Gotcha TIER-05 locked: usar import.meta.dirname, NUNCA new URL(import.meta.url)
 * (falla en vitest).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Predicado puro: retorna true si el source de un provider NO tiene los guards
 * obligatorios. Extraído como función reutilizable para el mutation self-check.
 */
function esProviderSinGuard(source: string): boolean {
  return (
    !source.includes("assertNoRutInLlmInput") ||
    !source.includes("assertSensitivityAllowed")
  );
}

const PROVIDERS_DIR = join(import.meta.dirname, "providers");

// Enumera providers LLM reales (excluye tests y gemini-embeddings)
function listarProviders(): string[] {
  return readdirSync(PROVIDERS_DIR).filter(
    (f) =>
      f.endsWith(".ts") &&
      !f.endsWith(".test.ts") &&
      f !== "gemini-embeddings.ts",
  );
}

describe("Guard prospectivo: todos los providers LLM tienen wrapper zod+PII", () => {
  it("Test 1 (positivo): cada provider contiene assertNoRutInLlmInput y assertSensitivityAllowed", () => {
    const providers = listarProviders();

    const offenders: string[] = [];
    for (const filename of providers) {
      const source = readFileSync(join(PROVIDERS_DIR, filename), "utf-8");
      if (esProviderSinGuard(source)) {
        offenders.push(filename);
      }
    }

    expect(
      offenders,
      `Providers sin wrapper zod+PII (deben tener assertNoRutInLlmInput + assertSensitivityAllowed): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("Test 2 (mutation self-check): un source sintético SIN assertNoRutInLlmInput es detectado como offender", () => {
    // Prueba que el predicado MUERDE — el guard no es vacuo
    const syntheticSinGuard = `
      export class FakeProvider {
        async complete(req, schema) {
          // Este provider no tiene los guards obligatorios
          return {};
        }
      }
    `;
    expect(
      esProviderSinGuard(syntheticSinGuard),
      "El predicado debe detectar un provider sin guards como offender",
    ).toBe(true);

    // Contraejemplo: un source con los guards NO es offender
    const syntheticConGuards = `
      assertNoRutInLlmInput(req.user);
      assertSensitivityAllowed({ sensitivity: req.sensitivity }, this);
    `;
    expect(
      esProviderSinGuard(syntheticConGuards),
      "Un source con ambos guards no debe ser offender",
    ).toBe(false);
  });

  it("Test 3 (enumeración no-vacía): la lista de providers tiene length ≥ 4", () => {
    const providers = listarProviders();
    expect(
      providers.length,
      `Se esperan ≥4 providers LLM; se encontraron ${providers.length}: [${providers.join(", ")}]. Si este test falla, el glob roto causaría falso verde en Test 1.`,
    ).toBeGreaterThanOrEqual(4);
  });
});
