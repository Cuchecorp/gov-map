/**
 * writer-supabase — impl REAL del `MaestraWriter` inyectable (Plan 03 lo dejó como interfaz).
 *
 * Hace upsert por CLAVE NATURAL contra el Supabase LOCAL (docker, Fases 1-2) vía
 * `@supabase/supabase-js` con la SERVICE key local (bypassa RLS deny-by-default, como
 * corresponde al worker/CI; anon nunca lee/escribe la maestra — T-03-04).
 *
 * Idempotencia (T-03-06): la clave natural por cámara (`parlid_senado`/`id_diputado_camara`)
 * está respaldada por índices únicos PARCIALES (`where ... is not null`). PostgREST/`ON CONFLICT`
 * NO puede targetear un índice parcial por lista de columnas (requiere el predicado), por lo que
 * el upsert se hace sobre la PRIMARY KEY `id`, que es DERIVADA de la clave natural y por tanto
 * estable y determinista: `S{parlid_senado}` para senadores, `D{id_diputado_camara}` para
 * diputados (ver parse-senado/parse-camara). Re-correr la siembra con el mismo input produce los
 * mismos `id` → upsert por `id` no duplica (misma idempotencia que la clave natural, pero contra
 * un índice único TOTAL que `ON CONFLICT` sí puede targetear). Los índices parciales de la clave
 * natural siguen garantizando que dos `id` distintos no puedan colisionar en la misma clave.
 *
 * Credenciales (CONTEXT): apunta SIEMPRE al LOCAL (URL 544xx + service key local). El push al
 * Supabase REMOTO es un paso de operador diferido (service key API ≠ PAT `sbp_`; sin DB
 * password en `.env` apto para `db push`).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Parlamentario } from "@obs/core";
import type { MaestraWriter } from "./seeder";
import type { FilaRutEscribir, RutBackfillWriter } from "./backfill-rut";

export interface SupabaseMaestraWriterOptions {
  /** URL del Supabase LOCAL (p.ej. http://127.0.0.1:54421). */
  url: string;
  /** SERVICE role key LOCAL (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Nombre de tabla (default: parlamentario). Inyectable para tests. */
  table?: string;
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

/**
 * Writer real contra Supabase local. Upsert idempotente por clave natural, partido por cámara
 * (cada índice único parcial necesita su propio `onConflict`).
 */
export class SupabaseMaestraWriter implements MaestraWriter, RutBackfillWriter {
  private readonly client: SupabaseClient;
  private readonly table: string;

  constructor(opts: SupabaseMaestraWriterOptions) {
    this.table =
      opts.table ?? "parlamentario";
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsert(rows: Parlamentario[]): Promise<void> {
    if (rows.length === 0) return;
    // Upsert por la PK `id` (derivada de la clave natural → estable/determinista). Un único
    // call cubre ambas cámaras; `id` tiene índice único TOTAL que `ON CONFLICT` sí targetea.
    const { error } = await this.client
      .from(this.table)
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false });
    if (error) {
      throw new Error(`upsert maestra falló: ${error.message}`);
    }
  }

  /**
   * Promueve a `confirmado` EXACTAMENTE las filas cuyos `id` se pasan en `ids` (CR-01).
   *
   * El caller (seed-cli) DEBE construir `ids` de forma PRINCIPIADA — solo identidades
   * confirmadas por una de las dos fuentes legítimas:
   *   (a) la regla seed-from-authoritative-vigentes-catalog (`vigentesDeCatalogo`), o
   *   (b) la reconciliación que devolvió `confirmado` (`reconciliarMaestra`).
   * Esta función NO infiere qué promover: NO toca filas fuera de `ids`, NUNCA confirma el
   * lote completo, y promueve por la PK ESTABLE `id` (no por clave natural en IN-lists que
   * podrían sobre-emparejar). Devuelve el nº de filas efectivamente actualizadas.
   *
   * `ids` vacío es un no-op (0 promovidas) — nunca un "promueve todo".
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
      if (error) throw new Error(`promote falló: ${error.message}`);
      promovidos += data?.length ?? 0;
    }
    return { promovidos };
  }

  /**
   * Backfill del `rut` interno (IDENT-10): actualiza SOLO `rut`+provenance de las filas cuyos
   * `id` se pasan. Espeja `promoteToConfirmado` (update por PK estable `id`, sin tocar nada
   * fuera del lote), pero cada fila lleva SU PROPIO `rut`/provenance, así que el update es
   * POR FILA (`.update({...}).eq("id", ...)`) — un `.in("id", lote)` fijaría el mismo valor a
   * todo el lote, lo que sería incorrecto. El lote acota la concurrencia/IO.
   *
   * El caller (`runBackfillRut`) ya DV-validó cada RUT (`isRutValido`) y exigió provenance: este
   * método NO fabrica ni valida RUT, solo persiste lo que el gate ya aprobó. Idempotente:
   * re-escribir el mismo `rut`+provenance por `id` es un no-op semántico.
   *
   * `rows` vacío es un no-op (0 actualizadas).
   */
  async updateRut(rows: FilaRutEscribir[]): Promise<{ actualizadas: number }> {
    const validas = rows.filter((r) => r != null && r.id !== "");
    if (validas.length === 0) return { actualizadas: 0 };

    let actualizadas = 0;
    for (const lote of chunk(validas, PROMOTE_CHUNK)) {
      for (const fila of lote) {
        const { data, error } = await this.client
          .from(this.table)
          .update({
            rut: fila.rut,
            origen: fila.origen,
            fecha_captura: fila.fecha_captura,
            enlace: fila.enlace,
          })
          .eq("id", fila.id)
          .select("id");
        if (error) throw new Error(`updateRut falló (id=${fila.id}): ${error.message}`);
        actualizadas += data?.length ?? 0;
      }
    }
    return { actualizadas };
  }
}
