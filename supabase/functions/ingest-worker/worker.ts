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
  extraHostsFromEnv,
  Fetcher,
  HostRateLimiter,
  PgHostThrottle,
  R2Store,
  RobotsGuard,
  SnapshotWriter,
} from "@obs/ingest";
import type { IngestRun, IngestStatus } from "@obs/core";

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

/**
 * CR-01: compara dos strings en tiempo (cuasi) constante para no filtrar la
 * longitud/contenido del secreto via timing. Compara los bytes UTF-8.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  // Longitud distinta: aun asi recorremos para no cortocircuitar por longitud.
  let diff = ba.length ^ bb.length;
  const len = Math.max(ba.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/**
 * CR-01: autoriza el request contra un secreto DEDICADO de invocacion del
 * worker (INGEST_WORKER_SECRET), separado del service_role key. El dispatcher
 * SQL envia `Authorization: Bearer <secret>`. Sin match => no se procesa nada
 * (ni ack de msg_ids => evita el primitivo de borrado de cola por un caller no
 * autenticado). Si el secreto no esta configurado, se rechaza TODO (fail-closed).
 */
export function authorized(req: Request): boolean {
  const secret = Deno.env.get("INGEST_WORKER_SECRET") ?? "";
  if (!secret) return false; // fail-closed: sin secreto configurado, nada pasa.
  const expected = `Bearer ${secret}`;
  const got = req.headers.get("Authorization") ?? "";
  return timingSafeEqualStr(got, expected);
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

/**
 * WR-06: ciclo de vida de ingest_run. Crea una fila `running` antes de correr el
 * connector, y la cierra a `ok`/`error` con stats. Devuelve el id real para
 * threadearlo a los snapshots (en vez del cast fabricado `as unknown as`).
 */
export interface IngestRunLifecycle {
  start(source: string): Promise<IngestRun>;
  finish(id: number, status: Extract<IngestStatus, "ok" | "error">, opts: {
    stats?: Record<string, unknown>;
    error?: string;
  }): Promise<void>;
}

export function makeRunLifecycle(sb: SupabaseClient): IngestRunLifecycle {
  return {
    async start(source: string): Promise<IngestRun> {
      const { data, error } = await sb
        .from("ingest_run")
        .insert({ source, status: "running" })
        .select("id, source, started_at, status, stats")
        .single();
      if (error) throw new Error(`insert ingest_run fallo: ${error.message}`);
      return {
        id: data.id as number,
        source: data.source as string,
        startedAt: data.started_at as string,
        status: data.status as IngestStatus,
        stats: (data.stats as Record<string, unknown>) ?? {},
      };
    },
    async finish(id, status, opts): Promise<void> {
      const { error } = await sb
        .from("ingest_run")
        .update({
          status,
          finished_at: new Date().toISOString(),
          stats: opts.stats ?? {},
          error: opts.error ?? null,
        })
        .eq("id", id);
      if (error) throw new Error(`update ingest_run fallo: ${error.message}`);
    },
  };
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
        // IN-01: ordenar por id (monotonico) — "fetched_at" puede empatar.
        .order("id", { ascending: false })
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
      if (error) {
        // WR-02: violacion de unique (source,resource,date_bucket) => otra
        // corrida ya capturo el snapshot de hoy. Tratar como exito idempotente:
        // leer la fila existente y devolver su id (no re-fetch, no fallo de job).
        if (error.code === "23505") {
          const { data: existing } = await sb
            .from("source_snapshot")
            .select("id")
            .eq("source", row.source as string)
            .eq("resource", row.resource as string)
            .eq("date_bucket", row.date_bucket as string)
            .maybeSingle();
          if (existing) return { id: existing.id as number };
          // 23505 pero la fila no aparece en el SELECT de recuperación: carrera
          // extrema (borrado out-of-band entre el INSERT y el SELECT). Error
          // RETRYABLE explícito — no se cae a `undefined`/TypeError (#40); reaparece
          // vía vt y el reintento reinserta limpiamente.
          throw new Error(
            `source_snapshot 23505 sin fila recuperable (carrera): ${row.source as string}/${row.resource as string}/${row.date_bucket as string}`,
          );
        }
        throw new Error(`insert source_snapshot fallo: ${error.message}`);
      }
      return { id: data.id as number };
    },
  });

  const rateLimiter = new HostRateLimiter();
  // CR-02: gate durable por host respaldado en Postgres (util.reserve_host_slot).
  const hostThrottle = new PgHostThrottle({
    async reserveHostSlot(host, minIntervalMs) {
      const { data, error } = await sb.schema("util").rpc("reserve_host_slot", {
        p_host: host,
        p_min_interval_ms: minIntervalMs,
      });
      if (error) throw new Error(`reserve_host_slot fallo: ${error.message}`);
      return (data as number) ?? 0;
    },
  });
  // CR-03: allowlist gubernamental + bloqueo SSRF. extraHosts (p.ej. dummy.local
  // para E2E) habilitados SOLO via env en dev/CI; en prod la lista queda vacia.
  const allowlist = {
    extraHosts: extraHostsFromEnv(Deno.env.get("INGEST_ALLOW_TEST_HOSTS")),
  };
  // #1: el RobotsGuard comparte el MISMO allowlist que el Fetcher, así el fetch
  // de robots.txt también queda gateado contra SSRF antes de tocar la red.
  const robots = new RobotsGuard({ allowlist });
  const fetcher = new Fetcher({ allowlist });

  return new DummyConnector({
    cache,
    robots,
    rateLimiter,
    hostThrottle,
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

/**
 * Procesa el batch: corre el connector por job, ack en exito, no-ack en fallo.
 *
 * WR-04: clasifica y loguea el error por msg_id (sin secretos). Los errores
 * permanentes (4xx no-429, validacion, host no permitido) se ACKean para no
 * gastar ciclos de vt; los transitorios (429/5xx, red, throttle diferido) se
 * NO-ackean para reaparecer via backoff.
 *
 * WR-06: por cada job se crea/cierra una fila ingest_run (status running -> ok/
 * error) y su id real se threadea al connector (en vez del cast fabricado).
 */
export async function processBatch(
  batch: IngestBatch,
  connector: { run(ctx: IngestRun): Promise<unknown> },
  ack: QueueAck,
  lifecycle?: IngestRunLifecycle,
): Promise<{ acked: number; failed: number }> {
  let acked = 0;
  let failed = 0;
  for (const job of batch) {
    let run: IngestRun | undefined;
    try {
      run = await lifecycle?.start("dummy");
      const ctx: IngestRun = run ?? {
        // Sin lifecycle (tests): ctx minimo pero TIPADO (no `as unknown as`).
        id: 0,
        source: "dummy",
        startedAt: new Date(0).toISOString(),
        status: "running",
        stats: {},
      };
      const result = await connector.run(ctx);
      const count = Array.isArray(result) ? result.length : 0;
      if (run) {
        await lifecycle?.finish(run.id, "ok", { stats: { snapshots: count } });
      }
      // ACK: exito => sacar de la cola (pgmq.delete).
      await ack.ack("ingest_jobs", job.msg_id);
      acked++;
    } catch (err) {
      // WR-04: log clasificado por msg_id, sin filtrar secretos.
      const name = err instanceof Error ? err.name : "UnknownError";
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`job ${job.msg_id} fallo [${name}]: ${msg}`);
      if (run) {
        try {
          await lifecycle?.finish(run.id, "error", { error: `${name}: ${msg}` });
        } catch (_finishErr) {
          // No enmascarar el fallo original por un fallo al cerrar la corrida.
        }
      }
      if (isPermanent(name)) {
        // Permanente: ACK para no loopear hasta el dead-letter (ahorra vt).
        try {
          await ack.ack("ingest_jobs", job.msg_id);
        } catch (_ackErr) {
          // Si el ack falla, el mensaje reaparecera via vt (peor caso tolerable).
        }
      }
      // NO-ACK (transitorio): el mensaje reaparece al expirar el vt (backoff).
      failed++;
    }
  }
  return { acked, failed };
}

/**
 * WR-04: errores NO recuperables que deben ackearse en vez de reintentar.
 *
 * `TypeError` se EXCLUYE a propósito (#41): un bug de programación que lance
 * TypeError, si se ackeara, drenaría la cola en silencio sin pasar nunca por la
 * DLQ. Al NO ackearlo, el mensaje reaparece vía vt y el dispatcher de pgmq lo
 * mueve a `ingest_dlq` tras `max_read_ct` — el bug queda visible para diagnóstico
 * en vez de desaparecer.
 */
function isPermanent(errorName: string): boolean {
  return (
    errorName === "FetchError" || // 4xx no-429
    errorName === "HostNotAllowedError" || // SSRF/allowlist (CR-03)
    errorName === "ZodError" // payload/forma invalida
  );
}

/** Handler HTTP: autoriza, valida el batch, ensambla deps reales y procesa. */
export async function handler(req: Request): Promise<Response> {
  // CR-01: autenticacion en el handler ANTES de parsear o tocar la cola.
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

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
  const lifecycle = makeRunLifecycle(sb);
  const result = await processBatch(parsed.batch, connector, ack, lifecycle);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
