/**
 * GUARD NO-RUT (106-02) — escáner estático de PII sobre los bytes de un `casos.json`.
 *
 * Los golden es-CL se construyen NO-PII-por-construcción (§ Sourcing NO-PII del corpus
 * real): idea_matriz/sector/tramitación son datos públicos de proyectos de ley, sin
 * RUT ni identificador personal (T-106-04). Este guard es la compuerta estática: cada
 * `disjuncion.test.ts` corre `contieneRut(readFileSync(casos.json))` y falla ruidoso si
 * un RUT se coló. El corpus de adjudicación queda OFF-LIMITS (golden-1263 intacto).
 *
 * Puro, sin red, sin dependencias. El barrel `src/index.ts` (owner 106-01) ya re-exporta
 * este módulo; 106-02 solo llena el cuerpo.
 */

/**
 * Patrón de RUT chileno: 1–3 dígitos, grupos de miles con punto opcionales, guion y
 * dígito verificador (0–9 o K/k). Cubre las formas formateadas
 * (`12.345.678-9`, `9.876.543-K`) y sin puntos (`12345678-9`). El flag `g` permite
 * reusarlo con `.test`/`.match`; el escáner lo resetea con un `RegExp` local para
 * evitar el estado de `lastIndex` compartido.
 */
export const RUT_RE = /\d{1,3}(?:\.\d{3})*-[\dkK]\b/g;

/**
 * `true` si el texto contiene al menos un RUT chileno bien formado. Reconstruye el
 * `RegExp` sin flag `g` para una evaluación booleana estable (sin estado `lastIndex`).
 */
export function contieneRut(raw: string): boolean {
  return new RegExp(RUT_RE.source).test(raw);
}
