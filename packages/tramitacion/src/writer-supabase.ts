// writer-supabase — impl REAL del `TramitacionWriter` contra el Supabase LOCAL.
//
// Espeja `SupabaseMaestraWriter` (packages/identity/src/writer-supabase.ts): `createClient`
// con la SERVICE key local (bypassa RLS public-read; el writer es server-side, T-05-13) y
// `upsert(filas, { onConflict: '<clave natural>' })` idempotente por la clave natural de
// migración 0008:
//   * proyecto            → onConflict 'boletin' (PK)
//   * votacion            → onConflict 'id' (PK)
//   * voto                → onConflict 'votacion_id,mencion_nombre' (unique)
//   * tramitacion_evento  → onConflict 'boletin,fecha,camara,tipo,descripcion' (unique)
//
// La service key NUNCA se interpola en mensajes de error (solo se propaga `error.message` de
// PostgREST, que no la contiene). Apunta SIEMPRE al LOCAL; remoto/R2 = pasos de operador
// diferidos por credencial.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TramitacionWriter } from "./writer";
import type { Proyecto, Votacion, Voto, TramitacionEvento } from "./model";

export interface SupabaseTramitacionWriterOptions {
  /** URL del Supabase LOCAL (p.ej. http://127.0.0.1:54421). */
  url: string;
  /** SERVICE role key LOCAL (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

/** Lote de inserción para evitar payloads gigantes en una sola llamada. */
const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export class SupabaseTramitacionWriter implements TramitacionWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseTramitacionWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertProyecto(proyecto: Proyecto): Promise<void> {
    const { error } = await this.client
      .from("proyecto")
      .upsert(proyecto, { onConflict: "boletin", ignoreDuplicates: false });
    if (error) throw new Error(`upsert proyecto falló: ${error.message}`);
  }

  async upsertVotacion(votaciones: Votacion[]): Promise<void> {
    if (votaciones.length === 0) return;
    for (const lote of chunk(votaciones, CHUNK)) {
      const { error } = await this.client
        .from("votacion")
        .upsert(lote, { onConflict: "id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert votacion falló: ${error.message}`);
    }
  }

  async upsertVotos(votos: Voto[]): Promise<void> {
    if (votos.length === 0) return;
    for (const lote of chunk(votos, CHUNK)) {
      const { error } = await this.client
        .from("voto")
        .upsert(lote, {
          onConflict: "votacion_id,mencion_nombre",
          ignoreDuplicates: false,
        });
      if (error) throw new Error(`upsert voto falló: ${error.message}`);
    }
  }

  async upsertEventos(eventos: TramitacionEvento[]): Promise<void> {
    if (eventos.length === 0) return;
    for (const lote of chunk(eventos, CHUNK)) {
      const { error } = await this.client
        .from("tramitacion_evento")
        .upsert(lote, {
          onConflict: "boletin,fecha,camara,tipo,descripcion",
          ignoreDuplicates: false,
        });
      if (error) throw new Error(`upsert tramitacion_evento falló: ${error.message}`);
    }
  }
}
