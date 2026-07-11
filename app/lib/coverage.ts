import "server-only";

import { unstable_cache } from "next/cache";

import { createServerSupabase } from "@/lib/supabase";

/**
 * coverage.ts — cobertura del corpus de búsqueda (BUSQ-03), server-only.
 *
 * `/buscar` debe declarar HONESTAMENTE sobre cuántos proyectos busca. El N que ve
 * el usuario es `count(proyecto_embedding)` — los proyectos realmente indexados en
 * el índice HNSW cosine 768 — leído en vivo desde la DB, NUNCA hardcodeado
 * (T-63-14 / anti-patrón LOCKED). `verify-cobertura.sql` es la fuente única del
 * mismo conteo para verificación manual y freshness.
 *
 * Seguridad:
 *   - `import "server-only"` (línea 1) impide que este módulo — y la service key
 *     que usa createServerSupabase — entren al bundle del cliente (T-63-12).
 *   - Solo cuenta `proyecto_embedding`, tabla public-read. `createServerSupabase`
 *     usa service_role (bypassa RLS), pero esta tabla NO tiene PII, así que el
 *     count es seguro (T-63-13). NUNCA consultar una tabla PII desde aquí.
 *
 * Rendimiento: el conteo se cachea ~1h con `unstable_cache` (revalidate 3600) — un
 * `count(*)` por request sería derroche para un número que casi no cambia y que solo
 * decora un banner. En Next.js 16 `use cache` reemplaza a `unstable_cache`, pero
 * `use cache` exige habilitar `cacheComponents` a nivel de config (cambio de alcance
 * amplio); `unstable_cache` sigue soportado y basta para este caso puntual.
 */

/** Alcance documentado del corpus (63-ALCANCE-HISTORICO.md: período vigente completo). */
export const ALCANCE_COBERTURA = "período legislativo 2022–2026";

const REVALIDATE_SEGUNDOS = 3600; // ~1h: el corpus cambia lento; no re-contar por request.

async function contarEmbeddings(): Promise<number> {
  const sb = createServerSupabase();
  const { count, error } = await sb
    .from("proyecto_embedding")
    .select("*", { count: "exact", head: true });
  // WR-02: un fallo del count NO debe fingir "0". Para una feature cuyo propósito es
  // cobertura HONESTA (BUSQ-03), "Busca sobre 0 proyectos" es la afirmación FALSA que la
  // fase busca eliminar. Además, devolver 0 aquí (dentro del wrapper de unstable_cache)
  // CACHEARÍA el fallo por ~1h. Lanzamos: unstable_cache NO cachea rechazos y el caller
  // traduce el throw a `null` (desconocido) → el banner se oculta upstream en vez de mentir.
  if (error) {
    console.error("contarCoberturaBusqueda: count(proyecto_embedding) falló:", error);
    throw new Error("count(proyecto_embedding) falló");
  }
  return count ?? 0;
}

const contarEmbeddingsCacheado = unstable_cache(
  contarEmbeddings,
  ["cobertura-busqueda-proyecto-embedding"],
  { revalidate: REVALIDATE_SEGUNDOS },
);

/**
 * Retorna el N real de proyectos indexados en /buscar (count de proyecto_embedding),
 * cacheado ~1h. Este es el número que declara el banner de cobertura. Ante un fallo del
 * count → `null` (desconocido, NO 0): el banner se oculta upstream (WR-02). El throw de
 * `contarEmbeddings` NO llega a poblar el cache (unstable_cache no cachea rechazos), así
 * que un hipo transitorio de la DB no envenena el banner por una hora.
 */
export async function contarCoberturaBusqueda(): Promise<number | null> {
  try {
    return await contarEmbeddingsCacheado();
  } catch {
    return null;
  }
}
