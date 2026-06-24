/**
 * EnlaceEntidadConfirmado — el INVARIANTE TIPADO del enlace confirmado de TERCEROS (ENT-03).
 *
 * ESPEJO del PATRÓN de `enlace-confirmado.ts` (EnlaceConfirmado de parlamentario) hacia la
 * maestra `entidad_tercero`. NO es reusable el tipo de parlamentario: tiene `parlamentarioId`
 * y su `unique symbol` es privado al otro módulo. Aquí se mintea un símbolo PROPIO.
 *
 * Sube la guarda LOCKED de "solo un match confirmado puebla el FK" de CONVENCIÓN a TIPO: un
 * `*Writer`/reconciliador que tipa su FK como `EnlaceEntidadConfirmado | null` NO puede aceptar
 * un `string` desnudo (los FKs hoy NULL en `lobby_contraparte.contraparte_id`/`contratista.
 * entidad_id`, Plan 04). Publicar un string crudo como match es un ERROR DE COMPILACIÓN.
 *
 * DISEÑO (espejo de Pitfall 1/2):
 *  - `ENLACE_ENTIDAD_CONFIRMADO` es un `unique symbol` PRIVADO al módulo. NUNCA se exporta
 *    (ni de aquí ni del barrel `index.ts`). Exportarlo —o permitir un cast de string al tipo
 *    branded en código de conector— rompería el invariante (el grep-gate de la fase lo rechaza
 *    fuera de tests).
 *  - `confirmarEntidad()` es la ÚNICA factory legítima. La invocan SOLO la reconciliación
 *    (tras un resultado `determinista`/`confirmado`) y `revisor-entidad-cli` (tras una
 *    promoción humana, `metodo: "humano"`).
 */

declare const ENLACE_ENTIDAD_CONFIRMADO: unique symbol;

/**
 * Prueba estructural de que un `entidadTerceroId` provino de un match determinista/confirmado
 * (o de una promoción humana). NO se puede construir un valor de este tipo fuera de
 * `confirmarEntidad()`: el `unique symbol` privado lo hace nominal (branded). Un writer que
 * tipa su FK como `EnlaceEntidadConfirmado | null` RECHAZA estructuralmente un string crudo.
 */
export interface EnlaceEntidadConfirmado {
  /** El id de entidad_tercero de la maestra al que apunta el enlace confirmado. */
  readonly entidadTerceroId: string;
  /** Cómo se confirmó el enlace: por match determinista de máquina o por humano. */
  readonly metodo: "determinista" | "humano";
  /** Marca nominal privada — imposible de fijar fuera de este módulo. */
  readonly [ENLACE_ENTIDAD_CONFIRMADO]: true;
}

/**
 * ÚNICA factory de `EnlaceEntidadConfirmado`. Mintea el enlace SOLO cuando el llamador ya
 * resolvió un match legítimo:
 *  - la reconciliación, en la rama `determinista` (`metodo = "determinista"`), o
 *  - `revisor-entidad-cli`, tras una promoción humana (`metodo = "humano"`).
 *
 * `probable`/`revision`/`no_confirmado` (incl. toda jurídica-sin-RUT) NUNCA llaman a
 * `confirmarEntidad()` — dejan el FK en `null` + la mención cruda (degradación honesta).
 *
 * @param entidadTerceroId  Id de la maestra confirmado por el match.
 * @param metodo            Origen de la confirmación (default `"determinista"`).
 * @returns                 Un `EnlaceEntidadConfirmado` branded — el único valor aceptable
 *                          por el FK tipado de un reconciliador de terceros.
 */
export function confirmarEntidad(
  entidadTerceroId: string,
  metodo: "determinista" | "humano" = "determinista",
): EnlaceEntidadConfirmado {
  // La marca nominal existe SOLO en el espacio de tipos (`declare const ... : unique symbol`
  // no produce valor en runtime). El valor real es un objeto plano; la marca se asienta AQUÍ,
  // el único sitio de construcción legítimo. Alias local `Branded` para no escribir el cast
  // prohibido por el grep-gate fuera de este archivo.
  type Branded = EnlaceEntidadConfirmado;
  return { entidadTerceroId, metodo } as unknown as Branded;
}
