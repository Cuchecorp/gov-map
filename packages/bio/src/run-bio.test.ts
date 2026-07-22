// run-bio.test — orquestador dos-etapas fail-closed: --from-r2 sin red, short-circuit R2,
// DIPID sin match → skip (no fabrica FK), idempotencia 2× run, refresco de parlamentario.partido.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runBio, conectorDeEnvelope, type BioEnvelope, type BioConector } from "./run-bio";
import { InMemoryBioWriter } from "./writer";
import type { MaestraRow } from "@obs/identity";
import type { R2Store } from "@obs/ingest";

const here = dirname(fileURLToPath(import.meta.url));
const DIP_XML = readFileSync(join(here, "__fixtures__", "diputados-periodo-actual.xml"), "utf8");

function maestraRow(id: string, dipid: string | null, nombreParts: string): MaestraRow {
  const [nombres = "", ap = "", am = ""] = nombreParts.split(" ");
  return {
    id,
    nombre_normalizado: "",
    nombres,
    apellido_paterno: ap,
    apellido_materno: am,
    camara: "diputados",
    periodo: "2026-2030",
    region: null,
    distrito: null,
    circunscripcion: null,
    partido: null,
    rut: null,
    parlid_senado: null,
    id_diputado_camara: dipid,
    estado: "no_confirmado",
    email: null,
    origen: "diputados",
    fecha_captura: "2026-07-22T00:00:00Z",
    enlace: "https://test",
  };
}

function envelopeSoloDiputados(): BioEnvelope {
  return {
    diputadosXml: DIP_XML,
    senadoresSparql: null,
    comisionesCatalogoHtml: null,
    integrantesPorComision: {},
  };
}

/** Conector que EXPLOTA si se le llama (prueba de replay sin red). */
const conectorQueExplota: BioConector = {
  async fetchEnvelope() {
    throw new Error("¡NO se debe tocar la red en --from-r2!");
  },
};

/** R2Store fake: sirve un envelope guardado por key (getObject) y registra putImmutable. */
function fakeR2(store: Map<string, Uint8Array>): R2Store {
  return {
    async putImmutable(source: string, resource: string, date: string, sha: string, ext: string, body: Uint8Array) {
      const key = `${source}/${resource}/${date}/${sha}.${ext}`;
      const existed = store.has(key);
      if (!existed) store.set(key, body);
      return { r2Path: key, existed };
    },
    async getObject(key: string) {
      const b = store.get(key);
      if (b == null) throw new Error(`R2 GET 404 ${key}`);
      return b;
    },
  } as unknown as R2Store;
}

describe("run-bio — match fail-closed de diputados por DIPID", () => {
  it("DIPID en la maestra (1074) → militancias enlazadas; DIPID ausente → skip + sinMatch", async () => {
    // La maestra tiene 1074 (Santibáñez) pero NO 1009 (Boric) → Boric queda sin match.
    const maestra = [maestraRow("P1", "1074", "Marisela Santibáñez Novoa")];
    const writer = new InMemoryBioWriter();
    const res = await runBio({
      conector: conectorDeEnvelope(envelopeSoloDiputados()),
      writer,
      maestra,
      fechaCaptura: "2026-07-22T00:00:00Z",
    });
    // 1074 tiene 2 militancias → enlazadas a P1; 1009 sin match.
    expect(res.militancias).toBe(2);
    expect(res.sinMatch).toContain("DIP:1009");
    expect([...writer.militancias.values()].every((m) => m.parlamentarioId === "P1")).toBe(true);
  });

  it("DIPID sin match único → NO fabrica FK (cero militancias, todo a sinMatch)", async () => {
    const writer = new InMemoryBioWriter();
    const res = await runBio({
      conector: conectorDeEnvelope(envelopeSoloDiputados()),
      writer,
      maestra: [], // maestra vacía → ningún DIPID matchea
      fechaCaptura: "2026-07-22T00:00:00Z",
    });
    expect(res.militancias).toBe(0);
    expect(writer.militancias.size).toBe(0);
    expect(res.sinMatch).toEqual(expect.arrayContaining(["DIP:1074", "DIP:1009"]));
  });

  it("actualiza parlamentario.partido desde la militancia ACTUAL (PC, no la histórica PRO)", async () => {
    const maestra = [maestraRow("P1", "1074", "Marisela Santibáñez Novoa")];
    const writer = new InMemoryBioWriter();
    await runBio({
      conector: conectorDeEnvelope(envelopeSoloDiputados()),
      writer,
      maestra,
      fechaCaptura: "2026-07-22T00:00:00Z",
    });
    expect(writer.partidos.get("P1")?.partido).toBe("Partido Comunista");
  });
});

describe("run-bio — dos-etapas R2", () => {
  it("--from-r2 reconstruye SIN tocar la red (conector que explota si se invoca)", async () => {
    const store = new Map<string, Uint8Array>();
    const r2 = fakeR2(store);
    const key = "bio/envelope/2026-07-22/replay.json";
    store.set(key, new TextEncoder().encode(JSON.stringify(envelopeSoloDiputados())));
    const maestra = [maestraRow("P1", "1074", "Marisela Santibáñez Novoa")];
    const writer = new InMemoryBioWriter();
    const res = await runBio({
      conector: conectorQueExplota, // si se llama, el test falla
      writer,
      maestra,
      r2Store: r2,
      fromR2: key,
      fechaCaptura: "2026-07-22T00:00:00Z",
    });
    expect(res.militancias).toBe(2);
    expect(res.r2Path).toBe(key);
  });

  it("putImmutable short-circuit: segunda corrida = 'sin novedades' (existed → ceros)", async () => {
    const store = new Map<string, Uint8Array>();
    const r2 = fakeR2(store);
    const maestra = [maestraRow("P1", "1074", "Marisela Santibáñez Novoa")];
    const opts = {
      conector: conectorDeEnvelope(envelopeSoloDiputados()),
      writer: new InMemoryBioWriter(),
      maestra,
      r2Store: r2,
      fechaCaptura: "2026-07-22T00:00:00Z",
    };
    const primera = await runBio(opts);
    expect(primera.militancias).toBe(2);
    // Segunda corrida con el MISMO contenido → misma sha → existed → short-circuit.
    const segunda = await runBio({ ...opts, writer: new InMemoryBioWriter() });
    expect(segunda.militancias).toBe(0);
  });
});

describe("run-bio — idempotencia", () => {
  it("2× run con el mismo writer InMemory = conteos idénticos (upsert, no duplica)", async () => {
    const maestra = [maestraRow("P1", "1074", "Marisela Santibáñez Novoa")];
    const writer = new InMemoryBioWriter();
    const opts = {
      conector: conectorDeEnvelope(envelopeSoloDiputados()),
      writer,
      maestra,
      fechaCaptura: "2026-07-22T00:00:00Z",
    };
    await runBio(opts);
    const sizeTras1 = writer.militancias.size;
    await runBio(opts);
    expect(writer.militancias.size).toBe(sizeTras1);
  });
});

describe("run-bio — comisiones fail-closed por DIPID", () => {
  it("membresía solo por DIPID confirmado; sin integrantes → catálogo sin membresía", async () => {
    const CAT = `<a href="integrantes.aspx?prmID=100">Hacienda</a>`;
    const INT = `<article class="integrante"><p><a href="mociones.aspx?prmID=1074">Sr. X</a><br/><strong>Presidente</strong></p></article>`;
    const env: BioEnvelope = {
      diputadosXml: null,
      senadoresSparql: null,
      comisionesCatalogoHtml: CAT,
      integrantesPorComision: { "100": INT },
    };
    const maestra = [maestraRow("P1", "1074", "Marisela Santibáñez Novoa")];
    const writer = new InMemoryBioWriter();
    const res = await runBio({
      conector: conectorDeEnvelope(env),
      writer,
      maestra,
      fechaCaptura: "2026-07-22T00:00:00Z",
    });
    expect(res.comisiones).toBe(1);
    expect(res.membresias).toBe(1);
    expect([...writer.membresias.values()][0]!.parlamentarioId).toBe("P1");

    // Sin integrantes → catálogo se emite, membresía vacía (degradación honesta).
    const writer2 = new InMemoryBioWriter();
    const res2 = await runBio({
      conector: conectorDeEnvelope({ ...env, integrantesPorComision: {} }),
      writer: writer2,
      maestra,
      fechaCaptura: "2026-07-22T00:00:00Z",
    });
    expect(res2.comisiones).toBe(1);
    expect(res2.membresias).toBe(0);
  });
});
