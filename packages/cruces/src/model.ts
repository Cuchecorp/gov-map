/**
 * @obs/cruces — modelo de salida de la CLASIFICACIÓN DE SECTOR (CRUCE-02).
 *
 * `ClasificacionSectorSchema` es la COMPUERTA DE CONTRATO de la salida untrusted del LLM:
 * a qué macro-sector pertenece un proyecto de ley o una contraparte de lobby. Un único
 * campo:
 *   - `sector_codigo`: UN código de la taxonomía cerrada (`SECTOR_CODIGOS`), o `null` cuando
 *     el modelo NO puede asignar un sector con confianza. La abstención (`null`) es
 *     first-class (D-05/D-08): vale más un null que un sector inventado. NO hay catch-all
 *     'otros' — la ausencia de sector se modela con null en la fila, nunca con una etiqueta
 *     paraguas (espeja `null = honest no-match` de la columna `sector_id` en 0038).
 *
 * El `z.enum(SECTOR_CODIGOS)` cierra la taxonomía: una salida del LLM fuera de los 13
 * códigos es rechazada por el gate (T-36-08). `provider.complete(req, ClasificacionSectorSchema)`
 * aplica esta compuerta (parseAndValidate + repair loop) — NUNCA se hace safeParse propio.
 */

import { z } from "zod";
import { SECTOR_CODIGOS } from "./sector";

/**
 * Clasificación de sector validada por el LLM gate. `sector_codigo` es un código de la
 * taxonomía cerrada o `null` (abstención first-class, D-05/D-08).
 */
export const ClasificacionSectorSchema = z.object({
  // UN código válido de la taxonomía cerrada, o null (abstención, NUNCA un sector inventado).
  sector_codigo: z.enum(SECTOR_CODIGOS).nullable(),
});

/** Clasificación de sector validada por `ClasificacionSectorSchema`. */
export type ClasificacionSector = z.infer<typeof ClasificacionSectorSchema>;
