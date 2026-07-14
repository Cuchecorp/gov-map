// ingest-run.test — wire dos-etapas R2 de ChileCompra (DEBT-01 + MONEY-01), 100% OFFLINE.
//
// Espeja el molde de Phase 66 (RUTA A): un `FakeR2Store` (putImmutable/getObject) y un
// `OrderTrackingWriter` comparten un CONTADOR MONOTONICO -> los tests prueban el ORDEN DE CAPTURA
// (Etapa 1 R2 ANTES de Etapa 2 Supabase), no la mera presencia. Cinco casos:
//   A  put-antes-upsert   — la 1a putImmutable captura un orden < la 1a upsertContratos.
//   B  --from-r2 0-fetch   — replay desde R2 con un conector que LANZA si se toca (0 fetch fuente).
//   C  put-falla-gatea     — putImmutable que LANZA -> RUT en `errores`, upsertContratos NO llamado.
//   D  412 idempotente     — putImmutable devuelve existed:true -> skip Etapa 2 (0 upsert).
//   E  monto/nombre VERBATIM — el string crudo sobrevive byte-identico tras el replay.
//
// El envelope de dinero es POR-RUT (Pitfall 2): { rut, buscarProveedor: <json paso1>,
// ordenes: { [dia]: <json paso2> } } — NO la forma por-boletin de tramitacion.

import { describe, it, expect } from "vitest";
import type { Parlamentario } from "@obs/core";
import type { ChileCompraConnector } from "./connector-chilecompra";
import { runIngestDinero, type TareaRut } from "./ingest-run";
import { InMemoryDineroWriter } from "./writer";
import type { DineroWriter } from "./writer";
import type { ContratoParaEscribir } from "./reconciliar-contrato";
import type { Contratista } from "./model";

const SECRET_TICKET = "S3CR3T-TICKET-NO-LEAK-70";

// ── Fakes offline compartiendo un contador monotonico ──────────────────────────

/** Contador monotonico compartido: cada captura toma el siguiente entero (orden de eventos). */
class MonotonicClock {
  private n = 0;
  next(): number {
    return this.n++;
  }
}

/**
 * FakeR2Store: registra el ORDEN de cada `putImmutable` (via el reloj compartido) y sirve el ultimo
 * envelope guardado por `getObject`. `mode` controla el comportamiento: "ok" (existed:false),
 * "existed" (412 idempotente) o "throw" (fallo no-412 que debe GATEAR la Etapa 2).
 */
class FakeR2Store {
  readonly putOrders: number[] = [];
  readonly puts: { r2Path: string; bytes: Uint8Array }[] = [];
  readonly byPath = new Map<string, Uint8Array>();
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
      // Fallo no-412 (p.ej. HTTP 500 / red) — la Etapa 1 no persistio el crudo.
      throw new Error(`R2 PUT 500 para ${source}/${resource}/${date}/${sha}.${ext}`);
    }
    const r2Path = `${source}/${resource}/${date}/${sha}.${ext}`;
    this.puts.push({ r2Path, bytes });
    this.byPath.set(r2Path, bytes);
    return { r2Path, existed: this.mode === "existed" };
  }
  async getObject(r2Path: string): Promise<Uint8Array> {
    const b = this.byPath.get(r2Path);
    if (!b) throw new Error(`R2 GET 404 para ${r2Path}`);
    return b;
  }
}

/** Writer que registra el ORDEN de cada upsertContratos (via el reloj compartido). */
class OrderTrackingWriter implements DineroWriter {
  readonly upsertOrders: number[] = [];
  readonly inner = new InMemoryDineroWriter();
  constructor(private readonly clock: MonotonicClock) {}
  async upsertContratos(filas: ContratoParaEscribir[]): Promise<void> {
    this.upsertOrders.push(this.clock.next());
    await this.inner.upsertContratos(filas);
  }
  async upsertContratistas(filas: Contratista[]): Promise<void> {
    await this.inner.upsertContratistas(filas);
  }
  async marcarIngestado(ids: string[], hasta: string): Promise<void> {
    await this.inner.marcarIngestado(ids, hasta);
  }
}

// ── Conectores fake ────────────────────────────────────────────────────────────

/** Respuesta cruda del paso 1 (BuscarProveedor) y paso 2 (ordenesdecompra.json). */
function buscarJson(codigo: string, nombre: string) {
  return { CodigoEmpresa: codigo, NombreEmpresa: nombre };
}
function ordenesJson(codigoOrden: string, nombreOrden: string) {
  return {
    Cantidad: 1,
    Listado: [
      {
        Codigo: codigoOrden,
        Nombre: nombreOrden,
        FechaEnvio: "2024-02-02",
        Comprador: { NombreOrganismo: "ORGANISMO X" },
      },
    ],
  };
}

/** Conector fake normal: sirve buscarProveedor/ordenesDeCompra desde memoria (sin red). */
function conectorNormal(codigo: string, nombre: string, nombreOrden: string): ChileCompraConnector {
  return {
    async buscarProveedor() {
      return buscarJson(codigo, nombre);
    },
    async ordenesDeCompra() {
      return ordenesJson("OC-1", nombreOrden);
    },
  } as unknown as ChileCompraConnector;
}

/** Conector fake que LANZA si se le toca — prueba 0 fetch a la fuente en el replay `--from-r2`. */
function conectorQueLanza(): ChileCompraConnector {
  return {
    async buscarProveedor() {
      throw new Error("PROHIBIDO: --from-r2 NO debe tocar buscarProveedor (0 fetch a la fuente)");
    },
    async ordenesDeCompra() {
      throw new Error("PROHIBIDO: --from-r2 NO debe tocar ordenesDeCompra (0 fetch a la fuente)");
    },
  } as unknown as ChileCompraConnector;
}

/** RUT de persona juridica valido (DV modulo-11 correcto) — evita el name-pipeline. */
const RUT_JURIDICO = "76.123.456-0";

function tareas(rut: string, dias: string[] = ["02022024"]): TareaRut[] {
  return [{ rut, dias }];
}

const MAESTRA: Parlamentario[] = [];

describe("runIngestDinero — Etapa 1 R2 (dos-etapas, DEBT-01)", () => {
  it("A: putImmutable (Etapa 1) captura un orden ESTRICTAMENTE menor que upsertContratos (Etapa 2)", async () => {
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const writer = new OrderTrackingWriter(clock);
    await runIngestDinero({
      conector: conectorNormal("17793", "PROVEEDOR SA", "Compra de sillas"),
      writer,
      ticket: SECRET_TICKET,
      maestra: MAESTRA,
      tareas: tareas(RUT_JURIDICO),
      r2Store: r2Store as never,
    });
    expect(r2Store.putOrders.length).toBeGreaterThan(0);
    expect(writer.upsertOrders.length).toBeGreaterThan(0);
    // Orden de CAPTURA: la 1a Etapa 1 precede a la 1a Etapa 2 (no por presencia).
    expect(r2Store.putOrders[0]!).toBeLessThan(writer.upsertOrders[0]!);
    // Content-addressed bajo "dinero/<rut>/...".
    expect(r2Store.puts[0]!.r2Path).toMatch(/^dinero\//);
  });

  it("B: --from-r2 replay puebla contratos con un conector que LANZA si se toca (0 fetch)", async () => {
    // 1) Corrida normal para dejar el envelope en R2.
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const writer1 = new OrderTrackingWriter(clock);
    await runIngestDinero({
      conector: conectorNormal("17793", "PROVEEDOR SA", "Compra de sillas"),
      writer: writer1,
      ticket: SECRET_TICKET,
      maestra: MAESTRA,
      tareas: tareas(RUT_JURIDICO),
      r2Store: r2Store as never,
    });
    const r2Path = r2Store.puts[0]!.r2Path;

    // 2) Replay --from-r2 con un conector que LANZA si se toca -> prueba 0 fetch a la fuente.
    const writer2 = new InMemoryDineroWriter();
    const res = await runIngestDinero({
      conector: conectorQueLanza(),
      writer: writer2,
      ticket: SECRET_TICKET,
      maestra: MAESTRA,
      tareas: tareas(RUT_JURIDICO),
      r2Store: r2Store as never,
      fromR2: r2Path,
    });
    // El contrato se reconstruyo desde el envelope sin tocar la fuente.
    expect(res.contratos).toBe(1);
    expect(writer2.contratos.size).toBe(1);
  });

  it("B-guard: --from-r2 sin r2Store LANZA error de args", async () => {
    await expect(
      runIngestDinero({
        conector: conectorQueLanza(),
        writer: new InMemoryDineroWriter(),
        ticket: SECRET_TICKET,
        maestra: MAESTRA,
        tareas: tareas(RUT_JURIDICO),
        fromR2: "dinero/x/2026-07-14/abc.json",
      }),
    ).rejects.toThrow();
  });

  it("C: putImmutable que LANZA (no-412) GATEA el upsert — RUT en errores, upsertContratos NO llamado", async () => {
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "throw");
    const writer = new OrderTrackingWriter(clock);
    const res = await runIngestDinero({
      conector: conectorNormal("17793", "PROVEEDOR SA", "Compra de sillas"),
      writer,
      ticket: SECRET_TICKET,
      maestra: MAESTRA,
      tareas: tareas(RUT_JURIDICO),
      r2Store: r2Store as never,
    });
    // Etapa-1-primero LOCKED: sin crudo en R2, NO hay derivado en Supabase.
    expect(writer.upsertOrders.length).toBe(0);
    expect(writer.inner.contratos.size).toBe(0);
    expect(res.errores.length).toBeGreaterThan(0);
    // El mensaje del error va redactado (no filtra el ticket).
    expect(res.errores.some((e) => e.clave.includes(RUT_JURIDICO))).toBe(true);
    for (const e of res.errores) expect(e.mensaje).not.toContain(SECRET_TICKET);
  });

  it("D: 412 (existed:true) hace skip de la Etapa 2 — 0 upsert para ese RUT", async () => {
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "existed");
    const writer = new OrderTrackingWriter(clock);
    await runIngestDinero({
      conector: conectorNormal("17793", "PROVEEDOR SA", "Compra de sillas"),
      writer,
      ticket: SECRET_TICKET,
      maestra: MAESTRA,
      tareas: tareas(RUT_JURIDICO),
      r2Store: r2Store as never,
    });
    expect(r2Store.putOrders.length).toBe(1);
    expect(writer.upsertOrders.length).toBe(0);
    expect(writer.inner.contratos.size).toBe(0);
  });

  it("E: el string crudo del paso 2 (nombreOrden) sobrevive byte-identico tras el replay", async () => {
    const NOMBRE_CRUDO = "Compra VERBATIM 1.234.567 pesos · ñÑáé";
    // 1) Normal -> envelope a R2.
    const clock = new MonotonicClock();
    const r2Store = new FakeR2Store(clock, "ok");
    const writer1 = new OrderTrackingWriter(clock);
    await runIngestDinero({
      conector: conectorNormal("17793", "PROVEEDOR SA", NOMBRE_CRUDO),
      writer: writer1,
      ticket: SECRET_TICKET,
      maestra: MAESTRA,
      tareas: tareas(RUT_JURIDICO),
      r2Store: r2Store as never,
    });
    const r2Path = r2Store.puts[0]!.r2Path;

    // 2) Replay -> el nombre_orden persistido es byte-identico al crudo (no re-parseado/reformateado).
    const writer2 = new InMemoryDineroWriter();
    await runIngestDinero({
      conector: conectorQueLanza(),
      writer: writer2,
      ticket: SECRET_TICKET,
      maestra: MAESTRA,
      tareas: tareas(RUT_JURIDICO),
      r2Store: r2Store as never,
      fromR2: r2Path,
    });
    const fila = [...writer2.contratos.values()][0]!;
    expect(fila.nombre_orden).toBe(NOMBRE_CRUDO);
    // El monto se preserva tal cual el modelo lo entrega (null hoy — NUNCA re-parseado a numero).
    expect(fila.monto).toBeNull();
  });
});
