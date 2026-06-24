/**
 * seeder-entidad — siembra idempotente de la maestra `entidad_tercero` (ENT-05).
 *
 * ESPEJO de `seeder.ts` (parlamentario) hacia terceros. La idempotencia vive en la CLAVE
 * NATURAL del upsert (no en una caché de día): re-correr con el mismo input deja el mismo
 * estado (0 entidades nuevas en la 2ª corrida — criterio ENT-05).
 *
 * El `estado` inicial es `no_confirmado`: el seeder NUNCA auto-confirma un lote sembrado. La
 * promoción a `confirmado` es exclusiva de `matchDeterministaEntidad` (determinista) o del
 * revisor humano vía RPC (Plan 03/04). Como las contrapartes de lobby no traen RUT y un nombre
 * puede repetirse, fail-closed deja casi todo en `no_confirmado`.
 */

import type { EntidadTerceroRow } from "./deterministic-entidad";

/**
 * Fila de `entidad_tercero` a sembrar. Espeja `EntidadTerceroRow` (clave de match) + provenance
 * obligatoria (NOT NULL en el DDL 0034). El `id` puede venir vacío para filas nuevas cuyo id lo
 * asigna la sequence `entidad_id_seq` en DB; la clave natural del upsert es `rut` (donde no nulo)
 * o `(tipo_entidad, nombre_normalizado)`.
 */
export interface EntidadTerceroSeed extends EntidadTerceroRow {
  /** Estado de identidad. El seeder lo fuerza a 'no_confirmado' (nunca auto-confirma). */
  estado: "confirmado" | "probable" | "no_confirmado";
  /** Provenance inline (NOT NULL en 0034). */
  origen: string;
  fecha_captura: string;
  enlace: string;
}

/** Writer inyectable: upsert por clave natural. El writer real (Supabase) lo cablea Plan 04. */
export interface EntidadTerceroWriter {
  upsert(rows: EntidadTerceroSeed[]): Promise<void>;
}

/**
 * Normaliza el lote antes de sembrar: fuerza `estado='no_confirmado'` (ID-01 espejo — el seeder
 * NUNCA auto-confirma; la promoción es un paso explícito posterior). PURA: no muta el input.
 */
export function prepararSeed(rows: EntidadTerceroSeed[]): EntidadTerceroSeed[] {
  return rows.map((row) => ({ ...row, estado: "no_confirmado" as const }));
}

/**
 * Upsert idempotente por clave natural. Correr 2× con el mismo input deja el mismo estado
 * (el writer hace upsert por la clave natural, no insert) → ENT-05 "2ª corrida = 0 nuevos".
 * Fuerza el estado inicial a `no_confirmado` por construcción antes de persistir.
 */
export async function upsertEntidades(
  rows: EntidadTerceroSeed[],
  writer: EntidadTerceroWriter,
): Promise<void> {
  await writer.upsert(prepararSeed(rows));
}
