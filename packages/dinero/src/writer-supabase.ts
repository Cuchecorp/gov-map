// writer-supabase — impl REAL del `DineroWriter` contra Supabase (remoto/local).
//
// Espeja `SupabaseProbidadWriter`: `createClient` con la SERVICE key (bypassa RLS; server-side) y
// `upsert(filas, { onConflict })` idempotente. El `onConflict` de `contrato` INCLUYE `fecha_corte`
// -> las versiones ACUMULAN:
//   * contrato                 -> onConflict 'fuente_id,fecha_corte'  (CLAVE DE VERSION)
//   * contratista              -> onConflict 'rut_proveedor'          (sub-maestra last-write-wins)
//   * contratos_ingesta_estado -> onConflict 'parlamentario_id'
//
// CRITICO: NUNCA keyear `contrato` por el proveedor solo (colapsa ordenes distintas). La clave de
// conflicto SIEMPRE incluye `fecha_corte`.
//
// La service key NUNCA se interpola en mensajes de error (solo se propaga `error.message` de
// PostgREST, que no la contiene). STORAGE PLANO: el FK del proveedor entra branded
// (`EnlaceConfirmado | null`) y se persiste como `parlamentario_id: string | null`.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DineroWriter } from "./writer";
import type { ContratoParaEscribir } from "./reconciliar-contrato";
import type { Contratista } from "./model";

export interface SupabaseDineroWriterOptions {
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

/** De-duplica por clave (last-write-wins), preservando el orden de la ultima aparicion. */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

/** Fila raiz de contrato (plana). */
function contratoRoot(f: ContratoParaEscribir): Record<string, unknown> {
  return {
    fuente_id: f.fuenteId,
    fecha_corte: f.fechaCorte,
    codigo_orden: f.codigoOrden,
    // Storage PLANO: el FK branded se aplana a string|null.
    parlamentario_id: f.enlace?.parlamentarioId ?? null,
    rut_proveedor: f.rutProveedor,
    proveedor_nombre: f.mencionProveedor,
    mencion_proveedor: f.mencionProveedor,
    tipo_persona: f.tipoPersona,
    estado_vinculo: f.estadoVinculo,
    organismo: f.organismo,
    monto: f.monto,
    fecha_oc: f.fechaOc,
    origen: f.origen,
    fecha_captura: f.fecha_captura,
    enlace: f.enlace_url,
    licencia: f.licencia,
  };
}

function contratistaRoot(c: Contratista): Record<string, unknown> {
  return {
    rut_proveedor: c.rutProveedor,
    nombre: c.nombre,
    codigo_empresa: c.codigoEmpresa,
    tipo_persona: c.tipoPersona,
    origen: c.origen,
    fecha_captura: c.fecha_captura,
    enlace: c.enlace,
    licencia: c.licencia,
  };
}

export class SupabaseDineroWriter implements DineroWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseDineroWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertContratos(filas: ContratoParaEscribir[]): Promise<void> {
    if (filas.length === 0) return;
    // De-dup por la clave de version (fuente_id, fecha_corte).
    const raices = dedupePorClave(filas, (f) => `${f.fuenteId}∥${f.fechaCorte}`);
    for (const lote of chunk(raices.map(contratoRoot), CHUNK)) {
      const { error } = await this.client
        .from("contrato")
        .upsert(lote, { onConflict: "fuente_id,fecha_corte", ignoreDuplicates: false });
      if (error) throw new Error(`upsert contrato fallo: ${error.message}`);
    }
  }

  async upsertContratistas(filas: Contratista[]): Promise<void> {
    if (filas.length === 0) return;
    // Sub-maestra keyed por RUT: de-dup last-write-wins antes del batch.
    const unicos = dedupePorClave(filas, (c) => c.rutProveedor);
    for (const lote of chunk(unicos.map(contratistaRoot), CHUNK)) {
      const { error } = await this.client
        .from("contratista")
        .upsert(lote, { onConflict: "rut_proveedor", ignoreDuplicates: false });
      if (error) throw new Error(`upsert contratista fallo: ${error.message}`);
    }
  }

  async marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void> {
    if (parlamentarioIds.length === 0) return;
    const ids = [...new Set(parlamentarioIds)];
    const filas = ids.map((id) => ({ parlamentario_id: id, ingestado_hasta: hasta }));
    for (const lote of chunk(filas, CHUNK)) {
      const { error } = await this.client
        .from("contratos_ingesta_estado")
        .upsert(lote, { onConflict: "parlamentario_id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert contratos_ingesta_estado fallo: ${error.message}`);
    }
  }
}
