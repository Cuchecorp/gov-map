// writer-supabase-servel — impl REAL del `ServelWriter` contra Supabase. Espeja writer-supabase.ts.
//
// `createClient` con la SERVICE key (bypassa RLS; server-side) + `upsert(filas, { onConflict })`
// idempotente. El `onConflict` de `aporte` INCLUYE `fecha_corte` -> las versiones ACUMULAN:
//   * aporte                 -> onConflict 'fuente_id,fecha_corte'  (CLAVE DE VERSION)
//   * donante                -> onConflict 'donante_id'             (sub-maestra last-write-wins)
//   * aportes_ingesta_estado -> onConflict 'parlamentario_id'
//
// Compone `SupabaseStorageServel` para subir el crudo. La service key NUNCA se interpola en errores.
// STORAGE PLANO: el FK del candidato entra branded (`EnlaceConfirmado | null`) via `enlaceCandidato` y
// se persiste como `parlamentario_id: string | null` (poblado SOLO cuando el enlace es determinista).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ServelWriter } from "./writer-servel";
import type { AporteParaEscribir } from "./reconciliar-aporte";
import type { Donante } from "./model-servel";
import { SupabaseStorageServel } from "./storage-supabase";

export interface SupabaseServelWriterOptions {
  /** URL de Supabase (remoto sa-east-1 o local). */
  url: string;
  /** SERVICE role key (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
  /** Bucket del crudo (default crudo-servel; el operador lo crea). */
  bucket?: string;
}

const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** De-duplica por clave (last-write-wins), preservando el orden de la ultima aparicion. */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

/** Fila raiz de aporte (plana). */
function aporteRoot(f: AporteParaEscribir): Record<string, unknown> {
  return {
    fuente_id: f.fuenteId,
    fecha_corte: f.fechaCorte,
    eleccion: f.eleccion,
    // Storage PLANO: el FK branded del candidato se aplana a string|null.
    parlamentario_id: f.enlaceCandidato?.parlamentarioId ?? null,
    estado_vinculo: f.estadoVinculo,
    candidato_nombre_verbatim: f.candidatoNombreVerbatim,
    donante_nombre: f.donanteNombre,
    tipo_persona: f.tipoPersona,
    monto: f.monto,
    fecha_aporte: f.fechaAporte,
    tipo_aporte: f.tipoAporte,
    territorio: f.territorio,
    pacto: f.pacto,
    partido: f.partido,
    origen: f.origen,
    fecha_captura: f.fecha_captura,
    enlace: f.enlace,
    licencia: f.licencia,
  };
}

function donanteRoot(d: Donante): Record<string, unknown> {
  return {
    donante_id: d.donanteId,
    rut_donante: d.rutDonante,
    nombre: d.nombre,
    tipo_persona: d.tipoPersona,
    origen: d.origen,
    fecha_captura: d.fecha_captura,
    enlace: d.enlace,
    licencia: d.licencia,
  };
}

export class SupabaseServelWriter implements ServelWriter {
  private readonly client: SupabaseClient;
  private readonly storage: SupabaseStorageServel;
  readonly bucket: string;

  constructor(opts: SupabaseServelWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    this.bucket = opts.bucket ?? "crudo-servel";
    // Reusa el MISMO cliente (composicion) para Storage.
    this.storage = new SupabaseStorageServel({ url: opts.url, serviceKey: opts.serviceKey, client: this.client });
  }

  /** Sube el crudo .xlsx a Supabase Storage (idempotente). Devuelve la clave versionada. */
  async subirCrudo(eleccion: string, fechaCorte: string, bytes: Uint8Array): Promise<string> {
    return this.storage.subirCrudo(this.bucket, eleccion, fechaCorte, bytes);
  }

  async upsertAportes(filas: AporteParaEscribir[]): Promise<void> {
    if (filas.length === 0) return;
    // De-dup por la clave de version (fuente_id, fecha_corte).
    const raices = dedupePorClave(filas, (f) => `${f.fuenteId}∥${f.fechaCorte}`);
    for (const lote of chunk(raices.map(aporteRoot), CHUNK)) {
      const { error } = await this.client
        .from("aporte")
        .upsert(lote, { onConflict: "fuente_id,fecha_corte", ignoreDuplicates: false });
      if (error) throw new Error(`upsert aporte fallo: ${error.message}`);
    }
  }

  async upsertDonantes(filas: Donante[]): Promise<void> {
    if (filas.length === 0) return;
    // Sub-maestra keyed por donante_id: de-dup last-write-wins antes del batch.
    const unicos = dedupePorClave(filas, (d) => d.donanteId);
    for (const lote of chunk(unicos.map(donanteRoot), CHUNK)) {
      const { error } = await this.client
        .from("donante")
        .upsert(lote, { onConflict: "donante_id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert donante fallo: ${error.message}`);
    }
  }

  async marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void> {
    if (parlamentarioIds.length === 0) return;
    const ids = [...new Set(parlamentarioIds)];
    const filas = ids.map((id) => ({ parlamentario_id: id, ingestado_hasta: hasta }));
    for (const lote of chunk(filas, CHUNK)) {
      const { error } = await this.client
        .from("aportes_ingesta_estado")
        .upsert(lote, { onConflict: "parlamentario_id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert aportes_ingesta_estado fallo: ${error.message}`);
    }
  }
}
