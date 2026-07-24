// kmeans.ts — Lloyd k-means DETERMINISTA sobre embeddings 768d (SEN-05).
//
// Es la capa SECUNDARIA de agrupación por tema del panel de actualidad: agrupa los
// proyectos por cercanía semántica de su `proyecto_embedding.embedding vector(768)`
// y etiqueta cada cluster con el `mode(proyecto.materia)` FACTUAL — nunca con texto
// generado por un LLM (riesgo existencial #2; threat T-99-11).
//
// DETERMINISMO (Pitfall 4 / threat T-99-12): sin `Math.random`. Un PRNG mulberry32 con
// una SEED FIJA constante (`KMEANS_SEED`) alimenta el init k-means++; la misma entrada
// (ordenada por boletín aguas arriba) + la misma seed → asignaciones byte-idénticas en
// cada corrida. Sin dependencia externa de k-means: ~Lloyd a mano, reproducible.
//
// Distancia: COSENO (dot-product sobre vectores normalizados L2), consistente con cómo
// Gemini genera los embeddings y con el operador `<=>` del índice HNSW en SQL (0011).

/**
 * SEED FIJA del PRNG determinista. Constante documentada: cambiarla re-baraja TODOS los
 * clusters, así que se trata como un valor LOCKED del pipeline. Elegida arbitraria pero fija.
 */
export const KMEANS_SEED = 0x9e3779b9; // 2654435769 — golden-ratio-ish, sin significado especial.

/** k por defecto y rango discrecional documentado (99-RESEARCH §Clustering). */
export const DEFAULT_K = 10;
export const K_MIN = 8;
export const K_MAX = 15;

/** Máximo de iteraciones de Lloyd antes de cortar (converge mucho antes en la práctica). */
const MAX_ITER = 100;

/** PRNG determinista mulberry32: seed uint32 → función () => float en [0,1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normaliza L2 (copia). Vector cero → se deja tal cual (evita NaN). */
function normalize(v: readonly number[]): number[] {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i]! * v[i]!;
  const norm = Math.sqrt(sum);
  if (norm === 0) return v.slice();
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / norm;
  return out;
}

/** Distancia coseno sobre vectores YA normalizados: 1 - dot. En [0,2]. */
function cosineDistance(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return 1 - dot;
}

export interface KMeansResult {
  /** k efectivo (clampado a [1, N] y al rango discrecional). */
  k: number;
  /** assignments[i] = índice de cluster (0..k-1) del vector i (en el orden de entrada). */
  assignments: number[];
  /** centroides normalizados, uno por cluster. */
  centroids: number[][];
}

/**
 * k-means++ init DETERMINISTA: elige el 1er centroide con el PRNG, luego cada siguiente
 * con probabilidad proporcional a D(x)^2 (distancia al centroide más cercano ya elegido),
 * muestreando con el MISMO PRNG. Reproducible byte-a-byte con seed fija.
 */
function initCentroidsPlusPlus(
  points: number[][],
  k: number,
  rng: () => number,
): number[][] {
  const n = points.length;
  const chosen: number[][] = [];
  const first = Math.floor(rng() * n);
  chosen.push(points[first]!.slice());

  const dist2 = new Array<number>(n).fill(Infinity);
  while (chosen.length < k) {
    const last = chosen[chosen.length - 1]!;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = cosineDistance(points[i]!, last);
      const d2 = d * d;
      if (d2 < dist2[i]!) dist2[i] = d2;
      total += dist2[i]!;
    }
    // muestreo proporcional a D(x)^2; total=0 (todos idénticos) → fallback al primero disponible.
    let target = rng() * total;
    let pick = 0;
    if (total > 0) {
      for (let i = 0; i < n; i++) {
        target -= dist2[i]!;
        if (target <= 0) {
          pick = i;
          break;
        }
      }
    } else {
      pick = chosen.length % n;
    }
    chosen.push(points[pick]!.slice());
  }
  return chosen;
}

/**
 * Lloyd k-means determinista sobre `vectors` (768d o cualquier dim), distancia coseno.
 *
 * - Normaliza L2 la entrada (coseno = dot sobre normalizados).
 * - k se clampa a [1, min(N, k)] — si el corpus N es pequeño, k baja (checker warning #2).
 * - Init k-means++ con `mulberry32(seed)`; convergencia por asignación estable o MAX_ITER.
 * - Empates de "centroide más cercano" se rompen por índice de cluster MENOR (determinista).
 * - Empates al re-centrar un cluster vacío: se mantiene el centroide previo (estable).
 */
export function kmeans(
  vectors: readonly (readonly number[])[],
  k: number = DEFAULT_K,
  seed: number = KMEANS_SEED,
): KMeansResult {
  const n = vectors.length;
  const effectiveK = Math.max(1, Math.min(k, n));
  const points = vectors.map(normalize);
  const rng = mulberry32(seed);

  if (n === 0) return { k: 0, assignments: [], centroids: [] };

  let centroids = initCentroidsPlusPlus(points, effectiveK, rng);
  let assignments = new Array<number>(n).fill(-1);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;
    // Paso de asignación: cada punto al centroide más cercano (empate → índice menor).
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < effectiveK; c++) {
        const d = cosineDistance(points[i]!, centroids[c]!);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed && iter > 0) break;

    // Paso de recentrado: media (normalizada) de los miembros; cluster vacío conserva su centroide.
    const dims = points[0]!.length;
    const sums: number[][] = Array.from({ length: effectiveK }, () =>
      new Array<number>(dims).fill(0),
    );
    const counts = new Array<number>(effectiveK).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i]!;
      counts[c]!++;
      const s = sums[c]!;
      const p = points[i]!;
      for (let d = 0; d < dims; d++) s[d]! += p[d]!;
    }
    const next: number[][] = [];
    for (let c = 0; c < effectiveK; c++) {
      if (counts[c]! === 0) {
        next.push(centroids[c]!.slice()); // vacío: estable, no re-siembra aleatoria.
        continue;
      }
      const mean = new Array<number>(dims);
      for (let d = 0; d < dims; d++) mean[d] = sums[c]![d]! / counts[c]!;
      next.push(normalize(mean));
    }
    centroids = next;
  }

  return { k: effectiveK, assignments, centroids };
}

/**
 * Etiqueta FACTUAL de un cluster = `mode(materia)` — la materia más frecuente entre sus
 * miembros. Empate → orden alfabético (determinista, Intl-agnostic con localeCompare 'es').
 * Ignora null/vacío/whitespace. Sin ninguna materia útil → '(sin materia)' literal.
 *
 * JAMÁS genera texto (threat T-99-11): solo cuenta y elige de la taxonomía oficial existente.
 */
export function labelCluster(materias: readonly (string | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const m of materias) {
    if (typeof m !== "string") continue;
    const t = m.trim();
    if (t === "") continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) return "(sin materia)";

  let bestLabel: string | null = null;
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && bestLabel !== null && label.localeCompare(bestLabel, "es") < 0)
    ) {
      bestLabel = label;
      bestCount = count;
    }
  }
  return bestLabel!;
}
