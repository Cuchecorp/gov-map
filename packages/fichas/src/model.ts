/**
 * @obs/fichas — modelo de salida de la EXTRACCIÓN LITERAL (SEM-02 / guardarraíl #2).
 *
 * `FichaSchema` es la COMPUERTA DE CONTRATO de la salida untrusted del LLM: la ficha
 * estructurada de un proyecto de ley. Solo dos campos, ambos LITERALES:
 *   - `idea_matriz`: cita TEXTUAL de la idea matriz/fundamental, o `null` cuando el texto
 *     no la enuncia explícitamente. La degradación honesta (null) es first-class: vale más
 *     un null que una paráfrasis inventada (riesgo existencial #2). El gate golden verifica
 *     que, cuando no es null, sea SUBSTRING literal del texto fuente.
 *   - `cuerpos_legales`: SOLO las normas (Ley N°, Código, DFL, decreto) citadas textualmente
 *     como afectadas, con sus artículos. Una norma fabricada (no en el texto) es el modo de
 *     fallo existencial → el gate la cuenta como falso positivo.
 *
 * El schema impone límites duros (idea_matriz ≤ 4000 chars, cuerpos ≤ 100) para acotar la
 * salida del modelo; `DeepSeekProvider.complete(req, FichaSchema)` aplica esta compuerta
 * (parseAndValidate + repair loop) — NUNCA se hace safeParse propio (SEM-02).
 */

import { z } from "zod";

/**
 * Una norma legal citada textualmente en el texto fuente, con sus artículos citados.
 * `articulos` por defecto `[]` cuando el texto no detalla artículos (degradación honesta).
 */
export const CuerpoLegalSchema = z.object({
  /** "Ley N° 19.628", "Código del Trabajo", "DFL N° 1" — tal como aparece, ≤ 200 chars. */
  norma: z.string().max(200),
  /** ["artículo 4", "artículo 12 bis"] — citados textualmente. */
  articulos: z.array(z.string().max(50)).max(50).default([]),
});

/** Una norma legal validada por `CuerpoLegalSchema`. */
export type CuerpoLegal = z.infer<typeof CuerpoLegalSchema>;

/**
 * Ficha estructurada de un proyecto de ley (salida de la extracción literal).
 * idea_matriz nullable (degradación honesta first-class) + cuerpos_legales con default [].
 */
export const FichaSchema = z.object({
  // idea matriz = cita textual o null (NUNCA paráfrasis). El gate verifica substring.
  idea_matriz: z.string().max(4000).nullable(),
  cuerpos_legales: z.array(CuerpoLegalSchema).max(100).default([]),
});

/** Ficha validada por `FichaSchema`. */
export type Ficha = z.infer<typeof FichaSchema>;
