// storage-supabase — helper GREENFIELD para subir el crudo .xlsx de SERVEL a Supabase Storage.
//
// Grep `.storage.from(` en el repo = 0 hits (no existe uso de Storage). El analogo a EXTENDER es el
// `createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false }})` de
// writer-supabase.ts. Construye el cliente service-key y sube el crudo con clave VERSIONADA idempotente:
//
//   servel/<eleccionSlug>/<fechaCorte>/<sha256hex>.xlsx
//
// IDEMPOTENCIA: re-subir el mismo contenido (mismo hash en la clave) NO es error. Un error cuyo mensaje
// matchea /exists|duplicate|409/i es la idempotencia esperada -> se traga. Cualquier otro -> THROW.
// El bucket `crudo-servel` lo crea el OPERADOR (checkpoint); el helper NO lo crea en runtime.
//
// R2 (el destino original del criterio) devuelve 401 con las credenciales provistas -> fallback a
// Supabase Storage (funciona). R2 queda como deuda de operador. La service key SOLO de env, jamas
// interpolada en errores.

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Bucket por defecto del crudo SERVEL (el operador lo crea; defaultable por env). */
export const DEFAULT_BUCKET_SERVEL = "crudo-servel";

/** Content-type del .xlsx (Office Open XML spreadsheet). */
const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface SupabaseStorageOptions {
  /** URL de Supabase (remoto sa-east-1 o local). */
  url: string;
  /** SERVICE role key (bypassa Storage RLS; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests / cliente fake). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

/** sha256 hex de los bytes (clave de version determinista del crudo). */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Slug seguro para la clave de Storage (no inventa datos; solo normaliza separadores). */
function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-eleccion";
}

/**
 * Construye la clave versionada del crudo: `servel/<eleccionSlug>/<fechaCorte>/<sha256hex>.xlsx`.
 * Determinista: mismo contenido + misma eleccion + misma fecha -> misma clave (idempotencia).
 */
export function claveCrudo(eleccion: string, fechaCorte: string, bytes: Uint8Array): string {
  return `servel/${slug(eleccion)}/${fechaCorte}/${sha256Hex(bytes)}.xlsx`;
}

/** Helper de subida del crudo a Supabase Storage (composicion: el writer lo reusa). */
export class SupabaseStorageServel {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseStorageOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  /**
   * Sube el crudo .xlsx al bucket con clave versionada. IDEMPOTENTE: un 409/duplicate/exists se traga
   * (el mismo contenido ya esta versionado); cualquier otro error THROW (sin interpolar la service key).
   * Devuelve la clave usada.
   */
  async subirCrudo(
    bucket: string,
    eleccion: string,
    fechaCorte: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const key = claveCrudo(eleccion, fechaCorte, bytes);
    const { error } = await this.client.storage.from(bucket).upload(key, bytes, {
      contentType: XLSX_CONTENT_TYPE,
      upsert: false, // no sobreescribir: el hash en la clave hace que el mismo contenido sea la misma clave.
    });
    if (error) {
      // Idempotencia esperada: el objeto ya existe (mismo hash) -> no es un error real.
      if (/exists|duplicate|409/i.test(error.message)) {
        return key;
      }
      throw new Error(`storage SERVEL: ${error.message}`);
    }
    return key;
  }
}
