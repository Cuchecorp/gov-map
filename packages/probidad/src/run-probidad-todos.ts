// run-probidad-todos — orquestación de la ingesta LIVE de patrimonio/intereses para TODOS los
// parlamentarios de la maestra, con confirmación de identidad DIRIGIDA y determinista (Phase 26).
//
// A diferencia de `runIngestProbidad` (cruce name-only contra toda la maestra vía `correrPipeline`),
// aquí se consulta UNA query SPARQL por parlamentario (FILTER coarse por `apellido_paterno
// apellido_materno`) y se filtra el resultado con el test de SUPERCONJUNTO de tokens dirigido
// (`reconciliarDeclaracionesObjetivo`): sólo las declaraciones cuyo declarante es superconjunto del
// objetivo se escriben, confirmadas a ESE parlamentario. Esto separa hermanos (mismo paterno+materno)
// por el primer nombre y tolera segundos nombres del declarante. NUNCA fabrica un enlace.
//
// Flujo por parlamentario:
//   1. frag = "paterno materno" (coarse FILTER). Sin ambos apellidos → error anotado, sigue.
//   2. fetchSparql(queryDeclaracionesPorNombre(frag)) → parseDeclaraciones → reconciliarObjetivo.
//   3. writer.upsertDeclaraciones(filas); si hubo filas, el objetivo queda confirmado.
//   4. cualquier error de un parlamentario se anota y NO aborta la corrida (tolerante).
// Tras el loop: writer.marcarIngestado(confirmados, ingestadoHasta ?? hoy).
//
// El rate-limit 2-3s/host lo aplica el `HostRateLimiter` del conector — NO se agregan sleeps aquí.

import { makeProvenance, type Parlamentario } from "@obs/core";
import { sha256Hex, type R2Store, type SnapshotWriter } from "@obs/ingest";
import type { InfoProbidadConnector } from "./connector-infoprobidad";
import type { ProbidadWriter } from "./writer";
import { parseDeclaraciones } from "./parse-infoprobidad";
import { queryDeclaracionesPorNombre } from "./sparql";
import { reconciliarDeclaracionesObjetivo } from "./reconciliar-objetivo";

/** Endpoint SPARQL representativo del run (la fila source_snapshot es run-level, no por declaración). */
const INFOPROBIDAD_SPARQL_URL = "https://datos.cplt.cl/sparql";

export interface RunProbidadTodosOpts {
  conector: InfoProbidadConnector;
  writer: ProbidadWriter;
  /** Maestra de parlamentarios: uno por objetivo (una query SPARQL por cada uno). */
  maestra: Parlamentario[];
  /** Límite de parlamentarios a consultar (slice de la maestra); ausente = todos. */
  limite?: number;
  /** Fecha de corte del marcador de ingesta (`ingestado_hasta`). Default: hoy (ISO date). */
  ingestadoHasta?: string;
  /**
   * Store R2 para la Etapa 1 (crudo agregado por run, content-addressed). Si se omite, no se
   * persiste crudo (r2Path = null) — best-effort, NO fatal (espejo de run-camara-lobby).
   */
  r2Store?: R2Store;
  /**
   * Writer de source_snapshot (provenance run-level). Solo se invoca tras un put R2 exitoso. Si se
   * omite, no se escribe la fila (la carga a Supabase de las declaraciones procede igual).
   */
  snapshotWriter?: SnapshotWriter;
  log?: (m: string) => void;
}

export interface RunProbidadTodosResult {
  /** Parlamentarios efectivamente consultados (tras el slice por `limite`). */
  parlamentariosConsultados: number;
  /** Declaraciones (versiones) escritas (suma sobre todos los objetivos). */
  declaraciones: number;
  /** Bienes escritos (suma de las 6 sub-clases). */
  bienes: number;
  /** Familiares escritos. */
  familiares: number;
  /** Parlamentarios con al menos una declaración confirmada en esta corrida. */
  confirmados: number;
  /** Errores por parlamentario — tolerados, no abortan la corrida. */
  errores: { id: string; mensaje: string }[];
  /** Key del crudo agregado en R2, o null (Etapa 1 omitida o fallida — no fatal). */
  r2Path: string | null;
  /**
   * true si el crudo agregado de esta corrida YA existía en R2 con el mismo sha (412 de
   * `If-None-Match: *`) ⇒ la fuente no trajo novedades respecto de la corrida anterior (G6).
   */
  sinNovedades: boolean;
}

/** Cuenta los bienes de una versión sumando las 6 sub-clases (espeja ingest-run.contarBienes). */
function contarBienes(b: {
  inmuebles: unknown[];
  muebles: unknown[];
  actividades: unknown[];
  pasivos: unknown[];
  accionesDerechos: unknown[];
  valores: unknown[];
}): number {
  return (
    b.inmuebles.length +
    b.muebles.length +
    b.actividades.length +
    b.pasivos.length +
    b.accionesDerechos.length +
    b.valores.length
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// G7 — Etapa 2 DESDE R2 (`--from-r2`). Regla LOCKED 2 de CLAUDE.md: re-ingestar a
// Supabase se hace SIEMPRE desde el crudo versionado, NUNCA volviendo al CPLT.
// Firma del flag = plantilla dorada `tramitacion/src/ingest-cli.ts:130`.
// ─────────────────────────────────────────────────────────────────────────────

/** Error de argumentos/validación del replay: se lanza ANTES de cualquier red o DB. */
export class ReplayR2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayR2Error";
  }
}

/** Fuente de lectura del crudo (subconjunto de `R2Store` — inyectable en tests). */
export interface R2ReplaySource {
  getObject(r2Path: string): Promise<Uint8Array>;
}

/**
 * Keys ACEPTADAS por el replay (T-119-13): el `r2Path` es input del operador y se usa como key
 * de `getObject`; la regex lo ancla de punta a punta ⇒ ni `..`, ni rutas absolutas, ni prefijos
 * ajenos. El segmento de fecha ES la fecha de corte del crudo (ver `ingestadoHasta`).
 */
const REPLAY_KEY_RE = /^infoprobidad\/declaraciones\/(\d{4}-\d{2}-\d{2})\/([0-9a-f]{64})\.json$/;

export interface RunProbidadReplayOpts {
  r2: R2ReplaySource;
  /** Key content-addressed del crudo AGREGADO a re-procesar. */
  r2Path: string;
  writer: ProbidadWriter;
  /** Maestra: el cruce sigue siendo el test de superconjunto determinista (nunca fabrica FK). */
  maestra: Parlamentario[];
  log?: (m: string) => void;
}

export interface RunProbidadReplayResult {
  declaraciones: number;
  bienes: number;
  familiares: number;
  confirmados: number;
  /** Fecha de corte usada para `ingestado_hasta` — SIEMPRE la del crudo, jamás `new Date()`. */
  ingestadoHasta: string;
  r2Path: string;
}

/** Lee `--from-r2 <r2Path>` de argv. Devuelve null si el flag no está; lanza si viene vacío. */
export function parseFromR2Arg(argv: string[]): string | null {
  const i = argv.indexOf("--from-r2");
  if (i < 0) return null;
  const path = argv[i + 1];
  if (!path || path.startsWith("--")) throw new ReplayR2Error("--from-r2 requiere un r2Path");
  return path;
}

/**
 * Re-procesa a Supabase el crudo agregado YA versionado en R2 (Etapa 2 aislada). NO instancia el
 * conector InfoProbidad: la firma no lo admite ⇒ es imposible volver al CPLT desde aquí.
 *
 * HONESTIDAD DE FRESCURA (T-119-15): `ingestado_hasta` sale del segmento de fecha de la key —
 * un replay del pasado NO puede fingir que la fuente se consultó hoy.
 *
 * FAIL-LOUD, CERO ESCRITURA PARCIAL: la key, el sha del contenido (T-119-14), el JSON y su forma
 * se validan y TODO el crudo se parsea/reconcilia ANTES del primer upsert. Un crudo malformado
 * lanza con el path (sin credenciales — T-119-16) y no deja ni una fila escrita.
 *
 * DIVERGENCIA DECLARADA respecto de la ingesta normal: el crudo agregado es un array SIN el id del
 * parlamentario que originó cada query, así que cada response se reconcilia contra la maestra
 * COMPLETA con el MISMO test de superconjunto determinista. Es igual de fail-closed (un declarante
 * que no es superconjunto de ningún objetivo no se escribe) y no depende del orden del array.
 */
export async function runProbidadReplay(
  opts: RunProbidadReplayOpts,
): Promise<RunProbidadReplayResult> {
  const log = opts.log ?? (() => {});
  const m = REPLAY_KEY_RE.exec(opts.r2Path);
  if (!m) {
    throw new ReplayR2Error(
      `--from-r2: r2Path no reconocido (${opts.r2Path}); se espera ` +
        `infoprobidad/declaraciones/<YYYY-MM-DD>/<sha256>.json`,
    );
  }
  const hasta = m[1]!;
  const shaKey = m[2]!;

  log(`probidad-replay: leyendo crudo desde R2 (${opts.r2Path}) — CERO consultas al CPLT`);
  const bytes = await opts.r2.getObject(opts.r2Path);

  // T-119-14: la key ES el sha256 del contenido → se re-calcula y se compara.
  const shaReal = await sha256Hex(bytes);
  if (shaReal !== shaKey) {
    throw new ReplayR2Error(
      `--from-r2: sha del contenido (${shaReal}) ≠ sha de la key (${shaKey}) en ${opts.r2Path}`,
    );
  }

  let crudos: unknown;
  try {
    crudos = JSON.parse(new TextDecoder().decode(bytes));
  } catch (err) {
    throw new ReplayR2Error(
      `--from-r2: crudo ilegible en ${opts.r2Path} (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (!Array.isArray(crudos)) {
    throw new ReplayR2Error(
      `--from-r2: forma inesperada en ${opts.r2Path} (se espera un array de responses SPARQL)`,
    );
  }
  for (const [i, c] of crudos.entries()) {
    const bindings = (c as { results?: { bindings?: unknown } } | null)?.results?.bindings;
    if (typeof c !== "object" || c === null || !Array.isArray(bindings)) {
      throw new ReplayR2Error(
        `--from-r2: forma inesperada en ${opts.r2Path} — el elemento ${i} no es una response SPARQL ` +
          `(falta results.bindings)`,
      );
    }
  }

  // Fase 1 (SIN escribir): parsear + reconciliar TODO. Cualquier fallo aborta con cero filas.
  const porVersion = new Map<string, ReturnType<typeof reconciliarDeclaracionesObjetivo>[number]>();
  const confirmados = new Set<string>();
  for (const json of crudos) {
    const decls = parseDeclaraciones(json, { enlace: INFOPROBIDAD_SPARQL_URL });
    for (const p of opts.maestra) {
      const filas = reconciliarDeclaracionesObjetivo(decls, p);
      for (const f of filas) {
        // Dedupe por clave de VERSIÓN + objetivo: el mismo declarante puede aparecer en varias
        // responses del crudo agregado (FILTER coarse por apellidos) — se escribe una sola vez.
        porVersion.set(`${f.fuenteId}∥${f.fechaPresentacion}∥${p.id}`, f);
        confirmados.add(p.id);
      }
    }
  }

  // Fase 2 (escritura): upsert idempotente + cursor con la fecha DEL CRUDO.
  const filas = [...porVersion.values()];
  await opts.writer.upsertDeclaraciones(filas);
  await opts.writer.marcarIngestado([...confirmados], hasta);

  const bienes = filas.reduce((n, f) => n + contarBienes(f.bienes), 0);
  const familiares = filas.reduce((n, f) => n + f.familiares.length, 0);
  log(
    `probidad-replay: ${filas.length} versiones / ${confirmados.size} confirmados ` +
      `(ingestado_hasta=${hasta}, del crudo — NO del reloj)`,
  );

  return {
    declaraciones: filas.length,
    bienes,
    familiares,
    confirmados: confirmados.size,
    ingestadoHasta: hasta,
    r2Path: opts.r2Path,
  };
}

/**
 * Corre la ingesta de probidad para todos los parlamentarios (o los primeros `limite`). Idempotente
 * y VERSIONADA (el writer upserta por la clave de versión). Tolerante: un parlamentario que falla se
 * anota y la corrida sigue. Confirma SÓLO por test de superconjunto determinista — nunca fabrica.
 */
export async function runProbidadTodos(opts: RunProbidadTodosOpts): Promise<RunProbidadTodosResult> {
  const log = opts.log ?? (() => {});
  const hasta = opts.ingestadoHasta ?? new Date().toISOString().slice(0, 10);
  const objetivos =
    opts.limite != null ? opts.maestra.slice(0, opts.limite) : opts.maestra;

  const errores: RunProbidadTodosResult["errores"] = [];
  const confirmados = new Set<string>();
  // Crudo AGREGADO por run (decisión LOCKED RESEARCH Open Q1): cada response SPARQL se acumula y
  // se persiste como UN solo objeto R2 → UN r2_path → UNA fila source_snapshot por run.
  const crudos: unknown[] = [];
  let declaraciones = 0;
  let bienes = 0;
  let familiares = 0;

  for (const p of objetivos) {
    const paterno = (p.apellido_paterno ?? "").trim();
    const materno = (p.apellido_materno ?? "").trim();
    const frag = `${paterno} ${materno}`.toLowerCase().trim();
    if (frag.length === 0) {
      errores.push({ id: p.id, mensaje: "sin apellido_paterno ni apellido_materno — no se puede consultar" });
      log(`probidad-todos: ${p.id} OMITIDO (sin apellidos)`);
      continue;
    }

    try {
      const json = await opts.conector.fetchSparql(queryDeclaracionesPorNombre(frag));
      const rawBindings = (json as { results?: { bindings?: unknown[] } })?.results?.bindings ?? [];
      log(`probidad-todos: ${p.id} (${frag}) → SPARQL devolvió ${rawBindings.length} bindings`);
      crudos.push(json); // acumula el crudo SPARQL para el snapshot agregado por run (Etapa 1).
      const decls = parseDeclaraciones(json, { enlace: opts.conector.urlSparql(frag) });
      const filas = reconciliarDeclaracionesObjetivo(decls, p);
      await opts.writer.upsertDeclaraciones(filas);

      declaraciones += filas.length;
      bienes += filas.reduce((n, f) => n + contarBienes(f.bienes), 0);
      familiares += filas.reduce((n, f) => n + f.familiares.length, 0);
      if (filas.length > 0) confirmados.add(p.id);
      log(`probidad-todos: ${p.id} (${frag}) → ${filas.length} versiones confirmadas`);
    } catch (err) {
      errores.push({ id: p.id, mensaje: err instanceof Error ? err.message : String(err) });
      log(`probidad-todos: ${p.id} ERROR → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await opts.writer.marcarIngestado([...confirmados], hasta);

  // Etapa 1 (R2, best-effort): persiste el crudo AGREGADO por run content-addressed y escribe UNA
  // fila source_snapshot run-level. NO fatal — la carga a Supabase YA ocurrió arriba; un fallo de
  // R2/snapshot deja r2Path null y no aborta (espejo de run-camara-lobby.ts L85–105).
  let r2Path: string | null = null;
  let sinNovedades = false;
  if (opts.r2Store) {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(crudos));
      const sha = await sha256Hex(bytes);
      let existed = false;
      ({ r2Path, existed } = await opts.r2Store.putImmutable(
        "infoprobidad",
        "declaraciones",
        hasta,
        sha,
        "json",
        bytes,
      ));
      log(`probidad-todos: crudo agregado en R2 → ${r2Path}`);
      // G6 — DIVERGENCIA DELIBERADA respecto de la plantilla dorada
      // (`packages/tramitacion/src/ingest-run.ts:330`), no un descuido: allá la Etapa 1 corre
      // ANTES de la carga y el `existed` permite saltarse la Etapa 2 entera; ACÁ la carga a
      // Supabase (`marcarIngestado` + los upserts del loop) YA ocurrió más arriba, así que el
      // 412 no puede ahorrar trabajo. Lo que sí hace: (a) queda CONSUMIDO y VISIBLE en el log
      // —un skip silencioso es indistinguible de una corrida rota (T-119-08)— y (b) evita
      // re-registrar una fila source_snapshot para un objeto ya registrado. Reordenar las
      // etapas para que el skip ahorre trabajo de verdad queda registrado como hallazgo del
      // plan 119-03; este plan NO reordena etapas.
      if (existed) {
        sinNovedades = true;
        log(`[skip] sin novedades — infoprobidad declaraciones ${hasta}`);
      }
      if (opts.snapshotWriter && !sinNovedades) {
        await opts.snapshotWriter.write({
          source: "infoprobidad",
          resource: "declaraciones",
          cacheKey: `infoprobidad:declaraciones:${hasta}`,
          r2Path,
          contentHash: sha,
          fingerprint: sha,
          dateBucket: hasta,
          provenance: makeProvenance("infoprobidad", INFOPROBIDAD_SPARQL_URL),
        });
        log(`probidad-todos: fila source_snapshot escrita (r2_path=${r2Path})`);
      }
    } catch (err) {
      r2Path = null;
      log(`probidad-todos: Etapa 1 R2/snapshot falló (no fatal): ${(err as Error).message}`);
    }
  }

  return {
    parlamentariosConsultados: objetivos.length,
    declaraciones,
    bienes,
    familiares,
    confirmados: confirmados.size,
    errores,
    r2Path,
    sinNovedades,
  };
}
