/**
 * embed-cache.ts — Cache committeable de query-text → vector.
 *
 * Lee el cache JSON (BOM-safe, read-first), embebe solo las queries en miss,
 * escribe el JSON de vuelta (committeable al repo — reproducible en CI).
 *
 * Seguridad (V7/V12):
 *   El cache guarda SOLO floats (query-text → vector number[]).
 *   CERO env values, CERO API keys, CERO URLs de conexión.
 *
 * El embedder se inyecta como parámetro para testear offline (sin red ni key).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

/** Estructura del cache en disco: objeto query-text → vector float[]. */
type CacheJson = Record<string, number[]>;

/**
 * Obtiene los embeddings de un conjunto de queries, con cache read-first.
 *
 * - Lee el JSON de cache desde `cachePath` (BOM-safe).
 * - Embebe SOLO las queries no encontradas en el cache (miss).
 * - Escribe el JSON actualizado de vuelta a `cachePath`.
 * - Devuelve un Map<query, vector> con todos los resultados.
 *
 * @param queries   - textos a embeber
 * @param embed     - función embedder inyectada (offline: mock; live: embedQuery)
 * @param cachePath - ruta absoluta al archivo JSON de cache
 */
export async function getCachedEmbeddings(
  queries: string[],
  embed: (texts: string[]) => Promise<number[][]>,
  cachePath: string,
): Promise<Map<string, number[]>> {
  // Leer cache existente (BOM-safe — el .env del repo puede tener BOM)
  let cache: CacheJson = {};
  if (existsSync(cachePath)) {
    const raw = readFileSync(cachePath, "utf8").replace(/^﻿/, ""); // strip UTF-8 BOM
    try {
      cache = JSON.parse(raw) as CacheJson;
    } catch {
      // Cache corrupto: empezar de cero
      cache = {};
    }
  }

  // Detectar misses
  const misses = queries.filter((q) => !(q in cache));

  if (misses.length > 0) {
    // Embeber solo los misses
    const vectors = await embed(misses);
    for (let i = 0; i < misses.length; i++) {
      const query = misses[i]!;
      const vector = vectors[i]!;
      cache[query] = vector;
    }

    // Escribir cache actualizado (solo floats, sin secrets)
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  }

  // Construir Map de resultados
  const result = new Map<string, number[]>();
  for (const q of queries) {
    const v = cache[q];
    if (v !== undefined) {
      result.set(q, v);
    }
  }
  return result;
}
