// ingest-cli — entry-point de la corrida LIVE acotada (espeja seed-cli.ts de Fase 3).
//
// Instancia los colaboradores REALES de @obs/ingest (Fetcher + HostRateLimiter + RobotsGuard),
// arma CamaraConnector/SenadoConnector + SupabaseTramitacionWriter contra el Supabase LOCAL, y
// corre `runIngest` sobre un conjunto ACOTADO de boletines de la legislatura vigente (Leg 58).
//
// Flags (validados ANTES de tocar la red/DB):
//   --anno N           año/legislatura a descubrir (default 2026)
//   --limite N         recorte del conjunto descubierto (default 5; alcance acotado)
//   --boletines a,b,c  lista explícita de boletines (salta el descubrimiento)
//   --dry-run          NO escribe en la DB (corre fetch/parse/reconcile, descarta el upsert)
//   --service-key K    SERVICE key local (o SUPABASE_LOCAL_SERVICE_KEY del entorno)
//
// Sin service key (y sin --dry-run) → la corrida degrada a dry-run con aviso (no carga DB).
// El provider LLM (MiniMax) es OPCIONAL y gated: sin él, las menciones dudosas del Senado
// degradan a `no_confirmado` (los votos deterministas resuelven igual). R2/remoto diferidos.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
} from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { CamaraConnector } from "./connector-camara";
import { SenadoConnector } from "./connector-senado";
import { SupabaseTramitacionWriter } from "./writer-supabase";
import { InMemoryTramitacionWriter, type TramitacionWriter } from "./writer";
import { runIngest, type RunIngestResult } from "./ingest-run";

const DEFAULT_LOCAL_URL = "http://127.0.0.1:54421";
const DEFAULT_LIMITE = 5;

export interface IngestCliOptions {
  anno?: number;
  limite?: number;
  boletines?: string[];
  dryRun?: boolean;
  localUrl?: string;
  serviceKey?: string;
  /** Raíz para resolver el seed (default: cwd). */
  cwd?: string;
  log?: (msg: string) => void;
}

export interface IngestCliResult extends RunIngestResult {
  dbLoaded: boolean;
  dryRun: boolean;
  boletinesPedidos: string[];
}

/** Error de validación de flags (se reporta ANTES de cualquier red/DB). */
export class IngestCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "IngestCliArgsError";
  }
}

/** Parsea argv → IngestCliOptions, validando los valores numéricos. */
export function parseArgs(argv: string[]): IngestCliOptions {
  const opts: IngestCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--anno": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 2000 || n > 2100) {
          throw new IngestCliArgsError(`--anno inválido: ${raw} (esperado 2000-2100)`);
        }
        opts.anno = n;
        break;
      }
      case "--limite": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) {
          throw new IngestCliArgsError(`--limite inválido: ${raw} (esperado entero > 0)`);
        }
        opts.limite = n;
        break;
      }
      case "--boletines": {
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0) {
          throw new IngestCliArgsError("--boletines vacío (esperado a,b,c)");
        }
        const lista = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (lista.length === 0) {
          throw new IngestCliArgsError("--boletines no contiene ningún boletín válido");
        }
        opts.boletines = lista;
        break;
      }
      case "--service-key":
        opts.serviceKey = argv[++i];
        break;
      default:
        if (a != null && a.startsWith("--")) {
          throw new IngestCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Resuelve la RAÍZ del workspace subiendo desde `start` hasta hallar `pnpm-workspace.yaml`
 * (pnpm corre el script con cwd = paquete). Lanza si no la encuentra.
 */
export function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `findWorkspaceRoot: no se encontró pnpm-workspace.yaml subiendo desde ${start}`,
      );
    }
    dir = parent;
  }
}

/** Carga la maestra real desde el snapshot autoritativo `supabase/seeds/parlamentario.seed.json`. */
export function cargarMaestra(root: string, log: (m: string) => void): Parlamentario[] {
  const path = resolve(root, "supabase/seeds/parlamentario.seed.json");
  if (!existsSync(path)) {
    log(`ingest: WARN seed de maestra no hallado en ${path} → maestra vacía (sin vínculos)`);
    return [];
  }
  try {
    const rows = JSON.parse(readFileSync(path, "utf8")) as Parlamentario[];
    log(`ingest: maestra cargada del seed → ${rows.length} parlamentarios`);
    return rows;
  } catch (err) {
    log(
      `ingest: WARN seed de maestra ilegible (${err instanceof Error ? err.message : String(err)}) → maestra vacía`,
    );
    return [];
  }
}

/**
 * Corre la ingesta LIVE acotada end-to-end. Devuelve los conteos + si cargó a DB.
 * Lanza `IngestCliArgsError` si los flags son inválidos (antes de cualquier red/DB).
 */
export async function main(opts: IngestCliOptions = {}): Promise<IngestCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const localUrl = opts.localUrl ?? process.env.SUPABASE_LOCAL_URL ?? DEFAULT_LOCAL_URL;
  const serviceKey = opts.serviceKey ?? process.env.SUPABASE_LOCAL_SERVICE_KEY ?? "";
  const anno = opts.anno ?? 2026;
  const limite = opts.limite ?? DEFAULT_LIMITE;
  const root = opts.cwd ?? findWorkspaceRoot(process.cwd());

  // dry-run si lo pidió el operador O si no hay service key (no se toca la DB).
  const dryRun = opts.dryRun === true || serviceKey.length === 0;
  if (opts.dryRun !== true && serviceKey.length === 0) {
    log("ingest: sin SUPABASE_LOCAL_SERVICE_KEY → corrida DRY-RUN (no carga DB)");
  }

  // Colaboradores REALES de @obs/ingest (política: rate-limit 2-3s + robots + UA + SSRF).
  const deps = {
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  };
  const camara = new CamaraConnector(deps);
  const senado = new SenadoConnector(deps);

  const maestra = cargarMaestra(root, log);

  // Writer: Supabase real (carga DB) o in-memory (dry-run, descarta).
  let writer: TramitacionWriter;
  let dbLoaded = false;
  if (dryRun) {
    writer = new InMemoryTramitacionWriter();
  } else {
    writer = new SupabaseTramitacionWriter({ url: localUrl, serviceKey });
    dbLoaded = true;
    // Etiqueta por URL: el runner de prod pasa el endpoint REMOTO por este mismo `localUrl`.
    const destino = localUrl === DEFAULT_LOCAL_URL ? "LOCAL" : "REMOTO";
    log(`ingest: writer Supabase ${destino} (${localUrl}) — upsert idempotente`);
  }

  const res = await runIngest({
    ...(opts.boletines !== undefined ? { boletines: opts.boletines } : {}),
    anno,
    limite,
    maestra,
    camara,
    senado,
    writer,
    log,
  });

  log(
    `ingest: OK → ${res.proyectos} proyectos / ${res.votaciones} votaciones / ` +
      `${res.votos} votos / ${res.eventos} eventos (errores: ${res.errores.length})`,
  );
  for (const e of res.errores) {
    log(`ingest: ERROR ${e.boletin} [${e.etapa}]: ${e.mensaje}`);
  }

  return {
    ...res,
    dbLoaded,
    dryRun,
    boletinesPedidos: opts.boletines ?? [],
  };
}

// Entry-point CLI: `tsx ingest-cli.ts --anno 2026 --limite 5 [--boletines a,b] [--dry-run]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /ingest-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: IngestCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("ingest FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\ningest ${r.dryRun ? "DRY-RUN" : "LIVE"}: proyectos=${r.proyectos} votaciones=${r.votaciones} ` +
          `votos=${r.votos} eventos=${r.eventos} dbLoaded=${r.dbLoaded} errores=${r.errores.length}`,
      );
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("ingest FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
