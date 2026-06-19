/**
 * backfill-rut — completa (backfill) el `rut` interno de la maestra de parlamentarios (IDENT-10).
 *
 * HALLAZGO DECISIVO del research (verificado en vivo 2026-06-18): NINGÚN catálogo oficial del
 * Congreso expone el RUT (Senado `senadores_vigentes.php` no lo trae; Cámara `WSDiputado` lo trae
 * VACÍO). Por eso el RUT entra por DOS tracks:
 *   - Track A: spike SERVEL/electoral (frágil; un RUT matcheado por NOMBRE es un CANDIDATO, no un
 *     hecho — solo cuenta como determinista contra el propio RUT de la fila maestra).
 *   - Track B: lista curada server-side `supabase/seeds/parlamentario-rut.seed.json` con provenance
 *     por fila (fallback GARANTIZADO y default seguro).
 *
 * REGLA LOCKED — NUNCA se fabrica un RUT: cada RUT crudo se DV-valida con `isRutValido` (módulo-11,
 * REUSADO de @obs/identity — no se reimplementa) ANTES de escribir. Un RUT inválido (o sin
 * provenance, que `0005` exige NOT NULL) se rechaza a un log de revisión y NUNCA llega al writer.
 *
 * El RUT es PII interna (`parlamentario.rut`, RLS deny-by-default): nunca a una tabla pública,
 * nunca a un LLM.
 */

import { isRutValido, normRut } from "./deterministic";

/** Una fila cruda de la fuente de RUT (Track A SERVEL o Track B curada). */
export interface FilaRutCruda {
  /** id de la maestra (PK estable) a la que pertenece el RUT. */
  id: string;
  /** RUT crudo (con o sin puntos/guión); se DV-valida y normaliza antes de escribir. */
  rut: string;
  /** Provenance OBLIGATORIA (0005 NOT NULL): fuente de origen del RUT. */
  origen: string;
  /** Provenance: ISO de captura. */
  fecha_captura: string;
  /** Provenance: enlace a la fuente donde se leyó el RUT. */
  enlace: string;
}

/** Fila lista para escribir: RUT ya normalizado + provenance. */
export interface FilaRutEscribir {
  id: string;
  rut: string;
  origen: string;
  fecha_captura: string;
  enlace: string;
}

/** Razón por la que una fila cruda se rechaza (nunca se escribe). */
export type RazonRechazo = "dv-invalido" | "provenance-faltante";

/** Resultado de evaluar una fila cruda. */
export type ResultadoAceptacion =
  | { ok: true; fila: FilaRutEscribir }
  | { ok: false; id: string; razon: RazonRechazo };

/** Una fila rechazada (va al log de revisión, NUNCA a la DB). */
export interface FilaRechazada {
  id: string;
  razon: RazonRechazo;
}

/** Writer del backfill: actualiza solo `rut`+provenance por `id`. */
export interface RutBackfillWriter {
  updateRut(rows: FilaRutEscribir[]): Promise<{ actualizadas: number }>;
}

/**
 * Decide si una fila cruda es ESCRIBIBLE (función PURA, sin red ni DB):
 *   (a) provenance presente y no vacía (origen/fecha_captura/enlace) — 0005 exige NOT NULL;
 *   (b) RUT DV-válido vía `isRutValido` (módulo-11, REUSADO);
 *   (c) si inválido/sin provenance → rechazo a revisión (NUNCA se fabrica/escribe);
 *   (d) si válido → fila con `normRut` aplicado, lista para `updateRut`.
 */
export function aceptarRutBackfill(fila: FilaRutCruda): ResultadoAceptacion {
  const id = fila?.id;
  // (a) provenance NOT NULL — un string vacío NO satisface NOT NULL semánticamente.
  const provenanceOk =
    typeof fila?.origen === "string" && fila.origen.trim() !== "" &&
    typeof fila?.fecha_captura === "string" && fila.fecha_captura.trim() !== "" &&
    typeof fila?.enlace === "string" && fila.enlace.trim() !== "";
  if (!provenanceOk) {
    return { ok: false, id, razon: "provenance-faltante" };
  }
  // (b) DV módulo-11 — REUSA isRutValido (Don't Hand-Roll). Inválido → revisión, NUNCA escribir.
  if (typeof fila.rut !== "string" || !isRutValido(fila.rut)) {
    return { ok: false, id, razon: "dv-invalido" };
  }
  // (d) válido → normalizado para almacenar/comparar (normRut).
  return {
    ok: true,
    fila: {
      id,
      rut: normRut(fila.rut),
      origen: fila.origen,
      fecha_captura: fila.fecha_captura,
      enlace: fila.enlace,
    },
  };
}

/** Resultado de una corrida de backfill. */
export interface ResultadoBackfill {
  /** Nº de filas efectivamente escritas (RUT DV-válido + provenance). */
  escritas: number;
  /** Filas rechazadas (DV inválido o provenance faltante) — log de revisión. */
  rechazadas: FilaRechazada[];
}

/**
 * Orquesta el backfill: filtra las filas escribibles (DV-válidas + provenance), llama a
 * `writer.updateRut` SOLO con esas, y devuelve `{ escritas, rechazadas }`. Idempotente: el
 * update por `id` es no-op la 2.ª vez (mismas escrituras para la misma lista). Una fila
 * rechazada NUNCA se pasa al writer (NUNCA se fabrica un RUT).
 */
export async function runBackfillRut(
  filas: FilaRutCruda[],
  writer: RutBackfillWriter,
): Promise<ResultadoBackfill> {
  const escribibles: FilaRutEscribir[] = [];
  const rechazadas: FilaRechazada[] = [];

  for (const fila of filas) {
    const r = aceptarRutBackfill(fila);
    if (r.ok) escribibles.push(r.fila);
    else rechazadas.push({ id: r.id, razon: r.razon });
  }

  let escritas = 0;
  if (escribibles.length > 0) {
    const { actualizadas } = await writer.updateRut(escribibles);
    escritas = actualizadas;
  }

  return { escritas, rechazadas };
}
