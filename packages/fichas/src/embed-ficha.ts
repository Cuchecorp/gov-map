/**
 * embed-ficha — composición defensiva del texto a embeber + embedding ASIMÉTRICO (SEM-03).
 *
 * Compone el texto a partir de [título, materia, idea_matriz, cuerpos serializados] FILTRANDO
 * partes null/empty (RESEARCH Pitfall 5): cuando `idea_matriz` es null (texto íntegro no
 * disponible), embebe sobre título+materia — NUNCA un string vacío, NUNCA fabrica contenido.
 * Trunca defensivamente el texto compuesto (Assumption A5) antes de mandarlo a Gemini.
 *
 * Llama `gemini.embed([texto], "RETRIEVAL_DOCUMENT")`: las fichas se indexan como DOCUMENT
 * (escritura); la consulta del usuario va como RETRIEVAL_QUERY (lectura, ola 3). El provider
 * L2-normaliza y estampa model/dims/version (FND-07) — aquí NO se re-normaliza ni re-chequean
 * dims (RESEARCH §"Don't Hand-Roll").
 */

import type { EmbeddingResult } from "@obs/llm";
import type { Proyecto } from "@obs/tramitacion";
import type { Ficha } from "./model";

/** Límite defensivo de caracteres del texto compuesto antes de embed (Assumption A5). */
export const MAX_EMBED_CHARS = 8000;

/** Provider de embeddings con taskType asimétrico (subconjunto de GeminiEmbeddingProvider). */
export interface FichaEmbedder {
  embed(
    texts: string[],
    taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  ): Promise<EmbeddingResult[]>;
}

/** Serializa un cuerpo legal a texto plano ("Ley N° 19.628: artículo 4, artículo 12"). */
function serializarCuerpo(c: Ficha["cuerpos_legales"][number]): string {
  const arts = c.articulos.length > 0 ? `: ${c.articulos.join(", ")}` : "";
  return `${c.norma}${arts}`.trim();
}

/**
 * Compone el texto a embeber filtrando partes null/empty y truncando a MAX_EMBED_CHARS.
 * Orden: título → materia → idea_matriz → cuerpos serializados. Nunca devuelve "" si hay
 * al menos título o materia.
 */
export function componerTextoEmbed(
  proyecto: Pick<Proyecto, "titulo" | "materia">,
  ficha: Ficha,
): string {
  const partes: (string | null | undefined)[] = [
    proyecto.titulo,
    proyecto.materia,
    ficha.idea_matriz,
    ...ficha.cuerpos_legales.map(serializarCuerpo),
  ];

  const texto = partes
    .map((p) => (p == null ? "" : p.trim()))
    .filter((p) => p.length > 0)
    .join("\n");

  return texto.length > MAX_EMBED_CHARS ? texto.slice(0, MAX_EMBED_CHARS) : texto;
}

/**
 * Embebe la ficha de `proyecto` como RETRIEVAL_DOCUMENT y devuelve el EmbeddingResult versionado.
 * El texto se compone defensivamente (título+materia cuando idea_matriz null).
 */
export async function embedFicha(
  proyecto: Pick<Proyecto, "titulo" | "materia">,
  ficha: Ficha,
  gemini: FichaEmbedder,
): Promise<EmbeddingResult> {
  const texto = componerTextoEmbed(proyecto, ficha);
  // Guarda contra el caso degradado total (título+materia null/empty e idea_matriz
  // null → texto compuesto vacío). Mandar "" a Gemini puede 400 o devolver un vector
  // degenerado: se lanza para que el pipeline lo colecte como error por-boletín
  // (no aborta el batch) en vez de persistir un embedding sin contenido semántico.
  if (texto.trim().length === 0) {
    throw new Error(
      "embedFicha: texto compuesto vacío (sin título/materia/idea) — no se embebe",
    );
  }
  const [result] = await gemini.embed([texto], "RETRIEVAL_DOCUMENT");
  if (!result) {
    throw new Error("embedFicha: Gemini no devolvió embedding para el texto compuesto");
  }
  return result;
}
