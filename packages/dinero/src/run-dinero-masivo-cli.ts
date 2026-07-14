// run-dinero-masivo-cli — entry-point de OPERADOR de la ingesta masiva de dinero (ChileCompra).
//
// Espejo de `run-votos-masivo-cli.ts` (Phase 66): construye un `R2Store` real de `.env R2_*` y lo
// threadea a `runIngestDinero` -> los contratos ganan la Etapa 1 R2 (crudo content-addressed por-RUT
// ANTES del upsert a Supabase). `--from-r2 <r2Path>` re-ejecuta la Etapa 2 DESDE R2 sin tocar la
// fuente (0 fetch). El `MERCADOPUBLICO_TICKET` es secreto de operador: SOLO de env (nunca argv), y
// TODO log/error/degradacion pasa por `redactarTicket` (CR-01: el ticket NUNCA en claro).
//
// El crawl LIVE (que consume cuota de MERCADOPUBLICO) es operador-LOCAL (runbook), fuera de esta
// corrida CI. Sin `.env R2_*` la Etapa 1 se omite con WARN (degrada honesto). Sin DB o sin ticket
// (y sin --from-r2) -> DRY-RUN (InMemory), NUNCA fabrica.
//
// Uso: tsx packages/dinero/src/run-dinero-masivo-cli.ts [--dry-run] [--rut RUT]... [--dia DDMMAAAA]...
//        [--ruts-file <ruta>] [--from-r2 <r2Path>]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R2Store } from "@obs/ingest";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { ChileCompraConnector } from "./connector-chilecompra";
import { SupabaseDineroWriter } from "./writer-supabase";
import { InMemoryDineroWriter } from "./writer";
import type { DineroWriter } from "./writer";
import { ddmmaaaaDe, redactarTicket } from "./query";
import { runIngestDinero, type RunIngestDineroResult, type TareaRut } from "./ingest-run";
import type { ReconciliarContratoOpts } from "./reconciliar-contrato";

/** Error de flags — se reporta ANTES de cualquier red/DB. */
export class DineroMasivoArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "DineroMasivoArgsError";
  }
}

/** Lee `.env` BOM-safe (espejo de run-votos-masivo-cli). */
function loadEnv(root: string): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

export interface DineroMasivoOptions {
  ruts?: string[];
  dias?: string[];
  rutsFile?: string;
  dryRun?: boolean;
  fromR2?: string;
}

export interface DineroMasivoDeps {
  /** Env inyectable (tests). Default: `loadEnv(root)` + `process.env` para el ticket. */
  env?: Record<string, string>;
  /** Ticket inyectable (tests). Default: `env.MERCADOPUBLICO_TICKET`. NUNCA de argv. */
  ticket?: string;
  /** Maestra inyectable. Default: vacia. */
  maestra?: Parlamentario[];
  reconciliar?: ReconciliarContratoOpts;
  /** Conector inyectable (tests, sin red). Default: el REAL de @obs/ingest. */
  conector?: ChileCompraConnector;
  /** Writer inyectable (tests). Default: Supabase real o InMemory segun dry-run. */
  writer?: DineroWriter;
  /** R2Store inyectable (tests). Default: construido de `.env R2_*` si estan presentes. */
  r2Store?: R2Store;
  log?: (msg: string) => void;
  /** Raiz del workspace para `loadEnv`. Default: cwd. */
  root?: string;
}

export interface DineroMasivoResult extends RunIngestDineroResult {
  dbLoaded: boolean;
  dryRun: boolean;
  /** true si se construyo/inyecto un R2Store (Etapa 1 activa). */
  r2Activo: boolean;
  fromR2: string | null;
}

/** Parsea argv -> DineroMasivoOptions, validando ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): DineroMasivoOptions {
  const opts: DineroMasivoOptions = {};
  const ruts: string[] = [];
  const dias: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--rut": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new DineroMasivoArgsError("--rut requiere un RUT");
        ruts.push(v.trim());
        break;
      }
      case "--dia": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new DineroMasivoArgsError("--dia requiere un DDMMAAAA");
        if (!/^\d{8}$/.test(v.trim())) throw new DineroMasivoArgsError("--dia debe ser ddmmaaaa (8 digitos)");
        dias.push(v.trim());
        break;
      }
      case "--ruts-file": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new DineroMasivoArgsError("--ruts-file requiere una ruta");
        opts.rutsFile = v.trim();
        break;
      }
      case "--from-r2": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new DineroMasivoArgsError("--from-r2 requiere un r2Path");
        opts.fromR2 = v.trim();
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new DineroMasivoArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  if (ruts.length > 0) opts.ruts = ruts;
  if (dias.length > 0) opts.dias = dias;
  return opts;
}

/**
 * Corre la ingesta masiva de dinero de OPERADOR. Construye el `R2Store` de `.env R2_*` (Etapa 1),
 * threadea `--from-r2`, loguea destino LOCAL/REMOTO y redacta el ticket en TODA salida. Devuelve los
 * conteos + si cargo DB + si R2 estuvo activo.
 */
export async function main(
  opts: DineroMasivoOptions = {},
  deps: DineroMasivoDeps = {},
): Promise<DineroMasivoResult> {
  const log = deps.log ?? ((m: string) => console.log(redactarTicket(m)));
  const root = deps.root ?? process.cwd();
  const env = deps.env ?? loadEnv(root);
  // Ticket: secreto de operador SOLO de env (nunca argv).
  const ticket = deps.ticket ?? env.MERCADOPUBLICO_TICKET ?? process.env.MERCADOPUBLICO_TICKET ?? "";

  // R2Store real de `.env R2_*` (Etapa 1). Sin R2 la Etapa 1 se omite (WARN) y `--from-r2` no lee.
  let r2Store = deps.r2Store;
  if (!r2Store && env.R2_ACCESS_KEY_ID && env.R2_ENDPOINT_URL) {
    r2Store = new R2Store({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
      endpoint: env.R2_ENDPOINT_URL,
      bucket: env.R2_BUCKET ?? "",
    });
    log("dinero-masivo: R2Store construido de .env (Etapa 1 activa) — crudo content-addressed");
  } else if (!r2Store) {
    log("dinero-masivo: [WARN] R2 no configurado (R2_ACCESS_KEY_ID/R2_ENDPOINT_URL) — Etapa 1 omitida");
  }
  if (opts.fromR2 && !r2Store) {
    throw new DineroMasivoArgsError(
      "--from-r2 requiere R2 configurado en .env (R2_ACCESS_KEY_ID + R2_ENDPOINT_URL)",
    );
  }

  // Tareas: RUTs de --rut / --ruts-file; dias de --dia (default: hoy).
  const rutsFromFile = opts.rutsFile
    ? readFileSync(opts.rutsFile, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];
  const ruts = [...(opts.ruts ?? []), ...rutsFromFile];
  const dias = opts.dias ?? [ddmmaaaaDe(new Date())];
  const tareas: TareaRut[] = ruts.map((rut) => ({ rut, dias }));

  // Writer: Supabase real (REMOTO) o InMemory (DRY-RUN/LOCAL). En --from-r2 no se exige ticket.
  const sinTicket = ticket.length === 0 && !opts.fromR2;
  const sinDb = !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY;
  const dryRun = opts.dryRun === true || sinTicket || sinDb;

  let writer: DineroWriter;
  let dbLoaded = false;
  if (deps.writer) {
    writer = deps.writer;
    dbLoaded = !dryRun;
  } else if (dryRun) {
    writer = new InMemoryDineroWriter();
    // Pitfall 5: loguear el destino ANTES de escribir (LOCAL vs REMOTO).
    log("dinero-masivo: DRY-RUN (in-memory, no escribe DB) — destino LOCAL");
  } else {
    writer = new SupabaseDineroWriter({ url: env.SUPABASE_API_URL!, serviceKey: env.SUPABASE_SECRET_KEY! });
    dbLoaded = true;
    log(`dinero-masivo: writer Supabase REMOTO (${env.SUPABASE_API_URL}) — upsert VERSIONADO idempotente`);
  }

  // Conector REAL de @obs/ingest, salvo inyeccion (tests) o replay (--from-r2 usa un fake interno).
  const conector =
    deps.conector ??
    new ChileCompraConnector({
      fetcher: new Fetcher(),
      rateLimiter: new HostRateLimiter(),
      robots: new RobotsGuard({ allowlist: {} }),
    });

  const res = await runIngestDinero({
    conector,
    writer,
    ticket,
    maestra: deps.maestra ?? [],
    tareas,
    ...(deps.reconciliar !== undefined ? { reconciliar: deps.reconciliar } : {}),
    ...(r2Store ? { r2Store } : {}),
    ...(opts.fromR2 ? { fromR2: opts.fromR2 } : {}),
    log,
  });

  log(
    `dinero-masivo ${dryRun ? "DRY-RUN" : "LIVE"}${opts.fromR2 ? " (--from-r2)" : ""}: ` +
      `contratos=${res.contratos} contratistas=${res.contratistas} dbLoaded=${dbLoaded} ` +
      `cuarentena=${res.cuarentenados.length} errores=${res.errores.length} degradaciones=${res.degradaciones.length}`,
  );
  // CR-01 defensa-en-profundidad: TODO error/degradacion redactado antes de imprimir.
  for (const e of res.errores) log(redactarTicket(`dinero-masivo: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`));
  for (const d of res.degradaciones) log(redactarTicket(`dinero-masivo: DEGRADA [${d.fuente}]: ${d.motivo}`));

  return { ...res, dbLoaded, dryRun, r2Activo: r2Store != null, fromR2: opts.fromR2 ?? null };
}

// Entry-point CLI.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /run-dinero-masivo-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: DineroMasivoOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("dinero-masivo FLAGS:", err instanceof Error ? redactarTicket(err.message) : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("dinero-masivo FALLO:", err instanceof Error ? redactarTicket(err.message) : err);
      process.exit(1);
    });
}
