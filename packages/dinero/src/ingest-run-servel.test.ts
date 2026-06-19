// ingest-run-servel.test — drift BLOQUEANTE run-level: cualquier mismatch -> cuarentena, 0 filas.
//
// Invariantes (el quarantine boundary es el RUN, NO la fila):
//  - corrida OK: header OK + completitud OK -> parse -> reconciliar -> subirCrudo -> upsert.
//  - drift de header (parse THROW) -> cuarentena, 0 upserts, degradacion{cuarentena:true}.
//  - completitud mismatch (Content-MD5/byte-length) -> cuarentena, 0 upserts, degradacion{cuarentena:true}.
//  - fuente bloqueada (ServelBloqueadaError) -> degradacion honesta, 0 filas, continua.
//  - enlace honesto: solo determinista puebla parlamentario_id; nunca fabrica.

import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import type { Parlamentario } from "@obs/core";
import { MockMiniMaxProvider } from "@obs/adjudication";
import { runIngestServel } from "./ingest-run-servel";
import { ServelBloqueadaError, type ServelConnector, type DescargaServel } from "./connector-servel";
import { InMemoryServelWriter, type ServelWriter } from "./writer-servel";
import { EXPECTED_HEADERS, HEADER_ROW } from "./parse-servel";
import type { AporteParaEscribir } from "./reconciliar-aporte";
import type { Donante } from "./model-servel";

function md5Base64(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("base64");
}

/** Construye un .xlsx en memoria con headers + filas (headers en HEADER_ROW). */
async function xlsx(headers: string[], filas: string[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Aportes");
  ws.getRow(1).getCell(1).value = "meta";
  headers.forEach((h, i) => (ws.getRow(HEADER_ROW).getCell(i + 1).value = h));
  filas.forEach((f, ri) => f.forEach((v, ci) => (ws.getRow(HEADER_ROW + 1 + ri).getCell(ci + 1).value = v)));
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

const FILA_DET = ["Aporte", "Donante X", "Natural", "Bianchi Ch., Carlos", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-01", "100"];
const FILA_DET2 = ["Aporte", "Donante Y", "Natural", "Bianchi Ch., Carlos", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-02", "200"];

/** Conector fake: devuelve bytes + anclas (Content-MD5 = md5 de los bytes salvo override), o lanza. */
function fakeConnector(bytes: Uint8Array, opts: { md5?: string | null; length?: number | null; err?: Error } = {}): ServelConnector {
  return {
    async descargar(): Promise<DescargaServel> {
      if (opts.err) throw opts.err;
      return {
        bytes,
        byteLength: bytes.byteLength,
        anclas: {
          etag: '"x"',
          contentMd5: opts.md5 === undefined ? md5Base64(bytes) : opts.md5,
          lastModified: null,
          contentLength: opts.length === undefined ? bytes.byteLength : opts.length,
        },
      };
    },
  } as unknown as ServelConnector;
}

/** Writer espia: cuenta llamadas a upsert para asertar 0 upserts en cuarentena. */
class SpyServelWriter implements ServelWriter {
  upsertAportesCalls = 0;
  upsertDonantesCalls = 0;
  aportesEscritos = 0;
  marcados: string[] = [];
  async upsertAportes(filas: AporteParaEscribir[]): Promise<void> {
    this.upsertAportesCalls++;
    this.aportesEscritos += filas.length;
  }
  async upsertDonantes(_filas: Donante[]): Promise<void> {
    this.upsertDonantesCalls++;
  }
  async marcarIngestado(ids: string[]): Promise<void> {
    this.marcados.push(...ids);
  }
}

function maestraDet(): Parlamentario[] {
  return [
    {
      id: "P00900",
      nombre_normalizado: "bianchi carlos",
      nombres: "Carlos",
      apellido_paterno: "Bianchi",
      apellido_materno: "",
      camara: "senado",
      periodo: "senado-vigente-2026",
      region: null,
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
    },
  ];
}

describe("runIngestServel — drift BLOQUEANTE run-level", () => {
  it("corrida OK: header OK + completitud OK -> upsert + crudo + determinista puebla parlamentario_id", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET, FILA_DET2]);
    const writer = new InMemoryServelWriter();
    const crudos: string[] = [];
    const res = await runIngestServel({
      conector: fakeConnector(bytes),
      writer,
      maestra: maestraDet(),
      tareas: [{ eleccion: "diputado-2025", url: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx", anio: "2025" }],
      subirCrudo: async (e, _f, b) => {
        crudos.push(`${e}:${b.byteLength}`);
        return `servel/${e}/key.xlsx`;
      },
      fechaCorte: "2026-06-19",
    });

    expect(res.aportes).toBe(2);
    expect(res.cuarentenados).toEqual([]);
    expect(crudos.length).toBe(1); // crudo subido SOLO cuando header+completitud OK.
    // determinista -> parlamentario_id poblado.
    const filas = [...writer.aportes.values()];
    expect(filas.every((f) => f.parlamentario_id === "P00900")).toBe(true);
    expect(res.parlamentariosMarcados).toBe(1);
    // sub-maestra donante deduplicada por (nombre+tipo): 2 donantes distintos.
    expect(writer.donantes.size).toBe(2);
  });

  it("drift de header (parse THROW) -> CUARENTENA RUN: 0 upserts, degradacion{cuarentena:true}", async () => {
    // MONTO renombrado -> el parser THROW.
    const headers = EXPECTED_HEADERS.map((h) => (h === "MONTO" ? "IMPORTE" : h));
    const bytes = await xlsx([...headers], [FILA_DET]);
    const writer = new SpyServelWriter();
    let subirLlamado = false;
    const res = await runIngestServel({
      conector: fakeConnector(bytes),
      writer,
      maestra: maestraDet(),
      tareas: [{ eleccion: "diputado-2025", url: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx", anio: "2025" }],
      subirCrudo: async () => {
        subirLlamado = true;
        return "k";
      },
    });

    expect(res.aportes).toBe(0);
    expect(res.cuarentenados).toEqual(["diputado-2025"]);
    expect(writer.upsertAportesCalls).toBe(0); // 0 upserts (test del invariante).
    expect(writer.upsertDonantesCalls).toBe(0);
    expect(subirLlamado).toBe(false); // crudo NO se sube en cuarentena.
    expect(res.degradaciones.some((d) => d.cuarentena === true && /drift estructural/.test(d.motivo))).toBe(true);
  });

  it("completitud mismatch (Content-MD5) -> CUARENTENA RUN: 0 upserts", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const writer = new SpyServelWriter();
    const res = await runIngestServel({
      conector: fakeConnector(bytes, { md5: "MD5_ALTERADO==" }), // declara un MD5 distinto al de los bytes.
      writer,
      maestra: maestraDet(),
      tareas: [{ eleccion: "diputado-2025", url: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx", anio: "2025" }],
    });

    expect(res.aportes).toBe(0);
    expect(res.cuarentenados).toEqual(["diputado-2025"]);
    expect(writer.upsertAportesCalls).toBe(0);
    expect(res.degradaciones.some((d) => d.cuarentena === true && /Content-MD5/.test(d.motivo))).toBe(true);
  });

  it("completitud mismatch (byte-length) -> CUARENTENA RUN: 0 upserts", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const writer = new SpyServelWriter();
    const res = await runIngestServel({
      conector: fakeConnector(bytes, { length: bytes.byteLength + 999 }), // Content-Length declarado != bytes.
      writer,
      maestra: maestraDet(),
      tareas: [{ eleccion: "diputado-2025", url: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx", anio: "2025" }],
    });

    expect(res.aportes).toBe(0);
    expect(writer.upsertAportesCalls).toBe(0);
    expect(res.degradaciones.some((d) => d.cuarentena === true && /Content-Length/.test(d.motivo))).toBe(true);
  });

  it("fuente bloqueada (ServelBloqueadaError) -> degradacion honesta, 0 filas, sin abortar", async () => {
    const writer = new SpyServelWriter();
    const res = await runIngestServel({
      conector: fakeConnector(new Uint8Array([1]), { err: new ServelBloqueadaError("https://x", 503) }),
      writer,
      maestra: maestraDet(),
      tareas: [{ eleccion: "diputado-2025", url: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx", anio: "2025" }],
    });
    expect(res.aportes).toBe(0);
    expect(res.cuarentenados).toEqual([]); // un bloqueo NO es cuarentena (es degradacion honesta).
    expect(writer.upsertAportesCalls).toBe(0);
    expect(res.degradaciones.some((d) => /HTTP 503/.test(d.motivo))).toBe(true);
  });

  it("WR-05: tarea con eleccion vacia (conector inyectado) -> 0 filas, NO toca storage ni marcador", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const writer = new SpyServelWriter();
    let subirLlamado = false;
    const res = await runIngestServel({
      conector: fakeConnector(bytes),
      writer,
      maestra: maestraDet(),
      // eleccion VACIA pero url presente: rule #4 exige NO dejar fluir un slug vacio a storage/marcador.
      tareas: [{ eleccion: "  ", url: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx", anio: "2025" }],
      subirCrudo: async () => {
        subirLlamado = true;
        return "k";
      },
    });

    expect(res.aportes).toBe(0);
    expect(subirLlamado).toBe(false); // NUNCA sube el crudo con un slug vacio.
    expect(writer.upsertAportesCalls).toBe(0);
    expect(writer.marcados).toEqual([]); // NUNCA marca con eleccion vacia.
    expect(res.errores.some((e) => /eleccion\/url vacios/.test(e.mensaje))).toBe(true);
  });

  it("WR-05: tarea con url vacia (conector inyectado) -> 0 filas, sin tocar storage/marcador", async () => {
    const writer = new SpyServelWriter();
    const res = await runIngestServel({
      conector: fakeConnector(new Uint8Array([1])),
      writer,
      maestra: maestraDet(),
      tareas: [{ eleccion: "diputado-2025", url: "", anio: "2025" }],
    });
    expect(res.aportes).toBe(0);
    expect(writer.upsertAportesCalls).toBe(0);
    expect(res.degradaciones.some((d) => /eleccion\/url vacios/.test(d.motivo))).toBe(true);
  });

  it("enlace honesto: un candidato homonimo queda null (no_confirmado), nunca fabrica", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [
      ["Aporte", "Donante", "Natural", "Soto P., Juan", "Candidato", "DIPUTADO", "DISTRITO 1", "P", "Q", "2025-01-01", "100"],
    ]);
    const maestra: Parlamentario[] = [
      { ...maestraDet()[0]!, id: "P00701", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" },
      { ...maestraDet()[0]!, id: "P00702", nombre_normalizado: "juan soto", nombres: "Juan", apellido_paterno: "Soto" },
    ];
    const writer = new InMemoryServelWriter();
    // Sin provider -> el homonimo degrada a no_confirmado (fail-closed). Pasamos un mock para asegurar
    // que NO se fabrica un FK aunque el LLM "elija" uno.
    const provider = new MockMiniMaxProvider({ decision: "match", chosen_id: "P00701", confidence: 0.99, evidence: [], conflicts: [] });
    const res = await runIngestServel({
      conector: fakeConnector(bytes),
      writer,
      maestra,
      tareas: [{ eleccion: "diputado-2025", url: "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx", anio: "2025" }],
      reconciliar: { provider, writer: { async upsertVinculo() { return 1; }, async appendAudit() {}, async enqueueRevision() {} } },
    });
    expect(res.aportes).toBe(1);
    const fila = [...writer.aportes.values()][0]!;
    expect(fila.parlamentario_id).toBeNull(); // homonimo -> NUNCA un FK fabricado (probable, no determinista).
    expect(fila.estado_vinculo).toBe("no_confirmado");
    expect(res.parlamentariosMarcados).toBe(0);
  });
});
