/**
 * writer-entidad-supabase — impl REAL del `EntidadTerceroWriter` inyectable (ENT-05).
 *
 * ESPEJO de `writer-supabase.ts` (parlamentario) hacia `entidad_tercero`. Upsert por la clave
 * natural contra Supabase vía `@supabase/supabase-js` con la SERVICE key (bypassa la RLS
 * deny-by-default de la maestra; anon nunca lee/escribe terceros — ENT-01).
 *
 * INVARIANTE (espejo): el writer NUNCA auto-confirma. Una fila nueva nace `no_confirmado`
 * (default del DDL 0034 + `prepararSeed` del seeder); la promoción a `confirmado` es exclusiva
 * de `promoteToConfirmado` con una allow-list PRINCIPIADA de ids confirmados por
 * `matchDeterministaEntidad` (determinista) o por el revisor humano. `promoteToConfirmado([])`
 * es un no-op (nunca "promueve todo").
 *
 * Idempotencia (ENT-05): la clave natural `(tipo_entidad, nombre_normalizado)` está respaldada
 * por un índice único TOTAL en 0034/0035 que `ON CONFLICT` sí puede targetear → re-correr la
 * siembra con el mismo input no duplica (2ª corrida = 0 nuevos).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EntidadTerceroWriter, EntidadTerceroSeed } from "./seeder-entidad";

export interface SupabaseEntidadWriterOptions {
  /** URL del Supabase (local o remoto). */
  url: string;
  /** SERVICE role key (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Nombre de tabla (default: entidad_tercero). Inyectable para tests. */
  table?: string;
  /** Clave natural del ON CONFLICT (default: tipo_entidad,nombre_normalizado). */
  onConflict?: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

/** Tamaño de lote para el `in("id", ...)` de promoción (evita URLs/queries gigantes). */
const PROMOTE_CHUNK = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Writer real contra Supabase. Upsert idempotente por clave natural; nunca auto-confirma. */
export class SupabaseEntidadWriter implements EntidadTerceroWriter {
  private readonly client: SupabaseClient;
  private readonly table: string;
  private readonly onConflict: string;

  constructor(opts: SupabaseEntidadWriterOptions) {
    this.table = opts.table ?? "entidad_tercero";
    this.onConflict = opts.onConflict ?? "tipo_entidad,nombre_normalizado";
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  /**
   * Upsert por la clave natural. El writer NUNCA fija `estado='confirmado'` por su cuenta: las
   * filas llegan ya `no_confirmado` (el seeder lo fuerza) y se persisten tal cual. Lote vacío =
   * no-op.
   */
  async upsert(rows: EntidadTerceroSeed[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.client
      .from(this.table)
      .upsert(rows, { onConflict: this.onConflict, ignoreDuplicates: false });
    if (error) {
      throw new Error(`upsert entidad_tercero falló: ${error.message}`);
    }
  }

  /**
   * Promueve a `confirmado` EXACTAMENTE las filas cuyos `id` se pasan (espejo de
   * `promoteToConfirmado` de parlamentario). El caller DEBE construir `ids` de forma PRINCIPIADA
   * — solo identidades confirmadas por `matchDeterministaEntidad` (determinista) o por el revisor
   * humano. NO infiere qué promover, NUNCA confirma el lote completo, y `ids` vacío es un no-op.
   * Devuelve el nº de filas efectivamente actualizadas.
   */
  async promoteToConfirmado(ids: string[]): Promise<{ promovidos: number }> {
    const unicos = [...new Set(ids.filter((x) => x != null && x !== ""))];
    if (unicos.length === 0) return { promovidos: 0 };

    let promovidos = 0;
    for (const lote of chunk(unicos, PROMOTE_CHUNK)) {
      const { data, error } = await this.client
        .from(this.table)
        .update({ estado: "confirmado" })
        .in("id", lote)
        .select("id");
      if (error) throw new Error(`promote entidad falló: ${error.message}`);
      promovidos += data?.length ?? 0;
    }
    return { promovidos };
  }
}
