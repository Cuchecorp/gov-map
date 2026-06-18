/**
 * Tests del pipeline correrPipeline (etapas 0-3) con mock determinista + writer espía.
 * SIN red, SIN DB.
 *
 * Invariantes existenciales verificados:
 *  - Etapa 0: matchDeterminista 'confirmado' → NO llama al LLM (0 llamadas), vínculo
 *    confirmado metodo='determinista' + audit.
 *  - Etapa 1: 0 candidatos tras blocking → no_confirmado, NO llama al LLM, audit.
 *  - Etapa 2/3 happy: match/0.97 → auto-aceptar → vínculo 'probable' metodo='llm'
 *    (NUNCA 'confirmado', A4) + audit con confidence/modelo_version.
 *  - Etapa 3 revisión: confidence 0.5 → enqueueRevision (pendiente) + audit.
 *  - Fail-closed PII: RUT que se colaría al prompt → lanza ANTES de complete; 0 llamadas;
 *    nada se escribe como confirmado.
 */
import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import { correrPipeline } from "./pipeline";
import { MockMiniMaxProvider } from "./mock-provider";
import type { MencionForanea } from "./tipos";
import type { CasoRevision, FilaVinculo, FilaAudit } from "./writer-revision";

/** Writer espía in-memory: captura toda escritura sin tocar la DB. */
class SpyWriter {
  vinculos: FilaVinculo[] = [];
  audits: FilaAudit[] = [];
  colas: CasoRevision[] = [];
  /** id simulado que `upsertVinculo` devuelve (incremental), para verificar el enlace audit. */
  private nextId = 1;

  async upsertVinculo(v: FilaVinculo): Promise<number | null> {
    this.vinculos.push(v);
    return this.nextId++;
  }
  async appendAudit(row: FilaAudit): Promise<void> {
    this.audits.push(row);
  }
  async enqueueRevision(caso: CasoRevision): Promise<void> {
    this.colas.push(caso);
  }
}

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
    estado: p.estado ?? "confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
    enlace: "https://example.cl",
  };
}

const mencionWalker: MencionForanea = {
  nombreOriginal: "Walker P., Matías",
  nombreNormalizado: "walker matias",
  tokens: ["walker", "matias"],
  camara: "senado",
  periodo: "senado-vigente-2026",
  region: "Valparaíso",
};

const maestraUnWalker = [
  maestro({
    id: "P00042",
    nombre_normalizado: "walker matias",
    nombres: "Matías",
    apellido_paterno: "Walker",
    apellido_materno: "Prieto",
    camara: "senado",
    periodo: "senado-vigente-2026",
    region: "Valparaíso",
  }),
];

describe("correrPipeline — Etapa 0 (determinista, reuse Fase 3)", () => {
  it("matchDeterminista 'confirmado' (nombre único) → NO llama al LLM (0), vínculo confirmado metodo='determinista' + audit", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.99,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const out = await correrPipeline(mencionWalker, maestraUnWalker, provider, writer);

    expect(out.tipo).toBe("determinista");
    expect(provider.callCount).toBe(0); // NO se tocó el LLM
    expect(writer.vinculos).toHaveLength(1);
    expect(writer.vinculos[0]!.estado).toBe("confirmado");
    expect(writer.vinculos[0]!.metodo).toBe("determinista");
    expect(writer.vinculos[0]!.parlamentario_id).toBe("P00042");
    expect(writer.audits).toHaveLength(1);
    expect(writer.audits[0]!.metodo).toBe("determinista");
    // WR-01: el audit referencia el vínculo recién escrito (no null).
    expect(writer.audits[0]!.vinculo_id).toBe(1);
    expect(writer.colas).toHaveLength(0);
  });
});

describe("correrPipeline — Etapa 1 (blocking)", () => {
  it("0 candidatos tras blocking → no_confirmado, NO llama al LLM (0), audit", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.99,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    // Mención de un apellido inexistente en la maestra → 0 candidatos.
    const mencionHuerfana: MencionForanea = {
      ...mencionWalker,
      nombreOriginal: "Inexistente, Juan",
      nombreNormalizado: "inexistente juan",
      tokens: ["inexistente", "juan"],
    };
    const out = await correrPipeline(mencionHuerfana, maestraUnWalker, provider, writer);

    expect(out.tipo).toBe("no_confirmado");
    expect(provider.callCount).toBe(0);
    expect(writer.vinculos).toHaveLength(1);
    expect(writer.vinculos[0]!.estado).toBe("no_confirmado");
    expect(writer.audits).toHaveLength(1);
    expect(writer.colas).toHaveLength(0);
  });
});

describe("correrPipeline — Etapas 2/3 (LLM + compuerta)", () => {
  // Maestra con DOS candidatos (homónimos por nombre) → matchDeterminista NO confirma,
  // el LLM desempata. Necesario para llegar a la etapa LLM.
  const maestraDosWalker = [
    maestro({
      id: "P00042",
      nombre_normalizado: "walker matias",
      nombres: "Matías",
      apellido_paterno: "Walker",
      apellido_materno: "Prieto",
      camara: "senado",
      periodo: "senado-vigente-2026",
      region: "Valparaíso",
    }),
    maestro({
      id: "P00099",
      nombre_normalizado: "walker matias",
      nombres: "Matías",
      apellido_paterno: "Walker",
      apellido_materno: "Errazuriz",
      camara: "senado",
      periodo: "senado-vigente-2026",
      region: "Maule",
    }),
  ];

  it("happy: match/0.97/sin-conflicts → auto-aceptar → vínculo 'probable' metodo='llm' (NUNCA 'confirmado') + audit", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.97,
      evidence: ["apellido y cámara coinciden"],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const out = await correrPipeline(mencionWalker, maestraDosWalker, provider, writer);

    expect(out.tipo).toBe("probable");
    expect(provider.callCount).toBe(1);
    expect(writer.vinculos).toHaveLength(1);
    expect(writer.vinculos[0]!.estado).toBe("probable");
    expect(writer.vinculos[0]!.estado).not.toBe("confirmado");
    expect(writer.vinculos[0]!.metodo).toBe("llm");
    expect(writer.vinculos[0]!.parlamentario_id).toBe("P00042");
    expect(writer.audits).toHaveLength(1);
    expect(writer.audits[0]!.metodo).toBe("llm");
    expect(writer.audits[0]!.confidence).toBe(0.97);
    expect(writer.audits[0]!.modelo_version).toBe("minimax-mock");
    // WR-01: el audit del probable referencia el vínculo escrito (no null).
    expect(writer.audits[0]!.vinculo_id).toBe(1);
    expect(writer.colas).toHaveLength(0);
  });

  it("revisión: confidence 0.5 → enqueueRevision (pendiente) con candidatos+salida_modelo + audit; NUNCA confirmado", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.5,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const out = await correrPipeline(mencionWalker, maestraDosWalker, provider, writer);

    expect(out.tipo).toBe("revision");
    expect(provider.callCount).toBe(1);
    expect(writer.colas).toHaveLength(1);
    expect(writer.colas[0]!.estado).toBe("pendiente");
    expect(writer.colas[0]!.candidatos.length).toBeGreaterThan(0);
    expect(writer.colas[0]!.salida_modelo).toBeDefined();
    expect(writer.audits).toHaveLength(1);
    // Ningún vínculo confirmado puede haberse escrito en la ruta de revisión.
    expect(writer.vinculos.every((v) => v.estado !== "confirmado")).toBe(true);
  });
});

describe("correrPipeline — fail-closed PII (T-04-09)", () => {
  it("RUT que se colaría al prompt → lanza ANTES de complete (0 llamadas), nada confirmado", async () => {
    const maestraDosWalker = [
      maestro({
        id: "P00042",
        nombre_normalizado: "walker matias",
        nombres: "Matías",
        apellido_paterno: "Walker",
        apellido_materno: "Prieto",
        camara: "senado",
        periodo: "senado-vigente-2026",
      }),
      maestro({
        id: "P00099",
        nombre_normalizado: "walker matias",
        nombres: "Matías",
        apellido_paterno: "Walker",
        apellido_materno: "Errazuriz",
        camara: "senado",
        periodo: "senado-vigente-2026",
      }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.97,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const mencionConRut: MencionForanea = {
      ...mencionWalker,
      nombreOriginal: "Walker P., Matías (RUT 12.345.678-9)",
    };

    await expect(
      correrPipeline(mencionConRut, maestraDosWalker, provider, writer),
    ).rejects.toThrow();
    expect(provider.callCount).toBe(0);
    expect(writer.vinculos.every((v) => v.estado !== "confirmado")).toBe(true);
  });

  it("WR-05: un RUT en el campo de nombre de un CANDIDATO (maestra sucia) → lanza ANTES de complete (0 llamadas)", async () => {
    // Vector distinto: el RUT no viene en la mención sino inyectado en un campo de la
    // maestra (dato sucio aguas arriba) que fluye a las líneas de candidatos del prompt.
    // El gate corre sobre el payload completo (WR-05) y aborta igual con 0 llamadas.
    const maestraSucia = [
      maestro({
        id: "P00042",
        nombre_normalizado: "walker matias",
        nombres: "Matías 12.345.678-9", // RUT colado en el nombre del candidato
        apellido_paterno: "Walker",
        apellido_materno: "Prieto",
        camara: "senado",
        periodo: "senado-vigente-2026",
      }),
      maestro({
        id: "P00099",
        nombre_normalizado: "walker matias",
        nombres: "Matías",
        apellido_paterno: "Walker",
        apellido_materno: "Errazuriz",
        camara: "senado",
        periodo: "senado-vigente-2026",
      }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00042",
      confidence: 0.97,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();

    await expect(
      correrPipeline(mencionWalker, maestraSucia, provider, writer),
    ).rejects.toThrow();
    expect(provider.callCount).toBe(0);
    expect(writer.vinculos.every((v) => v.estado !== "confirmado")).toBe(true);
  });
});
