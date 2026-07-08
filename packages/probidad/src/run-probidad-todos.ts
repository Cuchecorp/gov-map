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
  if (opts.r2Store) {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(crudos));
      const sha = await sha256Hex(bytes);
      ({ r2Path } = await opts.r2Store.putImmutable(
        "infoprobidad",
        "declaraciones",
        hasta,
        sha,
        "json",
        bytes,
      ));
      log(`probidad-todos: crudo agregado en R2 → ${r2Path}`);
      if (opts.snapshotWriter) {
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
  };
}
