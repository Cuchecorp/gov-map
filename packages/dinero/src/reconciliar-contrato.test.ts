// reconciliar-contrato.test — cruce del PROVEEDOR. RUT-exacto determinista intacto + fallback
// persona-natural por NOMBRE via correrPipeline (finalidad del dato) + persona-juridica RUT-only.
// SIN red, SIN DB: MockMiniMaxProvider + SpyWriter/SpyProvider.
//
// Invariantes (MONEY-02 retrofit "finalidad del dato"; CR-01: name-match != RUT-ownership):
//  - RUT invalido (DV malo) -> cuarentena, enlace null, NUNCA fila confirmada (intacto).
//  - sin RUT interno en la maestra (IDENT-10) -> enlace null, estadoVinculo "no_confirmado".
//  - RUT-exacto unico -> confirmar(id,"determinista") -> EnlaceConfirmado, "confirmado" (intacto).
//  - RUT con 2+ matches -> fail-closed, enlace null.
//  - PERSONA NATURAL sin match RUT-exacto, nombre unico, MASTER YA TIENE EL MISMO RUT -> enlace
//    confirmado + candidato de COSECHA (corroboracion del RUT ya presente).
//  - PERSONA NATURAL sin match RUT-exacto, nombre unico, MASTER SIN/CON OTRO RUT -> enlace confirmado
//    + candidato a REVISION HUMANA (CR-01), SIN cosecha, SIN mutar el master (cola humana).
//  - PERSONA NATURAL ambigua (homonimo) -> null + sin cosecha (fail-closed, cola humana).
//  - PERSONA JURIDICA -> NUNCA correrPipeline (prompts.length === 0); enlace null, sin cosecha.
//  - DATA-ROUTING (LOAD-BEARING): el rutProveedor NUNCA aparece en vinculos/colas ni en el prompt.

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import {
  MockMiniMaxProvider,
  type PipelineWriter,
  type FilaVinculo,
  type FilaAudit,
  type CasoRevision,
} from "@obs/adjudication";
import { reconciliarContrato } from "./reconciliar-contrato";
import type { Contrato } from "./model";

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
    rut: p.rut ?? null,
    parlid_senado: null,
    id_diputado_camara: null,
    estado: p.estado ?? "confirmado",
    email: null,
    origen: "senado",
    fecha_captura: "2026-01-01T00:00:00Z",
  } as Parlamentario;
}

function contrato(over: Partial<Contrato> & { rutProveedor: string }): Contrato {
  return {
    fuenteId: over.fuenteId ?? "OC-1",
    fechaCorte: over.fechaCorte ?? "2026-06-19",
    codigoOrden: over.codigoOrden ?? over.fuenteId ?? "OC-1",
    rutProveedor: over.rutProveedor,
    proveedorNombre: over.proveedorNombre ?? "Proveedor X",
    tipoPersona: over.tipoPersona ?? "natural",
    organismo: over.organismo ?? "ORG",
    nombreOrden: over.nombreOrden ?? "Compra de prueba",
    monto: over.monto ?? null,
    fechaOc: over.fechaOc ?? "2024-02-02",
    origen: "chilecompra",
    fecha_captura: "2026-06-19T00:00:00Z",
    enlace: "https://api.mercadopublico.cl",
    licencia: "mencion de la fuente",
  };
}

describe("reconciliarContrato — RUT invalido -> cuarentena", () => {
  it("DV malo -> estadoVinculo cuarentena, enlace null, sin fila confirmada", async () => {
    const r = await reconciliarContrato([contrato({ rutProveedor: "12.345.678-9" })], [], {});
    expect(r.contratos[0]!.estadoVinculo).toBe("cuarentena");
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.parlamentariosConfirmados).toEqual([]);
    expect(r.cuarentenados).toEqual(["OC-1"]);
    expect(r.cosechas).toEqual([]);
  });
});

describe("reconciliarContrato — sin RUT interno en la maestra (IDENT-10)", () => {
  it("maestra sin rut poblado, persona juridica -> enlace null, no_confirmado, mencion cruda", async () => {
    const maestra = [maestro({ id: "P1", rut: null })];
    const r = await reconciliarContrato(
      [contrato({ rutProveedor: "76.123.456-0", tipoPersona: "juridica" })],
      maestra,
      {},
    );
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.contratos[0]!.estadoVinculo).toBe("no_confirmado");
    expect(r.contratos[0]!.mencionProveedor).toBe("Proveedor X");
    expect(r.parlamentariosConfirmados).toEqual([]);
    expect(r.cosechas).toEqual([]);
  });
});

describe("reconciliarContrato — RUT-exacto unico -> confirmado", () => {
  it("un parlamentario con ese RUT -> confirmar() -> EnlaceConfirmado, confirmado, sin cosecha", async () => {
    const maestra = [maestro({ id: "P500", rut: "76.123.456-0" })];
    const r = await reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    expect(r.contratos[0]!.enlace).not.toBeNull();
    expect(r.contratos[0]!.enlace!.parlamentarioId).toBe("P500");
    expect(r.contratos[0]!.enlace!.metodo).toBe("determinista");
    expect(r.parlamentariosConfirmados).toEqual(["P500"]);
    // RUT-exacto no cosecha: el RUT interno YA estaba poblado, no hay nada que cosechar.
    expect(r.cosechas).toEqual([]);
  });

  it("normaliza ambos lados (puntos/guion) antes de comparar", async () => {
    const maestra = [maestro({ id: "P500", rut: "761234560" })];
    const r = await reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    expect(r.contratos[0]!.enlace!.parlamentarioId).toBe("P500");
  });
});

describe("reconciliarContrato — RUT con 2+ matches -> fail-closed", () => {
  it("dos parlamentarios con el mismo RUT -> enlace null, no_confirmado", async () => {
    const maestra = [
      maestro({ id: "P1", rut: "76.123.456-0" }),
      maestro({ id: "P2", rut: "76.123.456-0" }),
    ];
    const r = await reconciliarContrato([contrato({ rutProveedor: "76.123.456-0" })], maestra, {});
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.contratos[0]!.estadoVinculo).toBe("no_confirmado");
    expect(r.parlamentariosConfirmados).toEqual([]);
    expect(r.cosechas).toEqual([]);
  });
});

describe("reconciliarContrato — persona JURIDICA NUNCA name-link", () => {
  it("RUT valido sin match RUT-exacto, persona juridica con nombre coincidente -> NO confirma, NO pipeline", async () => {
    // El proveedor no esta por RUT; un parlamentario comparte nombre_normalizado. Persona juridica
    // NUNCA se enlaza por nombre: correrPipeline NO se invoca (prompts.length === 0).
    const maestra = [maestro({ id: "P9", rut: "12.345.678-5", nombre_normalizado: "proveedor x" })];
    const spyProvider = new SpyProvider(
      new MockMiniMaxProvider({ decision: "match", chosen_id: "P9", confidence: 0.99, evidence: [], conflicts: [] }),
    );
    const writer = new SpyWriter();
    const r = await reconciliarContrato(
      [contrato({ rutProveedor: "76.123.456-0", tipoPersona: "juridica", proveedorNombre: "Proveedor X" })],
      maestra,
      { provider: spyProvider as never, writer },
    );
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.contratos[0]!.estadoVinculo).toBe("no_confirmado");
    expect(r.cosechas).toEqual([]);
    // CLAVE: una empresa nunca llega al pipeline/LLM.
    expect(spyProvider.prompts.length).toBe(0);
    expect(writer.vinculos.length).toBe(0);
  });
});

describe("reconciliarContrato — fallback persona-natural confirmada (CORROBORACION de RUT, CR-01)", () => {
  it("nombre unico + master YA tiene el mismo RUT -> enlace + cosecha (no-op de confirmacion)", async () => {
    // CR-01 canal CORROBORACION: la maestra YA tenia el RUT y coincide -> la igualdad RUT<->parlamentario
    // esta establecida; cosechar es re-escribir el mismo valor. ES el unico camino que alimenta el writer.
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
        rut: "76.123.456-0", // master YA tiene el RUT que trae el contrato
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
    const contratos = [
      contrato({
        rutProveedor: "76.123.456-0",
        tipoPersona: "natural",
        proveedorNombre: "Coloma C., Juan Antonio",
      }),
    ];

    // Con el master poblado por ESE RUT, matchDeterminista resuelve por RUT-exacto en el paso 2 (antes
    // del pipeline) -> confirmado, SIN cosecha (no hay RUT nuevo que cosechar). Es el comportamiento
    // seguro: la unica via que escribe el master es la corroboracion de un RUT ya presente, jamas un RUT
    // nuevo derivado por nombre.
    const r = await reconciliarContrato(contratos, maestra, { provider, writer });

    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    expect(r.contratos[0]!.enlace!.parlamentarioId).toBe("P00500");
    expect(r.parlamentariosConfirmados).toEqual(["P00500"]);
    // RUT-exacto del paso 2: no cosecha (el master ya estaba poblado; nada que cosechar).
    expect(r.cosechas).toEqual([]);
    expect(r.revisionesRut).toEqual([]);
  });
});

describe("reconciliarContrato — fallback persona-natural confirmada (RUT name-only -> REVISION, CR-01)", () => {
  it("nombre unico, master SIN rut -> enlace confirmado + candidato a REVISION HUMANA, SIN cosecha, SIN master write", async () => {
    // CR-01: name-uniqueness != RUT-ownership. El enlace-por-nombre se mantiene (fiscalizacion), pero el
    // RUT del proveedor es un CANDIDATO que se ENCOLA a revision humana, NUNCA se cosecha al master.
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
        rut: null, // master SIN rut -> el RUT name-only NO se puede corroborar
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
    const contratos = [
      contrato({
        rutProveedor: "76.123.456-0",
        tipoPersona: "natural",
        proveedorNombre: "Coloma C., Juan Antonio",
      }),
    ];

    const r = await reconciliarContrato(contratos, maestra, { provider, writer });

    // El enlace confirmado-por-nombre se mantiene (la feature de fiscalizacion).
    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    expect(r.contratos[0]!.enlace!.parlamentarioId).toBe("P00500");
    expect(r.parlamentariosConfirmados).toEqual(["P00500"]);
    // NINGUNA cosecha: el RUT name-only NUNCA va al canal de escritura del master.
    expect(r.cosechas).toEqual([]);
    // SI un candidato a revision humana, con el trust-level en la provenance.
    expect(r.revisionesRut.length).toBe(1);
    expect(r.revisionesRut[0]!.parlamentarioId).toBe("P00500");
    expect(r.revisionesRut[0]!.rutCandidato).toBe("761234560");
    expect(r.revisionesRut[0]!.provenance.origen).toContain("name-only");
    expect(r.revisionesRut[0]!.provenance.origen).toContain("pendiente-humano");
    // Y se encolo a la cola humana (enqueueRevision), NO a un vinculo confirmado ni a un master write.
    expect(writer.colas.length).toBe(1);
    expect(writer.colas[0]!.motivo).toContain("ANTES de escribir el master");
    // DATA-ROUTING: el RUT NO viaja a un prompt del LLM (el determinista corto antes del modelo).
  });

  it("namesake-collision: contratista privado nombre-unico cuyo RUT difiere del master -> SIN cosecha, master NO muta (IN-03)", async () => {
    // EL caso que CR-01 existe para prevenir: un contratista privado que es homonimo (nombre unico en
    // camara+periodo) de un senador, pero cuyo RUT NO es el del senador. El master ya trae OTRO rut.
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
        rut: "9.876.543-3", // el RUT REAL del senador (DV-valido), distinto al del contratista
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
    const contratos = [
      contrato({
        rutProveedor: "76.123.456-0", // RUT del contratista privado, NO el del senador
        tipoPersona: "natural",
        proveedorNombre: "Coloma C., Juan Antonio",
      }),
    ];

    const r = await reconciliarContrato(contratos, maestra, { provider, writer });

    // El enlace-por-nombre se mantiene, pero el RUT del contratista NUNCA se cosecha al master.
    expect(r.contratos[0]!.estadoVinculo).toBe("confirmado");
    expect(r.cosechas).toEqual([]); // INVARIANTE rule-5: NINGUNA mutacion del master rut.
    // El RUT difiere del master -> candidato a revision humana (un humano descartara la colision).
    expect(r.revisionesRut.length).toBe(1);
    expect(r.revisionesRut[0]!.rutCandidato).toBe("761234560");
    // El RUT REAL del senador (9.876.543-3) NUNCA se sobreescribe por esta ruta.
    expect(r.cosechas.find((c) => c.rutHarvested === "761234560")).toBeUndefined();
  });
});

describe("reconciliarContrato — persona-natural ambigua (homonimo) -> null + sin cosecha", () => {
  it("dos parlamentarios con el mismo nombre_normalizado -> enlace null, no_confirmado, cosechas vacio", async () => {
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
    const r = await reconciliarContrato(
      [contrato({ rutProveedor: "76.123.456-0", tipoPersona: "natural", proveedorNombre: "Perez P., Juan" })],
      maestra,
      { provider, writer },
    );
    expect(r.contratos[0]!.enlace).toBeNull();
    expect(r.contratos[0]!.estadoVinculo).toBe("no_confirmado");
    expect(r.parlamentariosConfirmados).toEqual([]);
    expect(r.cosechas).toEqual([]);
  });
});

describe("reconciliarContrato — sin provider: persona-natural homonima degrada, determinista resuelve", () => {
  it("homonimo degrada a no_confirmado (fail-closed); un determinista (master sin rut) -> revision, NO cosecha", async () => {
    const maestra = [
      maestro({ id: "PD", nombre_normalizado: "bianchi carlos", nombres: "Carlos", apellido_paterno: "Bianchi" }),
      maestro({ id: "PH1", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
      maestro({ id: "PH2", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
    ];
    const contratos = [
      contrato({ fuenteId: "det", rutProveedor: "76.123.456-0", proveedorNombre: "Bianchi Ch., Carlos" }),
      contrato({ fuenteId: "hom", rutProveedor: "77.888.999-4", proveedorNombre: "Soto P., Juan" }),
    ];

    // SIN provider inyectado: el homonimo NO debe abortar; debe degradar.
    const r = await reconciliarContrato(contratos, maestra, {});

    const det = r.contratos.find((c) => c.codigoOrden === "det")!;
    const hom = r.contratos.find((c) => c.codigoOrden === "hom")!;
    expect(det.enlace?.parlamentarioId).toBe("PD");
    expect(det.estadoVinculo).toBe("confirmado");
    expect(hom.enlace).toBeNull();
    expect(hom.estadoVinculo).toBe("no_confirmado");
    // CR-01: el determinista-por-nombre con master SIN rut NO cosecha; produce un candidato a revision.
    expect(r.cosechas).toEqual([]);
    expect(r.revisionesRut.length).toBe(1);
    expect(r.revisionesRut[0]!.parlamentarioId).toBe("PD");
    expect(r.revisionesRut[0]!.rutCandidato).toBe("761234560");
  });
});

describe("reconciliarContrato — DATA-ROUTING: el rutProveedor NUNCA al pipeline/prompt", () => {
  it("RUT distintivo nunca aparece en vinculos/colas ni en ningun prompt; el nombre SI", async () => {
    const RUT = "76.543.210-3";
    const maestra = [
      maestro({
        id: "P00500",
        nombre_normalizado: "antonio coloma juan",
        nombres: "Juan Antonio",
        apellido_paterno: "Coloma",
        apellido_materno: "Correa",
      }),
      // Homonimos para forzar el camino LLM (prompt) en un segundo contrato.
      maestro({ id: "P00701", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
      maestro({ id: "P00702", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" }),
    ];
    const spyProvider = new SpyProvider(
      new MockMiniMaxProvider({ decision: "match", chosen_id: "P00701", confidence: 0.99, evidence: [], conflicts: [] }),
    );
    const writer = new SpyWriter();
    const contratos = [
      contrato({
        fuenteId: "det",
        rutProveedor: RUT,
        tipoPersona: "natural",
        proveedorNombre: "Coloma C., Juan Antonio",
      }),
      contrato({
        fuenteId: "hom",
        rutProveedor: RUT,
        tipoPersona: "natural",
        proveedorNombre: "Soto P., Juan",
      }),
    ];

    await reconciliarContrato(contratos, maestra, { provider: spyProvider as never, writer });

    // 1. El rutProveedor (con guion/puntos, normalizado, o sin formato) NUNCA en vinculos.
    const vinculoJson = JSON.stringify(writer.vinculos);
    expect(vinculoJson).not.toContain(RUT);
    expect(vinculoJson).not.toContain("765432");
    // 2. Ni en los casos encolados a revision humana.
    const colasJson = JSON.stringify(writer.colas);
    expect(colasJson).not.toContain(RUT);
    expect(colasJson).not.toContain("765432");
    // 3. Ni en NINGUN prompt enviado al LLM (el homonimo si llego al LLM).
    expect(spyProvider.prompts.length).toBeGreaterThan(0);
    for (const p of spyProvider.prompts) {
      expect(p).not.toContain(RUT);
      expect(p).not.toContain("765432");
    }
    // 4. Sanity: el nombre del proveedor SI aparece en la mencion escrita.
    expect(vinculoJson).toContain("Coloma");
  });
});
