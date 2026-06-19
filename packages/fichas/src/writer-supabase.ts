// writer-supabase — impl REAL del writer de fichas contra Supabase (service key, server-side).
//
// Espeja `SupabaseTramitacionWriter` (packages/tramitacion/src/writer-supabase.ts): `createClient`
// con la SERVICE/SECRET key (bypassa RLS public-read; el writer es server-side, T-07-06) y
// `upsert(filas, { onConflict: 'boletin' })` idempotente por la clave natural de migración 0011:
//   * proyecto_ficha     → onConflict 'boletin' (PK, 1:1 con proyecto)
//   * proyecto_embedding → onConflict 'boletin' (PK, 1:1 con proyecto)
//
// La service key NUNCA se interpola en mensajes de error (solo se propaga `error.message` de
// PostgREST, que no la contiene — T-07-06). Apunta a SUPABASE_URL con SUPABASE_SECRET_KEY
// (env-driven, sin puertos hardcodeados); remoto/R2 = pasos de operador diferidos por credencial.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CuerpoLegal } from "./model";

/** Estado del pipeline de extracción/embedding (migración 0011 + 0013). */
export type FichaEstado = "pendiente" | "procesando" | "embebido" | "error";

/** Fila de proyecto_ficha (1:1 con proyecto, migración 0011). */
export interface FichaRow {
  boletin: string;
  idea_matriz: string | null;
  cuerpos_legales: CuerpoLegal[];
  texto_r2_path: string | null;
  estado: FichaEstado;
  origen: string;
  fecha_captura: string;
}

/** Fila de proyecto_embedding (vector versionado, FND-07). */
export interface EmbeddingRow {
  boletin: string;
  embedding: number[];
  embedding_model: string;
  embedding_dims: number;
  embedding_version: string;
}

export interface SupabaseFichasWriterOptions {
  /** URL de Supabase (de SUPABASE_URL; nunca hardcodear puertos). */
  url: string;
  /** SERVICE/SECRET key (bypassa RLS; nunca la anon). */
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

/**
 * De-duplica por una clave (last-write-wins), preservando el orden de la última aparición.
 * Defensa-en-profundidad: un lote de upsert nunca lleva dos filas con la misma clave de
 * conflicto (Postgres aborta el lote con `command cannot affect row a second time`).
 */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

/** Writer idempotente por boletín de proyecto_ficha + proyecto_embedding. */
export class SupabaseFichasWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseFichasWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertFicha(filas: FichaRow[]): Promise<void> {
    if (filas.length === 0) return;
    const deduped = dedupePorClave(filas, (f) => f.boletin);
    for (const lote of chunk(deduped, CHUNK)) {
      const { error } = await this.client
        .from("proyecto_ficha")
        .upsert(lote, { onConflict: "boletin", ignoreDuplicates: false });
      // T-07-06: solo error.message de PostgREST (no contiene la service key).
      if (error) throw new Error(`upsert proyecto_ficha falló: ${error.message}`);
    }
  }

  async upsertEmbedding(filas: EmbeddingRow[]): Promise<void> {
    if (filas.length === 0) return;
    const deduped = dedupePorClave(filas, (e) => e.boletin);
    for (const lote of chunk(deduped, CHUNK)) {
      const { error } = await this.client
        .from("proyecto_embedding")
        .upsert(lote, { onConflict: "boletin", ignoreDuplicates: false });
      if (error) throw new Error(`upsert proyecto_embedding falló: ${error.message}`);
    }
  }

  /**
   * Marca un boletín como 'error' con el mensaje del fallo (#42). El resume normal
   * (estado='pendiente') NO lo reintenta a ciegas: el fallo queda visible y solo
   * `--reembed` lo recupera. Best-effort: no lanza si la fila aún no existe.
   */
  async marcarError(boletin: string, mensaje: string): Promise<void> {
    const { error } = await this.client
      .from("proyecto_ficha")
      .update({ estado: "error", error_msg: mensaje.slice(0, 2000) })
      .eq("boletin", boletin);
    if (error) throw new Error(`marcarError proyecto_ficha falló: ${error.message}`);
  }

  /**
   * Lee los proyecto_ficha pendientes (estado='pendiente') uniendo título/materia/procedencia
   * desde proyecto (boletín = FK 1:1). SOLO se ejerce en LIVE (gated por env); no se llama en
   * los tests offline. Si `boletines` se pasa, restringe a ese conjunto explícito (cualquier
   * estado). `link_mensaje_mocion` es un SIDECAR no persistido (07-01); se entrega null →
   * texto-fuente degrada honesto (ficha con idea_matriz null). Wiring del link = follow-up.
   */
  async leerPendientes(boletines?: string[]): Promise<PipelinePendienteRow[]> {
    let query = this.client
      .from("proyecto_ficha")
      .select("boletin, estado, proyecto:proyecto(titulo, materia, origen, fecha_captura)");
    if (boletines && boletines.length > 0) {
      query = query.in("boletin", boletines);
    } else {
      query = query.eq("estado", "pendiente");
    }
    const { data, error } = await query;
    if (error) throw new Error(`leerPendientes falló: ${error.message}`);
    type JoinRow = {
      boletin: string;
      estado: FichaEstado;
      proyecto: { titulo?: string; materia?: string | null; origen?: string; fecha_captura?: string } | null;
    };
    return ((data ?? []) as unknown as JoinRow[]).map((r) => ({
      boletin: r.boletin,
      titulo: r.proyecto?.titulo ?? "",
      materia: r.proyecto?.materia ?? null,
      link_mensaje_mocion: null,
      estado: r.estado,
      ...(r.proyecto?.origen != null ? { origen: r.proyecto.origen } : {}),
      ...(r.proyecto?.fecha_captura != null ? { fecha_captura: r.proyecto.fecha_captura } : {}),
    }));
  }
}

/** Forma de fila leída por `leerPendientes` (= PipelinePendiente que el CLI alimenta). */
export interface PipelinePendienteRow {
  boletin: string;
  titulo: string;
  materia: string | null;
  link_mensaje_mocion: string | null;
  estado: FichaEstado;
  origen?: string;
  fecha_captura?: string;
}

/** Contrato mínimo que el pipeline consume (real = SupabaseFichasWriter; tests = espía). */
export interface FichasWriter {
  upsertFicha(filas: FichaRow[]): Promise<void>;
  upsertEmbedding(filas: EmbeddingRow[]): Promise<void>;
  /** Marca 'error' un boletín cuyo procesamiento falló (#42). Opcional (tests). */
  marcarError?(boletin: string, mensaje: string): Promise<void>;
}
