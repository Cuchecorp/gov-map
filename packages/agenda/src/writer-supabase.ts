// writer-supabase — impl REAL del `AgendaWriter` contra el Supabase LOCAL.
//
// Espeja `SupabaseTramitacionWriter` (Fase 5): `createClient` con la SERVICE key local
// (bypassa RLS public-read; el writer es server-side, T-06-06) y
// `upsert(filas, { onConflict: '<clave natural>' })` idempotente por la clave natural de
// migración 0010:
//   * citacion           → onConflict 'id' (PK)
//   * citacion_invitado  → onConflict 'citacion_id,nombre' (unique)
//   * citacion_punto     → onConflict 'citacion_id,posicion' (unique)
//   * sesion_sala        → onConflict 'id' (PK)
//   * sesion_tabla_item  → onConflict 'sesion_id,posicion' (unique)
//
// La service key NUNCA se interpola en mensajes de error (solo se propaga `error.message` de
// PostgREST, que no la contiene) — T-06-06. Apunta SIEMPRE al LOCAL.
//
// El modelo anida invitados/puntos/items dentro de la raíz; aquí se APLANA a filas de las
// tablas hijas (la `posicion` del punto/ítem es el discriminador de la clave natural) y se
// upserta cada tabla por separado, raíz ANTES que hijos (FK). Se de-duplica por la clave de
// conflicto antes de enviar el lote (Postgres aborta un lote con dos filas de la misma clave).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgendaWriter } from "./writer";
import type { Citacion, SesionSala } from "./model";

export interface SupabaseAgendaWriterOptions {
  /** URL del Supabase LOCAL (p.ej. http://127.0.0.1:54421). */
  url: string;
  /** SERVICE role key LOCAL (bypassa RLS; nunca la anon). */
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

/** Fila raíz de citacion SIN los arrays anidados (las tablas hijas van por separado). */
function citacionRoot(c: Citacion): Record<string, unknown> {
  const { invitados: _invitados, puntos: _puntos, ...root } = c;
  return root;
}

/** Fila raíz de sesion_sala SIN los items anidados. */
function sesionRoot(s: SesionSala): Record<string, unknown> {
  const { items: _items, ...root } = s;
  return root;
}

export class SupabaseAgendaWriter implements AgendaWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseAgendaWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertCitaciones(citaciones: Citacion[]): Promise<void> {
    if (citaciones.length === 0) return;

    // 1. Raíces (PK id). De-dup por id por si una corrida trae dos veces la misma.
    const raices = dedupePorClave(citaciones, (c) => c.id);
    for (const lote of chunk(raices.map(citacionRoot), CHUNK)) {
      const { error } = await this.client
        .from("citacion")
        .upsert(lote, { onConflict: "id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert citacion falló: ${error.message}`);
    }

    // 2. Invitados (unique citacion_id,nombre) aplanados.
    const invitados = raices.flatMap((c) =>
      c.invitados.map((inv) => ({
        citacion_id: c.id,
        nombre: inv.nombre,
        calidad: inv.calidad,
      })),
    );
    const invitadosDedup = dedupePorClave(invitados, (r) => `${r.citacion_id} ${r.nombre}`);
    for (const lote of chunk(invitadosDedup, CHUNK)) {
      const { error } = await this.client
        .from("citacion_invitado")
        .upsert(lote, { onConflict: "citacion_id,nombre", ignoreDuplicates: false });
      if (error) throw new Error(`upsert citacion_invitado falló: ${error.message}`);
    }

    // 3. Puntos (unique citacion_id,posicion) — posicion = índice en el orden.
    const puntos = raices.flatMap((c) =>
      c.puntos.map((p, i) => ({
        citacion_id: c.id,
        posicion: i,
        boletin: p.boletin,
        id_proyecto: p.id_proyecto,
        materia: p.materia,
        tipo_tramite: p.tipo_tramite,
      })),
    );
    const puntosDedup = dedupePorClave(puntos, (r) => `${r.citacion_id} ${r.posicion}`);
    for (const lote of chunk(puntosDedup, CHUNK)) {
      const { error } = await this.client
        .from("citacion_punto")
        .upsert(lote, { onConflict: "citacion_id,posicion", ignoreDuplicates: false });
      if (error) throw new Error(`upsert citacion_punto falló: ${error.message}`);
    }
  }

  async upsertSesiones(sesiones: SesionSala[]): Promise<void> {
    if (sesiones.length === 0) return;

    // 1. Raíces (PK id).
    const raices = dedupePorClave(sesiones, (s) => s.id);
    for (const lote of chunk(raices.map(sesionRoot), CHUNK)) {
      const { error } = await this.client
        .from("sesion_sala")
        .upsert(lote, { onConflict: "id", ignoreDuplicates: false });
      if (error) throw new Error(`upsert sesion_sala falló: ${error.message}`);
    }

    // 2. Ítems de tabla (unique sesion_id,posicion).
    const items = raices.flatMap((s) =>
      s.items.map((it) => ({
        sesion_id: s.id,
        posicion: it.posicion,
        parte_sesion: it.parte_sesion,
        materia: it.materia,
        boletin: it.boletin,
        id_proyecto: it.id_proyecto,
        alias: it.alias,
        quorum: it.quorum,
      })),
    );
    const itemsDedup = dedupePorClave(items, (r) => `${r.sesion_id} ${r.posicion}`);
    for (const lote of chunk(itemsDedup, CHUNK)) {
      const { error } = await this.client
        .from("sesion_tabla_item")
        .upsert(lote, { onConflict: "sesion_id,posicion", ignoreDuplicates: false });
      if (error) throw new Error(`upsert sesion_tabla_item falló: ${error.message}`);
    }
  }
}
