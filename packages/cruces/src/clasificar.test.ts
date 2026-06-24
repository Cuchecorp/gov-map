/**
 * Tests Wave 0 del clasificador de sector (seguridad load-bearing):
 *   (a) RUT-gate: clasificarContraparte con un RUT en el nombre lanza ANTES de llamar al LLM
 *       (cero invocaciones al provider mock) — T-36-06.
 *   (b) routing/sensibilidad: clasificarFicha entrega `sensitivity:"public"`+`criticality:"bulk"`;
 *       clasificarContraparte entrega `sensitivity:"personal"`+`criticality:"critical"` — T-36-07.
 *   (c) abstención: el mock devuelve `{sector_codigo:null}` y el clasificador lo propaga sin error.
 *   (d) taxonomía cerrada: una salida del LLM fuera de SECTOR_CODIGOS es rechazada por el zod gate.
 */
import { describe, it, expect } from "vitest";
import { RutInLlmInputError } from "@obs/llm";
import { clasificarFicha, clasificarContraparte } from "./clasificar";
import { MockClasificadorProvider } from "./mock-provider";
import type { ClasificacionSector } from "./model";

describe("clasificarContraparte — gate de RUT (T-36-06)", () => {
  // El gate load-bearing es `assertNoRutInLlmInput`, invocado PRIMERO en clasificar.ts antes
  // de provider.complete; aquí se ejerce su efecto observable (RutInLlmInputError + 0 llamadas).
  it("lanza RutInLlmInputError y NO invoca al LLM cuando el nombre contiene un RUT", async () => {
    const provider = new MockClasificadorProvider({ sector_codigo: "salud" });

    await expect(
      clasificarContraparte(
        { nombre: "Clínica Las Condes S.A. 96.872.730-K" },
        provider,
      ),
    ).rejects.toBeInstanceOf(RutInLlmInputError);

    // El gate abortó ANTES de complete: cero llamadas al modelo.
    expect(provider.callCount).toBe(0);
    expect(provider.requests).toHaveLength(0);
  });

  it("el mensaje del error NUNCA filtra el RUT ni el nombre", async () => {
    const provider = new MockClasificadorProvider({ sector_codigo: "salud" });
    try {
      await clasificarContraparte({ nombre: "Empresa 12.345.678-9" }, provider);
      throw new Error("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(RutInLlmInputError);
      expect((e as Error).message).not.toContain("12.345.678-9");
      expect((e as Error).message).not.toContain("Empresa");
    }
  });
});

describe("routing y sensibilidad por ruta (T-36-07)", () => {
  it("clasificarFicha usa sensitivity:public + criticality:bulk", async () => {
    const provider = new MockClasificadorProvider({ sector_codigo: "educacion" });
    await clasificarFicha(
      { idea_matriz: "Modifica la Ley General de Educación" },
      provider,
    );
    expect(provider.callCount).toBe(1);
    expect(provider.requests[0]?.sensitivity).toBe("public");
    expect(provider.requests[0]?.criticality).toBe("bulk");
  });

  it("clasificarContraparte usa sensitivity:personal + criticality:critical (sin RUT)", async () => {
    const provider = new MockClasificadorProvider({ sector_codigo: "salud" });
    await clasificarContraparte(
      { nombre: "Asociación de Clínicas de Chile" },
      provider,
    );
    expect(provider.callCount).toBe(1);
    expect(provider.requests[0]?.sensitivity).toBe("personal");
    expect(provider.requests[0]?.criticality).toBe("critical");
  });
});

describe("abstención first-class (D-05/D-08)", () => {
  it("propaga sector_codigo:null sin error (ficha)", async () => {
    const provider = new MockClasificadorProvider({ sector_codigo: null });
    const out = await clasificarFicha({ titulo: "Proyecto sin materia clara" }, provider);
    expect(out).toEqual({ sector_codigo: null });
  });

  it("propaga sector_codigo:null sin error (contraparte)", async () => {
    const provider = new MockClasificadorProvider({ sector_codigo: null });
    const out = await clasificarContraparte({ nombre: "Persona Genérica" }, provider);
    expect(out).toEqual({ sector_codigo: null });
  });
});

describe("taxonomía cerrada (T-36-08) — zod gate", () => {
  it("rechaza una salida del LLM fuera de SECTOR_CODIGOS", async () => {
    // Forzamos una salida inválida (código inexistente) por el mock; el gate zod del schema
    // dentro de complete() debe rechazarla.
    const provider = new MockClasificadorProvider({
      sector_codigo: "codigo_inexistente",
    } as unknown as ClasificacionSector);
    await expect(
      clasificarFicha({ titulo: "Algo" }, provider),
    ).rejects.toBeTruthy();
  });
});
