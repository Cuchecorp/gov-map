/**
 * Scorer hit@1/hit@5/MRR para el golden set de retrieval.
 *
 * Función pura — la estrategia de retrieval se inyecta como `ejecutar`.
 * Sin red, sin DB, sin I/O. Mirror de evaluarGolden (golden/golden-set.ts).
 *
 * Hit criteria:
 *   hit@1  = el primer expected encontrado tiene rank === 1
 *   hit@5  = rank !== null && rank <= 5
 *   mrr@5  = rank !== null && rank <= 5 ? 1/rank : 0  (MRR truncado a ventana top-5; consistente con hit@5)
 *
 * El matching es accent-insensitive via normalizarLiteral (Pitfall #3).
 */

import type { CasoRetrieval } from "./golden-set";
import { normalizarLiteral } from "./golden-set";

export interface MetricasRetrieval {
  /** Métricas por categoría: promedio de hit@1, hit@5 y MRR en los n casos de esa categoría. */
  porCategoria: Record<string, { hit1: number; hit5: number; mrr: number; n: number }>;
  /** Agregado global: promedio sobre todos los casos del set. */
  agregado: { hit1: number; hit5: number; mrr: number; n: number };
  /** Detalle por caso: rank del primer expected encontrado (1-based) o null si ausente. */
  detalle: { id: string; category: string; rank: number | null; ok: boolean }[];
}

/**
 * Evalúa una estrategia de retrieval sobre el golden set usando hit@1/hit@5/MRR.
 *
 * @param set   - Casos del golden set (o subconjunto)
 * @param ejecutar - Función que ejecuta la estrategia y devuelve boletines rankeados
 */
export async function evaluarRetrieval(
  set: CasoRetrieval[],
  ejecutar: (caso: CasoRetrieval) => Promise<string[]>,
): Promise<MetricasRetrieval> {
  const detalle: MetricasRetrieval["detalle"] = [];
  const acum: Record<string, { hit1: number; hit5: number; mrr: number; n: number }> = {};

  for (const caso of set) {
    const resultados = await ejecutar(caso);

    // Encontrar el rank (1-based) del primer expected que matchea (accent-insensitive)
    let rank: number | null = null;
    for (const exp of caso.expected) {
      const expNorm = normalizarLiteral(exp);
      const idx = resultados.findIndex((r) => normalizarLiteral(r) === expNorm);
      if (idx !== -1) {
        const candidateRank = idx + 1;
        if (rank === null || candidateRank < rank) {
          rank = candidateRank;
        }
      }
    }

    const hit1 = rank === 1 ? 1 : 0;
    const hit5 = rank !== null && rank <= 5 ? 1 : 0;
    // MRR@5: truncado a ventana top-5 (rank > 5 → 0, consistente con hit@5)
    // Etiquetado como mrr en los campos para simplicidad; el CLI lo emite como MRR@5.
    const mrr = rank !== null && rank <= 5 ? 1 / rank : 0;
    const ok = rank !== null;

    detalle.push({ id: caso.id, category: caso.category, rank, ok });

    if (!acum[caso.category]) {
      acum[caso.category] = { hit1: 0, hit5: 0, mrr: 0, n: 0 };
    }
    const cat = acum[caso.category]!;
    cat.hit1 += hit1;
    cat.hit5 += hit5;
    cat.mrr += mrr;
    cat.n += 1;
  }

  // Calcular promedios por categoría
  const porCategoria: MetricasRetrieval["porCategoria"] = {};
  let totalHit1 = 0;
  let totalHit5 = 0;
  let totalMrr = 0;
  let totalN = 0;

  for (const [cat, vals] of Object.entries(acum)) {
    porCategoria[cat] = {
      hit1: vals.n > 0 ? vals.hit1 / vals.n : 0,
      hit5: vals.n > 0 ? vals.hit5 / vals.n : 0,
      mrr: vals.n > 0 ? vals.mrr / vals.n : 0,
      n: vals.n,
    };
    totalHit1 += vals.hit1;
    totalHit5 += vals.hit5;
    totalMrr += vals.mrr;
    totalN += vals.n;
  }

  const agregado = {
    hit1: totalN > 0 ? totalHit1 / totalN : 0,
    hit5: totalN > 0 ? totalHit5 / totalN : 0,
    mrr: totalN > 0 ? totalMrr / totalN : 0,
    n: totalN,
  };

  return { porCategoria, agregado, detalle };
}
