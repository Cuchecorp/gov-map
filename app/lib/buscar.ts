import "server-only";

import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import type { MatchProyectoRow } from "@/lib/types";

/**
 * Capa de datos de la búsqueda semántica ciudadana (SEM-04), server-only.
 *
 * El embedding de la consulta (`RETRIEVAL_QUERY`) y el kNN (`match_proyectos`)
 * corren EXCLUSIVAMENTE en el servidor: `import "server-only"` impide que este
 * módulo entre al bundle del cliente, y la Gemini key se lee de `process.env`
 * sin prefijo público (T-07-11). `SearchBox` solo navega; jamás llama modelos.
 *
 * Trust boundary navegador → /buscar: `qRaw` es input no confiable. Se trimea y
 * capea a ≤300 chars (T-07-09); el atajo de boletín reusa `BOLETIN_RE` (T-07-10);
 * y `supabase-js .rpc()` PARAMETRIZA el vector — `q` jamás se interpola en SQL.
 *
 * El `similarity` que devuelve el RPC se usa solo para el orden server-side;
 * NUNCA se expone al usuario (UI-SPEC §5).
 */

// Mismo validador que /proyecto/[boletin] (T-07-10 / T-05-09): 3-6 dígitos +
// sufijo opcional "-NN". El atajo redirige a la ficha ANTES de embeber.
// #36: fuente ÚNICA — las páginas /buscar y /proyecto/[boletin] lo importan de aquí
// en vez de redefinirlo (antes triplicado). Sin flag `g` → `.test()` es stateless.
export const BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/;

// Id interno estable de la maestra (0005). El seeder (seed-cli) lo emite con el
// prefijo de cámara + número nativo de la fuente: "D"+dígitos para diputados
// (id_diputado_camara, p.ej. "D1009") y "S"+dígitos para senadores (parlid_senado,
// p.ej. "S1110"). El "P00001" del comentario de 0005 era ilustrativo; la maestra
// real usa D/S. Se admite también "P" por compatibilidad con el esquema documentado.
// Validador ÚNICO del path `[id]` de /parlamentario/[id] (V5 input validation): se
// rechaza cualquier formato no-id ANTES de tocar la DB. `.rpc()` ya parametriza, pero
// el guard temprano evita gastar una consulta en basura del path. Sin flag `g`.
export const PARLAMENTARIO_ID_RE = /^[DSP]\d{3,5}$/;

// Id de contraparte (Phase 16) consumido por /contraparte/[id]: el RPC
// `agregado_por_contraparte` (Plan 16-01) emite ids PREFIJADOS — 'c:<rut_proveedor>'
// (faceta contratos) / 'd:<donante_nombre>' (faceta aportes). El path se valida con
// este regex ANTES de tocar la DB (V5 / T-16-08): se rechaza cualquier id sin el
// prefijo 'c:'/'d:' o con caracteres de control / path-traversal.
//
// WR-02 (Phase 16): el charset usa `\p{L}` (cualquier letra Unicode) con el flag `u`,
// de modo que una razón-social chilena con acentos o ñ ("Constructora Peñalolén",
// "Compañía…", "Logística…") VALIDA en vez de 404ear antes de tocar la DB. Se admiten
// además dígitos (`\p{N}`), espacio, punto, guion, guion bajo y ampersand (`&`, común en
// nombres de empresa). NO admite '/', '\\', saltos de línea ni otros control chars (la
// clase es explícita, no un `.`), y es lineal (un solo `+`, sin backtracking anidado →
// sin ReDoS). Anclado `^…$`. Sin flag `g` → `.test()` es stateless.
export const CONTRAPARTE_ID_RE = /^[cd]:[\p{L}\p{N} .\-_&]+$/u;

/** Cap defensivo de la consulta (V5 input validation). #36: fuente única. */
export const MAX_QUERY_CHARS = 300;

// Contrato del provider de embeddings (gemini-embedding-001, 768, L2, FND-07).
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = "v1beta";

/** Resultado mínimo de un embed: solo el vector (lo único que consume el RPC). */
export interface QueryEmbedding {
  vector: number[];
}

/**
 * Subconjunto del `GeminiEmbeddingProvider` necesario para la búsqueda. Permite
 * inyectar un embedder mockeado en tests (offline, sin red ni key) y mantiene la
 * paridad de contrato con `@obs/llm` (taskType asimétrico SEM-03).
 */
export interface QueryEmbedder {
  embed(
    texts: string[],
    taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  ): Promise<QueryEmbedding[]>;
}

/** Normaliza un vector a norma L2 = 1 (cosine válido a dims != 3072). */
function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/**
 * Embedder Gemini por defecto, server-only. Espeja la llamada REST
 * `batchEmbedContents` del `GeminiEmbeddingProvider` vetado de @obs/llm: la key
 * viaja por header `x-goog-api-key` (NUNCA en URL/body/logs), 768 dims, L2.
 * Se construye perezosamente — solo cuando de verdad hay que embeber (después
 * de los atajos de q-vacía y boletín), así esos caminos no exigen la key.
 */
function defaultEmbedder(): QueryEmbedder {
  return {
    async embed(texts, taskType) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Falta GEMINI_API_KEY en el entorno del servidor para la búsqueda semántica.",
        );
      }
      if (texts.length === 0) return [];

      const url = `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${EMBEDDING_MODEL}:batchEmbedContents`;
      const body = {
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMS,
          ...(taskType ? { taskType } : {}),
        })),
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // NUNCA incluir la key en el mensaje.
        throw new Error(
          `Gemini embeddings request failed: ${res.status} ${res.statusText}`,
        );
      }

      const json = (await res.json()) as {
        embeddings?: { values?: number[] }[];
      };
      const embeddings = json.embeddings ?? [];
      return embeddings.map((e) => {
        const values = e.values ?? [];
        if (values.length !== EMBEDDING_DIMS) {
          throw new Error(
            `Gemini embedding dim mismatch: expected ${EMBEDDING_DIMS}, got ${values.length}`,
          );
        }
        return { vector: l2normalize(values) };
      });
    },
  };
}

export interface BuscarProyectosOptions {
  /** Self-exclusion: excluye el propio boletín (sección "proyectos similares", SEM-05). */
  excludeBoletin?: string;
  /** Umbral mínimo de similitud (server-side; nunca mostrado al usuario). */
  matchThreshold?: number;
  /** Cantidad máxima de vecinos (default 20). */
  matchCount?: number;
  /** Embedder inyectable (tests offline). Default: Gemini REST server-only. */
  embedder?: QueryEmbedder;
}

/**
 * Busca proyectos semánticamente cercanos a `qRaw`.
 *
 * Flujo (server-only): trim + cap ≤300 → si vacía, `[]` (sin embeber ni rpc) →
 * si matchea `BOLETIN_RE`, `redirect(/proyecto/{q})` ANTES de embeber → si no,
 * embed `RETRIEVAL_QUERY` (asimétrico) → `rpc match_proyectos` con el vector
 * parametrizado → filas `(boletin, similarity)`.
 */
export async function buscarProyectos(
  qRaw: string,
  opts: BuscarProyectosOptions = {},
): Promise<MatchProyectoRow[]> {
  const q = qRaw.trim().slice(0, MAX_QUERY_CHARS);
  if (q.length === 0) return [];

  // Atajo: un boletín redirige directo a la ficha, ANTES de gastar un embed.
  if (BOLETIN_RE.test(q)) {
    redirect(`/proyecto/${q}`);
  }

  const embedder = opts.embedder ?? defaultEmbedder();
  const [emb] = await embedder.embed([q], "RETRIEVAL_QUERY");

  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("match_proyectos", {
    query_embedding: emb.vector,
    match_count: opts.matchCount ?? 20,
    match_threshold: opts.matchThreshold ?? 0.0,
    exclude_boletin: opts.excludeBoletin ?? null,
  });

  // Honest degradation: un fallo del RPC (grant/RLS, red, vector malformado,
  // error de Postgres) NO es "sin resultados". Se lanza para que la UI muestre
  // el banner de error (buscar/page.tsx try/catch) en vez de "Sin resultados".
  // El camino [] queda SOLO para resultados genuinamente vacíos.
  if (error) {
    throw new Error(`match_proyectos RPC falló: ${error.message}`);
  }

  return (data as MatchProyectoRow[] | null) ?? [];
}
