/**
 * Tests de reconciliarVotosSenado — cruce por NOMBRE vía correrPipeline (Fase 4),
 * respetando la GUARDA DE IDENTIDAD LOCKED (riesgo existencial #1).
 * SIN red, SIN DB: MockMiniMaxProvider + PipelineWriter espía in-memory (patrón 04-03).
 *
 * Invariantes LOCKED:
 *  - determinista (nombre único en cámara+periodo) → parlamentario_id poblado, confirmado.
 *  - probable (auto-aceptar del LLM) → parlamentario_id NULL, estado_vinculo='probable',
 *    mención cruda conservada (NUNCA vincula a la ficha pública).
 *  - revision / no_confirmado → parlamentario_id NULL, no_confirmado, mención cruda.
 */
import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import {
  MockMiniMaxProvider,
  type PipelineWriter,
  type FilaVinculo,
  type FilaAudit,
  type CasoRevision,
} from "@obs/adjudication";
import { reconciliarVotosSenado } from "./reconciliar-senado";
import { aplanarVoto } from "./writer";
import type { VotoSenadoCrudo } from "./parse-senado-votacion";

/** Writer espía in-memory: captura escrituras sin tocar la DB (patrón 04-03). */
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

const votosCrudos: VotoSenadoCrudo[] = [
  { mencionNombre: "Coloma C., Juan Antonio", seleccion: "si", votoSeq: 0 },
];

describe("reconciliarVotosSenado — guarda de identidad LOCKED", () => {
  it("nombre único en cámara+periodo (determinista) → parlamentario_id poblado, confirmado", async () => {
    // Un único Coloma en la maestra → matchDeterminista confirma sin tocar el LLM.
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
    const out = await reconciliarVotosSenado(votosCrudos, maestra, {
      votacionId: "senado:14309:01/06/2026",
      provider,
      writer,
    });
    expect(out).toHaveLength(1);
    // IDENT-12: el FK ahora es un EnlaceConfirmado branded minteado por confirmar().
    expect(out[0]!.enlace?.parlamentarioId).toBe("P00500");
    expect(out[0]!.enlace?.metodo).toBe("determinista");
    // La forma pública persistida (aplanada) sigue poblando parlamentario_id solo si confirmado.
    expect(aplanarVoto(out[0]!).parlamentario_id).toBe("P00500");
    expect(out[0]!.metodo).toBe("determinista");
    expect(out[0]!.estado_vinculo).toBe("confirmado");
    expect(out[0]!.seleccion).toBe("si");
    expect(out[0]!.mencion_nombre).toBe("Coloma C., Juan Antonio");
    expect(out[0]!.votacion_id).toBe("senado:14309:01/06/2026");
    expect(provider.callCount).toBe(0); // determinista corta antes del LLM
  });

  it("probable (auto-aceptar LLM, homónimos) → parlamentario_id NULL, estado_vinculo='probable', mención cruda", async () => {
    // DOS Coloma → matchDeterminista NO confirma; el LLM auto-acepta (0.97) → 'probable'.
    // GUARDA LOCKED: 'probable' NUNCA vincula a la ficha pública (parlamentario_id null).
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
      }),
      maestro({
        id: "P00501",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Alamos",
      }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00500",
      confidence: 0.97,
      evidence: ["apellido y cámara coinciden"],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const out = await reconciliarVotosSenado(votosCrudos, maestra, {
      votacionId: "senado:1",
      provider,
      writer,
    });
    // GUARDA LOCKED: 'probable' NUNCA mintea un enlace → FK público null.
    expect(out[0]!.enlace).toBeNull();
    expect(aplanarVoto(out[0]!).parlamentario_id).toBeNull();
    expect(out[0]!.estado_vinculo).toBe("probable");
    expect(out[0]!.metodo).toBe("llm");
    expect(out[0]!.mencion_nombre).toBe("Coloma C., Juan Antonio");
    expect(provider.callCount).toBe(1);
  });

  it("revisión (LLM baja confianza) → parlamentario_id NULL, no_confirmado, mención cruda", async () => {
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
      }),
      maestro({
        id: "P00501",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Alamos",
      }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00500",
      confidence: 0.5,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const out = await reconciliarVotosSenado(votosCrudos, maestra, {
      votacionId: "senado:1",
      provider,
      writer,
    });
    expect(out[0]!.enlace).toBeNull();
    expect(aplanarVoto(out[0]!).parlamentario_id).toBeNull();
    expect(out[0]!.estado_vinculo).toBe("no_confirmado");
    expect(out[0]!.metodo).toBeNull();
    expect(out[0]!.mencion_nombre).toBe("Coloma C., Juan Antonio");
  });

  it("sin candidato (maestra vacía) → parlamentario_id NULL, no_confirmado, mención cruda (Test 4 slice E2E)", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "no_match",
      chosen_id: null,
      confidence: 0,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const out = await reconciliarVotosSenado(votosCrudos, [], {
      votacionId: "senado:1",
      provider,
      writer,
    });
    expect(out[0]!.enlace).toBeNull();
    expect(aplanarVoto(out[0]!).parlamentario_id).toBeNull();
    expect(out[0]!.estado_vinculo).toBe("no_confirmado");
    expect(out[0]!.mencion_nombre).toBeTruthy();
  });

  it("provider opcional: los votos que resuelven determinísticamente no requieren LLM", async () => {
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
      decision: "no_match",
      chosen_id: null,
      confidence: 0,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const out = await reconciliarVotosSenado(votosCrudos, maestra, {
      votacionId: "senado:1",
      provider,
      writer,
    });
    expect(out[0]!.enlace?.parlamentarioId).toBe("P00500");
    expect(aplanarVoto(out[0]!).parlamentario_id).toBe("P00500");
    expect(provider.callCount).toBe(0);
  });

  it("CR-02: dos votos con el MISMO nombre crudo reciben fuente_voter_id distintos (seq) → no colapsan", async () => {
    const provider = new MockMiniMaxProvider({
      decision: "no_match",
      chosen_id: null,
      confidence: 0,
      evidence: [],
      conflicts: [],
    });
    const crudos: VotoSenadoCrudo[] = [
      { mencionNombre: "Homónimo X.", seleccion: "si", votoSeq: 3 },
      { mencionNombre: "Homónimo X.", seleccion: "no", votoSeq: 7 },
    ];
    const out = await reconciliarVotosSenado(crudos, [], {
      votacionId: "senado:1",
      provider,
      writer: new SpyWriter(),
    });
    expect(out[0]!.fuente_voter_id).toBe("seq:3");
    expect(out[1]!.fuente_voter_id).toBe("seq:7");
    expect(out[0]!.fuente_voter_id).not.toBe(out[1]!.fuente_voter_id);
  });
});
