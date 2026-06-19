// ingest-cli — entry-point de la corrida de probidad (espeja el ingest-cli de @obs/lobby).
//
// Instancia los colaboradores REALES de @obs/ingest (Fetcher + HostRateLimiter + RobotsGuard),
// arma InfoProbidadConnector + SupabaseProbidadWriter, y corre `runIngestProbidad` ACOTADO (un
// puñado de declarantes por nombre por defecto). La service key se toma SOLO de env (nunca argv);
// sin key (y sin --dry-run) → degrada a dry-run (InMemoryProbidadWriter), nunca fabrica.
//
// Flags (validados ANTES de tocar red/DB):
//   --nombre FRAGMENTO   fragmento de nombre/apellido a consultar (repetible — corrida acotada)
//   --dry-run            NO escribe en la DB (corre fetch/parse, descarta el upsert)
//
// CORRIDA LIVE ACOTADA: limita a los nombres pasados (o un default conocido). Respeta el delay
// 2-3s del HostRateLimiter. Si InfoProbidad no es alcanzable → degrada a dry-run / fixture y marca
// `human_verification`, NUNCA fabrica declaraciones.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { InfoProbidadConnector } from "./connector-infoprobidad";
import { SupabaseProbidadWriter } from "./writer-supabase";
import { InMemoryProbidadWriter } from "./writer";
import type { ProbidadWriter } from "./writer";
import {
  runIngestProbidad,
  type RunIngestProbidadResult,
  type TareaDeclarante,
} from "./ingest-run";
import type { ReconciliarDeclaranteOpts } from "./reconciliar-declarante";
import type { DriftStore } from "@obs/ingest";

/** Fragmento por defecto (corrida acotada de demostración — un apellido conocido del Senado). */
const DEFAULT_NOMBRES = ["bianchi chelech"];

export interface ProbidadCliOptions {
  nombres?: string[];
  dryRun?: boolean;
  url?: string;
  serviceKey?: string;
  /** Maestra inyectable (tests / corrida real cargada por el caller). Default: vacía. */
  maestra?: Parlamentario[];
  reconciliar?: ReconciliarDeclaranteOpts;
  driftStore?: DriftStore;
  log?: (msg: string) => void;
  /** Conector inyectable (tests, sin red). Si se omite, `main` construye el REAL de @obs/ingest. */
  conector?: InfoProbidadConnector;
}

export interface ProbidadCliResult extends RunIngestProbidadResult {
  dbLoaded: boolean;
  dryRun: boolean;
  tareas: string[];
}

/** Error de validación de flags (se reporta ANTES de cualquier red/DB). */
export class ProbidadCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ProbidadCliArgsError";
  }
}

/** Parsea argv → ProbidadCliOptions, validando los valores ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): ProbidadCliOptions {
  const opts: ProbidadCliOptions = {};
  const nombres: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--nombre": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new ProbidadCliArgsError("--nombre requiere un fragmento");
        nombres.push(v.trim().toLowerCase());
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new ProbidadCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  if (nombres.length > 0) opts.nombres = nombres;
  return opts;
}

/**
 * Corre la ingesta de probidad end-to-end ACOTADA. Devuelve los conteos + si cargó a DB.
 * Lanza `ProbidadCliArgsError` si los flags son inválidos (antes de cualquier red/DB).
 */
export async function main(opts: ProbidadCliOptions = {}): Promise<ProbidadCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url = opts.url ?? process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey =
    opts.serviceKey ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_LOCAL_SERVICE_KEY ??
    "";

  const nombres = opts.nombres ?? DEFAULT_NOMBRES;
  const tareas: TareaDeclarante[] = nombres.map((nombre) => ({ nombre }));

  const dryRun = opts.dryRun === true || serviceKey.length === 0 || url.length === 0;
  if (opts.dryRun !== true && (serviceKey.length === 0 || url.length === 0)) {
    log("ingest-probidad: sin SUPABASE_DB_URL/SERVICE_KEY → corrida DRY-RUN (no carga DB)");
  }

  // Conector REAL de @obs/ingest (rate-limit 2-3s + robots + UA + SSRF), salvo inyección (tests).
  const conector =
    opts.conector ??
    new InfoProbidadConnector({
      fetcher: new Fetcher(),
      rateLimiter: new HostRateLimiter(),
      robots: new RobotsGuard({ allowlist: {} }),
    });

  let writer: ProbidadWriter;
  let dbLoaded = false;
  if (dryRun) {
    writer = new InMemoryProbidadWriter();
  } else {
    writer = new SupabaseProbidadWriter({ url, serviceKey });
    dbLoaded = true;
    log(`ingest-probidad: writer Supabase (${url}) — upsert VERSIONADO idempotente`);
  }

  const res = await runIngestProbidad({
    conector,
    writer,
    maestra: opts.maestra ?? [],
    tareas,
    ...(opts.reconciliar !== undefined ? { reconciliar: opts.reconciliar } : {}),
    ...(opts.driftStore !== undefined ? { driftStore: opts.driftStore } : {}),
    log,
  });

  log(
    `ingest-probidad: OK → ${res.declaraciones} versiones / ${res.bienes} bienes / ${res.familiares} familiares / ` +
      `${res.parlamentariosMarcados} parlamentarios marcados (errores: ${res.errores.length}, ` +
      `degradaciones: ${res.degradaciones.length}, drift-quarantine: ${res.driftQuarantine})`,
  );
  for (const e of res.errores) log(`ingest-probidad: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`);
  for (const d of res.degradaciones) log(`ingest-probidad: DEGRADA [${d.fuente}]: ${d.motivo}`);

  return {
    ...res,
    dbLoaded,
    dryRun,
    tareas: tareas.map((t) => `nombre:${t.nombre}`),
  };
}

// Entry-point CLI: `tsx ingest-cli.ts --nombre "bianchi chelech" [--dry-run]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /ingest-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: ProbidadCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("ingest-probidad FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\ningest-probidad ${r.dryRun ? "DRY-RUN" : "LIVE"}: versiones=${r.declaraciones} ` +
          `bienes=${r.bienes} familiares=${r.familiares} dbLoaded=${r.dbLoaded} errores=${r.errores.length} ` +
          `degradaciones=${r.degradaciones.length} driftQuarantine=${r.driftQuarantine}`,
      );
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("ingest-probidad FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
