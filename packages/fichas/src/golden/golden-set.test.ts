/**
 * GATE DE CALIDAD (flag P7): regresión del golden set de EXTRACCIÓN LITERAL. Dos bloques.
 *
 * MODO CI (default, SIN red): corre `extraer` con el MockDeepSeekProvider alimentado con el
 * `llmEsperado` de cada caso. `evaluarGolden` cuenta tp/fp/fn de la FIDELIDAD LITERAL (una
 * idea matriz que NO es substring del texto, o un cuerpo legal fabricado = fp) y calcula
 * precision/recall.
 *   const PRECISION_MIN = 0.95 → `expect(precision).toBeGreaterThanOrEqual(PRECISION_MIN)`
 * Un fallo aquí FALLA el test → BLOQUEA el deploy. El gate NO depende de red ni de la key
 * (Pitfall 5): CI corre SIEMPRE mockeado.
 *
 * MODO LIVE (gated): `FICHAS_GOLDEN_LIVE === "1"` activa un describe que instancia el
 * `DeepSeekProvider` REAL (de @obs/llm) y mide la fidelidad real de DeepSeek contra el mismo
 * umbral. Skip por defecto (no quema cuota).
 */
import { describe, it, expect } from "vitest";
import { DeepSeekProvider } from "@obs/llm";
import { extraer } from "../extraer";
import { MockDeepSeekProvider } from "../mock-provider";
import type { Ficha } from "../model";
import type { CasoGolden } from "./golden-set";
import {
  GOLDEN_SET,
  GOLDEN_SET_GATE,
  GOLDEN_SET_ADVERSARIO,
  ID_CASO_ADVERSARIO,
  IDS_CASOS_ADVERSARIOS,
  evaluarGolden,
} from "./golden-set";

const PRECISION_MIN = 0.95;
const RECALL_MIN = 0.8;

/**
 * Ejecuta `extraer` para un caso con un MockDeepSeekProvider que devuelve su `llmEsperado`.
 * Un provider por caso evita el keying global y mantiene el aislamiento (sin red).
 */
function ejecutarConMock(caso: CasoGolden): Promise<Ficha> {
  const provider = new MockDeepSeekProvider(caso.llmEsperado);
  return extraer(caso.textoFuente, caso.proyecto, provider);
}

describe("golden set fichas — gate de calidad (mock, sin red)", () => {
  it("tiene ≥15 casos y ≥1 caso adversarial de degradación honesta (expected null)", () => {
    expect(GOLDEN_SET_GATE.length).toBeGreaterThanOrEqual(15);
    const adversariales = GOLDEN_SET_GATE.filter(
      (c) => c.expected.idea_matriz_substring === null,
    );
    expect(adversariales.length).toBeGreaterThanOrEqual(1);
  });

  it("cubre extracción positiva, degradación honesta y múltiples normas", () => {
    const cats = new Set(GOLDEN_SET_GATE.map((c) => c.categoria));
    expect(cats.has("idea-y-cuerpos")).toBe(true);
    expect(cats.has("solo-idea")).toBe(true);
    expect(cats.has("sin-idea-matriz")).toBe(true);
    expect(cats.has("multiples-normas")).toBe(true);
  });

  it("precisión ≥ 0.95 sobre GOLDEN_SET_GATE (un fallo BLOQUEA el deploy)", async () => {
    const m = await evaluarGolden(GOLDEN_SET_GATE, ejecutarConMock);
    if (m.precision < PRECISION_MIN) {
      console.error("Golden FP/FN:", m.detalle.filter((d) => !d.ok));
    }
    expect(m.precision).toBeGreaterThanOrEqual(PRECISION_MIN);
  });

  it("recall ≥ 0.80 sobre GOLDEN_SET_GATE", async () => {
    const m = await evaluarGolden(GOLDEN_SET_GATE, ejecutarConMock);
    expect(m.recall).toBeGreaterThanOrEqual(RECALL_MIN);
  });
});

// ── META-PRUEBA: el gate PUEDE fallar. Prueba que la métrica está VIVA (no teatro). ──
describe("golden set fichas — el gate NO es una tautología (la rama fp es alcanzable)", () => {
  it("una idea fabricada / cuerpo fabricado cuenta como fp y BAJA la precisión < 0.95", async () => {
    expect(GOLDEN_SET_ADVERSARIO.length).toBeGreaterThanOrEqual(1);
    const m = await evaluarGolden(GOLDEN_SET_ADVERSARIO, ejecutarConMock);

    expect(m.fp).toBeGreaterThanOrEqual(1); // la rama fp ES alcanzable
    expect(m.precision).toBeLessThan(PRECISION_MIN); // y baja la precisión bajo el umbral
    const adv = m.detalle.find((d) => d.id === ID_CASO_ADVERSARIO)!;
    expect(adv.ok).toBe(false);
    expect(adv.nota).toMatch(/FALSO POSITIVO/);
  });

  it("inyectar los adversarios en el set del gate lo hace caer bajo el umbral", async () => {
    const conAdversario = [...GOLDEN_SET_GATE, ...GOLDEN_SET_ADVERSARIO];
    const m = await evaluarGolden(conAdversario, ejecutarConMock);
    expect(m.precision).toBeLessThan(PRECISION_MIN);
  });

  it("los casos adversarios están EXCLUIDOS del set del gate", () => {
    for (const id of IDS_CASOS_ADVERSARIOS) {
      expect(GOLDEN_SET_GATE.some((c) => c.id === id)).toBe(false);
      expect(GOLDEN_SET.some((c) => c.id === id)).toBe(true);
    }
  });
});

// ── MODO LIVE (gated): mide fidelidad real de DeepSeek. Skip por defecto. ──
const LIVE = process.env.FICHAS_GOLDEN_LIVE === "1";

(LIVE ? describe : describe.skip)(
  "golden set fichas LIVE — DeepSeek real (FICHAS_GOLDEN_LIVE=1)",
  () => {
    it.skipIf(!process.env.DEEPSEEK_API_KEY)(
      "mide fidelidad literal real contra el mismo umbral (informativo + gate)",
      async () => {
        const provider = new DeepSeekProvider({
          apiKey: process.env.DEEPSEEK_API_KEY!,
        });
        const ejecutarLive = (caso: CasoGolden) =>
          extraer(caso.textoFuente, caso.proyecto, provider);
        const m = await evaluarGolden(GOLDEN_SET_GATE, ejecutarLive);
        console.log(
          `golden fichas LIVE DeepSeek: precision=${m.precision.toFixed(3)} recall=${m.recall.toFixed(3)} ` +
            `(tp=${m.tp} fp=${m.fp} fn=${m.fn})`,
        );
        expect(m.precision).toBeGreaterThanOrEqual(PRECISION_MIN);
      },
    );
  },
);
