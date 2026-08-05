// writer-supabase — impl REAL del `NewsWriter` contra el Supabase LOCAL.
//
// Espeja `SupabaseTramitacionWriter` (packages/tramitacion/src/writer-supabase.ts): `createClient`
// con la SERVICE key local (bypassa RLS deny-all total, T-132-13) y `upsert(filas, { onConflict:
// '<clave natural>' })` idempotente por la clave natural de migración 0084:
//   * noticia            → onConflict 'url_hash' (PK)
//   * noticia_url_vista  → onConflict 'url_hash' (PK)
//
// La service key NUNCA se interpola en mensajes de error (solo se propaga `error.message` de
// PostgREST, que no la contiene). El project-ref de Supabase NUNCA se transcribe en este archivo
// (B26): la URL viene siempre de env / opts, nunca hardcodeada.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NewsWriter, NoticiaRow, UrlVistaRow } from "./writer";

export interface SupabaseNewsWriterOptions {
  /** URL del Supabase LOCAL (p.ej. http://127.0.0.1:54421). */
  url: string;
  /** SERVICE role key LOCAL (bypassa RLS; nunca la anon). */
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
 * Defensa-en-profundidad: La Tercera y La Cuarta traen 100 ítems cada uno y un mismo `url_hash`
 * puede repetirse dentro del lote — sin dedupe, Postgres aborta el lote con
 * `ON CONFLICT DO UPDATE command cannot affect row a second time`.
 */
function dedupePorClave<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>();
  for (const v of arr) m.set(key(v), v);
  return [...m.values()];
}

/** PostgREST cap 1.000 filas por request (gotcha v6.1): consultar `urlsYaVistas` por chunks. */
const QUERY_CHUNK = 500;

/**
 * Causas conocidas de descarte (espeja `UrlVistaRow["causa"]` sin el `null`). Fuente única para
 * `contarPorCausa`: si el tipo cambia y esta lista no se actualiza, un test de correspondencia
 * (`writer-supabase.test.ts`) cae.
 */
export const CAUSAS_CONOCIDAS = ["prefiltro_lexico", "duplicado"] as const;

export class SupabaseNewsWriter implements NewsWriter {
  private readonly client: SupabaseClient;

  constructor(opts: SupabaseNewsWriterOptions) {
    this.client =
      opts.client ??
      createClient(opts.url, opts.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  async upsertNoticias(filas: NoticiaRow[]): Promise<void> {
    if (filas.length === 0) return;
    const deduped = dedupePorClave(filas, (f) => f.url_hash);
    for (const lote of chunk(deduped, CHUNK)) {
      const { error } = await this.client
        .from("noticia")
        .upsert(lote, { onConflict: "url_hash", ignoreDuplicates: false });
      if (error) throw new Error(`upsert noticia falló: ${error.message}`);
    }
  }

  async marcarVistas(filas: UrlVistaRow[]): Promise<void> {
    if (filas.length === 0) return;
    const deduped = dedupePorClave(filas, (f) => f.url_hash);
    for (const lote of chunk(deduped, CHUNK)) {
      const { error } = await this.client
        .from("noticia_url_vista")
        .upsert(lote, { onConflict: "url_hash", ignoreDuplicates: false });
      if (error) throw new Error(`upsert noticia_url_vista falló: ${error.message}`);
    }
  }

  /**
   * Conteo EXACTO por causa (WR-05: el gotcha B-01 de v12.0 — `Ver detalle (1000)` — no puede
   * renacer aquí). `select("causa")` sin `range()` topa en 1.000 filas y devolvería un número
   * falso sin ningún aviso a partir de la primera semana de cron; en cambio, cada causa se
   * cuenta con `select("*", { count: "exact", head: true })` — `head: true` significa que
   * PostgREST NO transfiere las filas, solo el conteo del servidor, así que el cap de 1.000
   * nunca aplica. Un `error` de PostgREST LANZA — nunca se devuelve un conteo parcial silencioso.
   */
  async contarPorCausa(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};

    for (const causa of CAUSAS_CONOCIDAS) {
      const { count, error } = await this.client
        .from("noticia_url_vista")
        .select("*", { count: "exact", head: true })
        .eq("causa", causa);
      if (error) throw new Error(`contarPorCausa falló (causa=${causa}): ${error.message}`);
      out[causa] = count ?? 0;
    }

    const { count: sinCausa, error: errorSinCausa } = await this.client
      .from("noticia_url_vista")
      .select("*", { count: "exact", head: true })
      .is("causa", null);
    if (errorSinCausa) throw new Error(`contarPorCausa falló (sin_causa): ${errorSinCausa.message}`);
    out.sin_causa = sinCausa ?? 0;

    return out;
  }

  /**
   * Dedup nivel 1 (D-13). Filtra a `estado in ('pasa','descarta')` (contrato 132-09/CR-02): los
   * `pendiente` NO cuentan como vistos — deben re-evaluarse en la corrida siguiente porque un
   * fallo transitorio pudo haberlos dejado sin causa final.
   */
  async urlsYaVistas(hashes: string[]): Promise<Set<string>> {
    const out = new Set<string>();
    for (const lote of chunk(hashes, QUERY_CHUNK)) {
      if (lote.length === 0) continue;
      const { data, error } = await this.client
        .from("noticia_url_vista")
        .select("url_hash")
        .in("url_hash", lote)
        .in("estado", ["pasa", "descarta"]);
      if (error) throw new Error(`urlsYaVistas falló: ${error.message}`);
      for (const row of (data ?? []) as { url_hash: string }[]) out.add(row.url_hash);
    }
    return out;
  }
}
