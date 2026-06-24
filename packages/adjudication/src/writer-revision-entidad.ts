/**
 * RevisionEntidadWriter — escritor del estado durable del subsistema de identidad de TERCEROS
 * (ENT-04). ESPEJO de `RevisionWriter` (writer-revision.ts) contra las tablas de terceros de las
 * migraciones 0035 (`vinculo_entidad`, `revision_entidad`) y 0036 (RPC `resolver_entidad`, columna
 * `identidad_audit.tipo_entidad`). Escribe vía `@supabase/supabase-js` con la SERVICE key local
 * (bypassa RLS deny-by-default, como corresponde al orquestador/worker).
 *
 * Tres responsabilidades de escritura del pipeline:
 *  - `enqueueRevision`     → INSERT en `revision_entidad` (cola humana; candidatos/salida_modelo jsonb).
 *  - `upsertVinculoEntidad`→ UPSERT en `vinculo_entidad` por clave natural (Δ Pitfall 6: índice único
 *    TOTAL `(tipo_entidad, mencion_normalizada)`; el onConflict debe coincidir BYTE-A-BYTE con 0035 y el
 *    `on conflict` del RPC en 0036).
 *  - `appendAudit`         → INSERT en `identidad_audit` (APPEND-ONLY; REUSA la tabla de parlamentario
 *    con la columna nueva `tipo_entidad`; la inmutabilidad ya la enforce la DB).
 *
 * Y los métodos de cola que consume el revisor-entidad-cli:
 *  - `listarPendientes`    → SELECT de los casos `estado='pendiente'`.
 *  - `obtenerCaso`         → SELECT de un caso por id.
 *  - `resolverEntidad`     → RPC `resolver_entidad` atómico (UPDATE caso + UPSERT vínculo + INSERT audit),
 *    con el 10º param `p_tipo_entidad` para poblar `identidad_audit.tipo_entidad`.
 *
 * MINIMIZACIÓN: `candidatos`/`salida_modelo` NUNCA llevan RUT. El RPC `resolver_entidad` es la
 * ÚNICA vía de promoción a `confirmado` (gate humano LOCKED).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TipoEntidad } from "@obs/identity";
import { DECISIONES_AUDIT, type DecisionAudit } from "./writer-revision";

export type { DecisionAudit };
export { DECISIONES_AUDIT };

export interface RevisionEntidadWriterOptions {
  /** URL del Supabase LOCAL (p.ej. http://127.0.0.1:54421). */
  url: string;
  /** SERVICE role key LOCAL (bypassa RLS; nunca la anon). */
  serviceKey: string;
  /** Cliente pre-construido (tests). Si se pasa, ignora url/serviceKey. */
  client?: SupabaseClient;
}

/** Candidato resumido (SIN rut) que viaja al jsonb de la cola. */
export interface CandidatoEntidadResumen {
  id: string;
  nombre: string;
}

/** Caso a encolar en `revision_entidad` (cola humana, ENT-04). */
export interface CasoRevisionEntidad {
  /** FK opcional al vínculo ya creado (probable) que motivó la revisión. */
  vinculo_id?: number | null;
  mencion_nombre: string;
  mencion_normalizada: string;
  /** Δ1: discriminador de la entidad (clave de blocking, no camara/periodo). */
  tipo_entidad: TipoEntidad;
  /** Candidatos del blocking (jsonb, SIN rut). */
  candidatos: CandidatoEntidadResumen[];
  /** Salida validada del adjudicador LLM (jsonb). */
  salida_modelo: unknown;
  modelo_version: string;
  /** Default 'pendiente' por DDL; explícito aquí. */
  estado: "pendiente";
  /** Razones acumuladas de la compuerta fail-closed. */
  motivo?: string | null;
}

/** Fila a upsert en `vinculo_entidad` (producto final mención→entidad_tercero_id). */
export interface FilaVinculoEntidad {
  /** PK opcional: si se omite, la DB la genera. */
  id?: number;
  mencion_nombre: string;
  mencion_normalizada: string;
  /** Δ1: discriminador (parte de la clave natural del upsert). */
  tipo_entidad: TipoEntidad;
  entidad_tercero_id: string | null;
  estado: "confirmado" | "probable" | "no_confirmado";
  metodo: "determinista" | "llm" | "humano";
  origen: string;
  fecha_captura: string;
  enlace: string;
}

/** Fila a insertar en `identidad_audit` (append-only) con la columna nueva `tipo_entidad`. */
export interface FilaAuditEntidad {
  vinculo_id: number | null;
  metodo: "determinista" | "llm" | "humano";
  decision: DecisionAudit;
  confidence: number | null;
  modelo_version: string | null;
  revisor_id: string | null;
  evidence: string[];
  conflicts: string[];
  /** Δ1: discriminador de la entidad (columna nueva de 0036). */
  tipo_entidad: TipoEntidad;
}

/** Caso de la cola tal como lo devuelve un SELECT. */
export interface CasoRevisionEntidadRow extends CasoRevisionEntidad {
  id: number;
  created_at?: string;
  resolved_at?: string | null;
  revisor_id?: string | null;
}

const TABLA_REVISION = "revision_entidad";
const TABLA_VINCULO = "vinculo_entidad";
const TABLA_AUDIT = "identidad_audit";

/** Clave natural del upsert de `vinculo_entidad` (Pitfall 6: índice único TOTAL de 0035 / on conflict de 0036). */
export const ONCONFLICT_VINCULO_ENTIDAD = "tipo_entidad,mencion_normalizada";

export class RevisionEntidadWriter {
  private readonly client: SupabaseClient;

  constructor(opts: RevisionEntidadWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  /** INSERTA un caso en la cola de revisión humana de terceros. */
  async enqueueRevision(caso: CasoRevisionEntidad): Promise<void> {
    const { error } = await this.client
      .from(TABLA_REVISION)
      .insert([caso])
      .select();
    if (error) {
      throw new Error(`enqueueRevision falló: ${error.message}`);
    }
  }

  /**
   * UPSERT del vínculo final mención→entidad_tercero_id. Devuelve el `id` de la fila escrita
   * para enlazarlo en el audit. Idempotencia por la CLAVE NATURAL `(tipo_entidad, mencion_normalizada)`
   * con índice único TOTAL (0035) — debe coincidir byte-a-byte con el `on conflict` del RPC en 0036
   * (Pitfall 6). Re-procesar la misma mención ACTUALIZA en vez de duplicar.
   */
  async upsertVinculoEntidad(v: FilaVinculoEntidad): Promise<number | null> {
    const { data, error } = await this.client
      .from(TABLA_VINCULO)
      .upsert([v], { onConflict: ONCONFLICT_VINCULO_ENTIDAD })
      .select("id");
    if (error) {
      throw new Error(`upsertVinculoEntidad falló: ${error.message}`);
    }
    const filas = (data ?? []) as { id: number }[];
    return filas[0]?.id ?? null;
  }

  /**
   * Resolución ATÓMICA del caso vía el RPC `resolver_entidad` (0036): UPDATE del caso (guardado
   * contra 'pendiente') + UPSERT del vínculo (si promueve) + INSERT del audit, TODO en una
   * transacción. Si el caso ya no está pendiente, el RPC lanza y revierte TODO. El 10º param
   * `p_tipo_entidad` puebla `identidad_audit.tipo_entidad`. Devuelve el `id` del vínculo (o null).
   */
  async resolverEntidad(params: {
    casoId: number;
    estado: "confirmado" | "rechazado" | "corregido";
    revisor: string;
    motivo: string | null;
    resolvedAt: string;
    promover: boolean;
    vinculo: FilaVinculoEntidad | null;
    decision: DecisionAudit;
    modeloVersion: string | null;
    tipoEntidad: TipoEntidad;
  }): Promise<number | null> {
    const { data, error } = await this.client.rpc("resolver_entidad", {
      p_caso_id: params.casoId,
      p_estado: params.estado,
      p_revisor: params.revisor,
      p_motivo: params.motivo,
      p_resolved_at: params.resolvedAt,
      p_promover: params.promover,
      p_vinculo: params.vinculo ?? null,
      p_decision: params.decision,
      p_modelo_version: params.modeloVersion,
      p_tipo_entidad: params.tipoEntidad,
    });
    if (error) {
      // El RPC lanza 'no_data_found' si el caso ya no estaba pendiente (carrera/ya resuelto).
      throw new Error(`resolverEntidad falló: ${error.message}`);
    }
    return (data as number | null) ?? null;
  }

  /**
   * APPEND a `identidad_audit` (reusada con la columna `tipo_entidad`). SOLO insert: la
   * inmutabilidad la enforce la DB (trigger BEFORE UPDATE/DELETE/TRUNCATE + REVOKE). Aquí jamás
   * se emite update.
   */
  async appendAudit(row: FilaAuditEntidad): Promise<void> {
    const { error } = await this.client
      .from(TABLA_AUDIT)
      .insert([row])
      .select();
    if (error) {
      throw new Error(`appendAudit falló: ${error.message}`);
    }
  }

  /** SELECT de los casos `estado='pendiente'` (revisor-entidad-cli `list`). */
  async listarPendientes(): Promise<CasoRevisionEntidadRow[]> {
    const { data, error } = await this.client
      .from(TABLA_REVISION)
      .select("*")
      .eq("estado", "pendiente");
    if (error) {
      throw new Error(`listarPendientes falló: ${error.message}`);
    }
    return (data ?? []) as CasoRevisionEntidadRow[];
  }

  /** SELECT de un caso por id (revisor-entidad-cli `show`). Devuelve null si no existe. */
  async obtenerCaso(id: number): Promise<CasoRevisionEntidadRow | null> {
    const { data, error } = await this.client
      .from(TABLA_REVISION)
      .select("*")
      .eq("id", id);
    if (error) {
      throw new Error(`obtenerCaso falló: ${error.message}`);
    }
    const filas = (data ?? []) as CasoRevisionEntidadRow[];
    return filas[0] ?? null;
  }
}
