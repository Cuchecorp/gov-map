// ingest-cli-servel — entry-point de la corrida de SERVEL (espeja ingest-cli.ts de dinero + el wiring
// de provider/writer del pipeline de ingest-cli.ts de lobby).
//
// Instancia los colaboradores REALES de @obs/ingest (Fetcher + HostRateLimiter + RobotsGuard), arma
// ServelConnector + SupabaseServelWriter, y corre `runIngestServel` ACOTADO (una eleccion). La service
// key + la url de Supabase se toman SOLO de env (nunca argv). Sin key/url (y sin --dry-run) -> degrada a
// dry-run (InMemoryServelWriter), NUNCA fabrica.
//
// Flags (validados ANTES de tocar red/DB):
//   --eleccion <slug>   slug de la eleccion (entra en la clave del crudo + el marcador)
//   --url <blob-url>    URL del .xlsx de la eleccion (A2: la pasa el operador; no hardcodear el patron)
//   --anio <YYYY>       anio de la eleccion (entra en la `eleccion` compuesta verbatim)
//   --dry-run           NO escribe en la DB (corre fetch/parse, descarta el upsert)
//
// CRUCE POR NOMBRE: en LIVE se inyecta el provider LLM real + RevisionWriter (@obs/adjudication) — el
// MISMO patron que lobby usa para su sujeto pasivo; las credenciales del provider ya existen (Phase 4/11).
// En dry-run o sin provider, el cruce degrada a no_confirmado (PROVIDER_AUSENTE), nunca fabrica.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { RevisionWriter } from "@obs/adjudication";
import { ServelConnector } from "./connector-servel";
import { SupabaseServelWriter } from "./writer-supabase-servel";
import { InMemoryServelWriter, type ServelWriter } from "./writer-servel";
import {
  runIngestServel,
  type RunIngestServelResult,
  type TareaEleccion,
} from "./ingest-run-servel";
import type { ReconciliarAporteOpts } from "./reconciliar-aporte";

export interface ServelCliOptions {
  eleccion?: string;
  url?: string;
  anio?: string;
  dryRun?: boolean;
  supabaseUrl?: string;
  serviceKey?: string;
  /** Maestra inyectable (tests / corrida real cargada por el caller). Default: vacia. */
  maestra?: Parlamentario[];
  /** Opciones del cruce por NOMBRE (provider/writer/periodo). En LIVE el operador wirea el real. */
  reconciliar?: ReconciliarAporteOpts;
  log?: (msg: string) => void;
  /** Conector inyectable (tests, sin red). Si se omite, `main` construye el REAL de @obs/ingest. */
  conector?: ServelConnector;
  /** Writer inyectable (tests). Si se omite, `main` elige InMemory (dry-run) o Supabase (LIVE). */
  writer?: ServelWriter;
}

export interface ServelCliResult extends RunIngestServelResult {
  dbLoaded: boolean;
  dryRun: boolean;
  tareas: string[];
}

/** Error de validacion de flags (se reporta ANTES de cualquier red/DB). */
export class ServelCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ServelCliArgsError";
  }
}

/** Parsea argv -> ServelCliOptions, validando los valores ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): ServelCliOptions {
  const opts: ServelCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--eleccion": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new ServelCliArgsError("--eleccion requiere un slug");
        opts.eleccion = v.trim();
        break;
      }
      case "--url": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new ServelCliArgsError("--url requiere una URL");
        opts.url = v.trim();
        break;
      }
      case "--anio": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new ServelCliArgsError("--anio requiere un YYYY");
        if (!/^\d{4}$/.test(v.trim())) throw new ServelCliArgsError("--anio debe ser YYYY (4 digitos)");
        opts.anio = v.trim();
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new ServelCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Corre la ingesta de SERVEL end-to-end ACOTADA. Devuelve los conteos + si cargo a DB. Lanza
 * `ServelCliArgsError` si los flags son invalidos (antes de cualquier red/DB).
 */
export async function main(opts: ServelCliOptions = {}): Promise<ServelCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url = opts.supabaseUrl ?? process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey =
    opts.serviceKey ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_LOCAL_SERVICE_KEY ??
    "";

  const eleccion = opts.eleccion ?? "";
  if (eleccion === "" || opts.url == null || opts.url === "") {
    // Sin eleccion+url no hay corrida (la URL la pasa el operador, A2). Validacion antes de red/DB.
    if (opts.conector === undefined) {
      throw new ServelCliArgsError("--eleccion y --url son obligatorios (la URL del .xlsx la pasa el operador)");
    }
  }

  const tareas: TareaEleccion[] = [
    { eleccion, url: opts.url ?? "", anio: opts.anio ?? null },
  ];

  // Sin key/url -> degrada a dry-run (InMemory), NUNCA fabrica.
  const sinDb = serviceKey.length === 0 || url.length === 0;
  const dryRun = opts.dryRun === true || sinDb;
  if (opts.dryRun !== true && sinDb) {
    log("ingest-servel: sin SUPABASE_DB_URL/SERVICE_KEY -> corrida DRY-RUN (no carga DB)");
  }

  // Conector REAL de @obs/ingest (rate-limit 2-3s + robots + UA + SSRF), salvo inyeccion (tests).
  const conector =
    opts.conector ??
    new ServelConnector({
      fetcher: new Fetcher(),
      rateLimiter: new HostRateLimiter(),
      robots: new RobotsGuard({ allowlist: {} }),
    });

  let writer: ServelWriter;
  let dbLoaded = false;
  let subirCrudo: ((e: string, f: string, b: Uint8Array) => Promise<string>) | undefined;
  if (opts.writer) {
    writer = opts.writer;
  } else if (dryRun) {
    writer = new InMemoryServelWriter();
  } else {
    const supa = new SupabaseServelWriter({ url, serviceKey });
    writer = supa;
    subirCrudo = (e, f, b) => supa.subirCrudo(e, f, b);
    dbLoaded = true;
    log(`ingest-servel: writer Supabase (${url}) — upsert VERSIONADO idempotente + crudo a Storage`);
  }

  // Wiring del cruce por NOMBRE: en LIVE, si el caller no inyecto un writer del pipeline, construir un
  // RevisionWriter real para que deterministas/ambiguos queden auditados en `identidad_audit`. El
  // provider LLM lo inyecta el operador/caller via opts.reconciliar; sin el, el cruce degrada a
  // no_confirmado (PROVIDER_AUSENTE). En dry-run no se construye nada (NUNCA fabrica).
  let reconciliar = opts.reconciliar;
  if (!dryRun && (reconciliar?.writer === undefined)) {
    reconciliar = { ...(reconciliar ?? {}), writer: new RevisionWriter({ url, serviceKey }) };
  }

  const res = await runIngestServel({
    conector,
    writer,
    maestra: opts.maestra ?? [],
    tareas,
    ...(reconciliar !== undefined ? { reconciliar } : {}),
    ...(subirCrudo !== undefined ? { subirCrudo } : {}),
    log,
  });

  log(
    `ingest-servel: OK -> ${res.aportes} aportes / ${res.donantes} donantes / ` +
      `${res.parlamentariosMarcados} parlamentarios marcados (cuarentena: ${res.cuarentenados.length}, ` +
      `errores: ${res.errores.length}, degradaciones: ${res.degradaciones.length})`,
  );
  for (const e of res.errores) log(`ingest-servel: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`);
  for (const d of res.degradaciones) log(`ingest-servel: DEGRADA [${d.fuente}]: ${d.motivo}`);

  return {
    ...res,
    dbLoaded,
    dryRun,
    tareas: tareas.map((t) => `eleccion:${t.eleccion}`),
  };
}

// Entry-point CLI: `tsx ingest-cli-servel.ts --eleccion <slug> --url <blob-url> [--anio YYYY] [--dry-run]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /ingest-cli-servel\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: ServelCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("ingest-servel FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\ningest-servel ${r.dryRun ? "DRY-RUN" : "LIVE"}: aportes=${r.aportes} donantes=${r.donantes} ` +
          `dbLoaded=${r.dbLoaded} cuarentena=${r.cuarentenados.length} errores=${r.errores.length} ` +
          `degradaciones=${r.degradaciones.length}`,
      );
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("ingest-servel FALLO:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
