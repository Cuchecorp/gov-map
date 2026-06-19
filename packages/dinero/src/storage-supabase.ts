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

/**
 * Decide si un error de upload es la IDEMPOTENCIA esperada (el objeto ya existe, mismo hash en la
 * clave) y NO un fallo real. Precision sobre el regex laxo: Supabase Storage expone el conflicto de
 * forma ESTRUCTURADA (statusCode/status 409 o el `error: "Duplicate"` canonico). Un "Bucket not
 * found"/"does not exist" NO debe tragarse como exito -> seria reportar el crudo como capturado sin
 * estarlo (brecha de recuperabilidad del archivo crudo que este helper existe para garantizar). SOLO
 * el caso 409/Duplicate canonico se traga; cualquier otro -> THROW aguas arriba.
 */
function esConflictoYaExiste(error: { message?: string } & Record<string, unknown>): boolean {
  // 1. Codigo de estado estructurado (Supabase lo expone como statusCode string u status number).
  const code = error.statusCode ?? error.status;
  if (code === 409 || code === "409") return true;
  // 2. El `error` canonico de Supabase Storage para un duplicado es exactamente "Duplicate".
  const errName = typeof error.error === "string" ? error.error.trim().toLowerCase() : "";
  if (errName === "duplicate") return true;
  // 3. Fallback ANCLADO al mensaje canonico de duplicado ("The resource already exists"), NO un
  //    substring laxo de "exist" (que tambien aparece en "Bucket not found"/"does not exist").
  const msg = (error.message ?? "").toLowerCase();
  if (/the resource already exists/.test(msg)) return true;
  return false;
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
      // Idempotencia esperada: el objeto ya existe (mismo hash, 409/Duplicate canonico) -> no es un
      // error real. Precision estructurada (WR-03): un "Bucket not found"/"does not exist" NO se
      // traga (seria reportar el crudo como capturado sin estarlo). Cualquier otro error -> THROW.
      if (esConflictoYaExiste(error as { message?: string } & Record<string, unknown>)) {
        return key;
      }
      throw new Error(`storage SERVEL: ${error.message}`);
    }
    return key;
  }
}
