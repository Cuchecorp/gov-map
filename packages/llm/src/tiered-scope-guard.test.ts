/**
 * Guard estructural TIER-05: asevera que packages/fichas/src/pipeline-cli.ts
 * NO contiene `TieredProvider`.
 *
 * El construction point de fichas queda INTACTO (prompt-cache DeepSeek vivo).
 * Si un cambio futuro introduce TieredProvider en fichas, este guard MUERDE.
 *
 * Gotcha conocido: usar import.meta.dirname (no new URL(import.meta.url) — falla en vitest).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Guard estructural TIER-05: pipeline-cli.ts de fichas queda intacto", () => {
  it("packages/fichas/src/pipeline-cli.ts NO contiene TieredProvider", () => {
    // Navegar desde packages/llm/src/ hacia packages/fichas/src/
    const pipelineCliPath = join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "packages",
      "fichas",
      "src",
      "pipeline-cli.ts",
    );

    const source = readFileSync(pipelineCliPath, "utf-8");

    // El guard muerde si TieredProvider aparece en el construction point de fichas
    expect(source).not.toContain("TieredProvider");
  });
});
