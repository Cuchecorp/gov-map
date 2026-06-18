/**
 * GATE DE DEPLOY (ID-07): regresión del golden set. Dos bloques.
 *
 * MODO CI (default, SIN red): corre `correrPipeline` con un writer in-memory y el
 * mock-provider de 04-01 alimentado con `llmEsperado` por caso. Cuenta tp/fp/fn
 * (un auto-aceptar de un id equivocado = fp, pesa al máximo) y calcula precision/recall.
 *   const PRECISION_MIN = 0.95 → `expect(precision).toBeGreaterThanOrEqual(PRECISION_MIN)`
 * Un fallo aquí FALLA el test → BLOQUEA el deploy. El gate NO depende de red ni de la key
 * (Pitfall 5 / T-04-12): CI corre SIEMPRE mockeado.
 *
 * MODO LIVE (gated): `IDENTITY_GOLDEN_LIVE === "1"` activa un describe que instancia el
 * `MiniMaxProvider` REAL (de @obs/llm) y mide la precisión real de MiniMax-M3 contra el
 * mismo umbral. Skip por defecto (no quema cuota). Espeja el patrón de smoke.test.ts.
 */
import { describe, it, expect } from "vitest";
import type { LLMProvider } from "@obs/llm";
import { MiniMaxProvider } from "@obs/llm";
import { MockMiniMaxProvider } from "../mock-provider";
import { GOLDEN_SET, evaluarGolden } from "./golden-set";

const PRECISION_MIN = 0.95;
const RECALL_MIN = 0.8;

/**
 * Mock keyed por mención: para cada caso, devuelve su `llmEsperado` cuando el prompt
 * contiene el `nombreOriginal`. Los casos que no llegan al LLM (no_match por blocking 0,
 * o determinista) no consultan el mock.
 */
function mockDelGolden(): LLMProvider {
  const mapa: Record<string, CasoGoldenLlm> = {};
  for (const c of GOLDEN_SET) {
    mapa[c.mencion.nombreOriginal] = c.llmEsperado;
  }
  return new MockMiniMaxProvider(mapa);
}
type CasoGoldenLlm = (typeof GOLDEN_SET)[number]["llmEsperado"];

describe("golden set — gate de deploy (mock, sin red)", () => {
  it("cubre las 5 categorías obligatorias + Walker + no_match + región distinta", () => {
    const cats = new Set(GOLDEN_SET.map((c) => c.categoria));
    expect(cats.has("abreviatura-canonica")).toBe(true);
    expect(cats.has("homonimo")).toBe(true);
    expect(cats.has("nombre-casada")).toBe(true);
    expect(cats.has("inicial")).toBe(true);
    expect(cats.has("grafia")).toBe(true);
    expect(cats.has("no-match")).toBe(true);
    expect(cats.has("region-distinta")).toBe(true);
    // "Walker P., Matías" presente.
    expect(GOLDEN_SET.some((c) => c.mencion.nombreOriginal === "Walker P., Matías")).toBe(true);
    // ≥20 casos.
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(20);
  });

  it("precisión ≥ 0.95 (un fallo BLOQUEA el deploy)", async () => {
    const provider = mockDelGolden();
    const m = await evaluarGolden(GOLDEN_SET, provider);
    if (m.precision < PRECISION_MIN) {
      // Visibiliza los falsos positivos en el output del CI.
      console.error("Golden FP/FN:", m.detalle.filter((d) => !d.ok));
    }
    expect(m.precision).toBeGreaterThanOrEqual(PRECISION_MIN);
  });

  it("recall ≥ 0.80", async () => {
    const provider = mockDelGolden();
    const m = await evaluarGolden(GOLDEN_SET, provider);
    expect(m.recall).toBeGreaterThanOrEqual(RECALL_MIN);
  });
});

// ── MODO LIVE (gated): mide precisión real de MiniMax-M3. Skip por defecto. ──
const LIVE = process.env.IDENTITY_GOLDEN_LIVE === "1";

(LIVE ? describe : describe.skip)(
  "golden set LIVE — MiniMax-M3 real (IDENTITY_GOLDEN_LIVE=1)",
  () => {
    it.skipIf(!process.env.MINIMAX_API_KEY)(
      "mide precisión real contra el mismo umbral (informativo + gate)",
      async () => {
        const provider = new MiniMaxProvider({ apiKey: process.env.MINIMAX_API_KEY! });
        const m = await evaluarGolden(GOLDEN_SET, provider);
        // Log de la precisión real (no quema cuota en CI: solo corre con el flag).
        console.log(
          `golden LIVE MiniMax-M3: precision=${m.precision.toFixed(3)} recall=${m.recall.toFixed(3)} ` +
            `(tp=${m.tp} fp=${m.fp} fn=${m.fn})`,
        );
        expect(m.precision).toBeGreaterThanOrEqual(PRECISION_MIN);
      },
    );
  },
);
