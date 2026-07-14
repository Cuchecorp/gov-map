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
 * DEFENSA DURABLE (RUT-01, CR-01): el gate DV+provenance no es solo runtime. El input del writer
 * (`RutBackfillWriter.updateRut`) es el tipo BRANDED `FilaRutCorroborada` (ver `rut-corroborado.ts`),
 * minteado SOLO por `corroborarRutFila` (el gate). Un RUT derivado por NOMBRE — un objeto plano, un
 * string, un `CandidatoRevisionRut` — NO satisface ese tipo, así que el COMPILADOR (no un regex)
 * rechaza que llegue al writer. Ésta es la defensa que un guard estático de texto no puede dar.
 *
 * El RUT es PII interna (`parlamentario.rut`, RLS deny-by-default): nunca a una tabla pública,
 * nunca a un LLM.
 */

import {
  corroborarRutFila,
  type FilaRutCandidata,
  type FilaRutCorroborada,
  type RazonRechazoRut,
  type ResultadoCorroboracion,
} from "./rut-corroborado";

/**
 * Una fila cruda de la fuente de RUT (Track A SERVEL o Track B curada). Alias de
 * `FilaRutCandidata` (el input SIN la marca de `corroborarRutFila`). Un RUT crudo aquí
 * es DV-validado + provenance-gated ANTES de obtener la marca escribible.
 */
export type FilaRutCruda = FilaRutCandidata;

/**
 * Fila lista para escribir: RUT ya normalizado + provenance + la MARCA BRANDED
 * (`FilaRutCorroborada`). CAMBIO CR-01 (RUT-01): antes era un objeto plano
 * `{ id; rut; ... }` que cualquier caller podía fabricar (un RUT name-only podía llegar
 * al writer con un simple objeto literal). Ahora es el tipo NOMINAL minteado SOLO por
 * `corroborarRutFila` (el DV-gate). El writer (`updateRut`) tipa su input como este tipo
 * → el compilador RECHAZA un string desnudo / un `CandidatoRevisionRut` (name-only) /
 * un objeto imitado (ver `rut-corroborado.test-d.ts`). El regex del guard estático era
 * evadible por aliasing; este tipo NO lo es.
 */
export type FilaRutEscribir = FilaRutCorroborada;

/** Razón por la que una fila cruda se rechaza (nunca se escribe). */
export type RazonRechazo = RazonRechazoRut;

/** Resultado de evaluar una fila cruda. */
export type ResultadoAceptacion = ResultadoCorroboracion;

/** Una fila rechazada (va al log de revisión, NUNCA a la DB). */
export interface FilaRechazada {
  id: string;
  razon: RazonRechazo;
}

/**
 * Writer del backfill: actualiza solo `rut`+provenance por `id`. Su input es el tipo
 * BRANDED `FilaRutCorroborada[]` (RUT-01): un objeto plano / string / candidato name-only
 * NO lo satisface → el COMPILADOR rechaza cualquier RUT que no pasó `corroborarRutFila`.
 */
export interface RutBackfillWriter {
  updateRut(rows: FilaRutEscribir[]): Promise<{ actualizadas: number }>;
}

/**
 * Decide si una fila cruda es ESCRIBIBLE (función PURA, sin red ni DB). DELEGA en
 * `corroborarRutFila` (la ÚNICA factory del branded type), que aplica:
 *   (a) provenance presente y no vacía (origen/fecha_captura/enlace) — 0005 exige NOT NULL;
 *   (b) RUT DV-válido vía `isRutValido` (módulo-11, REUSADO);
 *   (c) si inválido/sin provenance → rechazo a revisión (NUNCA se fabrica/escribe);
 *   (d) si válido → `FilaRutCorroborada` (branded) con `normRut` aplicado, lista para
 *       `updateRut`. Ésta es la ÚNICA vía a un valor escribible: sin ella no hay marca.
 */
export function aceptarRutBackfill(fila: FilaRutCruda): ResultadoAceptacion {
  return corroborarRutFila(fila);
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
