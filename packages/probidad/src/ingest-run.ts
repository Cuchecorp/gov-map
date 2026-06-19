// ingest-run — orquestación de la corrida de probidad: por cada declarante (por nombre/lote),
// fetchea el SPARQL en el ORDEN LOCKED, aplica DRIFT BLOQUEANTE (cuarentena), parsea LITERAL,
// reconcilia el declarante name-only y persiste VERSIONADO — tolerante a fuentes inalcanzables
// (degradación honesta) y SIN fabricar filas.
//
// Esta es una fuente PII (InfoProbidad). Un drift ESTRUCTURAL (la forma del SPARQL-JSON cambió —
// p.ej. CPLT evoluciona la ontología) CUARENTENA la corrida de ESE recurso: emite 0 filas y
// registra una `DegradacionProbidad`, NUNCA filas vacías/garbage que se lean como "no declara"
// (Pitfall 5 / C4).
//
// Flujo por declarante (nombre normalizado):
//   1. build query (sparql.ts) → fetch (orden LOCKED). Inalcanzable → degradación honesta, sigue.
//   2. DriftDetector en modo BLOQUEANTE: fingerprint de la forma parseada vs. el último conocido.
//      changed === true → CUARENTENA (0 filas + degradación). NO escribe.
//   3. parseDeclaraciones → reconciliarDeclarante → writer.upsertDeclaraciones → writer.marcarIngestado.
//   4. Fuente vacía → 0 filas (NO inventa).

import type { InfoProbidadConnector } from "./connector-infoprobidad";
import { InfoProbidadBloqueadaError } from "./connector-infoprobidad";
import type { ProbidadWriter } from "./writer";
import { parseDeclaraciones } from "./parse-infoprobidad";
import { queryDeclaracionesPorNombre } from "./sparql";
import { reconciliarDeclarante, type ReconciliarDeclaranteOpts } from "./reconciliar-declarante";
import { fingerprint, structuralPaths, type DriftStore } from "@obs/ingest";
import type { Parlamentario } from "@obs/core";

/** Una tarea acotada: un fragmento de nombre normalizado (apellido) a consultar. */
export interface TareaDeclarante {
  /** Fragmento de nombre normalizado (apellido) para el FILTER coarse. */
  nombre: string;
}

/** Marcador de degradación de una fuente (no es un error de datos: es honestidad). */
export interface DegradacionProbidad {
  fuente: string;
  motivo: string;
  /** true si la causa fue un drift estructural BLOQUEANTE (cuarentena). */
  driftQuarantine?: boolean;
}

export interface RunIngestProbidadOpts {
  conector: InfoProbidadConnector;
  writer: ProbidadWriter;
  /** Maestra de parlamentarios para el cruce name-only del declarante. */
  maestra: Parlamentario[];
  /** Tareas acotadas (un fragmento de nombre por declarante). */
  tareas: TareaDeclarante[];
  /** Opciones de reconciliación (provider/writer/periodo) — defaults seguros. */
  reconciliar?: ReconciliarDeclaranteOpts;
  /**
   * Store de drift (lee el último fingerprint conocido). Si se omite, no se evalúa drift (primera
   * corrida / tests sin store). Cuando se provee, el drift es BLOQUEANTE.
   */
  driftStore?: DriftStore;
  /** Fecha de corte para el marcador de ingesta (`ingestado_hasta`). Default: hoy (ISO date). */
  ingestadoHasta?: string;
  log?: (msg: string) => void;
}

export interface RunIngestProbidadResult {
  /** Declaraciones (versiones) escritas (suma sobre las tareas no en cuarentena). */
  declaraciones: number;
  /** Bienes escritos (suma de todas las sub-clases). */
  bienes: number;
  /** Familiares escritos. */
  familiares: number;
  /** Parlamentarios marcados como ingestados (confirmados en esta corrida). */
  parlamentariosMarcados: number;
  /** Errores por declarante — tolerados, no abortan la corrida. */
  errores: { fuente: string; clave: string; mensaje: string }[];
  /** Degradaciones honestas (declarante inalcanzable y/o cuarentena por drift). */
  degradaciones: DegradacionProbidad[];
  /** true si alguna tarea quedó en cuarentena por drift estructural. */
  driftQuarantine: boolean;
}

const ORIGEN_DRIFT = "infoprobidad-sparql";

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
 * Corre la ingesta de probidad. Idempotente y VERSIONADA (el writer upserta por la clave de
 * versión). Tolerante: un declarante inalcanzable degrada honestamente sin abortar; un drift
 * estructural CUARENTENA esa tarea (0 filas), NUNCA fabrica.
 */
export async function runIngestProbidad(opts: RunIngestProbidadOpts): Promise<RunIngestProbidadResult> {
  const log = opts.log ?? (() => {});
  const hasta = opts.ingestadoHasta ?? new Date().toISOString().slice(0, 10);

  const errores: RunIngestProbidadResult["errores"] = [];
  const degradaciones: DegradacionProbidad[] = [];
  const marcados = new Set<string>();
  let declaraciones = 0;
  let bienes = 0;
  let familiares = 0;
  let driftQuarantine = false;

  for (const tarea of opts.tareas) {
    const clave = `nombre:${tarea.nombre}`;
    let json: unknown;
    try {
      const query = queryDeclaracionesPorNombre(tarea.nombre);
      json = await opts.conector.fetchSparql(query);
    } catch (err) {
      if (err instanceof InfoProbidadBloqueadaError) {
        log(`ingest-probidad: ${clave} BLOQUEADA (HTTP ${err.status}) → degradación honesta`);
        degradaciones.push({
          fuente: clave,
          motivo: `InfoProbidad bloqueó el fetch (HTTP ${err.status}); sin filas para esta tarea`,
        });
      } else {
        errores.push({
          fuente: ORIGEN_DRIFT,
          clave,
          mensaje: err instanceof Error ? err.message : String(err),
        });
      }
      continue;
    }

    // DRIFT BLOQUEANTE (Pitfall 5 / C4): compara la forma parseada contra el último fingerprint
    // conocido de este recurso. Si CAMBIÓ → CUARENTENA: 0 filas + degradación, NUNCA escribe.
    let parsed: ReturnType<typeof parseDeclaraciones>;
    try {
      parsed = parseDeclaraciones(json, { enlace: opts.conector.urlSparql(tarea.nombre) });
    } catch (err) {
      // Una forma SPARQL-JSON inesperada (sin results.bindings) → cuarentena por drift estructural.
      driftQuarantine = true;
      log(`ingest-probidad: ${clave} DRIFT ESTRUCTURAL (forma SPARQL-JSON inesperada) → CUARENTENA`);
      degradaciones.push({
        fuente: clave,
        motivo: `drift estructural: ${err instanceof Error ? err.message : String(err)}; cuarentena (0 filas)`,
        driftQuarantine: true,
      });
      continue;
    }

    if (opts.driftStore) {
      const recurso = `nombre/${tarea.nombre}`;
      const muestra = parsed.length > 0 ? parsed[0] : { __vacio: true };
      const fp = await fingerprint(muestra);
      const prev = await opts.driftStore.lastFingerprint(ORIGEN_DRIFT, recurso);
      if (prev !== undefined && prev !== fp) {
        driftQuarantine = true;
        log(`ingest-probidad: ${clave} DRIFT ESTRUCTURAL (forma cambió) → CUARENTENA (0 filas, no escribe)`);
        degradaciones.push({
          fuente: clave,
          motivo:
            "drift estructural: la forma del SPARQL-JSON de declaraciones cambió respecto al golden; " +
            "la corrida de este recurso se puso en cuarentena para no emitir filas que se lean como 'no declara'",
          driftQuarantine: true,
        });
        await opts.driftStore.insertAlert({
          source: ORIGEN_DRIFT,
          resource: recurso,
          prevFingerprint: prev,
          newFingerprint: fp,
        });
        continue;
      }
      if (prev === undefined) {
        await opts.driftStore.insertAlert({ source: ORIGEN_DRIFT, resource: recurso, newFingerprint: fp });
      }
    }

    // Fuente vacía → 0 filas (NO inventa). Reconcilia name-only + escribe versionado.
    try {
      const { declaraciones: filas, parlamentariosConfirmados } = await reconciliarDeclarante(
        parsed,
        opts.maestra,
        opts.reconciliar ?? {},
      );
      await opts.writer.upsertDeclaraciones(filas);
      declaraciones += filas.length;
      bienes += filas.reduce((n, f) => n + contarBienes(f.bienes), 0);
      familiares += filas.reduce((n, f) => n + f.familiares.length, 0);
      for (const id of parlamentariosConfirmados) marcados.add(id);
      log(`ingest-probidad: ${clave} → ${filas.length} versiones`);
    } catch (err) {
      errores.push({
        fuente: ORIGEN_DRIFT,
        clave,
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Marca a los parlamentarios tocados (un row por id) para el marcador de "no ingestado".
  if (marcados.size > 0) {
    await opts.writer.marcarIngestado([...marcados], hasta);
  }

  return {
    declaraciones,
    bienes,
    familiares,
    parlamentariosMarcados: marcados.size,
    errores,
    degradaciones,
    driftQuarantine,
  };
}

/** Helper exportado para tests: el set de paths estructurales de una declaración parseada. */
export function formaDe(obj: unknown): string[] {
  return structuralPaths(obj);
}
