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
import { runIngestServel, type TareaEleccion } from "./ingest-run-servel";
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

// ── Wire dos-etapas R2 (DEBT-01 + MONEY-02), 100% OFFLINE ─────────────────────────
//
// Espeja el molde de Phase 70 (ingest-run.test.ts): un `FakeR2Store` (putImmutable/getObject) y un
// `OrderTrackingServelWriter` comparten un CONTADOR MONOTONICO -> los tests prueban el ORDEN DE
// CAPTURA (Etapa 1 R2 ANTES de Etapa 2 Supabase), no la mera presencia. Adaptado a que el crudo
// SERVEL son los BYTES binarios del `.xlsx` (no un envelope JSON), y a que la Etapa 1 en modo LOCAL
// la hizo el operador (colocar el .xlsx en R2 -> tarea con `r2Path`, sin fetch a la fuente).
//   A  put-antes-upsert       — la 1a putImmutable("servel") captura un orden < la 1a upsertAportes.
//   B  --from-r2 / LOCAL 0-fetch — lee los bytes del .xlsx de R2 con un conector que LANZA si se toca.
//   C  put-falla-gatea         — putImmutable que LANZA -> eleccion en `errores`, upsertAportes NO llamado.
//   D  412 idempotente         — putImmutable devuelve existed:true -> skip Etapa 2 (0 upsert).
//   E  fail-soft por eleccion  — A con drift/bloqueada + B ok en la MISMA corrida.
//   F  eleccion/fecha_corte VERBATIM — sobreviven byte-identicos tras el replay --from-r2.

/** Contador monotonico compartido: cada captura toma el siguiente entero (orden de eventos). */
class MonotonicClock {
  private n = 0;
  next(): number {
    return this.n++;
  }
}

/**
 * FakeR2Store: registra el ORDEN de cada `putImmutable` (via el reloj compartido) y sirve el ultimo
 * blob guardado por `getObject`. `mode` controla el comportamiento: "ok" (existed:false),
 * "existed" (412 idempotente) o "throw" (fallo no-412 que debe GATEAR la Etapa 2).
 */
class FakeR2Store {
  readonly putOrders: number[] = [];
  readonly puts: { r2Path: string; bytes: Uint8Array }[] = [];
  readonly byPath = new Map<string, Uint8Array>();
  getObjectCalls = 0;
  constructor(
    private readonly clock: MonotonicClock,
    private readonly mode: "ok" | "existed" | "throw" = "ok",
  ) {}
  async putImmutable(
    source: string,
    resource: string,
    date: string,
    sha: string,
    ext: string,
    bytes: Uint8Array,
  ): Promise<{ r2Path: string; existed: boolean }> {
    this.putOrders.push(this.clock.next());
    if (this.mode === "throw") {
      throw new Error(`R2 PUT 500 para ${source}/${resource}/${date}/${sha}.${ext}`);
    }
    const r2Path = `${source}/${resource}/${date}/${sha}.${ext}`;
    this.puts.push({ r2Path, bytes });
    this.byPath.set(r2Path, bytes);
    return { r2Path, existed: this.mode === "existed" };
  }
  /** En modo LOCAL puro sembramos un r2Path -> bytes directamente (sin put previo). */
  seed(r2Path: string, bytes: Uint8Array): void {
    this.byPath.set(r2Path, bytes);
  }
  async getObject(r2Path: string): Promise<Uint8Array> {
    this.getObjectCalls++;
    const b = this.byPath.get(r2Path);
    if (!b) throw new Error(`R2 GET 404 para ${r2Path}`);
    return b;
  }
}

/** Writer que registra el ORDEN de cada upsertAportes (via el reloj compartido) sobre el in-memory. */
class OrderTrackingServelWriter implements ServelWriter {
  readonly upsertOrders: number[] = [];
  readonly inner = new InMemoryServelWriter();
  constructor(private readonly clock: MonotonicClock) {}
  async upsertAportes(filas: AporteParaEscribir[]): Promise<void> {
    this.upsertOrders.push(this.clock.next());
    await this.inner.upsertAportes(filas);
  }
  async upsertDonantes(filas: Donante[]): Promise<void> {
    await this.inner.upsertDonantes(filas);
  }
  async marcarIngestado(ids: string[], hasta: string): Promise<void> {
    await this.inner.marcarIngestado(ids, hasta);
  }
}

/** Conector fake que LANZA si se le toca — prueba 0 fetch al blob en el modo LOCAL/`--from-r2`. */
function conectorQueLanza(): ServelConnector {
  return {
    async descargar(): Promise<DescargaServel> {
      throw new Error("PROHIBIDO: modo LOCAL/--from-r2 NO debe tocar descargar (0 fetch a la fuente)");
    },
  } as unknown as ServelConnector;
}

const URL_OK = "https://repodocgastoelectoral.blob.core.windows.net/x.xlsx";

function tarea(eleccion: string, extra: Partial<TareaEleccion> = {}): TareaEleccion {
  return { eleccion, url: URL_OK, anio: "2025", ...extra };
}

describe("runIngestServel — Etapa 1 R2 (dos-etapas, DEBT-01/MONEY-02)", () => {
  it("A: putImmutable('servel') (Etapa 1) captura un orden ESTRICTAMENTE menor que upsertAportes (Etapa 2)", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const writer = new OrderTrackingServelWriter(clock);
    await runIngestServel({
      conector: fakeConnector(bytes),
      writer,
      maestra: maestraDet(),
      tareas: [tarea("diputado-2025")],
      fechaCorte: "2026-06-19",
      r2Store: r2Store as never,
    });
    expect(r2Store.putOrders.length).toBeGreaterThan(0);
    expect(writer.upsertOrders.length).toBeGreaterThan(0);
    // Orden de CAPTURA: la 1a Etapa 1 precede a la 1a Etapa 2 (no por presencia).
    expect(r2Store.putOrders[0]!).toBeLessThan(writer.upsertOrders[0]!);
    // Content-addressed bajo "servel/<eleccion>/..." con extension xlsx.
    expect(r2Store.puts[0]!.r2Path).toMatch(/^servel\/diputado-2025\/.*\.xlsx$/);
  });

  it("B: modo LOCAL/--from-r2 lee los bytes .xlsx de R2 con un conector que LANZA si se toca (0 fetch)", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const r2Path = "servel/diputado-2025/2026-06-19/deadbeef.xlsx";
    r2Store.seed(r2Path, bytes); // la Etapa 1 la hizo el operador: el .xlsx ya esta en R2.
    const writer = new InMemoryServelWriter();
    const res = await runIngestServel({
      conector: conectorQueLanza(), // si se toca -> LANZA (prueba 0 fetch al blob).
      writer,
      maestra: maestraDet(),
      tareas: [tarea("diputado-2025", { url: "" })], // sin url: la tarea LOCAL trae r2Path.
      fechaCorte: "2026-06-19",
      r2Store: r2Store as never,
      fromR2: r2Path,
    });
    expect(res.aportes).toBe(1);
    expect(writer.aportes.size).toBe(1);
    expect(r2Store.getObjectCalls).toBeGreaterThan(0); // leyo de R2.
  });

  it("B-guard: --from-r2 sin r2Store LANZA error de args", async () => {
    await expect(
      runIngestServel({
        conector: conectorQueLanza(),
        writer: new InMemoryServelWriter(),
        maestra: maestraDet(),
        tareas: [tarea("diputado-2025", { url: "" })],
        fromR2: "servel/x/2026-07-14/abc.xlsx",
      }),
    ).rejects.toThrow();
  });

  it("C: putImmutable que LANZA (no-412) GATEA el upsert — eleccion en errores, upsertAportes NO llamado", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "throw");
    const writer = new OrderTrackingServelWriter(clock);
    const res = await runIngestServel({
      conector: fakeConnector(bytes),
      writer,
      maestra: maestraDet(),
      tareas: [tarea("diputado-2025")],
      r2Store: r2Store as never,
    });
    // Etapa-1-primero LOCKED: sin crudo en R2, NO hay derivado en Supabase.
    expect(writer.upsertOrders.length).toBe(0);
    expect(writer.inner.aportes.size).toBe(0);
    expect(res.aportes).toBe(0);
    expect(res.errores.some((e) => e.clave.includes("diputado-2025"))).toBe(true);
  });

  it("D: 412 (existed:true) hace skip de la Etapa 2 — 0 upsert para esa eleccion (camino normal)", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "existed");
    const writer = new OrderTrackingServelWriter(clock);
    const res = await runIngestServel({
      conector: fakeConnector(bytes),
      writer,
      maestra: maestraDet(),
      tareas: [tarea("diputado-2025")],
      r2Store: r2Store as never,
    });
    expect(r2Store.putOrders.length).toBe(1);
    expect(writer.upsertOrders.length).toBe(0);
    expect(writer.inner.aportes.size).toBe(0);
    expect(res.aportes).toBe(0);
  });

  it("E: fail-soft por eleccion — A cuarentenada por drift + B ok en la MISMA corrida", async () => {
    const headersDrift = EXPECTED_HEADERS.map((h) => (h === "MONTO" ? "IMPORTE" : h));
    const bytesA = await xlsx([...headersDrift], [FILA_DET]); // drift -> cuarentena run-level.
    const bytesB = await xlsx([...EXPECTED_HEADERS], [FILA_DET, FILA_DET2]); // ok.
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const writer = new OrderTrackingServelWriter(clock);
    // Conector que sirve bytesA para A y bytesB para B (por url distinta).
    const conector = {
      async descargar(url: string): Promise<DescargaServel> {
        const b = url.includes("a.xlsx") ? bytesA : bytesB;
        return {
          bytes: b,
          byteLength: b.byteLength,
          anclas: { etag: '"x"', contentMd5: md5Base64(b), lastModified: null, contentLength: b.byteLength },
        };
      },
    } as unknown as ServelConnector;
    const res = await runIngestServel({
      conector,
      writer,
      maestra: maestraDet(),
      tareas: [
        tarea("eleccion-A", { url: "https://repodocgastoelectoral.blob.core.windows.net/a.xlsx" }),
        tarea("eleccion-B", { url: "https://repodocgastoelectoral.blob.core.windows.net/b.xlsx" }),
      ],
      fechaCorte: "2026-06-19",
      r2Store: r2Store as never,
    });
    expect(res.cuarentenados).toContain("eleccion-A"); // A degradada.
    expect(res.aportes).toBe(2); // B ok (no aborto la corrida).
  });

  it("E': fail-soft por eleccion — A bloqueada (ServelBloqueadaError) + B ok en la MISMA corrida", async () => {
    const bytesB = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const writer = new OrderTrackingServelWriter(clock);
    const conector = {
      async descargar(url: string): Promise<DescargaServel> {
        if (url.includes("a.xlsx")) throw new ServelBloqueadaError("https://x", 503);
        return {
          bytes: bytesB,
          byteLength: bytesB.byteLength,
          anclas: { etag: '"x"', contentMd5: md5Base64(bytesB), lastModified: null, contentLength: bytesB.byteLength },
        };
      },
    } as unknown as ServelConnector;
    const res = await runIngestServel({
      conector,
      writer,
      maestra: maestraDet(),
      tareas: [
        tarea("eleccion-A", { url: "https://repodocgastoelectoral.blob.core.windows.net/a.xlsx" }),
        tarea("eleccion-B", { url: "https://repodocgastoelectoral.blob.core.windows.net/b.xlsx" }),
      ],
      fechaCorte: "2026-06-19",
      r2Store: r2Store as never,
    });
    expect(res.degradaciones.some((d) => /HTTP 503/.test(d.motivo))).toBe(true); // A degradada.
    expect(res.aportes).toBe(1); // B ok.
  });

  it("F: eleccion + fecha_corte sobreviven byte-identicos tras el replay --from-r2 (no recomputados)", async () => {
    const bytes = await xlsx([...EXPECTED_HEADERS], [FILA_DET]);
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const r2Path = "servel/diputado-2025/2026-06-19/cafef00d.xlsx";
    r2Store.seed(r2Path, bytes);
    const writer = new InMemoryServelWriter();
    await runIngestServel({
      conector: conectorQueLanza(),
      writer,
      maestra: maestraDet(),
      tareas: [tarea("diputado-2025", { url: "", anio: "2025" })],
      fechaCorte: "2026-06-19",
      r2Store: r2Store as never,
      fromR2: r2Path,
    });
    const fila = [...writer.aportes.values()][0]!;
    // eleccion compuesta VERBATIM del parser: "DIPUTADO - DISTRITO 1 - 2025".
    expect(fila.eleccion).toBe("DIPUTADO - DISTRITO 1 - 2025");
    // fecha_corte byte-identica a la inyectada (no recomputada por el wire).
    expect(fila.fecha_corte).toBe("2026-06-19");
  });
});
