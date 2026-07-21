/**
 * Fusión RRF (Reciprocal Rank Fusion) por rank — NUNCA por suma ponderada de scores.
 *
 * Fórmula: score(b) += w / (rrfK + rank_i + 1)
 * donde rank_i es la posición 0-based del boletín en la lista.
 *
 * Ref: PATTERNS.md §strategies.ts "RRF merge (TS, rank not score)".
 */
export function rrf(
  fts: string[],
  sem: string[],
  rrfK = 50,
  wFts = 1,
  wSem = 1,
): string[] {
  const score = new Map<string, number>();
  fts.forEach((b, i) => score.set(b, (score.get(b) ?? 0) + wFts / (rrfK + i + 1)));
  sem.forEach((b, i) => score.set(b, (score.get(b) ?? 0) + wSem / (rrfK + i + 1)));
  return [...score.entries()].sort((a, z) => z[1] - a[1]).map(([b]) => b);
}
