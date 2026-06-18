/**
 * Tests del worker ingest-worker (deno test) — sin red, sin DB, sin env.
 *
 * Verifica el contrato de ack/no-ack de processBatch:
 *   - exito  => ack (pgmq.delete) del msg_id
 *   - fallo  => NO-ACK (el mensaje no se borra => reaparece via vt)
 * y la validacion zod del batch entrante.
 */
import { assertEquals } from "jsr:@std/assert@1";
import {
  authorized,
  handler,
  type IngestBatch,
  type IngestRunLifecycle,
  processBatch,
  type QueueAck,
} from "./index.ts";
import type { IngestRun } from "@obs/core";

/** Ack mock que registra los msg_id ackeados. */
function spyAck(): QueueAck & { acked: number[] } {
  const acked: number[] = [];
  return {
    acked,
    async ack(_queue: string, msgId: number): Promise<void> {
      acked.push(msgId);
    },
  };
}

const fixtureBatch: IngestBatch = [
  { msg_id: 1, message: { boletin: "0001-AA" } },
  { msg_id: 2, message: { boletin: "0002-BB" } },
];

Deno.test("ack en exito: cada job corrido se borra de la cola", async () => {
  const ack = spyAck();
  let runs = 0;
  const connector = {
    run(_ctx: IngestRun): Promise<unknown> {
      runs++;
      return Promise.resolve([]);
    },
  };

  const res = await processBatch(fixtureBatch, connector, ack);

  assertEquals(runs, 2, "corrio el connector por cada job");
  assertEquals(res.acked, 2, "ackeo los 2 jobs exitosos");
  assertEquals(res.failed, 0);
  assertEquals(ack.acked, [1, 2], "borro ambos msg_id de ingest_jobs");
});

Deno.test("no-ack en fallo: el job que lanza NO se borra (reaparece via vt)", async () => {
  const ack = spyAck();
  const connector = {
    run(_ctx: IngestRun): Promise<unknown> {
      return Promise.reject(new Error("429 simulado"));
    },
  };

  const res = await processBatch(fixtureBatch, connector, ack);

  assertEquals(res.acked, 0, "ningun job se ackeo");
  assertEquals(res.failed, 2, "ambos fallaron");
  assertEquals(ack.acked, [], "no se borro ningun mensaje => backoff via vt");
});

Deno.test("ack mixto: exito ackea, fallo NO-ackea (aislamiento por job)", async () => {
  const ack = spyAck();
  let call = 0;
  const connector = {
    run(_ctx: IngestRun): Promise<unknown> {
      call++;
      // El primer job falla con error TRANSITORIO; el segundo tiene exito.
      return call === 1
        ? Promise.reject(new Error("fallo job 1")) // name=Error => transitorio
        : Promise.resolve([]);
    },
  };

  const res = await processBatch(fixtureBatch, connector, ack);

  assertEquals(res.acked, 1, "solo el job exitoso se ackeo");
  assertEquals(res.failed, 1, "el job que fallo no se ackeo");
  assertEquals(ack.acked, [2], "solo el msg_id 2 se borro de la cola");
});

// --- CR-01: autenticacion del handler ---

Deno.test("CR-01: handler sin Authorization => 401 (no procesa, no ackea)", async () => {
  // Sin INGEST_WORKER_SECRET seteado => fail-closed: cualquier request es 401.
  const prev = Deno.env.get("INGEST_WORKER_SECRET");
  Deno.env.delete("INGEST_WORKER_SECRET");
  try {
    const req = new Request("http://localhost/functions/v1/ingest-worker", {
      method: "POST",
      body: JSON.stringify({ batch: [] }),
    });
    const res = await handler(req);
    assertEquals(res.status, 401, "sin secreto configurado => fail-closed 401");
  } finally {
    if (prev !== undefined) Deno.env.set("INGEST_WORKER_SECRET", prev);
  }
});

Deno.test("CR-01: authorized rechaza Bearer incorrecto y acepta el correcto", () => {
  const prev = Deno.env.get("INGEST_WORKER_SECRET");
  Deno.env.set("INGEST_WORKER_SECRET", "s3cr3t");
  try {
    const mk = (auth?: string) =>
      new Request("http://localhost/x", {
        headers: auth ? { Authorization: auth } : {},
      });
    assertEquals(authorized(mk()), false, "sin header => false");
    assertEquals(authorized(mk("Bearer wrong")), false, "secreto erroneo => false");
    assertEquals(authorized(mk("Bearer s3cr3t")), true, "secreto correcto => true");
  } finally {
    if (prev !== undefined) Deno.env.set("INGEST_WORKER_SECRET", prev);
    else Deno.env.delete("INGEST_WORKER_SECRET");
  }
});

// --- WR-06: ciclo de vida ingest_run ---

Deno.test("WR-06: processBatch crea y cierra ingest_run con el id real", async () => {
  const ack = spyAck();
  const started: string[] = [];
  const finished: Array<{ id: number; status: string }> = [];
  const lifecycle: IngestRunLifecycle = {
    start(source) {
      started.push(source);
      return Promise.resolve({
        id: 42,
        source,
        startedAt: "2026-06-17T00:00:00Z",
        status: "running",
        stats: {},
      });
    },
    finish(id, status) {
      finished.push({ id, status });
      return Promise.resolve();
    },
  };
  let ctxId = -1;
  const connector = {
    run(ctx: IngestRun): Promise<unknown> {
      ctxId = ctx.id; // verifica que se threadea el id REAL (no un cast fabricado)
      return Promise.resolve([{}]);
    },
  };

  const res = await processBatch([{ msg_id: 1, message: {} }], connector, ack, lifecycle);

  assertEquals(res.acked, 1);
  assertEquals(ctxId, 42, "el connector recibio el id real de ingest_run");
  assertEquals(started, ["dummy"]);
  assertEquals(finished, [{ id: 42, status: "ok" }], "se cerro la corrida en ok");
});

// --- WR-04: clasificacion de errores (permanente => ack, transitorio => no-ack) ---

Deno.test("WR-04: error permanente (FetchError) => ACK para no loopear", async () => {
  const ack = spyAck();
  const connector = {
    run(_ctx: IngestRun): Promise<unknown> {
      const e = new Error("404 permanente");
      e.name = "FetchError";
      return Promise.reject(e);
    },
  };
  const res = await processBatch([{ msg_id: 7, message: {} }], connector, ack);
  assertEquals(res.failed, 1, "se contabiliza como fallo");
  assertEquals(ack.acked, [7], "error permanente => ackeado (no gasta vt)");
});

Deno.test("WR-04: error transitorio (Error generico) => NO-ACK (backoff via vt)", async () => {
  const ack = spyAck();
  const connector = {
    run(_ctx: IngestRun): Promise<unknown> {
      return Promise.reject(new Error("429 transitorio")); // name=Error
    },
  };
  const res = await processBatch([{ msg_id: 8, message: {} }], connector, ack);
  assertEquals(res.failed, 1);
  assertEquals(ack.acked, [], "transitorio => NO ackeado => reaparece via vt");
});
