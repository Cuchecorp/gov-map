/**
 * Guard de integración 109: asevera que la escalera TieredProvider NO está cableada
 * en la ruta de adjudicación ni en la extracción strict-schema.
 *
 * Landmines (RESEARCH §Landmines):
 *   1. clasificar-lobby-cli.ts = adjudicación MiniMax. Ruta INTOCABLE.
 *   2. fichas/src/pipeline-cli.ts = extracción vetada es-CL (prompt-cache DeepSeek vivo).
 *
 * TIER-05 (tiered-scope-guard.test.ts) ya cubre pipeline-cli.ts; este guard
 * re-asevera desde 109 para que la fase falle si el swap de Wave 2 toca fichas
 * por error, Y añade la cobertura de clasificar-lobby-cli.ts.
 *
 * Archivo NUEVO paralelo — NO modifica tiered-scope-guard.test.ts (evita colisión
 * de ownership con 108).
 *
 * Gotcha TIER-05 locked: usar import.meta.dirname, NUNCA new URL(import.meta.url).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Predicado puro: retorna true si el source contiene TieredProvider (es offender).
 * Extraído para el mutation self-check.
 */
function contieneTiered(source: string): boolean {
  return source.includes("TieredProvider");
}

// Raíz del monorepo: packages/llm/src → ../../../
const MONO_ROOT = join(import.meta.dirname, "..", "..", "..");

describe("Guard de integración 109: TieredProvider NO en adjudicación/extracción", () => {
  it("Test 1: packages/cruces/src/clasificar-lobby-cli.ts NO contiene TieredProvider (adjudicación MiniMax intacta)", () => {
    const lobbyCliPath = join(
      MONO_ROOT,
      "packages",
      "cruces",
      "src",
      "clasificar-lobby-cli.ts",
    );

    const source = readFileSync(lobbyCliPath, "utf-8");

    // Si este guard muerde: el swap de clasificar-fichas-cli tocó lobby por error
    expect(source).not.toContain("TieredProvider");
  });

  it("Test 2: packages/fichas/src/pipeline-cli.ts NO contiene TieredProvider (extracción vetada es-CL)", () => {
    const pipelineCliPath = join(
      MONO_ROOT,
      "packages",
      "fichas",
      "src",
      "pipeline-cli.ts",
    );

    const source = readFileSync(pipelineCliPath, "utf-8");

    // Re-asevera TIER-05 desde 109 para que la fase falle si fichas se toca por error
    expect(source).not.toContain("TieredProvider");
  });

  it("Test 3 (mutation self-check): un source sintético CON TieredProvider es detectado como offender", () => {
    // Prueba que el predicado MUERDE — el guard no es vacuo
    const syntheticConTiered = `
      import { TieredProvider } from "@obs/llm";
      const provider = new TieredProvider(ladderConfig);
    `;
    expect(
      contieneTiered(syntheticConTiered),
      "El predicado debe detectar TieredProvider como offender",
    ).toBe(true);

    // Contraejemplo: source limpio NO es offender
    const syntheticLimpio = `
      import { DeepSeekProvider } from "@obs/llm";
      const provider = new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY ?? "" });
    `;
    expect(
      contieneTiered(syntheticLimpio),
      "Un source sin TieredProvider no debe ser offender",
    ).toBe(false);
  });
});
