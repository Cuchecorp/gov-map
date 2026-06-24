// reconciliar-sujeto.test — cruce del sujeto pasivo vía correrPipeline, respetando la GUARDA DE
// IDENTIDAD LOCKED. SIN red, SIN DB: MockMiniMaxProvider + PipelineWriter espía in-memory.
//
// Invariantes LOCKED:
//  - determinista (nombre único en cámara+periodo) → FK poblado, confirmado, audit.
//  - probable/revision/no_confirmado → FK NULL, no_confirmado, mención cruda.
//  - contrapartes SIEMPRE crudas, contraparteId null (un tercero nunca se enlaza a una persona).
//  - sin provider, un homónimo degrada a no_confirmado (fail-closed); un determinista resuelve igual.

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import type { EntidadTerceroRow } from "@obs/identity";
import {
  MockMiniMaxProvider,
  type PipelineWriter,
  type FilaVinculo,
  type FilaAudit,
  type CasoRevision,
} from "@obs/adjudication";
import { reconciliarSujeto } from "./reconciliar-sujeto";
import type { LobbyAudiencia } from "./model";

/** Writer espía in-memory: captura escrituras del pipeline sin tocar la DB. */
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

function audiencia(over: Partial<LobbyAudiencia> & { identificador: string }): LobbyAudiencia {
  return {
    identificador: over.identificador,
    institucionCodigo: over.institucionCodigo ?? "AA001",
    fecha: over.fecha ?? "2024-06-24T16:30:00.000Z",
    fechaRaw: over.fechaRaw ?? "2024-06-24 12:30:00-04",
    materia: over.materia ?? "Materia X",
    enlaceDetalle: over.enlaceDetalle ?? "https://www.leylobby.gob.cl/x/728817",
    asistentes: over.asistentes ?? [],
    origen: "leylobby-audiencias",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://www.leylobby.gob.cl/instituciones/AA001/audiencias/2024",
  };
}

describe("reconciliarSujeto — guarda de identidad LOCKED", () => {
  it("sujeto pasivo único en cámara+periodo (determinista) → FK poblado, confirmado, audit", async () => {
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
    const aud = [
      audiencia({
        identificador: "AA001AW1",
        asistentes: [{ rol: "Sujeto Pasivo", nombre: "Coloma C., Juan Antonio", representado: null }],
      }),
    ];

    const { audiencias, parlamentariosConfirmados } = await reconciliarSujeto(aud, maestra, {
      provider,
      writer,
    });

    expect(audiencias[0]!.enlace?.parlamentarioId).toBe("P00500");
    expect(audiencias[0]!.estadoVinculo).toBe("confirmado");
    expect(parlamentariosConfirmados).toEqual(["P00500"]);
    // El pipeline escribió una fila de audit (la decisión determinista).
    expect(writer.audits.length).toBe(1);
    expect(writer.audits[0]!.decision).toBe("confirmado");
  });

  it("homónimo (probable/revision) → FK NULL + mención cruda preservada, no_confirmado", async () => {
    // Dos homónimos en la maestra → no determinista; el LLM auto-acepta a 'probable' (NUNCA FK).
    const maestra = [
      maestro({ id: "P00001", nombre_normalizado: "juan perez", nombres: "Juan", apellido_paterno: "Pérez" }),
      maestro({ id: "P00002", nombre_normalizado: "juan perez", nombres: "Juan", apellido_paterno: "Pérez" }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00001",
      confidence: 0.99,
      evidence: [],
      conflicts: [],
    });
    const writer = new SpyWriter();
    const aud = [
      audiencia({
        identificador: "AA001AW2",
        asistentes: [{ rol: "Sujeto Pasivo", nombre: "Pérez P., Juan", representado: null }],
      }),
    ];

    const { audiencias, parlamentariosConfirmados } = await reconciliarSujeto(aud, maestra, {
      provider,
      writer,
    });

    expect(audiencias[0]!.enlace).toBeNull();
    expect(audiencias[0]!.estadoVinculo).toBe("no_confirmado");
    expect(audiencias[0]!.mencionSujeto).toBe("Pérez P., Juan"); // mención cruda preservada
    expect(parlamentariosConfirmados).toEqual([]);
  });

  it("las contrapartes pasan crudas con contraparteId null (Pitfall 4)", async () => {
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
      }),
    ];
    const aud = [
      audiencia({
        identificador: "AA001AW3",
        asistentes: [
          { rol: "Sujeto Pasivo", nombre: "Coloma C., Juan Antonio", representado: null },
          { rol: "Gestor de intereses", nombre: "Lobbista Uno", representado: "Fundación X" },
          { rol: "Gestor de intereses", nombre: "Lobbista Dos", representado: "Fundación X" },
        ],
      }),
    ];

    const { audiencias } = await reconciliarSujeto(aud, maestra, {});

    const cps = audiencias[0]!.contrapartes;
    expect(cps.length).toBe(2);
    expect(cps.every((c) => c.contraparteId === null)).toBe(true);
    expect(cps.map((c) => c.nombre).sort()).toEqual(["Lobbista Dos", "Lobbista Uno"]);
    expect(cps.every((c) => c.rol === "Gestor de intereses")).toBe(true);
    expect(cps.every((c) => c.representadoText === "Fundación X")).toBe(true);
  });

  it("sin provider: un homónimo degrada a no_confirmado (fail-closed) y un determinista resuelve", async () => {
    const maestra = [
      // determinista (único): "Bianchi Carlos"
      maestro({ id: "PD", nombre_normalizado: "bianchi carlos", nombres: "Carlos", apellido_paterno: "Bianchi" }),
      // homónimos: dos "Juan Soto"
      maestro({ id: "PH1", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
      maestro({ id: "PH2", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
    ];
    const aud = [
      audiencia({
        identificador: "AA001AW-DET",
        asistentes: [{ rol: "Sujeto Pasivo", nombre: "Bianchi Ch., Carlos", representado: null }],
      }),
      audiencia({
        identificador: "AA001AW-HOM",
        asistentes: [{ rol: "Sujeto Pasivo", nombre: "Soto P., Juan", representado: null }],
      }),
    ];

    // SIN provider inyectado: el homónimo NO debe llamar al LLM ausente y abortar; debe degradar.
    const { audiencias } = await reconciliarSujeto(aud, maestra, {});

    const det = audiencias.find((a) => a.identificador === "AA001AW-DET")!;
    const hom = audiencias.find((a) => a.identificador === "AA001AW-HOM")!;
    expect(det.enlace?.parlamentarioId).toBe("PD");
    expect(det.estadoVinculo).toBe("confirmado");
    expect(hom.enlace).toBeNull();
    expect(hom.estadoVinculo).toBe("no_confirmado");
  });
});

// ── Δ3: la contraparte (tercero) ahora puebla contraparteId con un match confirmado ──────────
//
// ANTES: contraparteId era SIEMPRE null por diseño (Pitfall 4 original). AHORA reconciliarSujeto
// resuelve cada contraparte contra la maestra de terceros (`opts.maestraEntidad`) con
// `matchDeterministaEntidad` + `confirmarEntidad`: SOLO un match confirmado puebla el FK branded
// `EnlaceEntidadConfirmado | null`; null en cualquier otro caso (jurídica-sin-RUT, homónimo,
// sin candidato). El sujeto pasivo NO cambia.
function entidad(p: Partial<EntidadTerceroRow> & { id: string }): EntidadTerceroRow {
  return {
    id: p.id,
    nombre_normalizado: p.nombre_normalizado ?? "",
    tipo_entidad: p.tipo_entidad ?? "natural",
    rut: p.rut ?? null,
  };
}

describe("reconciliarSujeto — contraparteId poblado con match confirmado (Δ3)", () => {
  const maestra = [
    maestro({
      id: "P00500",
      nombre_normalizado: "antonio coloma juan",
      nombres: "Juan Antonio",
      apellido_paterno: "Coloma",
      apellido_materno: "Correa",
    }),
  ];

  it("Test 1: contraparte natural, nombre único por tipo en la maestra de terceros → contraparteId poblado (EnlaceEntidadConfirmado)", async () => {
    // "Lobbista Uno" → normaliza a un nombre único entre los terceros naturales.
    const maestraEntidad = [
      entidad({ id: "E00001", nombre_normalizado: "lobbista uno", tipo_entidad: "natural" }),
    ];
    const aud = [
      audiencia({
        identificador: "AA001AW-CP1",
        asistentes: [
          { rol: "Sujeto Pasivo", nombre: "Coloma C., Juan Antonio", representado: null },
          { rol: "Gestor de intereses", nombre: "Lobbista Uno", representado: "Fundación X" },
        ],
      }),
    ];

    const { audiencias } = await reconciliarSujeto(aud, maestra, { maestraEntidad });

    const cp = audiencias[0]!.contrapartes[0]!;
    expect(cp.contraparteId).not.toBeNull();
    expect(cp.contraparteId!.entidadTerceroId).toBe("E00001");
    expect(cp.contraparteId!.metodo).toBe("determinista");
    // La fila cruda se preserva intacta.
    expect(cp.nombre).toBe("Lobbista Uno");
    expect(cp.representadoText).toBe("Fundación X");
  });

  it("Test 2: contraparte jurídica SIN RUT → contraparteId null (Δ2); la fila se escribe igual con el nombre crudo", async () => {
    // Una jurídica sin RUT NUNCA confirma (juridica-sin-rut). El rol marca jurídica vía maestra.
    const maestraEntidad = [
      // Aunque exista una jurídica de nombre coincidente, sin RUT en la mención no confirma.
      entidad({ id: "E00010", nombre_normalizado: "fundacion x", tipo_entidad: "juridica" }),
    ];
    const aud = [
      audiencia({
        identificador: "AA001AW-CP2",
        asistentes: [
          { rol: "Sujeto Pasivo", nombre: "Coloma C., Juan Antonio", representado: null },
          // La contraparte es la firma jurídica "Fundación X" (sin RUT en LeyLobby).
          { rol: "Representante de Persona Jurídica", nombre: "Fundación X", representado: "Fundación X" },
        ],
      }),
    ];

    const { audiencias } = await reconciliarSujeto(aud, maestra, {
      maestraEntidad,
      tipoEntidadContraparte: () => "juridica",
    });

    const cp = audiencias[0]!.contrapartes[0]!;
    expect(cp.contraparteId).toBeNull();
    expect(cp.nombre).toBe("Fundación X"); // fila cruda preservada
  });

  it("Test 3: contraparte ambigua/homónima → contraparteId null (fail-closed); no inventa enlace", async () => {
    const maestraEntidad = [
      entidad({ id: "E00021", nombre_normalizado: "juan perez", tipo_entidad: "natural" }),
      entidad({ id: "E00022", nombre_normalizado: "juan perez", tipo_entidad: "natural" }),
    ];
    const aud = [
      audiencia({
        identificador: "AA001AW-CP3",
        asistentes: [
          { rol: "Sujeto Pasivo", nombre: "Coloma C., Juan Antonio", representado: null },
          { rol: "Gestor de intereses", nombre: "Juan Pérez", representado: null },
        ],
      }),
    ];

    const { audiencias } = await reconciliarSujeto(aud, maestra, { maestraEntidad });

    const cp = audiencias[0]!.contrapartes[0]!;
    expect(cp.contraparteId).toBeNull();
    expect(cp.nombre).toBe("Juan Pérez"); // fila cruda preservada
  });

  it("Test 3b: sin maestra de terceros inyectada → contraparteId null (degradación honesta, sin cambios de comportamiento)", async () => {
    const aud = [
      audiencia({
        identificador: "AA001AW-CP3B",
        asistentes: [
          { rol: "Sujeto Pasivo", nombre: "Coloma C., Juan Antonio", representado: null },
          { rol: "Gestor de intereses", nombre: "Lobbista Uno", representado: null },
        ],
      }),
    ];
    const { audiencias } = await reconciliarSujeto(aud, maestra, {});
    expect(audiencias[0]!.contrapartes[0]!.contraparteId).toBeNull();
  });

  it("Test 4 (no-regresión): el sujeto pasivo parlamentario sigue reconciliando exactamente como antes (EnlaceConfirmado intacto)", async () => {
    const maestraEntidad = [
      entidad({ id: "E00001", nombre_normalizado: "lobbista uno", tipo_entidad: "natural" }),
    ];
    const provider = new MockMiniMaxProvider({
      decision: "match",
      chosen_id: "P00500",
      confidence: 0.99,
      evidence: [],
      conflicts: [],
    });
    const aud = [
      audiencia({
        identificador: "AA001AW-CP4",
        asistentes: [
          { rol: "Sujeto Pasivo", nombre: "Coloma C., Juan Antonio", representado: null },
          { rol: "Gestor de intereses", nombre: "Lobbista Uno", representado: null },
        ],
      }),
    ];

    const { audiencias, parlamentariosConfirmados } = await reconciliarSujeto(aud, maestra, {
      provider,
      maestraEntidad,
    });

    // El sujeto pasivo (parlamentario) sigue minteando EnlaceConfirmado por determinista.
    expect(audiencias[0]!.enlace?.parlamentarioId).toBe("P00500");
    expect(audiencias[0]!.estadoVinculo).toBe("confirmado");
    expect(parlamentariosConfirmados).toEqual(["P00500"]);
    // Y la contraparte ahora SÍ puebla su propio FK de tercero (independiente del sujeto pasivo).
    expect(audiencias[0]!.contrapartes[0]!.contraparteId!.entidadTerceroId).toBe("E00001");
  });
});
