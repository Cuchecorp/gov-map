// reconciliar-declarante.test — cruce NAME-ONLY del declarante vía correrPipeline, respetando la
// GUARDA DE IDENTIDAD LOCKED. SIN red, SIN DB: MockMiniMaxProvider + PipelineWriter espía in-memory.
//
// Invariantes LOCKED:
//  - determinista (nombre único en cámara+periodo) → FK poblado, confirmado, audit.
//  - probable/revision/no_confirmado → FK NULL, no_confirmado, mención cruda.
//  - familiares SIEMPRE crudos, sin enlace a persona (deny-by-default).
//  - sin provider, un homónimo degrada a no_confirmado (fail-closed); un determinista resuelve igual.
//  - normalizarNombre limpia el `\t`+dobles-espacios antes del cruce.

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import {
  MockMiniMaxProvider,
  type PipelineWriter,
  type FilaVinculo,
  type FilaAudit,
  type CasoRevision,
} from "@obs/adjudication";
import { reconciliarDeclarante } from "./reconciliar-declarante";
import type { Declaracion, Bienes } from "./model";

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

const bienesVacios: Bienes = {
  inmuebles: [],
  muebles: [],
  actividades: [],
  pasivos: [],
  accionesDerechos: [],
  valores: [],
};

function declaracion(over: Partial<Declaracion> & { fuenteId: string }): Declaracion {
  return {
    fuenteId: over.fuenteId,
    fechaPresentacion: over.fechaPresentacion ?? "2026-03-30",
    tipo: over.tipo ?? "ACTUALIZACIÓN PERIÓDICA (MARZO)",
    cargo: over.cargo ?? null,
    organismo: over.organismo ?? null,
    declaranteNombre: over.declaranteNombre ?? "Carlos Bianchi",
    bienes: over.bienes ?? bienesVacios,
    familiares: over.familiares ?? [],
    origen: "infoprobidad-sparql",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://datos.cplt.cl/datos/infoprobidad/declaracion_x",
    licencia: "CC BY 4.0",
  };
}

describe("reconciliarDeclarante — guarda de identidad LOCKED (name-only)", () => {
  it("(a) declarante único en cámara+periodo (determinista) → FK poblado, confirmado, audit", async () => {
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
    const decls = [declaracion({ fuenteId: "decl_1", declaranteNombre: "Coloma C., Juan Antonio" })];

    const { declaraciones, parlamentariosConfirmados } = await reconciliarDeclarante(decls, maestra, {
      provider,
      writer,
    });

    expect(declaraciones[0]!.enlace?.parlamentarioId).toBe("P00500");
    expect(declaraciones[0]!.estadoVinculo).toBe("confirmado");
    expect(parlamentariosConfirmados).toEqual(["P00500"]);
    expect(writer.audits.length).toBe(1);
    expect(writer.audits[0]!.decision).toBe("confirmado");
  });

  it("(b) homónimo (probable) → FK NULL + mención cruda preservada, no_confirmado", async () => {
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
    const decls = [declaracion({ fuenteId: "decl_2", declaranteNombre: "JUAN PEREZ" })];

    const { declaraciones, parlamentariosConfirmados } = await reconciliarDeclarante(decls, maestra, {
      provider,
      writer,
    });

    expect(declaraciones[0]!.enlace).toBeNull();
    expect(declaraciones[0]!.estadoVinculo).toBe("no_confirmado");
    expect(declaraciones[0]!.mencionDeclarante).toBe("JUAN PEREZ"); // mención cruda preservada
    expect(parlamentariosConfirmados).toEqual([]);
  });

  it("(c) los familiares pasan crudos, sin enlace a persona (deny-by-default)", async () => {
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
      }),
    ];
    const decls = [
      declaracion({
        fuenteId: "decl_3",
        declaranteNombre: "Coloma C., Juan Antonio",
        familiares: [
          { relacion: "esConyugeDe", nombre: "Tercero Uno" },
          { relacion: "esHijoDe", nombre: "Tercero Dos" },
        ],
      }),
    ];

    const { declaraciones } = await reconciliarDeclarante(decls, maestra, {});

    const fams = declaraciones[0]!.familiares;
    expect(fams.length).toBe(2);
    // El familiar es texto crudo: ninguna forma de enlace a una persona.
    expect(fams.every((fam) => !("parlamentarioId" in fam) && !("personaId" in fam))).toBe(true);
    expect(fams.map((fam) => fam.nombre).sort()).toEqual(["Tercero Dos", "Tercero Uno"]);
  });

  it("(d) sin provider: un homónimo degrada a no_confirmado (fail-closed) y un determinista resuelve", async () => {
    const maestra = [
      maestro({ id: "PD", nombre_normalizado: "bianchi carlos", nombres: "Carlos", apellido_paterno: "Bianchi" }),
      maestro({ id: "PH1", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
      maestro({ id: "PH2", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
    ];
    const decls = [
      declaracion({ fuenteId: "decl-det", declaranteNombre: "CARLOS BIANCHI" }),
      declaracion({ fuenteId: "decl-hom", declaranteNombre: "JUAN SOTO" }),
    ];

    // SIN provider inyectado: el homónimo NO debe llamar al LLM ausente y abortar; debe degradar.
    const { declaraciones } = await reconciliarDeclarante(decls, maestra, {});

    const det = declaraciones.find((d) => d.fuenteId === "decl-det")!;
    const hom = declaraciones.find((d) => d.fuenteId === "decl-hom")!;
    expect(det.enlace?.parlamentarioId).toBe("PD");
    expect(det.estadoVinculo).toBe("confirmado");
    expect(hom.enlace).toBeNull();
    expect(hom.estadoVinculo).toBe("no_confirmado");
  });

  it("(e) normalizarNombre limpia el `\\t`+dobles-espacios antes del cruce (resuelve determinista)", async () => {
    const maestra = [
      maestro({ id: "PD", nombre_normalizado: "bianchi carlos", nombres: "Carlos", apellido_paterno: "Bianchi" }),
    ];
    // Nombre crudo con tab inicial + dobles-espacios (forma típica de InfoProbidad).
    const decls = [declaracion({ fuenteId: "decl-ws", declaranteNombre: "\tCARLOS   BIANCHI  " })];

    const { declaraciones } = await reconciliarDeclarante(decls, maestra, {});

    // Si el cruce falla por el ruido del nombre, no resolvería determinista.
    expect(declaraciones[0]!.enlace?.parlamentarioId).toBe("PD");
    expect(declaraciones[0]!.estadoVinculo).toBe("confirmado");
    // La mención cruda preservada es la forma trimmed (sin el tab/espacios de borde).
    expect(declaraciones[0]!.mencionDeclarante).toBe("CARLOS   BIANCHI");
  });
});
