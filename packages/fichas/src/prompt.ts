/**
 * Prompt de la EXTRACCIÓN LITERAL (SEM-02 / guardarraíl #2: nunca interpretativa).
 *
 * `SYSTEM_EXTRACCION` es el system prompt estable (prompt-cache friendly: no depende del
 * texto fuente), restrictivo y literal: el modelo COPIA lo que aparece explícitamente, y
 * NUNCA resume, parafrasea, infiere intención/efecto/causa, ni conecta hechos. La idea
 * matriz se transcribe textual o se devuelve null; los cuerpos legales solo si se citan.
 *
 * `construirPromptExtraccion(textoFuente, proyecto)` arma el `user` del request con el
 * texto íntegro a extraer + el contexto mínimo del proyecto (boletín/título). Espeja
 * `construirPromptAdjudicacion` de @obs/adjudication (patrón probado).
 *
 * `DeepSeekProvider.complete(req, FichaSchema)` aplica la compuerta zod (parseAndValidate +
 * repair) y antepone su propio prefijo estable para prompt-cache — aquí solo se define el
 * contrato del prompt; NUNCA se hace safeParse propio (SEM-02).
 */

import type { Proyecto } from "@obs/tramitacion";

/**
 * SYSTEM prompt en español, restrictivo y literal (riesgo existencial #2). Estable
 * (prompt-cache friendly): NO depende del texto fuente. Va en `req.system`. Incluye
 * "JSON" por requisito del json_mode de DeepSeek.
 */
export const SYSTEM_EXTRACCION = `Eres un motor de extracción literal sobre el texto de un proyecto de ley chileno.
Tu única tarea es COPIAR información que aparece EXPLÍCITAMENTE en el texto. Reglas estrictas:
- idea_matriz: transcribe TEXTUALMENTE la frase del texto que enuncia la idea matriz/fundamental
  (suele estar tras "idea matriz", "objeto", "tiene por objeto"). Si el texto NO la enuncia
  explícitamente, devuelve null. NUNCA la resumas, parafrasees ni la redactes tú.
- cuerpos_legales: lista SOLO las normas (Ley N°, Código, DFL, decreto) que el texto cita
  textualmente como modificadas/afectadas, con sus artículos citados. Si no cita ninguna, [].
- NUNCA infieras intención, efecto, causa ni conexión entre hechos. NUNCA uses conocimiento
  externo. Si dudas si algo es literal, NO lo incluyas.
Responde un único objeto JSON. Output solo JSON, sin prosa.`;

/**
 * Construye el `user` del request de extracción: contexto mínimo del proyecto
 * (boletín/título, no sensible) + el texto íntegro a extraer literalmente. El texto fuente
 * es público (mensaje/moción), sin RUT/PII — el provider lo verifica (assertNoRutInLlmInput).
 */
export function construirPromptExtraccion(
  textoFuente: string,
  proyecto: Pick<Proyecto, "boletin" | "titulo">,
): string {
  return `PROYECTO DE LEY (contexto, no extraer de aquí):
- boletín: ${proyecto.boletin}
- título: ${proyecto.titulo}

TEXTO FUENTE a extraer (copia literal, nunca parafrasees):
"""
${textoFuente}
"""

Extrae SOLO lo que aparece textualmente en el TEXTO FUENTE. Devuelve un objeto JSON con:
- idea_matriz: la cita TEXTUAL de la idea matriz/objeto, o null si el texto no la enuncia.
- cuerpos_legales: las normas citadas textualmente (norma + artículos), o [] si no hay.
NUNCA resumas, parafrasees, infieras ni uses conocimiento externo.`;
}
