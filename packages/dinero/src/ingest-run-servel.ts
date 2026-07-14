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
import { sha256Hex, type R2Store, type SnapshotWriter } from "@obs/ingest";

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
  /**
   * Modo LOCAL (DEBT-01): en vez de fetchear el blob, la Etapa 1 la hizo el operador colocando el
   * `.xlsx` en R2. Cuando se setea `r2Path`, el pipeline LEE los bytes del `.xlsx` de R2 (`getObject`)
   * y NUNCA toca la fuente. `url` puede venir vacio en este modo (la frontera acepta `r2Path` como
   * alternativa valida). Requiere `r2Store`.
   */
  r2Path?: string;
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
  /**
   * Subida del crudo a Supabase Storage. DEGRADADO a secundario best-effort (decision LOCKED de
   * Plan 71-01): corre DESPUES del put R2 exitoso y NUNCA gatea (su fallo no aborta ni impide el
   * upsert). R2 es la UNICA verdad cruda gateante. Si se omite, no se sube (dry-run).
   */
  subirCrudo?: SubirCrudoFn;
  /** Fecha de corte para el marcador + el crudo. Default: hoy (ISO date). */
  fechaCorte?: string;
  log?: (msg: string) => void;
  /**
   * Store de crudo R2 (Etapa 1, DEBT-01). Si se configura, cada eleccion persiste los BYTES del
   * `.xlsx` content-addressed en R2 ANTES del upsert a Supabase; un put fallido (no-412) GATEA la
   * Etapa 2 (nunca hay derivado sin crudo reconstruible). Sin el, el runner corre como antes.
   */
  r2Store?: R2Store;
  /** Registro de provenance (`source_snapshot`) best-effort tras un put exitoso (no fatal). */
  snapshotWriter?: SnapshotWriter;
  /**
   * Modo replay LOCAL: r2Path del `.xlsx` que el operador coloco en R2. Reconstruye los aportes
   * DESDE R2 (0 fetch al blob). Requiere `r2Store`; si falta, lanza. Aplica a la(s) tarea(s):
   * cuando se setea, la lectura de bytes de esa tarea usa `getObject(fromR2)`.
   */
  fromR2?: string;
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

  // Guard de args (DEBT-01): el modo LOCAL/--from-r2 EXIGE R2 (de otro modo no hay de donde leer el
  // crudo que el operador coloco). Espeja ingest-run.ts (Phase 70).
  const modoLocal = opts.fromR2 != null && opts.fromR2 !== "";
  if (modoLocal && !opts.r2Store) {
    throw new Error("runIngestServel: --from-r2 requiere r2Store");
  }

  const errores: RunIngestServelResult["errores"] = [];
  const degradaciones: DegradacionDinero[] = [];
  const marcados = new Set<string>();
  const cuarentenados: string[] = [];
  let aportes = 0;
  let donantes = 0;

  for (const tarea of opts.tareas) {
    const clave = `eleccion:${tarea.eleccion}`;

    // Modo LOCAL para esta tarea: el operador coloco el `.xlsx` en R2. La fuente de bytes es R2
    // (`getObject`), NUNCA el fetch al blob. `opts.fromR2` (replay explicito) o `tarea.r2Path` (tarea
    // LOCAL) habilitan el modo; el path efectivo es el que aplique.
    const r2PathTarea = modoLocal ? opts.fromR2! : tarea.r2Path;
    const esLocal = r2PathTarea != null && r2PathTarea !== "";

    // 0. GUARDA DE FRONTERA (rule #4, WR-05): `eleccion` vacia JAMAS debe fluir a storage/marcador
    // (un slug vacio -> clave "servel/sin-eleccion/..." es un mislabel silencioso). Se exige `url` O
    // `r2Path` (una tarea LOCAL valida trae `eleccion`+`r2Path` aunque `url` este vacio). El run
    // boundary lo enforce SIEMPRE. 0 filas para esta tarea, sin tocar storage ni marcador.
    if (!tarea.eleccion?.trim() || (!tarea.url?.trim() && !esLocal)) {
      const motivo = `tarea invalida: eleccion/url vacios (eleccion='${tarea.eleccion ?? ""}', url='${tarea.url ?? ""}'); 0 filas`;
      log(`ingest-servel: ${clave} TAREA INVALIDA -> ${motivo}`);
      errores.push({ fuente: ORIGEN_DRIFT, clave, mensaje: motivo });
      degradaciones.push({ fuente: clave, motivo });
      continue;
    }

    // 1. Obtencion de bytes. LOCAL -> lee de R2 (`getObject`), 0 fetch al blob. Camino NORMAL ->
    // `descargar` (orden LOCKED dentro del conector). Bloqueada -> degradacion honesta, continue.
    let bytes: Uint8Array;
    let anclas;
    let byteLength: number;
    try {
      if (esLocal) {
        // Etapa 1 la hizo el operador (crudo YA en R2): leer los BYTES del `.xlsx` sin tocar la fuente.
        bytes = await opts.r2Store!.getObject(r2PathTarea!);
        byteLength = bytes.byteLength;
        // En modo LOCAL no hay HEAD del blob -> las anclas de completitud se derivan del crudo local
        // (md5/byte-length de los bytes leidos). La cuarentena run-level se mantiene intacta.
        anclas = {
          etag: null,
          contentMd5: md5Base64(bytes),
          lastModified: null,
          contentLength: bytes.byteLength,
        };
      } else {
        const desc = await opts.conector.descargar(tarea.url);
        bytes = desc.bytes;
        anclas = desc.anclas;
        byteLength = desc.byteLength;
      }
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

    // Etapa 1 R2 (LOCKED — "crudo PRIMERO en R2"): en el camino NORMAL (fetched), persiste los BYTES
    // del `.xlsx` content-addressed en R2 ANTES del upsert a Supabase. Espeja ingest-run.ts (Phase 70),
    // adaptado a que el crudo SERVEL son los bytes binarios del `.xlsx` (ext "xlsx"), no un envelope
    // JSON. T-71-02: si el `putImmutable` FALLA (no-412) NO se escribe el derivado — un crudo que no
    // quedo en R2 daria 404 en `--from-r2` y el derivado seria IRRECONSTRUIBLE. La eleccion se registra
    // en `errores` y se OMITE la Etapa 2; re-correr lo recupera (upserts idempotentes).
    // En modo LOCAL la Etapa 1 ya la hizo el operador (crudo YA en R2): no se re-persiste.
    if (opts.r2Store && !esLocal) {
      const sha = await sha256Hex(bytes);
      const today = fechaCorte;
      let r2Path: string;
      let existed: boolean;
      try {
        ({ r2Path, existed } = await opts.r2Store.putImmutable(
          "servel",
          tarea.eleccion,
          today,
          sha,
          "xlsx",
          bytes,
        ));
      } catch (err) {
        // Etapa-1-primero es LOCKED: sin crudo en R2, NO escribimos el derivado.
        errores.push({
          fuente: ORIGEN_DRIFT,
          clave: `${clave}#r2-etapa1`,
          mensaje: err instanceof Error ? err.message : String(err),
        });
        log(
          `ingest-servel: ERROR Etapa 1 R2 ${clave} -> se OMITE la escritura a Supabase ` +
            `(idempotente al re-correr): ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }
      if (existed) {
        // 412 = el crudo ya existia = exito idempotente. Sin novedades -> skip Etapa 2.
        log(`[skip] sin novedades — servel ${clave}`);
        continue;
      }
      log(`ingest-servel: crudo en R2 -> ${r2Path}`);
      // Registro source_snapshot (FND-08/CRON-02): best-effort, no fatal.
      if (opts.snapshotWriter) {
        try {
          await opts.snapshotWriter.write({
            source: "servel",
            resource: tarea.eleccion,
            cacheKey: sha,
            r2Path,
            contentHash: sha,
            fingerprint: sha.slice(0, 8),
            dateBucket: today,
            provenance: {
              source: "servel",
              sourceUrl: "https://repodocgastoelectoral.blob.core.windows.net",
              fetchedAt: new Date().toISOString(),
            },
          });
        } catch (snErr) {
          log(`ingest-servel: source_snapshot fallo (no fatal): ${(snErr as Error).message}`);
        }
      }
    }

    // 4. Solo si header OK Y completitud OK (y crudo en R2, en el camino normal): subirCrudo
    // (DEGRADADO a best-effort no-gate) -> reconciliar por NOMBRE -> upsert.
    try {
      // `subirCrudo` (Supabase Storage) es SECUNDARIO best-effort (decision LOCKED 71-01): corre
      // DESPUES del put R2 exitoso y su fallo NUNCA gatea ni aborta el upsert. R2 es la verdad cruda.
      if (opts.subirCrudo) {
        try {
          const key = await opts.subirCrudo(tarea.eleccion, fechaCorte, bytes);
          log(`ingest-servel: ${clave} crudo (secundario) subido -> ${key}`);
        } catch (scErr) {
          log(`ingest-servel: subirCrudo (secundario, no fatal) fallo: ${(scErr as Error).message}`);
        }
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
