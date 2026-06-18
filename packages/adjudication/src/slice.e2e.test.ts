/**
 * Slice e2e del subsistema de identidad asistida (sin red, mock determinista).
 *
 * Composición LOCAL del pipeline (la orquestación definitiva vive en 04-03):
 * mención dudosa → candidatos → assertNoRutInLlmInput(prompt) → LLM mock →
 * aplicarCompuerta → mapeo a estado. Verifica los invariantes existenciales:
 *  - auto-aceptar mapea SOLO a "probable", NUNCA "confirmado" (A4 / T-04-04).
 *  - un RUT que se colaría al prompt aborta ANTES de llamar al provider (0 llamadas, T-04-02).
 */
import { describe, it, expect } from "vitest";
import { assertNoRutInLlmInput, assertSensitivityAllowed } from "@obs/llm";
import type { LLMProvider } from "@obs/llm";
import type { Parlamentario, EstadoIdentidad } from "@obs/core";
import { generarCandidatos } from "./candidatos";
import { AdjudicacionSchema, construirPromptAdjudicacion, SYSTEM_ADJUDICACION } from "./prompt";
import { aplicarCompuerta } from "./compuerta";
import { MockMiniMaxProvider } from "./mock-provider";
import type { MencionForanea } from "./tipos";

function maestro(p: Partial<Parlamentario> & { id: string }): Parlamentario {
  return {
    id: p.id,
    nombre_normalizado: p.nombre_normalizado ?? "",
    nombres: p.nombres ?? "",
    apellido_paterno: p.apellido_paterno ?? "",
    apellido_materno: p.apellido_materno ?? "",
    camara: p.camara ?? "senado",
    periodo: p.periodo ?? "senado-vigente-2026",
    region: p.region ?? null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: "confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

interface ResultadoPipeline {
  ruta: "auto-aceptar" | "revision" | "sin-candidatos";
  estado: EstadoIdentidad;
  chosenId?: string;
  razones?: string[];
}

/**
 * Composición local del slice. Si no hay candidatos → no_confirmado sin LLM.
 * Si hay, construye el prompt, corre el gate de RUT, llama al provider con
 * temperature: 0, aplica la compuerta y mapea auto-aceptar → "probable" (A4).
 */
async function correrPipeline(
  mencion: MencionForanea,
  maestra: Parlamentario[],
  provider: LLMProvider,
): Promise<ResultadoPipeline> {
  const candidatos = generarCandidatos(mencion, maestra);
  if (candidatos.length === 0) {
    return { ruta: "sin-candidatos", estado: "no_confirmado" };
  }

  const userPrompt = construirPromptAdjudicacion(mencion, candidatos);
  // GATE fail-closed: aborta ANTES de cualquier llamada al provider (T-04-02).
  assertNoRutInLlmInput(userPrompt);
  assertSensitivityAllowed({ sensitivity: "personal" }, provider);

  const llm = await provider.complete(
    {
      system: SYSTEM_ADJUDICACION,
      user: userPrompt,
      criticality: "critical",
      sensitivity: "personal",
      temperature: 0,
    },
    AdjudicacionSchema,
  );

  const decision = aplicarCompuerta(llm, mencion, candidatos);
  if (decision.ruta === "auto-aceptar") {
    // A4: auto-aceptar NUNCA produce "confirmado"; lo máximo es "probable".
    return { ruta: "auto-aceptar", estado: "probable", chosenId: decision.chosenId };
  }
  return { ruta: "revision", estado: "no_confirmado", razones: decision.razones };
}

const mencion: MencionForanea = {
  nombreOriginal: "Walker P., Matías",
  nombreNormalizado: "walker matias",
  tokens: ["walker", "matias"],
  camara: "senado",
  periodo: "senado-vigente-2026",
  region: "Valparaíso",
};

const maestra = [
  maestro({
    id: "P00042",
    nombre_normalizado: "walker prieto matias",
    nombres: "Matías",
    apellido_paterno: "Walker",
    apellido_materno: "Prieto",
    camara: "senado",
    periodo: "senado-vigente-2026",
    region: "Valparaíso",
  }),
];

describe("slice e2e — pipeline dudoso → mock LLM → compuerta", () => {
  it("happy path: match/0.97/sin-conflicts → auto-aceptar, estado 'probable' (NUNCA 'confirmado')", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.97,
      evidence: ["apellido y cámara coinciden"],
      conflicts: [],
    });
    const out = await correrPipeline(mencion, maestra, provider);
    expect(out.ruta).toBe("auto-aceptar");
    expect(out.estado).toBe("probable");
    expect(out.estado).not.toBe("confirmado");
    expect(out.chosenId).toBe("P00042");
    expect(provider.callCount).toBe(1);
  });

  it("confidence 0.5 → revisión", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.5,
      evidence: [],
      conflicts: [],
    });
    const out = await correrPipeline(mencion, maestra, provider);
    expect(out.ruta).toBe("revision");
    expect(out.estado).toBe("no_confirmado");
  });

  it("fail-closed PII: un RUT que se colaría al prompt → lanza ANTES del provider (0 llamadas)", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.97,
      evidence: [],
      conflicts: [],
    });
    // Mención cuyo nombreOriginal (incorrectamente) trae un RUT — se colaría al prompt.
    const mencionConRut: MencionForanea = {
      ...mencion,
      nombreOriginal: "Walker P., Matías (RUT 12.345.678-9)",
    };
    await expect(correrPipeline(mencionConRut, maestra, provider)).rejects.toThrow();
    expect(provider.callCount).toBe(0);
  });
});
