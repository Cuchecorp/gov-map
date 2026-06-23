import "server-only";

import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { BOLETIN_RE, MAX_QUERY_CHARS } from "@/lib/buscar";

/**
 * Capa de datos del buscador de AGENDA (Frente B), server-only.
 *
 * A diferencia de /buscar (semántico, embeddings), la agenda se busca por PALABRA CLAVE
 * (comisión, materia, invitado, boletín) → Postgres Full-Text Search `spanish` vía el RPC
 * `buscar_citaciones` (migración 0032). NO embebe, NO llama modelos.
 *
 * Trust boundary navegador → /agenda?q=: `qRaw` es input no confiable. Se trimea y capea a
 * ≤300 (mismo cap que /buscar). El atajo de boletín reusa `BOLETIN_RE` y redirige a la ficha
 * ANTES de tocar el RPC (cruce a /proyecto/[boletin]). `supabase-js .rpc()` PARAMETRIZA `q`
 * — jamás se interpola en SQL. El `rank` que devuelve el RPC se usa solo para el orden
 * server-side; NUNCA se expone al usuario.
 */

/** Fila pública de un resultado de búsqueda de citación (sin `rank`, que es server-side). */
export interface CitacionBusquedaRow {
  id: string;
  camara: "camara" | "senado";
  comision: string;
  fecha: string | null;
  materia: string | null;
  semana_iso: string;
  estado: string | null;
  /** Primer boletín de la citación (cruce a la ficha), o null. */
  boletin: string | null;
}

/** Fila cruda del RPC (incluye `rank`, que NO se expone). */
interface RpcRow extends CitacionBusquedaRow {
  rank: number | null;
}

export interface BuscarCitacionesOptions {
  /** Filtra por cámara tras el ranking (Cámara/Senado). `undefined` = ambas. */
  camara?: "camara" | "senado";
  /** Cantidad máxima de filas (default 50; el RPC topa en 100). */
  limite?: number;
}

/**
 * Busca citaciones de comisiones por palabra clave.
 *
 * Flujo (server-only): trim + cap ≤300 → si vacía, `[]` (sin rpc) → si matchea `BOLETIN_RE`,
 * `redirect(/proyecto/{q})` ANTES del rpc → si no, `rpc buscar_citaciones` con `q` parametrizado
 * → filas públicas. Degradación honesta: un error del RPC se LANZA (la UI muestra banner de
 * error), distinto de `[]` (sin resultados genuino).
 */
export async function buscarCitaciones(
  qRaw: string,
  opts: BuscarCitacionesOptions = {},
): Promise<CitacionBusquedaRow[]> {
  const q = qRaw.trim().slice(0, MAX_QUERY_CHARS);
  if (q.length === 0) return [];

  // Atajo: un boletín redirige directo a la ficha, ANTES de tocar el RPC (cruce a la ficha).
  if (BOLETIN_RE.test(q)) {
    redirect(`/proyecto/${q}`);
  }

  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("buscar_citaciones", {
    q,
    limite: opts.limite ?? 50,
  });

  // Honest degradation: un fallo del RPC (grant/RLS, red, error de Postgres) NO es "sin
  // resultados". Se lanza para que la UI muestre el banner de error (no "Sin resultados").
  if (error) {
    throw new Error(`buscar_citaciones RPC falló: ${error.message}`);
  }

  let filas = (data as RpcRow[] | null) ?? [];
  if (opts.camara) {
    filas = filas.filter((f) => f.camara === opts.camara);
  }
  // Descarta el `rank` (server-side only); devuelve solo columnas públicas.
  return filas.map(({ rank: _rank, ...row }) => row);
}
