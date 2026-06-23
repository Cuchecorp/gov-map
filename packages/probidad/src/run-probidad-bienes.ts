// run-probidad-bienes — runner BATCHEADO de la ingesta de bienes (las 6 sub-tablas de OQ2).
//
// Toma una lista de versiones de declaración YA conocidas (`{fuenteId, fechaPresentacion}` — la raíz
// `declaracion` ya existe), las chunkea (default 50), y por cada chunk corre las 6 queries BATCH
// (`VALUES ?d {…}`) contra el conector SPARQL, parsea cada respuesta a `Map<fuenteId, T[]>`,
// reensambla un `Bienes` por versión y lo escribe vía `writer.upsertBienes`.
//
// TOLERANTE: si una de las 6 queries de un chunk falla, se registra el error y se CONTINÚA con los
// demás chunks (no aborta la corrida). Los conteos suman SOLO lo que llegó a escribirse.
//
// SIN red ni DB directa: todo pasa por el conector (fetchSparql) y el writer inyectados.

import {
  queryBienesInmueblesBatch,
  queryBienesMueblesBatch,
  queryActividadesBatch,
  queryPasivosBatch,
  queryAccionesDerechosBatch,
  queryValoresBatch,
} from "./sparql";
import {
  parseBienInmueble,
  parseBienMueble,
  parseActividad,
  parsePasivo,
  parseAccionDerecho,
  parseValor,
} from "./parse-bienes";
import { ORIGEN_PROBIDAD, LICENCIA_PROBIDAD, type Bienes } from "./model";
import type { InfoProbidadConnector } from "./connector-infoprobidad";
import type { ProbidadWriter, BienesParaEscribir } from "./writer";

export interface RunProbidadBienesOpts {
  conector: InfoProbidadConnector;
  writer: ProbidadWriter;
  /** Versiones de declaración cuyos bienes ingestar (la raíz ya existe). */
  declaraciones: { fuenteId: string; fechaPresentacion: string }[];
  /** Tamaño de chunk de declaraciones por lote de queries BATCH (default 50). */
  chunkSize?: number;
  log?: (m: string) => void;
}

export interface RunProbidadBienesResult {
  chunks: number;
  inmuebles: number;
  muebles: number;
  actividades: number;
  pasivos: number;
  accionesDerechos: number;
  valores: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Ingesta batcheada de bienes. Corre las 6 queries BATCH por chunk de declaraciones, parsea, reensambla
 * un `Bienes` por versión y escribe vía `writer.upsertBienes`. Tolerante: un fallo de query en un chunk
 * se registra y NO aborta los demás chunks. Devuelve los conteos de lo efectivamente escrito.
 */
export async function runProbidadBienes(opts: RunProbidadBienesOpts): Promise<RunProbidadBienesResult> {
  const { conector, writer, declaraciones } = opts;
  const chunkSize = opts.chunkSize ?? 50;
  const log = opts.log ?? (() => {});

  const enlace = conector.urlSparql?.("") ?? "https://datos.cplt.cl/sparql";
  const result: RunProbidadBienesResult = {
    chunks: 0,
    inmuebles: 0,
    muebles: 0,
    actividades: 0,
    pasivos: 0,
    accionesDerechos: 0,
    valores: 0,
  };

  const lotes = chunk(declaraciones, chunkSize);
  for (const [i, lote] of lotes.entries()) {
    result.chunks++;
    const uris = lote.map((d) => d.fuenteId);

    // Cada query es independiente y tolerante: un fallo deja su map vacío y se registra.
    const vacio = new Map<string, never[]>();
    const correr = async <T>(
      etiqueta: string,
      query: string,
      parse: (j: unknown) => Map<string, T[]>,
    ): Promise<Map<string, T[]>> => {
      try {
        const json = await conector.fetchSparql(query);
        return parse(json);
      } catch (err) {
        log(`[run-probidad-bienes] chunk ${i + 1}/${lotes.length} query ${etiqueta} falló: ${(err as Error).message}`);
        return vacio as Map<string, T[]>;
      }
    };

    const inmueblesMap = await correr("inmueble", queryBienesInmueblesBatch(uris), parseBienInmueble);
    const mueblesMap = await correr("mueble", queryBienesMueblesBatch(uris), parseBienMueble);
    const actividadesMap = await correr("actividad", queryActividadesBatch(uris), parseActividad);
    const pasivosMap = await correr("pasivo", queryPasivosBatch(uris), parsePasivo);
    const accionesMap = await correr("accionDerecho", queryAccionesDerechosBatch(uris), parseAccionDerecho);
    const valoresMap = await correr("valor", queryValoresBatch(uris), parseValor);

    const items: BienesParaEscribir[] = [];
    for (const decl of lote) {
      const bienes: Bienes = {
        inmuebles: inmueblesMap.get(decl.fuenteId) ?? [],
        muebles: mueblesMap.get(decl.fuenteId) ?? [],
        actividades: actividadesMap.get(decl.fuenteId) ?? [],
        pasivos: pasivosMap.get(decl.fuenteId) ?? [],
        accionesDerechos: accionesMap.get(decl.fuenteId) ?? [],
        valores: valoresMap.get(decl.fuenteId) ?? [],
      };
      items.push({
        fuenteId: decl.fuenteId,
        fechaPresentacion: decl.fechaPresentacion,
        bienes,
        origen: ORIGEN_PROBIDAD,
        fecha_captura: new Date().toISOString(),
        enlace,
        licencia: LICENCIA_PROBIDAD,
      });

      result.inmuebles += bienes.inmuebles.length;
      result.muebles += bienes.muebles.length;
      result.actividades += bienes.actividades.length;
      result.pasivos += bienes.pasivos.length;
      result.accionesDerechos += bienes.accionesDerechos.length;
      result.valores += bienes.valores.length;
    }

    try {
      await writer.upsertBienes(items);
    } catch (err) {
      log(`[run-probidad-bienes] chunk ${i + 1}/${lotes.length} upsertBienes falló: ${(err as Error).message}`);
    }
    log(
      `[run-probidad-bienes] chunk ${i + 1}/${lotes.length}: ${lote.length} decl → ` +
        `inm=${items.reduce((s, it) => s + it.bienes.inmuebles.length, 0)} ` +
        `mue=${items.reduce((s, it) => s + it.bienes.muebles.length, 0)} ` +
        `act=${items.reduce((s, it) => s + it.bienes.actividades.length, 0)} ` +
        `pas=${items.reduce((s, it) => s + it.bienes.pasivos.length, 0)} ` +
        `acc=${items.reduce((s, it) => s + it.bienes.accionesDerechos.length, 0)} ` +
        `val=${items.reduce((s, it) => s + it.bienes.valores.length, 0)}`,
    );
  }

  return result;
}
