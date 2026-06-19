// ingest-run-servel — orquestacion de la corrida de SERVEL. El quarantine boundary es el RUN (un
// archivo de eleccion), NO la fila. Espeja ingest-run.ts (dinero) para la maquinaria de
// cuarentena/degradacion + el wiring de reconciliacion de ingest-run.ts (lobby) para inyectar
// provider/writer/periodo al cruce del candidato por NOMBRE.
//
// DIVERGENCIA CLAVE vs ChileCompra (per-task tolerance): aqui el drift es BLOQUEANTE a nivel de RUN.
// En CUALQUIER mismatch (drift de header al parsear, o mismatch de completitud Content-MD5/byte-length/
// conteo) la corrida ENTERA va a cuarentena: 0 filas emitidas, NUNCA un parcial silencioso.
//
// Flujo por corrida (una eleccion = un .xlsx):
//   1. connector.descargar(url) -> bytes + anclas. ServelBloqueadaError -> degradacion honesta, continue.
//   2. parseAportes(bytes). THROW (drift de header) -> CUARENTENA DE TODA LA CORRIDA (0 filas).
//   3. reconciliarCompletitud(parsed, ctrl, md5/length). !ok -> CUARENTENA DE TODA LA CORRIDA (0 filas).
//   4. solo si header OK Y completitud OK: subirCrudo -> reconciliarAporte (cruce por NOMBRE async) ->
//      upsertDonantes -> upsertAportes -> acumula confirmados.
//   5. al final: marcarIngestado([...marcados], hasta).
//
// GUARDA EXPLICITA: prohibido cualquier upsertAportes de un subconjunto tras un error de parse/completitud.

import { createHash } from "node:crypto";
import type { Parlamentario } from "@obs/core";
import type { ServelConnector } from "./connector-servel";
import { ServelBloqueadaError } from "./connector-servel";
import { parseAportes } from "./parse-servel";
import { reconciliarCompletitud, type ControlTotal } from "./reconciliar-completitud";
import { reconciliarAporte, type ReconciliarAporteOpts } from "./reconciliar-aporte";
import { donanteIdDe, ORIGEN_SERVEL, LICENCIA_SERVEL, type Donante } from "./model-servel";
import type { ServelWriter } from "./writer-servel";

const ORIGEN_DRIFT = ORIGEN_SERVEL;

/** Subida del crudo a object storage (Supabase Storage). Inyectable; en dry-run se omite. */
export type SubirCrudoFn = (eleccion: string, fechaCorte: string, bytes: Uint8Array) => Promise<string>;

/** Una tarea acotada: una eleccion + la URL de su .xlsx (la URL la pasa el operador). */
export interface TareaEleccion {
  /** Slug de la eleccion (entra en la clave del crudo + el marcador). */
  eleccion: string;
  /** URL del .xlsx de la eleccion (Azure Blob; la pasa el operador, A2). */
  url: string;
  /** Anio de la eleccion (entra en la `eleccion` compuesta verbatim del parser). */
  anio?: string | null;
  /** Conteo declarado (TOTAL) si el operador lo conoce (control secundario best-effort). */
  declaredRowCount?: number | null;
}

/** Marcador de degradacion de una fuente (no es un error de datos: es honestidad). */
export interface DegradacionDinero {
  fuente: string;
  motivo: string;
  /** true si la causa fue cuarentena (drift de header o mismatch de completitud). */
  cuarentena?: boolean;
}

export interface RunIngestServelOpts {
  conector: ServelConnector;
  writer: ServelWriter;
  /** Maestra de parlamentarios para el cruce del candidato por NOMBRE. */
  maestra: Parlamentario[];
  /** Tareas acotadas (una eleccion + url por tarea). */
  tareas: TareaEleccion[];
  /** Opciones del cruce por NOMBRE (provider/writer/periodo) — se pasan TAL CUAL a reconciliarAporte. */
  reconciliar?: ReconciliarAporteOpts;
  /** Subida del crudo (Supabase Storage). Si se omite, no se sube (dry-run). */
  subirCrudo?: SubirCrudoFn;
  /** Fecha de corte para el marcador + el crudo. Default: hoy (ISO date). */
  fechaCorte?: string;
  log?: (msg: string) => void;
}

export interface RunIngestServelResult {
  /** Aportes escritos (suma sobre las corridas NO en cuarentena). */
  aportes: number;
  /** Donantes (sub-maestra) escritos. */
  donantes: number;
  /** Parlamentarios marcados como ingestados (confirmados en esta corrida). */
  parlamentariosMarcados: number;
  /** Elecciones cuarentenadas (drift de header o mismatch de completitud). */
  cuarentenados: string[];
  /** Errores por eleccion — tolerados, no abortan el proceso. */
  errores: { fuente: string; clave: string; mensaje: string }[];
  /** Degradaciones honestas (fuente inalcanzable y/o cuarentena run-level). */
  degradaciones: DegradacionDinero[];
}

/** md5 (base64) de los bytes recibidos (para comparar contra el Content-MD5 del HEAD). */
function md5Base64(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("base64");
}

/**
 * Corre la ingesta de SERVEL. Idempotente y VERSIONADA. El quarantine boundary es el RUN: cualquier
 * drift de header o mismatch de completitud CUARENTENA la eleccion ENTERA (0 filas), NUNCA un parcial.
 * Una fuente bloqueada degrada honestamente sin abortar. NUNCA fabrica un enlace ni una fila.
 */
export async function runIngestServel(opts: RunIngestServelOpts): Promise<RunIngestServelResult> {
  const log = opts.log ?? (() => {});
  const fechaCorte = opts.fechaCorte ?? new Date().toISOString().slice(0, 10);

  const errores: RunIngestServelResult["errores"] = [];
  const degradaciones: DegradacionDinero[] = [];
  const marcados = new Set<string>();
  const cuarentenados: string[] = [];
  let aportes = 0;
  let donantes = 0;

  for (const tarea of opts.tareas) {
    const clave = `eleccion:${tarea.eleccion}`;

    // 0. GUARDA DE FRONTERA (rule #4, WR-05): `eleccion`/`url` vacios JAMAS deben fluir a
    // storage/marcador (un slug vacio -> clave "servel/sin-eleccion/..." es un mislabel silencioso).
    // El CLI solo validaba cuando NO se inyecta conector; aqui el run boundary lo enforce SIEMPRE
    // (incluido el camino de conector inyectado / llamada directa). 0 filas para esta tarea, sin
    // tocar storage ni marcador.
    if (!tarea.eleccion?.trim() || !tarea.url?.trim()) {
      const motivo = `tarea invalida: eleccion/url vacios (eleccion='${tarea.eleccion ?? ""}', url='${tarea.url ?? ""}'); 0 filas`;
      log(`ingest-servel: ${clave} TAREA INVALIDA -> ${motivo}`);
      errores.push({ fuente: ORIGEN_DRIFT, clave, mensaje: motivo });
      degradaciones.push({ fuente: clave, motivo });
      continue;
    }

    // 1. Descarga (orden LOCKED dentro del conector). Bloqueada -> degradacion honesta, continue.
    let bytes: Uint8Array;
    let anclas;
    let byteLength: number;
    try {
      const desc = await opts.conector.descargar(tarea.url);
      bytes = desc.bytes;
      anclas = desc.anclas;
      byteLength = desc.byteLength;
    } catch (err) {
      if (err instanceof ServelBloqueadaError) {
        log(`ingest-servel: ${clave} BLOQUEADA (HTTP ${err.status}) -> degradacion honesta`);
        degradaciones.push({
          fuente: clave,
          motivo: `SERVEL bloqueo el fetch (HTTP ${err.status}); 0 filas para esta eleccion`,
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

    // 2. Parse (gate de header-text). THROW -> CUARENTENA DE TODA LA CORRIDA (0 filas, NO upsert).
    let parsed;
    try {
      parsed = await parseAportes(bytes, {
        anio: tarea.anio ?? null,
        fechaCorte,
        enlace: tarea.url,
      });
    } catch (err) {
      cuarentenados.push(tarea.eleccion);
      log(`ingest-servel: ${clave} DRIFT ESTRUCTURAL (header) -> CUARENTENA RUN (0 filas)`);
      degradaciones.push({
        fuente: clave,
        motivo: `drift estructural: ${err instanceof Error ? err.message : String(err)}; cuarentena run-level (0 filas)`,
        cuarentena: true,
      });
      continue; // NUNCA emite un subconjunto.
    }

    // 3. Reconciliacion de completitud RUN-LEVEL. !ok -> CUARENTENA DE TODA LA CORRIDA (0 filas).
    const ctrl: ControlTotal = {
      contentMd5: anclas.contentMd5,
      contentLength: anclas.contentLength,
      declaredRowCount: tarea.declaredRowCount ?? null,
    };
    const completitud = reconciliarCompletitud(parsed, ctrl, { md5: md5Base64(bytes), length: byteLength });
    if (!completitud.ok) {
      cuarentenados.push(tarea.eleccion);
      log(`ingest-servel: ${clave} COMPLETITUD MISMATCH -> CUARENTENA RUN (0 filas)`);
      degradaciones.push({
        fuente: clave,
        motivo: `${completitud.motivo}; cuarentena run-level (0 filas)`,
        cuarentena: true,
      });
      continue; // NUNCA emite un parcial silencioso.
    }

    // 4. Solo si header OK Y completitud OK: subirCrudo -> reconciliar por NOMBRE -> upsert.
    try {
      if (opts.subirCrudo) {
        const key = await opts.subirCrudo(tarea.eleccion, fechaCorte, bytes);
        log(`ingest-servel: ${clave} crudo subido -> ${key}`);
      }

      const { aportes: filas, parlamentariosConfirmados } = await reconciliarAporte(
        parsed,
        opts.maestra,
        opts.reconciliar ?? {},
      );

      // Sub-maestra donante: una fila por (nombre+tipo) unico de la corrida (el donante, VERBATIM,
      // NUNCA llave de enlace). Deduplicada por donante_id.
      const donantesMap = new Map<string, Donante>();
      for (const f of filas) {
        const id = donanteIdDe(f.donanteNombre, f.tipoPersona);
        donantesMap.set(id, {
          donanteId: id,
          rutDonante: null, // la fuente no trae RUT hoy.
          nombre: f.donanteNombre,
          tipoPersona: f.tipoPersona,
          origen: ORIGEN_SERVEL,
          fecha_captura: f.fecha_captura,
          enlace: f.enlace,
          licencia: LICENCIA_SERVEL,
        });
      }
      const donantesLote = [...donantesMap.values()];

      await opts.writer.upsertDonantes(donantesLote);
      await opts.writer.upsertAportes(filas);
      aportes += filas.length;
      donantes += donantesLote.length;
      for (const id of parlamentariosConfirmados) marcados.add(id);
      log(`ingest-servel: ${clave} -> ${filas.length} aportes / ${donantesLote.length} donantes`);
    } catch (err) {
      errores.push({
        fuente: ORIGEN_DRIFT,
        clave,
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Marca a los parlamentarios confirmados (un row por id) para el marcador de "no ingestado".
  if (marcados.size > 0) {
    await opts.writer.marcarIngestado([...marcados], fechaCorte);
  }

  return {
    aportes,
    donantes,
    parlamentariosMarcados: marcados.size,
    cuarentenados,
    errores,
    degradaciones,
  };
}
