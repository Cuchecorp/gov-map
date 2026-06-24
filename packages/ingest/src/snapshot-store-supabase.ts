/**
 * SupabaseSnapshotStore — implementación Node-side de `SnapshotStore` (INGEST-04).
 *
 * Puerto del único `SnapshotStore` concreto del repo, que vivía inline en el worker
 * Deno (`supabase/functions/ingest-worker/worker.ts` L197–228). Los CLIs de ingesta
 * corren en Node/tsx, no Deno, así que no podían reusar esa lógica. Este helper la
 * porta VERBATIM: el `.insert(row).select("id").single()` + el manejo idempotente de
 * la violación de unique (source,resource,date_bucket) → código `23505`.
 *
 * IDEMPOTENCIA (WR-02): un re-insert el mismo día (otra corrida ya capturó el snapshot)
 * dispara 23505 → se lee la fila existente por su clave natural y se devuelve su id.
 * No es un fallo de job: la caché diaria garantiza una sola fila por (source,resource,
 * date_bucket). Si el SELECT de recuperación no encuentra la fila (carrera extrema,
 * borrado out-of-band), se lanza un Error RETRYABLE explícito (#40) — nunca se cae a
 * `undefined`/TypeError; el reintento del job reinserta limpiamente.
 *
 * SEGURIDAD (T-34-01): la service key NUNCA se interpola ni loguea en mensajes de error.
 * Su único uso es la factory `createClient(url, serviceKey)`. Los mensajes propagan solo
 * `error.message` de PostgREST (que no contiene la key), espejo de `writer-supabase.ts`.
 *
 * DESACOPLE (T-34-SC, Cero dependencias nuevas): `@obs/ingest` no declara
 * `@supabase/supabase-js`. El consumidor (probidad, Plan 02 — que ya tiene la lib) inyecta
 * un `client` ya armado o su factory `createClient`. En tests se inyecta un mock estructural.
 */

import type { SnapshotStore } from "./snapshot";

/**
 * Subconjunto estructural del cliente supabase-js que toca `insertSnapshot`.
 * Tipar estructuralmente evita que `@obs/ingest` dependa de `@supabase/supabase-js`
 * en el camino de test (el cliente real se inyecta, o se construye vía dynamic import
 * en el consumidor —probidad— que ya tiene la dependencia).
 */
export interface SupabaseClientLike {
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(cols: string): {
        single(): Promise<{ data: { id: number } | null; error: { code?: string; message: string } | null }>;
      };
    };
    select(cols: string): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): {
          eq(col: string, val: unknown): {
            maybeSingle(): Promise<{ data: { id: number } | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
}

/**
 * Factory inyectable de cliente supabase-js (espejo de la firma de `createClient`).
 * `@obs/ingest` NO declara `@supabase/supabase-js` (Cero dependencias nuevas, T-34-SC):
 * el consumidor —probidad, Plan 02— que ya tiene la dependencia pasa su `createClient`,
 * o directamente un `client` pre-construido. Mantiene a ingest desacoplado de la lib.
 */
export type CreateSupabaseClient = (url: string, serviceKey: string) => SupabaseClientLike;

export interface SupabaseSnapshotStoreOptions {
  /** URL de Supabase (remoto sa-east-1 o local). */
  url: string;
  /** SERVICE role key (bypassa el deny-by-default RLS de source_snapshot; server-side). */
  serviceKey: string;
  /** Cliente pre-construido (tests, o consumidor que ya tiene supabase-js). */
  client?: SupabaseClientLike;
  /** Factory `createClient` del consumidor (cuando no se pasa un `client` ya armado). */
  createClient?: CreateSupabaseClient;
}

export class SupabaseSnapshotStore implements SnapshotStore {
  private client: SupabaseClientLike | undefined;
  private readonly url: string;
  private readonly serviceKey: string;
  private readonly createClient: CreateSupabaseClient | undefined;

  constructor(opts: SupabaseSnapshotStoreOptions) {
    this.url = opts.url;
    this.serviceKey = opts.serviceKey;
    this.client = opts.client;
    this.createClient = opts.createClient;
  }

  /**
   * Devuelve el cliente inyectado, o lo construye con la factory `createClient` del
   * consumidor (espejo de writer-supabase.ts). El cliente se memoiza. Si no hay ni
   * `client` ni `createClient`, falla con un error claro (NUNCA expone la service key).
   */
  private getClient(): SupabaseClientLike {
    if (this.client) return this.client;
    if (!this.createClient) {
      throw new Error(
        "SupabaseSnapshotStore: falta `client` o `createClient` en las opciones (@obs/ingest no depende de @supabase/supabase-js; el consumidor debe proveer uno).",
      );
    }
    this.client = this.createClient(this.url, this.serviceKey);
    return this.client;
  }

  /**
   * Porta L197–228 del worker Deno: insert + recuperación idempotente de 23505.
   */
  async insertSnapshot(row: Record<string, unknown>): Promise<{ id: number }> {
    const sb = this.getClient();
    const { data, error } = await sb.from("source_snapshot").insert(row).select("id").single();
    if (error) {
      // WR-02: violación de unique (source,resource,date_bucket) => otra corrida ya
      // capturó el snapshot de hoy. Éxito idempotente: leer la fila existente y devolver
      // su id (no re-fetch, no fallo de job).
      if (error.code === "23505") {
        const { data: existing } = await sb
          .from("source_snapshot")
          .select("id")
          .eq("source", row.source as string)
          .eq("resource", row.resource as string)
          .eq("date_bucket", row.date_bucket as string)
          .maybeSingle();
        if (existing) return { id: existing.id };
        // 23505 pero la fila no aparece en el SELECT de recuperación: carrera extrema
        // (borrado out-of-band entre el INSERT y el SELECT). Error RETRYABLE explícito —
        // no se cae a `undefined`/TypeError (#40); el reintento reinserta limpiamente.
        throw new Error(
          `source_snapshot 23505 sin fila recuperable (carrera): ${row.source as string}/${row.resource as string}/${row.date_bucket as string}`,
        );
      }
      throw new Error(`insert source_snapshot fallo: ${error.message}`);
    }
    return { id: data!.id };
  }
}
