/**
 * ingest-worker — Edge Function (Deno) que cierra el walking skeleton.
 *
 * El dispatcher SQL (util.process_ingest_jobs) lee un lote de pgmq.ingest_jobs
 * e invoca esta funcion via pg_net con `{ batch: [{ msg_id, message }] }`. La
 * logica reutilizable vive en worker.ts (compartida con el escape hatch de
 * GitHub Actions, backfill.ts); este modulo solo arranca el servidor.
 *
 * Flujo: valida el batch con zod -> ensambla el DummyConnector con colaboradores
 * REALES (R2Store/aws4fetch, SnapshotWriter/DailyCache/DriftDetector contra
 * supabase-js) -> corre el connector por job -> ACK (pgmq.delete) en exito,
 * NO-ACK en fallo (deja expirar el vt => backoff natural ante 429/5xx).
 */
export {
  authorized,
  buildConnector,
  handler,
  type IngestBatch,
  type IngestRunLifecycle,
  makeClient,
  makeQueueAck,
  makeRunLifecycle,
  processBatch,
  type QueueAck,
  requireEnv,
} from "./worker.ts";

import { handler } from "./worker.ts";

// Solo arranca el servidor cuando este modulo es el principal (no al importarlo
// desde los tests => evita bindear un puerto en `deno test`).
if (import.meta.main) {
  Deno.serve(handler);
}
