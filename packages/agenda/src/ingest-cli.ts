// ingest-cli — entry-point de la corrida de agenda (espeja el ingest-cli de Fase 5).
//
// Instancia los colaboradores REALES de @obs/ingest (Fetcher + HostRateLimiter + RobotsGuard),
// arma CitacionesCamaraConnector/SenadoActividadConnector + SupabaseAgendaWriter contra el
// Supabase LOCAL, enumera el RANGO de semanas ISO pedido (backfill de Cámara) y corre `runIngest`.
//
// Flags (validados ANTES de tocar red/DB):
//   --desde YYYY-Www   semana ISO inicial del backfill de Cámara (default: semana actual)
//   --hasta YYYY-Www   semana ISO final (default: = --desde → una sola semana)
//   --solo-senado      NO ingesta Cámara (solo la ventana forward-only del Senado)
//   --dry-run          NO escribe en la DB (corre fetch/parse, descarta el upsert)
//   --service-key K    SERVICE key local (o SUPABASE_LOCAL_SERVICE_KEY del entorno)
//
// Sin service key (y sin --dry-run) → la corrida degrada a dry-run con aviso (no carga DB).

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
} from "@obs/ingest";
import { CitacionesCamaraConnector } from "./connector-camara";
import { SenadoActividadConnector } from "./connector-senado";
import { createCurlTransport } from "./transport-curl";
import { SupabaseAgendaWriter } from "./writer-supabase";
import { InMemoryAgendaWriter } from "./writer";
import type { AgendaWriter } from "./writer";
import { runIngest, type RunIngestResult } from "./ingest-run";
import { isoWeekOf, enumerarSemanas, type SemanaIso } from "./semana-iso";

const DEFAULT_LOCAL_URL = "http://127.0.0.1:54421";
/** Backoff base entre reintentos ante 403 de Cámara en la corrida LIVE. */
const BACKOFF_MS = 2000;

export interface IngestCliOptions {
  desde?: SemanaIso;
  hasta?: SemanaIso;
  soloSenado?: boolean;
  dryRun?: boolean;
  localUrl?: string;
  serviceKey?: string;
  log?: (msg: string) => void;
  /**
   * Conectores inyectables (tests, sin red). Si se omiten, `main` construye los REALES de
   * @obs/ingest. No es un flag del CLI: solo un punto de costura para los tests hermenéuticos.
   */
  conectores?: {
    conectorCamara: CitacionesCamaraConnector;
    conectorSenado: SenadoActividadConnector;
  };
}

export interface IngestCliResult extends RunIngestResult {
  dbLoaded: boolean;
  dryRun: boolean;
  semanas: string[];
}

/** Error de validación de flags (se reporta ANTES de cualquier red/DB). */
export class IngestCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "IngestCliArgsError";
  }
}

/** Parsea `YYYY-Www` → SemanaIso, validando el rango ISO. Lanza IngestCliArgsError si inválido. */
export function parseSemanaIso(raw: string | undefined, flag: string): SemanaIso {
  if (raw == null) throw new IngestCliArgsError(`${flag} requiere un valor YYYY-Www`);
  const m = raw.trim().match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) {
    throw new IngestCliArgsError(`${flag} inválido: ${raw} (esperado YYYY-Www, p.ej. 2026-W25)`);
  }
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (year < 2000 || year > 2100) {
    throw new IngestCliArgsError(`${flag} año fuera de rango: ${year} (esperado 2000-2100)`);
  }
  if (week < 1 || week > 53) {
    throw new IngestCliArgsError(`${flag} semana fuera de rango: ${week} (esperado 1-53)`);
  }
  return { year, week };
}

/** Parsea argv → IngestCliOptions, validando los valores ANTES de cualquier red/DB. */
export function parseArgs(argv: string[]): IngestCliOptions {
  const opts: IngestCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--solo-senado":
        opts.soloSenado = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--desde":
        opts.desde = parseSemanaIso(argv[++i], "--desde");
        break;
      case "--hasta":
        opts.hasta = parseSemanaIso(argv[++i], "--hasta");
        break;
      case "--service-key":
        opts.serviceKey = argv[++i];
        break;
      default:
        if (a != null && a.startsWith("--")) {
          throw new IngestCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  // Validación cruzada: hasta no puede ser anterior a desde (lo afirma enumerarSemanas, pero
  // se reporta acá ANTES de tocar la red).
  if (opts.desde != null && opts.hasta != null) {
    try {
      enumerarSemanas(opts.desde, opts.hasta);
    } catch (err) {
      throw new IngestCliArgsError(err instanceof Error ? err.message : String(err));
    }
  }
  return opts;
}

/**
 * Corre la ingesta de agenda end-to-end. Devuelve los conteos + si cargó a DB.
 * Lanza `IngestCliArgsError` si los flags son inválidos (antes de cualquier red/DB).
 */
export async function main(opts: IngestCliOptions = {}): Promise<IngestCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const localUrl = opts.localUrl ?? process.env.SUPABASE_LOCAL_URL ?? DEFAULT_LOCAL_URL;
  const serviceKey = opts.serviceKey ?? process.env.SUPABASE_LOCAL_SERVICE_KEY ?? "";

  // Rango de semanas: --desde..--hasta; default = la semana ISO actual (una sola).
  const desde = opts.desde ?? isoWeekOf(new Date());
  const hasta = opts.hasta ?? desde;
  const semanas = enumerarSemanas(desde, hasta);

  const dryRun = opts.dryRun === true || serviceKey.length === 0;
  if (opts.dryRun !== true && serviceKey.length === 0) {
    log("ingest: sin SUPABASE_LOCAL_SERVICE_KEY → corrida DRY-RUN (no carga DB)");
  }

  // Colaboradores REALES de @obs/ingest (política: rate-limit 2-3s + robots + UA + SSRF),
  // salvo que se inyecten fakes (tests sin red).
  let conectorCamara: CitacionesCamaraConnector;
  let conectorSenado: SenadoActividadConnector;
  if (opts.conectores != null) {
    conectorCamara = opts.conectores.conectorCamara;
    conectorSenado = opts.conectores.conectorSenado;
  } else {
    const rateLimiter = new HostRateLimiter();
    const robots = new RobotsGuard({ allowlist: {} });
    // WR-03: el conector de Cámara usa un Fetcher con transporte `curl` para PASAR
    // el bot-management de Cloudflare (el fetch nativo recibe 403 por fingerprint
    // TLS/JA3). El resto de hosts (Senado) usa el Fetcher con fetch nativo.
    // El transporte `fetch`-compatible de curl se inyecta como `fetchFn`.
    const curlTransport = createCurlTransport();
    const camaraFetcher = new Fetcher({
      fetchFn: curlTransport as unknown as typeof fetch,
    });
    conectorCamara = new CitacionesCamaraConnector({
      fetcher: camaraFetcher,
      rateLimiter,
      robots,
    });
    conectorSenado = new SenadoActividadConnector({
      fetcher: new Fetcher(),
      rateLimiter,
      robots,
    });
  }

  let writer: AgendaWriter;
  let dbLoaded = false;
  if (dryRun) {
    writer = new InMemoryAgendaWriter();
  } else {
    writer = new SupabaseAgendaWriter({ url: localUrl, serviceKey });
    dbLoaded = true;
    log(`ingest: writer Supabase LOCAL (${localUrl}) — upsert idempotente`);
  }

  const res = await runIngest({
    conectorCamara,
    conectorSenado,
    writer,
    semanas,
    ...(opts.soloSenado !== undefined ? { soloSenado: opts.soloSenado } : {}),
    backoffMs: BACKOFF_MS,
    log,
  });

  log(
    `ingest: OK → Cámara ${res.camaraCitaciones} citaciones / Senado ${res.senadoCitaciones} citaciones / ` +
      `${res.senadoSesiones} sesiones (errores: ${res.errores.length}, degradaciones: ${res.degradaciones.length})`,
  );
  for (const e of res.errores) log(`ingest: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`);
  for (const d of res.degradaciones) {
    log(`ingest: DEGRADA [${d.fuente}]: ${d.motivo}${d.enlace ? ` (${d.enlace})` : ""}`);
  }

  return {
    ...res,
    dbLoaded,
    dryRun,
    semanas: semanas.map((s) => `${s.year}-W${String(s.week).padStart(2, "0")}`),
  };
}

// Entry-point CLI: `tsx ingest-cli.ts --desde 2026-W20 --hasta 2026-W25 [--solo-senado] [--dry-run]`.
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
        `\ningest ${r.dryRun ? "DRY-RUN" : "LIVE"}: camara=${r.camaraCitaciones} ` +
          `senado=${r.senadoCitaciones} sesiones=${r.senadoSesiones} dbLoaded=${r.dbLoaded} ` +
          `errores=${r.errores.length} degradaciones=${r.degradaciones.length}`,
      );
      process.exit(r.errores.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("ingest FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
