// harvest-rut — writer path de COSECHA de RUT (IDENT-10). Escribe el RUT COSECHADO al `rut` de la
// maestra de parlamentarios SOLO para enlaces persona-natural CONFIRMADOS (ver reconciliar-contrato.ts:
// el `rutProveedor` DV-valido de ChileCompra de un proveedor persona-natural confirmado ES el RUT del
// parlamentario enlazado).
//
// REUSO, NO REIMPLEMENTACION: delega en `runBackfillRut` de @obs/identity, que re-aplica el DV-gate
// (`isRutValido`, modulo-11) + provenance NOT NULL + fail-closed a log de revision. NUNCA se fabrica
// un RUT: una fila DV-invalida (defensivo; no deberia ocurrir porque reconciliar-contrato ya valido) o
// sin provenance es RECHAZADA por `aceptarRutBackfill` y NUNCA llega a `writer.updateRut`.
//
// CHECKPOINT DE OPERADOR: el `RutBackfillWriter` real (updateRut contra la maestra REMOTA via Supabase
// db-url) es deuda de operador (MEMORY: write DB remoto solo via db push --db-url). En este paquete se
// CONSTRUYE y TESTEA el path con un writer espia in-memory; la corrida LIVE con el writer Supabase real
// la dispara el operador. Sin esa accion de operador, nada se escribe a la maestra remota (fail-closed).

import {
  runBackfillRut,
  type FilaRutCruda,
  type RutBackfillWriter,
  type ResultadoBackfill,
} from "@obs/identity";

import type { CandidatoCosechaRut } from "./reconciliar-contrato";

/**
 * Mapea los candidatos de cosecha a las filas crudas del backfill (funcion PURA). La validacion
 * DV + provenance NOT NULL la hace `runBackfillRut` aguas abajo (reuso, NO reimplementacion).
 */
export function construirFilasCosecha(cosechas: CandidatoCosechaRut[]): FilaRutCruda[] {
  return cosechas.map((c) => ({
    id: c.parlamentarioId,
    rut: c.rutHarvested,
    origen: c.provenance.origen,
    fecha_captura: c.provenance.fecha_captura,
    enlace: c.provenance.enlace,
  }));
}

/**
 * Corre la cosecha de RUT: construye las filas crudas y delega en `runBackfillRut` (DV-gate +
 * provenance NOT NULL + fail-closed). Idempotente (el update por `id` es no-op la 2.a vez). Una fila
 * DV-invalida o sin provenance es RECHAZADA, NUNCA escrita. La escritura remota es checkpoint de operador.
 */
export async function runHarvestRut(
  cosechas: CandidatoCosechaRut[],
  writer: RutBackfillWriter,
): Promise<ResultadoBackfill> {
  return runBackfillRut(construirFilasCosecha(cosechas), writer);
}
