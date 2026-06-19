// pipeline-cli — entry-point del backfill de fichas (espeja ingest-cli.ts de Fase 5).
//
// Ensambla los colaboradores REALES (@obs/ingest Fetcher/HostRateLimiter/RobotsGuard +
// DeepSeekProvider + GeminiEmbeddingProvider + SupabaseFichasWriter) y corre `correrPipeline`
// sobre los proyecto_ficha PENDIENTES (o todos con --reembed). El texto íntegro se descarga
// con el orden LOCKED + R2 gateado por presencia de credencial.
//
// Flags (validados ANTES de tocar la red/DB):
//   --limite N         recorte del conjunto (default acotado)
//   --boletines a,b,c  lista explícita (salta el descubrimiento de pendientes)
//   --reembed          re-procesa TODO con bump de versión (no solo pendientes)
//   --dry-run          NO escribe en la DB (corre fetch/extract/embed, descarta el upsert)
//   --service-key K    SERVICE/SECRET key (o SUPABASE_SECRET_KEY del entorno)
//
// Sin service key (y sin --dry-run) → degrada a dry-run con aviso (mismo gating que R2).
// Env-driven, sin puertos hardcodeados: SUPABASE_URL (o SUPABASE_API_URL), SUPABASE_SECRET_KEY,
// DEEPSEEK_API_KEY, GEMINI_API_KEY, R2_* (R2 gateado por presencia). Remoto = operador.

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  R2Store,
} from "@obs/ingest";
import { DeepSeekProvider, GeminiEmbeddingProvider } from "@obs/llm";
import {
  SupabaseFichasWriter,
  type FichasWriter,
} from "./writer-supabase";
import {
  correrPipeline,
  type PipelinePendiente,
  type CorrerPipelineResult,
  type TextoFuenteOutput,
} from "./pipeline";
import { obtenerTextoFuente } from "./texto-fuente";

const DEFAULT_LIMITE = 50;

export interface FichasCliOptions {
  limite?: number;
  boletines?: string[];
  reembed?: boolean;
  dryRun?: boolean;
  serviceKey?: string;
  /** Override de URL (default: SUPABASE_URL / SUPABASE_API_URL del entorno). */
  url?: string;
  /** Pendientes inyectados (tests / boletines explícitos). */
  pendientes?: PipelinePendiente[];
  log?: (msg: string) => void;
}

export interface FichasCliResult extends CorrerPipelineResult {
  dbLoaded: boolean;
  dryRun: boolean;
}

/** Error de validación de flags (se reporta ANTES de cualquier red/DB). */
export class FichasCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "FichasCliArgsError";
  }
}

/** Parsea argv → FichasCliOptions, validando los valores ANTES de tocar red/DB. */
export function parseArgs(argv: string[]): FichasCliOptions {
  const opts: FichasCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--reembed":
        opts.reembed = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--limite": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) {
          throw new FichasCliArgsError(`--limite inválido: ${raw} (esperado entero > 0)`);
        }
        opts.limite = n;
        break;
      }
      case "--boletines": {
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0) {
          throw new FichasCliArgsError("--boletines vacío (esperado a,b,c)");
        }
        const lista = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (lista.length === 0) {
          throw new FichasCliArgsError("--boletines no contiene ningún boletín válido");
        }
        opts.boletines = lista;
        break;
      }
      case "--service-key": {
        // Fail-fast como --limite/--boletines: sin valor, `argv[++i]` es undefined
        // y `decidirDryRun` degradaría SILENCIOSAMENTE a dry-run — el operador cree
        // estar escribiendo a la DB y no persiste nada. Mejor error explícito (WR-05).
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0) {
          throw new FichasCliArgsError("--service-key vacío (esperado una key)");
        }
        opts.serviceKey = raw;
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new FichasCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Decide si la corrida es dry-run: lo es si el operador lo pidió O si no hay service key
 * (sin key NO se toca la DB — mismo gating que R2). Pura (testeable sin red).
 */
export function decidirDryRun(opts: { serviceKey?: string; dryRun?: boolean }): boolean {
  return opts.dryRun === true || (opts.serviceKey ?? "").length === 0;
}

/** Lee los proyecto_ficha pendientes desde Supabase (path real; dry-run usa inyección/vacío). */
async function cargarPendientes(
  writer: SupabaseFichasWriter | null,
  opts: FichasCliOptions,
  log: (m: string) => void,
): Promise<PipelinePendiente[]> {
  if (opts.pendientes !== undefined) return opts.pendientes;
  if (writer === null) {
    log("fichas: dry-run sin pendientes inyectados → conjunto vacío (no hay qué procesar)");
    return [];
  }
  // El read real vive aquí en LIVE (gated por env); no se ejerce en tests.
  return writer.leerPendientes(opts.boletines);
}

/**
 * Corre el backfill end-to-end. Devuelve conteos + si cargó a DB.
 * Lanza `FichasCliArgsError` si los flags son inválidos (antes de cualquier red/DB).
 */
export async function main(opts: FichasCliOptions = {}): Promise<FichasCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url =
    opts.url ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL ?? "";
  const serviceKey = opts.serviceKey ?? process.env.SUPABASE_SECRET_KEY ?? "";
  const limite = opts.limite ?? DEFAULT_LIMITE;

  const dryRun = decidirDryRun({ serviceKey, dryRun: opts.dryRun });
  if (opts.dryRun !== true && serviceKey.length === 0) {
    log("fichas: sin SUPABASE_SECRET_KEY → corrida DRY-RUN (no carga DB)");
  }

  // Colaboradores REALES de @obs/ingest (política: rate-limit 2-3s + robots + UA + SSRF).
  const fetcher = new Fetcher();
  const rateLimiter = new HostRateLimiter();
  const robots = new RobotsGuard({ allowlist: {} });

  // R2 GATEADO por presencia de credencial (degrada honesto si ausente — CONTEXT 401).
  const r2Creds =
    process.env.R2_ENDPOINT_URL &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET;
  const r2 = r2Creds
    ? new R2Store({
        endpoint: process.env.R2_ENDPOINT_URL!,
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        bucket: process.env.R2_BUCKET!,
      })
    : undefined;
  const r2Enabled = Boolean(r2Creds);

  // Providers LLM/embedding (keys de env; nunca hardcodear ni loguear).
  const provider = new DeepSeekProvider({ apiKey: process.env.DEEPSEEK_API_KEY ?? "" });
  const gemini = new GeminiEmbeddingProvider({ apiKey: process.env.GEMINI_API_KEY ?? "" });

  // Writer: Supabase real (carga DB) o null (dry-run, descarta).
  let supaWriter: SupabaseFichasWriter | null = null;
  let writer: FichasWriter;
  let dbLoaded = false;
  if (dryRun) {
    const noop: FichasWriter = {
      async upsertFicha() {},
      async upsertEmbedding() {},
    };
    writer = noop;
  } else {
    supaWriter = new SupabaseFichasWriter({ url, serviceKey });
    writer = supaWriter;
    dbLoaded = true;
    log(`fichas: writer Supabase (${url}) — upsert idempotente`);
  }

  const pendientes = await cargarPendientes(supaWriter, opts, log);

  const res = await correrPipeline({
    pendientes,
    limite,
    ...(opts.reembed ? { reembed: true } : {}),
    obtenerTexto: (link: string | null): Promise<TextoFuenteOutput> =>
      obtenerTextoFuente(link, {
        fetcher,
        rateLimiter,
        robots,
        ...(r2 ? { r2 } : {}),
        r2Enabled,
        log,
      }),
    provider,
    gemini,
    writer,
    log,
  });

  log(
    `fichas: OK → ${res.counts.procesados} procesados / ${res.counts.embebidos} embebidos / ` +
      `${res.counts.degradados} degradados (errores: ${res.errores.length})`,
  );
  for (const e of res.errores) {
    log(`fichas: ERROR ${e.boletin} [${e.etapa}]: ${e.mensaje}`);
  }

  return { ...res, dbLoaded, dryRun };
}

// Entry-point CLI: `tsx pipeline-cli.ts --limite 50 [--boletines a,b] [--reembed] [--dry-run]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /pipeline-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: FichasCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("fichas FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\nfichas ${r.dryRun ? "DRY-RUN" : "LIVE"}: procesados=${r.counts.procesados} ` +
          `embebidos=${r.counts.embebidos} degradados=${r.counts.degradados} ` +
          `dbLoaded=${r.dbLoaded} errores=${r.errores.length}`,
      );
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("fichas FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
