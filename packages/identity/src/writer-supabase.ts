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

/** Filas de senadores: tienen `parlid_senado` no nulo. */
function senadoRows(rows: Parlamentario[]): Parlamentario[] {
  return rows.filter((r) => r.parlid_senado != null);
}

/** Filas de diputados: tienen `id_diputado_camara` no nulo. */
function camaraRows(rows: Parlamentario[]): Parlamentario[] {
  return rows.filter((r) => r.id_diputado_camara != null);
}

/**
 * Writer real contra Supabase local. Upsert idempotente por clave natural, partido por cámara
 * (cada índice único parcial necesita su propio `onConflict`).
 */
export class SupabaseMaestraWriter implements MaestraWriter {
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
   * Promueve a `confirmado` las filas vigentes del lote (acotado a sus claves naturales).
   * La promoción es REVISIÓN HUMANA (ID-01): solo se invoca tras el visto bueno del operador.
   * Devuelve el nº de filas promovidas por cámara.
   */
  async promoteToConfirmado(
    rows: Parlamentario[],
  ): Promise<{ senado: number; camara: number }> {
    const senadoIds = senadoRows(rows)
      .map((r) => r.parlid_senado)
      .filter((x): x is string => x != null);
    const camaraIds = camaraRows(rows)
      .map((r) => r.id_diputado_camara)
      .filter((x): x is string => x != null);

    let senado = 0;
    let camara = 0;

    if (senadoIds.length > 0) {
      const { data, error } = await this.client
        .from(this.table)
        .update({ estado: "confirmado" })
        .in("parlid_senado", senadoIds)
        .select("id");
      if (error) throw new Error(`promote senado falló: ${error.message}`);
      senado = data?.length ?? 0;
    }
    if (camaraIds.length > 0) {
      const { data, error } = await this.client
        .from(this.table)
        .update({ estado: "confirmado" })
        .in("id_diputado_camara", camaraIds)
        .select("id");
      if (error) throw new Error(`promote cámara falló: ${error.message}`);
      camara = data?.length ?? 0;
    }
    return { senado, camara };
  }
}
