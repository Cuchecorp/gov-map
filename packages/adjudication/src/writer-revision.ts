/**
 * RevisionWriter — escritor del estado durable del subsistema de identidad asistida
 * (espeja `SupabaseMaestraWriter` de @obs/identity). Escribe contra las tres tablas
 * de 04-02 vía `@supabase/supabase-js` con la SERVICE key local (bypassa RLS
 * deny-by-default, como corresponde al orquestador/worker).
 *
 * Tres responsabilidades de escritura del pipeline (04-03):
 *  - `enqueueRevision`  → INSERT en `revision_identidad` (cola humana; candidatos y
 *    salida_modelo viajan como jsonb).
 *  - `upsertVinculo`    → UPSERT en `vinculo_identidad` (producto final mención→id,
 *    con estado+metodo).
 *  - `appendAudit`      → INSERT en `identidad_audit` (APPEND-ONLY: SOLO insert; la
 *    inmutabilidad la enforcea la DB de 04-02 con trigger+REVOKE — aquí jamás se
 *    emite update/delete, defensa app-side coherente).
 *
 * Además, los métodos de cola que consume el revisor-cli (04-03 Task 2):
 *  - `listarPendientes` → SELECT de los casos `estado='pendiente'`.
 *  - `obtenerCaso`      → SELECT de un caso por id.
 *  - `resolverRevision` → UPDATE del estado del caso (revisor_id + resolved_at).
 *
 * MINIMIZACIÓN: `candidatos`/`salida_modelo` NUNCA llevan RUT (la mención foránea no
 * lo transporta por diseño; 04-01/04-02). Los errores se propagan con un mensaje que
 * NO expone la service key ni secretos (solo el `error.message` de PostgREST).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Camara } from "@obs/core";

export interface RevisionWriterOptions {
  /** URL del Supabase LOCAL (p.ej. http://127.0.0.1:54421). */
  url: string;
  /** SERVICE role key LOCAL (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

/** Candidato resumido (SIN rut) que viaja al jsonb de la cola. */
export interface CandidatoResumen {
  id: string;
  nombre: string;
}

/** Caso a encolar en `revision_identidad` (cola humana, ID-05). */
export interface CasoRevision {
  /** FK opcional al vínculo ya creado (probable) que motivó la revisión. */
  vinculo_id?: number | null;
  mencion_nombre: string;
  mencion_normalizada: string;
  camara: Camara;
  periodo: string;
  region: string | null;
  /** Candidatos del blocking (jsonb, SIN rut). */
  candidatos: CandidatoResumen[];
  /** Salida validada del adjudicador LLM (jsonb). */
  salida_modelo: unknown;
  modelo_version: string;
  /** Default 'pendiente' por DDL; explícito aquí. */
  estado: "pendiente";
  /** Razones acumuladas de la compuerta fail-closed. */
  motivo?: string | null;
}

/** Fila a upsert en `vinculo_identidad` (producto final mención→id, ID-06). */
export interface FilaVinculo {
  /** PK opcional: si se omite, la DB la genera. */
  id?: number;
  mencion_nombre: string;
  mencion_normalizada: string;
  camara: Camara;
  periodo: string;
  parlamentario_id: string | null;
  estado: "confirmado" | "probable" | "no_confirmado";
  metodo: "determinista" | "llm" | "humano";
  origen: string;
  fecha_captura: string;
  enlace: string;
}

/**
 * Vocabulario CERRADO de `identidad_audit.decision` (WR-04). Antes la columna era
 * free-text y la migración documentaba un vocabulario distinto del que el pipeline
 * escribía (`no_confirmado`/`probable`/`revision` vs `match|no_match|...`), de modo que
 * un consumidor filtrando por `decision` perdía filas. Esta lista es la única fuente de
 * verdad, espejada por un CHECK en la migración 0007.
 *
 *  - determinista:        'confirmado'
 *  - blocking sin cands:  'no_confirmado'
 *  - auto-aceptar (LLM):  'probable'
 *  - compuerta → cola:    'revision'
 *  - humano (revisor-cli):'confirmado' | 'rechazado' | 'corregido'
 */
export const DECISIONES_AUDIT = [
  "confirmado",
  "no_confirmado",
  "probable",
  "revision",
  "rechazado",
  "corregido",
] as const;
export type DecisionAudit = (typeof DECISIONES_AUDIT)[number];

/** Fila a insertar en `identidad_audit` (append-only, ID-08). */
export interface FilaAudit {
  vinculo_id: number | null;
  metodo: "determinista" | "llm" | "humano";
  decision: DecisionAudit;
  confidence: number | null;
  modelo_version: string | null;
  revisor_id: string | null;
  evidence: string[];
  conflicts: string[];
}

/** Caso de la cola tal como lo devuelve un SELECT. */
export interface CasoRevisionRow extends CasoRevision {
  id: number;
  created_at?: string;
  resolved_at?: string | null;
  revisor_id?: string | null;
}

const TABLA_REVISION = "revision_identidad";
const TABLA_VINCULO = "vinculo_identidad";
const TABLA_AUDIT = "identidad_audit";

export class RevisionWriter {
  private readonly client: SupabaseClient;

  constructor(opts: RevisionWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  /** INSERTA un caso en la cola de revisión humana. */
  async enqueueRevision(caso: CasoRevision): Promise<void> {
    const { error } = await this.client
      .from(TABLA_REVISION)
      .insert([caso])
      .select();
    if (error) {
      throw new Error(`enqueueRevision falló: ${error.message}`);
    }
  }

  /**
   * UPSERT del vínculo final mención→id (estado + metodo). Devuelve el `id` de la fila
   * escrita para enlazarlo en el audit (WR-01).
   *
   * Idempotencia (WR-02): el conflicto se resuelve sobre la CLAVE NATURAL
   * `(camara, periodo, mencion_normalizada)` — el índice único parcial de 0006
   * (`where parlamentario_id is not null`). Re-procesar la misma mención con id
   * asignado ACTUALIZA la fila en vez de duplicarla. Las filas `no_confirmado` (sin
   * `parlamentario_id`) quedan fuera del índice parcial: no compiten por la unicidad,
   * así que se insertan como filas nuevas (no hay clave de conflicto que las una, lo
   * cual es correcto: una mención sin id no es un hecho idempotente).
   */
  async upsertVinculo(v: FilaVinculo): Promise<number | null> {
    const onConflict =
      v.parlamentario_id != null ? "camara,periodo,mencion_normalizada" : undefined;
    const { data, error } = await this.client
      .from(TABLA_VINCULO)
      .upsert([v], onConflict ? { onConflict } : undefined)
      .select("id");
    if (error) {
      throw new Error(`upsertVinculo falló: ${error.message}`);
    }
    const filas = (data ?? []) as { id: number }[];
    return filas[0]?.id ?? null;
  }

  /**
   * APPEND a `identidad_audit`. SOLO insert: la inmutabilidad la enforcea la DB
   * (trigger BEFORE UPDATE OR DELETE + REVOKE de 04-02). Aquí jamás se emite update.
   */
  async appendAudit(row: FilaAudit): Promise<void> {
    const { error } = await this.client
      .from(TABLA_AUDIT)
      .insert([row])
      .select();
    if (error) {
      throw new Error(`appendAudit falló: ${error.message}`);
    }
  }

  /** SELECT de los casos `estado='pendiente'` (revisor-cli `list`). */
  async listarPendientes(): Promise<CasoRevisionRow[]> {
    const { data, error } = await this.client
      .from(TABLA_REVISION)
      .select("*")
      .eq("estado", "pendiente");
    if (error) {
      throw new Error(`listarPendientes falló: ${error.message}`);
    }
    return (data ?? []) as CasoRevisionRow[];
  }

  /** SELECT de un caso por id (revisor-cli `show`). Devuelve null si no existe. */
  async obtenerCaso(id: number): Promise<CasoRevisionRow | null> {
    const { data, error } = await this.client
      .from(TABLA_REVISION)
      .select("*")
      .eq("id", id);
    if (error) {
      throw new Error(`obtenerCaso falló: ${error.message}`);
    }
    const filas = (data ?? []) as CasoRevisionRow[];
    return filas[0] ?? null;
  }

  /**
   * UPDATE del estado de un caso de la cola (confirmado/rechazado/corregido) con
   * revisor_id + resolved_at. Solo aplica si el caso seguía `pendiente` (no re-resuelve).
   * Devuelve el nº de filas afectadas (0 = id inexistente o ya resuelto).
   */
  async resolverRevision(
    id: number,
    patch: {
      estado: "confirmado" | "rechazado" | "corregido";
      revisor_id: string;
      motivo?: string | null;
      resolved_at: string;
    },
  ): Promise<{ afectadas: number }> {
    const { data, error } = await this.client
      .from(TABLA_REVISION)
      .update(patch)
      .eq("id", id)
      .eq("estado", "pendiente")
      .select("id");
    if (error) {
      throw new Error(`resolverRevision falló: ${error.message}`);
    }
    return { afectadas: (data ?? []).length };
  }
}
