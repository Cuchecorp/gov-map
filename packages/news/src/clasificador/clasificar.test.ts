import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import type { LLMProvider, CompletionRequest } from "@obs/llm";
import type { ZodType } from "zod";
import { clasificarNoticia, derivarPromptClasificador } from "./clasificar";
import { derivarPromptAnotacion } from "../eval/anotacion";

function mockProvider(respuesta: unknown, capturar?: (req: CompletionRequest) => void): LLMProvider {
  return {
    id: "mock",
    trainsOnInputs: false,
    async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
      capturar?.(req);
      if (respuesta instanceof Error) throw respuesta;
      return schema.parse(respuesta);
    },
  };
}

const ENTRADA = { titulo: "Senado aprueba reforma", descripcion: "La sala votó la iniciativa." };

describe("clasificador — contrato de producción (135-02)", () => {
  it("(a) camino feliz: etiqueta legal con confianza sobre el umbral", async () => {
    let req: CompletionRequest | undefined;
    const r = await clasificarNoticia(
      mockProvider({ etiqueta: "tramitacion_legislativa", confianza: 0.95 }, (x) => (req = x)),
      ENTRADA,
    );
    expect(r).toEqual({
      etiqueta: "tramitacion_legislativa",
      confianza: 0.95,
      fuera_de_lista: false,
      bajo_umbral: false,
    });
    // SC4: temperature 0 SIEMPRE; el titular viaja como DATO delimitado; task etiquetada.
    expect(req!.temperature).toBe(0);
    expect(req!.user).toContain("<titulo>Senado aprueba reforma</titulo>");
    expect(req!.task).toBe("clasificacion-news");
    expect(req!.sensitivity).toBe("public");
  });

  it("(b) emisión fuera de lista NO lanza: es dato de T1", async () => {
    const r = await clasificarNoticia(
      mockProvider({ etiqueta: "deportes", confianza: 0.9 }),
      ENTRADA,
    );
    expect(r.fuera_de_lista).toBe(true);
    expect(r.etiqueta).toBe("deportes");
  });

  it("(c) confianza bajo el umbral se marca (dead-letter confianza_bajo_umbral)", async () => {
    const r = await clasificarNoticia(
      mockProvider({ etiqueta: "no_legislativa", confianza: 0.5 }),
      ENTRADA,
    );
    expect(r.bajo_umbral).toBe(true);
    expect(r.etiqueta).toBe("no_legislativa");
  });

  it("(d) fallo de parse/validación ⇒ etiqueta null (T2), jamás se corrige en silencio", async () => {
    const r = await clasificarNoticia(
      mockProvider({ etiqueta: 42, confianza: "alta" }),
      ENTRADA,
    );
    expect(r.etiqueta).toBeNull();
    expect(r.confianza).toBeNull();
  });

  it("(e) el prompt de producción DIFIERE del prompt de anotación de 133-b (D-133b-4)", () => {
    const shaProd = createHash("sha256").update(derivarPromptClasificador()).digest("hex");
    const shaAnot = createHash("sha256").update(derivarPromptAnotacion()).digest("hex");
    expect(shaProd).not.toBe(shaAnot);
    // Ambos derivan de la MISMA taxonomía: las 6 etiquetas están en los dos.
    expect(derivarPromptClasificador()).toContain("tramitacion_legislativa");
    expect(derivarPromptClasificador()).toContain("ambiguo");
  });

  it("(f) determinismo del prompt de producción", () => {
    expect(derivarPromptClasificador()).toBe(derivarPromptClasificador());
  });
});
