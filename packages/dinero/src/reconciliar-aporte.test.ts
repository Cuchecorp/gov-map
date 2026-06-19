// reconciliar-aporte.test — cruce del CANDIDATO por NOMBRE via correrPipeline, respetando la GUARDA
// DE IDENTIDAD LOCKED y el DATA-ROUTING GATE. SIN red, SIN DB: MockMiniMaxProvider + SpyWriter.
//
// Invariantes LOCKED:
//  - determinista (nombre unico en camara+periodo) -> FK poblado, confirmado, audit.
//  - probable/revision/no_confirmado -> FK NULL, no_confirmado, candidato_nombre_verbatim crudo.
//  - sin provider, un candidato homonimo degrada a no_confirmado (fail-closed); un determinista resuelve.
//  - DATA-ROUTING (LOAD-BEARING): el DONANTE (nombre/tipo/RUT) NUNCA aparece en ninguna escritura del
//    pipeline ni en el prompt; SOLO el nombre del candidato es la mencion.

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import {
  MockMiniMaxProvider,
  type PipelineWriter,
  type FilaVinculo,
  type FilaAudit,
  type CasoRevision,
} from "@obs/adjudication";
import { reconciliarAporte } from "./reconciliar-aporte";
import { ORIGEN_SERVEL, LICENCIA_SERVEL, type Aporte } from "./model-servel";

/** Writer espia in-memory: captura escrituras del pipeline sin tocar la DB. */
class SpyWriter implements PipelineWriter {
  vinculos: FilaVinculo[] = [];
  audits: FilaAudit[] = [];
  colas: CasoRevision[] = [];
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

/** Provider espia: captura el prompt EXACTO (system+user) que recibiria el LLM, delega al mock. */
class SpyProvider {
  id = "spy-mock";
  trainsOnInputs = false;
  prompts: string[] = [];
  constructor(private inner: MockMiniMaxProvider) {}
  async complete(req: { system: string; user: string; [k: string]: unknown }, schema: unknown): Promise<unknown> {
    this.prompts.push(`${req.system}\n${req.user}`);
    return (this.inner as unknown as { complete: (r: unknown, s: unknown) => Promise<unknown> }).complete(req, schema);
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

function aporte(over: Partial<Aporte> & { candidatoNombreVerbatim: string | null }): Aporte {
  return {
    fuenteId: over.fuenteId ?? "f1",
    fechaCorte: over.fechaCorte ?? "2026-06-19",
    eleccion: over.eleccion ?? "DIPUTADO - DISTRITO 23 - 2025",
    donanteNombre: over.donanteNombre ?? "Donante Generico",
    tipoPersona: over.tipoPersona ?? "Persona Natural",
    monto: over.monto ?? "1000000",
    fechaAporte: over.fechaAporte ?? "2025-03-10",
    tipoAporte: over.tipoAporte ?? "Aporte con publicidad",
    candidatoNombreVerbatim: over.candidatoNombreVerbatim,
    territorio: over.territorio ?? "DISTRITO 23",
    pacto: over.pacto ?? null,
    partido: over.partido ?? null,
    origen: ORIGEN_SERVEL,
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx",
    licencia: LICENCIA_SERVEL,
  };
}

describe("reconciliarAporte — guarda de identidad LOCKED + data-routing", () => {
  it("candidato unico en camara+periodo (determinista) -> FK poblado, confirmado, audit", async () => {
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
      }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00500",
      confidence: 0.99,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const aportes = [aporte({ candidatoNombreVerbatim: "Coloma C., Juan Antonio" })];

    const { aportes: out, parlamentariosConfirmados } = await reconciliarAporte(aportes, maestra, {
      provider,
      writer,
    });

    expect(out[0]!.enlaceCandidato?.parlamentarioId).toBe("P00500");
    expect(out[0]!.estadoVinculo).toBe("confirmado");
    expect(parlamentariosConfirmados).toEqual(["P00500"]);
    // candidato_nombre_verbatim siempre se preserva crudo.
    expect(out[0]!.candidatoNombreVerbatim).toBe("Coloma C., Juan Antonio");
    expect(writer.audits.length).toBe(1);
    expect(writer.audits[0]!.decision).toBe("confirmado");
  });

  it("homonimo (probable/revision) -> FK NULL + candidato_nombre_verbatim crudo, no_confirmado", async () => {
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "juan perez", nombres: "Juan", apellido_paterno: "Perez" }),
      maestro({ id: "P00002", nombre_normalizado: "juan perez", nombres: "Juan", apellido_paterno: "Perez" }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00001",
      confidence: 0.99,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const aportes = [aporte({ candidatoNombreVerbatim: "Perez P., Juan" })];

    const { aportes: out, parlamentariosConfirmados } = await reconciliarAporte(aportes, maestra, {
      provider,
      writer,
    });

    expect(out[0]!.enlaceCandidato).toBeNull();
    expect(out[0]!.estadoVinculo).toBe("no_confirmado");
    expect(out[0]!.candidatoNombreVerbatim).toBe("Perez P., Juan");
    expect(parlamentariosConfirmados).toEqual([]);
  });

  it("sin provider: un candidato homonimo degrada a no_confirmado (fail-closed) y un determinista resuelve", async () => {
    const maestra = [
      maestro({ id: "PD", nombre_normalizado: "bianchi carlos", nombres: "Carlos", apellido_paterno: "Bianchi" }),
      maestro({ id: "PH1", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
      maestro({ id: "PH2", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
    ];
    const aportes = [
      aporte({ fuenteId: "det", candidatoNombreVerbatim: "Bianchi Ch., Carlos" }),
      aporte({ fuenteId: "hom", candidatoNombreVerbatim: "Soto P., Juan" }),
    ];

    // SIN provider inyectado: el homonimo NO debe abortar; debe degradar.
    const { aportes: out } = await reconciliarAporte(aportes, maestra, {});

    const det = out.find((a) => a.fuenteId === "det")!;
    const hom = out.find((a) => a.fuenteId === "hom")!;
    expect(det.enlaceCandidato?.parlamentarioId).toBe("PD");
    expect(det.estadoVinculo).toBe("confirmado");
    expect(hom.enlaceCandidato).toBeNull();
    expect(hom.estadoVinculo).toBe("no_confirmado");
  });

  it("candidato vacio -> enlace null, estado null (no hay a quien cruzar)", async () => {
    const { aportes: out } = await reconciliarAporte(
      [aporte({ candidatoNombreVerbatim: null })],
      [],
      {},
    );
    expect(out[0]!.enlaceCandidato).toBeNull();
    expect(out[0]!.estadoVinculo).toBeNull();
  });

  it("DATA-ROUTING (LOAD-BEARING): el donante NUNCA aparece en ninguna escritura del pipeline ni en el prompt", async () => {
    // Determinista -> el pipeline escribe vinculo + audit. El donante NO debe aparecer en NINGUN campo.
    const DONANTE = "Empresa Donante Secreta SpA";
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
      }),
      // Agregamos homonimos para forzar tambien el camino LLM (prompt) en un segundo aporte.
      maestro({ id: "P00701", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
      maestro({ id: "P00702", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
    ];
    const spyProvider = new SpyProvider(
      new MockMiniMaxProvider({ decision: "match", chosen_id: "P00701", confidence: 0.99, evidence: [], conflicts: [] }),
    );
    const writer = new SpyWriter();
    const aportes = [
      aporte({
        fuenteId: "det",
        candidatoNombreVerbatim: "Coloma C., Juan Antonio",
        donanteNombre: DONANTE,
        tipoPersona: "Persona Juridica",
      }),
      aporte({
        fuenteId: "hom",
        candidatoNombreVerbatim: "Soto P., Juan",
        donanteNombre: DONANTE,
        tipoPersona: "Persona Juridica",
      }),
    ];

    await reconciliarAporte(aportes, maestra, { provider: spyProvider as never, writer });

    // 1. El donante NUNCA aparece en ninguna fila de vinculo del pipeline.
    const vinculoJson = JSON.stringify(writer.vinculos);
    expect(vinculoJson).not.toContain(DONANTE);
    // 2. Ni en los casos encolados a revision humana.
    const colasJson = JSON.stringify(writer.colas);
    expect(colasJson).not.toContain(DONANTE);
    // 3. Ni en NINGUN prompt enviado al LLM (el homonimo si llego al LLM).
    expect(spyProvider.prompts.length).toBeGreaterThan(0);
    for (const p of spyProvider.prompts) {
      expect(p).not.toContain(DONANTE);
    }
    // 4. Sanity: la mencion escrita SI es el nombre del candidato.
    expect(vinculoJson).toContain("Coloma");
  });
});
