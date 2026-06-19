// ingest-cli — entry-point de la corrida de dinero (espeja el ingest-cli de @obs/probidad).
//
// Instancia los colaboradores REALES de @obs/ingest (Fetcher + HostRateLimiter + RobotsGuard),
// arma ChileCompraConnector + SupabaseDineroWriter, y corre `runIngestDinero` ACOTADO (un punado de
// RUT por defecto). La service key y el `MERCADOPUBLICO_TICKET` se toman SOLO de env (nunca argv);
// sin ticket o sin key (y sin --dry-run) -> degrada a dry-run (InMemoryDineroWriter), NUNCA fabrica.
//
// Flags (validados ANTES de tocar red/DB):
//   --rut RUT     RUT de proveedor a consultar (repetible — corrida acotada)
//   --dia DDMMAAAA dia a barrer (repetible; default: el dia de hoy)
//   --dry-run     NO escribe en la DB (corre fetch/parse, descarta el upsert)
//
// CORRIDA LIVE ACOTADA: respeta el delay 2-3s del HostRateLimiter. Si ChileCompra no es alcanzable
// o falta el ticket -> degrada a dry-run, NUNCA fabrica contratos.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { ChileCompraConnector } from "./connector-chilecompra";
import { SupabaseDineroWriter } from "./writer-supabase";
import { InMemoryDineroWriter } from "./writer";
import type { DineroWriter } from "./writer";
import { ddmmaaaaDe, redactarTicket } from "./query";
import { runIngestDinero, type RunIngestDineroResult, type TareaRut } from "./ingest-run";
import type { ReconciliarContratoOpts } from "./reconciliar-contrato";

/** RUT por defecto (corrida acotada de demostracion — un RUT de empresa conocido). */
const DEFAULT_RUTS = ["76.123.456-0"];

export interface DineroCliOptions {
  ruts?: string[];
  dias?: string[];
  dryRun?: boolean;
  url?: string;
  serviceKey?: string;
  ticket?: string;
  /** Maestra inyectable (tests / corrida real cargada por el caller). Default: vacia. */
  maestra?: Parlamentario[];
  reconciliar?: ReconciliarContratoOpts;
  log?: (msg: string) => void;
  /** Conector inyectable (tests, sin red). Si se omite, `main` construye el REAL de @obs/ingest. */
  conector?: ChileCompraConnector;
}

export interface DineroCliResult extends RunIngestDineroResult {
  dbLoaded: boolean;
  dryRun: boolean;
  tareas: string[];
}

/** Error de validacion de flags (se reporta ANTES de cualquier red/DB). */
export class DineroCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "DineroCliArgsError";
  }
}

/** Parsea argv -> DineroCliOptions, validando los valores ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): DineroCliOptions {
  const opts: DineroCliOptions = {};
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
        if (!v || v.startsWith("--")) throw new DineroCliArgsError("--rut requiere un RUT");
        ruts.push(v.trim());
        break;
      }
      case "--dia": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new DineroCliArgsError("--dia requiere un DDMMAAAA");
        if (!/^\d{8}$/.test(v.trim())) throw new DineroCliArgsError("--dia debe ser ddmmaaaa (8 digitos)");
        dias.push(v.trim());
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new DineroCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  if (ruts.length > 0) opts.ruts = ruts;
  if (dias.length > 0) opts.dias = dias;
  return opts;
}

/**
 * Corre la ingesta de dinero end-to-end ACOTADA. Devuelve los conteos + si cargo a DB. Lanza
 * `DineroCliArgsError` si los flags son invalidos (antes de cualquier red/DB).
 */
export async function main(opts: DineroCliOptions = {}): Promise<DineroCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url = opts.url ?? process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey =
    opts.serviceKey ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_LOCAL_SERVICE_KEY ??
    "";
  // El ticket es secreto de operador: SOLO de env (nunca argv).
  const ticket = opts.ticket ?? process.env.MERCADOPUBLICO_TICKET ?? "";

  const ruts = opts.ruts ?? DEFAULT_RUTS;
  const dias = opts.dias ?? [ddmmaaaaDe(new Date())];
  const tareas: TareaRut[] = ruts.map((rut) => ({ rut, dias }));

  // Sin ticket o sin key/url -> degrada a dry-run (InMemory), NUNCA fabrica.
  const sinTicket = ticket.length === 0;
  const sinDb = serviceKey.length === 0 || url.length === 0;
  const dryRun = opts.dryRun === true || sinTicket || sinDb;
  if (opts.dryRun !== true && sinTicket) {
    log("ingest-dinero: sin MERCADOPUBLICO_TICKET -> corrida DRY-RUN (InMemory, no consulta LIVE)");
  }
  if (opts.dryRun !== true && !sinTicket && sinDb) {
    log("ingest-dinero: sin SUPABASE_DB_URL/SERVICE_KEY -> corrida DRY-RUN (no carga DB)");
  }

  // Conector REAL de @obs/ingest (rate-limit 2-3s + robots + UA + SSRF), salvo inyeccion (tests).
  const conector =
    opts.conector ??
    new ChileCompraConnector({
      fetcher: new Fetcher(),
      rateLimiter: new HostRateLimiter(),
      robots: new RobotsGuard({ allowlist: {} }),
    });

  let writer: DineroWriter;
  let dbLoaded = false;
  if (dryRun) {
    writer = new InMemoryDineroWriter();
  } else {
    writer = new SupabaseDineroWriter({ url, serviceKey });
    dbLoaded = true;
    log(`ingest-dinero: writer Supabase (${url}) — upsert VERSIONADO idempotente`);
  }

  const res = await runIngestDinero({
    conector,
    writer,
    // En dry-run sin ticket el conector no se invoca (InMemory + no LIVE): el ticket vacio no viaja.
    ticket,
    maestra: opts.maestra ?? [],
    tareas,
    ...(opts.reconciliar !== undefined ? { reconciliar: opts.reconciliar } : {}),
    log,
  });

  log(
    `ingest-dinero: OK -> ${res.contratos} contratos / ${res.contratistas} contratistas / ` +
      `${res.parlamentariosMarcados} parlamentarios marcados (cuarentena: ${res.cuarentenados.length}, ` +
      `errores: ${res.errores.length}, degradaciones: ${res.degradaciones.length})`,
  );
  // CR-01 defensa-en-profundidad en el sitio de impresion: el ticket NUNCA debe llegar a consola.
  for (const e of res.errores) log(redactarTicket(`ingest-dinero: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`));
  for (const d of res.degradaciones) log(redactarTicket(`ingest-dinero: DEGRADA [${d.fuente}]: ${d.motivo}`));

  return {
    ...res,
    dbLoaded,
    dryRun,
    tareas: tareas.map((t) => `rut:${t.rut}`),
  };
}

// Entry-point CLI: `tsx ingest-cli.ts --rut "76.123.456-0" [--dia 02022024] [--dry-run]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /ingest-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: DineroCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("ingest-dinero FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\ningest-dinero ${r.dryRun ? "DRY-RUN" : "LIVE"}: contratos=${r.contratos} ` +
          `contratistas=${r.contratistas} dbLoaded=${r.dbLoaded} cuarentena=${r.cuarentenados.length} ` +
          `errores=${r.errores.length} degradaciones=${r.degradaciones.length}`,
      );
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("ingest-dinero FALLO:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
