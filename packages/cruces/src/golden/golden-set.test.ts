/**
 * GATE DE CALIDAD del clasificador de sector (CRUCE-02). Dos bloques.
 *
 * MODO CI (default, SIN red): corre `evaluarGolden` sobre la MUESTRA del gate con el
 * MockClasificadorProvider alimentado con el `sector_codigo` de oro de cada caso. El scoring es
 * SINGLE-LABEL TOP-1 + ABSTENCIÓN (NO substring): `gatePasa` exige cobertura ≥ 0.7 (≥7/10) Y
 * cero misclasificaciones. Un fallo aquí FALLA el test → bloquea la corrida LIVE de Plan 04.
 *
 * Incluye los 3 casos de BEHAVIOR (contrato del scoring): 10-correctos→pasa,
 * 10-abstención→0 cobertura/0 errores, 1-sector-distinto→error que falla el gate.
 *
 * MODO LIVE (gated): `CRUCES_GOLDEN_LIVE === "1"` instancia DeepSeek (fichas) / MiniMax
 * (contrapartes) reales y mide la cobertura real contra el mismo gate. Skip por defecto (no
 * quema cuota). Espejo de fichas golden-set.ts:13-15.
 */
import { describe, it, expect } from "vitest";
import { DeepSeekProvider, MiniMaxProvider, type LLMProvider } from "@obs/llm";
import { clasificarFicha, clasificarContraparte } from "../clasificar";
import { MockClasificadorProvider } from "../mock-provider";
import type { ClasificacionSector } from "../model";
import {
  GOLDEN_SET,
  GOLDEN_SET_GATE,
  COBERTURA_MIN,
  evaluarGolden,
  gatePasa,
  inputDeCaso,
  type CasoGolden,
} from "./golden-set";

/** Ejecuta un caso con un provider dado (mock en CI; real en LIVE), eligiendo la ruta por tipo. */
function ejecutarCon(
  provider: LLMProvider,
): (caso: CasoGolden) => Promise<ClasificacionSector> {
  return (caso) => {
    const d = inputDeCaso(caso);
    return d.tipo === "contraparte"
      ? clasificarContraparte(d.input, provider)
      : clasificarFicha(d.input, provider);
  };
}

/** En CI cada caso usa un mock que devuelve su `sector_codigo` de oro (clasificador "perfecto"). */
function ejecutarConMockOro(caso: CasoGolden): Promise<ClasificacionSector> {
  const provider = new MockClasificadorProvider({ sector_codigo: caso.sector_codigo });
  return ejecutarCon(provider)(caso);
}

describe("golden set sector — estructura del set", () => {
  it("tiene ~40 casos y al menos una abstención esperada (sector null)", () => {
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(35);
    expect(GOLDEN_SET.some((c) => c.sector_codigo === null)).toBe(true);
  });

  it("la muestra del gate tiene 10 casos, todos con sector no-null", () => {
    expect(GOLDEN_SET_GATE.length).toBe(10);
    expect(GOLDEN_SET_GATE.every((c) => c.sector_codigo !== null)).toBe(true);
  });

  it("cubre ambas rutas (ficha y contraparte)", () => {
    const tipos = new Set(GOLDEN_SET.map((c) => c.tipo));
    expect(tipos.has("ficha")).toBe(true);
    expect(tipos.has("contraparte")).toBe(true);
  });
});

describe("golden set sector — gate ≥7/10 con scoring top-1/abstención (mock, sin red)", () => {
  it("el clasificador-oro cubre 10/10 con cero errores → gate PASA", async () => {
    const m = await evaluarGolden(GOLDEN_SET_GATE, ejecutarConMockOro);
    expect(m.cobertura).toBe(1);
    expect(m.errores).toBe(0);
    expect(gatePasa(m)).toBe(true);
  });
});

// ── BEHAVIOR (contrato del scoring): los 3 casos del plan ──
describe("golden set sector — scoring single-label top-1 + abstención (behavior)", () => {
  const muestra = GOLDEN_SET_GATE;

  it("10 correctos → 10/10 cobertura, 0 errores → gate PASA", async () => {
    const m = await evaluarGolden(muestra, ejecutarConMockOro);
    expect(m.correctos).toBe(10);
    expect(m.noCubiertos).toBe(0);
    expect(m.misclasificaciones).toBe(0);
    expect(m.cobertura).toBe(1);
    expect(gatePasa(m)).toBe(true);
  });

  it("10 abstenciones (null) → 0 cobertura pero 0 errores (abstención NO es error)", async () => {
    // El mock abstiene siempre: cada caso recibe sector_codigo:null.
    const provider = new MockClasificadorProvider({ sector_codigo: null });
    const m = await evaluarGolden(muestra, ejecutarCon(provider));
    expect(m.correctos).toBe(0);
    expect(m.noCubiertos).toBe(10);
    expect(m.misclasificaciones).toBe(0); // abstención NUNCA cuenta como error
    expect(m.cobertura).toBe(0);
    expect(m.cobertura).toBeLessThan(COBERTURA_MIN); // falla el bar ≥7/10
    expect(gatePasa(m)).toBe(false); // por baja cobertura, NO por errores
  });

  it("un caso con sector distinto al golden → error que FALLA el gate aunque cobertura sea alta", async () => {
    // 9 correctos (mock-oro) + 1 forzado a un sector distinto del esperado.
    const objetivo = muestra[0]!;
    const sectorDistinto =
      objetivo.sector_codigo === "salud" ? "educacion" : "salud";
    const ejecutar = (caso: CasoGolden): Promise<ClasificacionSector> => {
      if (caso.id === objetivo.id) {
        const provider = new MockClasificadorProvider({ sector_codigo: sectorDistinto });
        return ejecutarCon(provider)(caso);
      }
      return ejecutarConMockOro(caso);
    };
    const m = await evaluarGolden(muestra, ejecutar);
    expect(m.misclasificaciones).toBe(1);
    expect(m.errores).toBe(1);
    expect(m.cobertura).toBeGreaterThanOrEqual(COBERTURA_MIN); // 9/10 = alta cobertura
    expect(gatePasa(m)).toBe(false); // …pero el error la hace FALLAR
  });
});

// ── MODO LIVE (gated): mide cobertura real de DeepSeek/MiniMax. Skip por defecto. ──
const LIVE = process.env.CRUCES_GOLDEN_LIVE === "1";

(LIVE ? describe : describe.skip)(
  "golden set sector LIVE — DeepSeek/MiniMax reales (CRUCES_GOLDEN_LIVE=1)",
  () => {
    it.skipIf(!process.env.DEEPSEEK_API_KEY || !process.env.MINIMAX_API_KEY)(
      "mide cobertura real contra el gate ≥7/10 (informativo + gate)",
      async () => {
        const deepseek = new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY! });
        const minimax = new MiniMaxProvider({ apiKey: process.env.MINIMAX_API_KEY! });
        const ejecutarLive = (caso: CasoGolden): Promise<ClasificacionSector> => {
          const d = inputDeCaso(caso);
          return d.tipo === "contraparte"
            ? clasificarContraparte(d.input, minimax)
            : clasificarFicha(d.input, deepseek);
        };
        const m = await evaluarGolden(GOLDEN_SET_GATE, ejecutarLive);
        console.log(
          `golden sector LIVE: cobertura=${m.cobertura.toFixed(3)} ` +
            `correctos=${m.correctos} noCubiertos=${m.noCubiertos} errores=${m.errores}`,
        );
        expect(gatePasa(m)).toBe(true);
      },
    );
  },
);
