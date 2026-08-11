// allowlist.ts — carga de la LISTA CERRADA del contrato anti-alucinación (Phase 134, SC1).
//
// Fuente de verdad: tablas `proyecto` (boletines canónicos con sufijo) y `parlamentario`
// (+ `parlamentario_alias`) — las cifras "3.675 / 186" del ROADMAP son contrato de tamaño
// esperado, no un artefacto congelado: la lista real se carga en runtime con service key.
//
// PostgREST capea en 1.000 filas por request (gotcha rector v6.1): TODA carga pagina con
// `.order().range()` — `proyecto` tiene ~3.7k filas y una carga sin paginar devolvería un
// tercio de la lista EN SILENCIO, que es exactamente la clase de allowlist mutilada que
// haría al resolver rechazar boletines legítimos sin que nadie lo note.
//
// La construcción del índice de nombres es PURA (`construirAllowlist`) y testeable sin DB;
// `cargarAllowlist` es la cáscara IO.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarNombre, assertAllowlistNoVacia, type AllowlistResolver } from "./resolver.js";

const PAGE = 1000;

export interface PersonaAllowlist {
  id: string;
  nombre_normalizado: string;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
}

export interface AliasAllowlist {
  parlamentario_id: string;
  alias: string;
}

/**
 * Índice puro de la lista cerrada. Variantes por persona (todas normalizadas):
 * nombre_normalizado completo, "nombres paterno materno", "nombres paterno",
 * "primer-nombre paterno", y cada alias. Homónimos conviven en el array de ids de la
 * variante compartida (el resolver los vuelve `null`, fail-closed).
 */
export function construirAllowlist(
  boletines: readonly string[],
  personas: readonly PersonaAllowlist[],
  aliases: readonly AliasAllowlist[],
): AllowlistResolver {
  const setBoletines = new Set<string>();
  for (const b of boletines) {
    const limpio = b.trim();
    if (limpio.length > 0) setBoletines.add(limpio);
  }

  const mapa = new Map<string, string[]>();
  const agregar = (variante: string, id: string) => {
    const clave = normalizarNombre(variante);
    if (clave.length === 0) return;
    const ids = mapa.get(clave) ?? [];
    if (!ids.includes(id)) ids.push(id);
    mapa.set(clave, ids);
  };

  for (const p of personas) {
    agregar(p.nombre_normalizado, p.id);
    const nombres = (p.nombres ?? "").trim();
    const paterno = (p.apellido_paterno ?? "").trim();
    const materno = (p.apellido_materno ?? "").trim();
    if (nombres && paterno) {
      agregar(`${nombres} ${paterno} ${materno}`.trim(), p.id);
      agregar(`${nombres} ${paterno}`, p.id);
      const primerNombre = nombres.split(/\s+/)[0]!;
      agregar(`${primerNombre} ${paterno}`, p.id);
    }
  }
  for (const a of aliases) {
    agregar(a.alias, a.parlamentario_id);
  }

  return { boletines: setBoletines, parlamentarios: mapa };
}

async function paginar<T>(
  query: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  etiqueta: string,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await query(desde, desde + PAGE - 1);
    if (error) throw new Error(`allowlist: fallo cargando ${etiqueta}: ${error.message}`);
    if (!data || data.length === 0) break;
    filas.push(...data);
    if (data.length < PAGE) break;
  }
  return filas;
}

/**
 * Carga la lista cerrada desde la DB (service key, server-only). Falla LOUD si cualquiera
 * de las dos listas queda vacía (SC1) — jamás devuelve una allowlist procesable a medias.
 */
export async function cargarAllowlist(client: SupabaseClient): Promise<AllowlistResolver> {
  const proyectos = await paginar<{ boletin: string }>(
    (d, h) => client.from("proyecto").select("boletin").order("boletin").range(d, h),
    "proyecto.boletin",
  );
  const personas = await paginar<PersonaAllowlist>(
    (d, h) =>
      client
        .from("parlamentario")
        .select("id, nombre_normalizado, nombres, apellido_paterno, apellido_materno")
        .order("id")
        .range(d, h),
    "parlamentario",
  );
  const aliases = await paginar<AliasAllowlist>(
    (d, h) =>
      client.from("parlamentario_alias").select("parlamentario_id, alias").order("id").range(d, h),
    "parlamentario_alias",
  );

  const allowlist = construirAllowlist(
    proyectos.map((p) => p.boletin),
    personas,
    aliases,
  );
  assertAllowlistNoVacia(allowlist);
  return allowlist;
}
