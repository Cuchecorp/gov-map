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
//   --from-r2 <r2Path>   REPLAY: la Etapa 2 lee el crudo YA versionado en R2 (regla LOCKED 2 de
//                        CLAUDE.md) — CERO fetches a leylobby.gob.cl. La key la imprime la corrida
//                        que lo escribió: leylobby/<INST>/<YYYY>/p<N>/<YYYY-MM-DD>/<sha256>.html.
//                        La tarea se DERIVA de la key; el cursor durable no se consulta ni avanza.
//
// La maestra de parlamentarios se inyecta (tests) o se deja vacía en dry-run (el cruce degrada a
// no_confirmado sin fabricar). NOTA CONGRESO (Open Question 2): la Cámara/Senado NO están en
// leylobby; la corrida LIVE de congreso usa el portal propio de la Cámara (verificación de operador).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  R2Store,
  sha256Hex,
  SnapshotWriter,
  SupabaseSnapshotStore,
  type CreateSupabaseClient,
} from "@obs/ingest";
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

/**
 * CR-01 (119-REVIEW) — keys ACEPTADAS por `--from-r2`, ancladas de punta a punta.
 *
 * Es EXACTAMENTE la partición que escribe la Etapa 1 de este conector
 * (`ingest-run.ts`: `putImmutable("leylobby", "<INST>/<year>/p<page>", <fecha>, <sha>, "html")`)
 * ⇒ `leylobby/<INST>/<YYYY>/p<N>/<YYYY-MM-DD>/<sha256>.html`. El anclaje excluye `..`, rutas
 * absolutas y prefijos de otras fuentes: el r2Path es input del operador y se usa como key de
 * `getObject` (T-119-13).
 */
export const R2_KEY_LEYLOBBY_RE =
  /^leylobby\/([A-Za-z0-9]+)\/(\d{4})\/p(\d+)\/\d{4}-\d{2}-\d{2}\/([0-9a-f]{64})\.html$/;

/** Tarea + sha derivados de una key de replay ya validada contra `R2_KEY_LEYLOBBY_RE`. */
export function tareaDesdeR2Path(
  r2Path: string,
): { institucion: string; year: number; page: number; sha: string } | null {
  const m = R2_KEY_LEYLOBBY_RE.exec(r2Path);
  if (!m) return null;
  return {
    institucion: m[1]!,
    year: Number(m[2]),
    page: Number(m[3]),
    sha: m[4]!,
  };
}

/**
 * G1 (119-06) — Carga la maestra del seed autoritativo (`supabase/seeds/parlamentario.seed.json`,
 * la MISMA fuente que usa `run-camara-lobby-cli.ts:98`) cuando el caller no inyectó una.
 *
 * POR QUÉ EXISTE: hasta 119-06 esta CLI corría SIEMPRE con `maestra: []`, así que
 * `reconciliarSujeto` no podía confirmar a NADIE — la reconciliación era código muerto en el cron
 * y `lobby_ingesta_estado` no tenía forma de avanzar por esta vía ni siquiera en principio. Con la
 * maestra cargada, la corrida marca cobertura si (y sólo si) un sujeto pasivo resulta ser un
 * parlamentario. Nótese que el alcance LOCKED del cron son instituciones del EJECUTIVO, así que lo
 * ESPERADO sigue siendo cero confirmados: esto no fabrica cobertura, sólo deja de ser ciego.
 *
 * Best-effort: si el seed no está donde se espera (empaquetado distinto), devuelve `[]` con un log
 * — degradar a "no confirma a nadie" es exactamente el comportamiento previo, nunca un enlace falso.
 */
export function cargarMaestraSeed(log: (m: string) => void): Parlamentario[] {
  // `import.meta.dirname` y NO `new URL(import.meta.url)`: el segundo se rompe bajo jsdom y en
  // `tsx -e` (gotcha registrado en Phase 46). `process.cwd()` cubre el caso `pnpm --filter exec`,
  // cuyo cwd es el paquete (gotcha v8.1).
  const arranques = [import.meta.dirname, process.cwd()].filter(
    (d): d is string => typeof d === "string" && d.length > 0,
  );
  for (const arranque of arranques) {
    let dir = arranque;
    for (let i = 0; i < 8; i++) {
      try {
        const raw = readFileSync(join(dir, "supabase", "seeds", "parlamentario.seed.json"), "utf8");
        const maestra = JSON.parse(raw) as Parlamentario[];
        log(`ingest-lobby: maestra cargada del seed (${maestra.length} parlamentarios)`);
        return maestra;
      } catch {
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
  }
  log(
    "ingest-lobby: seed de la maestra NO encontrado → la corrida NO podrá confirmar a ningún " +
      "sujeto pasivo (degradación honesta: nunca se fabrica un enlace)",
  );
  return [];
}

/**
 * Adapta el `createClient` de supabase-js a la factory estructural de `SupabaseSnapshotStore`
 * (espejo de `run-tramitacion-prod-cli.ts:49-50`). @obs/lobby ya declara `@supabase/supabase-js`.
 */
const createSupabaseClient: CreateSupabaseClient = (url, serviceKey) =>
  createClient(url, serviceKey) as unknown as ReturnType<CreateSupabaseClient>;

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
  /**
   * Writer de `source_snapshot` inyectable (tests). Si se omite, se construye desde las mismas
   * credenciales Supabase ya resueltas; `null` lo apaga explícitamente.
   */
  snapshotWriter?: Pick<SnapshotWriter, "write"> | null;
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
        if (!path || path.startsWith("--")) {
          throw new LobbyCliArgsError("--from-r2 requiere un r2Path");
        }
        // CR-01: la key se valida AQUÍ, antes de cualquier red/DB — fail-loud, sin adivinar.
        if (!R2_KEY_LEYLOBBY_RE.test(path)) {
          throw new LobbyCliArgsError(
            `--from-r2: r2Path no reconocido (${path}); se espera ` +
              `leylobby/<INST>/<YYYY>/p<N>/<YYYY-MM-DD>/<sha256>.html`,
          );
        }
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
  // RULE-1 (119-06): `SUPABASE_DB_URL` estaba PRIMERO en esta cadena, pero es la cadena de
  // conexión `postgres://` de psql — NO una URL REST. Con `.env` completo (corrida LOCAL del
  // operador) `createClient` moría con "Invalid supabaseUrl". En CI la variable no existe, así que
  // el defecto quedaba invisible. Sólo se aceptan las dos URLs REST.
  const url =
    opts.url ??
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
  // En REPLAY la ausencia de Etapa 1 NO es degradación (el crudo ya está versionado): el WARN
  // sería una alarma falsa. Y sin store el replay ni siquiera puede leer — falla más abajo.
  if (!r2Store && !dryRun && !opts.fromR2) {
    log("[WARN] R2 no configurado — Etapa 1 omitida (sin crudo versionado)");
  }

  // CR-01 (119-REVIEW) — REPLAY desde R2 (`--from-r2`).
  //
  // Hasta aquí el flag se parseaba, se guardaba en `opts.fromR2` y NUNCA se leía: `main()`
  // construía el conector real y corría LIVE. El operador que usaba el flag documentado para
  // "re-ingestar sin molestar al servidor" producía EXACTAMENTE el fetch que quería evitar,
  // contra una fuente volátil (Laravel/Azure, 403/503) — violación silenciosa de la regla
  // LOCKED 2 de CLAUDE.md ("Etapa 2 lee del crudo, NUNCA de la fuente").
  //
  // El replay espeja `run-camara-lobby-cli.ts:132-158` (la firma dorada): key anclada,
  // `getObject`, re-verificación del sha contra la key, y CERO conector real — es
  // estructuralmente imposible tocar leylobby.gob.cl en este camino.
  const replay = opts.fromR2 ? tareaDesdeR2Path(opts.fromR2) : null;
  if (opts.fromR2 && !replay) {
    // Defensa en profundidad: `parseArgs` ya valida, pero `main()` es API pública (tests/callers).
    throw new LobbyCliArgsError(
      `--from-r2: r2Path no reconocido (${opts.fromR2}); se espera ` +
        `leylobby/<INST>/<YYYY>/p<N>/<YYYY-MM-DD>/<sha256>.html`,
    );
  }

  // Conector REAL de @obs/ingest (rate-limit 2-3s + robots + UA + SSRF), salvo inyección (tests)
  // o REPLAY (stub sobre el crudo ya versionado).
  let conector: LeylobbyConnector;
  if (replay && opts.fromR2) {
    const fromR2 = opts.fromR2;
    const lector = r2Store;
    if (!lector) {
      throw new Error(
        "--from-r2 requiere R2 configurado (R2_ENDPOINT_URL + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY)",
      );
    }
    const urlReal = (code: string, year: number, page = 1) =>
      `https://www.leylobby.gob.cl/instituciones/${encodeURIComponent(code)}/audiencias/${year}` +
      (page > 1 ? `?page=${page}` : "");
    conector = {
      urlAudiencias: urlReal,
      urlDetalle: (code: string, year: number, rowId: string) =>
        `https://www.leylobby.gob.cl/instituciones/${encodeURIComponent(code)}/audiencias/${year}/${encodeURIComponent(rowId)}`,
      async fetchAudiencias() {
        // `getObject` lanza con status y path, SIN credenciales (T-119-16). Fail-loud: el
        // replay NUNCA degrada a re-fetch de la fuente.
        const bytes = await lector.getObject(fromR2);
        // T-119-14: la key ES el sha256 del contenido → se re-verifica antes de parsear.
        const shaReal = await sha256Hex(bytes);
        if (shaReal !== replay.sha) {
          throw new Error(
            `--from-r2: sha del contenido (${shaReal}) ≠ sha de la key (${replay.sha}) en ${fromR2}`,
          );
        }
        return new TextDecoder().decode(bytes);
      },
      async fetchDetalle(_code: string, _year: number, rowId: string) {
        // El crawl de DOS PASOS necesita fetchear cada detalle. En replay ese crudo NO está en
        // la key que el operador pasó, y salir a buscarlo sería volver a la fuente por la puerta
        // de atrás — justo lo que el flag existe para evitar. Se falla LOUD, sin adivinar: el
        // replay reproduce lo que hay en el crudo, ni una fila más.
        throw new Error(
          `--from-r2: el crudo de ${fromR2} es un LISTADO y requeriría fetchear el detalle ` +
            `${rowId} desde leylobby.gob.cl. El replay no vuelve a la fuente: re-ingesta el ` +
            `crudo de la página de DETALLE correspondiente.`,
        );
      },
    } as unknown as LeylobbyConnector;
    log(`ingest-lobby: REPLAY desde R2 (${opts.fromR2}) — CERO fetch a leylobby.gob.cl`);
  } else {
    conector =
      opts.conector ??
      new LeylobbyConnector({
        fetcher: new Fetcher(),
        rateLimiter: new HostRateLimiter(),
        robots: new RobotsGuard({ allowlist: {} }),
      });
  }

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
  // CR-01: el replay es una corrida DIRIGIDA por la key del crudo — no consulta ni mueve el
  // cursor durable (re-procesar un crudo viejo jamás puede empujar el barrido).
  const overrideExplicito = opts.anio !== undefined || opts.paginas !== undefined;
  const usaCursor = !overrideExplicito && !dryRun && !replay;

  let tareas: TareaInstitucion[];
  let cursorPrevio: CursorLeylobby | null = null;
  if (replay) {
    tareas = [
      { institucionCodigo: replay.institucion, year: replay.year, pages: [replay.page] },
    ];
    log(
      `ingest-lobby: tarea derivada de la key → ${replay.institucion}/${replay.year}/p${replay.page}`,
    );
  } else if (usaCursor) {
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

  // SnapshotWriter (source_snapshot / FND-08 / CRON-02 G5): plantilla dorada
  // `run-tramitacion-prod-cli.ts:215-224`, gateado por `!dryRun && url && serviceKey` — las
  // MISMAS variables ya resueltas arriba (incluidos los fallbacks SUPABASE_URL/SUPABASE_API_URL
  // que inyectan los workflows). En dry-run o sin credenciales queda `undefined`.
  const snapshotWriter =
    opts.snapshotWriter !== undefined
      ? (opts.snapshotWriter ?? undefined)
      : !dryRun && url && serviceKey
        ? new SnapshotWriter(
            new SupabaseSnapshotStore({ url, serviceKey, createClient: createSupabaseClient }),
          )
        : undefined;

  const res = await runIngestLobby({
    conector,
    writer,
    // G1: sin maestra inyectada, se carga el seed autoritativo (antes quedaba `[]` → cero
    // confirmados estructurales). En dry-run también, para que el ensayo refleje la corrida real.
    maestra: opts.maestra ?? cargarMaestraSeed(log),
    tareas,
    ...(opts.reconciliar !== undefined ? { reconciliar: opts.reconciliar } : {}),
    ...(opts.driftStore !== undefined ? { driftStore: opts.driftStore } : {}),
    // En REPLAY no se pasa store: el crudo YA está content-addressed en R2, así que re-escribirlo
    // daría 412 → `existed:true` → `[skip]` de la Etapa 2 entera, que es justo lo que el operador
    // quiere correr (mismo razonamiento que `omitirEtapa1` en run-camara-lobby-cli.ts).
    ...(r2Store && !replay ? { r2Store } : {}),
    ...(snapshotWriter ? { snapshotWriter } : {}),
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
