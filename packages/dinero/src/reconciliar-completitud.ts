// reconciliar-completitud — reconciliacion de completitud RUN-LEVEL (sin analogo directo en dinero).
//
// FUNCION PURA. Es el corazon del drift BLOQUEANTE a nivel de RUN: el orquestador (ingest-run-servel)
// usa el resultado para poner TODA la corrida en cuarentena (0 filas, nunca un parcial silencioso).
//
// Control PRIMARIO (siempre disponible, capturado del HEAD por el conector):
//   - Content-MD5 (base64 declarado) == md5 (base64) de los bytes recibidos  -> integridad.
//   - Content-Length declarado == bytes.length recibidos                      -> completitud de descarga.
// Control SECUNDARIO (best-effort): si la fuente declara un TOTAL numerico parseable de filas, debe
//   coincidir con `parsed.length`. Si no hay TOTAL, Content-MD5 + byte-length BASTAN.
//
// Cualquier mismatch -> { ok:false, motivo }. Una descarga parcial/alterada NUNCA se lee como completa.

import type { Aporte } from "./model-servel";

/** Anclas de control capturadas del HEAD/respuesta + el conteo declarado opcional. */
export interface ControlTotal {
  /** Content-MD5 declarado por el HEAD (base64), o null si la fuente no lo expone. */
  contentMd5: string | null;
  /** Content-Length declarado por el HEAD (byte-length), o null. */
  contentLength: number | null;
  /**
   * Conteo de filas declarado por la fuente (TOTAL en la hoja), si es parseable a numero. null si la
   * fuente no lo expone -> el control secundario se omite (Content-MD5 + byte-length bastan).
   */
  declaredRowCount?: number | null;
}

/** md5 (base64) + byte-length de los bytes EFECTIVAMENTE recibidos (lo calcula el caller). */
export interface BytesRecibidos {
  /** md5 de los bytes recibidos, en base64 (para comparar contra Content-MD5). */
  md5: string;
  /** Largo en bytes de lo recibido. */
  length: number;
}

export type ResultadoCompletitud = { ok: true } | { ok: false; motivo: string };

/**
 * Reconcilia la completitud de UNA corrida (un .xlsx de eleccion). Devuelve `{ ok:true }` solo si los
 * controles disponibles cuadran; cualquier mismatch -> `{ ok:false, motivo }` (cuarentena run-level).
 *
 * - Si la fuente declara Content-MD5, DEBE coincidir con el md5 de los bytes (descarga alterada/parcial).
 * - Si la fuente declara Content-Length, DEBE coincidir con bytes.length (descarga truncada).
 * - Si la fuente declara un TOTAL numerico, DEBE coincidir con parsed.length (filas perdidas/extra).
 * - Si la fuente NO declara ninguno de los tres, no hay como verificar la completitud -> `{ ok:false }`
 *   (fail-closed honesto: sin control, se cuarentena en vez de emitir a ciegas).
 */
export function reconciliarCompletitud(
  parsed: Aporte[],
  ctrl: ControlTotal,
  bytes: BytesRecibidos,
): ResultadoCompletitud {
  let algunControl = false;

  // Control primario 1: Content-MD5 (integridad de los bytes).
  if (ctrl.contentMd5 != null && ctrl.contentMd5 !== "") {
    algunControl = true;
    if (ctrl.contentMd5 !== bytes.md5) {
      return {
        ok: false,
        motivo:
          `Content-MD5 declarado (${ctrl.contentMd5}) != md5 de los bytes recibidos (${bytes.md5}); ` +
          "descarga parcial o alterada -> cuarentena run-level",
      };
    }
  }

  // Control primario 2: Content-Length (completitud de la descarga).
  if (ctrl.contentLength != null) {
    algunControl = true;
    if (ctrl.contentLength !== bytes.length) {
      return {
        ok: false,
        motivo:
          `Content-Length declarado (${ctrl.contentLength}) != bytes recibidos (${bytes.length}); ` +
          "descarga truncada -> cuarentena run-level",
      };
    }
  }

  // Control secundario best-effort: conteo de filas declarado.
  if (ctrl.declaredRowCount != null) {
    algunControl = true;
    if (ctrl.declaredRowCount !== parsed.length) {
      return {
        ok: false,
        motivo:
          `TOTAL declarado (${ctrl.declaredRowCount} filas) != filas parseadas (${parsed.length}); ` +
          "conteo incompleto -> cuarentena run-level",
      };
    }
  }

  if (!algunControl) {
    return {
      ok: false,
      motivo:
        "sin ancla de completitud (ni Content-MD5 ni Content-Length ni TOTAL); imposible verificar " +
        "la corrida -> cuarentena run-level (fail-closed: nunca emitir a ciegas)",
    };
  }

  return { ok: true };
}
