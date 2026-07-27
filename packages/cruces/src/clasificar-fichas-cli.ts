// clasificar-fichas-cli — batch de ETIQUETADO DE SECTOR de PROYECTOS (CRUCE-02, ruta PÚBLICA).
//
// Espeja la SHAPE de packages/fichas/src/pipeline-cli.ts (parseArgs fail-fast + --service-key
// guard, decidirDryRun degrade-to-dry-run, env-driven config, isMain), NO su contenido de
// extracción. Flujo de DOS ETAPAS (D-13):
//   1. selecciona filas de proyecto_ficha (idea_matriz cuando exista, si no titulo/materia);
//   2. clasificarFicha por fila (DeepSeek — público/bulk por el router);
//   3. en modo NO-dry: actualizarSectorFicha (writer service-role, etapa derivada sin LLM).
//
// En --dry-run NO toca la DB: corre la clasificación y, sobre los primeros N proyectos, reporta
// la COBERTURA (≥7/10 = gate CRUCE-02) sin escribir. Sin service key (y sin --dry-run) → degrada
// a dry-run con AVISO explícito (NUNCA silent no-write).
//
// NO reusa el pipeline de extracción literal (fetch de texto fuente, conector Senado, R2,
// --reembed/--boletines): esto SOLO clasifica filas ya ingeridas. Env-driven:
// SUPABASE_URL/SUPABASE_SECRET_KEY/DEEPSEEK_API_KEY. Cero vocabulario causal en logs. La
// corrida LIVE real que puebla sector_id = Plan 04.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DeepSeekProvider, GraniteProvider, buildTieredProvider, type LLMProvider } from "@obs/llm";
import { clasificarFicha, type ClasificarFichaInput } from "./clasificar";
import { SupabaseCrucesWriter, type CrucesWriter } from "./writer-supabase";

const DEFAULT_LIMITE = 50;
/** Tamaño de la muestra sobre la que se reporta la cobertura del gate CRUCE-02. */
const MUESTRA_GATE = 10;

/** Fila a clasificar (proyecto_ficha unida a proyecto para el texto). */
export interface FichaPorClasificar {
  boletin: string;
  idea_matriz?: string | null;
  titulo?: string | null;
  materia?: string | null;
}

export interface FichasCliOptions {
  limite?: number;
  dryRun?: boolean;
  serviceKey?: string;
  /**
   * Solo lobby: carga únicamente contrapartes en audiencia confirmada y sin sector_id.
   * INERTE en fichas (fichas clasifica TODAS, decisión LOCKED); el parser lo comparte.
   */
  soloConfirmadas?: boolean;
  /**
   * Solo lobby (WR-05): cursor de reanudación para --solo-confirmadas — carga solo
   * identificadores estrictamente MAYORES que este valor (orden determinista). Las
   * abstenciones dejan sector_id en null y volverían a seleccionarse por siempre;
   * el cursor permite AVANZAR sin re-pagar esas llamadas. INERTE en fichas.
   */
  desde?: string;
  /** Override de URL (default: SUPABASE_URL / SUPABASE_API_URL del entorno). */
  url?: string;
  /** Filas inyectadas (tests / dry-run sin DB). */
  filas?: FichaPorClasificar[];
  /** Provider inyectado (tests). Default: DeepSeekProvider de env. */
  provider?: LLMProvider;
  /** Writer inyectado (tests). Default: SupabaseCrucesWriter o noop si dry-run. */
  writer?: CrucesWriter;
  log?: (msg: string) => void;
}

export interface FichasCliResult {
  procesados: number;
  asignados: number;
  abstenidos: number;
  /** Cobertura sobre la muestra (asignados/min(procesados,10)) — el reporte del gate. */
  coberturaMuestra: number;
  dbLoaded: boolean;
  dryRun: boolean;
}

/** Error de validación de flags (se reporta ANTES de cualquier red/DB). */
export class CrucesCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "CrucesCliArgsError";
  }
}

/** Parsea argv → FichasCliOptions, validando los valores ANTES de tocar red/DB (fail-fast). */
export function parseArgs(argv: string[]): FichasCliOptions {
  const opts: FichasCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--solo-confirmadas":
        // Espejo booleano de --dry-run. Solo altera la CARGA de lobby (clasificar-lobby-cli);
        // inerte en fichas. El parser es compartido → un solo case cubre ambos CLIs.
        opts.soloConfirmadas = true;
        break;
      case "--limite": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) {
          throw new CrucesCliArgsError(`--limite inválido: ${raw} (esperado entero > 0)`);
        }
        opts.limite = n;
        break;
      }
      case "--service-key": {
        // Fail-fast: sin valor, decidirDryRun degradaría SILENCIOSAMENTE a dry-run y el
        // operador creería estar escribiendo sin persistir nada. Mejor error explícito.
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0) {
          throw new CrucesCliArgsError("--service-key vacío (esperado una key)");
        }
        opts.serviceKey = raw;
        break;
      }
      case "--desde": {
        // Cursor de reanudación (WR-05/WR-06, solo lobby): el `id` PK surrogate de
        // lobby_contraparte impreso al final de la corrida anterior. Fail-fast: un valor
        // ausente o que parece otro flag (--dry-run tragado como valor) sería un cursor basura.
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0 || raw.startsWith("--")) {
          throw new CrucesCliArgsError(
            `--desde inválido: ${raw ?? "(vacío)"} (esperado el id de la última fila procesada)`,
          );
        }
        opts.desde = raw;
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new CrucesCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Decide si la corrida es dry-run: lo es si el operador lo pidió O si no hay service key
 * (sin key NO se toca la DB). Pura (testeable sin red). Espejo de pipeline-cli decidirDryRun.
 */
export function decidirDryRun(opts: { serviceKey?: string; dryRun?: boolean }): boolean {
  return opts.dryRun === true || (opts.serviceKey ?? "").length === 0;
}

/** Construye el input de clasificación: idea_matriz cuando exista, si no titulo/materia. */
function inputDeFila(f: FichaPorClasificar): ClasificarFichaInput {
  return {
    ...(f.idea_matriz != null ? { idea_matriz: f.idea_matriz } : {}),
    ...(f.titulo != null ? { titulo: f.titulo } : {}),
    ...(f.materia != null ? { materia: f.materia } : {}),
  };
}

/** Lee proyecto_ficha (+ proyecto para el texto) acotado a `limite`. Solo se ejerce en LIVE. */
async function cargarFichas(
  client: SupabaseClient | null,
  opts: FichasCliOptions,
  limite: number,
  log: (m: string) => void,
): Promise<FichaPorClasificar[]> {
  if (opts.filas !== undefined) return opts.filas;
  if (client === null) {
    log("cruces-fichas: dry-run sin filas inyectadas → conjunto vacío (no hay qué clasificar)");
    return [];
  }
  const { data, error } = await client
    .from("proyecto_ficha")
    .select("boletin, idea_matriz, proyecto:proyecto(titulo, materia)")
    // LOCKED (CLAUDE.md): paginar/limitar con .order() SIEMPRE — PostgREST no garantiza
    // orden sin ORDER BY, y la muestra del gate CRUCE-02 se toma de las primeras filas.
    // Sin orden determinista, dos corridas sobre los mismos datos reportarían coberturas
    // distintas (WR-02). `boletin` da un orden estable y reproducible.
    .order("boletin", { ascending: true })
    .limit(limite);
  if (error) throw new Error(`cargarFichas falló: ${error.message}`);
  type JoinRow = {
    boletin: string;
    idea_matriz: string | null;
    proyecto: { titulo?: string | null; materia?: string | null } | null;
  };
  return ((data ?? []) as unknown as JoinRow[]).map((r) => ({
    boletin: r.boletin,
    idea_matriz: r.idea_matriz,
    titulo: r.proyecto?.titulo ?? null,
    materia: r.proyecto?.materia ?? null,
  }));
}

/**
 * Resuelve el LLMProvider a usar según opciones e entorno.
 *
 * Orden de prioridad:
 *  1. opts.provider inyectado (tests / integración) — se respeta sin condición.
 *  2. Sin CLASIFICACION_ESCALERA=1 → DeepSeekProvider directo (DEFAULT INCUMBENTE,
 *     byte-idéntico al comportamiento anterior, INTEG-03 rollback por config).
 *  3. Con CLASIFICACION_ESCALERA=1 + WORKERS_AI_API_TOKEN y CLOUDFLARE_ACCOUNT_ID
 *     no vacíos → TieredProvider Granite→DeepSeek (escalera candidata INTEG-01).
 *     Si faltan keys → DeepSeekProvider con log de advertencia (Pitfall 2, T-109-05).
 *
 * Función pura: recibe `env` como parámetro en vez de leer process.env directamente
 * para ser testeable sin efectos globales.
 */
export function resolverProvider(
  opts: Pick<FichasCliOptions, "provider">,
  env: Partial<Record<string, string>>,
  log: (msg: string) => void,
): LLMProvider {
  // Rama 1: inyección explícita (tests / integración) — nunca sobrescribir.
  if (opts.provider !== undefined) return opts.provider;

  const deepseekKey = env.DEEPSEEK_API_KEY ?? "";

  // Rama 2: default incumbente (sin env var o con cualquier valor ≠ "1").
  if (env.CLASIFICACION_ESCALERA !== "1") {
    log("cruces-fichas: provider=deepseek (default incumbente)");
    return new DeepSeekProvider({ apiKey: deepseekKey });
  }

  // Rama 3: escalera Granite→DeepSeek (CLASIFICACION_ESCALERA=1).
  const workerToken = env.WORKERS_AI_API_TOKEN ?? "";
  const accountId = env.CLOUDFLARE_ACCOUNT_ID ?? "";

  // Pitfall 2 (T-109-05): nunca construir GraniteProvider con key/account vacíos
  // → caída de vuelta a DeepSeek con advertencia.
  if (workerToken.length === 0 || accountId.length === 0) {
    log(
      "cruces-fichas: CLASIFICACION_ESCALERA=1 pero WORKERS_AI_API_TOKEN o " +
        "CLOUDFLARE_ACCOUNT_ID ausentes → fallback a DeepSeek (Pitfall 2)",
    );
    return new DeepSeekProvider({ apiKey: deepseekKey });
  }

  // Pitfall 1 (T-109-07): ACCOUNT_ID interpolado en baseURL, nunca hardcodeado.
  const baseURL = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
  log("cruces-fichas: provider=tiered:granite→deepseek (CLASIFICACION_ESCALERA=1)");
  return buildTieredProvider({
    primary: {
      provider: new GraniteProvider({ apiKey: workerToken, baseURL }),
      costPerToken: 0.00000000125, // informativo — telemetría
    },
    escalation: {
      provider: new DeepSeekProvider({ apiKey: deepseekKey }),
      costPerToken: 0.00000014, // informativo — telemetría
    },
  });
}

/**
 * Corre el batch de etiquetado de sector sobre fichas. Lanza CrucesCliArgsError si los flags
 * son inválidos (antes de cualquier red/DB).
 */
export async function main(opts: FichasCliOptions = {}): Promise<FichasCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url = opts.url ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL ?? "";
  const serviceKey = opts.serviceKey ?? process.env.SUPABASE_SECRET_KEY ?? "";
  const limite = opts.limite ?? DEFAULT_LIMITE;

  const dryRun = decidirDryRun({ serviceKey, dryRun: opts.dryRun });
  if (opts.dryRun !== true && serviceKey.length === 0) {
    log("cruces-fichas: sin SUPABASE_SECRET_KEY → corrida DRY-RUN (no carga DB)");
  }

  // Provider: resolverProvider encapsula el env-gate CLASIFICACION_ESCALERA.
  // Default = DeepSeek incumbente (byte-idéntico sin la env var).
  const provider = resolverProvider(opts, process.env, log);

  // Cliente de lectura + writer: Supabase real (carga DB) o null/noop (dry-run, descarta).
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
      // Hay key pero el operador pidió --dry-run: igual leemos para reportar cobertura.
      // WR-01: createClient("", key) lanza "supabaseUrl is required" — un dry-run "solo
      // reportar cobertura" no debe crashear por URL ausente. Degradar limpio: sin URL,
      // no hay lectura DB (solo filas inyectadas, que aquí no existen → conjunto vacío).
      if (url.length === 0) {
        log(
          "cruces-fichas: SUPABASE_URL ausente → dry-run sin lectura DB " +
            "(no hay filas que clasificar; solo se reportaría cobertura de filas inyectadas)",
        );
      } else {
        client = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      }
    }
  } else {
    // Rama LIVE: URL ausente es una misconfiguración real → fail-fast explícito antes
    // de construir un cliente inválido (WR-01, simétrico a la guarda de --service-key).
    if (url.length === 0) {
      throw new Error(
        "cruces-fichas: SUPABASE_URL ausente en corrida LIVE — " +
          "setear SUPABASE_URL/SUPABASE_API_URL o pasar --url (o usar --dry-run)",
      );
    }
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    writer = opts.writer ?? new SupabaseCrucesWriter({ url, serviceKey });
    dbLoaded = true;
    log(`cruces-fichas: writer Supabase (${url}) — UPDATE idempotente de sector_id`);
  }

  const filas = await cargarFichas(client, opts, limite, log);

  let asignados = 0;
  let abstenidos = 0;
  let asignadosMuestra = 0;
  let i = 0;
  for (const fila of filas) {
    const { sector_codigo } = await clasificarFicha(inputDeFila(fila), provider);
    if (sector_codigo === null) {
      abstenidos++;
    } else {
      asignados++;
      if (i < MUESTRA_GATE) asignadosMuestra++;
    }
    if (!dryRun) {
      await writer.actualizarSectorFicha(fila.boletin, sector_codigo);
    }
    i++;
  }

  const tamMuestra = Math.min(filas.length, MUESTRA_GATE);
  const coberturaMuestra = tamMuestra === 0 ? 0 : asignadosMuestra / tamMuestra;

  log(
    `cruces-fichas: ${dryRun ? "DRY-RUN" : "LIVE"} → ${filas.length} procesados / ` +
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

// Entry-point CLI: `tsx clasificar-fichas-cli.ts --limite 50 [--dry-run] [--service-key K]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /clasificar-fichas-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: FichasCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("cruces-fichas FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\ncruces-fichas ${r.dryRun ? "DRY-RUN" : "LIVE"}: procesados=${r.procesados} ` +
          `asignados=${r.asignados} abstenidos=${r.abstenidos} ` +
          `coberturaMuestra=${(r.coberturaMuestra * 100).toFixed(0)}% dbLoaded=${r.dbLoaded}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("cruces-fichas FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
