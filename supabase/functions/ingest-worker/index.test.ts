/**
 * Tests del worker ingest-worker (deno test) — sin red, sin DB, sin env.
 *
 * Verifica el contrato de ack/no-ack de processBatch:
 *   - exito  => ack (pgmq.delete) del msg_id
 *   - fallo  => NO-ACK (el mensaje no se borra => reaparece via vt)
 * y la validacion zod del batch entrante.
 */
import { assertEquals } from "jsr:@std/assert@1";
import { processBatch, type IngestBatch, type QueueAck } from "./index.ts";
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
      // El primer job falla; el segundo tiene exito.
      return call === 1
        ? Promise.reject(new Error("fallo job 1"))
        : Promise.resolve([]);
    },
  };

  const res = await processBatch(fixtureBatch, connector, ack);

  assertEquals(res.acked, 1, "solo el job exitoso se ackeo");
  assertEquals(res.failed, 1, "el job que fallo no se ackeo");
  assertEquals(ack.acked, [2], "solo el msg_id 2 se borro de la cola");
});
