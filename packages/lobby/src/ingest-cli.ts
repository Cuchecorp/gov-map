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

import { Fetcher, HostRateLimiter, RobotsGuard, R2Store } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { LeylobbyConnector } from "./connector-leylobby";
import { SupabaseLobbyWriter } from "./writer-supabase";
import { InMemoryLobbyWriter, type LobbyWriter } from "./writer";
import {
  runIngestLobby,
  type RunIngestLobbyResult,
  type TareaInstitucion,
} from "./ingest-run";
import type { ReconciliarSujetoOpts } from "./reconciliar-sujeto";
import type { DriftStore } from "@obs/ingest";
import {
  avanzarCursor as avanzarCursorPuro,
  cursorInicial,
  deriveTarea,
  type CursorLeylobby,
} from "./cursor-leylobby";

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
  /**
   * Modo re-ingesta desde R2 (CRON-02/G23): r2Path del envelope crudo de audiencias.
   * CERO fetches a leylobby.gob.cl cuando presente.
   */
  fromR2?: string;
  /**
   * Store R2 inyectable. Si undefined, se construye desde env R2_*; si null, se omite Etapa 1
   * (con WARN si !dryRun).
   */
  r2Store?: R2Store | null;
  /** Writer inyectable para tests sin DB. */
  writer?: LobbyWriter;
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
      case "--from-r2": {
        const path = argv[++i];
        if (!path) throw new LobbyCliArgsError("--from-r2 requiere un r2Path");
        opts.fromR2 = path;
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
  const url =
    opts.url ??
    process.env.SUPABASE_DB_URL ??
    process.env.SUPABASE_URL ??
    process.env.SUPABASE_API_URL ?? // fallback: nombre inyectado por los workflows de CI
    "";
  const serviceKey =
    opts.serviceKey ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ?? // fallback: nombre inyectado por los workflows de CI
    process.env.SUPABASE_LOCAL_SERVICE_KEY ??
    "";

  const institucion = opts.institucion ?? DEFAULT_INSTITUCION;

  const dryRun = opts.dryRun === true || serviceKey.length === 0 || url.length === 0;
  if (opts.dryRun !== true && (serviceKey.length === 0 || url.length === 0)) {
    // En CI (GITHUB_ACTIONS=true) credenciales faltantes son un error duro — nunca degradar
    // silenciosamente a dry-run porque el workflow exitaría 0 sin escribir datos.
    if (process.env.GITHUB_ACTIONS === "true") {
      throw new Error(
        "ingest-lobby: GITHUB_ACTIONS=true pero faltan credenciales Supabase " +
          "(SUPABASE_API_URL / SUPABASE_SECRET_KEY). Verifica los secrets del workflow.",
      );
    }
    log("ingest-lobby: sin credenciales Supabase → corrida DRY-RUN (no carga DB)");
  }

  // R2 Store (Etapa 1 G10, hash-check, --from-r2): construir desde env si no se inyectó.
  let r2Store: R2Store | null;
  if (opts.r2Store !== undefined) {
    r2Store = opts.r2Store;
  } else {
    const ak = process.env.R2_ACCESS_KEY_ID;
    const sk = process.env.R2_SECRET_ACCESS_KEY ?? "";
    const ep = process.env.R2_ENDPOINT_URL ?? "";
    const bk = process.env.R2_BUCKET ?? "";
    r2Store = ak && ep
      ? new R2Store({ accessKeyId: ak, secretAccessKey: sk, endpoint: ep, bucket: bk })
      : null;
  }
  if (!r2Store && !dryRun) {
    log("[WARN] R2 no configurado — Etapa 1 omitida (sin crudo versionado)");
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
    writer = opts.writer ?? new InMemoryLobbyWriter();
  } else {
    writer = opts.writer ?? new SupabaseLobbyWriter({ url, serviceKey });
    dbLoaded = true;
    if (!opts.writer) log(`ingest-lobby: writer Supabase (${url}) — upsert idempotente`);
  }

  // Derivación de tareas (DEBT-02):
  //   * Override explícito (--anio/--paginas): corrida DIRIGIDA del operador → NO consulta el cursor.
  //   * Sin override + writer real (no dry-run): LEE el cursor durable (leylobby_cursor_estado) y
  //     deriva la tarea de UNA página; tras corrida exitosa AVANZA + persiste (más abajo).
  //   * Sin override + dry-run: default histórico (año actual, página 1) sin tocar el cursor.
  const overrideExplicito = opts.anio !== undefined || opts.paginas !== undefined;
  const usaCursor = !overrideExplicito && !dryRun;

  let tareas: TareaInstitucion[];
  let cursorPrevio: CursorLeylobby | null = null;
  if (usaCursor) {
    cursorPrevio = (await writer.leerCursor(institucion)) ?? cursorInicial(institucion);
    tareas = [deriveTarea(cursorPrevio)];
    log(
      `ingest-lobby: cursor ${institucion} → año ${cursorPrevio.anio} pág ${cursorPrevio.pagina}`,
    );
  } else {
    const anio = opts.anio ?? new Date().getFullYear();
    const nPaginas = opts.paginas ?? 1; // corrida ACOTADA por defecto
    const pages = Array.from({ length: nPaginas }, (_v, i) => i + 1);
    tareas = [{ institucionCodigo: institucion, year: anio, pages }];
  }

  const res = await runIngestLobby({
    conector,
    writer,
    maestra: opts.maestra ?? [],
    tareas,
    ...(opts.reconciliar !== undefined ? { reconciliar: opts.reconciliar } : {}),
    ...(opts.driftStore !== undefined ? { driftStore: opts.driftStore } : {}),
    ...(r2Store ? { r2Store } : {}),
    log,
  });

  log(
    `ingest-lobby: OK → ${res.audiencias} audiencias / ${res.contrapartes} contrapartes / ` +
      `${res.parlamentariosMarcados} parlamentarios marcados (errores: ${res.errores.length}, ` +
      `degradaciones: ${res.degradaciones.length}, drift-quarantine: ${res.driftQuarantine})`,
  );
  for (const e of res.errores) log(`ingest-lobby: ERROR [${e.fuente}/${e.clave}]: ${e.mensaje}`);
  for (const d of res.degradaciones) log(`ingest-lobby: DEGRADA [${d.fuente}]: ${d.motivo}`);

  // Avance del cursor (DEBT-02, Pitfall 4 / T-74-02): SOLO en modo cursor (no override, no dry-run)
  // y DESPUÉS de una corrida exitosa. `huboDatos = res.audiencias > 0` → una corrida que degrada
  // (403/503 → degradaciones, audiencias===0) NO avanza el cursor (avanzarCursorPuro devuelve el
  // mismo cursor cuando huboDatos=false, así que no se persiste un avance falso).
  if (usaCursor && cursorPrevio) {
    const huboDatos = res.audiencias > 0;
    const siguiente = avanzarCursorPuro(cursorPrevio, { huboDatos });
    if (huboDatos) {
      await writer.avanzarCursor(siguiente);
      log(
        `ingest-lobby: cursor avanzado → año ${siguiente.anio} pág ${siguiente.pagina}`,
      );
    } else {
      log(
        `ingest-lobby: cursor NO avanza (sin datos: ${res.degradaciones.length} degradaciones) — ` +
          `permanece en año ${cursorPrevio.anio} pág ${cursorPrevio.pagina}`,
      );
    }
  }

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
