// writer-supabase — impl REAL del `LobbyWriter` contra Supabase (remoto/local).
//
// Espeja `SupabaseAgendaWriter`: `createClient` con la SERVICE key (bypassa RLS; server-side) y
// `upsert(filas, { onConflict })` idempotente por la clave natural de la migración 0021:
//   * lobby_audiencia      → onConflict 'identificador' (PK)
//   * lobby_contraparte    → onConflict 'identificador,nombre,rol' (unique)
//   * lobby_ingesta_estado → onConflict 'parlamentario_id' (PK)
//
// La service key NUNCA se interpola en mensajes de error (solo se propaga `error.message` de
// PostgREST, que no la contiene). El modelo anida las contrapartes dentro de la audiencia
// para-escribir; aquí se APLANA, raíz ANTES que hijos (FK), de-duplicando por la clave de
// conflicto antes del lote (Postgres aborta un lote con dos filas de la misma clave).
//
// STORAGE PLANO (Anti-Pattern A4 de Phase 9): el FK del sujeto pasivo entra branded
// (`EnlaceConfirmado | null`) y se persiste como `parlamentario_id: string | null`.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LobbyWriter } from "./writer";
import type { AudienciaParaEscribir } from "./reconciliar-sujeto";

export interface SupabaseLobbyWriterOptions {
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

/** De-duplica por clave (last-write-wins), preservando el orden de la última aparición. */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

/** Fila raíz de lobby_audiencia (plana, sin las contrapartes anidadas). */
function audienciaRoot(f: AudienciaParaEscribir): Record<string, unknown> {
  return {
    identificador: f.identificador,
    institucion_codigo: f.institucionCodigo,
    // Storage PLANO: el FK branded se aplana a string|null (Anti-Pattern A4).
    parlamentario_id: f.enlace?.parlamentarioId ?? null,
    mencion_sujeto: f.mencionSujeto,
    estado_vinculo: f.estadoVinculo,
    fecha: f.fecha,
    fecha_raw: f.fechaRaw,
    materia: f.materia,
    enlace_detalle: f.enlaceDetalle,
    origen: f.origen,
    fecha_captura: f.fecha_captura,
    enlace: f.enlace_url,
  };
}

export class SupabaseLobbyWriter implements LobbyWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseLobbyWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertAudiencias(filas: AudienciaParaEscribir[]): Promise<void> {
    if (filas.length === 0) return;

    // 1. Raíces (PK identificador). De-dup por id por si una corrida trae dos veces la misma.
    const raices = dedupePorClave(filas, (f) => f.identificador);
    for (const lote of chunk(raices.map(audienciaRoot), CHUNK)) {
      const { error } = await this.client
        .from("lobby_audiencia")
        .upsert(lote, { onConflict: "identificador", ignoreDuplicates: false });
      if (error) throw new Error(`upsert lobby_audiencia falló: ${error.message}`);
    }

    // 2. Contrapartes (unique identificador,nombre,rol) aplanadas. Pitfall 4: contraparte_id
    //    SIEMPRE null (un tercero nunca se enlaza a una persona). `rol` null→'' para la clave.
    const contrapartes = raices.flatMap((f) =>
      f.contrapartes.map((c) => ({
        identificador: f.identificador,
        nombre: c.nombre,
        rol: c.rol ?? "",
        representado_text: c.representadoText,
        contraparte_id: c.contraparteId,
        origen: f.origen,
        fecha_captura: f.fecha_captura,
        enlace: f.enlace_url,
      })),
    );
    const contrapartesDedup = dedupePorClave(
      contrapartes,
      (r) => `${r.identificador} ${r.nombre} ${r.rol}`,
    );
    for (const lote of chunk(contrapartesDedup, CHUNK)) {
      const { error } = await this.client
        .from("lobby_contraparte")
        .upsert(lote, { onConflict: "identificador,nombre,rol", ignoreDuplicates: false });
      if (error) throw new Error(`upsert lobby_contraparte falló: ${error.message}`);
    }
  }

  async marcarIngestado(parlamentarioIds: string[], hasta: string): Promise<void> {
    if (parlamentarioIds.length === 0) return;
    const ids = [...new Set(parlamentarioIds)];
    const filas = ids.map((id) => ({ parlamentario_id: id, ingestado_hasta: hasta }));
    for (const lote of chunk(filas, CHUNK)) {
      const { error } = await this.client
        .from("lobby_ingesta_estado")
        .upsert(lote, { onConflict: "parlamentario_id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert lobby_ingesta_estado falló: ${error.message}`);
    }
  }
}
