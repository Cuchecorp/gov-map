// run-servel-local-cli — entry-point de OPERADOR LOCAL de la ingesta de SERVEL (DEBT-01/MONEY-02).
//
// Espejo de `run-dinero-masivo-cli.ts` (Phase 70, ChileCompra) adaptado a SERVEL en modo LOCAL:
//   - La Etapa 1 la hace el OPERADOR colocando el `.xlsx` en R2 (SERVEL no publica una API amable;
//     el crudo es un archivo que se descarga a mano). Este CLI NO fetchea el blob.
//   - Construye un `R2Store` real de `.env R2_*` y lee los BYTES del `.xlsx` de R2 (`--from-r2`/
//     `--r2-path`), threadeando una `TareaEleccion` con `eleccion`+`r2Path` (SIN `url`).
//   - El conector de fetch NUNCA se toca en modo LOCAL (se pasa uno que LANZA si se invoca:
//     defensa-en-profundidad — si algun refactor rutea al fetch, revienta en vez de molestar la fuente).
//
// A diferencia de ChileCompra, SERVEL es un GET anonimo SIN ticket secreto → no hay `redactarTicket`.
//
// El backfill LIVE real (colocar el .xlsx + re-correr) es toil operador-LOCAL (runbook, Plan 71-03);
// esta corrida NO consume la fuente. Sin DB (o con --dry-run) → InMemory, NUNCA fabrica.
//
// Uso: tsx packages/dinero/src/run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path>
//        [--anio YYYY] [--dry-run]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R2Store } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import type { ServelConnector } from "./connector-servel";
import { SupabaseServelWriter } from "./writer-supabase-servel";
import { InMemoryServelWriter, type ServelWriter } from "./writer-servel";
import {
  runIngestServel,
  type RunIngestServelResult,
  type TareaEleccion,
} from "./ingest-run-servel";
import type { ReconciliarAporteOpts } from "./reconciliar-aporte";

/** Error de flags — se reporta ANTES de cualquier red/DB. */
export class ServelLocalArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ServelLocalArgsError";
  }
}

/** Lee `.env` BOM-safe (espejo de run-dinero-masivo-cli). */
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

export interface ServelLocalOptions {
  eleccion?: string;
  /** r2Path del `.xlsx` que el operador colocó en R2 (modo LOCAL). Alias: --from-r2. */
  r2Path?: string;
  anio?: string;
  dryRun?: boolean;
}

/** Firma de `runIngestServel` (inyectable para tests). */
type RunIngestFn = typeof runIngestServel;

export interface ServelLocalDeps {
  /** Env inyectable (tests). Default: `loadEnv(root)`. */
  env?: Record<string, string>;
  /** Maestra inyectable. Default: vacía. */
  maestra?: Parlamentario[];
  reconciliar?: ReconciliarAporteOpts;
  /** Conector inyectable (tests). Default: uno que LANZA si se toca (modo LOCAL = 0 fetch). */
  conector?: ServelConnector;
  /** Writer inyectable (tests). Default: Supabase real o InMemory según dry-run. */
  writer?: ServelWriter;
  /** R2Store inyectable (tests). Default: construido de `.env R2_*` si están presentes. */
  r2Store?: R2Store;
  /** runIngestServel inyectable (tests). Default: el real. */
  runIngest?: RunIngestFn;
  log?: (msg: string) => void;
  /** Raíz del workspace para `loadEnv`. Default: cwd. */
  root?: string;
}

export interface ServelLocalResult extends RunIngestServelResult {
  dbLoaded: boolean;
  dryRun: boolean;
  /** true si se construyó/inyectó un R2Store (modo LOCAL activo). */
  r2Activo: boolean;
  r2Path: string;
}

/** Parsea argv → ServelLocalOptions, validando ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): ServelLocalOptions {
  const opts: ServelLocalOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--eleccion": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new ServelLocalArgsError("--eleccion requiere un slug");
        opts.eleccion = v.trim();
        break;
      }
      case "--r2-path":
      case "--from-r2": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new ServelLocalArgsError(`${a} requiere un r2Path`);
        opts.r2Path = v.trim();
        break;
      }
      case "--anio": {
        const v = argv[++i];
        if (!v || v.startsWith("--")) throw new ServelLocalArgsError("--anio requiere un YYYY");
        if (!/^\d{4}$/.test(v.trim())) throw new ServelLocalArgsError("--anio debe ser YYYY (4 digitos)");
        opts.anio = v.trim();
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new ServelLocalArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Conector que LANZA si se le toca — en modo LOCAL el fetch al blob JAMÁS ocurre (la Etapa 1 la hizo
 * el operador colocando el `.xlsx` en R2). Si un refactor rutea al fetch, revienta en vez de molestar
 * la fuente. Se usa como default cuando el caller no inyecta uno.
 */
function conectorLocalQueLanza(): ServelConnector {
  return {
    async descargar(): Promise<never> {
      throw new Error(
        "run-servel-local-cli: modo LOCAL NO debe fetchear el blob (la Etapa 1 la hizo el operador en R2)",
      );
    },
  } as unknown as ServelConnector;
}

/**
 * Corre la ingesta LOCAL de SERVEL de OPERADOR. Construye el `R2Store` de `.env R2_*`, threadea la
 * tarea LOCAL (`eleccion`+`r2Path`, sin `url`) y `--from-r2` a `runIngestServel`, loguea el destino
 * LOCAL (lee de R2), y NUNCA fetchea el blob. Devuelve los conteos + si cargó DB + si R2 estuvo activo.
 */
export async function main(
  opts: ServelLocalOptions = {},
  deps: ServelLocalDeps = {},
): Promise<ServelLocalResult> {
  const log = deps.log ?? ((m: string) => console.log(m));
  const root = deps.root ?? process.cwd();
  const env = deps.env ?? loadEnv(root);
  const runIngest = deps.runIngest ?? runIngestServel;

  // Validación de flags ANTES de red/DB.
  const eleccion = opts.eleccion?.trim() ?? "";
  if (eleccion === "") {
    throw new ServelLocalArgsError("--eleccion es obligatorio (entra en la clave del crudo LOCAL)");
  }
  const r2Path = opts.r2Path?.trim() ?? "";
  if (r2Path === "") {
    throw new ServelLocalArgsError(
      "--r2-path/--from-r2 es obligatorio en modo LOCAL (el .xlsx que el operador colocó en R2)",
    );
  }

  // R2Store real de `.env R2_*` (modo LOCAL: la única fuente de bytes). Sin R2 no hay de dónde leer.
  let r2Store = deps.r2Store;
  if (!r2Store && env.R2_ACCESS_KEY_ID && env.R2_ENDPOINT_URL) {
    r2Store = new R2Store({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
      endpoint: env.R2_ENDPOINT_URL,
      bucket: env.R2_BUCKET ?? "",
    });
    log("servel-local: R2Store construido de .env — modo LOCAL (lee el .xlsx que el operador colocó en R2)");
  }
  if (!r2Store) {
    throw new ServelLocalArgsError(
      "--r2-path/--from-r2 requiere R2 configurado en .env (R2_ACCESS_KEY_ID + R2_ENDPOINT_URL)",
    );
  }

  // Tarea LOCAL: eleccion + r2Path, SIN url (modo LOCAL no fetchea; la frontera acepta r2Path como
  // alternativa válida a url).
  const tareas: TareaEleccion[] = [
    { eleccion, url: "", anio: opts.anio ?? null, r2Path },
  ];

  // Writer: Supabase real (REMOTO) o InMemory (DRY-RUN/LOCAL). En modo LOCAL no se exige ticket.
  const sinDb = !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY;
  const dryRun = opts.dryRun === true || sinDb;

  let writer: ServelWriter;
  let dbLoaded = false;
  let subirCrudo: ((e: string, f: string, b: Uint8Array) => Promise<string>) | undefined;
  if (deps.writer) {
    writer = deps.writer;
    dbLoaded = !dryRun;
  } else if (dryRun) {
    writer = new InMemoryServelWriter();
    log("servel-local: DRY-RUN (in-memory, no escribe DB) — destino LOCAL (lee de R2)");
  } else {
    const supa = new SupabaseServelWriter({
      url: env.SUPABASE_API_URL!,
      serviceKey: env.SUPABASE_SECRET_KEY!,
    });
    writer = supa;
    subirCrudo = (e, f, b) => supa.subirCrudo(e, f, b);
    dbLoaded = true;
    log(`servel-local: writer Supabase REMOTO (${env.SUPABASE_API_URL}) — destino LOCAL (lee de R2), upsert VERSIONADO idempotente`);
  }

  // Conector: en modo LOCAL el fetch JAMÁS se toca. Default = uno que LANZA (defensa en profundidad).
  const conector = deps.conector ?? conectorLocalQueLanza();

  // Pitfall 5: loguear el destino ANTES de escribir. En modo LOCAL SIEMPRE se lee de R2 (no de la
  // fuente) — esta línea es honesta sin importar si el R2Store se inyectó o se construyó de .env.
  log(`servel-local: destino LOCAL — lee el .xlsx de R2 (${r2Path}), 0 fetch a la fuente`);

  const res = await runIngest({
    conector,
    writer,
    maestra: deps.maestra ?? [],
    tareas,
    ...(deps.reconciliar !== undefined ? { reconciliar: deps.reconciliar } : {}),
    ...(subirCrudo !== undefined ? { subirCrudo } : {}),
    r2Store,
    fromR2: r2Path,
    log,
  });

  log(
    `servel-local ${dryRun ? "DRY-RUN" : "LIVE"} (--from-r2 ${r2Path}): ` +
      `aportes=${res.aportes} donantes=${res.donantes} parlamentariosMarcados=${res.parlamentariosMarcados} ` +
      `dbLoaded=${dbLoaded} cuarentena=${res.cuarentenados.length} errores=${res.errores.length} ` +
      `degradaciones=${res.degradaciones.length}`,
  );
  for (const e of res.errores) log(`servel-local: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`);
  for (const d of res.degradaciones) log(`servel-local: DEGRADA [${d.fuente}]: ${d.motivo}`);

  return { ...res, dbLoaded, dryRun, r2Activo: true, r2Path };
}

// Entry-point CLI.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /run-servel-local-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  // NOTA (modo LOCAL): NO se importa/instancia el ServelConnector real (Fetcher/RobotsGuard/etc.):
  // en LOCAL el fetch al blob JAMÁS ocurre → el default `conectorLocalQueLanza()` basta. Esta
  // ausencia deliberada es la garantía estructural de 0-fetch a la fuente.
  let parsed: ServelLocalOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("servel-local FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("servel-local FALLO:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
