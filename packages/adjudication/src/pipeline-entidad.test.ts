/**
 * Tests de correrPipelineEntidad (ENT-02/ENT-04, Task 2) con mock determinista + writer espía.
 * SIN red, SIN DB. Casos del <behavior>:
 *  - Test 1 (Etapa 0): determinista confirmado → upsert metodo='determinista' + audit; 0 LLM.
 *  - Test 2 (Δ2 CRÍTICO): mención jurídica → no_confirmado directo; provider recibe 0 llamadas.
 *  - Test 3 (Etapa 1): 0 candidatos (natural) → no_confirmado + audit; 0 LLM.
 *  - Test 4 (gate RUT, ENT-02): RUT colado al prompt → lanza ANTES de complete; 0 LLM.
 *  - Test 5 (Etapa 3 auto-aceptar): confidence 0.90 → probable metodo='llm' (NUNCA confirmado).
 *  - Test 6 (Etapa 3 borde): confidence 0.8999 → revision → enqueue pendiente + audit vinculo_id:null.
 */
import { describe, it, expect } from "vitest";
import type { EntidadTerceroRow } from "@obs/identity";
import { correrPipelineEntidad } from "./pipeline-entidad";
import { MockMiniMaxProviderEntidad } from "./mock-provider-entidad";
import type { MencionEntidadForanea } from "./tipos-entidad";
import type {
  CasoRevisionEntidad,
  FilaVinculoEntidad,
  FilaAuditEntidad,
} from "./writer-revision-entidad";

/** Writer espía in-memory: captura toda escritura sin tocar la DB. */
class SpyWriter {
  vinculos: FilaVinculoEntidad[] = [];
  audits: FilaAuditEntidad[] = [];
  colas: CasoRevisionEntidad[] = [];
  private nextId = 1;

  async upsertVinculoEntidad(v: FilaVinculoEntidad): Promise<number | null> {
    this.vinculos.push(v);
    return this.nextId++;
  }
  async appendAudit(row: FilaAuditEntidad): Promise<void> {
    this.audits.push(row);
  }
  async enqueueRevision(caso: CasoRevisionEntidad): Promise<void> {
    this.colas.push(caso);
  }
}

const mencionNatural: MencionEntidadForanea = {
  nombreOriginal: "Juan Pérez González",
  nombreNormalizado: "juan perez gonzalez",
  tipoEntidad: "natural",
};

const maestraUnNatural: EntidadTerceroRow[] = [
  { id: "E00042", nombre_normalizado: "juan perez gonzalez", tipo_entidad: "natural", rut: null },
];

const maestraDosNaturales: EntidadTerceroRow[] = [
  { id: "E00042", nombre_normalizado: "juan perez gonzalez", tipo_entidad: "natural", rut: null },
  { id: "E00099", nombre_normalizado: "juan perez gonzalez", tipo_entidad: "natural", rut: null },
];

const salida = (over: Partial<{ decision: "match" | "no_match" | "uncertain"; chosen_id: string | null; confidence: number; conflicts: string[] }>) => ({
  decision: over.decision ?? "match",
  chosen_id: over.chosen_id !== undefined ? over.chosen_id : "E00042",
  confidence: over.confidence ?? 0.97,
  evidence: ["nombre coincide"],
  conflicts: over.conflicts ?? [],
});

describe("correrPipelineEntidad — Etapa 0 (determinista)", () => {
  it("Test 1: determinista confirmado (nombre único por tipo) → metodo='determinista' + audit; 0 LLM", async () => {
    const provider = new MockMiniMaxProviderEntidad(salida({}));
    const writer = new SpyWriter();
    const out = await correrPipelineEntidad(mencionNatural, maestraUnNatural, provider, writer);

    expect(out.tipo).toBe("determinista");
    expect(provider.callCount).toBe(0);
    expect(writer.vinculos).toHaveLength(1);
    expect(writer.vinculos[0]!.estado).toBe("confirmado");
    expect(writer.vinculos[0]!.metodo).toBe("determinista");
    expect(writer.vinculos[0]!.entidad_tercero_id).toBe("E00042");
    expect(writer.audits[0]!.metodo).toBe("determinista");
    expect(writer.audits[0]!.tipo_entidad).toBe("natural");
    expect(writer.audits[0]!.vinculo_id).toBe(1);
    expect(writer.colas).toHaveLength(0);
  });
});

describe("correrPipelineEntidad — Δ2 jurídica salta el LLM (CRÍTICO, ENT-02)", () => {
  it("Test 2: mención jurídica sin RUT único → no_confirmado directo; provider recibe 0 llamadas", async () => {
    const provider = new MockMiniMaxProviderEntidad(salida({}));
    const writer = new SpyWriter();
    // Maestra con DOS jurídicas homónimas → el matcher no confirma; pero una jurídica NUNCA
    // llega al LLM (Δ2): debe cortarse antes del blocking/prompt.
    const maestraJuridica: EntidadTerceroRow[] = [
      { id: "E00500", nombre_normalizado: "constructora andes spa", tipo_entidad: "juridica", rut: null },
      { id: "E00501", nombre_normalizado: "constructora andes spa", tipo_entidad: "juridica", rut: null },
    ];
    const mencionJuridica: MencionEntidadForanea = {
      nombreOriginal: "Constructora Andes SpA",
      nombreNormalizado: "constructora andes spa",
      tipoEntidad: "juridica",
    };
    const out = await correrPipelineEntidad(mencionJuridica, maestraJuridica, provider, writer);

    expect(out.tipo).toBe("no_confirmado");
    expect(provider.callCount).toBe(0); // NUNCA llama al modelo
    expect(writer.vinculos).toHaveLength(1);
    expect(writer.vinculos[0]!.estado).toBe("no_confirmado");
    expect(writer.vinculos[0]!.metodo).toBe("determinista");
    expect(writer.audits).toHaveLength(1);
    expect(writer.audits[0]!.tipo_entidad).toBe("juridica");
    expect(writer.colas).toHaveLength(0);
  });
});

describe("correrPipelineEntidad — Etapa 1 (blocking)", () => {
  it("Test 3: 0 candidatos (natural) → no_confirmado + audit; 0 LLM", async () => {
    const provider = new MockMiniMaxProviderEntidad(salida({}));
    const writer = new SpyWriter();
    const mencionHuerfana: MencionEntidadForanea = {
      nombreOriginal: "Inexistente Tal",
      nombreNormalizado: "inexistente tal",
      tipoEntidad: "natural",
    };
    const out = await correrPipelineEntidad(mencionHuerfana, maestraDosNaturales, provider, writer);

    expect(out.tipo).toBe("no_confirmado");
    expect(provider.callCount).toBe(0);
    expect(writer.vinculos[0]!.estado).toBe("no_confirmado");
    expect(writer.vinculos[0]!.metodo).toBe("determinista");
    expect(writer.audits[0]!.metodo).toBe("determinista");
    expect(writer.colas).toHaveLength(0);
  });
});

describe("correrPipelineEntidad — gate RUT fail-closed (ENT-02)", () => {
  it("Test 4: RUT que se colaría al prompt (maestra sucia) → lanza ANTES de complete; 0 LLM", async () => {
    // Vector: el RUT está inyectado en el nombre normalizado de un candidato (dato sucio aguas
    // arriba) que fluye a las líneas del prompt. El gate corre sobre el payload completo y aborta.
    const maestraSucia: EntidadTerceroRow[] = [
      { id: "E00042", nombre_normalizado: "juan perez gonzalez 12.345.678-9", tipo_entidad: "natural", rut: null },
      { id: "E00099", nombre_normalizado: "juan perez gonzalez 12.345.678-9", tipo_entidad: "natural", rut: null },
    ];
    const mencionSucia: MencionEntidadForanea = {
      nombreOriginal: "Juan Pérez González",
      nombreNormalizado: "juan perez gonzalez 12.345.678-9",
      tipoEntidad: "natural",
    };
    const provider = new MockMiniMaxProviderEntidad(salida({}));
    const writer = new SpyWriter();

    await expect(
      correrPipelineEntidad(mencionSucia, maestraSucia, provider, writer),
    ).rejects.toThrow();
    expect(provider.callCount).toBe(0);
    expect(writer.vinculos.every((v) => v.estado !== "confirmado")).toBe(true);
  });
});

describe("correrPipelineEntidad — Etapa 3 (compuerta, borde UMBRAL estricto)", () => {
  it("Test 5: confidence 0.90 (borde) → probable metodo='llm' (NUNCA confirmado)", async () => {
    const provider = new MockMiniMaxProviderEntidad(salida({ confidence: 0.9 }));
    const writer = new SpyWriter();
    const out = await correrPipelineEntidad(mencionNatural, maestraDosNaturales, provider, writer);

    expect(out.tipo).toBe("probable");
    expect(provider.callCount).toBe(1);
    expect(writer.vinculos).toHaveLength(1);
    expect(writer.vinculos[0]!.estado).toBe("probable");
    expect(writer.vinculos[0]!.estado).not.toBe("confirmado");
    expect(writer.vinculos[0]!.metodo).toBe("llm");
    expect(writer.vinculos[0]!.entidad_tercero_id).toBe("E00042");
    expect(writer.audits[0]!.confidence).toBe(0.9);
    expect(writer.colas).toHaveLength(0);
  });

  it("Test 6: confidence 0.8999 → revision → enqueue pendiente + audit vinculo_id:null", async () => {
    const provider = new MockMiniMaxProviderEntidad(salida({ confidence: 0.8999 }));
    const writer = new SpyWriter();
    const out = await correrPipelineEntidad(mencionNatural, maestraDosNaturales, provider, writer);

    expect(out.tipo).toBe("revision");
    expect(provider.callCount).toBe(1);
    expect(writer.colas).toHaveLength(1);
    expect(writer.colas[0]!.estado).toBe("pendiente");
    expect(writer.colas[0]!.tipo_entidad).toBe("natural");
    expect(writer.colas[0]!.candidatos.length).toBeGreaterThan(0);
    expect(writer.colas[0]!.salida_modelo).toBeDefined();
    expect(writer.audits).toHaveLength(1);
    expect(writer.audits[0]!.vinculo_id).toBeNull();
    expect(writer.vinculos.every((v) => v.estado !== "confirmado")).toBe(true);
  });
});
