/**
 * Tipos del subsistema de adjudicación de identidad de TERCEROS (@obs/adjudication).
 *
 * ESPEJO de `tipos.ts` (parlamentario) adaptado a la maestra `entidad_tercero`: la mención
 * NO tiene cámara/periodo (claves de blocking de parlamentario) sino el discriminador
 * `tipoEntidad` ('natural'|'juridica'). Como en parlamentario, por DISEÑO no transporta `rut`:
 * el RUT/dato personal duro se matchea de forma determinista y NUNCA cruza al prompt del LLM
 * (minimización; ENT-02).
 */

import type { TipoEntidad } from "@obs/identity";

/**
 * Mención foránea de un tercero a adjudicar (contraparte de lobby, proveedor de contrato).
 * SIN `rut` por construcción (ENT-02): solo viaja al LLM el nombre-tal-como-aparece. El
 * discriminador `tipoEntidad` gobierna la ramificación (una jurídica salta el LLM completo).
 */
export interface MencionEntidadForanea {
  /** Nombre tal como aparece en la fuente foránea (display). */
  nombreOriginal: string;
  /** Nombre normalizado de la mención (clave de comparación; `normalizarNombre` de @obs/core). */
  nombreNormalizado: string;
  /** Discriminador 'natural'|'juridica' — gobierna la rama jurídica-salta-LLM (Δ2). */
  tipoEntidad: TipoEntidad;
}

/**
 * Decisión de la compuerta fail-closed (reusada de `tipos.ts`: `DecisionCompuerta`). Se
 * re-declara aquí por claridad de dominio, pero es estructuralmente idéntica — `aplicarCompuerta`
 * (compuerta.ts) la produce sin cambios sobre `AdjudicacionEntidad`.
 */
export type DecisionCompuertaEntidad =
  | { ruta: "auto-aceptar"; chosenId: string }
  | { ruta: "revision"; razones: string[] };
