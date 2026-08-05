// SupabaseSnapshotLookup — implementación REAL de `SnapshotLookup` (@obs/ingest) contra
// `source_snapshot` (GAP-SC2/CR-01, 132-08).
//
// Por qué vive en `packages/news` y NO en `@obs/ingest` (D-132-B, LOCKED): el framework
// compartido no se toca en esta fase. `ConnectorDeps.cache` ya es un punto de inyección —
// `DailyCache` (packages/ingest/src/cache.ts) delega en cualquier `SnapshotLookup` que se le
// pase. Esta clase es esa implementación concreta, respaldada en Postgres, y vive junto al
// consumidor (news) exactamente como `SupabaseNewsWriter` (writer-supabase.ts).
//
// SEGURIDAD (T-132-29, espejo de writer-supabase.ts / snapshot-store-supabase.ts): la service
// key NUNCA se interpola ni loguea en mensajes de error. Su único uso es la factory
// `createClient(url, serviceKey)`. Los mensajes propagan solo `error.message` de PostgREST.
// B26: el project-ref de Supabase NUNCA se transcribe en este archivo — la URL viene siempre
// de opts/env, nunca hardcodeada.
//
// FALLO RUIDOSO ANTE ERROR DE DB (T-132-28, CR-01): si PostgREST devuelve `error`, esta clase
// LANZA — jamás degrada a `false`. Un `false` silencioso ante un error de DB haría que
// `DailyCache.hasToday` reporte "no hay caché" y el conector re-descargue los 5 medios
// creyendo que nunca se corrió hoy (mismo criterio que el fallo duro sin R2, T-132-17).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SnapshotLookup } from "@obs/ingest";

export interface SupabaseSnapshotLookupOptions {
  /** URL del Supabase de destino. */
  url: string;
  /** SERVICE role key (bypassa RLS deny-all de `source_snapshot`; server-side). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

export class SupabaseSnapshotLookup implements SnapshotLookup {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseSnapshotLookupOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  /**
   * true si ya existe una fila `(source, resource, date_bucket)` en `source_snapshot`.
   *
   * `.limit(1)` ANTES de `.maybeSingle()` es deliberado: el unique constraint garantiza a lo
   * más una fila, pero `.maybeSingle()` SIN `.limit(1)` lanzaría si alguna vez hubiera dos —
   * y ante esa duda queremos `true` (no re-descargar), no una excepción.
   */
  async hasSnapshot(source: string, resource: string, dateBucket: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("source_snapshot")
      .select("id")
      .eq("source", source)
      .eq("resource", resource)
      .eq("date_bucket", dateBucket)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`hasSnapshot falló: ${error.message}`);
    }
    return data != null;
  }
}
