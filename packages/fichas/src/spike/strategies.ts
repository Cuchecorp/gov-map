/**
 * strategies.ts — Las 3 estrategias de retrieval para el spike.
 *
 * Exporta tres runners que devuelven Promise<string[]> (boletin[] rankeado):
 *   - runFtsOnly:       FTS ad-hoc con websearch_to_tsquery + unaccent + weights A/B/C
 *   - runSemanticOnly:  RPC match_proyectos (ya existe en 0011) con vector inyectado
 *   - runRrf:           Fusión RRF de FTS + semántico, con short-circuit de boletín
 *
 * Seguridad (V5):
 *   - El texto de query va SIEMPRE bindeado vía params de runSql (nunca interpolado)
 *   - El vector se serializa como string y se pasa como param (NUNCA interpolado)
 *   - websearch_to_tsquery SIEMPRE (nunca to_tsquery crudo — 500s en sub-secretaría/16733-07)
 *
 * Schema (0011 + 0008):
 *   proyecto.titulo, proyecto.boletin, proyecto.boletin_num
 *   proyecto_ficha.idea_matriz, proyecto_ficha.cuerpos_legales jsonb {norma, articulos[]}
 *   match_proyectos(query_embedding vector(768), match_count int, match_threshold float8, exclude_boletin text)
 *
 * Pitfall #1: NO existe columna normas_afectadas. Normas = cuerpos_legales jsonb, key 'norma'.
 * Pitfall #3: unaccent en AMBOS lados (tsvector y tsquery).
 * Pitfall #5: boletín 3 formatos manejados por detectarBoletin (importado de 86-01).
 */

import { detectarBoletin } from "./boletin.js";
import { rrf } from "./rrf.js";

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Función de ejecución SQL inyectada (real = runSql de psql.ts; test = mock). */
export type SqlRunner = (
  sql: string,
  params?: Record<string, string>,
) => Promise<string[][]>;

// ── SQL ──────────────────────────────────────────────────────────────────────

/**
 * FTS ad-hoc con websearch_to_tsquery + unaccent ambos lados.
 * Weight A = titulo, B = idea_matriz, C = normas de cuerpos_legales jsonb.
 *
 * El texto de query va bindeado como :q (NUNCA interpolado — V5).
 * Assumption A3: key 'norma' en cuerpos_legales verificada contra 0011 (línea 25):
 *   `cuerpos_legales jsonb not null default '[]'` con elementos `{norma, articulos[]}`.
 */
const FTS_QUERY = `
with q as (
  select websearch_to_tsquery('spanish', unaccent(:q)) as tsq
)
select p.boletin,
       ts_rank_cd(
         setweight(to_tsvector('spanish', unaccent(coalesce(p.titulo, ''))), 'A') ||
         setweight(to_tsvector('spanish', unaccent(coalesce(f.idea_matriz, ''))), 'B') ||
         setweight(to_tsvector('spanish', unaccent(coalesce(
           (select string_agg(c->>'norma', ' ')
            from jsonb_array_elements(f.cuerpos_legales) c),
           ''))), 'C'),
         q.tsq
       ) as rank
from proyecto p
left join proyecto_ficha f on f.boletin = p.boletin,
q
where (
  setweight(to_tsvector('spanish', unaccent(coalesce(p.titulo, ''))), 'A') ||
  setweight(to_tsvector('spanish', unaccent(coalesce(f.idea_matriz, ''))), 'B') ||
  setweight(to_tsvector('spanish', unaccent(coalesce(
    (select string_agg(c->>'norma', ' ')
     from jsonb_array_elements(f.cuerpos_legales) c),
    ''))), 'C')
) @@ q.tsq
order by rank desc
limit :limit
`.trim();

/**
 * FTS degradado (sin unaccent) para el caso en que la extensión no está disponible.
 * El texto de query sigue bindeado como :q.
 */
const FTS_QUERY_NO_UNACCENT = `
with q as (
  select websearch_to_tsquery('spanish', :q) as tsq
)
select p.boletin,
       ts_rank_cd(
         setweight(to_tsvector('spanish', coalesce(p.titulo, '')), 'A') ||
         setweight(to_tsvector('spanish', coalesce(f.idea_matriz, '')), 'B') ||
         setweight(to_tsvector('spanish', coalesce(
           (select string_agg(c->>'norma', ' ')
            from jsonb_array_elements(f.cuerpos_legales) c),
           '')), 'C'),
         q.tsq
       ) as rank
from proyecto p
left join proyecto_ficha f on f.boletin = p.boletin,
q
where (
  setweight(to_tsvector('spanish', coalesce(p.titulo, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(f.idea_matriz, '')), 'B') ||
  setweight(to_tsvector('spanish', coalesce(
    (select string_agg(c->>'norma', ' ')
     from jsonb_array_elements(f.cuerpos_legales) c),
    '')), 'C')
) @@ q.tsq
order by rank desc
limit :limit
`.trim();

/** RPC match_proyectos vía SELECT (firma de 0011, threshold 0.59 = DEFAULT_MATCH_THRESHOLD). */
const SEMANTIC_QUERY = `
select boletin, similarity
from match_proyectos(:query_embedding::vector, :match_count::int, :match_threshold::float8, :exclude_boletin)
order by similarity desc
`.trim();

/** Short-circuit de boletín: busca por boletin (full) o boletin_num (base). */
const BOLETIN_EXACT_QUERY = `
select boletin from proyecto
where boletin = :full or boletin_num = :base
limit 1
`.trim();

// ── Opciones ─────────────────────────────────────────────────────────────────

export interface FtsOptions {
  runSql: SqlRunner;
  limit?: number;
  /** Si false, usa FTS sin unaccent (extensión no disponible). */
  useUnaccent?: boolean;
}

export interface SemanticOptions {
  runSql: SqlRunner;
  limit?: number;
  matchThreshold?: number;
  excludeBoletin?: string;
}

export interface RrfOptions {
  runSql: SqlRunner;
  rrfK?: number;
  /** Overall result limit (top-k from RRF fusion output). Default 20. */
  limit?: number;
  /**
   * Candidate limit per FTS arm. Default: same as limit.
   * Setting ftsLimit/semLimit independently enables honest per-arm grid measurement.
   */
  ftsLimit?: number;
  /**
   * Candidate limit per semantic arm. Default: same as limit.
   */
  semLimit?: number;
  wFts?: number;
  wSem?: number;
  matchThreshold?: number;
  useUnaccent?: boolean;
  /** Self-exclusion for 'similares' queries (SEM-05). Passed to semantic arm. */
  excludeBoletin?: string;
}

// ── Runners ──────────────────────────────────────────────────────────────────

/**
 * Estrategia 1: FTS-solo.
 *
 * Construye el SELECT FTS ad-hoc con websearch_to_tsquery + unaccent (ambos lados),
 * weight A/B/C sobre titulo/idea_matriz/normas-de-cuerpos_legales.
 * El texto de query va SIEMPRE bindeado (V5 — NUNCA interpolado).
 *
 * @param query     - texto de búsqueda (o boletín)
 * @param opts.runSql       - SQL runner inyectado
 * @param opts.limit        - máximo de resultados (default 20)
 * @param opts.useUnaccent  - usar unaccent (default true; false si la extensión no existe)
 * @returns boletin[] rankeado por FTS score desc
 */
export async function runFtsOnly(
  query: string,
  opts: FtsOptions,
): Promise<string[]> {
  const { runSql, limit = 20, useUnaccent = true } = opts;
  const sql = useUnaccent ? FTS_QUERY : FTS_QUERY_NO_UNACCENT;
  const rows = await runSql(sql, {
    q: query,
    limit: String(limit),
  });
  // cada fila es [boletin, rank] en -At output
  return rows.map((row) => row[0]!).filter(Boolean);
}

/**
 * Estrategia 2: Semántico-solo.
 *
 * Llama al RPC match_proyectos con el vector inyectado.
 * El vector se serializa a string de array PostgreSQL y se pasa como param (V5).
 *
 * @param vector    - embedding L2-normalizado de 768 dims
 * @param opts.runSql         - SQL runner inyectado
 * @param opts.limit          - match_count (default 20)
 * @param opts.matchThreshold - piso de similitud (default 0.59 = DEFAULT_MATCH_THRESHOLD)
 * @param opts.excludeBoletin - self-exclusión para "similares" (SEM-05)
 * @returns boletin[] rankeado por similarity desc
 */
export async function runSemanticOnly(
  vector: number[],
  opts: SemanticOptions,
): Promise<string[]> {
  const { runSql, limit = 20, matchThreshold = 0.59, excludeBoletin } = opts;

  // Serializar el vector al formato array de PostgreSQL: '[0.1,0.2,...]'
  const vectorStr = `[${vector.join(",")}]`;

  const rows = await runSql(SEMANTIC_QUERY, {
    query_embedding: vectorStr,
    match_count: String(limit),
    match_threshold: String(matchThreshold),
    exclude_boletin: excludeBoletin ?? "null",
  });

  return rows.map((row) => row[0]!).filter(Boolean);
}

/**
 * Estrategia 3: RRF (Reciprocal Rank Fusion).
 *
 * Si la query es un número de boletín (3 formatos: 14309-04 / 14309 / 14.309-04):
 *   SHORT-CIRCUIT: devuelve el match exacto desde proyecto.boletin / boletin_num
 *   SIN correr FTS ni semántico NI entrar en la fusión RRF.
 *   Este caso debe ser hit@1 determinístico.
 *
 * Si la query es texto libre:
 *   1. Corre FTS (runFtsOnly)
 *   2. Corre semántico con el vector inyectado (runSemanticOnly)
 *   3. Fusiona con rrf() de 86-01 (NUNCA suma de scores — solo ranks)
 *
 * @param query   - texto de búsqueda
 * @param vector  - embedding L2-normalizado (null para short-circuit de boletín)
 * @param opts    - runner + parámetros RRF
 * @returns boletin[] rankeado
 */
export async function runRrf(
  query: string,
  vector: number[] | null,
  opts: RrfOptions,
): Promise<string[]> {
  const {
    runSql,
    rrfK = 50,
    limit = 20,
    ftsLimit,
    semLimit,
    wFts = 1,
    wSem = 1,
    matchThreshold = 0.59,
    useUnaccent = true,
    excludeBoletin,
  } = opts;
  // Per-arm candidate limits (WR-02): allow independent sizing for honest grid measurement.
  const resolvedFtsLimit = ftsLimit ?? limit;
  const resolvedSemLimit = semLimit ?? limit;

  // SHORT-CIRCUIT de boletín ANTES de cualquier rama (Pitfall #5)
  const boletinMatch = detectarBoletin(query);
  if (boletinMatch !== null) {
    const { base, sufijo } = boletinMatch;
    const full = sufijo !== null ? `${base}-${sufijo}` : base;
    const rows = await runSql(BOLETIN_EXACT_QUERY, {
      full,
      base,
    });
    // Devolver el boletin exacto si existe, o vacío
    return rows.map((row) => row[0]!).filter(Boolean);
  }

  // Texto libre: correr FTS + semántico y fusionar con RRF
  const [ftsResults, semResults] = await Promise.all([
    runFtsOnly(query, { runSql, limit: resolvedFtsLimit, useUnaccent }),
    vector !== null
      ? runSemanticOnly(vector, { runSql, limit: resolvedSemLimit, matchThreshold, excludeBoletin })
      : Promise.resolve<string[]>([]),
  ]);

  // Fusión RRF (NUNCA suma de scores — solo ranks)
  const merged = rrf(ftsResults, semResults, rrfK, wFts, wSem);

  // Limitar al top-limit
  return merged.slice(0, limit);
}
