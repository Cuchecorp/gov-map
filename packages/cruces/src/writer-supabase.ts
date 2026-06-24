/**
 * writer-supabase (@obs/cruces) — writer service-role del ETIQUETADO DE SECTOR (CRUCE-02).
 *
 * ETAPA DERIVADA SEPARADA (D-13): este writer SOLO hace `UPDATE ... set sector_id` sobre las
 * tres tablas con la columna `sector_id` (0038). NUNCA importa ni invoca la etapa-1 (LLM) — el
 * etiquetado lo calcula la etapa de clasificacion; los CLIs orquestan ambas etapas. El writer
 * es la etapa-2 pura (escritura idempotente del resultado ya calculado).
 *
 * Espeja `SupabaseFichasWriter` (packages/fichas/src/writer-supabase.ts):
 *   - `createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } })`
 *     (bypassa RLS deny-by-default de lobby_contraparte; el writer es server-side, T-36-09).
 *   - La service key JAMÁS se interpola en mensajes de error — solo `error.message` de PostgREST
 *     (que no la contiene, T-36-09).
 *   - `chunk`/`dedupePorClave` para batch UPDATE seguro (un lote no escribe dos veces la misma clave).
 *
 * Env-driven (SUPABASE_URL + SUPABASE_SECRET_KEY); remoto = paso de operador (Plan 04 LIVE).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SectorCodigo } from "./sector";

/** Un sector asignado a una fila, o `null` (abstención = honest no-match, D-05/D-08). */
export type SectorAsignado = SectorCodigo | null;

/** UPDATE de sector de un PROYECTO (proyecto_ficha, keyed por boletín). */
export interface ActualizacionFicha {
  boletin: string;
  sector_id: SectorAsignado;
}

/**
 * UPDATE de sector de una CONTRAPARTE de lobby (lobby_contraparte). La clave natural es
 * (identificador, nombre, rol) — usamos (identificador, nombre) para acotar la fila; `rol`
 * es opcional para desambiguar cuando una contraparte aparece con varios roles.
 */
export interface ActualizacionContraparte {
  identificador: string;
  nombre: string;
  rol?: string;
  sector_id: SectorAsignado;
}

export interface SupabaseCrucesWriterOptions {
  /** URL de Supabase (de SUPABASE_URL; nunca hardcodear puertos). */
  url: string;
  /** SERVICE/SECRET key (bypassa RLS deny-by-default; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

/** Lote de actualización para evitar fan-out de requests gigante. */
const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * De-duplica por una clave (last-write-wins), preservando el orden de la última aparición.
 * Defensa-en-profundidad: un lote no emite dos UPDATE para la misma fila (último gana).
 */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

/**
 * Writer service-role del etiquetado de sector. Etapa DERIVADA pura: SOLO UPDATE de sector_id;
 * jamás invoca el LLM (D-13). El sector ya viene calculado por la etapa-1 de clasificacion.
 */
export class SupabaseCrucesWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseCrucesWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  /**
   * Actualiza el `sector_id` de un proyecto (proyecto_ficha) por su boletín (PK 1:1).
   * `null` escribe explícitamente NULL = honest no-match (D-05). T-36-09: solo error.message.
   */
  async actualizarSectorFicha(
    boletin: string,
    sector_id: SectorAsignado,
  ): Promise<void> {
    const { error } = await this.client
      .from("proyecto_ficha")
      .update({ sector_id })
      .eq("boletin", boletin);
    if (error) throw new Error(`actualizarSectorFicha falló: ${error.message}`);
  }

  /**
   * Actualiza el `sector_id` de una contraparte de lobby (lobby_contraparte) por su clave
   * natural (identificador, nombre[, rol]). `null` escribe NULL = honest no-match (D-05).
   */
  async actualizarSectorContraparte(
    identificador: string,
    nombre: string,
    sector_id: SectorAsignado,
    rol?: string,
  ): Promise<void> {
    let query = this.client
      .from("lobby_contraparte")
      .update({ sector_id })
      .eq("identificador", identificador)
      .eq("nombre", nombre);
    if (rol !== undefined) query = query.eq("rol", rol);
    const { error } = await query;
    if (error) {
      throw new Error(`actualizarSectorContraparte falló: ${error.message}`);
    }
  }

  /** UPDATE en lote de fichas (de-dup por boletín; chunked). */
  async actualizarSectoresFicha(filas: ActualizacionFicha[]): Promise<void> {
    if (filas.length === 0) return;
    const deduped = dedupePorClave(filas, (f) => f.boletin);
    for (const lote of chunk(deduped, CHUNK)) {
      for (const f of lote) {
        await this.actualizarSectorFicha(f.boletin, f.sector_id);
      }
    }
  }

  /** UPDATE en lote de contrapartes (de-dup por clave natural; chunked). */
  async actualizarSectoresContraparte(
    filas: ActualizacionContraparte[],
  ): Promise<void> {
    if (filas.length === 0) return;
    const deduped = dedupePorClave(
      filas,
      (f) => `${f.identificador}::${f.nombre}::${f.rol ?? ""}`,
    );
    for (const lote of chunk(deduped, CHUNK)) {
      for (const f of lote) {
        await this.actualizarSectorContraparte(
          f.identificador,
          f.nombre,
          f.sector_id,
          f.rol,
        );
      }
    }
  }
}

/** Contrato mínimo que los CLIs consumen (real = SupabaseCrucesWriter; tests = espía). */
export interface CrucesWriter {
  actualizarSectorFicha(boletin: string, sector_id: SectorAsignado): Promise<void>;
  actualizarSectorContraparte(
    identificador: string,
    nombre: string,
    sector_id: SectorAsignado,
    rol?: string,
  ): Promise<void>;
}
