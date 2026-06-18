/**
 * Smoke test LIVE por proveedor — GATED por env (`LLM_SMOKE=1`), SKIP por defecto.
 *
 * CI NO lo corre (no quema cuota, no expone keys). Usa las keys reales de env y el
 * `fetch` global real; hace 1 llamada minima por proveedor y asserta el shape.
 *
 * Correr una vez manualmente para confirmar las asunciones del RESEARCH:
 *   LLM_SMOKE=1 pnpm --filter @obs/llm test --run smoke
 * Confirma A1 (MiniMax forced tool_choice produce arguments validables) y
 * A4 (Gemini batch embedding shape: 768 dims versionados).
 *
 * Las keys salen SOLO de env; jamas se imprimen ni entran a asserts. Si una key
 * falta, el sub-test se salta (no falla la corrida).
 *
 * NOTA: el sub-test de Gemini construye `GeminiEmbeddingProvider` (lo rellena la
 * rebanada 02-03 sobre un stub que ya existe desde 02-01). El import resuelve aunque
 * 02-03 no haya corrido; el sub-test solo se ejecuta con LLM_SMOKE=1, asi que NO
 * bloquea la suite por orden de waves.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DeepSeekProvider } from "./providers/deepseek";
import { MiniMaxProvider } from "./providers/minimax";
import { GeminiEmbeddingProvider } from "./providers/gemini-embeddings";

const LIVE = process.env.LLM_SMOKE === "1";

const echoSchema = z.object({
  ok: z.boolean(),
});

(LIVE ? describe : describe.skip)("smoke live providers (LLM_SMOKE=1)", () => {
  it.skipIf(!process.env.DEEPSEEK_API_KEY)(
    "DeepSeek devuelve un objeto validado por zod",
    async () => {
      const p = new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY! });
      const data = await p.complete(
        { user: 'Return {"ok": true} as JSON.', criticality: "bulk", sensitivity: "public" },
        echoSchema,
      );
      expect(data.ok).toBe(true);
    },
  );

  it.skipIf(!process.env.MINIMAX_API_KEY)(
    "MiniMax (tool_choice forzado, A1) devuelve un objeto validado por zod",
    async () => {
      const p = new MiniMaxProvider({ apiKey: process.env.MINIMAX_API_KEY! });
      const data = await p.complete(
        { user: "Call emit_result with ok=true.", criticality: "critical", sensitivity: "public" },
        echoSchema,
      );
      expect(data.ok).toBe(true);
    },
  );

  it.skipIf(!process.env.GEMINI_API_KEY)(
    "Gemini embeddings (A4) devuelve un vector de 768 dims versionado",
    async () => {
      const p = new GeminiEmbeddingProvider();
      const [result] = await p.embed(["texto publico de prueba"]);
      expect(result!.vector).toHaveLength(768);
      expect(result!.dims).toBe(768);
      expect(result!.model).toBeTruthy();
      expect(result!.version).toBeTruthy();
    },
  );
});
