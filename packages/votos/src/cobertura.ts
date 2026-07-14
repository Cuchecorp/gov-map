// cobertura — reporte de cobertura del voto individual por `estado_vinculo` + invariante duro
// "0 DIPID de la maestra vigente quedó no_confirmado" (D-SC4-MET, VOTO-01/DEBT-01).
//
// Dos números (RESEARCH Open Q2 / Pitfall 3):
//   (a) `porEstado`: conteo ABSOLUTO por `estado_vinculo` (confirmado/no_confirmado/…). Se lee con
//       head+count (`select("*", {count:"exact", head:true})`) → NO trae filas → sin el cap 1k de
//       PostgREST. El % puede subir en absoluto al escalar (periodos históricos → más no_confirmado
//       LEGÍTIMOS), por eso el absoluto NO es el invariante.
//   (b) `dipidsMaestraNoConfirmados`: el INVARIANTE duro. Cuenta las filas `voto` con
//       `estado_vinculo='no_confirmado'` cuyo `fuente_voter_id` pertenece a un DIPID de la maestra
//       vigente (camara='diputados', periodo vigente). DEBE ser 0 — el golden gate (P65) lo
//       garantiza y `reconciliarVotosCamara` NUNCA hace name-match. Si sube de 0 → regresión.
//
// NUNCA hace name-match: el eje es `estado_vinculo` + pertenencia por DIPID exacto. El conjunto de
// DIPIDs vigentes se recibe como parámetro (derivado del seed vía `derivarGoldenDipid`), no se
// consulta a la fuente ni se adivina por nombre.
//
// Paginación PostgREST (gotcha v6.1): si en algún punto se MATERIALIZAN filas de `voto`, el bucle
// DEBE usar `.order("votacion_id").range(from, from+PAGE-1)` (cap 1k/request). El invariante (b)
// se calcula con head+count por lotes de DIPIDs (`.in(...)`), sin materializar filas.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Estados de vínculo que reporta la cobertura (el eje de `voto.estado_vinculo`). */
export const ESTADOS_VINCULO = ["confirmado", "no_confirmado"] as const;
export type EstadoVinculo = (typeof ESTADOS_VINCULO)[number];

/** Tamaño de lote para las cláusulas `.in(...)` (evita URLs gigantes en PostgREST). */
const IN_CHUNK = 200;

/** Resultado del reporte de cobertura. */
export interface CoberturaReport {
  /** Conteo absoluto por `estado_vinculo` (head+count, sin materializar filas). */
  porEstado: Record<string, number>;
  /**
   * Invariante duro D-SC4-MET: filas `voto` no_confirmado cuyo `fuente_voter_id` es un DIPID de
   * la maestra vigente. DEBE ser 0 (el golden gate lo garantiza). >0 = regresión ruidosa.
   */
  dipidsMaestraNoConfirmados: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Conteo por estado con head+count (no trae filas → sin cap 1k). */
async function contarPorEstado(
  client: SupabaseClient,
  estado: EstadoVinculo,
): Promise<number> {
  const { count, error } = await client
    .from("voto")
    .select("*", { count: "exact", head: true })
    .eq("estado_vinculo", estado);
  if (error) throw new Error(`cobertura: conteo por estado '${estado}' falló: ${error.message}`);
  return count ?? 0;
}

/**
 * Cuenta las filas `voto` no_confirmado cuyo `fuente_voter_id` está en el conjunto de DIPIDs de
 * la maestra vigente. Head+count por lotes de DIPIDs (`.in(...)`) → nunca materializa filas.
 * DEBE devolver 0 (invariante D-SC4-MET). NUNCA hace name-match.
 */
async function contarDipidsMaestraNoConfirmados(
  client: SupabaseClient,
  dipidsMaestra: readonly string[],
): Promise<number> {
  if (dipidsMaestra.length === 0) return 0;
  let total = 0;
  for (const lote of chunk([...dipidsMaestra], IN_CHUNK)) {
    const { count, error } = await client
      .from("voto")
      .select("*", { count: "exact", head: true })
      .eq("estado_vinculo", "no_confirmado")
      .in("fuente_voter_id", lote);
    if (error) {
      throw new Error(`cobertura: invariante DIPID-maestra falló: ${error.message}`);
    }
    total += count ?? 0;
  }
  return total;
}

/**
 * Reporta la cobertura del voto individual: conteo por `estado_vinculo` + el invariante duro
 * "0 DIPID-maestra no_confirmado". El conjunto `dipidsMaestra` proviene del seed autoritativo
 * (`derivarGoldenDipid(maestra).map(r => r.dipid)`), no de la fuente ni de un name-match.
 *
 * @param client       cliente supabase-js (service key server-side; PostgREST head+count).
 * @param dipidsMaestra DIPIDs de la maestra vigente (camara='diputados', periodo vigente).
 * @returns            `{ porEstado, dipidsMaestraNoConfirmados }` (el segundo DEBE ser 0).
 */
export async function reportarCobertura(
  client: SupabaseClient,
  dipidsMaestra: readonly string[],
): Promise<CoberturaReport> {
  const porEstado: Record<string, number> = {};
  for (const estado of ESTADOS_VINCULO) {
    porEstado[estado] = await contarPorEstado(client, estado);
  }
  const dipidsMaestraNoConfirmados = await contarDipidsMaestraNoConfirmados(
    client,
    dipidsMaestra,
  );
  return { porEstado, dipidsMaestraNoConfirmados };
}
