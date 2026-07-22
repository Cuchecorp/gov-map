// writer-supabase — impl REAL del `BioWriter` contra Supabase (remoto/local).
//
// Espeja `SupabaseLobbyWriter`: `createClient` con la SERVICE key (bypassa RLS; server-side) y
// `upsert(filas, { onConflict })` idempotente por la clave natural de la migración 0059:
//   * parlamentario_bio        → onConflict 'parlamentario_id'
//   * parlamentario_militancia → onConflict 'parlamentario_id,partido_alias,desde'
//   * comision                 → onConflict 'nombre,camara'  (retorna id asignado)
//   * comision_membresia       → onConflict 'comision_id,parlamentario_id'
//   * parlamentario            → UPDATE partido + fecha_captura (militancia actual)
//
// La service key NUNCA se interpola en mensajes de error (solo `error.message` de PostgREST, que
// no la contiene — T-90-KEY). Se de-duplica por la clave de conflicto ANTES del lote (Postgres
// aborta un lote con dos filas de la misma clave). Chunk de 500.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BioParlamentario, Militancia, Comision, ComisionMembresia } from "./model";
import type { BioWriter, PartidoUpdate } from "./writer";
import { comisionKey, militanciaKey, membresiaKey } from "./writer";

export interface SupabaseBioWriterOptions {
  /** URL de Supabase (remoto sa-east-1 o local). */
  url: string;
  /** SERVICE role key (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** De-duplica por clave (last-write-wins), preservando el orden de la última aparición. */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

function bioRow(f: BioParlamentario): Record<string, unknown> {
  return {
    parlamentario_id: f.parlamentarioId,
    profesion: f.profesion,
    origen: f.origen,
    fecha_captura: f.fechaCaptura,
    enlace: f.enlace,
  };
}

function militanciaRow(f: Militancia): Record<string, unknown> {
  return {
    parlamentario_id: f.parlamentarioId,
    partido: f.partido,
    partido_alias: f.partidoAlias,
    desde: f.desde,
    hasta: f.hasta,
    es_actual: f.esActual,
    origen: f.origen,
    fecha_captura: f.fechaCaptura,
    enlace: f.enlace,
  };
}

function comisionRow(f: Comision): Record<string, unknown> {
  return {
    nombre: f.nombre,
    camara: f.camara,
    tipo: f.tipo,
    origen: f.origen,
    fecha_captura: f.fechaCaptura,
    enlace: f.enlace,
  };
}

export class SupabaseBioWriter implements BioWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseBioWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertBio(filas: BioParlamentario[]): Promise<void> {
    if (filas.length === 0) return;
    const dedup = dedupePorClave(filas, (f) => f.parlamentarioId);
    for (const lote of chunk(dedup.map(bioRow), CHUNK)) {
      const { error } = await this.client
        .from("parlamentario_bio")
        .upsert(lote, { onConflict: "parlamentario_id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert parlamentario_bio falló: ${error.message}`);
    }
  }

  async upsertMilitancias(filas: Militancia[]): Promise<void> {
    if (filas.length === 0) return;
    const dedup = dedupePorClave(filas, (f) =>
      militanciaKey(f.parlamentarioId, f.partidoAlias, f.desde),
    );
    for (const lote of chunk(dedup.map(militanciaRow), CHUNK)) {
      const { error } = await this.client
        .from("parlamentario_militancia")
        .upsert(lote, { onConflict: "parlamentario_id,partido_alias,desde", ignoreDuplicates: false });
      if (error) throw new Error(`upsert parlamentario_militancia falló: ${error.message}`);
    }
  }

  async upsertComisiones(filas: Comision[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (filas.length === 0) return map;
    const dedup = dedupePorClave(filas, (f) => comisionKey(f.nombre, f.camara));
    for (const lote of chunk(dedup.map(comisionRow), CHUNK)) {
      const { data, error } = await this.client
        .from("comision")
        .upsert(lote, { onConflict: "nombre,camara", ignoreDuplicates: false })
        .select("id, nombre, camara");
      if (error) throw new Error(`upsert comision falló: ${error.message}`);
      for (const row of (data ?? []) as { id: string; nombre: string; camara: string }[]) {
        map.set(comisionKey(row.nombre, row.camara), String(row.id));
      }
    }
    return map;
  }

  async upsertMembresias(filas: ComisionMembresia[]): Promise<void> {
    if (filas.length === 0) return;
    const dedup = dedupePorClave(filas, (f) => membresiaKey(f.comisionId, f.parlamentarioId));
    const rows = dedup.map((f) => ({
      comision_id: f.comisionId,
      parlamentario_id: f.parlamentarioId,
      cargo: f.cargo,
      origen: f.origen,
      fecha_captura: f.fechaCaptura,
      enlace: f.enlace,
    }));
    for (const lote of chunk(rows, CHUNK)) {
      const { error } = await this.client
        .from("comision_membresia")
        .upsert(lote, { onConflict: "comision_id,parlamentario_id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert comision_membresia falló: ${error.message}`);
    }
  }

  async actualizarPartidoParlamentario(updates: PartidoUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    const dedup = dedupePorClave(updates, (u) => u.parlamentarioId);
    // UPDATE por fila (partido depende del id); PostgREST no hace bulk-update heterogéneo.
    for (const u of dedup) {
      const { error } = await this.client
        .from("parlamentario")
        .update({ partido: u.partido, fecha_captura: u.fechaCaptura })
        .eq("id", u.parlamentarioId);
      if (error) throw new Error(`update parlamentario.partido falló: ${error.message}`);
    }
  }
}
