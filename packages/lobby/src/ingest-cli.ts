// ingest-cli — entry-point de la corrida de lobby (espeja el ingest-cli de @obs/agenda).
//
// Instancia los colaboradores REALES de @obs/ingest (Fetcher + HostRateLimiter + RobotsGuard),
// arma LeylobbyConnector + SupabaseLobbyWriter, y corre `runIngestLobby` ACOTADO (una institución
// de congreso, año actual, page 1 por defecto). La service key se toma SOLO de env (nunca argv);
// sin key (y sin --dry-run) → degrada a dry-run (InMemoryLobbyWriter).
//
// Flags (validados ANTES de tocar red/DB):
//   --institucion CODE   código de institución leylobby (default: AA001 — ver nota de congreso)
//   --anio YYYY          año del listado de audiencias (default: año actual)
//   --paginas N          número de páginas desde 1 (default 1 — corrida acotada)
//   --dry-run            NO escribe en la DB (corre fetch/parse, descarta el upsert)
//
// La maestra de parlamentarios se inyecta (tests) o se deja vacía en dry-run (el cruce degrada a
// no_confirmado sin fabricar). NOTA CONGRESO (Open Question 2): la Cámara/Senado NO están en
// leylobby; la corrida LIVE de congreso usa el portal propio de la Cámara (verificación de operador).

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { LeylobbyConnector } from "./connector-leylobby";
import { SupabaseLobbyWriter } from "./writer-supabase";
import { InMemoryLobbyWriter } from "./writer";
import type { LobbyWriter } from "./writer";
import {
  runIngestLobby,
  type RunIngestLobbyResult,
  type TareaInstitucion,
} from "./ingest-run";
import type { ReconciliarSujetoOpts } from "./reconciliar-sujeto";
import type { DriftStore } from "@obs/ingest";

const DEFAULT_INSTITUCION = "AA001";

export interface LobbyCliOptions {
  institucion?: string;
  anio?: number;
  paginas?: number;
  dryRun?: boolean;
  url?: string;
  serviceKey?: string;
  /** Maestra inyectable (tests / corrida real cargada por el caller). Default: vacía. */
  maestra?: Parlamentario[];
  reconciliar?: ReconciliarSujetoOpts;
  driftStore?: DriftStore;
  log?: (msg: string) => void;
  /** Conector inyectable (tests, sin red). Si se omite, `main` construye el REAL de @obs/ingest. */
  conector?: LeylobbyConnector;
}

export interface LobbyCliResult extends RunIngestLobbyResult {
  dbLoaded: boolean;
  dryRun: boolean;
  tareas: string[];
}

/** Error de validación de flags (se reporta ANTES de cualquier red/DB). */
export class LobbyCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "LobbyCliArgsError";
  }
}

/** Parsea argv → LobbyCliOptions, validando los valores ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): LobbyCliOptions {
  const opts: LobbyCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--institucion":
        opts.institucion = argv[++i];
        if (!opts.institucion) throw new LobbyCliArgsError("--institucion requiere un código");
        break;
      case "--anio": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 2000 || n > 2100) {
          throw new LobbyCliArgsError(`--anio inválido: ${raw} (esperado 2000-2100)`);
        }
        opts.anio = n;
        break;
      }
      case "--paginas": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 50) {
          throw new LobbyCliArgsError(`--paginas inválido: ${raw} (esperado 1-50, corrida acotada)`);
        }
        opts.paginas = n;
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new LobbyCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Corre la ingesta de lobby end-to-end ACOTADA. Devuelve los conteos + si cargó a DB.
 * Lanza `LobbyCliArgsError` si los flags son inválidos (antes de cualquier red/DB).
 */
export async function main(opts: LobbyCliOptions = {}): Promise<LobbyCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url = opts.url ?? process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey =
    opts.serviceKey ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_LOCAL_SERVICE_KEY ??
    "";

  const institucion = opts.institucion ?? DEFAULT_INSTITUCION;
  const anio = opts.anio ?? new Date().getFullYear();
  const nPaginas = opts.paginas ?? 1; // corrida ACOTADA por defecto
  const pages = Array.from({ length: nPaginas }, (_v, i) => i + 1);
  const tareas: TareaInstitucion[] = [{ institucionCodigo: institucion, year: anio, pages }];

  const dryRun = opts.dryRun === true || serviceKey.length === 0 || url.length === 0;
  if (opts.dryRun !== true && (serviceKey.length === 0 || url.length === 0)) {
    log("ingest-lobby: sin SUPABASE_DB_URL/SERVICE_KEY → corrida DRY-RUN (no carga DB)");
  }

  // Conector REAL de @obs/ingest (rate-limit 2-3s + robots + UA + SSRF), salvo inyección (tests).
  const conector =
    opts.conector ??
    new LeylobbyConnector({
      fetcher: new Fetcher(),
      rateLimiter: new HostRateLimiter(),
      robots: new RobotsGuard({ allowlist: {} }),
    });

  let writer: LobbyWriter;
  let dbLoaded = false;
  if (dryRun) {
    writer = new InMemoryLobbyWriter();
  } else {
    writer = new SupabaseLobbyWriter({ url, serviceKey });
    dbLoaded = true;
    log(`ingest-lobby: writer Supabase (${url}) — upsert idempotente`);
  }

  const res = await runIngestLobby({
    conector,
    writer,
    maestra: opts.maestra ?? [],
    tareas,
    ...(opts.reconciliar !== undefined ? { reconciliar: opts.reconciliar } : {}),
    ...(opts.driftStore !== undefined ? { driftStore: opts.driftStore } : {}),
    log,
  });

  log(
    `ingest-lobby: OK → ${res.audiencias} audiencias / ${res.contrapartes} contrapartes / ` +
      `${res.parlamentariosMarcados} parlamentarios marcados (errores: ${res.errores.length}, ` +
      `degradaciones: ${res.degradaciones.length}, drift-quarantine: ${res.driftQuarantine})`,
  );
  for (const e of res.errores) log(`ingest-lobby: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`);
  for (const d of res.degradaciones) log(`ingest-lobby: DEGRADA [${d.fuente}]: ${d.motivo}`);

  return {
    ...res,
    dbLoaded,
    dryRun,
    tareas: tareas.flatMap((t) => (t.pages ?? [1]).map((p) => `${t.institucionCodigo}/${t.year}/p${p}`)),
  };
}

// Entry-point CLI: `tsx ingest-cli.ts --institucion AA001 --anio 2024 --paginas 1 [--dry-run]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /ingest-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: LobbyCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("ingest-lobby FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\ningest-lobby ${r.dryRun ? "DRY-RUN" : "LIVE"}: audiencias=${r.audiencias} ` +
          `contrapartes=${r.contrapartes} dbLoaded=${r.dbLoaded} errores=${r.errores.length} ` +
          `degradaciones=${r.degradaciones.length} driftQuarantine=${r.driftQuarantine}`,
      );
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("ingest-lobby FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
