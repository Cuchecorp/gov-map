// run-camara-votos — runner de PRODUCCIÓN de @obs/votos (VOTE-02).
//
// Promueve el spike de Phase 8 (`spike/spike.ts`) a un conector de producción Cámara-only que
// ENRIQUECE el modelo `voto`/`votacion` existente (0008/0009) — NO forka. Es un runner DELGADO:
// reusa VERBATIM los símbolos v1.0 de @obs/tramitacion / @obs/ingest (cero ingeniería nueva de
// fetch/parse/cruce/upsert) y cambia respecto del spike SOLO en dos cosas:
//   (1) escribe a Supabase vía `SupabaseTramitacionWriter` (no in-memory), y
//   (2) acota la corrida a la legislatura vigente (Leg-58) por boletines explícitos o `limite`.
//
// El cruce DIPID → id_diputado_camara es DETERMINISTA, sin LLM, minteando `EnlaceConfirmado` vía
// `reconciliarVotosCamara` (el único mint site, IDENT-12); el FK del voto es `EnlaceConfirmado |
// null` — un string crudo NO compila. Idempotente por clave natural `(votacion_id,
// fuente_voter_id)`; provenance por fila (`origen`/`fecha_captura`/`enlace`); fail-closed: un
// DIPID fuera de la maestra queda `no_confirmado`, NUNCA fabrica un vínculo ni un voto.
//
// La política de red LOCKED (rate-limit 2-3s + robots + UA + SSRF allowlist) vive UNA vez en
// @obs/ingest y se ensambla aquí heredando `buildCamaraConnector()` del spike (allowlist `{}`,
// el default ya cubre el sufijo `camara.cl` → `opendata.camara.cl` pasa). NO se edita el allowlist.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import {
  CamaraConnector,
  SenadoConnector,
  InMemoryTramitacionWriter,
  SupabaseTramitacionWriter,
  cargarMaestra,
  findWorkspaceRoot,
  runIngest,
  type TramitacionWriter,
  type RunIngestResult,
} from "@obs/tramitacion";
import type { Parlamentario } from "@obs/core";

/** Id de la legislatura vigente (Leg-58); la corrida de prod se acota a ella. */
export const LEGISLATURA_VIGENTE = 58;

export interface RunCamaraVotosOpts {
  /**
   * Boletines explícitos de la corrida ACOTADA (con o sin sufijo, p.ej. ["14309","18296"]).
   * Si se omite, se descubren por sesiones de la legislatura vigente y SE EXIGE un `limite`
   * (nunca se corre todo a ciegas contra el WAF).
   */
  boletines?: string[];
  /** Recorte del conjunto (descubierto o explícito) — alcance acotado WAF/tiempo. */
  limite?: number;
  /** Id de legislatura a descubrir si no hay `boletines`. Default: la vigente (58). */
  legislaturaId?: number;
  /**
   * Maestra ya cargada. Si se omite, se carga del seed autoritativo
   * (`supabase/seeds/parlamentario.seed.json`, read-only, sin tocar la DB). Inyectable en tests.
   */
  maestra?: Parlamentario[];
  /** Conector de Cámara. Inyectable en tests; por defecto se ensambla con la política LOCKED. */
  camara?: CamaraConnector;
  /** Conector de Senado. Inyectable en tests; por defecto se ensambla con la política LOCKED. */
  senado?: SenadoConnector;
  /**
   * Writer. Inyectable en tests. Si se omite: `SupabaseTramitacionWriter` cuando hay
   * `SUPABASE_URL`+`SUPABASE_LOCAL_SERVICE_KEY`, si no `InMemoryTramitacionWriter` (dry-run).
   */
  writer?: TramitacionWriter;
  /** Raíz del workspace para resolver el seed (default: cwd). */
  cwd?: string;
  /** Sink de logs (inyectable en tests). Default: noop. */
  log?: (msg: string) => void;
}

export interface RunCamaraVotosResult extends RunIngestResult {
  /** True si se escribió a Supabase (writer real); false en dry-run (in-memory). */
  dbLoaded: boolean;
  /** Boletines efectivamente pedidos (los explícitos, vacío si fue por descubrimiento). */
  boletinesPedidos: string[];
}

/** Error de validación de opciones (se reporta ANTES de tocar la red/DB). */
export class RunCamaraVotosArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RunCamaraVotosArgsError";
  }
}

/**
 * Construye el `CamaraConnector` con la política LOCKED de @obs/ingest (orden LOCKED), heredando
 * el patrón `buildCamaraConnector()` del spike: allowlist `{}` (el default cubre `camara.cl`),
 * `HostRateLimiter` 2-3s serial por host y `RobotsGuard`. NO se edita el allowlist.
 */
export function buildCamaraConnector(): CamaraConnector {
  const allowlist = {};
  return new CamaraConnector({
    fetcher: new Fetcher({ allowlist }),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist }),
    allowlist,
  });
}

/** Construye el `SenadoConnector` con la misma política LOCKED (runIngest lo exige; degrada vacío). */
export function buildSenadoConnector(): SenadoConnector {
  const allowlist = {};
  return new SenadoConnector({
    fetcher: new Fetcher({ allowlist }),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist }),
    allowlist,
  });
}

/**
 * Corre la ingesta acotada del voto individual de la Cámara enriqueciendo `voto`/`votacion`.
 * Ensambla los colaboradores LOCKED y REUSA `runIngest` (degrada fail-closed sin provider del
 * Senado: las votaciones del Senado quedan vacías y no abortan). Idempotente; provenance por fila.
 *
 * @throws RunCamaraVotosArgsError si no se acota la corrida (sin `boletines` y sin `limite`).
 */
export async function runCamaraVotos(
  opts: RunCamaraVotosOpts = {},
): Promise<RunCamaraVotosResult> {
  const log = opts.log ?? (() => {});

  // Acotar SIEMPRE: o boletines explícitos o un límite > 0 (nunca todo a ciegas contra el WAF).
  const tieneBoletines = opts.boletines != null && opts.boletines.length > 0;
  const tieneLimite = opts.limite != null && opts.limite > 0;
  if (!tieneBoletines && !tieneLimite) {
    throw new RunCamaraVotosArgsError(
      "corrida no acotada: pasa `boletines` explícitos o un `limite` > 0 (alcance WAF/tiempo)",
    );
  }

  const legislaturaId = opts.legislaturaId ?? LEGISLATURA_VIGENTE;
  const camara = opts.camara ?? buildCamaraConnector();
  const senado = opts.senado ?? buildSenadoConnector();

  // Maestra: inyectada (tests) o del seed autoritativo (read-only, no toca DB).
  const maestra =
    opts.maestra ?? cargarMaestra(opts.cwd ?? findWorkspaceRoot(process.cwd()), log);

  // Writer: inyectado (tests) o elegido por entorno. Supabase real solo si hay URL + service key;
  // si no, in-memory (dry-run) → corre fetch/parse/cruce pero descarta el upsert (no escribe DB).
  let writer = opts.writer;
  let dbLoaded = false;
  if (writer == null) {
    const url = process.env.SUPABASE_URL ?? process.env.SUPABASE_LOCAL_URL ?? "";
    const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY ?? "";
    if (url.length > 0 && serviceKey.length > 0) {
      writer = new SupabaseTramitacionWriter({ url, serviceKey });
      dbLoaded = true;
      log(`votos: writer Supabase (${url}) — upsert idempotente por clave natural`);
    } else {
      writer = new InMemoryTramitacionWriter();
      log("votos: sin SUPABASE_URL+SUPABASE_LOCAL_SERVICE_KEY → DRY-RUN (in-memory, no escribe DB)");
    }
  }

  const res = await runIngest({
    ...(tieneBoletines ? { boletines: opts.boletines } : {}),
    legislaturaId,
    ...(tieneLimite ? { limite: opts.limite } : {}),
    maestra,
    camara,
    senado,
    writer,
    log,
  });

  log(
    `votos: OK → ${res.votaciones} votaciones / ${res.votos} votos ` +
      `(${res.errores.length} errores) dbLoaded=${dbLoaded}`,
  );

  return {
    ...res,
    dbLoaded,
    boletinesPedidos: tieneBoletines ? opts.boletines! : [],
  };
}
