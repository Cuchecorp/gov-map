/**
 * Tipos del subsistema de adjudicación de identidad asistida (@obs/adjudication).
 *
 * `MencionForanea` es el registro foráneo dudoso a reconciliar contra la maestra
 * (un voto del Senado por nombre, una mención sin id). Por DISEÑO no transporta
 * `rut`: el RUT/dato personal duro se matchea de forma determinista y NUNCA cruza
 * al prompt del LLM (minimización; T-04-02). Solo el nombre tal como aparece,
 * cámara, periodo y región (para el blocking) viajan al adjudicador.
 *
 * `DecisionCompuerta` es la salida de la compuerta fail-closed: o se auto-acepta
 * (con el `chosenId` del candidato elegido) o se enruta a revisión humana con la
 * lista acumulada de razones.
 */

import type { Camara } from "@obs/core";

/**
 * Mención foránea dudosa a adjudicar. SIN `rut` por construcción (T-04-02):
 * solo viajan al LLM el nombre-tal-como-aparece, cámara, periodo y región.
 */
export interface MencionForanea {
  /** Nombre tal como aparece en la fuente foránea (display, p.ej. "Walker P., Matías"). */
  nombreOriginal: string;
  /** Nombre normalizado de la mención (clave de comparación, tokens sin acentos, ñ→n). */
  nombreNormalizado: string;
  /** Tokens del nombre normalizado; `tokens[0]` = primer token de apellido paterno. */
  tokens: string[];
  /** Cámara de origen de la mención (filtro DURO del blocking). */
  camara: Camara;
  /** Periodo/legislatura de la mención (filtro DURO del blocking). */
  periodo: string;
  /** Región (filtro BLANDO/fail-open del blocking: si es null, no filtra por región). */
  region: string | null;
}

/**
 * Decisión de la compuerta fail-closed.
 * - `auto-aceptar`: superó TODAS las reglas duras → vínculo `probable` (NUNCA `confirmado`).
 * - `revision`: al menos una regla falló → cola de revisión humana, con `razones` acumuladas.
 */
export type DecisionCompuerta =
  | { ruta: "auto-aceptar"; chosenId: string }
  | { ruta: "revision"; razones: string[] };
