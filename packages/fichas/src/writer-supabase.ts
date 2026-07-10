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
  /**
   * Resolvedor del `link_mensaje_mocion` REAL por boletín BASE (sin sufijo de comisión).
   * Inyectado (Opción A, sin DDL): el CLI lo ensambla con el `SenadoConnector` real
   * (re-fetch del XML del Senado + `parseSenadoTramitacion(...).linkMensajeMocion`),
   * reusando la política @obs/ingest (allowlist + robots + rate-limit 2-3s). El writer NO
   * conoce @obs/tramitacion: solo ve `(boletinBase) => Promise<string|null>` (separación
   * de capas). Ausente, fallo o link no presente → `null` (degradación honesta, NUNCA
   * fabrica). Es la causa raíz de SC3: sin esto el pipeline degrada SIEMPRE a título+materia.
   */
  resolverLink?: (boletinBase: string) => Promise<string | null>;
}

/** Strip del sufijo de comisión al boletín BASE (Pitfall 1; idéntico a parse-senado:79). */
function boletinBase(boletin: string): string {
  return boletin.replace(/-\d+$/, "");
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
  private readonly resolverLink?: (boletinBase: string) => Promise<string | null>;

  constructor(opts: SupabaseFichasWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    this.resolverLink = opts.resolverLink;
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

  /**
   * Seed idempotente: crea una fila proyecto_ficha estado='pendiente' para cada `proyecto`
   * SIN fila de ficha (causa raíz BUSQ-01 — sin esto los proyectos son invisibles al pipeline,
   * que lee proyecto_ficha vía leerPendientes). NO corre el backfill; solo abre las filas.
   *
   * Dos pasos: (1) SELECT boletines de `proyecto` y de `proyecto_ficha`, computar `faltantes`
   * (proyectos sin ficha) vía Set; (2) upsert de las filas faltantes con
   * `ignoreDuplicates: true` (ON CONFLICT DO NOTHING) — CRÍTICO: jamás re-abre un estado
   * terminal ('embebido'/'error') a 'pendiente' (T-63-02). Si no hay faltantes, no toca la DB.
   *
   * T-07-06: solo error.message de PostgREST (nunca la service key).
   */
  async seedFichasPendientes(): Promise<{ creados: number }> {
    // PostgREST recorta cada select a ~1000 filas: sin paginar, el Set-diff compara páginas
    // desalineadas y el seed re-inserta "faltantes" que ya tienen ficha (loop sin avance a >1k).
    const leerTodosBoletines = async (tabla: "proyecto" | "proyecto_ficha"): Promise<string[]> => {
      const PAGE = 1000;
      const todos: string[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await this.client
          .from(tabla)
          .select("boletin")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`seedFichasPendientes (${tabla}) falló: ${error.message}`);
        const filas = (data ?? []) as Array<{ boletin: string }>;
        todos.push(...filas.map((f) => f.boletin));
        if (filas.length < PAGE) break;
      }
      return todos;
    };

    const proyectos = await leerTodosBoletines("proyecto");
    const conFicha = new Set(await leerTodosBoletines("proyecto_ficha"));
    const faltantes = proyectos.filter((b) => !conFicha.has(b));
    if (faltantes.length === 0) return { creados: 0 };

    const filas: FichaRow[] = faltantes.map((boletin) => ({
      boletin,
      idea_matriz: null,
      cuerpos_legales: [],
      texto_r2_path: null,
      estado: "pendiente",
      origen: "fichas-seed",
      fecha_captura: new Date().toISOString(),
    }));
    for (const lote of chunk(dedupePorClave(filas, (f) => f.boletin), CHUNK)) {
      const { error } = await this.client
        .from("proyecto_ficha")
        // ignoreDuplicates: true → ON CONFLICT DO NOTHING: nunca re-abre estado terminal.
        .upsert(lote, { onConflict: "boletin", ignoreDuplicates: true });
      if (error) throw new Error(`seedFichasPendientes falló: ${error.message}`);
    }
    return { creados: faltantes.length };
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
   * estado).
   *
   * SC3 (causa raíz): por cada boletín pendiente resuelve el `link_mensaje_mocion` REAL vía el
   * `resolverLink` inyectado (re-fetch del XML del Senado por boletín BASE — Opción A, sin DDL),
   * eliminando el hardcode `link: null` que forzaba al pipeline a degradar SIEMPRE a
   * título+materia. Degradación honesta: sin resolvedor, fallo del fetch/parse o link ausente →
   * `null` (NUNCA fabrica). El re-fetch reusa la política @obs/ingest dentro del resolvedor.
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
    const rows = (data ?? []) as unknown as JoinRow[];
    const out: PipelinePendienteRow[] = [];
    for (const r of rows) {
      out.push({
        boletin: r.boletin,
        titulo: r.proyecto?.titulo ?? "",
        materia: r.proyecto?.materia ?? null,
        link_mensaje_mocion: await this.resolverLinkSeguro(r.boletin),
        estado: r.estado,
        ...(r.proyecto?.origen != null ? { origen: r.proyecto.origen } : {}),
        ...(r.proyecto?.fecha_captura != null ? { fecha_captura: r.proyecto.fecha_captura } : {}),
      });
    }
    return out;
  }

  /**
   * Resuelve el link del Senado por boletín BASE, blindando la degradación honesta: sin
   * resolvedor inyectado o ante cualquier fallo de fetch/parse → `null` (NUNCA propaga el
   * error ni fabrica un link). El re-fetch real reusa @obs/ingest dentro del resolvedor.
   */
  private async resolverLinkSeguro(boletin: string): Promise<string | null> {
    if (!this.resolverLink) return null;
    try {
      const link = await this.resolverLink(boletinBase(boletin));
      return link ?? null;
    } catch {
      // Degradación honesta: 503/timeout/parse roto del Senado → null, no aborta el lote.
      return null;
    }
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
