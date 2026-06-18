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
import type { CasoGolden } from "./golden-set";
import {
  GOLDEN_SET,
  GOLDEN_SET_GATE,
  GOLDEN_SET_ADVERSARIO,
  ID_CASO_ADVERSARIO,
  evaluarGolden,
} from "./golden-set";

const PRECISION_MIN = 0.95;
const RECALL_MIN = 0.8;

/**
 * Mock keyed por mención: para cada caso, devuelve su `llmEsperado` cuando el prompt
 * embebe ese `nombreOriginal` en la línea `- nombre:`. Los casos que no llegan al LLM
 * (no_match por blocking 0, o determinista) no consultan el mock.
 *
 * RECHAZA claves duplicadas (CR-02): si dos casos comparten `nombreOriginal`, una
 * sobrescribiría a la otra en silencio y el gate mediría el fixture equivocado. Un
 * choque revienta el test (la construcción del map) en vez de pasar/fallar en falso.
 */
function mockDelGolden(set: CasoGolden[] = GOLDEN_SET): LLMProvider {
  const mapa: Record<string, CasoGoldenLlm> = {};
  for (const c of set) {
    const k = c.mencion.nombreOriginal;
    if (k in mapa) {
      throw new Error(
        `mockDelGolden: nombreOriginal duplicado "${k}" (caso ${c.id}); las claves del mock deben ser únicas`,
      );
    }
    mapa[k] = c.llmEsperado;
  }
  return new MockMiniMaxProvider(mapa);
}
type CasoGoldenLlm = (typeof GOLDEN_SET)[number]["llmEsperado"];

describe("golden set — gate de deploy (mock, sin red)", () => {
  it("cubre las 5 categorías obligatorias + Walker + no_match + región distinta", () => {
    const cats = new Set(GOLDEN_SET_GATE.map((c) => c.categoria));
    expect(cats.has("abreviatura-canonica")).toBe(true);
    expect(cats.has("homonimo")).toBe(true);
    expect(cats.has("nombre-casada")).toBe(true);
    expect(cats.has("inicial")).toBe(true);
    expect(cats.has("grafia")).toBe(true);
    expect(cats.has("no-match")).toBe(true);
    expect(cats.has("region-distinta")).toBe(true);
    // "Walker P., Matías" presente.
    expect(GOLDEN_SET_GATE.some((c) => c.mencion.nombreOriginal === "Walker P., Matías")).toBe(true);
    // ≥20 casos en el set del gate (sin contar el adversario).
    expect(GOLDEN_SET_GATE.length).toBeGreaterThanOrEqual(20);
  });

  it("precisión ≥ 0.95 sobre GOLDEN_SET_GATE (un fallo BLOQUEA el deploy)", async () => {
    const provider = mockDelGolden(GOLDEN_SET_GATE);
    const m = await evaluarGolden(GOLDEN_SET_GATE, provider);
    if (m.precision < PRECISION_MIN) {
      // Visibiliza los falsos positivos en el output del CI.
      console.error("Golden FP/FN:", m.detalle.filter((d) => !d.ok));
    }
    expect(m.precision).toBeGreaterThanOrEqual(PRECISION_MIN);
  });

  it("recall ≥ 0.80 sobre GOLDEN_SET_GATE", async () => {
    const provider = mockDelGolden(GOLDEN_SET_GATE);
    const m = await evaluarGolden(GOLDEN_SET_GATE, provider);
    expect(m.recall).toBeGreaterThanOrEqual(RECALL_MIN);
  });
});

// ── META-PRUEBA (CR-02): el gate PUEDE fallar. Prueba que la métrica está VIVA. ──
describe("golden set — el gate NO es una tautología (la rama fp es alcanzable)", () => {
  it("un id auto-aceptado EQUIVOCADO con alta confianza cuenta como fp y BAJA la precisión < 0.95", async () => {
    // El caso adversario: el mock afirma P00998 (alta confianza) cuando el correcto es
    // P00999. La compuerta auto-acepta P00998 como `probable`; `evaluarGolden` lo cuenta
    // como FALSO POSITIVO. Aislado, tp=0 fp=1 → precision=0 → bajo el umbral. Esto prueba
    // que un model-driven false positive HACE FALLAR el gate (no es teatro).
    expect(GOLDEN_SET_ADVERSARIO.length).toBeGreaterThanOrEqual(1);
    const provider = mockDelGolden(GOLDEN_SET_ADVERSARIO);
    const m = await evaluarGolden(GOLDEN_SET_ADVERSARIO, provider);

    expect(m.fp).toBeGreaterThanOrEqual(1); // la rama fp ES alcanzable
    expect(m.precision).toBeLessThan(PRECISION_MIN); // y baja la precisión bajo el umbral
    const adv = m.detalle.find((d) => d.id === ID_CASO_ADVERSARIO)!;
    expect(adv.ok).toBe(false);
    expect(adv.nota).toMatch(/FALSO POSITIVO/);
  });

  it("inyectar el adversario en el set del gate lo hace caer bajo el umbral (el gate fallaría)", async () => {
    // Demuestra el efecto a nivel del gate completo: con el adversario adentro, la
    // precisión del set cae bajo 0.95 → el `expect(...).toBeGreaterThanOrEqual` del gate
    // fallaría. Por eso el adversario se excluye del set del gate y vive aislado.
    const conAdversario = [...GOLDEN_SET_GATE, ...GOLDEN_SET_ADVERSARIO];
    const provider = mockDelGolden(conAdversario);
    const m = await evaluarGolden(conAdversario, provider);
    expect(m.precision).toBeLessThan(PRECISION_MIN);
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
        // LIVE mide MiniMax-M3 real sobre el set del gate (sin el caso adversario, que
        // fija una respuesta inválida del mock y no aplica al modelo real).
        const m = await evaluarGolden(GOLDEN_SET_GATE, provider);
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
