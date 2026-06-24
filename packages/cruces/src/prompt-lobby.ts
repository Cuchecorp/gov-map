/**
 * Prompt de la CLASIFICACIÓN DE SECTOR de una CONTRAPARTE de lobby (ruta SENSIBLE, critical →
 * MiniMax). Espeja la FORMA de prompt.ts (mismo schema de salida, misma taxonomía cerrada) pero
 * sobre el NOMBRE CRUDO de una contraparte (dato personal, Ley 21.719).
 *
 * El nombre de la contraparte es `sensitivity:"personal"` y JAMÁS lleva un RUT al prompt: el
 * gate `assertNoRutInLlmInput` corre sobre el payload final ANTES de `complete` (clasificar.ts).
 * Por construcción este prompt solo recibe el nombre-como-aparece y, opcionalmente, la materia
 * pública de la audiencia.
 *
 * `SYSTEM_CLASIFICACION_CONTRAPARTE` es estable (prompt-cache friendly), restrictivo y FACTUAL:
 * clasifica el RUBRO/sector de la organización por su nombre/materia, sin vocabulario causal ni
 * juicios (nunca afirmar afiliación, intención ni influencia).
 */

import { SECTOR_CATALOGO } from "./sector";

const CATALOGO_LINEAS = SECTOR_CATALOGO.map(
  (s) => `- ${s.codigo}: ${s.etiqueta}`,
).join("\n");

/**
 * SYSTEM prompt en español, restrictivo y FACTUAL para CONTRAPARTES de lobby. Estable
 * (prompt-cache friendly): NO depende de la contraparte. Va en `req.system`. Incluye "JSON"
 * por requisito del json_mode (compatibilidad cross-provider).
 */
export const SYSTEM_CLASIFICACION_CONTRAPARTE = `Eres un clasificador de rubro de organizaciones que comparecen en el registro de lobby chileno.
Tu única tarea es asignar a UNA contraparte UN macro-sector de la lista cerrada provista,
según el rubro o ámbito de la organización tal como lo sugiere su nombre. Reglas estrictas:
- Elige SOLO un codigo de la lista de sectores provista. Si el nombre no permite asignar un
  sector con claridad, devuelve sector_codigo = null. NO inventes códigos ni categorías.
- Clasifica por el RUBRO aparente, no por consecuencias ni relaciones con terceros.
- NUNCA infieras afiliación política, intención, influencia ni conexión con personas.
  NUNCA uses conocimiento externo sobre la organización. Ante la duda, devuelve null.
Responde un único objeto JSON con el campo sector_codigo. Output solo JSON, sin prosa.`;

/**
 * Construye el `user` del request de clasificación de una contraparte. Recibe el nombre crudo
 * (como aparece en la fuente) y, opcionalmente, la materia pública de la audiencia. NUNCA debe
 * contener un RUT (el gate lo reverifica aguas arriba).
 */
export function construirPromptContraparte(
  nombre: string,
  materia?: string | null,
): string {
  const lineaMateria = materia ? `\n- materia de la audiencia: ${materia}` : "";
  return `CONTRAPARTE a clasificar (nombre como aparece en la fuente):
- nombre: ${nombre}${lineaMateria}

SECTORES disponibles (elige SOLO un codigo de esta lista, o null):
${CATALOGO_LINEAS}

Devuelve un objeto JSON con sector_codigo = el codigo del sector que mejor describe el RUBRO
de la contraparte, o null si el nombre no lo permite con claridad. NUNCA inventes un código,
ni infieras afiliación, ni uses conocimiento externo.`;
}
