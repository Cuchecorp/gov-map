// run-agenda-prod-cli — entry-point de OPERADOR de la ingesta de AGENDA contra PROD.
//
// El `ingest-cli.ts` del paquete apunta a Supabase LOCAL (SUPABASE_LOCAL_SERVICE_KEY +
// 127.0.0.1:54421). Este thin runner MIRRORea `packages/lobby/src/run-camara-lobby-cli.ts`:
// carga `.env` (BOM-safe), arma el SupabaseAgendaWriter contra el Supabase REMOTO
// (SUPABASE_API_URL + SUPABASE_SECRET_KEY), ensambla los conectores REALES de @obs/agenda
// (Cámara con `createCurlTransport` para PASAR el WAF de Cloudflare; Senado con fetch nativo)
// y corre `runIngest` sobre la SEMANA ISO ACTUAL + las próximas 2 (la agenda es forward-looking).
//
// Credenciales SOLO de `.env` (NUNCA por argv → no quedan en `ps`/history). Idempotente:
// el writer upserta por clave natural. `--dry-run` corre fetch/parse in-memory sin escribir.
//
// Uso:
//   tsx packages/agenda/src/run-agenda-prod-cli.ts [--dry-run] [--solo-senado]
//                                                  [--desde YYYY-Www] [--hasta YYYY-Www]
//
// Default de rango: --desde = semana ISO actual, --hasta = actual + 2 semanas (3 semanas).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard, R2Store } from "@obs/ingest";
import { DeepSeekProvider, type LLMProvider } from "@obs/llm";
import { CitacionesCamaraConnector } from "./connector-camara";
import { SenadoActividadConnector } from "./connector-senado";
import { createCurlTransport } from "./transport-curl";
import { SupabaseAgendaWriter } from "./writer-supabase";
import { InMemoryAgendaWriter, type AgendaWriter } from "./writer";
import { runIngest, type TablaR2Target } from "./ingest-run";
import { isoWeekOf, enumerarSemanas, semanaIsoKey, type SemanaIso } from "./semana-iso";
import { parseSemanaIso } from "./ingest-cli";

/** Backoff base entre reintentos ante 403 de Cámara en la corrida LIVE. */
const BACKOFF_MS = 2000;
/** Días a futuro para el rango por defecto (actual + 2 semanas = 3 semanas ISO). */
const DIAS_FORWARD = 14;

/** Lee el valor de un flag `--x <valor>` de argv, o null. */
function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/**
 * Carga variables BOM-safe: parte del `.env` local (operador) y deja que `process.env`
 * tenga PRECEDENCIA (CI/GitHub Actions inyecta los secrets ahí, sin archivo `.env`). Si
 * no hay `.env` (CI), usa solo `process.env`.
 */
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin `.env` (CI): los secrets vienen de process.env (abajo).
  }
  for (const k of [
    "SUPABASE_API_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_URL",
    "DEEPSEEK_API_KEY",
    "R2_ENDPOINT_URL",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const dryRun = process.argv.includes("--dry-run");
  const soloSenado = process.argv.includes("--solo-senado");
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  // Rango de semanas: --desde/--hasta explícitos o, por defecto, actual + próximas 2.
  const desdeRaw = flagValue("--desde");
  const hastaRaw = flagValue("--hasta");
  const now = new Date();
  const desde: SemanaIso = desdeRaw ? parseSemanaIso(desdeRaw, "--desde") : isoWeekOf(now);
  const hasta: SemanaIso = hastaRaw
    ? parseSemanaIso(hastaRaw, "--hasta")
    : isoWeekOf(new Date(now.getTime() + DIAS_FORWARD * 86_400_000));
  const semanas = enumerarSemanas(desde, hasta);
  log(
    `agenda: semanas ISO ${semanaIsoKey(desde.year, desde.week)}..${semanaIsoKey(hasta.year, hasta.week)} ` +
      `(${semanas.length}): ${semanas.map((s) => semanaIsoKey(s.year, s.week)).join(", ")}`,
  );

  // Conectores REALES (política @obs/ingest: rate-limit 2-3s + robots + UA + SSRF).
  // Cámara: Fetcher con transporte curl (PASA el WAF de Cloudflare; fetch nativo recibe 403).
  // Senado: web-back.senado.cl es API limpia → fetch nativo.
  const rateLimiter = new HostRateLimiter();
  const robots = new RobotsGuard({ allowlist: {} });
  const curlTransport = createCurlTransport();
  const conectorCamara = new CitacionesCamaraConnector({
    fetcher: new Fetcher({ fetchFn: curlTransport as unknown as typeof fetch }),
    rateLimiter,
    robots,
  });
  const conectorSenado = new SenadoActividadConnector({
    fetcher: new Fetcher(),
    rateLimiter,
    robots,
  });

  let writer: AgendaWriter;
  if (dryRun || !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY) {
    writer = new InMemoryAgendaWriter();
    log("agenda: DRY-RUN (in-memory, no escribe DB)");
  } else {
    writer = new SupabaseAgendaWriter({
      url: env.SUPABASE_API_URL,
      serviceKey: env.SUPABASE_SECRET_KEY,
    });
    log(`agenda: writer Supabase PROD (${env.SUPABASE_API_URL}) — upsert idempotente`);
  }

  // Tabla de sala de Cámara (DeepSeek-desde-PDF): provider LLM gateado por DEEPSEEK_API_KEY;
  // R2 (etapa 1) gateado por presencia de las 4 credenciales R2. Sin key → undefined → el
  // paso 4 mantiene la degradación honesta pura (enlace PDF). NUNCA se hardcodea ni se loguea.
  let proveedorTablaCamara: LLMProvider | undefined;
  if (env.DEEPSEEK_API_KEY) {
    proveedorTablaCamara = new DeepSeekProvider({ apiKey: env.DEEPSEEK_API_KEY });
    log("agenda: tabla de sala de Cámara → DeepSeek-desde-PDF habilitado");
  } else {
    log("agenda: sin DEEPSEEK_API_KEY → tabla de Cámara degrada honesto al PDF");
  }
  const r2Creds =
    env.R2_ENDPOINT_URL && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET;
  const r2: TablaR2Target | undefined = r2Creds
    ? new R2Store({
        endpoint: env.R2_ENDPOINT_URL!,
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
        bucket: env.R2_BUCKET!,
      })
    : undefined;

  const res = await runIngest({
    conectorCamara,
    conectorSenado,
    writer,
    semanas,
    soloSenado,
    backoffMs: BACKOFF_MS,
    log,
    proveedorTablaCamara,
    r2,
    r2Enabled: Boolean(r2Creds),
    // `prmId=0` = la semana vigente → asociar la tabla a la semana ISO actual (la primera del rango).
    semanaTablaCamara: desde,
  });

  console.log(
    `\nagenda ${dryRun ? "DRY-RUN" : "LIVE"}: camara=${res.camaraCitaciones} ` +
      `senado=${res.senadoCitaciones} sesiones=${res.senadoSesiones} ` +
      `camaraSesiones=${res.camaraSesiones} ` +
      `errores=${res.errores.length} degradaciones=${res.degradaciones.length}`,
  );
  for (const e of res.errores) log(`agenda: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`);
  for (const d of res.degradaciones) {
    log(
      `agenda: DEGRADA [${d.fuente}]: ${d.motivo}` +
        (d.enlace ? ` (${d.enlace})` : "") +
        (d.semanasOmitidas?.length ? ` [omitidas: ${d.semanasOmitidas.join(", ")}]` : ""),
    );
  }
  process.exit(res.errores.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("agenda FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
