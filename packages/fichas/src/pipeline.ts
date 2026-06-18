/**
 * pipeline — orquestación reanudable del WRITE-PATH de fichas (SEM-01/02/03).
 *
 * Espeja `runIngest` (packages/tramitacion/src/ingest-run.ts): colaboradores INYECTADOS
 * (obtenerTexto/provider/gemini/writer) + `log` + error-collection-not-abort, devuelve
 * `{ counts, errores }`. Por cada boletín PENDIENTE:
 *   1. obtenerTextoFuente(link)  → texto íntegro (o null = degradación honesta).
 *   2. extraer(texto, proyecto)  → Ficha literal vía DeepSeek (solo si hay texto).
 *   3. componer + embedFicha     → EmbeddingResult RETRIEVAL_DOCUMENT.
 *   4. upsertFicha + upsertEmbedding (idempotente por boletín).
 * Un error en un boletín NO aborta la corrida (se colecta). REANUDABLE: solo procesa
 * estado='pendiente' salvo `reembed` (re-procesa todos). DEGRADACIÓN: texto null → ficha con
 * idea_matriz null + embed sobre título+materia (NUNCA fabrica).
 *
 * Forma de CONVENIENCIA (slice E2E write-half): `correrPipeline({ boletin, titulo, textoFuente,
 * provider })` extrae una sola Ficha literal y la DEVUELVE (sin tocar DB). Sobrecarga detectada
 * por la presencia de `textoFuente` en el nivel superior.
 */

import type { LLMProvider, EmbeddingResult } from "@obs/llm";
import type { Ficha } from "./model";
import { extraer } from "./extraer";
import { embedFicha, type FichaEmbedder } from "./embed-ficha";
import type { FichasWriter, FichaRow, EmbeddingRow } from "./writer-supabase";

/** Versión base del embedding (bump con --reembed para re-embeddizar sin mezclar). */
export const EMBED_VERSION_BASE = "v1";

/** Un proyecto pendiente de procesar (lo provee el caller, p.ej. leyendo proyecto_ficha). */
export interface PipelinePendiente {
  boletin: string;
  titulo: string;
  materia: string | null;
  /** Link al texto íntegro (sidecar SEM-01). null/ausente → degradación honesta. */
  link_mensaje_mocion: string | null;
  /** Estado actual en DB; el pipeline solo procesa 'pendiente' (salvo reembed). */
  estado: "pendiente" | "embebido";
  /** Procedencia inline (provenance) para la fila proyecto_ficha. */
  origen?: string;
  fecha_captura?: string;
}

/** Resultado de obtenerTextoFuente (inyectable; el real vive en texto-fuente.ts). */
export interface TextoFuenteOutput {
  texto: string | null;
  r2Path: string | null;
}

export interface CorrerPipelineBatchOpts {
  /** Proyectos candidatos (el caller ya filtró/leyó de DB). */
  pendientes: PipelinePendiente[];
  /** Recorte del conjunto (alcance acotado). */
  limite?: number;
  /** Re-procesa TODOS (no solo pendientes) y bumpea la versión del embedding. */
  reembed?: boolean;
  /** Descarga del texto íntegro (inyectado; real = obtenerTextoFuente envuelto). */
  obtenerTexto: (link: string | null) => Promise<TextoFuenteOutput>;
  /** Provider de extracción (DeepSeek real / mock). */
  provider: LLMProvider;
  /** Provider de embeddings (Gemini con taskType). */
  gemini: FichaEmbedder;
  /** Writer idempotente (Supabase real / espía). */
  writer: FichasWriter;
  /** Sink de logs. Default: noop. */
  log?: (msg: string) => void;
}

export interface CorrerPipelineResult {
  counts: {
    /** Boletines procesados (intentados, no saltados). */
    procesados: number;
    /** Boletines escritos con embedding. */
    embebidos: number;
    /** Boletines con texto no disponible (idea_matriz null). */
    degradados: number;
  };
  errores: { boletin: string; etapa: string; mensaje: string }[];
}

/** Forma de conveniencia (slice E2E write-half): extrae una Ficha y la devuelve. */
export interface CorrerPipelineUnoOpts {
  boletin: string;
  titulo: string;
  textoFuente: string;
  provider: LLMProvider;
}

/** Discrimina la forma de conveniencia (single-ficha) de la batch. */
function esFormaUno(o: unknown): o is CorrerPipelineUnoOpts {
  return typeof o === "object" && o !== null && "textoFuente" in o;
}

// Sobrecargas: la convenience devuelve Ficha; la batch devuelve {counts, errores}.
export function correrPipeline(opts: CorrerPipelineUnoOpts): Promise<Ficha>;
export function correrPipeline(opts: CorrerPipelineBatchOpts): Promise<CorrerPipelineResult>;
export async function correrPipeline(
  opts: CorrerPipelineUnoOpts | CorrerPipelineBatchOpts,
): Promise<Ficha | CorrerPipelineResult> {
  // ── Forma de conveniencia: extrae una sola Ficha literal y la devuelve (sin DB). ──────────
  if (esFormaUno(opts)) {
    return extraer(
      opts.textoFuente,
      { boletin: opts.boletin, titulo: opts.titulo },
      opts.provider,
    );
  }

  // ── Forma batch: orquesta el write-path reanudable. ───────────────────────────────────────
  const log = opts.log ?? (() => {});
  const errores: CorrerPipelineResult["errores"] = [];
  const version = opts.reembed ? `${EMBED_VERSION_BASE}-reembed` : EMBED_VERSION_BASE;

  // Reanudable: solo pendientes salvo reembed. Recorte acotado.
  let candidatos = opts.reembed
    ? opts.pendientes
    : opts.pendientes.filter((p) => p.estado === "pendiente");
  if (opts.limite != null && opts.limite > 0) {
    candidatos = candidatos.slice(0, opts.limite);
  }

  let procesados = 0;
  let embebidos = 0;
  let degradados = 0;

  for (const p of candidatos) {
    try {
      procesados += 1;

      // 1. Texto íntegro (o null = degradación).
      const { texto, r2Path } = await opts.obtenerTexto(p.link_mensaje_mocion);

      // 2. Extracción literal SOLO si hay texto; sin texto → ficha degradada (idea_matriz null).
      let ficha: Ficha;
      if (texto != null && texto.trim().length > 0) {
        ficha = await extraer(texto, { boletin: p.boletin, titulo: p.titulo }, opts.provider);
      } else {
        ficha = { idea_matriz: null, cuerpos_legales: [] };
        degradados += 1;
      }

      const proyecto = { titulo: p.titulo, materia: p.materia };

      // 3. Embedding asimétrico (sobre idea_matriz si hay; si no, título+materia — nunca fabrica).
      const emb: EmbeddingResult = await embedFicha(proyecto, ficha, opts.gemini);

      // 4. Upsert idempotente por boletín (ficha → embedding).
      const fichaRow: FichaRow = {
        boletin: p.boletin,
        idea_matriz: ficha.idea_matriz,
        cuerpos_legales: ficha.cuerpos_legales,
        texto_r2_path: r2Path,
        estado: "embebido",
        origen: p.origen ?? "fichas-pipeline",
        fecha_captura: p.fecha_captura ?? new Date().toISOString(),
      };
      const embRow: EmbeddingRow = {
        boletin: p.boletin,
        embedding: emb.vector,
        embedding_model: emb.model,
        embedding_dims: emb.dims,
        embedding_version: version,
      };

      await opts.writer.upsertFicha([fichaRow]);
      await opts.writer.upsertEmbedding([embRow]);
      embebidos += 1;
      log(`fichas: ${p.boletin} → embebido (${texto == null ? "degradado/título+materia" : "literal"})`);
    } catch (err) {
      errores.push({
        boletin: p.boletin,
        etapa: "pipeline",
        mensaje: err instanceof Error ? err.message : String(err),
      });
      log(`fichas: ERROR ${p.boletin}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { counts: { procesados, embebidos, degradados }, errores };
}
