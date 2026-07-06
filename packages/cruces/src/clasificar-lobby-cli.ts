// clasificar-lobby-cli — batch de ETIQUETADO DE SECTOR de CONTRAPARTES de lobby (CRUCE-02,
// ruta SENSIBLE). Idéntica SHAPE a clasificar-fichas-cli (parseArgs fail-fast + --service-key
// guard, decidirDryRun, env-driven, isMain) pero por la ruta CRÍTICA:
//   - clasificarContraparte (MiniMax — personal/critical por el router) HEREDA el gate de RUT
//     de Plan 02: assertNoRutInLlmInput corre PRIMERO; un RUT en el nombre lanza con 0 llamadas.
//   - en NO-dry: actualizarSectorContraparte (writer service-role, etapa derivada sin LLM, D-13).
//
// Sin service key (y sin --dry-run) → degrada a dry-run con AVISO explícito (NUNCA silent
// no-write). Env-driven: SUPABASE_URL/SUPABASE_SECRET_KEY/MINIMAX_API_KEY. Cero vocabulario
// causal en logs. La corrida LIVE real que puebla sector_id = Plan 04.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MiniMaxProvider, type LLMProvider } from "@obs/llm";
import {
  clasificarContraparte,
  type ClasificarContraparteInput,
} from "./clasificar";
import { SupabaseCrucesWriter, type CrucesWriter } from "./writer-supabase";
import {
  decidirDryRun,
  parseArgs as parseArgsBase,
  CrucesCliArgsError,
} from "./clasificar-fichas-cli";

const DEFAULT_LIMITE = 50;
/** Tamaño de la muestra sobre la que se reporta la cobertura del gate CRUCE-02. */
const MUESTRA_GATE = 10;

/** Fila de lobby_contraparte a clasificar (clave natural identificador+nombre[+rol]). */
export interface ContrapartePorClasificar {
  identificador: string;
  nombre: string;
  rol?: string;
  materia?: string | null;
}

export interface LobbyCliOptions {
  limite?: number;
  dryRun?: boolean;
  serviceKey?: string;
  /**
   * Carga únicamente contrapartes que (a) aparecen en un lobby_audiencia confirmado con
   * parlamentario enlazado Y (b) tienen sector_id is null. El filtro sector_id is null hace
   * la corrida naturalmente incremental y resumible (RESEARCH Pitfall 1). Default off.
   */
  soloConfirmadas?: boolean;
  url?: string;
  /** Filas inyectadas (tests / dry-run sin DB). */
  filas?: ContrapartePorClasificar[];
  /** Provider inyectado (tests). Default: MiniMaxProvider de env. */
  provider?: LLMProvider;
  /** Writer inyectado (tests). Default: SupabaseCrucesWriter o noop si dry-run. */
  writer?: CrucesWriter;
  log?: (msg: string) => void;
}

export interface LobbyCliResult {
  procesados: number;
  asignados: number;
  abstenidos: number;
  coberturaMuestra: number;
  dbLoaded: boolean;
  dryRun: boolean;
}

/** Re-exporta el error y el degrade gating compartidos con el CLI de fichas (misma SHAPE). */
export { decidirDryRun, CrucesCliArgsError };

/** Parsea argv → LobbyCliOptions (reusa el parser fail-fast de fichas; mismas flags). */
export function parseArgs(argv: string[]): LobbyCliOptions {
  return parseArgsBase(argv) as LobbyCliOptions;
}

/** Construye el input de clasificación de contraparte (nombre crudo + materia opcional). */
function inputDeFila(f: ContrapartePorClasificar): ClasificarContraparteInput {
  return {
    nombre: f.nombre,
    ...(f.materia != null ? { materia: f.materia } : {}),
  };
}

/** Fila cruda de lobby_contraparte (con o sin el embed de audiencia) — mapeo compartido. */
type ContraparteRow = { identificador: string; nombre: string; rol: string | null };

/** Mapea la fila cruda a ContrapartePorClasificar (rol omitido si null) — idéntico en ambas ramas. */
function mapearFila(r: ContraparteRow): ContrapartePorClasificar {
  return {
    identificador: r.identificador,
    nombre: r.nombre,
    ...(r.rol != null ? { rol: r.rol } : {}),
  };
}

/**
 * Lee lobby_contraparte (deny-by-default; el service-role bypassa RLS) acotado a `limite`.
 *
 * Con `opts.soloConfirmadas` construye la carga ALTO-ROI e INCREMENTAL (RESEARCH Pitfall 1):
 * solo contrapartes que (a) aparecen en un lobby_audiencia con estado_vinculo='confirmado' y
 * parlamentario_id no-null (embed !inner) Y (b) tienen sector_id is null. El `is("sector_id",null)`
 * es load-bearing: cada corrida excluye lo ya clasificado, así re-correr AVANZA en vez de re-pagar
 * las mismas llamadas MiniMax. Sin el flag, conserva la carga plana original como fallback.
 *
 * Exportada para test directo (spy sobre el builder encadenado). El loop de clasificación
 * (main) sigue corriendo assertNoRutInLlmInput PRIMERO — esta carga no toca esa ruta.
 */
export async function cargarContrapartes(
  client: SupabaseClient | null,
  opts: LobbyCliOptions,
  limite: number,
  log: (m: string) => void,
): Promise<ContrapartePorClasificar[]> {
  if (opts.filas !== undefined) return opts.filas;
  if (client === null) {
    log("cruces-lobby: dry-run sin filas inyectadas → conjunto vacío (no hay qué clasificar)");
    return [];
  }
  if (opts.soloConfirmadas) {
    // Carga filtrada: embed !inner a lobby_audiencia (restringe a contrapartes con audiencia
    // confirmada + parlamentario enlazado) y sector_id is null (incremental/resumible).
    const { data, error } = await client
      .from("lobby_contraparte")
      .select("identificador, nombre, rol, lobby_audiencia!inner(estado_vinculo, parlamentario_id)")
      .is("sector_id", null)
      .eq("lobby_audiencia.estado_vinculo", "confirmado")
      .not("lobby_audiencia.parlamentario_id", "is", null)
      .limit(limite);
    if (error) throw new Error(`cargarContrapartes falló: ${error.message}`);
    return ((data ?? []) as unknown as ContraparteRow[]).map(mapearFila);
  }
  const { data, error } = await client
    .from("lobby_contraparte")
    .select("identificador, nombre, rol")
    .limit(limite);
  if (error) throw new Error(`cargarContrapartes falló: ${error.message}`);
  return ((data ?? []) as unknown as ContraparteRow[]).map(mapearFila);
}

/**
 * Corre el batch de etiquetado de sector sobre contrapartes (MiniMax + RUT-gate). Lanza
 * CrucesCliArgsError si los flags son inválidos (antes de cualquier red/DB).
 */
export async function main(opts: LobbyCliOptions = {}): Promise<LobbyCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url = opts.url ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL ?? "";
  const serviceKey = opts.serviceKey ?? process.env.SUPABASE_SECRET_KEY ?? "";
  const limite = opts.limite ?? DEFAULT_LIMITE;

  const dryRun = decidirDryRun({ serviceKey, dryRun: opts.dryRun });
  if (opts.dryRun !== true && serviceKey.length === 0) {
    log("cruces-lobby: sin SUPABASE_SECRET_KEY → corrida DRY-RUN (no carga DB)");
  }

  // Provider sensible (MiniMax por el router): key de env, nunca hardcodeada ni logueada.
  const provider =
    opts.provider ?? new MiniMaxProvider({ apiKey: process.env.MINIMAX_API_KEY ?? "" });

  let client: SupabaseClient | null = null;
  let writer: CrucesWriter;
  let dbLoaded = false;
  if (dryRun) {
    const noop: CrucesWriter = {
      async actualizarSectorFicha() {},
      async actualizarSectorContraparte() {},
    };
    writer = opts.writer ?? noop;
    if (opts.filas === undefined && serviceKey.length > 0) {
      client = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  } else {
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    writer = opts.writer ?? new SupabaseCrucesWriter({ url, serviceKey });
    dbLoaded = true;
    log(`cruces-lobby: writer Supabase (${url}) — UPDATE idempotente de sector_id`);
  }

  const filas = await cargarContrapartes(client, opts, limite, log);

  let asignados = 0;
  let abstenidos = 0;
  let asignadosMuestra = 0;
  let i = 0;
  for (const fila of filas) {
    // clasificarContraparte aplica el RUT-gate PRIMERO (assertNoRutInLlmInput) — un RUT en el
    // nombre lanza con 0 llamadas al LLM (T-36-06). No se captura: un nombre sucio debe abortar.
    const { sector_codigo } = await clasificarContraparte(inputDeFila(fila), provider);
    if (sector_codigo === null) {
      abstenidos++;
    } else {
      asignados++;
      if (i < MUESTRA_GATE) asignadosMuestra++;
    }
    if (!dryRun) {
      await writer.actualizarSectorContraparte(
        fila.identificador,
        fila.nombre,
        sector_codigo,
        fila.rol,
      );
    }
    i++;
  }

  const tamMuestra = Math.min(filas.length, MUESTRA_GATE);
  const coberturaMuestra = tamMuestra === 0 ? 0 : asignadosMuestra / tamMuestra;

  log(
    `cruces-lobby: ${dryRun ? "DRY-RUN" : "LIVE"} → ${filas.length} procesados / ` +
      `${asignados} con sector / ${abstenidos} sin sector (abstención). ` +
      `Cobertura muestra (${tamMuestra}): ${(coberturaMuestra * 100).toFixed(0)}% ` +
      `(gate CRUCE-02 ≥70%)`,
  );

  return {
    procesados: filas.length,
    asignados,
    abstenidos,
    coberturaMuestra,
    dbLoaded,
    dryRun,
  };
}

// Entry-point CLI: `tsx clasificar-lobby-cli.ts --limite 50 [--dry-run] [--service-key K]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /clasificar-lobby-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: LobbyCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("cruces-lobby FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\ncruces-lobby ${r.dryRun ? "DRY-RUN" : "LIVE"}: procesados=${r.procesados} ` +
          `asignados=${r.asignados} abstenidos=${r.abstenidos} ` +
          `coberturaMuestra=${(r.coberturaMuestra * 100).toFixed(0)}% dbLoaded=${r.dbLoaded}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("cruces-lobby FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
