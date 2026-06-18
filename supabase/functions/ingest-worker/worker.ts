/**
 * worker.ts — logica reutilizable del ingest-worker (sin bootstrap del servidor).
 *
 * Aqui vive el ensamblaje del DummyConnector con colaboradores REALES (DI), la
 * validacion zod del batch, el contrato de ack/no-ack y el handler HTTP. Tanto
 * la Edge Function (index.ts, via Deno.serve) como el escape hatch de GitHub
 * Actions (backfill.ts) importan de aqui => el MISMO conector corre en ambos
 * caminos (RESEARCH §6: lo recurrente y acotado en Edge Functions; lo masivo en
 * GitHub Actions, mismo codigo TS/Deno).
 *
 * Secrets via Deno.env (supabase secrets set / repo secrets en CI) — NUNCA
 * hardcodeados ni devueltos al cliente.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  DailyCache,
  DriftDetector,
  DummyConnector,
  Fetcher,
  HostRateLimiter,
  R2Store,
  RobotsGuard,
  SnapshotWriter,
} from "@obs/ingest";
import type { IngestRun } from "@obs/core";

/** Schema del batch entrante (Tampering: rechaza payloads malformados). */
const BatchItem = z.object({
  msg_id: z.number(),
  message: z.unknown(),
});
const Payload = z.object({
  batch: z.array(BatchItem),
});

export type IngestBatch = z.infer<typeof Payload>["batch"];

/** Lee un secreto obligatorio de Deno.env o lanza (sin filtrar el valor). */
export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

/** Ack: borra el mensaje de la cola (pgmq.delete via RPC). */
export interface QueueAck {
  ack(queue: string, msgId: number): Promise<void>;
}

/** Implementacion real de ack contra pgmq usando supabase-js RPC. */
export function makeQueueAck(sb: SupabaseClient): QueueAck {
  return {
    async ack(queue: string, msgId: number): Promise<void> {
      const { error } = await sb.schema("pgmq").rpc("delete", {
        queue_name: queue,
        msg_id: msgId,
      });
      if (error) throw new Error(`pgmq.delete fallo: ${error.message}`);
    },
  };
}

/** Crea el cliente supabase-js con el service key (server-only). */
export function makeClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_API_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false } },
  );
}

/** Ensambla el DummyConnector con los colaboradores reales (DI). */
export function buildConnector(sb: SupabaseClient): DummyConnector {
  const r2 = new R2Store({
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    endpoint: requireEnv("R2_ENDPOINT_URL"),
    bucket: requireEnv("R2_BUCKET"),
  });

  // Lookup/stores reales contra source_snapshot/drift_alert via supabase-js.
  const cache = new DailyCache({
    async hasSnapshot(source, resource, dateBucket) {
      const { count } = await sb
        .from("source_snapshot")
        .select("id", { count: "exact", head: true })
        .eq("source", source)
        .eq("resource", resource)
        .eq("date_bucket", dateBucket);
      return (count ?? 0) > 0;
    },
  });

  const drift = new DriftDetector({
    async lastFingerprint(source, resource) {
      const { data } = await sb
        .from("source_snapshot")
        .select("fingerprint")
        .eq("source", source)
        .eq("resource", resource)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.fingerprint ?? undefined;
    },
    async insertAlert(rec) {
      await sb.from("drift_alert").insert({
        source: rec.source,
        resource: rec.resource,
        prev_fingerprint: rec.prevFingerprint ?? null,
        new_fingerprint: rec.newFingerprint,
      });
    },
  });

  const snapshot = new SnapshotWriter({
    async insertSnapshot(row) {
      const { data, error } = await sb
        .from("source_snapshot")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(`insert source_snapshot fallo: ${error.message}`);
      return { id: data.id as number };
    },
  });

  const rateLimiter = new HostRateLimiter();
  const robots = new RobotsGuard();
  const fetcher = new Fetcher();

  return new DummyConnector({
    cache,
    robots,
    rateLimiter,
    fetcher,
    drift,
    r2,
    snapshot,
    log: {
      async skip(spec, reason) {
        console.log(`skip ${spec.resource}: ${reason}`);
      },
    },
  });
}

/** Procesa el batch: corre el connector por job, ack en exito, no-ack en fallo. */
export async function processBatch(
  batch: IngestBatch,
  connector: { run(ctx: IngestRun): Promise<unknown> },
  ack: QueueAck,
): Promise<{ acked: number; failed: number }> {
  let acked = 0;
  let failed = 0;
  for (const job of batch) {
    try {
      // Contexto minimo de corrida; el DummyConnector ignora el ctx salvo el id.
      const ctx = { source: "dummy", status: "running" } as unknown as IngestRun;
      await connector.run(ctx);
      // ACK: exito => sacar de la cola (pgmq.delete).
      await ack.ack("ingest_jobs", job.msg_id);
      acked++;
    } catch (_err) {
      // NO-ACK: el mensaje NO se borra => reaparece al expirar el vt (backoff).
      failed++;
    }
  }
  return { acked, failed };
}

/** Handler HTTP: valida el batch, ensambla deps reales y procesa. */
export async function handler(req: Request): Promise<Response> {
  let parsed;
  try {
    parsed = Payload.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "invalid batch" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = makeClient();
  const connector = buildConnector(sb);
  const ack = makeQueueAck(sb);
  const result = await processBatch(parsed.batch, connector, ack);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
