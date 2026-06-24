/**
 * Prompt de la CLASIFICACIÓN DE SECTOR de un PROYECTO de ley (ruta pública, bulk → DeepSeek).
 *
 * `SYSTEM_CLASIFICACION_FICHA` es el system prompt estable (prompt-cache friendly: no depende
 * del proyecto concreto): el modelo elige UN macro-sector de la taxonomía cerrada o `null`
 * (abstención). Restrictivo y FACTUAL — clasifica por materia/idea matriz, sin vocabulario
 * causal ni juicios (guardarraíl: nunca afirmar intención/efecto/influencia).
 *
 * `construirPromptFicha(...)` arma el `user` con el contexto público del proyecto. La materia
 * de un proyecto de ley es dato público (boletín/título/idea matriz), sin RUT/PII.
 *
 * `provider.complete(req, ClasificacionSectorSchema)` aplica la compuerta zod (parseAndValidate
 * + repair) y antepone su prefijo estable para prompt-cache — aquí solo se define el contrato
 * del prompt; NUNCA se hace safeParse propio.
 */

import { SECTOR_CATALOGO } from "./sector";

/**
 * Enumera la taxonomía como "codigo: etiqueta" por línea (un solo string estable, derivado
 * del catálogo) para embeber en los prompts. Cambiar la taxonomía cambia ambos prompts a la vez.
 */
const CATALOGO_LINEAS = SECTOR_CATALOGO.map(
  (s) => `- ${s.codigo}: ${s.etiqueta}`,
).join("\n");

/**
 * SYSTEM prompt en español, restrictivo y FACTUAL. Estable (prompt-cache friendly): NO depende
 * del proyecto. Va en `req.system`. Incluye "JSON" por requisito del json_mode de DeepSeek.
 */
export const SYSTEM_CLASIFICACION_FICHA = `Eres un clasificador temático de proyectos de ley chilenos.
Tu única tarea es asignar a UN proyecto de ley UN macro-sector de la lista cerrada provista,
según la MATERIA del proyecto. Reglas estrictas:
- Elige SOLO un codigo de la lista de sectores provista. Si la materia no corresponde con
  claridad a ninguno, devuelve sector_codigo = null. NO inventes códigos ni categorías.
- Clasifica por el TEMA del texto (de qué trata), no por sus posibles consecuencias.
- NUNCA infieras intención, efecto, beneficio, perjuicio ni conexión con personas u
  organizaciones. NUNCA uses conocimiento externo. Ante la duda, devuelve null.
Responde un único objeto JSON con el campo sector_codigo. Output solo JSON, sin prosa.`;

/**
 * Construye el `user` del request de clasificación de un proyecto: contexto público (idea
 * matriz / título / materia) + la taxonomía a elegir. Todos los campos son opcionales: con
 * los que haya, el modelo clasifica; si ninguno orienta, devuelve null (abstención).
 */
export function construirPromptFicha(input: {
  idea_matriz?: string | null;
  titulo?: string | null;
  materia?: string | null;
}): string {
  const contexto = [
    input.idea_matriz ? `- idea matriz: ${input.idea_matriz}` : null,
    input.titulo ? `- título: ${input.titulo}` : null,
    input.materia ? `- materia: ${input.materia}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return `PROYECTO DE LEY a clasificar (materia pública):
${contexto || "- (sin contexto temático disponible)"}

SECTORES disponibles (elige SOLO un codigo de esta lista, o null):
${CATALOGO_LINEAS}

Devuelve un objeto JSON con sector_codigo = el codigo del sector que mejor describe la
MATERIA del proyecto, o null si ninguno corresponde con claridad. NUNCA inventes un código
ni uses conocimiento externo.`;
}
